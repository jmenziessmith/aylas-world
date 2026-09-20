import test from 'node:test';
import assert from 'node:assert/strict';
import { CAFE_LAYOUT, progressPosition, servingPositions } from '../.cafe-test-build/layout.js';

const ART_MARGIN = 40;
const SOURCE_ITEM_SIZE = 88;
const SOURCE_HIT_SIZE = { width: 150, height: 126 };
const BUTTON_HIT_HEIGHT = 80;
const LOADED_ITEM_HIT_SIZE = 78;
const SERVING_TARGET_SIZE = { width: 132, height: 112 };
const PHONE_VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 960, height: 600 },
  { width: 844, height: 390 },
  { width: 667, height: 375 },
  { width: 740, height: 360 },
];

function bounds(rect, extra = 0) {
  return {
    left: rect.x - (rect.w + extra) / 2,
    right: rect.x + (rect.w + extra) / 2,
    top: rect.y - (rect.h + extra) / 2,
    bottom: rect.y + (rect.h + extra) / 2,
  };
}

function rootTransform(viewport) {
  const scale = Math.min(
    (viewport.width - 24) / CAFE_LAYOUT.width,
    (viewport.height - 12) / CAFE_LAYOUT.height,
  );
  return {
    scale,
    x: (viewport.width - CAFE_LAYOUT.width * scale) / 2,
    y: (viewport.height - CAFE_LAYOUT.height * scale) / 2,
  };
}

test('tray art and input regions stay visible on supported landscape phones', () => {
  for (const viewport of PHONE_VIEWPORTS) {
    const transform = rootTransform(viewport);
    for (const tray of [CAFE_LAYOUT.prepTray, CAFE_LAYOUT.carryTray, CAFE_LAYOUT.serveTray]) {
      const art = bounds(tray, ART_MARGIN);
      assert.ok(transform.x + art.left * transform.scale >= 0);
      assert.ok(transform.x + art.right * transform.scale <= viewport.width);
      assert.ok(transform.y + art.top * transform.scale >= 0);
      assert.ok(transform.y + art.bottom * transform.scale <= viewport.height);
    }
  }
});

test('all five counter categories remain distinct, touchable, and clear of the tray', () => {
  assert.equal(CAFE_LAYOUT.sourceSlots.length, 5);
  const tray = bounds(CAFE_LAYOUT.prepTray, ART_MARGIN);
  for (let index = 0; index < CAFE_LAYOUT.sourceSlots.length; index += 1) {
    const source = CAFE_LAYOUT.sourceSlots[index];
    assert.ok(source.x - SOURCE_ITEM_SIZE / 2 >= 0);
    assert.ok(source.x + SOURCE_ITEM_SIZE / 2 <= CAFE_LAYOUT.width);
    assert.ok(source.y - SOURCE_ITEM_SIZE / 2 >= 0);
    assert.ok(source.y + SOURCE_ITEM_SIZE / 2 <= CAFE_LAYOUT.height);
    assert.ok(
      source.x + SOURCE_ITEM_SIZE / 2 < tray.left
        || source.x - SOURCE_ITEM_SIZE / 2 > tray.right
        || source.y + SOURCE_ITEM_SIZE / 2 < tray.top
        || source.y - SOURCE_ITEM_SIZE / 2 > tray.bottom,
    );
    for (const other of CAFE_LAYOUT.sourceSlots.slice(0, index)) {
      assert.ok(Math.hypot(source.x - other.x, source.y - other.y) >= SOURCE_ITEM_SIZE + 48);
    }
  }
  for (const viewport of PHONE_VIEWPORTS) {
    const scale = rootTransform(viewport).scale;
    assert.ok(SOURCE_HIT_SIZE.width * scale >= 44);
    assert.ok(SOURCE_HIT_SIZE.height * scale >= 44);
    assert.ok(BUTTON_HIT_HEIGHT * scale >= 44);
    assert.ok(LOADED_ITEM_HIT_SIZE * scale >= 44);
    assert.ok(CAFE_LAYOUT.serveTargetRadius * 2 * scale >= 44);
  }
});

test('serving targets stay visible, separate, and clear of the source tray', () => {
  const tray = bounds(CAFE_LAYOUT.serveTray, ART_MARGIN);
  for (const count of [1, 2, 3]) {
    const positions = servingPositions(count);
    assert.equal(positions.length, count);
    positions.forEach((position, index) => {
      assert.ok(position.x - SERVING_TARGET_SIZE.width / 2 >= 0);
      assert.ok(position.x + SERVING_TARGET_SIZE.width / 2 <= CAFE_LAYOUT.width);
      assert.ok(position.y - SERVING_TARGET_SIZE.height / 2 >= 0);
      assert.ok(position.y + SERVING_TARGET_SIZE.height / 2 <= CAFE_LAYOUT.height);
      assert.ok(position.x - CAFE_LAYOUT.serveTargetRadius > tray.right);
      for (const other of positions.slice(0, index)) {
        assert.ok(
          Math.hypot(position.x - other.x, position.y - other.y)
            >= CAFE_LAYOUT.serveTargetRadius * 2,
        );
      }
    });
  }
});

test('ten progress overlays align with the source artwork glyph centers', () => {
  const source = {
    width: 629,
    height: 146,
    firstX: 40,
    lastX: 584,
    centerY: 69,
  };
  const bar = CAFE_LAYOUT.progress;
  const imageScale = Math.min(bar.width / source.width, bar.height / source.height);
  const renderedWidth = source.width * imageScale;
  const renderedHeight = source.height * imageScale;
  const expectedFirstX = bar.x - renderedWidth / 2 + source.firstX * imageScale;
  const expectedLastX = bar.x - renderedWidth / 2 + source.lastX * imageScale;
  const expectedY = bar.y - renderedHeight / 2 + source.centerY * imageScale;
  const positions = Array.from({ length: 10 }, (_, index) => progressPosition(index, 10));

  assert.ok(Math.abs(positions[0].x - expectedFirstX) <= 1.5);
  assert.ok(Math.abs(positions.at(-1).x - expectedLastX) <= 1.5);
  assert.ok(positions.every((position) => Math.abs(position.y - expectedY) <= 1.5));
  assert.ok(positions.every((position, index) => index === 0 || position.x > positions[index - 1].x));
});
