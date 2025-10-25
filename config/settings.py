"""Application-wide configuration values and helpers.

This module centralizes environment-dependent settings (API keys, model
identifiers, directory paths) so that the rest of the codebase can import
`get_settings()` to read configuration without hardcoding constants.
"""

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# Load environment variables from a local .env file if present.
load_dotenv()


@dataclass(frozen=True)
class Settings:
    """Strongly-typed collection of runtime configuration data."""

    whisper_api_key: Optional[str]
    llm_api_key: Optional[str]
    whisper_model: str
    llm_model: str
    data_dir: Path
    log_dir: Path


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Load and validate settings from environment variables or defaults."""
    data_dir = Path(os.getenv("DATA_DIR", "data")).resolve()
    log_dir_env = os.getenv("LOG_DIR")
    log_dir = Path(log_dir_env).resolve() if log_dir_env else data_dir / "logs"

    # Ensure data/log directories exist for downstream modules.
    data_dir.mkdir(parents=True, exist_ok=True)
    log_dir.mkdir(parents=True, exist_ok=True)

    return Settings(
        whisper_api_key=os.getenv("WHISPER_API_KEY"),
        llm_api_key=os.getenv("OPENAI_API_KEY"),
        whisper_model=os.getenv("WHISPER_MODEL", "whisper-1"),
        llm_model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        data_dir=data_dir,
        log_dir=log_dir,
    )
