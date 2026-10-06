import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compactPosition } from '../src/core/CompactPlacement';
import { CollisionEngine } from '../src/core/CollisionEngine';
import { block } from './helpers';

const collision = new CollisionEngine();
const bounds = { minX: 0, minY: 0, maxX: 240, maxY: 240 };
function ring() {
  const base = block();
  return [
    { ...base, id: 'left', x: 0, y: 0, width: 40, height: 240 },
    { ...base, id: 'right', x: 200, y: 0, width: 40, height: 240 },
    { ...base, id: 'top', x: 60, y: 0, width: 120, height: 40 },
    { ...base, id: 'bottom', x: 60, y: 200, width: 120, height: 40 },
  ];
}

test('an enclosed central gap is used before growing the outer spiral', () => {
  const blocks = ring();
  const before = structuredClone(blocks);
  const result = compactPosition(
    { x: 260, y: 0, width: 80, height: 40 },
    'RIGHT',
    blocks,
    bounds,
    20,
    collision,
  );
  assert.ok(result.x >= 60 && result.x + result.width <= 180);
  assert.ok(result.y >= 60 && result.y + result.height <= 180);
  assert.equal(collision.hasCollision(result, blocks), false);
  assert.deepEqual(blocks, before);
});

test('oversized sentences expand safely when the central gap cannot hold them', () => {
  const blocks = ring();
  const result = compactPosition(
    { x: 260, y: 0, width: 300, height: 100 },
    'RIGHT',
    blocks,
    bounds,
    20,
    collision,
  );
  assert.equal(collision.hasCollision(result, blocks), false);
  assert.ok(
    result.x < 0 || result.y < 0 || result.x + result.width > 240 || result.y + result.height > 240,
  );
});
