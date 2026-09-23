from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    secret_key: str = "dev-only-insecure-secret-change-me"
    anthropic_api_key: str = ""
    cors_origins: str = "http://localhost:5173"
    public_base_url: str = "http://localhost:5173"
    database_url: str = "sqlite:///./vibecast.db"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days, fine for a demo

    # Bidding: bids add weight to ranking rather than guaranteeing top position (spec §4/§9.1)
    bid_weight: float = 2.0

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
