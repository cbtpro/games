import type { Mood } from './types';

/**
 * 情绪分类：把一句话归到少数几个「有颜色、有动作」的类别里。
 *
 * 设计原则（沿用喂蜘蛛时踩过的坑）：**结构信号为主，词表仅做轻推**。
 * 句末标点、感叹数量、句子长短这些与语言无关的特征先定调，
 * 小词表（开心 / 温柔 / 疑问）只在模糊时轻轻推一把，避免「固定词表无技术含量」的问题。
 *
 * 纯函数、不碰 DOM，能在 Node 里直接跑测试。
 */

export const MOODS: readonly Mood[] = ['calm', 'joy', 'curious', 'urgent', 'tender'];

export const MOOD_LABEL: Record<Mood, string> = {
  calm: '平静',
  joy: '喜悦',
  curious: '好奇',
  urgent: '急切',
  tender: '温柔',
};

/** 墨色：取自原先校验过 WCAG AA 的 INK_PALETTE，文字与卡片边框都用它 */
export const MOOD_INK: Record<Mood, string> = {
  calm: '#4a43e0',
  joy: '#b4530a',
  curious: '#0f7b6c',
  urgent: '#c0392b',
  tender: '#6941c6',
};

/** 出场动画预设 key（对应 animation/presets 里的 key），让情绪「动」得不一样 */
export const MOOD_PRESET: Record<Mood, string> = {
  calm: 'rising',
  joy: 'pop',
  curious: 'slide-in',
  urgent: 'tilt',
  tender: 'focus',
};

// 仅作轻推的小词表；不是评分依据，只是让边界情况更自然
const JOY_WORDS = ['哈', '嘻', '嘿', '开心', '喜欢', '好耶', '棒', '爱', '欢', '笑', '耶'];
const TENDER_WORDS = [
  '星',
  '海',
  '梦',
  '光',
  '风',
  '月',
  '云',
  '夜',
  '温柔',
  '宁静',
  '忆',
  '愿',
  '花',
];
const CURIOUS_WORDS = ['为什么', '怎么', '吗', '呢', '何处', '谁', '几时'];

const hasAny = (text: string, words: readonly string[]): boolean =>
  words.some((word) => text.includes(word));

export function analyzeMood(text: string): Mood {
  const value = text.trim();
  if (value.length === 0) return 'calm';

  const last = value[value.length - 1];
  const exclaims = (value.match(/[!！]/g) ?? []).length;
  const isLong = value.length >= 18;

  // 1) 强信号优先：疑问尾、多重感叹、单句感叹
  if (last === '？' || last === '?') return 'curious';
  if (exclaims >= 2) return 'urgent';
  if (last === '！' || last === '!') return hasAny(value, JOY_WORDS) ? 'joy' : 'urgent';

  // 2) 关键词轻推
  if (hasAny(value, CURIOUS_WORDS)) return 'curious';
  if (hasAny(value, JOY_WORDS)) return 'joy';
  if (hasAny(value, TENDER_WORDS) || isLong) return 'tender';

  // 3) 默认：平静叙述
  return 'calm';
}
