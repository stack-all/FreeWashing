import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  parseProTrackerModule,
  renderProTrackerModule
} from "./modPlayer";

const moduleUrl = new URL(
  "../../public/audio/freewashing_8bit_loop.mod",
  import.meta.url
);

function readModule(): ArrayBuffer {
  const bytes = readFileSync(moduleUrl);
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  );
}

describe("modPlayer", () => {
  it("parses the bundled ProTracker module", () => {
    const module = parseProTrackerModule(readModule());

    expect(module.signature).toBe("M.K.");
    expect(module.songLength).toBe(6);
    expect(module.patternCount).toBe(6);
    expect(module.samples.filter((sample) => sample.data.length > 0)).toHaveLength(
      6
    );
  });

  it("renders audible PCM from the bundled module", () => {
    const module = parseProTrackerModule(readModule());
    const rendered = renderProTrackerModule(module, 8000);
    let peak = 0;

    for (let index = 0; index < rendered.frameCount; index += 1) {
      peak = Math.max(
        peak,
        Math.abs(rendered.left[index]),
        Math.abs(rendered.right[index])
      );
    }

    expect(rendered.duration).toBeGreaterThan(20);
    expect(peak).toBeGreaterThan(0.01);
  });
});
