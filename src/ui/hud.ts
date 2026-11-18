import { Color, PlayerInfo } from '../game/rules';
import { getLang, t } from '../i18n';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector(sel) as T;

const CARD_POS: Record<Color, string> = {
  red: 'card-pos-bl',
  green: 'card-pos-tl',
  yellow: 'card-pos-tr',
  blue: 'card-pos-br'
};
const AVATAR_CLS: Record<Color, string> = { red: 'pc-red', green: 'pc-green', yellow: 'pc-yellow', blue: 'pc-blue' };
const DS_CLS: Record<Color, string> = { red: 'ds-red', green: 'ds-green', yellow: 'ds-yellow', blue: 'ds-blue' };
const HEX: Record<Color, string> = { red: '#e43131', green: '#2eb23b', yellow: '#fccf1f', blue: '#2265e8' };

export class Hud {
  onSoundToggle: ((on: boolean) => void) | null = null;
  /** Fired when the active player's dice slot is tapped. */
  onDiceTap: ((color: Color) => void) | null = null;
  private rolling = false;

  constructor() {
    this.buildPlayerCards();
  }

  private buildPlayerCards(): void {
    const wrap = $('#player-cards');
    wrap.innerHTML = '';
    (Object.keys(CARD_POS) as Color[]).forEach((c) => {
      const div = document.createElement('div');
      div.className = `player-card hidden ${CARD_POS[c]}`;
      div.id = `card-${c}`;
      div.innerHTML = `
        <div class="avatar ${AVATAR_CLS[c]}" id="av-${c}">A</div>
        <div class="pinfo">
          <div class="pname" id="pn-${c}"></div>
          <div class="homes" id="hm-${c}">${'<span class="home-dot"></span>'.repeat(4)}</div>
        </div>
        <button class="dice-slot ${DS_CLS[c]}" id="ds-${c}" aria-label="${t('roll')}">${Hud.diceSvg(5)}</button>`;
      wrap.appendChild(div);
      const slot = div.querySelector(`#ds-${c}`) as HTMLButtonElement;
      slot.addEventListener('click', (e) => {
        e.preventDefault();
        if (slot.classList.contains('tap')) this.onDiceTap?.(c);
      });
    });
  }

  /** SVG die face (no emojis — pure vector). */
  static diceSvg(n: number): string {
    const P: Record<number, [number, number][]> = {
      1: [[50, 50]],
      2: [[26, 26], [74, 74]],
      3: [[26, 26], [50, 50], [74, 74]],
      4: [[26, 26], [74, 26], [26, 74], [74, 74]],
      5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
      6: [[26, 24], [74, 24], [26, 50], [74, 50], [26, 76], [74, 76]]
    };
    const pips = (P[n] ?? P[5]).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#1d2534"/>`).join('');
    return `<svg class="die" viewBox="0 0 100 100" aria-hidden="true"><rect x="5" y="5" width="90" height="90" rx="21" fill="#ffffff" stroke="#b9c6dd" stroke-width="4"/>${pips}</svg>`;
  }

  static iconSound(on: boolean): string {
    return on
      ? '<svg class="ic" viewBox="0 0 24 24"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" fill="currentColor"/><path d="M15 9c1 .8 1.5 1.8 1.5 3s-.5 2.2-1.5 3" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M17.5 6.8c1.7 1.3 2.6 3.1 2.6 5.2s-.9 3.9-2.6 5.2" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>'
      : '<svg class="ic" viewBox="0 0 24 24"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" fill="currentColor"/><path d="m15.5 9.5 5 5M20.5 9.5l-5 5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';
  }

  showMenu(on: boolean): void {
    $('#screen-menu').classList.toggle('hidden', !on);
    $('#hud').classList.toggle('hidden', on);
  }

  showSetup(which: '' | 'local' | 'bots'): void {
    $('#menu-actions').classList.toggle('hidden', which !== '');
    $('#local-setup').classList.toggle('hidden', which !== 'local');
    $('#bots-setup').classList.toggle('hidden', which !== 'bots');
  }

  updateCards(players: PlayerInfo[], tokens: Record<Color, number[]>, turn: number, currentTurnColor: Color | null): void {
    for (const p of players) {
      const card = $(`#card-${p.color}`);
      card.classList.remove('hidden');
      const homeCount = tokens[p.color].filter((v) => v === 56).length;
      const dots = $(`#hm-${p.color}`).children;
      for (let i = 0; i < dots.length; i++) dots[i].classList.toggle('filled', i < homeCount);
      const nameEl = $(`#pn-${p.color}`);
      let label = p.name;
      if (p.kind === 'bot') label = `${t('botName')} · ${p.name}`;
      nameEl.textContent = label;
      const av = $(`#av-${p.color}`);
      av.textContent = (p.name || '?').charAt(0).toUpperCase();
      card.classList.toggle('active', players.indexOf(p) === turn);
      card.classList.toggle('done', homeCount === 4);
      const finished = players.filter((x) => tokens[x.color].every((v) => v === 56)).length;
      card.classList.toggle('out', homeCount === 4 && players.indexOf(p) !== turn && finished < players.length);
    }
  }

  hideCards(): void {
    (Object.keys(CARD_POS) as Color[]).forEach((c) => $(`#card-${c}`).classList.add('hidden'));
  }

  /** Light up the current player's dice slot; `tappable` = local human may roll. */
  setRoll(color: Color | null, tappable = false): void {
    (Object.keys(CARD_POS) as Color[]).forEach((c) => {
      const slot = $(`#ds-${c}`) as HTMLButtonElement;
      slot.classList.toggle('on', c === color);
      slot.classList.toggle('tap', c === color && tappable);
    });
  }

  /** Shake + cycle random faces, then settle on the real value (predetermined by the engine for P2P sync). */
  rollDice(color: Color, value: number, ms = 780): Promise<void> {
    const slot = $(`#ds-${color}`) as HTMLButtonElement;
    slot.classList.remove('pop');
    slot.classList.add('rolling');
    this.rolling = true;
    return new Promise((resolve) => {
      const cycle = window.setInterval(() => {
        slot.innerHTML = Hud.diceSvg(1 + Math.floor(Math.random() * 6));
      }, 80);
      window.setTimeout(() => {
        window.clearInterval(cycle);
        slot.classList.remove('rolling');
        slot.innerHTML = Hud.diceSvg(value);
        void slot.offsetWidth;
        slot.classList.add('pop');
        this.rolling = false;
        window.setTimeout(resolve, 340);
      }, ms);
    });
  }

  get isRolling(): boolean {
    return this.rolling;
  }

  /** Back to the idle dim state (used on game start / exit / finish). */
  diceReset(): void {
    this.rolling = false;
    (Object.keys(CARD_POS) as Color[]).forEach((c) => {
      const slot = $(`#ds-${c}`) as HTMLButtonElement;
      slot.classList.remove('on', 'tap', 'rolling', 'pop');
      slot.innerHTML = Hud.diceSvg(5);
    });
  }

  toast(text: string, colorDot?: Color, life = 1.9): void {
    const el = document.createElement('div');
    el.className = 'toast';
    el.style.setProperty('--life', `${life}s`);
    el.innerHTML = colorDot ? `<span class="mini-dot" style="background:${HEX[colorDot]}"></span>${text}` : text;
    $('#toasts').appendChild(el);
    window.setTimeout(() => el.remove(), life * 1000 + 400);
  }

  confetti(): void {
    const wrap = document.createElement('div');
    wrap.className = 'confetti';
    const colors = [HEX.red, HEX.green, HEX.yellow, HEX.blue, '#f6b73c', '#ffffff'];
    for (let i = 0; i < 90; i++) {
      const p = document.createElement('i');
      p.style.left = `${Math.random() * 100}vw`;
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = `${2.2 + Math.random() * 2.2}s`;
      p.style.animationDelay = `${Math.random() * 0.9}s`;
      p.style.transform = `rotate(${Math.random() * 360}deg)`;
      p.style.borderRadius = Math.random() > 0.6 ? '50%' : '3px';
      wrap.appendChild(p);
    }
    document.body.appendChild(wrap);
    window.setTimeout(() => wrap.remove(), 5600);
  }

  dialog(id: string | null): void {
    document.querySelectorAll('.dialog').forEach((d) => d.classList.add('hidden'));
    if (id) $(id).classList.remove('hidden');
  }

  static bindSeg(sel: string, onChange: (v: string) => void, initial?: string): void {
    const seg = $(sel);
    seg.querySelectorAll('button').forEach((b) => {
      if (initial && b.dataset.v === initial) {
        seg.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
      }
      b.addEventListener('click', () => {
        seg.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
        onChange(b.dataset.v ?? '');
      });
    });
  }

  static setSeg(sel: string, v: string): void {
    const seg = $(sel);
    seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.v === v));
  }

  static getSeg(sel: string): string {
    return $(`${sel} button.on`)?.dataset.v ?? '';
  }

  renderSeats(seats: { name: string; color: Color; kind: string }[]): void {
    const box = $('#seats-box');
    box.innerHTML = `<p class="room-label">${t('seats')}</p>`;
    for (const s of seats) {
      const div = document.createElement('div');
      div.className = 'seat';
      const role = s.kind === 'bot' ? t('bot') : s.kind === 'remote' ? '' : t('host');
      div.innerHTML = `
        <div class="avatar ${AVATAR_CLS[s.color]}">${s.name.charAt(0).toUpperCase()}</div>
        <span>${s.name}</span>
        ${role ? `<span class="seat-role">${role}</span>` : ''}`;
      box.appendChild(div);
    }
    const empty = 4 - seats.length;
    for (let i = 0; i < Math.min(empty, 4 - Math.max(seats.length, 2)); i++) {
      const div = document.createElement('div');
      div.className = 'seat empty';
      div.innerHTML = `<span>${t('waitingPlayers')}</span>`;
      box.appendChild(div);
    }
    void getLang;
  }

  renderRanks(ranked: { color: Color; name: string; kind: string }[]): void {
    const box = $('#win-ranks');
    box.innerHTML = '';
    ranked.forEach((r, i) => {
      const div = document.createElement('div');
      div.className = `rank-row${i === 0 ? ' first' : ''}`;
      div.innerHTML = `
        <span class="rank-num">${i + 1}º</span>
        <div class="avatar ${AVATAR_CLS[r.color]}">${r.name.charAt(0).toUpperCase()}</div>
        <span>${r.name}${r.kind === 'bot' ? ` · ${t('botName')}` : ''}</span>`;
      box.appendChild(div);
    });
  }

  showHelp(): void {
    const body = $('#help-body');
    body.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
      const p = document.createElement('p');
      p.innerHTML = `<span class="help-num">${i}</span><span>${t(`how${i}`)}</span>`;
      body.appendChild(p);
    }
    this.dialog('#dlg-help');
  }
}
