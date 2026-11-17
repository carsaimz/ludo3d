import { COLOR_HEX } from '../render/palette';
import type { ColorId } from '../engine/types';
import { ICONS } from './icons';

export interface HudPlayer {
  owner: number;
  slot: number;
  color: ColorId;
  name: string;
  kind: 'human' | 'cpu';
}

export interface HudCallbacks {
  onRoll(): void;
  onSound(): void;
  onCam(): void;
  onPause(): void;
}

const CORNER = ['tl', 'tr', 'br', 'bl'];

/** HUD em tela: cartões dos jogadores nos cantos, dica central, botão de dado, avisos */
export class Hud {
  private cardsEl: HTMLElement;
  private hintEl: HTMLElement;
  private rollEl: HTMLButtonElement;
  private toastsEl: HTMLElement;
  private btnSound: HTMLButtonElement;
  private btnCam: HTMLButtonElement;
  private btnMenu: HTMLButtonElement;
  private cards: HTMLElement[] = [];

  constructor(root: HTMLElement, cb: HudCallbacks) {
    this.cardsEl = root.querySelector('#cards')!;
    this.hintEl = root.querySelector('#hint')!;
    this.rollEl = root.querySelector('#rollBtn')!;
    this.toastsEl = root.querySelector('#toasts')!;
    this.btnSound = root.querySelector('#btnSound')!;
    this.btnCam = root.querySelector('#btnCam')!;
    this.btnMenu = root.querySelector('#btnMenu')!;

    this.rollEl.addEventListener('click', () => cb.onRoll());
    this.btnSound.addEventListener('click', () => cb.onSound());
    this.btnCam.addEventListener('click', () => cb.onCam());
    this.btnMenu.addEventListener('click', () => cb.onPause());

    this.btnSound.innerHTML = ICONS.soundOn;
    this.btnCam.innerHTML = ICONS.camera;
    this.btnMenu.innerHTML = ICONS.menu;
  }

  setPlayers(players: HudPlayer[]): void {
    this.cardsEl.innerHTML = '';
    this.cards = [];
    for (const p of players) {
      const el = document.createElement('div');
      el.className = `pcard ${CORNER[p.slot]}`;
      const initial = p.name === 'Você' ? 'V' : p.name[0].toUpperCase();
      el.innerHTML = `
        <div class="avatar" style="--av:${COLOR_HEX[p.color]}">${initial}</div>
        <div class="pinfo">
          <div class="pname">${p.name}</div>
          <div class="pdots"><i></i><i></i><i></i><i></i></div>
        </div>
        <div class="pdie" style="display:none">1</div>`;
      this.cardsEl.appendChild(el);
      this.cards[p.owner] = el;
    }
  }

  setActive(owner: number): void {
    this.cards.forEach((c, i) => c.classList.toggle('active', i === owner));
  }

  setDice(owner: number, v: number | null): void {
    const die = this.cards[owner]?.querySelector('.pdie') as HTMLElement | null;
    if (!die) return;
    if (v === null) {
      die.style.display = 'none';
    } else {
      die.style.display = 'flex';
      die.textContent = String(v);
    }
  }

  setHome(owner: number, n: number): void {
    const dots = this.cards[owner]?.querySelectorAll('.pdots i');
    if (!dots) return;
    dots.forEach((d, i) => d.classList.toggle('on', i < n));
  }

  hint(text: string): void {
    this.hintEl.textContent = text;
  }

  showRoll(show: boolean): void {
    this.rollEl.classList.toggle('hidden', !show);
  }

  toast(text: string, tone: 'good' | 'bad' | 'gold' | '' = ''): void {
    const el = document.createElement('div');
    el.className = `toast ${tone}`;
    el.textContent = text;
    this.toastsEl.appendChild(el);
    window.setTimeout(() => el.classList.add('out'), 1900);
    window.setTimeout(() => el.remove(), 2400);
  }

  setSoundIcon(on: boolean): void {
    this.btnSound.innerHTML = on ? ICONS.soundOn : ICONS.soundOff;
    this.btnSound.classList.toggle('off', !on);
  }

  setCamIcon(on: boolean): void {
    this.btnCam.classList.toggle('off', !on);
  }

  show(show: boolean): void {
    const root = this.cardsEl.parentElement as HTMLElement;
    root.classList.toggle('hidden', !show);
  }
}
