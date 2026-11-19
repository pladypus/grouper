// Randomness for the solver. Everything random takes an `Rng` so tests can inject a seeded one.

/** Returns a float in [0, 1), like Math.random. */
export type Rng = () => number;

/** A small, fast seeded PRNG (mulberry32). Same seed, same sequence: use it in tests. */
export function seededRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A whole number in [0, n). */
export function randomInt(rng: Rng, n: number): number {
  return Math.floor(rng() * n);
}

/** Fisher–Yates, in place. Returns the same array. */
export function shuffleInPlace<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}
