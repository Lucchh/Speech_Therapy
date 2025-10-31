import requests
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Any, Dict
from config.settings import get_settings

router = APIRouter(prefix="/realtime", tags=["realtime"])

class SessionRequest(BaseModel):
    instructions: str | None = None

@router.post("/session", summary="Mint an ephemeral Realtime session for the browser")
def create_realtime_session(body: SessionRequest) -> Dict[str, Any]:
    settings = get_settings()
    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.realtime_model,
        "voice": settings.realtime_voice,
    }
    if body.instructions:
        payload["instructions"] = body.instructions
    resp = requests.post("https://api.openai.com/v1/realtime/sessions",
                         headers=headers, json=payload, timeout=15)
    resp.raise_for_status()
    return resp.json()
