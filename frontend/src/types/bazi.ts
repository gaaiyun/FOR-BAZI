/**
 * TypeScript interfaces for all Bazi (Four Pillars of Destiny) data structures.
 * These types mirror the backend API response shapes.
 */

import type { BaziChart as EngineChart } from "@/engine/bazi";

/** A single pillar in the Bazi chart (Year, Month, Day, or Hour). */
export interface Pillar {
  /** Heavenly Stem character (天干), e.g. "甲" */
  stem: string;
  /** Earthly Branch character (地支), e.g. "子" */
  branch: string;
  /** Hidden stems within the branch */
  hidden_stems: string[];
  /** The Wuxing element of this pillar */
  element: string;
  /** The Nayin (纳音) element name */
  nayin?: string;
}

/** The four pillars that make up a Bazi chart. */
export interface BaziChart {
  year_pillar: Pillar;
  month_pillar: Pillar;
  day_pillar: Pillar;
  hour_pillar: Pillar;
  /** The Day Master (日主) character */
  day_master: string;
  /** The Wuxing element of the Day Master */
  day_master_element: string;
}

/** Element strength / count summary. */
export interface ElementBalance {
  金: number;
  木: number;
  水: number;
  火: number;
  土: number;
}

/** A single ten-god (十神) relationship. */
export interface TenGod {
  name: string;
  character: string;
  element: string;
  is_favorable: boolean;
}

/** Luck pillar (大运) entry. */
export interface LuckPillar {
  age_range: string;
  stem: string;
  branch: string;
  element: string;
  start_year: number;
  end_year: number;
}

/** Annual pillar (流年) entry. */
export interface AnnualPillar {
  year: number;
  stem: string;
  branch: string;
  element: string;
}

/** Per-pillar annotations (ten gods, shensha, dishi, xunkong, nayin). */
export interface PillarAnnotations {
  ten_god_gan: string;
  ten_god_zhi: string;
  nayin: string;
  shensha: string[];
  dishi: string;
  xunkong: string;
}

/** Wuxing element power scores for radar / bar charts. */
export interface WuxingPower {
  金: number;
  木: number;
  水: number;
  火: number;
  土: number;
}

/** Dayun (大运) luck pillar with timeline info. */
export interface DayunEntry {
  stem: string;
  branch: string;
  ganzhi: string;
  start_age: number;
  end_age: number;
  start_year: number;
  end_year: number;
  is_current: boolean;
}

/** Geju (格局) analysis result. */
export interface GejuAnalysis {
  geju_type: string;
  description: string;
  favorable_elements: string[];
  unfavorable_elements: string[];
}

/** Full Bazi reading result returned by the API. */
export interface BaziReading {
  chart: BaziChart;
  element_balance: ElementBalance;
  ten_gods: TenGod[];
  luck_pillars: LuckPillar[];
  annual_pillars: AnnualPillar[];
  strengths: string[];
  weaknesses: string[];
  favorable_elements: string[];
  unfavorable_elements: string[];
  summary: string;
  /** Gender label from the backend (e.g. "乾造 (Male)" or "坤造 (Female)"). */
  gender?: string;

  // ── Extended fields from POST /api/v1/chart ──────────────────
  /**
   * 引擎产出的扁平命盘原件。UI 用的是上面的嵌套结构，但 Agent 工具
   * （格局、五行力量、古籍查询）需要引擎原始格式，带着走可免去反向转换。
   */
  engine_chart?: EngineChart;
  /** Per-pillar annotations keyed by "year" | "month" | "day" | "hour". */
  pillar_annotations?: Record<string, PillarAnnotations>;
  /** Wuxing power scores for radar/bar charts. */
  wuxing_power?: WuxingPower;
  /** Dayun luck pillars with timeline details. */
  dayun?: DayunEntry[];
  /** Ming Gong (命宫). */
  ming_gong?: string;
  /** Tai Yuan (胎元). */
  tai_yuan?: string;
  /** Shen Gong (身宫). */
  shen_gong?: string;
  /** Tai Xi (胎息). */
  tai_xi?: string;
  /** Geju (格局) analysis. */
  geju?: GejuAnalysis;
  /** XingChong (刑冲) clash information. */
  xingchong?: string[];
  /** Comprehensive shensha list across all pillars. */
  all_shensha?: Array<{ name: string; pillar: string; description: string }>;
}

/** Input form data for Bazi calculation. */
export interface BaziInput {
  /** Birth date in YYYY-MM-DD format */
  birth_date: string;
  /** Birth hour in HH:MM format (24h) */
  birth_time: string;
  /** Gender: "male" | "female" */
  gender: "male" | "female";
  /** Whether the birth time is known */
  time_known: boolean;
  /** Optional: solar or lunar calendar */
  calendar_type?: "solar" | "lunar";
}

/** Tool call information embedded in an assistant message. */
export interface ToolCallInfo {
  /** Unique identifier for this tool call. */
  id: string;
  /** Tool function name, e.g. "get_bazi_chart". */
  name: string;
  /** JSON-stringified arguments passed to the tool. */
  arguments: string;
  /** Result returned by the tool (null while still running). */
  result: string | null;
  /** Current execution status. */
  status: "calling" | "done" | "error";
}

/** Chat message in the AI consultation. */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  /** Tool calls invoked during this message (assistant only). */
  tool_calls?: ToolCallInfo[];
}

/** Supported AI provider identifiers. */
export type AIProviderId =
  | "cloudflare"
  | "alibaba"
  | "openai"
  | "anthropic"
  | "mimo"
  | "deepseek"
  | "custom";

/** AI analysis provider configuration. */
export interface AIProviderConfig {
  provider: AIProviderId;
  api_key: string;
  model: string;
  base_url?: string;
  streaming?: boolean;
}

/** A single Shen Sha (神煞) entry in the chart. */
export interface ShenShaItem {
  name: string;
  pillar: "年柱" | "月柱" | "日柱" | "时柱";
  description: string;
}

/** Application settings. */
export interface AppSettings {
  ai_provider: AIProviderConfig;
  theme: "dark" | "light";
  language: "zh" | "en";
}

/** API error response. */
export interface ApiError {
  detail: string;
  status_code: number;
}

/** Request body for the streaming chat endpoint. */
export interface ChatStreamRequest {
  message: string;
  bazi_context: BaziReading | null;
  provider: AIProviderConfig;
  history: ChatMessage[];
}

/** A single SSE event parsed from the stream. */
export interface SSEEvent {
  event: "token" | "status" | "done" | "error" | "tool_call";
  data: string;
}

/** Paginated API response wrapper. */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
