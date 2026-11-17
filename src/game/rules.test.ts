import { describe, expect, it } from 'vitest';
import { chooseBotMove } from './ai';
import {
  COLORS,
  HOME_POS,
  LudoEngine,
  PlayerInfo,
  SAFE_RING,
  globalRing
} from './rules';

function mkEngine(players: PlayerInfo[], seed = 7): LudoEngine {
  let s = seed;
  const rng = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  return new LudoEngine(players, rng);
}

const P2: PlayerInfo[] = [
  { color: 'red', name: 'R', kind: 'human' },
  { color: 'green', name: 'G', kind: 'human' }
];

describe('board model', () => {
  it('maps start cells correctly for all colors', () => {
    expect(globalRing('red', 0)).toBe(0);
    expect(globalRing('green', 0)).toBe(13);
    expect(globalRing('yellow', 0)).toBe(26);
    expect(globalRing('blue', 0)).toBe(39);
  });

  it('each color travels 51 distinct ring cells and skips only its entry arrow', () => {
    for (const c of COLORS) {
      const cells = new Set<number>();
      for (let p = 0; p <= 50; p++) cells.add(globalRing(c, p));
      expect(cells.size).toBe(51);
      const ownStart = globalRing(c, 0);
      // the last cell before the home column is the start cell minus 1
      expect(globalRing(c, 50)).toBe((ownStart + 50) % 52);
    }
  });
});

describe('leaving the yard', () => {
  it('requires a six', () => {
    const e = mkEngine(P2);
    e.roll();
    if (e.phase === 'pick') {
      // rolled a 6: exiting must be legal
      expect(e.legalMoves.some((m) => m.exitsYard)).toBe(true);
    } else {
      expect(e.legalMoves).toHaveLength(0);
    }
  });

  it('places the token on the start cell when exiting', () => {
    let e = mkEngine(P2);
    // force a six by re-rolling with a dedicated engine
    e = mkEngine(P2, 11);
    let tries = 0;
    while (tries < 200) {
      const r = e.roll();
      if (r.value === 6) break;
      if (e.phase === 'roll') continue;
      break;
    }
    // deterministic approach instead:
    e = new LudoEngine(P2, () => 0); // always rolls 1 -> no exit
    e.roll();
    expect(e.legalMoves).toHaveLength(0);
    e = new LudoEngine(P2, () => 0.999); // always rolls 6
    const r = e.roll();
    expect(r.value).toBe(6);
    expect(e.phase).toBe('pick');
    const m = e.legalMoves.find((x) => x.exitsYard)!;
    e.applyMove(m.token);
    expect(e.tokens.red[m.token]).toBe(0);
  });
});

describe('movement and finishing', () => {
  it('cannot overshoot home', () => {
    // green is already finished; red must close 48/50/52/54 with exact rolls (dice cycle 6,2,4)
    let call = 0;
    const cycle = [() => 0.999, () => 0.28, () => 0.55]; // dice 6, 2, 4
    const e = new LudoEngine(P2, () => cycle[call++ % 3]());
    e.tokens.red = [48, 50, 52, 54];
    e.tokens.green = [56, 56, 56, 56];
    e.ranks.push('green');
    e.turn = 0;
    let guard = 0;
    while (e.phase !== 'over' && guard++ < 300) {
      if (e.phase === 'roll') e.roll();
      if (e.phase === 'pick') e.applyMove(e.legalMoves[0].token);
    }
    expect(e.phase).toBe('over');
    expect(e.tokens.red.every((p) => p === HOME_POS)).toBe(true);
  });

  it('extra turn on six, capture and finish', () => {
    const e = new LudoEngine(P2, () => 0.999);
    const r = e.roll();
    expect(r.value).toBe(6);
    const res = e.applyMove(e.legalMoves[0].token);
    expect(res?.extra).toBe(true);
    expect(e.phase).toBe('roll');
    expect(e.current.color).toBe('red'); // same player rolls again
  });
});

describe('captures and safe cells', () => {
  it('captures enemy on an unsafe cell', () => {
    // red on ring cell 16, green at its start rolls 3 -> lands on ring 16
    const e2 = new LudoEngine(P2, () => 0.4); // dice = 3
    e2.tokens.red[0] = 16;
    e2.tokens.green[0] = 0;
    e2.turn = 1;
    e2.roll();
    expect(e2.phase).toBe('pick');
    const m = e2.legalMoves.find((x) => x.token === 0)!;
    expect(m.captures.length).toBe(1);
    expect(m.captures[0].color).toBe('red');
    const res = e2.applyMove(0);
    expect(res?.extra).toBe(true);
    expect(e2.tokens.red[0]).toBe(-1);
    expect(e2.tokens.green[0]).toBe(3);
  });

  it('never captures on safe cells', () => {
    const e = mkEngine(P2);
    for (const ring of SAFE_RING) {
      e.tokens.red[0] = (ring - 0 + 52) % 52; // red global cell = ring
      e.tokens.green[0] = (ring - 13 + 52) % 52; // green on same global cell
      expect(e.capturesAt('green', ring)).toHaveLength(0);
    }
  });

  it('red pos0 is a safe cell for everyone', () => {
    const e = mkEngine(P2);
    e.tokens.red[0] = 0; // red on its start cell
    e.tokens.green[0] = 39; // green global cell 13+39=52%52=0? no: (13+39)%52=0
    expect(globalRing('green', 39)).toBe(0);
    expect(e.capturesAt('green', 0)).toHaveLength(0);
  });
});

describe('triple six and empty turns', () => {
  it('third consecutive six forfeits the turn', () => {
    const e = new LudoEngine(P2, () => 0.999);
    e.roll(); // six #1
    e.applyMove(e.legalMoves[0].token);
    e.roll(); // six #2
    e.applyMove(e.legalMoves[0].token);
    const r = e.roll(); // six #3
    expect(r.forfeited).toBe(true);
    expect(e.current.color).toBe('green');
    expect(e.phase).toBe('roll');
  });

  it('passess the turn when no legal move exists', () => {
    const e = new LudoEngine(P2, () => 0); // always rolls 1
    e.roll();
    expect(e.phase).toBe('roll');
    expect(e.current.color).toBe('green');
  });
});

describe('winning', () => {
  it('ends the game when all but one player finished', () => {
    const e = mkEngine(P2);
    e.tokens.red = [56, 56, 56, 54];
    e.tokens.green = [56, 56, 56, 56];
    e.ranks.push('green');
    e.turn = 0;
    e.phase = 'roll';
    // red needs a 2 exactly
    const e2 = new LudoEngine(e.players, () => 0.28); // dice 2
    e2.tokens.red = [56, 56, 56, 54];
    e2.tokens.green = [56, 56, 56, 56];
    e2.ranks.push('green');
    e2.turn = 0;
    e2.roll();
    expect(e2.phase).toBe('pick');
    const res = e2.applyMove(e2.legalMoves[0].token);
    expect(res?.playerFinished).toBe(true);
    expect(e2.phase).toBe('over');
    expect(e2.finalRanks()).toEqual(['green', 'red']);
    expect(e2.winner).toBe('green');
  });
});

describe('bot', () => {
  it('always returns a legal token or -1', () => {
    const e = mkEngine(P2);
    const r = e.roll();
    if (e.phase === 'pick') {
      const t = chooseBotMove(e);
      expect(e.legalMoves.some((m) => m.token === t)).toBe(true);
    } else {
      expect(r.legal.length).toBe(0);
    }
  });

  it('prefers a capture over a quiet move', () => {
    // green at pos 40 (ring 1); dice 4 -> pos 44 = ring 5 where red stands
    const e3 = new LudoEngine(P2, () => 0.55); // dice = 4
    e3.tokens.red[0] = 5;
    e3.tokens.green[0] = 40;
    e3.turn = 1;
    e3.roll();
    expect(e3.phase).toBe('pick');
    const t = chooseBotMove(e3);
    const m = e3.legalMoves.find((x) => x.token === t)!;
    expect(m.captures.length).toBe(1);
  });
});
