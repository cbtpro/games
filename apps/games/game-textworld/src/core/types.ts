/**
 * 文字世界的基础类型。
 *
 * 这里是纯数据定义：不引用 Canvas、DOM、React，
 * 所以核心算法可以在 Node 里跑测试，也能换成别的渲染器。
 */

/** 生长方向 */
export type Direction = 'TOP' | 'RIGHT' | 'BOTTOM' | 'LEFT';

/** 第一版只允许 90° 的整数倍：宽高可以直接交换，不用做包围盒重算 */
export type Rotation = 0 | 90 | 180 | 270;

/** 布局策略：spiral=螺旋并排展开；graph=矩形树图平铺（类似 webpack 依赖分析图，互不重叠） */
export type LayoutMode = 'spiral' | 'graph';

/** 情绪类别，用于选择文字配色。 */
export type Mood = 'calm' | 'joy' | 'curious' | 'urgent' | 'tender';

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 只存 x/y/width/height，不存 left/right/top/bottom。
 * 两边同时存必然会出现同步问题，需要时现场算。
 */
export const rectRight = (rect: Rect): number => rect.x + rect.width;
export const rectBottom = (rect: Rect): number => rect.y + rect.height;

export interface TextFont {
  family: string;
  size: number;
  weight: 'normal' | 'bold' | number;
  lineHeight: number;
  color: string;
}

/**
 * 一个动画实例的当前状态。
 *
 * 只描述「看起来怎么样」，**不改布局坐标**：
 * 最终位置永远由 LayoutEngine 决定，动画只能临时偏移。
 */
export interface AnimationParams {
  /** 起始位移（动画结束归零） */
  fromX: number;
  fromY: number;
  /** 起始旋转偏移（度） */
  spin: number;
  /** 起始模糊（px） */
  blur: number;
  /** 缩放起点，1 表示不缩放 */
  fromScale: number;
}

export interface AnimationState {
  preset: string;
  params: AnimationParams;
  startedAt: number;
  duration: number;
  elapsed: number;
  /** 0~1 */
  progress: number;
  opacity: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  blur: number;
  /** 相对最终旋转的临时偏移（度） */
  rotationOffset: number;
  /** 打字机类动画用到：显示前百分之多少的字 */
  textProgress: number;
  done: boolean;
}

export interface TextBlock {
  id: string;
  text: string;

  /** 世界坐标（左上角） */
  x: number;
  y: number;

  /** 旋转之后的碰撞尺寸 */
  width: number;
  height: number;

  /** 原始文字尺寸（未旋转） */
  originalWidth: number;
  originalHeight: number;

  rotation: Rotation;
  direction: Direction;
  font: TextFont;
  /** 由句子内容推断出的情绪，决定配色与动画 */
  mood: Mood;
  /** 用于矩形树图布局的「权重面积」（= 原始文字尺寸面积），不随重排改变 */
  area: number;
  animation: AnimationState;
  createdAt: number;
  /** 重排前的中心，用于平滑过渡（仅 graph 模式使用） */
  prevCx?: number;
  prevCy?: number;
}

export interface WorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const getWorldWidth = (bounds: WorldBounds): number => bounds.maxX - bounds.minX;
export const getWorldHeight = (bounds: WorldBounds): number => bounds.maxY - bounds.minY;

/** 后续做「挂到某个块的某条边」时用，第一版只记录不参与布局 */
export interface Anchor {
  blockId: string;
  direction: Direction;
  point: Point;
}

/** 候选落点，第二版再做打分排序 */
export interface LayoutCandidate {
  x: number;
  y: number;
  direction: Direction;
  rotation: Rotation;
  sourceBlockId: string;
  score: number;
}

export const blockRect = (block: TextBlock): Rect => ({
  x: block.x,
  y: block.y,
  width: block.width,
  height: block.height,
});
