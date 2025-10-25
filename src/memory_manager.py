"""Persistence layer for user progress and session history."""

import json
from typing import Any, Dict

from config.settings import get_settings

settings = get_settings()
DATA_PATH = settings.data_dir / "users"
DATA_PATH.mkdir(parents=True, exist_ok=True)


def load_user_profile(user_id: str) -> Dict[str, Any]:
    """Load user progress, preferences, and historical performance.

    Args:
        user_id: Unique identifier per user.

    Returns:
        A dictionary containing user state (e.g., mastered phonemes, streaks).
    """
    path = DATA_PATH / f"{user_id}.json"
    if path.exists():
        return json.loads(path.read_text())
    return {"user_id": user_id, "sessions": []}


def save_session(user_id: str, session_data: Dict[str, Any]) -> None:
    """Persist results from the current session.

    Args:
        user_id: Unique identifier per user.
        session_data: Structured data containing transcript, feedback,
            and performance metrics to enable longitudinal tracking.
    """
    profile = load_user_profile(user_id)
    profile.setdefault("sessions", []).append(session_data)
    (DATA_PATH / f"{user_id}.json").write_text(json.dumps(profile, indent=2))
