import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commandPayload, mapPayload, indicatorsPayload, recordingPayload, dashboardPayload, mechatronicsPayload } from '../src/app/core/mqtt/payloads';
import { ClientCommandFactory as commands } from '../src/app/dtos/commands/ClientCommandFactory';
import { MarkType } from '../src/app/dtos/mark/MarkType';
import { IndicatorType } from '../src/app/dtos/indicator/IndicatorType';
import { MethodType } from '../src/app/dtos/indicator/MethodType';
import { TestFlapCommand } from '../src/app/dtos/servo/TestFlapCommand';
import { TOPICS } from '../src/app/core/mqtt/topics';

const stamp = {sec: 123, nanosec: 0};
test('ROS numeric buoy codes map to labels and back without swapping committee and pin', () => {
  const raw = {stamp, lat: 45, lon: 10, yaw: 15, twd: 20, tws: 8, ttl: -1, dtl: 12,
    marks: [{type: 0, lat: 45, lon: 10}, {type: 1, lat: 46, lon: 11}, {type: 2, lat: 47, lon: 12}, {type: 99}, null]};
  const data = mapPayload(raw);
  assert.deepEqual(data.marks.map(mark => mark.type), [MarkType.COMITATO, MarkType.PIN, MarkType.BOLINA]);
  assert.equal(data.ttl, -1);
  data.marks.forEach((mark, i) => assert.deepEqual(commandPayload(commands.setMark(mark)), {
    topic: TOPICS.setMark, payload: {type: i, lat: mark.lat, lon: mark.lon},
  }));
  assert.throws(() => mapPayload({...raw, lat: 100}));
  assert.throws(() => commandPayload(commands.setMark({type: MarkType.PIN, lat: NaN, lon: 0})));
});
test('indicator lists become keyed state with conservative capability defaults', () => {
  const data = indicatorsPayload({indicators: [
    {indicator: 'KP', value: 2, failed: false, can_increase: true, can_decrease: false},
    {indicator: 'ACTIVE_SENSOR', value: 1},
    {indicator: 'UNKNOWN', value: 1},
  ]});
  assert.deepEqual(data.KP, {value: 2, failed: false, canIncrease: true, canDecrease: false});
  assert.equal(data.ACTIVE_SENSOR.failed, true);
  assert.equal(data.ACTIVE_SENSOR.canIncrease, false);
  assert.equal(Object.keys(data).length, 2);
});
test('recording maps errors and bag name without coercing strings to booleans', () => {
  assert.deepEqual(recordingPayload({recording: true, last_error: 'disk full', bag_name: 'run-1'}), {
    recording: true, lastError: 'disk full', bagName: 'run-1',
  });
  assert.throws(() => recordingPayload({recording: 'false'}));
});
test('indicator and servo commands retain the ROS gateway wire contract', () => {
  assert.deepEqual(commandPayload(commands.update(IndicatorType.KP, MethodType.INCREASE)), {
    topic: TOPICS.update, payload: {indicator: 'KP', method: 'INCREASE'},
  });
  assert.deepEqual(commandPayload(commands.update(IndicatorType.ACTUATION_MODE, MethodType.CHANGE)), {
    topic: TOPICS.update, payload: {indicator: 'ACTUATION_MODE', method: 'CHANGE'},
  });
  assert.throws(() => commandPayload(commands.update(IndicatorType.KP, MethodType.CHANGE)));
  assert.throws(() => commandPayload(commands.update(IndicatorType.ACTIVE_SENSOR, MethodType.INCREASE)));
  assert.deepEqual(commandPayload(commands.sendTestCommand(TestFlapCommand.FLAP_MAX)), {
    topic: TOPICS.testServo, payload: {command: 'FLAP_MAX'},
  });
});
test('telemetry rejects nonnumeric samples rather than presenting fabricated zero values', () => {
  const dashboard = {stamp, roll: 1, pitch: 2, yaw: 3, sog: 4, vmg: 5, twa: 6, twd: 7, tws: 8};
  assert.deepEqual(dashboardPayload(dashboard), dashboard);
  assert.throws(() => dashboardPayload({...dashboard, sog: null}));
  assert.throws(() => dashboardPayload({...dashboard, yaw: Infinity}));
  assert.throws(() => dashboardPayload({...dashboard, stamp: undefined}));
  assert.throws(() => mechatronicsPayload({stamp, kp: 1}));
});
