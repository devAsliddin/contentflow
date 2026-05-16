from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Database
    database_url: str = "postgresql+asyncpg://user:password@localhost:5432/contentflow"
    redis_url: str = "redis://localhost:6379/0"

    # Security
    secret_key: str = "change-this-secret-key-in-production-min-32-chars"
    # Fernet key for encrypting platform credentials.
    # Generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    encryption_key: str = ""
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # CORS — comma-separated list of allowed origins in production
    # Example: "https://app.example.com,https://www.example.com"
    allowed_origins: str = "http://localhost:5173,http://localhost:3000"

    # Ollama
    ollama_url: str = "http://localhost:11434"

    # OpenRouter / OpenAI-compatible fallback
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "openai/gpt-oss-120b:free"

    # Anthropic
    anthropic_api_key: str = ""

    # Instagram
    instagram_app_id: str = ""
    instagram_app_secret: str = ""

    # TikTok
    tiktok_client_key: str = ""
    tiktok_client_secret: str = ""

    # Telegram
    telegram_bot_token: str = ""

    # Facebook
    facebook_app_id: str = ""
    facebook_app_secret: str = ""

    # LinkedIn
    linkedin_client_id: str = ""
    linkedin_client_secret: str = ""

    # YouTube
    youtube_client_id: str = ""
    youtube_client_secret: str = ""

    # X (Twitter)
    twitter_api_key: str = ""
    twitter_api_secret: str = ""

    # App
    environment: str = "development"
    frontend_url: str = "http://localhost:5173"
    backend_url: str = "http://localhost:8000"
    media_dir: str = "./media"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
