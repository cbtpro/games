import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fontForText, TEXT_INKS } from '../src/core/palette';
import { fitFontInSpace } from '../src/core/FontFit';
import { CollisionEngine } from '../src/core/CollisionEngine';
import { block } from './helpers';

test('same mood has varied colors and sizes with larger short phrases', () => {
  const fonts = Array.from({ length: 24 }, (_, index) =>
    fontForText(index, 'calm', '文字世界随着每一句话不断生长'),
  );
  assert.equal(new Set(fonts.map((font) => font.color)).size, TEXT_INKS.length);
  assert.ok(new Set(fonts.map((font) => font.size)).size >= 4);
  assert.ok(
    fontForText(0, 'calm', '你好').size >
      fontForText(
        0,
        'calm',
        '这是一个超过二十五个字符的长句子，用来验证长文本字号保持可读并且不会无限增大',
      ).size,
  );
});

for (const rotation of [0, 90] as const) {
  test(`font enlargement uses real measured bounds and respects gaps at ${rotation} degrees`, () => {
    const base = block();
    const blocks = [
      { ...base, x: 0, y: 0, width: 40, height: 240 },
      { ...base, x: 200, y: 0, width: 40, height: 240 },
      { ...base, x: 60, y: 0, width: 120, height: 40 },
      { ...base, x: 60, y: 200, width: 120, height: 40 },
    ];
    const before = structuredClone(blocks);
    const font = { ...base.font, size: 20, lineHeight: 27 };
    const collision = new CollisionEngine();
    const result = fitFontInSpace(
      { x: 60, y: 60, width: 40, height: 40, originalWidth: 40, originalHeight: 40, font },
      '你好',
      rotation,
      { minX: 0, minY: 0, maxX: 240, maxY: 240 },
      blocks,
      0,
      56,
      {
        measure: (_text, measuredFont) => ({
          width: measuredFont.size * 2,
          height: measuredFont.lineHeight,
        }),
      },
      collision,
    );
    assert.equal(result.font.size, 56);
    assert.equal(result.originalWidth, 112);
    assert.equal(result.width, rotation === 90 ? result.originalHeight : result.originalWidth);
    assert.equal(result.height, rotation === 90 ? result.originalWidth : result.originalHeight);
    assert.equal(collision.hasCollision(result, blocks), false);
    assert.ok(
      result.x >= 0 &&
        result.y >= 0 &&
        result.x + result.width <= 240 &&
        result.y + result.height <= 240,
    );
    assert.deepEqual(blocks, before);
  });
}

test('question and exclamation marks emphasize text without punctuation-count size changes', () => {
  for (const text of [
    '你好',
    '文字世界随着每一句话不断生长',
    '这是一个超过二十五个字符的长句子，用来验证带标点的长文本也会强调',
  ]) {
    const plain = fontForText(1, 'calm', text);
    for (const mark of ['!', '！', '?', '？', '！？！？']) {
      const emphasized = fontForText(1, 'calm', text + mark);
      assert.ok(emphasized.size > plain.size);
      assert.ok(emphasized.size <= 60);
      assert.equal(emphasized.weight, 700);
      assert.equal(emphasized.lineHeight, Math.ceil(emphasized.size * 1.35));
    }
  }
  assert.equal(fontForText(1, 'calm', '你好。').size, fontForText(1, 'calm', '你好').size);
});
