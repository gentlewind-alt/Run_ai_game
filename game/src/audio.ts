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
}

export const sfx = new Sfx();
