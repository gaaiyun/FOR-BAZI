/**
 * 访问密钥与免费额度。
 *
 * 三种访问模式在这里对用户可见：
 *   匿名     -> 每日限次，用站长的 Cloudflare 免费额度
 *   持密钥   -> 不限次，仍用站长的额度
 *   自带 key -> 用自己的服务商额度，不限次，也不消耗站长的
 */

import { useCallback, useEffect, useState } from "react";
import { fetchQuota, getAccessKey, setAccessKey } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Quota {
  mode: string;
  unlimited?: boolean;
  limit?: number;
  used?: number;
  remaining?: number;
}

export default function AccessKeyCard() {
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setQuota(await fetchQuota());
    } catch {
      setError("无法连接 AI 网关，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setKey(getAccessKey());
    void refresh();
  }, [refresh]);

  const handleSave = async () => {
    setAccessKey(key.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    await refresh();
  };

  const unlimited = quota?.unlimited === true;
  const remaining = quota?.remaining ?? 0;
  const limit = quota?.limit ?? 0;
  const pct = limit > 0 ? Math.max(0, Math.min(100, (remaining / limit) * 100)) : 0;

  return (
    <section className="rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm p-6 space-y-5">
      <header className="space-y-1">
        <h2 className="font-heading text-base font-semibold text-foreground">
          访问密钥与免费额度
        </h2>
        <p className="text-xs text-muted-foreground">
          默认使用站长预配置的 Cloudflare 免费 AI，无需任何设置即可试用
        </p>
      </header>

      {/* 额度状态 */}
      <div className="rounded-lg border border-border/70 bg-background/40 p-4">
        {loading ? (
          <div className="h-10 animate-shimmer rounded" />
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : unlimited ? (
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-gold/15 text-gold">
              ✓
            </span>
            <div>
              <p className="text-sm font-medium text-gold">密钥已生效 · 不限次数</p>
              <p className="text-xs text-muted-foreground">当前使用站长的 Workers AI 额度</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">今日免费额度</span>
              <span className="font-mono text-sm">
                <span
                  className={
                    remaining === 0
                      ? "text-destructive font-semibold"
                      : "text-foreground font-semibold"
                  }
                >
                  {remaining}
                </span>
                <span className="text-muted-foreground"> / {limit} 次</span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-border/60">
              <div
                className="h-full rounded-full transition-[width] duration-[var(--dur-slow)] ease-[var(--ease-out-expo)]"
                style={{
                  width: `${pct}%`,
                  background:
                    remaining === 0
                      ? "var(--destructive)"
                      : "linear-gradient(90deg, #d4af37, #e8c95f)",
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {remaining === 0
                ? "今日免费次数已用完。填入下方密钥，或在上方改用自己的 AI 服务商。"
                : "按 IP 每日重置。填入密钥可解除限制。"}
            </p>
          </div>
        )}
      </div>

      {/* 密钥输入 */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">访问密钥</label>
        <div className="flex gap-2">
          <Input
            type="password"
            placeholder="bazi_..."
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="font-mono"
          />
          <Button onClick={handleSave} className="shrink-0">
            {saved ? "已保存" : "保存"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          密钥只存在你的浏览器里，不会上传。留空并保存即可清除。
        </p>
      </div>

      {/* 三种模式说明 */}
      <div className="grid gap-2 text-xs sm:grid-cols-3">
        {[
          { t: "匿名", d: `每日 ${limit || 5} 次`, active: !unlimited },
          { t: "持密钥", d: "不限次数", active: unlimited },
          { t: "自带 Key", d: "用自己的额度", active: false },
        ].map((m) => (
          <div
            key={m.t}
            className={`rounded-lg border p-3 ${
              m.active
                ? "border-gold/40 bg-gold/5"
                : "border-border/60 bg-background/30"
            }`}
          >
            <p className={`font-medium ${m.active ? "text-gold" : "text-foreground"}`}>
              {m.t}
            </p>
            <p className="mt-0.5 text-muted-foreground">{m.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
