/** 父 -> 子 的命令 */
export const GAME_COMMANDS = {
  START: 'game:start',
  PAUSE: 'game:pause',
  RESUME: 'game:resume',
  RESTART: 'game:restart',
  STOP: 'game:stop',
  ACTIVATE: 'game:activate',
  DEACTIVATE: 'game:deactivate',
  UPDATE_CONFIG: 'game:update-config',
  DESTROY: 'game:destroy',
} as const;

export type GameCommandName = (typeof GAME_COMMANDS)[keyof typeof GAME_COMMANDS];

export interface GameCommand<TPayload = unknown> {
  type: GameCommandName | `game:custom:${string}`;
  payload?: TPayload;
  /** 命令发起方来源，便于日志溯源 */
  source?: string;
}
