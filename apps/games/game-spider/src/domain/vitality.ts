import type { VerdictGrade } from './types';

/**
 * 蜘蛛的饥饿、情绪，以及玩家的生命值。
 *
 * 这一层是纯数据与纯函数：不认识 React、不认识时间、不认识 rAF。
 * 时间由 useVitality 以 dt（秒）喂进来，所以整条曲线可以单独推演和调参，
 * 换 UI、换引擎都不需要动这里（分离关注点）。
 *
 * 玩法意图：这是一只「有脾气的」蜘蛛 —— 冷落它，它先焦躁，再发怒，
 * 最后把玩家当成点心；因此挂机不投喂一定会输，游戏永远有终点。
 */

/** 情绪档位，按饥饿度从低到高 */
export type MoodKey = 'content' | 'hungry' | 'restless' | 'angry' | 'furious';

export interface MoodSpec {
  key: MoodKey;
  /** 中文名，HUD 与日志用 */
  label: string;
  /** 进入该情绪的饥饿度下限（0-100） */
  from: number;
  /** 每秒扣掉玩家多少生命值 */
  drainPerSec: number;
  /** 爬行速度倍率：越烦躁窜得越快 */
  speedFactor: number;
  /** 蜘蛛头顶冒出的符号 */
  symbol: string;
  /** 给玩家的提示 */
  hint: string;
}

export const HP_MAX = 100;
export const HUNGER_MAX = 100;

/** 什么都不喂时，饥饿每秒涨多少 —— 约 25 秒从饱到饿透 */
const HUNGER_PER_SEC = 4;

/** 一口食物压下去多少饥饿 */
const SATIETY: Record<VerdictGrade, number> = { junk: 0, bland: 24, tasty: 42, delicacy: 64 };

/** 一口食物回多少血：只有真被吃下去的东西才续命 */
const HEAL: Record<VerdictGrade, number> = { junk: 0, bland: 2, tasty: 6, delicacy: 12 };

/** 被嫌弃一口（爬过去又吐掉），蜘蛛更烦 */
const SPURN_HUNGER = 12;

/**
 * 情绪阶梯。
 *
 * 前三档不掉血，给玩家反应时间；后面三档开始扣血且逐级加速，
 * 配合 HUD 的生命周期条，玩家能预判自己还能撑多久。
 */
export const MOODS: readonly MoodSpec[] = [
  {
    key: 'content',
    label: '满足',
    from: 0,
    drainPerSec: 0,
    speedFactor: 1,
    symbol: '',
    hint: '刚吃饱，八条腿慢悠悠地散步',
  },
  {
    key: 'hungry',
    label: '饿了',
    from: 30,
    drainPerSec: 0,
    speedFactor: 1.18,
    symbol: '·',
    hint: '在场子里来回踱步 —— 该喂了',
  },
  {
    key: 'restless',
    label: '烦躁',
    from: 55,
    drainPerSec: 1,
    speedFactor: 1.42,
    symbol: '?',
    hint: '开始跺脚：你的生命值在掉',
  },
  {
    key: 'angry',
    label: '发怒',
    from: 78,
    drainPerSec: 2,
    speedFactor: 1.72,
    symbol: '!',
    hint: '它盯着你，掉血更快了',
  },
  {
    key: 'furious',
    label: '暴走',
    from: 92,
    drainPerSec: 3.2,
    speedFactor: 2.05,
    symbol: '‼',
    hint: '饿疯了 —— 再不喂你就没了',
  },
];

const MOOD_INDEX: Record<MoodKey, number> = MOODS.reduce(
  (map, mood, index) => ({ ...map, [mood.key]: index }),
  {} as Record<MoodKey, number>,
);

/** 一次生命体征快照 */
export interface VitalityState {
  /** 饥饿度 0-100，越高越危险 */
  hunger: number;
  /** 玩家生命值 0-100 */
  hp: number;
  /** 距上一次「被吃下去」过了多少秒 */
  sinceFood: number;
}

export const INITIAL_VITALITY: VitalityState = { hunger: 0, hp: HP_MAX, sinceFood: 0 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 情绪档位越高，排名越大（用于判断「恶化了」还是「缓和了」） */
export function moodRank(key: MoodKey): number {
  return MOOD_INDEX[key] ?? 0;
}

/** 按饥饿度取当前情绪；MOODS 按 from 升序，从后往前找第一个满足的 */
export function moodOf(hunger: number): MoodSpec {
  for (let index = MOODS.length - 1; index >= 0; index -= 1) {
    if (hunger >= MOODS[index].from) return MOODS[index];
  }
  return MOODS[0];
}

/** 这一口能不能续上命：掉血中的蜘蛛只有吃到真东西才停得下来 */
export function isDraining(mood: MoodSpec): boolean {
  return mood.drainPerSec > 0;
}

/**
 * 推进 dt 秒。
 *
 * 饥饿只涨不落（除非吃到东西），生命值只在「烦躁」以上开始掉，
 * 且掉速随情绪加快 —— 于是「挂机」必然走向死亡，速度可预期。
 */
export function advanceVitality(
  state: VitalityState,
  dtSec: number,
  difficultyFactor = 1,
): VitalityState {
  if (dtSec <= 0) return state;

  const hunger = clamp(state.hunger + HUNGER_PER_SEC * difficultyFactor * dtSec, 0, HUNGER_MAX);
  const mood = moodOf(hunger);
  const hp = clamp(state.hp - mood.drainPerSec * difficultyFactor * dtSec, 0, HP_MAX);

  return { hunger, hp, sinceFood: state.sinceFood + dtSec };
}

/** 被吃掉一口：按档次减饥饿、回一点血，并重置「多久没吃到」 */
export function feedVitality(state: VitalityState, grade: VerdictGrade): VitalityState {
  return {
    hunger: clamp(state.hunger - SATIETY[grade], 0, HUNGER_MAX),
    hp: clamp(state.hp + HEAL[grade], 0, HP_MAX),
    sinceFood: 0,
  };
}

/** 爬过去闻了又吐掉：不算吃，还更饿 */
export function spurnVitality(state: VitalityState): VitalityState {
  return { ...state, hunger: clamp(state.hunger + SPURN_HUNGER, 0, HUNGER_MAX) };
}
