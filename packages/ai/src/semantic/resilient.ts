import type { TextAnalyzer } from '../types';

/**
 * 通用降级组合器：主分析器不可用时自动换上兜底分析器。
 *
 * 两个分析器必须产出同一种结果类型，这样上层业务感觉不到区别；
 * 主分析器一旦就绪会自动接管，不需要重启。
 */

export interface ResilientAnalyzer<T> extends TextAnalyzer<T> {
  /** 当前是否真的在用主分析器 */
  readonly usingAi: boolean;
  /** 主分析器是否已彻底失败（可据此提示玩家） */
  readonly failed: boolean;
}

export function withFallback<T>(
  primary: TextAnalyzer<T>,
  fallback: TextAnalyzer<T>,
): ResilientAnalyzer<T> {
  return {
    get kind() {
      return primary.ready ? primary.kind : fallback.kind;
    },
    get label() {
      return primary.ready ? primary.label : fallback.label;
    },
    // 对外永远可用：主分析器没好就用兜底顶上
    get ready() {
      return true;
    },
    get broken() {
      return false;
    },
    get usingAi() {
      return primary.ready;
    },
    get failed() {
      return primary.broken;
    },
    warmUp: () => primary.warmUp(),
    dispose: () => {
      primary.dispose();
      fallback.dispose();
    },
    async analyze(text: string, history?: readonly string[]): Promise<T> {
      if (primary.ready) {
        try {
          return await primary.analyze(text, history);
        } catch (error) {
          console.warn('[@games/ai] 语义分析出错，本次改用兜底判定：', error);
        }
      }
      return fallback.analyze(text, history);
    },
  };
}
