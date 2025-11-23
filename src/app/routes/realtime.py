import requests
from fastapi import APIRouter, HTTPException
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
        # Do not auto-create responses; make VAD more permissive and allow longer pauses.
        "turn_detection": {"type": "server_vad", "threshold": 0.25, "prefix_padding_ms": 300, "silence_duration_ms": 600, "create_response": False},
        # Enable realtime transcription so the model can base summaries on words actually spoken
        "input_audio_transcription": {"model": "whisper-1"},
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

    try:
        resp = requests.post("https://api.openai.com/v1/realtime/sessions", headers=headers, json=payload, timeout=15)
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 401:
            error_detail = e.response.text if e.response else "Unknown error"
            raise HTTPException(
                status_code=401,
                detail=f"OpenAI API authentication failed. Check your OPENAI_API_KEY in .env file. Error: {error_detail}"
            )
        elif e.response.status_code == 403:
            error_detail = e.response.text if e.response else "Unknown error"
            raise HTTPException(
                status_code=403,
                detail=f"OpenAI API access denied. You may need Realtime API access. Error: {error_detail}"
            )
        else:
            error_detail = e.response.text if e.response else "Unknown error"
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"OpenAI API error: {error_detail}"
            )
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to connect to OpenAI API: {str(e)}"
        )
