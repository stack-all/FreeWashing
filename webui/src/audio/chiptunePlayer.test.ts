import { describe, expect, it } from "vitest";
import { renderSeededChiptune } from "./chiptunePlayer";

function signature(samples: Float32Array): number {
  let value = 0;
  for (let index = 0; index < Math.min(samples.length, 4096); index += 31) {
    value = (value + Math.round((samples[index] + 1) * 100000) * (index + 1)) >>> 0;
  }
  return value;
}

function averageDifference(first: Float32Array, second: Float32Array): number {
  const frameCount = Math.min(first.length, second.length);
  let total = 0;
  let samples = 0;

  for (let index = 0; index < frameCount; index += 97) {
    total += Math.abs(first[index] - second[index]);
    samples += 1;
  }

  return total / samples;
}

describe("chiptunePlayer", () => {
  it("renders deterministic PCM for the same seed", () => {
    const first = renderSeededChiptune("AA 01 9A 03 02 0A 6F 55", 8000);
    const second = renderSeededChiptune("AA 01 9A 03 02 0A 6F 55", 8000);

    expect(first.frameCount).toBe(second.frameCount);
    expect(signature(first.left)).toBe(signature(second.left));
    expect(signature(first.right)).toBe(signature(second.right));
  });

  it("changes the rendered loop when the seed changes", () => {
    const quickWash = renderSeededChiptune("快速洗|AA 01 9A 03 02 0A 6F 55", 8000);
    const pause = renderSeededChiptune("暂停|AA 02 9A 00 00 DB 64 55", 8000);

    expect(signature(quickWash.left)).not.toBe(signature(pause.left));
    expect(averageDifference(quickWash.left, pause.left)).toBeGreaterThan(0.05);
  });

  it("renders an audible 8-bit loop", () => {
    const rendered = renderSeededChiptune("状态查询|AA 02 9A 00 00 DB 64 55", 8000);
    let peak = 0;

    for (let index = 0; index < rendered.frameCount; index += 1) {
      peak = Math.max(peak, Math.abs(rendered.left[index]), Math.abs(rendered.right[index]));
    }

    expect(rendered.duration).toBeGreaterThan(7);
    expect(rendered.duration).toBeLessThan(11);
    expect(peak).toBeGreaterThan(0.01);
  });
});
