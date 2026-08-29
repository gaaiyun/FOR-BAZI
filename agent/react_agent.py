# -*- coding: utf-8 -*-
"""
ReAct Agent 循环 — Thought → Action → Observation → ... → Final Answer。

核心设计：
  - 通过 api_adapter 统一调用 OpenAI / Anthropic API
  - 支持多轮工具调用（一次对话中可调用不同工具）
  - 可选 Fact-Check 机制：校验模型输出中的流年干支是否正确
  - 提供流式和非流式两种变体

使用方式：
    from agent import run_react_loop, run_react_loop_streaming
    from agent.api_adapter import create_client

    client_info = create_client("MiMo", api_key, base_url)
    content, msgs, checks = run_react_loop(client_info, model, messages, tools, dispatch)
"""

import json
from typing import Any, Callable, Dict, Generator, List, Tuple, Union

from tools.bazi_tools import extract_ganzhi_from_text, fact_check_ganzhi


def run_react_loop(
    client_info: dict,
    model: str,
    messages: List[Dict[str, Any]],
    tools: List[Dict[str, Any]],
    dispatch_tool: Callable[[str, Dict[str, Any], Dict[str, Any] | None], str],
    bazi_data: Dict[str, Any] | None = None,
    *,
    max_steps: int = 8,
    do_fact_check: bool = True,
) -> Tuple[str, List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    非流式 ReAct 循环。

    执行流程：
      1. 将当前消息列表 + 工具 schema 发送给模型
      2. 若模型返回 tool_calls → 执行工具 → 将结果追加到消息 → 重复
      3. 若模型返回纯文本 → 视为最终回答 → 退出循环
      4. 对最终回答执行 Fact-Check（可选）

    Args:
        client_info: create_client() 返回的客户端信息字典
        model: 模型名称
        messages: 消息列表（含 system 消息）
        tools: 工具 schema 列表
        dispatch_tool: 工具调度函数，(tool_name, args, bazi_data) -> result_str
        bazi_data: 八字数据字典，传递给 dispatch_tool
        max_steps: 最大循环步数（防止无限循环）
        do_fact_check: 是否对最终回答中的流年干支做校验

    Returns:
        (final_content, updated_messages, fact_check_results)
        - final_content: 模型最终回答文本
        - updated_messages: 包含所有工具调用历史的消息列表
        - fact_check_results: 校验失败项列表，每项含 year/claimed/actual/match
    """
    from agent.api_adapter import call_api

    bazi_data = bazi_data or {}
    working = list(messages)
    step = 0
    final_content = ""

    while step < max_steps:
        step += 1

        # 调用模型（通过适配层自动选择 OpenAI/Anthropic 格式）
        result = call_api(client_info, model, working, tools=tools)

        # 模型未调用工具 → 视为最终回答
        if not result["tool_calls"]:
            final_content = result["content"] or "天机不可泄露。"
            working.append({"role": "assistant", "content": final_content})
            break

        # 模型调用了工具 → 依次执行并追加结果
        assistant_msg = {
            "role": "assistant",
            "content": result["content"] or "",
            "tool_calls": result["tool_calls"],
        }
        working.append(assistant_msg)

        for tc in result["tool_calls"]:
            name = tc["function"]["name"]
            try:
                args = json.loads(tc["function"]["arguments"] or "{}")
            except json.JSONDecodeError:
                args = {}
            tool_result = dispatch_tool(name, args, bazi_data)
            working.append({
                "tool_call_id": tc["id"],
                "role": "tool",
                "name": name,
                "content": tool_result,
            })

    # Fact-Check：校验最终回答中的流年干支
    fact_check_results = _run_fact_check(final_content) if do_fact_check else []

    return final_content, working, fact_check_results


def run_react_loop_streaming(
    client_info: dict,
    model: str,
    messages: List[Dict[str, Any]],
    tools: List[Dict[str, Any]],
    dispatch_tool: Callable[[str, Dict[str, Any], Dict[str, Any] | None], str],
    bazi_data: Dict[str, Any] | None = None,
    *,
    max_steps: int = 8,
    do_fact_check: bool = True,
) -> Generator[Union[str, Tuple[str, List, List]], None, None]:
    """
    流式 ReAct 循环（生成器版本）。

    Yield 协议：
      - str 以 "[STATUS] " 开头 → 状态消息（如 "正在调用工具 get_annual_fortune..."）
      - str 无前缀 → 模型生成的实时文本片段
      - tuple → (final_content, updated_messages, fact_check_results) 作为最终结果，总是最后 yield

    使用示例：
        gen = run_react_loop_streaming(client_info, model, messages, tools, dispatch)
        for item in gen:
            if isinstance(item, tuple):
                final_content, messages, fact_checks = item
            elif item.startswith("[STATUS] "):
                show_status(item[9:])
            else:
                stream_to_ui(item)

    Args:
        同 run_react_loop。

    Yields:
        str 或 (str, list, list) 元组
    """
    from agent.api_adapter import call_api_streaming

    bazi_data = bazi_data or {}
    working = list(messages)
    step = 0
    final_content = ""

    while step < max_steps:
        step += 1
        streamed_parts = []
        accumulated = None
        tool_calls = []

        # 流式调用模型
        for item in call_api_streaming(client_info, model, working, tools=tools):
            if isinstance(item, tuple):
                # 收尾元组：(完整累积内容, tool_calls)
                accumulated, tool_calls = item[0], item[1]
            else:
                # 实时内容片段
                streamed_parts.append(item)
                yield item

        # 适配层收尾给的是**完整累积文本**，不是又一个增量块。
        # 把它和各增量块一起 join 会得到「全文 + 全文」，正文整段重复；
        # 而有工具调用时取首个增量块又会把内容截断。两者都以累积文本为准。
        content = accumulated if accumulated is not None else "".join(streamed_parts)

        # 无工具调用 → 最终回答
        if not tool_calls:
            final_content = content.strip() or "天机不可泄露。"
            working.append({"role": "assistant", "content": final_content})
            break

        # 有工具调用 → 依次执行
        assistant_msg = {
            "role": "assistant",
            "content": content or "",
            "tool_calls": tool_calls,
        }
        working.append(assistant_msg)

        for tc in tool_calls:
            name = tc["function"]["name"]
            raw_args = tc["function"]["arguments"] or "{}"
            try:
                args = json.loads(raw_args)
            except json.JSONDecodeError:
                args = {}

            yield f"[STATUS] 正在调用工具 {name}..."
            # 结构化的工具调用事件，供前端渲染调用卡片。
            yield {
                "type": "tool_call",
                "id": tc["id"],
                "name": name,
                "arguments": raw_args,
                "result": None,
                "status": "calling",
            }

            # 单个工具出错不该让整条流断掉——把错误回传给模型，让它自己决定怎么办。
            try:
                result = dispatch_tool(name, args, bazi_data)
                status = "done"
            except Exception as exc:  # noqa: BLE001 - 要把任何工具异常转成可继续的状态
                result = json.dumps(
                    {"error": f"工具 {name} 执行失败：{exc}"}, ensure_ascii=False
                )
                status = "error"

            yield {
                "type": "tool_call",
                "id": tc["id"],
                "name": name,
                "arguments": raw_args,
                "result": result,
                "status": status,
            }

            working.append({
                "tool_call_id": tc["id"],
                "role": "tool",
                "name": name,
                "content": result,
            })

    # Fact-Check
    fact_check_results = _run_fact_check(final_content) if do_fact_check else []

    yield (final_content, working, fact_check_results)


def _run_fact_check(text: str) -> List[Dict[str, Any]]:
    """
    对模型输出文本中的流年干支进行 Fact-Check。

    通过正则提取文本中提到的 "YYYY年 天干地支" 格式，
    然后用 lunar-python 验证实际干支是否与声称一致。

    Args:
        text: 模型输出的文本

    Returns:
        校验失败项列表。每项: {"year": int, "claimed": str, "actual": str, "match": False}
    """
    results = []
    if not text:
        return results

    for year, claimed in extract_ganzhi_from_text(text):
        data = json.loads(fact_check_ganzhi(claimed, year))
        if not data.get("match"):
            results.append({
                "year": year,
                "claimed": data.get("claimed"),
                "actual": data.get("actual"),
                "match": False,
            })

    return results
