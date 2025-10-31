"""
Audio-in / Audio-out coaching using Chat Completions with GPT-4o Audio Preview.

Modes
- stutter: identify all stuttered words/phrases, count total and per-word, and give tips.
- phonology: optionally compare to a ground-truth sentence (JSON) to highlight vowel/phoneme issues and give tips.

Usage
  python -m src.audio_to_audio stutter data/users/input.wav
  python -m src.audio_to_audio phonology data/users/input.wav data/users/truth.json

Requirements
  pip install -U openai requests python-dotenv numpy librosa soundfile

Notes
- The model is hardcoded to "gpt-4o-audio-preview".
- API key is read from .env via config/settings.py.
"""

from __future__ import annotations

import argparse
import base64
import io
import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple

import librosa
import numpy as np
import requests
import soundfile as sf
from openai import OpenAI

from config.settings import get_settings


# Constants
PCM16_MAX = 32767
TARGET_SR = 24000
DEFAULT_VOICE = "alloy"
DEFAULT_FORMAT = "wav"
AUDIO_MODEL = "gpt-4o-audio-preview"


STUTTER_INSTRUCTIONS = (
    "You are Ava, an empathetic speech therapy coach for adults. "
    "Listen to the user's speech and give a brief, supportive spoken reply (4–6 sentences). "
    "Identify every word or short phrase where stuttering occurred and mention them. "
    "Provide counts: the total number of stuttering moments and per‑word counts (e.g., 'I 3×, was 2×'). "
    "Name types when helpful (repetition/block/prolongation) with gentle language. "
    "If uncertain about a word, say 'It sounded like…'. "
    "Then give 1–2 practical tips (e.g., slower phrasing, short pauses, easy onset, light contact, calm breath). "
    "Keep it natural (no bullets) and end with brief encouragement."
)


PHONOLOGY_INSTRUCTIONS = (
    "You are Ava, an empathetic speech therapy coach for adults. "
    "Compare what the user said to the provided ground‑truth sentence (if present) and give a brief, supportive spoken reply (4–6 sentences). "
    "Identify likely phonological or vowel errors: specify affected sounds (e.g., /s/, /r/, clusters like /str/, vowels like /i/, /ɪ/, /æ/), and cite example words. "
    "Use gentle, probabilistic language when unsure (e.g., 'It sounded like…'). "
    "Then give 1–2 practical tips (e.g., a placement cue like tongue tip behind teeth for /t, d/, or a minimal‑pair drill). "
    "Keep it natural (no bullets) and end with brief encouragement."
)


def load_audio_as_pcm16_base64(path: Path) -> str:
    """Load file, convert to mono PCM16 @ 24 kHz, return base64-encoded WAV."""
    y, _ = librosa.load(str(path), sr=TARGET_SR, mono=True)
    if y is None or y.size == 0:
        raise RuntimeError(f"Failed to decode audio: {path}")
    y = np.clip(y, -1.0, 1.0).astype(np.float32)
    pcm16 = (y * PCM16_MAX).astype(np.int16)
    buf = io.BytesIO()
    sf.write(buf, pcm16, TARGET_SR, subtype="PCM_16", format="WAV")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def build_content_blocks(mode: str, instruction_text: str, audio_b64: str, truth_sentence: Optional[str]) -> List[dict]:
    blocks: List[dict] = [{"type": "text", "text": instruction_text}]
    if mode == "phonology" and truth_sentence:
        blocks.append({"type": "text", "text": f"GROUND_TRUTH_SENTENCE:\n{truth_sentence}"})
    blocks.append({"type": "input_audio", "input_audio": {"data": audio_b64, "format": "wav"}})
    return blocks


def call_chat_completions(
    client: OpenAI,
    content_blocks: List[dict],
    *,
    voice: str,
    audio_format: str,
):
    try:
        return client.chat.completions.create(
            model=AUDIO_MODEL,
            modalities=["text", "audio"],
            audio={"voice": voice, "format": audio_format},
            messages=[{"role": "user", "content": content_blocks}],
        )
    except TypeError:
        # Older SDK fallback via raw HTTP
        settings = get_settings()
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.llm_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": AUDIO_MODEL,
            "modalities": ["text", "audio"],
            "audio": {"voice": voice, "format": audio_format},
            "messages": [{"role": "user", "content": content_blocks}],
        }
        r = requests.post(url, headers=headers, json=payload, timeout=120)
        r.raise_for_status()
        return r.json()


def extract_text_and_audio(response) -> Tuple[List[str], bytes]:
    text_parts: List[str] = []
    b64_audio: Optional[str] = None
    # SDK object shape
    try:
        message = response.choices[0].message
        if hasattr(message, "audio") and getattr(message.audio, "data", None):
            b64_audio = message.audio.data
        for block in getattr(message, "content", []) or []:
            t = getattr(block, "type", None)
            if t == "output_audio":
                maybe = getattr(getattr(block, "audio", None), "data", None)
                if maybe:
                    b64_audio = maybe
            elif t == "output_text":
                txt = getattr(block, "text", "")
                if txt:
                    text_parts.append(txt)
    except Exception:
        pass
    # Raw JSON shape
    if b64_audio is None and isinstance(response, dict):
        try:
            msg = response["choices"][0]["message"]
            if isinstance(msg.get("audio"), dict) and msg["audio"].get("data"):
                b64_audio = msg["audio"]["data"]
            for block in msg.get("content", []) or []:
                if block.get("type") == "output_audio":
                    maybe = (block.get("audio") or {}).get("data")
                    if maybe:
                        b64_audio = maybe
                elif block.get("type") == "output_text":
                    txt = block.get("text") or ""
                    if txt:
                        text_parts.append(txt)
        except Exception:
            pass

    if not b64_audio:
        raise RuntimeError("Audio missing in response. Ensure the model supports audio output.")
    audio_bytes = base64.b64decode(b64_audio)
    return text_parts, audio_bytes


def _load_truth_sentence(truth_json_path: Path) -> str:
    with open(truth_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    for key in ("true_sentence", "sentence", "text", "ground_truth", "reference"):
        val = data.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    raise ValueError(
        "Truth JSON must contain a string under one of keys: true_sentence, sentence, text, ground_truth, reference"
    )


def run(mode: str, input_path: Path, truth_json: Optional[Path], *, instruction_override: Optional[str], voice: str, audio_format: str) -> Path:
    settings = get_settings()
    if not settings.llm_api_key:
        raise RuntimeError("OPENAI_API_KEY missing from .env")
    if not input_path.exists():
        raise FileNotFoundError(f"Input audio not found: {input_path}")

    truth_sentence: Optional[str] = None
    if mode == "phonology":
        if truth_json and truth_json.exists():
            truth_sentence = _load_truth_sentence(truth_json)
        else:
            print("ℹ️ No truth JSON provided; the model will infer targets, results may be less precise.")

    instruction_text = (instruction_override or (STUTTER_INSTRUCTIONS if mode == "stutter" else PHONOLOGY_INSTRUCTIONS)).strip()

    client = OpenAI()  # reads OPENAI_API_KEY from env
    audio_b64 = load_audio_as_pcm16_base64(input_path)
    content_blocks = build_content_blocks(mode, instruction_text, audio_b64, truth_sentence)
    response = call_chat_completions(client, content_blocks, voice=voice, audio_format=audio_format)
    text_parts, audio_bytes = extract_text_and_audio(response)

    out_dir = (settings.data_dir / "outputs")
    out_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = out_dir / f"ava_audio_reply_{mode}_{ts}.{audio_format.lower()}"
    with open(out_path, "wb") as f:
        f.write(audio_bytes)

    if text_parts:
        print("\n--- Text Summary ---")
        print("".join(text_parts))
    print(f"✅ Saved audio reply to: {out_path}")
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Audio → Audio coaching with GPT-4o Audio Preview")
    parser.add_argument("mode", choices=["stutter", "phonology"], help="Coaching mode")
    parser.add_argument("input", help="Path to input audio file (mp3/wav)")
    parser.add_argument("truth_json", nargs="?", default=None, help="Optional JSON with ground-truth sentence (phonology mode)")
    parser.add_argument("--instruction", default=None, help="Override system instruction text")
    parser.add_argument("--voice", default=DEFAULT_VOICE, help="Voice for audio reply (default: alloy)")
    parser.add_argument("--format", default=DEFAULT_FORMAT, choices=["wav", "mp3"], help="Output format")
    args = parser.parse_args()

    input_path = Path(args.input)
    truth = Path(args.truth_json) if args.truth_json else None
    run(args.mode, input_path, truth, instruction_override=args.instruction, voice=args.voice, audio_format=args.format)


if __name__ == "__main__":
    main()

