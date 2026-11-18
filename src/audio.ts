/** LUDO 3D - synthesized SFX tuned for a physical, wooden-board feel (WebAudio, no external assets). */

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  enabled = true;

  private ensure(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.9;
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -18;
        comp.ratio.value = 6;
        this.master.connect(comp).connect(this.ctx.destination);
        // shared noise buffer (1s of white noise, reused by all SFX)
        const len = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Short filtered noise burst — the workhorse for plastic/wood clicks. */
  private clickBurst(delay: number, vol: number, freq: number, q = 1.2, dur = 0.045): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.noiseBuf) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.9 + Math.random() * 0.25;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t0, Math.random() * 0.5, dur + 0.02);
  }

  /** Body resonance: a quickly-decaying sine, gives "wood" weight to a click. */
  private thock(delay: number, freq: number, vol: number, dur = 0.09): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.62, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  /** Pure tone with optional downward slide (chimes / alerts). */
  private tone(delay: number, freq: number, dur: number, vol: number, type: OscillatorType = 'sine', slideTo?: number): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.014);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  /** Marimba-like note: fundamental + soft octave partial, quick wooden decay. */
  private marimba(delay: number, freq: number, vol: number, dur = 0.24): void {
    this.tone(delay, freq, dur, vol, 'sine');
    this.tone(delay, freq * 2, dur * 0.45, vol * 0.32, 'sine');
    this.thock(delay, freq * 0.5, vol * 0.22, 0.05);
  }

  click(): void {
    this.clickBurst(0, 0.22, 2600, 1.4, 0.03);
    this.thock(0, 900, 0.12, 0.045);
  }

  dice(): void {
    // tumbling: a scatter of plastic clicks, decaying like real dice settling
    const n = 7;
    let t = 0.02;
    for (let i = 0; i < n; i++) {
      const vol = 0.30 * Math.pow(1 - i / n, 0.7) + 0.05;
      this.clickBurst(t, vol, 1500 + Math.random() * 2600, 1.6, 0.035);
      if (Math.random() > 0.4) this.thock(t + 0.005, 220 + Math.random() * 140, vol * 0.4, 0.05);
      t += 0.05 + Math.random() * 0.09 * (1 + i * 0.35);
    }
    // final settle thud on the board
    this.thock(t + 0.02, 150, 0.4, 0.13);
    this.clickBurst(t + 0.02, 0.18, 1100, 1.2, 0.05);
  }

  hop(): void {
    // pawn footstep on wood
    this.clickBurst(0, 0.12, 3200, 1.8, 0.02);
    this.thock(0, 520 + Math.random() * 60, 0.22, 0.055);
  }

  capture(): void {
    // sharp knock + falling body thud
    this.clickBurst(0, 0.3, 2200, 1.3, 0.04);
    this.tone(0.01, 300, 0.26, 0.4, 'sine', 90);
    this.thock(0.01, 120, 0.45, 0.16);
  }

  safe(): void {
    this.marimba(0, 740, 0.2, 0.2);
  }

  home(): void {
    this.marimba(0, 523.25, 0.3);
    this.marimba(0.11, 659.25, 0.3);
    this.marimba(0.22, 783.99, 0.32, 0.3);
  }

  win(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((n, i) => this.marimba(i * 0.14, n, 0.34, 0.3));
    // soft pad underneath the arpeggio
    this.tone(0.5, 523.25, 0.9, 0.12, 'triangle');
    this.tone(0.5, 659.25, 0.9, 0.1, 'triangle');
    this.tone(0.5, 783.99, 1.0, 0.1, 'triangle');
  }

  turn(): void {
    this.clickBurst(0, 0.1, 2800, 1.6, 0.025);
    this.thock(0, 700, 0.09, 0.04);
  }

  denied(): void {
    this.tone(0, 220, 0.12, 0.24, 'triangle', 150);
    this.thock(0, 180, 0.2, 0.08);
  }

  connect(): void {
    this.marimba(0, 620, 0.22, 0.18);
    this.marimba(0.1, 830, 0.22, 0.2);
  }
}
