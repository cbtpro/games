import { SemanticAnalyzer, type SemanticAnalyzerOptions } from '../semantic/analyzer';
import { withFallback } from '../semantic/resilient';
import type { SemanticReading, TextAnalyzer } from '../types';
import { useSemanticAnalyzer, type UseSemanticAnalyzer } from './useSemanticAnalyzer';

/**
 * 开箱即用的语义分析钩子：只给语义轴，其余交给公共层。
 *
 * 想完全自己组装（比如要输出自己的画像结构、要自定义兜底）时用
 * `useSemanticAnalyzer`，其余情况用这个就够了。
 */

export interface UseSemanticReadingOptions extends SemanticAnalyzerOptions {
  /** 模型加载失败/未就绪时的兜底分析器 */
  fallback?: TextAnalyzer<SemanticReading>;
}

/** 注意：语义轴在挂载时确定，之后改变不会重建分析器（模型加载很贵） */
export function useSemanticReading(
  options: UseSemanticReadingOptions,
): UseSemanticAnalyzer<SemanticReading> {
  const { fallback, ...analyzerOptions } = options;

  return useSemanticAnalyzer<SemanticReading>((report) => {
    const analyzer = new SemanticAnalyzer({
      ...analyzerOptions,
      model: { ...analyzerOptions.model, onProgress: report },
    });
    return fallback ? withFallback(analyzer, fallback) : analyzer;
  }, []);
}
