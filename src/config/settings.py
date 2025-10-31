# src/config/settings.py
from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # v2 style settings config ONLY (do not add class Config)
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        populate_by_name=True,
        extra="ignore",  # ignore unknown env keys so stray vars don't crash startup
    )

    # API / model settings (accept UPPER_SNAKE and your earlier CamelCase names)
    openai_api_key: str = Field(alias="OPENAI_API_KEY")
    llm_model: str = Field(default="gpt-4.1-mini", alias="LLM_MODEL", validation_alias="LlmModel")
    realtime_model: str = Field(default="gpt-4o-realtime-preview", alias="REALTIME_MODEL", validation_alias="RealtimeModel")
    realtime_voice: str = Field(default="alloy", alias="REALTIME_VOICE", validation_alias="RealtimeVoice")

    # Server/runtime (you had these in .env)
    app_host: str = Field(default="127.0.0.1", alias="APP_HOST", validation_alias="app_host")
    app_port: int = Field(default=8010, alias="APP_PORT", validation_alias="app_port")
    log_level: str = Field(default="info", alias="LOG_LEVEL", validation_alias="log_level")

_settings: Optional[Settings] = None
def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
