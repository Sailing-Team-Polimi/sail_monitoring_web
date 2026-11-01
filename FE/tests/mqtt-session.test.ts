import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { IClientOptions, MqttClient } from 'mqtt';
import { MqttSession } from '../src/app/core/mqtt/mqtt-session';
import { APP_CONFIG, brokerUrl } from '../src/app/core/mqtt/app-config';
import { TOPICS } from '../src/app/core/mqtt/topics';
import { AuthRoles } from '../src/app/dtos/auth/auth-roles';
import { ClientCommandFactory as commands } from '../src/app/dtos/commands/ClientCommandFactory';
import { IndicatorType } from '../src/app/dtos/indicator/IndicatorType';
import { MethodType } from '../src/app/dtos/indicator/MethodType';
import { MqttConnectionState } from '../src/app/dtos/mqtt/Mqtt.connection.model';
import { MarkType } from '../src/app/dtos/mark/MarkType';
import { diagnosticSample } from './diagnostic-sample';

function recordingSample(data: Record<string, unknown>, ms = Date.now()) {
  return {...data, header: {stamp: {sec: Math.floor(ms / 1000), nanosec: (ms % 1000) * 1e6}, frame_id: ''}};
}

let sourceSequence = 0;
function mechSample(data: Record<string, unknown> = {}) {
  return {header: {stamp: {sec: 1, nanosec: ++sourceSequence}, frame_id: ''},
    servo_limit_max: 74, servo_limit_min: 0, kp: 26, ki: 1, kd: 0,
    current_height_est_wand: 0.5, current_height_est_ultrasound: 0.5, height_target: 0.5,
    flap_angle_out: 0, servo_angle_out: 0, roll: 0, pitch: 0, wand_angle: 0, ...data};
}
function controlSample(data: Record<string, unknown>, remaining = {indicators: 2000}) {
  return {...mechSample(), indicators_fresh: true,
    indicators: {...data, header: {stamp: {sec: 1, nanosec: ++sourceSequence}, frame_id: ''}},
    control_freshness: {sent_at_unix_ms: Date.now(), remaining_ms: remaining}};
}

class FakeClient extends EventEmitter {
  connected = false;
  options: IClientOptions;
  subscriptions: string[] = [];
  published: {topic: string; payload: Record<string, unknown>; options: {qos: number; retain: boolean}}[] = [];
  denySubscriptions = false;
  acknowledgeSubscription?: () => void;
  publishError?: Error;
  ended = false;
  constructor(options: IClientOptions) { super(); this.options = options; }
  subscribe(topics: string[], _options: unknown, done: (error: Error | null, grants: {topic: string; qos: number}[]) => void): void {
    this.subscriptions = topics;
    this.acknowledgeSubscription = () => done(null, topics.map(topic => ({topic, qos: this.denySubscriptions ? 128 : 0})));
  }
  publish(topic: string, value: string, options: {qos: number; retain: boolean}, done: (error?: Error) => void): void {
    this.published.push({topic, payload: JSON.parse(value), options});
    done(this.publishError);
  }
  end(): void { this.ended = true; this.connected = false; this.emit('close'); }
  accept(): void { this.connected = true; this.emit('connect'); }
  message(topic: string, payload: unknown, retain = false): void {
    this.emit('message', topic, Buffer.from(JSON.stringify(payload)), {retain});
  }
}
function setup(t: import('node:test').TestContext) {
  t.mock.timers.enable({apis: ['Date', 'setTimeout', 'setInterval'], now: 100000});
  const clients: FakeClient[] = [];
  const config = {...APP_CONFIG, brokerUrl: 'wss://broker.example/mqtt'};
  const session = new MqttSession((_url, options) => {
    const client = new FakeClient(options);
    clients.push(client);
    return client as unknown as MqttClient;
  }, config);
  t.after(() => session.destroy());
  async function login(username = 'operator') {
    const promise = session.login(username, 'test-password');
    const client = clients.at(-1)!;
    client.accept(); client.acknowledgeSubscription!();
    await promise;
    return client;
  }
  return {session, clients, login};
}

test('login waits for broker authentication and SUBACK; no publish probes', async t => {
  const {session, clients} = setup(t);
  const login = session.login('operator', 'test');
  assert.equal(session.role$.value, null);
  clients[0].accept();
  assert.equal(session.role$.value, null);
  clients[0].acknowledgeSubscription!();
  await login;
  assert.equal(session.role$.value, AuthRoles.Admin);
  assert.equal(session.connection$.value.status, MqttConnectionState.CONNECTED);
  assert.equal(session.feedback$.value, '');
  assert.deepEqual(clients[0].published, []);
});
test('invalid broker URL and unknown users never open a socket', async t => {
  const {session, clients} = setup(t);
  await assert.rejects(session.login('toString', 'x'));
  await assert.rejects(session.login('operator', ''));
  assert.equal(clients.length, 0);
  assert.throws(() => brokerUrl('mqtts://broker.example:8883'));
  assert.throws(() => brokerUrl('wss://user:password@broker.example'));
  assert.throws(() => brokerUrl('wss://broker.example?password=x'));
});
test('bad credentials and denied subscriptions leave the user logged out', async t => {
  const {session, clients} = setup(t);
  const first = session.login('operator', 'wrong');
  const rejected = assert.rejects(first);
  clients[0].emit('error', Object.assign(new Error('denied'), {code: 0x86}));
  await rejected;
  assert.equal(session.role$.value, null);
  assert.equal(clients[0].options.password, undefined);
  const second = session.login('operator', 'test');
  const rejectedAgain = assert.rejects(second);
  clients[1].denySubscriptions = true;
  clients[1].accept(); clients[1].acknowledgeSubscription!();
  await rejectedAgain;
  assert.equal(session.role$.value, null);
});
test('login timeout and logout cancel a pending connection', async t => {
  const {session, clients} = setup(t);
  const rejected = assert.rejects(session.login('operator', 'test'));
  t.mock.timers.tick(APP_CONFIG.connectTimeoutMs + 1);
  await rejected;
  assert.equal(clients[0].ended, true);
  const cancelled = assert.rejects(session.login('operator', 'test'));
  session.logout();
  await cancelled;
  t.mock.timers.tick(APP_CONFIG.reconnectMs * 2);
  assert.equal(clients.length, 2);
});
test('guest cannot send any command through the application', async t => {
  const {session, login} = setup(t);
  const client = await login('guest');
  client.message(TOPICS.recording, recordingSample({recording: false}));
  session.send(commands.startRecording());
  session.send(commands.update(IndicatorType.KP, MethodType.INCREASE));
  assert.deepEqual(client.published, []);
  assert.equal(client.subscriptions.includes(TOPICS.startResponse), false);
});
test('recording requires live state, ignores retained state, prevents double clicks and matches topic + requestId', async t => {
  const {session, login} = setup(t);
  const client = await login();
  session.send(commands.startRecording());
  client.message(TOPICS.recording, recordingSample({recording: false}), true);
  session.send(commands.startRecording());
  assert.equal(client.published.length, 0);
  client.message(TOPICS.recording, recordingSample({recording: false, bag_name: '', last_error: ''}));
  session.send(commands.startRecording());
  session.send(commands.startRecording());
  assert.equal(client.published.length, 1);
  const requestId = client.published[0].payload['requestId'];
  assert.deepEqual(client.published[0].options, {qos: 1, retain: false});
  assert.equal(session.pending$.value, true); // A broker ACK is not a ROS response.
  client.message(TOPICS.startResponse, {requestId: 'another-user', success: true});
  client.message(TOPICS.stopResponse, {requestId, success: true});
  client.message(TOPICS.startResponse, {requestId, success: true}, true);
  assert.equal(session.pending$.value, true);
  client.message(TOPICS.startResponse, {requestId, success: true});
  assert.equal(session.pending$.value, false);
  assert.equal(session.recording$.value, null);
  assert.equal(session.canCommand(commands.stopRecording()), false);
  t.mock.timers.tick(1);
  client.message(TOPICS.recording, recordingSample({recording: true, bag_name: 'boat-bag'}));
  assert.equal(session.canCommand(commands.stopRecording()), true);
});
test('recording timeout never invents a stopped state or resends the command', async t => {
  const {session, login} = setup(t);
  const client = await login();
  client.message(TOPICS.recording, recordingSample({recording: true}));
  session.send(commands.stopRecording());
  t.mock.timers.tick(APP_CONFIG.commandTimeoutMs + 1);
  assert.equal(session.recording$.value, null);
  assert.equal(session.pending$.value, false);
  assert.match(session.feedback$.value, /sconosciuto/);
  assert.equal(client.published.length, 1);
});
test('ROS failure and publication failure require a fresh state before retrying', async t => {
  const {session, login} = setup(t);
  const client = await login();
  client.message(TOPICS.recording, recordingSample({recording: false}));
  session.send(commands.startRecording());
  client.message(TOPICS.startResponse, {requestId: client.published[0].payload['requestId'], success: false, error_message: 'service unavailable'});
  assert.match(session.feedback$.value, /service unavailable/);
  assert.equal(session.recording$.value, null);
  t.mock.timers.tick(1);
  client.message(TOPICS.recording, recordingSample({recording: false}));
  client.publishError = new Error('not authorized');
  session.send(commands.startRecording());
  assert.equal(session.pending$.value, false);
  assert.equal(session.recording$.value, null);
});
test('outage discards commands, clears old data and reconnects using a fresh client', async t => {
  const {session, login, clients} = setup(t);
  const old = await login();
  old.message(TOPICS.recording, recordingSample({recording: false}));
  session.send(commands.startRecording());
  old.connected = false; old.emit('close');
  assert.equal(session.pending$.value, false);
  assert.equal(session.recording$.value, null);
  assert.equal(old.options.password, undefined);
  assert.equal(session.connection$.value.status, MqttConnectionState.RECONNECTING);
  assert.match(session.feedback$.value, /esito sconosciuto/);
  t.mock.timers.tick(APP_CONFIG.reconnectMs);
  const fresh = clients[1];
  assert.notEqual(fresh.options.clientId, old.options.clientId);
  assert.equal(fresh.options.reconnectPeriod, 0);
  assert.equal(fresh.options.queueQoSZero, false);
  fresh.accept(); fresh.acknowledgeSubscription!();
  assert.equal(session.connection$.value.status, MqttConnectionState.CONNECTED);
  assert.match(session.feedback$.value, /esito sconosciuto/);
  assert.equal(fresh.published.length, 0);
  old.message(TOPICS.recording, recordingSample({recording: true}));
  assert.equal(session.recording$.value, null);
});
test('unauthorized DISCONNECT ends only this session and does not loop reconnect', async t => {
  const {session, clients, login} = setup(t);
  const client = await login();
  client.emit('disconnect', {reasonCode: 0x87});
  assert.equal(session.role$.value, null);
  assert.match(session.feedback$.value, /rifiutato/);
  t.mock.timers.tick(APP_CONFIG.reconnectMs * 3);
  assert.equal(clients.length, 1);
});

test('reconnection survives repeated network failures and timeouts until subscriptions succeed', async t => {
  const {session, clients, login} = setup(t);
  const first = await login();
  first.connected = false;
  first.emit('close');
  t.mock.timers.tick(APP_CONFIG.reconnectMs);
  clients[1].emit('error', new Error('network unavailable'));
  assert.equal(session.connection$.value.status, MqttConnectionState.RECONNECTING);
  assert.equal(session.role$.value, AuthRoles.Admin);
  t.mock.timers.tick(APP_CONFIG.reconnectMs);
  t.mock.timers.tick(APP_CONFIG.connectTimeoutMs);
  assert.equal(clients[2].ended, true);
  t.mock.timers.tick(APP_CONFIG.reconnectMs);
  const recovered = clients[3];
  assert.equal(recovered.options.username, 'operator');
  assert.equal(recovered.options.password, 'test-password');
  recovered.accept();
  assert.equal(session.connection$.value.status, MqttConnectionState.RECONNECTING);
  recovered.acknowledgeSubscription!();
  assert.equal(session.connection$.value.status, MqttConnectionState.CONNECTED);
  assert.deepEqual(recovered.published, []);
});

test('logout during reconnection cancels subsequent attempts', async t => {
  const {session, clients, login} = setup(t);
  const first = await login();
  first.connected = false;
  first.emit('close');
  session.logout();
  t.mock.timers.tick(APP_CONFIG.reconnectMs + APP_CONFIG.connectTimeoutMs);
  assert.equal(clients.length, 1);
  assert.equal(session.connection$.value.status, MqttConnectionState.DISCONNECTED);
  assert.equal(session.role$.value, null);
});
test('stale, oversized or malformed payloads never enable commands', async t => {
  const {session, login} = setup(t);
  const client = await login();
  client.message(TOPICS.recording, {recording: 'false'});
  client.emit('message', TOPICS.recording, Buffer.from('{bad json'), {retain: false});
  client.message(TOPICS.recording, recordingSample({recording: false, padding: 'x'.repeat(APP_CONFIG.maxPayloadBytes)}));
  assert.equal(session.canCommand(commands.startRecording()), false);
  client.message(TOPICS.recording, recordingSample({recording: false}));
  t.mock.timers.tick(APP_CONFIG.recordingTimeoutMs + 500);
  assert.equal(session.recording$.value, null);
  assert.equal(session.canCommand(commands.startRecording()), false);
});
test('logout clears credentials, pending requests and all cached boat data', async t => {
  const {session, login} = setup(t);
  const client = await login();
  client.message(TOPICS.recording, recordingSample({recording: false}));
  session.send(commands.startRecording());
  session.logout();
  assert.equal(session.pending$.value, false);
  assert.equal(session.recording$.value, null);
  assert.equal(session.role$.value, null);
  assert.equal(client.ended, true);
  assert.equal(client.options.password, undefined);
});

test('indicator commands obey fresh boat capability flags and use unqueued QoS 0', async t => {
  const {session, login} = setup(t);
  const client = await login();
  client.message(TOPICS.mechatronics, controlSample({indicators: [{indicator: 'KP', value: 1, failed: false, can_increase: false, can_decrease: true}]}));
  session.send(commands.update(IndicatorType.KP, MethodType.INCREASE));
  assert.equal(client.published.length, 0);
  session.send(commands.update(IndicatorType.KP, MethodType.DECREASE));
  assert.deepEqual(client.published[0], {topic: TOPICS.update, payload: {indicator: 'KP', method: 'DECREASE'}, options: {qos: 0, retain: false}});
  t.mock.timers.tick(APP_CONFIG.dataTimeoutMs + 1);
  session.send(commands.update(IndicatorType.KP, MethodType.DECREASE));
  assert.equal(client.published.length, 1);
});

test('a failed active height source can be switched, but stale or unknown state cannot', async t => {
  const {session, login} = setup(t);
  const client = await login();
  const change = commands.update(IndicatorType.ACTIVE_SENSOR, MethodType.CHANGE);
  client.message(TOPICS.mechatronics, controlSample({indicators: [{indicator: 'ACTIVE_SENSOR', value: 1,
    failed: true, can_increase: true, can_decrease: true}]}));
  assert.equal(session.canCommand(change), true);
  session.send(change);
  assert.deepEqual(client.published[0].payload, {indicator: 'ACTIVE_SENSOR', method: 'CHANGE'});
  client.message(TOPICS.mechatronics, controlSample({indicators: [{indicator: 'ACTIVE_SENSOR', value: 99,
    failed: true, can_increase: true}]}));
  assert.equal(session.canCommand(change), false);
  client.message(TOPICS.mechatronics, controlSample({indicators: [{indicator: 'ACTIVE_SENSOR', value: 0,
    failed: false, can_increase: true}]}));
  t.mock.timers.tick(APP_CONFIG.dataTimeoutMs + 1);
  assert.equal(session.canCommand(change), false);
});

test('only Staff subscribes to and receives diagnostics; switching to Guest clears them', async t => {
  const {session, login} = setup(t);
  const diagnostic = () => session.diagnostic$.value;
  const staff = await login('Staff');
  assert.ok(staff.subscriptions.includes('sail_gui/data/diagnostics'));
  assert.equal(staff.subscriptions.includes('sail_gui/data/diagnostic'), false);
  staff.message('sail_gui/data/diagnostic', diagnosticSample);
  assert.equal(diagnostic(), null);
  staff.message('sail_gui/data/diagnostics', diagnosticSample);
  assert.equal(diagnostic()?.raspberry.cpu_usage_percent, 0);
  assert.equal(diagnostic()?.raspberry.memory_usage_percent, 25);
  session.logout();
  assert.equal(session.diagnostic$.value, null);
  const guest = await login('Guest');
  assert.equal(guest.subscriptions.includes(TOPICS.diagnostic), false);
  guest.message(TOPICS.diagnostic, diagnosticSample);
  assert.equal(session.diagnostic$.value, null);
});

test('diagnostics ignore retained/malformed messages, expire independently, and clear on outage', async t => {
  const {session, login} = setup(t);
  // Each MQTT event can change the value; don't carry assertion narrowing across events.
  const diagnostic = () => session.diagnostic$.value;
  const client = await login('Staff');
  client.message(TOPICS.diagnostic, diagnosticSample, true);
  assert.equal(diagnostic(), null);
  client.message(TOPICS.diagnostic, diagnosticSample);
  t.mock.timers.tick(APP_CONFIG.dataTimeoutMs + 500);
  assert.equal(diagnostic()?.raspberry?.temperature_c, 48);
  client.message(TOPICS.diagnostic, {...diagnosticSample, temperature: 'bad'});
  t.mock.timers.tick(APP_CONFIG.diagnosticTimeoutMs - APP_CONFIG.dataTimeoutMs);
  assert.equal(diagnostic(), null);
  client.message(TOPICS.diagnostic, diagnosticSample);
  assert.ok(diagnostic());
  client.connected = false;
  client.emit('close');
  assert.equal(diagnostic(), null);
  assert.equal(session.feedback$.value, '');
});




test('live MQTT does not allow buoy commands for predicted or unavailable GPS', async t => {
  const {session, login} = setup(t);
  const client = await login();
  const command = commands.setMark({type: MarkType.PIN, lat: 45, lon: 10});
  const raw = {stamp: {sec: 100, nanosec: 0}, lat: 45, lon: 10, yaw: 0, twd: 0, tws: 0,
    dtl: 10, ttl: 5, marks: [], gps_state: 1, position_valid: true, horizontal_stddev_m: 1};
  client.message(TOPICS.map, raw);
  assert.equal(session.canCommand(command), true);
  for (const gps_state of [2, 0]) {
    client.message(TOPICS.map, {...raw, gps_state});
    session.send(command);
    assert.equal(session.canCommand(command), false);
  }
  assert.equal(client.published.length, 0);
  client.message(TOPICS.map, raw);
  session.send(command);
  assert.equal(client.published.length, 1);
  t.mock.timers.tick(APP_CONFIG.dataTimeoutMs + 1);
  assert.equal(session.canCommand(command), false);
});


test('source age expires a delayed recording state without granting a new full timeout', async t => {
  const {session, login} = setup(t);
  const client = await login();
  client.message(TOPICS.recording, recordingSample({recording: true}, Date.now() - 4500));
  assert.equal(session.canCommand(commands.stopRecording()), true);
  t.mock.timers.tick(500);
  assert.equal(session.recording$.value, null);
  assert.equal(session.canCommand(commands.startRecording()), false);
  assert.equal(session.canCommand(commands.stopRecording()), false);
});

test('old, future, missing and zero timestamps cannot enable recording controls', async t => {
  const {session, login} = setup(t);
  const client = await login();
  for (const payload of [
    {recording: false}, recordingSample({recording: false}, 0),
    recordingSample({recording: false}, Date.now() - APP_CONFIG.recordingTimeoutMs),
    recordingSample({recording: false}, Date.now() + APP_CONFIG.recordingClockSkewToleranceMs + 1),
  ]) {
    client.message(TOPICS.recording, payload);
    assert.equal(session.recording$.value, null);
    assert.equal(session.canCommand(commands.startRecording()), false);
  }
});

test('duplicate or reordered samples cannot replace state or renew its lifetime', async t => {
  const {session, login} = setup(t);
  const client = await login();
  const original = recordingSample({recording: true});
  client.message(TOPICS.recording, original);
  t.mock.timers.tick(3000);
  client.message(TOPICS.recording, {...original, recording: false});
  client.message(TOPICS.recording, recordingSample({recording: false}, Date.now() - 4000));
  assert.equal(session.recording$.value?.recording, true);
  t.mock.timers.tick(2000);
  assert.equal(session.recording$.value, null);
  client.message(TOPICS.recording, original);
  assert.equal(session.canCommand(commands.stopRecording()), false);
  client.message(TOPICS.recording, recordingSample({recording: false}));
  assert.equal(session.canCommand(commands.startRecording()), true);
});

test('retained timestamps are ignored and command responses cannot refresh expired state', async t => {
  const {session, login} = setup(t);
  const client = await login();
  client.message(TOPICS.recording, recordingSample({recording: false}), true);
  assert.equal(session.recording$.value, null);
  const original = recordingSample({recording: false});
  client.message(TOPICS.recording, original);
  session.send(commands.startRecording());
  const requestId = client.published[0].payload['requestId'];
  client.message(TOPICS.startResponse, {requestId, success: true});
  client.message(TOPICS.recording, original);
  assert.equal(session.recording$.value, null);
});


for (const ahead of [100, 1000]) {
  test(`recording accepts ${ahead} ms clock skew but expires after 5 seconds of silence`, async t => {
    const {session, login} = setup(t);
    const client = await login();
    const sample = recordingSample({recording: true}, Date.now() + ahead);
    client.message(TOPICS.recording, sample);
    assert.equal(session.canCommand(commands.stopRecording()), true);
    t.mock.timers.tick(4000);
    client.message(TOPICS.recording, sample); // Duplicate cannot renew receipt time.
    t.mock.timers.tick(1000);
    assert.equal(session.recording$.value, null);
    assert.equal(session.canCommand(commands.stopRecording()), false);
    client.message(TOPICS.recording, recordingSample({recording: false}, Date.now() + ahead));
    assert.equal(session.canCommand(commands.startRecording()), true);
  });
}

test('tolerance can be disabled or reduced without admitting over-age samples', async t => {
  const {session, login} = setup(t);
  const client = await login();
  session.config.recordingClockSkewToleranceMs = 0;
  client.message(TOPICS.recording, recordingSample({recording: false}, Date.now() + 1));
  assert.equal(session.canCommand(commands.startRecording()), false);
  session.config.recordingClockSkewToleranceMs = 100;
  client.message(TOPICS.recording, recordingSample({recording: false}, Date.now() + 101));
  assert.equal(session.canCommand(commands.startRecording()), false);
  client.message(TOPICS.recording, recordingSample({recording: false}, Date.now() - 5000));
  assert.equal(session.canCommand(commands.startRecording()), false);
  client.message(TOPICS.recording, recordingSample({recording: false}, Date.now() + 100));
  assert.equal(session.canCommand(commands.startRecording()), true);
});

test('invalid clock tolerance configuration is rejected before starting a session', () => {
  for (const value of [-1, 5000, NaN, Infinity]) {
    assert.throws(() => new MqttSession(() => {throw new Error('No connection expected');},
      {...APP_CONFIG, recordingClockSkewToleranceMs: value}), /Tolleranza/);
  }
});

test('indicator source validity expires despite MQTT duplicates and unrelated traffic', async t => {
  const {session, login} = setup(t);
  const client = await login();
  const change = commands.update(IndicatorType.KP, MethodType.INCREASE);
  const sample = controlSample({indicators: [{indicator: 'KP', value: 1, failed: false, can_increase: true}]});
  client.message(TOPICS.mechatronics, sample);
  assert.equal(session.canCommand(change), true);
  t.mock.timers.tick(1500);
  client.message(TOPICS.mechatronics, {...sample, header: mechSample().header,
    control_freshness: {sent_at_unix_ms: Date.now(), remaining_ms: {indicators: 2000}}});
  t.mock.timers.tick(501);
  assert.equal(session.canCommand(change), false);
});

test('delayed indicator state and messages without a source header cannot enable commands', async t => {
  const {session, login} = setup(t);
  const client = await login();
  const data = {indicators: [{indicator: 'KP', value: 1, failed: false, can_increase: true}]};
  const sample = controlSample(data);
  t.mock.timers.tick(2001);
  client.message(TOPICS.mechatronics, sample);
  assert.equal(session.indicators$.value, null);
  client.message(TOPICS.mechatronics, {...mechSample(), indicators: data, indicators_fresh: true,
    control_freshness: controlSample(data).control_freshness});
  assert.equal(session.indicators$.value, null);
  client.message(TOPICS.mechatronics, controlSample(data));
  assert.equal(session.canCommand(commands.update(IndicatorType.KP, MethodType.INCREASE)), true);
});

test('cached mechatronics controls expire independently and fresh sensor traffic cannot revive them', async t => {
  const {session, login} = setup(t);
  const client = await login();
  const data = {header: mechSample().header, indicators: controlSample({indicators: []}).indicators, servo_limit_max: 74, servo_limit_min: 0,
    kp: 26, ki: 1, kd: 0, current_height_est_wand: 0.5, current_height_est_ultrasound: 0.5,
    height_target: 0.5, flap_angle_out: 0, servo_angle_out: 0, roll: 0, pitch: 0, wand_angle: 0,
    flap_command_fresh: true, servo_command_fresh: true, indicators_fresh: true};
  const sample = {...data, control_freshness: {sent_at_unix_ms: Date.now(),
    remaining_ms: {flap: 300, servo: 1000, indicators: 2000}}};
  client.message(TOPICS.mechatronics, sample);
  assert.equal(session.mechatronics$.value?.flap_command_fresh, true);
  t.mock.timers.tick(500);
  assert.equal(session.mechatronics$.value?.flap_command_fresh, false);
  assert.equal(session.mechatronics$.value?.servo_command_fresh, true);
  client.message(TOPICS.mechatronics, sample); // reordered transport cannot refresh anything
  assert.equal(session.mechatronics$.value?.flap_command_fresh, false);
  t.mock.timers.tick(500);
  assert.equal(session.mechatronics$.value?.servo_command_fresh, false);
  client.message(TOPICS.mechatronics, {...data, header: mechSample().header, flap_command_fresh: false, servo_command_fresh: false,
    control_freshness: {sent_at_unix_ms: Date.now(), remaining_ms: {flap: 0, servo: 0, indicators: 1000}}});
  assert.equal(session.mechatronics$.value?.flap_command_fresh, false);
  t.mock.timers.tick(1000);
  assert.equal(session.mechatronics$.value?.indicators_fresh, false);
});

test('one mechatronics packet updates values and button state without an indicators subscription', async t => {
  const {session, login} = setup(t);
  const client = await login();
  assert.equal(client.subscriptions.includes('sail_gui/data/indicators'), false);
  const sample = controlSample({indicators: [{indicator: 'KP', value: 26, failed: false, can_increase: true}]});
  client.message(TOPICS.mechatronics, sample);
  assert.equal(session.mechatronics$.value?.kp, 26);
  assert.equal(session.indicators$.value?.KP.value, 26);
  assert.equal(session.canCommand(commands.update(IndicatorType.KP, MethodType.INCREASE)), true);
  client.message(TOPICS.mechatronics, {...sample, header: mechSample().header, indicators_fresh: false});
  assert.equal(session.indicators$.value, null);
  assert.equal(session.mechatronics$.value?.indicators_fresh, false);
  assert.equal(session.canCommand(commands.update(IndicatorType.KP, MethodType.INCREASE)), false);
});
