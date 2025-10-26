"""Main entry point for the AI Speech Therapy Agent."""

from datetime import datetime
from pathlib import Path

from src.acoustic_analysis import analyze_acoustics, format_acoustic_summary
from src.feedback_agent import generate_feedback
from src.speech_recognition import transcribe_audio
from src.text_to_video import feedback_json_to_script, tts_to_audio


def run_session():
    """Run one speech therapy session: transcribe, analyze, feedback, narrate."""

    # --- Step 1: Locate audio file ---
    audio_file = Path("data/users/stutter_sampe1.mp3")  # adjust filename if needed
    print(f"\n🎧 Processing audio file: {audio_file}")

    if not audio_file.exists():
        print(f"❌ Audio file not found at {audio_file}")
        return

    # --- Step 2: Transcribe using Whisper ---
    print("\n📝 Transcribing speech...")
    transcript = transcribe_audio(audio_file)
    if "Error" in transcript:
        print("❌ Transcription failed. Ending session early.")
        return

    print("\n🗣 Transcript:")
    print(transcript)

    # --- Step 3: Acoustic analysis ---
    print("\n🔍 Running acoustic-prosodic analysis...")
    acoustic_features = analyze_acoustics(audio_file)
    print("\n📊 Acoustic Analysis Summary:")
    print(format_acoustic_summary(acoustic_features))

    # --- Step 4: Generate LLM (Ava) feedback ---
    print("\n🤖 Generating personalized feedback with Ava...")
    user_profile = {"goal": "fluency improvement"}
    feedback = generate_feedback(
    user_profile=user_profile,
    transcript=transcript,
    acoustic_features=acoustic_features, 
)

    print("\n💬 Ava's Feedback JSON:")
    print(feedback)

    # --- Step 5: Convert feedback to narration script and synthesize audio ---
    print("\n🎙 Creating narrated feedback audio...")
    script_text = feedback_json_to_script(feedback)

    outputs_dir = Path("data/outputs")
    outputs_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")

    audio_out = outputs_dir / f"feedback_{ts}.mp3"
    feedback_file = outputs_dir / f"feedback_{ts}.json"

    # Save feedback JSON for future contextual prompting (MCP)
    try:
        with open(feedback_file, "w") as f:
            f.write(feedback)
        print(f"📝 Feedback JSON saved to: {feedback_file}")
    except Exception as e:
        print(f"⚠️ Could not save feedback JSON: {e}")

    # Synthesize audio narration
    try:
        tts_to_audio(script_text, audio_out, voice=None, response_format="mp3")
        print(f"🔊 Audio feedback saved to: {audio_out}")
    except Exception as e:
        print(f"⚠️ Failed to create audio narration: {e}")

    # --- Step 6: Display final session summary ---
    print("\n✅ Session complete!")
    print("──────────────────────────────────────────────")
    print(f"🎧 Audio analyzed: {audio_file.name}")
    print(f"🕒 Duration: {acoustic_features.get('duration_s', 0):.2f}s")
    print(f"🗣 Speech rate: {acoustic_features.get('speech_rate', 0):.2f} words/min")
    print(f"🤫 Pause ratio: {acoustic_features.get('pause_ratio', 0):.2f}")
    print(f"🎵 Pitch mean: {acoustic_features.get('pitch_mean', 0):.2f} Hz")
    print(f"🎶 Pitch variability: {acoustic_features.get('pitch_std', 0):.2f} Hz")
    print("──────────────────────────────────────────────")
    print("💬 Ava’s feedback and narrated audio have been saved for review.")


if __name__ == "__main__":
    run_session()
