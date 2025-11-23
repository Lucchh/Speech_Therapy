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
awaiting_response = False          # prevents overlapping response.create
buffer_committed = False           # set True when server confirms commit
response_sent = False              # ensure we trigger response only once

SAMPLE_RATE = 16000
BYTES_PER_SAMPLE = 2
MIN_MS = 100
MIN_BYTES = SAMPLE_RATE * BYTES_PER_SAMPLE * MIN_MS // 1000  # 3200

# ---- ffmpeg helper: mp3/wav/etc -> raw PCM16 mono 16kHz bytes ----
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
    global awaiting_response, response_sent
    if awaiting_response:
        print("⏳ Skipping response.create — previous response still running.")
        return
    ws.send(json.dumps({
        "type": "response.create",
        "response": {
            "modalities": ["text"],
            # tool_choice requires a top-level name
            "tool_choice": { "type": "function", "name": "submit_feedback" },
            # include tool again to guarantee scope this turn
            "tools": [{
                "type": "function",
                "name": "submit_feedback",
                "description": "Return structured stuttering/fluency feedback.",
                "parameters": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": [
                        "overall_summary","strengths",
                        "areas_for_improvement","practice_tips","motivation"
                    ],
                    "properties": {
                        "overall_summary": { "type": "string" },
                        "strengths": { "type": "array", "items": { "type": "string" } },
                        "areas_for_improvement": { "type": "array", "items": { "type": "string" } },
                        "practice_tips": { "type": "array", "items": { "type": "string" } },
                        "motivation": { "type": "string" }
                    }
                }
            }],
            "instructions": (
                "Analyze the committed audio buffer for disfluencies, pacing, and pitch/energy cues, "
                "then call submit_feedback with your findings. Do not output prose. Always respond in English."
            )
        }
    }))
    response_sent = True
    print("🤖 Requested structured feedback via function call…")

# ---- WebSocket event handlers ----
def on_open(ws):
    # 1) Configure session (use supported input_audio_format)
    session_update = {
        "type": "session.update",
        "session": {
            "model": MODEL,
            "instructions": (
                "You are Ava, a supportive speech therapy coach specializing in fluency and stuttering. "
                "Analyze the incoming audio (no transcription) for disfluencies (repetitions, prolongations, "
                "blocks, fillers), pacing, pitch variation, and vocal tension. "
                "Return results ONLY by calling submit_feedback. Always respond in English."
            ),
            "turn_detection": { "type": "server_vad" },   # or "semantic_vad"
            "input_audio_format": "pcm16",                # ✅ supported value
            "tools": [{
                "type": "function",
                "name": "submit_feedback",
                "description": "Return structured stuttering/fluency feedback.",
                "parameters": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": [
                        "overall_summary","strengths",
                        "areas_for_improvement","practice_tips","motivation"
                    ],
                    "properties": {
                        "overall_summary": { "type": "string" },
                        "strengths": { "type": "array", "items": { "type": "string" } },
                        "areas_for_improvement": { "type": "array", "items": { "type": "string" } },
                        "practice_tips": { "type": "array", "items": { "type": "string" } },
                        "motivation": { "type": "string" }
                    }
                }
            }]
        }
    }
    ws.send(json.dumps(session_update))
    print("✅ Session configured.")

    # 2) Load & verify audio
    if len(sys.argv) < 2:
        print("Usage: python realtime_stutter_from_file.py <path_to_audio>")
        ws.close(); return
    audio_path = sys.argv[1]
    print(f"🎧 Loading {audio_path} ...")

    pcm = to_pcm16_16k_mono_bytes(audio_path)
    ms = (len(pcm) / (BYTES_PER_SAMPLE * SAMPLE_RATE)) * 1000.0 if pcm else 0.0
    print(f"🔎 PCM bytes: {len(pcm)} (~{ms:.1f} ms)")

    if not pcm or len(pcm) == 0:
        print("❌ No audio decoded. Check path/codec.")
        ws.close(); return

    # 3) Ensure ≥100 ms; if short, repeat content (keeps actual sound vs silence)
    if len(pcm) < MIN_BYTES:
        need = MIN_BYTES - len(pcm)
        pcm = (pcm * ((need // len(pcm)) + 1))[:MIN_BYTES]
        ms2 = (len(pcm) / (BYTES_PER_SAMPLE * SAMPLE_RATE)) * 1000.0
        print(f"ℹ️  Padded to {len(pcm)} bytes (~{ms2:.1f} ms)")

    # 4) Append in chunks (each chunk base64’d separately), brief pause, then commit once
    FRAME_BYTES = 3200  # ~100 ms @ 16k, mono, 16-bit
    for i in range(0, len(pcm), FRAME_BYTES):
        chunk = pcm[i:i+FRAME_BYTES]
        ws.send(json.dumps({
            "type": "input_audio_buffer.append",
            "audio": base64.b64encode(chunk).decode("ascii"),
        }))
        # tiny pause to let the server ingest the chunk
        time.sleep(0.01)

    # short nudge before commit so server has processed appends
    time.sleep(0.05)
    ws.send(json.dumps({ "type": "input_audio_buffer.commit" }))
    print("⬆️  Audio sent in chunks & committed.")

    # NOTE: We do NOT call create_response here.
    # We'll wait for 'input_audio_buffer.committed' in on_message,
    # then trigger response.create exactly once.

def on_message(ws, message):
    global awaiting_response, buffer_committed, response_sent
    evt = json.loads(message)
    t = evt.get("type")

    # track buffer commit lifecycle
    if t == "input_audio_buffer.committed":
        buffer_committed = True
        print("✅ Server acknowledges audio buffer commit.")

    # prevent overlapping response.create
    if t == "response.created":
        awaiting_response = True
    elif t == "response.done":
        awaiting_response = False

    # once buffer is committed and no active response, trigger exactly once
    if buffer_committed and not response_sent and not awaiting_response:
        create_response(ws)

    # text streams (both variants)
    if t in ("response.text.delta", "response.output_text.delta"):
        text_buf.append(evt.get("delta", ""))

    elif t in ("response.text.done", "response.output_text.done"):
        if text_buf:
            print("\n📝 Text output:\n", "".join(text_buf))
            text_buf.clear()

    # tool-call JSON args
    elif t == "response.function_call_arguments.delta":
        tool_args_buf.append(evt.get("delta", ""))

    elif t in ("response.function_call_arguments.done", "response.done"):
        if tool_args_buf:
            raw = "".join(tool_args_buf).strip()
            tool_args_buf.clear()
            try:
                print("\n✅ Feedback JSON (tool):\n", json.dumps(json.loads(raw), indent=2))
            except Exception:
                print("\n⚠️ Tool args not valid JSON:\n", raw)
        if text_buf:  # fallback if text came instead of a tool call
            print("\n📝 Text output:\n", "".join(text_buf))
            text_buf.clear()

    elif t == "error":
        # if a commit error happens, allow retry later if you extend the script
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
