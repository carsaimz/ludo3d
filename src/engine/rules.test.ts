import { describe, expect, it } from 'vitest';
import {
  ENTRY_RING,
  HOME_COL,
  LAST_RING_POS,
  PATH_END,
  SAFE_RING,
  START_IDX,
  STAR_IDX,
  TRACK
} from './board';
import { chooseMove } from './ai';
import {
  applyMove,
  applyRoll,
  createGame,
  legalMoves,
  passIfNoMoves,
  progressOf,
  standings
} from './rules';
import type { GameState, MoveOption, PlayerSpec } from './types';

function twoPlayerGame(): GameState {
  const players: PlayerSpec[] = [
    { slot: 3, color: 'red', name: 'P1', kind: 'human' },
    { slot: 1, color: 'yellow', name: 'P2', kind: 'human' }
  ];
  return createGame(players);
}

function findMove(state: GameState, tokenId: number): MoveOption | undefined {
  return legalMoves(state).find((m) => m.tokenId === tokenId);
}

describe('geometria do tabuleiro', () => {
  it('o anel tem 52 casas únicas dentro da grelha 15x15', () => {
    expect(TRACK.length).toBe(52);
    const set = new Set(TRACK.map(([c, r]) => `${c},${r}`));
    expect(set.size).toBe(52);
    for (const [c, r] of TRACK) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(14);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(14);
    }
  });

  it('o anel não invade o centro 3x3 do tabuleiro', () => {
    const center = new Set([
      '6,6', '7,6', '8,6', '6,7', '8,7', '6,8', '7,8', '8,8'
    ]);
    for (const [c, r] of TRACK) expect(center.has(`${c},${r}`)).toBe(false);
  });

  it('as partidas distam 13 casas e as estrelas ficam 8 casas à frente', () => {
    for (let i = 0; i < 4; i++) {
      expect(START_IDX[i]).toBe((START_IDX[0] + i * 13) % 52);
      expect(STAR_IDX[i]).toBe((START_IDX[i] + 8) % 52);
    }
    expect(SAFE_RING.size).toBe(8);
  });

  it('a entrada da reta final está 50 casas à frente de cada partida', () => {
    expect(ENTRY_RING).toEqual([50, 11, 24, 37]);
  });

  it('cada reta final tem 5 casas exclusivas', () => {
    for (const col of HOME_COL) expect(col.length).toBe(5);
  });
});

describe('estado inicial', () => {
  it('cria 16 peças na base e fase de rolagem', () => {
    const s = twoPlayerGame();
    expect(s.tokens.length).toBe(8);
    expect(s.tokens.every((t) => t.pos === -1)).toBe(true);
    expect(s.phase).toBe('roll');
    expect(s.turn).toBe(0);
    expect(s.winner).toBeNull();
  });
});

describe('movimentos legais', () => {
  it('só sai da base com 6', () => {
    const s = twoPlayerGame();
    applyRoll(s, 3);
    expect(legalMoves(s).length).toBe(0);
    s.phase = 'roll';
    applyRoll(s, 6);
    const moves = legalMoves(s);
    expect(moves.length).toBe(4);
    expect(moves.every((m) => m.leavesYard && m.to === 0 && m.toSafe)).toBe(true);
  });

  it('captura peça adversária em casa comum', () => {
    const s = twoPlayerGame();
    s.tokens[0].pos = 5; // dono 0 (slot 3) -> anel 44
    s.tokens[4].pos = 37; // dono 1 (slot 1) -> anel 50 (mesma casa, comum)
    applyRoll(s, 6);
    const m = findMove(s, 0);
    expect(m).toBeDefined();
    expect(m!.captures).toEqual([4]);
  });

  it('não captura em casa segura (estrela)', () => {
    const s = twoPlayerGame();
    // slot 3: posições seguras próprias -> anel 39(pos0),47(pos8),8(pos21),21(pos34),34(pos47)
    s.tokens[0].pos = 2;
    s.tokens[4].pos = 34; // dono 1 na mesma estrela (anel 47)
    applyRoll(s, 6);
    const m = findMove(s, 0);
    expect(m).toBeDefined();
    expect(m!.toSafe).toBe(true);
    expect(m!.captures).toEqual([]);
  });

  it('pilha adversária (2+ peças) bloqueia a casa', () => {
    const s = twoPlayerGame();
    s.tokens[0].pos = 8;
    s.tokens[4].pos = 37; // dois adversários no anel 50
    s.tokens[5].pos = 37;
    applyRoll(s, 3); // 8 + 3 = anel 50 (bloqueado); peças na base não saem com 3
    expect(legalMoves(s).length).toBe(0);
  });

  it('chegada ao centro exige número exato', () => {
    const s = twoPlayerGame();
    s.tokens[0].pos = 55;
    applyRoll(s, 2);
    expect(legalMoves(s).length).toBe(0);
    s.phase = 'roll';
    applyRoll(s, 1);
    const m = findMove(s, 0);
    expect(m).toBeDefined();
    expect(m!.finishes).toBe(true);
    expect(m!.to).toBe(PATH_END);
  });

  it('avança pelo anel até a posição 50 e entra na reta final', () => {
    const s = twoPlayerGame();
    s.tokens[0].pos = 49;
    applyRoll(s, 1);
    const m1 = findMove(s, 0)!;
    expect(m1.to).toBe(LAST_RING_POS);
    expect(m1.entersHomeCol).toBe(true);
    expect(m1.toSafe).toBe(false);

    s.tokens[0].pos = 50;
    s.phase = 'roll';
    applyRoll(s, 1);
    const m2 = findMove(s, 0)!;
    expect(m2.to).toBe(51);
    expect(m2.toSafe).toBe(false);
  });

  it('não permite andar além do centro', () => {
    const s = twoPlayerGame();
    s.tokens[0].pos = 52;
    applyRoll(s, 5);
    expect(legalMoves(s).length).toBe(0);
  });
});

describe('turnos e bônus', () => {
  it('6 dá jogada extra; jogada comum passa a vez', () => {
    const s = twoPlayerGame();
    applyRoll(s, 6);
    const m = findMove(s, 0)!;
    const ev = applyMove(s, m);
    expect(ev.extraTurn).toBe(true);
    expect(s.turn).toBe(0);
    expect(s.phase).toBe('roll');
    expect(s.tokens[0].pos).toBe(0);

    applyRoll(s, 4);
    const m2 = findMove(s, 0)!;
    const ev2 = applyMove(s, m2);
    expect(ev2.extraTurn).toBe(false);
    expect(s.turn).toBe(1);
    expect(s.phase).toBe('roll');
    expect(s.dice).toBeNull();
  });

  it('capturar dá jogada extra', () => {
    const s = twoPlayerGame();
    s.tokens[0].pos = 5;
    s.tokens[4].pos = 37;
    applyRoll(s, 6);
    const m = findMove(s, 0)!;
    const ev = applyMove(s, m);
    expect(ev.extraTurn).toBe(true);
    expect(s.turn).toBe(0);
    expect(s.tokens[4].pos).toBe(-1); // capturada volta à base
  });

  it('três 6 consecutivos queimam a vez', () => {
    const s = twoPlayerGame();
    applyRoll(s, 6);
    applyMove(s, findMove(s, 0)!);
    applyRoll(s, 6);
    applyMove(s, findMove(s, 0)!);
    const r = applyRoll(s, 6);
    expect(r.forfeited).toBe(true);
    expect(s.turn).toBe(1);
    expect(s.sixStreak).toBe(0);
    expect(s.phase).toBe('roll');
    expect(s.dice).toBeNull();
  });

  it('sem movimentos legais passa a vez automaticamente', () => {
    const s = twoPlayerGame();
    applyRoll(s, 2); // todas na base, sem 6
    expect(legalMoves(s).length).toBe(0);
    expect(passIfNoMoves(s)).toBe(true);
    expect(s.turn).toBe(1);
    expect(s.phase).toBe('roll');
  });
});

describe('vitória', () => {
  it('leva as 4 peças ao centro e encerra a partida', () => {
    const s = twoPlayerGame();
    s.tokens[0].pos = 55;
    s.tokens[1].pos = 56;
    s.tokens[2].pos = 56;
    s.tokens[3].pos = 56;
    applyRoll(s, 1);
    const m = findMove(s, 0)!;
    const ev = applyMove(s, m);
    expect(ev.finished).toBe(true);
    expect(ev.extraTurn).toBe(false);
    expect(s.winner).toBe(0);
    expect(s.phase).toBe('over');
    expect(standings(s)[0]).toBe(0);
    expect(progressOf(s, 0)).toBe(56 * 4);
  });
});

describe('IA', () => {
  it('devolve sempre uma jogada legal e prefere capturar', () => {
    const s = twoPlayerGame();
    s.tokens[0].pos = 5;
    s.tokens[4].pos = 37;
    applyRoll(s, 6);
    const moves = legalMoves(s);
    const choice = chooseMove(s, moves);
    expect(moves.map((m) => m.tokenId)).toContain(choice.tokenId);
    expect(choice.captures.length).toBe(1);
  });
});
