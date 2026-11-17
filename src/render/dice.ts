import * as THREE from 'three';

/**
 * 3D dice with a PREDETERMINED result (required for host-authoritative P2P sync):
 * it tumbles naturally with decreasing bounces, then eases into the exact
 * orientation that shows the requested face up. No cup, no physics engine.
 */

const REST_Y = 0.78;
const FACE_QUATS: Record<number, THREE.Quaternion> = {
  // face assignment: +Y=1, -Y=6, +X=3, -X=4, +Z=2, -Z=5
  1: new THREE.Quaternion(),
  6: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI),
  2: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2),
  5: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2),
  3: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2),
  4: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2)
};

function pipTexture(n: number): THREE.CanvasTexture {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d')!;
  // glossy ivory face
  const grad = g.createRadialGradient(S / 2, S / 2, 30, S / 2, S / 2, S * 0.72);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.75, '#f4efe2');
  grad.addColorStop(1, '#e2d9c3');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  // subtle border shading for a beveled look
  g.strokeStyle = 'rgba(90,80,55,0.22)';
  g.lineWidth = 14;
  g.strokeRect(7, 7, S - 14, S - 14);
  // pips
  const P = 0.27 * S;
  const C = S / 2;
  const spots: [number, number][] = [];
  const off = 0.22 * S;
  switch (n) {
    case 1: spots.push([C, C]); break;
    case 2: spots.push([C - off, C - off], [C + off, C + off]); break;
    case 3: spots.push([C - off, C - off], [C, C], [C + off, C + off]); break;
    case 4: spots.push([C - off, C - off], [C + off, C - off], [C - off, C + off], [C + off, C + off]); break;
    case 5: spots.push([C - off, C - off], [C + off, C - off], [C, C], [C - off, C + off], [C + off, C + off]); break;
    case 6: spots.push([C - off, C - off], [C + off, C - off], [C - off, C], [C + off, C], [C - off, C + off], [C + off, C + off]); break;
  }
  for (const [x, y] of spots) {
    const rg = g.createRadialGradient(x - P * 0.12, y - P * 0.12, 1, x, y, P);
    rg.addColorStop(0, '#3a3a3a');
    rg.addColorStop(1, '#0d0d0d');
    g.fillStyle = rg;
    g.beginPath();
    g.arc(x, y, P / 2, 0, Math.PI * 2);
    g.fill();
    // tiny specular dot
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath();
    g.arc(x - P * 0.15, y - P * 0.18, P * 0.09, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export class Dice3D {
  mesh: THREE.Mesh;
  private rolling = false;
  private t = 0;
  private duration = 1.45;
  private value = 1;
  private startPos = new THREE.Vector3();
  private startQuat = new THREE.Quaternion();
  private targetQuat = new THREE.Quaternion();
  private spinAxis = new THREE.Vector3(1, 0, 0);
  private spinSpeed = 9;
  private drift = new THREE.Vector2();
  private onDone: (() => void) | null = null;

  constructor(scene: THREE.Scene) {
    const mats = [3, 4, 1, 6, 2, 5].map((n) => new THREE.MeshPhysicalMaterial({
      map: pipTexture(n),
      roughness: 0.28,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.0
    }));
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.86, 0.86), mats);
    this.mesh.castShadow = true;
    this.mesh.position.set(0, REST_Y, 0);
    this.mesh.rotation.set(-0.35, 0.5, 0.12);
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  get isRolling(): boolean {
    return this.rolling;
  }

  /** Animate the dice to land showing `value` facing up. */
  rollTo(value: number, onDone: () => void): void {
    this.value = value;
    this.onDone = onDone;
    this.rolling = true;
    this.t = 0;
    this.startPos.set(0, 4.6, 0);
    this.startQuat.setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
    const spinDir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    this.spinAxis = spinDir;
    this.spinSpeed = 8 + Math.random() * 5;
    this.drift.set((Math.random() - 0.5) * 1.1, (Math.random() - 0.5) * 1.1);
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2);
    this.targetQuat.copy(yaw).multiply(FACE_QUATS[value]);
    this.mesh.visible = true;
    this.mesh.position.copy(this.startPos);
    this.mesh.quaternion.copy(this.startQuat);
  }

  hide(): void {
    this.mesh.visible = false;
    this.rolling = false;
  }

  /** Rest pose (idle, shows last value slightly tilted on the center pad). */
  restPose(): void {
    this.mesh.position.set(0, REST_Y + 0.12, 0);
    this.mesh.quaternion.copy(FACE_QUATS[this.value]);
  }

  update(dt: number): void {
    if (!this.rolling) return;
    this.t += dt;
    const k = this.t / this.duration;
    if (k >= 1) {
      this.rolling = false;
      this.mesh.position.set(this.drift.x * 0.6, REST_Y, this.drift.y * 0.6);
      this.mesh.quaternion.copy(this.targetQuat);
      const cb = this.onDone;
      this.onDone = null;
      cb?.();
      return;
    }

    // height: launch + 3 decreasing bounces
    let y: number;
    if (k < 0.34) {
      const u = k / 0.34;
      y = Math.max(REST_Y, Math.min(4.6, 4.6 * Math.pow(1 - u, 1.6) + 2.3 * Math.sin(Math.PI * u)));
    } else if (k < 0.62) {
      const u = (k - 0.34) / 0.28;
      y = REST_Y + 1.15 * Math.sin(Math.PI * u);
    } else if (k < 0.82) {
      const u = (k - 0.62) / 0.2;
      y = REST_Y + 0.5 * Math.sin(Math.PI * u);
    } else if (k < 0.92) {
      const u = (k - 0.82) / 0.1;
      y = REST_Y + 0.18 * Math.sin(Math.PI * u);
    } else {
      const u = (k - 0.92) / 0.08;
      // settle orientation
      this.mesh.quaternion.copy(this.startQuat).slerp(this.targetQuat, Math.min(1, u * 1.4));
      this.mesh.position.set(this.drift.x * 0.6 * u, REST_Y, this.drift.y * 0.6 * u);
      return;
    }
    // tumble: integrate spin, damp over time
    const damp = Math.max(0.12, 1 - k * 1.05);
    const q = new THREE.Quaternion().setFromAxisAngle(this.spinAxis, this.spinSpeed * damp * dt);
    this.mesh.quaternion.multiply(q);
    this.mesh.position.set(this.drift.x * (0.9 - k * 0.5), Math.max(REST_Y, y), this.drift.y * (0.9 - k * 0.5));
    if (k > 0.8) {
      this.mesh.quaternion.slerp(this.targetQuat, 0.14);
    }
  }
}
