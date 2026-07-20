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
    # V5: model used when an AI_*_PROVIDER is set to "ollama"
    ollama_model: str = "qwen2.5:7b"

    # xAI (Grok) — primary AI provider when xai_api_key is set.
    # OpenAI-compatible API; replaces local Ollama. Get a key at https://console.x.ai
    xai_api_key: str = ""
    xai_base_url: str = "https://api.x.ai/v1"
    xai_model: str = "grok-3-mini"
    xai_vision_model: str = "grok-2-vision-1212"

    # OpenRouter / OpenAI-compatible fallback
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "openai/gpt-oss-120b:free"

    # Anthropic
    anthropic_api_key: str = ""
    anthropic_analysis_model: str = "claude-sonnet-4-20250514"

    # V5 — AI Provider routing (free-first)
    ai_analysis_provider: str = "groq"       # profil + tavsiyalar
    ai_classification_provider: str = "vllm" # caption klassifikatsiya
    ai_content_provider: str = "groq"        # kontent g'oyalari
    ai_fallback_chain: str = "groq,openrouter,vllm"

    # Groq
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    groq_max_retries: int = 5

    # vLLM (OpenAI-compatible local server)
    vllm_base_url: str = "http://127.0.0.1:8000/v1"
    vllm_model: str = "Qwen2.5-7B-Instruct"

    # V5 — Analysis settings
    analysis_media_limit: int = 50
    analysis_classify_chunk_size: int = 10

    # Instagram
    instagram_app_id: str = ""
    instagram_app_secret: str = ""

    # V4 — Instagram auto-reply (DM + comment). Uses the Meta app credentials.
    # meta_app_id/secret fall back to instagram_app_id/secret if left empty.
    meta_app_id: str = ""
    meta_app_secret: str = ""
    instagram_oauth_redirect_uri: str = ""
    instagram_webhook_verify_token: str = ""
    # Meta bumps the Graph version often — keep it configurable, never hardcoded.
    instagram_graph_version: str = "v23.0"

    # TikTok
    tiktok_client_key: str = ""
    tiktok_client_secret: str = ""

    # Telegram
    telegram_bot_token: str = ""

    # Facebook (V6)
    fb_app_id: str = ""
    fb_app_secret: str = ""
    fb_oauth_redirect_uri: str = ""
    fb_graph_version: str = "v23.0"
    fb_webhook_verify_token: str = ""

    # Image generation (V6)
    image_provider: str = "replicate"
    image_fallback_chain: str = "replicate,cloudflare,pollinations"
    # Replicate — primary image provider. Set REPLICATE_API_TOKEN to enable.
    replicate_api_token: str = ""
    replicate_image_model: str = "black-forest-labs/flux-schnell"
    cloudflare_account_id: str = ""
    cloudflare_api_token: str = ""
    cloudflare_image_model: str = "@cf/black-forest-labs/flux-1-schnell"
    pollinations_base_url: str = "https://image.pollinations.ai"
    # Optional free token (register at https://enter.pollinations.ai) — anonymous
    # tier is now paywalled (402). Sent as a Bearer header when set.
    pollinations_api_token: str = ""
    image_default_size: str = "1024x1024"
    image_rate_limit_per_user_hour: int = 10

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
    def meta_app_id_resolved(self) -> str:
        return self.meta_app_id or self.instagram_app_id

    @property
    def meta_app_secret_resolved(self) -> str:
        return self.meta_app_secret or self.instagram_app_secret

    @property
    def instagram_login_app_id(self) -> str:
        """Instagram Business Login (instagram.com/oauth) requires the Instagram
        app ID, which is DIFFERENT from the Facebook/Meta app ID. Falls back to
        the Meta app ID only if no dedicated Instagram app ID is configured."""
        return self.instagram_app_id or self.meta_app_id_resolved

    @property
    def instagram_login_app_secret(self) -> str:
        """Instagram app secret (pairs with instagram_login_app_id)."""
        return self.instagram_app_secret or self.meta_app_secret_resolved

    @property
    def fb_app_id_resolved(self) -> str:
        """FB app id — falls back to meta_app_id_resolved if fb_app_id is empty."""
        return self.fb_app_id or self.meta_app_id_resolved

    @property
    def fb_app_secret_resolved(self) -> str:
        """FB app secret — falls back to meta_app_secret_resolved if fb_app_secret is empty."""
        return self.fb_app_secret or self.meta_app_secret_resolved

    @property
    def image_default_size_wh(self) -> tuple[int, int]:
        """Parse IMAGE_DEFAULT_SIZE ('WxH') into (width, height) integers."""
        try:
            w_str, h_str = self.image_default_size.lower().split("x")
            return int(w_str.strip()), int(h_str.strip())
        except Exception:
            return 1024, 1024

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
