import { useSyncExternalStore } from 'react';
import type { GameEvent } from '@games/shared';
import { eventLogStore } from './index';

/** 订阅父应用收到的全部生命周期事件 */
export function useEventLog(): GameEvent[] {
  return useSyncExternalStore(eventLogStore.subscribe, eventLogStore.getSnapshot);
}
