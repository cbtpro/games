import { GAME_EVENTS, type GameEventName, type GameHostHooks } from './index';

/**
 * 事件 -> 父应用钩子 的映射表。
 * 新增事件只改这张表，不用改调度逻辑（开闭原则）。
 */
export const EVENT_TO_HOST_HOOK: Partial<Record<GameEventName, keyof GameHostHooks>> = {
  [GAME_EVENTS.INIT]: 'onGameInit',
  [GAME_EVENTS.MOUNT]: 'onGameMount',
  [GAME_EVENTS.UNMOUNT]: 'onGameUnmount',
  [GAME_EVENTS.ACTIVATE]: 'onGameActivate',
  [GAME_EVENTS.DEACTIVATE]: 'onGameDeactivate',
  [GAME_EVENTS.START]: 'onGameStart',
  [GAME_EVENTS.PAUSE]: 'onGamePause',
  [GAME_EVENTS.RESUME]: 'onGameResume',
  [GAME_EVENTS.DEATH]: 'onGameDeath',
  [GAME_EVENTS.RESTART]: 'onGameRestart',
  [GAME_EVENTS.OVER]: 'onGameOver',
  [GAME_EVENTS.END]: 'onGameEnd',
  [GAME_EVENTS.SCORE]: 'onGameScore',
  [GAME_EVENTS.ERROR]: 'onGameError',
};
