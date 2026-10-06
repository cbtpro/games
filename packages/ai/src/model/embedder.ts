import {
  modelKeyOf,
  resolveModelOptions,
  type ModelOptions,
  type ResolvedModelOptions,
} from './options';
import { unit, type Vector } from '../semantic/vector';

/**
 * 文本向量化：把句子变成可比较的向量。
 *
 * 只做一件事 —— 「句子 → 向量」，不理解任何业务语义。
 * 语义坐标由 AnchorSpace 负责，业务判定由各游戏自己组装。
 *
 * 实现要点：
 * 1. **动态 import**：模型库体积不小，且只有真要分析时才需要，不能拖慢首屏。
 * 2. **共享实例**：同一个模型在整个子应用里只加载一份（约 110MB），
 *    多个分析器通过 acquire/release 引用计数共用。
 * 3. **向量缓存**：锚点会反复参与运算，缓存后不再重复推理。
 */

/** 只描述我们用到的那一小部分能力，避免被上游巨大的类型定义绑架 */
interface FeatureExtractorLike {
  (input: string[], options: { pooling: 'mean'; normalize: boolean }): Promise<
    Array<{ data: ArrayLike<number> }>
  >;
  dispose?: () => Promise<void>;
}

interface SharedEntry {
  embedder: TextEmbedder;
  refs: number;
}

export class TextEmbedder {
  private static readonly pool = new Map<string, SharedEntry>();

  /**
   * 取一个共享的向量化器。
   *
   * 同一个模型只加载一次：第二个使用者拿到的是同一个实例。
   * 用完必须 release()，引用归零时才真正释放模型。
   */
  static acquire(options: ModelOptions = {}): TextEmbedder {
    const resolved = resolveModelOptions(options);
    const key = modelKeyOf(resolved);
    const existing = TextEmbedder.pool.get(key);
    if (existing) {
      existing.refs += 1;
      return existing.embedder;
    }
    const embedder = new TextEmbedder(resolved);
    TextEmbedder.pool.set(key, { embedder, refs: 1 });
    return embedder;
  }

  /** 归还共享实例；引用归零时释放模型 */
  static release(embedder: TextEmbedder): void {
    for (const [key, entry] of TextEmbedder.pool) {
      if (entry.embedder !== embedder) continue;
      entry.refs -= 1;
      if (entry.refs <= 0) {
        TextEmbedder.pool.delete(key);
        embedder.dispose();
      }
      return;
    }
    embedder.dispose();
  }

  readonly options: ResolvedModelOptions;

  private extractor: FeatureExtractorLike | null = null;
  private loading: Promise<boolean> | null = null;
  private failed = false;
  private readonly cache = new Map<string, Vector>();

  /** 直接构造仅供测试；正式使用请走 acquire() 以共享模型 */
  constructor(options: ModelOptions | ResolvedModelOptions = {}) {
    // ResolvedModelOptions 是 ModelOptions 的超集，再解析一次也是幂等的
    this.options = resolveModelOptions(options);
  }

  get ready(): boolean {
    return this.extractor !== null;
  }

  /** 模型是否已彻底放弃（加载失败）—— 上层据此降级 */
  get broken(): boolean {
    return this.failed;
  }

  /** 已缓存的向量条数，便于排查与调试 */
  get cacheSize(): number {
    return this.cache.size;
  }

  dispose(): void {
    const extractor = this.extractor;
    this.extractor = null;
    this.loading = null;
    this.cache.clear();
    // WASM 资源难以强制回收，尽力而为；失败不影响后续重新加载
    void Promise.resolve(extractor?.dispose?.()).catch(() => undefined);
  }

  warmUp(): Promise<boolean> {
    this.loading ??= this.load().catch((error) => {
      this.failed = true;
      console.warn('[@games/ai] 语义模型加载失败，将使用兜底判定：', error);
      return false;
    });
    return this.loading;
  }

  private async load(): Promise<boolean> {
    const { env, pipeline } = await import('@huggingface/transformers');

    if (this.options.allowLocalModels) {
      env.allowLocalModels = true;
      env.localModelPath = this.options.localModelPath;
    }
    if (this.options.remoteHost) env.remoteHost = this.options.remoteHost;
    env.allowRemoteModels = true;

    const extractor = (await pipeline('feature-extraction', this.options.modelId, {
      dtype: this.options.dtype,
      // ProgressInfo 是联合类型，这里只取关心的进度百分比
      progress_callback: (event: unknown) => {
        const progress = (event as { progress?: number } | null)?.progress;
        if (typeof progress === 'number') {
          this.options.onProgress?.(Math.min(1, Math.max(0, progress / 100)));
        }
      },
    })) as unknown as FeatureExtractorLike;

    this.extractor = extractor;
    this.options.onProgress?.(1);
    return true;
  }

  /** 批量向量化；已算过的句子直接取缓存 */
  async embedMany(texts: readonly string[]): Promise<Vector[]> {
    if (!this.extractor) await this.warmUp();
    const extractor = this.extractor;
    if (!extractor) throw new Error('[@games/ai] 语义模型不可用');

    const pending = texts.filter((text) => !this.cache.has(text));
    if (pending.length > 0) {
      const output = await extractor(
        pending.map((text) => this.options.prefix + text),
        { pooling: 'mean', normalize: true },
      );
      pending.forEach((text, index) => {
        const row = output[index];
        this.cache.set(text, unit(new Float32Array(row.data as ArrayLike<number>)));
      });
    }
    return texts.map((text) => this.cache.get(text) as Vector);
  }

  async embed(text: string): Promise<Vector> {
    const [vector] = await this.embedMany([text]);
    return vector;
  }
}
