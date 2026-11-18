import * as THREE from 'three';
import { Sfx } from './audio';
import { chooseBotMove } from './game/ai';
import {
  Color,
  COLORS,
  HOME_POS,
  LudoEngine,
  MoveResult,
  PlayerInfo,
  Snapshot,
  globalRing,
  START_INDEX
} from './game/rules';
import { initI18n, setLang, applyStaticI18n, t, getLang, Lang, LANGS } from './i18n';
import { makeRoomCode, Net, NetMsg } from './net/p2p';
import {
  BoardRefs,
  HOME_CELLS,
  RING_CELLS,
  YARD_SLOT,
  buildBoard,
  cellWorld
} from './render/board';
import { CinCam } from './render/camera';
import { Stage } from './render/scene';
import { Token3D } from './render/token';
import { Hud } from './ui/hud';

type Mode = 'menu' | 'local' | 'bots' | 'host' | 'client';

interface Settings {
  name: string;
  sound: boolean;
  autoCam: boolean;
}

const delay = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector(sel) as T;

export class App {
  private stage!: Stage;
  private cin!: CinCam;
  private hud!: Hud;
  private sfx = new Sfx();
  private board!: BoardRefs;
  private tokens = new Map<string, Token3D>(); // `${color}:${i}` -> token
  private engine: LudoEngine | null = null;
  private mode: Mode = 'menu';
  private myColor: Color | null = null;
  private net: Net | null = null;
  private roomCode = '';
  private gen = 0;
  private busy = false;
  private timers: number[] = [];
  private pendingState: Snapshot | null = null;
  private pendingIntent: { a: 'roll' | 'move'; token?: number } | null = null;
  private raycaster = new THREE.Raycaster();
  private settings: Settings = { name: '', sound: true, autoCam: true };
  private time = 0;
  private lastIntentPeer = '';

  async boot(): Promise<void> {
    this.loadSettings();
    initI18n();

    this.stage = new Stage($('#gl') as unknown as HTMLCanvasElement);
    this.cin = new CinCam(this.stage.controls, this.stage.camera);
    (window as unknown as Record<string, unknown>).__ludo3d = { app: this, cin: this.cin, camera: this.stage.camera, controls: this.stage.controls };
    this.board = buildBoard();
    this.stage.scene.add(this.board.group);
    this.hud = new Hud();
    this.hud.onDiceTap = (color) => this.onRollButton(color);

    // create all tokens (hidden until a game starts)
    for (const c of COLORS) {
      for (let i = 0; i < 4; i++) {
        const tk = new Token3D(c, i);
        tk.mesh.visible = false;
        this.stage.scene.add(tk.mesh);
        this.tokens.set(`${c}:${i}`, tk);
      }
    }

    this.stage.addUpdater((dt) => {
      this.time += dt;
      this.cin.update(dt);
      for (const tk of this.tokens.values()) tk.update(dt, this.time);
    });
    this.stage.onFrame = () => void 0;

    this.bindPointer();
    this.bindUI();
    applyStaticI18n();
    this.hud.showMenu(true);
    this.cin.menuOrbit(true);

    await this.waitForFonts();
    $('#splash').classList.add('away');
    window.setTimeout(() => $('#splash').remove(), 600);
  }

  private waitForFonts(): Promise<void> {
    return new Promise((r) => window.setTimeout(r, 250));
  }

  // ---------------- settings ----------------
  private loadSettings(): void {
    try {
      const raw = localStorage.getItem('ludo3d.settings');
      if (raw) Object.assign(this.settings, JSON.parse(raw));
    } catch {
      /* ignore */
    }
    this.sfx.enabled = this.settings.sound;
  }

  private saveSettings(): void {
    try {
      localStorage.setItem('ludo3d.settings', JSON.stringify(this.settings));
    } catch {
      /* ignore */
    }
  }

  // ---------------- UI wiring ----------------
  private bindUI(): void {
    const click = (fn: () => void) => () => {
      this.sfx.click();
      fn();
    };

    $('#btn-local').addEventListener('click', click(() => this.hud.showSetup('local')));
    $('#btn-bots').addEventListener('click', click(() => this.hud.showSetup('bots')));
    $('#btn-online').addEventListener('click', click(() => this.openOnline()));
    $('#btn-settings').addEventListener('click', click(() => this.openSettings()));
    $('#btn-help').addEventListener('click', click(() => this.hud.showHelp()));

    $('#btn-local-back').addEventListener('click', click(() => this.hud.showSetup('')));
    $('#btn-bots-back').addEventListener('click', click(() => this.hud.showSetup('')));

    Hud.bindSeg('#seg-local-count', () => void 0, '2');
    Hud.bindSeg('#seg-bots-count', () => void 0, '1');
    $('#btn-local-start').addEventListener('click', click(() => {
      this.sfx.click();
      this.startOffline('local', Number(Hud.getSeg('#seg-local-count')));
    }));
    $('#btn-bots-start').addEventListener('click', click(() => {
      this.sfx.click();
      this.startOffline('bots', Number(Hud.getSeg('#seg-bots-count')) + 1);
    }));

    // HUD
    $('#btn-pause').addEventListener('click', click(() => this.hud.dialog('#dlg-pause')));
    $('#btn-resume').addEventListener('click', click(() => this.hud.dialog(null)));
    $('#btn-restart').addEventListener('click', click(() => {
      this.hud.dialog(null);
      this.restart();
    }));
    $('#btn-exit').addEventListener('click', click(() => {
      this.hud.dialog(null);
      this.exitToMenu();
    }));
    document.querySelectorAll('.dlg-close').forEach((b) =>
      b.addEventListener('click', () => this.hud.dialog(null))
    );

    // settings dialog
    Hud.bindSeg('#seg-lang', (v) => {
      setLang(v as Lang);
      applyStaticI18n();
      const help = $('#dlg-help');
      if (!help.classList.contains('hidden')) this.hud.showHelp();
    }, getLang());
    ($('#inp-name') as HTMLInputElement).value = this.settings.name;
    ($('#inp-name') as HTMLInputElement).addEventListener('input', () => {
      this.settings.name = ($('#inp-name') as HTMLInputElement).value.trim();
      this.saveSettings();
    });
    const tglSound = $('#tgl-sound') as HTMLInputElement;
    const tglCam = $('#tgl-cam') as HTMLInputElement;
    tglSound.checked = this.settings.sound;
    tglCam.checked = this.settings.autoCam;
    tglSound.addEventListener('change', () => {
      this.settings.sound = tglSound.checked;
      this.sfx.enabled = this.settings.sound;
      this.saveSettings();
    });
    tglCam.addEventListener('change', () => {
      this.settings.autoCam = tglCam.checked;
      this.saveSettings();
    });

    // online dialog
    Hud.bindSeg('#seg-online-tab', (v) => {
      $('#online-create').classList.toggle('hidden', v !== 'create');
      $('#online-join').classList.toggle('hidden', v !== 'join');
    }, 'create');
    $('#btn-create-room').addEventListener('click', click(() => this.hostRoom()));
    $('#btn-copy-code').addEventListener('click', click(async () => {
      try {
        await navigator.clipboard.writeText(this.roomCode);
        this.hud.toast(t('copied'));
      } catch {
        /* ignore */
      }
    }));
    $('#tgl-bots').addEventListener('change', () => this.broadcastLobby());
    $('#btn-host-start').addEventListener('click', click(() => this.hostStart()));
    $('#btn-join-room').addEventListener('click', click(() => this.joinRoomFlow()));
  }

  private openSettings(): void {
    Hud.setSeg('#seg-lang', getLang());
    this.hud.dialog('#dlg-settings');
  }

  private openOnline(): void {
    Hud.setSeg('#seg-online-tab', 'create');
    $('#online-create').classList.remove('hidden');
    $('#online-join').classList.add('hidden');
    $('#room-box').classList.add('hidden');
    $('#seats-box').innerHTML = '';
    $('#btn-host-start').classList.add('hidden');
    $('#row-bots').classList.add('hidden');
    $('#online-wait').classList.add('hidden');
    $('#join-status').classList.add('hidden');
    ($('#inp-code') as HTMLInputElement).value = '';
    this.hud.dialog('#dlg-online');
  }

  // ---------------- position helpers ----------------
  private posToWorld(color: Color, pos: number, slot: number): THREE.Vector3 {
    if (pos === -1) {
      const yard = cellWorld(2.5, 2.5); // overwritten below per color
      void yard;
      const centers: Record<Color, THREE.Vector2> = {
        red: cellWorld(2.5, 11.5),
        green: cellWorld(2.5, 2.5),
        yellow: cellWorld(11.5, 2.5),
        blue: cellWorld(11.5, 11.5)
      };
      const off = YARD_SLOT[slot];
      return new THREE.Vector3(centers[color].x + off.x, 0.26, centers[color].y + off.y);
    }
    if (pos === HOME_POS) {
      const dirs: Record<Color, THREE.Vector2> = {
        red: new THREE.Vector2(0, 0.55),
        green: new THREE.Vector2(-0.55, 0),
        yellow: new THREE.Vector2(0, -0.55),
        blue: new THREE.Vector2(0.55, 0)
      };
      const d = dirs[color];
      return new THREE.Vector3(d.x, 0.36, d.y);
    }
    if (pos <= 50) {
      const idx = (START_INDEX[color] + pos) % 52;
      const [col, row] = RING_CELLS[idx];
      const w = cellWorld(col, row);
      return new THREE.Vector3(w.x, 0.27, w.y);
    }
    const [col, row] = HOME_CELLS[color][pos - 51];
    const w = cellWorld(col, row);
    return new THREE.Vector3(w.x, 0.27, w.y);
  }

  private tokensOf(color: Color): Token3D[] {
    return [0, 1, 2, 3].map((i) => this.tokens.get(`${color}:${i}`)!);
  }

  /** Instantly place every token according to engine state (with stack offsets). */
  private layoutAll(): void {
    if (!this.engine) return;
    const groups = new Map<string, { color: Color; idx: number }[]>();
    for (const c of COLORS) {
      this.engine.tokens[c].forEach((pos, i) => {
        if (pos === HOME_POS) return;
        let key: string;
        if (pos === -1) key = `yard:${c}:${i}`;
        else if (pos <= 50) key = `ring:${globalRing(c, pos)}`;
        else key = `home:${c}:${pos}`;
        const arr = groups.get(key) ?? [];
        arr.push({ color: c, idx: i });
        groups.set(key, arr);
      });
    }
    for (const [, arr] of groups) {
      arr.forEach(({ color, idx }, n) => {
        const tk = this.tokens.get(`${color}:${idx}`)!;
        const base = this.posToWorld(color, this.engine!.tokens[color][idx], idx);
        if (arr.length > 1 && this.engine!.tokens[color][idx] !== -1) {
          const a = (n / arr.length) * Math.PI * 2;
          base.x += Math.cos(a) * 0.2;
          base.z += Math.sin(a) * 0.2;
          base.y += 0.04 * n;
        }
        tk.mesh.position.copy(base);
        tk.mesh.rotation.set(0, Math.random() * 0.4 - 0.2, 0);
        tk.mesh.scale.setScalar(1.18);
        tk.mesh.visible = true;
      });
    }
    // finished tokens hidden (they "entered" the center)
    for (const c of COLORS) {
      this.engine.tokens[c].forEach((pos, i) => {
        if (pos === HOME_POS) {
          const tk = this.tokens.get(`${c}:${i}`)!;
          tk.mesh.visible = false;
        }
      });
    }
  }

  // ---------------- game lifecycle ----------------
  private playerName(color: Color, fallbackIndex: number): string {
    const saved = this.settings.name;
    if (fallbackIndex === 0 && saved) return saved;
    return `${t('player')} ${fallbackIndex + 1}`;
  }

  private startOffline(mode: 'local' | 'bots', count: number): void {
    const colors = COLORS.slice(0, count);
    const players: PlayerInfo[] = colors.map((c, i) => ({
      color: c,
      name: mode === 'bots' && i > 0 ? `${t('botName')} ${i}` : this.playerName(c, i),
      kind: mode === 'bots' && i > 0 ? 'bot' : 'human'
    }));
    this.beginGame(mode, players, null);
  }

  private beginGame(mode: Mode, players: PlayerInfo[], myColor: Color | null): void {
    this.gen += 1;
    this.mode = mode;
    this.myColor = myColor;
    this.engine = new LudoEngine(players);
    this.busy = false;
    this.pendingState = null;
    this.pendingIntent = null;
    this.clearTimers();

    this.hud.dialog(null);
    this.hud.showMenu(false);
    this.hud.hideCards();
    for (const tk of this.tokens.values()) {
      tk.mesh.visible = true;
      tk.setHighlighted(false);
    }
    this.layoutAll();
    this.hud.diceReset();
    this.cin.menuOrbit(false);
    if (this.settings.autoCam) this.cin.focusColor(this.engine.current.color);
    else this.cin.focusColor(this.engine.current.color);
    this.hud.setRoll(null, false);
    this.updateHud();
    this.next();
  }

  private clearTimers(): void {
    for (const id of this.timers) window.clearTimeout(id);
    this.timers = [];
  }

  private schedule(fn: () => void, ms: number): void {
    const g = this.gen;
    const id = window.setTimeout(() => {
      if (this.gen === g) fn();
    }, ms);
    this.timers.push(id);
  }

  private restart(): void {
    if (!this.engine) return;
    const players = this.engine.players;
    if (this.mode === 'host') {
      this.hostStart();
      return;
    }
    if (this.mode === 'client') return; // host controls restarts
    this.beginGame(this.mode, players.map((p) => ({ ...p })), this.myColor);
  }

  private exitToMenu(): void {
    this.gen += 1;
    this.mode = 'menu';
    this.engine = null;
    this.clearTimers();
    this.busy = false;
    this.hud.diceReset();
    for (const tk of this.tokens.values()) tk.mesh.visible = false;
    this.hud.hideCards();
    this.hud.setRoll(null, false);
    this.hud.showMenu(true);
    this.cin.menuOrbit(true);
    this.net?.leave();
    this.net = null;
    this.myColor = null;
  }

  // ---------------- HUD sync ----------------
  private isLocalTurnPlayer(): boolean {
    if (!this.engine) return false;
    const p = this.engine.current;
    if (this.mode === 'local' || this.mode === 'bots') return p.kind === 'human';
    if (this.mode === 'host') return p.kind === 'human';
    if (this.mode === 'client') return p.color === this.myColor;
    return false;
  }

  private updateHud(): void {
    if (!this.engine) return;
    const p = this.engine.current;
    // turn is conveyed visually: active card border, pulsing dice slot and glowing pawns — no text banners
    this.hud.updateCards(this.engine.players, this.engine.tokens, this.engine.turn, p.color);
  }

  // ---------------- turn driver ----------------
  private next(): void {
    if (!this.engine || this.mode === 'menu') return;
    this.updateHud();

    if (this.engine.phase === 'over') {
      this.finishGame();
      return;
    }

    // apply queued remote intent first (host mode)
    if (this.pendingIntent && this.mode === 'host') {
      const intent = this.pendingIntent;
      this.pendingIntent = null;
      if (this.engine.phase === 'roll' && intent.a === 'roll') {
        void this.doRoll();
        return;
      }
      if (this.engine.phase === 'pick' && intent.a === 'move') {
        void this.doMove(intent.token ?? -1);
        return;
      }
    }

    const p = this.engine.current;
    if (this.engine.phase === 'roll') {
      this.highlightLegal([]);
      if (this.mode === 'client') {
        this.hud.setRoll(p.color, p.color === this.myColor);
      } else if (p.kind === 'bot') {
        this.hud.setRoll(p.color, false);
        this.schedule(() => {
          if (this.engine && this.engine.phase === 'roll') void this.doRoll();
        }, 620 + Math.random() * 620);
      } else if (this.isLocalTurnPlayer()) {
        this.hud.setRoll(p.color, true);
      } else {
        this.hud.setRoll(p.color, false);
      }
    } else if (this.engine.phase === 'pick') {
      this.hud.setRoll(p.color, false);
      if (this.mode === 'client') {
        if (p.color === this.myColor) {
          this.highlightLegal(this.engine.legalMoves.map((m) => m.token));
          if (this.engine.legalMoves.length === 1) {
            this.schedule(() => {
              if (this.engine && this.engine.phase === 'pick' && this.engine.legalMoves.length === 1) {
                this.net?.broadcast({ t: 'intent', a: 'move', token: this.engine.legalMoves[0].token });
              }
            }, 500);
          }
        } else {
          this.highlightLegal([]);
        }
      } else if (p.kind === 'bot') {
        this.highlightLegal(this.engine.legalMoves.map((m) => m.token));
        this.schedule(() => {
          if (this.engine && this.engine.phase === 'pick') {
            const tk = chooseBotMove(this.engine);
            if (tk >= 0) void this.doMove(tk);
          }
        }, 560 + Math.random() * 500);
      } else if (this.isLocalTurnPlayer()) {
        this.highlightLegal(this.engine.legalMoves.map((m) => m.token));
        if (this.engine.legalMoves.length === 1) {
          this.schedule(() => {
            if (this.engine && this.engine.phase === 'pick' && this.engine.legalMoves.length === 1) {
              void this.doMove(this.engine.legalMoves[0].token);
            }
          }, 520);
        }
      } else {
        this.highlightLegal([]);
      }
    }
  }

  private highlightLegal(tokenIdxs: number[]): void {
    if (!this.engine) return;
    const color = this.engine.current.color;
    for (const tk of this.tokens.values()) {
      const isMine = tk.color === color && tokenIdxs.includes(tk.index);
      tk.setHighlighted(isMine);
    }
  }

  private clearHighlights(): void {
    for (const tk of this.tokens.values()) {
      tk.setHighlighted(false);
    }
  }

  // ---------------- actions ----------------
  private onRollButton(color?: Color): void {
    if (this.busy || !this.engine || this.engine.phase !== 'roll') return;
    if (color && color !== this.engine.current.color) return; // tapped someone else's dice
    if (this.mode === 'client') {
      if (this.engine.current.color === this.myColor) {
        this.net?.broadcast({ t: 'intent', a: 'roll' });
      }
      return;
    }
    if (this.isLocalTurnPlayer()) void this.doRoll();
  }

  /** Host / offline: roll locally on the engine, animate the player's dice slot. */
  private async doRoll(): Promise<void> {
    if (!this.engine || this.busy) return;
    const color = this.engine.current.color;
    this.busy = true;
    this.hud.setRoll(color, false);
    const r = this.engine.roll();
    this.broadcast({ t: 'ev', kind: 'roll', color, value: r.value, turn: this.engine.turn, forfeited: r.forfeited });
    this.sfx.dice();
    await this.hud.rollDice(color, r.value);
    if (this.engine.phase === 'pick') {
      this.sfx.turn();
    } else {
      // no legal move: brief pause keeps pacing without any text feedback
      await delay(700);
    }
    this.busy = false;
    this.broadcastState();
    this.next();
  }

  private async doMove(token: number): Promise<void> {
    if (!this.engine || this.busy) return;
    const res = this.engine.applyMove(token);
    if (!res) return;
    this.busy = true;
    this.clearHighlights();
    this.broadcast({
      t: 'ev',
      kind: 'move',
      color: res.color,
      token,
      from: res.move.from,
      to: res.move.to,
      captures: res.move.captures
    });
    await this.animateMove(res);
    this.busy = false;
    this.broadcastState();
    this.next();
  }

  /** Hop-by-hop token animation, captures flying back, finish into the center. */
  private async animateMove(res: MoveResult): Promise<void> {
    const tk = this.tokens.get(`${res.color}:${res.move.token}`)!;
    const { from, to } = res.move;
    const steps: THREE.Vector3[] = [];
    const startIdx = from === -1 ? -1 : from;
    for (let p = startIdx + 1; p <= to; p++) {
      steps.push(this.posToWorld(res.color, p, res.move.token));
    }
    if (from === -1) {
      // exit yard: arc from yard slot to start cell
      const yard = this.posToWorld(res.color, -1, res.move.token);
      const start = this.posToWorld(res.color, 0, res.move.token);
      tk.mesh.position.copy(yard);
      await this.hopTo(tk, start, 320, true);
      this.sfx.hop();
    } else {
      let prev = tk.mesh.position.clone();
      for (let i = 0; i < steps.length; i++) {
        await this.hopTo(tk, steps[i], steps.length > 1 ? 165 : 300, false);
        if (i < 7) this.sfx.hop();
        prev = steps[i];
      }
      void prev;
    }

    // captures
    if (res.move.captures.length > 0) {
      this.sfx.capture();
      await Promise.all(
        res.move.captures.map(async (cap) => {
          const ctk = this.tokens.get(`${cap.color}:${cap.token}`)!;
          const dest = this.posToWorld(cap.color, -1, cap.token);
          await this.hopTo(ctk, dest, 460, true, 2.6);
        })
      );
    }

    if (res.move.finishes) {
      this.sfx.home();
      const center = new THREE.Vector3(0, 0.3, 0);
      await this.hopTo(tk, center, 380, true, 1.6);
      await new Promise<void>((r) => {
        const t0 = performance.now();
        const shrink = () => {
          const u = Math.min(1, (performance.now() - t0) / 260);
          tk.mesh.scale.setScalar(1.18 * (1 - u));
          if (u >= 1) {
            tk.mesh.visible = false;
            tk.mesh.scale.setScalar(1.18);
            r();
          } else requestAnimationFrame(shrink);
        };
        requestAnimationFrame(shrink);
      });
    }
    this.layoutAll();
  }

  private hopTo(tk: Token3D, target: THREE.Vector3, ms: number, arc: boolean, height = 0.7): Promise<void> {
    return new Promise((r) => {
      const from = tk.mesh.position.clone();
      const t0 = performance.now();
      const step = () => {
        const u = Math.min(1, (performance.now() - t0) / ms);
        const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        tk.mesh.position.lerpVectors(from, target, e);
        if (arc) {
          tk.mesh.position.y += Math.sin(Math.PI * u) * height;
        } else {
          tk.mesh.position.y += Math.sin(Math.PI * u) * 0.32;
        }
        if (u >= 1) {
          tk.mesh.position.copy(target);
          r();
        } else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  // ---------------- selection (tap) ----------------
  private bindPointer(): void {
    const canvas = $('#gl') as unknown as HTMLCanvasElement;
    let downX = 0, downY = 0;
    canvas.addEventListener('pointerdown', (e) => {
      downX = e.clientX;
      downY = e.clientY;
    });
    canvas.addEventListener('pointerup', (e) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 12) return;
      this.handleTap(e);
    });
  }

  private handleTap(e: PointerEvent): void {
    if (!this.engine || this.busy || this.mode === 'menu') return;
    if (this.engine.phase !== 'pick') return;
    const isMine = this.isLocalTurnPlayer();
    if (!isMine) return;

    const canvas = $('#gl') as unknown as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.stage.camera);
    const meshes = [...this.tokens.values()].filter((tk) => tk.highlighted).map((tk) => tk.mesh);
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return;
    const mesh = hits[0].object;
    for (const [key, tk] of this.tokens) {
      if (tk.mesh === mesh) {
        const idx = Number(key.split(':')[1]);
        if (this.mode === 'client') {
          this.net?.broadcast({ t: 'intent', a: 'move', token: idx });
        } else {
          void this.doMove(idx);
        }
        return;
      }
    }
  }

  // ---------------- finish ----------------
  private finishGame(): void {
    if (!this.engine) return;
    const ranks = this.engine.finalRanks();
    const ranked = ranks.map((c) => this.engine!.players.find((p) => p.color === c)!);
    this.clearHighlights();
    this.hud.setRoll(null, false);
    $('#win-title').textContent =
      this.mode === 'client' || this.mode === 'host'
        ? `${ranked[0].name} ${t('gameWon')}`
        : ranked[0].kind === 'bot'
          ? `${ranked[0].name} ${t('gameWon')}`
          : t('youWin');
    this.hud.renderRanks(ranked);
    this.hud.dialog('#dlg-win');
    this.hud.confetti();
    this.sfx.win();
    this.broadcast({ t: 'over', ranks });
    this.schedule(() => {
      if (this.settings.autoCam) this.cin.focusColor(ranked[0].color, 26);
    }, 200);
  }

  // ---------------- networking ----------------
  private broadcast(msg: NetMsg): void {
    if (this.mode === 'host') this.net?.broadcast(msg);
  }

  private broadcastState(): void {
    if (this.mode !== 'host' || !this.engine) return;
    this.broadcast({ t: 'state', snap: this.engine.snapshot() });
  }

  private async hostRoom(): Promise<void> {
    this.roomCode = makeRoomCode();
    const codeEl = $('#room-code');
    codeEl.textContent = this.roomCode;
    $('#room-box').classList.remove('hidden');
    $('#row-bots').classList.remove('hidden');
    $('#online-wait').classList.remove('hidden');
    $('#online-wait').textContent = t('waitingPlayers');

    const seats: ({ name: string; color: Color; kind: 'human' | 'bot' } | null)[] = [
      { name: this.settings.name || `${t('player')} 1`, color: 'red', kind: 'human' },
      null, null, null
    ];
    this.net = new Net({
      onPeerJoin: () => void 0,
      onPeerLeave: (peerId) => this.hostOnPeerLeave(peerId),
      onMessage: (msg, peerId) => this.hostOnMessage(msg, peerId)
    });
    try {
      await this.net.host(this.roomCode);
      this.sfx.connect();
    } catch {
      this.hud.toast(t('joinFail'));
      return;
    }
    this.renderSeatsFrom(seats.filter((s) => s !== null) as { name: string; color: Color; kind: 'human' | 'bot' }[]);
    this.broadcastLobby();
  }

  private lobbySeats: ({ name: string; color: Color; kind: 'human' | 'bot' } | null)[] = [
    null, null, null, null
  ];
  private seatByPeer = new Map<string, number>();

  private renderSeatsFrom(seats: { name: string; color: Color; kind: 'human' | 'bot' }[]): void {
    this.hud.renderSeats(seats);
  }

  private broadcastLobby(): void {
    if (this.mode !== 'menu' || !this.net?.isHost) return;
    const seats = this.lobbySeats;
    const humans = seats.filter((s) => s && s.kind === 'human').length;
    const fillBots = ($('#tgl-bots') as HTMLInputElement).checked;
    const startable = humans >= 1 && (fillBots || humans >= 2);
    const payload = seats.map((s, i) => (s ? { name: s.name, color: COLORS[i], kind: s.kind } : null));
    this.net.broadcast({ t: 'lobby', seats: payload, hostStartable: startable });
    this.renderSeatsFrom(payload.filter((s) => s !== null) as { name: string; color: Color; kind: 'human' | 'bot' }[]);
    $('#btn-host-start').classList.toggle('hidden', false);
    ($('#btn-host-start') as HTMLButtonElement).disabled = !startable;
  }

  private hostOnMessage(msg: NetMsg, peerId: string): void {
    switch (msg.t) {
      case 'hello': {
        const idx = this.lobbySeats.findIndex((s) => s === null);
        if (idx >= 0 && idx < 4) {
          this.lobbySeats[idx] = { name: (msg.name || `${t('player')} ${idx + 1}`).slice(0, 14), color: COLORS[idx], kind: 'human' };
          this.seatByPeer.set(peerId, idx);
        }
        this.broadcastLobby();
        break;
      }
      case 'intent': {
        this.lastIntentPeer = peerId;
        if (this.busy) {
          this.pendingIntent = { a: msg.a, token: msg.token };
          return;
        }
        const seatIdx = this.seatByPeer.get(peerId);
        if (seatIdx === undefined || !this.engine) return;
        const player = this.engine.players[this.engine.turn];
        if (player.color !== COLORS[seatIdx]) return; // not their turn
        if (this.engine.phase === 'roll' && msg.a === 'roll') void this.doRoll();
        else if (this.engine.phase === 'pick' && msg.a === 'move') void this.doMove(msg.token ?? -1);
        break;
      }
      default:
        break;
    }
  }

  private hostOnPeerLeave(peerId: string): void {
    const idx = this.seatByPeer.get(peerId);
    this.seatByPeer.delete(peerId);
    if (idx === undefined) return;
    if (this.mode === 'host' && this.engine) {
      const player = this.engine.players.find((p) => p.color === COLORS[idx]);
      if (player && !this.engine.ranks.includes(player.color)) {
        player.kind = 'bot';
        this.hud.toast(t('peerLeft'));
        this.broadcastState();
        this.next();
      }
    } else {
      this.lobbySeats[idx] = null;
    }
    this.broadcastLobby();
  }

  private hostStart(): void {
    if (!this.net) return;
    const fillBots = ($('#tgl-bots') as HTMLInputElement).checked;
    const players: PlayerInfo[] = [];
    let botN = 0;
    for (let i = 0; i < 4; i++) {
      const s = this.lobbySeats[i];
      if (s) {
        players.push({ color: COLORS[i], name: s.name, kind: s.kind === 'bot' ? 'bot' : 'remote' });
      } else if (fillBots) {
        botN += 1;
        players.push({ color: COLORS[i], name: `${t('botName')} ${botN}`, kind: 'bot' });
      }
    }
    if (players.length < 2) {
      this.hud.toast(t('joinFail'));
      return;
    }
    const myColor: Color = 'red';
    this.beginGame('host', players, myColor);
    // convert my own seat (host is seat 0) to local human
    const me = this.engine!.players.find((p) => p.color === myColor)!;
    me.kind = 'human';
    this.net.broadcast({ t: 'start', players: this.engine!.players, you: 'red' });
    this.broadcastState();
  }

  private async joinRoomFlow(): Promise<void> {
    const code = ($('#inp-code') as HTMLInputElement).value.trim().toUpperCase();
    if (code.length < 4) {
      this.hud.toast(t('joinFail'));
      return;
    }
    const status = $('#join-status');
    status.classList.remove('hidden');
    status.textContent = t('connecting');
    this.net = new Net({
      onPeerJoin: () => void 0,
      onPeerLeave: () => this.clientHostLeft(),
      onMessage: (msg) => this.clientOnMessage(msg)
    });
    try {
      await this.net.join(code);
    } catch {
      status.textContent = t('joinFail');
      this.net.leave();
      this.net = null;
      return;
    }
    this.sfx.connect();
    status.textContent = t('connected');
    this.net.broadcast({ t: 'hello', name: this.settings.name || `${t('player')} 1` });
  }

  private clientHostLeft(): void {
    if (this.mode === 'client') {
      this.hud.toast(t('hostLeft'), undefined, 3);
      this.exitToMenu();
    } else if (this.net) {
      $('#join-status').textContent = t('joinFail');
      $('#join-status').classList.remove('hidden');
    }
  }

  private clientOnMessage(msg: NetMsg): void {
    switch (msg.t) {
      case 'lobby': {
        this.renderSeatsFrom(msg.seats.filter((s) => s !== null) as { name: string; color: Color; kind: 'human' | 'bot' }[]);
        break;
      }
      case 'start': {
        this.beginGame('client', msg.players, msg.you);
        break;
      }
      case 'ev': {
        void this.clientApplyEvent(msg);
        break;
      }
      case 'state': {
        if (this.busy || this.hud.isRolling) {
          this.pendingState = msg.snap as Snapshot;
        } else {
          this.clientApplyState(msg.snap as Snapshot);
        }
        break;
      }
      case 'over': {
        // final ranks applied through finishGame via state 'over' phase
        break;
      }
      default:
        break;
    }
  }

  private async clientApplyEvent(msg: Extract<NetMsg, { t: 'ev' }>): Promise<void> {
    if (!this.engine) return;
    this.busy = true;
    if (msg.kind === 'roll') {
      this.sfx.dice();
      this.hud.setRoll(msg.color, false);
      await this.hud.rollDice(msg.color, msg.value);
    } else if (msg.kind === 'move') {
      this.clearHighlights();
      const fake: MoveResult = {
        color: msg.color,
        move: { token: msg.token, from: msg.from, to: msg.to, captures: msg.captures, finishes: msg.to === HOME_POS, exitsYard: msg.from === -1 },
        extra: false,
        playerFinished: false
      };
      await this.animateMove(fake);
      if (msg.captures.length > 0) this.sfx.capture();
      if (msg.to === HOME_POS) this.sfx.home();
    }
    this.busy = false;
    if (this.pendingState) {
      const s = this.pendingState;
      this.pendingState = null;
      this.clientApplyState(s);
    }
  }

  private clientApplyState(snap: Snapshot): void {
    if (!this.engine) return;
    this.engine.loadSnapshot(snap);
    this.layoutAll();
    this.updateHud();
    if (this.engine.phase === 'over') {
      this.finishGame();
      return;
    }
    this.next();
  }

  // ---------------- global helpers ----------------
  private toastIfMine(key: string, color?: Color): void {
    if (this.mode !== 'client' || this.engine?.current.color === this.myColor) {
      this.hud.toast(t(key), color);
    }
  }
}
