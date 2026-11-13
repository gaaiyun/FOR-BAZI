/**
 * Root application component.
 * Configures React Router with lazy-loaded page components
 * and wraps everything in the AppShell layout.
 */

import { lazy } from "react";
import { Routes, Route, Link } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";

const BaziCalculator = lazy(() => import("@/pages/BaziCalculator"));
const ChartVisualization = lazy(() => import("@/pages/ChartVisualization"));
const LuckPillars = lazy(() => import("@/pages/LuckPillars"));
const AnnualForecast = lazy(() => import("@/pages/AnnualForecast"));
const ElementsAnalysis = lazy(() => import("@/pages/ElementsAnalysis"));
const TenGods = lazy(() => import("@/pages/TenGods"));
const ShenSha = lazy(() => import("@/pages/ShenSha"));
const AIReading = lazy(() => import("@/pages/AIReading"));
const Chat = lazy(() => import("@/pages/Chat"));
const Settings = lazy(() => import("@/pages/Settings"));

function NotFound() {
  return (
    <div className="animate-fade-in border-t border-foreground py-14">
      <p className="font-heading text-xl font-semibold">没有这个页面</p>
      <Link to="/" className="btn btn-primary mt-6">
        回到排盘
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<BaziCalculator />} />
        <Route path="/chart" element={<ChartVisualization />} />
        <Route path="/luck-pillars" element={<LuckPillars />} />
        <Route path="/annual" element={<AnnualForecast />} />
        <Route path="/elements" element={<ElementsAnalysis />} />
        <Route path="/ten-gods" element={<TenGods />} />
        <Route path="/shensha" element={<ShenSha />} />
        <Route path="/ai-reading" element={<AIReading />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
