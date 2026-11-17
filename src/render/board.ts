import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  BASE_CENTER,
  ENTRY_RING,
  HOME_COL,
  HOME_DIR,
  STAR_IDX,
  START_IDX,
  TRACK,
  cellOfPos,
  type GridCell
} from '../engine/board';
import type { ColorId } from '../engine/types';
import { COLOR_HEX, shade } from './palette';

export const SLAB_TOP = 0.6;
export const TILE_H = 0.12;
export const TILE_TOP = SLAB_TOP + TILE_H;          // 0.72
export const PLATFORM_TOP = SLAB_TOP + 0.18;        // 0.78
export const PAD_TOP = PLATFORM_TOP + 0.06;         // 0.84

export function worldOfGrid(c: number, r: number, y = 0): THREE.Vector3 {
  return new THREE.Vector3(c - 7, y, r - 7);
}

const IVORY = '#f6efdd';

function canvasTex(draw: (ctx: CanvasRenderingContext2D, s: number) => void, size = 256): THREE.CanvasTexture {
  const cnv = document.createElement('canvas');
  cnv.width = cnv.height = size;
  const ctx = cnv.getContext('2d')!;
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(cnv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number, inner: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? outer : inner;
    const x = cx + Math.cos(ang) * rad;
    const y = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function tileTexture(kind: 'plain' | 'start' | 'star' | 'entry' | 'home', color?: string, rotDeg = 0): THREE.CanvasTexture {
  return canvasTex((ctx, s) => {
    const base = color ?? IVORY;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);

    // sombra interna suave (aspecto de plástico injetado)
    const grad = ctx.createLinearGradient(0, 0, 0, s);
    grad.addColorStop(0, 'rgba(255,255,255,0.14)');
    grad.addColorStop(1, 'rgba(0,0,0,0.10)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);

    // moldura interna
    ctx.strokeStyle = color ? shade(base, 0.82) : '#ddd2b6';
    ctx.lineWidth = 10;
    rr(ctx, 12, 12, s - 24, s - 24, 16);
    ctx.stroke();

    if (kind === 'start') {
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      starPath(ctx, s / 2, s / 2, s * 0.26, s * 0.11);
      ctx.fill();
    } else if (kind === 'star') {
      ctx.fillStyle = '#4d5a75';
      starPath(ctx, s / 2, s / 2, s * 0.27, s * 0.115);
      ctx.fill();
    } else if (kind === 'entry') {
      // seta branca apontando para o centro do tabuleiro (rotação por quadrante)
      ctx.save();
      ctx.translate(s / 2, s / 2);
      ctx.rotate((rotDeg * Math.PI) / 180);
      ctx.translate(-s / 2, -s / 2);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.moveTo(s / 2, s * 0.24);
      ctx.lineTo(s * 0.76, s * 0.62);
      ctx.lineTo(s * 0.62, s * 0.62);
      ctx.lineTo(s * 0.62, s * 0.78);
      ctx.lineTo(s * 0.38, s * 0.78);
      ctx.lineTo(s * 0.38, s * 0.62);
      ctx.lineTo(s * 0.24, s * 0.62);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  });
}

/** Textura do centro: 4 triângulos coloridos apontando ao centro */
function centerTexture(colors: string[]): THREE.CanvasTexture {
  return canvasTex((ctx, s) => {
    ctx.fillStyle = IVORY;
    ctx.fillRect(0, 0, s, s);
    const m = 6; // margem
    const tri = (pts: [number, number][], color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(pts[0][0] * s, pts[0][1] * s);
      ctx.lineTo(pts[1][0] * s, pts[1][1] * s);
      ctx.lineTo(pts[2][0] * s, pts[2][1] * s);
      ctx.closePath();
      ctx.fill();
    };
    // esquerda = quadrante 0 (verde), topo = 1 (amarelo), direita = 2 (azul), fundo = 3 (vermelho)
    tri([[m / s, m / s], [m / s, 1 - m / s], [0.5, 0.5]], colors[0]);
    tri([[m / s, m / s], [1 - m / s, m / s], [0.5, 0.5]], colors[1]);
    tri([[1 - m / s, m / s], [1 - m / s, 1 - m / s], [0.5, 0.5]], colors[2]);
    tri([[m / s, 1 - m / s], [1 - m / s, 1 - m / s], [0.5, 0.5]], colors[3]);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 8;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(m, m);
      ctx.lineTo(m, s - m);
      ctx.lineTo(s - m, s - m);
      ctx.lineTo(s - m, m);
      ctx.closePath();
      ctx.stroke();
    }
  });
}

export interface BoardView {
  group: THREE.Group;
  worldOfGrid(c: number, r: number, y?: number): THREE.Vector3;
  posWorld(slot: number, pos: number): THREE.Vector3;
  yardWorld(slot: number, pad: number): THREE.Vector3;
  homePileWorld(slot: number, i: number): THREE.Vector3;
  slotGlows: THREE.Mesh[];
}

/** Constrói todo o tabuleiro 3D estático (estilo Ludo King: casas brilhantes e biseladas) */
export function buildBoard(colorIds: readonly ColorId[]): BoardView {
  const group = new THREE.Group();

  const hexOf = (slot: number) => COLOR_HEX[colorIds[slot]];

  // ---- base do tabuleiro ----
  const slab = new THREE.Mesh(
    new RoundedBoxGeometry(15.35, 0.7, 15.35, 4, 0.1),
    new THREE.MeshPhysicalMaterial({
      color: 0xefe6cf,
      roughness: 0.32,
      metalness: 0.02,
      clearcoat: 0.8,
      clearcoatRoughness: 0.25
    })
  );
  slab.position.y = 0.25;
  slab.castShadow = true;
  slab.receiveShadow = true;
  group.add(slab);

  // ---- casas ----
  const tileGeo = new THREE.BoxGeometry(0.94, TILE_H, 0.94);
  const buckets = new Map<string, { mat: THREE.MeshPhysicalMaterial; geos: THREE.BufferGeometry[] }>();

  const push = (key: string, mat: THREE.MeshPhysicalMaterial, cell: GridCell, y: number) => {
    let b = buckets.get(key);
    if (!b) {
      b = { mat, geos: [] };
      buckets.set(key, b);
    }
    const g = tileGeo.clone().translate(cell[0] - 7, y, cell[1] - 7);
    b.geos.push(g);
  };

  const yTile = SLAB_TOP + TILE_H / 2;
  const ringToCell = new Map<string, number>();
  TRACK.forEach((cell, idx) => ringToCell.set(`${cell[0]},${cell[1]}`, idx));

  const matPlain = new THREE.MeshPhysicalMaterial({ map: tileTexture('plain'), roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.28 });
  const matStar = new THREE.MeshPhysicalMaterial({ map: tileTexture('star'), roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.28 });

  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      const inCenter = c >= 6 && c <= 8 && r >= 6 && r <= 8;
      if (inCenter) continue;
      const inBase =
        (c <= 5 && r <= 5) || (c >= 9 && r <= 5) || (c >= 9 && r >= 9) || (c <= 5 && r >= 9);
      if (inBase) continue;

      const key = `${c},${r}`;
      const ring = ringToCell.get(key);
      if (ring === undefined) continue;

      const slotOfStart = START_IDX.indexOf(ring as 0 | 13 | 26 | 39);
      const slotOfEntry = ENTRY_RING.indexOf(ring);
      const slotOfStar = STAR_IDX.indexOf(ring as 8 | 21 | 34 | 47);

      if (slotOfStart >= 0) {
        const slot = slotOfStart;
        const hex = hexOf(slot);
        push(`start${slot}`, new THREE.MeshPhysicalMaterial({ map: tileTexture('start', hex), roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.28 }), [c, r], yTile);
      } else if (slotOfEntry >= 0) {
        const slot = slotOfEntry;
        const hex = hexOf(slot);
        // seta aponta para dentro: esquerda->direita(90), topo->baixo(180), direita->esquerda(270), fundo->cima(0)
        const rot = [90, 180, 270, 0][slot];
        push(`entry${slot}`, new THREE.MeshPhysicalMaterial({ map: tileTexture('entry', hex, rot), roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.28 }), [c, r], yTile);
      } else if (slotOfStar >= 0) {
        push('star', matStar, [c, r], yTile);
      } else {
        push('plain', matPlain, [c, r], yTile);
      }
    }
  }

  // retas finais coloridas
  for (let slot = 0; slot < 4; slot++) {
    const hex = hexOf(slot);
    const mat = new THREE.MeshPhysicalMaterial({ map: tileTexture('home', hex), roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.28 });
    for (const cell of HOME_COL[slot]) push(`home${slot}`, mat, cell, yTile);
  }

  for (const [, b] of buckets) {
    const merged = mergeGeometries(b.geos);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, b.mat);
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // ---- centro (triângulos) ----
  const centerColors = [0, 1, 2, 3].map((s) => hexOf(s));
  const centerTile = new THREE.Mesh(
    new THREE.BoxGeometry(2.9, TILE_H, 2.9),
    new THREE.MeshPhysicalMaterial({ map: centerTexture(centerColors), roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.28 })
  );
  centerTile.position.set(0, yTile, 0);
  centerTile.receiveShadow = true;
  group.add(centerTile);

  // ---- plataformas das bases ----
  const slotGlows: THREE.Mesh[] = [];
  for (let slot = 0; slot < 4; slot++) {
    const hex = hexOf(slot);
    const bc = BASE_CENTER[slot];
    const platform = new THREE.Mesh(
      new RoundedBoxGeometry(5.72, 0.18, 5.72, 4, 0.09),
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(hex),
        roughness: 0.34,
        clearcoat: 0.7,
        clearcoatRoughness: 0.3
      })
    );
    platform.position.set(bc[0] - 7, SLAB_TOP + 0.09, bc[1] - 7);
    platform.castShadow = true;
    platform.receiveShadow = true;
    group.add(platform);

    // 4 almofadas circulares para as peças na base
    const padMat = new THREE.MeshPhysicalMaterial({ color: 0xf3ecd9, roughness: 0.4, clearcoat: 0.4 });
    for (const [dx, dz] of [[-1.35, -1.35], [1.35, -1.35], [-1.35, 1.35], [1.35, 1.35]]) {
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 28), padMat);
      pad.position.set(bc[0] + dx - 7, PLATFORM_TOP + 0.03, bc[1] + dz - 7);
      pad.receiveShadow = true;
      group.add(pad);
    }

    // anel de brilho para indicar o jogador da vez
    const glow = new THREE.Mesh(
      new THREE.RingGeometry(2.52, 2.78, 56),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(hex), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(bc[0] - 7, PLATFORM_TOP + 0.02, bc[1] - 7);
    group.add(glow);
    slotGlows.push(glow);
  }

  const yardWorld = (slot: number, pad: number): THREE.Vector3 => {
    const bc = BASE_CENTER[slot];
    const offs: [number, number][] = [[-1.35, -1.35], [1.35, -1.35], [-1.35, 1.35], [1.35, 1.35]];
    const [dx, dz] = offs[pad];
    return worldOfGrid(bc[0] + dx, bc[1] + dz, PAD_TOP);
  };

  const homePileWorld = (slot: number, i: number): THREE.Vector3 => {
    const [dc, dr] = HOME_DIR[slot];
    const perp = [-dr, dc];
    const spread = [-0.34, -0.115, 0.115, 0.34][i];
    return new THREE.Vector3(dc * 0.75 + perp[0] * spread, TILE_TOP, dr * 0.75 + perp[1] * spread);
  };

  return {
    group,
    worldOfGrid,
    posWorld(slot: number, pos: number): THREE.Vector3 {
      const cell = cellOfPos(slot, pos);
      return cell ? worldOfGrid(cell[0], cell[1], TILE_TOP) : worldOfGrid(7, 7, TILE_TOP);
    },
    yardWorld,
    homePileWorld,
    slotGlows
  };
}
