export type ColorId = 'red' | 'green' | 'yellow' | 'blue';

export type PlayerKind = 'human' | 'cpu';

export interface PlayerSpec {
  /** Quadrante do tabuleiro, em ordem horária: 0 = sup. esquerdo, 1 = sup. direito, 2 = inf. direito, 3 = inf. esquerdo */
  slot: number;
  color: ColorId;
  name: string;
  kind: PlayerKind;
}

export interface Token {
  /** id sequencial; corresponde ao índice no array de tokens do estado */
  id: number;
  /** índice do jogador dono (índice em GameState.players) */
  owner: number;
  /**
   * -1  = na base (pátio)
   * 0..50 = caminho comum (0 = casa de partida própria, 50 = casa de entrada da reta final)
   * 51..55 = reta final colorida (5 casas exclusivas)
   * 56 = centro (chegada)
   */
  pos: number;
}

export type Phase = 'roll' | 'move' | 'over';

export interface MoveOption {
  tokenId: number;
  from: number;
  to: number;
  leavesYard: boolean;
  entersHomeCol: boolean;
  finishes: boolean;
  /** ids das peças capturadas (devolvidas à base) */
  captures: number[];
  /** casa de destino é segura (estrela ou partida) */
  toSafe: boolean;
}

export interface MoveEvent {
  tokenId: number;
  owner: number;
  from: number;
  to: number;
  captures: number[];
  finished: boolean;
  extraTurn: boolean;
}

export interface GameState {
  players: PlayerSpec[];
  tokens: Token[];
  turn: number;
  dice: number | null;
  /** sequência atual de 6 consecutivos do jogador da vez */
  sixStreak: number;
  phase: Phase;
  winner: number | null;
}
