import { useNavigate } from "@tanstack/react-router";
import { Pause, Play, RotateCcw } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import {
  STATUS_DOT,
  STATUS_HEX,
  STATUS_LABEL,
  TIER_HEX,
  TIER_TEXT,
  tierOf,
  type Status,
} from "@/lib/oee/config";
import type { Line, Machine } from "@/lib/oee/data";
import {
  CHAIN_GAP,
  CHAIN_ORDER_MODE,
  DEBUG_CHAIN,
  fitCameraToChain,
  createMachineLabelSprite,
  getOrderedLineMachines,
  layoutChain,
  type ChainPlacement,
} from "@/lib/oee/chainLayout";
import { J2_LINES_CONFIG } from "@/lib/oee/j2-layout-config";
import {
  createMachine,
  resolveMachineType,
  TYPE_META,
  type CreatedMachine,
  type MachineState,
} from "@/lib/oee/machineModels";
import { setupStudioLightingAndEnvironment } from "@/lib/oee/three-studio-env";
import {
  IsoMachineScene,
  type IsoMachineSceneHandle,
} from "@/components/oee/three/IsoMachineScene";
import { ISO_MODEL_OVERRIDES, isIsoModelOverridden } from "@/lib/oee/three/isoSceneConfig";
import { selectStatus, selectMetrics } from "@/lib/oee/selectors";
import { usePeriod } from "@/lib/oee/period";
import { useLiveTick } from "@/lib/oee/metrics-engine";
import { cn } from "@/lib/utils";

function mapDashboardStatus(status: Status): { state: MachineState; speedFactor: number } {
  if (status === "running") return { state: "running", speedFactor: 1.0 };
  if (status === "slow") return { state: "running", speedFactor: 0.5 };
  if (status === "down") return { state: "down", speedFactor: 0.0 };
  return { state: "idle", speedFactor: 0.0 };
}

function Bop15LineChainView({
  plantId,
  zoneId,
  line,
  className,
}: {
  plantId: string;
  zoneId: string;
  line: Line;
  className?: string;
}) {
  const navigate = useNavigate();
  const { resolved } = usePeriod();
  const tick = useLiveTick();
  void tick;

  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const sceneRef = useRef<IsoMachineSceneHandle>(null);

  useEffect(() => {
    if (DEBUG_CHAIN && typeof window !== "undefined") {
      (window as any).debugIsoLayout = () => {
        const wrapper = sceneRef.current;
        console.info("[DEBUG_ISO] Debugging layout...", {
          wrapper: wrapper,
        });
      };
    }
  }, []);

  const override = ISO_MODEL_OVERRIDES["J2:BOP15"];
  const machines = override.machines;

  const lineStatus = selectStatus(plantId, line.id);

  const getMachineStatus = React.useCallback(
    (key: string) => {
      void tick;
      const shortKey = key.replace(/^BOP15-/, "");
      return selectStatus(plantId, line.id, shortKey);
    },
    [plantId, line.id, tick],
  );

  return (
    <div className={cn("relative h-full w-full select-none overflow-hidden", className)}>
      {/* 3D Scene */}
      <IsoMachineScene
        ref={sceneRef}
        mode="chain"
        getStatus={getMachineStatus}
        animate={isPlaying}
        hoveredKey={hoveredKey}
        onHover={setHoveredKey}
        onSelect={(key) => {
          const shortKey = key.replace(/^BOP15-/, "");
          navigate({
            to: "/live/$plantId/$zoneId/$lineId/$machineId",
            params: { plantId, zoneId, lineId: line.id, machineId: shortKey },
          });
        }}
        className="h-full w-full"
      />

      {/* Interactive Machine Chips Overlay */}
      <div className="absolute inset-x-4 top-3 z-20 flex flex-wrap items-center justify-center gap-2 pointer-events-auto">
        {machines.map((m, idx) => {
          const isHovered = hoveredKey === m.key || hoveredKey === m.shortKey;
          const status = selectStatus(plantId, line.id, m.shortKey);
          const metrics = selectMetrics(plantId, "machine", m.shortKey, resolved);
          const oee = metrics?.oee ?? 75;
          const tier = tierOf(oee);

          return (
            <div key={m.key} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  navigate({
                    to: "/live/$plantId/$zoneId/$lineId/$machineId",
                    params: {
                      plantId,
                      zoneId,
                      lineId: line.id,
                      machineId: m.shortKey,
                    },
                  })
                }
                onMouseEnter={() => setHoveredKey(m.key)}
                onMouseLeave={() => setHoveredKey(null)}
                className={cn(
                  "group flex items-center gap-2 rounded-full border bg-surface/95 px-3 py-1 shadow-xs backdrop-blur-md transition-all cursor-pointer",
                  isHovered
                    ? "border-primary ring-2 ring-primary/20 scale-105"
                    : "border-border/80 hover:border-foreground/50",
                )}
                style={{
                  borderColor: isHovered ? "var(--primary)" : TIER_HEX[tier],
                }}
                title={`Click for ${m.name} telemetry`}
              >
                <span className={cn("size-2 rounded-full", STATUS_DOT[status])} />
                <span className="font-mono text-xs font-bold text-foreground">{m.shortKey}</span>
                <span
                  data-metric={`machine-${m.shortKey}-oee`}
                  data-raw={oee.toFixed(1)}
                  className={cn("font-mono text-xs font-bold", TIER_TEXT[tier])}
                >
                  {oee.toFixed(0)}%
                </span>
              </button>

              {idx < machines.length - 1 && (
                <span className="text-xs font-bold text-muted-foreground/60 select-none">→</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Toolbar: Exactly ONE line status pill + Controls + ONE hint line */}
      <div className="absolute bottom-3 inset-x-3 z-20 flex items-center justify-between pointer-events-none">
        {/* Exactly ONE status pill */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider shadow-xs backdrop-blur-md border border-border/80 bg-surface/90",
              lineStatus === "running" && "text-status-running",
              lineStatus === "slow" && "text-status-slow",
              lineStatus === "down" && "text-status-down",
              lineStatus === "idle" && "text-muted-foreground",
            )}
          >
            <span className={cn("size-2 rounded-full", STATUS_DOT[lineStatus])} />
            <span>{STATUS_LABEL[lineStatus]}</span>
          </span>
        </div>

        {/* Right side: ONE hint line + Controls */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <span className="hidden sm:inline-block text-[11px] text-muted-foreground font-sans select-none bg-surface/70 px-2 py-0.5 rounded backdrop-blur-xs">
            Scroll: zoom · Drag: pan
          </span>
          <div className="flex items-center gap-1.5 rounded-md border border-border/80 bg-surface/90 p-1 shadow-sm backdrop-blur-md">
            <button
              type="button"
              onClick={() => {
                const next = !isPlaying;
                setIsPlaying(next);
                sceneRef.current?.setAnimate(next);
              }}
              className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title={isPlaying ? "Pause Animation" : "Play Animation"}
            >
              {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => sceneRef.current?.resetView()}
              className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Reset View"
            >
              <RotateCcw className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LineChainView3D(props: {
  plantId: string;
  zoneId: string;
  line: Line;
  className?: string;
}) {
  if (isIsoModelOverridden(props.plantId, props.line.id)) {
    return <Bop15LineChainView {...props} />;
  }
  return <GenericLineChainView3D {...props} />;
}

function GenericLineChainView3D({
  plantId,
  zoneId,
  line,
  className,
}: {
  plantId: string;
  zoneId: string;
  line: Line;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredMachineId, setHoveredMachineId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [hasError, setHasError] = useState(false);
  const isPlayingRef = useRef(true);
  isPlayingRef.current = isPlaying;

  const navigate = useNavigate();

  // Find line flow direction to determine correct physical process flow order (§4.4)
  const lineConfig = useMemo(() => J2_LINES_CONFIG.find((l) => l.code === line.id), [line.id]);
  const flowDirection = lineConfig?.flowDirection ?? "left-to-right";

  // Ordered machines: flow order (left-to-right inlet to outlet) driven by CHAIN_ORDER_MODE
  const orderedMachines: Machine[] = useMemo(() => {
    return getOrderedLineMachines(line.machines, flowDirection, CHAIN_ORDER_MODE);
  }, [line.machines, flowDirection]);

  // Pure layout placements calculated from TY table
  const chainLayout = useMemo(() => {
    return layoutChain(orderedMachines, CHAIN_GAP);
  }, [orderedMachines]);

  // Keep references to active created machines for animation & status updates
  const createdMachinesRef = useRef<
    {
      machineId: string;
      machineCode: string;
      instance: CreatedMachine;
      placement: ChainPlacement<Machine>;
      hitMesh: THREE.Mesh;
    }[]
  >([]);

  const animFrameRef = useRef<number | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Camera Orbit state
  const orbitRef = useRef({
    th: 0.78, // ~45 deg azimuth
    ph: 0.55, // ~31 deg elevation
    dist: 36,
    target: new THREE.Vector3(0, 1.0, 0),
    current: new THREE.Vector3(0, 1.0, 0),
    initialDist: 36,
    initialTarget: new THREE.Vector3(0, 1.0, 0),
    minDist: 6,
    maxDist: 150,
  });

  const targetDistRef = useRef<number | null>(null);

  const focusMachine = (centerX: number, focusDist: number = 34) => {
    orbitRef.current.target.set(centerX, 1.0, 0);
    targetDistRef.current = focusDist;
  };

  const resetCamera = () => {
    orbitRef.current.th = 0.78;
    orbitRef.current.ph = 0.55;
    orbitRef.current.target.copy(orbitRef.current.initialTarget);
    targetDistRef.current = orbitRef.current.initialDist;
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
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      rendererRef.current = renderer;
    } catch (e) {
      console.warn("WebGL failed for LineChainView3D, falling back", e);
      setHasError(true);
      return;
    }

    const scene = new THREE.Scene();
    scene.name = `LineChainScene_${line.id}`;

    const aspect = Math.max(0.1, container.clientWidth / Math.max(container.clientHeight, 1));
    const camera = new THREE.PerspectiveCamera(38, aspect, 0.1, 400);

    // Studio Environment Reflections & Base Lighting Setup
    const studioLights = setupStudioLightingAndEnvironment(scene, renderer, {
      ambientIntensity: 0.6,
      directionalIntensity: 1.5,
      directionalPos: [10, 10, 10],
      fillIntensity: 0.7,
      hemiIntensity: 0.6,
    });

    // Continuous floor foundation (§4.5): exactly ONE continuous floor plate under the whole chain
    const totalLength = chainLayout.totalLength;
    const floorLength = Math.max(28, totalLength + 14);
    const floorWidth = 14;
    const floorGeo = new THREE.PlaneGeometry(floorLength, floorWidth);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x888882,
      roughness: 0.85,
      metalness: 0.1,
      transparent: true,
      opacity: 0.22,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, -0.01, 0);
    scene.add(floorMesh);

    // Grid helper covering the entire chain length
    const gridDim = Math.max(32, Math.ceil((totalLength + 16) / 4) * 4);
    const grid = new THREE.GridHelper(
      gridDim,
      Math.max(16, Math.round(gridDim / 2)),
      0x94a3b8,
      0xcbd5e1,
    );
    grid.position.y = -0.02;
    if (grid.material instanceof THREE.Material) {
      grid.material.transparent = true;
      grid.material.opacity = 0.25;
    }
    scene.add(grid);

    // Build machines row using the pure layoutChain placements (§4.3)
    const machineEntries: {
      machineId: string;
      machineCode: string;
      instance: CreatedMachine;
      placement: ChainPlacement<Machine>;
      hitMesh: THREE.Mesh;
    }[] = [];

    const labelDisposables: (() => void)[] = [];

    chainLayout.placements.forEach((placement) => {
      const m = placement.machine;
      const machineCode = m.code || m.id;

      // Build machine with per-machine floor disc disabled (§4.5)
      const instance = createMachine(placement.type, { floor: false });

      // Apply uniform scale k and position (originX, dy, dz) directly (§4.3)
      instance.group.scale.setScalar(placement.scale);
      instance.group.position.set(placement.position.x, placement.position.y, placement.position.z);

      // Set initial status
      const mapped = mapDashboardStatus(m.status);
      instance.setState(mapped.state, mapped.speedFactor);

      // Add directly to scene (no extra parent transform)
      scene.add(instance.group);

      // Invisible hit-box mesh for raycasting click/hover telemetry
      const hitGeo = new THREE.BoxGeometry(placement.length, 5.0, 4.0);
      const hitMat = new THREE.MeshBasicMaterial({
        visible: false,
        transparent: true,
        opacity: 0,
      });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.position.set(placement.labelCenterX, 2.5, 0);
      hitMesh.userData = { machineId: m.id, machineCode };
      scene.add(hitMesh);

      // Floating label sprite centered at labelCenterX above the machine (§4.7)
      const { sprite: labelSprite, dispose: disposeLabel } = createMachineLabelSprite(
        machineCode,
        placement.meta.name,
      );
      labelSprite.position.set(placement.labelCenterX, 4.8, 0);
      scene.add(labelSprite);
      labelDisposables.push(disposeLabel);

      machineEntries.push({
        machineId: m.id,
        machineCode,
        instance,
        placement,
        hitMesh,
      });

      // Temporary debug logging (§3) behind DEBUG_CHAIN
      if (DEBUG_CHAIN) {
        console.info(`[DEBUG_CHAIN] ${machineCode}:`, {
          key: m.id,
          code: machineCode,
          type: placement.type,
          k: placement.scale,
          dy: placement.meta.dy,
          dz: placement.meta.dz,
          i: placement.meta.i,
          o: placement.meta.o,
          groupPosition: instance.group.position,
          groupScale: instance.group.scale,
          inletX: placement.inletWorldX,
          outletX: placement.outletWorldX,
        });
      }
    });

    // Assert that scene contains exactly one machine group per machine (§4.8)
    const machineGroupsInScene = scene.children.filter((c) => c.name.startsWith("Machine_"));
    console.assert(
      machineGroupsInScene.length === orderedMachines.length,
      `Expected ${orderedMachines.length} machines in scene, got ${machineGroupsInScene.length}`,
    );

    createdMachinesRef.current = machineEntries;

    // Camera initial framing based on total chain length (§4.6)
    const fit = fitCameraToChain(camera, totalLength, aspect, 0.55, 0.78, 1.15);
    orbitRef.current.dist = fit.dist;
    orbitRef.current.initialDist = fit.dist;
    orbitRef.current.target.copy(fit.target);
    orbitRef.current.initialTarget.copy(fit.target);
    orbitRef.current.current.copy(fit.target);
    orbitRef.current.minDist = fit.minDist;
    orbitRef.current.maxDist = fit.maxDist;

    // Raycaster for interactive hover & click
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Controls state
    let isDragging = false;
    let dragStart = { x: 0, y: 0 };
    let hasDraggedDistance = 0;
    const activePointers = new Map<number, { x: number; y: number }>();
    let prevPinchDist = 0;

    const onPointerDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      isDragging = true;
      dragStart = { x: e.clientX, y: e.clientY };
      hasDraggedDistance = 0;
      prevPinchDist = 0;
      targetDistRef.current = null;
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      // Raycast machine hover
      raycaster.setFromCamera(mouse, camera);
      const hitMeshes = machineEntries.map((me) => me.hitMesh);
      const intersects = raycaster.intersectObjects(hitMeshes, false);

      if (intersects.length > 0) {
        const topHit = intersects[0].object;
        const mId = topHit.userData.machineId;
        if (mId) {
          setHoveredMachineId(mId);
          canvas.style.cursor = "pointer";
        }
      } else {
        if (!isDragging) {
          setHoveredMachineId(null);
          canvas.style.cursor = "grab";
        }
      }

      if (!isDragging) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      hasDraggedDistance += Math.hypot(dx, dy);
      dragStart = { x: e.clientX, y: e.clientY };

      if (activePointers.size === 2) {
        const [p1, p2] = Array.from(activePointers.values());
        const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (prevPinchDist > 0) {
          const factor = prevPinchDist / d;
          orbitRef.current.dist = Math.min(
            orbitRef.current.maxDist,
            Math.max(orbitRef.current.minDist, orbitRef.current.dist * factor),
          );
        }
        prevPinchDist = d;
        return;
      }

      if (e.shiftKey || e.button === 2) {
        // Pan
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
        orbitRef.current.target.addScaledVector(right, -dx * 0.02);
        orbitRef.current.target.addScaledVector(up, dy * 0.02);
      } else {
        // Orbit
        orbitRef.current.th -= dx * 0.007;
        orbitRef.current.ph = Math.min(1.45, Math.max(0.12, orbitRef.current.ph - dy * 0.007));
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      activePointers.delete(e.pointerId);
      if (activePointers.size === 0) {
        isDragging = false;
        canvas.style.cursor = "grab";
      }

      // If it was a clean click (not a drag), handle machine click navigation
      if (hasDraggedDistance < 6) {
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const hitMeshes = machineEntries.map((me) => me.hitMesh);
        const intersects = raycaster.intersectObjects(hitMeshes, false);

        if (intersects.length > 0) {
          const topHit = intersects[0].object;
          const mId = topHit.userData.machineId;
          if (mId) {
            navigate({
              to: "/live/$plantId/$zoneId/$lineId/$machineId",
              params: {
                plantId,
                zoneId,
                lineId: line.id,
                machineId: mId,
              },
            });
          }
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      targetDistRef.current = null;
      const zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;
      orbitRef.current.dist = Math.min(
        orbitRef.current.maxDist,
        Math.max(orbitRef.current.minDist, orbitRef.current.dist * zoomFactor),
      );
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    const onDblClick = () => resetCamera();

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", onContextMenu);
    canvas.addEventListener("dblclick", onDblClick);

    // Resize handler debounced with requestAnimationFrame to prevent ResizeObserver loop errors
    let resizeRaf: number | null = null;
    const resize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      const newAspect = w / h;
      camera.aspect = newAspect;
      camera.updateProjectionMatrix();

      // Refit camera bounds on resize (§4.6)
      const newFit = fitCameraToChain(
        camera,
        totalLength,
        newAspect,
        orbitRef.current.ph,
        orbitRef.current.th,
        1.15,
      );
      orbitRef.current.minDist = newFit.minDist;
      orbitRef.current.maxDist = newFit.maxDist;
      orbitRef.current.initialDist = newFit.dist;
    };

    const handleResize = () => {
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null;
        resize();
      });
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserverRef.current = resizeObserver;
    resizeObserver.observe(container);
    resize();

    // Render loop
    let lastTime = performance.now();
    let isVisible = true;

    const onVisibilityChange = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const loop = (now: number) => {
      animFrameRef.current = requestAnimationFrame(loop);
      if (!isVisible) return;

      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      // Update machine animations when playing
      if (isPlayingRef.current) {
        machineEntries.forEach(({ instance }) => {
          instance.update(dt);
        });
      }

      // Smooth distance easing when focusing a machine
      if (targetDistRef.current !== null) {
        orbitRef.current.dist += (targetDistRef.current - orbitRef.current.dist) * 0.08;
        if (Math.abs(targetDistRef.current - orbitRef.current.dist) < 0.1) {
          targetDistRef.current = null;
        }
      }

      // Smooth camera interpolation
      const { th, ph, dist, target, current } = orbitRef.current;
      current.lerp(target, 0.1);

      const sinPh = Math.sin(ph);
      const cosPh = Math.cos(ph);
      const sinTh = Math.sin(th);
      const cosTh = Math.cos(th);

      camera.position.set(
        current.x + dist * sinPh * sinTh,
        current.y + dist * cosPh,
        current.z + dist * sinPh * cosTh,
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
      canvas.removeEventListener("contextmenu", onContextMenu);
      canvas.removeEventListener("dblclick", onDblClick);

      // Clean up models & sprites (§4.8)
      machineEntries.forEach(({ instance }) => instance.dispose());
      labelDisposables.forEach((d) => d());
      floorGeo.dispose();
      floorMat.dispose();
      grid.geometry.dispose();
      if (grid.material instanceof THREE.Material) grid.material.dispose();
      studioLights.dispose();

      renderer.dispose();
    };
  }, [chainLayout, orderedMachines, navigate, plantId, zoneId, line.id]);

  // Live status updates without rebuilding the whole scene
  useEffect(() => {
    orderedMachines.forEach((m) => {
      const entry = createdMachinesRef.current.find((e) => e.machineId === m.id);
      if (entry) {
        const mapped = mapDashboardStatus(m.status);
        entry.instance.setState(mapped.state, mapped.speedFactor);
      }
    });
  }, [orderedMachines]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex h-full w-full min-h-[380px] flex-col overflow-hidden rounded-lg bg-surface/30 select-none",
        className,
      )}
    >
      {/* 3D Canvas with interactive controls */}
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-grab active:cursor-grabbing touch-none"
      />

      {/* Interactive Machine Chips Overlay (Driven by SAME ordered array §4.4) */}
      <div className="absolute inset-x-4 top-4 z-20 flex flex-wrap items-center justify-center gap-3 pointer-events-auto">
        {orderedMachines.map((m, idx) => {
          const isHovered = hoveredMachineId === m.id;
          const tier = tierOf(m.oee);
          const placement = chainLayout.placements[idx];

          return (
            <div key={m.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (placement) {
                    focusMachine(placement.labelCenterX, 34);
                  }
                }}
                onDoubleClick={() =>
                  navigate({
                    to: "/live/$plantId/$zoneId/$lineId/$machineId",
                    params: {
                      plantId,
                      zoneId,
                      lineId: line.id,
                      machineId: m.id,
                    },
                  })
                }
                onMouseEnter={() => setHoveredMachineId(m.id)}
                onMouseLeave={() => setHoveredMachineId(null)}
                className={cn(
                  "group flex items-center gap-2 rounded-full border bg-surface/95 px-3 py-1.5 shadow-sm backdrop-blur-md transition-all cursor-pointer",
                  isHovered
                    ? "border-primary ring-2 ring-primary/20 scale-105"
                    : "border-border/80 hover:border-foreground/50",
                )}
                style={{
                  borderColor: isHovered ? "var(--primary)" : TIER_HEX[tier],
                }}
                title={`Click to focus camera · Double-click for telemetry`}
              >
                <span className={cn("size-2 rounded-full", STATUS_DOT[m.status])} />
                <span className="font-mono text-xs font-bold text-foreground">
                  {m.code || m.id}
                </span>
                <span className={cn("font-mono text-xs font-bold", TIER_TEXT[tier])}>
                  {m.oee.toFixed(0)}%
                </span>
              </button>

              {idx < orderedMachines.length - 1 && (
                <span className="text-xs font-bold text-muted-foreground/60 select-none">→</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Floating Toolbar: Status Pill + Play/Pause & Reset Camera Controls */}
      <div className="absolute bottom-3 inset-x-3 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider shadow-xs backdrop-blur-md border border-border/80 bg-surface/90",
              line.status === "running" && "text-status-running",
              line.status === "slow" && "text-status-slow",
              line.status === "down" && "text-status-down",
              line.status === "idle" && "text-muted-foreground",
            )}
          >
            <span className={cn("size-2 rounded-full", STATUS_DOT[line.status])} />
            <span>{STATUS_LABEL[line.status]}</span>
          </span>
          {hoveredMachineId && (
            <button
              type="button"
              onClick={() =>
                navigate({
                  to: "/live/$plantId/$zoneId/$lineId/$machineId",
                  params: {
                    plantId,
                    zoneId,
                    lineId: line.id,
                    machineId: hoveredMachineId,
                  },
                })
              }
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/30 backdrop-blur-md shadow-xs hover:bg-primary/20 transition-colors cursor-pointer"
            >
              Selected: {hoveredMachineId} (Click for telemetry)
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 rounded-md border border-border/80 bg-surface/90 p-1 shadow-sm backdrop-blur-md pointer-events-auto">
          <button
            type="button"
            onClick={() => setIsPlaying((v) => !v)}
            className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            title={isPlaying ? "Pause Animation" : "Play Animation"}
          >
            {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </button>
          <button
            type="button"
            onClick={resetCamera}
            className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            title="Reset Camera View (Double click canvas)"
          >
            <RotateCcw className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Fallback View */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/80 p-6 text-center">
          <p className="text-xs text-muted-foreground">
            3D machine chain view preview unavailable. Showing telemetry.
          </p>
        </div>
      )}
    </div>
  );
}
