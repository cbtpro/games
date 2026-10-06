import type { GameState } from './state';

/**
 * 子 -> 父 的事件类型。父应用通过这些事件触发自己的钩子。
 * `phase` 区分钩子执行前 / 执行后 / 执行失败，便于父应用做埋点与耗时统计。
 */
export const GAME_EVENTS = {
  INIT: 'game:init',
  MOUNT: 'game:mount',
  UNMOUNT: 'game:unmount',
  ACTIVATE: 'game:activate',
  DEACTIVATE: 'game:deactivate',
  START: 'game:start',
  PAUSE: 'game:pause',
  RESUME: 'game:resume',
  DEATH: 'game:death',
  RESTART: 'game:restart',
  OVER: 'game:over',
  END: 'game:end',
  SCORE: 'game:score',
  STATE_CHANGE: 'game:state-change',
  ERROR: 'game:error',
} as const;

export type GameEventName = (typeof GAME_EVENTS)[keyof typeof GAME_EVENTS];
export type GameEventType = GameEventName | `game:custom:${string}`;

export type GameEventPhase = 'before' | 'after' | 'error';

export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
}

/** 父子之间流动的事件信封 */
export interface GameEvent<TPayload = unknown> {
  type: GameEventType;
  phase: GameEventPhase;
  /** 事件可读名，用于控制台展示 */
  label: string;
  gameCode: string;
  sessionId: string;
  state: GameState;
  timestamp: number;
  /** 钩子耗时（仅 after / error 阶段有） */
  durationMs?: number;
  payload?: TPayload;
  error?: SerializedError;
}

export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: 'UnknownError', message: String(error) };
}
