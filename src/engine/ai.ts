import { LAST_RING_POS, ringIndexOf } from './board';
import type { GameState, MoveOption } from './types';

/**
 * IA simples e eficiente: pontua cada jogada legal e escolhe a melhor.
 * Prioriza: chegar ao centro > capturar > sair da base > entrar na reta final > casas seguras > fugir de perigo.
 */
export function chooseMove(state: GameState, moves: MoveOption[]): MoveOption {
  if (moves.length === 1) return moves[0];
  let best = moves[0];
  let bestScore = -Infinity;
  for (const m of moves) {
    const s = scoreMove(state, m) + Math.random() * 3;
    if (s > bestScore) {
      bestScore = s;
      best = m;
    }
  }
  return best;
}

function onTrackCount(state: GameState, owner: number): number {
  return state.tokens.filter((t) => t.owner === owner && t.pos >= 0 && t.pos <= LAST_RING_POS).length;
}

/** Uma peça em `pos` do quadrante `slot` corre risco de captura (adversário a 1..6 casas atrás)? */
function threatened(state: GameState, owner: number, slot: number, pos: number): boolean {
  const myRing = ringIndexOf(slot, pos);
  if (myRing === null) return false;
  for (const t of state.tokens) {
    if (t.owner === owner) continue;
    if (t.pos < 0 || t.pos > LAST_RING_POS) continue;
    const ri = ringIndexOf(state.players[t.owner].slot, t.pos);
    if (ri === null) continue;
    const dist = (myRing - ri + 52) % 52;
    if (dist >= 1 && dist <= 6) return true;
  }
  return false;
}

function scoreMove(state: GameState, m: MoveOption): number {
  const owner = state.turn;
  const slot = state.players[owner].slot;
  let s = 0;
  if (m.finishes) s += 130;
  s += m.captures.length * 115;
  if (m.leavesYard) s += 55 + (onTrackCount(state, owner) <= 1 ? 25 : 0);
  if (m.entersHomeCol) s += 35;
  if (m.to > LAST_RING_POS) s += (m.to - LAST_RING_POS) * 1.5;
  if (m.toSafe) s += 22;
  if (m.from >= 0 && m.from <= LAST_RING_POS && threatened(state, owner, slot, m.from)) s += 14;
  if (!m.toSafe && m.to <= LAST_RING_POS && threatened(state, owner, slot, m.to)) s -= 14;
  s += m.to * 0.15;
  return s;
}
