/** 全站导航。侧栏、手机底栏和「更多」面板共用这一份。 */

export interface NavItem {
  label: string;
  path: string;
  /** 一句事实性说明，只在「更多」面板里显示 */
  note: string;
}

export const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "命盘",
    items: [
      { label: "排盘", path: "/", note: "填写出生信息" },
      { label: "命盘", path: "/chart", note: "四柱、格局与干支关系" },
      { label: "大运", path: "/luck-pillars", note: "十年一步与逐年流年" },
      { label: "流年", path: "/annual", note: "任选一年看它与原局的关系" },
    ],
  },
  {
    title: "分析",
    items: [
      { label: "五行", path: "/elements", note: "力量占比与生克" },
      { label: "十神", path: "/ten-gods", note: "分布与落宫" },
      { label: "神煞", path: "/shensha", note: "各柱所带神煞" },
    ],
  },
  {
    title: "解读",
    items: [
      { label: "解读", path: "/ai-reading", note: "一次完整的 AI 解读" },
      { label: "问事", path: "/chat", note: "就具体问题追问" },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = { label: "设置", path: "/settings", note: "AI 服务与外观" };

export const ALL_ITEMS: NavItem[] = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS_ITEM];

/** 手机底栏的四个固定入口，其余进「更多」。 */
export const TAB_PATHS = ["/", "/chart", "/luck-pillars", "/ai-reading"];
