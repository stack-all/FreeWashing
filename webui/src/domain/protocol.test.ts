import { describe, expect, it } from "vitest";
import { bytesToHex, parseHexPacket } from "./hex";
import {
  buildControlFrame,
  buildPauseFrame,
  buildResumeCandidateFrame,
  buildRequestFrame,
  buildStatusQueryFrame,
  crcCore,
  NORMAL_FAMILY,
  parseWasherResponse,
  SPECIAL_FAMILY
} from "./protocol";

describe("washer protocol", () => {
  it("generates the reverse-engineered request CRC samples", () => {
    expect(crcCore([0xaa, 0x01, 0x9a, 0x02, 0x02])).toBe(0xdb9b);
    expect(crcCore([0xaa, 0x01, 0x9a, 0x03, 0x01])).toBe(0xb93d);
    expect(crcCore([0xaa, 0x01, 0x9b, 0x08, 0x03])).toBe(0xd1e5);
  });

  it("builds query and common control frames from fields", () => {
    expect(bytesToHex(buildStatusQueryFrame())).toBe("AA 00 9A 00 00 DA 0D 55");
    expect(bytesToHex(buildControlFrame(0x02, 0x01, NORMAL_FAMILY))).toBe(
      "AA 01 9A 02 01 68 C9 55"
    );
    expect(bytesToHex(buildControlFrame(0x03, 0x03, NORMAL_FAMILY))).toBe(
      "AA 01 9A 03 03 9B 2E 55"
    );
    expect(bytesToHex(buildControlFrame(0x04, 0x03, SPECIAL_FAMILY))).toBe(
      "AA 01 9B 04 03 1B 40 55"
    );
  });

  it("supports custom request fields", () => {
    const frame = buildRequestFrame({
      transaction: 0x01,
      family: 0x9b,
      mode: 0x08,
      parameter: 0x03
    });
    expect(bytesToHex(frame)).toBe("AA 01 9B 08 03 D1 E5 55");
  });

  it("parses known status responses and validates response CRC", () => {
    const response = parseWasherResponse(parseHexPacket("AA 06 02 02 03 15 03 0D 5A 55"));
    expect(response).toMatchObject({
      validCrc: true,
      deviceStateLabel: "运行中",
      washingStateLabel: "洗涤中",
      modeLabel: "快速洗",
      remainingMinutes: 21,
      waterLevelLabel: "高水位"
    });
  });

  it("labels observed idle, pause and spin response states", () => {
    expect(parseWasherResponse(parseHexPacket("AA 06 00 00 01 00 03 92 12 55"))).toMatchObject({
      validCrc: true,
      deviceStateLabel: "空闲",
      washingStateLabel: "空闲"
    });
    expect(parseWasherResponse(parseHexPacket("AA 06 09 02 03 10 03 3B 13 55"))).toMatchObject({
      validCrc: true,
      deviceStateLabel: "暂停中",
      washingStateLabel: "洗涤中"
    });
    expect(parseWasherResponse(parseHexPacket("AA 06 02 04 03 04 03 C6 08 55"))).toMatchObject({
      validCrc: true,
      washingStateLabel: "脱水中"
    });
    expect(parseWasherResponse(parseHexPacket("AA 06 02 06 03 04 03 C7 61 55"))).toMatchObject({
      validCrc: true,
      washingStateLabel: "自洁中"
    });
  });

  it("keeps resume as an explicit generated candidate", () => {
    expect(bytesToHex(buildResumeCandidateFrame())).toMatch(/^AA 01 9B 05 00 /);
  });

  it("uses the confirmed pause frame", () => {
    expect(bytesToHex(buildPauseFrame())).toBe("AA 02 9A 00 00 DB 64 55");
  });
});
