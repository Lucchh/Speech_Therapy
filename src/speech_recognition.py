import openai
from config.settings import get_settings
from pathlib import Path
from typing import Optional

# Load API keys and model info
settings = get_settings()
openai.api_key = settings.whisper_api_key


def transcribe_audio(audio_path: Path, *, language: Optional[str] = None) -> str:
    """
    Transcribe an audio file into text using the OpenAI Whisper API.
    
    Args:
        audio_path: Path to the audio file (.wav or .mp3)
        language: Optional language code (default: English)
    Returns:
        The recognized transcript text.
    """
    if not audio_path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    try:
        with open(audio_path, "rb") as audio_file:
            # Call the Whisper API for transcription
            transcript = openai.audio.transcriptions.create(
                model=settings.whisper_model,
                file=audio_file,
                language=language or "en"
            )
        print("✅ Transcription complete.")
        return transcript.text

    except Exception as e:
        print(f"⚠️ Whisper transcription failed: {e}")
        return "Error: Could not transcribe audio."


# Run test if executed directly
if __name__ == "__main__":
    test_path = Path("data/users/stutter_sampe1.mp3")  # adjust filename to match yours
    print(f"🎧 Transcribing: {test_path}")
    result = transcribe_audio(test_path)
    print("🗣 Transcript:\n", result)
