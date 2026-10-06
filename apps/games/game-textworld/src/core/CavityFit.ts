import type { ICollisionEngine } from './CollisionEngine';
import type { ITextMeasure } from './TextMeasure';
import type { Direction, Rect, Rotation, TextBlock, TextFont, WorldBounds } from './types';

/** 从世界内部扣除文字及安全间距，保留可容纳矩形的空白。 */
export function cavitySpaces(
  bounds: WorldBounds,
  blocks: readonly TextBlock[],
  gap: number,
): Rect[] {
  let spaces: Rect[] = [
    {
      x: bounds.minX,
      y: bounds.minY,
      width: bounds.maxX - bounds.minX,
      height: bounds.maxY - bounds.minY,
    },
  ];
  for (const block of blocks) {
    const obstacle = {
      x: block.x - gap,
      y: block.y - gap,
      width: block.width + 2 * gap,
      height: block.height + 2 * gap,
    };
    const next: Rect[] = [];
    for (const space of spaces) {
      const right = space.x + space.width,
        bottom = space.y + space.height;
      const ox = obstacle.x,
        oy = obstacle.y,
        or = ox + obstacle.width,
        ob = oy + obstacle.height;
      if (or <= space.x || ox >= right || ob <= space.y || oy >= bottom) {
        next.push(space);
        continue;
      }
      if (ox > space.x) next.push({ ...space, width: ox - space.x });
      if (or < right) next.push({ ...space, x: or, width: right - or });
      if (oy > space.y) next.push({ ...space, height: oy - space.y });
      if (ob < bottom) next.push({ ...space, y: ob, height: bottom - ob });
    }
    spaces = next
      .filter(
        (rect, i) =>
          rect.width > 0 &&
          rect.height > 0 &&
          !next.some(
            (other, j) =>
              j !== i &&
              other.x <= rect.x &&
              other.y <= rect.y &&
              other.x + other.width >= rect.x + rect.width &&
              other.y + other.height >= rect.y + rect.height &&
              (j < i || other.width * other.height > rect.width * rect.height),
          ),
      )
      .sort((a, b) => b.width * b.height - a.width * a.height)
      .slice(0, 256);
  }
  return spaces;
}

/** 优先以原字号填凹陷，否则最多缩小 20%，不改变已有布局。 */
export function fitCavity(
  text: string,
  font: TextFont,
  bounds: WorldBounds,
  blocks: readonly TextBlock[],
  padding: number,
  gap: number,
  measure: ITextMeasure,
  collision: ICollisionEngine,
  preferredRotation: Rotation,
) {
  if (blocks.length < 3) return null;
  const spaces = cavitySpaces(bounds, blocks, gap);
  const minimum = Math.min(
    font.size,
    Math.max(/[!！?？]/.test(text) ? 24 : 18, Math.ceil(font.size * 0.8)),
  );
  for (let size = font.size; size >= minimum; size--) {
    const fittedFont = { ...font, size, lineHeight: Math.ceil(size * 1.35) };
    const measured = measure.measure(text, fittedFont);
    const originalWidth = measured.width + 2 * padding,
      originalHeight = measured.height + 2 * padding;
    const hits = [];
    for (let turn = 0; turn < 4; turn++) {
      const rotation = ((preferredRotation + turn * 90) % 360) as Rotation;
      const direction = (['BOTTOM', 'RIGHT', 'TOP', 'LEFT'] as Direction[])[rotation / 90];
      const width = rotation % 180 ? originalHeight : originalWidth,
        height = rotation % 180 ? originalWidth : originalHeight;
      for (const space of spaces) {
        if (width > space.width || height > space.height) continue;
        const rect = { x: space.x, y: space.y, width, height };
        const sides = new Set<string>();
        for (const block of blocks) {
          const overlapY =
            Math.min(space.y + space.height, block.y + block.height) - Math.max(space.y, block.y);
          const overlapX =
            Math.min(space.x + space.width, block.x + block.width) - Math.max(space.x, block.x);
          if (overlapY > 0 && Math.abs(space.x - block.x - block.width - gap) < 1)
            sides.add('left');
          if (overlapY > 0 && Math.abs(block.x - space.x - space.width - gap) < 1)
            sides.add('right');
          if (overlapX > 0 && Math.abs(space.y - block.y - block.height - gap) < 1)
            sides.add('top');
          if (overlapX > 0 && Math.abs(block.y - space.y - space.height - gap) < 1)
            sides.add('bottom');
        }
        if (sides.size < 3 || collision.hasCollision(rect, blocks)) continue;
        hits.push({
          ...rect,
          rotation,
          direction,
          font: fittedFont,
          originalWidth,
          originalHeight,
          waste: space.width * space.height - width * height,
        });
      }
    }
    hits.sort((a, b) => a.waste - b.waste);
    if (hits.length) return hits[0];
  }
  return null;
}
