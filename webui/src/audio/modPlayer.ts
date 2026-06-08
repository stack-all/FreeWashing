const CHANNEL_COUNT = 4;
const ROWS_PER_PATTERN = 64;
const PATTERN_BYTES = ROWS_PER_PATTERN * CHANNEL_COUNT * 4;
const SAMPLE_COUNT = 31;
const MODULE_HEADER_BYTES = 1084;
const AMIGA_PAL_CLOCK = 7093789.2;
const DEFAULT_SPEED = 6;
const DEFAULT_BPM = 125;
const DEFAULT_VOLUME = 0.36;
const MIX_GAIN = 0.42;
const CHANNEL_PAN = [0.18, 0.82, 0.82, 0.18] as const;
const SUPPORTED_SIGNATURES = new Set(["M.K.", "M!K!", "4CHN", "FLT4"]);

export interface ProTrackerSample {
  name: string;
  data: Float32Array;
  finetune: number;
  volume: number;
  loopStart: number;
  loopEnd: number | null;
}

export interface ProTrackerNote {
  sampleNumber: number;
  period: number;
  effect: number;
  parameter: number;
}

export interface ProTrackerModule {
  title: string;
  signature: string;
  songLength: number;
  patternCount: number;
  sequence: number[];
  samples: ProTrackerSample[];
  patterns: ProTrackerNote[][];
}

export interface RenderedModuleAudio {
  left: Float32Array;
  right: Float32Array;
  frameCount: number;
  duration: number;
}

interface ChannelState {
  sample: ProTrackerSample | null;
  volume: number;
  position: number;
  baseStep: number;
  arpeggio: number;
}

type AudioContextConstructor = new (
  contextOptions?: AudioContextOptions
) => AudioContext;

type WebAudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: AudioContextConstructor;
  };

export class ModLoopPlayer {
  private context: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private bufferPromise: Promise<AudioBuffer> | null = null;
  private muted = false;

  constructor(
    private readonly url: string,
    private readonly volume = DEFAULT_VOLUME
  ) {}

  async play(): Promise<void> {
    const context = this.ensureContext();
    if (!context) {
      return;
    }

    this.applyVolume();
    const buffer = await this.getBuffer(context);

    if (!this.sourceNode) {
      this.startSource(context, buffer);
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
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
      } catch {
        // The source may already be stopped by the browser.
      }
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    this.gainNode?.disconnect();
    this.gainNode = null;

    if (this.context && this.context.state !== "closed") {
      void this.context.close().catch(() => undefined);
    }
    this.context = null;
  }

  private ensureContext(): AudioContext | null {
    if (this.context && this.context.state !== "closed") {
      return this.context;
    }

    const AudioContextClass =
      window.AudioContext ?? (window as WebAudioWindow).webkitAudioContext;

    if (!AudioContextClass) {
      return null;
    }

    this.context = new AudioContextClass({ latencyHint: "playback" });
    this.gainNode = this.context.createGain();
    this.gainNode.connect(this.context.destination);
    this.sourceNode = null;
    this.applyVolume();

    return this.context;
  }

  private async getBuffer(context: AudioContext): Promise<AudioBuffer> {
    if (!this.bufferPromise) {
      this.bufferPromise = this.loadBuffer(context).catch((error: unknown) => {
        this.bufferPromise = null;
        throw error;
      });
    }

    return this.bufferPromise;
  }

  private async loadBuffer(context: AudioContext): Promise<AudioBuffer> {
    const response = await fetch(this.url);
    if (!response.ok) {
      throw new Error(`MOD load failed: ${response.status}`);
    }

    const module = parseProTrackerModule(await response.arrayBuffer());
    const rendered = renderProTrackerModule(module, context.sampleRate);
    const audioBuffer = context.createBuffer(
      2,
      rendered.frameCount,
      context.sampleRate
    );
    audioBuffer.getChannelData(0).set(rendered.left);
    audioBuffer.getChannelData(1).set(rendered.right);
    return audioBuffer;
  }

  private startSource(context: AudioContext, buffer: AudioBuffer): void {
    if (!this.gainNode) {
      return;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.gainNode);
    source.start();
    source.onended = () => {
      if (this.sourceNode === source) {
        this.sourceNode = null;
      }
    };
    this.sourceNode = source;
  }

  private applyVolume(): void {
    if (this.gainNode) {
      this.gainNode.gain.value = this.muted ? 0 : this.volume;
    }
  }
}

export function parseProTrackerModule(buffer: ArrayBuffer): ProTrackerModule {
  if (buffer.byteLength < MODULE_HEADER_BYTES) {
    throw new Error("MOD file is too small");
  }

  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const signature = readAscii(bytes, 1080, 4);

  if (!SUPPORTED_SIGNATURES.has(signature)) {
    throw new Error(`Unsupported MOD signature: ${signature || "unknown"}`);
  }

  const title = readAscii(bytes, 0, 20);
  const songLength = Math.min(bytes[950], 128);
  const sequence = Array.from(bytes.slice(952, 952 + songLength));
  const patternCount = Math.max(...sequence, 0) + 1;
  const sampleDataStart = MODULE_HEADER_BYTES + patternCount * PATTERN_BYTES;

  if (buffer.byteLength < sampleDataStart) {
    throw new Error("MOD pattern data is incomplete");
  }

  const sampleHeaders = Array.from({ length: SAMPLE_COUNT }, (_, index) => {
    const offset = 20 + index * 30;
    const length = view.getUint16(offset + 22, false) * 2;
    const finetuneNibble = bytes[offset + 24] & 0x0f;
    const finetune = finetuneNibble > 7 ? finetuneNibble - 16 : finetuneNibble;
    const volume = Math.min(bytes[offset + 25], 64);
    const loopStart = view.getUint16(offset + 26, false) * 2;
    const loopLength = view.getUint16(offset + 28, false) * 2;

    return {
      name: readAscii(bytes, offset, 22),
      length,
      finetune,
      volume,
      loopStart,
      loopLength
    };
  });

  let sampleOffset = sampleDataStart;
  const samples = sampleHeaders.map((header) => {
    const data = new Float32Array(header.length);

    for (let index = 0; index < header.length; index += 1) {
      const sourceIndex = sampleOffset + index;
      data[index] =
        sourceIndex < bytes.length ? view.getInt8(sourceIndex) / 128 : 0;
    }

    const loopStart = clamp(header.loopStart, 0, header.length);
    const loopEnd =
      header.loopLength > 2
        ? clamp(loopStart + header.loopLength, loopStart, header.length)
        : null;

    sampleOffset += header.length;

    return {
      name: header.name,
      data,
      finetune: header.finetune,
      volume: header.volume,
      loopStart,
      loopEnd: loopEnd && loopEnd > loopStart ? loopEnd : null
    };
  });

  const patterns = Array.from({ length: patternCount }, (_, patternIndex) => {
    const patternOffset = MODULE_HEADER_BYTES + patternIndex * PATTERN_BYTES;
    return Array.from(
      { length: ROWS_PER_PATTERN * CHANNEL_COUNT },
      (_, noteIndex) => {
        const offset = patternOffset + noteIndex * 4;
        const first = bytes[offset];
        const second = bytes[offset + 1];
        const third = bytes[offset + 2];
        const fourth = bytes[offset + 3];

        return {
          sampleNumber: (first & 0xf0) | (third >> 4),
          period: ((first & 0x0f) << 8) | second,
          effect: third & 0x0f,
          parameter: fourth
        };
      }
    );
  });

  return {
    title,
    signature,
    songLength,
    patternCount,
    sequence,
    samples,
    patterns
  };
}

export function renderProTrackerModule(
  module: ProTrackerModule,
  sampleRate: number
): RenderedModuleAudio {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error("Invalid output sample rate");
  }

  const states: ChannelState[] = Array.from({ length: CHANNEL_COUNT }, () => ({
    sample: null,
    volume: 0,
    position: 0,
    baseStep: 0,
    arpeggio: 0
  }));

  const leftRows: Float32Array[] = [];
  const rightRows: Float32Array[] = [];
  let frameCount = 0;
  let speed = DEFAULT_SPEED;
  let bpm = DEFAULT_BPM;

  for (const patternNumber of module.sequence) {
    const pattern = module.patterns[patternNumber];
    if (!pattern) {
      continue;
    }

    for (let row = 0; row < ROWS_PER_PATTERN; row += 1) {
      const rowNotes = getRowNotes(pattern, row);

      for (const note of rowNotes) {
        if (note.effect === 0x0f && note.parameter > 0) {
          if (note.parameter <= 32) {
            speed = note.parameter;
          } else {
            bpm = note.parameter;
          }
        }
      }

      for (let channel = 0; channel < CHANNEL_COUNT; channel += 1) {
        applyNote(
          states[channel],
          rowNotes[channel],
          module.samples,
          sampleRate
        );
      }

      const rowFrameCount = Math.max(
        1,
        Math.round(((2.5 * speed) / bpm) * sampleRate)
      );
      const tickFrameCount = Math.max(1, rowFrameCount / Math.max(speed, 1));
      const left = new Float32Array(rowFrameCount);
      const right = new Float32Array(rowFrameCount);

      renderRow(states, left, right, tickFrameCount);
      leftRows.push(left);
      rightRows.push(right);
      frameCount += rowFrameCount;
    }
  }

  const left = concatRows(leftRows, frameCount);
  const right = concatRows(rightRows, frameCount);

  return {
    left,
    right,
    frameCount,
    duration: frameCount / sampleRate
  };
}

function getRowNotes(
  pattern: ProTrackerNote[],
  row: number
): ProTrackerNote[] {
  const offset = row * CHANNEL_COUNT;
  return pattern.slice(offset, offset + CHANNEL_COUNT);
}

function applyNote(
  state: ChannelState,
  note: ProTrackerNote,
  samples: ProTrackerSample[],
  sampleRate: number
): void {
  state.arpeggio = 0;

  if (note.sampleNumber > 0) {
    const sample = samples[note.sampleNumber - 1];
    if (sample) {
      state.sample = sample;
      state.volume = sample.volume / 64;
    }
  }

  if (note.period > 0 && state.sample) {
    state.position = 0;
    state.baseStep = periodToStep(note.period, state.sample, sampleRate);
  }

  if (note.effect === 0x00 && note.parameter > 0) {
    state.arpeggio = note.parameter;
  }

  if (note.effect === 0x0c) {
    state.volume = clamp(note.parameter, 0, 64) / 64;
  }
}

function renderRow(
  states: ChannelState[],
  left: Float32Array,
  right: Float32Array,
  tickFrameCount: number
): void {
  for (let frame = 0; frame < left.length; frame += 1) {
    let leftSample = 0;
    let rightSample = 0;

    for (let channel = 0; channel < CHANNEL_COUNT; channel += 1) {
      const state = states[channel];
      if (!normalizePosition(state)) {
        continue;
      }

      const sample = state.sample;
      if (!sample) {
        continue;
      }

      const value = sample.data[Math.floor(state.position)] * state.volume;
      const pan = CHANNEL_PAN[channel];
      leftSample += value * (1 - pan);
      rightSample += value * pan;

      const step = getFrameStep(state, frame, tickFrameCount);
      state.position += step;
    }

    left[frame] = clamp(leftSample * MIX_GAIN, -1, 1);
    right[frame] = clamp(rightSample * MIX_GAIN, -1, 1);
  }
}

function periodToStep(
  period: number,
  sample: ProTrackerSample,
  sampleRate: number
): number {
  const frequency =
    (AMIGA_PAL_CLOCK / (period * 2)) *
    2 ** (sample.finetune / (12 * 8));
  return frequency / sampleRate;
}

function getFrameStep(
  state: ChannelState,
  frame: number,
  tickFrameCount: number
): number {
  if (!state.arpeggio) {
    return state.baseStep;
  }

  const tick = Math.floor(frame / tickFrameCount) % 3;
  const semitone =
    tick === 1
      ? (state.arpeggio >> 4) & 0x0f
      : tick === 2
        ? state.arpeggio & 0x0f
        : 0;

  return state.baseStep * 2 ** (semitone / 12);
}

function normalizePosition(state: ChannelState): boolean {
  const sample = state.sample;
  if (!sample || sample.data.length === 0) {
    state.sample = null;
    return false;
  }

  const end = sample.loopEnd ?? sample.data.length;
  if (state.position >= end) {
    if (sample.loopEnd !== null) {
      const loopLength = sample.loopEnd - sample.loopStart;
      state.position =
        sample.loopStart + ((state.position - sample.loopStart) % loopLength);
    } else {
      state.sample = null;
      return false;
    }
  }

  return state.position < sample.data.length;
}

function concatRows(rows: Float32Array[], frameCount: number): Float32Array {
  const output = new Float32Array(frameCount);
  let offset = 0;

  for (const row of rows) {
    output.set(row, offset);
    offset += row.length;
  }

  return output;
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  let value = "";

  for (let index = 0; index < length; index += 1) {
    const code = bytes[offset + index];
    if (code > 0) {
      value += String.fromCharCode(code);
    }
  }

  return value.trim();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
