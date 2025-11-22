import base64
from typing import Any, Dict, Optional
import io

from fastapi import APIRouter, File, Form, UploadFile, HTTPException
from openai import OpenAI

from config.settings import get_settings

router = APIRouter(prefix="/analyze", tags=["analyze"])


# Output schemas for structured JSON
STUTTER_SCHEMA: Dict[str, Any] = {
    "name": "StutterFeedback",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "content_summary",
            "overall_summary",
            "strengths",
            "areas_for_improvement",
            "practice_tips",
            "motivation",
        ],
        "properties": {
            "content_summary": {"type": "string"},
            "overall_summary": {"type": "string"},
            "strengths": {"type": "array", "items": {"type": "string"}},
            "areas_for_improvement": {"type": "array", "items": {"type": "string"}},
            "practice_tips": {"type": "array", "items": {"type": "string"}},
            "motivation": {"type": "string"},
        },
    },
}

PHONO_SCHEMA: Dict[str, Any] = {
    "name": "PhonologicalFeedback",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["content_summary", "summary", "differences", "practice_tips", "scores"],
        "properties": {
            "content_summary": {"type": "string"},
            "summary": {"type": "string"},
            "scores": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "pronunciation": {"type": "integer", "minimum": 0, "maximum": 100},
                    "intelligibility": {"type": "integer", "minimum": 0, "maximum": 100},
                },
            },
            "differences": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["type", "reference", "observed", "note"],
                    "properties": {
                        "type": {
                            "type": "string",
                            "enum": [
                                "substitution",
                                "deletion",
                                "insertion",
                                "stress",
                                "rhythm",
                                "intonation",
                            ],
                        },
                        "reference": {"type": "string"},
                        "observed": {"type": "string"},
                        "note": {"type": "string"},
                    },
                },
            },
            "practice_tips": {"type": "array", "items": {"type": "string"}},
        },
    },
}


@router.post("/audio", summary="Analyze an audio recording using non-realtime model")
async def analyze_audio(
    audio: UploadFile = File(...),
    mode: str = Form("stutter"),
    target_script: Optional[str] = Form(None),
    instructions: Optional[str] = Form(None),
) -> Dict[str, Any]:
    settings = get_settings()
    if not settings.openai_api_key:
        raise HTTPException(status_code=400, detail="OPENAI_API_KEY not configured")

    # Read audio as bytes and base64-encode for Responses API
    content = await audio.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty audio upload")

    # The browser records WebM; pass format accordingly
    # Only wav/mp3 are supported by chat completions input_audio today
    fmt = "wav"
    if audio.filename and "." in audio.filename:
        ext = audio.filename.rsplit(".", 1)[-1].lower()
        if ext in ("wav", "mp3"):
            fmt = ext

    b64 = base64.b64encode(content).decode("ascii")

    client = OpenAI(api_key=settings.openai_api_key)

    # Build system/user content
    if mode.lower() == "phonological":
        schema = PHONO_SCHEMA
        # Coaching style tuned for concise, encouraging, actionable feedback
        sys = (
            "You are Ava, a friendly and encouraging pronunciation coach. "
            "Compare the user's speech to the provided target sentence (included below). "
            "Keep the tone warm and supportive. Start with one short, positive sentence. "
            "Then, briefly name the top 1–2 differences (e.g., a likely substitution, deletion, or a stress/rhythm issue) that most affect intelligibility. "
            "For each difference, give 1–2 concise, high‑impact tips with concrete articulatory cues (placement, airflow, voicing) and a tiny example word or mini drill. "
            "Use plain language and minimal jargon; avoid long lists. Keep the whole response about 20–30 seconds. "
            "Always respond in English (US)."
        )
        if target_script:
            sys += f" Target sentence: {target_script}"
    else:
        schema = STUTTER_SCHEMA
        # Coaching style tuned for stuttering: warm, focused, and actionable
        sys = (
            "You are Ava, an encouraging fluency coach for adults who stutter. "
            "Start with one short, positive observation (content_summary). "
            "Focus on stuttering features first: note any repetitions, prolongations, blocks, and visible/voice tension. "
            "Briefly call out where they occurred (e.g., word‑initial sounds, specific words) and any helpful patterns (breath, rate). "
            "Then give 2–3 concise, practical suggestions with concrete cues (e.g., easy onset on vowels, light contact for /p t k/, short pause before hard words, slower first syllable, gentle airflow). "
            "Include one tiny drill or example phrase the user can try immediately. Keep the tone warm, hopeful, and non‑judgmental; avoid jargon. Keep total length about 20–30 seconds. "
            "Always respond in English (US)."
        )

    if instructions:
        sys = instructions + "\n\n" + sys

    try:
        # 1) Transcribe the user's recording (Whisper) - needed for phonological mode
        transcript_text: Optional[str] = None
        try:
            buf = io.BytesIO(content)
            buf.name = f"take.{fmt}"
            tr = client.audio.transcriptions.create(model="whisper-1", file=buf, response_format="text")
            transcript_text = tr if isinstance(tr, str) else getattr(tr, "text", None)
        except Exception:
            transcript_text = None

        # 2) Chat Completions with GPT-4o Audio Preview (text + audio out)
        content_blocks = [{"type": "text", "text": sys}]
        # Phonology target sentence included above in sys
        content_blocks.append({"type": "input_audio", "input_audio": {"data": b64, "format": fmt}})

        # 3) Get assistant reply (text + audio). Strongly require a short text summary first.
        sys += " Always include a brief 1–2 sentence text summary of your feedback before speaking."
        # Ensure target sentence is clearly provided for phonological mode
        if mode.lower() == "phonological" and target_script:
            content_blocks.append({"type": "text", "text": f"Target sentence: {target_script}"})
        
        # Include transcribed text in phonological mode for better comparison
        if mode.lower() == "phonological" and transcript_text:
            content_blocks.append({"type": "text", "text": f"User's transcribed speech: {transcript_text}"})

        resp = client.chat.completions.create(
            model="gpt-4o-audio-preview",
            modalities=["text", "audio"],
            audio={"voice": "alloy", "format": "mp3"},
            messages=[{"role": "user", "content": content_blocks}],
        )

        # Extract text and audio (works for SDK and raw JSON)
        text_parts: list[str] = []
        b64_audio: str | None = None
        try:
            message = resp.choices[0].message
            # SDK path
            if hasattr(message, "audio") and getattr(message.audio, "data", None):
                b64_audio = message.audio.data  # type: ignore[attr-defined]
            for blk in getattr(message, "content", []) or []:
                t = getattr(blk, "type", None)
                if t == "output_audio":
                    maybe = getattr(getattr(blk, "audio", None), "data", None)
                    if maybe:
                        b64_audio = maybe
                elif t == "output_text":
                    txt = getattr(blk, "text", "")
                    if txt:
                        text_parts.append(txt)
        except Exception:
            pass
        if not b64_audio and isinstance(resp, dict):
            try:
                msg = resp["choices"][0]["message"]
                if isinstance(msg.get("audio"), dict) and msg["audio"].get("data"):
                    b64_audio = msg["audio"]["data"]
                for blk in msg.get("content", []) or []:
                    if blk.get("type") == "output_audio":
                        maybe = (blk.get("audio") or {}).get("data")
                        if maybe:
                            b64_audio = maybe
                    elif blk.get("type") == "output_text":
                        txt = blk.get("text") or ""
                        if txt:
                            text_parts.append(txt)
            except Exception:
                pass

        # 3) Transcribe assistant audio reply so the UI can show text alongside audio
        reply_transcript: Optional[str] = None
        if b64_audio:
            try:
                import base64 as _b64
                audio_bytes = _b64.b64decode(b64_audio)
                buf2 = io.BytesIO(audio_bytes)
                buf2.name = "reply.mp3"
                tr2 = client.audio.transcriptions.create(model="whisper-1", file=buf2, response_format="text")
                reply_transcript = tr2 if isinstance(tr2, str) else getattr(tr2, "text", None)
            except Exception:
                reply_transcript = None

        return {
            "text": "\n".join(text_parts) if text_parts else "",
            "audio_b64": b64_audio or "",
            "audio_format": "mp3",
            "transcript": transcript_text or "",
            "reply_transcript": reply_transcript or "",
        }
    except Exception as e:
        # Return a schema-shaped error payload
        if mode.lower() == "phonological":
            return {
                "content_summary": f"Error: {e}",
                "summary": "",
                "scores": {"pronunciation": 0, "intelligibility": 0},
                "differences": [],
                "practice_tips": [],
            }
        return {
            "content_summary": f"Error: {e}",
            "overall_summary": "",
            "strengths": [],
            "areas_for_improvement": [],
            "practice_tips": [],
            "motivation": "",
        }
