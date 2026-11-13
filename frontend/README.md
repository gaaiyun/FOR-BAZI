# FOR-BAZI 前端

React 19 + TypeScript + Vite。排盘引擎、14 个 AI 工具和古籍检索都在这里，网页版不需要后端。

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest：引擎对拍、复制文本、真太阳时、农历等
npm run build      # 产出 dist/
npm run lint
```

## 目录

| 路径 | 内容 |
|---|---|
| `src/engine/` | TS 排盘引擎，与仓库根目录的 Python 引擎逐字段对拍（`parity.test.ts`） |
| `src/lib/chart-view.ts` | 展示模型：页面和复制文本共用的派生量 |
| `src/lib/chart-text.ts` | 「复制给 AI」的 Markdown / JSON |
| `src/lib/solar-time.ts` | 农历转公历、夏令时、真太阳时 |
| `src/lib/relations.ts` | 大运、流年与原局的合冲刑害 |
| `src/lib/react-agent.ts` | ReAct 循环，经 `/api/chat` 调模型 |
| `functions/api/` | Cloudflare Pages Function：AI 网关 |
| `scripts/subset_glyph_font.py` | 生成干支大字的字体子集（需要 `fonttools` 与 `brotli`） |

## 站内 AI 解读

`npm run dev` 时 `/api/*` 会代理到本地 8000 端口的 Python 后端。要连同网关一起调试：

```bash
npm run build
npx wrangler pages dev dist
```

部署步骤见 [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md#cloudflare-pages网页版推荐)，整体架构见 [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)。
