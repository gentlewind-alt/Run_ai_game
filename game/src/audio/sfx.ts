// All sound is synthesised with WebAudio. No audio files.
class Sfx {
  private ctx?: AudioContext;
  private master?: GainNode;
  muted = false;

  /** Must be called from a user gesture (first pointerdown). */
  unlock(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) this.ctx?.suspend();
          else this.ctx?.resume();
        });
      }
      this.ctx.resume();
    } catch { /* audio is optional */ }
  }

  suspend(): void { this.ctx?.suspend(); }
  resume(): void { this.ctx?.resume(); }
  getContext(): AudioContext | undefined { return this.ctx; }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  private tone(f: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, lowpass: number): void {
    if (!this.ctx || !this.master) return;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lowpass;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    s.connect(f).connect(g).connect(this.master);
    s.start();
  }

  stretch(): void { this.tone(180, 0.04, 'square', 0.06); }
  launch(): void { this.tone(260, 0.16, 'square', 0.16, 820); this.noise(0.1, 0.1, 3000); }
  hit(power: number): void { this.noise(0.06 + power * 0.1, 0.25, 1800); this.tone(150, 0.08, 'square', 0.18, 60); }
  crunch(): void { this.noise(0.18, 0.3, 900); this.tone(95, 0.14, 'sawtooth', 0.18, 40); }
  coin(): void { this.tone(988, 0.06, 'square', 0.12); this.tone(1319, 0.12, 'square', 0.12, undefined, 0.06); }
  saw(): void { this.tone(420, 0.55, 'sawtooth', 0.12, 1100); }
  win(): void { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, 'square', 0.14, undefined, i * 0.1)); }
  lose(): void { [392, 330, 262].forEach((f, i) => this.tone(f, 0.22, 'square', 0.14, undefined, i * 0.16)); }
  click(): void { this.tone(660, 0.05, 'square', 0.1); }
  brahmastra(): void {
    // rising choral chord, a bright shimmer and a low boom as the beam ends
    [220, 277, 330, 440].forEach((f, i) => this.tone(f, 1.6, 'triangle', 0.14, f * 1.5, i * 0.05));
    this.tone(1760, 1.2, 'sine', 0.1, 2640, 0.1);
    this.noise(1.4, 0.08, 5200);
    this.tone(70, 0.9, 'sine', 0.3, 30, 1.4);
  }
  thunder(): void {
    this.noise(0.08, 0.35, 4200);
    this.tone(780, 0.06, 'sawtooth', 0.22, 140);
    this.tone(110, 0.85, 'sine', 0.38, 35, 0.03);
    this.noise(0.95, 0.32, 380);
  }
  quake(): void {
    this.tone(75, 0.65, 'triangle', 0.35, 28);
    this.noise(0.55, 0.28, 160);
  }
  ping(): void {
    this.tone(2150, 0.12, 'sine', 0.25, 2600);
    this.tone(3300, 0.08, 'triangle', 0.18);
  }
  thwip(): void {
    this.tone(950, 0.09, 'sawtooth', 0.2, 320);
    this.noise(0.07, 0.15, 2200);
  }
  repulsor(): void {
    this.tone(520, 0.11, 'sine', 0.22, 1280);
    this.tone(260, 0.09, 'square', 0.1, 740);
  }
  twang(): void {
    this.tone(480, 0.15, 'triangle', 0.22, 210);
    this.tone(240, 0.12, 'sawtooth', 0.12, 120);
  }
}

export const sfx = new Sfx();
