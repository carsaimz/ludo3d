import * as THREE from 'three';
import { Color } from '../game/rules';

/** World position helper: board is 15x15 cells centered at origin. */
export function cellWorld(col: number, row: number): THREE.Vector2 {
  return new THREE.Vector2(col - 7, row - 7);
}

/** The 52 ring cells (col,row), index 0 = red start. See rules.ts START_INDEX. */
export const RING_CELLS: [number, number][] = [
  [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],
  [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  [0, 7], [0, 6],
  [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
  [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],
  [7, 0],
  [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
  [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6],
  [14, 7], [14, 8],
  [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],
  [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],
  [7, 14],
  [6, 14]
];

/** 5 home column cells per color, in travel order (then the center). */
export const HOME_CELLS: Record<Color, [number, number][]> = {
  red: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  green: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  yellow: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  blue: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]]
};

/** Yard centers per color (world coords). */
export const YARD_CENTER: Record<Color, THREE.Vector2> = {
  red: cellWorld(2.5, 11.5),
  green: cellWorld(2.5, 2.5),
  yellow: cellWorld(11.5, 2.5),
  blue: cellWorld(11.5, 11.5)
};

/** Yard slots (offsets around the yard center) for the 4 tokens. */
export const YARD_SLOT = [new THREE.Vector2(-0.95, -0.95), new THREE.Vector2(0.95, -0.95), new THREE.Vector2(0.95, 0.95), new THREE.Vector2(-0.95, 0.95)];

export const PALETTE: Record<Color, number> = {
  red: 0xe0393b,
  green: 0x3fa344,
  yellow: 0xf6c62e,
  blue: 0x2472d4
};

export const STAR_CELLS = new Set([8, 21, 34, 47]);

export interface BoardRefs {
  group: THREE.Group;
  tokenSlots: Record<Color, THREE.Vector3[]>;
}

function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function starShape(r: number): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

function arrowShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-0.16, -0.22);
  s.lineTo(0.16, -0.22);
  s.lineTo(0.16, 0.02);
  s.lineTo(0.28, 0.02);
  s.lineTo(0, 0.28);
  s.lineTo(-0.28, 0.02);
  s.lineTo(-0.16, 0.02);
  s.closePath();
  return s;
}

/** Materials */
function mat(color: number, opts: Partial<THREE.MeshPhysicalMaterialParameters> = {}): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25, envMapIntensity: 0.7, ...opts });
}

export function buildBoard(): BoardRefs {
  const group = new THREE.Group();

  // ---- outer frame (ring with a hole so the playing surface shows through) ----
  const frameShape = roundedRectShape(16.7, 16.7, 1.3);
  const holePath = new THREE.Path();
  const holePts = roundedRectShape(15.0, 15.0, 0.7).getPoints(64);
  holePath.setFromPoints(holePts);
  frameShape.holes.push(holePath);
  const frameGeo = new THREE.ExtrudeGeometry(frameShape, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 4 });
  const frame = new THREE.Mesh(frameGeo, mat(0x14243c, { roughness: 0.3, clearcoat: 0.9, metalness: 0.15, envMapIntensity: 1.0 }));
  frame.rotation.x = -Math.PI / 2;
  frame.position.y = -0.7; // extrusion runs upward: ring spans y -0.7 .. +0.3
  frame.castShadow = true;
  frame.receiveShadow = true;
  group.add(frame);

  // ---- playing surface ----
  const surfGeo = new THREE.ExtrudeGeometry(roundedRectShape(15.2, 15.2, 0.7), { depth: 0.16, bevelEnabled: false });
  const surf = new THREE.Mesh(surfGeo, mat(0xf3ead9, { roughness: 0.55, clearcoat: 0.25 }));
  surf.rotation.x = -Math.PI / 2;
  surf.position.y = -0.02;
  surf.receiveShadow = true;
  group.add(surf);

  // ---- quadrant yard panels ----
  const yardGeo = new THREE.ExtrudeGeometry(roundedRectShape(5.9, 5.9, 0.9), { depth: 0.06, bevelEnabled: false });
  const yardCircleGeo = new THREE.CylinderGeometry(1.95, 1.95, 0.07, 48);
  const tokenSlots: Record<Color, THREE.Vector3[]> = { red: [], green: [], yellow: [], blue: [] };
  (Object.keys(YARD_CENTER) as Color[]).forEach((c) => {
    const panel = new THREE.Mesh(yardGeo, mat(PALETTE[c], { roughness: 0.38 }));
    panel.rotation.x = -Math.PI / 2;
    const pos = YARD_CENTER[c];
    panel.position.set(pos.x, 0.145, pos.y);
    panel.receiveShadow = true;
    group.add(panel);

    const circle = new THREE.Mesh(yardCircleGeo, mat(0xfbf7ee, { roughness: 0.45 }));
    circle.position.set(pos.x, 0.2, pos.y);
    circle.receiveShadow = true;
    group.add(circle);

    for (const off of YARD_SLOT) {
      tokenSlots[c].push(new THREE.Vector3(pos.x + off.x, 0.25, pos.y + off.y));
    }
  });

  // ---- track tiles ----
  const tileGeo = new THREE.BoxGeometry(0.94, 0.1, 0.94);
  const tileWhite = mat(0xfdfaf2, { roughness: 0.5 });
  const startIdxOf: Record<number, Color> = { 0: 'red', 13: 'green', 26: 'yellow', 39: 'blue' };
  const coloredRing: Set<number> = new Set([0, 13, 26, 39]);
  // home column tiles per color
  const homeTileOfColor: Record<Color, Set<string>> = { red: new Set(), green: new Set(), yellow: new Set(), blue: new Set() };
  (Object.keys(HOME_CELLS) as Color[]).forEach((c) => {
    for (const [col, row] of HOME_CELLS[c]) homeTileOfColor[c].add(`${col},${row}`);
  });
  const colOfHomeTile = new Map<string, Color>();
  (Object.keys(HOME_CELLS) as Color[]).forEach((c) => {
    for (const [col, row] of HOME_CELLS[c]) colOfHomeTile.set(`${col},${row}`, c);
  });

  const addTile = (col: number, row: number, material: THREE.Material, y = 0.19) => {
    const w = cellWorld(col, row);
    const m = new THREE.Mesh(tileGeo, material);
    m.position.set(w.x, y, w.y);
    m.receiveShadow = true;
    m.castShadow = false;
    group.add(m);
  };

  RING_CELLS.forEach(([col, row], idx) => {
    if (coloredRing.has(idx)) {
      addTile(col, row, mat(PALETTE[startIdxOf[idx]]));
    } else if (colOfHomeTile.has(`${col},${row}`)) {
      addTile(col, row, mat(0xfdfaf2));
    } else {
      addTile(col, row, tileWhite);
    }
  });
  (Object.keys(HOME_CELLS) as Color[]).forEach((c) => {
    for (const [col, row] of HOME_CELLS[c]) addTile(col, row, mat(PALETTE[c]));
  });

  // ---- star emblems on safe cells ----
  const starGeo = new THREE.ExtrudeGeometry(starShape(0.26), { depth: 0.03, bevelEnabled: false });
  const starMat = mat(0x3c4a63, { roughness: 0.5, clearcoat: 0.2 });
  for (const idx of STAR_CELLS) {
    const [col, row] = RING_CELLS[idx];
    const w = cellWorld(col, row);
    const s = new THREE.Mesh(starGeo, starMat);
    s.rotation.x = -Math.PI / 2;
    s.position.set(w.x, 0.25, w.y);
    group.add(s);
  }

  // ---- start cell arrows (direction of travel) ----
  const arrowGeo = new THREE.ExtrudeGeometry(arrowShape(), { depth: 0.03, bevelEnabled: false });
  const arrowDirs: Record<Color, number> = { red: 0, green: -Math.PI / 2, yellow: Math.PI, blue: Math.PI / 2 };
  const arrowCells: Record<Color, THREE.Vector2> = {
    red: cellWorld(6, 13),
    green: cellWorld(1, 6),
    yellow: cellWorld(8, 1),
    blue: cellWorld(13, 8)
  };
  (Object.keys(arrowCells) as Color[]).forEach((c) => {
    const a = new THREE.Mesh(arrowGeo, mat(0x2b3244, { roughness: 0.5 }));
    a.rotation.x = -Math.PI / 2;
    a.rotation.z = arrowDirs[c];
    const p = arrowCells[c];
    a.position.set(p.x, 0.25, p.y);
    group.add(a);
  });

  // ---- center home area: 4 triangles ----
  const tri = (pts: [number, number][], color: number) => {
    const shape = new THREE.Shape();
    shape.moveTo(pts[0][0], pts[0][1]);
    shape.lineTo(pts[1][0], pts[1][1]);
    shape.lineTo(pts[2][0], pts[2][1]);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false });
    const m = new THREE.Mesh(g, mat(color, { roughness: 0.35 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, 0.17, 0);
    m.receiveShadow = true;
    return m;
  };
  // shape (x, y) maps to world (x, ?, -y) after rotateX(-PI/2):
  // base on the bottom edge (world z+1.5) needs shape y = -1.5
  group.add(tri([[-1.5, -1.5], [1.5, -1.5], [0, 0]], PALETTE.red));    // bottom edge (red column arrives from z+)
  group.add(tri([[-1.5, 1.5], [1.5, 1.5], [0, 0]], PALETTE.yellow));   // top edge (z-)
  group.add(tri([[-1.5, -1.5], [-1.5, 1.5], [0, 0]], PALETTE.green));  // left edge (x-)
  group.add(tri([[1.5, -1.5], [1.5, 1.5], [0, 0]], PALETTE.blue));     // right edge (x+)

  const centerPad = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.16, 24), mat(0x14243c, { roughness: 0.3, clearcoat: 0.9 }));
  centerPad.position.set(0, 0.25, 0);
  group.add(centerPad);

  return { group, tokenSlots };
}
