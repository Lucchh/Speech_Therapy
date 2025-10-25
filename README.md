# AI Speech Therapy Agent

Prototype scaffolding for an AI-driven speech therapy assistant. The system
records user audio, transcribes pronunciations, leverages an LLM to provide
feedback, and adapts future exercises based on stored progress.

## Project Layout

Project source lives under `src/`, configuration under `config/`, and data
artifacts (seed exercises, logs, user state) under `data/`. Tests are organized
with `pytest` inside `tests/`.

## Development Notes

- Copy `.env` and populate `OPENAI_API_KEY` / `WHISPER_API_KEY` before running.
- Update `config/settings.py` if you add new environment variables or paths.
- Fill in ASR, LLM, persistence, and planning modules within `src/`.
- `tests/test_sanity.py` acts as a placeholder until real tests are added.
