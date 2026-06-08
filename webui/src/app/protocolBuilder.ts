import { bytesToHex, parseHexByte } from "../domain/hex";
import {
  buildRequestFrame,
  buildResumeCandidateFrame,
  buildStatusQueryFrame,
  CONTROL_TRANSACTION,
  NORMAL_FAMILY,
  resolveFamily,
  SPECIAL_FAMILY
} from "../domain/protocol";
import type { StoredSettings } from "../services/storage";
import type { BuilderPreview } from "./types";

export const defaultSettings: StoredSettings = {
  waterLevel: "02",
  builderTransaction: "control",
  builderFamily: "auto",
  builderMode: "03",
  builderParameter: "water",
  customTransaction: "01",
  customFamily: "9A",
  customMode: "03",
  customParameter: "02",
  manualHex: "",
  pauseHex: bytesToHex(buildResumeCandidateFrame()),
  lastDevice: null
};

export function getBuilderPreview(settings: StoredSettings): BuilderPreview {
  try {
    if (settings.builderTransaction === "query") {
      const bytes = buildStatusQueryFrame();
      return { bytes, hex: bytesToHex(bytes), error: null };
    }

    const transaction =
      settings.builderTransaction === "custom"
        ? parseHexByte(settings.customTransaction, "TT")
        : CONTROL_TRANSACTION;
    const mode =
      settings.builderMode === "custom" ? parseHexByte(settings.customMode, "MM") : parseHexByte(settings.builderMode, "MM");
    const family = getBuilderFamily(settings, mode);
    const parameter = getBuilderParameter(settings);
    const bytes = buildRequestFrame({ transaction, family, mode, parameter });

    return { bytes, hex: bytesToHex(bytes), error: null };
  } catch (error) {
    return { bytes: [], hex: "", error: error instanceof Error ? error.message : String(error) };
  }
}

export function getBuilderFamily(settings: StoredSettings, mode: number): number {
  if (settings.builderFamily === "auto") {
    return resolveFamily(mode);
  }
  if (settings.builderFamily === "custom") {
    return parseHexByte(settings.customFamily, "CC");
  }
  return settings.builderFamily === "9B" ? SPECIAL_FAMILY : NORMAL_FAMILY;
}

export function getBuilderParameter(settings: StoredSettings): number {
  if (settings.builderParameter === "water") {
    return parseHexByte(settings.waterLevel, "水位");
  }
  if (settings.builderParameter === "custom") {
    return parseHexByte(settings.customParameter, "LL");
  }
  return parseHexByte(settings.builderParameter, "LL");
}

export function byteValue(value: number): string {
  return value.toString(16).padStart(2, "0").toUpperCase();
}
