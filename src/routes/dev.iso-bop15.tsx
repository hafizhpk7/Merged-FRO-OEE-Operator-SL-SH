import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import {
  IsoMachineScene,
  type IsoMachineSceneHandle,
  type IsoStatus,
} from "@/components/oee/three/IsoMachineScene";
import { BOP15_MACHINES, STATUS_DISPLAY_INFO, DEBUG_ISO } from "@/lib/oee/three/isoSceneConfig";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dev/iso-bop15")({
  head: () => ({
    meta: [
      { title: "BOP15 — Isometric Animated Machines (Dev Demo)" },
      {
        name: "description",
        content: "Dev demo route for Plant J2 / Line BOP15 isometric 3D animated machines.",
      },
    ],
  }),
  component: DevIsoBop15Page,
});

const STATUS_OPTIONS: IsoStatus[] = ["running", "slow", "minor stop", "down", "off"];

function DevIsoBop15Page() {
  const [view, setView] = useState<string>("chain"); // 'chain' | 'BOP15-LBF15-3' | etc.
  const [selectedMachine, setSelectedMachine] = useState<string>("BOP15-LBF15-2");
  const [hoveredMachine, setHoveredMachine] = useState<string | null>(null);
  const [animate, setAnimate] = useState<boolean>(true);

  // Machine statuses dictionary
  const [statuses, setStatuses] = useState<Record<string, IsoStatus>>({
    "BOP15-LBF15-3": "down",
    "BOP15-LBF15-2": "running",
    "BOP15-LBF15-1": "running",
    "BOP15-LBC": "slow",
    "BOP15-LCM": "running",
  });

  const sceneRef = useRef<IsoMachineSceneHandle>(null);

  const getStatus = useCallback(
    (key: string): IsoStatus => {
      const canonical = key.startsWith("BOP15-") ? key : `BOP15-${key}`;
      return statuses[canonical] || statuses[key] || "running";
    },
    [statuses],
  );

  const handleStatusChange = (status: IsoStatus) => {
    setStatuses((prev) => ({
      ...prev,
      [selectedMachine]: status,
    }));
  };

  const selectedShortKey =
    BOP15_MACHINES.find((m) => m.key === selectedMachine)?.shortKey || selectedMachine;

  // Derive aggregate line status
  const getLineStatus = (): IsoStatus => {
    const priority: IsoStatus[] = ["down", "slow", "minor stop", "running", "off"];
    for (const st of priority) {
      if (BOP15_MACHINES.some((m) => statuses[m.key] === st)) return st;
    }
    return "off";
  };

  const currentDisplayStatus = view === "chain" ? getLineStatus() : getStatus(view);
  const statusInfo = STATUS_DISPLAY_INFO[currentDisplayStatus] || STATUS_DISPLAY_INFO.off;

  if (!DEBUG_ISO) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
        <h1 className="text-xl font-bold">Dev Demo Disabled</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This route is restricted to development builds.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 text-foreground">
      <div className="mb-4">
        <h1 className="text-xl font-bold tracking-tight">BOP15 - isometric machines</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Isometric scene (with an animation toggle) built from the BOP15 machine models, with
          connecting conveyors and a status stack light per machine. Pick a view and set a status to
          see the stack light.
        </p>
      </div>

      {/* View Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2.5" role="group" aria-label="View">
        <button
          type="button"
          onClick={() => {
            setView("chain");
          }}
          aria-pressed={view === "chain"}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors bg-card",
            view === "chain"
              ? "border-[#378ADD] text-[#378ADD] font-bold shadow-xs ring-1 ring-[#378ADD]/30"
              : "border-border text-foreground hover:bg-muted/50",
          )}
        >
          Machine chain
        </button>
        {BOP15_MACHINES.map((m) => {
          const isCurrentView = view === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => {
                setView(m.key);
                setSelectedMachine(m.key);
              }}
              aria-pressed={isCurrentView}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors bg-card",
                isCurrentView
                  ? "border-[#378ADD] text-[#378ADD] font-bold shadow-xs ring-1 ring-[#378ADD]/30"
                  : "border-border text-foreground hover:bg-muted/50",
              )}
            >
              {m.shortKey}
            </button>
          );
        })}
      </div>

      {/* Status Buttons for selected machine */}
      <div
        className="flex flex-wrap items-center gap-1.5 mb-3"
        role="group"
        aria-label="Status of selected machine"
      >
        <span className="text-xs text-muted-foreground mr-1">
          Status of <strong className="text-foreground">{selectedShortKey}</strong>:
        </span>
        {STATUS_OPTIONS.map((st) => {
          const isCurrentStatus = statuses[selectedMachine] === st;
          return (
            <button
              key={st}
              type="button"
              onClick={() => handleStatusChange(st)}
              aria-pressed={isCurrentStatus}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs font-semibold uppercase tracking-wider transition-colors bg-card",
                isCurrentStatus
                  ? "border-[#378ADD] text-[#378ADD] ring-1 ring-[#378ADD]/30"
                  : "border-border text-foreground hover:bg-muted/50",
              )}
            >
              {st}
            </button>
          );
        })}
      </div>

      {/* Card container */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {/* Machine chain pills */}
        {view === "chain" && (
          <div className="flex flex-wrap items-center justify-center gap-2 border-b border-border/50 bg-muted/15 px-4 py-2.5">
            {BOP15_MACHINES.map((m, idx) => {
              const machineStatus = statuses[m.key] || "running";
              const info = STATUS_DISPLAY_INFO[machineStatus] || STATUS_DISPLAY_INFO.off;
              const isSelected = selectedMachine === m.key;

              return (
                <div key={m.key} className="flex items-center gap-2">
                  {idx > 0 && <span className="text-muted-foreground text-xs font-mono">→</span>}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMachine(m.key);
                    }}
                    onMouseEnter={() => setHoveredMachine(m.key)}
                    onMouseLeave={() => setHoveredMachine(null)}
                    aria-pressed={isSelected}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs font-bold transition-all bg-card",
                      isSelected
                        ? "border-[#378ADD] shadow-xs ring-2 ring-[#378ADD]/20"
                        : "border-border hover:border-foreground/40",
                    )}
                    style={{ borderColor: isSelected ? "#378ADD" : info.color }}
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: info.color }}
                    />
                    <span>{m.shortKey}</span>
                    <span
                      className={cn(
                        "text-[11px]",
                        m.defaultOee < 70 ? "text-[#d93838]" : "text-[#1fa35c]",
                      )}
                    >
                      {m.defaultOee}%
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* 3D Scene Viewport */}
        <div className="relative h-[480px] w-full">
          <IsoMachineScene
            ref={sceneRef}
            mode={view === "chain" ? "chain" : "machine"}
            machineKey={view === "chain" ? selectedMachine : view}
            getStatus={getStatus}
            animate={animate}
            hoveredKey={hoveredMachine}
            selectedKey={selectedMachine}
            onHover={setHoveredMachine}
            onSelect={(key) => {
              setSelectedMachine(key);
            }}
            className="h-full w-full"
          />

          {/* Status badge chip in bottom-left */}
          <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-full border border-border bg-card/90 px-3 py-1 font-mono text-xs font-bold backdrop-blur-xs shadow-xs">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusInfo.color }} />
            <span style={{ color: statusInfo.color }}>{statusInfo.label}</span>
          </div>

          {/* Hint in bottom-right */}
          <div className="absolute bottom-3 right-3 z-10 pointer-events-none text-[11px] text-muted-foreground bg-card/70 px-2 py-0.5 rounded backdrop-blur-xs">
            Scroll: zoom · Drag: pan
          </div>

          {/* Controls in top-right */}
          <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const next = !animate;
                setAnimate(next);
                sceneRef.current?.setAnimate(next);
              }}
              aria-pressed={animate}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium backdrop-blur-xs shadow-xs transition-colors bg-card/90",
                animate ? "border-[#378ADD] text-[#378ADD]" : "border-border text-foreground",
              )}
            >
              Animation: {animate ? "On" : "Off"}
            </button>
            <button
              type="button"
              onClick={() => {
                sceneRef.current?.resetView();
              }}
              className="rounded-md border border-border bg-card/90 px-2.5 py-1 text-xs font-medium backdrop-blur-xs shadow-xs hover:bg-muted/70 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
export default DevIsoBop15Page;
