import { useEffect, type ReactNode } from "react";
import { SIDEBAR_RAIL_PX, SIDEBAR_WIDE_PX, useSidebarCollapsed } from "@/lib/oee/operatorSidebarStore";
import { OperatorSidebar } from "./OperatorSidebar";
import { OperatorTopBar } from "./OperatorTopBar";

/**
 * Common frame of every operator page: legacy-styled sidebar, top bar, content area (zinc-100 page
 * background, 12 px padding) and footer. Everything inside carries the `.fro-theme` class (legacy FRO
 * design tokens). The class is also put on <body> while an operator page is mounted so portals
 * (dialogs, popovers, selects) get the same look; it is removed again on unmount, so SL/SH pages keep
 * the prototype theme.
 */
export function OperatorFrame({ plantId, lineId, children }: { plantId?: string; lineId?: string; children: ReactNode }) {
  const collapsed = useSidebarCollapsed();
  useEffect(() => {
    document.body.classList.add("fro-theme");
    return () => document.body.classList.remove("fro-theme");
  }, []);
  return (
    <div className="fro-theme flex min-h-screen w-full bg-background text-foreground" data-testid="operator-frame">
      <OperatorSidebar {...(plantId ? { plantId } : {})} {...(lineId ? { lineId } : {})} />
      <div
        style={{ paddingLeft: collapsed ? SIDEBAR_RAIL_PX : SIDEBAR_WIDE_PX }}
        className="flex min-h-screen min-w-0 flex-1 flex-col transition-[padding] duration-200 max-md:!pl-[69px]"
      >
        <OperatorTopBar />
        <main className="flex min-w-0 flex-1 flex-col gap-2 bg-[color:var(--fro-page)] p-3" data-testid="operator-main">
          {children}
        </main>
        <OperatorFooter />
      </div>
    </div>
  );
}

export function OperatorFooter() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-x-16 gap-y-2 border-t border-border p-4" data-testid="operator-footer">
      <p className="text-sm font-medium">Developed by IT Paragon Technology &amp; Innovation</p>
      <div className="flex items-center gap-1">
        <a href="https://paragon-corp.com" target="_blank" rel="noreferrer" className="text-sm font-bold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
          FlowReport
        </a>
        <p className="text-sm">v4.0.0</p>
      </div>
    </footer>
  );
}
