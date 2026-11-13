/**
 * 出生时间换算：农历转公历、夏令时扣除、真太阳时校正。
 *
 * 排盘用的是「当地真太阳时」。钟表时间是东经 120° 的平太阳时，
 * 出生地越往西偏差越大（乌鲁木齐约慢 2 小时 10 分），足以换一个时辰。
 * 校正量 = 经度差 × 4 分钟 + 均时差；1986–1991 年夏令时期间另扣 1 小时。
 */

import { Lunar } from "lunar-typescript";

export interface City {
  name: string;
  /** 东经，度 */
  lng: number;
}

/** 省会、直辖市与常见城市，按拼音大致排序。经度取市中心，精确到 0.1°。 */
export const CITIES: City[] = [
  { name: "北京", lng: 116.4 }, { name: "上海", lng: 121.5 }, { name: "广州", lng: 113.3 },
  { name: "深圳", lng: 114.1 }, { name: "天津", lng: 117.2 }, { name: "重庆", lng: 106.5 },
  { name: "成都", lng: 104.1 }, { name: "杭州", lng: 120.2 }, { name: "南京", lng: 118.8 },
  { name: "武汉", lng: 114.3 }, { name: "西安", lng: 108.9 }, { name: "长沙", lng: 113.0 },
  { name: "郑州", lng: 113.6 }, { name: "济南", lng: 117.0 }, { name: "青岛", lng: 120.4 },
  { name: "沈阳", lng: 123.4 }, { name: "大连", lng: 121.6 }, { name: "长春", lng: 125.3 },
  { name: "哈尔滨", lng: 126.6 }, { name: "石家庄", lng: 114.5 }, { name: "太原", lng: 112.5 },
  { name: "呼和浩特", lng: 111.7 }, { name: "合肥", lng: 117.3 }, { name: "南昌", lng: 115.9 },
  { name: "福州", lng: 119.3 }, { name: "厦门", lng: 118.1 }, { name: "南宁", lng: 108.4 },
  { name: "海口", lng: 110.3 }, { name: "贵阳", lng: 106.7 }, { name: "昆明", lng: 102.7 },
  { name: "拉萨", lng: 91.1 }, { name: "兰州", lng: 103.8 }, { name: "西宁", lng: 101.8 },
  { name: "银川", lng: 106.3 }, { name: "乌鲁木齐", lng: 87.6 }, { name: "苏州", lng: 120.6 },
  { name: "无锡", lng: 120.3 }, { name: "宁波", lng: 121.6 }, { name: "温州", lng: 120.7 },
  { name: "佛山", lng: 113.1 }, { name: "东莞", lng: 113.8 }, { name: "汕头", lng: 116.7 },
  { name: "湛江", lng: 110.4 }, { name: "香港", lng: 114.2 }, { name: "澳门", lng: 113.5 },
  { name: "台北", lng: 121.5 },
];

/** 中国大陆 1986–1991 年夏令时起止（月、日），期间钟表拨快 1 小时。 */
const CN_DST: Record<number, [number, number, number, number]> = {
  1986: [5, 4, 9, 14],
  1987: [4, 12, 9, 13],
  1988: [4, 10, 9, 11],
  1989: [4, 16, 9, 17],
  1990: [4, 15, 9, 16],
  1991: [4, 14, 9, 15],
};

export function isChinaDst(d: Date): boolean {
  const span = CN_DST[d.getFullYear()];
  if (!span) return false;
  const [sm, sd, em, ed] = span;
  const start = new Date(d.getFullYear(), sm - 1, sd, 2, 0, 0);
  const end = new Date(d.getFullYear(), em - 1, ed, 2, 0, 0);
  return d >= start && d < end;
}

/** 均时差（分钟）。真太阳时 − 平太阳时，全年在 −14 到 +16 分钟之间摆动。 */
export function equationOfTime(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((d.getTime() - start.getTime()) / 86_400_000);
  const b = (2 * Math.PI * (dayOfYear - 81)) / 364;
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}

export interface ResolvedBirth {
  /** 实际用于排盘的时刻 */
  effective: Date;
  /** 用户填写对应的公历钟表时刻 */
  clock: Date;
  /** 校正分钟数（已含夏令时），未校正时为 0 */
  offsetMinutes: number;
  /** 是否扣除了夏令时 */
  dst: boolean;
  /** 对用户可读的换算说明，逐条 */
  notes: string[];
}

export interface BirthInputLike {
  birth_date: string;
  birth_time: string;
  calendar_type?: "solar" | "lunar";
  lunar_leap?: boolean;
  true_solar?: boolean;
  longitude?: number | null;
  place?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatDateTime(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 把表单输入换算成排盘时刻。输入无法解析时抛错，由调用方展示。 */
export function resolveBirth(input: BirthInputLike): ResolvedBirth {
  const dm = input.birth_date.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const tm = input.birth_time.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!dm || !tm) throw new Error("请填写完整的出生日期和时间。");
  const [y, mo, da] = [Number(dm[1]), Number(dm[2]), Number(dm[3])];
  const [h, mi] = [Number(tm[1]), Number(tm[2])];
  const notes: string[] = [];

  let clock: Date;
  if (input.calendar_type === "lunar") {
    let solar;
    try {
      solar = Lunar.fromYmdHms(y, input.lunar_leap ? -mo : mo, da, h, mi, 0).getSolar();
    } catch {
      throw new Error(
        input.lunar_leap
          ? `农历 ${y} 年没有闰 ${mo} 月，或该月没有 ${da} 日。`
          : `农历 ${y} 年 ${mo} 月没有 ${da} 日。`
      );
    }
    clock = new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay(), h, mi, 0);
    notes.push(`农历 ${y} 年${input.lunar_leap ? "闰" : ""}${mo} 月 ${da} 日，对应公历 ${formatDateTime(clock).slice(0, 10)}`);
  } else {
    clock = new Date(y, mo - 1, da, h, mi, 0);
    if (clock.getMonth() !== mo - 1 || clock.getDate() !== da) {
      throw new Error(`公历 ${y} 年 ${mo} 月没有 ${da} 日。`);
    }
  }

  const useTrue = Boolean(input.true_solar) && typeof input.longitude === "number";
  if (!useTrue) {
    return { effective: clock, clock, offsetMinutes: 0, dst: false, notes };
  }

  const dst = isChinaDst(clock);
  const lngOffset = ((input.longitude as number) - 120) * 4;
  const eot = equationOfTime(clock);
  const offsetMinutes = Math.round(lngOffset + eot - (dst ? 60 : 0));
  const effective = new Date(clock.getTime() + offsetMinutes * 60_000);

  if (dst) notes.push("出生在夏令时期间，先扣除 1 小时");
  notes.push(
    `${input.place ? input.place + " " : ""}东经 ${(input.longitude as number).toFixed(1)}°，` +
      `经度差 ${lngOffset >= 0 ? "+" : "−"}${Math.abs(Math.round(lngOffset))} 分，` +
      `均时差 ${eot >= 0 ? "+" : "−"}${Math.abs(Math.round(eot))} 分`
  );
  notes.push(`真太阳时 ${formatDateTime(effective)}`);

  return { effective, clock, offsetMinutes, dst, notes };
}
