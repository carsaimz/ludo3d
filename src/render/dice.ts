import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { TILE_TOP } from './board';

const DIE_SIZE = 1.04;
const HALF = DIE_SIZE / 2;
const GROUND_Y = TILE_TOP;
const REST_Y = GROUND_Y + HALF;

/** Valor impresso em cada face do BoxGeometry: ordem [+x, -x, +y, -y, +z, -z] */
const FACE_VALUES = [3, 4, 1, 6, 2, 5];
const FACE_NORMALS = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1)
];

function dieFaceTexture(n: number): THREE.CanvasTexture {
  const cnv = document.createElement('canvas');
  cnv.width = cnv.height = 256;
  const ctx = cnv.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 108, 30, 128, 128, 240);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#e3e6ee');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  ctx.lineWidth = 14;
  roundRect(ctx, 16, 16, 224, 224, 28);
  ctx.stroke();

  const P = 62;
  const Q = 194;
  const M = 128;
  const layouts: Record<number, [number, number][]> = {
    1: [[M, M]],
    2: [[P, P], [Q, Q]],
    3: [[P, P], [M, M], [Q, Q]],
    4: [[P, P], [Q, P], [P, Q], [Q, Q]],
    5: [[P, P], [Q, P], [M, M], [P, Q], [Q, Q]],
    6: [[P, P], [Q, P], [P, M], [Q, M], [P, Q], [Q, Q]]
  };
  ctx.fillStyle = n === 1 ? '#d63b2f' : '#20242e';
  for (const [x, y] of layouts[n]) {
    ctx.beginPath();
    ctx.arc(x, y, n === 1 ? 44 : 26, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(cnv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

type DiceState = 'idle' | 'rolling' | 'snapping' | 'rest';

/**
 * Dado 3D com física real (cannon-es): rola solto no centro do tabuleiro, sem copo.
 * O resultado é pré-determinado (seed) e o dado é alinhado à face correta ao parar.
 */
export class DiceView {
  readonly mesh: THREE.Mesh;
  value = 1;
  state: DiceState = 'idle';
  private world: CANNON.World;
  private body: CANNON.Body;
  private result = 1;
  private onDone: (() => void) | null = null;
  private stableFrames = 0;
  private elapsed = 0;
  private snapT = 0;
  private snapFromQ = new THREE.Quaternion();
  private snapToQ = new THREE.Quaternion();
  private snapFromP = new THREE.Vector3();
  private snapToP = new THREE.Vector3();
  private time = 0;

  constructor() {
    const mats = FACE_VALUES.map((v) => {
      const tex = dieFaceTexture(v);
      return new THREE.MeshPhysicalMaterial({
        map: tex,
        roughness: 0.16,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.1
      });
    });
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(DIE_SIZE, DIE_SIZE, DIE_SIZE), mats);
    this.mesh.castShadow = true;
    this.mesh.position.set(0, REST_Y + 0.1, 0);
    this.value = 1;

    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -32, 0) });
    const dieMat = new CANNON.Material('die');
    const boardMat = new CANNON.Material('board');
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(dieMat, boardMat, { friction: 0.32, restitution: 0.5 })
    );

    const ground = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane(), material: boardMat });
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    ground.position.set(0, GROUND_Y, 0);
    this.world.addBody(ground);

    // paredes invisíveis para o dado rolar na área central
    const wallShape = new CANNON.Box(new CANNON.Vec3(0.06, 1.6, 2.0));
    for (const [x, z, ry] of [[-1.85, 0, 0], [1.85, 0, 0], [0, -1.85, Math.PI / 2], [0, 1.85, Math.PI / 2]] as const) {
      const wall = new CANNON.Body({ type: CANNON.Body.STATIC, shape: wallShape, material: boardMat });
      wall.position.set(x, GROUND_Y + 1.2, z);
      wall.quaternion.setFromEuler(0, ry, 0);
      this.world.addBody(wall);
    }

    this.body = new CANNON.Body({
      mass: 1,
      shape: new CANNON.Box(new CANNON.Vec3(HALF, HALF, HALF)),
      material: dieMat,
      linearDamping: 0.06,
      angularDamping: 0.06,
      allowSleep: true,
      sleepSpeedLimit: 0.16,
      sleepTimeLimit: 0.2
    });
    this.body.position.set(0, REST_Y, 0);
    this.world.addBody(this.body);
    this.syncMesh();
    this.state = 'rest';
  }

  /** Coloca o dado em modo "flutuando", aguardando a rolagem */
  idle(): void {
    this.state = 'idle';
    this.body.position.set(0, REST_Y, 0);
    this.mesh.position.set(0, REST_Y, 0);
  }

  /** Rola o dado: resultado pré-determinado, física define a coreografia */
  roll(result: number, onDone: () => void): void {
    this.result = result;
    this.onDone = onDone;
    this.state = 'rolling';
    this.stableFrames = 0;
    this.elapsed = 0;
    this.body.wakeUp();
    this.body.position.set((Math.random() - 0.5) * 0.6, 2.9, (Math.random() - 0.5) * 0.6);
    this.body.velocity.set((Math.random() - 0.5) * 5, -2 - Math.random() * 2, (Math.random() - 0.5) * 5);
    const axis = new CANNON.Vec3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
    axis.normalize();
    const spd = 10 + Math.random() * 7;
    this.body.angularVelocity.set(axis.x * spd, axis.y * spd, axis.z * spd);
    this.body.quaternion.setFromEuler(Math.random() * 6, Math.random() * 6, Math.random() * 6);
  }

  private faceUpValue(): number {
    let best = 1;
    let bestY = -Infinity;
    const n = new THREE.Vector3();
    for (let i = 0; i < 6; i++) {
      n.copy(FACE_NORMALS[i]).applyQuaternion(this.mesh.quaternion);
      if (n.y > bestY) {
        bestY = n.y;
        best = FACE_VALUES[i];
      }
    }
    return best;
  }

  private targetQuat(value: number): THREE.Quaternion {
    const idx = FACE_VALUES.indexOf(value);
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(FACE_NORMALS[idx < 0 ? 2 : idx], new THREE.Vector3(0, 1, 0));
    return q;
  }

  private finalize(): void {
    this.state = 'snapping';
    this.snapT = 0;
    this.snapFromQ.copy(this.mesh.quaternion);
    this.snapToQ.copy(this.targetQuat(this.result));
    this.snapFromP.copy(this.mesh.position);
    this.snapToP.set(
      THREE.MathUtils.clamp(this.mesh.position.x, -0.55, 0.55),
      REST_Y,
      THREE.MathUtils.clamp(this.mesh.position.z, -0.55, 0.55)
    );
    this.body.sleep();
  }

  private syncMesh(): void {
    this.mesh.position.set(this.body.position.x, this.body.position.y, this.body.position.z);
    this.mesh.quaternion.set(this.body.quaternion.x, this.body.quaternion.y, this.body.quaternion.z, this.body.quaternion.w);
  }

  update(dt: number): void {
    this.time += dt;
    if (this.state === 'rolling') {
      this.elapsed += dt;
      this.world.step(1 / 60, dt, 6);
      this.syncMesh();
      const still =
        this.body.velocity.lengthSquared() < 0.012 &&
        this.body.angularVelocity.lengthSquared() < 0.02;
      this.stableFrames = still ? this.stableFrames + 1 : 0;
      if (this.stableFrames > 22 || this.elapsed > 2.8) this.finalize();
    } else if (this.state === 'snapping') {
      this.snapT = Math.min(1, this.snapT + dt / 0.26);
      const e = 1 - Math.pow(1 - this.snapT, 3);
      this.mesh.position.lerpVectors(this.snapFromP, this.snapToP, e);
      this.mesh.quaternion.slerpQuaternions(this.snapFromQ, this.snapToQ, e);
      if (this.snapT >= 1) {
        this.state = 'rest';
        this.value = this.result;
        const cb = this.onDone;
        this.onDone = null;
        cb?.();
      }
    } else if (this.state === 'idle') {
      this.mesh.position.y = REST_Y + 0.14 + Math.sin(this.time * 2.4) * 0.06;
      this.mesh.rotation.y += dt * 0.9;
    }
  }

  /** Valor atual visível (durante 'rest' é o resultado garantido) */
  shownValue(): number {
    return this.state === 'rest' ? this.value : this.faceUpValue();
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material[]).forEach((m) => m.dispose());
  }
}
