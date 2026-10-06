import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitCavity } from '../src/core/CavityFit';
import { CollisionEngine } from '../src/core/CollisionEngine';
import { block } from './helpers';

function ring() {
  const base = block();
  return [
    { ...base, x: 0, y: 0, width: 40, height: 240 },
    { ...base, x: 200, y: 0, width: 40, height: 240 },
    { ...base, x: 60, y: 0, width: 120, height: 40 },
    { ...base, x: 60, y: 200, width: 120, height: 40 },
  ];
}
const bounds = { minX: 0, minY: 0, maxX: 240, maxY: 240 };
const measure = {
  measure: (text: string, font: { size: number; lineHeight: number }) => ({
    width: text.length * font.size,
    height: font.lineHeight,
  }),
};

test('slightly oversized text shrinks into a cavity without modifying old blocks', () => {
  const blocks = ring(),
    before = structuredClone(blocks),
    collision = new CollisionEngine();
  const font = { ...blocks[0].font, size: 32, lineHeight: 44 };
  const hit = fitCavity('填入凹陷', font, bounds, blocks, 0, 20, measure, collision, 0);
  assert.ok(hit);
  assert.equal(hit.font.size, 30);
  assert.equal(hit.width, 120);
  assert.ok(hit.x >= 60 && hit.y >= 60 && hit.x + hit.width <= 180 && hit.y + hit.height <= 180);
  assert.equal(collision.hasCollision(hit, blocks), false);
  assert.deepEqual(blocks, before);
});
test('text already fitting keeps its font size and oversized text uses normal fallback', () => {
  const blocks = ring();
  const font = { ...blocks[0].font, size: 32, lineHeight: 44 };
  const collision = new CollisionEngine();
  assert.equal(
    fitCavity('空白', font, bounds, blocks, 0, 20, measure, collision, 0)?.font.size,
    32,
  );
  assert.equal(
    fitCavity(
      '这句话实在太长无法合理缩小到凹陷里面',
      font,
      bounds,
      blocks,
      0,
      20,
      measure,
      collision,
      0,
    ),
    null,
  );
});
