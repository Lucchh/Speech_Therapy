"""File-system helpers for reading/writing structured data."""

from pathlib import Path
from typing import Any, Dict
import json


def load_json(path: Path) -> Dict[str, Any]:
    """Load a JSON document into memory."""
    # Memory manager and exercise planner rely on this helper to access data/
    raise NotImplementedError("JSON loader is not implemented yet.")


def save_json(path: Path, payload: Dict[str, Any]) -> None:
    """Persist a JSON document to disk."""
    # Used by memory manager to persist user state snapshots after each session.
    raise NotImplementedError("JSON saver is not implemented yet.")

