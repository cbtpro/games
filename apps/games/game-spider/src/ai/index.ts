/**
 * 蜘蛛味觉的装配出口。
 *
 * 对外只暴露「拿一个能用的判定器」：背后是语义模型还是应急规则由这里决定，
 * 上层业务不需要知道 —— 领域层拿到的永远是一份 SemanticProfile。
 */

import { withFallback, type ResilientAnalyzer } from '@games/ai';
import { HeuristicJudge } from './heuristicJudge';
import { SemanticTaste, type SemanticTasteOptions } from './semanticTaste';
import type { SemanticProfile } from './types';

export * from './types';
export { SPIDER_AXES, SemanticTaste, type SemanticTasteOptions } from './semanticTaste';
export { HeuristicJudge } from './heuristicJudge';
export { REFINED_ANCHORS, VULGAR_ANCHORS, PASSAGE_PREFIX } from './anchors';

/** 有韧性的判定器：AI 优先，失败自动降级 */
export type SpiderJudge = ResilientAnalyzer<SemanticProfile>;

/**
 * 造一个蜘蛛味觉。
 *
 * 模型下载慢、离线、浏览器不支持 WASM 时自动用应急规则顶上，
 * 游戏照常能玩，只是判得粗一点；模型一旦就绪会自动接管，无需重启。
 */
export function createSpiderJudge(options: SemanticTasteOptions = {}): SpiderJudge {
  return withFallback<SemanticProfile>(new SemanticTaste(options), new HeuristicJudge());
}
