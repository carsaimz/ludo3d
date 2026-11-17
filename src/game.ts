import * as THREE from 'three';
import { LAST_RING_POS, SLOTS_BY_COUNT, SLOT_COLORS, ringIndexOf } from './engine/board';
import { chooseMove } from './engine/ai';
import { diceValue, mulberry32, type Rng } from './engine/rng';
import {
  applyMove,
  applyRoll,
  createGame,
  homeCount,
  legalMoves,
  passIfNoMoves,
  standings
} from './engine/rules';
import type { GameState, MoveEvent, MoveOption, PlayerSpec } from './engine/types';
import type { BoardView } from './render/board';
import type { DiceView } from './render/dice';
import type { PawnManager } from './render/pawn';
import type { CameraRig } from './render/camera';
import type { FX } from './render/fx';
import { COLOR_HEX } from './render/palette';
import type { Hud } from './ui/hud';
import type { GameSetup, Menu } from './ui/menu';
import { sfx } from './audio';

export interface GameDeps {
  board: BoardView;
  dice: DiceView;
  pawns: PawnManager;
  fx: FX;
  rig: CameraRig;
  hud: Hud;
  menu: Menu;
}

const CPU_NAMES = ['Ana', 'Bruno', 'Caia'];

/** Controlador: liga o motor de regras à cena 3D, HUD, câmera e som */
export class GameController {
  private state: GameState | null = null;
  private deps: GameDeps;
  private runId = 0;
  private rng: Rng = mulberry32(12345);
  private settings: GameSetup = { mode: 'cpu', count: 4, color: 'red' };
  private movable: MoveOption[] = [];
  private waitingPick = false;
  private canRoll = false;
  private timers: number[] = [];
  private autoCam = localStorage.getItem('ludo3d.autocam') !== '0';
  private dragCancel = false;

  constructor(deps: GameDeps) {
    this.deps = deps;
    this.deps.rig.setDragHandler(() => {
      this.dragCancel = true;
    });
  }

  get autoCamera(): boolean {
    return this.autoCam;
  }

  get soundOn(): boolean {
    return sfx.enabled;
  }

  toggleAutoCam(): void {
    this.autoCam = !this.autoCam;
    localStorage.setItem('ludo3d.autocam', this.autoCam ? '1' : '0');
  }

  toggleSound(): boolean {
    sfx.enabled = !sfx.enabled;
    localStorage.setItem('ludo3d.sound', sfx.enabled ? '1' : '0');
    return sfx.enabled;
  }

  private schedule(fn: () => void, ms: number): void {
    const myRun = this.runId;
    const id = window.setTimeout(() => {
      if (this.runId === myRun) fn();
    }, ms);
    this.timers.push(id);
  }

  private clearTimers(): void {
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers = [];
  }

  start(settings: GameSetup): void {
    this.runId++;
    this.clearTimers();
    this.settings = settings;
    this.rng = mulberry32((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);

    const slots = SLOTS_BY_COUNT[settings.count];
    let cpuIdx = 0;
    let playerIdx = 0;
    const players: PlayerSpec[] = slots.map((slot) => {
      const color = SLOT_COLORS[slot];
      const isHuman = settings.mode === 'local' || color === settings.color;
      const name = settings.mode === 'local' ? `Jogador ${++playerIdx}` : isHuman ? 'Você' : CPU_NAMES[cpuIdx++];
      return { slot, color, name, kind: isHuman ? ('human' as const) : ('cpu' as const) };
    });

    this.state = createGame(players);
    this.state.turn = 0; // vermelho começa (padrão Ludo King)
    for (let i = 0; i < players.length; i++) this.deps.pawns.setOwnerColor(i, players[i].color);
    this.deps.hud.setPlayers(
      players.map((p, i) => ({ owner: i, slot: p.slot, color: p.color, name: p.name, kind: p.kind }))
    );
    for (let i = 0; i < players.length; i++) {
      this.deps.hud.setHome(i, 0);
      this.deps.hud.setDice(i, null);
    }
    this.deps.hud.show(true);
    this.deps.rig.stopOrbit();
    this.layoutAll();
    this.beginTurn();
  }

  // ---------- posicionamento / pilhas ----------

  private worldForToken(tok: { id: number; owner: number; pos: number }): { pos: THREE.Vector3; scale: number } {
    const st = this.state!;
    const slot = st.players[tok.owner].slot;
    if (tok.pos === -1) {
      return { pos: this.deps.board.yardWorld(slot, tok.id % 4), scale: 0.95 };
    }
    if (tok.pos === 56) {
      const doneBefore = st.tokens.filter(
        (t) => t.owner === tok.owner && t.pos === 56 && t.id < tok.id
      ).length;
      return { pos: this.deps.board.homePileWorld(slot, doneBefore), scale: 0.9 };
    }

    const p = this.deps.board.posWorld(slot, tok.pos);
    const group = st.tokens.filter((t) => {
      if (t.pos < 0 || t.pos > LAST_RING_POS) return false;
      const a = ringIndexOf(slot, tok.pos);
      const b = ringIndexOf(st.players[t.owner].slot, t.pos);
      return a !== null && b !== null && a === b;
    });
    const n = Math.min(4, group.length);
    const idxInGroup = Math.max(0, group.findIndex((t) => t.id === tok.id));
    const OFF: Record<number, [number, number][]> = {
      1: [[0, 0]],
      2: [[-0.17, 0], [0.17, 0]],
      3: [[-0.2, 0.14], [0.2, 0.14], [0, -0.2]],
      4: [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]
    };
    const offs = OFF[n];
    const [dx, dz] = offs[Math.min(idxInGroup, offs.length - 1)];
    const scale = n === 1 ? 1 : n === 2 ? 0.9 : n === 3 ? 0.82 : 0.75;
    return { pos: new THREE.Vector3(p.x + dx, p.y, p.z + dz), scale };
  }

  private layoutAll(): void {
    const st = this.state;
    if (!st) return;
    for (const v of this.deps.pawns.views) {
      const tok = st.tokens[v.id];
      const target = this.worldForToken(tok);
      this.deps.pawns.placeInstant(v, target.pos, target.scale);
    }
  }

  // ---------- fluxo de turno ----------

  private beginTurn(): void {
    const st = this.state!;
    if (st.phase === 'over') {
      this.gameOver();
      return;
    }
    if (st.phase !== 'roll') return; // segurança: só inicia turno em fase de rolagem
    this.canRoll = false;
    this.waitingPick = false;
    this.movable = [];
    this.deps.fx.clearHints();
    this.deps.pawns.setPulse(null);
    this.deps.hud.setActive(st.turn);
    this.deps.hud.setDice(st.turn, null);
    this.deps.board.slotGlows.forEach((g, i) => {
      (g.material as THREE.MeshBasicMaterial).opacity = i === st.players[st.turn].slot ? 0.85 : 0;
    });
    this.deps.dice.idle();
    if (this.autoCam && !this.dragCancel) this.deps.rig.slotView(st.players[st.turn].slot);
    this.dragCancel = false;

    const p = st.players[st.turn];
    if (p.kind === 'cpu') {
      this.deps.hud.showRoll(false);
      this.deps.hud.hint(`${p.name} está jogando...`);
      this.schedule(() => this.doRoll(), 900);
    } else {
      this.deps.hud.showRoll(true);
      this.deps.hud.hint('Sua vez! Toque no dado para rolar');
      this.canRoll = true;
    }
  }

  private doRoll(): void {
    const st = this.state!;
    if (st.phase !== 'roll') return;
    this.canRoll = false;
    this.deps.hud.showRoll(false);
    sfx.diceShake();
    this.deps.rig.diceView();
    const v = diceValue(this.rng);
    this.deps.dice.roll(v, () => this.afterRoll(v));
  }

  tryRoll(): void {
    if (this.canRoll) this.doRoll();
  }

  private afterTurnAdvance(): void {
    const st = this.state!;
    if (st.phase === 'over') this.gameOver();
    else this.beginTurn();
  }

  private afterRoll(v: number): void {
    const st = this.state!;
    sfx.diceLand();
    this.deps.hud.setDice(st.turn, v);
    const res = applyRoll(st, v);
    if (res.forfeited) {
      sfx.forfeit();
      this.deps.hud.toast('Três 6 seguidos: vez perdida!', 'bad');
      this.schedule(() => this.afterTurnAdvance(), 1200);
      return;
    }
    if (v === 6) sfx.six();
    const moves = legalMoves(st);
    if (moves.length === 0) {
      sfx.none();
      this.deps.hud.toast('Sem movimentos possíveis', 'bad');
      this.schedule(() => {
        passIfNoMoves(st); // avança turno/phase no motor
        this.afterTurnAdvance();
      }, 1000);
      return;
    }
    const p = st.players[st.turn];
    if (p.kind === 'cpu') {
      this.schedule(() => {
        const m = chooseMove(st, moves);
        this.executeMove(m);
      }, 550);
    } else {
      this.presentMoves(moves);
    }
  }

  private presentMoves(moves: MoveOption[]): void {
    const st = this.state!;
    this.movable = moves;
    this.waitingPick = true;
    const hex = COLOR_HEX[st.players[st.turn].color];
    const slot = st.players[st.turn].slot;

    const seen = new Set<number>();
    for (const m of moves) {
      if (seen.has(m.tokenId)) continue;
      seen.add(m.tokenId);
      const v = this.deps.pawns.view(m.tokenId);
      this.deps.fx.showMovable(v.mesh.position, hex);
    }
    const taken = new Set<string>();
    for (const m of moves) {
      const p = m.to <= 55 ? this.deps.board.posWorld(slot, m.to) : this.deps.board.homePileWorld(slot, 0);
      const key = `${p.x.toFixed(2)},${p.z.toFixed(2)}`;
      if (taken.has(key)) continue;
      taken.add(key);
      this.deps.fx.showTarget(p, m);
    }
    if (moves.length === 1) {
      this.deps.pawns.setPulse(moves[0].tokenId);
      const opt = moves[0];
      this.schedule(() => {
        if (this.waitingPick) this.executeMove(opt);
      }, 650);
    } else {
      this.deps.hud.hint('Escolha uma peça para mover');
    }
  }

  onPawnPicked(tokenId: number): void {
    if (!this.waitingPick) return;
    const m = this.movable.find((x) => x.tokenId === tokenId);
    if (!m) return;
    sfx.select();
    this.executeMove(m);
  }

  onHintPicked(opt: unknown): void {
    if (!this.waitingPick) return;
    const m = opt as MoveOption;
    if (!this.movable.includes(m)) return;
    sfx.select();
    this.executeMove(m);
  }

  private executeMove(m: MoveOption): void {
    const st = this.state!;
    this.waitingPick = false;
    this.movable = [];
    this.deps.fx.clearHints();
    this.deps.pawns.setPulse(null);
    this.deps.hud.showRoll(false);
    this.deps.hud.hint('');

    const ev = applyMove(st, m);
    const view = this.deps.pawns.view(m.tokenId);
    const slot = st.players[ev.owner].slot;

    const points: THREE.Vector3[] = [];
    if (m.leavesYard) {
      points.push(this.deps.board.yardWorld(slot, m.tokenId % 4));
      points.push(this.deps.board.posWorld(slot, 0));
    } else {
      for (let p = m.from; p <= m.to; p++) {
        if (p === 56) points.push(this.deps.board.homePileWorld(slot, 0));
        else points.push(this.deps.board.posWorld(slot, p));
      }
    }
    this.deps.rig.follow(view.mesh.position);
    this.deps.pawns.hop(
      view,
      points,
      m.leavesYard ? 240 : 170,
      () => this.afterMoveAnim(ev),
      (seg, total) => {
        sfx.hop();
        if (seg >= total - 1) this.deps.rig.follow(null);
      }
    );
  }

  private afterMoveAnim(ev: MoveEvent): void {
    const st = this.state!;
    this.deps.rig.follow(null);
    this.layoutAll();
    this.deps.hud.setHome(ev.owner, homeCount(st, ev.owner));
    const ownerSlot = st.players[ev.owner].slot;

    if (ev.captures.length) {
      sfx.capture();
      this.deps.hud.toast('Capturou! Jogue de novo', 'gold');
      const site = this.deps.board.posWorld(ownerSlot, Math.min(ev.to, LAST_RING_POS));
      this.deps.fx.burst(site, '#ffffff', 30);
      for (const cid of ev.captures) {
        const victim = st.tokens[cid];
        const vHex = COLOR_HEX[st.players[victim.owner].color];
        const vView = this.deps.pawns.view(cid);
        const from = vView.mesh.position.clone();
        const padSlot = st.players[victim.owner].slot;
        const to = this.deps.board.yardWorld(padSlot, cid % 4);
        this.deps.fx.burst(from, vHex, 26);
        this.deps.pawns.hop(vView, [from, to], 380, () => this.layoutAll(), () => {});
      }
    }
    if (ev.finished) {
      sfx.home();
      this.deps.hud.toast('Peça em casa!', 'gold');
      this.deps.fx.burst(this.deps.board.homePileWorld(ownerSlot, 0), '#ffd23f', 30);
    }

    if (st.phase === 'over') {
      this.schedule(() => this.gameOver(), 700);
      return;
    }
    this.schedule(() => this.beginTurn(), ev.extraTurn ? 850 : 500);
  }

  private gameOver(): void {
    const st = this.state!;
    this.deps.hud.showRoll(false);
    this.deps.hud.hint('');
    const winner = st.players[st.winner ?? 0];
    sfx.win();
    this.deps.fx.confetti();
    this.deps.rig.winOrbit();
    this.deps.board.slotGlows.forEach((g) => {
      (g.material as THREE.MeshBasicMaterial).opacity = 0;
    });
    const rows = standings(st).map((idx, i) => ({
      place: i + 1,
      name: st.players[idx].name,
      color: st.players[idx].color,
      home: homeCount(st, idx)
    }));
    this.deps.hud.toast(`${winner.name} venceu!`, 'gold');
    this.schedule(() => this.deps.menu.showWin(winner.name, rows), 1600);
  }

  // ---------- menus ----------

  pause(): void {
    this.deps.menu.showPause();
  }

  resume(): void {
    this.deps.menu.hideAll();
  }

  quit(): void {
    this.runId++;
    this.clearTimers();
    this.deps.fx.clearHints();
    this.deps.pawns.setPulse(null);
    this.deps.rig.stopOrbit();
    this.deps.rig.follow(null);
    this.deps.board.slotGlows.forEach((g) => {
      (g.material as THREE.MeshBasicMaterial).opacity = 0;
    });
    this.deps.hud.show(false);
    this.deps.hud.showRoll(false);
    this.state = null;
    this.deps.menu.showMain();
    this.deps.rig.overview();
  }

  restart(): void {
    this.start(this.settings);
  }

  again(): void {
    this.start(this.settings);
  }

  update(dt: number): void {
    this.deps.dice.update(dt);
    this.deps.pawns.update(dt);
  }
}
