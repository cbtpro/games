import type { GameCommand, GameEvent, GameHostApi, Unsubscribe } from '@games/shared';

/**
 * 独立运行（直接打开子应用 URL，不经过主应用）时使用的桥。
 * 行为与内嵌完全一致，只是把事件输出到控制台，保证子应用可以脱离主应用独立调试。
 */
export class StandaloneHostBridge implements GameHostApi {
  private commandHandlers = new Set<(command: GameCommand) => void>();

  emit(event: GameEvent): void {
    // eslint-disable-next-line no-console
    console.debug(`[standalone-host] ${event.type}/${event.phase}`, event);
  }

  onCommand(handler: (command: GameCommand) => void): Unsubscribe {
    this.commandHandlers.add(handler);
    return () => this.commandHandlers.delete(handler);
  }

  reportScore(payload: unknown): void {
    // eslint-disable-next-line no-console
    console.debug('[standalone-host] reportScore', payload);
  }

  notifyStateChange(from: string, to: string): void {
    // eslint-disable-next-line no-console
    console.debug(`[standalone-host] state ${from} -> ${to}`);
  }

  requestClose(reason?: string): void {
    // eslint-disable-next-line no-console
    console.debug('[standalone-host] requestClose', reason);
  }

  isEmbedded(): boolean {
    return false;
  }

  /** 供独立模式下的调试面板调用 */
  dispatch(command: GameCommand): void {
    for (const handler of Array.from(this.commandHandlers)) {
      try {
        handler(command);
      } catch (error) {
        console.error('[standalone-host] command handler failed', error);
      }
    }
  }
}
