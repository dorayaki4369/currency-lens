/** Walks backwards from the final value with a seeded, slowly drifting step. */
export function createRandomWalk(
  end: number,
  length: number,
  volatility: number,
  seed: number,
): number[] {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
  const values = Array.from({ length }, () => end);
  let drift = 0;
  for (let index = length - 2; index >= 0; index -= 1) {
    drift = drift * 0.85 + (random() - 0.5) * 2 * volatility;
    values[index] = Number(
      (values[index + 1]! * (1 + drift * 0.6 + 0.0003)).toPrecision(6),
    );
  }
  return values;
}
