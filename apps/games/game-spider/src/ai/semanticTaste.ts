import { SemanticAnalyzer, type ModelOptions, type SemanticAxis } from '@games/ai';
import { REFINED_ANCHORS, VULGAR_ANCHORS } from './anchors';
import type { SemanticProfile, TextJudge } from './types';

/**
 * AI 味觉：把公共语义层量出的读数翻译成蜘蛛的画像。
 *
 * 这里只做两件小事 —— 定义「量哪几条轴」、把读数映射成本游戏的画像；
 * 模型加载、各向异性修正、语义去重都由 @games/ai 负责。
 *
 * 轴的区间（range）根据样本分布设置：
 * 文学性取「佳肴亲和度 − 敷衍亲和度」，敷衍度则直接以 0 为基准并整体上移 0.25。
 */

export const SPIDER_AXES: readonly SemanticAxis[] = [
  {
    key: 'literary',
    positive: REFINED_ANCHORS,
    negative: VULGAR_ANCHORS,
    range: [-0.15, 0.25],
  },
  {
    key: 'junk',
    positive: VULGAR_ANCHORS,
    // diff = 敷衍亲和度 - 0，区间 [-0.25, 0.75] 等价于 clamp01(亲和度 + 0.25)
    range: [-0.25, 0.75],
  },
];

export interface SemanticTasteOptions {
  model?: ModelOptions;
  label?: string;
}

export class SemanticTaste implements TextJudge {
  readonly kind = 'ai' as const;
  readonly label: string;

  private readonly analyzer: SemanticAnalyzer;

  constructor(options: SemanticTasteOptions = {}) {
    this.label = options.label ?? 'AI 味觉';
    this.analyzer = new SemanticAnalyzer({
      axes: SPIDER_AXES,
      model: options.model,
      label: this.label,
    });
  }

  get ready(): boolean {
    return this.analyzer.ready;
  }

  get broken(): boolean {
    return this.analyzer.broken;
  }

  warmUp(): Promise<boolean> {
    return this.analyzer.warmUp();
  }

  async analyze(text: string, history: readonly string[] = []): Promise<SemanticProfile> {
    const reading = await this.analyzer.analyze(text, history);
    return {
      literary: reading.axes.literary ?? 0,
      junk: reading.axes.junk ?? 0,
      familiarity: reading.familiarity,
      source: reading.source,
    };
  }

  dispose(): void {
    this.analyzer.dispose();
  }
}
