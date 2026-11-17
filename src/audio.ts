/** Efeitos sonoros sintetizados via WebAudio (sem assets externos) */
class Sfx {
  enabled = true;
  private ctx: AudioContext | null = null;

  ensure(): void {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private tone(f0: number, f1: number, dur: number, type: OscillatorType, vol: number, when = 0): void {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, vol: number, when = 0): void {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2400;
    src.connect(filter).connect(g).connect(this.ctx.destination);
    src.start(t0);
  }

  click(): void {
    this.tone(600, 880, 0.06, 'triangle', 0.12);
  }

  diceShake(): void {
    this.noise(0.05, 0.18, 0);
    this.noise(0.05, 0.16, 0.09);
    this.noise(0.05, 0.14, 0.18);
  }

  diceLand(): void {
    this.tone(190, 90, 0.12, 'sine', 0.3);
    this.noise(0.05, 0.2, 0.02);
  }

  hop(): void {
    this.tone(520, 700, 0.06, 'triangle', 0.14);
  }

  select(): void {
    this.tone(720, 980, 0.05, 'triangle', 0.1);
  }

  capture(): void {
    this.tone(320, 110, 0.3, 'sawtooth', 0.2);
    this.noise(0.12, 0.22, 0.02);
  }

  six(): void {
    this.tone(660, 660, 0.09, 'square', 0.1);
    this.tone(880, 880, 0.09, 'square', 0.1, 0.09);
    this.tone(1320, 1320, 0.12, 'square', 0.1, 0.18);
  }

  home(): void {
    this.tone(523, 523, 0.1, 'sine', 0.16);
    this.tone(659, 659, 0.1, 'sine', 0.16, 0.1);
    this.tone(784, 784, 0.14, 'sine', 0.16, 0.2);
    this.tone(1046, 1046, 0.18, 'sine', 0.16, 0.3);
  }

  win(): void {
    const seq = [523, 659, 784, 1046, 784, 1046, 1318];
    seq.forEach((f, i) => this.tone(f, f, 0.16, 'triangle', 0.18, i * 0.14));
  }

  forfeit(): void {
    this.tone(240, 170, 0.35, 'square', 0.16);
  }

  none(): void {
    this.tone(330, 280, 0.12, 'sine', 0.12);
  }
}

export const sfx = new Sfx();
