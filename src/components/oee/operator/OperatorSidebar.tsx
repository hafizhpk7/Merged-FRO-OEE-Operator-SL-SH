import { Link } from "@tanstack/react-router";
import {
  Activity,
  BadgeCheck,
  Boxes,
  CalendarCheck,
  ChartPie,
  Container,
  FolderOpen,
  LayoutDashboard,
  Moon,
  Network,
  Package,
  PanelLeft,
  RefreshCw,
  Scale,
  Sun,
  UserCog,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";
import { toast } from "sonner";
import { useApp, type Role } from "@/lib/oee/app-context";
import { reasonTagStore } from "@/lib/oee/reasonTagStore";
import { DEFAULT_PLANT_ID, DEFAULT_ZONE_ID, getLine } from "@/lib/oee/data";
import { operatorSidebarStore, SIDEBAR_RAIL_PX, SIDEBAR_WIDE_PX, useSidebarCollapsed } from "@/lib/oee/operatorSidebarStore";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FroLogo } from "./FroLogo";

const roleLabels: Record<Role, string> = {
  "shift-leader": "Shift Leader",
  "section-head": "Section Head",
  operator: "Operator",
};

type Item = { label: string; icon: ComponentType<{ className?: string }>; active?: boolean };
type Group = { title?: string; items: Item[] };

/** Menu structure of the old FRO MES (docs/legacy/design-tokens.md). Only Pengemasan is part of this prototype. */
const MENU: Group[] = [
  { items: [{ label: "Beranda", icon: LayoutDashboard }] },
  {
    title: "Produksi",
    items: [
      { label: "Penimbangan", icon: Scale },
      { label: "Pengolahan", icon: Network },
      { label: "Pengemasan", icon: Boxes, active: true },
    ],
  },
  {
    title: "Manajemen",
    items: [
      { label: "Manajemen Produksi", icon: ChartPie },
      { label: "Manajemen Kemasan", icon: Package },
      { label: "Manajemen Bulk", icon: Container },
      { label: "Manajemen Kualitas", icon: BadgeCheck },
      { label: "Manajemen Jadwal", icon: CalendarCheck },
      { label: "Manajemen User", icon: Users },
    ],
  },
  { title: "Master", items: [{ label: "Master Data", icon: FolderOpen }] },
];

export function OperatorSidebar({ plantId = DEFAULT_PLANT_ID, lineId }: { plantId?: string; lineId?: string }) {
  const { role, setRole, isDarkMode, setIsDarkMode } = useApp();
  const collapsed = useSidebarCollapsed();

  const handleResetData = () => {
    reasonTagStore.resetDemoData();
    toast.info("Demo data reset to initial state");
  };
  const notInPrototype = () => toast.info("Not part of this prototype");

  const lineObj = lineId
    ? getLine(plantId, "A", lineId) || getLine(plantId, "B", lineId) || getLine(plantId, "C", lineId)
    : undefined;
  const zoneId = lineObj?.zoneId || DEFAULT_ZONE_ID;

  const itemClass = (active: boolean) =>
    `relative flex h-10 items-center gap-3 rounded-md text-sm transition-colors ${
      collapsed ? "w-10 justify-center" : "w-full px-3"
    } ${active ? "rounded-l-none bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-accent hover:text-foreground"}`;

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        data-testid="operator-sidebar"
        data-collapsed={collapsed}
        style={{ width: collapsed ? SIDEBAR_RAIL_PX : SIDEBAR_WIDE_PX }}
        className="fixed inset-y-0 left-0 z-40 flex flex-col justify-between overflow-y-auto overflow-x-hidden border-r border-sidebar-border bg-sidebar transition-[width] duration-200"
      >
        <div className="flex flex-col gap-4 py-3">
          {/* logo and collapse toggle */}
          <div className={`flex items-center ${collapsed ? "flex-col gap-3" : "justify-between px-4"}`}>
            <Link to="/operator" aria-label="FlowReport, pilih line">
              <FroLogo collapsed={collapsed} />
            </Link>
            <button
              type="button"
              data-testid="sidebar-toggle"
              aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
              onClick={() => operatorSidebarStore.toggle()}
              className="flex size-9 items-center justify-center rounded-md text-sidebar-foreground hover:bg-accent hover:text-foreground"
            >
              <PanelLeft className="size-5" />
            </button>
          </div>

          {/* MES menu (non-functional except Pengemasan) */}
          <nav aria-label="Menu MES" className={`flex flex-col gap-1 ${collapsed ? "items-center" : "px-3"}`}>
            {MENU.map((g, gi) => (
              <div key={gi} className={`flex flex-col gap-1 ${collapsed ? "items-center" : ""}`}>
                {g.title && !collapsed && (
                  <p className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/70">{g.title}</p>
                )}
                {g.title && collapsed && <span className="my-1 h-px w-6 bg-sidebar-border" />}
                {g.items.map((it) => {
                  const Icon = it.icon;
                  const body = (
                    <>
                      {it.active && <span className="absolute -left-0 top-1 bottom-1 w-1 rounded-r bg-sidebar-primary" />}
                      <Icon className="size-5 shrink-0" />
                      {!collapsed && <span className="truncate font-semibold">{it.label}</span>}
                    </>
                  );
                  const el = it.active ? (
                    <Link
                      key={it.label}
                      to={lineId ? "/operator/$plantId/$lineId" : "/operator"}
                      {...(lineId ? { params: { plantId, lineId } } : {})}
                      data-testid="menu-pengemasan"
                      aria-current="page"
                      className={itemClass(true)}
                    >
                      {body}
                    </Link>
                  ) : (
                    <button key={it.label} type="button" data-testid={`menu-${it.label.toLowerCase().replace(/\s+/g, "-")}`} onClick={notInPrototype} className={itemClass(false)}>
                      {body}
                    </button>
                  );
                  return collapsed ? (
                    <Tooltip key={it.label}>
                      <TooltipTrigger asChild>{el}</TooltipTrigger>
                      <TooltipContent side="right">{it.label}</TooltipContent>
                    </Tooltip>
                  ) : (
                    el
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Prototype group: role switcher and light/dark toggle stay reachable */}
        <div className={`flex flex-col gap-1 border-t border-sidebar-border py-3 ${collapsed ? "items-center" : "px-3"}`} data-testid="sidebar-prototype">
          {!collapsed && <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/70">Prototype</p>}
          <button
            type="button"
            data-testid="theme-toggle"
            onClick={() => setIsDarkMode(!isDarkMode)}
            aria-label={isDarkMode ? "Light mode" : "Dark mode"}
            className={itemClass(false)}
          >
            {isDarkMode ? <Sun className="size-5 shrink-0" /> : <Moon className="size-5 shrink-0" />}
            {!collapsed && <span className="font-semibold">{isDarkMode ? "Light Mode" : "Dark Mode"}</span>}
          </button>

          <Popover>
            <PopoverTrigger asChild>
              <button type="button" data-testid="role-switcher" aria-label="User & Role" className={itemClass(false)}>
                <UserCog className="size-5 shrink-0" />
                {!collapsed && <span className="font-semibold">User &amp; Role</span>}
              </button>
            </PopoverTrigger>
            <PopoverContent side="right" align="end" className="w-56 p-2">
              <p className="px-2 pb-2 text-xs font-semibold text-muted-foreground">View dashboard as</p>
              {(["shift-leader", "section-head", "operator"] as const).map((itemRole) => {
                const targetTo =
                  itemRole === "operator" ? "/operator" : itemRole === "section-head" ? "/live" : "/live/$plantId/$zoneId";
                const targetParams =
                  itemRole === "operator" || itemRole === "section-head" ? undefined : { plantId, zoneId };
                return (
                  <Link key={itemRole} to={targetTo as never} params={targetParams as never} className="block w-full" onClick={() => setRole(itemRole)}>
                    <button
                      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                        role === itemRole ? "bg-primary/10 text-primary" : "hover:bg-accent text-foreground"
                      }`}
                    >
                      {itemRole === "shift-leader" ? <Activity className="size-3.5" /> : itemRole === "section-head" ? <Users className="size-3.5" /> : <UserCog className="size-3.5" />}
                      <span>{roleLabels[itemRole]}</span>
                    </button>
                  </Link>
                );
              })}
              <div className="my-2 border-t border-border" />
              <Link to="/operator" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent">
                Change Line
              </Link>
              <button
                onClick={handleResetData}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <RefreshCw className="size-3.5" />
                Reset Demo Data
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </aside>
    </TooltipProvider>
  );
}
