/**
 * Settings page (设置).
 * Configures AI provider, API keys, base URL, model, streaming,
 * and theme. Persists to useSettingsStore.
 */

import { useState, useEffect } from "react";
import { useSettingsStore } from "@/stores/useSettingsStore";
import type { AIProviderId } from "@/types/bazi";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import AccessKeyCard from "@/components/settings/AccessKeyCard";

/** Provider presets: label, default model, default base URL. */
const PROVIDER_PRESETS: Record<
  AIProviderId,
  { label: string; models: string[]; baseUrl: string }
> = {
  // Workers AI models must support tool calling — the ReAct loop always
  // sends tool schemas. Models without it silently ignore the tools.
  cloudflare: {
    label: "Cloudflare AI (免费)",
    models: [
      "@cf/zai-org/glm-4.7-flash",
      "@cf/qwen/qwen3-30b-a3b-fp8",
      "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    ],
    baseUrl: "",
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
  deepseek: {
    label: "DeepSeek",
    models: ["deepseek-chat", "deepseek-reasoner"],
    baseUrl: "https://api.deepseek.com",
  },
  custom: {
    label: "自定义",
    models: [],
    baseUrl: "",
  },
};

const PROVIDER_IDS = Object.keys(PROVIDER_PRESETS) as AIProviderId[];

export default function Settings() {
  const {
    ai_provider,
    theme,
    setAIProvider,
    setTheme,
  } = useSettingsStore();

  /* ── Local form state ─────────────────────────────────────────── */
  const [provider, setProvider] = useState<AIProviderId>(ai_provider.provider);
  const [apiKey, setApiKey] = useState(ai_provider.api_key);
  const [model, setModel] = useState(ai_provider.model);
  const [baseUrl, setBaseUrl] = useState(ai_provider.base_url ?? "");
  const [streaming, setStreaming] = useState(ai_provider.streaming ?? true);
  const [saved, setSaved] = useState(false);

  /* ── Sync from store on mount / store change ──────────────────── */
  useEffect(() => {
    setProvider(ai_provider.provider);
    setApiKey(ai_provider.api_key);
    setModel(ai_provider.model);
    setBaseUrl(ai_provider.base_url ?? "");
    setStreaming(ai_provider.streaming ?? true);
  }, [ai_provider]);

  /* ── When provider changes, apply defaults ────────────────────── */
  const handleProviderChange = (newProvider: AIProviderId) => {
    setProvider(newProvider);
    const preset = PROVIDER_PRESETS[newProvider];
    setBaseUrl(preset.baseUrl);
    if (preset.models.length > 0) {
      setModel(preset.models[0]);
    }
  };

  /* ── Save handler ─────────────────────────────────────────────── */
  const handleSave = () => {
    setAIProvider({
      provider,
      api_key: apiKey,
      model,
      base_url: baseUrl,
      streaming,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const preset = PROVIDER_PRESETS[provider];

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-gold">
          设置 · Settings
        </h1>
        <p className="mt-2 text-muted-foreground">
          配置 AI 服务商、访问密钥与外观偏好
        </p>
      </div>

      <AccessKeyCard />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── AI Provider Configuration ─────────────────────────── */}
        <Card className="bg-[#161b22]/60 border-[#30363d]">
          <CardHeader>
            <CardTitle className="text-foreground">AI Provider</CardTitle>
            <CardDescription>
              选择AI服务商并配置API密钥
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Provider selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                服务商
              </label>
              <div className="flex flex-wrap gap-2">
                {PROVIDER_IDS.map((pid) => (
                  <Button
                    key={pid}
                    variant={provider === pid ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleProviderChange(pid)}
                  >
                    {PROVIDER_PRESETS[pid].label}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {provider === "cloudflare" ? (
              <div className="rounded-md bg-[#0d1117] border border-[#30363d] p-4 space-y-2">
                <p className="text-sm text-foreground font-medium">
                  Cloudflare Workers AI (免费)
                </p>
                <p className="text-xs text-muted-foreground">
                  使用服务端预配置的 Cloudflare 账户，无需填写 API
                  Key。如需切换到其他服务商，请选择上方对应按钮。
                </p>
              </div>
            ) : (
              <>
                {/* API Key */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    API Key
                  </label>
                  <Input
                    type="password"
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    密钥仅存储在本地浏览器中，不会上传至服务器。
                  </p>
                </div>

                {/* Base URL */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Base URL
                  </label>
                  <Input
                    type="text"
                    placeholder={preset.baseUrl || "https://..."}
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Model selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                模型
              </label>
              {preset.models.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {preset.models.map((m) => (
                    <Button
                      key={m}
                      variant={model === m ? "default" : "outline"}
                      size="sm"
                      onClick={() => setModel(m)}
                    >
                      {m}
                    </Button>
                  ))}
                </div>
              ) : (
                <Input
                  type="text"
                  placeholder="model-name"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
              )}
            </div>

            <Separator />

            {/* Streaming toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  流式输出
                </p>
                <p className="text-xs text-muted-foreground">
                  启用后AI回复将实时显示
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={streaming}
                onClick={() => setStreaming(!streaming)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  streaming ? "bg-[#d4af37]" : "bg-[#30363d]"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform ${
                    streaming ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <Separator />

            {/* Save button */}
            <div className="flex items-center gap-3">
              <Button onClick={handleSave}>
                {saved ? "已保存" : "保存设置"}
              </Button>
              {saved && (
                <Badge variant="default" className="text-xs animate-fade-in">
                  设置已更新
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Appearance & Info ─────────────────────────────────── */}
        <div className="space-y-6">
          <Card className="bg-[#161b22]/60 border-[#30363d]">
            <CardHeader>
              <CardTitle className="text-foreground">外观</CardTitle>
              <CardDescription>主题与显示设置</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Theme toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    暗色主题
                  </p>
                  <p className="text-xs text-muted-foreground">
                    当前仅支持暗色主题
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={theme === "dark"}
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    theme === "dark" ? "bg-[#d4af37]" : "bg-[#30363d]"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform ${
                      theme === "dark" ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#161b22]/60 border-[#30363d]">
            <CardHeader>
              <CardTitle className="text-foreground">当前配置</CardTitle>
              <CardDescription>已保存的AI配置摘要</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">服务商</span>
                  <span className="text-foreground">
                    {PROVIDER_PRESETS[ai_provider.provider].label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">模型</span>
                  <span className="text-foreground font-mono">
                    {ai_provider.model}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">API Key</span>
                  <span className="text-foreground font-mono">
                    {ai_provider.api_key
                      ? `${ai_provider.api_key.slice(0, 8)}...`
                      : "未设置"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">流式输出</span>
                  <span className="text-foreground">
                    {ai_provider.streaming ? "开启" : "关闭"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
