import { ANIMATION_PRESETS, type AnimationPreset } from '../animation/presets';
import { pickWeighted, rand, type Rng } from '../animation/utils';
import type { AnimationState } from './types';

/**
 * 出场动画引擎。
 *
 * 只回答「这句话怎么出现」，产出的是一份 AnimationState：
 * opacity / scale / offset / blur / rotationOffset / textProgress。
 *
 * 硬约束：**不碰 Block 的最终坐标、最终旋转与包围盒**。
 * 否则布局会随动画抖动，碰撞检测也会失真。
 */

export interface AnimationEngineOptions {
  rng?: Rng;
  /** 连续几次内不重复同一个预设，避免连着几句话看起来一模一样 */
  recentMemory?: number;
  presets?: readonly AnimationPreset[];
}

export class AnimationEngine {
  private readonly rng: Rng;
  private readonly presets: readonly AnimationPreset[];
  private readonly memorySize: number;
  private readonly presetByKey: ReadonlyMap<string, AnimationPreset>;
  private readonly recent: string[] = [];

  constructor(options: AnimationEngineOptions = {}) {
    this.rng = options.rng ?? Math.random;
    this.presets = options.presets ?? ANIMATION_PRESETS;
    this.memorySize = Math.max(0, Math.floor(options.recentMemory ?? 2));
    this.presetByKey = new Map(this.presets.map((preset) => [preset.key, preset]));
    if (!this.presets.some((preset) => preset.weight > 0)) {
      throw new Error('At least one animation must have a positive weight');
    }
  }

  /** 清空最近动画记录，供世界重置使用。 */
  clear(): void {
    this.recent.length = 0;
  }

  /** 根据文字长度、最近记录与权重选择独立入场动画。 */
  create(now: number, text = ''): AnimationState {
    const preset = this.nextPreset([...text].length);
    const params = preset.sample(this.rng);
    const duration = rand(preset.duration[0], preset.duration[1], this.rng);

    return this.compose(
      {
        preset: preset.key,
        params,
        startedAt: now,
        duration,
        elapsed: 0,
        progress: 0,
        opacity: 0,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        blur: 0,
        rotationOffset: 0,
        textProgress: 1,
        done: false,
      },
      now,
    );
  }

  /** 推进到指定时刻；已结束的动画原样返回，避免每帧都重算 */
  advance(state: AnimationState, now: number): AnimationState {
    if (state.done && now - state.startedAt >= state.duration) return state;
    return this.compose(state, now);
  }

  private compose(state: AnimationState, now: number): AnimationState {
    const preset = this.presetByKey.get(state.preset);
    if (!preset) throw new Error(`Unknown animation preset: ${state.preset}`);
    const elapsed = Math.max(0, now - state.startedAt);
    const raw = state.duration <= 0 ? 1 : elapsed / state.duration;
    const progress = raw < 0 ? 0 : raw > 1 ? 1 : raw;
    const eased = preset.easing(progress);

    return {
      ...state,
      ...preset.apply(eased, state.params),
      elapsed,
      progress,
      done: progress >= 1,
    };
  }

  private nextPreset(textLength: number): AnimationPreset {
    const eligible = this.presets.filter(
      (preset) => preset.weight > 0 && !(textLength > 30 && ['pop', 'tilt'].includes(preset.key)),
    );
    if (!eligible.length) throw new Error('No animation is eligible for this text');
    let available = eligible.filter((preset) => !this.recent.includes(preset.key));
    while (!available.length && this.recent.length) {
      this.recent.shift();
      available = eligible.filter((preset) => !this.recent.includes(preset.key));
    }
    const preset = pickWeighted(
      available.map((preset) => ({
        item: preset,
        weight:
          preset.weight *
          (textLength <= 10 && ['pop', 'scale-in', 'tilt'].includes(preset.key) ? 1.5 : 1),
      })),
      this.rng,
    );
    this.recent.push(preset.key);
    while (this.recent.length > this.memorySize) this.recent.shift();
    return preset;
  }
}
