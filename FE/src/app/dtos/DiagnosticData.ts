import type { TimeStamp } from './common/TimeStamp';

/** Provisional MQTT/ROS contract v1. Units are explicit; null means unavailable. */
export type DiagnosticStatus = 'ok' | 'warning' | 'error' | 'unknown';

export interface RaspberryDiagnostic {
  temperature_c: number | null;
  cpu_usage_percent: number | null;
  memory_usage_percent: number | null;
  uptime_s: number | null;
  status: DiagnosticStatus;
}

export interface BatteryDiagnostic {
  id: string;
  name: string;
  level_percent: number | null;
  voltage_v: number | null;
  current_a: number | null;
  temperature_c: number | null;
  status: DiagnosticStatus;
}

export interface DiagnosticData {
  schema_version: 1;
  stamp: TimeStamp;
  raspberry: RaspberryDiagnostic | null;
  batteries: BatteryDiagnostic[];
}
