import { object } from './payloads';

// ROS stamps can follow bag /clock. The gateway converts remaining ROS validity
// into a transport lifetime; its wall-clock timestamp detects delayed MQTT data.
export function controlDeadlines(value: unknown, now: number): Record<string, number> {
  try {
    const envelope = object(object(value)['control_freshness']);
    const sent = envelope['sent_at_unix_ms'];
    if (typeof sent !== 'number' || !Number.isFinite(sent) || sent <= 0 || sent > now + 1000) return {};
    const remaining = object(envelope['remaining_ms']);
    const result: Record<string, number> = {};
    for (const name of ['flap', 'servo', 'indicators']) {
      const budget = remaining[name];
      if (typeof budget !== 'number' || !Number.isFinite(budget) || budget <= 0) continue;
      const left = Math.min(budget - Math.max(0, now - sent), 5000);
      if (left > 0) result[name] = now + left;
    }
    return result;
  } catch { return {}; }
}
