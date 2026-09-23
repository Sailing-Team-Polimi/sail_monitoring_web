import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnosticPayload } from '../src/app/core/mqtt/diagnostic-payload';

const base = {schema_version: 1, stamp: {sec: 100, nanosec: 0}, batteries: []};

test('diagnostics distinguish missing measurements from zero and accept multiple batteries', () => {
  const data = diagnosticPayload({...base, raspberry: {temperature_c: 0}, batteries: [
    {id: 'main', name: 'Principale', level_percent: 0, current_a: -1.2, status: 'warning'},
    {id: 'aux', level_percent: 100, voltage_v: 12.8},
    {id: 'spare', temperature_c: null},
  ]});
  assert.equal(data.raspberry?.temperature_c, 0);
  assert.equal(data.raspberry?.cpu_usage_percent, null);
  assert.equal(data.raspberry?.status, 'unknown');
  assert.equal(data.batteries.length, 3);
  assert.equal(data.batteries[0].level_percent, 0);
  assert.equal(data.batteries[0].current_a, -1.2);
  assert.equal(data.batteries[1].name, 'aux');
  assert.equal(data.batteries[2].voltage_v, null);
  assert.equal(diagnosticPayload(base).raspberry, null);
});

test('diagnostics reject malformed units, invalid ranges, duplicate IDs and unsupported schemas', () => {
  for (const raspberry of [{temperature_c: '45'}, {cpu_usage_percent: 101},
    {memory_usage_percent: -1}, {uptime_s: Infinity}, {status: 'healthy'}]) {
    assert.throws(() => diagnosticPayload({...base, raspberry}));
  }
  for (const batteries of [[{id: 'a', level_percent: 101}], [{id: 'a', voltage_v: -1}],
    [{id: 'a'}, {id: 'a'}], [{id: ''}], [{id: 'a', current_a: '2'}], null]) {
    assert.throws(() => diagnosticPayload({...base, batteries}));
  }
  assert.throws(() => diagnosticPayload({...base, schema_version: 2}));
  assert.throws(() => diagnosticPayload({...base, stamp: {sec: 1, nanosec: 1e9}}));
  assert.throws(() => diagnosticPayload({...base, stamp: {sec: 1.5, nanosec: 0}}));
  assert.throws(() => diagnosticPayload({}));
});
