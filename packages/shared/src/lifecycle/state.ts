/**
 * 子游戏状态机。
 *
 * 状态机只做「观测与校验」，不做「阻断」：非法迁移会以 `game:error` 事件上报给父应用，
 * 但钩子依旧执行。这样单个游戏的异常行为永远不会拖垮主应用（高鲁棒性优先于严格性）。
 */
export const GameState = {
  /** 尚未初始化 */
  Idle: 'idle',
  Initializing: 'initializing',
  Initialized: 'initialized',
  Mounting: 'mounting',
  Mounted: 'mounted',
  /** 激活（获得焦点 / 处于前台） */
  Activated: 'activated',
  /** 去激活（失去焦点 / 退到后台），资源保留，可再激活 */
  Deactivated: 'deactivated',
  Running: 'running',
  Paused: 'paused',
  /** 死亡 / 失败，等待重开或结束 */
  Over: 'over',
  Destroying: 'destroying',
  Destroyed: 'destroyed',
} as const;

export type GameState = (typeof GameState)[keyof typeof GameState];

/** 允许的状态迁移表 */
const TRANSITIONS: Readonly<Record<GameState, readonly GameState[]>> = {
  idle: ['initializing', 'destroyed'],
  initializing: ['initialized'],
  initialized: ['mounting', 'destroyed'],
  mounting: ['mounted'],
  mounted: ['activated', 'deactivated', 'destroying', 'destroyed'],
  activated: ['running', 'paused', 'deactivated', 'destroying'],
  deactivated: ['activated', 'destroying'],
  running: ['paused', 'over', 'deactivated', 'destroying'],
  paused: ['running', 'over', 'deactivated', 'destroying'],
  over: ['running', 'destroying'],
  destroying: ['destroyed'],
  destroyed: ['initializing'],
};

export function canTransition(from: GameState, to: GameState): boolean {
  const allowed = TRANSITIONS[from];
  return !!allowed && (allowed as readonly GameState[]).includes(to);
}

/** 终态：进入后不应再产生业务事件 */
export function isTerminal(state: GameState): boolean {
  return state === GameState.Destroyed;
}
