import * as THREE from 'three';
import { Color } from '../game/rules';
import { PALETTE } from './board';

/** Glossy 3D ludo pawn. Movable pawns breathe (scale + own-color glow) — no floating markers. */
export class Token3D {
  mesh: THREE.Mesh;
  color: Color;
  index: number;
  private baseScale = 1.32;
  private baseEmissive = 0x000000;
  highlighted = false;

  constructor(color: Color, index: number) {
    this.color = color;
    this.index = index;
    const pts: THREE.Vector2[] = [
      [0.0, 0.0], [0.30, 0.0], [0.305, 0.035], [0.24, 0.07], [0.165, 0.13],
      [0.12, 0.2], [0.1, 0.27], [0.095, 0.33], [0.13, 0.365], [0.15, 0.41],
      [0.11, 0.45], [0.075, 0.475], [0.115, 0.515], [0.15, 0.555], [0.115, 0.6],
      [0.0, 0.62]
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const geo = new THREE.LatheGeometry(pts, 28);
    const mat = new THREE.MeshPhysicalMaterial({
      color: PALETTE[color],
      roughness: 0.26,
      clearcoat: 1,
      clearcoatRoughness: 0.15,
      envMapIntensity: 0.45,
      emissive: this.baseEmissive,
      emissiveIntensity: 0.5
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = false;
    this.mesh.scale.setScalar(this.baseScale);
  }

  get position(): THREE.Vector3 {
    return this.mesh.position;
  }

  setHighlighted(on: boolean): void {
    this.highlighted = on;
    if (!on) {
      const mat = this.mesh.material as THREE.MeshPhysicalMaterial;
      mat.emissive.setHex(this.baseEmissive);
      this.mesh.scale.setScalar(this.baseScale);
    }
  }

  /** Call every frame: highlighted pawns breathe and glow in their own color. */
  update(dt: number, t: number): void {
    void dt;
    if (!this.highlighted) return;
    const mat = this.mesh.material as THREE.MeshPhysicalMaterial;
    const k = 0.5 + 0.5 * Math.sin(t * 5.2);
    mat.emissive.setHex(PALETTE[this.color]);
    mat.emissiveIntensity = 0.25 + 0.45 * k;
    this.mesh.scale.setScalar(this.baseScale * (1 + 0.09 * k));
  }
}
