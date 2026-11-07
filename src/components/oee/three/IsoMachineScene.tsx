import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { IsoScene, type IsoStatus } from "@/lib/oee/three/isoScene";
import { BOP15_MACHINES, STATUS_DISPLAY_INFO } from "@/lib/oee/three/isoSceneConfig";
import { ErrorBoundary } from "@/components/oee/error-boundary";
import { useApp } from "@/lib/oee/app-context";
import { cn } from "@/lib/utils";

export type { IsoStatus };

export interface IsoMachineSceneProps {
  mode: "chain" | "machine";
  machineKey?: string;
  getStatus?: (key: string) => IsoStatus | string;
  animate?: boolean;
  hoveredKey?: string | null;
  selectedKey?: string | null;
  onHover?: (key: string | null) => void;
  onSelect?: (key: string) => void;
  className?: string;
}

export interface IsoMachineSceneHandle {
  resetView: () => void;
  setAnimate: (bool: boolean) => void;
}

/**
 * Static Fallback component rendered if WebGL fails or throws
 * Displays a flat colored card per machine in chain order with code and status color.
 */
function IsoStaticFallback({
  mode,
  machineKey,
  getStatus,
  selectedKey,
  onSelect,
}: {
  mode: "chain" | "machine";
  machineKey?: string;
  getStatus: (key: string) => string;
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
}) {
  const machines =
    mode === "chain"
      ? BOP15_MACHINES
      : BOP15_MACHINES.filter(
          (m) =>
            m.key === machineKey || m.shortKey === machineKey || m.key === `BOP15-${machineKey}`,
        );

  const displayList = machines.length > 0 ? machines : BOP15_MACHINES;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-6 bg-muted/20 text-foreground">
      <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Fallback 2D View (WebGL Disabled or Unavailable)
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 max-w-4xl">
        {displayList.map((m, idx) => {
          const rawStatus = getStatus(m.key) || "running";
          const status =
            (rawStatus.toLowerCase().replace("_", " ").trim() as IsoStatus) || "running";
          const info = STATUS_DISPLAY_INFO[status] || STATUS_DISPLAY_INFO.off;
          const isSelected = selectedKey === m.key || selectedKey === m.shortKey;

          return (
            <React.Fragment key={m.key}>
              {idx > 0 && mode === "chain" && (
                <div className="text-muted-foreground font-mono text-sm">→</div>
              )}
              <button
                type="button"
                onClick={() => onSelect?.(m.key)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border bg-card px-3.5 py-2.5 text-left shadow-xs transition-all hover:border-primary/50",
                  isSelected && "border-primary ring-2 ring-primary/20",
                )}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: info.color }}
                />
                <div>
                  <div className="font-mono text-xs font-bold text-foreground">{m.shortKey}</div>
                  <div className="text-[10px] text-muted-foreground">{info.label}</div>
                </div>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

const IsoMachineSceneInner = forwardRef<IsoMachineSceneHandle, IsoMachineSceneProps>(
  function IsoMachineSceneInner(
    {
      mode,
      machineKey,
      getStatus = () => "running",
      animate = true,
      hoveredKey,
      selectedKey,
      onHover,
      onSelect,
      className,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneInstanceRef = useRef<IsoScene | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    // Retrieve dark mode state from context
    const app = useApp();
    const isDarkMode =
      app?.isDarkMode ??
      (typeof document !== "undefined"
        ? document.documentElement.classList.contains("dark")
        : false);

    // Expose imperative handle
    useImperativeHandle(
      ref,
      () => ({
        resetView: () => {
          sceneInstanceRef.current?.resetView();
        },
        setAnimate: (bool: boolean) => {
          sceneInstanceRef.current?.setAnimate(bool);
        },
      }),
      [],
    );

    // Mount IsoScene instance once
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      let isMounted = true;
      setIsLoading(true);
      setHasError(false);

      try {
        const scene = new IsoScene({
          container,
          mode,
          machineKey,
          getStatus,
          animate,
          hoveredKey,
          selectedKey,
          onHover,
          onSelect,
          onReady: () => {
            if (isMounted) {
              setIsLoading(false);
            }
          },
          onError: (err) => {
            console.warn("[IsoMachineScene] Error initializing 3D scene, showing fallback:", err);
            if (isMounted) {
              setHasError(true);
              setIsLoading(false);
            }
          },
        });

        sceneInstanceRef.current = scene;
      } catch (err) {
        console.warn("[IsoMachineScene] Failed to create WebGL context or scene:", err);
        setHasError(true);
        setIsLoading(false);
      }

      return () => {
        isMounted = false;
        if (sceneInstanceRef.current) {
          sceneInstanceRef.current.dispose();
          sceneInstanceRef.current = null;
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update mode or machineKey when changed
    useEffect(() => {
      if (sceneInstanceRef.current) {
        sceneInstanceRef.current.setMode(mode, machineKey);
      }
    }, [mode, machineKey]);

    // Update animation state
    useEffect(() => {
      if (sceneInstanceRef.current) {
        sceneInstanceRef.current.setAnimate(animate);
      }
    }, [animate]);

    // Update status getter and stack lights without remounting
    useEffect(() => {
      if (sceneInstanceRef.current && getStatus) {
        sceneInstanceRef.current.setGetStatus(getStatus);
      }
    }, [getStatus]);

    // Update hoveredKey
    useEffect(() => {
      if (sceneInstanceRef.current) {
        sceneInstanceRef.current.setHoveredKey(hoveredKey ?? null);
      }
    }, [hoveredKey]);

    // Update selectedKey
    useEffect(() => {
      if (sceneInstanceRef.current) {
        sceneInstanceRef.current.setSelectedKey(selectedKey ?? null);
      }
    }, [selectedKey]);

    // Update floor plate color on dark mode toggle without remounting
    useEffect(() => {
      if (sceneInstanceRef.current) {
        sceneInstanceRef.current.updateTheme();
      }
    }, [isDarkMode]);

    return (
      <div
        ref={containerRef}
        className={cn("relative h-full w-full min-h-[300px] overflow-hidden", className)}
      >
        {/* Loading skeleton */}
        {isLoading && !hasError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-card/80 backdrop-blur-xs transition-opacity duration-300">
            <div className="flex items-center gap-3 text-muted-foreground text-sm font-medium">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span>Loading BOP15 3D isometric models...</span>
            </div>
            <div className="mt-4 flex gap-2">
              <div className="h-2 w-16 animate-pulse rounded-full bg-muted" />
              <div className="h-2 w-12 animate-pulse rounded-full bg-muted" />
              <div className="h-2 w-20 animate-pulse rounded-full bg-muted" />
            </div>
          </div>
        )}

        {/* Fallback card display if WebGL failed */}
        {hasError && (
          <IsoStaticFallback
            mode={mode}
            machineKey={machineKey}
            getStatus={getStatus}
            selectedKey={selectedKey}
            onSelect={onSelect}
          />
        )}
      </div>
    );
  },
);

export const IsoMachineScene = forwardRef<IsoMachineSceneHandle, IsoMachineSceneProps>(
  function IsoMachineScene(props, ref) {
    return (
      <ErrorBoundary
        fallback={
          <IsoStaticFallback
            mode={props.mode}
            machineKey={props.machineKey}
            getStatus={props.getStatus || (() => "running")}
            selectedKey={props.selectedKey}
            onSelect={props.onSelect}
          />
        }
      >
        <IsoMachineSceneInner ref={ref} {...props} />
      </ErrorBoundary>
    );
  },
);
