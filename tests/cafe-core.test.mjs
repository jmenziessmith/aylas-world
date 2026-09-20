import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAFE_ORDERS,
  addItem,
  beginRecovery,
  canAddItem,
  createRound,
  getRoundOutcome,
  markServed,
  markSpilled,
  validateLoadedOrder,
} from '../.cafe-test-build/model.js';
import { createTrayBody, stepTrayPhysics } from '../.cafe-test-build/physics.js';
import {
  CafeMotionInput,
  CarefulStepDetector,
  GravitySampleFilter,
  TiltCalibrator,
  mapTiltToScreen,
} from '../.cafe-test-build/sensors.js';

test('orders accept exact items and counts only', () => {
  const round = createRound(CAFE_ORDERS[1]);
  assert.equal(addItem(round, 'cupcake'), undefined);
  const first = addItem(round, 'cookie');
  assert.ok(first);
  assert.equal(validateLoadedOrder(round), false);
  assert.ok(addItem(round, 'cookie'));
  assert.ok(addItem(round, 'juice'));
  assert.equal(canAddItem(round, 'cookie'), false);
  assert.equal(addItem(round, 'cookie'), undefined);
  assert.equal(validateLoadedOrder(round), true);
  assert.equal(markServed(round, first.id, 'cookie'), true);
  assert.equal(canAddItem(round, 'cookie'), false);
  assert.equal(addItem(round, 'cookie'), undefined);
});

test('serving checks the target and spills can be recovered', () => {
  const round = createRound();
  const cookie = addItem(round, 'cookie');
  const juice = addItem(round, 'juice');
  assert.ok(cookie && juice);
  assert.equal(markServed(round, cookie.id, 'juice'), false);
  assert.equal(markServed(round, cookie.id, 'cookie'), true);
  assert.equal(markSpilled(round, juice.id), true);
  assert.equal(getRoundOutcome(round), 'retry');
  assert.deepEqual(beginRecovery(round).map((item) => item.id), [juice.id]);
  assert.equal(round.recoveryCount, 1);
  assert.equal(markServed(round, juice.id, 'juice'), true);
  assert.equal(getRoundOutcome(round), 'perfect');
});

test('tray tilt moves an item and crossing the forgiving edge spills it once', () => {
  const body = createTrayBody('one', 'cookie', 0.5, 0.5);
  for (let index = 0; index < 20; index += 1) stepTrayPhysics([body], { x: 1, y: 0 }, 1 / 30);
  assert.ok(body.x > 0.52);
  body.x = 0.001;
  const result = stepTrayPhysics([body], { x: -1, y: 0 }, 1 / 60);
  assert.deepEqual(result.spilledIds, ['one']);
  assert.deepEqual(stepTrayPhysics([body], { x: -1, y: 0 }, 1 / 60).spilledIds, []);
});

test('overlapping tray bodies separate without unstable velocity', () => {
  const a = createTrayBody('a', 'cookie', 0.5, 0.5);
  const b = createTrayBody('b', 'juice', 0.5, 0.5);
  stepTrayPhysics([a, b], { x: 0, y: 0 }, 1 / 60);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.radius + b.radius - 0.00001);
  assert.ok(Number.isFinite(a.vx) && Number.isFinite(b.vx));
});

test('screen orientation mapping rotates tray axes', () => {
  assert.deepEqual(mapTiltToScreen(0.4, 0.2, 0), { x: 0.4, y: 0.2 });
  assert.deepEqual(mapTiltToScreen(0.4, 0.2, 90), { x: -0.2, y: 0.4 });
  assert.deepEqual(mapTiltToScreen(0.4, 0.2, 270), { x: 0.2, y: -0.4 });
});

test('calibration removes the resting tilt after about 850ms', () => {
  const calibrator = new TiltCalibrator();
  calibrator.start(0);
  calibrator.sample({ x: 0.12, y: -0.08 }, 0);
  calibrator.sample({ x: 0.12, y: -0.08 }, 450);
  assert.deepEqual(calibrator.sample({ x: 0.12, y: -0.08 }, 850), { x: 0, y: 0 });
  assert.equal(calibrator.ready, true);
  assert.ok(calibrator.sample({ x: 0.5, y: -0.08 }, 900).x > 0.3);
});

test('calibration preserves response beyond the normal tilt range', () => {
  const calibrator = new TiltCalibrator();
  calibrator.start(0);
  calibrator.sample({ x: 1.5, y: 0 }, 0);
  calibrator.sample({ x: 1.5, y: 0 }, 450);
  calibrator.sample({ x: 1.5, y: 0 }, 850);
  assert.ok(calibrator.sample({ x: 2, y: 0 }, 900).x > 0.45);
});

test('gravity fallback establishes its baseline without a first-sample pulse', () => {
  const filter = new GravitySampleFilter();
  const first = filter.sample({ x: 7, y: 1, z: 6 });
  assert.equal(first.linear, undefined);
  assert.deepEqual(first.gravity, { x: 7, y: 1, z: 6 });
  const second = filter.sample({ x: 7, y: 1, z: 6 });
  assert.ok(second.linear);
  assert.ok(Math.hypot(second.linear.x, second.linear.y, second.linear.z) < 0.0001);
});

test('step detector rejects noise, rotation, violent shake, and rapid repeats', () => {
  const detector = new CarefulStepDetector();
  assert.equal(detector.sample(0.4, 0, 0), undefined);
  detector.sample(1.8, 0, 100);
  assert.ok(detector.sample(0.3, 0, 220));
  detector.sample(2, 150, 700);
  assert.equal(detector.sample(0.2, 0, 760), undefined);
  detector.sample(7, 0, 1_100);
  assert.equal(detector.sample(0.2, 0, 1_160), undefined);
  // The lower-energy tail after a shake must not become a step.
  detector.sample(1.8, 0, 1_300);
  assert.equal(detector.sample(0.3, 0, 1_420), undefined);
  detector.sample(1.8, 0, 2_000);
  assert.ok(detector.sample(0.3, 0, 2_080));
  detector.sample(1.8, 0, 2_600);
  const rhythmic = detector.sample(0.3, 0, 2_680);
  assert.ok(rhythmic && rhythmic.confidence > 0.8);
});

test('motion permission requests start together, samples gate readiness, and destroy cleans up', async () => {
  const listeners = new Map();
  const calls = [];
  let resolveMotion;
  let resolveOrientation;
  class MotionPermission {
    static requestPermission() {
      calls.push('motion');
      return new Promise(resolve => { resolveMotion = resolve; });
    }
  }
  class OrientationPermission {
    static requestPermission() {
      calls.push('orientation');
      return new Promise(resolve => { resolveOrientation = resolve; });
    }
  }
  const fakeWindow = {
    isSecureContext: true,
    DeviceMotionEvent: MotionPermission,
    DeviceOrientationEvent: OrientationPermission,
    screen: { orientation: { angle: 0 } },
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); },
  };
  const previousWindow = globalThis.window;
  globalThis.window = fakeWindow;
  try {
    const input = new CafeMotionInput();
    const enabling = input.enable();
    assert.deepEqual(calls, ['motion', 'orientation']);
    resolveMotion('granted');
    resolveOrientation('granted');
    assert.equal(await enabling, 'enabled');
    input.startCalibration(0);
    input.update(1_000);
    assert.equal(input.hasTiltSamples, false);
    assert.equal(input.ready, false);

    const orientation = listeners.get('deviceorientation');
    orientation({ beta: 64, gamma: 0 });
    input.update(0);
    // Frame updates cannot turn one stale sensor event into calibration samples.
    input.update(1_000);
    assert.equal(input.ready, false);
    orientation({ beta: 64, gamma: 0 }); input.update(450);
    orientation({ beta: 64, gamma: 0 }); input.update(850);
    assert.equal(input.ready, true);
    orientation({ beta: 80, gamma: 0 });
    assert.ok(input.update(900).y > 0.45);
    assert.equal(input.hasRecentMotion(900), false);

    input.destroy();
    assert.equal(listeners.size, 0);
  } finally {
    globalThis.window = previousWindow;
  }
});

test('null-only direct acceleration falls back to filtered gravity and invalid events are ignored', async () => {
  const listeners = new Map();
  const fakeWindow = {
    isSecureContext: true,
    DeviceMotionEvent: class {},
    DeviceOrientationEvent: class {},
    screen: { orientation: { angle: 0 } },
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); },
  };
  const previousWindow = globalThis.window;
  globalThis.window = fakeWindow;
  try {
    let steps = 0;
    const input = new CafeMotionInput({ onStep: () => { steps += 1; } });
    assert.equal(await input.enable(), 'enabled');
    const motion = listeners.get('devicemotion');
    motion({
      acceleration: { x: null, y: Number.NaN, z: null },
      accelerationIncludingGravity: { x: null, y: null, z: null },
      rotationRate: null,
    });
    assert.equal(input.hasMotionSamples, false);

    const nullDirect = { x: null, y: null, z: null };
    motion({ acceleration: nullDirect, accelerationIncludingGravity: { x: 0, y: 0, z: 9.81 }, rotationRate: null });
    motion({ acceleration: nullDirect, accelerationIncludingGravity: { x: 0, y: 0, z: 12 }, rotationRate: null });
    motion({ acceleration: nullDirect, accelerationIncludingGravity: { x: 0, y: 0, z: 9.81 }, rotationRate: null });
    assert.equal(input.hasMotionSamples, true);
    assert.equal(steps, 1);
    input.destroy();
  } finally {
    globalThis.window = previousWindow;
  }
});

test('stale orientation hands tilt calibration back to motion gravity', async () => {
  const listeners = new Map();
  let now = 0;
  const fakeWindow = {
    isSecureContext: true,
    DeviceMotionEvent: class {},
    DeviceOrientationEvent: class {},
    screen: { orientation: { angle: 0 } },
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); },
  };
  const previousWindow = globalThis.window;
  const performanceDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'performance');
  globalThis.window = fakeWindow;
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => now } });
  try {
    const input = new CafeMotionInput();
    assert.equal(await input.enable(), 'enabled');
    const orientation = listeners.get('deviceorientation');
    const motion = listeners.get('devicemotion');
    orientation({ beta: Number.NaN, gamma: 0 });
    assert.equal(input.hasTiltSamples, false);
    orientation({ beta: 0, gamma: 0 });
    input.startCalibration(0);

    const gravity = { x: 2, y: 0, z: 9.6 };
    now = 300; motion({ acceleration: null, accelerationIncludingGravity: gravity, rotationRate: null }); input.update(now);
    now = 600; motion({ acceleration: null, accelerationIncludingGravity: gravity, rotationRate: null }); input.update(now);
    now = 900; motion({ acceleration: null, accelerationIncludingGravity: gravity, rotationRate: null }); input.update(now);
    assert.equal(input.ready, true);
    input.destroy();
  } finally {
    globalThis.window = previousWindow;
    if (performanceDescriptor) Object.defineProperty(globalThis, 'performance', performanceDescriptor);
  }
});

test('stale orientation switches to matching gravity angles without a false tilt', async () => {
  const listeners = new Map();
  let now = 0;
  const fakeWindow = {
    isSecureContext: true,
    DeviceMotionEvent: class {},
    DeviceOrientationEvent: class {},
    screen: { orientation: { angle: 0 } },
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); },
  };
  const previousWindow = globalThis.window;
  const performanceDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'performance');
  globalThis.window = fakeWindow;
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => now } });
  try {
    const input = new CafeMotionInput();
    assert.equal(await input.enable(), 'enabled');
    const orientation = listeners.get('deviceorientation');
    const motion = listeners.get('devicemotion');
    input.startCalibration(0);
    for (const time of [0, 450, 850]) {
      now = time;
      orientation({ beta: 0, gamma: 30 });
      input.update(now);
    }
    assert.equal(input.ready, true);
    assert.deepEqual(input.tilt, { x: 0, y: 0 });

    now = 1_101;
    const radians = 30 * Math.PI / 180;
    motion({
      acceleration: { x: 0, y: 0, z: 0 },
      accelerationIncludingGravity: { x: 9.81 * Math.sin(radians), y: 0, z: 9.81 * Math.cos(radians) },
      rotationRate: null,
    });
    const tilt = input.update(now);
    assert.ok(Math.abs(tilt.x) < 0.01, `unexpected fallback jump: ${tilt.x}`);
    assert.ok(Math.abs(tilt.y) < 0.01, `unexpected fallback jump: ${tilt.y}`);
    input.destroy();
  } finally {
    globalThis.window = previousWindow;
    if (performanceDescriptor) Object.defineProperty(globalThis, 'performance', performanceDescriptor);
  }
});
