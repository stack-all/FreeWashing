import { assertByte, bytesToHex } from "./hex";

export const FRAME_HEAD = 0xaa;
export const FRAME_TAIL = 0x55;
export const DEVICE_ADDRESS = 0x01;
export const QUERY_TRANSACTION = 0x00;
export const CONTROL_TRANSACTION = 0x01;
export const RESPONSE_TRANSACTION = 0x06;
export const NORMAL_FAMILY = 0x9a;
export const SPECIAL_FAMILY = 0x9b;
export const RESPONSE_CRC_XOR = 0x4f23;

export type WaterLevelCode = 0x01 | 0x02 | 0x03;
export type WasherModeCode = 0x01 | 0x02 | 0x03 | 0x04 | 0x08;

export interface RequestFields {
  transaction: number;
  family: number;
  mode: number;
  parameter: number;
}

export interface WasherModeDefinition {
  id: string;
  label: string;
  code: WasherModeCode;
  defaultFamily: number;
  defaultParameter: WaterLevelCode;
}

export interface WaterLevelDefinition {
  id: string;
  label: string;
  code: WaterLevelCode;
}

export interface ParsedWasherResponse {
  raw: string;
  validCrc: boolean | null;
  expectedCrc?: string;
  receivedCrc?: string;
  deviceState: number;
  deviceStateLabel: string;
  washingState: number;
  washingStateLabel: string;
  mode: number;
  modeLabel: string;
  remainingMinutes: number;
  waterLevel: number;
  waterLevelLabel: string;
}

export const WATER_LEVELS: WaterLevelDefinition[] = [
  { id: "low", label: "低水位", code: 0x01 },
  { id: "middle", label: "中水位", code: 0x02 },
  { id: "high", label: "高水位", code: 0x03 }
];

export const WASHER_MODES: WasherModeDefinition[] = [
  {
    id: "intensive",
    label: "强力洗",
    code: 0x01,
    defaultFamily: NORMAL_FAMILY,
    defaultParameter: 0x02
  },
  {
    id: "standard",
    label: "标准洗",
    code: 0x02,
    defaultFamily: NORMAL_FAMILY,
    defaultParameter: 0x02
  },
  {
    id: "quick",
    label: "快速洗",
    code: 0x03,
    defaultFamily: NORMAL_FAMILY,
    defaultParameter: 0x02
  },
  {
    id: "spin",
    label: "单脱水",
    code: 0x04,
    defaultFamily: SPECIAL_FAMILY,
    defaultParameter: 0x03
  },
  {
    id: "tub-clean",
    label: "自洁",
    code: 0x08,
    defaultFamily: SPECIAL_FAMILY,
    defaultParameter: 0x03
  }
];

export const RESUME_CANDIDATE_FIELDS: RequestFields = {
  transaction: CONTROL_TRANSACTION,
  family: SPECIAL_FAMILY,
  mode: 0x05,
  parameter: 0x00
};

export const PAUSE_FRAME: readonly number[] = [0xaa, 0x02, 0x9a, 0x00, 0x00, 0xdb, 0x64, 0x55];

export function crcCore(bytes: readonly number[]): number {
  let crc = 0xe4a5;

  for (const byte of bytes) {
    crc ^= assertByte(byte);
    for (let bit = 0; bit < 8; bit += 1) {
      if ((crc & 1) === 1) {
        crc = ((crc >> 1) ^ 0x8048) & 0xffff;
      } else {
        crc = (crc >> 1) & 0xffff;
      }
    }
  }

  return crc;
}

export function resolveFamily(mode: number): number {
  if (mode === 0x04 || mode === 0x08) {
    return SPECIAL_FAMILY;
  }
  return NORMAL_FAMILY;
}

export function buildRequestFrame(fields: RequestFields): number[] {
  const firstFive = [
    FRAME_HEAD,
    assertByte(fields.transaction, "TT"),
    assertByte(fields.family, "CC"),
    assertByte(fields.mode, "MM"),
    assertByte(fields.parameter, "LL")
  ];
  const crc = crcCore(firstFive);
  return [...firstFive, (crc >> 8) & 0xff, crc & 0xff, FRAME_TAIL];
}

export function buildControlFrame(mode: number, parameter: number, family = resolveFamily(mode)): number[] {
  return buildRequestFrame({
    transaction: CONTROL_TRANSACTION,
    family,
    mode,
    parameter
  });
}

export function buildStatusQueryFrame(): number[] {
  return buildRequestFrame({
    transaction: QUERY_TRANSACTION,
    family: NORMAL_FAMILY,
    mode: 0x00,
    parameter: 0x00
  });
}

export function buildResumeCandidateFrame(): number[] {
  return buildRequestFrame(RESUME_CANDIDATE_FIELDS);
}

export function buildPauseFrame(): number[] {
  return [...PAUSE_FRAME];
}

export function describeMode(code: number): string {
  return WASHER_MODES.find((mode) => mode.code === code)?.label ?? `未知模式 0x${hexByte(code)}`;
}

export function describeWaterLevel(code: number): string {
  return WATER_LEVELS.find((level) => level.code === code)?.label ?? `参数 0x${hexByte(code)}`;
}

export function describeDeviceState(code: number): string {
  switch (code) {
    case 0x00:
      return "空闲";
    case 0x01:
      return "启动中";
    case 0x02:
      return "运行中";
    case 0x09:
      return "暂停中";
    default:
      return `未知状态 0x${hexByte(code)}`;
  }
}

export function describeWashingState(code: number): string {
  switch (code) {
    case 0x00:
      return "空闲";
    case 0x02:
      return "洗涤中";
    case 0x04:
      return "脱水中";
    case 0x06:
      return "自洁中";
    default:
      return `未知阶段 0x${hexByte(code)}`;
  }
}

export function parseWasherResponse(bytes: readonly number[]): ParsedWasherResponse | null {
  if (bytes.length < 10 || bytes[0] !== FRAME_HEAD || bytes[1] !== RESPONSE_TRANSACTION) {
    return null;
  }

  const frame = Array.from(bytes.slice(0, 10), (byte) => assertByte(byte));
  const receivedCrc = (frame[7] << 8) | frame[8];
  const expectedCrc = crcCore(frame.slice(0, 7)) ^ RESPONSE_CRC_XOR;

  return {
    raw: bytesToHex(frame),
    validCrc: receivedCrc === expectedCrc,
    expectedCrc: wordToHex(expectedCrc),
    receivedCrc: wordToHex(receivedCrc),
    deviceState: frame[2],
    deviceStateLabel: describeDeviceState(frame[2]),
    washingState: frame[3],
    washingStateLabel: describeWashingState(frame[3]),
    mode: frame[4],
    modeLabel: describeMode(frame[4]),
    remainingMinutes: frame[5],
    waterLevel: frame[6],
    waterLevelLabel: describeWaterLevel(frame[6])
  };
}

export function hexByte(byte: number): string {
  return assertByte(byte).toString(16).padStart(2, "0").toUpperCase();
}

export function wordToHex(value: number): string {
  return `${hexByte((value >> 8) & 0xff)} ${hexByte(value & 0xff)}`;
}
