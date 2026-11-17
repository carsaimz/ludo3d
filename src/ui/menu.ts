import type { ColorId } from '../engine/types';
import { COLOR_HEX, COLOR_NAME } from '../render/palette';
import { ICONS } from './icons';

export interface GameSetup {
  mode: 'cpu' | 'local';
  count: 2 | 3 | 4;
  color: ColorId;
}

export interface MenuCallbacks {
  onStart(cfg: GameSetup): void;
  onResume(): void;
  onRestart(): void;
  onQuit(): void;
  onAgain(): void;
  onSound(): void;
  onCam(): void;
}

interface StandingRow {
  place: number;
  name: string;
  color: ColorId;
  home: number;
}

/** Menus: principal, configuração de partida, ajuda, pausa e vitória */
export class Menu {
  private root: HTMLElement;
  private main: HTMLElement;
  private setup: HTMLElement;
  private how: HTMLElement;
  private pause: HTMLElement;
  private win: HTMLElement;
  private cfg: GameSetup = { mode: 'cpu', count: 4, color: 'red' };

  constructor(cb: MenuCallbacks) {
    this.root = document.getElementById('menu')!;
    this.main = document.getElementById('panelMain')!;
    this.setup = document.getElementById('panelSetup')!;
    this.how = document.getElementById('panelHow')!;
    this.pause = document.getElementById('panelPause')!;
    this.win = document.getElementById('panelWin')!;

    document.getElementById('btnPlay')!.addEventListener('click', () => this.showPanel(this.setup));
    document.getElementById('btnHow')!.addEventListener('click', () => this.showPanel(this.how));
    document.getElementById('btnBackMain')!.addEventListener('click', () => this.showPanel(this.main));
    document.getElementById('btnBackMain2')!.addEventListener('click', () => this.showPanel(this.main));
    document.getElementById('btnStart')!.addEventListener('click', () => {
      this.root.classList.add('hidden');
      cb.onStart({ ...this.cfg });
    });
    document.getElementById('btnResume')!.addEventListener('click', () => {
      this.root.classList.add('hidden');
      cb.onResume();
    });
    document.getElementById('btnRestart')!.addEventListener('click', () => {
      this.root.classList.add('hidden');
      cb.onRestart();
    });
    document.getElementById('btnQuit')!.addEventListener('click', () => cb.onQuit());
    document.getElementById('btnAgain')!.addEventListener('click', () => {
      this.root.classList.add('hidden');
      cb.onAgain();
    });
    document.getElementById('btnWinMenu')!.addEventListener('click', () => cb.onQuit());

    document.getElementById('btnSoundMenu')!.addEventListener('click', () => cb.onSound());
    document.getElementById('btnCamMenu')!.addEventListener('click', () => cb.onCam());

    // segmented controls
    const wireSeg = (id: string, apply: (v: string) => void) => {
      const row = document.getElementById(id)!;
      row.querySelectorAll('.seg').forEach((b) => {
        b.addEventListener('click', () => {
          row.querySelectorAll('.seg').forEach((x) => x.classList.remove('active'));
          b.classList.add('active');
          apply((b as HTMLElement).dataset.v!);
        });
      });
    };
    wireSeg('segMode', (v) => {
      this.cfg.mode = v as 'cpu' | 'local';
      const lbl = document.getElementById('lblColor')!;
      const row = document.getElementById('colorRow')!;
      const show = this.cfg.mode === 'cpu';
      lbl.style.display = show ? '' : 'none';
      row.style.display = show ? 'flex' : 'none';
    });
    wireSeg('segCount', (v) => {
      this.cfg.count = Number(v) as 2 | 3 | 4;
    });
    document.getElementById('colorRow')!.querySelectorAll('.colorchip').forEach((b) => {
      b.addEventListener('click', () => {
        document.getElementById('colorRow')!.querySelectorAll('.colorchip').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        this.cfg.color = (b as HTMLElement).dataset.c! as ColorId;
      });
    });
  }

  private showPanel(panel: HTMLElement): void {
    this.root.classList.remove('hidden');
    for (const p of [this.main, this.setup, this.how, this.pause, this.win]) p.classList.add('hidden');
    panel.classList.remove('hidden');
  }

  showMain(): void {
    this.showPanel(this.main);
  }

  hideAll(): void {
    this.root.classList.add('hidden');
  }

  showPause(): void {
    this.showPanel(this.pause);
  }

  showWin(winnerName: string, rows: StandingRow[]): void {
    const title = document.getElementById('winTitle')!;
    title.textContent = `${winnerName} VENCEU!`;
    const st = document.getElementById('standings')!;
    st.innerHTML = '';
    for (const r of rows) {
      const el = document.createElement('div');
      el.className = 'standRow';
      el.innerHTML = `
        <span class="place">${r.place}.</span>
        <span class="dot" style="background:${COLOR_HEX[r.color]}"></span>
        <span>${r.name}</span>
        <span class="score">${r.home}/4 em casa</span>`;
      st.appendChild(el);
    }
    this.showPanel(this.win);
  }

  setSoundIcon(on: boolean): void {
    const b = document.getElementById('btnSoundMenu')!;
    b.innerHTML = `${on ? ICONS.soundOn : ICONS.soundOff} <span>Som</span>`;
    b.classList.toggle('on', on);
  }

  setCamIcon(on: boolean): void {
    const b = document.getElementById('btnCamMenu')!;
    b.innerHTML = `${ICONS.camera} <span>Câmera</span>`;
    b.classList.toggle('on', on);
  }

  /** Nome amigável para mensagens */
  static colorName(c: ColorId): string {
    return COLOR_NAME[c];
  }
}
