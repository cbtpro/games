/** 缓动函数：入参与返回都是 0~1 */

export type Easing = (t: number) => number;

export const linear: Easing = (t) => t;

export const easeOutCubic: Easing = (t) => 1 - (1 - t) ** 3;

export const easeInOutCubic: Easing = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** 带回弹：结束时略微超过 1 再收回 */
export const easeOutBack: Easing = (t) => {
  const c = 1.70158;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};

export const easeOutElastic: Easing = (t) => {
  if (t === 0 || t === 1) return t;
  const p = 0.4;
  return 2 ** (-9 * t) * Math.sin(((t - p / 4) * (2 * Math.PI)) / p) + 1;
};
