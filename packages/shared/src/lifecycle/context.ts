import type { ReactNode } from 'react';
import type { GameEvent, GameEventType } from './events';
import type { GameCommand } from './commands';
import type { GameLaunchConfig, GameLaunchConfigPatch } from './config';
import type { GameState } from './state';
import type { GameHostApi } from './host';
import type { GameManifest } from './manifest';
import type { DeathPayload, GameResult, PauseReason, ScorePayload } from './payloads';

/**
 * 运行期上下文：子游戏的每个钩子、每个 React 组件拿到的都是它。
 * 子应用只与这个抽象交互，不直接碰 qiankun / DOM / 后端，关注点彻底分离。
 */
export interface GameContext<C extends GameLaunchConfig = GameLaunchConfig> {
  readonly manifest: GameManifest;
  /** 父应用传入的启动参数（只读） */
  readonly config: Readonly<C>;
  /** 当前状态 */
  readonly state: GameState;
  /** 与父应用通信的桥 */
  readonly host: GameHostApi;
  /** 子应用内部事件总线 */
  readonly bus: GameEventBus;
  /** 轻量状态容器 */
  readonly store: GameStore;
  readonly logger: GameLogger;
  /** 挂载容器（mount 之后才有值） */
  readonly container: HTMLElement | null;
  readonly isEmbedded: boolean;

  /** 渲染 React 树（SDK 在 mount 阶段自动调用，游戏一般无需手动调用） */
  render(node: ReactNode): void;
  /** 卸载 React 树 */
  clear(): void;

  /** 上报事件到父应用（同步广播） */
  emit<T = unknown>(type: GameEventType, payload?: T): void;
  /** 上报分数 */
  reportScore(payload: ScorePayload): void;

  /** 主动驱动生命周期（供游戏内部按钮 / 快捷键调用） */
  start(): Promise<void>;
  pause(reason?: PauseReason): Promise<void>;
  resume(): Promise<void>;
  die(payload?: DeathPayload): Promise<void>;
  restart(): Promise<void>;
  finish(result: GameResult): Promise<void>;
  /** 局部更新配置，会触发 onConfigUpdate */
  patchConfig(patch: GameLaunchConfigPatch): Promise<void>;
  /** 向父应用请求自定义能力（父应用自定义命令的反向通道） */
  sendCommand(command: GameCommand): void;
}

/** 子应用内部事件总线 */
export interface GameEventBus {
  on(handler: (event: GameEvent) => void): () => void;
  emit(event: GameEvent): void;
  clear(): void;
}

/** 轻量 KV 状态容器 */
export interface GameStore {
  get<T = unknown>(key: string): T | undefined;
  set<T = unknown>(key: string, value: T): void;
  patch(values: Record<string, unknown>): void;
  delete(key: string): void;
  snapshot(): Record<string, unknown>;
  clear(): void;
}

export interface GameLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}
