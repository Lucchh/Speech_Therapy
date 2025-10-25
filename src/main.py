"""Main entry point for the AI Speech Therapy Agent."""

from pathlib import Path
from src.speech_recognition import transcribe_audio
from src.feedback_agent import generate_feedback

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


if __name__ == "__main__":
    run_session()
