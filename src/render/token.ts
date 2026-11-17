import * as THREE from 'three';
import { Color } from '../game/rules';
import { PALETTE } from './board';

/** Glossy 3D ludo pawn built from a lathe profile. */
export class Token3D {
  mesh: THREE.Mesh;
  color: Color;
  index: number;
  private baseEmissive = 0x000000;
  highlighted = false;
  private pulseT = 0;

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
      roughness: 0.22,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1.1,
      emissive: 0x000000,
      emissiveIntensity: 0.5
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = false;
    this.mesh.scale.setScalar(1.18);
  }

  get position(): THREE.Vector3 {
    return this.mesh.position;
  }

  setHighlighted(on: boolean): void {
    this.highlighted = on;
    if (!on) {
      (this.mesh.material as THREE.MeshPhysicalMaterial).emissive.setHex(this.baseEmissive);
      const marker = this.mesh.userData.marker as THREE.Object3D | undefined;
      if (marker) marker.visible = false;
    }
  }

  /** Call every frame: pulsing highlight + marker bobbing. */
  update(dt: number, t: number): void {
    if (!this.highlighted) return;
    const mat = this.mesh.material as THREE.MeshPhysicalMaterial;
    const k = 0.5 + 0.5 * Math.sin(t * 5.2);
    mat.emissive.setHex(0xfff0c4).multiplyScalar(0.35 + 0.65 * k);
    const marker = this.mesh.userData.marker as THREE.Object3D | undefined;
    if (marker && marker.visible) {
      marker.position.y = 0.95 + Math.sin(t * 4.5) * 0.08;
      marker.rotation.y += dt * 2.2;
    }
  }
}

/** Floating cone marker that sits above a movable token. */
export function makeMarker(): THREE.Mesh {
  const geo = new THREE.ConeGeometry(0.13, 0.3, 12);
  geo.rotateX(Math.PI); // point down
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffd764, emissive: 0x8a5a00, emissiveIntensity: 0.8, roughness: 0.3, clearcoat: 0.8 });
  const m = new THREE.Mesh(geo, mat);
  m.visible = false;
  return m;
}
