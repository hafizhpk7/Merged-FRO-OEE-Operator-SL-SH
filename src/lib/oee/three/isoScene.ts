import * as THREE from "three";
import {
  BOP15_MACHINES,
  CONV_Y,
  PAL,
  LBF15,
  LBC,
  LCM,
  conveyor,
  single,
  place,
  hideStatic,
  LAMP_COLORS,
  STATUS_LAMP_MAP,
  STATUS_FACTOR_MAP,
  type MachineType,
  type StackLightMesh,
} from "./isoSceneConfig";

export { BOP15_MACHINES, type IsoStatus, type MachineType } from "./isoSceneConfig";

export interface IsoSceneOptions {
  container: HTMLElement;
  mode: "chain" | "machine";
  machineKey?: string;
  getStatus?: (key: string) => string;
  animate?: boolean;
  hoveredKey?: string | null;
  selectedKey?: string | null;
  onHover?: (key: string | null) => void;
  onSelect?: (key: string) => void;
  onReady?: () => void;
  onError?: (err: Error) => void;
}

interface MachineRegistryEntry {
  group: THREE.Group;
  proxy: THREE.Mesh;
  outline: THREE.LineSegments;
  lamps: THREE.MeshBasicMaterial[];
  type: MachineType;
  key: string;
}

interface FlowSegment {
  machineKey: string | null;
  start: number;
  end: number;
}

interface FlowProduct {
  x: number;
  group: THREE.Group;
  bottle: THREE.Group;
  carton: THREE.Mesh;
}

interface MovingPart {
  machineKey: string;
  mesh: THREE.Mesh;
  axis: "x" | "y" | "z";
  base: number;
  amplitude: number;
  speed: number;
  phase: number;
}

interface FlowState {
  segments: FlowSegment[];
  products: FlowProduct[];
  movingParts: MovingPart[];
  start: number;
  end: number;
  cartonStart: number;
}

/** Named constants */
export const GAP = 0.7;
export const ISO_AZ_DEG = 40;
export const ISO_EL_DEG = 26;
export const FLOW_SPEED = 0.45;
export const PRODUCT_SPACING = 0.5;
export const MIN_QUEUE_GAP = 0.22;

export const ISO_CAMERA_PRESETS = {
  files: { az: 40, el: 26 },
  front_biased: { az: 30, el: 30 },
  classic: { az: 45, el: 35.264 },
} as const;

export class IsoScene {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private rootGroup: THREE.Group;
  private floorPlate: THREE.Mesh | null = null;

  private mode: "chain" | "machine";
  private machineKey: string;
  private getStatusFn: (key: string) => string;
  private animateEnabled: boolean;
  private hoveredKey: string | null = null;
  private selectedKey: string | null = null;

  private onHoverCallback?: (key: string | null) => void;
  private onSelectCallback?: (key: string) => void;
  private onReadyCallback?: () => void;
  private onErrorCallback?: (err: Error) => void;

  private registry: Record<string, MachineRegistryEntry> = {};
  private flow: FlowState | null = null;

  // Viewport & camera fit
  private zoom = 1;
  private pan = { x: 0, y: 0 };
  private viewExtents = { cx: 0, cy: 0, hw: 1, hh: 1 };
  private unitsPerPixel = 0.01;
  private width = 800;
  private height = 400;

  // Interaction
  private raycaster = new THREE.Raycaster();
  private pointerDrag: { x: number; y: number } | null = null;
  private dragMovedDistance = 0;

  // Loop & visibility
  private isVisible = true;
  private isTabVisible = true;
  private animationFrameId: number | null = null;
  private lastTimestamp = 0;
  private isDisposed = false;

  // Observers & listeners
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private boundOnVisibilityChange: () => void;
  private boundOnThemeMediaChange: () => void;
  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerMove: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;
  private boundWheel: (e: WheelEvent) => void;
  private boundContextLost: (e: Event) => void;
  private boundContextRestored: (e: Event) => void;

  constructor(options: IsoSceneOptions) {
    this.container = options.container;
    this.mode = options.mode;
    this.machineKey = options.machineKey || "BOP15-LBF15-2";
    this.getStatusFn = options.getStatus || (() => "running");
    this.animateEnabled =
      options.animate !== undefined
        ? options.animate
        : typeof window !== "undefined"
          ? !window.matchMedia("(prefers-reduced-motion: reduce)").matches
          : true;
    this.hoveredKey = options.hoveredKey ?? null;
    this.selectedKey = options.selectedKey ?? null;
    this.onHoverCallback = options.onHover;
    this.onSelectCallback = options.onSelect;
    this.onReadyCallback = options.onReady;
    this.onErrorCallback = options.onError;

    // Create canvas
    this.canvas = document.createElement("canvas");
    this.canvas.style.display = "block";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.touchAction = "none";
    this.canvas.style.cursor = "grab";
    this.container.appendChild(this.canvas);

    // Renderer (Three.js 0.186+)
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;

    // Scene & Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);

    // Lights: exactly as in reference with Math.PI compensation for Three.js r186 (>= r165)
    const ambient = new THREE.AmbientLight(0xffffff, 0.62 * Math.PI);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.62 * Math.PI);
    dirLight.position.set(0.2, 0.82, 0.45);
    this.scene.add(ambient);
    this.scene.add(dirLight);

    this.rootGroup = new THREE.Group();
    this.scene.add(this.rootGroup);

    // Bind event handlers
    this.boundOnVisibilityChange = this.handleVisibilityChange.bind(this);
    this.boundOnThemeMediaChange = this.handleThemeMediaChange.bind(this);
    this.boundPointerDown = this.handlePointerDown.bind(this);
    this.boundPointerMove = this.handlePointerMove.bind(this);
    this.boundPointerUp = this.handlePointerUp.bind(this);
    this.boundWheel = this.handleWheel.bind(this);
    this.boundContextLost = this.handleContextLost.bind(this);
    this.boundContextRestored = this.handleContextRestored.bind(this);

    this.setupListeners();
    this.setupObservers();

    // Initial build
    try {
      this.resize();
      this.buildScene();
      this.onReadyCallback?.();
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.warn("[IsoScene] build failed:", error);
      this.onErrorCallback?.(error);
    }
  }

  // ==========================================
  // SCENE BUILDER
  // ==========================================

  public buildScene(): void {
    if (this.isDisposed) return;

    // Clear previous models in root group
    this.disposeGroup(this.rootGroup);
    this.registry = {};
    this.flow = null;

    if (this.floorPlate) {
      this.scene.remove(this.floorPlate);
      if (this.floorPlate.geometry) this.floorPlate.geometry.dispose();
      if (this.floorPlate.material instanceof THREE.Material) {
        this.floorPlate.material.dispose();
      }
      this.floorPlate = null;
    }

    if (this.mode === "chain") {
      this.buildChain();
    } else {
      this.buildSingleMachine();
    }

    this.rootGroup.updateMatrixWorld(true);

    // Floor plate
    const bb = new THREE.Box3().setFromObject(this.rootGroup);
    const center = bb.getCenter(new THREE.Vector3());
    const size = bb.getSize(new THREE.Vector3());
    const floorColor = this.getFloorColor();

    const fpGeo = new THREE.PlaneGeometry(size.x + 0.8, size.z + 0.8);
    const fpMat = new THREE.MeshBasicMaterial({ color: floorColor });
    this.floorPlate = new THREE.Mesh(fpGeo, fpMat);
    this.floorPlate.rotation.x = -Math.PI / 2;
    this.floorPlate.position.set(center.x, -0.004, center.z);
    this.scene.add(this.floorPlate);

    // Initial lamps
    Object.keys(this.registry).forEach((k) => this.updateLamps(k));

    // Animation flow
    this.flow = this.createFlow();

    // Camera fit & selection highlights
    this.fitView();
    this.updateHighlights();

    this.draw();
  }

  private buildChain(): void {
    let x = 0;

    // LBF units: LBF15-3 (x=0), LBF15-2 (x=1.10), LBF15-1 (x=2.20)
    // rightWall: false for the first two, true for LBF15-1
    const lbfConfigs = [
      { key: "BOP15-LBF15-3", rightWall: false },
      { key: "BOP15-LBF15-2", rightWall: false },
      { key: "BOP15-LBF15-1", rightWall: true },
    ];

    lbfConfigs.forEach((cfg) => {
      const machine = this.createMachineWithLampsAndProxy("LBF", cfg.key, {
        rightWall: cfg.rightWall,
      });
      this.placeMachineInRoot(cfg.key, machine, x);
      x += 1.1;
    });

    // Connecting conveyor 1
    this.addConnectingConveyor(x - 0.05, x + GAP + 0.05);
    x += GAP;

    // LBC (x = 4.00, W = 0.95)
    const lbc = this.createMachineWithLampsAndProxy("LBC", "BOP15-LBC");
    this.placeMachineInRoot("BOP15-LBC", lbc, x);
    x += 0.95;

    // Connecting conveyor 2
    this.addConnectingConveyor(x - 0.05, x + GAP + 0.05);
    x += GAP;

    // LCM (x = 5.65, W = 2.30)
    const lcm = this.createMachineWithLampsAndProxy("LCM", "BOP15-LCM");
    this.placeMachineInRoot("BOP15-LCM", lcm, x);
    x += 2.3;

    // Center whole chain
    this.rootGroup.position.x = -x / 2;
  }

  private buildSingleMachine(): void {
    const rawKey = this.machineKey;
    const key = rawKey.startsWith("BOP15-") ? rawKey : `BOP15-${rawKey}`;
    const mMeta =
      BOP15_MACHINES.find((m) => m.key === key || m.shortKey === rawKey) || BOP15_MACHINES[1];

    const machine = this.createMachineWithLampsAndProxy(mMeta.type, mMeta.key);
    const u = machine.userData;
    const rootSingle = single(machine, 0.5);
    this.rootGroup.add(rootSingle);

    this.registry[mMeta.key] = {
      group: machine,
      proxy: u.proxy,
      outline: u.outline,
      lamps: u.lamps,
      type: mMeta.type,
      key: mMeta.key,
    };
    u.proxy.userData = { machineKey: mMeta.key };

    this.rootGroup.position.x = -u.W / 2;
  }

  private placeMachineInRoot(key: string, machine: THREE.Group, x: number): void {
    place(this.rootGroup, machine, x);
    const u = machine.userData;
    this.registry[key] = {
      group: machine,
      proxy: u.proxy,
      outline: u.outline,
      lamps: u.lamps,
      type: u.machineType,
      key,
    };
    u.proxy.userData = { machineKey: key };
  }

  private addConnectingConveyor(x0: number, x1: number): void {
    conveyor(this.rootGroup, x0, x1, 0, CONV_Y, { legs: true });

    // Flat flow chevron (ShapeGeometry triangle-arrow, color #e0a800, double side)
    const s = new THREE.Shape();
    s.moveTo(-0.07, -0.07);
    s.lineTo(0.09, 0);
    s.lineTo(-0.07, 0.07);
    s.lineTo(-0.02, 0);

    const chevronMat = new THREE.MeshBasicMaterial({ color: 0xe0a800, side: THREE.DoubleSide });
    const c = new THREE.Mesh(new THREE.ShapeGeometry(s), chevronMat);
    c.rotation.x = -Math.PI / 2;
    c.position.set((x0 + x1) / 2, CONV_Y + 0.004, 0);
    this.rootGroup.add(c);
  }

  private createMachineWithLampsAndProxy(
    type: MachineType,
    machineKey: string,
    options?: { rightWall?: boolean },
  ): THREE.Group {
    const group = type === "LBF" ? LBF15(options) : type === "LBC" ? LBC() : LCM();
    const u = group.userData;
    u.machineType = type;

    // 4.1 Hide static green indicator pieces
    hideStatic(group);

    // 4.2 Stack light on every machine
    const sp = this.getStackLightPosition(type, u);
    const lamps: THREE.MeshBasicMaterial[] = [];

    // Pole box 0.025 x 0.25 x 0.025 (#3a3d42) centered at y + 0.125
    this.addBox(group, 0.025, 0.25, 0.025, 0x3a3d42, sp[0], sp[1] + 0.125, sp[2]);

    // 3 lamp cubes of 0.075: red top (y+0.2), amber (y+0.125), green (y+0.050)
    for (let i = 0; i < 3; i++) {
      const lampMat = new THREE.MeshBasicMaterial({ color: LAMP_COLORS[i] });
      this.addBox(group, 0.075, 0.075, 0.075, lampMat, sp[0], sp[1] + 0.2 - i * 0.075, sp[2]);
      lamps.push(lampMat);
    }

    // 6.2 Hit proxy (invisible box W x H x D at center)
    const proxyMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const proxy = this.addBox(group, u['W'], u['H'], u['D'], proxyMat, u['W'] / 2, u['H'] / 2, u['D'] / 2);

    // Selection / hover outline
    const edges = new THREE.EdgesGeometry(proxy.geometry);
    const outlineMat = new THREE.LineBasicMaterial({ color: 0x378add });
    const outline = new THREE.LineSegments(edges, outlineMat);
    outline.position.copy(proxy.position);
    outline.visible = false;
    group.add(outline);

    u.lamps = lamps;
    u.proxy = proxy;
    u.outline = outline;

    return group;
  }

  private getStackLightPosition(
    type: MachineType,
    u: { W: number; D: number; H: number },
  ): [number, number, number] {
    if (type === "LBF") return [0.15, 1.41, u.D - 0.22];
    if (type === "LBC") return [u.W - 0.15, 1.31, u.D * 0.5];
    return [u.W - 0.12, 1.17, 0.14];
  }

  private addBox(
    parent: THREE.Group,
    w: number,
    h: number,
    d: number,
    materialOrColor: THREE.Material | number,
    x: number,
    y: number,
    z: number,
  ): THREE.Mesh {
    const mat =
      typeof materialOrColor === "number"
        ? new THREE.MeshBasicMaterial({ color: materialOrColor })
        : materialOrColor;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  // ==========================================
  // ANIMATION ENGINE (Section 5)
  // ==========================================

  private createFlow(): FlowState {
    const segs: FlowSegment[] = [];
    const products: FlowProduct[] = [];
    const movingParts: MovingPart[] = [];
    let st = 0;
    let en = 0;
    let cartonStart = 0;

    if (this.mode === "chain") {
      segs.push({ machineKey: "BOP15-LBF15-3", start: 0, end: 1.1 });
      segs.push({ machineKey: "BOP15-LBF15-2", start: 1.1, end: 2.2 });
      segs.push({ machineKey: "BOP15-LBF15-1", start: 2.2, end: 3.3 });
      segs.push({ machineKey: null, start: 3.3, end: 3.3 + GAP });
      segs.push({ machineKey: "BOP15-LBC", start: 3.3 + GAP, end: 4.25 + GAP });
      segs.push({ machineKey: null, start: 4.25 + GAP, end: 4.25 + 2 * GAP });
      segs.push({ machineKey: "BOP15-LCM", start: 4.25 + 2 * GAP, end: 6.55 + 2 * GAP });

      st = 0;
      en = 6.55 + 2 * GAP;
      cartonStart = 4.25 + 2 * GAP; // 5.65 m (LCM start)
    } else {
      const reg = this.registry[Object.keys(this.registry)[0]];
      const W0 = reg?.group.userData.W || 1.1;
      st = -0.5;
      en = W0 + 0.5;
      segs.push({ machineKey: reg?.key || null, start: st, end: en });
      cartonStart = reg?.type === "LCM" ? -9 : 99;
    }

    const n = Math.floor((en - st) / PRODUCT_SPACING);
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group();
      const b = new THREE.Group();

      // Bottle: body box 0.084 x 0.15 x 0.084 #3fb6a8 at y = CONV_Y + 0.075
      this.addBox(b, 0.084, 0.15, 0.084, 0x3fb6a8, 0, CONV_Y + 0.075, 0);
      // Cap: box 0.05 x 0.03 x 0.05 #f4f4f4 at y = CONV_Y + 0.165
      this.addBox(b, 0.05, 0.03, 0.05, 0xf4f4f4, 0, CONV_Y + 0.165, 0);

      // Carton: box 0.14 x 0.09 x 0.09 #c99a5b at y = CONV_Y + 0.045
      const c = this.addBox(g, 0.14, 0.09, 0.09, 0xc99a5b, 0, CONV_Y + 0.045, 0);

      g.add(b);
      const initX = en - i * PRODUCT_SPACING - 0.25;
      g.position.set(initX, 0, 0);
      this.rootGroup.add(g);

      products.push({
        x: initX,
        group: g,
        bottle: b,
        carton: c,
      });
    }

    // 5.2 Decorative moving parts inside machines
    Object.values(this.registry).forEach((entry) => {
      const u = entry.group.userData;
      if (entry.type === "LBF") {
        // Arm box 0.06 x 0.14 x 0.06 #2a5db8 at (W*0.5, 0.95, D*0.55), axis x
        const mesh = this.addBox(
          entry.group,
          0.06,
          0.14,
          0.06,
          0x2a5db8,
          u.W * 0.5,
          0.95,
          u.D * 0.55,
        );
        movingParts.push({
          machineKey: entry.key,
          mesh,
          axis: "x",
          base: u.W * 0.5,
          amplitude: 0.22,
          speed: 3,
          phase: 0,
        });
      } else if (entry.type === "LBC") {
        // Two head boxes 0.06 x 0.10 x 0.06 #9ea2a4 at x=W*0.40 and W*0.62, y=0.98, z=D*0.5, axis y
        [0.4, 0.62].forEach((f, idx) => {
          const mesh = this.addBox(
            entry.group,
            0.06,
            0.1,
            0.06,
            0x9ea2a4,
            u.W * f,
            0.98,
            u.D * 0.5,
          );
          movingParts.push({
            machineKey: entry.key,
            mesh,
            axis: "y",
            base: 0.98,
            amplitude: 0.04,
            speed: 5,
            phase: idx * 1.6,
          });
        });
      } else if (entry.type === "LCM") {
        // Pusher box 0.14 x 0.10 x 0.07 #9ea2a4 at (1.65, 0.86, D*0.55), axis z
        const mesh = this.addBox(entry.group, 0.14, 0.1, 0.07, 0x9ea2a4, 1.65, 0.86, u.D * 0.55);
        movingParts.push({
          machineKey: entry.key,
          mesh,
          axis: "z",
          base: u.D * 0.55,
          amplitude: 0.14,
          speed: 3.5,
          phase: 0,
        });
      }
    });

    const flowState: FlowState = {
      segments: segs,
      products,
      movingParts,
      start: st,
      end: en,
      cartonStart,
    };

    this.stepAnimation(0, flowState);
    return flowState;
  }

  private getMachineFactor(key: string): number {
    const rawStatus = this.getStatusFn(key) || "running";
    const status = rawStatus.toLowerCase().replace("_", " ").trim();
    return STATUS_FACTOR_MAP[status] ?? 0;
  }

  private speedAt(flow: FlowState, x: number): number {
    for (let i = 0; i < flow.segments.length; i++) {
      const seg = flow.segments[i];
      if (x >= seg.start && x < seg.end) {
        if (seg.machineKey) {
          return this.getMachineFactor(seg.machineKey);
        }
        // In a gap segment: minimum of two neighboring machines
        const prevKey = flow.segments[i - 1]?.machineKey;
        const nextKey = flow.segments[i + 1]?.machineKey;
        const fPrev = prevKey ? this.getMachineFactor(prevKey) : 1;
        const fNext = nextKey ? this.getMachineFactor(nextKey) : 1;
        return Math.min(fPrev, fNext);
      }
    }
    return 1;
  }

  private stepAnimation(dt: number, flowState?: FlowState): void {
    const F = flowState || this.flow;
    if (!F) return;

    // Update lamps every frame according to current status
    Object.keys(this.registry).forEach((k) => this.updateLamps(k));

    // Sort products by x descending
    const P = F.products.slice().sort((a, b) => b.x - a.x);

    P.forEach((p, i) => {
      p.x += this.speedAt(F, p.x) * FLOW_SPEED * dt;
      if (i > 0 && p.x > P[i - 1].x - MIN_QUEUE_GAP) {
        p.x = P[i - 1].x - MIN_QUEUE_GAP;
      }
    });

    // Leader respawn or hold at end
    const leader = P[0];
    if (leader && leader.x > F.end + 0.1) {
      let minX = 1e9;
      for (let i = 1; i < P.length; i++) {
        minX = Math.min(minX, P[i].x);
      }
      leader.x = minX > F.start + 0.3 ? F.start - 0.1 : F.end + 0.1;
    }

    // Apply positions & visibility
    P.forEach((p) => {
      p.group.position.x = p.x;
      p.group.visible = p.x >= F.start && p.x <= F.end;
      p.bottle.visible = p.x < F.cartonStart;
      p.carton.visible = !p.bottle.visible;
    });

    // Moving parts inside machines
    F.movingParts.forEach((m) => {
      const factor = this.getMachineFactor(m.machineKey);
      m.phase += dt * factor * m.speed;
      m.mesh.position[m.axis] = m.base + Math.sin(m.phase) * m.amplitude;
    });
  }

  private updateLamps(key: string): void {
    const entry = this.registry[key];
    if (!entry) return;

    const rawStatus = this.getStatusFn(key) || "running";
    const status = rawStatus.toLowerCase().replace("_", " ").trim();
    const lampPattern = STATUS_LAMP_MAP[status] || STATUS_LAMP_MAP.off;

    entry.lamps.forEach((mat, i) => {
      mat.color.set(LAMP_COLORS[i]);
      if (!lampPattern[i]) {
        mat.color.multiplyScalar(0.28);
      }
    });
  }

  // ==========================================
  // CAMERA, VIEWPORT & FITTING (Section 6)
  // ==========================================

  public fitView(): void {
    const bb = new THREE.Box3().setFromObject(this.rootGroup);
    const center = bb.getCenter(new THREE.Vector3());

    const azRad = (ISO_AZ_DEG * Math.PI) / 180;
    const elRad = (ISO_EL_DEG * Math.PI) / 180;
    const dir = new THREE.Vector3(
      Math.sin(azRad) * Math.cos(elRad),
      Math.sin(elRad),
      Math.cos(azRad) * Math.cos(elRad),
    );

    this.camera.position.copy(center).addScaledVector(dir, 80);
    this.camera.lookAt(center);
    this.camera.updateMatrixWorld(true);

    const inv = this.camera.matrixWorldInverse;
    let minX = 1e9;
    let maxX = -1e9;
    let minY = 1e9;
    let maxY = -1e9;

    [bb.min.x, bb.max.x].forEach((x) => {
      [bb.min.y, bb.max.y].forEach((y) => {
        [bb.min.z, bb.max.z].forEach((z) => {
          const p = new THREE.Vector3(x, y, z).applyMatrix4(inv);
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
        });
      });
    });

    const margin = this.mode === "chain" ? 1.06 : 1.12;
    this.viewExtents = {
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      hw: ((maxX - minX) / 2) * margin,
      hh: ((maxY - minY) / 2) * margin,
    };

    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this.updateFrustum();
  }

  private updateFrustum(): void {
    const aspect = this.width / this.height;
    let hw = this.viewExtents.hw;
    let hh = this.viewExtents.hh;

    if (hw / hh < aspect) {
      hw = hh * aspect;
    } else {
      hh = hw / aspect;
    }

    hw /= this.zoom;
    hh /= this.zoom;
    this.unitsPerPixel = (2 * hw) / this.width;

    // Clamped pan so the scene never leaves the canvas completely
    const maxPanX = this.viewExtents.hw * 2;
    const maxPanY = this.viewExtents.hh * 2;
    this.pan.x = Math.max(-maxPanX, Math.min(maxPanX, this.pan.x));
    this.pan.y = Math.max(-maxPanY, Math.min(maxPanY, this.pan.y));

    this.camera.left = this.viewExtents.cx + this.pan.x - hw;
    this.camera.right = this.viewExtents.cx + this.pan.x + hw;
    this.camera.top = this.viewExtents.cy + this.pan.y + hh;
    this.camera.bottom = this.viewExtents.cy + this.pan.y - hh;
    this.camera.updateProjectionMatrix();
  }

  public resetView(): void {
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this.updateFrustum();
    this.draw();
  }

  public resize(): void {
    if (this.isDisposed || !this.container) return;
    const w = Math.max(280, this.container.clientWidth);
    const h = Math.max(240, this.container.clientHeight);
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.updateFrustum();
    this.draw();
  }

  // ==========================================
  // RENDER & ANIMATION LOOP
  // ==========================================

  public setAnimate(enabled: boolean): void {
    this.animateEnabled = enabled;
    if (enabled) {
      this.startLoop();
    } else {
      this.stopLoop();
      this.draw();
    }
  }

  public draw(): void {
    if (this.isDisposed) return;
    this.updateFrustum();
    this.renderer.render(this.scene, this.camera);
  }

  private startLoop(): void {
    if (this.animationFrameId !== null || this.isDisposed) return;
    if (!this.animateEnabled || !this.isVisible || !this.isTabVisible) return;
    this.lastTimestamp = performance.now();
    this.animationFrameId = requestAnimationFrame(this.loopTick.bind(this));
  }

  private stopLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.lastTimestamp = 0;
  }

  private loopTick(now: number): void {
    this.animationFrameId = null;
    if (this.isDisposed || !this.animateEnabled || !this.isVisible || !this.isTabVisible) {
      return;
    }

    const elapsed = this.lastTimestamp ? (now - this.lastTimestamp) / 1000 : 0.016;
    this.lastTimestamp = now;
    const dt = Math.min(0.05, Math.max(0.001, elapsed));

    this.stepAnimation(dt);
    this.updateFrustum();
    this.renderer.render(this.scene, this.camera);

    this.animationFrameId = requestAnimationFrame(this.loopTick.bind(this));
  }

  // ==========================================
  // INTERACTION & PICKING
  // ==========================================

  private pick(e: PointerEvent): string | null {
    if (!this.canvas) return null;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
    const proxies = Object.values(this.registry)
      .map((r) => r?.proxy)
      .filter((p): p is THREE.Mesh => Boolean(p));
    if (proxies.length === 0) return null;

    const hits = this.raycaster.intersectObjects(proxies, false);

    if (hits.length > 0 && hits[0]?.object?.userData) {
      return hits[0].object.userData.machineKey || null;
    }
    return null;
  }

  private handlePointerDown(e: PointerEvent): void {
    this.pointerDrag = { x: e.clientX, y: e.clientY };
    this.dragMovedDistance = 0;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    this.canvas.style.cursor = "grabbing";
  }

  private handlePointerMove(e: PointerEvent): void {
    if (this.pointerDrag) {
      const dx = e.clientX - this.pointerDrag.x;
      const dy = e.clientY - this.pointerDrag.y;
      this.dragMovedDistance += Math.abs(dx) + Math.abs(dy);

      this.pan.x -= dx * this.unitsPerPixel;
      this.pan.y += dy * this.unitsPerPixel;
      this.pointerDrag = { x: e.clientX, y: e.clientY };

      this.draw();
      return;
    }

    if (this.mode === "chain") {
      const pickedKey = this.pick(e);
      if (pickedKey !== this.hoveredKey) {
        this.hoveredKey = pickedKey;
        this.updateHighlights();
        this.draw();
        this.onHoverCallback?.(pickedKey);
      }
      this.canvas.style.cursor = pickedKey ? "pointer" : "grab";
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    const wasClick = this.dragMovedDistance < 5;
    this.pointerDrag = null;
    this.canvas.style.cursor = "grab";

    if (wasClick && this.mode === "chain") {
      const pickedKey = this.pick(e);
      if (pickedKey) {
        this.selectedKey = pickedKey;
        this.updateHighlights();
        this.draw();
        this.onSelectCallback?.(pickedKey);
      }
    }
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();
    this.zoom = Math.max(0.8, Math.min(3.0, this.zoom * Math.exp(-e.deltaY * 0.001)));
    this.draw();
  }

  public setHoveredKey(key: string | null): void {
    if (this.hoveredKey === key) return;
    this.hoveredKey = key;
    this.updateHighlights();
    this.draw();
  }

  public setSelectedKey(key: string | null): void {
    if (this.selectedKey === key) return;
    this.selectedKey = key;
    this.updateHighlights();
    this.draw();
  }

  public setGetStatus(fn: (key: string) => string): void {
    this.getStatusFn = fn;
    this.updateAllLamps();
    this.draw();
  }

  public updateAllLamps(): void {
    Object.keys(this.registry).forEach((k) => this.updateLamps(k));
  }

  public setMode(mode: "chain" | "machine", machineKey?: string): void {
    if (this.mode === mode && this.machineKey === machineKey) return;
    this.mode = mode;
    if (machineKey) this.machineKey = machineKey;
    this.buildScene();
  }

  private updateHighlights(): void {
    Object.values(this.registry).forEach((entry) => {
      const isHovered = entry.key === this.hoveredKey;
      const isSelected = entry.key === this.selectedKey && this.mode === "chain";
      entry.outline.visible = isHovered || isSelected;
    });
  }

  // ==========================================
  // THEME & OBSERVERS
  // ==========================================

  private getFloorColor(): number {
    if (typeof window === "undefined") return 0xeef0f3;
    const computed = getComputedStyle(document.documentElement).getPropertyValue("--floor").trim();
    if (computed) {
      return new THREE.Color(computed).getHex();
    }
    const isDark = document.documentElement.classList.contains("dark");
    return isDark ? 0x2d3440 : 0xeef0f3;
  }

  public updateTheme(): void {
    if (this.floorPlate && this.floorPlate.material instanceof THREE.MeshBasicMaterial) {
      this.floorPlate.material.color.set(this.getFloorColor());
      this.draw();
    }
  }

  private handleThemeMediaChange(): void {
    this.updateTheme();
  }

  private handleVisibilityChange(): void {
    this.isTabVisible = document.visibilityState === "visible";
    if (this.isTabVisible && this.animateEnabled && this.isVisible) {
      this.startLoop();
    } else {
      this.stopLoop();
    }
  }

  private setupListeners(): void {
    this.canvas.addEventListener("pointerdown", this.boundPointerDown);
    this.canvas.addEventListener("pointermove", this.boundPointerMove);
    this.canvas.addEventListener("pointerup", this.boundPointerUp);
    this.canvas.addEventListener("wheel", this.boundWheel, { passive: false });

    this.canvas.addEventListener("webglcontextlost", this.boundContextLost, false);
    this.canvas.addEventListener("webglcontextrestored", this.boundContextRestored, false);

    document.addEventListener("visibilitychange", this.boundOnVisibilityChange);

    if (typeof window !== "undefined") {
      window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", this.boundOnThemeMediaChange);
    }
  }

  private setupObservers(): void {
    let animFrame: number;
    this.resizeObserver = new ResizeObserver(() => {
      animFrame = requestAnimationFrame(() => {
        this.resize();
      });
    });
    this.resizeObserver.observe(this.container);

    this.intersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        this.isVisible = entry.isIntersecting;
        if (this.isVisible && this.animateEnabled && this.isTabVisible) {
          this.startLoop();
        } else {
          this.stopLoop();
        }
      }
    });
    this.intersectionObserver.observe(this.canvas);
  }

  private handleContextLost(e: Event): void {
    e.preventDefault();
    console.warn("[IsoScene] WebGL context lost");
    this.stopLoop();
  }

  private handleContextRestored(): void {
    console.info("[IsoScene] WebGL context restored, rebuilding scene");
    this.buildScene();
    if (this.animateEnabled) {
      this.startLoop();
    }
  }

  // ==========================================
  // DISPOSAL & CLEANUP
  // ==========================================

  private disposeGroup(group: THREE.Group | THREE.Object3D): void {
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      this.disposeObject(child);
    }
  }

  private disposeObject(obj: THREE.Object3D): void {
    obj.traverse((child: THREE.Object3D) => {
      const meshOrLine = child as THREE.Mesh | THREE.LineSegments;
      if (meshOrLine.geometry) {
        meshOrLine.geometry.dispose();
      }
      if (meshOrLine.material) {
        if (Array.isArray(meshOrLine.material)) {
          meshOrLine.material.forEach((m: THREE.Material) => m.dispose());
        } else {
          meshOrLine.material.dispose();
        }
      }
    });
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    this.stopLoop();

    this.canvas.removeEventListener("pointerdown", this.boundPointerDown);
    this.canvas.removeEventListener("pointermove", this.boundPointerMove);
    this.canvas.removeEventListener("pointerup", this.boundPointerUp);
    this.canvas.removeEventListener("wheel", this.boundWheel);

    this.canvas.removeEventListener("webglcontextlost", this.boundContextLost);
    this.canvas.removeEventListener("webglcontextrestored", this.boundContextRestored);

    document.removeEventListener("visibilitychange", this.boundOnVisibilityChange);

    if (typeof window !== "undefined") {
      window
        .matchMedia("(prefers-color-scheme: dark)")
        .removeEventListener("change", this.boundOnThemeMediaChange);
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }

    this.disposeGroup(this.scene);

    if (this.renderer) {
      try {
        this.renderer.dispose();
        this.renderer.forceContextLoss();
      } catch {
        // ignore
      }
    }

    if (this.canvas && this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
  }
}
