export function assertByte(value: number, label = "byte"): number {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new Error(`${label} 必须是 00-FF 之间的十六进制字节`);
  }
  return value;
}

export function parseHexByte(value: string, label = "byte"): number {
  const normalized = value.trim().replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{1,2}$/.test(normalized)) {
    throw new Error(`${label} 必须是 00-FF 之间的十六进制字节`);
  }
  return assertByte(Number.parseInt(normalized, 16), label);
}

export function parseHexPacket(input: string): number[] {
  const compact = input.replace(/0x/gi, "").replace(/[\s,;:_-]/g, "").toUpperCase();

  if (!compact) {
    throw new Error("HEX 包不能为空");
  }

  if (!/^[0-9A-F]+$/.test(compact)) {
    throw new Error("HEX 包只能包含 0-9、A-F 和常见分隔符");
  }

  if (compact.length % 2 !== 0) {
    throw new Error("HEX 包长度必须是偶数");
  }

  const bytes: number[] = [];
  for (let index = 0; index < compact.length; index += 2) {
    bytes.push(Number.parseInt(compact.slice(index, index + 2), 16));
  }
  return bytes;
}

export function bytesToHex(bytes: Iterable<number>): string {
  return Array.from(bytes, (byte) => assertByte(byte).toString(16).padStart(2, "0").toUpperCase()).join(" ");
}

export function bytesToCompactHex(bytes: Iterable<number>): string {
  return Array.from(bytes, (byte) => assertByte(byte).toString(16).padStart(2, "0").toUpperCase()).join("");
}
