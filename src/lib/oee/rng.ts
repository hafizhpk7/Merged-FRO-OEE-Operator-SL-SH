/** Deterministic pseudo random helpers so SSR and client render identical mock data. */

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeRng(seed: string) {
  let a = hashString(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rand(seed: string, min: number, max: number, decimals = 0): number {
  const v = makeRng(seed)() * (max - min) + min;
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

export function pick<T>(seed: string, items: readonly T[]): T {
  const idx = Math.floor(makeRng(seed)() * items.length) % items.length;
  return items[idx] as T;
}
