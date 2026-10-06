/** 随机工具：全部接受可注入的 rng，方便测试时固定序列 */

export type Rng = () => number;

export const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);

export function rand(min: number, max: number, rng: Rng = Math.random): number {
  return min + (max - min) * rng();
}

export function randInt(min: number, max: number, rng: Rng = Math.random): number {
  return Math.floor(rand(min, max + 1, rng));
}

export function pick<T>(items: readonly T[], rng: Rng = Math.random): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

export interface Weighted<T> {
  item: T;
  weight: number;
}

/** 加权随机：weight 为 0 的项不会被选中 */
export function pickWeighted<T>(items: readonly Weighted<T>[], rng: Rng = Math.random): T {
  const positive = items.filter((entry) => entry.weight > 0);
  const total = positive.reduce((sum, entry) => sum + entry.weight, 0);
  if (!positive.length) throw new Error('Weighted random requires a positive weight');
  let ticket = Math.min(1, Math.max(0, rng())) * total;
  for (const entry of positive) {
    if (ticket < entry.weight) return entry.item;
    ticket -= entry.weight;
  }
  return positive[positive.length - 1].item;
}

/**
 * 线性插值。t=0 返回 a，t=1 返回 b。
 */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
