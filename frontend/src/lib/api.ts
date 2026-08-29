/**
 * Axios API client for the FOR-BAZI backend.
 * All API calls go through this module for consistent error handling,
 * authentication, and typed responses.
 */

import axios, { type AxiosInstance, type AxiosResponse } from "axios";
import type {
  BaziInput,
  BaziReading,
  ChatStreamRequest,
  ApiError,
} from "@/types/bazi";
import { adaptChartResponse } from "@/lib/response-adapter";
import { calculateChart } from "@/engine";
import { runReactLoop } from "@/lib/react-agent";

/**
 * In Tauri production, the frontend is bundled as static files and has no
 * Vite proxy. We detect this and point API calls directly at the backend.
 * In dev mode (localhost:5173) the Vite proxy handles /api → localhost:8000.
 */
const isTauri = "__TAURI_INTERNALS__" in window;

const API_BASE = isTauri ? "http://127.0.0.1:8000/api" : "/api";
const HEALTH_BASE = isTauri ? "http://127.0.0.1:8000/health" : "/health";

const client: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 30_000,
  headers: {
    "Content-Type": "application/json",
  },
});

/** Response interceptor: normalize errors. */
client.interceptors.response.use(
  (res: AxiosResponse) => res,
  (error) => {
    const apiError: ApiError = {
      detail:
        error.response?.data?.detail ??
        error.message ??
        "An unexpected error occurred.",
      status_code: error.response?.status ?? 500,
    };
    return Promise.reject(apiError);
  }
);

// ── Bazi Calculation ────────────────────────────────────────────────

/**
 * Calculate a full Bazi reading from birth information.
 *
 * Runs entirely in the browser. Charting is deterministic and needs no
 * credentials, so there is no reason to round-trip it through a server —
 * this is what lets the app deploy to Cloudflare Pages as a static site
 * with no Python backend. The TypeScript engine is verified field-for-field
 * against the Python one by `src/engine/parity.test.ts`.
 */
export async function calculateBazi(input: BaziInput): Promise<BaziReading> {
  const datetimeStr = `${input.birth_date} ${input.birth_time}`;
  // Engine expects exactly "乾造 (Male)" or "坤造 (Female)".
  const genderLabel = input.gender === "male" ? "乾造 (Male)" : "坤造 (Female)";
  const data = calculateChart(datetimeStr, genderLabel);
  // Adapt flat engine output → nested frontend BaziReading，
  // 同时把引擎原件带上，供 Agent 工具直接使用。
  return { ...adaptChartResponse(data as never), engine_chart: data.chart };
}

// ── AI Chat / Analysis ──────────────────────────────────────────────

/**
 * 各服务商的 OpenAI 兼容 base URL。
 * 用户自带 key 时，请求由 Worker 网关代转到这里——既用对方自己的额度，
 * 也顺带解决浏览器直连第三方 API 的 CORS 问题。
 */
const PROVIDER_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  alibaba: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  deepseek: "https://api.deepseek.com/v1",
  mimo: "https://token-plan-cn.xiaomimimo.com/v1",
};

/**
 * AI 网关地址。默认同源（Pages Function 挂在 /api/*），
 * 因此不需要跨域配置；本地开发时用 VITE_AI_GATEWAY 指向别处。
 */
export const AI_GATEWAY =
  (import.meta.env.VITE_AI_GATEWAY as string | undefined) ?? "";

/** 本地保存的访问密钥（持有者不受匿名限次约束）。 */
const ACCESS_KEY_STORAGE = "bazi-access-key";

export function getAccessKey(): string {
  try {
    return localStorage.getItem(ACCESS_KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export function setAccessKey(v: string): void {
  try {
    if (v) localStorage.setItem(ACCESS_KEY_STORAGE, v);
    else localStorage.removeItem(ACCESS_KEY_STORAGE);
  } catch {
    /* 隐私模式下 localStorage 可能不可用，忽略即可 */
  }
}

/** 查询今日剩余免费次数，供设置页展示。 */
export async function fetchQuota(): Promise<{
  mode: string;
  unlimited?: boolean;
  limit?: number;
  used?: number;
  remaining?: number;
}> {
  const headers: Record<string, string> = {};
  const key = getAccessKey();
  if (key) headers["X-Access-Key"] = key;
  const res = await fetch(`${AI_GATEWAY}/api/quota`, { headers });
  return res.json();
}

/**
 * 跑一轮 AI 对话。
 *
 * ReAct 循环与全部工具都在浏览器本地执行——排盘、五行、格局、古籍检索
 * 都是本地计算和本地数据，没必要绕服务器；只有模型补全走 Worker 网关，
 * 由它统一处理访问密钥、匿名限次和自带 key 的转发。
 *
 * 事件回调签名与原来的 SSE 版本保持一致，上层组件无需改动。
 */
export async function chatStream(
  params: ChatStreamRequest,
  onToken: (text: string) => void,
  onStatus: (text: string) => void,
  onToolCall: (data: {
    id: string;
    name: string;
    arguments: string;
    result: string | null;
    status: "calling" | "done" | "error";
  }) => void,
  onDone: (data: Record<string, unknown>) => void,
  onError: (error: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const cfg = params.provider;

  // 自带 key：走对方服务商，不消耗默认额度。
  const isByo = cfg.provider !== "cloudflare" && Boolean(cfg.api_key);
  const baseUrl = cfg.base_url || PROVIDER_BASE_URLS[cfg.provider] || "";

  const gateway = {
    endpoint: AI_GATEWAY,
    accessKey: getAccessKey() || undefined,
    providerKey: isByo ? cfg.api_key : undefined,
    providerBaseUrl: isByo ? baseUrl : undefined,
    model: cfg.model || undefined,
  };

  try {
    const stream = runReactLoop({
      message: params.message,
      chart: params.bazi_context?.engine_chart ?? null,
      history: params.history.map((m) => ({ role: m.role, content: m.content })),
      gateway,
      signal,
    });

    for await (const ev of stream) {
      if (signal?.aborted) return;
      switch (ev.type) {
        case "token":
          onToken(String(ev.payload.content ?? ""));
          break;
        case "status":
          onStatus(String(ev.payload.message ?? ""));
          break;
        case "tool_call":
          onToolCall(ev.payload as never);
          break;
        case "done":
          onDone(ev.payload);
          break;
        case "error":
          onError(String(ev.payload.message ?? "未知错误"));
          return;
      }
    }
  } catch (err) {
    if (signal?.aborted) return;
    onError(err instanceof Error ? err.message : String(err));
  }
}

// ── Classical Texts Search ─────────────────────────────────────────

/**
 * Search classical texts (经典文献) by keyword.
 * GET /api/v1/texts?q=...&source=...
 */
export async function searchTexts(
  query: string,
  source?: string
): Promise<Array<{ title: string; content: string; source: string }>> {
  const params: Record<string, string> = { q: query };
  if (source) params.source = source;
  const { data } = await client.get("/v1/texts", { params });
  return data;
}

// ── Daily Fortune ──────────────────────────────────────────────────

/**
 * Get daily fortune for a zodiac sign.
 * GET /api/v1/entertainment/daily-fortune?zodiac=...
 */
export async function getDailyFortune(
  zodiac: string
): Promise<{ zodiac: string; fortune: string; lucky_color: string; lucky_number: number }> {
  const { data } = await client.get("/v1/entertainment/daily-fortune", {
    params: { zodiac },
  });
  return data;
}

// ── Compatibility ──────────────────────────────────────────────────

/**
 * Check compatibility between two people.
 * POST /api/v1/compatibility
 * Backend expects { person_a: {datetime_str, gender}, person_b: {datetime_str, gender} }.
 */
export async function checkCompatibility(
  inputA: BaziInput,
  inputB: BaziInput
): Promise<{
  person_a: BaziReading;
  person_b: BaziReading;
  day_master_relation: string;
  score: number;
  summary: string;
  details: string[];
}> {
  const genderA = inputA.gender === "male" ? "乾造 (Male)" : "坤造 (Female)";
  const genderB = inputB.gender === "male" ? "乾造 (Male)" : "坤造 (Female)";

  const { data } = await client.post("/v1/compatibility", {
    person_a: {
      datetime_str: `${inputA.birth_date} ${inputA.birth_time}`,
      gender: genderA,
    },
    person_b: {
      datetime_str: `${inputB.birth_date} ${inputB.birth_time}`,
      gender: genderB,
    },
  });

  // Adapt the nested chart objects.
  return {
    ...data,
    person_a: adaptChartResponse({ chart: data.person_a }),
    person_b: adaptChartResponse({ chart: data.person_b }),
  };
}

// ── Health Check ────────────────────────────────────────────────────

/**
 * Ping the backend to verify connectivity.
 * Uses /api/v1/health (not /health through the /api base).
 */
export async function healthCheck(): Promise<{ status: string }> {
  // The health endpoint is at root level, not under /api/v1.
  // We bypass the base client to hit /health directly.
  const { data } = await axios.get<{ status: string }>(HEALTH_BASE);
  return data;
}

export default client;
