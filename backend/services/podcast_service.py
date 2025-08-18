# backend/services/podcast_service.py
import os
import re
import uuid
from pathlib import Path
from typing import List, Optional

from .tts import generate_audio
try:
    from pydub import AudioSegment  # type: ignore
    _HAS_PYDUB = True
except Exception:
    _HAS_PYDUB = False

APP_ROOT = Path(__file__).resolve().parent.parent
STATIC_DIR = APP_ROOT / "static"
STATIC_DIR.mkdir(exist_ok=True)

_SENT_SPLIT = re.compile(r"(?<=[\.\!\?])\s+")


def _split_sentences(text: str) -> List[str]:
    s = re.sub(r"\s+", " ", (text or "").strip())
    if not s:
        return []
    return [x.strip() for x in _SENT_SPLIT.split(s) if x.strip()]


def synthesize_podcast(
    script_text: str,
    voice: Optional[str] = None,
    provider: Optional[str] = None,
    rate: Optional[int] = None,   # used by local/espeak via ESPEAK_SPEED
    volume: Optional[float] = None,
    speakers: int = 1,
    voices: Optional[List[str]] = None,
) -> str:
    """
    Create podcast mp3 under backend/static and return filename.
    - speakers == 1: single pass TTS
    - speakers > 1 : alternate SENTENCES across provided voices and merge (needs pydub+ffmpeg).
      If deps are missing, we gracefully FALL BACK to single-voice (no error popup).
    """
    STATIC_DIR.mkdir(exist_ok=True)
    out_name = f"podcast_{uuid.uuid4().hex}.mp3"
    out_path = STATIC_DIR / out_name

    # allow rate override for local provider (espeak-ng)
    if rate:
        os.environ.setdefault("ESPEAK_SPEED", str(rate))

    provider_eff = provider or os.getenv("TTS_PROVIDER", "gcp")
    print(f"[podcast] TTS provider={provider_eff}")

    def _single_voice(reason: str, pick_voice: Optional[str] = None):
        print(f"[podcast] falling back to single-voice ({reason}); voice={pick_voice or voice or '(default)'}; words={len(script_text.split())}")
        generate_audio(script_text, str(out_path), provider=provider_eff, voice=(pick_voice or voice))
        return out_name

    # Single voice path
    if speakers <= 1:
        print(f"[podcast] single-voice; voice={voice or '(default)'}; words={len(script_text.split())}")
        generate_audio(script_text, str(out_path), provider=provider_eff, voice=voice)
        return out_name

    # Multi-voice desired:
    if not _HAS_PYDUB:
        # Graceful fallback instead of raising
        first = (voices[0] if voices else None)
        return _single_voice("pydub not importable", pick_voice=first)

    if not voices or len(voices) < 2:
        voices = ["en-US-Neural2-F", "en-US-Neural2-D"]

    sentences = _split_sentences(script_text)
    if not sentences:
        return _single_voice("no sentence segmentation", pick_voice=voices[0])

    print(f"[podcast] multi-voice; speakers={speakers}; voices={voices}; sentences={len(sentences)}; words={len(script_text.split())}")

    parts = []
    try:
        for i, sent in enumerate(sentences):
            v = voices[i % len(voices)]
            part_path = out_path.with_name(out_path.stem + f".s{i}.mp3")
            generate_audio(sent, str(part_path), provider=provider_eff, voice=v)
            parts.append(part_path)

        # Try merging with ffmpeg/pydub
        combined = None
        for p in parts:
            seg = AudioSegment.from_file(str(p), format="mp3")
            combined = seg if combined is None else combined + seg
        combined.export(str(out_path), format="mp3")

    except Exception as e:
        # If ffmpeg missing or merge fails, fall back to single-voice full script
        print(f"[podcast] multi-merge failed ({type(e).__name__}: {e}); falling back to single-voice.")
        return _single_voice("ffmpeg/pydub merge failure", pick_voice=voices[0])
    finally:
        for p in parts:
            try:
                p.unlink()
            except Exception:
                pass

    print(f"[podcast] wrote {out_name}")
    return out_name
