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
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

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

    # App
    environment: str = "development"
    frontend_url: str = "http://localhost:5173"
    backend_url: str = "http://localhost:8000"
    media_dir: str = "./media"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
