import React, { useEffect, useRef } from "react";
import * as THREE from "three";

import { STATUS_HEX } from "@/lib/oee/config";
import type { Zone } from "@/lib/oee/data";
import { J2_LINES_CONFIG, MACHINE_GAP, type J2LineConfig } from "@/lib/oee/j2-layout-config";
import {
  CELL_SIZE_ZONE,
  MAX_ANIMATED_MACHINES,
  buildMachineModel,
  resolveModelKey,
  type ModelInstance,
} from "@/lib/oee/models";
import { setupStudioLightingAndEnvironment } from "@/lib/oee/three-studio-env";
import { createBop15ChainGroup } from "@/lib/oee/three/bop15Models";
import { selectStatus } from "@/lib/oee/selectors";

export function J2ZoneCanvas3D({
  zone,
  hoveredLineCode,
  hoveredMachineCode,
  onHoverMachine,
  onLeaveMachine,
  onClickMachine,
}: {
  zone: Zone;
  hoveredLineCode?: string | null;
  hoveredMachineCode?: string | null;
  onHoverMachine?: (
    lineCode: string,
    machineCode: string,
    clientX: number,
    clientY: number,
  ) => void;
  onLeaveMachine?: () => void;
  onClickMachine?: (lineCode: string, machineCode: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const modelInstancesRef = useRef<
    Map<string, { instance: any; plateMesh?: THREE.Mesh; lineCode: string; machineCode: string }>
  >(new Map());
  const animFrameRef = useRef<number | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  const linesForZone = J2_LINES_CONFIG.filter((l) => l.zoneId === zone.id);

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
      rendererRef.current = renderer;
    } catch (e) {
      console.warn("WebGL initialization failed for J2ZoneCanvas3D", e);
      return;
    }

    const scene = new THREE.Scene();
    const aspect = container.clientWidth / Math.max(container.clientHeight, 1);
    const camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 300);

    // Studio Environment Reflections & Base Lighting Setup
    const studioLights = setupStudioLightingAndEnvironment(scene, renderer, {
      ambientIntensity: 0.65,
      directionalIntensity: 1.5,
      directionalPos: [16, 26, 20],
      fillIntensity: 0.7,
      hemiIntensity: 0.6,
    });

    // Zone Ground Floor Plate
    const groundGeo = new THREE.BoxGeometry(40, 0.08, 48);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.85,
      metalness: 0.05,
      transparent: true,
      opacity: 0.5,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.set(0, -0.06, 0);
    scene.add(ground);

    // Camera target
    camera.position.set(24, 32, 36);
    camera.lookAt(0, 0, 0);

    // Build machines for this zone
    const instances = new Map<
      string,
      { instance: any; plateMesh?: THREE.Mesh; lineCode: string; machineCode: string }
    >();

    linesForZone.forEach((lineCfg) => {
      const isRtl = lineCfg.flowDirection === "right-to-left";

      if (lineCfg.code === "BOP15") {
        const bop15Group = createBop15ChainGroup((key) => selectStatus("J2", "BOP15", key));
        const bx = lineCfg.zoneViewLayout.x * 1.6 - 12;
        const bz = lineCfg.zoneViewLayout.y * 1.6 - 18;
        bop15Group.position.set(bx, 0, bz);
        if (isRtl) bop15Group.rotation.y = Math.PI;
        scene.add(bop15Group);
        instances.set("BOP15-CHAIN", { instance: bop15Group, lineCode: "BOP15", machineCode: "" });
        return;
      }

      const lineData = zone.lines.find((l) => l.id === lineCfg.code);

      lineCfg.machines.forEach((mCfg, mIdx) => {
        const uniqueKey = `${lineCfg.code}-${mCfg.code}-${mIdx}`;
        const modelKey = resolveModelKey(mCfg.code);
        const machineData = lineData?.machines.find(
          (m) => m.id === mCfg.code || m.code === mCfg.code,
        );
        const status = machineData?.status ?? "running";

        try {
          const modelInst =
            lineCfg.code === "BOP15"
              ? createBop15ModelInstance(mCfg.type ?? "LBF", status)
              : buildMachineModel(modelKey, {
                  lod: 1,
                  seed: mIdx * 60 + 23,
                  status,
                });

          // Normalize scale
          const bounds = modelInst.getBounds();
          const sizeX = Math.max(0.1, bounds.max.x - bounds.min.x);
          const sizeZ = Math.max(0.1, bounds.max.z - bounds.min.z);
          const maxDim = Math.max(sizeX, sizeZ);
          const scaleFactor = Math.min(
            1.0,
            (CELL_SIZE_ZONE * (lineCfg.code === "BOP15" ? 0.6 : 0.72)) / maxDim,
          );
          modelInst.group.scale.setScalar(scaleFactor);

          // Position
          const bx = (lineCfg.zoneViewLayout.x + (mCfg.offsetX ?? mIdx * MACHINE_GAP)) * 1.6 - 12;
          let bz = (lineCfg.zoneViewLayout.y + (mCfg.offsetY ?? 0)) * 1.6 - 18;
          if (mCfg.subRow === "top") bz -= 1.2;

          modelInst.group.position.set(bx, 0, bz);

          // Flow orientation
          if (isRtl) {
            modelInst.group.rotation.y = Math.PI;
          }

          // Status base plate (machine status color)
          const plateGeo = new THREE.BoxGeometry(
            CELL_SIZE_ZONE * 0.85,
            0.06,
            CELL_SIZE_ZONE * 0.85,
          );
          const plateMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(STATUS_HEX[status]),
            roughness: 0.5,
            metalness: 0.2,
            transparent: true,
            opacity: 0.85,
          });
          const plate = new THREE.Mesh(plateGeo, plateMat);
          plate.position.set(bx, -0.03, bz);
          plate.userData = { lineCode: lineCfg.code, machineCode: mCfg.code };
          scene.add(plate);

          scene.add(modelInst.group);
          instances.set(uniqueKey, {
            instance: modelInst,
            plateMesh: plate,
            lineCode: lineCfg.code,
            machineCode: mCfg.code,
          });
        } catch (err) {
          console.warn(`Error building model for ${mCfg.code}:`, err);
        }
      });
    });

    modelInstancesRef.current = instances;

    // Raycast for hover/click
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      let found = false;
      for (const hit of intersects) {
        let cur: THREE.Object3D | null = hit.object;
        while (cur && cur !== scene) {
          if (cur.userData && cur.userData.lineCode) {
            onHoverMachine?.(cur.userData.lineCode, cur.userData.machineCode, e.clientX, e.clientY);
            found = true;
            break;
          }
          cur = cur.parent;
        }
        if (found) break;
      }
      if (!found) {
        onLeaveMachine?.();
      }
    };

    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      for (const hit of intersects) {
        let cur: THREE.Object3D | null = hit.object;
        while (cur && cur !== scene) {
          if (cur.userData && cur.userData.lineCode) {
            onClickMachine?.(cur.userData.lineCode, cur.userData.machineCode);
            return;
          }
          cur = cur.parent;
        }
      }
    };

    canvas.addEventListener("mousemove", onPointerMove);
    canvas.addEventListener("click", onClick);

    // Resize Handler with requestAnimationFrame debounce
    let resizeRaf: number | null = null;
    const resize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };

    const handleResize = () => {
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null;
        resize();
      });
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    resize();

    // Render loop with MAX_ANIMATED_MACHINES cap
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

      let animatedCount = 0;
      instances.forEach(({ instance, lineCode }) => {
        // Simple update: if it has an update method (ModelInstance), call it.
        // If it's the BOP15 group, we need to update lamps.
        if (instance.update) {
          const isLineHovered = hoveredLineCode === lineCode;
          if (isLineHovered || animatedCount < MAX_ANIMATED_MACHINES) {
            instance.update(dt, now / 1000);
            animatedCount++;
          }
        } else if (instance.userData?.registry) {
          // BOP15 group: update lamps based on status
          instance.userData.registry.forEach((entry: any) => {
            const status = selectStatus("J2", "BOP15", entry.key.replace("BOP15-", ""));
            const pattern = [0, 0, 0]; // simplified lamp pattern
            if (status === "running") pattern[2] = 1;
            else if (status === "slow") {
              pattern[1] = 1;
              pattern[2] = 1;
            } else if (status === "down") pattern[0] = 1;

            entry.lamps.forEach((mat: THREE.MeshBasicMaterial, i: number) => {
              mat.color.set(pattern[i] ? [0xe24b4a, 0xf5a623, 0x2ecc71][i] : 0x222222);
            });
          });
        }
      });

      renderer.render(scene, camera);
    };
    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      resizeObserver.disconnect();
      canvas.removeEventListener("mousemove", onPointerMove);
      canvas.removeEventListener("click", onClick);

      instances.forEach(({ instance }) => {
        if (instance.dispose) instance.dispose();
        else if (instance.children) {
          // Dispose BOP15 group
          instance.traverse((child: any) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) child.material.forEach((m: any) => m.dispose());
              else child.material.dispose();
            }
          });
        }
      });
      studioLights.dispose();
      renderer.dispose();
    };
  }, [zone, linesForZone, onClickMachine, onHoverMachine, onLeaveMachine, hoveredLineCode]);

  return (
    <div ref={containerRef} className="absolute inset-0 h-full w-full overflow-hidden">
      <canvas ref={canvasRef} className="h-full w-full touch-none cursor-pointer" />
    </div>
  );
}
