# backend/tts_utils.py
import os
from google.cloud import texttospeech
from dotenv import load_dotenv
from datetime import datetime

# Load .env
load_dotenv()

def init_tts_client():
    """Initialize Google Cloud TTS client."""
    creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if not creds_path or not os.path.exists(creds_path):
        raise RuntimeError(f"Service account file not found: {creds_path}")
    return texttospeech.TextToSpeechClient()

def synthesize_text(text, output_dir="static"):
    """Convert text to speech using Google Cloud TTS and save to file."""
    client = init_tts_client()

    # Get voice + language from env
    language_code = os.getenv("GCP_TTS_LANGUAGE", "en-US")
    voice_name = os.getenv("GCP_TTS_VOICE", "en-US-Neural2-F")

    input_text = texttospeech.SynthesisInput(text=text)

    voice = texttospeech.VoiceSelectionParams(
        language_code=language_code,
        name=voice_name
    )

    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3
    )

    # Call the API
    response = client.synthesize_speech(
        input=input_text, voice=voice, audio_config=audio_config
    )

    # Ensure static dir exists
    os.makedirs(output_dir, exist_ok=True)

    # Unique filename
    filename = f"podcast_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp3"
    filepath = os.path.join(output_dir, filename)

    with open(filepath, "wb") as out:
        out.write(response.audio_content)

    return filepath
