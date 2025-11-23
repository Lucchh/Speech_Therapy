# Ava — Speech Therapy Coach (Realtime)

Voice-first practice agent for speech therapy with two realtime modes powered by OpenAI Realtime:

- Stutter (fluency) analysis
- Phonological (targeted transcript) analysis

Press Record → speak → Stop to retrieve structured feedback. Each take appears as a card in the UI.

---

## Features

- Realtime voice via WebRTC to OpenAI Realtime
- Mode selector: Stutter or Phonological
- Record/Stop workflow (no auto replies while speaking)
- Structured JSON feedback rendered as readable cards
  - Stutter: `content_summary`, `overall_summary`, `strengths`, `areas_for_improvement`, `practice_tips`, `motivation`
  - Phonological: `content_summary`, `summary`, `scores`, `differences`, `practice_tips`
- FastAPI backend
  - `POST /realtime/session` — returns a short‑lived client secret and session config
  - `POST /feedback` — non‑realtime structured feedback for a given transcript (optional)
- Progress tracking with XP, levels, streaks, and achievements
- Training plans with daily practice sentences
- Feedback history with export capabilities (JSON, Text, PDF)

---

## Prerequisites

- Python 3.10+
- An OpenAI API key with access to `gpt-4o-realtime-preview`
- Chrome/Edge with microphone access allowed for localhost

---

## Local Development

1) Create environment and install

Windows (PowerShell):

```powershell
py -3.11 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e .
Copy-Item .env.example .env
# Edit .env and set OPENAI_API_KEY=sk-...
```

macOS/Linux:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
cp .env.example .env
# Edit .env and set OPENAI_API_KEY=sk-...
```

2) Run the backend (FastAPI on 8000)

```bash
uvicorn src.app.main:app --reload --host 0.0.0.0 --port 8000
# or
make dev
```

Health check: http://localhost:8000/healthz → `{ "ok": true }`

3) Serve the web UI

```bash
cd web
python -m http.server 5000
```

Open http://localhost:5000/

The client automatically targets the backend at `http://localhost:8000` when running from a different port.

---

## Using the App

1) Choose Training Plan
- Select therapy type (Stuttering or Phonological)
- Select difficulty level (Simple, Compound, or Complex sentences)
- View daily practice sentences assigned for today

2) Connect → Record → Speak → Stop
- After Stop, the app requests feedback and renders a new card at the top.
- Repeat Record/Stop to create more takes; previous cards remain below.
- Progress is tracked automatically (XP, levels, streaks)

3) View Progress
- Check your progress dashboard for streaks, XP, level, and daily goals
- View achievements unlocked
- Export feedback history as JSON, Text, or PDF for therapist review

Note: The model first adds `content_summary` (1‑sentence topic) before feedback.

---

## Non‑Realtime Feedback (optional API)

```bash
curl -X POST http://localhost:8000/feedback -H "Content-Type: application/json" -d '{
  "user_profile": {"goal":"fluency improvement"},
  "transcript": "I went to the st-store to buy some milk.",
  "acoustic_features": {"pitch_mean":128.3,"rms_energy":0.025,"tempo":105.4}
}'
```

---

## Docker

Build and run backend:

```bash
docker build -t ava-coach .
docker run --env-file .env -p 8000:8000 ava-coach
```

Serve the web UI locally (outside Docker):

```bash
cd web && python -m http.server 5000
```

Open http://localhost:5000/ (the web client calls http://localhost:8000).

---

## Docker Compose

Run backend:

```bash
docker compose up --build
# Backend: http://localhost:8000
```

Optionally add a `web` service for static hosting:

```yaml
  web:
    image: python:3.11-slim
    working_dir: /web
    command: python -m http.server 5000
    volumes:
      - ./web:/web
    ports:
      - "5000:5000"
```

---

## Production Deployment

Single host (reverse proxy):

```bash
pip install gunicorn uvicorn
gunicorn -k uvicorn.workers.UvicornWorker src.app.main:app --bind 0.0.0.0:8000 --workers 2
```

- Serve `web/` from the same origin (Nginx/Apache/static host). Prefer a same‑origin setup so the UI can POST to `/realtime/session` without CORS friction.
- Keep `OPENAI_API_KEY` server‑side only.

Containers:

- Use the Dockerfile + compose above; place Nginx/Traefik in front of both `backend` and `web`.

Heads‑up:

- The client defaults to `http://localhost:8000` when not served on port 8000. For custom domains, host UI and API on the same origin or update `API_BASE` in `web/client.js` to your backend origin.

---

## Configuration

`.env.example` keys:

- `OPENAI_API_KEY` — required
- `LlmModel` — e.g., `gpt-4.1-mini`
- `RealtimeModel` — e.g., `gpt-4o-realtime-preview`
- `RealtimeVoice` — e.g., `alloy`
- `APP_HOST`, `APP_PORT`, `LOG_LEVEL` — backend runtime

---

## Troubleshooting

- HTML/JSON parse error in the UI: ensure backend is on 8000; UI on a different port is fine.
- No audio or off‑topic summaries: check mic permission/device; Status panel should show "Speech started/stopped" and "Audio committed".
- Identical feedback across takes: use Record/Stop; each Stop commits the latest take and requests new analysis.
- Missing `pydantic_settings`: `pip install -e .` after pulling latest.
- 401 Unauthorized error: Check your `OPENAI_API_KEY` in `.env` file and ensure it has access to `gpt-4o-realtime-preview`.

---

## Reference: Realtime Prompts (by mode)

- Stutter (tool: `stutter_feedback`)
  - "You are Ava, a supportive fluency coach. First, briefly summarize what the user is talking about (one sentence) and include it as content_summary. Then listen for disfluencies (repetitions, prolongations, blocks, fillers), pacing, pitch variation, and vocal tension. Return ONLY the stutter_feedback function call with strengths, issues, and practice tips in English."

- Phonological (tool: `pronunciation_feedback`)
  - "You are a friendly pronunciation coach. The client may send a target sentence as text in the conversation. First, briefly summarize what the user is talking about (one sentence) and include it as content_summary. Then listen to the user's spoken audio and compare it strictly against the target at word/phoneme/stress levels. Identify substitutions, deletions, insertions, and prosody issues. Return ONLY a function call to pronunciation_feedback with concise, actionable feedback."
  - If a target sentence is provided, the backend appends: `Target sentence: <your text>`

---

## License

MIT
