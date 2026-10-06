/**
 * 公共 AI 层的端口定义。
 *
 * 这里只描述「一个文本分析器该长什么样」，不涉及任何具体模型，
 * 也不涉及任何具体玩法 —— 游戏按自己的语义定义去实现或组装即可。
 */

/** 判定来源，用于 UI 展示当前走的是模型还是兜底规则 */
export type JudgeSource = 'ai' | 'heuristic';

/**
 * 文本分析器端口。
 *
 * 泛型 `TReading` 是「一次分析的结果」，由使用方定义：
 * 有的游戏关心雅/俗，有的关心攻击性/友善，不需要共用一种结构。
 */
export interface TextAnalyzer<TReading> {
  readonly kind: JudgeSource;
  /** 给玩家看的分析器名称 */
  readonly label: string;
  /** 是否已可用（模型加载完成；规则实现恒为 true） */
  readonly ready: boolean;
  /** 是否已彻底不可用（模型加载失败），上层据此提示玩家 */
  readonly broken: boolean;
  /** 预热：提前下载模型，避免第一次分析时卡一下 */
  warmUp: () => Promise<boolean>;
  /** 分析一段文本；history 用于「和之前说过的比一比」（语义去重） */
  analyze: (text: string, history?: readonly string[]) => Promise<TReading>;
  /** 释放资源（子应用销毁时调用） */
  dispose: () => void;
}

/** 一组语义锚点：同一个语义方向上的若干例句 */
export interface SemanticGroup {
  key: string;
  samples: readonly string[];
}

/**
 * 一条语义轴：正面样本与负面样本之间的方向。
 *
 * 例如「文学性」= 诗句 vs 大白话，「攻击性」= 挑衅 vs 客套。
 * 判定不是匹配词表，而是看输入落在这一轴的哪一端 —— 因此没收录过的句子也能判。
 */
export interface SemanticAxis {
  key: string;
  /** 靠近轴正端的样本 */
  positive: readonly string[];
  /** 靠近轴负端的样本；省略时以 0 为基准 */
  negative?: readonly string[];
  /** 原始差值 → 0~1 的映射区间，省略时用 DEFAULT_DIFF_RANGE */
  range?: readonly [number, number];
}

/** 一次语义分析的读数 */
export interface SemanticReading {
  /** 每条语义轴的得分 0~1：越靠近 positive 端越高 */
  axes: Record<string, number>;
  /** 与上面一一对应的原始差值（未映射），便于自行调参 */
  raw: Record<string, number>;
  /** 与历史文本的最高语义相似度 0~1：0 表示历史为空 */
  familiarity: number;
  source: JudgeSource;
}

/** 安全读数：分析失败时的兜底值，保证游戏永远能继续 */
export const EMPTY_READING: SemanticReading = {
  axes: {},
  raw: {},
  familiarity: 0,
  source: 'heuristic',
};

/** 默认差值区间：根据 multilingual-e5-small 的样本分布设置。 */
export const DEFAULT_DIFF_RANGE: readonly [number, number] = [-0.15, 0.25];

/** 取 top-k 锚点的平均亲和度，抗单点噪声 */
export const DEFAULT_TOP_K = 3;
