import { test } from 'node:test';
import assert from 'node:assert/strict';
import { controlDeadlines } from '../src/app/core/mqtt/control-freshness';

function sample(sent: unknown, remaining: unknown) {
  return {control_freshness: {sent_at_unix_ms: sent, remaining_ms: remaining}};
}
test('transport age consumes source lifetime and supports a replay ROS stamp', () => {
  assert.deepEqual(controlDeadlines({...sample(10000, {flap: 300, indicators: 1800}),
    header: {stamp: {sec: 1, nanosec: 0}}}, 10200), {flap: 10300, indicators: 11800});
  assert.deepEqual(controlDeadlines(sample(10000, {flap: 300}), 10300), {});
});
test('invalid envelopes fail closed and small wall clock offsets have bounded lifetime', () => {
  for (const sent of [0, NaN, Infinity, '10000', 11001]) {
    assert.deepEqual(controlDeadlines(sample(sent, {indicators: 2000}), 10000), {});
  }
  assert.deepEqual(controlDeadlines(sample(11000, {indicators: 2000}), 10000), {indicators: 12000});
  assert.deepEqual(controlDeadlines(sample(10000, {flap: -1, servo: NaN, indicators: 20000}), 10000),
    {indicators: 15000});
  assert.deepEqual(controlDeadlines({}, 10000), {});
});
