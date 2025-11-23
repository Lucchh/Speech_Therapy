import os
import json
import pytest

from src.services.feedback_generator import generate_feedback

@pytest.mark.skipif(not os.getenv("OPENAI_API_KEY"), reason="requires OPENAI_API_KEY")
def test_feedback_shape():
    payload = generate_feedback(
        user_profile={"goal": "fluency improvement"},
        transcript="I went to the st-store to buy some milk.",
        acoustic_features={"pitch_mean": 128.3, "rms_energy": 0.025, "tempo": 105.4},
        session_history=[],
    )
    assert isinstance(payload, dict)
    for key in ["overall_summary","strengths","areas_for_improvement","practice_tips","motivation"]:
        assert key in payload
