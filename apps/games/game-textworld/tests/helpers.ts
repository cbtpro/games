import { AnimationEngine } from '../src/core/AnimationEngine';
import { LayoutEngine, type LayoutDeps } from '../src/core/LayoutEngine';

export function layout(deps: Partial<LayoutDeps> = {}): LayoutEngine {
  return new LayoutEngine({
    animation: new AnimationEngine({ rng: () => 0.25 }),
    measure: { measure: (text) => ({ width: Number(text) || text.length * 20, height: 20 }) },
    ...deps,
    config: { padding: 0, spiralShape: 'compact', ...deps.config },
  });
}

export function block() {
  return layout().append('80', 0)!;
}
