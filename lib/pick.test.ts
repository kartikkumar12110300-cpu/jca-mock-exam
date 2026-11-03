import { describe, expect, it } from "vitest";
import { shuffle, weightedSample } from "./pick";

/** Deterministic PRNG (mulberry32) so the statistical tests never flake. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("weightedSample", () => {
  it("returns exactly the requested count, never more than the pool", () => {
    const pool = Array.from({ length: 50 }, (_, i) => i);

    expect(weightedSample(pool, 20, () => 1, seeded(1))).toHaveLength(20);
    expect(weightedSample(pool, 999, () => 1, seeded(1))).toHaveLength(50);
    expect(weightedSample(pool, 0, () => 1, seeded(1))).toHaveLength(0);
  });

  it("never repeats an item", () => {
    const pool = Array.from({ length: 30 }, (_, i) => i);
    const picked = weightedSample(pool, 30, () => 1, seeded(2));
    expect(new Set(picked).size).toBe(picked.length);
  });

  it("returns every item when asked for the whole pool", () => {
    const pool = ["a", "b", "c"];
    expect(new Set(weightedSample(pool, 3, () => 1, seeded(3)))).toEqual(new Set(pool));
  });

  it("favours heavier items over many draws", () => {
    const random = seeded(42);
    const pool = [
      { id: "heavy", weight: 10 },
      { id: "light", weight: 1 },
    ];

    let heavy = 0;
    for (let i = 0; i < 2000; i += 1) {
      const [first] = weightedSample(pool, 1, (q) => q.weight, random);
      if (first.id === "heavy") heavy += 1;
    }

    // With 10:1 weights the heavy item should dominate clearly.
    expect(heavy).toBeGreaterThan(1500);
  });

  it("is reproducible for a given seed", () => {
    const pool = Array.from({ length: 100 }, (_, i) => i);
    const a = weightedSample(pool, 20, () => 1, seeded(7));
    const b = weightedSample(pool, 20, () => 1, seeded(7));
    expect(a).toEqual(b);
  });
});

describe("shuffle", () => {
  it("keeps every element (a permutation, not a subset)", () => {
    const pool = Array.from({ length: 40 }, (_, i) => i);
    const out = shuffle(pool, seeded(5));
    expect(out).toHaveLength(pool.length);
    expect([...out].sort((a, b) => a - b)).toEqual(pool);
  });

  it("does not mutate the input", () => {
    const pool = [1, 2, 3, 4, 5];
    shuffle(pool, seeded(6));
    expect(pool).toEqual([1, 2, 3, 4, 5]);
  });
});
