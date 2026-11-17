import { Color, LAST_RING, LudoEngine, Move, SAFE_RING, globalRing } from './rules';

/**
 * Heuristic bot: scores every legal move and picks the best one.
 * Priorities: captures, escaping danger, leaving the yard, entering the home
 * column, finishing, safe squares, then plain progress.
 */
export function chooseBotMove(engine: LudoEngine, rng: () => number = Math.random): number {
  const moves = engine.legalMoves;
  if (moves.length === 0) return -1;
  const color = engine.current.color;

  let best = moves[0];
  let bestScore = -Infinity;
  for (const m of moves) {
    const s = scoreMove(engine, color, m) + rng() * 1.5;
    if (s > bestScore) {
      bestScore = s;
      best = m;
    }
  }
  return best.token;
}

function scoreMove(engine: LudoEngine, color: Color, m: Move): number {
  let s = 0;

  if (m.exitsYard) s += 55;

  for (const cap of m.captures) {
    s += 90;
    s += Math.max(0, engine.tokens[cap.color][cap.token]) * 0.6;
  }

  if (m.finishes) s += 78;

  if (m.to >= 51 && m.from >= 0 && m.from <= LAST_RING) s += 38;

  const fromRing = m.from >= 0 && m.from <= LAST_RING ? globalRing(color, m.from) : -1;
  const toRing = m.to >= 0 && m.to <= LAST_RING ? globalRing(color, m.to) : -1;

  if (toRing >= 0) {
    if (SAFE_RING.has(toRing)) s += 20;
    else s -= 24 * engine.threatened(color, toRing);
  }
  if (fromRing >= 0 && !SAFE_RING.has(fromRing) && engine.threatened(color, fromRing) > 0) {
    s += 32; // escaping a threatened square
  }

  // Mild preference for advancing the leading token.
  s += m.to * 0.35;
  return s;
}
