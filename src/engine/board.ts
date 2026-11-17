import type { ColorId } from './types';

export type GridCell = readonly [number, number];

/** Tamanho do anel comum do tabuleiro */
export const TRACK_LEN = 52;
/** Última posição do anel (casa de entrada da reta final) */
export const LAST_RING_POS = 50;
/** Posição final: centro do tabuleiro */
export const PATH_END = 56;

/** Índice no anel de cada casa de partida, por quadrante (horário) */
export const START_IDX = [0, 13, 26, 39] as const;
/** Casas seguras com estrela (8 casas após cada partida) */
export const STAR_IDX = [8, 21, 34, 47] as const;
/** Todas as casas seguras do anel */
export const SAFE_RING: ReadonlySet<number> = new Set<number>([...START_IDX, ...STAR_IDX]);

/**
 * Cores por quadrante (horário), no padrão do Ludo King:
 * 0 sup. esquerdo = verde, 1 sup. direito = amarelo, 2 inf. direito = azul, 3 inf. esquerdo = vermelho.
 * Ordem de jogo do Ludo King: vermelho -> verde -> amarelo -> azul (horário a partir do inf. esquerdo).
 */
export const SLOT_COLORS: readonly ColorId[] = ['green', 'yellow', 'blue', 'red'];

/** Quadrantes usados conforme o número de jogadores (diagonal no modo 2) */
export const SLOTS_BY_COUNT: Record<number, readonly number[]> = {
  2: [3, 1],
  3: [3, 0, 1],
  4: [3, 0, 1, 2]
};

/** Anel comum de 52 casas (col, row) numa grelha 15x15; movimento horário */
function buildTrack(): GridCell[] {
  const t: GridCell[] = [];
  for (let c = 1; c <= 5; c++) t.push([c, 6]);       // braço esquerdo, linha superior
  for (let r = 5; r >= 0; r--) t.push([6, r]);       // braço superior, coluna esquerda
  t.push([7, 0]);                                     // topo central
  for (let r = 0; r <= 5; r++) t.push([8, r]);       // braço superior, coluna direita
  for (let c = 9; c <= 14; c++) t.push([c, 6]);      // braço direito, linha superior
  t.push([14, 7]);                                    // direita central
  for (let c = 14; c >= 9; c--) t.push([c, 8]);      // braço direito, linha inferior
  for (let r = 9; r <= 14; r++) t.push([8, r]);      // braço inferior, coluna direita
  t.push([7, 14]);                                    // fundo central
  for (let r = 14; r >= 9; r--) t.push([6, r]);      // braço inferior, coluna esquerda
  for (let c = 5; c >= 0; c--) t.push([c, 8]);       // braço esquerdo, linha inferior
  t.push([0, 7]);                                     // esquerda central
  t.push([0, 6]);
  return t;
}

export const TRACK: readonly GridCell[] = buildTrack();

/** Índice no anel da casa de entrada da reta final de cada quadrante */
export const ENTRY_RING: readonly number[] = [0, 1, 2, 3].map((s) => (START_IDX[s] + 50) % TRACK_LEN);

/** Reta final exclusiva (5 casas) de cada quadrante, da entrada para o centro */
export const HOME_COL: readonly GridCell[][] = [
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]]
];

/** Centro (grelha) da base de cada quadrante */
export const BASE_CENTER: readonly GridCell[] = [
  [2.5, 2.5],
  [11.5, 2.5],
  [11.5, 11.5],
  [2.5, 11.5]
];

/** Direção (grelha) da reta final de cada quadrante, do centro para fora */
export const HOME_DIR: readonly GridCell[] = [
  [-1, 0],
  [0, -1],
  [1, 0],
  [0, 1]
];

/** Índice no anel correspondente a uma posição relativa de um quadrante (ou null se fora do anel) */
export function ringIndexOf(slot: number, pos: number): number | null {
  if (pos < 0 || pos > LAST_RING_POS) return null;
  return (START_IDX[slot] + pos) % TRACK_LEN;
}

/** A posição é uma casa segura (partida ou estrela)? */
export function isSafePos(slot: number, pos: number): boolean {
  const ri = ringIndexOf(slot, pos);
  return ri !== null && SAFE_RING.has(ri);
}

/** Célula da grelha de uma posição relativa (0..55); o centro (56) devolve null */
export function cellOfPos(slot: number, pos: number): GridCell | null {
  if (pos < 0 || pos > 55) return null;
  if (pos <= LAST_RING_POS) {
    const ri = ringIndexOf(slot, pos);
    return ri !== null ? TRACK[ri] : null;
  }
  return HOME_COL[slot][pos - LAST_RING_POS - 1];
}
