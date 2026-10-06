import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import type { Camera } from '../core/Camera';
import { CameraController } from '../core/CameraController';
import type { TextWorld } from '../core/TextWorld';
import { CanvasRenderer } from '../renderer/CanvasRenderer';

/** 画布视图，负责渲染循环、视口尺寸和相机交互。布局由核心引擎计算。 */

export interface CanvasViewProps {
  world: TextWorld | null;
  /** 暂停时冻结动画，但仍然保持画面 */
  running?: boolean;
  debug?: boolean;
  autoDemo?: boolean;
  controlsTarget?: HTMLElement | null;
  mobile?: boolean;
  /** 拿到 ctx 后回调一次，用来创建依赖真实字体度量的 TextWorld */
  onReady: (ctx: CanvasRenderingContext2D) => void;
  onCamera?: (camera: Camera) => void;
}

export function CanvasView({
  world,
  running = true,
  debug = false,
  autoDemo = false,
  controlsTarget = null,
  mobile = false,
  onReady,
  onCamera,
}: CanvasViewProps): JSX.Element {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef(new CameraController());
  const rendererRef = useRef(new CanvasRenderer());
  const worldRef = useRef<TextWorld | null>(world);
  const runningRef = useRef(running);
  const debugRef = useRef(debug);
  const autoDemoRef = useRef(autoDemo);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  /** 画布是否自动旋转，让最新一句保持水平 */
  const [spin, setSpin] = useState(true);
  const [overview, setOverview] = useState(false);
  const overviewRef = useRef(false);
  overviewRef.current = overview;
  const [angle, setAngle] = useState(0);
  const angleRef = useRef(0);

  worldRef.current = world;
  runningRef.current = running;
  debugRef.current = debug;
  autoDemoRef.current = autoDemo;

  useEffect(() => {
    cameraRef.current.setAutoSpin(spin);
  }, [spin]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const viewport = { width: wrap.clientWidth, height: wrap.clientHeight };
    let dpr = Math.min(2, window.devicePixelRatio || 1);

    const resize = (): void => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      viewport.width = wrap.clientWidth;
      viewport.height = wrap.clientHeight;
      canvas.width = Math.max(1, Math.round(viewport.width * dpr));
      canvas.height = Math.max(1, Math.round(viewport.height * dpr));
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
    };
    resize();

    onReady(ctx);

    const observer = new ResizeObserver(resize);
    observer.observe(wrap);

    let frame = 0;
    let last = performance.now();
    let observedWorld: TextWorld | null = null;
    let resetVersion = -1;
    let latestId: string | undefined;
    let pendingOverview = false;

    const loop = (now: number): void => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      const current = worldRef.current;
      if (current) {
        if (current !== observedWorld || current.resetVersion !== resetVersion) {
          observedWorld = current;
          resetVersion = current.resetVersion;
          pendingOverview = false;
          latestId = undefined;
          cameraRef.current.reset();
          setSpin(true);
          setOverview(false);
          overviewRef.current = false;
          zoomRef.current = 1;
          angleRef.current = 0;
          setZoom(1);
          setAngle(0);
        }

        const nextLatestId = current.layout.lastBlock?.id;
        if (nextLatestId !== latestId) {
          latestId = nextLatestId;
          pendingOverview = nextLatestId !== undefined;
          cameraRef.current.resumeFollow();
          overviewRef.current = false;
          setOverview(false);
        }
        if (runningRef.current) current.update(current.time + dt * 1000);
        if (
          pendingOverview &&
          !autoDemoRef.current &&
          runningRef.current &&
          current.blocks.every((block) => block.animation.done)
        ) {
          pendingOverview = false;
          cameraRef.current.resumeFollow();
          cameraRef.current.setAutoSpin(true);
          setSpin(true);
          overviewRef.current = true;
          setOverview(true);
        }
        if (!current.isEmpty) {
          cameraRef.current.follow(
            current.bounds,
            viewport,
            dt,
            overviewRef.current ? 0 : current.frontierRotation,
            !overviewRef.current ? (current.layout.lastBlock ?? undefined) : undefined,
            current.blocks,
          );
        }
        rendererRef.current.render(
          current,
          cameraRef.current.camera,
          { ctx, viewport, dpr, debug: debugRef.current },
          current.time,
        );
        onCamera?.(cameraRef.current.camera);
        // 缩放变化超过 1%、角度变化超过 1° 才刷新 UI，避免每帧都触发一次 React 渲染
        const nextZoom = cameraRef.current.camera.zoom;
        if (Math.abs(nextZoom - zoomRef.current) > 0.01) {
          zoomRef.current = nextZoom;
          setZoom(nextZoom);
        }
        const nextAngle = cameraRef.current.camera.rotation;
        if (Math.abs(nextAngle - angleRef.current) > 0.4) {
          angleRef.current = nextAngle;
          setAngle(nextAngle);
        }
      } else {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, viewport.width, viewport.height);
      }

      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
    // 画布初始化后调用一次 onReady。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------- 交互
  const drag = useRef<{ x: number; y: number } | null>(null);

  const touches = useRef(new Map<number, { x: number; y: number }>());
  const pinchDistance = useRef<number | null>(null);
  const zoomBy = (factor: number): void => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect)
      cameraRef.current.zoomAt(
        factor,
        { x: rect.width / 2, y: rect.height / 2 },
        { width: rect.width, height: rect.height },
      );
  };
  const tools = (
    <div className="tw-canvas__tools">
      {mobile && (
        <>
          <button className="tw-tool" aria-label="放大" onClick={() => zoomBy(1.2)}>
            ＋
          </button>
          <button className="tw-tool" aria-label="缩小" onClick={() => zoomBy(1 / 1.2)}>
            −
          </button>
        </>
      )}
      <button
        type="button"
        className="tw-tool"
        aria-pressed={overview}
        title="查看完整文字结构"
        onClick={() => {
          cameraRef.current.reset();
          setSpin(true);
          setOverview(!overview);
        }}
      >
        全景
      </button>
      <button
        type="button"
        className="tw-tool"
        title="逆时针转 90°（会停掉自动跟随）"
        aria-label="逆时针转 90 度"
        onClick={() => {
          cameraRef.current.rotateBy(-90);
          setSpin(cameraRef.current.autoSpin);
        }}
      >
        ⟲
      </button>
      <button
        type="button"
        className="tw-tool"
        title="顺时针转 90°（会停掉自动跟随）"
        aria-label="顺时针转 90 度"
        onClick={() => {
          cameraRef.current.rotateBy(90);
          setSpin(cameraRef.current.autoSpin);
        }}
      >
        ⟳
      </button>
      <button
        type="button"
        className="tw-tool"
        title="把最新的一句摆正（会停掉自动跟随）"
        onClick={() => {
          cameraRef.current.level(world?.frontierRotation ?? 0);
          setSpin(cameraRef.current.autoSpin);
        }}
      >
        转正
      </button>
      <button
        type="button"
        className="tw-tool tw-tool--toggle"
        aria-pressed={spin}
        title="自动旋转画布，让最新的一句始终水平（手动转过之后会自动关闭）"
        onClick={() => setSpin(!spin)}
      >
        跟随
      </button>
    </div>
  );
  return (
    <div className="tw-canvas" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="tw-canvas__el"
        onPointerDown={(event) => {
          touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          if (touches.current.size > 1) {
            const [a, b] = [...touches.current.values()];
            pinchDistance.current = Math.hypot(a.x - b.x, a.y - b.y);
            drag.current = null;
          } else drag.current = { x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!touches.current.has(event.pointerId)) return;
          touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          if (touches.current.size === 2) {
            const [a, b] = [...touches.current.values()];
            const distance = Math.hypot(a.x - b.x, a.y - b.y);
            const rect = event.currentTarget.getBoundingClientRect();
            if (pinchDistance.current && distance > 0)
              cameraRef.current.zoomAt(
                distance / pinchDistance.current,
                { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top },
                { width: rect.width, height: rect.height },
              );
            pinchDistance.current = distance;
            return;
          }
          if (!drag.current) return;
          cameraRef.current.panBy(event.clientX - drag.current.x, event.clientY - drag.current.y);
          drag.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={(event) => {
          touches.current.delete(event.pointerId);
          pinchDistance.current = null;
          drag.current = touches.current.size === 1 ? [...touches.current.values()][0] : null;
        }}
        onPointerCancel={() => {
          touches.current.clear();
          pinchDistance.current = null;
          drag.current = null;
        }}
        onWheel={(event) => {
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          cameraRef.current.zoomAt(
            event.deltaY < 0 ? 1.12 : 1 / 1.12,
            { x: event.clientX - rect.left, y: event.clientY - rect.top },
            { width: rect.width, height: rect.height },
          );
        }}
      />
      {world && world.isEmpty && (
        <div className="tw-canvas__empty">
          {mobile ? '说一句话，让文字落入世界' : '输入一句话，按 Enter 添加'}
        </div>
      )}
      {controlsTarget ? createPortal(tools, controlsTarget) : tools}
      <span className="tw-canvas__zoom">
        {Math.round(zoom * 100)}% · {Math.round(((angle % 360) + 360) % 360)}°
      </span>
    </div>
  );
}
