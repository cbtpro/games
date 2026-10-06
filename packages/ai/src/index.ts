/**
 * @games/ai —— 子游戏共用的浏览器内 AI 能力。
 *
 * 分三层，越往上越贴近业务：
 *   model/     模型加载与向量化（句子 → 向量）
 *   semantic/  语义坐标系（锚点方向、语义轴、降级组合）
 *   react/     把上面接进 React 的钩子
 *
 * 所有推理都在浏览器本地完成，没有后端参与。
 */

export * from './types';

export { TextEmbedder } from './model/embedder';
export {
  DEFAULT_DTYPE,
  DEFAULT_MODEL_ID,
  DEFAULT_PREFIX,
  defaultLocalModelPath,
  modelKeyOf,
  modelOptionsFromEnv,
  resolveModelOptions,
  type ModelDtype,
  type ModelOptions,
  type ResolvedModelOptions,
} from './model/options';

export { AnchorSpace, type AnchorSpaceOptions } from './semantic/anchorSpace';
export { SemanticAnalyzer, type SemanticAnalyzerOptions } from './semantic/analyzer';
export { withFallback, type ResilientAnalyzer } from './semantic/resilient';
export { clamp01, cosine, dot, subtractProjection, unit, type Vector } from './semantic/vector';

export {
  useSemanticAnalyzer,
  type AnalyzerFactory,
  type AnalyzerPhase,
  type AnalyzerStatus,
  type ProgressReporter,
  type UseSemanticAnalyzer,
} from './react/useSemanticAnalyzer';
export {
  useSemanticReading,
  type UseSemanticReadingOptions,
} from './react/useSemanticReading';
