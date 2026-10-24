from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

ProviderName = Literal["demo", "gemini", "openai"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="QA_",
        env_file=Path(__file__).resolve().parents[2] / ".env",
        extra="ignore",
    )

    mode: Literal["auto", "demo", "ai"] = "auto"
    provider: Literal["auto", "gemini", "openai"] = "auto"

    gemini_api_key: SecretStr = SecretStr("")
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta"
    gemini_model: str = "gemini-3.8-flash"

    # OpenAI-compatible fallback / alternative provider.
    ai_api_key: SecretStr = SecretStr("")
    ai_base_url: str = "https://api.openai.com/v1"
    ai_model: str = "gpt-4o-mini"

    ai_timeout_seconds: float = Field(default=30, ge=1, le=120)

    @property
    def provider_name(self) -> ProviderName:
        if self.mode == "demo":
            return "demo"

        gemini_configured = bool(self.gemini_api_key.get_secret_value())
        openai_configured = bool(self.ai_api_key.get_secret_value())

        if self.provider == "gemini":
            if gemini_configured or self.mode == "ai":
                return "gemini"
            return "demo"

        if self.provider == "openai":
            if openai_configured or self.mode == "ai":
                return "openai"
            return "demo"

        # Auto mode prefers Gemini because it offers a free tier for supported models.
        if gemini_configured:
            return "gemini"
        if openai_configured:
            return "openai"
        if self.mode == "ai":
            return "gemini"
        return "demo"

    @property
    def demo(self) -> bool:
        return self.provider_name == "demo"
