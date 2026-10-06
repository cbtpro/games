import { memo, useEffect, useRef } from 'react';
import type { SpiderFrame } from '../hooks/useSpiderEngine';
import type { MoodSpec } from '../domain/vitality';

/**
 * 一只用 SVG 画的八足蜘蛛。
 *
 * 只负责「把帧数据画出来」：位置、朝向直接写 style.transform，
 * 八条腿的关节坐标每帧重算后写进 <path d>。
 * 它不认识游戏逻辑，也不持有任何状态 —— 换一张皮不影响引擎。
 *
 * 情绪是纯展示属性：体色与头顶符号由 data-mood 驱动（见 styles.css），
 * 爬行速度由引擎按 mood.speedFactor 算出，组件自己不解释情绪。
 */

interface Leg {
  angle: number;
  reach: number;
  /** 步态分组：0 / 1 两组交替抬起，形成交替四足步态 */
  group: 0 | 1;
}

/** 局部坐标系里 Y 轴向下，蜘蛛朝 -Y（上方） */
const LEGS: readonly Leg[] = [
  { angle: -72, reach: 30, group: 0 },
  { angle: -36, reach: 35, group: 1 },
  { angle: 0, reach: 37, group: 0 },
  { angle: 36, reach: 33, group: 1 },
  { angle: 252, reach: 30, group: 1 },
  { angle: 216, reach: 35, group: 0 },
  { angle: 180, reach: 37, group: 1 },
  { angle: 144, reach: 33, group: 0 },
];

const HIP_RADIUS = 9;

/** 单条腿的二次贝塞尔路径：髋 -> 膝 -> 足尖 */
function legPath(leg: Leg, frame: SpiderFrame): string {
  const rad = (leg.angle * Math.PI) / 180;
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);

  const hx = ux * HIP_RADIUS;
  const hy = uy * HIP_RADIUS;

  let tx = hx + ux * leg.reach;
  let ty = hy + uy * leg.reach;
  let lift = 0;

  if (frame.moving) {
    const phase = frame.legPhase + (leg.group ? Math.PI : 0);
    const swing = Math.cos(phase) * 6;
    lift = Math.max(0, Math.sin(phase));
    // 前进方向为局部 -Y：足尖前后摆，抬腿时略微收拢
    ty -= swing;
    tx -= ux * lift * 4;
    ty -= uy * lift * 4;
  }

  const dx = tx - hx;
  const dy = ty - hy;
  const length = Math.hypot(dx, dy) || 1;
  // 膝盖统一朝上顶起，左右自然镜像
  let px = -dy / length;
  let py = dx / length;
  if (py > 0) {
    px = -px;
    py = -py;
  }
  const bend = 13 + lift * 5;
  const kx = (hx + tx) / 2 + px * bend;
  const ky = (hy + ty) / 2 + py * bend;

  return `M ${hx.toFixed(1)} ${hy.toFixed(1)} Q ${kx.toFixed(1)} ${ky.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}`;
}

export interface SpiderProps {
  subscribe: (listener: (frame: SpiderFrame) => void) => () => void;
  /** 当前情绪，仅用于外观 */
  mood: MoodSpec;
}

export const Spider = memo(function Spider({ subscribe, mood }: SpiderProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const legRefs = useRef<(SVGPathElement | null)[]>([]);

  useEffect(() => {
    const apply = (frame: SpiderFrame): void => {
      const root = rootRef.current;
      if (!root) return;
      root.style.transform = `translate3d(${frame.x.toFixed(1)}px, ${frame.y.toFixed(
        1,
      )}px, 0) translate(-50%, -50%) rotate(${frame.angle.toFixed(1)}deg)`;
      root.classList.toggle('is-moving', frame.moving);
      root.classList.toggle('is-chewing', frame.chewing);

      LEGS.forEach((leg, index) => {
        legRefs.current[index]?.setAttribute('d', legPath(leg, frame));
      });
    };

    return subscribe(apply);
  }, [subscribe]);

  return (
    <div
      ref={rootRef}
      className="sp-spider"
      data-mood={mood.key}
      aria-hidden="true"
      role="presentation"
    >
      {mood.symbol && <span className="sp-spider__mood">{mood.symbol}</span>}
      <svg viewBox="-42 -42 84 84" width="84" height="84">
        <g className="sp-legs">
          {LEGS.map((leg, index) => (
            <path
              key={leg.angle}
              className="sp-leg"
              ref={(element) => {
                legRefs.current[index] = element;
              }}
              d=""
            />
          ))}
        </g>

        <ellipse className="sp-abdomen" cx="0" cy="9" rx="14" ry="16" />
        <path className="sp-marking" d="M -7 3 Q 0 13 7 3" />
        <ellipse className="sp-cephalothorax" cx="0" cy="-8" rx="9.5" ry="9" />
        <ellipse className="sp-eye" cx="-3.6" cy="-12" rx="2.7" ry="2.4" />
        <ellipse className="sp-eye" cx="3.6" cy="-12" rx="2.7" ry="2.4" />
        <circle className="sp-pupil" cx="-3.4" cy="-12" r="1.2" />
        <circle className="sp-pupil" cx="3.8" cy="-12" r="1.2" />
        <path className="sp-fang" d="M -3 -16 L -1.4 -11 L -4.6 -12.4 Z" />
        <path className="sp-fang" d="M 3 -16 L 1.4 -11 L 4.6 -12.4 Z" />
      </svg>
    </div>
  );
});
