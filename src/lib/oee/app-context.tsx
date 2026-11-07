import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Context,
  type ReactNode,
} from "react";

import { DEFAULT_PLANT_ID } from "./data";
import { snapResolution, type ResolutionId, type SpanId, type PeriodId } from "./filters";
import { PeriodProvider } from "./period";
import { ROLE_DEFAULT, ROLE_PERSISTENCE, type Role } from "./config";

export type { Role };

export type Filters = {
  span: SpanId;
  resolution: ResolutionId;
  /** Section Head only (single select) */
  plantId: string;
  zoneIds: string[];
  lineIds: string[];
  sku: string | "all";
};

type Ctx = {
  role: Role;
  setRole: (r: Role) => void;
  roleReady: boolean;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  toggleMobileSidebar: () => void;
  isDarkMode: boolean;
  setIsDarkMode: (dark: boolean) => void;
  livePeriod: PeriodId;
  setLivePeriod: (p: PeriodId) => void;
  filters: Filters;
  /** Applies the cascading rules from §5 automatically. */
  setFilters: (patch: Partial<Filters>) => void;
};

// Keep a single context instance across hot-module reloads. Without this, a
// reloaded copy of this module creates a new context and consumers rendered by
// the still-mounted provider read `null` and crash.
const globalStore = globalThis as unknown as { __oeeAppContext?: Context<Ctx | null> };
const AppContext = (globalStore.__oeeAppContext ??= createContext<Ctx | null>(null));

export function AppProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(ROLE_DEFAULT);
  const [roleReady, setRoleReady] = useState<boolean>(false);

  useEffect(() => {
    try {
      const storage = ROLE_PERSISTENCE === "session" ? sessionStorage : localStorage;
      const saved = storage.getItem("paragon_oee_role");
      if (saved === "shift-leader" || saved === "section-head" || saved === "operator") {
        setRoleState(saved);
      } else {
        setRoleState(ROLE_DEFAULT);
      }
    } catch {
      setRoleState(ROLE_DEFAULT);
    } finally {
      setRoleReady(true);
    }
  }, []);

  const setRole = useCallback((newRole: Role) => {
    setRoleState(newRole);
    try {
      const storage = ROLE_PERSISTENCE === "session" ? sessionStorage : localStorage;
      storage.setItem("paragon_oee_role", newRole);
    } catch {
      // ignore
    }
  }, []);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [livePeriod, setLivePeriod] = useState<PeriodId>("live");
  const [filters, setFiltersState] = useState<Filters>({
    span: "this-week",
    resolution: "1d",
    plantId: DEFAULT_PLANT_ID,
    zoneIds: ["A"],
    lineIds: [],
    sku: "all",
  });

  const toggleMobileSidebar = useCallback(() => {
    setMobileSidebarOpen((prev) => !prev);
  }, []);

  const setFilters = useCallback((patch: Partial<Filters>) => {
    setFiltersState((prev) => {
      const next: Filters = { ...prev, ...patch };
      // Plant resets Zone & Line, but never Span/Resolution/SKU.
      if (patch.plantId && patch.plantId !== prev.plantId) {
        next.zoneIds = [];
        next.lineIds = [];
      }
      // Zone limits the available Lines -> drop lines that no longer apply.
      if (patch.zoneIds && patch.zoneIds !== prev.zoneIds) {
        next.lineIds = [];
      }
      // Span change may invalidate resolution -> auto snap to nearest coarser.
      next.resolution = snapResolution(next.span, next.resolution);
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  const value = useMemo(
    () => ({
      role,
      setRole,
      roleReady,
      isCollapsed,
      setIsCollapsed,
      mobileSidebarOpen,
      setMobileSidebarOpen,
      toggleMobileSidebar,
      isDarkMode,
      setIsDarkMode,
      livePeriod,
      setLivePeriod,
      filters,
      setFilters,
    }),
    [
      role,
      setRole,
      roleReady,
      isCollapsed,
      mobileSidebarOpen,
      setMobileSidebarOpen,
      toggleMobileSidebar,
      isDarkMode,
      livePeriod,
      filters,
      setFilters,
    ],
  );
  return (
    <AppContext.Provider value={value}>
      <PeriodProvider>{children}</PeriodProvider>
    </AppContext.Provider>
  );
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
