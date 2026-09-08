import assert from 'node:assert/strict';
import { Movement, TRAIN, TAU, CALIBRE } from '../app/mechanism.ts';
const near = (a, b, e = 1e-8) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
let count = 0;
function test(name, fn) {
  fn();
  count++;
  console.log(`PASS ${name}`);
}

function woundMovement() {
  const m = new Movement();
  m.wind(16);
  m.amplitude = 270;
  return m;
}

test('Fresh movement has no stored energy and remains stationary until wound', () => {
  const m = new Movement();
  const time = m.snapshot().time;
  m.advance(3600);
  near(m.reserve, 0);
  near(m.crownTurns, 0);
  near(m.amplitude, 0);
  near(m.elapsed, 0);
  assert.equal(m.running, false);
  assert.equal(m.snapshot().time, time);
  m.wind(1);
  m.advance(1);
  near(m.reserve, 7199);
  near(m.elapsed, 1);
  assert.equal(m.running, true);
  assert.notEqual(m.snapshot().time, time);
});
test('Matched pitch distances for all four going-train meshes', () => {
  for (let i = 0; i < 4; i++) {
    const a = TRAIN[i],
      b = TRAIN[i + 1];
    near(
      Math.hypot(a.x - b.x, a.y - b.y),
      (a.module * (a.wheel + b.pinion)) / 2,
    );
  }
});
test('Tooth counts conserve mesh velocity and reverse direction', () => {
  for (let i = 0; i < 4; i++) {
    const a = TRAIN[i],
      b = TRAIN[i + 1];
    near(
      (a.wheel * a.direction) / a.period + (b.pinion * b.direction) / b.period,
      0,
    );
  }
});
test('Eight-hour train periods and reserve', () => {
  const m = woundMovement();
  m.advance(28800);
  const revs = [1, -8, 64, -480, 5760];
  TRAIN.forEach((g, i) => near(m.angle(g.period, g.direction) / TAU, revs[i]));
  near(m.reserve, 86400);
});
test('Six releases/second, 12 degrees/beat, 1 degree of seconds/beat', () => {
  const m = woundMovement();
  for (let i = 0; i < 6; i++) {
    const e = m.angle(5, 1),
      f = m.angle(60, -1);
    m.advance(1 / 6);
    near(m.angle(5, 1) - e, Math.PI / 15);
    near(m.angle(60, -1) - f, -Math.PI / 180);
  }
});
test('Locked escape wheel between impulse windows', () => {
  const m = woundMovement();
  m.elapsed = 0.1 / 6;
  const locked = m.angle(5, 1);
  m.elapsed = 0.4 / 6;
  near(m.angle(5, 1), locked);
  m.elapsed = 0.5 / 6;
  near(m.balanceAngle, 0);
  m.elapsed = 0.6 / 6;
  const locked2 = m.angle(5, 1);
  m.elapsed = 0.9 / 6;
  near(m.angle(5, 1), locked2);
});
test('All releases occur near balance equilibrium', () => {
  const m = woundMovement();
  for (const f of [0.475, 0.5, 0.525]) {
    m.elapsed = f / 6;
    assert.ok((Math.abs(m.balanceAngle) * 180) / Math.PI < 22);
  }
});
test('Motion works same center distances and 12:1 reduction', () => {
  near((0.013 * (10 + 30)) / 2, (0.013 * (8 + 32)) / 2);
  near(((30 / 10) * 32) / 8, 12);
});
test('Full-wind hard stop and reverse crown freewheel', () => {
  const m = woundMovement();
  near(m.wind(20), 8);
  near(m.reserve, CALIBRE.reserveSeconds);
  near(m.crownTurns, 24);
  near(m.wind(1), 0);
  near(m.wind(-5), 0);
  near(m.reserve, 172800);
});
test('Crown, barrel and spring conserve their relative turns', () => {
  const m = woundMovement();
  for (let i = 0; i < 200; i++) {
    m.advance(i * 3.7);
    m.wind((i % 7) / 100);
    near(m.reserve + m.elapsed, m.crownTurns * 7200, 1e-6);
  }
});
test('Exhaustion cannot overshoot or resurrect the train', () => {
  const m = woundMovement();
  m.reserve = 0.25;
  m.advance(1);
  const angle = m.angle(5, 1);
  m.advance(5);
  near(m.elapsed, 0.25);
  near(m.reserve, 0);
  assert.equal(m.running, false);
  near(m.angle(5, 1), angle);
});
test('Empty watch restarts through manual winding', () => {
  const m = woundMovement();
  m.reserve = 0;
  m.advance(2);
  m.wind(0.25);
  near(m.reserve, 1800);
  m.advance(1);
  assert.equal(m.running, true);
  near(m.elapsed, 1);
});
test('Pulled crown hacks movement without consuming reserve', () => {
  const m = woundMovement();
  m.setting = true;
  const before = m.snapshot();
  m.advance(500);
  near(m.reserve, before.reserve);
  near(m.elapsed, 0);
  near(m.wind(1), 0);
  assert.equal(m.running, false);
  near(m.amplitude, 0);
});
test('Midnight wraps hour/minute/seconds consistently', () => {
  const m = woundMovement();
  m.setTime(23, 59, 59);
  assert.equal(m.snapshot().time, '23:59:59');
  m.advance(1);
  assert.equal(m.snapshot().time, '00:00:00');
});
test('Slow and fast demonstration change time and energy together', () => {
  for (const speed of [0.1, 1, 60]) {
    const m = woundMovement();
    m.speed = speed;
    m.advance(20);
    near(m.elapsed, 20 * speed);
    near(m.reserve, 115200 - 20 * speed);
  }
});
test('Invalid deltas, winding and speed cannot corrupt finite state', () => {
  const m = woundMovement();
  for (const v of [NaN, Infinity, -1, 0]) m.advance(v);
  for (const v of [NaN, Infinity, -1]) m.wind(v);
  for (const speed of [-1, NaN, Infinity, 0]) {
    m.speed = speed;
    m.advance(20);
  }
  near(m.elapsed, 0);
  near(m.reserve, 115200);
  near(m.crownTurns, 16);
});
console.log(`${count} mechanical invariants passed.`);
