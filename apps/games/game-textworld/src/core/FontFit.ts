import type { ICollisionEngine } from './CollisionEngine';
import type { ITextMeasure } from './TextMeasure';
import type { Point, Rect, Rotation, TextBlock, TextFont, WorldBounds } from './types';

export interface FittedText extends Rect {
  font: TextFont;
  originalWidth: number;
  originalHeight: number;
}

/** 在既定空间内放大新文字，重新测量并检查间距，不移动已有文字。 */
export function fitFontInSpace(
  initial: FittedText,
  text: string,
  rotation: Rotation,
  bounds: WorldBounds,
  blocks: readonly TextBlock[],
  padding: number,
  maxSize: number,
  measure: ITextMeasure,
  collision: ICollisionEngine,
): FittedText {
  if (!blocks.length) return initial;
  const limit = {
    minX: Math.min(bounds.minX, initial.x),
    minY: Math.min(bounds.minY, initial.y),
    maxX: Math.max(bounds.maxX, initial.x + initial.width),
    maxY: Math.max(bounds.maxY, initial.y + initial.height),
  };
  let best = initial;
  for (let size = initial.font.size + 2; size <= maxSize; size += 2) {
    const font = { ...initial.font, size, lineHeight: Math.ceil(size * 1.35) };
    const measured = measure.measure(text, font);
    const originalWidth = measured.width + padding * 2;
    const originalHeight = measured.height + padding * 2;
    if (originalWidth <= best.originalWidth && originalHeight <= best.originalHeight) continue;
    const swapped = rotation === 90 || rotation === 270;
    const width = swapped ? originalHeight : originalWidth;
    const height = swapped ? originalWidth : originalHeight;
    const positions: Point[] = [
      { x: initial.x, y: initial.y },
      { x: initial.x + initial.width - width, y: initial.y },
      { x: initial.x, y: initial.y + initial.height - height },
      { x: initial.x + initial.width - width, y: initial.y + initial.height - height },
      { x: initial.x + (initial.width - width) / 2, y: initial.y + (initial.height - height) / 2 },
    ];
    const position = positions.find(
      ({ x, y }) =>
        x >= limit.minX &&
        y >= limit.minY &&
        x + width <= limit.maxX &&
        y + height <= limit.maxY &&
        !collision.hasCollision({ x, y, width, height }, blocks),
    );
    if (!position) break;
    best = { ...position, width, height, originalWidth, originalHeight, font };
  }
  return best;
}
