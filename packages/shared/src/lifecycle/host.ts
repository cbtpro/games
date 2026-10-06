import type { GameCommand } from './commands';
import type { GameEvent, GameEventType } from './events';
import type { ScorePayload } from './payloads';

/** 命令处理器，返回取消订阅函数 */
export type Unsubscribe = () => void;

/**
 * 父应用暴露给子游戏的能力集合（通过 qiankun props 注入）。
 * 子应用只依赖这个接口，不依赖 qiankun 本身 —— 便于单测与独立运行。
 */
export interface GameHostApi {
  /** 子 -> 父：上报事件（触发父应用钩子） */
  emit(event: GameEvent): void;
  /** 监听父应用下发的命令 */
  onCommand(handler: (command: GameCommand) => void): Unsubscribe;
  /** 上报分数 */
  reportScore(payload: ScorePayload): void;
  /** 通知状态变更 */
  notifyStateChange(from: string, to: string): void;
  /** 请求父应用关闭自己 */
  requestClose(reason?: string): void;
  /** 当前是否被父应用内嵌（false 表示独立运行） */
  isEmbedded(): boolean;
}

/** 子应用自定义事件上报的便捷签名 */
export type EventEmitter = <T>(type: GameEventType, payload?: T) => void;
