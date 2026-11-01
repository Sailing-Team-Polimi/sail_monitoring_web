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
function numeric(value: unknown, keys: string[], stampedHeader = false): JsonObject {
  const data = object(value);
  for (const key of keys) finite(data[key]);
  const stamp = object(stampedHeader ? object(data['header'])['stamp'] : data['stamp']);
  finite(stamp['sec']); finite(stamp['nanosec']);
  if (stampedHeader) {
    if (!Number.isInteger(stamp['sec']) || (stamp['sec'] as number) < 0 ||
        !Number.isInteger(stamp['nanosec']) || (stamp['nanosec'] as number) < 0 ||
        (stamp['nanosec'] as number) >= 1e9 ||
        ((stamp['sec'] as number) === 0 && (stamp['nanosec'] as number) === 0) ||
        object(data['header'])['frame_id'] !== '') throw new Error('Header meccatronica non valido');
  }
  return data;
}
function coordinates(lat: unknown, lon: unknown): void {
  if (Math.abs(finite(lat)) > 90 || Math.abs(finite(lon)) > 180) throw new Error('Coordinate non valide');
}

function sourceFlags(data: JsonObject, keys: string[]): JsonObject {
  return {...data, ...Object.fromEntries(keys.map(key => [key, data[key] === true]))};
}
export function dashboardPayload(value: unknown): DashboardData {
  const data = numeric(value, ['roll','pitch','yaw','sog','vmg','twa','twd','tws']);
  // ROS invia la SOG in m/s; la dashboard usa nodi. VMG e TWS sono già in nodi.
  return {...sourceFlags(data, ['imu_fresh', 'velocity_fresh', 'wind_fresh']),
    sog: finite(data['sog']) * 3600 / 1852} as unknown as DashboardData;
}
export function mechatronicsPayload(value: unknown): MechatronicsData {
  const data = numeric(value, ['servo_limit_max','servo_limit_min','kp','ki','kd','current_height_est_wand',
    'current_height_est_ultrasound','height_target','flap_angle_out','servo_angle_out',
    'roll','pitch','wand_angle'], true);
  const checked = sourceFlags(data, ['imu_fresh', 'wand_fresh', 'height_wand_fresh', 'height_ultrasound_fresh']);
  // Older telemetry has no triple sample: retain other readings, show no distances.
  if (data['ultrasound'] == null) return {...checked, ultrasound: null, ultrasound_fresh: false} as unknown as MechatronicsData;
  const sample = numeric(data['ultrasound'], ['sequence_id', 'left_mm', 'center_mm', 'right_mm']);
  for (const key of ['sequence_id', 'left_mm', 'center_mm', 'right_mm']) {
    const n = finite(sample[key]);
    if (!Number.isInteger(n) || n < 0 || n > (key === 'sequence_id' ? 255 : 65535)) {
      throw new Error('Misura ultrasuoni non valida');
    }
  }
  for (const key of ['left_valid', 'center_valid', 'right_valid']) {
    if (typeof sample[key] !== 'boolean') throw new Error('Validità ultrasuoni non valida');
  }
  if (typeof data['ultrasound_fresh'] !== 'boolean') throw new Error('Freschezza ultrasuoni non valida');
  return checked as unknown as MechatronicsData;
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
  // Old/malformed quality metadata is unavailable, never an implicit valid fix.
  const sigma = data['horizontal_stddev_m'];
  const qualityKnown = typeof sigma === 'number' && Number.isFinite(sigma) && sigma >= 0;
  const usable = data['position_valid'] === true && qualityKnown &&
    (data['gps_state'] === 1 || data['gps_state'] === 2);
  const gps_state = usable ? data['gps_state'] : 0;
  return {...sourceFlags(data, ['imu_fresh', 'wind_fresh']), marks, gps_state, position_valid: usable,
    horizontal_stddev_m: qualityKnown ? sigma : -1,
    gps_covariance_fallback: data['gps_covariance_fallback'] === true,
    dtl: gps_state === 1 ? data['dtl'] : -1,
    ttl: gps_state === 1 ? data['ttl'] : -1,
  } as unknown as MapData;
}
export function indicatorsPayload(value: unknown): IndicatorsState {
  const data = object(value);
  const stamp = object(object(data['header'])['stamp']);
  const sec = finite(stamp['sec']), ns = finite(stamp['nanosec']);
  if (!Number.isInteger(sec) || sec < 0 || !Number.isInteger(ns) || ns < 0 || ns >= 1e9 || sec * 1e9 + ns <= 0) {
    throw new Error('Timestamp indicatori non valido');
  }
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
  const header = object(data['header']);
  const stamp = object(header['stamp']);
  const sec = finite(stamp['sec']);
  const nanosec = finite(stamp['nanosec']);
  if (!Number.isInteger(sec) || sec < 0 || sec > 2147483647 ||
      !Number.isInteger(nanosec) || nanosec < 0 || nanosec >= 1e9 ||
      (sec === 0 && nanosec === 0) || typeof header['frame_id'] !== 'string') {
    throw new Error('Timestamp registrazione non valido');
  }
  return {
    header: {stamp: {sec, nanosec}, frame_id: header['frame_id']},
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
