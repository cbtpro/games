import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RotationEngine } from '../src/core/RotationEngine';
import { block } from './helpers';

test('clockwise direction and rotation complete a four-step cycle', () => {
  const engine = new RotationEngine();
  assert.deepEqual(
    ['BOTTOM', 'RIGHT', 'TOP', 'LEFT'].map((d) => engine.nextDirection(d as 'BOTTOM')),
    ['RIGHT', 'TOP', 'LEFT', 'BOTTOM'],
  );
  assert.deepEqual(
    [0, 90, 180, 270].map((r) => engine.nextRotation(r as 0)),
    [90, 180, 270, 0],
  );
});

test('rotation threshold compares the correct world axis and minimum size', () => {
  const engine = new RotationEngine();
  const bounds = { minX: -100, minY: -100, maxX: 300, maxY: 100 };
  assert.equal(engine.shouldRotate({ originalWidth: 201 }, bounds, 'BOTTOM'), true);
  assert.equal(engine.shouldRotate({ originalWidth: 200 }, bounds, 'TOP'), false);
  assert.equal(engine.shouldRotate({ originalWidth: 400 }, bounds, 'RIGHT'), false);
  assert.equal(engine.shouldRotate({ originalWidth: 401 }, bounds, 'LEFT'), true);
  assert.equal(
    engine.shouldRotate({ originalWidth: 160 }, { minX: 0, minY: 0, maxX: 0, maxY: 0 }, 'BOTTOM'),
    false,
  );
});

test('rotation swaps collision dimensions without mutating the source', () => {
  const original = block();
  const snapshot = structuredClone(original);
  const engine = new RotationEngine();
  let rotated = original;
  for (const rotation of [90, 180, 270, 0]) {
    rotated = engine.applyRotation(rotated);
    assert.equal(rotated.rotation, rotation);
    assert.equal(rotated.width, rotation === 90 || rotation === 270 ? 20 : 80);
    assert.equal(rotated.height, rotation === 90 || rotation === 270 ? 80 : 20);
  }
  assert.deepEqual(original, snapshot);
});
