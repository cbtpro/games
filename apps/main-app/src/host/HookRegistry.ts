import {
  EVENT_TO_HOST_HOOK,
  GAME_EVENTS,
  type GameEvent,
  type GameEventName,
  type GameHostHooks,
} from '@games/shared';

/**
 * 父应用钩子注册表。
 * 钩子以「集合」为单位注册而非继承，方便按能力插拔（日志 / 埋点 / 计分 / 风控）。
 */
export class HookRegistry {
  private sets: GameHostHooks[] = [];

  register(set: GameHostHooks): () => void {
    this.sets = [...this.sets, set];
    return () => {
      this.sets = this.sets.filter((item) => item !== set);
    };
  }

  dispatch(event: GameEvent): void {
    const key = EVENT_TO_HOST_HOOK[event.type as GameEventName];
    for (const set of this.sets) {
      if (key) {
        this.invoke(set, key, event);
      }
      if (event.type === GAME_EVENTS.STATE_CHANGE) {
        const payload = event.payload as { from?: string; to?: string } | undefined;
        if (payload?.from !== undefined && payload?.to !== undefined) {
          this.invoke(set, 'onStateChange', event);
        }
      }
      this.invoke(set, 'onAnyEvent', event);
    }
  }

  private invoke(set: GameHostHooks, key: keyof GameHostHooks, event: GameEvent): void {
    try {
      const handler = set[key];
      if (typeof handler === 'function') {
        (handler as (e: GameEvent) => void).call(set, event);
      }
    } catch (error) {
      // 单个钩子抛错绝不能中断事件分发
      console.error(`[HookRegistry] 钩子 ${String(key)} 执行失败`, error);
    }
  }
}
