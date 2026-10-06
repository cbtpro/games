import type { TextEmbedder } from '../model/embedder';
import type { SemanticGroup } from '../types';
import { DEFAULT_TOP_K } from '../types';
import { dot, subtractProjection, unit, type Vector } from './vector';

/**
 * 语义坐标系。
 *
 * 把若干组锚点句子（每个组代表一个语义方向）投到同一套坐标里，
 * 之后任意一句话都能问出「它离哪一组更近」。
 *
 * 关键点：**锚点不是匹配词表，而是坐标**。
 * 输入只要落在某个方向附近就算数 —— 所以没收录过的句子也能判出来。
 *
 * 另一个关键点是各向异性修正（见 vector.ts）：
 * 建系时先算出所有锚点的公共方向，之后所有向量都先减掉它再比较。
 * 不减的话任意两句相似度都在 0.8 以上，完全不可分。
 */

export interface AnchorSpaceOptions {
  /** 与某组比相似度时取前几名的均值，抗单点噪声 */
  topK?: number;
}

export class AnchorSpace {
  private readonly embedder: TextEmbedder;
  private readonly groups: readonly SemanticGroup[];
  private readonly topK: number;

  /** 公共语义方向（锚点均值），比较前要先减掉 */
  private axis: Vector | null = null;
  /** 每组锚点去各向异性后的单位向量 */
  private readonly projected = new Map<string, Vector[]>();

  constructor(
    embedder: TextEmbedder,
    groups: readonly SemanticGroup[],
    options: AnchorSpaceOptions = {},
  ) {
    this.embedder = embedder;
    this.groups = groups;
    this.topK = options.topK ?? DEFAULT_TOP_K;
  }

  get keys(): string[] {
    return this.groups.map((group) => group.key);
  }

  get ready(): boolean {
    return this.axis !== null;
  }

  /** 算好公共方向与各组锚点向量 */
  warmUp(): Promise<boolean> {
    return this.build();
  }

  private building: Promise<boolean> | null = null;

  private build(): Promise<boolean> {
    this.building ??= (async (): Promise<boolean> => {
      // 先去重再编码：同一批语料被多个组引用时只算一次，
      // 公共方向也不会因为某组语料重复而偏移
      const unique = [...new Set(this.groups.flatMap((group) => group.samples))];
      const encoded = await this.embedder.embedMany(unique);
      const bySample = new Map<string, Vector>();
      unique.forEach((sample, index) => bySample.set(sample, encoded[index]));

      const dim = encoded[0]?.length ?? 0;
      const mean = new Float32Array(dim);
      for (const vector of bySample.values()) {
        for (let i = 0; i < dim; i += 1) mean[i] += vector[i] / bySample.size;
      }
      const axis = unit(mean);
      this.axis = axis;

      for (const group of this.groups) {
        this.projected.set(
          group.key,
          group.samples.map((sample) => {
            const vector = bySample.get(sample);
            return vector ? unit(subtractProjection(vector, axis)) : new Float32Array(dim);
          }),
        );
      }
      return true;
    })();
    return this.building;
  }

  /** 把一句话投进坐标系（已去各向异性、已归一化） */
  async project(text: string): Promise<Vector> {
    if (!this.axis) await this.warmUp();
    return this.projectVector(await this.embedder.embed(text));
  }

  projectVector(vector: Vector): Vector {
    const axis = this.axis;
    if (!axis) throw new Error('[@games/ai] 语义坐标系尚未就绪');
    return unit(subtractProjection(vector, axis));
  }

  /** 某个向量与某组锚点的亲和度：top-k 平均余弦 */
  affinity(vector: Vector, key: string): number {
    const anchors = this.projected.get(key);
    if (!anchors || anchors.length === 0) return 0;
    const sims = anchors.map((anchor) => dot(vector, anchor)).sort((a, b) => b - a);
    const top = sims.slice(0, Math.min(this.topK, sims.length));
    return top.reduce((sum, value) => sum + value, 0) / top.length;
  }

  /**
   * 与一组历史文本的最高语义相似度（用于「这句话是不是换汤不换药」）。
   * 比的是语义不是字面 —— 打乱语序的同一句诗照样能认出来。
   */
  async familiarity(text: string, history: readonly string[]): Promise<number> {
    if (history.length === 0) return 0;
    const self = await this.project(text);
    const previous = await this.embedder.embedMany(history);
    let best = 0;
    for (const past of previous) {
      const sim = dot(self, this.projectVector(past));
      if (sim > best) best = sim;
    }
    return best;
  }
}
