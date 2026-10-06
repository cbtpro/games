import type { Rect, Rotation, TextBlock, WorldBounds } from './types';

/** 归一化多目标评分：紧凑、中心距离、接触边和局部横竖平衡。越低越好。 */
export function packingScore(
  rect: Rect,
  rotation: Rotation,
  blocks: readonly TextBlock[],
  bounds: WorldBounds,
  gap: number,
): number {
  const width = Math.max(bounds.maxX, rect.x + rect.width) - Math.min(bounds.minX, rect.x);
  const height = Math.max(bounds.maxY, rect.y + rect.height) - Math.min(bounds.minY, rect.y);
  const area = Math.max(1, (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY));
  const first = blocks[0];
  if (!first) return 0;
  const cx = rect.x + rect.width / 2,
    cy = rect.y + rect.height / 2;
  const axis = rotation % 180;
  const neighbors = blocks
    .map((block) => ({
      block,
      distance: Math.hypot(cx - block.x - block.width / 2, cy - block.y - block.height / 2),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 6);
  const parallel =
    neighbors.filter(({ block }) => block.rotation % 180 === axis).length /
    Math.max(1, neighbors.length);
  let streak = 0;
  for (let i = blocks.length - 1; i >= 0 && blocks[i].rotation % 180 === axis; i--) streak++;
  let contact = 0;
  for (const block of blocks) {
    const overlapX = Math.max(
      0,
      Math.min(rect.x + rect.width, block.x + block.width) - Math.max(rect.x, block.x),
    );
    const overlapY = Math.max(
      0,
      Math.min(rect.y + rect.height, block.y + block.height) - Math.max(rect.y, block.y),
    );
    if (
      Math.abs(rect.x - block.x - block.width - gap) < 1 ||
      Math.abs(block.x - rect.x - rect.width - gap) < 1
    )
      contact += overlapY;
    if (
      Math.abs(rect.y - block.y - block.height - gap) < 1 ||
      Math.abs(block.y - rect.y - rect.height - gap) < 1
    )
      contact += overlapX;
  }
  const centerDistance =
    Math.hypot(cx - first.x - first.width / 2, cy - first.y - first.height / 2) / Math.sqrt(area);
  return (
    (width * height) / area +
    (0.15 * Math.max(width, height) ** 2) / area +
    0.08 * centerDistance +
    0.24 * parallel +
    0.1 * Math.min(streak, 4) -
    0.08 * Math.min(1, contact / (rect.width + rect.height))
  );
}
