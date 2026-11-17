import {
  LAST_RING_POS,
  PATH_END,
  SAFE_RING,
  ringIndexOf
} from './board';
import type { GameState, MoveEvent, MoveOption, PlayerSpec, Token } from './types';

/** Cria um novo estado de jogo. players deve estar em ordem de turno. */
export function createGame(players: PlayerSpec[]): GameState {
  const tokens: Token[] = [];
  let id = 0;
  for (let p = 0; p < players.length; p++) {
    for (let i = 0; i < 4; i++) tokens.push({ id: id++, owner: p, pos: -1 });
  }
  return {
    players: players.map((p) => ({ ...p })),
    tokens,
    turn: 0,
    dice: null,
    sixStreak: 0,
    phase: 'roll',
    winner: null
  };
}

function occupantsOnRing(state: GameState, ringIdx: number): Token[] {
  return state.tokens.filter((t) => {
    if (t.pos < 0 || t.pos > LAST_RING_POS) return false;
    const ri = ringIndexOf(state.players[t.owner].slot, t.pos);
    return ri === ringIdx;
  });
}

/** Lista todas as jogadas legais do jogador da vez, dado o valor atual do dado. */
export function legalMoves(state: GameState): MoveOption[] {
  if (state.phase !== 'move' || state.dice === null) return [];
  const owner = state.turn;
  const slot = state.players[owner].slot;
  const dice = state.dice;
  const out: MoveOption[] = [];

  for (const tok of state.tokens) {
    if (tok.owner !== owner || tok.pos === PATH_END) continue;

    if (tok.pos === -1) {
      // Sair da base exige 6
      if (dice !== 6) continue;
      const ring = ringIndexOf(slot, 0)!;
      const opps = occupantsOnRing(state, ring).filter((t) => t.owner !== owner);
      if (opps.length >= 2) continue; // bloco adversário
      // casa de partida é segura: não captura ninguém
      out.push({
        tokenId: tok.id,
        from: -1,
        to: 0,
        leavesYard: true,
        entersHomeCol: false,
        finishes: false,
        captures: [],
        toSafe: true
      });
      continue;
    }

    const to = tok.pos + dice;
    if (to > PATH_END) continue; // chegada exige número exato
    const finishes = to === PATH_END;
    let captures: number[] = [];
    let blocked = false;
    if (to <= LAST_RING_POS) {
      const ring = ringIndexOf(slot, to)!;
      const occ = occupantsOnRing(state, ring);
      const opps = occ.filter((t) => t.owner !== owner);
      if (!SAFE_RING.has(ring)) {
        if (opps.length >= 2) {
          blocked = true; // pilha adversária = bloco
        } else if (opps.length === 1) {
          captures = opps.map((t) => t.id);
        }
      }
    }
    if (blocked) continue;
    out.push({
      tokenId: tok.id,
      from: tok.pos,
      to,
      leavesYard: false,
      entersHomeCol: tok.pos < LAST_RING_POS && to >= LAST_RING_POS,
      finishes,
      captures,
      toSafe: to <= LAST_RING_POS && SAFE_RING.has(ringIndexOf(slot, to)!)
    });
  }
  return out;
}

function nextTurn(state: GameState): void {
  state.turn = (state.turn + 1) % state.players.length;
  state.dice = null;
  state.sixStreak = 0;
  state.phase = 'roll';
}

/**
 * Registra o valor sorteado. Três 6 consecutivos queimam a vez.
 * Devolve { forfeited } quando a vez é perdida.
 */
export function applyRoll(state: GameState, value: number): { forfeited: boolean } {
  state.dice = value;
  if (value === 6) {
    state.sixStreak += 1;
    if (state.sixStreak >= 3) {
      nextTurn(state);
      return { forfeited: true };
    }
  } else {
    state.sixStreak = 0;
  }
  state.phase = 'move';
  return { forfeited: false };
}

/** Aplica uma jogada legal, resolvendo capturas, chegada, bônus e vitória. */
export function applyMove(state: GameState, opt: MoveOption): MoveEvent {
  const tok = state.tokens[opt.tokenId];
  tok.pos = opt.to;
  for (const cid of opt.captures) {
    state.tokens[cid].pos = -1;
  }
  const owner = tok.owner;
  const won = state.tokens
    .filter((t) => t.owner === owner)
    .every((t) => t.pos === PATH_END);

  const bonusSix = state.dice === 6 && state.sixStreak < 3;
  const extra = opt.captures.length > 0 || opt.finishes || bonusSix;

  const ev: MoveEvent = {
    tokenId: opt.tokenId,
    owner,
    from: opt.from,
    to: opt.to,
    captures: [...opt.captures],
    finished: opt.finishes,
    extraTurn: extra && !won
  };

  if (won) {
    state.winner = owner;
    state.phase = 'over';
    return ev;
  }
  if (extra) {
    state.dice = null;
    state.phase = 'roll';
  } else {
    nextTurn(state);
  }
  return ev;
}

/** Se não há jogadas legais, passa a vez. Devolve true quando passou. */
export function passIfNoMoves(state: GameState): boolean {
  if (legalMoves(state).length === 0) {
    nextTurn(state);
    return true;
  }
  return false;
}

/** Número de peças do jogador que já chegaram ao centro */
export function homeCount(state: GameState, owner: number): number {
  return state.tokens.filter((t) => t.owner === owner && t.pos === PATH_END).length;
}

/** Progresso total (soma das posições) de um jogador — usado para desempate */
export function progressOf(state: GameState, owner: number): number {
  return state.tokens
    .filter((t) => t.owner === owner)
    .reduce((s, t) => s + Math.max(t.pos, 0), 0);
}

/** Classificação final: vencedor primeiro, depois por peças em casa e progresso */
export function standings(state: GameState): number[] {
  return state.players
    .map((_, i) => i)
    .sort(
      (a, b) =>
        homeCount(state, b) - homeCount(state, a) ||
        progressOf(state, b) - progressOf(state, a)
    );
}
