import type { DashboardData } from '../../dtos/DashboardData';
import type { MapData } from '../../dtos/MapData';
import type { MechatronicsData } from '../../dtos/MechatronicsData';
import type { Mark } from '../../dtos/mark/Mark';
import { MarkType } from '../../dtos/mark/MarkType';
import { IndicatorType } from '../../dtos/indicator/IndicatorType';
import type { IndicatorsState } from '../../dtos/indicator/Indicator.telemetry';
import type { RecordingState } from '../../dtos/state/RecordingState';
import type { ClientCommandUnion } from '../../dtos/commands/ClientCommand';
import { ClientCommandType } from '../../dtos/commands/ClientCommandType';
import { MethodType } from '../../dtos/indicator/MethodType';
import { TestFlapCommand } from '../../dtos/servo/TestFlapCommand';
import { TOPICS } from './topics';

type JsonObject = Record<string, unknown>;
const markTypes = [MarkType.COMITATO, MarkType.PIN, MarkType.BOLINA];
export function object(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Oggetto JSON non valido');
  return value as JsonObject;
}
function finite(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Numero non valido');
  return value;
}
function numeric(value: unknown, keys: string[]): JsonObject {
  const data = object(value);
  for (const key of keys) finite(data[key]);
  const stamp = object(data['stamp']);
  finite(stamp['sec']); finite(stamp['nanosec']);
  return data;
}
function coordinates(lat: unknown, lon: unknown): void {
  if (Math.abs(finite(lat)) > 90 || Math.abs(finite(lon)) > 180) throw new Error('Coordinate non valide');
}
export function dashboardPayload(value: unknown): DashboardData {
  return numeric(value, ['roll','pitch','yaw','sog','vmg','twa','twd','tws']) as unknown as DashboardData;
}
export function mechatronicsPayload(value: unknown): MechatronicsData {
  return numeric(value, ['servo_limit_max','servo_limit_min','kp','ki','kd','current_height_est_wand',
    'current_height_est_ultrasound','ultrasound_data','height_target','flap_angle_out','servo_angle_out',
    'roll','pitch','wand_angle']) as unknown as MechatronicsData;
}
export function mapPayload(value: unknown): MapData {
  const data = numeric(value, ['lat','lon','yaw','twd','tws','ttl','dtl']);
  coordinates(data['lat'], data['lon']);
  const marks: Mark[] = [];
  if (Array.isArray(data['marks'])) for (const raw of data['marks']) {
    try {
      const mark = object(raw);
      const code = mark['type'];
      if (typeof code !== 'number' || !Number.isInteger(code) || !markTypes[code]) continue;
      coordinates(mark['lat'], mark['lon']);
      marks.push({type: markTypes[code], lat: finite(mark['lat']), lon: finite(mark['lon'])});
    } catch { /* One invalid buoy must not discard the boat position. */ }
  }
  return {...data, marks} as unknown as MapData;
}
export function indicatorsPayload(value: unknown): IndicatorsState {
  const data = object(value);
  if (!Array.isArray(data['indicators'])) throw new Error('Indicatori non validi');
  const result = {} as IndicatorsState;
  for (const raw of data['indicators']) {
    const item = object(raw);
    if (!Object.values(IndicatorType).includes(item['indicator'] as IndicatorType)) continue;
    result[item['indicator'] as IndicatorType] = {
      value: finite(item['value']), failed: item['failed'] !== false,
      canIncrease: item['can_increase'] === true, canDecrease: item['can_decrease'] === true,
    };
  }
  return result;
}
export function recordingPayload(value: unknown): RecordingState {
  const data = object(value);
  if (typeof data['recording'] !== 'boolean') throw new Error('Stato registrazione non valido');
  return {
    recording: data['recording'],
    lastError: typeof data['last_error'] === 'string' ? data['last_error'] : undefined,
    bagName: typeof data['bag_name'] === 'string' ? data['bag_name'] : undefined,
  };
}
export function commandPayload(command: ClientCommandUnion): {topic: string; payload: unknown} {
  switch (command.type) {
    case ClientCommandType.SetMark: {
      const mark = command.payload.mark;
      coordinates(mark.lat, mark.lon);
      const type = markTypes.indexOf(mark.type);
      if (type < 0) throw new Error('Tipo di boa non valido');
      return {topic: TOPICS.setMark, payload: {type, lat: mark.lat, lon: mark.lon}};
    }
    case ClientCommandType.Update: {
      const {indicator, method} = command.payload;
      if (!Object.values(IndicatorType).includes(indicator) || !Object.values(MethodType).includes(method)) {
        throw new Error('Regolazione non valida');
      }
      const toggle = indicator === IndicatorType.ACTIVE_SENSOR || indicator === IndicatorType.ACTUATION_MODE;
      if (toggle !== (method === MethodType.CHANGE)) throw new Error('Operazione non valida per questo indicatore');
      return {topic: TOPICS.update, payload: {indicator, method}};
    }
    case ClientCommandType.TestCommand:
      if (!Object.values(TestFlapCommand).includes(command.payload.command)) throw new Error('Test non valido');
      return {topic: TOPICS.testServo, payload: {command: command.payload.command}};
    default: throw new Error('Comando non supportato');
  }
}
