import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  INITIAL_VITALITY,
  advanceVitality,
  feedVitality,
  moodOf,
  spurnVitality,
} from '../domain/vitality';
import type { MoodSpec, VitalityState } from '../domain/vitality';
import type { VerdictGrade } from '../domain/types';

/**
 * 生命体征的时间驱动。
 *
 * 只做三件事：定时把 dt 喂给领域模型、暂停/后台时冻结时间、生命归零时回调一次。
 * 「多久算饿」「饿了掉多少血」全部在 domain/vitality.ts 里，这里不掺和数值。
 */

/** 推进粒度：250ms 足够平滑，又不会让 React 每帧重渲染 */
const TICK_MS = 250;
/** 单次 tick 最多补多少秒，防止标签页被挂起后一次性扣光 */
const MAX_DT_SEC = 2;

export interface UseVitalityOptions {
  /** 已开局（父应用 start / resume 之后） */
  running: boolean;
  /** 在前台（去激活时冻结，回来接着算） */
  active: boolean;
  /** 难度系数：加快饥饿与掉血 */
  factor: number;
  /** 生命值归零，只回调一次 */
  onDepleted: () => void;
}

export interface VitalityApi {
  state: VitalityState;
  mood: MoodSpec;
  /** 被吃掉一口 */
  feed: (grade: VerdictGrade) => void;
  /** 被吐掉一口 */
  spurn: () => void;
  reset: () => void;
}

export function useVitality(options: UseVitalityOptions): VitalityApi {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [state, setState] = useState<VitalityState>(INITIAL_VITALITY);
  /** 权威值放 ref：定时器里读到的永远是最新的，不依赖闭包快照 */
  const stateRef = useRef<VitalityState>(state);
  const lastTickAt = useRef(0);
  const depleted = useRef(false);

  const apply = useCallback((mutate: (current: VitalityState) => VitalityState): void => {
    const next = mutate(stateRef.current);
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = performance.now();
      const previous = lastTickAt.current || now;
      // 无论是否推进都要更新时间戳：暂停期间流逝的时间不能补算
      lastTickAt.current = now;

      const { running, active, factor } = optionsRef.current;
      if (!running || !active) return;

      const dt = Math.min(MAX_DT_SEC, (now - previous) / 1000);
      if (depleted.current || stateRef.current.hp <= 0) return;

      const next = advanceVitality(stateRef.current, dt, factor);
      stateRef.current = next;
      setState(next);

      if (next.hp <= 0) {
        depleted.current = true;
        optionsRef.current.onDepleted();
      }
    }, TICK_MS);

    return () => window.clearInterval(timer);
  }, []);

  const feed = useCallback(
    (grade: VerdictGrade): void => {
      apply((current) => feedVitality(current, grade));
    },
    [apply],
  );

  const spurn = useCallback((): void => {
    apply(spurnVitality);
  }, [apply]);

  const reset = useCallback((): void => {
    depleted.current = false;
    lastTickAt.current = 0;
    stateRef.current = INITIAL_VITALITY;
    setState(INITIAL_VITALITY);
  }, []);

  const mood = useMemo(() => moodOf(state.hunger), [state.hunger]);

  return { state, mood, feed, spurn, reset };
}
