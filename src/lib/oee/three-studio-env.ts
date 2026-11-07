import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export interface StudioLightingOptions {
  ambientIntensity?: number;
  directionalIntensity?: number;
  directionalPos?: [number, number, number];
  fillIntensity?: number;
  hemiIntensity?: number;
  toneMapping?: THREE.ToneMapping;
  toneMappingExposure?: number;
}

export interface StudioEnvironmentResult {
  envTexture: THREE.Texture;
  ambientLight: THREE.AmbientLight;
  sunLight: THREE.DirectionalLight;
  fillLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  dispose: () => void;
}

/**
 * Shared studio environment and lighting setup for all 3D viewers.
 * Ensures metallic PBR materials reflect realistic neutral studio light
 * and prevents 3D models from rendering dark or black.
 */
export function setupStudioLightingAndEnvironment(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  options: StudioLightingOptions = {},
): StudioEnvironmentResult {
  // Ensure standard sRGB color management and output color space
  if ("ColorManagement" in THREE) {
    (THREE as { ColorManagement: { enabled: boolean } }).ColorManagement.enabled = true;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = options.toneMapping ?? THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = options.toneMappingExposure ?? 1.1;

  // 1. Generate RoomEnvironment map for realistic PBR metal reflections
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  const roomScene = new RoomEnvironment();
  const envTexture = pmremGenerator.fromScene(roomScene, 0.04).texture;
  scene.environment = envTexture;

  // 2. Base Lighting
  // Ambient light for base illumination
  const ambientLight = new THREE.AmbientLight(0xffffff, options.ambientIntensity ?? 0.6);
  ambientLight.name = "studio_ambient";
  scene.add(ambientLight);

  // Key Directional Light
  const sunLight = new THREE.DirectionalLight(0xffffff, options.directionalIntensity ?? 1.5);
  sunLight.name = "studio_sun";
  const pos = options.directionalPos ?? [10, 10, 10];
  sunLight.position.set(pos[0], pos[1], pos[2]);
  scene.add(sunLight);

  // Fill Light from opposite quadrant
  const fillLight = new THREE.DirectionalLight(0xffffff, options.fillIntensity ?? 0.7);
  fillLight.name = "studio_fill";
  fillLight.position.set(-pos[0] * 0.7, Math.max(6, pos[1] * 0.6), -pos[2] * 0.7);
  scene.add(fillLight);

  // Hemisphere Light for natural ambient gradient
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x556677, options.hemiIntensity ?? 0.6);
  hemiLight.name = "studio_hemi";
  scene.add(hemiLight);

  return {
    envTexture,
    ambientLight,
    sunLight,
    fillLight,
    hemiLight,
    dispose: () => {
      scene.remove(ambientLight);
      scene.remove(sunLight);
      scene.remove(fillLight);
      scene.remove(hemiLight);
      if (scene.environment === envTexture) {
        scene.environment = null;
      }
      envTexture.dispose();
      pmremGenerator.dispose();
      roomScene.dispose();
    },
  };
}
