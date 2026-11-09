import { QueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";

import { AppSidebar } from "@/components/oee/app-sidebar";
import { AppProvider, useApp } from "@/lib/oee/app-context";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { DEFAULT_PLANT_ID, DEFAULT_ZONE_ID } from "@/lib/oee/data";
import { reportLovableError } from "../lib/lovable-error-reporting";
import "@/lib/oee/oeeSelfTest";
import "@/lib/oee/reasonGroupSelfTest";
import "@/lib/oee/reminderSelfTest";
import "@/lib/oee/rejectL2SelfTest";
import "@/lib/oee/rejectEditorSelfTest";
import "@/lib/oee/targetSelfTest";
import "@/lib/oee/summarizationSelfTest";
import "@/lib/oee/assetMasterSelfTest";
import "@/lib/oee/simControls";
import "@/lib/oee/simSelfTest";
import "@/lib/oee/simPanelSelfTest";
import "@/lib/oee/simOutputSelfTest";
import { SimDensityConfirm } from "@/components/oee/operator/SimDensityConfirm";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/live"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/live"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  void queryClient;

  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      const msg =
        event.message || (event.error instanceof Error ? event.error.message : String(event.error));
      if (
        msg.includes("ResizeObserver loop completed with undelivered notifications") ||
        msg.includes("ResizeObserver loop limit exceeded")
      ) {
        event.stopImmediatePropagation?.();
        event.preventDefault?.();
        return;
      }
      if (
        msg.includes("Failed to fetch dynamically imported module") ||
        msg.includes("Importing a module script failed")
      ) {
        const reloadKey = "vite_reload_on_chunk_error";
        if (!sessionStorage.getItem(reloadKey)) {
          sessionStorage.setItem(reloadKey, "true");
          window.location.reload();
        }
      }
    };
    window.addEventListener("error", handleWindowError);
    return () => window.removeEventListener("error", handleWindowError);
  }, []);

  return (
    <AppProvider>
      <DashboardShell />
    </AppProvider>
  );
}

function RoleRouteGuard() {
  const { role, roleReady } = useApp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  useEffect(() => {
    if (!roleReady) return;
    if (pathname.startsWith("/dev")) return;

    const isOperatorPath = pathname.startsWith("/operator");

    if (role === "operator" && !isOperatorPath) {
      navigate({ to: "/operator", replace: true });
    } else if ((role === "shift-leader" || role === "section-head") && isOperatorPath) {
      const liveDest = role === "section-head" ? "/live" : "/live/$plantId/$zoneId";
      const liveParams =
        role === "section-head"
          ? undefined
          : { plantId: DEFAULT_PLANT_ID, zoneId: DEFAULT_ZONE_ID };
      navigate({ to: liveDest as never, params: liveParams as never, replace: true });
    }
  }, [role, roleReady, pathname, navigate]);

  return null;
}

function DashboardShell() {
  const { isCollapsed, roleReady } = useApp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!roleReady) {
    return <div className="min-h-screen bg-background" />;
  }

  if (pathname.startsWith("/operator")) {
    return (
      <div className="flex min-h-screen w-full min-w-0 max-w-full overflow-x-hidden bg-background text-foreground">
        <RoleRouteGuard />
        <Outlet />
        <Toaster position="bottom-right" richColors closeButton duration={5000} />
        <SimDensityConfirm />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full min-w-0 max-w-full overflow-x-hidden bg-background text-foreground">
      <RoleRouteGuard />
      <AppSidebar />
      <div
        className={cn(
          "flex min-h-screen min-w-0 max-w-full flex-1 flex-col transition-[margin] duration-300 ml-0",
          isCollapsed ? "lg:ml-20" : "lg:ml-64",
        )}
      >
        <Outlet />
      </div>
      <Toaster position="bottom-right" richColors closeButton duration={5000} />
        <SimDensityConfirm />
    </div>
  );
}
