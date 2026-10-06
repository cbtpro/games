import { shapeOf, volumeOf } from '../domain/textShape';
import type { SemanticProfile, TextJudge } from './types';

/**
 * 应急味觉：纯规则的语义近似。
 *
 * 定位是**降级兜底**，不是主判定 —— 模型加载失败、离线、浏览器不支持 WASM 时用。
 * 它输出与 AI 版本完全相同的 SemanticProfile，所以上层业务感觉不到区别，
 * 只是判得粗一些（认不出没见过的诗句）。
 */
export class HeuristicJudge implements TextJudge {
  readonly kind = 'heuristic' as const;
  readonly label = '应急味觉';
  readonly ready = true;
  readonly broken = false;

  warmUp(): Promise<boolean> {
    return Promise.resolve(true);
  }

  dispose(): void {
    // 无状态，无需清理
  }

  async analyze(text: string, history: readonly string[] = []): Promise<SemanticProfile> {
    const shape = shapeOf(text);
    const trimmed = text.trim();

    // ---------------------------------------------------------- 敷衍度
    let junk = 0.12;
    if (shape.gibberish) junk = 0.95;
    else if (shape.chars <= 1) junk = 0.6;
    else if (shape.chars === 2) junk = 0.45;
    else if (shape.uniqueness < 0.4) junk = 0.55;

    // ---------------------------------------------------------- 文学性（形态代理）
    let literary = 0.18;
    literary += volumeOf(shape) * 0.42;
    if (shape.cjk > 0.6) literary += 0.1;
    if (shape.antithetical) literary += 0.16;
    if (shape.punctuated) literary += 0.08;
    if (shape.uniqueness > 0.85 && shape.chars >= 5) literary += 0.08;
    if (shape.gibberish) literary = 0.02;

    // ---------------------------------------------------------- 熟悉度（字面重叠）
    let familiarity = 0;
    for (const previous of history) {
      const a = [...previous.trim()];
      const b = [...trimmed];
      if (a.length === 0 || b.length === 0) continue;
      if (previous.trim() === trimmed) {
        familiarity = 1;
        break;
      }
      const shared = b.filter((char) => a.includes(char)).length;
      const ratio = shared / Math.max(a.length, b.length);
      familiarity = Math.max(familiarity, ratio > 0.6 ? 0.55 + ratio * 0.3 : ratio * 0.6);
    }

    return {
      literary: clamp01(literary),
      junk: clamp01(junk),
      familiarity: clamp01(familiarity),
      source: 'heuristic',
    };
  }
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
