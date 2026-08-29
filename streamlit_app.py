import json
import os
from datetime import datetime

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from engine import calculate_professional_bazi
from prompts import build_system_prompt
from tools import TOOL_SCHEMAS, dispatch_tool
from agent import get_messages_for_api, run_react_loop, run_react_loop_streaming
from agent.api_adapter import create_client, call_api, is_anthropic_provider

st.set_page_config(
    page_title="玄冥 | MING MATRIX",
    page_icon="☯️",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500;700&display=swap');
    :root {
        --bg-color: #0d1117;
        --panel-bg: rgba(22, 27, 34, 0.6);
        --accent-gold: #d4af37;
        --accent-silver: #c0c0c0;
        --accent-jade: #50c878;
        --text-primary: #e6edf3;
        --text-secondary: #8b949e;
        --border-color: #30363d;
    }
    .stApp {
        background-color: var(--bg-color);
        color: var(--text-primary);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
    }
    h1, h2, h3 {
        color: var(--text-primary) !important;
        font-weight: 300;
        letter-spacing: 0.1em;
        margin-bottom: 0.5em;
    }
    .chinese-serif {
        font-family: "Noto Serif SC", "Songti SC", serif;
        font-weight: 500;
    }
    h1 .chinese-serif, h2 .chinese-serif, h3 .chinese-serif { color: var(--accent-gold); }
    [data-testid="stSidebar"] {
        background-color: #161b22 !important;
        border-right: 1px solid var(--border-color);
    }
    .stTextInput>div>div>input, .stSelectbox>div>div>div, .stDateInput>div>div>input, .stTimeInput>div>div>input {
        background-color: #0d1117 !important;
        border: 1px solid var(--border-color) !important;
        color: var(--text-primary) !important;
        border-radius: 6px;
    }
    label, .stRadio label p { color: var(--text-primary) !important; }
    [data-testid="stHeader"] { display: none; }
    .block-container { padding-top: 2rem !important; }
    .stButton>button {
        background-color: transparent !important;
        border: 1px solid var(--accent-gold) !important;
        color: var(--accent-gold) !important;
        border-radius: 4px;
        transition: all 0.3s ease;
        letter-spacing: 0.15em;
        font-family: "Noto Serif SC", serif;
    }
    .stButton>button:hover {
        background-color: rgba(212, 175, 55, 0.1) !important;
        color: #fff !important;
        box-shadow: 0 0 10px rgba(212, 175, 55, 0.2);
    }
    [data-testid="stChatMessage"] { background-color: transparent; border: none; padding: 0; margin-bottom: 24px; }
    [data-testid="stChatMessage"][data-baseweb="box"] .stMarkdown {
        background-color: var(--panel-bg);
        border-radius: 8px;
        padding: 16px 20px;
        border: 1px solid var(--border-color);
    }
    .stMarkdown p, .stMarkdown li, [data-testid="stChatMessage"] p {
        color: var(--text-primary) !important;
        line-height: 1.6;
        font-size: 1.05rem;
    }
    .bazi-pillar {
        background: var(--panel-bg);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 20px 10px;
        text-align: center;
        transition: transform 0.2s ease;
    }
    .bazi-pillar:hover { border-color: var(--accent-gold); transform: translateY(-2px); }
    .pillar-header { font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 8px; }
    .god-gan { font-size: 0.85rem; color: var(--accent-silver); margin-bottom: 4px; }
    .gan, .zhi { font-size: 2.2rem; font-weight: bold; color: var(--text-primary); line-height: 1.1; margin-bottom: 8px; }
    .nayin { font-size: 0.75rem; color: var(--accent-gold); margin-bottom: 8px; }
    .god-zhi { font-size: 0.75rem; color: var(--text-secondary); border-top: 1px solid var(--border-color); padding-top: 8px; }
    .shensha { font-size: 0.75rem; color: var(--accent-jade); margin-top: 4px; }
    /* --- Wuxing element colors --- */
    .wx-wood   { color: #50c878 !important; }
    .wx-fire   { color: #e94560 !important; }
    .wx-earth  { color: #d4af37 !important; }
    .wx-metal  { color: #c0c0c0 !important; }
    .wx-water  { color: #4a90d9 !important; }
    /* --- Pillar card fade-in animation --- */
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; } }
    .bazi-pillar { animation: fadeIn 0.5s ease-in-out; }
    /* --- Disheng/xunkong micro labels --- */
    .dishi-label { font-size: 0.7rem; color: var(--accent-jade); opacity: 0.85; margin-top: 2px; }
    .xunkong-label { font-size: 0.65rem; color: var(--accent-silver); opacity: 0.7; margin-top: 1px; }
</style>
""", unsafe_allow_html=True)


def render_wuxing_chart(wuxing):
    df = pd.DataFrame(dict(
        r=[v * 20 for v in wuxing.values()],
        theta=list(wuxing.keys())
    ))
    fig = px.line_polar(df, r='r', theta='theta', line_close=True)
    fig.update_traces(fill='toself', line_color='#d4af37', fillcolor='rgba(212, 175, 55, 0.2)')
    fig.update_layout(
        polar=dict(
            radialaxis=dict(visible=False, range=[0, 80]),
            angularaxis=dict(tickfont=dict(color='#8b949e', size=13)),
            bgcolor='rgba(0,0,0,0)'
        ),
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        margin=dict(l=20, r=20, t=20, b=20),
        height=250
    )
    return fig


# ── Wuxing color helper ──────────────────────────────────────────────────────

_WUXING_COLOR_MAP = {
    "甲": "#50c878", "乙": "#50c878", "寅": "#50c878", "卯": "#50c878",   # Wood
    "丙": "#e94560", "丁": "#e94560", "巳": "#e94560", "午": "#e94560",   # Fire
    "戊": "#d4af37", "己": "#d4af37", "辰": "#d4af37", "戌": "#d4af37",
    "丑": "#d4af37", "未": "#d4af37",                                      # Earth
    "庚": "#c0c0c0", "辛": "#c0c0c0", "申": "#c0c0c0", "酉": "#c0c0c0",   # Metal
    "壬": "#4a90d9", "癸": "#4a90d9", "亥": "#4a90d9", "子": "#4a90d9",   # Water
}


def get_wuxing_color(char: str) -> str:
    """Return the hex color for a Chinese character based on its wuxing element."""
    return _WUXING_COLOR_MAP.get(char, "#e6edf3")


def colored_char(char: str) -> str:
    """Wrap a single character in a <span> with its wuxing color."""
    color = get_wuxing_color(char)
    return f'<span style="color:{color};font-weight:bold;">{char}</span>'


def colored_ganzhi(gz: str) -> str:
    """Color both characters of a two-char gan-zhi string."""
    if len(gz) >= 2:
        return colored_char(gz[0]) + colored_char(gz[1])
    return gz


def _render_wuxing_bar_chart(bzi):
    """Render a detailed wuxing bar chart with power percentages."""
    raw = bzi.get("wuxing", {})
    # Try to use refined power data if available
    try:
        from tools.wuxing_calculator import calculate_wuxing_power
        result = json.loads(calculate_wuxing_power(bzi))
        power = result.get("power", {})
    except Exception:
        power = {}
    if not power:
        power = raw
    elements = ["金", "木", "水", "火", "土"]
    colors = ["#c0c0c0", "#50c878", "#4a90d9", "#e94560", "#d4af37"]
    values = [power.get(e, raw.get(f"{e}(Metal)" if e == "金" else f"{e}(Wood)" if e == "木" else f"{e}(Water)" if e == "水" else f"{e}(Fire)" if e == "火" else f"{e}(Earth)", 0)) for e in elements]
    fig = go.Figure(go.Bar(
        x=elements, y=values, marker_color=colors,
        text=[f"{v}%" if isinstance(v, (int, float)) and v > 0 else str(v) for v in values],
        textposition="outside", textfont=dict(color="#e6edf3", size=12),
    ))
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
        xaxis=dict(tickfont=dict(color="#8b949e", size=14)),
        yaxis=dict(tickfont=dict(color="#8b949e"), gridcolor="rgba(48,54,61,0.5)", range=[0, max(max(values) * 1.2, 10)]),
        margin=dict(l=20, r=20, t=10, b=20), height=260,
    )
    return fig


def _render_dayun_timeline(bzi):
    """Render a horizontal timeline chart for dayun (luck pillars)."""
    dayun = bzi.get("dayun", [])
    if not dayun:
        return None
    current_year = datetime.now().year
    years = [d["start_year"] for d in dayun]
    end_years = years[1:] + [years[-1] + 10]
    ganzhi_labels = [d["ganzhi"] for d in dayun]
    bar_colors = []
    for gz in ganzhi_labels:
        if len(gz) >= 2:
            zhi_color = get_wuxing_color(gz[1])
            bar_colors.append(zhi_color)
        else:
            bar_colors.append("#8b949e")
    # Highlight current year segment
    for idx in range(len(years)):
        if years[idx] <= current_year < end_years[idx]:
            bar_colors[idx] = "#e94560"
    fig = go.Figure()
    for idx in range(len(dayun)):
        width = end_years[idx] - years[idx]
        fig.add_trace(go.Bar(
            y=[ganzhi_labels[idx]], x=[width], base=[years[idx]],
            orientation="h", marker_color=bar_colors[idx],
            text=f"{years[idx]}-{end_years[idx]-1}",
            textposition="inside", textfont=dict(color="#0d1117", size=11),
            name=ganzhi_labels[idx], showlegend=False,
            hovertemplate=f"{ganzhi_labels[idx]}<br>{years[idx]}-{end_years[idx]-1}<br>起于{dayun[idx]['start_age']}岁<extra></extra>",
        ))
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
        xaxis=dict(
            tickfont=dict(color="#8b949e", size=10), gridcolor="rgba(48,54,61,0.3)",
            title=dict(text="年份", font=dict(color="#8b949e", size=11)),
        ),
        yaxis=dict(tickfont=dict(color="#e6edf3", size=12), autorange="reversed"),
        margin=dict(l=10, r=10, t=5, b=30), height=max(180, len(dayun) * 36),
        bargap=0.3,
    )
    return fig


PROVIDER_PRESETS = {
    "MiniMax": {
        "base_url": "https://api.minimaxi.com/v1",
        "models": ["MiniMax-M2.7", "MiniMax-Text-01", "MiniMax-M1"],
        "env_key": "BAZI_OPENAI_API_KEY",
    },
    "智谱 GLM": {
        "base_url": "https://open.bigmodel.cn/api/anthropic",
        "models": ["glm-5.1", "glm-4.7", "glm-4.5-air"],
        "env_key": "BAZI_ANTHROPIC_API_KEY",
    },
    "阿里云百炼": {
        "base_url": "https://coding.dashscope.aliyuncs.com/v1",
        "models": ["qwen3.5-plus", "qwen3-coder-plus", "qwen-plus", "qwen-max"],
        "env_key": "DASHSCOPE_API_KEY",
    },
    "OpenAI": {
        "base_url": "https://api.openai.com/v1",
        "models": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
        "env_key": "OPENAI_API_KEY",
    },
    # Anthropic 协议的 base_url 不带 /v1 —— SDK 自行拼接 /v1/messages。
    "Anthropic (兼容)": {
        "base_url": "https://api.anthropic.com",
        "models": ["claude-sonnet-5", "claude-opus-5", "claude-haiku-4-5-20251001"],
        "env_key": "ANTHROPIC_API_KEY",
    },
    "MiMo": {
        "base_url": "https://token-plan-cn.xiaomimimo.com/anthropic",
        "models": ["mimo-v2.5-pro"],
        "env_key": "ANTHROPIC_AUTH_TOKEN",
    },
    "自定义 (Custom)": {
        "base_url": "",
        "models": [],
        "env_key": "",
    },
}


def _get_default_api_key(env_key: str) -> str:
    if env_key:
        # Check URL query params first (for testing / automation)
        try:
            qp = st.query_params
            if env_key in qp:
                return qp[env_key]
        except Exception:
            pass
        try:
            if st.secrets.get(env_key):
                return st.secrets[env_key]
        except Exception:
            pass
        return os.environ.get(env_key, "")
    return ""


st.markdown("<h1>玄冥 | <span class='chinese-serif'>命理架构终端</span></h1>", unsafe_allow_html=True)
st.markdown("秉持传统数术严谨，重构当代命运图谱。")

with st.sidebar:
    st.header("⚙️ 模型配置 (MODEL CONFIG)")

    provider = st.selectbox("服务商 (Provider)", list(PROVIDER_PRESETS.keys()), index=0)
    preset = PROVIDER_PRESETS[provider]

    if provider == "自定义 (Custom)":
        base_url = st.text_input("API Base URL", placeholder="https://your-api.com/v1")
        custom_model = st.text_input("模型名称 (Model)", placeholder="gpt-4o")
        selected_model = custom_model
        env_key = st.text_input("环境变量名 (可选)", placeholder="MY_API_KEY")
    else:
        base_url = preset["base_url"]
        selected_model = st.selectbox("模型 (Model)", preset["models"])
        env_key = preset["env_key"]

    default_key = _get_default_api_key(env_key)
    api_key = st.text_input(
        "API Key",
        type="password",
        value=default_key or "",
        placeholder=f"输入 Key 或设置环境变量 {env_key}",
    )
    api_key = api_key.strip() or default_key

    if provider != "自定义 (Custom)":
        with st.expander("高级设置"):
            base_url = st.text_input("Base URL (可修改)", value=base_url)
            custom_model_override = st.text_input("模型名 (留空用上方选择)", placeholder="留空则使用下拉选择")
            if custom_model_override.strip():
                selected_model = custom_model_override.strip()
    enable_streaming = st.toggle("流式输出 (Streaming)", value=True, help="实时逐字显示回答；若 API 不稳定可关闭。")

    st.markdown("---")
    st.header("📜 四柱排盘 (BAZI INPUT)")
    gender = st.radio("系统性别", ["乾造 (Male)", "坤造 (Female)"])
    birth_date = st.date_input(
        "公历出生日",
        value=datetime(1990, 6, 15),
        min_value=datetime(1900, 1, 1),
        max_value=datetime(2100, 1, 1)
    )
    birth_time = st.time_input("出生时间 (时辰)")

    if st.button("生成命盘体系 (GENERATE)"):
        with st.spinner("推算先天数据矩阵..."):
            dt = datetime.combine(birth_date, birth_time)
            bazi = calculate_professional_bazi(dt, gender)
            st.session_state['bazi_data'] = bazi
            st.session_state['messages'] = [
                {"role": "system", "content": build_system_prompt(bazi)}
            ]
            st.session_state['chat_history'] = []

            if api_key:
                st.session_state.pop('api_key_missing', None)
                try:
                    client_info = create_client(provider, api_key, base_url)
                    # Include a user prompt for the greeting (Anthropic API requires at least one user message)
                    greeting_messages = st.session_state['messages'] + [
                        {"role": "user", "content": "请用一句话问候来者，并简要介绍这个命盘的核心特征。"}
                    ]
                    result = call_api(
                        client_info, selected_model,
                        greeting_messages,
                        temperature=0.6, max_tokens=1024,
                    )
                    greeting = result["content"]
                    if greeting:
                        st.session_state['messages'].append({"role": "assistant", "content": greeting})
                        st.session_state['chat_history'].append({"role": "assistant", "content": greeting})
                except Exception as e:
                    st.error(f"API 调用失败: {e}")
            else:
                st.session_state['api_key_missing'] = env_key

if 'bazi_data' in st.session_state:
    bzi = st.session_state['bazi_data']
    if 'api_key_missing' in st.session_state:
        st.warning(f"未配置 API Key，请在侧边栏填写或设置环境变量 {st.session_state['api_key_missing']}。")
    col_matrix, col_chat = st.columns([1, 1.2])

    with col_matrix:
        st.markdown("<h3><span class='chinese-serif'>命盘矩阵</span> (MING MATRIX)</h3>", unsafe_allow_html=True)

        # ── 四柱排盘（始终可见）────────────────────────────────────────────
        cols = st.columns(4)
        labels = ["年柱 (祖业)", "月柱 (机缘)", "日柱 (本我)", "时柱 (晚成)"]
        dishi_list = bzi.get("dishi", ["", "", "", ""])
        xunkong_list = bzi.get("xunkong", ["", "", "", ""])
        for i, col in enumerate(cols):
            with col:
                gan_ch = bzi['pillars'][i][0]
                zhi_ch = bzi['pillars'][i][1]
                dishi_val = dishi_list[i] if i < len(dishi_list) else ""
                xunkong_val = xunkong_list[i] if i < len(xunkong_list) else ""
                dishi_html = f'<div class="dishi-label">{dishi_val}</div>' if dishi_val else ""
                xunkong_html = f'<div class="xunkong-label">旬空: {xunkong_val}</div>' if xunkong_val else ""
                st.markdown(f"""
                <div class="bazi-pillar">
                    <div class="pillar-header">{labels[i]}</div>
                    <div class="god-gan">{bzi['tg_gan'][i]}</div>
                    <div class="gan">{colored_char(gan_ch)}</div>
                    <div class="zhi">{colored_char(zhi_ch)}</div>
                    <div class="nayin">{bzi['nayin'][i]}</div>
                    <div class="god-zhi">藏干: {bzi['tg_zhi'][i]}</div>
                    <div class="shensha">{bzi['shensha'][i]}</div>
                    {dishi_html}
                    {xunkong_html}
                </div>
                """, unsafe_allow_html=True)

        # ── 命宫/胎元/身宫/胎息 + 五行雷达图 ─────────────────────────────
        st.markdown("<br/>", unsafe_allow_html=True)
        cols_bottom = st.columns([1, 1.2])
        with cols_bottom[0]:
            shengong = bzi.get("shengong", "")
            taixi = bzi.get("taixi", "")
            extra_info = f"**命宫**: {bzi['minggong']} &nbsp;|&nbsp; **胎元**: {bzi['taiyuan']}"
            if shengong:
                extra_info += f" &nbsp;|&nbsp; **身宫**: {shengong}"
            if taixi:
                extra_info += f" &nbsp;|&nbsp; **胎息**: {taixi}"
            st.markdown(extra_info, unsafe_allow_html=True)
            st.plotly_chart(render_wuxing_chart(bzi['wuxing']), width="stretch")
        with cols_bottom[1]:
            st.markdown("**大运概览**")
            for d in bzi['dayun']:
                st.markdown(f"`{d['start_year']} (起于{d['start_age']}岁) -> {d['ganzhi']}`")

        # ── 详细分析标签页 ──────────────────────────────────────────────
        tab_dayun, tab_geju, tab_wuxing = st.tabs(["大运流年", "格局神煞", "五行精算"])

        # ── Tab 1: 大运流年 ─────────────────────────────────────────────────
        with tab_dayun:
            st.markdown("#### 后天大运轨迹 (Luck Pillars)")
            dayun = bzi.get("dayun", [])
            if dayun:
                current_year = datetime.now().year
                for d in dayun:
                    end_year = d["start_year"] + 10
                    is_current = d["start_year"] <= current_year < end_year
                    marker = " **[当前]**" if is_current else ""
                    gz_colored = colored_ganzhi(d["ganzhi"])
                    st.markdown(
                        f"<span style='color:#8b949e;'>{d['start_year']}</span> "
                        f"(起于{d['start_age']}岁) &rarr; "
                        f"<span style='font-size:1.3rem;'>{gz_colored}</span>{marker}",
                        unsafe_allow_html=True,
                    )
                st.markdown("<br/>", unsafe_allow_html=True)
                fig_dayun = _render_dayun_timeline(bzi)
                if fig_dayun:
                    st.plotly_chart(fig_dayun, width="stretch")
            else:
                st.info("暂无大运数据。")

        # ── Tab 3: 格局神煞 ─────────────────────────────────────────────────
        with tab_geju:
            st.markdown("#### 格局判定 (Geju Analysis)")
            try:
                from tools.geju_analyzer import analyze_geju
                geju_raw = analyze_geju(bzi)
                geju = json.loads(geju_raw) if isinstance(geju_raw, str) else geju_raw
                geju_context = geju.get("context", "")
                if geju_context:
                    st.markdown(f"> {geju_context}")
                geju_kv = {k: v for k, v in geju.items() if k != "context"}
                if geju_kv:
                    for k, v in geju_kv.items():
                        st.markdown(f"- **{k}**: {v}")
            except Exception as e:
                st.warning(f"格局分析不可用: {e}")

            st.markdown("<br/>", unsafe_allow_html=True)
            st.markdown("#### 神煞一览 (Shen Sha)")
            shensha_detail = bzi.get("shensha_detail", {})
            if shensha_detail:
                for category, items in shensha_detail.items():
                    if items:
                        st.markdown(f"**{category}**: {', '.join(items) if isinstance(items, list) else items}")
            else:
                pillar_names = ["年柱", "月柱", "日柱", "时柱"]
                has_any = False
                for i, ss in enumerate(bzi.get("shensha", [])):
                    if ss:
                        has_any = True
                        st.markdown(f"- **{pillar_names[i]}**: {ss}")
                if not has_any:
                    st.info("命局未见显著神煞。")

            st.markdown("<br/>", unsafe_allow_html=True)
            st.markdown("#### 刑冲合害 (Xing-Chong)")
            xingchong = bzi.get("xingchong", {})
            if xingchong:
                for rel_type, rel_list in xingchong.items():
                    if rel_list:
                        st.markdown(f"**{rel_type}**: {', '.join(rel_list)}")

        # ── Tab 4: 五行精算 ─────────────────────────────────────────────────
        with tab_wuxing:
            st.markdown("#### 五行力量精算 (Wuxing Power)")
            try:
                from tools.wuxing_calculator import calculate_wuxing_power
                wx_result = json.loads(calculate_wuxing_power(bzi))
                power = wx_result.get("power", {})
                strong = wx_result.get("strong", [])
                weak = wx_result.get("weak", [])
                balanced = wx_result.get("balanced", False)
                context = wx_result.get("context", "")
                if context:
                    st.markdown(f"> {context}")
                elem_colors = {"金": "#c0c0c0", "木": "#50c878", "水": "#4a90d9", "火": "#e94560", "土": "#d4af37"}
                for elem, pct in power.items():
                    bar_len = int(pct / 2)
                    bar = "█" * bar_len
                    color = elem_colors.get(elem, "#e6edf3")
                    st.markdown(
                        f"<span style='color:{color};font-weight:bold;'>{elem}</span> "
                        f"<code style='color:{color};'>{bar}</code> {pct}%",
                        unsafe_allow_html=True,
                    )
                if strong:
                    st.markdown(f"**偏旺**: {', '.join(strong)}")
                if weak:
                    st.markdown(f"**偏弱**: {', '.join(weak)}")
                if balanced:
                    st.markdown("**五行较均衡**")
            except Exception:
                raw = bzi.get("wuxing", {})
                for k, v in raw.items():
                    st.markdown(f"- **{k}**: {v}")

            st.markdown("<br/>", unsafe_allow_html=True)
            fig_bar = _render_wuxing_bar_chart(bzi)
            st.plotly_chart(fig_bar, width="stretch")

    with col_chat:
        st.markdown("<h3><span class='chinese-serif'>命理论道</span> (ORACLE ENGINE)</h3>", unsafe_allow_html=True)
        for msg in st.session_state.get('chat_history', []):
            with st.chat_message(msg["role"]):
                st.markdown(msg["content"])

        if prompt := st.chat_input("向玄冥大师提问 (如：我何时能遇正缘？2026年我的运势如何？)"):
            st.session_state.setdefault('chat_history', []).append({"role": "user", "content": prompt})
            st.session_state.setdefault('messages', []).append({"role": "user", "content": prompt})

            with st.chat_message("user"):
                st.markdown(prompt)

            with st.chat_message("assistant"):
                message_placeholder = st.empty()
                if not api_key:
                    message_placeholder.markdown("请先在侧边栏配置 API Key。")
                else:
                    try:
                        client_info = create_client(provider, api_key, base_url)
                        original_count = len(st.session_state['messages'])
                        messages_for_api = get_messages_for_api(
                            st.session_state['messages'],
                        )
                        if len(messages_for_api) < original_count:
                            st.caption("📜 此前对话已摘要保存，上下文已优化。")

                        if enable_streaming:
                            # --- Streaming mode ---
                            accumulated = ""
                            status_box = None
                            gen = run_react_loop_streaming(
                                client_info,
                                selected_model,
                                messages_for_api,
                                TOOL_SCHEMAS,
                                dispatch_tool,
                                bazi_data=st.session_state['bazi_data'],
                                max_steps=8,
                                do_fact_check=True,
                            )
                            for item in gen:
                                if isinstance(item, tuple):
                                    final_content, updated_messages, fact_check_results = item
                                    if status_box is not None:
                                        status_box.update(label="推算完成", state="complete")
                                elif item.startswith("[STATUS] "):
                                    status_text = item.removeprefix("[STATUS] ")
                                    if status_box is None:
                                        status_box = st.status(status_text, state="running")
                                    else:
                                        status_box.update(label=status_text, state="running")
                                else:
                                    accumulated += item
                                    message_placeholder.markdown(accumulated + "▌")

                            # Final render without cursor
                            message_placeholder.markdown(final_content)
                            st.session_state['messages'] = updated_messages
                            st.session_state['chat_history'].append({"role": "assistant", "content": final_content})
                            if fact_check_results:
                                for fc in fact_check_results:
                                    st.warning(f"Fact-Check: {fc.get('year')}年 声称「{fc.get('claimed')}」实际为「{fc.get('actual')}」，已按实际校正。")
                        else:
                            # --- Non-streaming fallback ---
                            with st.spinner("正在推算..."):
                                final_content, updated_messages, fact_check_results = run_react_loop(
                                    client_info,
                                    selected_model,
                                    messages_for_api,
                                    TOOL_SCHEMAS,
                                    dispatch_tool,
                                    bazi_data=st.session_state['bazi_data'],
                                    max_steps=8,
                                    do_fact_check=True,
                                )
                            st.session_state['messages'] = updated_messages
                            message_placeholder.markdown(final_content)
                            st.session_state['chat_history'].append({"role": "assistant", "content": final_content})
                            if fact_check_results:
                                for fc in fact_check_results:
                                    st.warning(f"Fact-Check: {fc.get('year')}年 声称「{fc.get('claimed')}」实际为「{fc.get('actual')}」，已按实际校正。")
                    except Exception as e:
                        st.error(f"引擎同步异常: {e}")

else:
    st.info("👈 调校左侧八字参数，进入命运罗盘。")
