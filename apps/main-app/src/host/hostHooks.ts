import { GAME_EVENTS, type GameEvent, type GameHostHooks, type ScorePayload } from '@games/shared';
import { api } from '../api/client';
import type { TelemetryBuffer } from './TelemetryBuffer';

/** 控制台钩子：开发期直观看到每个生命周期被触发 */
export function createLoggingHooks(): GameHostHooks {
  return {
    onAnyEvent(event: GameEvent) {
      const extra = event.durationMs !== undefined ? `${event.durationMs}ms` : '';
      // eslint-disable-next-line no-console
      console.log(
        `%c[${event.label}]%c ${event.type}/${event.phase} ${extra}`,
        'color:#2563eb;font-weight:600',
        'color:inherit',
        event.payload ?? '',
      );
    },
    onGameError(event: GameEvent) {
      console.error('[父应用] 子游戏异常', event.error);
    },
  };
}

/** 埋点钩子：所有事件入缓冲，批量上报后端 */
export function createTelemetryHooks(buffer: TelemetryBuffer): GameHostHooks {
  return {
    onAnyEvent(event: GameEvent) {
      buffer.push(event);
    },
  };
}

export interface SessionSyncOptions {
  gameCode: string;
  sessionId: string;
  playerId?: string | null;
}

/**
 * 会话同步钩子：把生命周期映射成后端会话状态与分数。
 * 这是「父组件钩子」真正产生业务价值的地方，游戏本身完全不需要关心。
 */
export function createSessionSyncHooks(options: SessionSyncOptions): GameHostHooks {
  const { gameCode, sessionId, playerId } = options;
  let startedAt: number | null = null;

  const submitScore = (score: number, stats?: Record<string, unknown> | null): void => {
    void api.submitScore({
      gameCode,
      playerId: playerId ?? null,
      sessionId,
      score,
      stats: stats ?? null,
    });
  };

  return {
    onGameStart() {
      startedAt = Date.now();
      void api.updateSession(sessionId, { status: 'running' });
    },
    onGameResume() {
      void api.updateSession(sessionId, { status: 'running' });
    },
    onGamePause() {
      void api.updateSession(sessionId, { status: 'paused' });
    },
    onGameScore(event: GameEvent) {
      const payload = (event.payload ?? {}) as ScorePayload;
      if (typeof payload.score === 'number') {
        submitScore(payload.score, payload.stats ?? null);
      }
    },
    onGameEnd(event: GameEvent) {
      const result = (event.payload ?? {}) as { score?: number; stats?: Record<string, unknown> };
      const durationMs = startedAt ? Date.now() - startedAt : null;
      if (typeof result.score === 'number') submitScore(result.score, result.stats ?? null);
      void api.updateSession(sessionId, {
        status: 'ended',
        finalScore: typeof result.score === 'number' ? result.score : null,
        durationMs,
      });
    },
    onGameUnmount() {
      void api.updateSession(sessionId, { status: 'ended' });
    },
  };
}

/** 事件日志钩子（驱动右侧事件控制台） */
export function createEventLogHooks(sink: (event: GameEvent) => void): GameHostHooks {
  return {
    onAnyEvent(event) {
      // 状态变更过于密集，只在控制台保留生命周期事件
      if (event.type === GAME_EVENTS.STATE_CHANGE && !event.error) return;
      sink(event);
    },
  };
}
