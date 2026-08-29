# -*- coding: utf-8 -*-
"""
Agent service — wraps the ReAct streaming loop for SSE delivery.

Translates the generator protocol used by ``run_react_loop_streaming``
(yielding ``str`` tokens, ``[STATUS]`` prefixes, and a final ``tuple``)
into a uniform ``(event_type, data)`` stream consumed by the chat router.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Callable, Dict, Generator, List, Optional, Tuple, Union

from agent.api_adapter import create_client
from agent.react_agent import run_react_loop_streaming
from prompts.system_prompts import build_system_prompt
from tools.bazi_tools import TOOL_SCHEMAS, dispatch_tool
from backend.config import settings

logger = logging.getLogger(__name__)


def _normalize_chart_data(chart_data: Dict[str, Any]) -> Dict[str, Any]:
    """Convert frontend BaziReading format to flat backend engine format.

    The frontend sends nested BaziReading objects (chart.year_pillar, etc.)
    while the backend tools and system prompt expect flat fields (pillars,
    tg_zhi, day_master, gender, minggong, etc.).

    If already in flat format (has 'pillars' at top level), pass through.
    """
    if not chart_data:
        return {}

    # Already flat engine format — pass through.
    if chart_data.get("pillars") and isinstance(chart_data["pillars"], list):
        return chart_data

    # Detect frontend BaziReading format: has nested 'chart' with pillar objects.
    chart = chart_data.get("chart")
    if not chart or not isinstance(chart, dict):
        # No nested chart — maybe already partial flat, return as-is.
        return chart_data

    # Check if chart has nested pillar objects (frontend format).
    # Detect by presence of either "stem" or "branch" in any pillar dict.
    has_nested = any(
        isinstance(chart.get(k), dict)
        and ("stem" in (chart.get(k) or {}) or "branch" in (chart.get(k) or {}))
        for k in ("year_pillar", "month_pillar", "day_pillar", "hour_pillar")
    )
    if not has_nested:
        return chart_data

    flat: Dict[str, Any] = {}

    # Reconstruct pillars, tg_zhi, nayin from nested pillar objects.
    pillars: list = []
    tg_zhi: list = []
    nayin_list: list = []
    tg_gan: list = []
    for key in ("year_pillar", "month_pillar", "day_pillar", "hour_pillar"):
        p = chart.get(key, {})
        stem = (p or {}).get("stem", "")
        branch = (p or {}).get("branch", "")
        pillars.append(f"{stem}{branch}" if stem and branch else "")
        hidden = (p or {}).get("hidden_stems", [])
        tg_zhi.append("".join(hidden) if hidden else "")
        nayin_list.append((p or {}).get("nayin", "") or "")
    flat["pillars"] = pillars
    flat["tg_zhi"] = tg_zhi
    flat["nayin"] = nayin_list

    # Ten gods from pillar_annotations.
    annotations = chart_data.get("pillar_annotations") or {}
    if annotations:
        flat["tg_gan"] = [
            (annotations.get(k) or {}).get("ten_god_gan", "")
            for k in ("year", "month", "day", "hour")
        ]
        flat["tg_zhi"] = [
            (annotations.get(k) or {}).get("ten_god_zhi", "")
            for k in ("year", "month", "day", "hour")
        ]
        flat["dishi"] = [
            (annotations.get(k) or {}).get("dishi", "")
            for k in ("year", "month", "day", "hour")
        ]
        flat["xunkong"] = [
            (annotations.get(k) or {}).get("xunkong", "")
            for k in ("year", "month", "day", "hour")
        ]
        flat["shensha_detail"] = {
            k: (annotations.get(k) or {}).get("shensha", [])
            for k in ("year", "month", "day", "hour")
        }

    # Day master.
    flat["day_master"] = chart.get("day_master", "")

    # Gender — may not be in BaziReading, try to infer or leave empty.
    flat["gender"] = chart_data.get("gender") or chart.get("gender", "")

    # Ming gong / tai yuan (frontend uses underscores).
    flat["minggong"] = chart_data.get("ming_gong") or chart_data.get("minggong") or chart.get("minggong", "")
    flat["taiyuan"] = chart_data.get("tai_yuan") or chart_data.get("taiyuan") or chart.get("taiyuan", "")
    flat["shengong"] = chart_data.get("shen_gong") or chart_data.get("shengong") or chart.get("shengong", "")
    flat["taixi"] = chart_data.get("tai_xi") or chart_data.get("taixi") or chart.get("taixi", "")

    # Wuxing / element balance.
    eb = chart_data.get("element_balance")
    if eb and isinstance(eb, dict):
        flat["wuxing"] = eb
    elif chart.get("wuxing"):
        flat["wuxing"] = chart["wuxing"]

    # Xingchong.
    flat["xingchong"] = chart_data.get("xingchong") or chart.get("xingchong") or {}

    # All shensha (flat list).
    all_shensha = chart_data.get("all_shensha") or []
    if all_shensha:
        flat["shensha"] = [s.get("name", "") for s in all_shensha if isinstance(s, dict)]

    # Dayun — already in compatible format.
    flat["dayun"] = chart_data.get("dayun") or chart.get("dayun") or []

    # Wuxing power & geju.
    if chart_data.get("wuxing_power"):
        flat["wuxing_power"] = chart_data["wuxing_power"]
    if chart_data.get("geju"):
        flat["geju"] = chart_data["geju"]

    return flat


class ProviderConfigError(Exception):
    """Raised when a provider's credentials are missing or incomplete."""


def _cloudflare_base_url(account_id: str) -> str:
    """Build the Workers AI OpenAI-compatible base URL for an account."""
    return f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1"


def _resolve_provider_config(
    provider: str, api_key: str, base_url: str, model: str
) -> Tuple[str, str, str]:
    """
    Fill in any missing credential fields from server-side settings.

    The frontend sends blank fields when the user has not configured their own
    key, which is the normal path for the default Cloudflare provider — its
    credentials live in the server's ``.env`` rather than the browser.

    Raises:
        ProviderConfigError: if the provider cannot be used with what we have.
    """
    if api_key and base_url and model:
        return api_key, base_url, model

    if provider == "Cloudflare":
        api_key = api_key or settings.CF_API_TOKEN
        model = model or settings.CF_MODEL
        if not base_url:
            if not settings.CF_ACCOUNT_ID:
                raise ProviderConfigError(
                    "Cloudflare Workers AI 未配置：请在项目根目录的 .env 中设置 "
                    "BAZI_CF_ACCOUNT_ID 和 BAZI_CF_API_TOKEN，"
                    "或在「设置」页切换到其他 AI 服务商。"
                )
            base_url = _cloudflare_base_url(settings.CF_ACCOUNT_ID)
        if not api_key:
            raise ProviderConfigError(
                "Cloudflare Workers AI 缺少 API Token：请在 .env 中设置 "
                "BAZI_CF_API_TOKEN，或在「设置」页切换到其他 AI 服务商。"
            )
        return api_key, base_url, model

    if provider in ("GLM", "Zhipu"):
        return (
            api_key or settings.ANTHROPIC_API_KEY,
            base_url or settings.ANTHROPIC_BASE_URL,
            model or "glm-5.1",
        )

    return (
        api_key or settings.OPENAI_API_KEY,
        base_url or settings.OPENAI_BASE_URL,
        model or settings.OPENAI_MODEL,
    )


def stream_chat(
    *,
    message: str,
    provider: str,
    api_key: str,
    base_url: str,
    model: str,
    chart_data: Optional[Dict[str, Any]] = None,
    history: Optional[List[Dict[str, str]]] = None,
    max_steps: int = 8,
) -> Generator[Tuple[str, Any], None, None]:
    """
    Run the ReAct agent and yield ``(event_type, payload)`` tuples.

    The caller (SSE router) is responsible for formatting these into
    ``EventSourceResponse`` frames.

    Event types emitted:
      - ``"status"``  — progress messages (tool calls, etc.)
      - ``"token"``   — real-time text chunks from the LLM
      - ``"done"``    — final answer + optional fact-check results
      - ``"error"``   — unrecoverable error

    Args:
        message: User's latest message.
        provider: AI provider name (``"OpenAI"`` or ``"MiMo"``).
        api_key: Provider API key.
        base_url: Provider base URL.
        model: Model identifier.
        chart_data: Pre-computed bazi chart (from /chart).
        history: Previous conversation turns ``[{role, content}, ...]``.
        max_steps: ReAct loop depth limit.

    Yields:
        ``(event_type: str, data: Any)``
    """
    chart_data = _normalize_chart_data(chart_data or {})
    try:
        api_key, base_url, model = _resolve_provider_config(
            provider, api_key, base_url, model
        )
    except ProviderConfigError as exc:
        logger.error("Provider config incomplete: %s", exc)
        yield ("error", {"message": str(exc)})
        return

    # Build system prompt from chart data
    try:
        system_prompt = build_system_prompt(chart_data)
    except Exception:
        logger.warning("Failed to build system prompt", exc_info=True)
        system_prompt = "你是一位专业的命理大师。"

    # Assemble messages
    messages: List[Dict[str, Any]] = [{"role": "system", "content": system_prompt}]
    if history:
        for turn in history:
            if isinstance(turn, dict) and "role" in turn and "content" in turn:
                messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append({"role": "user", "content": message})

    # Create client
    try:
        client_info = create_client(provider, api_key, base_url)
    except Exception as exc:
        logger.error("Failed to create API client: %s", exc)
        yield ("error", {"message": "无法创建 API 客户端，请检查 API Key 和 Base URL 配置。"})
        return

    # Run the streaming ReAct loop
    try:
        gen = run_react_loop_streaming(
            client_info=client_info,
            model=model,
            messages=messages,
            tools=TOOL_SCHEMAS,
            dispatch_tool=dispatch_tool,
            bazi_data=chart_data,
            max_steps=max_steps,
            do_fact_check=True,
        )

        for item in gen:
            if isinstance(item, tuple):
                # Final result: (final_content, updated_messages, fact_check_results)
                final_content, _updated_msgs, fact_checks = item
                yield ("done", {
                    "content": final_content,
                    "fact_checks": fact_checks,
                })
            elif isinstance(item, dict) and item.get("type") == "tool_call":
                # 工具调用卡片：前端 api.ts / useChatSSE / ChatPanel 一路都接了
                # 这个事件，此前后端从未发出，整套调用可视化因此是死的。
                payload = {k: v for k, v in item.items() if k != "type"}
                yield ("tool_call", payload)
            elif isinstance(item, str) and item.startswith("[STATUS] "):
                yield ("status", {"message": item[9:]})
            elif isinstance(item, str):
                yield ("token", {"content": item})
            else:
                # Unexpected type — skip
                logger.debug("Unexpected yield type from agent: %s", type(item))

    except Exception as exc:
        logger.error("Agent streaming failed: %s", exc, exc_info=True)
        yield ("error", {"message": "AI 分析过程中出现错误，请稍后重试。"})
