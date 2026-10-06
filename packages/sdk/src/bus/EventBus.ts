import type { GameEvent, GameEventBus } from '@games/shared';

/** 子应用内部事件总线；单个订阅者抛错不影响其它订阅者 */
export class EventBus implements GameEventBus {
  private handlers = new Set<(event: GameEvent) => void>();

  on(handler: (event: GameEvent) => void): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  emit(event: GameEvent): void {
    for (const handler of Array.from(this.handlers)) {
      try {
        handler(event);
      } catch (error) {
        console.error('[EventBus] handler failed', error);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
