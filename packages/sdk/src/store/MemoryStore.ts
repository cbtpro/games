import type { GameStore } from '@games/shared';

/** 极简 KV 状态容器：够用、无依赖、易替换成 zustand / redux */
export class MemoryStore implements GameStore {
  private data = new Map<string, unknown>();

  get<T = unknown>(key: string): T | undefined {
    return this.data.get(key) as T | undefined;
  }

  set<T = unknown>(key: string, value: T): void {
    this.data.set(key, value);
  }

  patch(values: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(values)) {
      this.data.set(key, value);
    }
  }

  delete(key: string): void {
    this.data.delete(key);
  }

  snapshot(): Record<string, unknown> {
    return Object.fromEntries(this.data.entries());
  }

  clear(): void {
    this.data.clear();
  }
}
