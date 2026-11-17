import * as THREE from 'three';
import { COLOR_HEX } from './palette';
import type { ColorId } from '../engine/types';

/** Perfil clássico da peça de Ludo (base larga, cintura, cabeça esférica) */
function pawnProfile(): THREE.Vector2[] {
  const pts: [number, number][] = [
    [0.0, 0.0],
    [0.30, 0.0],
    [0.38, 0.02],
    [0.41, 0.06],
    [0.42, 0.09],
    [0.38, 0.13],
    [0.30, 0.16],
    [0.20, 0.26],
    [0.14, 0.38],
    [0.12, 0.48],
    [0.14, 0.56],
    [0.20, 0.62],
    [0.26, 0.67],
    [0.28, 0.72],
    [0.25, 0.77],
    [0.19, 0.82],
    [0.13, 0.86],
    [0.0, 0.90]
  ];
  return pts.map(([x, y]) => new THREE.Vector2(x, y));
}

export interface TokenView {
  id: number;
  owner: number;
  mesh: THREE.Mesh;
  baseScale: number;
}

interface HopAnim {
  view: TokenView;
  points: THREE.Vector3[];
  seg: number;
  t: number;
  perSeg: number;
  arc: number;
  onDone: () => void;
  tick: (seg: number, total: number) => void;
}

/** Gereciona as 16 peças: cores por jogador, pilhas, pulso de seleção e salto animado */
export class PawnManager {
  readonly views: TokenView[] = [];
  private mats = new Map<string, THREE.MeshPhysicalMaterial>();
  private hops: HopAnim[] = [];
  private pulseId: number | null = null;
  private t = 0;
  private parent: THREE.Object3D;

  constructor(parent: THREE.Object3D) {
    this.parent = parent;
    const geo = new THREE.LatheGeometry(pawnProfile(), 40);
    for (let owner = 0; owner < 4; owner++) {
      const mat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(COLOR_HEX.red),
        roughness: 0.22,
        metalness: 0.0,
        clearcoat: 1,
        clearcoatRoughness: 0.16,
        envMapIntensity: 1.1
      });
      for (let i = 0; i < 4; i++) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.visible = false;
        const view: TokenView = { id: owner * 4 + i, owner, mesh, baseScale: 1 };
        mesh.userData.tokenId = view.id;
        parent.add(mesh);
        this.views.push(view);
      }
    }
  }

  private matFor(color: ColorId): THREE.MeshPhysicalMaterial {
    let m = this.mats.get(color);
    if (!m) {
      m = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(COLOR_HEX[color]),
        roughness: 0.22,
        metalness: 0.0,
        clearcoat: 1,
        clearcoatRoughness: 0.16,
        envMapIntensity: 1.1
      });
      this.mats.set(color, m);
    }
    return m;
  }

  /** Aplica a cor do jogador (índice no array de players) às 4 peças dele */
  setOwnerColor(owner: number, color: ColorId): void {
    const mat = this.matFor(color);
    for (const v of this.views) {
      if (v.owner === owner) v.mesh.material = mat;
    }
  }

  view(id: number): TokenView {
    return this.views[id];
  }

  placeInstant(view: TokenView, pos: THREE.Vector3, scale = 1): void {
    this.stopHops(view);
    view.mesh.position.copy(pos);
    view.baseScale = scale;
    view.mesh.scale.setScalar(scale);
    view.mesh.visible = true;
  }

  /** Salto em arco por várias casas (caminho do movimento) */
  hop(view: TokenView, points: THREE.Vector3[], perSeg: number, onDone: () => void, tick: (seg: number, total: number) => void): void {
    if (points.length < 2) {
      onDone();
      return;
    }
    this.stopHops(view);
    this.hops.push({ view, points, seg: 0, t: 0, perSeg, arc: 0.55, onDone, tick });
  }

  private stopHops(view: TokenView): void {
    this.hops = this.hops.filter((h) => h.view !== view);
  }

  setPulse(id: number | null): void {
    if (this.pulseId !== null) {
      const v = this.views[this.pulseId];
      if (v && this.hops.every((h) => h.view !== v)) v.mesh.scale.setScalar(v.baseScale);
    }
    this.pulseId = id;
  }

  update(dt: number): void {
    this.t += dt;

    for (let i = this.hops.length - 1; i >= 0; i--) {
      const h = this.hops[i];
      const a = h.points[h.seg];
      const b = h.points[h.seg + 1];
      h.t += (dt * 1000) / h.perSeg; // perSeg é em milissegundos
      const k = Math.min(1, h.t);
      h.view.mesh.position.set(
        THREE.MathUtils.lerp(a.x, b.x, k),
        THREE.MathUtils.lerp(a.y, b.y, k) + Math.sin(Math.PI * k) * h.arc,
        THREE.MathUtils.lerp(a.z, b.z, k)
      );
      const sq = 1 + Math.sin(Math.PI * k) * 0.06;
      h.view.mesh.scale.set(h.view.baseScale / sq, h.view.baseScale * sq, h.view.baseScale / sq);
      if (h.t >= 1) {
        h.tick(h.seg + 1, h.points.length - 1);
        h.seg++;
        h.t = 0;
        if (h.seg >= h.points.length - 1) {
          this.hops.splice(i, 1);
          h.view.mesh.scale.setScalar(h.view.baseScale);
          h.onDone();
        }
      }
    }

    if (this.pulseId !== null) {
      const v = this.views[this.pulseId];
      if (v && this.hops.every((h) => h.view !== v)) {
        v.mesh.scale.setScalar(v.baseScale * (1 + Math.sin(this.t * 7) * 0.07));
      }
    }
  }

  dispose(): void {
    if (this.views.length) {
      this.views[0].mesh.geometry.dispose();
      this.mats.forEach((m) => m.dispose());
    }
  }
}
