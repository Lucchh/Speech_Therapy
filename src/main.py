"""Main entry point for the AI Speech Therapy Agent."""

from pathlib import Path
from datetime import datetime
from src.speech_recognition import transcribe_audio
from src.feedback_agent import generate_feedback
from src.text_to_video import (
    feedback_json_to_script,
    tts_to_audio,
)

def run_session():
    """Run one complete speech therapy session: transcribe → analyze → feedback."""
    
    # 1️⃣ Locate audio file
    audio_file = Path("data/users/stutter_sampe1.mp3")  # adjust if renamed
    
    print(f"🎧 Processing audio: {audio_file}")
    
    # 2️⃣ Transcribe using Whisper
    transcript = transcribe_audio(audio_file)
    print("\n🗣 Transcript:")
    print(transcript)
    
    # 3️⃣ Generate feedback with Ava (LLM)
    user_profile = {"goal": "fluency improvement"}
    feedback = generate_feedback(user_profile, transcript)
    
    print("\n💬 Ava's Feedback JSON:")
    print(feedback)

    # 4️⃣ Convert feedback to narration script → synthesize audio only
    print("\n🔊 Creating narrated feedback audio...")
    script_text = feedback_json_to_script(feedback)

    outputs_dir = Path("data/outputs")
    outputs_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")

    audio_out = outputs_dir / f"feedback_{ts}.mp3"

    try:
        tts_to_audio(script_text, audio_out, voice=None, response_format="mp3")
        print(f"✅ Audio saved: {audio_out}")
    except Exception as e:
        print(f"⚠️ Failed to create audio narration: {e}")


if __name__ == "__main__":
    run_session()
