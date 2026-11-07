import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Moon,
  Settings,
  Sun,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DEFAULT_PLANT_ID, DEFAULT_ZONE_ID } from "@/lib/oee/data";
import { useApp, type Role } from "@/lib/oee/app-context";
import { cn } from "@/lib/utils";
import { BUILD_ID } from "@/lib/oee/build-info";
import { QuickSearchTrigger } from "./quick-search";

const roleLabels: Record<Role, string> = {
  "shift-leader": "Shift Leader",
  "section-head": "Section Head",
  operator: "Operator",
};

function CollapsedTooltip({
  collapsed,
  label,
  children,
}: {
  collapsed: boolean;
  label: string;
  children: ReactNode;
}) {
  if (!collapsed) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function AppSidebar() {
  const {
    role,
    setRole,
    isCollapsed,
    setIsCollapsed,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    isDarkMode,
    setIsDarkMode,
  } = useApp();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const liveDestination = role === "section-head" ? "/live" : "/live/$plantId/$zoneId";
  const liveParams =
    role === "section-head" ? undefined : { plantId: DEFAULT_PLANT_ID, zoneId: DEFAULT_ZONE_ID };

  // Auto-close mobile drawer on route change (skip initial mount)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setMobileSidebarOpen(false);
  }, [pathname, setMobileSidebarOpen]);

  return (
    <TooltipProvider delayDuration={150}>
      {/* Mobile Slide-Out Drawer Backdrop */}
      {mobileSidebarOpen && (
        <div
          role="presentation"
          aria-hidden="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity duration-300 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Slide-Out Drawer */}
      <aside
        aria-label="Mobile Navigation Sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl transition-transform duration-300 ease-in-out lg:hidden",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-sidebar-border px-4">
          <Link
            to={liveDestination}
            params={liveParams as never}
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Paragon OEE FRO home"
            activeProps={() => ({ className: "" })}
            className="flex min-w-0 items-center gap-3"
          >
            <img
              src="/paragon-logo-new.png"
              alt="ParagonCorp Logo"
              className="h-10 w-10 shrink-0 object-contain p-1"
            />
            <div className="min-w-0">
              <span className="block truncate text-sm font-semibold">Paragon OEE FRO</span>
              <span className="block truncate text-[10px] text-muted-foreground">
                Factory Operations
              </span>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileSidebarOpen(false)}
            className="size-9 rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
            aria-label="Close navigation menu"
          >
            <X className="size-5" />
          </Button>
        </div>

        <nav aria-label="Mobile Navigation" className="flex-1 space-y-1.5 overflow-y-auto p-3">
          <div className="pb-2">
            <QuickSearchTrigger className="w-full" />
          </div>
          <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Operations
          </p>
          <Link
            to={liveDestination}
            params={liveParams as never}
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Live Monitor Dashboard"
            className={cn(
              "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
              pathname === "/" || pathname.startsWith("/live")
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Activity className="size-5 shrink-0" />
            <span>Live Monitor</span>
          </Link>

          <Link
            to="/analytics"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="OEE Analytics Dashboard"
            className={cn(
              "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
              pathname.startsWith("/analytics")
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <BarChart3 className="size-5 shrink-0" />
            <span>OEE Analytics</span>
          </Link>

          {role === "section-head" && (
            <Link
              to="/shift-performance"
              onClick={() => setMobileSidebarOpen(false)}
              aria-label="Shift Performance"
              className={cn(
                "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                pathname === "/shift-performance"
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Users className="size-5 shrink-0" />
              <span>Shift Performance</span>
            </Link>
          )}
        </nav>

        <div className="space-y-1 border-t border-sidebar-border p-3">
          <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Settings
          </p>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className="h-11 w-full justify-start px-3"
                aria-label={`Change role. Current role: ${roleLabels[role]}`}
              >
                <UserCog className="size-5" />
                <span className="min-w-0 flex-1 truncate text-left">{roleLabels[role]}</span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-56 p-2">
              <p className="px-2 pb-2 text-xs font-semibold">View dashboard as</p>
              {(["shift-leader", "section-head", "operator"] as const).map((itemRole) => (
                <Link
                  key={itemRole}
                  to={itemRole === "operator" ? "/operator" : liveDestination}
                  params={(itemRole === "operator" ? undefined : liveParams) as never}
                  className="block w-full"
                  onClick={() => {
                    setRole(itemRole);
                    setMobileSidebarOpen(false);
                  }}
                >
                  <Button
                    variant={role === itemRole ? "secondary" : "ghost"}
                    className="w-full justify-start"
                  >
                    {itemRole === "shift-leader" ? (
                      <Activity />
                    ) : itemRole === "section-head" ? (
                      <Users />
                    ) : (
                      <UserCog />
                    )}
                    {roleLabels[itemRole]}
                  </Button>
                </Link>
              ))}
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            className="h-11 w-full justify-start px-3"
            onClick={() => setIsDarkMode(!isDarkMode)}
            aria-label={isDarkMode ? "Use light mode" : "Enable dark mode"}
          >
            {isDarkMode ? <Sun className="size-5" /> : <Moon className="size-5" />}
            <span>{isDarkMode ? "Light Mode" : "Dark Mode"}</span>
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                className="h-11 w-full justify-start px-3"
                aria-label="User Management"
              >
                <Settings className="size-5" />
                <span>User Management</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] md:w-auto md:max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>User Management</DialogTitle>
                <DialogDescription>
                  User access is read-only in this prototype. Account management will be connected
                  during production development.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 p-3">
                <span className="grid size-10 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  SL
                </span>
                <div>
                  <p className="text-sm font-medium">Prototype User</p>
                  <p className="text-xs text-muted-foreground">Current role: {roleLabels[role]}</p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </aside>

      {/* Desktop Pinned Sidebar (lg and above) */}
      <aside
        aria-label="Desktop Navigation Sidebar"
        className={cn(
          "hidden lg:flex fixed inset-y-0 left-0 z-40 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm transition-all duration-300",
          isCollapsed ? "w-20" : "w-64",
        )}
      >
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b border-sidebar-border",
            isCollapsed ? "justify-center px-3" : "justify-between px-4",
          )}
        >
          <Link
            to={liveDestination}
            params={liveParams as never}
            aria-label="Paragon OEE FRO home"
            activeProps={() => ({ className: "" })}
            className="flex min-w-0 items-center gap-3"
          >
            <img
              src="/paragon-logo-new.png"
              alt="ParagonCorp Logo"
              className="h-10 w-10 shrink-0 object-contain p-1"
            />
            {!isCollapsed && (
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">Paragon OEE FRO</span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  Factory Operations
                </span>
              </span>
            )}
          </Link>
        </div>

        <nav aria-label="Global navigation" className="flex-1 space-y-1 overflow-y-auto p-3">
          <div className="pb-2">
            <CollapsedTooltip collapsed={isCollapsed} label="Search lines and machines (⌘K)">
              <div className="w-full">
                <QuickSearchTrigger collapsed={isCollapsed} />
              </div>
            </CollapsedTooltip>
          </div>
          {!isCollapsed && (
            <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Operations
            </p>
          )}
          <CollapsedTooltip collapsed={isCollapsed} label="Live Monitor Dashboard">
            <Link
              to={liveDestination}
              params={liveParams as never}
              aria-label="Live Monitor Dashboard"
              className={cn(
                "flex h-11 items-center rounded-md transition-colors",
                isCollapsed ? "justify-center px-0" : "gap-3 px-3",
                pathname === "/" || pathname.startsWith("/live")
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Activity className="size-5 shrink-0" />
              {!isCollapsed && <span className="text-sm font-medium">Live Monitor</span>}
            </Link>
          </CollapsedTooltip>

          <CollapsedTooltip collapsed={isCollapsed} label="OEE Analytics Dashboard">
            <Link
              to="/analytics"
              aria-label="OEE Analytics Dashboard"
              className={cn(
                "flex h-11 items-center rounded-md transition-colors",
                isCollapsed ? "justify-center px-0" : "gap-3 px-3",
                pathname.startsWith("/analytics")
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <BarChart3 className="size-5 shrink-0" />
              {!isCollapsed && <span className="text-sm font-medium">OEE Analytics</span>}
            </Link>
          </CollapsedTooltip>

          {role === "section-head" && (
            <CollapsedTooltip collapsed={isCollapsed} label="Shift Performance">
              <Link
                to="/shift-performance"
                aria-label="Shift Performance"
                className={cn(
                  "flex h-11 items-center rounded-md transition-colors",
                  isCollapsed ? "justify-center px-0" : "gap-3 px-3",
                  pathname === "/shift-performance"
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Users className="size-5 shrink-0" />
                {!isCollapsed && <span className="text-sm font-medium">Shift Performance</span>}
              </Link>
            </CollapsedTooltip>
          )}
        </nav>

        <div className="space-y-1 border-t border-sidebar-border p-3">
          {!isCollapsed && (
            <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Settings
            </p>
          )}

          <Popover>
            <CollapsedTooltip collapsed={isCollapsed} label={`Role: ${roleLabels[role]}`}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn("h-11 w-full", isCollapsed ? "px-0" : "justify-start px-3")}
                  aria-label={`Change role. Current role: ${roleLabels[role]}`}
                >
                  <UserCog className="size-5" />
                  {!isCollapsed && (
                    <span className="min-w-0 flex-1 truncate text-left">{roleLabels[role]}</span>
                  )}
                  {!isCollapsed && <ChevronRight className="size-4 text-muted-foreground" />}
                </Button>
              </PopoverTrigger>
            </CollapsedTooltip>
            <PopoverContent side="right" align="end" sideOffset={10} className="w-56 p-2">
              <p className="px-2 pb-2 text-xs font-semibold">View dashboard as</p>
              {(["shift-leader", "section-head", "operator"] as const).map((itemRole) => (
                <Link
                  key={itemRole}
                  to={itemRole === "operator" ? "/operator" : liveDestination}
                  params={(itemRole === "operator" ? undefined : liveParams) as never}
                  className="block w-full"
                  onClick={() => setRole(itemRole)}
                >
                  <Button
                    variant={role === itemRole ? "secondary" : "ghost"}
                    className="w-full justify-start"
                  >
                    {itemRole === "shift-leader" ? (
                      <Activity />
                    ) : itemRole === "section-head" ? (
                      <Users />
                    ) : (
                      <UserCog />
                    )}
                    {roleLabels[itemRole]}
                  </Button>
                </Link>
              ))}
            </PopoverContent>
          </Popover>

          <CollapsedTooltip
            collapsed={isCollapsed}
            label={isDarkMode ? "Use light mode" : "Enable dark mode"}
          >
            <Button
              variant="ghost"
              className={cn("h-11 w-full", isCollapsed ? "px-0" : "justify-start px-3")}
              onClick={() => setIsDarkMode(!isDarkMode)}
              aria-label={isDarkMode ? "Use light mode" : "Enable dark mode"}
            >
              {isDarkMode ? <Sun className="size-5" /> : <Moon className="size-5" />}
              {!isCollapsed && <span>{isDarkMode ? "Light Mode" : "Dark Mode"}</span>}
            </Button>
          </CollapsedTooltip>

          <Dialog>
            <CollapsedTooltip collapsed={isCollapsed} label="User Management">
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn("h-11 w-full", isCollapsed ? "px-0" : "justify-start px-3")}
                  aria-label="User Management"
                >
                  <Settings className="size-5" />
                  {!isCollapsed && <span>User Management</span>}
                </Button>
              </DialogTrigger>
            </CollapsedTooltip>
            <DialogContent className="w-[95vw] md:w-auto md:max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>User Management</DialogTitle>
                <DialogDescription>
                  User access is read-only in this prototype. Account management will be connected
                  during production development.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 p-3">
                <span className="grid size-10 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  SL
                </span>
                <div>
                  <p className="text-sm font-medium">Prototype User</p>
                  <p className="text-xs text-muted-foreground">Current role: {roleLabels[role]}</p>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <div className="pt-2">
            {!isCollapsed && (
              <div className="px-3 pb-1 text-[10px] font-mono text-muted-foreground/70 truncate">
                Build {BUILD_ID}
              </div>
            )}
            <CollapsedTooltip collapsed={isCollapsed} label={`Build ${BUILD_ID} · Expand sidebar`}>
              <Button
                variant="outline"
                className={cn("h-10 w-full", isCollapsed ? "px-0" : "justify-start px-3")}
                onClick={() => setIsCollapsed(!isCollapsed)}
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isCollapsed ? (
                  <ChevronRight className="size-5" />
                ) : (
                  <ChevronLeft className="size-5" />
                )}
                {!isCollapsed && <span>Collapse Sidebar</span>}
              </Button>
            </CollapsedTooltip>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
