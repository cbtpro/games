import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import { easeInOutQuad, easeOutCubic, tendrilPathAt, buildTendril, cubicPoint } from '../domain/bezier';
import type { Point, SpiderPhase, WordItem } from '../domain/types';

/**
 * 蜘蛛的一帧姿态。
 * 引擎只算数，组件只负责把数字画到 DOM 上 —— 避免每帧触发 React reconcile。
 */
export interface SpiderFrame {
  x: number;
  y: number;
  /** 朝向（度），0 度朝上 */
  angle: number;
  /** 步态相位 */
  legPhase: number;
  moving: boolean;
  chewing: boolean;
  /** 螯肢路径（最多两条），由 TendrilLayer 直接写进 <path d> */
  tendrils: string[];
}

export interface SpiderEngineApi {
  subscribe: (listener: (frame: SpiderFrame) => void) => () => void;
  reset: () => void;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 抵达这个距离后伸出螯肢 */
const GRAB_DISTANCE = 44;
const WANDER_MIN_MS = 900;
const WANDER_MAX_MS = 2100;

export interface UseSpiderEngineOptions {
  fieldRef: RefObject<HTMLElement>;
  wordRefs: MutableRefObject<Map<string, HTMLElement>>;
  itemsRef: MutableRefObject<WordItem[]>;
  /** 父应用生命周期控制：running=已开局，active=在前台 */
  running: boolean;
  active: boolean;
  speed: number;
  onEat: (item: WordItem) => void;
  onReject: (item: WordItem) => void;
  onPhase?: (phase: SpiderPhase) => void;
}

/**
 * 蜘蛛的行为引擎。
 *
 * 三条主线彼此独立，互不阻塞：
 *   1. rAF 主循环 —— 位置、朝向、步态，并把帧数据广播给订阅者；
 *   2. 觅食决策 —— 挑最有价值的一条去查看；
 *   3. 抓取协程 —— 克隆 DOM、沿贝塞尔曲线拖回、吞噬，全程可被 unmount 打断。
 */
export function useSpiderEngine(options: UseSpiderEngineOptions): SpiderEngineApi {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const listeners = useRef(new Set<(frame: SpiderFrame) => void>());
  const rectCache = useRef(new Map<string, Rect>());
  const frameId = useRef<number | null>(null);
  const pendingFrames = useRef(new Set<number>());
  const lastTs = useRef(0);
  const disposed = useRef(false);

  /** 内部运动状态，全程用 ref 承载，不进 React state */
  const body = useRef({ x: 60, y: 60, angle: 0, legPhase: 0, targetAngle: 0 });
  const mode = useRef<'wander' | 'seek' | 'idle'>('wander');
  const phaseRef = useRef<SpiderPhase>('idle');
  const waypoint = useRef<Point>({ x: 60, y: 60 });
  const wanderDue = useRef(0);
  const targetId = useRef<string | null>(null);
  const chewUntil = useRef(0);

  const frame = useRef<SpiderFrame>({
    x: 60,
    y: 60,
    angle: 0,
    legPhase: 0,
    moving: false,
    chewing: false,
    tendrils: [],
  });

  useEffect(() => {
    disposed.current = false;
    return () => {
      disposed.current = true;
      stopLoop();
      pendingFrames.current.forEach((id) => cancelAnimationFrame(id));
      pendingFrames.current.clear();
      listeners.current.clear();
      rectCache.current.clear();
    };
  }, []);

  // ---------------------------------------------------------------- 工具

  function emit(): void {
    const snapshot = { ...frame.current, tendrils: [...frame.current.tendrils] };
    listeners.current.forEach((listener) => listener(snapshot));
  }

  function setTendrils(paths: string[]): void {
    frame.current = { ...frame.current, tendrils: paths };
    emit();
  }

  function setPhase(next: SpiderPhase): void {
    phaseRef.current = next;
    optionsRef.current.onPhase?.(next);
  }

  function fieldSize(): { width: number; height: number } {
    const el = optionsRef.current.fieldRef.current;
    return { width: el?.clientWidth ?? 800, height: el?.clientHeight ?? 480 };
  }

  /** 相对场地坐标系测量某个词条的位置（带缓存，窗口尺寸变化时失效） */
  function measureWord(id: string): Rect | null {
    const cached = rectCache.current.get(id);
    if (cached) return cached;

    const el = optionsRef.current.wordRefs.current.get(id);
    const field = optionsRef.current.fieldRef.current;
    if (!el || !field) return null;

    const rect = el.getBoundingClientRect();
    const origin = field.getBoundingClientRect();
    const measured: Rect = {
      left: rect.left - origin.left,
      top: rect.top - origin.top,
      width: rect.width,
      height: rect.height,
    };
    rectCache.current.set(id, measured);
    return measured;
  }

  function wordCenter(id: string): Point | null {
    const rect = measureWord(id);
    if (!rect) return null;
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  /** 螯肢根部在场地坐标系里的位置（身体前方左右各一） */
  function forelimbRoots(): [Point, Point] {
    const { x, y, angle } = frame.current;
    const rad = ((angle - 90) * Math.PI) / 180;
    const forward = { x: Math.cos(rad), y: Math.sin(rad) };
    const side = { x: -forward.y, y: forward.x };
    const reach = 16;
    const splay = 9;
    return [
      { x: x + forward.x * reach + side.x * splay, y: y + forward.y * reach + side.y * splay },
      { x: x + forward.x * reach - side.x * splay, y: y + forward.y * reach - side.y * splay },
    ];
  }

  /** 可以被放进 rAF 的补间，组件卸载后自动停手 */
  function tween(duration: number, apply: (t: number) => void): Promise<void> {
    return new Promise<void>((resolve) => {
      const started = performance.now();
      const step = (now: number): void => {
        if (disposed.current) return resolve();
        const raw = Math.min(1, (now - started) / duration);
        apply(raw);
        if (raw < 1) {
          const id = requestAnimationFrame(step);
          pendingFrames.current.delete(id);
          pendingFrames.current.add(id);
        } else {
          resolve();
        }
      };
      const first = requestAnimationFrame(step);
      pendingFrames.current.add(first);
    });
  }

  // ---------------------------------------------------------------- 主循环

  function pickWaypoint(): void {
    const { width, height } = fieldSize();
    waypoint.current = {
      x: 40 + Math.random() * Math.max(1, width - 80),
      y: 40 + Math.random() * Math.max(1, height - 80),
    };
  }

  /** 从场上挑一条最值得去的目标：先看价值，再看距离 */
  function pickTarget(): WordItem | null {
    const { x, y } = frame.current;
    const candidates = optionsRef.current.itemsRef.current;
    if (candidates.length === 0) return null;

    return [...candidates].sort((left, right) => {
      const scoreDiff = right.verdict.score - left.verdict.score;
      if (Math.abs(scoreDiff) > 12) return scoreDiff;
      const dl = Math.hypot(left.x - x, left.y - y);
      const dr = Math.hypot(right.x - x, right.y - y);
      return dl - dr;
    })[0] ?? null;
  }

  function step(dt: number): void {
    const { width, height } = fieldSize();
    const bodyRef = body.current;

    // 没开局就原地待命
    if (!optionsRef.current.running) {
      mode.current = 'idle';
      setPhase('idle');
      frame.current = { ...frame.current, moving: false };
      return;
    }

    if (mode.current !== 'seek') {
      const next = pickTarget();
      if (next) {
        targetId.current = next.id;
        mode.current = 'seek';
        setPhase('seek');
      } else {
        mode.current = 'wander';
        if (phaseRef.current !== 'wander') setPhase('wander');
      }
    }

    let aim: Point;
    if (mode.current === 'seek' && targetId.current) {
      const center = wordCenter(targetId.current);
      if (!center) {
        targetId.current = null;
        mode.current = 'wander';
        aim = waypoint.current;
      } else {
        aim = center;
      }
    } else {
      if (performance.now() >= wanderDue.current) {
        pickWaypoint();
        wanderDue.current = performance.now() + WANDER_MIN_MS + Math.random() * (WANDER_MAX_MS - WANDER_MIN_MS);
      }
      aim = waypoint.current;
    }

    const dx = aim.x - bodyRef.x;
    const dy = aim.y - bodyRef.y;
    const distance = Math.hypot(dx, dy);
    const baseSpeed = optionsRef.current.speed;
    const speed = mode.current === 'seek' ? baseSpeed * 1.35 : baseSpeed;
    const stepLength = speed * dt;
    const stopAt = mode.current === 'seek' ? GRAB_DISTANCE : 1.5;

    if (distance > stopAt) {
      const ratio = Math.min(1, stepLength / distance);
      bodyRef.x += dx * ratio;
      bodyRef.y += dy * ratio;
      bodyRef.legPhase += dt * 0.012 * (mode.current === 'seek' ? 1.5 : 1);
      frame.current = { ...frame.current, moving: true };
    } else {
      frame.current = { ...frame.current, moving: false };
    }

    // 靠近到可以下嘴的距离 -> 进入抓取协程
    if (mode.current === 'seek' && targetId.current && distance <= GRAB_DISTANCE + 1) {
      const item = optionsRef.current.itemsRef.current.find((entry) => entry.id === targetId.current);
      targetId.current = null;
      mode.current = 'wander';
      wanderDue.current = performance.now() + 400;
      if (item) {
        const edible = item.verdict.edible && item.verdict.grade !== 'junk';
        void (edible ? devour(item) : taste(item));
      }
    }

    if (optionsRef.current.running) {
      const targetAngle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      let delta = ((targetAngle - bodyRef.angle + 540) % 360) - 180;
      bodyRef.angle += delta * Math.min(1, dt * 0.012);
    }

    frame.current = {
      ...frame.current,
      x: bodyRef.x,
      y: bodyRef.y,
      angle: bodyRef.angle,
      legPhase: bodyRef.legPhase,
      chewing: performance.now() < chewUntil.current,
    };

    // 身体不许爬出场地
    bodyRef.x = Math.max(28, Math.min(width - 28, bodyRef.x));
    bodyRef.y = Math.max(28, Math.min(height - 28, bodyRef.y));
    frame.current = { ...frame.current, x: bodyRef.x, y: bodyRef.y };
  }

  function tick(now: number): void {
    if (disposed.current) return;
    const dt = lastTs.current === 0 ? 16 : Math.min(48, now - lastTs.current);
    lastTs.current = now;

    if (optionsRef.current.active) step(dt);
    emit();

    frameId.current = requestAnimationFrame(tick);
  }

  function startLoop(): void {
    if (frameId.current !== null) return;
    lastTs.current = 0;
    frameId.current = requestAnimationFrame(tick);
  }

  function stopLoop(): void {
    if (frameId.current !== null) {
      cancelAnimationFrame(frameId.current);
      frameId.current = null;
    }
  }

  useEffect(() => {
    rectCache.current.clear();
    const field = optionsRef.current.fieldRef.current;
    if (!field || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => rectCache.current.clear());
    observer.observe(field);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (options.running || options.active) startLoop();
    else stopLoop();
    return undefined;
  }, [options.running, options.active]);

  // ---------------------------------------------------------------- 抓取

  /** 克隆 DOM 后立刻销毁原节点，后续动画只操作克隆体 */
  function clonePrey(item: WordItem): { node: HTMLElement | null; center: Point } | null {
    const rect = measureWord(item.id);
    const source = optionsRef.current.wordRefs.current.get(item.id);
    if (!rect || !source) return null;

    const clone = source.cloneNode(true) as HTMLElement;
    clone.classList.add('sp-prey-clone');
    clone.removeAttribute('data-word-id');
    Object.assign(clone.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      margin: '0',
      transform: 'translate(0, 0)',
      animation: 'none',
      opacity: '1',
    });

    const layer = optionsRef.current.fieldRef.current?.querySelector<HTMLElement>('.sp-grasp-layer');
    layer?.appendChild(clone);

    // 原来的直接销毁
    rectCache.current.delete(item.id);
    optionsRef.current.wordRefs.current.delete(item.id);

    return { node: clone, center: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } };
  }

  async function devour(item: WordItem): Promise<void> {
    setPhase('grasp');
    const grabbed = clonePrey(item);
    if (!grabbed || !grabbed.node) {
      optionsRef.current.onEat(item);
      setPhase('wander');
      return;
    }

    const { node, center } = grabbed;
    const roots = forelimbRoots();
    optionsRef.current.onEat(item);

    // 1. 螯肢伸出
    await tween(360, (raw) => {
      const t = easeOutCubic(raw);
      setTendrils(
        roots.map((root, index) => tendrilPathAt(root, center, t, index === 0 ? 0.3 : -0.3)),
      );
    });

    node.classList.add('is-caught');

    // 2. 沿曲线拖回嘴里
    const [root] = forelimbRoots();
    const curve = buildTendril(root, center, 0.3);
    await tween(560, (raw) => {
      const t = easeInOutQuad(raw);
      const spot = cubicPoint(curve.p0, curve.p1, curve.p2, curve.p3, 1 - t);
      const scale = 1 - t * 0.72;
      node.style.transform = `translate(${spot.x - center.x}px, ${spot.y - center.y}px) scale(${scale})`;
      node.style.opacity = `${1 - t * 0.25}`;
      const current = forelimbRoots();
      setTendrils(
        current.map((hip, index) =>
          tendrilPathAt(hip, spot, 1, index === 0 ? 0.3 : -0.3),
        ),
      );
    });

    // 3. 吞下去
    chewUntil.current = performance.now() + 420;
    await tween(240, (raw) => {
      node.style.transform = `translate(${root.x - center.x}px, ${root.y - center.y}px) scale(${0.28 * (1 - raw)})`;
      node.style.opacity = `${0.75 * (1 - raw)}`;
    });

    node.remove();
    setTendrils([]);
    setPhase('wander');
  }

  async function taste(item: WordItem): Promise<void> {
    setPhase('grasp');
    const grabbed = clonePrey(item);
    if (!grabbed || !grabbed.node) {
      optionsRef.current.onReject(item);
      setPhase('wander');
      return;
    }

    const { node, center } = grabbed;
    const roots = forelimbRoots();

    await tween(300, (raw) => {
      const t = easeOutCubic(raw);
      setTendrils(roots.map((root, index) => tendrilPathAt(root, center, t, index === 0 ? 0.28 : -0.28)));
    });

    node.classList.add('is-spurned');

    // 嫌弃地甩头
    await tween(320, (raw) => {
      const shake = Math.sin(raw * Math.PI * 4) * 6;
      node.style.transform = `translate(${shake}px, 0) rotate(${shake * 0.4}deg)`;
      setTendrils(roots.map((root, index) => tendrilPathAt(root, center, 1, index === 0 ? 0.28 : -0.28)));
    });

    await tween(320, (raw) => {
      node.style.transform = `translate(${raw * 40}px, ${raw * 60}px) scale(${1 - raw * 0.5})`;
      node.style.opacity = `${1 - raw}`;
      const current = forelimbRoots();
      const origin = { x: center.x + raw * 40, y: center.y + raw * 60 };
      setTendrils(current.map((hip, index) => tendrilPathAt(hip, origin, 1 - raw, index === 0 ? 0.28 : -0.28)));
    });

    node.remove();
    setTendrils([]);
    optionsRef.current.onReject(item);
    setPhase('wander');
  }

  // ---------------------------------------------------------------- 对外 API

  const api = useMemo<SpiderEngineApi>(
    () => ({
      subscribe(listener) {
        listeners.current.add(listener);
        listener({ ...frame.current, tendrils: [...frame.current.tendrils] });
        return () => listeners.current.delete(listener);
      },
      reset() {
        stopLoop();
        rectCache.current.clear();
        targetId.current = null;
        mode.current = 'wander';
        chewUntil.current = 0;
        const { width, height } = fieldSize();
        body.current = { x: width / 2, y: height / 2, angle: 0, legPhase: 0, targetAngle: 0 };
        frame.current = { x: width / 2, y: height / 2, angle: 0, legPhase: 0, moving: false, chewing: false, tendrils: [] };
        setPhase('idle');
        emit();
        startLoop();
      },
    }),
    [],
  );

  return api;
}
