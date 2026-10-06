import type { GameCommand, GameEvent, GameHostApi, ScorePayload, Unsubscribe } from '@games/shared';
import type { CommandHub } from './CommandHub';

/**
 * 父应用注入给子游戏的桥实现。
 * 子游戏只依赖 GameHostApi 接口，因此能独立运行、单测，不被 qiankun 绑死。
 */
export class ParentGameBridge implements GameHostApi {
  constructor(
    private readonly hub: CommandHub,
    private readonly sink: (event: GameEvent) => void,
    private readonly hooks: ParentBridgeHooks = {},
  ) {}

  emit(event: GameEvent): void {
    this.sink(event);
  }

  onCommand(handler: (command: GameCommand) => void): Unsubscribe {
    return this.hub.subscribe(handler);
  }

  reportScore(payload: ScorePayload): void {
    try {
      this.hooks.onScore?.(payload);
    } catch (error) {
      console.error('[ParentGameBridge] 计分钩子失败', error);
    }
  }

  notifyStateChange(from: string, to: string): void {
    try {
      this.hooks.onStateChange?.(from, to);
    } catch (error) {
      console.error('[ParentGameBridge] 状态钩子失败', error);
    }
  }

  requestClose(reason?: string): void {
    this.hooks.onRequestClose?.(reason);
  }

  isEmbedded(): boolean {
    return true;
  }
}

export interface ParentBridgeHooks {
  onScore?: (payload: ScorePayload) => void;
  onStateChange?: (from: string, to: string) => void;
  onRequestClose?: (reason?: string) => void;
}
