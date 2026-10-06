import type { GameEvent } from './events';
import type { GameState } from './state';
import type { GameLaunchConfig } from './config';
import type { GameContext } from './context';
import type { DeathPayload, GameResult, PauseReason } from './payloads';

/**
 * 子游戏需要实现的生命周期钩子。
 *
 * 全部可选 —— 未实现的钩子依然会向父应用派发事件，
 * 因此「父组件钩子」永远能被触发，新增游戏时按需实现即可（开闭原则）。
 */
export interface GameHooks<C extends GameLaunchConfig = GameLaunchConfig> {
  /** 初始化：拿到父应用传入的配置，做资源预加载等（此时还没有 DOM 容器） */
  onInit?(ctx: GameContext<C>): void | Promise<void>;
  /** 挂载：已渲染 React 树，可操作 DOM、启动渲染循环 */
  onMount?(ctx: GameContext<C>): void | Promise<void>;
  /** 销毁：释放定时器、事件监听、WebGL 上下文等 */
  onUnmount?(ctx: GameContext<C>): void | Promise<void>;
  /** 激活：回到前台 / 获得焦点 */
  onActivate?(ctx: GameContext<C>): void | Promise<void>;
  /** 去激活：退到后台 / 失去焦点，保留状态 */
  onDeactivate?(ctx: GameContext<C>): void | Promise<void>;
  /** 游戏开始 */
  onStart?(ctx: GameContext<C>): void | Promise<void>;
  /** 游戏暂停 */
  onPause?(ctx: GameContext<C>, reason?: PauseReason): void | Promise<void>;
  /** 游戏继续 */
  onResume?(ctx: GameContext<C>): void | Promise<void>;
  /** 死亡（区别于彻底结束，一般还有剩余生命，可重开） */
  onDeath?(ctx: GameContext<C>, payload: DeathPayload): void | Promise<void>;
  /** 重开 */
  onRestart?(ctx: GameContext<C>): void | Promise<void>;
  /** 游戏结束，产出结算结果 */
  onEnd?(ctx: GameContext<C>, result: GameResult): void | Promise<void>;
  /** 父应用下发了新的启动参数 */
  onConfigUpdate?(ctx: GameContext<C>, next: Readonly<C>, prev: Readonly<C>): void | Promise<void>;
  /** 任意钩子抛错时兜底（不会中断其它钩子） */
  onError?(ctx: GameContext<C>, error: Error): void;
  /** 父应用下发了自定义命令 */
  onCommand?(ctx: GameContext<C>, command: { type: string; payload?: unknown }): void | Promise<void>;
}

/**
 * 父应用侧的钩子。每发生一个子应用事件，所有注册的 hook 集合都会被依次调用。
 * 用数组组合而非继承，方便按需插拔（日志 / 埋点 / 计分 / 风控）。
 */
export interface GameHostHooks {
  onGameInit?(event: GameEvent): void;
  onGameMount?(event: GameEvent): void;
  onGameUnmount?(event: GameEvent): void;
  onGameActivate?(event: GameEvent): void;
  onGameDeactivate?(event: GameEvent): void;
  onGameStart?(event: GameEvent): void;
  onGamePause?(event: GameEvent): void;
  onGameResume?(event: GameEvent): void;
  onGameDeath?(event: GameEvent): void;
  onGameRestart?(event: GameEvent): void;
  onGameOver?(event: GameEvent): void;
  onGameEnd?(event: GameEvent): void;
  onGameScore?(event: GameEvent): void;
  onGameError?(event: GameEvent): void;
  onStateChange?(event: GameEvent & { payload: { from: GameState; to: GameState } }): void;
  /** 兜底：每个事件都会调用一次（在专用钩子之后） */
  onAnyEvent?(event: GameEvent): void;
}

export type GameHostHookSet = GameHostHooks;
