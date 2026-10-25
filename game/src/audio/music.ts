import { profile } from '../core/profile';
import { data } from '../data/load';
import { sfx } from './sfx';
import { buildPhrase, type NoteEvent } from './trackgen';

/** A track request: a theme id from data/music.json, the level number (picks key and tempo drift) and whether it is a boss level. */
export interface TrackRequest { theme: string; variant?: number; boss?: boolean }

class MusicPlayer {
  private active?: TrackRequest;
  private musicGain?: GainNode;
  /** One bus per track: stopping a track silences everything it already scheduled, so a new track starts clean at once. */
  private bus?: GainNode;
  private isRunning = false;
  private nextPhraseTime = 0;
  private phraseNo = 0;
  private noiseBuf?: AudioBuffer;
  private loopTimer?: ReturnType<typeof setTimeout>;
  /** Debug and tests: what is playing now. */
  current(): TrackRequest | undefined { return this.active; }

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

  /** Starts a track; the same track already playing is left alone. */
  play(req: TrackRequest): void {
    const a = this.active;
    if (a && this.isRunning && a.theme === req.theme && (a.variant ?? 0) === (req.variant ?? 0) && !!a.boss === !!req.boss) return;
    this.stop();
    this.active = req;
    sfx.unlock();
    const c = this.ctx;
    if (!c) return;
    const master = this.initGain();
    if (master) {
      this.bus = c.createGain();
      this.bus.connect(master);
    }
    this.isRunning = true;
    this.phraseNo = 0;
    this.nextPhraseTime = c.currentTime + 0.02;
    this.schedulePhrase();
  }

  /** The track for a level: its realm's theme (data), the level number as the variant, boss levels get the boss mix. */
  playForLevel(levelId: number, realmId: string, boss: boolean): void {
    // the realm that lists the level (the Bonus Yard levels keep their old realm's look but get the bonus theme), else the level's own realm
    const theme = (data.content.realms.find((r) => r.levels.includes(levelId)) ?? data.content.realms.find((r) => r.id === realmId))?.music ?? 'hills';
    this.play({ theme, variant: levelId, boss });
  }

  stop(): void {
    this.isRunning = false;
    this.active = undefined;
    const old = this.bus;
    const c = this.ctx;
    this.bus = undefined;
    if (old && c) {
      old.gain.cancelScheduledValues(c.currentTime);
      old.gain.setTargetAtTime(0, c.currentTime, 0.012);
      setTimeout(() => old.disconnect(), 250);
    }
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = undefined;
    }
  }

  private noise(): AudioBuffer | undefined {
    const c = this.ctx;
    if (!c) return undefined;
    if (!this.noiseBuf) {
      this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuf;
  }

  private play1(e: NoteEvent, at: number): void {
    const c = this.ctx;
    const g = this.bus;
    if (!c || !g || !Number.isFinite(e.freq) || e.freq <= 0) return;
    const start = at + e.t;
    const gain = c.createGain();
    gain.connect(g);
    if (e.kind === 'note') {
      const osc = c.createOscillator();
      osc.type = e.wave;
      osc.frequency.setValueAtTime(e.freq, start);
      gain.gain.setValueAtTime(e.vol * 0.5, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + Math.max(0.05, e.dur - 0.02));
      osc.connect(gain);
      osc.start(start);
      osc.stop(start + e.dur);
      return;
    }
    if (e.kind === 'kick') {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(e.freq * 1.8, start);
      osc.frequency.exponentialRampToValueAtTime(40, start + e.dur);
      gain.gain.setValueAtTime(e.vol * 0.9, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + e.dur);
      osc.connect(gain);
      osc.start(start);
      osc.stop(start + e.dur);
      return;
    }
    const buf = this.noise();
    if (!buf) return;
    const src = c.createBufferSource();
    src.buffer = buf;
    const filt = c.createBiquadFilter();
    filt.type = e.kind === 'hat' ? 'highpass' : 'bandpass';
    filt.frequency.value = e.kind === 'hat' ? 6000 : 1800;
    gain.gain.setValueAtTime(e.vol * (e.kind === 'hat' ? 0.25 : 0.5), start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + e.dur);
    src.connect(filt);
    filt.connect(gain);
    src.start(start);
    src.stop(start + e.dur);
  }

  private schedulePhrase(): void {
    const c = this.ctx;
    const req = this.active;
    const md = data.music;
    if (!this.isRunning || !c || !req || !md) return;
    const phrase = buildPhrase(md, req.theme, req.variant ?? 0, !!req.boss, this.phraseNo++);
    for (const e of phrase.events) this.play1(e, this.nextPhraseTime);
    this.nextPhraseTime += phrase.seconds;
    const msUntilNext = Math.max(100, (this.nextPhraseTime - c.currentTime - 1.0) * 1000);
    this.loopTimer = setTimeout(() => this.schedulePhrase(), msUntilNext);
  }
}

export const music = new MusicPlayer();
