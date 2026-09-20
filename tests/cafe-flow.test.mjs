import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAFE_ORDERS,
  addItem,
  beginRecovery,
  createRound,
  getRoundOutcome,
  markServed,
  markSpilled,
} from '../.cafe-test-build/model.js';
import { createTrayBody, stepTrayPhysics } from '../.cafe-test-build/physics.js';

function loadOrder(round) {
  return round.order.lines.flatMap(({ itemId, count }) =>
    Array.from({ length: count }, () => addItem(round, itemId)),
  );
}

test('a complete ten-step carry keeps a level first order and finishes perfectly', () => {
  const round = createRound(CAFE_ORDERS[0]);
  const items = loadOrder(round);
  assert.ok(items.every(Boolean));
  const bodies = items.map((item, index) =>
    createTrayBody(item.id, item.itemId, 0.43 + index * 0.14, 0.5),
  );

  for (let step = 0; step < round.order.steps; step += 1) {
    // Match the small alternating nudge applied by CafeScene.acceptStep().
    for (const body of bodies) {
      body.vx += step % 2 === 0 ? 0.012 : -0.012;
      body.vy += 0.009;
    }
    stepTrayPhysics(bodies, { x: 0, y: 0 }, 0.3);
  }

  assert.equal(bodies.some((body) => body.spilled), false);
  for (const item of items) assert.equal(markServed(round, item.id, item.itemId), true);
  assert.equal(getRoundOutcome(round), 'perfect');
});

test('one spill in a repeated-item order recovers only the missing item', () => {
  const round = createRound(CAFE_ORDERS[1]);
  const items = loadOrder(round);
  assert.equal(items.length, 3);
  assert.equal(new Set(items.map((item) => item.id)).size, 3);

  const spilled = items[1];
  assert.equal(markSpilled(round, spilled.id), true);
  for (const item of items.filter((item) => item.id !== spilled.id)) {
    assert.equal(markServed(round, item.id, item.itemId), true);
  }
  assert.equal(getRoundOutcome(round), 'retry');

  const recovered = beginRecovery(round);
  assert.deepEqual(recovered.map((item) => item.id), [spilled.id]);
  assert.equal(round.recoveryCount, 1);
  assert.equal(markServed(round, recovered[0].id, recovered[0].itemId), true);
  assert.equal(getRoundOutcome(round), 'perfect');
});

test('an all-item spill can be recovered as a fresh carry without duplicating items', () => {
  const round = createRound(CAFE_ORDERS[0]);
  const items = loadOrder(round);
  const bodies = items.map((item, index) =>
    createTrayBody(item.id, item.itemId, 0.001, 0.35 + index * 0.3),
  );
  const result = stepTrayPhysics(bodies, { x: -1, y: 0 }, 1 / 60);
  for (const id of result.spilledIds) assert.equal(markSpilled(round, id), true);

  assert.equal(result.spilledIds.length, items.length);
  assert.equal(getRoundOutcome(round), 'retry');
  const recovered = beginRecovery(round);
  assert.equal(recovered.length, items.length);
  assert.equal(round.items.length, items.length);
  assert.equal(round.recoveryCount, 1);

  for (const item of recovered) assert.equal(markServed(round, item.id, item.itemId), true);
  assert.equal(getRoundOutcome(round), 'perfect');
});

test('neutral tray input damps existing velocity without reversing it', () => {
  const body = createTrayBody('coasting-cookie', 'cookie', 0.5, 0.5);
  body.vx = 0.2;
  body.vy = -0.12;
  const initialSpeed = Math.hypot(body.vx, body.vy);

  for (let frame = 0; frame < 12; frame += 1) {
    stepTrayPhysics([body], { x: 0, y: 0 }, 1 / 60);
  }

  assert.ok(body.vx > 0 && body.vy < 0);
  assert.ok(Math.hypot(body.vx, body.vy) < initialSpeed * 0.6);
  assert.equal(body.spilled, false);
});
