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
  client.message(TOPICS.recording, {recording: false});
  session.send(commands.startRecording());
  session.send(commands.update(IndicatorType.KP, MethodType.INCREASE));
  assert.deepEqual(client.published, []);
  assert.equal(client.subscriptions.includes(TOPICS.startResponse), false);
});
test('recording requires live state, ignores retained state, prevents double clicks and matches topic + requestId', async t => {
  const {session, login} = setup(t);
  const client = await login();
  session.send(commands.startRecording());
  client.message(TOPICS.recording, {recording: false}, true);
  session.send(commands.startRecording());
  assert.equal(client.published.length, 0);
  client.message(TOPICS.recording, {recording: false, bag_name: '', last_error: ''});
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
  client.message(TOPICS.recording, {recording: true, bag_name: 'boat-bag'});
  assert.equal(session.canCommand(commands.stopRecording()), true);
});
test('recording timeout never invents a stopped state or resends the command', async t => {
  const {session, login} = setup(t);
  const client = await login();
  client.message(TOPICS.recording, {recording: true});
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
  client.message(TOPICS.recording, {recording: false});
  session.send(commands.startRecording());
  client.message(TOPICS.startResponse, {requestId: client.published[0].payload['requestId'], success: false, error_message: 'service unavailable'});
  assert.match(session.feedback$.value, /service unavailable/);
  assert.equal(session.recording$.value, null);
  client.message(TOPICS.recording, {recording: false});
  client.publishError = new Error('not authorized');
  session.send(commands.startRecording());
  assert.equal(session.pending$.value, false);
  assert.equal(session.recording$.value, null);
});
test('outage discards commands, clears old data and reconnects using a fresh client', async t => {
  const {session, login, clients} = setup(t);
  const old = await login();
  old.message(TOPICS.recording, {recording: false});
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
  old.message(TOPICS.recording, {recording: true});
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
test('stale, oversized or malformed payloads never enable commands', async t => {
  const {session, login} = setup(t);
  const client = await login();
  client.message(TOPICS.recording, {recording: 'false'});
  client.emit('message', TOPICS.recording, Buffer.from('{bad json'), {retain: false});
  client.message(TOPICS.recording, {recording: false, padding: 'x'.repeat(APP_CONFIG.maxPayloadBytes)});
  assert.equal(session.canCommand(commands.startRecording()), false);
  client.message(TOPICS.recording, {recording: false});
  t.mock.timers.tick(APP_CONFIG.recordingTimeoutMs + 500);
  assert.equal(session.recording$.value, null);
  assert.equal(session.canCommand(commands.startRecording()), false);
});
test('logout clears credentials, pending requests and all cached boat data', async t => {
  const {session, login} = setup(t);
  const client = await login();
  client.message(TOPICS.recording, {recording: false});
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
  client.message(TOPICS.indicators, {indicators: [{indicator: 'KP', value: 1, failed: false, can_increase: false, can_decrease: true}]});
  session.send(commands.update(IndicatorType.KP, MethodType.INCREASE));
  assert.equal(client.published.length, 0);
  session.send(commands.update(IndicatorType.KP, MethodType.DECREASE));
  assert.deepEqual(client.published[0], {topic: TOPICS.update, payload: {indicator: 'KP', method: 'DECREASE'}, options: {qos: 0, retain: false}});
  t.mock.timers.tick(APP_CONFIG.dataTimeoutMs + 1);
  session.send(commands.update(IndicatorType.KP, MethodType.DECREASE));
  assert.equal(client.published.length, 1);
});

const diagnosticSample = {schema_version: 1, stamp: {sec: 100, nanosec: 0},
  raspberry: {temperature_c: 48}, batteries: [{id: 'main', level_percent: 0}, {id: 'aux', level_percent: 85}]};

test('only Staff subscribes to and receives diagnostics; switching to Guest clears them', async t => {
  const {session, login} = setup(t);
  const staff = await login('Staff');
  assert.ok(staff.subscriptions.includes(TOPICS.diagnostic));
  staff.message(TOPICS.diagnostic, diagnosticSample);
  assert.equal(session.diagnostic$.value?.batteries[0].level_percent, 0);
  session.logout();
  assert.equal(session.diagnostic$.value, null);
  const guest = await login('Guest');
  assert.equal(guest.subscriptions.includes(TOPICS.diagnostic), false);
  guest.message(TOPICS.diagnostic, diagnosticSample);
  assert.equal(session.diagnostic$.value, null);
});

test('diagnostics ignore retained/malformed messages, expire independently, and clear on outage', async t => {
  const {session, login} = setup(t);
  const client = await login('Staff');
  client.message(TOPICS.diagnostic, diagnosticSample, true);
  assert.equal(session.diagnostic$.value, null);
  client.message(TOPICS.diagnostic, diagnosticSample);
  t.mock.timers.tick(APP_CONFIG.dataTimeoutMs + 500);
  assert.equal(session.diagnostic$.value?.raspberry?.temperature_c, 48);
  client.message(TOPICS.diagnostic, {...diagnosticSample, raspberry: {temperature_c: 'bad'}});
  t.mock.timers.tick(APP_CONFIG.diagnosticTimeoutMs - APP_CONFIG.dataTimeoutMs);
  assert.equal(session.diagnostic$.value, null);
  client.message(TOPICS.diagnostic, diagnosticSample);
  assert.ok(session.diagnostic$.value);
  client.connected = false;
  client.emit('close');
  assert.equal(session.diagnostic$.value, null);
  assert.equal(session.feedback$.value, '');
});
