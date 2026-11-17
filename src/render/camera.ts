import * as THREE from 'three';
import { Color } from '../game/rules';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const AZIMUTH: Record<Color, number> = {
  red: Math.atan2(-4.5, 4.5),   // bottom-left
  green: Math.atan2(-4.5, -4.5), // top-left
  yellow: Math.atan2(4.5, -4.5), // top-right
  blue: Math.atan2(4.5, 4.5)     // bottom-right
};

const easeInOut = (u: number): number => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

/**
 * Cinematic camera: OrbitControls with smooth authored transitions.
 * - `focusColor` glides the camera to a 3/4 view from the active player's side.
 * - `menuOrbit` enables a slow showcase rotation for the main menu.
 */
export class CinCam {
  controls: OrbitControls;
  private tween: { t: number; dur: number; fromTheta: number; toTheta: number; fromPhi: number; toPhi: number; fromR: number; toR: number } | null = null;
  private target = new THREE.Vector3(0, 0.2, 0);

  constructor(controls: OrbitControls, camera: THREE.PerspectiveCamera) {
    this.controls = controls;
    // initial showcase position
    camera.position.set(Math.sin(0.8) * 21, 15, Math.cos(0.8) * 21);
    controls.update();
  }

  menuOrbit(on: boolean): void {
    this.controls.autoRotate = on;
    this.controls.enabled = true;
    if (on) {
      this.tween = null;
      const sph = this.spherical();
      this.applySpherical(sph.theta, 0.72, 25);
    }
  }

  private spherical(): { theta: number; phi: number; r: number } {
    const off = this.controls.object.position.clone().sub(this.target);
    const sph = new THREE.Spherical().setFromVector3(off);
    return { theta: sph.theta, phi: sph.phi, r: sph.radius };
  }

  private applySpherical(theta: number, phi: number, r: number): void {
    const sph = new THREE.Spherical(r, phi, theta);
    const pos = new THREE.Vector3().setFromSpherical(sph).add(this.target);
    this.controls.object.position.copy(pos);
    this.controls.target.copy(this.target);
    this.controls.update();
  }

  focusColor(color: Color, radius = 20): void {
    const cur = this.spherical();
    let to = AZIMUTH[color];
    // shortest angular path
    const TWO_PI = Math.PI * 2;
    let d = (to - cur.theta) % TWO_PI;
    if (d > Math.PI) d -= TWO_PI;
    if (d < -Math.PI) d += TWO_PI;
    this.tween = {
      t: 0,
      dur: 0.95,
      fromTheta: cur.theta,
      toTheta: cur.theta + d,
      fromPhi: cur.phi,
      toPhi: 0.66,
      fromR: cur.r,
      toR: radius
    };
    this.controls.autoRotate = false;
  }


  update(dt: number): void {
    if (!this.tween) return;
    const tw = this.tween;
    tw.t += dt;
    const u = Math.min(1, tw.t / tw.dur);
    const e = easeInOut(u);
    this.applySpherical(
      tw.fromTheta + (tw.toTheta - tw.fromTheta) * e,
      tw.fromPhi + (tw.toPhi - tw.fromPhi) * e,
      tw.fromR + (tw.toR - tw.fromR) * e
    );
    if (u >= 1) this.tween = null;
  }

  get busy(): boolean {
    return this.tween !== null;
  }
}
