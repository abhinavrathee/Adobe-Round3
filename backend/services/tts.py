# backend/services/tts.py
import os
import re
import uuid
import base64
import requests
from pathlib import Path
from typing import List, Optional

# Optional pydub (for high-fidelity merges). We’ll fall back to simple MP3 concat if missing.
try:
    from pydub import AudioSegment  # type: ignore
    _HAS_PYDUB = True
except Exception:
    _HAS_PYDUB = False

# ------------------ Helpers ------------------

def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except Exception:
        return default

def _chunk_text_by_chars(text: str, max_chars: int) -> List[str]:
    """Split text into chunks <= max_chars, respecting whitespace when possible."""
    import re as _re
    if len(text) <= max_chars:
        return [text]
    tokens = _re.findall(r"\S+\s*", text)
    out, cur = [], ""
    for tok in tokens:
        if len(cur) + len(tok) <= max_chars:
            cur += tok
        else:
            if cur.strip():
                out.append(cur.strip())
                cur = ""
            if len(tok) > max_chars:
                # hard split very long token
                start = 0
                while start < len(tok):
                    part = tok[start:start + max_chars].strip()
                    if part:
                        out.append(part)
                    start += max_chars
            else:
                cur = tok
    if cur.strip():
        out.append(cur.strip())
    return out

# ------------------ Providers ------------------

def _gcp_tts(text: str, output_file: str, voice: Optional[str]) -> str:
    """Synthesize with Google Cloud TTS using service account credentials."""
    from google.cloud import texttospeech  # type: ignore

    language = os.getenv("GCP_TTS_LANGUAGE", "en-US")
    gcp_voice = voice or os.getenv("GCP_TTS_VOICE", "en-US-Neural2-F")

    client = texttospeech.TextToSpeechClient()
    inp = texttospeech.SynthesisInput(text=text)
    voice_params = texttospeech.VoiceSelectionParams(language_code=language, name=gcp_voice)
    audio_cfg = texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.MP3)

    resp = client.synthesize_speech(input=inp, voice=voice_params, audio_config=audio_cfg)
    Path(output_file).parent.mkdir(parents=True, exist_ok=True)
    with open(output_file, "wb") as f:
        f.write(resp.audio_content)
    return output_file


def _azure_tts(text: str, output_file: str, voice: Optional[str]) -> str:
    """Synthesize with Azure OpenAI TTS (only used if provider='azure')."""
    api_key = os.getenv("AZURE_TTS_KEY")
    endpoint = os.getenv("AZURE_TTS_ENDPOINT")
    deployment = os.getenv("AZURE_TTS_DEPLOYMENT", "tts")
    voice = voice or os.getenv("AZURE_TTS_VOICE", "alloy")
    api_version = os.getenv("AZURE_TTS_API_VERSION", "2025-03-01-preview")

    if not api_key or not endpoint:
        raise RuntimeError("Azure TTS: set AZURE_TTS_KEY and AZURE_TTS_ENDPOINT in backend/.env")

    headers = {"api-key": api_key, "Content-Type": "application/json"}
    payload = {"model": deployment, "input": text, "voice": voice}
    url = f"{endpoint}/openai/deployments/{deployment}/audio/speech?api-version={api_version}"
    r = requests.post(url, headers=headers, json=payload, timeout=60)
    r.raise_for_status()
    with open(output_file, "wb") as f:
        f.write(r.content)
    return output_file


def _local_espeak(text: str, output_file: str, voice: Optional[str]) -> str:
    """Very simple local TTS using espeak-ng -> WAV -> MP3 (requires pydub/ffmpeg for MP3)."""
    import subprocess
    espeak_voice = voice or os.getenv("ESPEAK_VOICE", "en")
    espeak_speed = os.getenv("ESPEAK_SPEED", "150")
    wav_path = output_file.replace(".mp3", ".wav")
    cmd = ["espeak-ng", "-v", espeak_voice, "-s", str(espeak_speed), "-w", wav_path, text]
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if res.returncode != 0:
        raise RuntimeError(res.stderr or "espeak-ng failed")
    if output_file.lower().endswith(".mp3"):
        if not _HAS_PYDUB:
            # naive fallback: leave WAV if pydub missing
            Path(wav_path).rename(output_file.replace(".mp3", ".wav"))
            return output_file.replace(".mp3", ".wav")
        from pydub import AudioSegment  # type: ignore
        AudioSegment.from_wav(wav_path).export(output_file, format="mp3")
        try: Path(wav_path).unlink()
        except Exception: pass
        return output_file
    Path(wav_path).rename(output_file)
    return output_file

# ------------------ Chunking / Merge ------------------

def _cloud_tts_chunked(text: str, output_file: str, provider: str, voice: Optional[str], max_chars: int) -> str:
    """Chunk long text for GCP/Azure and merge into output_file."""
    chunks = _chunk_text_by_chars(text, max_chars)
    out = Path(output_file)
    out.parent.mkdir(parents=True, exist_ok=True)
    temp_files: List[str] = []

    try:
        for i, ch in enumerate(chunks):
            tmp = str(out.with_name(out.stem + f".part{i}.mp3"))
            if provider == "gcp":
                _gcp_tts(ch, tmp, voice)
            else:
                _azure_tts(ch, tmp, voice)
            temp_files.append(tmp)

        if _HAS_PYDUB:
            combined = None
            for t in temp_files:
                seg = AudioSegment.from_file(t, format="mp3")
                combined = seg if combined is None else combined + seg
            combined.export(str(out), format="mp3")
        else:
            # Naive MP3 concat; works for most players since MP3 frames are self-contained
            with open(str(out), "wb") as w:
                for t in temp_files:
                    with open(t, "rb") as r:
                        w.write(r.read())
        return str(out)
    finally:
        for t in temp_files:
            try:
                os.remove(t)
            except Exception:
                pass

# ------------------ Public API ------------------

def generate_audio(text: str, output_file: str, provider: Optional[str] = None, voice: Optional[str] = None) -> str:
    """
    Unified entry point:
      - provider: 'gcp' | 'azure' | 'local' (defaults to env TTS_PROVIDER or 'local')
      - output_file: final MP3/WAV path
    """
    if not text or not text.strip():
        raise ValueError("Text cannot be empty")
    prov = (provider or os.getenv("TTS_PROVIDER", "local")).lower()

    # Effective chunking setting
    max_chars_env = _env_int("TTS_CLOUD_MAX_CHARS", 3000)
    # Guard: if user disabled chunking but text exceeds GCP/Azure 5k limit, force chunking anyway.
    if prov in ("gcp", "azure"):
        if max_chars_env <= 0 and len(text) > 4800:
            max_chars_env = 3000  # safe default
        if max_chars_env > 0 and len(text) > max_chars_env:
            return _cloud_tts_chunked(text, output_file, prov, voice, max_chars_env)

    if prov == "gcp":
        return _gcp_tts(text, output_file, voice)
    if prov == "azure":
        return _azure_tts(text, output_file, voice)
    # local
    return _local_espeak(text, output_file, voice)
