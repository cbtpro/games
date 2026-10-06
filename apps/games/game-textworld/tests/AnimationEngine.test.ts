import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AnimationEngine } from '../src/core/AnimationEngine';
import { TextWorld } from '../src/core/TextWorld';
import { ANIMATION_PRESETS, type AnimationPreset } from '../src/animation/presets';
import { pickWeighted } from '../src/animation/utils';

function preset(key: string, weight: number): AnimationPreset {
  return {
    key,
    label: key,
    weight,
    duration: [100, 100],
    easing: (t) => t,
    sample: () => ({ fromX: 0, fromY: 0, spin: 0, blur: 0, fromScale: 1 }),
    apply: (t) => ({ opacity: t, textProgress: t }),
  };
}

test('Weighted Random follows weighted intervals and excludes zero weights at rng=0', () => {
  const choices = [
    { item: 'excluded', weight: 0 },
    { item: 'a', weight: 1 },
    { item: 'b', weight: 3 },
  ];
  assert.equal(
    pickWeighted(choices, () => 0),
    'a',
  );
  assert.equal(
    pickWeighted(choices, () => 0.249),
    'a',
  );
  assert.equal(
    pickWeighted(choices, () => 0.25),
    'b',
  );
  assert.equal(
    pickWeighted(choices, () => 0.99),
    'b',
  );
  assert.throws(() => pickWeighted([{ item: 0, weight: 0 }]));
  const engine = new AnimationEngine({
    presets: [preset('a', 1), preset('b', 3)],
    recentMemory: 0,
    rng: () => 0.5,
  });
  assert.equal(engine.create(0).preset, 'b');
});

test('every animation excludes the last two even at rng=0', () => {
  const engine = new AnimationEngine({ rng: () => 0 });
  const history: string[] = [];
  for (let i = 0; i < 30; i++) {
    const state = engine.create(i * 100, '你好');
    assert.equal(history.slice(-2).includes(state.preset), false);
    history.push(state.preset);
  }
});

test('actual world append chain chooses independent animations for the same mood', () => {
  const world = new TextWorld({ animation: { rng: () => 0 } });
  for (const text of ['你好', '继续', '下一句']) world.append(text);
  assert.equal(new Set(world.blocks.map((block) => block.animation.preset)).size, 3);
  assert.notEqual(world.blocks[0].animation, world.blocks[1].animation);
});

test('long texts exclude Pop and Rotate In', () => {
  const engine = new AnimationEngine({ rng: () => 0.99 });
  for (let i = 0; i < 40; i++) {
    const animation = engine.create(0, '文'.repeat(31));
    assert.equal(['pop', 'tilt'].includes(animation.preset), false);
  }
});

test('all seven required animation families are selectable', () => {
  for (const key of ['fade-in', 'scale-in', 'slide-in', 'focus', 'typewriter', 'pop', 'tilt']) {
    assert.ok(ANIMATION_PRESETS.some((preset) => preset.key === key));
  }
});

test('custom presets are used for progress and completion without changing the initial state', () => {
  const engine = new AnimationEngine({ presets: [preset('custom', 1)], rng: () => 0 });
  const start = engine.create(50);
  assert.equal(start.progress, 0);
  const middle = engine.advance(start, 100);
  assert.equal(middle.progress, 0.5);
  assert.equal(middle.opacity, 0.5);
  assert.equal(start.progress, 0);
  const done = engine.advance(middle, 150);
  assert.equal(done.done, true);
  assert.equal(done.opacity, 1);
  assert.equal(engine.advance(done, 200), done);
});

test('every preset ends at neutral visual state without changing layout', () => {
  for (const preset of ANIMATION_PRESETS) {
    const engine = new AnimationEngine({ presets: [preset], rng: () => 0.5 });
    const state = engine.create(10, '短句');
    const done = engine.advance(state, 10 + state.duration);
    assert.equal(done.progress, 1);
    for (const value of [done.opacity, done.scale, done.textProgress])
      assert.ok(Math.abs(value - 1) < 1e-8, preset.key);
    for (const value of [done.offsetX, done.offsetY, done.blur, done.rotationOffset])
      assert.ok(Math.abs(value) < 1e-8, preset.key);
  }
  const world = new TextWorld();
  world.append('你好');
  world.append('这是一个比较长的句子');
  const before = world.blocks.map(({ x, y, width, height, rotation }) => ({
    x,
    y,
    width,
    height,
    rotation,
  }));
  world.update(2000);
  assert.deepEqual(
    world.blocks.map(({ x, y, width, height, rotation }) => ({ x, y, width, height, rotation })),
    before,
  );
});

test('reset clears animation history and the world clock', () => {
  const world = new TextWorld({ animation: { rng: () => 0 } });
  const initial = world.append('你好')!.animation.preset;
  world.update(500);
  assert.equal(world.append('继续')!.animation.startedAt, 500);
  world.clear();
  assert.equal(world.time, 0);
  assert.equal(world.append('你好')!.animation.preset, initial);
});
