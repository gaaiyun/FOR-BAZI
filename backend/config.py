# -*- coding: utf-8 -*-
"""
Application configuration loaded from environment variables / .env file.

Uses pydantic-settings so every field can be overridden by env vars
(prefixed with ``BAZI_``) or by entries in a ``.env`` file at project root.
"""

from __future__ import annotations

from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


# Resolve project root (one level up from backend/)
_PROJECT_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Centralised, validated application settings."""

    model_config = SettingsConfigDict(
        env_file=str(_PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        env_prefix="BAZI_",
        case_sensitive=False,
    )

    # -- CORS --
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "tauri://localhost",
        "https://tauri.localhost",
        "http://tauri.localhost",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    # -- Server --
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # -- Cloudflare Workers AI (default provider) --
    # GLM-4.7-Flash: Chinese-native, 131K context, multi-turn tool calling.
    # Tool calling is required — the ReAct loop passes TOOL_SCHEMAS on every turn.
    CF_ACCOUNT_ID: str = ""
    CF_API_TOKEN: str = ""
    CF_MODEL: str = "@cf/zai-org/glm-4.7-flash"

    # -- AI Provider (OpenAI-compatible fallback) --
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.minimaxi.com/v1"
    OPENAI_MODEL: str = "MiniMax-M2.7"

    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_BASE_URL: str = "https://api.minimaxi.com/anthropic"


# Singleton — import ``settings`` wherever needed.
settings = Settings()
