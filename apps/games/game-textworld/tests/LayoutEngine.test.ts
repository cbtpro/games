import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AnimationEngine } from '../src/core/AnimationEngine';
import { CollisionEngine, type ICollisionEngine } from '../src/core/CollisionEngine';
import { RotationEngine } from '../src/core/RotationEngine';
import { TextWorld } from '../src/core/TextWorld';
import { layout } from './helpers';

test('first block uses configured origin and initial direction without rotating', () => {
  const engine = layout({
    config: { padding: 0, startX: 10, startY: -30, initialDirection: 'LEFT' },
  });
  const first = engine.append('800')!;
  assert.deepEqual([first.x, first.y, first.direction, first.rotation], [10, -30, 'LEFT', 0]);
  assert.deepEqual(engine.getBounds(), { minX: 10, minY: -30, maxX: 810, maxY: -10 });
});

test('short blocks attach to the previous block and bounds grow', () => {
  const engine = layout();
  const first = engine.append('80')!;
  const second = engine.append('100')!;
  assert.deepEqual([second.x, second.y, second.direction, second.rotation], [-10, 40, 'BOTTOM', 0]);
  assert.deepEqual(engine.getBounds(), { minX: -10, minY: 0, maxX: 90, maxY: 60 });
  assert.deepEqual([first.x, first.y], [0, 0]);
});

test('rotation is inherited and long sentences complete the clockwise cycle', () => {
  const engine = layout();
  engine.append('80');
  const next = new RotationEngine();
  let direction = 'BOTTOM' as const as 'BOTTOM' | 'RIGHT' | 'TOP' | 'LEFT';
  let rotation = 0 as 0 | 90 | 180 | 270;
  for (let i = 0; i < 4; i++) {
    const b = engine.getBounds();
    const width = Math.max(160, b.maxX - b.minX, b.maxY - b.minY) + 100;
    const turned = engine.append(String(width))!;
    direction = next.nextDirection(direction);
    rotation = next.nextRotation(rotation);
    assert.equal(turned.direction, direction);
    assert.equal(turned.rotation, rotation);
    assert.equal(turned.width, rotation === 90 || rotation === 270 ? 20 : width);
    const short = engine.append('40')!;
    assert.equal(short.direction, direction);
    assert.equal(short.rotation, rotation);
  }
});

test('actual collisions shift the candidate until safeGap is satisfied', () => {
  const collision = new CollisionEngine();
  let checks = 0;
  const engine = layout({
    collision: {
      intersects: (a, b) => collision.intersects(a, b),
      hasCollision: (rect, blocks) => collision.hasCollision(rect, blocks),
      findFreePosition: (rect, direction, blocks) => {
        checks++;
        const obstacle = { ...blocks[0], x: 0, y: 40, width: 80, height: 20 };
        return collision.findFreePosition(rect, direction, [...blocks, obstacle]);
      },
    },
  });
  engine.append('80');
  const second = engine.append('80')!;
  assert.equal(checks, 1);
  assert.equal(second.y, 76);
  assert.equal(second.direction, 'BOTTOM');
});

test('search fallback rotates, checks only committed blocks, then commits', () => {
  let calls = 0;
  const collision: ICollisionEngine = {
    intersects: () => false,
    hasCollision: () => false,
    findFreePosition: (rect, direction, blocks) => {
      assert.equal(blocks.length, 1);
      calls++;
      if (calls === 1) {
        assert.equal(direction, 'BOTTOM');
        return null;
      }
      assert.equal(direction, 'RIGHT');
      return { x: rect.x, y: rect.y };
    },
  };
  const engine = layout({ collision });
  engine.append('80');
  const result = engine.append('80')!;
  assert.deepEqual(
    [result.direction, result.rotation, result.width, result.height],
    ['RIGHT', 90, 20, 80],
  );
});

test('all searches failing leaves blocks, bounds, last block and animation history unchanged', () => {
  const collision: ICollisionEngine = {
    intersects: () => true,
    hasCollision: () => true,
    findFreePosition: () => null,
  };
  const animation = new AnimationEngine({ rng: () => 0 });
  const engine = layout({ collision, animation });
  const first = engine.append('80')!;
  const before = structuredClone(engine.getBounds());
  assert.equal(engine.append('100'), null);
  assert.equal(engine.getBlocks().length, 1);
  assert.equal(engine.lastBlock, first);
  assert.deepEqual(engine.getBounds(), before);
  assert.equal(animation.create(0).preset, 'scale-in');
});

test('500 spiral blocks retain immutable previous layout and safe gaps', () => {
  const engine = layout();
  const collision = new CollisionEngine();
  for (let i = 0; i < 500; i++) {
    const previous = engine
      .getBlocks()
      .map(({ x, y, width, height, rotation }) => ({ x, y, width, height, rotation }));
    const added = engine.append(String(20 + ((i * 73) % 900)));
    assert.ok(added, `block ${i} must fit`);
    for (let j = 0; j < previous.length; j++) {
      const old = engine.getBlocks()[j];
      assert.deepEqual(
        { x: old.x, y: old.y, width: old.width, height: old.height, rotation: old.rotation },
        previous[j],
      );
      assert.equal(
        collision.intersects(added, old),
        false,
        `blocks ${i}, ${j} must retain safeGap`,
      );
    }
  }
});

test('optional graph layout preserves safeGap even with different block heights', () => {
  const engine = layout({
    config: { mode: 'graph', padding: 0 },
    measure: { measure: (text) => ({ width: Number(text), height: Number(text) / 4 }) },
  });
  for (const text of ['40', '80', '700', '400']) engine.append(text);
  const blocks = engine.getBlocks();
  const collision = new CollisionEngine();
  for (let i = 0; i < blocks.length; i++)
    for (let j = 0; j < i; j++) assert.equal(collision.intersects(blocks[i], blocks[j]), false);
});

test('clear resets origin, direction, rotation, bounds and reflow metadata', () => {
  const engine = layout();
  engine.append('80');
  engine.append('800');
  engine.clear();
  assert.deepEqual(engine.getBounds(), { minX: 0, minY: 0, maxX: 0, maxY: 0 });
  assert.equal(engine.lastBlock, null);
  const first = engine.append('800')!;
  assert.deepEqual([first.x, first.y, first.direction, first.rotation], [0, 0, 'BOTTOM', 0]);
  const graph = layout({ config: { mode: 'graph' } });
  graph.append('80', 10);
  graph.clear();
  assert.equal(graph.reflowAt, 0);
});

const MIXED_SENTENCES = [
  '你好',
  '今天的天气非常不错',
  '我刚才突然想到一个非常有意思的问题',
  '为什么',
  '如果所有文字都可以不断生长',
  '那最终是不是可以形成一整个文字世界',
  '等等',
  '这个方向好像不太对',
];

test('late spiral growth keeps turning and stays compact with repeated mixed sentences', () => {
  const world = new TextWorld({ layout: { spiralShape: 'compact' } });
  for (let i = 0; i < 100; i++)
    assert.ok(world.append(MIXED_SENTENCES[i % MIXED_SENTENCES.length]));
  const blocks = world.blocks;
  assert.equal(new Set(blocks.slice(40).map((block) => block.direction)).size, 4);
  const bounds = world.bounds;
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  assert.ok(width / height > 0.5 && width / height < 2);
  assert.ok(
    blocks.reduce((sum, block) => sum + block.width * block.height, 0) / (width * height) > 0.5,
  );
});

test('identical short sentences still form repeated clockwise turns instead of a subtitle list', () => {
  const world = new TextWorld({ layout: { spiralShape: 'compact' } });
  for (let i = 0; i < 100; i++) world.append('你好');
  const changes = world.blocks.filter(
    (block, i) => i && block.direction !== world.blocks[i - 1].direction,
  );
  assert.ok(changes.length >= 8);
  assert.equal(new Set(changes.map((block) => block.direction)).size, 4);
});

test('graph preserves all previous positions during rapid and long-running append', () => {
  const world = new TextWorld({ layout: { mode: 'graph' } });
  const collision = new CollisionEngine();
  for (let i = 0; i < 100; i++) {
    const before = world.blocks.map(({ x, y, width, height }) => ({ x, y, width, height }));
    const added = world.append(MIXED_SENTENCES[i % MIXED_SENTENCES.length], i * 50)!;
    assert.ok(added);
    world.blocks.slice(0, -1).forEach((block, j) => {
      assert.deepEqual(
        { x: block.x, y: block.y, width: block.width, height: block.height },
        before[j],
      );
      assert.equal(collision.intersects(added, block), false);
    });
  }
  const bounds = world.bounds;
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  assert.ok(width / height > 0.5 && width / height < 2);
  assert.ok(
    world.blocks.reduce((sum, block) => sum + block.width * block.height, 0) / (width * height) >
      0.25,
  );
});

test('default greedy packing keeps mixed text compact with stable old positions and safe gaps', () => {
  const world = new TextWorld();
  const collision = new CollisionEngine();
  for (let i = 0; i < 150; i++) {
    const before = world.blocks.map(({ x, y, width, height, rotation }) => ({
      x,
      y,
      width,
      height,
      rotation,
    }));
    const added = world.append(MIXED_SENTENCES[i % MIXED_SENTENCES.length])!;
    assert.ok(added);
    world.blocks.slice(0, -1).forEach((block, j) => {
      const { x, y, width, height, rotation } = block;
      assert.deepEqual({ x, y, width, height, rotation }, before[j]);
      assert.equal(collision.intersects(added, block), false);
    });
  }
  const bounds = world.bounds;
  const area = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY);
  assert.ok(world.blocks.reduce((sum, block) => sum + block.width * block.height, 0) / area > 0.5);
});

test('multi-objective packing balances horizontal and vertical text without moving old blocks', () => {
  for (const texts of [MIXED_SENTENCES, ['你好！']]) {
    const world = new TextWorld();
    for (let i = 0; i < 100; i++) assert.ok(world.append(texts[i % texts.length]));
    const horizontal = world.blocks.filter((block) => block.rotation % 180 === 0).length;
    assert.ok(horizontal >= 25 && horizontal <= 75, `horizontal count: ${horizontal}`);
    const changes = world.blocks.filter(
      (block, i) => i > 0 && block.rotation % 180 !== world.blocks[i - 1].rotation % 180,
    ).length;
    assert.ok(changes >= 25, `axis changes: ${changes}`);
  }
});
