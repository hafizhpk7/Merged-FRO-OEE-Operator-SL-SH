import React, { useEffect, useRef } from "react";
import * as THREE from "three";

import { TIER_HEX, tierOf } from "@/lib/oee/config";
import type { Plant } from "@/lib/oee/data";
import { J2_LINES_CONFIG, J2_ZONE_FOOTPRINTS, PLANT_MACHINE_GAP } from "@/lib/oee/j2-layout-config";
import {
  CELL_SIZE_PLANT,
  buildMachineModel,
  resolveModelKey,
  type ModelInstance,
} from "@/lib/oee/models";
import { setupStudioLightingAndEnvironment } from "@/lib/oee/three-studio-env";
import { createBop15ModelInstance } from "@/lib/oee/models/bop15Adapter";

export function J2PlantCanvas3D({
  plant,
  hoveredZoneId,
  hoveredLineCode,
  hoveredMachineCode,
  onHoverMachine,
  onLeaveMachine,
  onClickZone,
}: {
  plant: Plant;
  hoveredZoneId?: string | null;
  hoveredLineCode?: string | null;
  hoveredMachineCode?: string | null;
  onHoverMachine?: (
    lineCode: string,
    machineCode: string,
    clientX: number,
    clientY: number,
  ) => void;
  onLeaveMachine?: () => void;
  onClickZone?: (zoneId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const modelInstancesRef = useRef<Map<string, { instance: any; plateMesh: THREE.Mesh }>>(
    new Map(),
  );
  const animFrameRef = useRef<number | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Map of line/machine OEE
  const lineOeeMap = useRef<Map<string, number>>(new Map());
  plant.zones.forEach((z) => {
    z.lines.forEach((l) => {
      lineOeeMap.current.set(l.id, l.oee);
    });
  });

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
      console.warn("WebGL initialization failed for J2PlantCanvas3D", e);
      return;
    }

    const scene = new THREE.Scene();
    const aspect = container.clientWidth / Math.max(container.clientHeight, 1);
    const camera = new THREE.PerspectiveCamera(36, aspect, 0.1, 300);

    // Studio Environment Reflections & Base Lighting Setup
    const studioLights = setupStudioLightingAndEnvironment(scene, renderer, {
      ambientIntensity: 0.65,
      directionalIntensity: 1.5,
      directionalPos: [16, 26, 20],
      fillIntensity: 0.7,
      hemiIntensity: 0.6,
    });

    // Camera preset for high-fidelity plant overview
    camera.position.set(28, 38, 48);
    camera.lookAt(8, 0, 8);

    // 1. Zone Ground Plates
    const zoneMats: Record<string, THREE.MeshStandardMaterial> = {};
    (["A", "B", "C"] as const).forEach((zId) => {
      const fp = J2_ZONE_FOOTPRINTS[zId];
      const shape = new THREE.Shape();
      fp.polygon.forEach((pt, idx) => {
        // Map 2D footprint to 3D X/Z
        const px = pt.x * 1.5 - 10;
        const pz = pt.y * 1.5 - 12;
        if (idx === 0) shape.moveTo(px, pz);
        else shape.lineTo(px, pz);
      });
      shape.closePath();

      const geom = new THREE.ShapeGeometry(shape);
      geom.rotateX(Math.PI / 2);

      const mat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.8,
        metalness: 0.1,
        transparent: true,
        opacity: 0.65,
      });
      zoneMats[zId] = mat;

      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.y = -0.05;
      mesh.userData = { zoneId: zId };
      scene.add(mesh);
    });

    // 2. Build 106 Machine Models at LOD 0
    const instances = new Map<string, { instance: ModelInstance; plateMesh: THREE.Mesh }>();

    J2_LINES_CONFIG.forEach((lineCfg) => {
      const isRtl = lineCfg.flowDirection === "right-to-left";

      if (lineCfg.code === "BOP15") {
        const bop15Group = createBop15ChainGroup((key) => "running");
        const bx = lineCfg.layout.x * 1.5 - 10;
        const bz = lineCfg.layout.y * 1.5 - 12;
        bop15Group.position.set(bx, 0, bz);
        if (isRtl) bop15Group.rotation.y = Math.PI;
        scene.add(bop15Group);
        // Add hit proxy for BOP15 chain to instances for interaction
        instances.set("BOP15-CHAIN", { instance: bop15Group, plateMesh: new THREE.Mesh() });
        return;
      }

      const lineOee = lineOeeMap.current.get(lineCfg.code) ?? 65;
      const plateColor = TIER_HEX[tierOf(lineOee)];

      lineCfg.machines.forEach((mCfg, mIdx) => {
        const uniqueKey = `${lineCfg.code}-${mCfg.code}-${mIdx}`;
        const modelKey = resolveModelKey(mCfg.code);

        try {
          const modelInst = buildMachineModel(modelKey, {
            lod: 0,
            seed: mIdx * 50 + 13,
            status: "running",
          });

          // Normalize size
          const bounds = modelInst.getBounds();
          const sizeX = Math.max(0.1, bounds.max.x - bounds.min.x);
          const sizeZ = Math.max(0.1, bounds.max.z - bounds.min.z);
          const maxDim = Math.max(sizeX, sizeZ);
          const scaleFactor = Math.min(1.0, (CELL_SIZE_PLANT * 0.75) / maxDim);
          modelInst.group.scale.setScalar(scaleFactor);

          // Position in Plant coordinate space
          const bx = (lineCfg.layout.x + (mCfg.offsetX ?? mIdx * PLANT_MACHINE_GAP)) * 1.5 - 10;
          let bz = (lineCfg.layout.y + (mCfg.offsetY ?? 0)) * 1.5 - 12;
          if (mCfg.subRow === "top") bz -= 1.0;

          modelInst.group.position.set(bx, 0, bz);

          // Flow orientation
          if (isRtl) {
            modelInst.group.rotation.y = Math.PI;
          }

          // Status base plate (OEE colored)
          const plateGeo = new THREE.BoxGeometry(
            CELL_SIZE_PLANT * 0.85,
            0.05,
            CELL_SIZE_PLANT * 0.85,
          );
          const plateMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(plateColor),
            roughness: 0.5,
            metalness: 0.2,
            transparent: true,
            opacity: 0.85,
          });
          const plate = new THREE.Mesh(plateGeo, plateMat);
          plate.position.set(bx, -0.02, bz);
          plate.userData = {
            lineCode: lineCfg.code,
            machineCode: mCfg.code,
            zoneId: lineCfg.zoneId,
          };
          scene.add(plate);

          scene.add(modelInst.group);
          instances.set(uniqueKey, { instance: modelInst, plateMesh: plate });
        } catch (err) {
          console.warn(`Error instantiating model ${mCfg.code}:`, err);
        }
      });
    });

    modelInstancesRef.current = instances;

    // Pointer Raycasting for clicks & hover
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
          if (cur.userData && cur.userData.zoneId) {
            onClickZone?.(cur.userData.zoneId);
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

    // Render loop (LOD 0 is static, render on demand / slow tick)
    let isVisible = true;
    const onVisibilityChange = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const loop = () => {
      animFrameRef.current = requestAnimationFrame(loop);
      if (!isVisible) return;
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

      instances.forEach(({ instance }) => instance.dispose());
      studioLights.dispose();
      renderer.dispose();
    };
  }, [plant, onClickZone, onHoverMachine, onLeaveMachine]);

  // Update dimming & highlights dynamically based on hover
  useEffect(() => {
    modelInstancesRef.current.forEach(({ instance, plateMesh }, key) => {
      const [lineCode, machineCode] = key.split("-");
      const isLineHovered = hoveredLineCode === lineCode;
      const isMachineHovered = hoveredMachineCode === machineCode && isLineHovered;

      if (plateMesh.material instanceof THREE.MeshStandardMaterial) {
        plateMesh.material.opacity = isMachineHovered ? 1.0 : isLineHovered ? 0.9 : 0.7;
        plateMesh.material.emissive.setHex(isMachineHovered ? 0xffffff : 0x000000);
        plateMesh.material.emissiveIntensity = isMachineHovered ? 0.3 : 0.0;
      }
    });
  }, [hoveredLineCode, hoveredMachineCode, hoveredZoneId]);

  return (
    <div ref={containerRef} className="absolute inset-0 h-full w-full overflow-hidden">
      <canvas ref={canvasRef} className="h-full w-full touch-none cursor-pointer" />
    </div>
  );
}
