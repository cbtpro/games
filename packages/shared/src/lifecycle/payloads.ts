/** 死亡事件载荷 */
export interface DeathPayload {
  /** 死亡原因，例如 'out-of-bounds' | 'timeout' | 'hp-zero' */
  reason?: string;
  /** 第几条命 */
  lifeIndex?: number;
  position?: { x: number; y: number };
  [key: string]: unknown;
}

/** 游戏结束结果 */
export interface GameResult {
  /** 是否通关 / 胜利 */
  won?: boolean;
  score: number;
  level?: number;
  /** 存活时长（毫秒） */
  durationMs?: number;
  /** 结算原因：completed / quit / timeout / error */
  reason?: string;
  stats?: Record<string, number | string | boolean>;
  [key: string]: unknown;
}

/** 分数上报载荷 */
export interface ScorePayload {
  score: number;
  level?: number;
  /** 增量分数 or 总分 */
  mode?: 'delta' | 'total';
  label?: string;
  stats?: Record<string, number | string | boolean>;
  [key: string]: unknown;
}

/** 暂停原因 */
export type PauseReason = 'user' | 'blur' | 'background' | 'parent' | 'network' | string;
