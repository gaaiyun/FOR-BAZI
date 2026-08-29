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

/**
 * In Tauri production, the frontend is bundled as static files and has no
 * Vite proxy. We detect this and point API calls directly at the backend.
 * In dev mode (localhost:5173) the Vite proxy handles /api → localhost:8000.
 */
const isTauri = "__TAURI_INTERNALS__" in window;

const API_BASE = isTauri ? "http://127.0.0.1:8000/api" : "/api";
const HEALTH_BASE = isTauri ? "http://127.0.0.1:8000/health" : "/health";
const CHAT_STREAM_URL = isTauri
  ? "http://127.0.0.1:8000/api/v1/chat/stream"
  : "/api/v1/chat/stream";

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
 * Combines birth_date + birth_time into datetime_str for the backend.
 * Calls POST /api/v1/chart with { datetime_str, gender }.
 * Uses adaptChartResponse() to transform the flat backend arrays
 * into the nested frontend BaziReading shape.
 */
export async function calculateBazi(input: BaziInput): Promise<BaziReading> {
  const datetimeStr = `${input.birth_date} ${input.birth_time}`;
  // Backend expects exactly "乾造 (Male)" or "坤造 (Female)".
  const genderLabel = input.gender === "male" ? "乾造 (Male)" : "坤造 (Female)";
  const { data } = await client.post("/v1/chart", {
    datetime_str: datetimeStr,
    gender: genderLabel,
  });
  // Adapt flat backend response → nested frontend BaziReading.
  return adaptChartResponse(data);
}

// ── AI Chat / Analysis ──────────────────────────────────────────────

/**
 * Map frontend AIProviderId values to backend-recognized provider names.
 *
 * The backend api_adapter.py uses these names to select the correct SDK:
 *   - Names in ANTHROPIC_PROVIDERS → Anthropic SDK
 *   - Everything else → OpenAI SDK (works for OpenAI-compatible APIs)
 *
 * Frontend IDs like "alibaba", "deepseek" are OpenAI-compatible, so they
 * map to "OpenAI". "mimo" maps to "MiMo" for the Anthropic code path.
 * "anthropic" maps to a recognized Anthropic provider name.
 */
const PROVIDER_NAME_MAP: Record<string, string> = {
  cloudflare: "Cloudflare",
  alibaba: "OpenAI",
  openai: "OpenAI",
  anthropic: "Anthropic (兼容)",
  mimo: "MiMo",
  deepseek: "OpenAI",
  custom: "OpenAI",
};

/**
 * Stream a chat response via SSE (Server-Sent Events) using fetch + ReadableStream.
 * The backend exposes POST /api/v1/chat/stream which returns an SSE stream.
 *
 * Transforms the frontend ChatStreamRequest into the backend ChatRequest shape
 * (separate provider, api_key, base_url, model fields).
 *
 * @param params       - Chat request body (message, context, provider, history).
 * @param onToken      - Called for each streamed text token.
 * @param onStatus     - Called when the server sends a status update.
 * @param onToolCall   - Called when a tool call event is received.
 * @param onDone       - Called when the stream completes successfully.
 * @param onError      - Called when an error occurs.
 * @param signal       - Optional AbortSignal to cancel the request.
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
  // Transform frontend ChatStreamRequest → backend ChatRequest shape.
  // Map the frontend provider ID to a backend-recognized name.
  const mappedProvider =
    PROVIDER_NAME_MAP[params.provider.provider] ?? params.provider.provider;

  const backendBody = {
    message: params.message,
    provider: mappedProvider,
    api_key: params.provider.api_key,
    base_url: params.provider.base_url ?? "https://api.openai.com/v1",
    model: params.provider.model,
    chart_data: params.bazi_context ?? null,
    history: params.history.map((m) => ({ role: m.role, content: m.content })),
    max_steps: 8,
  };

  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(CHAT_STREAM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(backendBody),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      if (!response.body) {
        throw new Error("Response body is null – streaming not supported.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Normalize CRLF to LF, then split on double newline.
        buffer = buffer.replace(/\r\n/g, "\n");
        const parts = buffer.split("\n\n");
        // Keep the last incomplete chunk in the buffer.
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          if (!part.trim()) continue;

          let eventType = "message";
          let eventData = "";

          for (const line of part.split("\n")) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              eventData += line.slice(6);
            } else if (line.startsWith("data:")) {
              // SSE spec allows no space after colon.
              eventData += line.slice(5);
            }
          }

          if (!eventData) continue;

          switch (eventType) {
            case "token":
              try {
                const tokenParsed = JSON.parse(eventData);
                onToken(typeof tokenParsed === "string" ? tokenParsed : (tokenParsed.content ?? eventData));
              } catch {
                onToken(eventData);
              }
              break;

            case "status":
              try {
                const statusParsed = JSON.parse(eventData);
                onStatus(typeof statusParsed === "string" ? statusParsed : (statusParsed.message ?? eventData));
              } catch {
                onStatus(eventData);
              }
              break;

            case "tool_call":
              try {
                onToolCall(JSON.parse(eventData));
              } catch {
                onToolCall({
                  id: `tc_${Date.now()}`,
                  name: "unknown",
                  arguments: eventData,
                  result: null,
                  status: "calling",
                });
              }
              break;

            case "done":
              try {
                onDone(JSON.parse(eventData));
              } catch {
                onDone({});
              }
              break;

            case "error":
              onError(
                eventData.startsWith('"') && eventData.endsWith('"')
                  ? JSON.parse(eventData)
                  : eventData
              );
              return; // Do not retry on application-level errors.

            default:
              // Unknown event type – ignore gracefully.
              break;
          }
        }
      }

      // Stream finished successfully.
      return;
    } catch (err: unknown) {
      if (signal?.aborted) return; // User cancelled – do not retry.

      lastError = err instanceof Error ? err : new Error(String(err));

      // Do not retry on 4xx client errors.
      if (lastError.message.startsWith("HTTP 4")) {
        onError(lastError.message);
        return;
      }

      if (attempt < maxRetries) {
        // Exponential back-off: 1s, 2s.
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
    }
  }

  // All retries exhausted.
  onError(lastError?.message ?? "Unknown streaming error");
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
