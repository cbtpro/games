import type { GameEvent } from '@games/shared';
import { api, type EventLogInput } from '../api/client';

const FLUSH_INTERVAL_MS = 1500;
const MAX_BATCH = 30;

/** 生命周期事件批量上报，避免每个事件打一次接口 */
export class TelemetryBuffer {
  private buffer: EventLogInput[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
    window.addEventListener('beforeunload', this.flushSync);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    window.removeEventListener('beforeunload', this.flushSync);
    void this.flush();
  }

  push(event: GameEvent): void {
    this.buffer.push({
      gameCode: event.gameCode,
      sessionId: event.sessionId,
      type: String(event.type),
      phase: event.phase,
      state: event.state,
      durationMs: event.durationMs ?? null,
      payload: event.payload ?? null,
      error: event.error ? `${event.error.name}: ${event.error.message}` : null,
    });
    if (this.buffer.length >= MAX_BATCH) void this.flush();
  }

  private flushSync = (): void => {
    const items = this.buffer;
    this.buffer = [];
    if (!items.length) return;
    // 页面卸载时用 sendBeacon 兜底，fetch 可能被浏览器取消
    const url = `${import.meta.env.VITE_API_BASE ?? '/api'}/events/batch`;
    navigator.sendBeacon(url, new Blob([JSON.stringify({ items })], { type: 'application/json' }));
  };

  async flush(): Promise<void> {
    if (!this.buffer.length) return;
    const items = this.buffer;
    this.buffer = [];
    await api.uploadEvents(items);
  }
}
