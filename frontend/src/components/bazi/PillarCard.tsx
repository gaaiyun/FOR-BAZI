/**
 * 四柱卡 —— 这个应用的招牌视觉。
 *
 * 设计要点：干支是绝对主角，字号与其余信息拉开三档；十神贴在干支左右
 * 作为注解而不是并列信息；藏干、纳音、神煞按重要性递减排布。
 * 五行色只用于干支本身和顶部那道细光带，其余保持中性，避免整张卡花掉。
 */

import { WUXING_CHAR_COLORS } from "@/lib/wuxing-colors";

export interface PillarCardProps {
  /** 柱名，如「年柱」 */
  label: string;
  /** 宫位，如「祖业」 */
  sublabel: string;
  stem: string;
  branch: string;
  hiddenStems: string[];
  tenGodGan?: string;
  tenGodZhi?: string;
  nayin?: string;
  shensha?: string[];
  dishi?: string;
  xunkong?: string;
  /** 显示地势与旬空等专业字段 */
  isProfessional?: boolean;
  /** 日柱高亮：日主是全盘的太极点 */
  isDayPillar?: boolean;
}

function charColor(char: string): string {
  return WUXING_CHAR_COLORS[char] ?? "var(--foreground)";
}

export default function PillarCard({
  label,
  sublabel,
  stem,
  branch,
  hiddenStems,
  tenGodGan,
  tenGodZhi,
  nayin,
  shensha = [],
  dishi,
  xunkong,
  isProfessional = false,
  isDayPillar = false,
}: PillarCardProps) {
  const stemColor = charColor(stem);
  const branchColor = charColor(branch);

  return (
    <article
      className={`surface-raised card-interactive relative overflow-hidden rounded-xl ${
        isDayPillar ? "ring-1 ring-gold/30" : ""
      }`}
    >
      {/* 顶部光带：由天干五行色渐隐，给每柱一个可辨识的色彩身份 */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${stemColor}, transparent)`,
          opacity: 0.55,
        }}
      />

      <header className="px-4 pt-4 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <h3 className="text-[13px] font-medium tracking-wide text-foreground/80">
            {label}
          </h3>
          {isDayPillar && (
            <span className="rounded bg-gold/15 px-1.5 py-px text-[10px] font-medium text-gold">
              日主
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{sublabel}</p>
      </header>

      {/* 干支主体 */}
      <div className="flex flex-col items-center gap-1 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="w-10 text-right text-[11px] leading-tight text-gold/85">
            {tenGodGan && tenGodGan !== "日主" ? tenGodGan : ""}
          </span>
          <span
            className="font-heading text-[42px] font-bold leading-none tracking-tight"
            style={{ color: stemColor }}
          >
            {stem}
          </span>
          <span className="w-10" />
        </div>

        <div className="flex items-center gap-2">
          <span className="w-10 text-right text-[11px] leading-tight text-gold/70">
            {tenGodZhi ? tenGodZhi.split(" ")[0] : ""}
          </span>
          <span
            className="font-heading text-[42px] font-bold leading-none tracking-tight"
            style={{ color: branchColor }}
          >
            {branch}
          </span>
          <span className="w-10" />
        </div>
      </div>

      {/* 次级信息 */}
      <div className="space-y-2 px-4 pb-4">
        {hiddenStems.length > 0 && (
          <div className="surface-inset flex items-center justify-center gap-1.5 rounded-md py-1.5">
            <span className="text-[10px] text-muted-foreground">藏干</span>
            {hiddenStems.map((s, i) => (
              <span
                key={i}
                className="text-[13px] font-semibold leading-none"
                style={{ color: charColor(s) }}
              >
                {s}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">纳音</span>
          <span className="font-medium text-foreground/85">{nayin || "—"}</span>
        </div>

        {isProfessional && (
          <>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">地势</span>
              <span className="text-foreground/75">{dishi || "—"}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">旬空</span>
              <span className="tabular text-foreground/75">{xunkong || "—"}</span>
            </div>
          </>
        )}

        {shensha.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1 pt-0.5">
            {shensha.map((ss, i) => (
              <span
                key={i}
                className="rounded-full border border-jade/25 bg-jade/10 px-2 py-0.5 text-[10px] font-medium text-jade"
              >
                {ss}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
