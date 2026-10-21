import { profile } from '../core/profile';
import { data } from '../data/load';
import { sfx } from './sfx';

export type MusicTheme = 'cheerful' | 'dusk';

// 120 BPM -> 0.5s per beat, 0.25s per 8th note, 0.125s per 16th note
const BEAT = 0.5;
const EIGHTH = 0.25;

// Note frequencies (Hz)
const N: Record<string, number> = {
  C1: 32.7, D1: 36.71, E1: 41.2, F1: 43.65, G1: 49.0, Gs1: 51.91, A1: 55.0, B1: 61.74,
  C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.0, Gs2: 103.83, A2: 110.0, B2: 123.47,
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, Gs3: 207.65, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, Gs4: 415.3, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99,
};

class MusicPlayer {
  private activeTheme?: MusicTheme;
  private musicGain?: GainNode;
  private isRunning = false;
  private nextBarTime = 0;
  private loopTimer?: ReturnType<typeof setTimeout>;

  private get ctx(): AudioContext | undefined {
    return sfx.getContext();
  }

  private initGain(): GainNode | undefined {
    const c = this.ctx;
    if (!c) return undefined;
    if (!this.musicGain) {
      this.musicGain = c.createGain();
      this.updateVolume();
      this.musicGain.connect(c.destination);
    }
    return this.musicGain;
  }

  updateVolume(): void {
    if (!this.musicGain || !this.ctx) return;
    const isMuted = profile.settings.muted || sfx.muted || profile.settings.musicOn === false || data.config?.features?.music === false;
    this.musicGain.gain.setValueAtTime(isMuted ? 0 : 0.08, this.ctx.currentTime);
  }

  play(theme: MusicTheme): void {
    if (this.activeTheme === theme && this.isRunning) return;
    this.activeTheme = theme;
    sfx.unlock();
    const c = this.ctx;
    if (!c) return;
    this.initGain();
    this.isRunning = true;
    this.nextBarTime = c.currentTime + 0.05;
    this.scheduleNextBar();
  }

  stop(): void {
    this.isRunning = false;
    this.activeTheme = undefined;
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = undefined;
    }
  }

  private scheduleNote(f: number, startTime: number, dur: number, type: OscillatorType = 'square', vol = 1): void {
    const c = this.ctx;
    const gMaster = this.initGain();
    if (!c || !gMaster || typeof f !== 'number' || !Number.isFinite(f) || f <= 0 || !Number.isFinite(startTime)) return;

    const osc = c.createOscillator();
    const noteGain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, startTime);

    noteGain.gain.setValueAtTime(vol * 0.5, startTime);
    noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + dur - 0.02);

    osc.connect(noteGain);
    noteGain.connect(gMaster);

    osc.start(startTime);
    osc.stop(startTime + dur);
  }

  private scheduleNextBar(): void {
    if (!this.isRunning || !this.activeTheme) return;
    const c = this.ctx;
    if (!c) return;

    const t = this.nextBarTime;
    const theme = this.activeTheme;

    if (theme === 'cheerful') {
      // 4-bar upbeat conga loop (8 seconds total)
      const bass: [number, number, number][] = [
        // Bar 1
        [N.C2, t, EIGHTH], [N.C2, t + EIGHTH, EIGHTH], [N.G2, t + 2 * EIGHTH, EIGHTH], [N.C2, t + 3 * EIGHTH, EIGHTH],
        [N.C2, t + 4 * EIGHTH, EIGHTH], [N.E2, t + 5 * EIGHTH, EIGHTH], [N.G2, t + 6 * EIGHTH, EIGHTH], [N.C2, t + 7 * EIGHTH, EIGHTH],
        // Bar 2
        [N.F2, t + 2.0, EIGHTH], [N.F2, t + 2.0 + EIGHTH, EIGHTH], [N.C3, t + 2.0 + 2 * EIGHTH, EIGHTH], [N.F2, t + 2.0 + 3 * EIGHTH, EIGHTH],
        [N.F2, t + 2.0 + 4 * EIGHTH, EIGHTH], [N.A2, t + 2.0 + 5 * EIGHTH, EIGHTH], [N.C3, t + 2.0 + 6 * EIGHTH, EIGHTH], [N.F2, t + 2.0 + 7 * EIGHTH, EIGHTH],
        // Bar 3
        [N.G2, t + 4.0, EIGHTH], [N.G2, t + 4.0 + EIGHTH, EIGHTH], [N.D3, t + 4.0 + 2 * EIGHTH, EIGHTH], [N.G2, t + 4.0 + 3 * EIGHTH, EIGHTH],
        [N.G2, t + 4.0 + 4 * EIGHTH, EIGHTH], [N.B2, t + 4.0 + 5 * EIGHTH, EIGHTH], [N.D3, t + 4.0 + 6 * EIGHTH, EIGHTH], [N.G2, t + 4.0 + 7 * EIGHTH, EIGHTH],
        // Bar 4
        [N.C2, t + 6.0, EIGHTH], [N.E2, t + 6.0 + EIGHTH, EIGHTH], [N.G2, t + 6.0 + 2 * EIGHTH, EIGHTH], [N.C3, t + 6.0 + 3 * EIGHTH, EIGHTH],
        [N.G2, t + 6.0 + 4 * EIGHTH, EIGHTH], [N.E2, t + 6.0 + 5 * EIGHTH, EIGHTH], [N.C2, t + 6.0 + 6 * EIGHTH, 2 * EIGHTH],
      ];
      for (const [f, st, dur] of bass) this.scheduleNote(f, st, dur, 'triangle', 0.9);

      const lead: [number, number, number][] = [
        // Bar 1: C - E - G - A - G - E
        [N.C4, t, EIGHTH], [N.E4, t + EIGHTH, EIGHTH], [N.G4, t + 2 * EIGHTH, EIGHTH], [N.A4, t + 3 * EIGHTH, BEAT],
        [N.G4, t + 5 * EIGHTH, EIGHTH], [N.E4, t + 6 * EIGHTH, BEAT],
        // Bar 2: F - A - C5 - D5 - C5 - A
        [N.F4, t + 2.0, EIGHTH], [N.A4, t + 2.0 + EIGHTH, EIGHTH], [N.C5, t + 2.0 + 2 * EIGHTH, EIGHTH], [N.D5, t + 2.0 + 3 * EIGHTH, BEAT],
        [N.C5, t + 2.0 + 5 * EIGHTH, EIGHTH], [N.A4, t + 2.0 + 6 * EIGHTH, BEAT],
        // Bar 3: G - B - D5 - E5 - D5 - B
        [N.G4, t + 4.0, EIGHTH], [N.B4, t + 4.0 + EIGHTH, EIGHTH], [N.D5, t + 4.0 + 2 * EIGHTH, EIGHTH], [N.E5, t + 4.0 + 3 * EIGHTH, BEAT],
        [N.D5, t + 4.0 + 5 * EIGHTH, EIGHTH], [N.B4, t + 4.0 + 6 * EIGHTH, BEAT],
        // Bar 4: C5 - G4 - E4 - D4 - C4
        [N.C5, t + 6.0, EIGHTH], [N.G4, t + 6.0 + EIGHTH, EIGHTH], [N.E4, t + 6.0 + 2 * EIGHTH, EIGHTH], [N.D4, t + 6.0 + 3 * EIGHTH, EIGHTH],
        [N.C4, t + 6.0 + 4 * EIGHTH, BEAT * 2],
      ];
      for (const [f, st, dur] of lead) this.scheduleNote(f, st, dur, 'square', 0.6);
    } else {
      // 4-bar dusk/boss march loop (8 seconds total)
      const bass: [number, number, number][] = [
        // Bar 1: A minor
        [N.A1, t, EIGHTH], [N.A1, t + EIGHTH, EIGHTH], [N.E2, t + 2 * EIGHTH, EIGHTH], [N.A1, t + 3 * EIGHTH, EIGHTH],
        [N.A1, t + 4 * EIGHTH, EIGHTH], [N.C2, t + 5 * EIGHTH, EIGHTH], [N.E2, t + 6 * EIGHTH, EIGHTH], [N.A1, t + 7 * EIGHTH, EIGHTH],
        // Bar 2: F major
        [N.F1, t + 2.0, EIGHTH], [N.F1, t + 2.0 + EIGHTH, EIGHTH], [N.C2, t + 2.0 + 2 * EIGHTH, EIGHTH], [N.F1, t + 2.0 + 3 * EIGHTH, EIGHTH],
        [N.F1, t + 2.0 + 4 * EIGHTH, EIGHTH], [N.A1, t + 2.0 + 5 * EIGHTH, EIGHTH], [N.C2, t + 2.0 + 6 * EIGHTH, EIGHTH], [N.F1, t + 2.0 + 7 * EIGHTH, EIGHTH],
        // Bar 3: D minor
        [N.D1, t + 4.0, EIGHTH], [N.D1, t + 4.0 + EIGHTH, EIGHTH], [N.A1, t + 4.0 + 2 * EIGHTH, EIGHTH], [N.D1, t + 4.0 + 3 * EIGHTH, EIGHTH],
        [N.D1, t + 4.0 + 4 * EIGHTH, EIGHTH], [N.F1, t + 4.0 + 5 * EIGHTH, EIGHTH], [N.A1, t + 4.0 + 6 * EIGHTH, EIGHTH], [N.D1, t + 4.0 + 7 * EIGHTH, EIGHTH],
        // Bar 4: E major (suspense resolution)
        [N.E1, t + 6.0, EIGHTH], [N.E1, t + 6.0 + EIGHTH, EIGHTH], [N.B1, t + 6.0 + 2 * EIGHTH, EIGHTH], [N.Gs1, t + 6.0 + 3 * EIGHTH, EIGHTH],
        [N.E1, t + 6.0 + 4 * EIGHTH, EIGHTH], [N.B1, t + 6.0 + 5 * EIGHTH, EIGHTH], [N.E1, t + 6.0 + 6 * EIGHTH, 2 * EIGHTH],
      ];
      for (const [f, st, dur] of bass) this.scheduleNote(f, st, dur, 'triangle', 0.95);

      const lead: [number, number, number][] = [
        // Bar 1: A3 - C4 - E4 - A4
        [N.A3, t, EIGHTH], [N.C4, t + EIGHTH, EIGHTH], [N.E4, t + 2 * EIGHTH, EIGHTH], [N.A4, t + 3 * EIGHTH, BEAT],
        [N.G4, t + 5 * EIGHTH, EIGHTH], [N.E4, t + 6 * EIGHTH, BEAT],
        // Bar 2: F4 - A4 - C5 - B4 - A4
        [N.F4, t + 2.0, EIGHTH], [N.A4, t + 2.0 + EIGHTH, EIGHTH], [N.C5, t + 2.0 + 2 * EIGHTH, EIGHTH], [N.B4, t + 2.0 + 3 * EIGHTH, BEAT],
        [N.A4, t + 2.0 + 5 * EIGHTH, EIGHTH], [N.F4, t + 2.0 + 6 * EIGHTH, BEAT],
        // Bar 3: D4 - F4 - A4 - B4 - A4
        [N.D4, t + 4.0, EIGHTH], [N.F4, t + 4.0 + EIGHTH, EIGHTH], [N.A4, t + 4.0 + 2 * EIGHTH, EIGHTH], [N.B4, t + 4.0 + 3 * EIGHTH, BEAT],
        [N.A4, t + 4.0 + 5 * EIGHTH, EIGHTH], [N.F4, t + 4.0 + 6 * EIGHTH, BEAT],
        // Bar 4: E4 - G#4 - B4 - D5 - C5 - B4
        [N.E4, t + 6.0, EIGHTH], [N.Gs4, t + 6.0 + EIGHTH, EIGHTH], [N.B4, t + 6.0 + 2 * EIGHTH, EIGHTH], [N.D5, t + 6.0 + 3 * EIGHTH, EIGHTH],
        [N.C5, t + 6.0 + 4 * EIGHTH, EIGHTH], [N.B4, t + 6.0 + 5 * EIGHTH, BEAT],
      ];
      for (const [f, st, dur] of lead) this.scheduleNote(f, st, dur, 'sawtooth', 0.55);
    }

    this.nextBarTime += 8.0;
    const msUntilNext = Math.max(100, (this.nextBarTime - c.currentTime - 1.0) * 1000);
    this.loopTimer = setTimeout(() => this.scheduleNextBar(), msUntilNext);
  }
}

export const music = new MusicPlayer();
