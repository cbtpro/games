import { test } from 'node:test';
import assert from 'node:assert/strict';
import { worldToScreen } from '../src/core/Camera';
import { CameraController } from '../src/core/CameraController';
import { TextWorld } from '../src/core/TextWorld';
import { CanvasRenderer } from '../src/renderer/CanvasRenderer';

test('camera smoothly follows latest block rather than WorldBounds center', () => {
  const controller = new CameraController();
  const bounds = { minX: 0, minY: 0, maxX: 2000, maxY: 1000 };
  const latest = { x: 1500, y: 100, width: 100, height: 40 };
  const viewport = { width: 800, height: 600 };
  controller.follow(bounds, viewport, 0.016, 0, latest);
  assert.ok(controller.camera.x > 0 && controller.camera.x < 1550);
  for (let i = 0; i < 300; i++) controller.follow(bounds, viewport, 0.016, 0, latest);
  const screen = worldToScreen(
    { x: latest.x + latest.width / 2, y: latest.y + latest.height / 2 },
    controller.camera,
    viewport,
  );
  assert.ok(Math.abs(screen.x - 400) < 0.03);
  assert.ok(Math.abs(screen.y - 300) < 0.03);
  controller.rotateBy(90);
  controller.panBy(100, 40);
  controller.reset();
  assert.deepEqual(controller.camera, { x: 0, y: 0, zoom: 1, rotation: 0 });
  assert.equal(controller.isManual, false);
  assert.equal(controller.autoSpin, true);
});

test('renderer accepts frozen world, draws Debug bounds only when enabled', () => {
  const world = new TextWorld();
  world.append('你好');
  world.update(2000);
  const frozen = structuredClone({
    blocks: world.blocks,
    bounds: world.bounds,
    reflowAt: world.reflowAt,
  });
  for (const block of frozen.blocks) {
    Object.freeze(block.animation.params);
    Object.freeze(block.animation);
    Object.freeze(block.font);
    Object.freeze(block);
  }
  Object.freeze(frozen.blocks);
  Object.freeze(frozen.bounds);
  Object.freeze(frozen);
  const labels: string[] = [];
  let boundsDrawn = 0;
  let maxShadowBlur = 0;
  let maxShadowOffset = 0;
  const ctx = new Proxy(
    {},
    {
      get: (_target, key) => {
        if (key === 'measureText') return () => ({ width: 40 });
        if (key === 'strokeRect')
          return () => {
            boundsDrawn++;
          };
        if (key === 'fillText')
          return (text: string) => {
            labels.push(text);
          };
        return () => {};
      },
      set: (_target, key, value) => {
        if (key === 'shadowBlur') maxShadowBlur = Math.max(maxShadowBlur, Number(value));
        if (key === 'shadowOffsetY') maxShadowOffset = Math.max(maxShadowOffset, Number(value));
        return true;
      },
    },
  ) as CanvasRenderingContext2D;
  const renderer = new CanvasRenderer();
  const camera = { x: 0, y: 0, zoom: 1, rotation: 0 };
  const viewport = { width: 800, height: 600 };
  renderer.render(frozen, camera, { ctx, viewport, dpr: 2 }, world.time);
  assert.equal(boundsDrawn, 0);
  renderer.render(frozen, camera, { ctx, viewport, dpr: 2, debug: true }, world.time);
  assert.equal(boundsDrawn, 2);
  assert.ok(labels.includes('WorldBounds'));
  assert.ok(labels.some((text) => text.includes('BOTTOM') && text.includes('0°')));
  assert.ok(labels.some((text) => text.startsWith('Camera')));
  renderer.render(
    { ...frozen, blocks: Array(200).fill(frozen.blocks[0]) },
    camera,
    { ctx, viewport, dpr: 2 },
    world.time,
  );
  assert.ok(maxShadowBlur <= 8);
  assert.ok(maxShadowOffset <= 3);
});

test('latest rectangle stays centered after rotation and manual movement', () => {
  for (const rotation of [0, 90, 180, 270]) {
    const controller = new CameraController();
    const latest = { x: 400, y: -200, width: 900, height: 120 };
    const bounds = { minX: -100, minY: -200, maxX: 1300, maxY: 800 };
    const viewport = { width: 800, height: 600 };
    controller.panBy(100, 50);
    controller.resumeFollow();
    for (let i = 0; i < 400; i++) controller.follow(bounds, viewport, 0.016, rotation, latest);
    const corners = [
      { x: latest.x, y: latest.y },
      { x: latest.x + latest.width, y: latest.y },
      { x: latest.x, y: latest.y + latest.height },
      { x: latest.x + latest.width, y: latest.y + latest.height },
    ].map((point) => worldToScreen(point, controller.camera, viewport));
    assert.ok(
      Math.abs(
        (Math.min(...corners.map((point) => point.x)) +
          Math.max(...corners.map((point) => point.x))) /
          2 -
          400,
      ) < 0.04,
    );
    assert.ok(
      Math.abs(
        (Math.min(...corners.map((point) => point.y)) +
          Math.max(...corners.map((point) => point.y))) /
          2 -
          300,
      ) < 0.04,
    );
    assert.ok(Math.max(...corners.map((point) => point.x)) <= viewport.width - 31);
    assert.ok(Math.max(...corners.map((point) => point.y)) <= viewport.height - 31);
  }
});

test('several nearby large fonts expand the visible area while keeping latest centered', () => {
  const world = new TextWorld();
  for (let i = 0; i < 6; i++) world.append('你好！');
  const controller = new CameraController();
  const latest = world.layout.lastBlock!;
  for (let i = 0; i < 400; i++)
    controller.follow(
      world.bounds,
      { width: 800, height: 600 },
      0.016,
      latest.rotation,
      latest,
      world.blocks,
    );
  assert.ok(controller.camera.zoom < 0.9);
  assert.ok(controller.camera.zoom >= 0.6);
});

test('rotation responds faster than translation without delaying text entrance', () => {
  const controller = new CameraController();
  const world = new TextWorld();
  const latest = world.append('立即入场！')!;
  for (let i = 0; i < 18; i++) {
    world.update(((i + 1) * 1000) / 60);
    controller.follow(world.bounds, { width: 800, height: 600 }, 1 / 60, 90, latest);
  }
  assert.ok(Math.abs(controller.camera.rotation + 90) < 1);
  assert.ok(Math.abs(controller.camera.x - (latest.x + latest.width / 2)) > 1);
  assert.ok(latest.animation.progress > 0);
});
