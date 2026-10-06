import { TextEmbedder } from '../model/embedder';
import type { ModelOptions } from '../model/options';
import {
  DEFAULT_DIFF_RANGE,
  type SemanticAxis,
  type SemanticGroup,
  type SemanticReading,
  type TextAnalyzer,
} from '../types';
import { AnchorSpace } from './anchorSpace';
import { clamp01 } from './vector';

/**
 * 语义分析器：给定若干条语义轴，把一句话量成一组 0~1 的分数。
 *
 * 这是「AI 怎么理解文字」的通用实现，不含任何具体玩法：
 * 轴怎么定义由使用方决定（雅/俗、攻击性/友善、科幻/现实……），
 * 换一组锚点就能换一种判断，代码一行不用改。
 *
 * 同时附带「语义去重」：和历史文本比语义而不是比字面。
 */

export interface SemanticAnalyzerOptions {
  /** 要量的语义轴 */
  axes: readonly SemanticAxis[];
  /** 模型来源配置；省略时走默认模型与浏览器缓存 */
  model?: ModelOptions;
  topK?: number;
  label?: string;
}

const positiveKey = (key: string): string => `${key}:+`;
const negativeKey = (key: string): string => `${key}:-`;

function groupsOf(axes: readonly SemanticAxis[]): SemanticGroup[] {
  const groups: SemanticGroup[] = [];
  for (const axis of axes) {
    groups.push({ key: positiveKey(axis.key), samples: axis.positive });
    if (axis.negative && axis.negative.length > 0) {
      groups.push({ key: negativeKey(axis.key), samples: axis.negative });
    }
  }
  return groups;
}

export class SemanticAnalyzer implements TextAnalyzer<SemanticReading> {
  readonly kind = 'ai' as const;
  readonly label: string;

  private readonly axes: readonly SemanticAxis[];
  private readonly embedder: TextEmbedder;
  private readonly space: AnchorSpace;

  constructor(options: SemanticAnalyzerOptions) {
    this.label = options.label ?? 'AI 语义';
    this.axes = options.axes;
    this.embedder = TextEmbedder.acquire(options.model);
    this.space = new AnchorSpace(this.embedder, groupsOf(options.axes), { topK: options.topK });
  }

  get ready(): boolean {
    return this.space.ready;
  }

  get broken(): boolean {
    return this.embedder.broken;
  }

  async warmUp(): Promise<boolean> {
    if (!(await this.embedder.warmUp())) return false;
    return this.space.warmUp().catch(() => false);
  }

  async analyze(text: string, history: readonly string[] = []): Promise<SemanticReading> {
    if (!this.ready) await this.warmUp();
    const vector = await this.space.project(text);

    const axes: Record<string, number> = {};
    const raw: Record<string, number> = {};

    for (const axis of this.axes) {
      const positive = this.space.affinity(vector, positiveKey(axis.key));
      const negative = axis.negative?.length
        ? this.space.affinity(vector, negativeKey(axis.key))
        : 0;
      const diff = positive - negative;
      const [floor, ceil] = axis.range ?? DEFAULT_DIFF_RANGE;
      raw[axis.key] = diff;
      axes[axis.key] = clamp01((diff - floor) / (ceil - floor));
    }

    return {
      axes,
      raw,
      familiarity: clamp01(await this.space.familiarity(text, history)),
      source: 'ai',
    };
  }

  dispose(): void {
    TextEmbedder.release(this.embedder);
  }
}
