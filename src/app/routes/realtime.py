import requests
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Any, Dict, Optional
from config.settings import get_settings

router = APIRouter(prefix="/realtime", tags=["realtime"])

class SessionRequest(BaseModel):
    instructions: Optional[str] = None
    mode: Optional[str] = None  # "stutter" | "phonological"
    target_script: Optional[str] = None

@router.post("/session", summary="Mint an ephemeral Realtime session for the browser")
def create_realtime_session(body: SessionRequest) -> Dict[str, Any]:
    settings = get_settings()
    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }

    # Base realtime session payload
    payload: Dict[str, Any] = {
        "model": settings.realtime_model,
        "voice": settings.realtime_voice,
        "modalities": ["audio", "text"],
        # Do not auto-create responses; we'll trigger on Stop from the UI.
        "turn_detection": {"type": "server_vad", "silence_duration_ms": 200, "create_response": False},
        "input_audio_format": "pcm16",
    }

    mode = (body.mode or "").lower().strip()

    if mode == "phonological":
        pronunciation_tool = {
            "type": "function",
            "name": "pronunciation_feedback",
            "description": "Compare the spoken audio against the provided target text and return concise pronunciation feedback.",
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "required": ["content_summary", "summary", "differences", "practice_tips", "scores"],
                "properties": {
                    "content_summary": {"type": "string", "description": "Very brief (1 sentence) summary of what the user was talking about."},
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
                                "type": {"type": "string", "enum": ["substitution", "deletion", "insertion", "stress", "rhythm", "intonation"]},
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

        payload["tools"] = [pronunciation_tool]
        payload["tool_choice"] = {"type": "function", "name": "pronunciation_feedback"}

        default_instr = (
            "You are a friendly pronunciation coach. The client may send a target sentence as text in the conversation. "
            "First, briefly summarize what the user is talking about (one sentence) and include it as content_summary. "
            "Then listen to the user's spoken audio and compare it strictly against the target at word/phoneme/stress levels. "
            "Identify substitutions, deletions, insertions, and prosody issues. Return ONLY a function call to pronunciation_feedback with concise, actionable feedback. "
            "Always respond in English (US)."
        )
        if body.target_script:
            default_instr += f" Target sentence: {body.target_script}"
        payload["instructions"] = body.instructions or default_instr

    else:
        stutter_tool = {
            "type": "function",
            "name": "stutter_feedback",
            "description": "Return structured stuttering/fluency feedback including counts and practice tips.",
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "required": ["content_summary", "overall_summary", "strengths", "areas_for_improvement", "practice_tips", "motivation"],
                "properties": {
                    "content_summary": {"type": "string", "description": "Very brief (1 sentence) summary of what the user was talking about."},
                    "overall_summary": {"type": "string"},
                    "strengths": {"type": "array", "items": {"type": "string"}},
                    "areas_for_improvement": {"type": "array", "items": {"type": "string"}},
                    "practice_tips": {"type": "array", "items": {"type": "string"}},
                    "motivation": {"type": "string"},
                },
            },
        }

        payload["tools"] = [stutter_tool]
        payload["tool_choice"] = {"type": "function", "name": "stutter_feedback"}

        default_instr = (
            "You are Ava, a supportive fluency coach. First, briefly summarize what the user is talking about (one sentence) and include it as content_summary. "
            "Then listen for disfluencies (repetitions, prolongations, blocks, fillers), pacing, pitch variation, and vocal tension. "
            "Return ONLY the stutter_feedback function call with strengths, issues, and practice tips. "
            "Always respond in English (US)."
        )
        payload["instructions"] = body.instructions or default_instr

    resp = requests.post("https://api.openai.com/v1/realtime/sessions", headers=headers, json=payload, timeout=15)
    resp.raise_for_status()
    return resp.json()
