import { useEffect, useRef } from 'react';
import type { SpiderFrame } from '../hooks/useSpiderEngine';

/**
 * 螯肢图层 —— 和连线图层同一个套路：
 * 一个覆盖整个场地的 SVG，pointer-events: none，只把引擎算好的路径画出来。
 */
export interface TendrilLayerProps {
  subscribe: (listener: (frame: SpiderFrame) => void) => () => void;
}

export function TendrilLayer({ subscribe }: TendrilLayerProps): JSX.Element {
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);

  useEffect(
    () =>
      subscribe((frame) => {
        pathRefs.current.forEach((path, index) => {
          if (!path) return;
          const d = frame.tendrils[index] ?? '';
          path.setAttribute('d', d);
          path.style.opacity = d ? '1' : '0';
        });
      }),
    [subscribe],
  );

  return (
    <svg className="sp-tendril-layer" aria-hidden="true">
      {[0, 1].map((index) => (
        <path
          key={index}
          className="sp-tendril"
          ref={(element) => {
            pathRefs.current[index] = element;
          }}
          d=""
        />
      ))}
    </svg>
  );
}
