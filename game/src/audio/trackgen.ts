// Turns a theme from data/music.json into notes. Pure (no Web Audio, no imports) so tools/render_tracks.mjs can test and render it.
// One phrase is 4 bars of 8 eighth-notes. A "variant" (the level number) changes the key, the tempo a little and the lead line, so
// every level of a realm sounds related but not identical. Boss levels apply the theme's `boss` modifier.

export interface ThemeDef {
  bpm: number;
  rootMidi: number;
  scale: number[];
  progression: number[];
  bass: { wave: OscillatorKind; vol: number; pattern: (number | null)[] };
  lead: { wave: OscillatorKind; vol: number; octave: number; pattern: (number | null)[] };
  pad?: { wave: OscillatorKind; vol: number };
  arp?: { wave: OscillatorKind; vol: number; octave: number };
  drums?: { kick?: string; snare?: string; hat?: string };
  boss?: { bpmMult?: number; transpose?: number; leadWave?: OscillatorKind; drums?: { kick?: string; snare?: string; hat?: string }; bassVol?: number };
}
export type OscillatorKind = 'sine' | 'square' | 'sawtooth' | 'triangle';
export interface MusicData { transposeByVariant: number[]; themes: Record<string, ThemeDef> }
export interface NoteEvent {
  kind: 'note' | 'kick' | 'snare' | 'hat';
  t: number; // seconds from the start of the phrase
  dur: number;
  freq: number;
  wave: OscillatorKind;
  vol: number;
}

const midiToHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

/** Scale degree (any integer, may be negative) to a MIDI note above `root`. */
export function degreeToMidi(root: number, scale: number[], degree: number): number {
  const n = scale.length;
  const oct = Math.floor(degree / n);
  const idx = ((degree % n) + n) % n;
  return root + 12 * oct + scale[idx];
}

const BARS = 4;

export function phraseSeconds(theme: ThemeDef, variant: number, boss: boolean): number {
  return (BARS * 4 * 60) / tempoFor(theme, variant, boss);
}

export function tempoFor(theme: ThemeDef, variant: number, boss: boolean): number {
  const drift = 1 + 0.015 * (((variant % 5) + 5) % 5 - 2);
  return theme.bpm * drift * (boss ? theme.boss?.bpmMult ?? 1.15 : 1);
}

/** All notes of one 4-bar phrase. `phraseNo` counts phrases played so far (it rotates the lead so a long level does not loop identically). */
export function buildPhrase(data: MusicData, themeId: string, variant: number, boss: boolean, phraseNo = 0): { events: NoteEvent[]; seconds: number } {
  const theme = data.themes[themeId] ?? data.themes.hills;
  const bpm = tempoFor(theme, variant, boss);
  const eighth = 30 / bpm;
  const transposes = data.transposeByVariant;
  const transpose = (transposes[((variant % transposes.length) + transposes.length) % transposes.length] ?? 0) + (boss ? theme.boss?.transpose ?? 0 : 0);
  const root = theme.rootMidi + transpose;
  const scale = theme.scale;
  const events: NoteEvent[] = [];
  const drums = boss && theme.boss?.drums ? theme.boss.drums : theme.drums;
  const leadWave = boss && theme.boss?.leadWave ? theme.boss.leadWave : theme.lead.wave;
  const bassVol = theme.bass.vol * (boss ? theme.boss?.bassVol ?? 1.1 : 1);

  for (let bar = 0; bar < BARS; bar++) {
    const t0 = bar * 8 * eighth;
    const chordRoot = theme.progression[bar % theme.progression.length];
    const chord = [chordRoot, chordRoot + 2, chordRoot + 4, chordRoot + scale.length];

    theme.bass.pattern.forEach((p, i) => {
      if (p === null || p === undefined) return;
      const midi = degreeToMidi(root, scale, chord[p % chord.length]);
      events.push({ kind: 'note', t: t0 + i * eighth, dur: eighth * 0.95, freq: midiToHz(midi), wave: theme.bass.wave, vol: bassVol });
    });

    // the lead: the pattern is rotated by the variant and the phrase number, and every other bar swaps its last two steps
    const pat = theme.lead.pattern;
    const rot = (variant + phraseNo + bar) % 3;
    pat.forEach((_, i) => {
      let j = (i + rot) % pat.length;
      if (bar % 2 === 1 && i >= pat.length - 2) j = pat.length - 1 - (i - (pat.length - 2));
      const p = pat[j];
      if (p === null || p === undefined) return;
      const midi = degreeToMidi(root + 12 * theme.lead.octave, scale, chordRoot + p);
      const long = pat[(j + 1) % pat.length] === null;
      events.push({ kind: 'note', t: t0 + i * eighth, dur: eighth * (long ? 1.9 : 0.9), freq: midiToHz(midi), wave: leadWave, vol: theme.lead.vol });
    });

    if (theme.pad) {
      for (const d of chord.slice(0, 3)) {
        events.push({ kind: 'note', t: t0, dur: 8 * eighth * 0.98, freq: midiToHz(degreeToMidi(root + 12, scale, d)), wave: theme.pad.wave, vol: theme.pad.vol });
      }
    }
    if (theme.arp) {
      for (let i = 0; i < 16; i++) {
        const d = chord[[0, 1, 2, 3, 2, 1][i % 6] % chord.length];
        events.push({ kind: 'note', t: t0 + i * eighth / 2, dur: eighth / 2 * 0.9, freq: midiToHz(degreeToMidi(root + 12 * theme.arp.octave, scale, d)), wave: theme.arp.wave, vol: theme.arp.vol });
      }
    }
    if (drums) {
      for (const [name, str] of [['kick', drums.kick], ['snare', drums.snare], ['hat', drums.hat]] as const) {
        if (!str) continue;
        for (let i = 0; i < 8; i++) {
          if (str[i % str.length] === 'x') events.push({ kind: name, t: t0 + i * eighth, dur: name === 'hat' ? 0.04 : name === 'kick' ? 0.14 : 0.12, freq: name === 'kick' ? 90 : name === 'snare' ? 220 : 6000, wave: 'sine', vol: name === 'hat' ? 0.5 : 1 });
        }
      }
    }
  }
  return { events, seconds: BARS * 8 * eighth };
}
