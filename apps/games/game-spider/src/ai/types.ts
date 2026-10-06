import type { JudgeSource, TextAnalyzer } from '@games/ai';

/**
 * 蜘蛛的味觉契约。
 *
 * 「怎么量这段文字」是公共能力（@games/ai），
 * 「一段文字对蜘蛛意味着什么」是本游戏的定义 —— 所以画像结构留在游戏里。
 * 领域层（domain/palatability）只认这个结构，换模型、换词表都不用改。
 */

/**
 * 一段文字的语义画像。
 *
 * 三个维度都是 0~1 的相似度，由模型在语义空间里量出来，
 * 而不是靠词表匹配 —— 所以没见过的句子也能判。
 */
export interface SemanticProfile {
  /** 与「佳肴」语义方向的最高相似度：越接近诗词/典故/有文学性的表达越高 */
  literary: number;
  /** 与「敷衍」语义方向的最高相似度：越接近乱敲/客套/无信息量越高 */
  junk: number;
  /** 与已吃过的东西的最高语义相似度：0 表示它还没吃过任何东西 */
  familiarity: number;
  /** 判定来源 */
  source: JudgeSource;
}

/** 味觉端口：输入文本与已吃过的东西，输出画像 */
export type TextJudge = TextAnalyzer<SemanticProfile>;

/** 空画像：判定失败时的安全值，保证游戏永远能继续 */
export const EMPTY_PROFILE: SemanticProfile = {
  literary: 0,
  junk: 0,
  familiarity: 0,
  source: 'heuristic',
};
