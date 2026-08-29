# FOR-BAZI API 文档

> 后端 API 接口详细说明

**Base URL**: `http://localhost:8000`
**API Prefix**: `/api/v1`
**Content-Type**: `application/json`

---

## 目录

- [1. 健康检查](#1-健康检查)
- [2. 计算命盘](#2-计算命盘)
- [3. 流式对话](#3-流式对话)
- [4. 古籍检索](#4-古籍检索)
- [5. 合婚匹配](#5-合婚匹配)
- [6. 每日运势](#6-每日运势)
- [数据模型](#数据模型)

---

## 1. 健康检查

检查后端服务是否正常运行。

```http
GET /health
```

### 响应

```json
{
  "status": "ok"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | `string` | 服务状态，固定为 `"ok"` |

---

## 2. 计算命盘

根据出生时间计算完整的八字命盘。

```http
POST /api/v1/chart
Content-Type: application/json
```

### 请求体

```json
{
  "datetime_str": "1985-06-15 09:20",
  "gender": "乾造 (Male)"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `datetime_str` | `string` | 是 | 公历出生时间，格式 `YYYY-MM-DD HH:MM` 或 `YYYY-MM-DD HH:MM:SS` |
| `gender` | `string` | 是 | 性别，仅接受 `"乾造 (Male)"` 或 `"坤造 (Female)"` |

### 响应

```json
{
  "chart": {
    "gender": "乾造 (Male)",
    "pillars": ["壬午", "丁未", "庚寅", "戊寅"],
    "tg_gan": ["食神", "正官", "日主", "偏印"],
    "tg_zhi": ["正官 正印", "正印 正官 正财", "偏财 七杀 偏印", "偏财 七杀 偏印"],
    "nayin": ["杨柳木", "天河水", "松柏木", "城头土"],
    "shensha": ["将星", "天乙贵人", "", ""],
    "shensha_detail": {
      "0": ["将星"],
      "1": ["天乙贵人"],
      "2": [],
      "3": []
    },
    "wuxing": {
      "金(Metal)": 1,
      "木(Wood)": 2,
      "水(Water)": 1,
      "火(Fire)": 2,
      "土(Earth)": 2
    },
    "dayun": [
      {"start_age": 7, "start_year": 2008, "ganzhi": "戊申"},
      {"start_age": 17, "start_year": 2018, "ganzhi": "己酉"},
      {"start_age": 27, "start_year": 2028, "ganzhi": "庚戌"}
    ],
    "minggong": "戊申",
    "taiyuan": "戊戌",
    "shengong": "庚戌",
    "taixi": "乙亥",
    "dishi": ["沐浴", "冠带", "绝", "绝"],
    "xunkong": ["申酉", "寅卯", "午未", "申酉"],
    "xingchong": {
      "合": ["年月六合(午未)"],
      "半三合": ["年日半三合(午寅)", "年时半三合(午寅)"]
    },
    "wuxing_str": "水火火土金木土木",
    "day_master": "庚"
  },
  "wuxing_power": {
    "power": {"金": 3.8, "木": 14.4, "水": 15.0, "火": 47.5, "土": 19.4},
    "strong": ["火"],
    "weak": ["金"],
    "balanced": false,
    "context": "五行力量：{'金': 3.8, '木': 14.4, '水': 15.0, '火': 47.5, '土': 19.4}。偏旺：['火']；偏弱：['金']；有偏。"
  },
  "geju": {
    "格局类型": "从格",
    "格局名称": "从财/从杀/从儿等（需细辨）",
    "月令": "未",
    "月令主气": "己",
    "月干透干": true,
    "透干位置": "月干",
    "日主强弱": "身弱（从格可能）",
    "日主力量占比": 3.8,
    "context": "命局为从格，从财/从杀/从儿等（需细辨）。月令未主气己，透干。透干位置：月干。日主身弱（从格可能）。"
  }
}
```

### chart 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `gender` | `string` | 性别 |
| `pillars` | `string[4]` | 四柱干支，顺序：年、月、日、时 |
| `tg_gan` | `string[4]` | 天干十神 |
| `tg_zhi` | `string[4]` | 地支藏干十神（空格分隔多个） |
| `nayin` | `string[4]` | 纳音 |
| `shensha` | `string[]` | 神煞列表 |
| `shensha_detail` | `object` | 神煞详细信息，按柱位索引 |
| `wuxing` | `object` | 五行基础计数（键含英文后缀） |
| `dayun` | `object[]` | 大运列表 |
| `minggong` | `string` | 命宫 |
| `taiyuan` | `string` | 胎元 |
| `shengong` | `string` | 身宫 |
| `taixi` | `string` | 胎息 |
| `dishi` | `string[4]` | 十二长生（地势） |
| `xunkong` | `string[4]` | 旬空 |
| `xingchong` | `object` | 刑冲合害关系 |
| `wuxing_str` | `string` | 五行字符串表示 |
| `day_master` | `string` | 日主天干 |

### wuxing_power 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `power` | `object` | 五行力量百分比（0-100） |
| `strong` | `string[]` | 偏旺元素列表 |
| `weak` | `string[]` | 偏弱元素列表 |
| `balanced` | `boolean` | 是否平衡（最大最小差 ≤ 15%） |
| `context` | `string` | 文字描述 |

### 错误响应

```json
{
  "detail": "无法解析日期时间 'invalid-date'，请使用 'YYYY-MM-DD HH:MM' 格式"
}
```

| 状态码 | 说明 |
|--------|------|
| `400` | 请求参数错误（日期格式、性别值） |
| `422` | 请求体验证失败 |
| `500` | 服务器内部错误 |

---

## 3. 流式对话

基于 SSE（Server-Sent Events）的流式 AI 对话接口。

```http
POST /api/v1/chat/stream
Content-Type: application/json
```

### 请求体

```json
{
  "message": "请分析一下我的八字格局和事业运势",
  "provider": "OpenAI",
  "api_key": "sk-...",
  "base_url": "https://api.openai.com/v1",
  "model": "gpt-4o",
  "chart_data": {
    "pillars": ["壬午", "丁未", "庚寅", "戊寅"],
    "day_master": "庚",
    "wuxing": {"金(Metal)": 1, "木(Wood)": 2, "水(Water)": 1, "火(Fire)": 2, "土(Earth)": 2}
  },
  "history": [
    {"role": "user", "content": "你好"},
    {"role": "assistant", "content": "你好！有什么可以帮你的？"}
  ],
  "max_steps": 8
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `message` | `string` | 是 | 用户消息文本 |
| `provider` | `string` | 否 | AI 服务商，默认 `"OpenAI"` |
| `api_key` | `string` | 是 | API 密钥 |
| `base_url` | `string` | 否 | API 基础 URL，默认 OpenAI 地址 |
| `model` | `string` | 否 | 模型名称，默认 `"gpt-4o"` |
| `chart_data` | `object` | 否 | 已计算的命盘数据（来自 `/chart` 端点） |
| `history` | `object[]` | 否 | 对话历史 `[{role, content}]` |
| `max_steps` | `int` | 否 | ReAct 循环最大步数，默认 8，范围 1-16 |

### SSE 事件流

响应 `Content-Type: text/event-stream`，每个事件格式：

```
event: <event_type>
data: <json_payload>
```

#### 事件类型

| 事件 | data 格式 | 说明 |
|------|----------|------|
| `token` | `"文本片段"` | 实时文本输出 |
| `status` | `"正在思考..."` | 进度提示 |
| `tool_call` | `{"id":"tc_1","name":"get_bazi_chart","arguments":"...","result":null,"status":"calling"}` | 工具调用 |
| `done` | `{"content":"完整回答","fact_checks":[...]}` | 完成 |
| `error` | `"错误信息"` | 错误 |

#### 示例事件流

```
event: status
data: "正在分析命盘..."

event: token
data: "根据"

event: token
data: "您的八字"

event: tool_call
data: {"id":"tc_1","name":"get_wuxing_power","arguments":"...","result":null,"status":"calling"}

event: tool_call
data: {"id":"tc_1","name":"get_wuxing_power","arguments":"...","result":"...","status":"done"}

event: token
data: "分析，"

event: done
data: {"content":"根据您的八字分析...","fact_checks":[]}
```

### 错误响应

| 状态码 | 说明 |
|--------|------|
| `400` | 请求参数错误 |
| `401` | API Key 无效 |
| `422` | 请求体验证失败 |
| `500` | 服务器内部错误 |

---

## 4. 古籍检索

搜索经典命理文献。

```http
GET /api/v1/texts?q=食神&source=滴天髓
```

### 查询参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `q` | `string` | 是 | 搜索关键词 |
| `source` | `string` | 否 | 文献来源筛选 |

### 响应

```json
[
  {
    "title": "食神论",
    "content": "食神者，我生之物也...",
    "source": "滴天髓"
  }
]
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `title` | `string` | 条目标题 |
| `content` | `string` | 条目内容 |
| `source` | `string` | 文献来源 |

---

## 5. 合婚匹配

比较两个命盘的匹配度。

```http
POST /api/v1/compatibility
Content-Type: application/json
```

### 请求体

```json
{
  "person_a": {
    "datetime_str": "1985-06-15 09:20",
    "gender": "乾造 (Male)"
  },
  "person_b": {
    "datetime_str": "2003-05-15 14:00",
    "gender": "坤造 (Female)"
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `person_a.datetime_str` | `string` | 是 | 甲方出生时间 |
| `person_a.gender` | `string` | 是 | 甲方性别 |
| `person_b.datetime_str` | `string` | 是 | 乙方出生时间 |
| `person_b.gender` | `string` | 是 | 乙方性别 |

### 响应

```json
{
  "person_a": { ... },
  "person_b": { ... },
  "day_master_relation": "庚(金)生壬(水)，甲方生助乙方",
  "score": 72,
  "summary": "日主配合良好，地支多合少冲，整体匹配度较高。",
  "details": [
    "庚(金)生壬(水)，甲方生助乙方",
    "地支六合: A-年(午) 与 B-月(未) 六合",
    "甲方原局合多: 年月六合(午未)"
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `person_a` | `object` | 甲方命盘数据 |
| `person_b` | `object` | 乙方命盘数据 |
| `day_master_relation` | `string` | 日主五行关系描述 |
| `score` | `int` | 综合匹配度评分（0-100） |
| `summary` | `string` | 综合评语 |
| `details` | `string[]` | 详细分析要点 |

### 评分逻辑

| 关系 | 分值变化 |
|------|---------|
| 日主同五行（比和） | +10 |
| 一方生另一方 | +15 |
| 一方克另一方 | -10 |
| 地支六合 | +5/组 |
| 地支六冲 | -5/组 |
| 原局合多 | +3/人 |

---

## 6. 每日运势

获取生肖每日运势（娱乐功能）。

```http
GET /api/v1/entertainment/daily-fortune?zodiac=龙
```

### 查询参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `zodiac` | `string` | 是 | 生肖名称 |

### 响应

```json
{
  "zodiac": "龙",
  "fortune": "今日运势平稳，适合处理日常事务...",
  "lucky_color": "金色",
  "lucky_number": 8
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `zodiac` | `string` | 生肖 |
| `fortune` | `string` | 运势描述 |
| `lucky_color` | `string` | 幸运颜色 |
| `lucky_number` | `int` | 幸运数字 |

---

## 数据模型

### BaziChartData

完整的八字命盘数据结构。

```typescript
interface BaziChartData {
  gender: string;           // 性别
  pillars: string[];        // 四柱干支 ["年", "月", "日", "时"]
  tg_gan: string[];         // 天干十神
  tg_zhi: string[];         // 地支藏干十神
  nayin: string[];          // 纳音
  shensha: string[];        // 神煞列表
  shensha_detail: Record<number, string[]>;  // 神煞详细
  wuxing: Record<string, number>;            // 五行计数
  dayun: DayunItem[];       // 大运列表
  minggong: string;         // 命宫
  taiyuan: string;          // 胎元
  shengong: string;         // 身宫
  taixi: string;            // 胎息
  dishi: string[];          // 十二长生
  xunkong: string[];        // 旬空
  xingchong: XingChongData; // 刑冲合害
  wuxing_str: string;       // 五行字符串
  day_master: string;       // 日主天干
}
```

### WuxingPowerData

五行力量精算数据。

```typescript
interface WuxingPowerData {
  power: Record<string, number>;  // 五行力量百分比
  strong: string[];               // 偏旺元素
  weak: string[];                 // 偏弱元素
  balanced: boolean;              // 是否平衡
  context: string;                // 文字描述
}
```

### ChatRequest

流式对话请求。

```typescript
interface ChatRequest {
  message: string;           // 用户消息
  provider: string;          // AI 服务商
  api_key: string;           // API 密钥
  base_url: string;          // API 基础 URL
  model: string;             // 模型名称
  chart_data?: object;       // 命盘数据
  history?: {role: string; content: string}[];  // 对话历史
  max_steps: number;         // ReAct 最大步数
}
```

---

## 错误处理

所有错误响应格式统一：

```json
{
  "detail": "错误描述信息"
}
```

| 状态码 | 说明 |
|--------|------|
| `200` | 成功 |
| `400` | 请求参数错误 |
| `401` | 认证失败（API Key 无效） |
| `422` | 请求体验证失败 |
| `500` | 服务器内部错误 |

---

## 交互式文档

启动后端后，可通过以下地址访问自动生成的 API 文档：

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
