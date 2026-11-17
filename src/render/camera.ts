import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface CamTween {
  p0: THREE.Vector3;
  p1: THREE.Vector3;
  t0: THREE.Vector3;
  t1: THREE.Vector3;
  dur: number;
  t: number;
  onDone: (() => void) | null;
}

const SLOT_DIRS: THREE.Vector3[] = [
  new THREE.Vector3(-0.707, 0, -0.707),
  new THREE.Vector3(0.707, 0, -0.707),
  new THREE.Vector3(0.707, 0, 0.707),
  new THREE.Vector3(-0.707, 0, 0.707)
];

const OVERVIEW_POS = new THREE.Vector3(0, 14.6, 11.6);
const OVERVIEW_TGT = new THREE.Vector3(0, 0.4, 0);
const DICE_POS = new THREE.Vector3(0, 6.6, 5.0);
const DICE_TGT = new THREE.Vector3(0, 1.0, 0);

function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Câmera com transições cinematográficas (posição + alvo), vista lateral por jogador e modo de acompanhamento */
export class CameraRig {
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private tweens: CamTween[] = [];
  private followPos: THREE.Vector3 | null = null;
  private dragging = false;
  private dragged = false;
  private onDragStart: (() => void) | null = null;
  autoRotate = false;

  constructor(camera: THREE.PerspectiveCamera, controls: OrbitControls, canvas: HTMLElement) {
    this.camera = camera;
    this.controls = controls;
    canvas.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
  }

  setDragHandler(fn: (() => void) | null): void {
    this.onDragStart = fn;
  }

  private onDown = (): void => {
    this.dragging = true;
    this.dragged = false;
  };

  private onMove = (e: PointerEvent): void => {
    if (this.dragging && (e.buttons & 1 || e.pointerType === 'touch')) {
      if (!this.dragged) {
        this.dragged = true;
        if (this.followPos) this.followPos = null;
        this.onDragStart?.();
      }
    }
  };

  private onUp = (): void => {
    this.dragging = false;
  };

  /** Movimenta câmera + alvo com suavização */
  tweenTo(pos: THREE.Vector3, target: THREE.Vector3, dur = 1.0, onDone: (() => void) | null = null): void {
    this.tweens.push({
      p0: this.camera.position.clone(),
      p1: pos.clone(),
      t0: this.controls.target.clone(),
      t1: target.clone(),
      dur,
      t: 0,
      onDone
    });
    this.followPos = null;
  }

  overview(onDone: (() => void) | null = null): void {
    this.tweenTo(OVERVIEW_POS, OVERVIEW_TGT, 1.2, onDone);
  }

  slotView(slot: number, onDone: (() => void) | null = null): void {
    const pos = SLOT_DIRS[slot].clone().multiplyScalar(10.6).add(new THREE.Vector3(0, 9.4, 0));
    this.tweenTo(pos, OVERVIEW_TGT, 1.0, onDone);
  }

  diceView(onDone: (() => void) | null = null): void {
    this.tweenTo(DICE_POS, DICE_TGT, 0.9, onDone);
  }

  intro(onDone: (() => void) | null = null): void {
    this.camera.position.set(23, 25, 23);
    this.controls.target.set(0, 0.4, 0);
    this.tweenTo(OVERVIEW_POS, OVERVIEW_TGT, 2.3, onDone);
  }

  follow(worldPos: THREE.Vector3 | null): void {
    this.followPos = worldPos ? worldPos.clone() : null;
    if (this.followPos) this.tweens = [];
  }

  winOrbit(): void {
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 1.6;
  }

  stopOrbit(): void {
    this.controls.autoRotate = false;
  }

  update(dt: number): void {
    if (this.tweens.length) {
      const tw = this.tweens[0];
      tw.t += dt / tw.dur;
      const e = easeInOutCubic(Math.min(1, tw.t));
      this.camera.position.lerpVectors(tw.p0, tw.p1, e);
      this.controls.target.lerpVectors(tw.t0, tw.t1, e);
      if (tw.t >= 1) {
        this.tweens.shift();
        tw.onDone?.();
      }
    } else if (this.followPos) {
      const k = 1 - Math.exp(-6 * dt);
      const desired = this.followPos.clone().add(new THREE.Vector3(0, 0.6, 0));
      this.controls.target.lerp(desired, k);
    }
    this.controls.update();
  }

  isBusy(): boolean {
    return this.tweens.length > 0;
  }
}
