import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutGrid,
  XCircle,
  ListFilter,
  Sun,
  Moon,
  UserCog,
  RefreshCw,
  Activity,
  Users,
} from "lucide-react";
import { useApp, type Role } from "@/lib/oee/app-context";
import { reasonTagStore } from "@/lib/oee/reasonTagStore";
import { isOeeActiveLine } from "@/lib/oee/config";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getLine, DEFAULT_ZONE_ID } from "@/lib/oee/data";

const roleLabels: Record<Role, string> = {
  "shift-leader": "Shift Leader",
  "section-head": "Section Head",
  operator: "Operator",
};

export function OperatorSidebar({ plantId, lineId }: { plantId: string; lineId: string }) {
  const { role, setRole, isDarkMode, setIsDarkMode } = useApp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActiveLine = isOeeActiveLine(plantId, lineId);

  const handleResetData = () => {
    reasonTagStore.resetDemoData();
    toast.info("Demo data reset to initial state");
  };

  return (
    <TooltipProvider delayDuration={150}>
      <aside className="fixed inset-y-0 left-0 z-40 flex w-16 flex-col items-center justify-between border-r border-border bg-card py-4 shadow-sm">
        {/* Top Logo */}
        <div className="flex flex-col items-center gap-6">
          <Link
            to="/operator"
            className="flex size-10 items-center justify-center rounded-lg p-1 hover:bg-accent"
          >
            <img src="/paragon-logo-new.png" alt="Paragon Logo" className="size-8 object-contain" />
          </Link>

          {/* Navigation Items */}
          <nav className="flex flex-col items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/operator/$plantId/$lineId"
                  params={{ plantId, lineId }}
                  className={`flex size-10 items-center justify-center rounded-lg transition-colors ${
                    pathname === `/operator/${plantId}/${lineId}` ||
                    pathname === `/operator/${plantId}/${lineId}/`
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <LayoutGrid className="size-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Dashboard</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                {isActiveLine ? (
                  <Link
                    to="/operator/$plantId/$lineId/reject"
                    params={{ plantId, lineId }}
                    className={`flex size-10 items-center justify-center rounded-lg transition-colors ${
                      pathname.endsWith("/reject")
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <XCircle className="size-5" />
                  </Link>
                ) : (
                  <span className="flex size-10 items-center justify-center rounded-lg opacity-40 cursor-not-allowed text-muted-foreground">
                    <XCircle className="size-5" />
                  </span>
                )}
              </TooltipTrigger>
              <TooltipContent side="right">
                {isActiveLine ? "Reject" : "OEE is not active for this line yet"}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                {isActiveLine ? (
                  <Link
                    to="/operator/$plantId/$lineId/reason"
                    params={{ plantId, lineId }}
                    className={`flex size-10 items-center justify-center rounded-lg transition-colors ${
                      pathname.endsWith("/reason")
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <ListFilter className="size-5" />
                  </Link>
                ) : (
                  <span className="flex size-10 items-center justify-center rounded-lg opacity-40 cursor-not-allowed text-muted-foreground">
                    <ListFilter className="size-5" />
                  </span>
                )}
              </TooltipTrigger>
              <TooltipContent side="right">
                {isActiveLine ? "Reason" : "OEE is not active for this line yet"}
              </TooltipContent>
            </Tooltip>
          </nav>
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-col items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {isDarkMode ? <Sun className="size-5" /> : <Moon className="size-5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{isDarkMode ? "Light Mode" : "Dark Mode"}</TooltipContent>
          </Tooltip>

          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground transition-colors hover:bg-accent">
                    <UserCog className="size-5" />
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="right">User & Role</TooltipContent>
            </Tooltip>
            <PopoverContent side="right" align="end" className="w-56 p-2">
              <p className="px-2 pb-2 text-xs font-semibold text-muted-foreground">
                View dashboard as
              </p>
              {(["shift-leader", "section-head", "operator"] as const).map((itemRole) => {
                const lineObj =
                  getLine(plantId, "A", lineId) ||
                  getLine(plantId, "B", lineId) ||
                  getLine(plantId, "C", lineId);
                const zoneId = lineObj?.zoneId || DEFAULT_ZONE_ID;
                const targetTo =
                  itemRole === "operator"
                    ? "/operator"
                    : itemRole === "section-head"
                      ? "/live"
                      : "/live/$plantId/$zoneId";
                const targetParams =
                  itemRole === "operator" || itemRole === "section-head"
                    ? undefined
                    : { plantId, zoneId };

                return (
                  <Link
                    key={itemRole}
                    to={targetTo as never}
                    params={targetParams as never}
                    className="block w-full"
                    onClick={() => setRole(itemRole)}
                  >
                    <button
                      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                        role === itemRole
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-accent text-foreground"
                      }`}
                    >
                      {itemRole === "shift-leader" ? (
                        <Activity className="size-3.5" />
                      ) : itemRole === "section-head" ? (
                        <Users className="size-3.5" />
                      ) : (
                        <UserCog className="size-3.5" />
                      )}
                      <span>{roleLabels[itemRole]}</span>
                    </button>
                  </Link>
                );
              })}
              <div className="my-2 border-t border-border" />
              <Link
                to="/operator"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
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
