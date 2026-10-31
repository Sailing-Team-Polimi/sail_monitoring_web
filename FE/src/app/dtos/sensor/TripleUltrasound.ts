import type { TimeStamp } from '../common/TimeStamp';

export interface TripleUltrasound {
  stamp: TimeStamp;
  sequence_id: number;
  left_mm: number;
  center_mm: number;
  right_mm: number;
  left_valid: boolean;
  center_valid: boolean;
  right_valid: boolean;
}

export interface UltrasoundReading {
  label: string;
  meters: number | null;
  state: 'valid' | 'invalid' | 'unavailable';
}

// Use source freshness from ROS; browser and Raspberry clocks need not agree.
export function ultrasoundReadings(data: {
  ultrasound: TripleUltrasound | null; ultrasound_fresh: boolean;
} | null): UltrasoundReading[] {
  const sample = data?.ultrasound;
  return (['left', 'center', 'right'] as const).map((side, index) => {
    const label = ['SX', 'Centro', 'DX'][index];
    if (!sample || !data?.ultrasound_fresh) return {label, meters: null, state: 'unavailable'};
    const valid = sample[`${side}_valid`] && sample[`${side}_mm`] <= 0xFFFC;
    return {label, meters: valid ? sample[`${side}_mm`] / 1000 : null,
      state: valid ? 'valid' : 'invalid'};
  });
}
