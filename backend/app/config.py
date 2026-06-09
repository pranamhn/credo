from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "RiskLens API"
    app_version: str = "1.0.0"
    debug: bool = False

    # Database
    database_url: str = "postgresql+asyncpg://risklens:risklens@localhost:5432/risklens"
    database_url_sync: str = "postgresql://risklens:risklens@localhost:5432/risklens"

    # Redis / Celery
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/1"

    # Object storage (S3-compatible)
    storage_endpoint: str = ""
    storage_access_key: str = ""
    storage_secret_key: str = ""
    storage_bucket: str = "risklens-statements"
    storage_region: str = "auto"

    # Auth
    secret_key: str = "changeme-in-production-use-64-char-random-string"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480

    # LLM fallback
    anthropic_api_key: str = ""
    llm_model: str = "claude-opus-4-8"
    llm_max_tokens: int = 4096

    # Parsing
    confidence_threshold: float = 0.85
    max_file_size_mb: int = 50
    allowed_extensions: list[str] = [".pdf", ".csv", ".xlsx"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
