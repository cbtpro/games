import { useEffect, useRef, useState } from 'react';
import { useFullscreen, useGame } from '@games/sdk';
import { GAME_EVENTS } from '@games/shared';

/** 状态码 -> 中文徽标文案 */
const STATE_LABEL: Record<string, string> = {
  idle: '未就绪',
  initializing: '初始化中',
  initialized: '已就绪',
  mounting: '挂载中',
  mounted: '已挂载',
  activated: '已激活',
  deactivated: '已挂起',
  running: '游戏中',
  paused: '已暂停',
  over: '已结束',
  destroying: '销毁中',
  destroyed: '已销毁',
};

interface LogItem {
  id: number;
  time: string;
  label: string;
}

/**
 * 模板 UI：把每个生命周期都做成了可点击的按钮 + 时间线回显。
 * 新游戏把这块换成自己的玩法即可，生命周期机制不用动。
 */
export default function App(): JSX.Element {
  const ctx = useGame();
  const { config } = ctx;

  const rootRef = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen(rootRef);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(ctx.store.get<number>('lives') ?? 3);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogItem[]>([]);
  const [state, setState] = useState(ctx.state);

  // 子应用内部也能监听自己的生命周期事件（ctx.bus 是内部总线）
  useEffect(
    () =>
      ctx.bus.on((event) => {
        setState(event.state);
        if (event.phase !== 'after' || event.type === GAME_EVENTS.STATE_CHANGE) return;

        switch (event.type) {
          case GAME_EVENTS.START:
          case GAME_EVENTS.RESUME:
          case GAME_EVENTS.RESTART:
            setRunning(true);
            break;
          case GAME_EVENTS.PAUSE:
          case GAME_EVENTS.DEACTIVATE:
          case GAME_EVENTS.END:
          case GAME_EVENTS.OVER:
            setRunning(false);
            break;
          case GAME_EVENTS.DEATH:
            setRunning(false);
            setLives(ctx.store.get<number>('lives') ?? 0);
            break;
          default:
            break;
        }

        if (event.type === GAME_EVENTS.RESTART) {
          setScore(0);
          setLives(ctx.store.get<number>('lives') ?? 3);
        }

        setLog((prev) => {
          const time = new Date(event.timestamp).toLocaleTimeString('zh-CN', { hour12: false });
          return [{ id: event.timestamp, time, label: event.label }, ...prev].slice(0, 40);
        });
      }),
    [ctx],
  );

  // 演示一个会被 onUnmount 清理的定时器
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setScore((value) => {
        const next = value + 1;
        ctx.store.set('score', next);
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [running, ctx]);

  const addScore = (delta: number): void => {
    setScore((value) => {
      const next = value + delta;
      ctx.store.set('score', next);
      ctx.reportScore({ score: next, mode: 'total' });
      return next;
    });
  };

  const stateLabel = STATE_LABEL[state] ?? state;

  return (
    <div
      className="template-game"
      data-theme={config.theme ?? 'light'}
      data-fullscreen={fullscreen.isFullscreen || undefined}
      ref={rootRef}
    >
      <header className="tg-hero">
        <div className="tg-hero__meta">
          <div className="tg-hero__title">
            <span className="tg-badge" data-tone={state}>
              {stateLabel}
            </span>
            <h2>{config.playerName ?? '游客'}的对局</h2>
          </div>
          <p>
            难度 {config.difficulty ?? 'normal'} · 会话 {String(config.sessionId).slice(0, 8)}
          </p>
        </div>
        <div className="tg-stats">
          <div className="tg-stat tg-stat--score">
            <span>分数</span>
            <strong>{score}</strong>
          </div>
          <div className="tg-stat">
            <span>生命</span>
            <strong className="tg-hearts">{'♥'.repeat(Math.max(0, lives)) || '—'}</strong>
          </div>
        </div>
      </header>

      <div className="tg-actions">
        <button className="tg-btn tg-btn--primary" onClick={() => void ctx.start()} disabled={running}>
          开始
        </button>
        <button className="tg-btn" onClick={() => void ctx.pause('user')} disabled={!running}>
          暂停
        </button>
        <button className="tg-btn tg-btn--primary" onClick={() => void ctx.resume()} disabled={running}>
          继续
        </button>
        <button className="tg-btn" onClick={() => void ctx.restart()}>
          重开
        </button>
        <button className="tg-btn tg-btn--accent" onClick={() => addScore(5)}>
          +5 分
        </button>
        <button className="tg-btn tg-btn--danger" onClick={() => void ctx.die({ reason: 'manual' })}>
          死亡
        </button>
        <button
          className="tg-btn tg-btn--danger"
          onClick={() => void ctx.finish({ score, won: score > 20, reason: 'quit', durationMs: 0 })}
        >
          结束
        </button>
        {fullscreen.isSupported && (
          <button
            className="tg-btn tg-btn--ghost"
            onClick={() => void fullscreen.toggle()}
            aria-pressed={fullscreen.isFullscreen}
            title={fullscreen.isFullscreen ? '退出全屏（Esc）' : '全屏游玩'}
          >
            <svg viewBox="0 0 16 16" aria-hidden focusable="false">
              {fullscreen.isFullscreen ? (
                <path
                  d="M6.5 2.5v3h-3M9.5 2.5v3h3M6.5 13.5v-3h-3M9.5 13.5v-3h3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M2.5 6v-3.5H6M13.5 6V2.5H10M2.5 10v3.5H6M13.5 10v3.5H10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              )}
            </svg>
            {fullscreen.isFullscreen ? '退出全屏' : '全屏'}
          </button>
        )}
      </div>

      <div className="tg-body">
        <section className="tg-panel">
          <header className="tg-panel__head">
            <h3>父应用传入的参数</h3>
            <span className="tg-panel__tag">JSON</span>
          </header>
          <pre>{JSON.stringify(config, null, 2)}</pre>
        </section>

        <section className="tg-panel">
          <header className="tg-panel__head">
            <h3>本游戏触发的生命周期</h3>
            <span className="tg-panel__count">{log.length}</span>
          </header>
          {log.length === 0 ? (
            <p className="tg-empty">还没有事件 —— 点上面的按钮试试</p>
          ) : (
            <ol className="tg-timeline">
              {log.map((item, index) => (
                <li key={`${item.id}-${index}`} className={index === 0 ? 'is-latest' : undefined}>
                  <span className="tg-timeline__dot" aria-hidden />
                  <time>{item.time}</time>
                  <span className="tg-timeline__label">{item.label}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
