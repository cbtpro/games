import type { GameEvent } from '@games/shared';

const MAX_ENTRIES = 300;

/**
 * 事件日志：父应用所有钩子触发的可视化证据。
 * 用外部 store + useSyncExternalStore，避免每次事件都重渲染整棵树。
 */
export class EventLogStore {
  private entries: GameEvent[] = [];
  private listeners = new Set<() => void>();
  private snapshotCache: GameEvent[] = [];

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): GameEvent[] => this.snapshotCache;

  push(event: GameEvent): void {
    this.entries = [event, ...this.entries].slice(0, MAX_ENTRIES);
    this.snapshotCache = this.entries;
    this.listeners.forEach((listener) => listener());
  }

  clear(): void {
    this.entries = [];
    this.snapshotCache = [];
    this.listeners.forEach((listener) => listener());
  }
}
