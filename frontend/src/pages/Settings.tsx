/**
 * 设置页（/settings）。
 * AI 服务（站内服务 / 自带服务商）、外观、本地数据。
 */

import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, Section, Facts } from "@/components/layout/Page";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useBaziStore } from "@/stores/useBaziStore";
import { useChatStore } from "@/stores/useChatStore";
import { useAIReadingStore } from "@/stores/useAIReadingStore";
import AccessKeyCard from "@/components/settings/AccessKeyCard";
import type { AIProviderId, AppSettings } from "@/types/bazi";

/** Provider presets: label, default model, default base URL. */
const PROVIDER_PRESETS: Record<AIProviderId, { label: string; models: string[]; baseUrl: string }> = {
  // 站内服务由网关决定实际服务商：deepseek-flash 走站长的 DeepSeek，@cf/ 开头走 Workers AI。
  // 模型必须支持工具调用——ReAct 循环每轮都带工具 schema，不支持的模型会静默忽略。
  cloudflare: {
    label: "站内服务",
    models: [
      "deepseek-flash",
      "@cf/zai-org/glm-4.7-flash",
      "@cf/qwen/qwen3-30b-a3b-fp8",
      "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    ],
    baseUrl: "",
  },
  deepseek: {
    label: "DeepSeek",
    models: ["deepseek-chat", "deepseek-reasoner"],
    baseUrl: "https://api.deepseek.com",
  },
  alibaba: {
    label: "阿里云百炼",
    models: ["qwen-plus", "qwen-turbo", "qwen-max", "qwen-long"],
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  },
  openai: {
    label: "OpenAI",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    baseUrl: "https://api.openai.com/v1",
  },
  // Anthropic-protocol providers: base URL must NOT end in /v1 —
  // the SDK appends /v1/messages itself.
  anthropic: {
    label: "Anthropic",
    models: ["claude-sonnet-5", "claude-opus-5", "claude-haiku-4-5-20251001"],
    baseUrl: "https://api.anthropic.com",
  },
  mimo: {
    label: "MiMo",
    models: ["mimo-v2.5-pro"],
    baseUrl: "https://token-plan-cn.xiaomimimo.com/anthropic",
  },
  custom: { label: "自定义", models: [], baseUrl: "" },
};

const PROVIDER_IDS = Object.keys(PROVIDER_PRESETS) as AIProviderId[];

const THEMES: Array<{ id: AppSettings["theme"]; label: string }> = [
  { id: "system", label: "跟随系统" },
  { id: "light", label: "昼" },
  { id: "dark", label: "夜" },
];

export default function Settings() {
  const { ai_provider, theme, setAIProvider, setTheme } = useSettingsStore();

  const [provider, setProvider] = useState<AIProviderId>(ai_provider.provider);
  const [apiKey, setApiKey] = useState(ai_provider.api_key);
  const [model, setModel] = useState(ai_provider.model);
  const [baseUrl, setBaseUrl] = useState(ai_provider.base_url ?? "");
  const [streaming, setStreaming] = useState(ai_provider.streaming ?? true);

  const preset = PROVIDER_PRESETS[provider];
  const isFree = provider === "cloudflare";
  const dirty =
    provider !== ai_provider.provider ||
    apiKey !== ai_provider.api_key ||
    model !== ai_provider.model ||
    baseUrl !== (ai_provider.base_url ?? "") ||
    streaming !== (ai_provider.streaming ?? true);

  const pickProvider = (id: AIProviderId) => {
    setProvider(id);
    const p = PROVIDER_PRESETS[id];
    setBaseUrl(p.baseUrl);
    setModel(p.models[0] ?? "");
  };

  const handleSave = () => {
    if (!isFree && !apiKey.trim()) {
      toast.error("还没有填 API Key", { description: "自带服务需要你自己的密钥；不填请选「站内服务」。" });
      return;
    }
    setAIProvider({ provider, api_key: apiKey.trim(), model: model.trim(), base_url: baseUrl.trim(), streaming });
    toast.success("设置已保存");
  };

  // 本地数据
  const historyCount = useBaziStore((s) => s.history.length);
  const chatCount = useChatStore((s) => s.messages.length);
  const savedCount = useAIReadingStore((s) => Object.keys(s.saved).length);

  const clearAll = () => {
    if (!window.confirm("清除这台设备上保存的全部命盘、对话和解读？此操作不能撤销。")) return;
    useBaziStore.getState().reset();
    useBaziStore.setState({ history: [] });
    useChatStore.getState().clearMessages();
    useAIReadingStore.setState({ saved: {} });
    toast.success("本地数据已清除");
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="设置" description="排盘不需要任何设置；这里只管 AI 解读用哪家服务，以及外观。" />

      <Section title="免费额度" description="默认使用站长提供的 DeepSeek，开箱即用；它不可用时自动换成 Cloudflare 的免费模型。" className="border-t">
        <AccessKeyCard />
      </Section>

      <Section title="AI 服务" description="自带服务时，密钥只存在本机，请求经网关转发到你选的服务商。">
        <fieldset>
          <legend className="eyebrow">服务商</legend>
          <div className="no-scrollbar -mx-4 mt-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div className="seg" role="radiogroup">
              {PROVIDER_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={provider === id}
                  data-on={provider === id}
                  onClick={() => pickProvider(id)}
                >
                  {PROVIDER_PRESETS[id].label}
                </button>
              ))}
            </div>
          </div>
        </fieldset>

        <div className="mt-7 grid max-w-2xl gap-x-8 gap-y-6 sm:grid-cols-2">
          {!isFree && (
            <>
              <label className="block">
                <span className="eyebrow">API Key</span>
                <input
                  type="password"
                  autoComplete="off"
                  placeholder="sk-…"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="field mt-1 font-mono"
                />
              </label>
              <label className="block">
                <span className="eyebrow">Base URL</span>
                <input
                  type="url"
                  placeholder={preset.baseUrl || "https://…"}
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className="field mt-1 font-mono"
                />
              </label>
            </>
          )}

          <label className="block sm:col-span-2">
            <span className="eyebrow">模型</span>
            {preset.models.length > 0 ? (
              <select className="field mt-1 font-mono" value={model} onChange={(e) => setModel(e.target.value)}>
                {!preset.models.includes(model) && <option value={model}>{model}</option>}
                {preset.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="模型名称"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="field mt-1 font-mono"
              />
            )}
            <span className="mt-2 block text-xs text-muted-foreground">
              模型必须支持工具调用（function calling），否则查流年、查古籍这些取证步骤不会执行。
            </span>
          </label>
        </div>

        <label className="mt-6 flex cursor-pointer items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-[var(--foreground)]"
            checked={streaming}
            onChange={(e) => setStreaming(e.target.checked)}
          />
          边生成边显示
        </label>

        <div className="mt-7 flex items-center gap-4">
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={!dirty}>
            保存
          </button>
          {dirty && <span className="text-xs text-muted-foreground">有未保存的修改</span>}
        </div>

        <Facts
          className="mt-8 border-t border-rule pt-6"
          items={[
            { k: "当前服务商", v: PROVIDER_PRESETS[ai_provider.provider].label },
            { k: "当前模型", v: <span className="break-all font-mono text-sm">{ai_provider.model || "—"}</span> },
            {
              k: "API Key",
              v: ai_provider.provider === "cloudflare" ? "不需要" : ai_provider.api_key ? "已填写" : "未填写",
            },
          ]}
        />
      </Section>

      <Section title="外观">
        <div className="seg" role="radiogroup" aria-label="主题">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={theme === t.id}
              data-on={theme === t.id}
              onClick={() => setTheme(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="本地数据" description="命盘、对话、解读都只存在这台设备的浏览器里，不上传。">
        <Facts
          items={[
            { k: "命盘", v: <span className="tabular">{historyCount} 份</span> },
            { k: "对话", v: <span className="tabular">{chatCount} 条</span> },
            { k: "解读", v: <span className="tabular">{savedCount} 篇</span> },
          ]}
        />
        <button type="button" className="btn btn-line btn-sm mt-6" onClick={clearAll}>
          清除全部本地数据
        </button>
      </Section>

      <p className="tabular border-t border-rule pt-5 text-xs text-faint">玄冥 v{__APP_VERSION__}</p>
    </div>
  );
}
