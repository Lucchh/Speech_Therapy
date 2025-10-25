"""Adaptive planner for upcoming speech practice exercises."""

import json
import random

from config.settings import get_settings

settings = get_settings()
EXERCISES_PATH = settings.data_dir / "exercises" / "exercise_bank.json"
EXERCISES_PATH.parent.mkdir(parents=True, exist_ok=True)


def get_next_exercise(goal: str) -> str:
    """Return a random exercise related to the user's goal.

    Args:
        goal: The target phoneme or articulation objective.

    Returns:
        A textual prompt instructing the user on what to practice next.
    """
    if EXERCISES_PATH.exists():
        with EXERCISES_PATH.open() as handle:
            data = json.load(handle)
    else:
        data = {}

    exercises = data.get(goal, ["Say 'red river rocks' three times"])
    # This output feeds back into `main.run_session` for display or TTS.
    return random.choice(exercises)
