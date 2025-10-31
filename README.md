# Ava — Speech Therapy Coach (Realtime + Structured Feedback)

A voice-first practice agent for fluency that can (a) talk in realtime via OpenAI Realtime models and (b) produce **structured JSON feedback** from transcripts + acoustic cues using the **Responses API** with a JSON Schema.

---

## Features

- **Realtime voice** (browser WebRTC ↔️ OpenAI Realtime) — no transcript UI required.
- **Structured feedback** (JSON Schema) produced by the Responses API.
- **FastAPI backend** with:
  - `POST /feedback` → returns JSON feedback for your transcript + acoustic features
  - `POST /realtime/session` → mints an ephemeral Realtime session for the browser
- Docker + simple web client for quick testing.

---

## Quickstart

1. **Install**

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e .
cp .env.example .env  # then edit it to add your OPENAI_API_KEY
make dev  # or: uvicorn src.app.main:app --reload
```

2. **Open the demo UI**  
Serve the `web/` folder (e.g., with VS Code Live Server) or any static server and open it in your browser. The page calls the backend at `POST /realtime/session` to mint an ephemeral key and then performs the WebRTC SDP exchange with OpenAI.

3. **Generate feedback (non-realtime)**

```bash
curl -X POST http://localhost:8000/feedback -H "Content-Type: application/json" -d '{
  "user_profile": {"goal":"fluency improvement"},
  "transcript": "I went to the st-store to buy some milk.",
  "acoustic_features": {"pitch_mean":128.3,"rms_energy":0.025,"tempo":105.4}
}'
```

---

## How it works

- **Realtime**: Browser creates a `RTCPeerConnection`, adds mic audio, and sends an SDP **offer** to the OpenAI Realtime endpoint using a short‑lived client secret returned by `POST /realtime/session`. OpenAI responds with an SDP **answer**; the returned audio track is played in the page.
- **Structured outputs**: The `/feedback` route uses the **Responses API** with `response_format: { type: "json_schema", ... }` to enforce a stable JSON shape.

---

## Configuration

See `.env.example`:

- `OPENAI_API_KEY` — required
- `LlmModel` — e.g. `gpt-4.1-mini`
- `RealtimeModel` — e.g. `gpt-4o-realtime-preview`
- `RealtimeVoice` — e.g. `alloy`

---

## Notes & docs

- Realtime API (overview): https://platform.openai.com/docs/guides/realtime
- Realtime WebRTC flow (offer/answer & browser setup): https://platform.openai.com/docs/guides/realtime-webrtc
- Realtime conversations & events: https://platform.openai.com/docs/guides/realtime-conversations
- Realtime sessions (create ephemeral): https://platform.openai.com/docs/api-reference/realtime-sessions/create
- Responses API (structured outputs JSON Schema): https://platform.openai.com/docs/guides/structured-outputs
- Migrating from Chat Completions → Responses: https://platform.openai.com/docs/guides/migrate-to-responses

---

## License

MIT
