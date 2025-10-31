"""Realtime Ava voice interaction powered by OpenAI's Realtime API."""

from __future__ import annotations

import asyncio
import base64
import json
import signal
import time
import contextlib
import io
from collections import deque
from typing import Any, Awaitable, Callable, Deque, Dict, Optional

import numpy as np
import websockets
from websockets.legacy.client import WebSocketClientProtocol
import sounddevice as sd
import soundfile as sf
from openai import OpenAI

from config.settings import get_settings
from src.acoustic_analysis import analyze_prosody
from src.audio_utils import AudioPlayback, PCM16_MAX, encode_audio_chunk
from src.session_logger import SessionLogger

client: OpenAI | None = None


REALTIME_URI = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview"
BASE_INSTRUCTIONS = """
# Identity
You are Ava, an empathetic speech therapy coach. You are calm, encouraging, and focused on fluency, pacing, and confidence-building for adults who experience stuttering.

# Task
Listen attentively to the user’s speech, analyze their clarity, pacing, and emotional tone, and provide supportive coaching feedback referencing any acoustic cues you receive.

# Demeanor
Patient, upbeat, warm, and non-judgmental. You celebrate progress and gently guide improvements.

# Tone
Conversational, encouraging, and natural. Speak as a supportive coach, not as a clinician or a script.

# Enthusiasm
Moderate enthusiasm. Enough energy to motivate the user, but never overwhelming.

# Formality
Casual-professional. Use approachable language and contractions.

# Emotion
Empathetic and reassuring. Acknowledge effort and emotions the user shares.

# Filler Words
Avoid filler words like “um” and “uh.” Maintain smooth delivery.

# Pacing
Speak slightly slower than average with deliberate pauses between key ideas. Leave a beat before responding so the user feels heard.

# Additional Guidance
- Highlight strengths first, then opportunities to improve.
- Offer 1–2 actionable tips that can be practiced immediately (e.g., breath support, pacing drills, easy onset).
- If the user shares personal feelings or struggles, reflect them compassionately.
- Encourage self-compassion and long-term growth.
- Keep responses under 6 sentences and avoid bullet lists unless the user requests them.
""".strip()


def _build_headers(api_key: str) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {api_key}",
        "OpenAI-Beta": "realtime=v1",
    }


def _features_to_instruction(features: Optional[Dict[str, float]]) -> str:
    if not features:
        return BASE_INSTRUCTIONS

    pause_ratio = features.get("pause_ratio", 0.0)
    num_pauses = features.get("num_pauses", 0.0)
    mean_pause = features.get("mean_pause_s", 0.0)

    return (
        f"{BASE_INSTRUCTIONS}\n\n"
        f"Recent acoustic cues — pitch_mean: {features.get('pitch_mean', 0):.1f} Hz, "
        f"pitch_std: {features.get('pitch_std', 0):.1f} Hz, "
        f"rms_energy: {features.get('rms_energy', 0):.4f}, "
        f"pause_ratio: {pause_ratio:.2f}, "
        f"num_pauses: {num_pauses:.0f}, "
        f"mean_pause_s: {mean_pause:.2f}."
        " Incorporate these observations into your response."
    )


# 🔄 New: load from file instead of mic
async def _file_audio_loop(
    ws: WebSocketClientProtocol,
    file_path: str,
    stop_event: asyncio.Event,
    feature_queue: Deque[Dict[str, float]],
) -> None:
    """Send an audio file to Ava instead of listening from microphone."""

    print(f"🎧 Ava is analyzing your audio file: {file_path}")

    # Load the audio file
    audio, sample_rate = sf.read(file_path, dtype="float32")

    # Convert stereo → mono
    if audio.ndim > 1:
        audio = np.mean(audio, axis=1)

    try:
        features = analyze_prosody(audio, sample_rate)
    except Exception:
        features = {}

    feature_queue.append(features)

    # Encode and send entire audio to Realtime API
    pcm_audio = (audio * PCM16_MAX).astype(np.int16)
    encoded = encode_audio_chunk(pcm_audio)

    print("📤 Sending audio to Ava...")
    await ws.send(json.dumps({"type": "input_audio_buffer.append", "audio": encoded}))
    await ws.send(json.dumps({"type": "input_audio_buffer.commit"}))

    # Ask the Realtime API for response
    response_payload: Dict[str, Any] = {
        "type": "response.create",
        "response": {
            "modalities": ["audio", "text"],
            "instructions": _features_to_instruction(features if features else None),
        },
    }
    await ws.send(json.dumps(response_payload))


async def _receive_loop(
    ws: WebSocketClientProtocol,
    player: AudioPlayback,
    logger: SessionLogger,
    stop_event: asyncio.Event,
    feature_queue: Deque[Dict[str, float]],
    *,
    request_response: Callable[[Dict[str, float] | None], Awaitable[None]],
    fallback_tts: Optional[Callable[[str], None]] = None,
) -> None:
    """Process incoming realtime events: play audio, print text, and log transcripts."""

    assistant_buffer: Dict[str, str] = {}
    assistant_printing = False
    received_audio = False
    latest_text = ""
    response_requested = False

    while not stop_event.is_set():
        try:
            message = await ws.recv()
        except websockets.ConnectionClosed:
            stop_event.set()
            break

        try:
            event = json.loads(message)
        except json.JSONDecodeError:
            print(f"\n⚠️ Failed to decode event: {message[:80]}...")
            continue

        event_type = event.get("type")

        if event_type == "error":
            print(f"\n⚠️ Realtime API error: {event.get('error')}")
            continue

        if event_type == "response.audio.delta":
            audio_bytes = base64.b64decode(event.get("delta", ""))
            player.queue_pcm_bytes(audio_bytes)
            received_audio = True
            continue

        if event_type == "response.delta":
            response_id = event.get("response_id", "default")
            delta = event.get("delta", {})
            for item in delta.get("content", []):
                if item.get("type") == "output_text_delta":
                    text_delta = item.get("text", "")
                    buf = assistant_buffer.setdefault(response_id, "")
                    buf += text_delta
                    assistant_buffer[response_id] = buf
                    if text_delta:
                        if not assistant_printing:
                            print("\n🤖 Ava: ", end="", flush=True)
                            assistant_printing = True
                        print(text_delta, end="", flush=True)
                elif item.get("type") == "output_audio_delta":
                    audio_delta = item.get("audio", "")
                    if audio_delta:
                        player.queue_pcm_bytes(base64.b64decode(audio_delta))
                        received_audio = True
            continue

        if event_type == "response.completed":
            response_id = event.get("response_id", "default")
            text = assistant_buffer.pop(response_id, "").strip()
            if text:
                logger.log(role="assistant", text=text)
            if assistant_printing:
                print()
                assistant_printing = False
            if not received_audio and fallback_tts and text:
                fallback_tts(text)
            stop_event.set()
            continue


async def run_realtime_session() -> None:
    """Main entry point for Ava's realtime coaching session."""

    settings = get_settings()
    api_key = settings.llm_api_key or settings.whisper_api_key
    if not api_key:
        raise RuntimeError("❌ OPENAI_API_KEY not configured. Cannot start realtime session.")

    sessions_dir = settings.data_dir / "sessions"
    logger = SessionLogger(sessions_dir=sessions_dir)

    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()

    def _handle_signal() -> None:
        if not stop_event.is_set():
            print("\n🛑 Stopping realtime session...")
            stop_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _handle_signal)
        except NotImplementedError:
            pass

    try:
        async with websockets.connect(
            REALTIME_URI,
            additional_headers=_build_headers(api_key),
            ping_interval=20,
            max_size=None,
        ) as ws:
            session_update = {
                "type": "session.update",
                "session": {
                    "instructions": BASE_INSTRUCTIONS,
                    "voice": settings.tts_voice,
                    "modalities": ["audio", "text"],
                },
            }
            await ws.send(json.dumps(session_update))

            feature_queue: Deque[Dict[str, float]] = deque()

            async def request_response(features: Dict[str, float] | None) -> None:
                if stop_event.is_set():
                    return
                response_payload: Dict[str, Any] = {
                    "type": "response.create",
                    "response": {
                        "modalities": ["audio", "text"],
                        "instructions": _features_to_instruction(features if features else None),
                    },
                }
                await ws.send(json.dumps(response_payload))

            def fallback_tts(text: str) -> None:
                if client is None:
                    return
                try:
                    with client.audio.speech.with_streaming_response.create(
                        model=settings.tts_model,
                        voice=settings.tts_voice,
                        input=text,
                        response_format="wav",
                    ) as response:
                        data = io.BytesIO(response.read())
                        data.seek(0)
                        audio, sr = sf.read(data, dtype="float32")
                        sd.play(audio, sr)
                        sd.wait()
                except Exception as exc:
                    print(f"⚠️ Fallback TTS failed: {exc}")

            audio_file_path = "data/outputs/feedback_20251025_210747.mp3"

            with AudioPlayback(sample_rate=24000) as player:
                file_task = asyncio.create_task(
                    _file_audio_loop(
                        ws,
                        audio_file_path,
                        stop_event,
                        feature_queue,
                    )
                )

                receive_task = asyncio.create_task(
                    _receive_loop(
                        ws,
                        player,
                        logger,
                        stop_event,
                        feature_queue,
                        request_response=request_response,
                        fallback_tts=fallback_tts,
                    )
                )

                done, pending = await asyncio.wait(
                    {file_task, receive_task},
                    return_when=asyncio.ALL_COMPLETED,
                )

                for task in pending:
                    task.cancel()
                    with contextlib.suppress(asyncio.CancelledError):
                        await task

                for task in done:
                    if task.exception():
                        raise task.exception()

    except Exception as exc:
        print(f"⚠️ Realtime session failed: {exc}")
        print("➡️ Falling back to Whisper + GPT pipeline.")
        from src.main import main as fallback_main
        fallback_main()
        return
    finally:
        saved_path = logger.save()
        print(f"🗂 Session log saved to {saved_path}")


def main() -> None:
    settings = get_settings()
    api_key = settings.llm_api_key or settings.whisper_api_key
    if not api_key:
        raise RuntimeError("❌ OPENAI_API_KEY not configured. Cannot start realtime session.")

    global client
    client = OpenAI(api_key=api_key)

    try:
        asyncio.run(run_realtime_session())
    except KeyboardInterrupt:
        print("\n🛑 Session interrupted by user.")


if __name__ == "__main__":
    main()
