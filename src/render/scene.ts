import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** Renderer, camera, lights, environment and the render loop. */
export class Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  dirLight: THREE.DirectionalLight;
  private clock = new THREE.Clock();
  private updaters: ((dt: number) => void)[] = [];
  onFrame: ((dt: number) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Neutral tone mapping keeps saturated board colors vivid (ACES washes them toward pastel/white)
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 18, 21);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const hemi = new THREE.HemisphereLight(0xdceaff, 0x2a3040, 0.42);
    this.scene.add(hemi);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.55);
    this.dirLight.position.set(9, 20, 6);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(2048, 2048);
    this.dirLight.shadow.camera.left = -14;
    this.dirLight.shadow.camera.right = 14;
    this.dirLight.shadow.camera.top = 14;
    this.dirLight.shadow.camera.bottom = -14;
    this.dirLight.shadow.camera.far = 60;
    this.dirLight.shadow.radius = 5;
    this.dirLight.shadow.bias = -0.0004;
    this.scene.add(this.dirLight);

    const fill = new THREE.DirectionalLight(0x9db8ff, 0.22);
    fill.position.set(-10, 8, -8);
    this.scene.add(fill);

    // soft ground shadow catcher far below the floating board
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.ShadowMaterial({ opacity: 0.28, color: 0x000000 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -3.2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 0.2, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 7;
    this.controls.maxDistance = 42;
    this.controls.minPolarAngle = 0.25;
    this.controls.maxPolarAngle = 1.35;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 0.7;

    window.addEventListener('resize', () => this.resize());
    this.renderer.setAnimationLoop(() => {
      const dt = Math.min(this.clock.getDelta(), 0.05);
      for (const u of this.updaters) u(dt);
      this.controls.update();
      if (this.onFrame) this.onFrame(dt);
      this.renderer.render(this.scene, this.camera);
    });
  }

  addUpdater(fn: (dt: number) => void): void {
    this.updaters.push(fn);
  }

  resize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    // keep the board fully visible on narrow (portrait) screens: constant ~62deg horizontal fov
    const HFOV = (62 * Math.PI) / 180;
    const vFov = 2 * Math.atan(Math.tan(HFOV / 2) / this.camera.aspect);
    this.camera.fov = Math.max(40, Math.min(78, (vFov * 180) / Math.PI));
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
