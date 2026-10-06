import { useCallback, useEffect, useRef, useState } from 'react';
import type { TextAnalyzer } from '../types';

/**
 * 把分析器接进 React。
 *
 * 策略：组件挂载后就在后台下载模型，玩家不用等；
 * 模型没好之前的分析会走兜底 —— 游戏任何时候都不会卡住。
 */

export type AnalyzerPhase = 'idle' | 'loading' | 'ready' | 'failed';

export interface AnalyzerStatus {
  phase: AnalyzerPhase;
  /** 模型下载进度 0~1 */
  progress: number;
  /** 最近一次分析是否真的走了模型 */
  usingAi: boolean;
}

/** 进度上报回调：分析器在加载模型时调用它 */
export type ProgressReporter = (ratio: number) => void;

/** 创建分析器的工厂；report 用于上报模型加载进度 */
export type AnalyzerFactory<T> = (report: ProgressReporter) => TextAnalyzer<T>;

export interface UseSemanticAnalyzer<T> {
  status: AnalyzerStatus;
  analyze: (text: string, history?: readonly string[]) => Promise<T>;
  retry: () => void;
}

export function useSemanticAnalyzer<T>(
  factory: AnalyzerFactory<T>,
  deps: readonly unknown[] = [],
): UseSemanticAnalyzer<T> {
  const analyzerRef = useRef<TextAnalyzer<T> | null>(null);
  const [status, setStatus] = useState<AnalyzerStatus>({
    phase: 'idle',
    progress: 0,
    usingAi: false,
  });
  const [nonce, setNonce] = useState(0);

  const boot = useCallback((): TextAnalyzer<T> => {
    const existing = analyzerRef.current;
    if (existing) return existing;

    const analyzer = factory((ratio) =>
      setStatus((current) => ({ ...current, progress: ratio })),
    );
    analyzerRef.current = analyzer;

    setStatus({ phase: 'loading', progress: 0, usingAi: false });
    void analyzer.warmUp().then((ok) => {
      setStatus({ phase: ok ? 'ready' : 'failed', progress: ok ? 1 : 0, usingAi: ok });
    });

    return analyzer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    boot();
    return () => {
      analyzerRef.current?.dispose();
      analyzerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boot, nonce]);

  const analyze = useCallback(
    async (text: string, history: readonly string[] = []): Promise<T> => {
      const analyzer = analyzerRef.current ?? boot();
      const reading = await analyzer.analyze(text, history);
      setStatus((current) => ({ ...current, usingAi: analyzer.kind === 'ai' }));
      return reading;
    },
    [boot],
  );

  const retry = useCallback((): void => {
    analyzerRef.current?.dispose();
    analyzerRef.current = null;
    setNonce((value) => value + 1);
    boot();
  }, [boot]);

  return { status, analyze, retry };
}
