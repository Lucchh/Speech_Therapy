import os, sys, json, base64, subprocess, threading, time
import websocket  # pip install websocket-client

API_KEY = os.environ.get("OPENAI_API_KEY")
MODEL = os.environ.get("REALTIME_MODEL", "gpt-4o-realtime-preview")
URL = f"wss://api.openai.com/v1/realtime?model={MODEL}"

HEADERS = [
    f"Authorization: Bearer {API_KEY}",
    "OpenAI-Beta: realtime=v1",
]

# ---- globals ----
text_buf = []
tool_args_buf = []
awaiting_response = False          # blocks overlapping response.create
buffer_committed = False           # flips True when server confirms commit
response_sent = False              # ensure we trigger once

SAMPLE_RATE = 16000
BYTES_PER_SAMPLE = 2
MIN_MS = 100
MIN_BYTES = SAMPLE_RATE * BYTES_PER_SAMPLE * MIN_MS // 1000  # 3200

# ---- ffmpeg: mp3/wav/etc -> raw PCM16 mono 16kHz bytes ----
def to_pcm16_16k_mono_bytes(path: str) -> bytes:
    cmd = [
        "ffmpeg","-nostdin","-hide_banner","-loglevel","error",
        "-i", path, "-f", "s16le", "-ac", "1", "-ar", "16000", "pipe:1"
    ]
    try:
        data = subprocess.check_output(cmd)
    except FileNotFoundError:
        raise SystemExit("❌ ffmpeg not found on PATH.")
    except subprocess.CalledProcessError as e:
        raise SystemExit(f"❌ ffmpeg failed to decode '{path}': {e}")
    return data

def create_response(ws):
    """Ask the model to compare the audio against the provided target sentence and return JSON."""
    global awaiting_response, response_sent
    if awaiting_response:
        print("⏳ Skipping response.create — previous response still running.")
        return

    ws.send(json.dumps({
        "type": "response.create",
        "response": {
            "modalities": ["text"],

            # Force a function call that returns structured feedback
            "tool_choice": { "type": "function", "name": "pronunciation_feedback" },

            # Keep tool in scope for this turn too
            "tools": [{
                "type": "function",
                "name": "pronunciation_feedback",
                "description": "Compare the audio to the given target sentence and return concise, actionable pronunciation feedback.",
                "parameters": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["summary","differences","practice_tips","scores"],
                    "properties": {
                        "summary": { "type": "string", "description": "One-sentence summary of how close the audio was to the target." },
                        "scores": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "pronunciation": { "type": "integer", "minimum": 0, "maximum": 100 },
                                "intelligibility": { "type": "integer", "minimum": 0, "maximum": 100 }
                            }
                        },
                        "differences": {
                            "type": "array",
                            "description": "Concrete differences between the audio and the target (subs/ins/dels, stress, rhythm, vowels, consonants).",
                            "items": {
                                "type": "object",
                                "additionalProperties": False,
                                "required": ["type","reference","observed","note"],
                                "properties": {
                                    "type": { "type": "string", "enum": ["substitution","deletion","insertion","stress","rhythm","intonation"] },
                                    "reference": { "type": "string", "description": "Word/phoneme in target" },
                                    "observed":  { "type": "string", "description": "What was heard" },
                                    "note":      { "type": "string", "description": "Very short explanation" }
                                }
                            }
                        },
                        "practice_tips": {
                            "type": "array",
                            "items": { "type": "string" },
                            "minItems": 2, "maxItems": 6
                        }
                    }
                }
            }],

            "instructions": (
                "You will see a target sentence as user text and the user's spoken audio as a committed buffer. "
                "Compare the pronunciation to the target strictly at the word/phoneme/stress level. "
                "Identify likely substitutions (e.g., /r/→/w/), deletions (final consonants), insertions, stress/rhythm/intonation mismatches. "
                "Base judgments on careful listening; if uncertain, hedge (e.g., 'likely ...'). "
                "Return ONLY the function call with concise, actionable feedback and short tips. Always respond in English."
            )
        }
    }))
    response_sent = True
    print("🤖 Requested pronunciation feedback…")

# ---- WebSocket events ----
def on_open(ws):
    # 0) args
    if len(sys.argv) < 3:
        print("Usage: python realtime_pronunciation_feedback.py <audio_path> \"<target sentence>\"")
        ws.close(); return
    audio_path = sys.argv[1]
    target_sentence = sys.argv[2]
    print(f"🎧 Loading {audio_path}")
    print(f"🎯 Target: {target_sentence}")

    # 1) Configure session (supported audio format)
    session_update = {
        "type": "session.update",
        "session": {
            "model": MODEL,
            "instructions": (
                "You are a friendly pronunciation coach. "
                "Always respond in English."
            ),
            "turn_detection": { "type": "server_vad" },   # or "semantic_vad"
            "input_audio_format": "pcm16",
            "tools": [{
                "type": "function",
                "name": "pronunciation_feedback",
                "description": "Compare the audio to the given target sentence and return concise, actionable pronunciation feedback.",
                "parameters": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["summary","differences","practice_tips","scores"],
                    "properties": {
                        "summary": { "type": "string" },
                        "scores": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "pronunciation": { "type": "integer", "minimum": 0, "maximum": 100 },
                                "intelligibility": { "type": "integer", "minimum": 0, "maximum": 100 }
                            }
                        },
                        "differences": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "additionalProperties": False,
                                "required": ["type","reference","observed","note"],
                                "properties": {
                                    "type": { "type": "string", "enum": ["substitution","deletion","insertion","stress","rhythm","intonation"] },
                                    "reference": { "type": "string" },
                                    "observed":  { "type": "string" },
                                    "note":      { "type": "string" }
                                }
                            }
                        },
                        "practice_tips": { "type": "array", "items": { "type": "string" } }
                    }
                }
            }]
        }
    }
    ws.send(json.dumps(session_update))
    print("✅ Session configured.")

    # 2) Send the target sentence as a user message (so the model can compare against it)
    ws.send(json.dumps({
        "type": "conversation.item.create",
        "item": {
            "type": "message",
            "role": "user",
            "content": [
                {"type": "input_text", "text": f"Target sentence: {target_sentence}"}
            ]
        }
    }))
    print("✉️  Target sentence sent.")

    # 3) Decode audio and ensure ≥100 ms (or pad)
    pcm = to_pcm16_16k_mono_bytes(audio_path)
    ms = (len(pcm) / (BYTES_PER_SAMPLE * SAMPLE_RATE)) * 1000.0 if pcm else 0.0
    print(f"🔎 PCM bytes: {len(pcm)} (~{ms:.1f} ms)")
    if not pcm:
        print("❌ No audio decoded. Check path/codec.")
        ws.close(); return
    if len(pcm) < MIN_BYTES:
        need = MIN_BYTES - len(pcm)
        pcm = (pcm * ((need // len(pcm)) + 1))[:MIN_BYTES]  # repeat actual content
        ms2 = (len(pcm) / (BYTES_PER_SAMPLE * SAMPLE_RATE)) * 1000.0
        print(f"ℹ️  Padded to {len(pcm)} bytes (~{ms2:.1f} ms)")

    # 4) Append audio in ~100ms chunks, then commit once
    FRAME_BYTES = 3200  # ~100 ms
    for i in range(0, len(pcm), FRAME_BYTES):
        chunk = pcm[i:i+FRAME_BYTES]
        ws.send(json.dumps({
            "type": "input_audio_buffer.append",
            "audio": base64.b64encode(chunk).decode("ascii"),
        }))
        time.sleep(0.01)  # small nudge for ingestion
    time.sleep(0.05)
    ws.send(json.dumps({ "type": "input_audio_buffer.commit" }))
    print("⬆️  Audio sent & committed.")

    # We do NOT call create_response here; we’ll wait for 'input_audio_buffer.committed'
    # then trigger exactly once from on_message().

def on_message(ws, message):
    global awaiting_response, buffer_committed, response_sent
    evt = json.loads(message)
    t = evt.get("type")

    # track commit lifecycle and response lifecycle
    if t == "input_audio_buffer.committed":
        buffer_committed = True
        print("✅ Server acknowledges audio buffer commit.")
    if t == "response.created":
        awaiting_response = True
    elif t == "response.done":
        awaiting_response = False

    # When committed and no active response, trigger once
    if buffer_committed and not response_sent and not awaiting_response:
        create_response(ws)

    # ---- stream handlers ----
    if t in ("response.text.delta", "response.output_text.delta"):
        text_buf.append(evt.get("delta", ""))

    elif t in ("response.text.done", "response.output_text.done"):
        if text_buf:
            print("\n📝 Text output:\n", "".join(text_buf))
            text_buf.clear()

    elif t == "response.function_call_arguments.delta":
        tool_args_buf.append(evt.get("delta", ""))

    elif t in ("response.function_call_arguments.done", "response.done"):
        if tool_args_buf:
            raw = "".join(tool_args_buf).strip()
            tool_args_buf.clear()
            try:
                print("\n✅ Pronunciation feedback (JSON):\n", json.dumps(json.loads(raw), indent=2))
            except Exception:
                print("\n⚠️ Tool args not valid JSON:\n", raw)
        if text_buf:  # fallback: sometimes model returns text, not a tool call
            print("\n📝 Text output:\n", "".join(text_buf))
            text_buf.clear()

    elif t == "error":
        # reset gates so you can retry in same session if you extend this script
        buffer_committed = False
        response_sent = False
        awaiting_response = False
        print("\n[Realtime Error]", evt)

def on_error(ws, err):
    print("\n[WebSocket error]", err)

def on_close(ws, code, msg):
    print(f"\n[WS closed] code={code} msg={msg or ''}")

def start_ws():
    ws = websocket.WebSocketApp(
        URL,
        header=HEADERS,
        on_open=on_open,
        on_message=on_message,
        on_error=on_error,
        on_close=on_close,
    )
    websocket._app = ws  # type: ignore[attr-defined]
    ws.run_forever(ping_interval=20, ping_timeout=10)

if __name__ == "__main__":
    if not API_KEY:
        raise SystemExit("Set OPENAI_API_KEY.")
    t = threading.Thread(target=start_ws, daemon=True)
    t.start()
    try:
        while t.is_alive():
            time.sleep(0.1)
    except KeyboardInterrupt:
        pass
