import { easeOutBack, easeOutCubic, easeOutElastic, type Easing } from './easing';
import { rand, type Rng } from './utils';
import type { AnimationParams, AnimationState } from '../core/types';

/**
 * 出场动画预设。
 *
 * 每个预设只负责「按进度算出这一帧长什么样」，
 * 返回值是 AnimationState 的一部分 —— 布局坐标、旋转、尺寸一概不碰。
 */

export interface AnimationPreset {
  key: string;
  label: string;
  /** 权重越大越常出现 */
  weight: number;
  /** 时长区间（毫秒），每次实例随机 */
  duration: readonly [number, number];
  /** 每次实例随机出的参数 */
  sample: (rng: Rng) => AnimationParams;
  easing: Easing;
  apply: (eased: number, params: AnimationParams) => Partial<AnimationState>;
}

const RISING: AnimationPreset = {
  key: 'rising',
  label: '浮起',
  weight: 3,
  duration: [420, 620],
  easing: easeOutCubic,
  sample: (rng) => ({
    fromX: 0,
    fromY: rand(18, 34, rng),
    spin: 0,
    blur: 0,
    fromScale: 0.94,
  }),
  apply: (t, params) => ({
    opacity: t,
    scale: params.fromScale + (1 - params.fromScale) * t,
    offsetX: 0,
    offsetY: params.fromY * (1 - t),
    blur: 0,
    rotationOffset: 0,
    textProgress: 1,
  }),
};

const SLIDE_IN: AnimationPreset = {
  key: 'slide-in',
  label: '滑入',
  weight: 3,
  duration: [460, 700],
  easing: easeOutCubic,
  sample: (rng) => {
    const angle = rand(-Math.PI, Math.PI, rng);
    const distance = rand(40, 90, rng);
    return {
      fromX: Math.cos(angle) * distance,
      fromY: Math.sin(angle) * distance,
      spin: 0,
      blur: 0,
      fromScale: 1,
    };
  },
  apply: (t, params) => ({
    opacity: Math.min(1, t * 1.6),
    scale: 1,
    offsetX: params.fromX * (1 - t),
    offsetY: params.fromY * (1 - t),
    blur: 0,
    rotationOffset: 0,
    textProgress: 1,
  }),
};

const POP: AnimationPreset = {
  key: 'pop',
  label: '弹出',
  weight: 2,
  duration: [520, 780],
  easing: easeOutBack,
  sample: (rng) => ({
    fromX: 0,
    fromY: 0,
    spin: 0,
    blur: 0,
    fromScale: rand(0.45, 0.62, rng),
  }),
  apply: (t, params) => ({
    opacity: Math.min(1, t * 2),
    scale: params.fromScale + (1 - params.fromScale) * t,
    offsetX: 0,
    offsetY: 0,
    blur: 0,
    rotationOffset: 0,
    textProgress: 1,
  }),
};

const TYPEWRITER: AnimationPreset = {
  key: 'typewriter',
  label: '打字机',
  weight: 2,
  duration: [700, 1200],
  easing: (t) => t,
  sample: () => ({ fromX: 0, fromY: 0, spin: 0, blur: 0, fromScale: 1 }),
  apply: (t) => ({
    opacity: 1,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    blur: 0,
    rotationOffset: 0,
    textProgress: t,
  }),
};

const FOCUS: AnimationPreset = {
  key: 'focus',
  label: '对焦',
  weight: 2,
  duration: [520, 760],
  easing: easeOutCubic,
  sample: (rng) => ({
    fromX: 0,
    fromY: 0,
    spin: 0,
    blur: rand(8, 16, rng),
    fromScale: 1.06,
  }),
  apply: (t, params) => ({
    opacity: t,
    scale: params.fromScale + (1 - params.fromScale) * t,
    offsetX: 0,
    offsetY: 0,
    blur: params.blur * (1 - t),
    rotationOffset: 0,
    textProgress: 1,
  }),
};

const TILT: AnimationPreset = {
  key: 'tilt',
  label: '摆正',
  weight: 2,
  duration: [560, 820],
  easing: easeOutElastic,
  sample: (rng) => ({
    fromX: 0,
    fromY: rand(10, 22, rng),
    spin: rand(9, 18, rng) * (rng() < 0.5 ? -1 : 1),
    blur: 0,
    fromScale: 0.9,
  }),
  apply: (t, params) => ({
    opacity: Math.min(1, t * 1.4),
    scale: params.fromScale + (1 - params.fromScale) * t,
    offsetX: 0,
    offsetY: params.fromY * (1 - t),
    blur: 0,
    rotationOffset: params.spin * (1 - t),
    textProgress: 1,
  }),
};

const FADE_IN: AnimationPreset = {
  key: 'fade-in',
  label: '淡入',
  weight: 3,
  duration: [450, 900],
  easing: easeOutCubic,
  sample: () => ({ fromX: 0, fromY: 0, spin: 0, blur: 0, fromScale: 1 }),
  apply: (t) => ({
    opacity: t,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    blur: 0,
    rotationOffset: 0,
    textProgress: 1,
  }),
};

const SCALE_IN: AnimationPreset = {
  ...POP,
  key: 'scale-in',
  label: '缩放',
  easing: easeOutCubic,
};

export const ANIMATION_PRESETS: readonly AnimationPreset[] = [
  FADE_IN,
  SCALE_IN,
  RISING,
  SLIDE_IN,
  POP,
  TYPEWRITER,
  FOCUS,
  TILT,
];

export const PRESET_BY_KEY: Readonly<Record<string, AnimationPreset>> = Object.fromEntries(
  ANIMATION_PRESETS.map((preset) => [preset.key, preset]),
);

export const DEFAULT_PRESET: AnimationPreset = RISING;
