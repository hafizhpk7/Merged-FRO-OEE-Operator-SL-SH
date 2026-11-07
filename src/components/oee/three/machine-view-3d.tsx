import { Pause, Play, RotateCcw } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { STATUS_DOT, STATUS_LABEL, type Status } from "@/lib/oee/config";
import {
  createMachine,
  resolveMachineType,
  type CreatedMachine,
  type MachineState,
} from "@/lib/oee/machineModels";
import { setupStudioLightingAndEnvironment } from "@/lib/oee/three-studio-env";
import {
  IsoMachineScene,
  type IsoMachineSceneHandle,
} from "@/components/oee/three/IsoMachineScene";
import { isIsoMachineOverridden } from "@/lib/oee/three/isoSceneConfig";
import { useApp } from "@/lib/oee/app-context";
import { cn } from "@/lib/utils";

function mapDashboardStatus(status: Status): { state: MachineState; speedFactor: number } {
  if (status === "running") return { state: "running", speedFactor: 1.0 };
  if (status === "slow") return { state: "running", speedFactor: 0.5 };
  if (status === "down") return { state: "down", speedFactor: 0.0 };
  return { state: "idle", speedFactor: 0.0 };
}

function Bop15MachineView3D({
  machineCode,
  status,
  className,
}: {
  machineCode: string;
  status: Status;
  className?: string;
}) {
  const [isPlaying, setIsPlaying] = useState(true);
  const sceneRef = useRef<IsoMachineSceneHandle>(null);

  return (
    <div
      className={cn(
        "relative flex h-full w-full min-h-[320px] flex-col overflow-hidden rounded-lg bg-surface/50 select-none",
        className,
      )}
    >
      <IsoMachineScene
        ref={sceneRef}
        mode="machine"
        machineKey={machineCode}
        getStatus={() => status}
        animate={isPlaying}
        className="h-full w-full"
      />

      {/* Top Toolbar Controls */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            const next = !isPlaying;
            setIsPlaying(next);
            sceneRef.current?.setAnimate(next);
          }}
          className="flex items-center gap-1.5 rounded-md border border-border bg-surface/90 px-2.5 py-1 text-xs font-medium text-foreground shadow-xs backdrop-blur-md transition-colors hover:bg-muted cursor-pointer"
        >
          {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          <span>{isPlaying ? "Pause" : "Play"}</span>
        </button>
        <button
          type="button"
          onClick={() => sceneRef.current?.resetView()}
          className="flex items-center gap-1.5 rounded-md border border-border bg-surface/90 px-2.5 py-1 text-xs font-medium text-foreground shadow-xs backdrop-blur-md transition-colors hover:bg-muted cursor-pointer"
        >
          <RotateCcw className="size-3.5" />
          <span>Reset</span>
        </button>
      </div>

      {/* Bottom Status Pill */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider shadow-xs backdrop-blur-md border border-border/80 bg-surface/90",
            status === "running" && "text-status-running",
            status === "slow" && "text-status-slow",
            status === "down" && "text-status-down",
            status === "idle" && "text-muted-foreground",
          )}
        >
          <span className={cn("size-2 rounded-full", STATUS_DOT[status])} />
          <span>{STATUS_LABEL[status]}</span>
        </span>
      </div>

      {/* Bottom Interaction Hint: ONE hint line */}
      <div className="absolute bottom-3 right-3 z-10 hidden sm:block text-[11px] text-muted-foreground select-none pointer-events-none bg-surface/60 px-2 py-0.5 rounded backdrop-blur-xs">
        Scroll: zoom · Drag: pan
      </div>
    </div>
  );
}

export function MachineView3D(props: {
  machineCode: string;
  machineName?: string;
  status: Status;
  className?: string;
  plantId?: string;
  lineId?: string;
}) {
  const { plantId = "J2", lineId = "BOP15", machineCode, status, className } = props;
  if (isIsoMachineOverridden(plantId, lineId, machineCode)) {
    return <Bop15MachineView3D machineCode={machineCode} status={status} className={className} />;
  }
  return <GenericMachineView3D {...props} />;
}

function GenericMachineView3D({
  machineCode,
  machineName,
  status,
  className,
}: {
  machineCode: string;
  machineName?: string;
  status: Status;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [hasError, setHasError] = useState(false);
  const isPlayingRef = useRef(true);
  isPlayingRef.current = isPlaying;

  const { isDarkMode } = useApp();
  const machineType = resolveMachineType(machineCode);
  const machineInstanceRef = useRef<CreatedMachine | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Camera Orbit state
  const orbitRef = useRef({
    th: 0.75,
    ph: 0.45,
    dist: 22,
    target: new THREE.Vector3(0, 1.2, 0),
    current: new THREE.Vector3(0, 1.2, 0),
    minDist: 6,
    maxDist: 55,
    initialDist: 22,
    initialTarget: new THREE.Vector3(0, 1.2, 0),
  });

  const resetCamera = () => {
    orbitRef.current.th = 0.75;
    orbitRef.current.ph = 0.45;
    orbitRef.current.dist = orbitRef.current.initialDist;
    orbitRef.current.target.copy(orbitRef.current.initialTarget);
  };

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)];
    } catch (e) {
      console.warn("WebGL initialization failed for MachineView3D", e);
      setHasError(true);
      return;
    }

    const scene = new THREE.Scene();
    const aspect = container.clientWidth / Math.max(container.clientHeight, 1);
    const camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 300);

    // Studio Environment Reflections & Base Lighting Setup
    const studioLights = setupStudioLightingAndEnvironment(scene, renderer, {
      ambientIntensity: 0.6,
      directionalIntensity: 1.5,
      directionalPos: [10, 10, 10],
      fillIntensity: 0.7,
      hemiIntensity: 0.6,
    });

    // Floor grid
    const grid = new THREE.GridHelper(48, 48, 0x8894a8, 0xb8c1d0);
    grid.position.y = -0.01;
    if (grid.material instanceof THREE.Material) {
      grid.material.transparent = true;
      grid.material.opacity = 0.35;
    }
    scene.add(grid);

    // Build the machine using the single shared factory module
    let createdMachine: CreatedMachine;
    try {
      createdMachine = createMachine(machineType, { floor: true });
      scene.add(createdMachine.group);
      machineInstanceRef.current = createdMachine;

      const mapped = mapDashboardStatus(status);
      createdMachine.setState(mapped.state, mapped.speedFactor);
    } catch (err) {
      console.warn(`Failed to build 3D machine model for ${machineCode}:`, err);
      setHasError(true);
      return;
    }

    // Framing setup based on Box3
    createdMachine.group.updateMatrixWorld(true);
    const box3 = new THREE.Box3().setFromObject(createdMachine.group);
    const center = box3.getCenter(new THREE.Vector3());
    const size = box3.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 6);

    const initialDist = Math.max(16, maxDim * 1.4);
    orbitRef.current.target.set(center.x, Math.max(center.y, 1.2), center.z);
    orbitRef.current.current.copy(orbitRef.current.target);
    orbitRef.current.initialTarget.copy(orbitRef.current.target);
    orbitRef.current.dist = initialDist;
    orbitRef.current.initialDist = initialDist;
    orbitRef.current.minDist = Math.max(5, maxDim * 0.35);
    orbitRef.current.maxDist = Math.max(50, maxDim * 3.5);

    // Pointer controls (Orbit, Pan, Zoom)
    let isDragging = false;
    let dragStart = { x: 0, y: 0 };
    const activePointers = new Map<number, { x: number; y: number }>();
    let prevPinchDist = 0;

    const onPointerDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      isDragging = true;
      dragStart = { x: e.clientX, y: e.clientY };
      prevPinchDist = 0;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // 2-finger pinch zoom
      if (activePointers.size === 2) {
        const [p1, p2] = Array.from(activePointers.values());
        const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (prevPinchDist > 0) {
          const factor = prevPinchDist / d;
          orbitRef.current.dist = THREE.MathUtils.clamp(
            orbitRef.current.dist * factor,
            orbitRef.current.minDist,
            orbitRef.current.maxDist,
          );
        }
        prevPinchDist = d;
        return;
      }

      if (!isDragging) return;
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      dragStart = { x: e.clientX, y: e.clientY };

      // Shift+drag or right-mouse = pan
      if (e.shiftKey || e.button === 2) {
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
        const panSpeed = 0.02 * (orbitRef.current.dist / 30);
        orbitRef.current.target.addScaledVector(right, -dx * panSpeed);
        orbitRef.current.target.y += dy * panSpeed;
      } else {
        // Left-drag = rotate
        orbitRef.current.th -= dx * 0.006;
        orbitRef.current.ph = THREE.MathUtils.clamp(
          orbitRef.current.ph - dy * 0.006,
          0.12,
          Math.PI / 2 - 0.05,
        );
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      activePointers.delete(e.pointerId);
      if (activePointers.size === 0) {
        isDragging = false;
        prevPinchDist = 0;
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = 1 + e.deltaY * 0.001;
      orbitRef.current.dist = THREE.MathUtils.clamp(
        orbitRef.current.dist * zoomFactor,
        orbitRef.current.minDist,
        orbitRef.current.maxDist,
      );
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    // Responsive resize with requestAnimationFrame debounce
    let resizeRaf: number | null = null;
    const handleResize = () => {
      if (!container || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };

    const onResize = () => {
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null;
        handleResize();
      });
    };

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);
    handleResize();

    // Render loop
    let lastTime = performance.now();
    let isTabVisible = !document.hidden;

    const onVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (isTabVisible) lastTime = performance.now();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const loop = (now: number) => {
      animFrameRef.current = requestAnimationFrame(loop);
      if (!isTabVisible) return;

      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      if (isPlayingRef.current && createdMachine) {
        createdMachine.update(dt);
      }

      // Smooth camera interpolation
      orbitRef.current.current.lerp(orbitRef.current.target, 0.08);

      const { th, ph, dist, current } = orbitRef.current;
      camera.position.set(
        current.x + dist * Math.sin(ph) * Math.sin(th),
        current.y + dist * Math.cos(ph),
        current.z + dist * Math.sin(ph) * Math.cos(th),
      );
      camera.lookAt(current);

      renderer.render(scene, camera);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);

      createdMachine.dispose();
      studioLights.dispose();
      renderer.dispose();
    };
  }, [machineCode, machineType, status]);

  // Live status updates
  useEffect(() => {
    if (machineInstanceRef.current) {
      const mapped = mapDashboardStatus(status);
      machineInstanceRef.current.setState(mapped.state, mapped.speedFactor);
    }
  }, [status]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex h-full w-full min-h-[420px] flex-col overflow-hidden rounded-lg bg-surface/50 select-none",
        className,
      )}
    >
      {/* 3D Canvas */}
      <canvas
        ref={canvasRef}
        className="h-full w-full touch-none cursor-grab active:cursor-grabbing"
      />

      {/* Fallback View if WebGL fails */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/80 p-6 text-center">
          <div className="size-16 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold text-xl">
            {machineCode}
          </div>
          <p className="text-xs text-muted-foreground">
            3D rendering preview unavailable. Showing fallback telemetry.
          </p>
        </div>
      )}

      {/* Top Toolbar Controls */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsPlaying(!isPlaying)}
          className="flex items-center gap-1.5 rounded-md border border-border bg-surface/90 px-2.5 py-1 text-xs font-medium text-foreground shadow-xs backdrop-blur-md transition-colors hover:bg-muted cursor-pointer"
        >
          {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          <span>{isPlaying ? "Pause" : "Play"}</span>
        </button>
        <button
          type="button"
          onClick={resetCamera}
          className="flex items-center gap-1.5 rounded-md border border-border bg-surface/90 px-2.5 py-1 text-xs font-medium text-foreground shadow-xs backdrop-blur-md transition-colors hover:bg-muted cursor-pointer"
        >
          <RotateCcw className="size-3.5" />
          <span>Reset</span>
        </button>
      </div>

      {/* Bottom Status Pill */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider shadow-xs backdrop-blur-md border border-border/80 bg-surface/90",
            status === "running" && "text-status-running",
            status === "slow" && "text-status-slow",
            status === "down" && "text-status-down",
            status === "idle" && "text-muted-foreground",
          )}
        >
          <span className={cn("size-2 rounded-full", STATUS_DOT[status])} />
          <span>{STATUS_LABEL[status]}</span>
        </span>
      </div>

      {/* Bottom Interaction Hint */}
      <div className="absolute bottom-3 right-3 z-10 hidden sm:block text-[11px] text-muted-foreground select-none pointer-events-none bg-surface/60 px-2 py-0.5 rounded backdrop-blur-xs">
        Drag: rotate · Scroll: zoom · Shift+drag: pan
      </div>
    </div>
  );
}
