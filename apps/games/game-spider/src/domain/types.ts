/**
 * 「喂蜘蛛」游戏的领域类型。
 * 全部为纯数据定义，不引用 React，方便单独测试与复用。
 */

/** 文本被判定的档次 */
export type VerdictGrade = 'junk' | 'bland' | 'tasty' | 'delicacy';

/** 一次口味鉴定结果 */
export interface WordVerdict {
  grade: VerdictGrade;
  /** 营养价值 0 - 100 */
  score: number;
  /** 命中的特征标签，用于 UI 展示 */
  tags: string[];
  /** 给玩家看的判定理由 */
  reason: string;
  /** 在当前挑食等级下，蜘蛛愿不愿意吃 */
  edible: boolean;
}

/** 场上的一条漂浮文字 */
export interface WordItem {
  id: string;
  text: string;
  verdict: WordVerdict;
  /** 场地坐标系内的左上角位置 */
  x: number;
  y: number;
  bornAt: number;
}

/** 蜘蛛的行为阶段 */
export type SpiderPhase = 'idle' | 'wander' | 'seek' | 'grasp';

/** 一次进食 / 拒食的结果，用于 UI 反馈与计分 */
export interface FeedingOutcome {
  kind: 'eat' | 'reject';
  text: string;
  verdict: WordVerdict;
  gained: number;
}

export interface Point {
  x: number;
  y: number;
}
