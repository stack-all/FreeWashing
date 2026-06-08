export const DEFAULT_CHIPTUNE_SEED = "freewashing:init";

const DEFAULT_VOLUME = 0.36;
const LOOP_STEPS = 64;
const STEP_DIVISION = 4;
const SCALE = [0, 2, 3, 5, 7, 10, 12, 14];

type AudioContextConstructor = new () => AudioContext;

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
  const bpm = 96 + Math.floor(random() * 32);
  const rootMidi = 43 + Math.floor(random() * 12);
  const stepSeconds = 60 / bpm / STEP_DIVISION;
  const frameCount = Math.round(LOOP_STEPS * stepSeconds * sampleRate);
  const left = new Float32Array(frameCount);
  const right = new Float32Array(frameCount);
  const melody = createMelody(random);
  const bass = createBass(random);
  const hatEveryStep = random() > 0.48;
  const swing = random() * 0.012;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const time = frame / sampleRate;
    const step = Math.floor(time / stepSeconds) % LOOP_STEPS;
    const localStepTime = time - Math.floor(time / stepSeconds) * stepSeconds;
    const swungTime = time + (step % 2 === 1 ? swing : 0);
    const melodyNote = melody[step % melody.length];
    const bassNote = bass[Math.floor(step / 4) % bass.length];
    let sample = 0;

    if (melodyNote !== null) {
      const freq = midiToFrequency(rootMidi + melodyNote);
      const leadEnvelope = decayEnvelope(localStepTime, stepSeconds * 0.82, 0.28);
      const duty = 0.42 + ((hash >>> (step % 12)) & 3) * 0.04;
      sample += squareWave(freq, swungTime, duty) * leadEnvelope * 0.38;
      sample += squareWave(freq * 2, swungTime, 0.5) * leadEnvelope * 0.09;
    }

    if (step % 4 === 0 || step % 4 === 2) {
      const bassFreq = midiToFrequency(rootMidi - 24 + bassNote);
      const bassEnvelope = decayEnvelope(localStepTime, stepSeconds * 1.35, 0.42);
      sample += squareWave(bassFreq, time, 0.5) * bassEnvelope * 0.34;
    }

    sample += renderKick(step, localStepTime, stepSeconds, time);
    sample += renderSnare(hash, step, localStepTime, stepSeconds, frame);
    sample += renderHat(hash, step, localStepTime, stepSeconds, frame, hatEveryStep);

    const quantized = quantize8Bit(clamp(sample * 0.72, -1, 1));
    const pan = melodyNote === null ? 0 : ((melodyNote % 5) - 2) * 0.04;
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

function createMelody(random: () => number): Array<number | null> {
  const phrase: Array<number | null> = [];
  for (let index = 0; index < 16; index += 1) {
    if (index % 4 !== 0 && random() < 0.28) {
      phrase.push(null);
      continue;
    }

    const octave = random() > 0.78 ? 12 : 0;
    phrase.push(SCALE[Math.floor(random() * SCALE.length)] + octave);
  }
  return phrase;
}

function createBass(random: () => number): number[] {
  const root = SCALE[0];
  const fifth = SCALE[4];
  const minor = SCALE[2];
  const walk = SCALE[Math.floor(random() * 4)];
  return [root, root, fifth, root, minor, root, fifth, walk];
}

function renderKick(step: number, localTime: number, stepSeconds: number, time: number): number {
  const beatStep = step % 16;
  if (beatStep !== 0 && beatStep !== 8) {
    return 0;
  }

  const envelope = decayEnvelope(localTime, stepSeconds * 0.92, 0.24);
  const freq = 46 + 86 * Math.exp(-localTime * 34);
  return Math.sin(Math.PI * 2 * freq * time) * envelope * 0.42;
}

function renderSnare(hash: number, step: number, localTime: number, stepSeconds: number, frame: number): number {
  const beatStep = step % 16;
  if (beatStep !== 4 && beatStep !== 12) {
    return 0;
  }

  const envelope = decayEnvelope(localTime, stepSeconds * 0.64, 0.18);
  return seededNoise(frame, hash ^ 0x9e3779b9) * envelope * 0.28;
}

function renderHat(
  hash: number,
  step: number,
  localTime: number,
  stepSeconds: number,
  frame: number,
  hatEveryStep: boolean
): number {
  if (!hatEveryStep && step % 2 !== 0) {
    return 0;
  }

  if (hatEveryStep && step % 2 !== 0 && ((hash >>> (step % 12)) & 1) === 0) {
    return 0;
  }

  const envelope = decayEnvelope(localTime, stepSeconds * 0.28, 0.08);
  return seededNoise(frame, hash ^ 0x85ebca6b) * envelope * 0.12;
}

function decayEnvelope(localTime: number, length: number, sharpness: number): number {
  if (localTime > length) {
    return 0;
  }

  const normalized = localTime / length;
  return Math.pow(1 - normalized, 1 / sharpness);
}

function squareWave(frequency: number, time: number, duty: number): number {
  const phase = (time * frequency) % 1;
  return phase < duty ? 1 : -1;
}

function midiToFrequency(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

function quantize8Bit(sample: number): number {
  return Math.round(sample * 127) / 127;
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
