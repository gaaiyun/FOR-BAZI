/**
 * 免费额度与访问密钥。
 *
 * 三种用法在这里对用户可见：
 *   匿名     —— 每日限次，用站长的模型（DeepSeek，不可用时退回 Workers AI）
 *   持密钥   —— 不限次，仍用站长的额度
 *   自带服务 —— 用自己的服务商额度，不限次，也不消耗站长的
 */

import { useCallback, useEffect, useState } from "react";
import { fetchQuota, getAccessKey, setAccessKey } from "@/lib/api";

interface Quota {
  mode: string;
  unlimited?: boolean;
  limit?: number;
  used?: number;
  remaining?: number;
}

/** 查额度。连不上或返回的不是额度对象时给 null。 */
async function queryQuota(): Promise<Quota | null> {
  try {
    const q = await fetchQuota();
    // 本地开发时网关不在，/api/quota 会返回 HTML 或 404，一并当作连不上
    return q && typeof q === "object" && "mode" in q ? q : null;
  } catch {
    return null;
  }
}

export default function AccessKeyCard() {
  const [key, setKey] = useState(() => getAccessKey());
  const [saved, setSaved] = useState(false);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  const apply = useCallback((q: Quota | null) => {
    setQuota(q);
    setState(q ? "ok" : "error");
  }, []);

  const refresh = useCallback(async () => {
    setState("loading");
    apply(await queryQuota());
  }, [apply]);

  useEffect(() => {
    let alive = true;
    void queryQuota().then((q) => {
      if (alive) apply(q);
    });
    return () => {
      alive = false;
    };
  }, [apply]);

  const handleSave = async () => {
    setAccessKey(key.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    await refresh();
  };

  const unlimited = quota?.unlimited === true;
  const remaining = quota?.remaining ?? 0;
  const limit = quota?.limit ?? 0;

  return (
    <div>
      <div aria-live="polite">
        {state === "loading" ? (
          <p className="text-sm text-muted-foreground">正在查询额度…</p>
        ) : state === "error" ? (
          <p className="text-sm text-muted-foreground">
            暂时连不上 AI 网关，查不到额度。
            <button type="button" className="link ml-2" onClick={() => void refresh()}>
              重试
            </button>
          </p>
        ) : unlimited ? (
          <p className="text-[0.9375rem]">
            <span className="font-heading text-2xl font-semibold">不限次数</span>
            <span className="ml-3 text-sm text-muted-foreground">访问密钥已生效</span>
          </p>
        ) : (
          <div>
            <p className="flex items-baseline gap-2">
              <span className={`tabular font-heading text-4xl font-semibold ${remaining === 0 ? "text-destructive" : ""}`}>
                {remaining}
              </span>
              <span className="tabular text-sm text-muted-foreground">/ {limit} 次，今日剩余</span>
            </p>
            <div className="mt-3 h-1.5 max-w-xs bg-wash">
              <div
                className="h-full transition-[width] duration-[var(--dur-slow)]"
                style={{
                  width: `${limit > 0 ? Math.max(0, Math.min(100, (remaining / limit) * 100)) : 0}%`,
                  background: remaining === 0 ? "var(--destructive)" : "var(--foreground)",
                }}
              />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {remaining === 0
                ? "今日免费次数已用完。可以填访问密钥，改用自己的 AI 服务，或把命盘复制给自己的 AI。"
                : "匿名使用按 IP 每日重置。填入访问密钥可解除限制。"}
            </p>
          </div>
        )}
      </div>

      <div className="mt-7 max-w-md">
        <label className="block">
          <span className="eyebrow">访问密钥</span>
          <div className="mt-1 flex items-end gap-3">
            <input
              type="password"
              autoComplete="off"
              placeholder="bazi_…"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="field font-mono"
            />
            <button type="button" onClick={() => void handleSave()} className="btn btn-line btn-sm shrink-0">
              {saved ? "已保存" : "保存"}
            </button>
          </div>
        </label>
        <p className="mt-2 text-xs text-muted-foreground">只存在你的浏览器里。留空并保存即清除。</p>
      </div>
    </div>
  );
}
