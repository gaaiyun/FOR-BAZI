/**
 * AppShell – root layout component.
 * Renders the sidebar + main content area with a header bar.
 */

import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";

export function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-12 items-center justify-between border-b border-border px-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              玄冥 | Ming Matrix
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              命理系统 v{__APP_VERSION__}
            </span>
          </div>
        </header>

        <Separator />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      {/* Toast notifications */}
      <Toaster />
    </div>
  );
}

export default AppShell;
