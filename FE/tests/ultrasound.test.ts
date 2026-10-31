import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mechatronicsPayload } from '../src/app/core/mqtt/payloads';
import { ultrasoundReadings } from '../src/app/dtos/sensor/TripleUltrasound';

const stamp = {sec: 10, nanosec: 0};
const sample = {stamp, sequence_id: 42, left_mm: 720, center_mm: 65535, right_mm: 735,
  left_valid: true, center_valid: false, right_valid: true};
const telemetry = {stamp, servo_limit_max: 74, servo_limit_min: 0, kp: 26, ki: 1, kd: 0,
  current_height_est_wand: 0.5, current_height_est_ultrasound: 0.5, height_target: 0.5,
  flap_angle_out: 0, servo_angle_out: 0, roll: 0, pitch: 0, wand_angle: 0,
  ultrasound: sample, ultrasound_fresh: true};

test('three independent distances preserve wire values and render meters with individual validity', () => {
  const data = mechatronicsPayload(telemetry);
  assert.deepEqual(data.ultrasound, sample);
  assert.deepEqual(ultrasoundReadings(data), [
    {label: 'SX', meters: 0.720, state: 'valid'},
    {label: 'Centro', meters: null, state: 'invalid'},
    {label: 'DX', meters: 0.735, state: 'valid'},
  ]);
});

test('expired, disconnected and legacy telemetry show no fabricated distance', () => {
  for (const data of [null, mechatronicsPayload({...telemetry, ultrasound_fresh: false}),
    mechatronicsPayload({...telemetry, ultrasound: undefined})]) {
    assert.ok(ultrasoundReadings(data).every(r => r.meters === null && r.state === 'unavailable'));
  }
});

test('malformed flags and ranges are rejected and reserved codes are never displayed as distances', () => {
  for (const change of [{left_valid: 'false'}, {left_mm: -1}, {center_mm: 65536},
    {right_mm: 1.5}, {sequence_id: 256}, {stamp: undefined}]) {
    assert.throws(() => mechatronicsPayload({...telemetry, ultrasound: {...sample, ...change}}));
  }
  assert.throws(() => mechatronicsPayload({...telemetry, ultrasound_fresh: 'true'}));
  for (const code of [0xFFFD, 0xFFFE, 0xFFFF]) {
    const data = mechatronicsPayload({...telemetry, ultrasound: {...sample, left_mm: code}});
    assert.equal(ultrasoundReadings(data)[0].state, 'invalid');
    assert.equal(ultrasoundReadings(data)[0].meters, null);
  }
  assert.equal(ultrasoundReadings(mechatronicsPayload({...telemetry,
    ultrasound: {...sample, left_mm: 0}}))[0].meters, 0);
});
