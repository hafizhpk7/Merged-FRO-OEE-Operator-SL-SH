import { useEffect, type ReactNode } from "react";
import { SIDEBAR_RAIL_PX, SIDEBAR_WIDE_PX, useSidebarCollapsed } from "@/lib/oee/operatorSidebarStore";
import { OperatorSidebar } from "./OperatorSidebar";

/**
 * Common frame of every operator page: legacy-styled sidebar, content area and footer. Everything
 * inside carries the `.fro-theme` class (legacy FRO design tokens). The class is also put on <body>
 * while an operator page is mounted so portals (dialogs, popovers, selects) get the same look; it is
 * removed again on unmount, so SL/SH pages keep the prototype theme.
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
        <div className="flex w-full min-w-0 flex-1 flex-col gap-4 p-3 sm:p-4 lg:p-5">{children}</div>
        <OperatorFooter />
      </div>
    </div>
  );
}

export function OperatorFooter() {
  return (
    <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-4 py-4 text-sm font-medium text-foreground" data-testid="operator-footer">
      <p>Developed by IT Paragon Technology &amp; Innovation</p>
      <span aria-hidden="true" className="text-muted-foreground">·</span>
      <a href="https://paragon-corp.com" target="_blank" rel="noreferrer" className="text-primary hover:underline">
        FlowReport
      </a>
      <p className="text-muted-foreground">v4.0.0</p>
    </footer>
  );
}
