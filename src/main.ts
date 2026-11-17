import './styles.css';
import * as THREE from 'three';
import { createStage } from './render/scene';
import { buildBoard } from './render/board';
import { PawnManager } from './render/pawn';
import { DiceView } from './render/dice';
import { CameraRig } from './render/camera';
import { FX } from './render/fx';
import { SLOT_COLORS } from './engine/board';
import { Hud } from './ui/hud';
import { Menu } from './ui/menu';
import { GameController } from './game';
import { sfx } from './audio';

const canvas = document.getElementById('gl') as HTMLCanvasElement;
const confettiCanvas = document.getElementById('confetti') as HTMLCanvasElement;
const menuRoot = document.getElementById('menu')!;

// ---- cena ----
const stage = createStage(canvas);
const board = buildBoard(SLOT_COLORS);
stage.scene.add(board.group);
const pawns = new PawnManager(stage.scene);
const dice = new DiceView();
stage.scene.add(dice.mesh);
const rig = new CameraRig(stage.camera, stage.controls, canvas);
const fx = new FX(stage.scene, confettiCanvas);

// ---- UI ----
const hud = new Hud(document.getElementById('hud')!, {
  onRoll: () => game.tryRoll(),
  onSound: () => applySound(),
  onCam: () => applyCam(),
  onPause: () => game.pause()
});
const menu = new Menu({
  onStart: (cfg) => {
    sfx.ensure();
    sfx.click();
    game.start(cfg);
  },
  onResume: () => {
    sfx.click();
    game.resume();
  },
  onRestart: () => {
    sfx.click();
    game.restart();
  },
  onQuit: () => {
    sfx.click();
    game.quit();
  },
  onAgain: () => {
    sfx.click();
    game.again();
  },
  onSound: () => applySound(),
  onCam: () => applyCam()
});

function applySound(): void {
  const on = game.toggleSound();
  hud.setSoundIcon(on);
  menu.setSoundIcon(on);
  sfx.ensure();
  sfx.click();
}

function applyCam(): void {
  game.toggleAutoCam();
  hud.setCamIcon(game.autoCamera);
  menu.setCamIcon(game.autoCamera);
  sfx.ensure();
  sfx.click();
}

const game = new GameController({ board, dice, pawns, fx, rig, hud, menu });

// hook de depuração/e2e
(window as unknown as Record<string, unknown>).__ludo = { game, dice, board, pawns, rig, camera: stage.camera };

// estado inicial dos ícones
sfx.enabled = localStorage.getItem('ludo3d.sound') !== '0';
hud.setSoundIcon(sfx.enabled);
hud.setCamIcon(game.autoCamera);
menu.setSoundIcon(sfx.enabled);
menu.setCamIcon(game.autoCamera);
menu.showMain();
rig.intro();

// ---- interação (toque/clique) ----
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let downX = 0;
let downY = 0;

canvas.addEventListener('pointerdown', (e) => {
  downX = e.clientX;
  downY = e.clientY;
  sfx.ensure();
});

canvas.addEventListener('pointerup', (e) => {
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 9) return; // era arrasto (órbita)
  if (!menuRoot.classList.contains('hidden')) return; // menus abertos
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, stage.camera);
  const targets: THREE.Object3D[] = [
    dice.mesh,
    ...pawns.views.filter((v) => v.mesh.visible).map((v) => v.mesh),
    ...fx.hintObjects()
  ];
  const hits = ray.intersectObjects(targets, true);
  for (const h of hits) {
    let o: THREE.Object3D | null = h.object;
    while (o) {
      if (o.userData.moveOpt !== undefined) {
        game.onHintPicked(o.userData.moveOpt);
        return;
      }
      if (typeof o.userData.tokenId === 'number') {
        game.onPawnPicked(o.userData.tokenId);
        return;
      }
      if (o === dice.mesh) {
        game.tryRoll();
        return;
      }
      o = o.parent;
    }
  }
});

// ---- loop principal ----
let last = performance.now();
let splashHidden = false;

function loop(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  fx.update(dt);
  rig.update(dt);
  stage.renderer.render(stage.scene, stage.camera);
  if (!splashHidden) {
    splashHidden = true;
    const sp = document.getElementById('splash')!;
    sp.classList.add('fade');
    window.setTimeout(() => sp.remove(), 700);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
