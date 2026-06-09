export const DEFAULT_CHIPTUNE_SEED = "freewashing:init";

const DEFAULT_VOLUME = 0.36;
const LOOP_STEPS = 64;
const STEP_DIVISION = 4;
const SCALE_BANK = [
  [0, 2, 3, 5, 7, 10, 12, 14],
  [0, 2, 4, 7, 9, 12, 14, 16],
  [0, 3, 5, 6, 7, 10, 12, 15],
  [0, 1, 5, 7, 8, 12, 13, 17],
  [0, 2, 5, 7, 9, 12, 17, 19]
] as const;
const WAVE_SHAPES = ["square", "pulse", "triangle", "saw"] as const;
const DRUM_PROFILES = [
  { kicks: [0, 8], snares: [4, 12], hatEvery: 2 },
  { kicks: [0, 6, 10], snares: [4, 12, 14], hatEvery: 2 },
  { kicks: [0, 4, 8, 12], snares: [6, 14], hatEvery: 1 },
  { kicks: [0, 7, 11], snares: [3, 12], hatEvery: 4 },
  { kicks: [0, 5, 8, 13], snares: [4, 10, 14], hatEvery: 1 }
] as const;
const BASS_PATTERNS = [
  [0, 0, 4, 0, 2, 0, 4, 1],
  [0, 3, 4, 3, 0, 2, 5, 4],
  [0, 0, 2, 4, 5, 4, 2, 1],
  [0, 4, 0, 5, 3, 2, 4, 0]
] as const;

type AudioContextConstructor = new () => AudioContext;
type WaveShape = (typeof WAVE_SHAPES)[number];

interface ChiptuneProfile {
  bpm: number;
  rootMidi: number;
  scale: readonly number[];
  melodyLength: number;
  melodyRestChance: number;
  leadShape: WaveShape;
  bassShape: WaveShape;
  leadGain: number;
  bassGain: number;
  drumGain: number;
  arpeggioGain: number;
  bitDepth: number;
  swing: number;
  drumProfile: (typeof DRUM_PROFILES)[number];
  bassPattern: readonly number[];
}

export interface RenderedChiptune {
  left: Float32Array;
  right: Float32Array;
  frameCount: number;
  duration: number;
}

export class ChiptuneLoopPlayer {
  private context: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private muted = false;
  private seed: string;

  constructor(seed = DEFAULT_CHIPTUNE_SEED, private readonly volume = DEFAULT_VOLUME) {
    this.seed = seed || DEFAULT_CHIPTUNE_SEED;
  }

  setSeed(seed: string): void {
    const nextSeed = seed || DEFAULT_CHIPTUNE_SEED;
    if (nextSeed === this.seed) {
      return;
    }

    this.seed = nextSeed;
    if (this.context) {
      this.restartSource();
    }
  }

  async play(): Promise<void> {
    const context = this.ensureContext();
    if (!context) {
      return;
    }

    this.applyVolume();
    if (!this.sourceNode) {
      this.startSource();
    }

    if (context.state !== "running") {
      await context.resume();
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyVolume();
  }

  dispose(): void {
    this.stopSource();
    this.gainNode?.disconnect();
    this.gainNode = null;

    if (this.context && this.context.state !== "closed") {
      void this.context.close();
    }
    this.context = null;
  }

  private ensureContext(): AudioContext | null {
    if (this.context) {
      return this.context;
    }

    const AudioContextClass = getAudioContextConstructor();
    if (!AudioContextClass) {
      return null;
    }

    const context = new AudioContextClass();
    const gainNode = context.createGain();
    gainNode.connect(context.destination);
    this.context = context;
    this.gainNode = gainNode;
    this.applyVolume();
    return context;
  }

  private restartSource(): void {
    if (!this.context) {
      return;
    }

    this.stopSource();
    this.startSource();
  }

  private startSource(): void {
    const context = this.context;
    const gainNode = this.gainNode;
    if (!context || !gainNode) {
      return;
    }

    const rendered = renderSeededChiptune(this.seed, context.sampleRate);
    const buffer = context.createBuffer(2, rendered.frameCount, context.sampleRate);
    buffer.getChannelData(0).set(rendered.left);
    buffer.getChannelData(1).set(rendered.right);

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gainNode);
    source.onended = () => {
      if (this.sourceNode === source) {
        this.sourceNode = null;
      }
    };
    source.start();
    this.sourceNode = source;
  }

  private stopSource(): void {
    const source = this.sourceNode;
    if (!source) {
      return;
    }

    this.sourceNode = null;
    source.onended = null;
    try {
      source.stop();
    } catch {
      // The node may already be stopped during browser lifecycle changes.
    }
    source.disconnect();
  }

  private applyVolume(): void {
    if (!this.gainNode) {
      return;
    }

    this.gainNode.gain.value = this.muted ? 0 : this.volume;
  }
}

export function renderSeededChiptune(seed: string, sampleRate: number): RenderedChiptune {
  const normalizedSeed = seed || DEFAULT_CHIPTUNE_SEED;
  const hash = hashSeed(normalizedSeed);
  const random = mulberry32(hash);
  const profile = createProfile(hash, random);
  const stepSeconds = 60 / profile.bpm / STEP_DIVISION;
  const frameCount = Math.round(LOOP_STEPS * stepSeconds * sampleRate);
  const left = new Float32Array(frameCount);
  const right = new Float32Array(frameCount);
  const melody = createMelody(random, profile);
  const arpeggio = createArpeggio(random, profile.scale);

  for (let frame = 0; frame < frameCount; frame += 1) {
    const time = frame / sampleRate;
    const step = Math.floor(time / stepSeconds) % LOOP_STEPS;
    const localStepTime = time - Math.floor(time / stepSeconds) * stepSeconds;
    const swungTime = time + (step % 2 === 1 ? profile.swing : 0);
    const beatStep = step % 16;
    const melodyNote = melody[step % melody.length];
    const bassNote = profile.bassPattern[Math.floor(step / 4) % profile.bassPattern.length];
    const accent = beatStep === 0 ? 1.24 : beatStep % 4 === 0 ? 1.08 : 1;
    let sample = 0;

    if (melodyNote !== null) {
      const freq = midiToFrequency(profile.rootMidi + melodyNote);
      const leadEnvelope = decayEnvelope(localStepTime, stepSeconds * 0.72, 0.2);
      const duty = 0.42 + ((hash >>> (step % 12)) & 3) * 0.04;
      sample += renderWave(profile.leadShape, freq, swungTime, duty) * leadEnvelope * profile.leadGain * accent;
      sample += renderWave(profile.leadShape, freq * 2, swungTime, 0.5) * leadEnvelope * profile.leadGain * 0.18;
    }

    if (shouldRenderBass(step, hash)) {
      const bassFreq = midiToFrequency(profile.rootMidi - 24 + profile.scale[bassNote % profile.scale.length]);
      const bassEnvelope = decayEnvelope(localStepTime, stepSeconds * 1.18, 0.34);
      sample += renderWave(profile.bassShape, bassFreq, time, 0.5) * bassEnvelope * profile.bassGain;
    }

    if (profile.arpeggioGain > 0) {
      const arpNote = arpeggio[(step + Math.floor(localStepTime / Math.max(stepSeconds / 3, 0.001))) % arpeggio.length];
      const arpFreq = midiToFrequency(profile.rootMidi + 12 + arpNote);
      const arpEnvelope = decayEnvelope(localStepTime, stepSeconds * 0.58, 0.16);
      sample += renderWave("pulse", arpFreq, time, 0.25) * arpEnvelope * profile.arpeggioGain;
    }

    sample += renderKick(profile, step, localStepTime, stepSeconds, time);
    sample += renderSnare(profile, hash, step, localStepTime, stepSeconds, frame);
    sample += renderHat(profile, hash, step, localStepTime, stepSeconds, frame);
    sample += renderSeedFill(profile, hash, step, localStepTime, stepSeconds, time, frame);

    const quantized = quantize8Bit(clamp(sample * 0.74, -1, 1), profile.bitDepth);
    const pan = melodyNote === null ? 0 : ((melodyNote % 7) - 3) * 0.035;
    left[frame] = clamp(quantized * (0.94 - pan), -1, 1);
    right[frame] = clamp(quantized * (0.94 + pan), -1, 1);
  }

  return {
    left,
    right,
    frameCount,
    duration: frameCount / sampleRate
  };
}

function createProfile(hash: number, random: () => number): ChiptuneProfile {
  const energy = hash & 3;
  const tempoBase = [88, 102, 116, 130][energy];
  const profileIndex = (hash >>> 4) % DRUM_PROFILES.length;
  const scale = SCALE_BANK[(hash >>> 8) % SCALE_BANK.length];
  return {
    bpm: tempoBase + Math.floor(random() * 8),
    rootMidi: [38, 41, 43, 45, 48, 50][(hash >>> 12) % 6],
    scale,
    melodyLength: [8, 12, 16, 32][(hash >>> 16) & 3],
    melodyRestChance: [0.12, 0.2, 0.32, 0.42][(hash >>> 18) & 3],
    leadShape: WAVE_SHAPES[(hash >>> 20) % WAVE_SHAPES.length],
    bassShape: WAVE_SHAPES[(hash >>> 22) % WAVE_SHAPES.length],
    leadGain: [0.32, 0.42, 0.5, 0.58][energy],
    bassGain: [0.42, 0.36, 0.46, 0.32][(hash >>> 24) & 3],
    drumGain: [0.72, 0.86, 1, 1.12][profileIndex % 4],
    arpeggioGain: ((hash >>> 26) & 3) === 0 ? 0 : [0.1, 0.16, 0.22][(hash >>> 28) % 3],
    bitDepth: [5, 6, 7, 8][(hash >>> 2) & 3],
    swing: (((hash >>> 6) & 3) / 3) * 0.018,
    drumProfile: DRUM_PROFILES[profileIndex],
    bassPattern: BASS_PATTERNS[(hash >>> 10) % BASS_PATTERNS.length]
  };
}

function createMelody(random: () => number, profile: ChiptuneProfile): Array<number | null> {
  const phrase: Array<number | null> = [];
  let previousDegree = 0;

  for (let index = 0; index < profile.melodyLength; index += 1) {
    if (index % 4 !== 0 && random() < profile.melodyRestChance) {
      phrase.push(null);
      continue;
    }

    const leap = random() > 0.72 ? Math.floor(random() * profile.scale.length) : Math.max(0, previousDegree + Math.floor(random() * 3) - 1);
    previousDegree = leap % profile.scale.length;
    const octave = random() > 0.7 ? 12 : random() < 0.12 ? -12 : 0;
    phrase.push(profile.scale[previousDegree] + octave);
  }
  return phrase;
}

function createArpeggio(random: () => number, scale: readonly number[]): number[] {
  const first = scale[0];
  const second = scale[2 + Math.floor(random() * 2)] ?? scale[2];
  const third = scale[4 + Math.floor(random() * 2)] ?? scale[4];
  const turn = scale[1 + Math.floor(random() * 5)] ?? scale[1];
  return [first, second, third, second, turn, third, second, first];
}

function shouldRenderBass(step: number, hash: number): boolean {
  const pattern = (hash >>> 14) & 3;
  if (pattern === 0) {
    return step % 4 === 0 || step % 4 === 2;
  }
  if (pattern === 1) {
    return step % 4 !== 3;
  }
  if (pattern === 2) {
    return step % 2 === 0;
  }
  return step % 8 === 0 || step % 8 === 3 || step % 8 === 6;
}

function renderKick(profile: ChiptuneProfile, step: number, localTime: number, stepSeconds: number, time: number): number {
  if (!(profile.drumProfile.kicks as readonly number[]).includes(step % 16)) {
    return 0;
  }

  const envelope = decayEnvelope(localTime, stepSeconds * 0.92, 0.24);
  const freq = 46 + 86 * Math.exp(-localTime * 34);
  return Math.sin(Math.PI * 2 * freq * time) * envelope * 0.42 * profile.drumGain;
}

function renderSnare(profile: ChiptuneProfile, hash: number, step: number, localTime: number, stepSeconds: number, frame: number): number {
  if (!(profile.drumProfile.snares as readonly number[]).includes(step % 16)) {
    return 0;
  }

  const envelope = decayEnvelope(localTime, stepSeconds * 0.64, 0.18);
  return seededNoise(frame, hash ^ 0x9e3779b9) * envelope * 0.28 * profile.drumGain;
}

function renderHat(
  profile: ChiptuneProfile,
  hash: number,
  step: number,
  localTime: number,
  stepSeconds: number,
  frame: number
): number {
  if (step % profile.drumProfile.hatEvery !== 0) {
    return 0;
  }

  if (profile.drumProfile.hatEvery === 1 && step % 2 !== 0 && ((hash >>> (step % 12)) & 1) === 0) {
    return 0;
  }

  const envelope = decayEnvelope(localTime, stepSeconds * 0.28, 0.08);
  return seededNoise(frame, hash ^ 0x85ebca6b) * envelope * 0.12 * profile.drumGain;
}

function renderSeedFill(
  profile: ChiptuneProfile,
  hash: number,
  step: number,
  localTime: number,
  stepSeconds: number,
  time: number,
  frame: number
): number {
  const fillMode = (hash >>> 30) & 3;
  const beatStep = step % 16;
  if (fillMode === 0 || beatStep < 13) {
    return 0;
  }

  const envelope = decayEnvelope(localTime, stepSeconds * 0.38, 0.12);
  if (fillMode === 1) {
    return seededNoise(frame, hash ^ 0xc2b2ae35) * envelope * 0.18 * profile.drumGain;
  }

  const fillFreq = midiToFrequency(profile.rootMidi + 12 + profile.scale[(beatStep + fillMode) % profile.scale.length]);
  return renderWave(fillMode === 2 ? "saw" : "pulse", fillFreq, time, 0.25) * envelope * 0.2;
}

function decayEnvelope(localTime: number, length: number, sharpness: number): number {
  if (localTime > length) {
    return 0;
  }

  const normalized = localTime / length;
  return Math.pow(1 - normalized, 1 / sharpness);
}

function renderWave(shape: WaveShape, frequency: number, time: number, duty: number): number {
  if (shape === "pulse") {
    return squareWave(frequency, time, duty);
  }

  const phase = (time * frequency) % 1;
  if (shape === "triangle") {
    return 1 - 4 * Math.abs(phase - 0.5);
  }

  if (shape === "saw") {
    return phase * 2 - 1;
  }

  return squareWave(frequency, time, 0.5);
}

function squareWave(frequency: number, time: number, duty: number): number {
  const phase = (time * frequency) % 1;
  return phase < duty ? 1 : -1;
}

function midiToFrequency(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

function quantize8Bit(sample: number, bitDepth: number): number {
  const steps = 2 ** bitDepth - 1;
  return Math.round(sample * steps) / steps;
}

function seededNoise(index: number, seed: number): number {
  let value = (Math.imul(index, 374761393) + Math.imul(seed, 668265263)) >>> 0;
  value ^= value >>> 13;
  value = Math.imul(value, 1274126177) >>> 0;
  value ^= value >>> 16;
  return (value / 0xffffffff) * 2 - 1;
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}

function mulberry32(seed: number): () => number {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  const maybeWindow = window as typeof window & {
    webkitAudioContext?: AudioContextConstructor;
  };

  return maybeWindow.AudioContext ?? maybeWindow.webkitAudioContext ?? null;
}
