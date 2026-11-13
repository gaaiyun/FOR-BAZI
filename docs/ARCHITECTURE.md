# FOR-BAZI 架构文档

> 系统架构、模块职责、数据流。第 3–6、9 节描述的是 Python 后端（桌面版与 MCP 使用）。

---

## 1. 总体架构

网页版的计算全部在浏览器里完成：排盘引擎、14 个 Agent 工具、5 本古籍的检索都打包进前端，
只有模型补全经过一个同源的 Pages Function 网关。Python 部分保留为对拍基准，
并服务桌面版、MCP 服务器和 Streamlit 旧版。

```mermaid
graph TB
    subgraph Browser["浏览器"]
        direction TB
        Pages["10 个页面<br/>按路由懒加载"]
        View["lib/chart-view.ts<br/>展示模型（十神、大运、流年、十神分布）"]
        Text["lib/chart-text.ts<br/>复制给 AI 的文本"]
        Birth["lib/solar-time.ts<br/>农历 · 真太阳时 · 夏令时"]
        TSEngine["src/engine/<br/>四柱 · 神煞 · 五行 · 格局 · 刑冲"]
        Agent["lib/react-agent.ts<br/>ReAct 循环 + 14 个工具"]
        Books["古籍 JSON<br/>按需加载"]
        Store["Zustand + localStorage<br/>命盘历史 · 对话 · 解读存档 · 设置"]
        Pages --> View --> TSEngine
        Pages --> Text --> View
        Pages --> Birth --> TSEngine
        Pages --> Agent --> TSEngine
        Agent --> Books
        Pages --> Store
    end

    subgraph Edge["Cloudflare Pages Function"]
        GW["/api/chat · /api/quota<br/>匿名限次（KV）· 访问密钥 · 转发自带 Key"]
    end

    subgraph Models["模型"]
        WAI["Workers AI（默认免费）"]
        BYO["自带服务商<br/>OpenAI · Anthropic · DeepSeek · 百炼 · MiMo"]
    end

    Agent -->|SSE| GW
    GW --> WAI
    GW --> BYO

    subgraph Python["Python（对拍基准 / 桌面版 / MCP）"]
        PyEngine["engine/ · tools/<br/>与 TS 引擎逐字段一致"]
        Backend["backend/ FastAPI"]
        MCP["mcp_server/"]
        Backend --> PyEngine
        MCP --> PyEngine
    end

    PyEngine -. "scripts/gen_golden_fixtures.py<br/>导出 18 个边界命例" .-> TSEngine
```

### 引擎为什么有两份

排盘移到浏览器之后，站点可以纯静态部署，用户的出生信息也不再离开设备。代价是要维护两份实现。
约束办法是对拍：`scripts/gen_golden_fixtures.py` 从 Python 引擎导出 18 个边界命例
（立春交节、晚子时跨日、除夕、闰年、大运顺逆、从格边界等）的全部字段，
`frontend/src/engine/parity.test.ts` 要求 TS 引擎逐字段相等，包括同柱多个神煞的先后顺序。
改任何一边的规则，都要两边一起改，再重新导出基准。

---

## 2. 前端架构

```mermaid
graph TB
    subgraph Routes["路由（全部懒加载）"]
        R1["/ 排盘"]
        R2["/chart 命盘"]
        R3["/luck-pillars 大运"]
        R4["/annual 流年（?year=）"]
        R5["/elements 五行"]
        R6["/ten-gods 十神"]
        R7["/shensha 神煞"]
        R8["/ai-reading 解读"]
        R9["/chat 问事"]
        R10["/settings 设置"]
    end

    subgraph Shell["layout/"]
        AppShell["AppShell<br/>宽屏左侧导航 · 手机底部导航 + 「更多」"]
        Page["Page.tsx<br/>PageHeader · Section · Facts · EmptyState"]
    end

    subgraph Viz["components/bazi/"]
        PillarTable["PillarTable 四柱表"]
        Relation["RelationDiagram 干支关系弧线"]
        Cycle["ElementCycle 五行生克图"]
        Bars["Bars 细条图"]
        Dayun["DayunTimeline 大运轨道"]
        Years["YearGrid · YearDetail 流年"]
        Copy["CopyChart 复制给 AI"]
    end

    subgraph Stores["stores/"]
        BaziStore["useBaziStore<br/>输入 · 当前命盘 · 历史（20 份）"]
        ChatStore["useChatStore<br/>消息 · 所属命盘 id"]
        ReadingStore["useAIReadingStore<br/>按「命盘 + 主题」存解读"]
        SettingsStore["useSettingsStore<br/>服务商 · 主题"]
    end

    Routes --> Shell
    Routes --> Viz
    Routes --> Stores
```

### 数据流

```mermaid
graph LR
    Input["表单输入<br/>公历/农历 · 出生地"] --> Resolve["resolveBirth()<br/>农历转公历 → 扣夏令时 → 真太阳时"]
    Resolve --> Calc["calculateChart()<br/>TS 引擎"]
    Calc --> Adapt["adaptChartResponse()<br/>扁平字段 → BaziReading"]
    Adapt --> Reading["BaziReading<br/>+ engine_chart 原件<br/>+ birth 换算记录"]
    Reading --> View["deriveChart()<br/>ChartView"]
    View --> PagesOut["各页面"]
    View --> CopyOut["buildChartText()<br/>Markdown / JSON"]
    Reading --> AgentIn["ReAct 循环<br/>直接用 engine_chart"]
```

- `BaziReading` 同时带着嵌套结构（页面用）和引擎原件 `engine_chart`（工具用），免去来回转换。
- 所有派生量（藏干十神、大运十神、虚岁、十神加权分布、原局关系）只在 `deriveChart()` 里算一次，
  页面和复制文本用的是同一份，口径不会分叉。
- 外来干支（某步大运、某个流年）与原局的合冲刑害由 `lib/relations.ts` 计算，只报事实，不下吉凶。

### 视觉约定

- 不用卡片，靠细线和留白分区；墨色加一种朱砂强调色，昼夜两套主题由 `lib/theme.ts` 切换，
  `index.html` 里的内联脚本在首帧前定好主题，避免闪烁。
- 五行色是 CSS 变量（`--wx-wood` 等），昼夜各一套明度。`getCharColor()` 返回的是 `var(...)`，
  要半透明请用 `tint()`（`color-mix`），不能往后拼十六进制透明度。
- 字体：思源宋体 400/600 用 fontsource 的分片版，浏览器只下载页面上出现的字所在的分片；
  干支大字另有一个 29 字的 900 字重子集（`frontend/scripts/subset_glyph_font.py` 生成，约 5 KB）。

---

## 3. 后端架构

```mermaid
graph TB
    subgraph Middleware["中间件"]
        CORS["CORS Middleware<br/>7 allowed origins"]
        StaticFiles["StaticFiles<br/>frontend/dist/"]
    end

    subgraph Routes["API Routes"]
        ChartRoute["/api/v1/chart<br/>POST → bazi_service.calculate_chart()"]
        ChatRoute["/api/v1/chat/stream<br/>POST → agent_service.stream_chat()"]
        TextsRoute["/api/v1/texts<br/>GET → text_service.query()"]
        CompatRoute["/api/v1/compatibility<br/>POST → bazi_service × 2"]
        EntertainRoute["/api/v1/entertainment/*<br/>GET → entertainment"]
        HealthRoute["/health<br/>GET → {status: ok}"]
    end

    subgraph Services["Services"]
        BaziService["bazi_service.py<br/>calculate_chart()<br/>256-entry LRU Cache<br/>Thread-safe"]
        AgentService["agent_service.py<br/>stream_chat()<br/>_normalize_chart_data()"]
        TextService["text_service.py<br/>query() · get_all_entries()"]
    end

    subgraph Schemas["Pydantic Schemas"]
        ChartReq["ChartRequest<br/>datetime_str · gender"]
        ChartResp["ChartResponse<br/>chart · wuxing_power · geju"]
        ChatReq["ChatRequest<br/>message · provider · api_key · chart_data · history"]
    end

    Middleware --> Routes
    Routes --> Services
    Services --> Schemas
```

---

## 4. AI Agent 架构

### ReAct 推理循环

```mermaid
stateDiagram-v2
    [*] --> ReceiveMessage: 用户消息
    ReceiveMessage --> BuildPrompt: 构建 System Prompt<br/>+ 命盘参数 + 古籍参考
    
    state "ReAct Loop (max 8)" as Loop {
        BuildPrompt --> CallLLM: 发送 messages + tools
        CallLLM --> HasToolCall: 模型返回
        
        state HasToolCall <<choice>>
        HasToolCall --> ExecuteTool: tool_calls 存在
        HasToolCall --> FinalAnswer: 纯文本回答
        
        ExecuteTool --> AppendResult: 执行工具 → 结果
        AppendResult --> CallLLM: 追加到消息历史
        
        FinalAnswer --> FactCheck: 干支校验
    }
    
    FactCheck --> [*]: SSE done event
```

### API 适配层

```mermaid
graph TD
    subgraph Providers["Provider Detection"]
        Check{"provider in<br/>ANTHROPIC_PROVIDERS?"}
    end

    subgraph AnthropicPath["Anthropic SDK Path"]
        A_Client["Anthropic()<br/>api_key · base_url"]
        A_Call["messages.create()<br/>stream=True"]
        A_Parse["Parse tool_use blocks"]
    end

    subgraph OpenAIPath["OpenAI SDK Path"]
        O_Client["OpenAI()<br/>api_key · base_url"]
        O_Call["chat.completions.create()<br/>stream=True"]
        O_Parse["Parse tool_calls"]
    end

    subgraph ANTHROPIC_PROVIDERS["ANTHROPIC_PROVIDERS"]
        P1["MiMo"]
        P2["GLM"]
        P3["Zhipu"]
        P4["智谱 GLM"]
        P5["Anthropic (兼容)"]
    end

    Check -->|"Yes<br/>MiMo/GLM/Zhipu"| AnthropicPath
    Check -->|"No<br/>OpenAI/DeepSeek/..."| OpenAIPath
```

### 14 个工具注册表

```mermaid
graph TD
    subgraph Registry["TOOL_REGISTRY + TOOL_SCHEMAS"]
        D["dispatch_tool(name, args, bazi_data)"]
    end

    subgraph G1["计算类"]
        T1["get_annual_fortune(year)"]
        T2["get_dayun_stage(bazi_data, current_year)"]
        T3["calculate_wuxing_power(bazi_data)"]
        T4["analyze_wuxing_balance(bazi_data)"]
        T5["analyze_geju(bazi_data)"]
    end

    subgraph G2["古籍查询类"]
        T6["query_qiongtong_guidance(day_master, month_zhi)"]
        T7["query_disitian_guidance(day_master)"]
        T8["query_ziping_guidance(day_master, month_zhi)"]
        T9["query_sanming_guidance(category, key)"]
        T10["query_classical_text(source, keyword)"]
    end

    subgraph G3["辅助类"]
        T11["rag_retrieve(query, top_k)"]
        T12["query_xing_chong_he_hai(chars, relation_type)"]
        T13["explain_shensha(name)"]
        T14["fact_check_ganzhi(year, claimed_ganzhi)"]
    end

    D --> G1 & G2 & G3
```

---

## 5. SSE 流式通信

```mermaid
sequenceDiagram
    participant Browser as React 前端
    participant Server as FastAPI /chat/stream

    Browser->>Server: POST (fetch + ReadableStream)
    Note over Browser: body: {message, provider, chart_data, history}

    Server->>Server: _normalize_chart_data(chart_data)
    Server->>Server: build_system_prompt(bazi_data)

    loop ReAct Loop
        Server->>Server: Call AI Model
        alt Tool Call
            Server-->>Browser: event: status\ndata: {"message": "调用工具..."}
            Server-->>Browser: event: tool_call\ndata: {"name": "analyze_geju", ...}
        else Token Stream
            loop Each Token
                Server-->>Browser: event: token\ndata: {"content": "..."}
            end
        end
    end

    Server-->>Browser: event: done\ndata: {"content": "完整回答"}
    Note over Browser: onToken → 累积显示<br/>onStatus → 状态更新<br/>onToolCall → 工具卡片<br/>onDone → 完成
```

---

## 6. 数据模型

### 命盘数据流转

```mermaid
graph LR
    subgraph Input["用户输入 BaziInput"]
        I_DT["birth_date: '1985-06-15'"]
        I_TM["birth_time: '09:20'"]
        I_GD["gender: 'male'"]
    end

    subgraph Engine["引擎输出 (Flat)"]
        E_P["pillars: str[4]"]
        E_TG["tg_gan: str[4]"]
        E_TZ["tg_zhi: str[4]"]
        E_N["nayin: str[4]"]
        E_DM["day_master: str"]
        E_GD["gender: '乾造 (Male)'"]
        E_MG["minggong: str"]
        E_TY["taiyuan: str"]
        E_SG["shengong: str"]
        E_TX["taixi: str"]
        E_DS["dishi: str[4]"]
        E_XK["xunkong: str[4]"]
        E_SS["shensha: str[]"]
        E_SD["shensha_detail: dict"]
        E_WX["wuxing: dict"]
        E_XC["xingchong: dict"]
        E_DY["dayun: list"]
    end

    subgraph Frontend["前端 BaziReading"]
        F_C["chart: {<br/>  year/month/day/hour_pillar: Pillar<br/>  day_master: str<br/>}"]
        F_EB["element_balance: dict"]
        F_TG["ten_gods: TenGod[]"]
        F_DY["dayun: DayunEntry[]"]
        F_AP["annual_pillars: AnnualPillar[]"]
        F_PA["pillar_annotations: dict"]
        F_WP["wuxing_power: WuxingPower"]
        F_GJ["geju: Geju"]
        F_MG["ming_gong: str"]
        F_TY["tai_yuan: str"]
        F_GD["gender: str"]
    end

    Input -->|"calculateBazi()"| Engine
    Engine -->|"adaptChartResponse()"| Frontend
```

### Pydantic Schemas

```mermaid
classDiagram
    class ChartRequest {
        +str datetime_str
        +str gender
    }

    class ChartResponse {
        +dict chart
        +WuxingPowerData wuxing_power
        +dict geju
    }

    class ChatRequest {
        +str message
        +str provider
        +str api_key
        +str base_url
        +str model
        +dict chart_data
        +list history
        +int max_steps
    }

    class BaziChartData {
        +list pillars
        +list tg_gan
        +list tg_zhi
        +list nayin
        +str day_master
        +str gender
        +str minggong
        +str taiyuan
        +dict wuxing
        +list dayun
    }

    ChartRequest --> ChartResponse : POST /chart
    ChatRequest --> BaziChartData : chart_data field
```

---

## 7. 测试架构

| 套件 | 数量 | 覆盖 |
|---|---|---|
| `frontend` vitest | 380 | TS 与 Python 引擎对拍（18 命例 × 全字段）、复制文本、真太阳时与夏令时、农历与闰月、外来干支关系、神煞释义覆盖 |
| `tests/` pytest | 506 | 引擎、五行与格局、14 个工具、第二批神煞规则、Agent 服务、API、古籍数据 |

对拍基准 `tests/fixtures/golden_charts.json` 由 Python 引擎导出。改了 Python 引擎的输出之后：

```bash
python scripts/gen_golden_fixtures.py tests/fixtures/golden_charts.json
cd frontend && npm test
```

---

## 8. 部署模式

```mermaid
graph TB
    subgraph Mode1["网页版（推荐）"]
        PagesStatic["Cloudflare Pages<br/>静态资源"]
        PagesFn["Pages Function<br/>/api/* 网关"]
        PagesStatic --- PagesFn
    end

    subgraph Mode2["本地开发"]
        Vite["Vite :5173"]
        WranglerDev["wrangler pages dev<br/>（需要站内 AI 时）"]
    end

    subgraph Mode3["桌面应用"]
        TauriEXE["Tauri EXE<br/>WebView2"]
        Uvicorn3["uvicorn :8000"]
        TauriEXE -->|"HTTP 127.0.0.1:8000"| Uvicorn3
    end

    subgraph Mode4["其他"]
        MCPS["mcp_server/"]
        StreamlitApp["streamlit_app.py（旧版）"]
    end
```

网页版部署步骤见 [DEPLOYMENT.md](DEPLOYMENT.md#cloudflare-pages网页版推荐)。

---

## 9. 配置系统

```mermaid
graph TD
    subgraph Config["Pydantic Settings"]
        Env[".env file<br/>BAZI_ prefix"]
        EnvVars["Environment Variables<br/>BAZI_ prefix"]
    end

    subgraph Settings["Settings"]
        S_Debug["DEBUG: bool = False"]
        S_Host["HOST: str = 0.0.0.0"]
        S_Port["PORT: int = 8000"]
        S_CORS["CORS_ORIGINS: List[str]"]
        S_OpenAI["OPENAI_API_KEY · BASE_URL · MODEL"]
        S_Anthro["ANTHROPIC_API_KEY · BASE_URL"]
    end

    subgraph Consumers["使用方"]
        C_Main["main.py<br/>app setup"]
        C_Chat["chat.py<br/>CORS middleware"]
        C_Agent["agent_service.py<br/>API auto-fill"]
    end

    Config --> Settings
    Settings --> Consumers
```
