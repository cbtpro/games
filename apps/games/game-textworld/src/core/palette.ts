import type { Mood, TextFont } from './types';
import { MOODS } from './mood';

/** 白色卡片上的深色设计配色：蓝、青、绿、紫、玫红、朱红与赭色。 */
export const TEXT_INKS = [
  '#1d4ed8',
  '#0f766e',
  '#be185d',
  '#6d28d9',
  '#c2410c',
  '#047857',
  '#a21caf',
  '#0369a1',
  '#b91c1c',
  '#4338ca',
  '#a16207',
  '#334155',
] as const;

export const BASE_FONT: Omit<TextFont, 'color'> = {
  family:
    "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  size: 24,
  weight: 600,
  lineHeight: 34,
};

/** 情绪影响色盘起点，同类情绪的句子也会轮换色彩和字号。 */
export function fontForMood(index: number, mood: Mood): TextFont {
  const sizes = [28, 24, 32, 22, 36, 26, 30, 24];
  const size = sizes[index % sizes.length];
  const offset = MOODS.indexOf(mood) * 2;
  return {
    ...BASE_FONT,
    size,
    lineHeight: Math.ceil(size * 1.35),
    weight: index % 4 === 0 ? 700 : 600,
    color: TEXT_INKS[(index + offset) % TEXT_INKS.length],
  };
}

/** 短句作为视觉重点，长句保留较克制的字号以便阅读和布局。 */
export function fontForText(index: number, mood: Mood, text: string): TextFont {
  const font = fontForMood(index, mood);
  const emphasized = /[!！?？]/.test(text);
  const length = [...text.replace(/[!！?？]/g, '')].length;
  const baseSize =
    length <= 4
      ? [40, 48, 36, 44][index % 4]
      : length <= 8
        ? Math.max(font.size, 30)
        : length > 25
          ? Math.min(font.size, 24)
          : font.size;
  const size = emphasized ? Math.min(60, Math.ceil(baseSize * 1.25)) : baseSize;
  return {
    ...font,
    size,
    weight: emphasized ? 700 : font.weight,
    lineHeight: Math.ceil(size * 1.35),
  };
}

export function fontAt(index: number): TextFont {
  return fontForMood(index, MOODS[index % MOODS.length]);
}
