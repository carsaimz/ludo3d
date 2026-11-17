import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  dispose(): void;
}

/** Cria renderer, cena, câmera, luzes e ambiente estilo "estúdio escuro premium" */
export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b1020, 36, 78);

  const camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / window.innerHeight,
    0.1,
    140
  );
  camera.position.set(20, 24, 20);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 6.5;
  controls.maxDistance = 30;
  controls.maxPolarAngle = 1.32;
  controls.target.set(0, 0.5, 0);

  // Reflexos PBR (plástico/verniz ganham vida)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new RoomEnvironment();
  scene.environment = pmrem.fromScene(envScene, 0.04).texture;
  pmrem.dispose();

  // Luzes
  const hemi = new THREE.HemisphereLight(0x9db4ff, 0x3a2f2a, 0.5);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff4e0, 1.7);
  sun.position.set(13, 20, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  sun.shadow.camera.near = 4;
  sun.shadow.camera.far = 55;
  sun.shadow.bias = -0.0004;
  sun.shadow.radius = 4;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xbcd0ff, 0.35);
  fill.position.set(-10, 9, -13);
  scene.add(fill);

  // Piso
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(38, 48),
    new THREE.MeshStandardMaterial({
      color: 0x0d1424,
      roughness: 0.5,
      metalness: 0.18
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.82;
  ground.receiveShadow = true;
  scene.add(ground);

  // Pódio circular sob o tabuleiro
  const podium = new THREE.Mesh(
    new THREE.CylinderGeometry(11.7, 12.6, 0.72, 72),
    new THREE.MeshPhysicalMaterial({
      color: 0x182338,
      roughness: 0.32,
      metalness: 0.42,
      clearcoat: 0.6,
      clearcoatRoughness: 0.3
    })
  );
  podium.position.y = -0.46;
  podium.receiveShadow = true;
  podium.castShadow = false;
  scene.add(podium);

  const accent = new THREE.Mesh(
    new THREE.TorusGeometry(11.7, 0.06, 10, 96),
    new THREE.MeshStandardMaterial({
      color: 0x3a5aa8,
      emissive: 0x1a3a80,
      emissiveIntensity: 0.9,
      roughness: 0.4
    })
  );
  accent.rotation.x = -Math.PI / 2;
  accent.position.y = -0.09;
  scene.add(accent);

  const onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);

  return {
    renderer,
    scene,
    camera,
    controls,
    dispose() {
      window.removeEventListener('resize', onResize);
      controls.dispose();
      renderer.dispose();
    }
  };
}
