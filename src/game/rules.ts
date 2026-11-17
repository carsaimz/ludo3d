/**
 * LUDO 3D - rules engine (pure, framework-free, deterministic via injectable RNG).
 *
 * Board model: classic 52-cell ring, each color enters at its own start cell,
 * walks 51 ring cells, then 5 home-column cells and finally the center (home).
 * A token position encodes:
 *   -1        -> in the yard (base)
 *   0..50     -> on the main ring (global cell = (START_INDEX[color] + pos) % 52)
 *   51..55    -> in its private home column
 *   56        -> home (finished)
 */

export type Color = 'red' | 'green' | 'yellow' | 'blue';
export const COLORS: Color[] = ['red', 'green', 'yellow', 'blue'];

/** Ring index of each color's start cell. */
export const START_INDEX: Record<Color, number> = { red: 0, green: 13, yellow: 26, blue: 39 };

/** Safe ring cells: the 4 colored start cells + the 4 star cells. Safe for every token. */
export const SAFE_RING = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

export const RING_LEN = 52;
export const LAST_RING = 50;
export const HOME_POS = 56;
export const TOKENS_PER_PLAYER = 4;

export type PlayerKind = 'human' | 'bot' | 'remote';

export interface PlayerInfo {
  color: Color;
  name: string;
  kind: PlayerKind;
}

export interface Move {
  token: number;
  from: number;
  to: number;
  captures: { color: Color; token: number }[];
  finishes: boolean;
  exitsYard: boolean;
}

export interface MoveResult {
  color: Color;
  move: Move;
  extra: boolean;
  playerFinished: boolean;
}

export type Phase = 'roll' | 'pick' | 'moving' | 'over';

export interface Snapshot {
  players: PlayerInfo[];
  turn: number;
  dice: number | null;
  sixes: number;
  tokens: Record<Color, number[]>;
  ranks: Color[];
  phase: Phase;
  legal: number[];
}

export function globalRing(color: Color, pos: number): number {
  return pos >= 0 && pos <= LAST_RING ? (START_INDEX[color] + pos) % RING_LEN : -1;
}

export class LudoEngine {
  players: PlayerInfo[];
  tokens: Record<Color, number[]>;
  turn = 0;
  dice: number | null = null;
  sixes = 0;
  ranks: Color[] = [];
  phase: Phase = 'roll';
  legalMoves: Move[] = [];
  rng: () => number;

  constructor(players: PlayerInfo[], rng: () => number = Math.random) {
    if (players.length < 2 || players.length > 4) {
      throw new Error('Ludo needs 2 to 4 players');
    }
    const seen = new Set<Color>();
    for (const p of players) {
      if (seen.has(p.color)) throw new Error('Duplicated color');
      seen.add(p.color);
    }
    this.players = players.map((p) => ({ ...p }));
    this.rng = rng;
    this.tokens = { red: [-1, -1, -1, -1], green: [-1, -1, -1, -1], yellow: [-1, -1, -1, -1], blue: [-1, -1, -1, -1] };
  }

  get current(): PlayerInfo {
    return this.players[this.turn];
  }

  get winner(): Color | null {
    return this.phase === 'over' ? this.ranks[0] : null;
  }

  activeColors(): Color[] {
    return this.players.map((p) => p.color).filter((c) => !this.ranks.includes(c));
  }

  /** Roll the dice for the current player. Handles the triple-six forfeit and empty turns. */
  roll(): { value: number; forfeited: boolean; legal: Move[] } {
    if (this.phase !== 'roll') return { value: this.dice ?? 0, forfeited: false, legal: [] };
    const value = 1 + Math.floor(this.rng() * 6);
    this.dice = value;

    if (value === 6) {
      this.sixes += 1;
      if (this.sixes >= 3) {
        this.sixes = 0;
        this.endTurn();
        return { value, forfeited: true, legal: [] };
      }
    } else {
      this.sixes = 0;
    }

    this.legalMoves = this.computeLegal(value);
    if (this.legalMoves.length === 0) {
      // No legal move: turn passes (a six alone does not grant a bonus roll).
      this.endTurn();
      return { value, forfeited: false, legal: [] };
    }
    this.phase = 'pick';
    return { value, forfeited: false, legal: this.legalMoves };
  }

  computeLegal(value: number): Move[] {
    const color = this.current.color;
    const moves: Move[] = [];
    this.tokens[color].forEach((pos, ti) => {
      if (pos === HOME_POS) return;
      if (pos === -1) {
        if (value === 6) {
          moves.push({
            token: ti,
            from: -1,
            to: 0,
            captures: this.capturesAt(color, globalRing(color, 0)),
            finishes: false,
            exitsYard: true
          });
        }
        return;
      }
      const to = pos + value;
      if (to > HOME_POS) return; // exact roll required to enter home
      const ring = to <= LAST_RING ? globalRing(color, to) : -1;
      moves.push({
        token: ti,
        from: pos,
        to,
        captures: ring >= 0 ? this.capturesAt(color, ring) : [],
        finishes: to === HOME_POS,
        exitsYard: false
      });
    });
    return moves;
  }

  /** Enemy tokens standing on a ring cell (empty on safe cells). */
  capturesAt(color: Color, ringIdx: number): { color: Color; token: number }[] {
    if (ringIdx < 0 || SAFE_RING.has(ringIdx)) return [];
    const out: { color: Color; token: number }[] = [];
    for (const p of this.players) {
      if (p.color === color) continue;
      this.tokens[p.color].forEach((pos, ti) => {
        if (pos >= 0 && pos <= LAST_RING && globalRing(p.color, pos) === ringIdx) {
          out.push({ color: p.color, token: ti });
        }
      });
    }
    return out;
  }

  /** True if some enemy token could reach `ringIdx` with a roll of 1..6. */
  threatened(color: Color, ringIdx: number): number {
    if (ringIdx < 0) return 0;
    let threats = 0;
    for (const p of this.players) {
      if (p.color === color) continue;
      // from the yard an enemy enters on its own start cell, which is safe,
      // so yard tokens only matter through their start cell (already a ring cell).
      this.tokens[p.color].forEach((pos) => {
        if (pos >= 0 && pos <= LAST_RING) {
          const d = (ringIdx - globalRing(p.color, pos) + RING_LEN) % RING_LEN;
          if (d >= 1 && d <= 6) threats += 1;
        }
      });
    }
    return threats;
  }

  applyMove(token: number): MoveResult | null {
    if (this.phase !== 'pick') return null;
    const move = this.legalMoves.find((m) => m.token === token);
    if (!move) return null;
    const color = this.current.color;
    this.tokens[color][token] = move.to;
    for (const c of move.captures) this.tokens[c.color][c.token] = -1;

    const extra = this.dice === 6 || move.captures.length > 0 || move.finishes;
    let playerFinished = false;

    if (this.tokens[color].every((p) => p === HOME_POS)) {
      playerFinished = true;
      this.ranks.push(color);
      if (this.ranks.length >= this.players.length - 1) {
        this.phase = 'over';
      } else {
        this.endTurn();
      }
    } else if (extra) {
      this.phase = 'roll';
      this.dice = null;
    } else {
      this.endTurn();
    }
    this.legalMoves = [];
    return { color, move, extra, playerFinished };
  }

  /** Advance the turn to the next active player. */
  endTurn(): void {
    do {
      this.turn = (this.turn + 1) % this.players.length;
    } while (this.ranks.includes(this.players[this.turn].color));
    this.dice = null;
    this.sixes = 0;
    this.legalMoves = [];
    this.phase = 'roll';
  }

  /** Final ranking (used when phase === 'over'). */
  finalRanks(): Color[] {
    const rest = this.players.map((p) => p.color).filter((c) => !this.ranks.includes(c));
    return [...this.ranks, ...rest];
  }

  snapshot(): Snapshot {
    return {
      players: this.players.map((p) => ({ ...p })),
      turn: this.turn,
      dice: this.dice,
      sixes: this.sixes,
      tokens: {
        red: [...this.tokens.red],
        green: [...this.tokens.green],
        yellow: [...this.tokens.yellow],
        blue: [...this.tokens.blue]
      },
      ranks: [...this.ranks],
      phase: this.phase,
      legal: this.phase === 'pick' ? this.legalMoves.map((m) => m.token) : []
    };
  }

  loadSnapshot(s: Snapshot): void {
    this.players = s.players.map((p) => ({ ...p }));
    this.turn = s.turn;
    this.dice = s.dice;
    this.sixes = s.sixes;
    for (const c of COLORS) this.tokens[c] = [...s.tokens[c]];
    this.ranks = [...s.ranks];
    this.phase = s.phase;
    this.legalMoves = s.phase === 'pick' ? this.computeLegal(s.dice ?? 1) : [];
  }
}
