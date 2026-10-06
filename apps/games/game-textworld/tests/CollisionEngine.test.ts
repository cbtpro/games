import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionEngine } from '../src/core/CollisionEngine';
import type { Direction } from '../src/core/types';
import { block } from './helpers';

test('rectangles: complete overlap, partial overlap, contact and separation', () => {
  const engine = new CollisionEngine({ safeGap: 0 });
  const rect = { x: 0, y: 0, width: 20, height: 20 };
  assert.equal(engine.intersects(rect, rect), true);
  assert.equal(engine.intersects(rect, { ...rect, x: 10 }), true);
  assert.equal(engine.intersects(rect, { ...rect, x: 20 }), false);
  assert.equal(engine.intersects(rect, { ...rect, x: 40 }), false);
});

test('safeGap rejects too-close rectangles and accepts the exact boundary', () => {
  const engine = new CollisionEngine({ safeGap: 16 });
  const rect = { x: 0, y: 0, width: 20, height: 20 };
  assert.equal(engine.intersects(rect, { ...rect, x: 35 }), true);
  assert.equal(engine.intersects(rect, { ...rect, x: 36 }), false);
  assert.equal(engine.intersects(rect, { ...rect, y: -36 }), false);
});

test('Shift Search moves along all four directions without changing input', () => {
  const engine = new CollisionEngine({ safeGap: 0, searchStep: 12, maxSearchSteps: 10 });
  const obstacle = { ...block(), width: 20, height: 20 };
  const rect = { x: 0, y: 0, width: 20, height: 20 };
  const expected = {
    RIGHT: { x: 24, y: 0 },
    LEFT: { x: -24, y: 0 },
    BOTTOM: { x: 0, y: 24 },
    TOP: { x: 0, y: -24 },
  };
  for (const direction of Object.keys(expected) as Direction[]) {
    assert.deepEqual(engine.findFreePosition(rect, direction, [obstacle]), expected[direction]);
  }
  assert.deepEqual(rect, { x: 0, y: 0, width: 20, height: 20 });
});

test('search exhaustion returns null and a free initial position is accepted', () => {
  const engine = new CollisionEngine({ maxSearchSteps: 1 });
  const obstacle = block();
  assert.equal(engine.findFreePosition(obstacle, 'RIGHT', [obstacle]), null);
  assert.deepEqual(engine.findFreePosition({ ...obstacle, x: 500 }, 'RIGHT', [obstacle]), {
    x: 500,
    y: 0,
  });
});
