from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Any, Dict, Optional, List
from services.feedback_generator import generate_feedback

router = APIRouter(prefix="/feedback", tags=["feedback"])

class Acoustic(BaseModel):
    pitch_mean: Optional[float] = None
    rms_energy: Optional[float] = None
    tempo: Optional[float] = None
    formants: Optional[Dict[str, float]] = None

class FeedbackRequest(BaseModel):
    user_profile: Dict[str, Any] = Field(default_factory=dict)
    transcript: str = ""
    acoustic_features: Optional[Dict[str, Any]] = None
    session_history: Optional[List[Dict[str, Any]]] = None

@router.post("", summary="Generate structured feedback JSON")
def create_feedback(req: FeedbackRequest) -> Dict[str, Any]:
    data = generate_feedback(
        user_profile=req.user_profile,
        transcript=req.transcript,
        acoustic_features=req.acoustic_features,
        session_history=req.session_history,
    )
    return data
