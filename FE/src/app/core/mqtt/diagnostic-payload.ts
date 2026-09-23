import type { DiagnosticData, DiagnosticStatus, RaspberryDiagnostic } from '../../dtos/DiagnosticData';
import { object } from './payloads';

function measure(value: unknown, min = -Infinity, max = Infinity): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error('Misura diagnostica non valida');
  }
  return value;
}

function status(value: unknown): DiagnosticStatus {
  if (value === undefined || value === null) return 'unknown';
  if (value === 'ok' || value === 'warning' || value === 'error' || value === 'unknown') return value;
  throw new Error('Stato diagnostico non valido');
}

function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 80) throw new Error('Nome diagnostico non valido');
  return value.trim();
}

/** Missing measurements stay unknown; malformed snapshots never replace live data. */
export function diagnosticPayload(value: unknown): DiagnosticData {
  const data = object(value);
  if (data['schema_version'] !== 1) throw new Error('Versione diagnostica non supportata');
  const stamp = object(data['stamp']);
  const sec = measure(stamp['sec'], 0);
  const nanosec = measure(stamp['nanosec'], 0, 999999999);
  if (sec === null || nanosec === null || !Number.isSafeInteger(sec) || !Number.isInteger(nanosec)) {
    throw new Error('Timestamp diagnostico non valido');
  }

  let raspberry: RaspberryDiagnostic | null = null;
  if (data['raspberry'] != null) {
    const pi = object(data['raspberry']);
    raspberry = {
      temperature_c: measure(pi['temperature_c'], -273.15),
      cpu_usage_percent: measure(pi['cpu_usage_percent'], 0, 100),
      memory_usage_percent: measure(pi['memory_usage_percent'], 0, 100),
      uptime_s: measure(pi['uptime_s'], 0),
      status: status(pi['status']),
    };
  }
  const rawBatteries = data['batteries'];
  if (!Array.isArray(rawBatteries) || rawBatteries.length > 32) throw new Error('Elenco batterie non valido');
  const ids = new Set<string>();
  const batteries = rawBatteries.map(raw => {
    const battery = object(raw);
    const id = text(battery['id']);
    if (ids.has(id)) throw new Error('ID batteria duplicato');
    ids.add(id);
    return {
      id,
      name: battery['name'] == null ? id : text(battery['name']),
      level_percent: measure(battery['level_percent'], 0, 100),
      voltage_v: measure(battery['voltage_v'], 0),
      current_a: measure(battery['current_a']),
      temperature_c: measure(battery['temperature_c'], -273.15),
      status: status(battery['status']),
    };
  });
  return {schema_version: 1, stamp: {sec, nanosec}, raspberry, batteries};
}
