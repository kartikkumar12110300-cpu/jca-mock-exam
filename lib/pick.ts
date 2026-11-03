/**
 * Random selection helpers used when composing a paper from the bank.
 *
 * Kept pure and independent of the database so the selection policy can be
 * unit tested with a seeded random source.
 */

/**
 * Weighted sampling **without replacement**.
 *
 * Uses the Efraimidis–Spirakis algorithm: give every item the key
 * `random() ** (1 / weight)` and keep the `count` largest keys. A larger weight
 * makes an item more likely to be kept, and no item can ever be chosen twice.
 */
export function weightedSample<T>(
  items: readonly T[],
  count: number,
  weightOf: (item: T) => number,
  random: () => number = Math.random,
): T[] {
  const k = Math.max(0, Math.min(count, items.length));
  if (k === 0) return [];
  if (k === items.length) return [...items];

  return items
    .map((item) => {
      const weight = Math.max(weightOf(item), Number.EPSILON);
      return { item, key: Math.pow(random(), 1 / weight) };
    })
    .sort((a, b) => b.key - a.key)
    .slice(0, k)
    .map((entry) => entry.item);
}

/** Fisher–Yates shuffle. Returns a new array; never mutates the input. */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
