/**
 * 文字世界的对外出口。
 *
 * 核心引擎（core/）是纯 TypeScript：不碰 Canvas、DOM、React，
 * 因此可以在 Node 里直接跑布局与碰撞的测试；渲染层（renderer/）按需替换。
 */

export * from './core/types';
export { AnimationEngine, type AnimationEngineOptions } from './core/AnimationEngine';
export {
  CollisionEngine,
  DEFAULT_COLLISION_CONFIG,
  shift,
  type CollisionConfig,
  type ICollisionEngine,
} from './core/CollisionEngine';
export {
  RotationEngine,
  DEFAULT_ROTATION_CONFIG,
  type IRotationEngine,
  type RotationConfig,
  type RotationProbe,
} from './core/RotationEngine';
export {
  LayoutEngine,
  DEFAULT_LAYOUT_CONFIG,
  type ILayoutEngine,
  type LayoutConfig,
  type LayoutDeps,
} from './core/LayoutEngine';
export { ApproximateTextMeasure, type ITextMeasure } from './core/TextMeasure';
export { TextWorld, type TextWorldOptions } from './core/TextWorld';
export {
  DEFAULT_CAMERA,
  fitZoom,
  screenToWorld,
  visibleRect,
  worldToScreen,
  type Camera,
  type Viewport,
} from './core/Camera';
export { CameraController, type CameraControllerOptions } from './core/CameraController';
export { BASE_FONT, TEXT_INKS, fontAt, fontForMood, fontForText } from './core/palette';
export { analyzeMood, MOODS, MOOD_LABEL, MOOD_INK, MOOD_PRESET } from './core/mood';

export { CanvasRenderer, type CanvasRendererOptions } from './renderer/CanvasRenderer';
export {
  CanvasTextMeasure,
  type IRenderer,
  type RenderContext,
  type RenderWorld,
  type ReadonlyData,
} from './renderer/Renderer';

export { ANIMATION_PRESETS, type AnimationPreset } from './animation/presets';
