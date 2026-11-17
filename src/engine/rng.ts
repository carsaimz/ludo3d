/** PRNG determinístico (mulberry32) — permite sincronizar resultados online no futuro */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Valor do dado 1..6 a partir de um Rng */
export function diceValue(rng: Rng): number {
  return 1 + Math.floor(rng() * 6);
}
