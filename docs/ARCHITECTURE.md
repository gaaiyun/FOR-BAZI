# FOR-BAZI 架构文档

> 系统架构、模块职责、数据流详细说明

---

## 1. 总体架构

```mermaid
graph TB
    subgraph Client["客户端层"]
        direction LR
        Tauri["Tauri v2 Desktop<br/>Rust Shell + WebView2"]
        Web["Web Browser<br/>localhost:5173"]
        Streamlit["Streamlit<br/>localhost:8501<br/>(Legacy)"]
    end

    subgraph Frontend["React 前端"]
        direction TB
        Pages["10 Pages<br/>Lazy-loaded Routes"]
        Components["UI Components<br/>bazi · chat · layout · ui"]
        Stores["Zustand Stores<br/>bazi · chat · settings"]
        Adapter["response-adapter.ts<br/>Backend → Frontend 格式转换"]
        APIClient["api.ts<br/>Axios + SSE Client"]
    end

    subgraph Server["FastAPI 服务层"]
        direction TB
        Router["5 API Routes<br/>chart · chat · texts · compat · entertain"]
        Schemas["Pydantic Schemas<br/>请求/响应验证"]
        Services["3 Services<br/>bazi · agent · text"]
        Normalize["_normalize_chart_data()<br/>前端格式 → 引擎格式"]
    end

    subgraph Core["Python 核心引擎"]
        direction TB
        Engine["bazi_engine.py<br/>lunar-python 四柱计算"]
        Shensha["shensha.py<br/>20+ 神煞判定"]
        Tools["14 Tools<br/>bazi_tools · wuxing · geju"]
        AgentCore["ReAct Agent<br/>react_agent · api_adapter"]
    end

    subgraph DataStore["数据层"]
        direction TB
        Texts["5 JSON Files<br/>穷通宝鉴 · 滴天髓 · 子平真诠<br/>三命通会 · 渊海子平"]
        Chroma["ChromaDB<br/>sentence-transformers<br/>向量索引"]
    end

    subgraph LLM["大模型 API"]
        OpenAI["OpenAI / DeepSeek<br/>(OpenAI SDK)"]
        Anthropic["Anthropic / MiMo / GLM<br/>(Anthropic SDK)"]
    end

    Client --> Frontend
    Frontend -->|HTTP + SSE| Server
    Server --> Normalize
    Normalize --> Core
    Server --> DataStore
    Core --> AgentCore
    AgentCore --> Tools
    AgentCore --> LLM
    Tools --> DataStore
```

---

## 2. 前端架构

```mermaid
graph TB
    subgraph Router["React Router v7"]
        R1["/ → BaziCalculator"]
        R2["/chart → ChartVisualization"]
        R3["/luck → LuckPillars"]
        R4["/elements → ElementsAnalysis"]
        R5["/tengods → TenGods"]
        R6["/shensha → ShenSha"]
        R7["/annual → AnnualForecast"]
        R8["/reading → AIReading"]
        R9["/chat → Chat"]
        R10["/settings → Settings"]
    end

    subgraph Layout["Layout"]
        AppShell["AppShell"]
        Sidebar["Sidebar<br/>10 Nav Items"]
    end

    subgraph State["Zustand Stores"]
        BaziStore["useBaziStore<br/>reading · input · persist"]
        ChatStore["useChatStore<br/>messages · persist"]
        SettingsStore["useSettingsStore<br/>provider · theme · persist"]
    end

    subgraph Components["Components"]
        BaziComps["bazi/<br/>PillarCard · FourPillarGrid<br/>WuxingRadar · WuxingBar · DayunTimeline"]
        ChatComps["chat/<br/>ChatPanel · ChatMessage<br/>ChatInput · ToolCallStatus"]
        UIComps["ui/<br/>13 shadcn/ui components"]
    end

    subgraph Lib["Lib"]
        API["api.ts<br/>calculateBazi · chatStream"]
        Adapter["response-adapter.ts<br/>adaptChartResponse()"]
        SSE["useChatSSE.ts<br/>SSE Hook"]
    end

    Router --> Layout
    Layout --> Components
    Components --> State
    Components --> Lib
    Lib --> State
```

### 数据适配层

前端和后端使用不同的数据格式，`response-adapter.ts` 负责转换：

```mermaid
graph LR
    subgraph Backend["后端 Flat Format"]
        B_Pillars["pillars: ['壬午','丁未','庚寅','戊寅']"]
        B_TG["tg_gan: ['食神','正官','日主','偏印']"]
        B_TZ["tg_zhi: ['丁己','丁己乙','甲丙戊','甲壬']"]
        B_Nayin["nayin: ['杨柳木','天河水','松柏木','城头土']"]
        B_DM["day_master: '庚'"]
        B_MG["minggong: '甲寅'"]
    end

    subgraph Adapter["adaptChartResponse()"]
        Transform["格式转换<br/>flat arrays → nested objects<br/>camelCase 映射"]
    end

    subgraph Frontend["前端 BaziReading"]
        F_Chart["chart: {<br/>  year_pillar: {stem:'壬', branch:'午'},<br/>  day_master: '庚'<br/>}"]
        F_EB["element_balance: {金:1, 木:2, ...}"]
        F_TG["ten_gods: [{name,character,element}]"]
        F_DY["dayun: [{ganzhi, start_age, ...}]"]
        F_MG["ming_gong: '甲寅'"]
    end

    Backend --> Adapter --> Frontend
```

反向转换在 `agent_service._normalize_chart_data()` 中完成：

```mermaid
graph LR
    subgraph Frontend["前端 BaziReading"]
        F_Chart["chart.year_pillar.stem + branch"]
        F_Annotations["pillar_annotations.year.ten_god_gan"]
        F_MG["ming_gong / tai_yuan"]
    end

    subgraph Normalize["_normalize_chart_data()"]
        N_Transform["嵌套对象 → 扁平字段<br/>ming_gong → minggong<br/>element_balance → wuxing"]
    end

    subgraph Engine["引擎 Flat Format"]
        E_Pillars["pillars: ['壬午','丁未',...]"]
        E_TG["tg_gan / tg_zhi"]
        E_MG["minggong / taiyuan"]
    end

    Frontend --> Normalize --> Engine
```

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

```mermaid
graph TB
    subgraph Tests["452 Tests"]
        subgraph API["API 层 (72)"]
            TA1["test_backend_api<br/>17 tests"]
            TA2["test_api_comprehensive<br/>55 tests"]
        end

        subgraph Engine["引擎层 (141)"]
            TE1["test_engine<br/>11 tests"]
            TE2["test_engine_comprehensive<br/>130 tests"]
        end

        subgraph Tools["工具层 (141)"]
            TT1["test_tools<br/>18 tests"]
            TT2["test_tools_comprehensive<br/>118 tests"]
            TT3["test_rag_retrieve<br/>5 tests"]
        end

        subgraph Service["服务层 (96)"]
            TS1["test_agent_service<br/>73 tests"]
            TS2["test_chart_data_adapter<br/>23 tests"]
        end

        subgraph Data["数据层 (2)"]
            TD1["test_text_service<br/>3 tests"]
            TD2["test_scholar_agent<br/>2 tests"]
        end
    end
```

---

## 8. 部署模式

```mermaid
graph TB
    subgraph Mode1["模式 1: Web 开发"]
        Vite["Vite Dev Server<br/>:5173"]
        Uvicorn1["uvicorn<br/>:8000"]
        Vite -->|"Proxy /api"| Uvicorn1
    end

    subgraph Mode2["模式 2: Web 生产"]
        Browser2["Browser<br/>:8000"]
        Uvicorn2["uvicorn<br/>:8000"]
        Uvicorn2 -->|"serve frontend/dist/"| Browser2
    end

    subgraph Mode3["模式 3: 桌面应用"]
        TauriEXE["Tauri EXE<br/>WebView2"]
        Uvicorn3["uvicorn<br/>:8000"]
        TauriEXE -->|"HTTP to 127.0.0.1:8000"| Uvicorn3
    end

    subgraph Mode4["模式 4: Streamlit"]
        StreamlitApp["streamlit_app.py<br/>:8501"]
    end
```

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
