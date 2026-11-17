import * as THREE from 'three';

interface Burst {
  points: THREE.Points;
  vel: Float32Array;
  life: number;
}

interface ConfettiP {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: string;
}

const CONFETTI_COLORS = ['#f24537', '#4caf50', '#ffd23f', '#2196f3', '#ffffff', '#ff8a80'];

/** Efeitos: marcadores de jogada, explosão de captura, confete de vitória */
export class FX {
  private scene: THREE.Scene;
  private hints: THREE.Object3D[] = [];
  private bursts: Burst[] = [];
  private t = 0;
  private confCanvas: HTMLCanvasElement;
  private confCtx: CanvasRenderingContext2D | null;
  private confParts: ConfettiP[] = [];
  private confUntil = 0;
  private confRunning = false;

  constructor(scene: THREE.Scene, confCanvas: HTMLCanvasElement) {
    this.scene = scene;
    this.confCanvas = confCanvas;
    this.confCtx = confCanvas.getContext('2d');
  }

  /** Anéis pulsantes sob as peças que podem se mover */
  showMovable(pos: THREE.Vector3, colorHex: string): void {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.68, 40),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(colorHex), transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(pos);
    ring.position.y += 0.03;
    this.scene.add(ring);
    this.hints.push(ring);
  }

  /** Marcador luminoso nas casas de destino; userData guarda a jogada */
  showTarget(pos: THREE.Vector3, opt: unknown): void {
    const group = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.34, 32),
      new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide })
    );
    disc.rotation.x = -Math.PI / 2;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.5, 40),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    group.add(disc, ring);
    group.position.copy(pos);
    group.position.y += 0.04;
    group.userData.moveOpt = opt;
    this.scene.add(group);
    this.hints.push(group);
  }

  clearHints(): void {
    for (const h of this.hints) {
      this.scene.remove(h);
      h.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) (m.material as THREE.Material).dispose();
      });
    }
    this.hints = [];
  }

  hintObjects(): THREE.Object3D[] {
    return this.hints;
  }

  /** Explosão de partículas na captura */
  burst(pos: THREE.Vector3, colorHex: string, count = 42): void {
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = pos.x;
      arr[i * 3 + 1] = pos.y + 0.2;
      arr[i * 3 + 2] = pos.z;
      const a = Math.random() * Math.PI * 2;
      const up = 2.5 + Math.random() * 3.5;
      const rad = 1.2 + Math.random() * 2.2;
      vel[i * 3] = Math.cos(a) * rad;
      vel[i * 3 + 1] = up;
      vel[i * 3 + 2] = Math.sin(a) * rad;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const mat = new THREE.PointsMaterial({
      color: new THREE.Color(colorHex),
      size: 0.16,
      transparent: true,
      opacity: 1,
      depthWrite: false
    });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    this.bursts.push({ points, vel, life: 0.85 });
  }

  /** Confete 2D para a vitória */
  confetti(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.confCanvas.width = w;
    this.confCanvas.height = h;
    this.confCanvas.classList.remove('hidden');
    this.confParts = [];
    for (let i = 0; i < 170; i++) {
      this.confParts.push({
        x: Math.random() * w,
        y: -20 - Math.random() * h * 0.5,
        vx: (Math.random() - 0.5) * 2.4,
        vy: 2 + Math.random() * 3.4,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.24,
        w: 7 + Math.random() * 7,
        h: 4 + Math.random() * 5,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]
      });
    }
    this.confUntil = this.t + 3.6;
    this.confRunning = true;
  }

  update(dt: number): void {
    this.t += dt;

    // pulso dos marcadores
    const s = 1 + Math.sin(this.t * 5.5) * 0.1;
    for (const h of this.hints) h.scale.setScalar(h instanceof THREE.Group ? 1 : s);

    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.life -= dt;
      const pos = b.points.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let j = 0; j < pos.count; j++) {
        pos.setXYZ(
          j,
          pos.getX(j) + b.vel[j * 3] * dt,
          pos.getY(j) + b.vel[j * 3 + 1] * dt,
          pos.getZ(j) + b.vel[j * 3 + 2] * dt
        );
        b.vel[j * 3 + 1] -= 10 * dt;
      }
      pos.needsUpdate = true;
      (b.points.material as THREE.PointsMaterial).opacity = Math.max(0, b.life / 0.85);
      if (b.life <= 0) {
        this.scene.remove(b.points);
        b.points.geometry.dispose();
        (b.points.material as THREE.Material).dispose();
        this.bursts.splice(i, 1);
      }
    }

    if (this.confRunning) {
      const ctx = this.confCtx;
      if (ctx) {
        ctx.clearRect(0, 0, this.confCanvas.width, this.confCanvas.height);
        for (const p of this.confParts) {
          p.x += p.vx;
          p.y += p.vy;
          p.rot += p.vr;
          if (p.y > this.confCanvas.height + 20 && this.t < this.confUntil) {
            p.y = -20;
            p.x = Math.random() * this.confCanvas.width;
          }
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
      }
      if (this.t >= this.confUntil) {
        this.confRunning = false;
        this.confCanvas.classList.add('hidden');
        this.confCtx?.clearRect(0, 0, this.confCanvas.width, this.confCanvas.height);
      }
    }
  }

  dispose(): void {
    this.clearHints();
    for (const b of this.bursts) {
      this.scene.remove(b.points);
      b.points.geometry.dispose();
    }
    this.bursts = [];
  }
}
