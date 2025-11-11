"""Simple file-based coaching pipeline (no Realtime API).

Flow:
- Loads API keys from .env via config/settings
- Takes an input audio file (mp3/wav)
- Transcribes with Whisper
- Generates a short coaching reply using your instruction
- Synthesizes the reply to an audio file (MP3)
"""

from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path
from typing import Optional

from openai import OpenAI

from config.settings import get_settings
from src.speech_recognition import transcribe_audio
from src.text_to_video import tts_to_audio


BASE_INSTRUCTIONS = (
    "You are Ava, an empathetic speech therapy coach for adults. "
    "Your goal is to support smoother, more confident speech while keeping guidance simple and immediately useful.\n\n"
    "Tone: warm, encouraging, and non-judgmental. Avoid medical claims or diagnosis.\n"
    "Style: conversational, and specific to what the person likely attempted to say.\n"
    "Order: 1) brief encouragement, 2) 1–2 strengths, 3) 1–2 focused tips, 4) short motivation.\n\n"
    "If signs of stuttering (repetitions, blocks, prolongations) are present:\n"
    "- Normalize the effort and reduce pressure.\n"
    "- Suggest pacing (short pauses), easy onset (soft start of airflow/voice), and gentle breath support.\n"
    "- Offer one simple drill (e.g., say the first word softly on a calm exhale, then continue).\n\n"
    "If signs of phonological/articulation difficulty (sound substitutions, cluster reductions) are present:\n"
    "- Keep feedback supportive and concrete (no jargon).\n"
    "- Suggest a specific placement cue (e.g., tongue tip behind teeth for /t, d/) or a quick minimal-pair practice.\n"
    "- Encourage slow, clear syllables and short phrases.\n\n"
    "Always avoid bullet lists unless explicitly requested.\n"
    "Never over-correct; give only 1–2 tips the person can try right now."
)


def generate_coach_reply(transcript: str, instruction: str, *, client: OpenAI, model: str) -> str:
    messages = [
        {"role": "system", "content": instruction},
        {
            "role": "user",
            "content": (
                "Here is the user transcript. Provide your spoken coaching feedback based on the instruction.\n\n"
                f"TRANSCRIPT:\n{transcript}\n\n"
                "Keep it supportive, specific, and actionable."
            ),
        },
    ]
    resp = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.5,
    )
    return resp.choices[0].message.content or ""


def run(input_path: Path, instruction: Optional[str]) -> Path:
    settings = get_settings()

    if not settings.llm_api_key:
        raise RuntimeError("OPENAI_API_KEY not configured in .env")
    if not settings.whisper_api_key:
        # Many accounts use the same key for both; fall back to llm_api_key
        pass

    if not input_path.exists():
        raise FileNotFoundError(f"Input audio not found: {input_path}")

    # Step 1: Transcribe
    print(f"🎧 Transcribing: {input_path}")
    transcript = transcribe_audio(input_path)
    if not transcript or transcript.startswith("Error"):
        raise RuntimeError("Transcription failed; see logs above.")

    # Step 2: Generate coaching reply text
    client = OpenAI(api_key=settings.llm_api_key)
    system_instruction = (instruction or BASE_INSTRUCTIONS).strip()
    print("🧠 Generating coaching reply text…")
    reply_text = generate_coach_reply(transcript, system_instruction, client=client, model=settings.llm_model)

    # Step 3: Synthesize to audio
    outputs = settings.data_dir / "outputs"
    outputs.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_audio = outputs / f"ava_coach_reply_{ts}.mp3"
    print("🔊 Synthesizing reply to audio…")
    tts_to_audio(reply_text, out_audio, voice=None, response_format="mp3")
    print(f"✅ Saved: {out_audio}")
    return out_audio


def main() -> None:
    parser = argparse.ArgumentParser(description="File-based coaching (Ava) – no realtime")
    parser.add_argument("--input", required=False, default=None, help="Path to input audio file (mp3/wav)")
    parser.add_argument("--instruction", required=False, default=None, help="Override system instruction")
    args = parser.parse_args()

    settings = get_settings()
    default_audio = settings.data_dir / "users" / "stutter_sampe1.mp3"
    input_path = Path(args.input) if args.input else default_audio

    run(input_path, args.instruction)


if __name__ == "__main__":
    main()
