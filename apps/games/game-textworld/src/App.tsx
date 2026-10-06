import { useFullscreen, useGame } from '@games/sdk';
import { GAME_EVENTS } from '@games/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TextWorld } from './core/TextWorld';
import { getWorldHeight, getWorldWidth, type LayoutMode } from './core/types';
import { CanvasView } from './demo/CanvasView';
import { InputPanel, type InputPanelHandle } from './demo/InputPanel';
import { CanvasTextMeasure } from './renderer/Renderer';
import { MOOD_LABEL } from './core/mood';

const DEMO_SENTENCES = [
  '你好',
  '今天的天气非常不错',
  '我刚才突然想到一个非常有意思的问题',
  '为什么',
  '如果所有文字都可以不断生长',
  '那最终是不是可以形成一整个文字世界',
  '等等',
  '这个方向好像不太对',
  '我们换一个方向试试看',
  '原来如此',
  '这句话故意写得非常非常非常非常非常非常非常非常长用来测试旋转逻辑',
  '继续',
  '下一句',
  '再来一句',
];

/** 文字世界界面，统一接收文本和语音输入，并管理布局、演示和调试状态。 */
export default function App(): JSX.Element {
  const ctx = useGame();

  const rootRef = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen(rootRef);
  const [mobile, setMobile] = useState(
    () =>
      window.matchMedia('(max-width: 760px), (pointer: coarse) and (max-height: 520px)').matches,
  );
  const [mobileStarted, setMobileStarted] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [controlsTarget, setControlsTarget] = useState<HTMLDivElement | null>(null);
  const [voiceStatus, setVoiceStatus] = useState('');
  const inputRef = useRef<InputPanelHandle>(null);
  useEffect(() => {
    const query = window.matchMedia(
      '(max-width: 760px), (pointer: coarse) and (max-height: 520px)',
    );
    const update = () => setMobile(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const [world, setWorld] = useState<TextWorld | null>(null);
  const worldRef = useRef<TextWorld | null>(null);
  const [running, setRunning] = useState(false);
  const [autoDemo, setAutoDemo] = useState(false);
  const [debug, setDebug] = useState(false);
  const [error, setError] = useState('');
  const demoIndex = useRef(0);
  /** 世界结构变化时 +1，用来刷新右上角统计 */
  const [, setRevision] = useState(0);
  /** 布局方式：螺旋并排 or 矩形树图平铺（类似 webpack 依赖分析图，互不重叠）。切换即重建世界 */
  const [mode, setMode] = useState<LayoutMode>('spiral');
  const modeRef = useRef<LayoutMode>('spiral');
  /** 拿到真实字体的 ctx，重建世界时复用，避免再等一次 onReady */
  const canvasCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const startedRef = useRef(false);

  worldRef.current = world;

  const buildWorld = useCallback(
    (m: LayoutMode): TextWorld =>
      new TextWorld({
        measure: canvasCtxRef.current ? new CanvasTextMeasure(canvasCtxRef.current) : undefined,
        layout: { mode: m },
      }),
    [],
  );

  const switchMode = useCallback(
    (m: LayoutMode): void => {
      if (m === modeRef.current) return;
      modeRef.current = m;
      setMode(m);
      setAutoDemo(false);
      setError('');
      setWorld(buildWorld(m));
      setRevision((value) => value + 1);
      setRunning(true);
    },
    [buildWorld],
  );

  // 宿主的 start 可能早于 React 订阅事件，这里补一次，保证独立调试也直接开跑
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void ctx.start();
  }, [ctx]);

  useEffect(
    () =>
      ctx.bus.on((event) => {
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
          case GAME_EVENTS.DEATH:
            setRunning(false);
            break;
          default:
            break;
        }

        if (event.type === GAME_EVENTS.RESTART) {
          worldRef.current?.clear();
          setAutoDemo(false);
          demoIndex.current = 0;
          setError('');
          setRevision((value) => value + 1);
        }
      }),
    [ctx],
  );

  const handleReady = useCallback(
    (canvasCtx: CanvasRenderingContext2D): void => {
      // 文字尺寸必须靠真实字体度量，因此世界要等到拿到 ctx 才创建
      canvasCtxRef.current = canvasCtx;
      setWorld(buildWorld(modeRef.current));
    },
    [buildWorld],
  );

  const submit = useCallback(
    (text: string): boolean => {
      const current = worldRef.current;
      if (!current) return false;
      if (!current.append(text)) {
        if (text.trim()) {
          setError('暂时找不到安全位置，请重开后重试。');
          setAutoDemo(false);
        }
        return false;
      }
      setError('');

      setRevision((value) => value + 1);
      ctx.store.set('blocks', current.size);
      ctx.reportScore({ score: current.size, mode: 'total' });
      return true;
    },
    [ctx],
  );

  const reset = useCallback((): void => {
    setAutoDemo(false);
    demoIndex.current = 0;
    setError('');
    worldRef.current?.clear();
    setRevision((value) => value + 1);
    void ctx.restart();
  }, [ctx]);

  useEffect(() => {
    if (!autoDemo || !running || !world) return;
    const timer = window.setInterval(() => {
      submit(DEMO_SENTENCES[demoIndex.current % DEMO_SENTENCES.length]);
      demoIndex.current += 1;
    }, 900);
    return () => window.clearInterval(timer);
  }, [autoDemo, running, world, submit]);

  const size = world?.size ?? 0;
  const bounds = world?.bounds;
  const last = size > 0 ? world?.blocks[size - 1] : undefined;

  const input = (
    <InputPanel
      ref={inputRef}
      mobile={mobile}
      onVoiceStatus={setVoiceStatus}
      onSubmit={submit}
      disabled={!running || !world}
      count={size}
    />
  );
  return (
    <div
      data-mobile={mobile || undefined}
      className="tw-app"
      ref={rootRef}
      data-fullscreen={fullscreen.isFullscreen || undefined}
    >
      {mobile && (
        <button
          className="tw-menu-toggle tw-btn"
          aria-expanded={panelOpen}
          aria-controls="tw-mobile-panel"
          disabled={!mobileStarted}
          onClick={() => setPanelOpen(!panelOpen)}
        >
          {panelOpen ? '收起操作' : '操作 ☰'}
        </button>
      )}
      <div
        id="tw-mobile-panel"
        className={mobile ? 'tw-mobile-panel' : 'tw-desktop-panel'}
        data-open={panelOpen || undefined}
        hidden={mobile && !panelOpen}
      >
        <header className="tw-hud">
          <div className="tw-hud__meta">
            <div className="tw-hud__title">
              <h2>文字世界</h2>
              <span className="tw-badge" data-running={running}>
                {running ? '生长中' : '已暂停'}
              </span>
            </div>
            <p>
              输入一句话，按 Enter
              添加。文字按空间贪心堆叠，优先填补内部空白，每句使用独立随机动画。相机平滑跟随最新内容。
            </p>
          </div>

          <div className="tw-hud__right">
            <dl className="tw-stats">
              <div>
                <dt>句数</dt>
                <dd>{size}</dd>
              </div>
              <div>
                <dt>世界</dt>
                <dd>
                  {bounds
                    ? `${Math.round(getWorldWidth(bounds))}×${Math.round(getWorldHeight(bounds))}`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>布局</dt>
                <dd>{world ? (world.layoutMode === 'graph' ? '图谱' : '螺旋') : '—'}</dd>
              </div>
              <div>
                <dt>情绪</dt>
                <dd style={last ? { color: last.font.color } : undefined}>
                  {last ? MOOD_LABEL[last.mood] : '—'}
                </dd>
              </div>
            </dl>
            <div className="tw-layout-toggle" role="group" aria-label="布局方式">
              <button
                type="button"
                className={mode === 'spiral' ? 'is-active' : ''}
                aria-pressed={mode === 'spiral'}
                onClick={() => switchMode('spiral')}
              >
                螺旋
              </button>
              <button
                type="button"
                className={mode === 'graph' ? 'is-active' : ''}
                aria-pressed={mode === 'graph'}
                onClick={() => switchMode('graph')}
              >
                图谱
              </button>
            </div>
            <button
              className="tw-btn"
              disabled={!running || !world}
              aria-pressed={autoDemo}
              onClick={() => setAutoDemo(!autoDemo)}
            >
              {autoDemo ? '停止 Auto Demo' : 'Auto Demo'}
            </button>
            <button className="tw-btn" aria-pressed={debug} onClick={() => setDebug(!debug)}>
              Debug
            </button>
            <button className="tw-btn" onClick={reset}>
              重开
            </button>
            {fullscreen.isSupported && (
              <button
                className="tw-btn tw-btn--ghost"
                onClick={() => void fullscreen.toggle()}
                aria-pressed={fullscreen.isFullscreen}
              >
                {fullscreen.isFullscreen ? '退出全屏' : '全屏'}
              </button>
            )}
          </div>
        </header>
        {mobile && (
          <>
            <button className="tw-btn" onClick={() => void (running ? ctx.pause() : ctx.resume())}>
              {running ? '暂停' : '继续'}
            </button>
            <div className="tw-mobile-camera" ref={setControlsTarget} />
            {input}
          </>
        )}
      </div>

      {debug && (
        <p className="tw-debug" role="status">
          Direction: {last?.direction ?? 'BOTTOM'} · Rotation: {last?.rotation ?? 0}° · Blocks:{' '}
          {size} · Animation: {last?.animation.preset ?? '—'}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <CanvasView
        world={world}
        running={running && (!mobile || mobileStarted)}
        debug={debug}
        autoDemo={autoDemo}
        onReady={handleReady}
        controlsTarget={mobile ? controlsTarget : null}
        mobile={mobile}
      />

      {mobile && mobileStarted && (
        <div className="tw-mobile-status" role="status">
          {voiceStatus}
        </div>
      )}
      {!mobile && input}
      {mobile && !mobileStarted && (
        <div className="tw-start-backdrop">
          <section
            className="tw-start-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tw-start-title"
            onKeyDown={(event) => {
              if (event.key !== 'Tab') return;
              const buttons = Array.from(
                event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
              );
              const first = buttons[0],
                last = buttons[buttons.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
              }
              if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
              }
            }}
          >
            <h2 id="tw-start-title">用声音，让文字生长</h2>
            <p>说一句话，文字就会落入世界。支持拖动与缩放，入场结束后自动展示全景。</p>
            <p>
              点击开始会启用语音并请求麦克风权限；不支持语音时，可在操作面板使用示例句或 Auto Demo。
            </p>
            <div className="tw-layout-toggle" role="group" aria-label="开始布局">
              <button aria-pressed={mode === 'spiral'} onClick={() => switchMode('spiral')}>
                螺旋堆叠
              </button>
              <button aria-pressed={mode === 'graph'} onClick={() => switchMode('graph')}>
                图谱
              </button>
            </div>
            <button
              autoFocus
              className="tw-btn tw-btn--primary"
              disabled={!world}
              onClick={() => {
                inputRef.current?.startVoice();
                setMobileStarted(true);
                setRunning(true);
                if (fullscreen.isSupported && !fullscreen.isFullscreen)
                  void fullscreen.toggle().catch(() => {});
              }}
            >
              开始 · 语音输入
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
