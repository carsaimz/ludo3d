/** LUDO 3D - lightweight synthesized SFX (WebAudio, no external assets). */

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  enabled = true;

  private ensure(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.5, delay = 0, slideTo?: number): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, vol = 0.4, delay = 0, freq = 2400): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = 1.1;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(bp).connect(g).connect(this.master);
    src.start(t0);
  }

  click(): void {
    this.tone(660, 0.06, 'square', 0.18);
  }

  dice(): void {
    for (let i = 0; i < 5; i++) this.noise(0.05, 0.3, i * 0.11, 1800 + Math.random() * 1400);
    this.tone(220, 0.08, 'triangle', 0.2, 0.02);
  }

  hop(): void {
    this.tone(480 + Math.random() * 60, 0.09, 'sine', 0.32, 0, 720);
  }

  capture(): void {
    this.tone(420, 0.28, 'sawtooth', 0.35, 0, 110);
    this.noise(0.12, 0.25, 0.02, 900);
  }

  safe(): void {
    this.tone(880, 0.12, 'sine', 0.22);
  }

  home(): void {
    this.tone(523.25, 0.14, 'sine', 0.35, 0);
    this.tone(659.25, 0.14, 'sine', 0.35, 0.11);
    this.tone(783.99, 0.2, 'sine', 0.38, 0.22);
  }

  win(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((n, i) => this.tone(n, 0.22, 'triangle', 0.4, i * 0.13));
    this.tone(1046.5, 0.5, 'sine', 0.3, 0.75);
  }

  turn(): void {
    this.tone(880, 0.1, 'sine', 0.2);
  }

  denied(): void {
    this.tone(160, 0.14, 'square', 0.22);
  }

  connect(): void {
    this.tone(520, 0.1, 'sine', 0.25);
    this.tone(780, 0.12, 'sine', 0.25, 0.09);
  }
}
