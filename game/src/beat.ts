// The game's metronome: 120 BPM. Anything that moves on the beat reads from here.
export const BPM = 120;
export const BEAT_MS = 60000 / BPM;

/** 0..1 position inside the current beat. */
export const beatPhase = (t: number): number => (t % BEAT_MS) / BEAT_MS;

/** Sharp 1 -> 0 pulse that peaks on the beat. */
export const beatPulse = (t: number): number => Math.pow(1 - beatPhase(t), 3);

/** Smooth -1..1 bob, two per second at 120 BPM, offset by a per-object phase. */
export const beatBob = (t: number, phase = 0): number => Math.sin((t / BEAT_MS) * Math.PI * 2 + phase);

/** Milliseconds until the next beat lands. */
export const msToNextBeat = (t: number): number => BEAT_MS - (t % BEAT_MS);
