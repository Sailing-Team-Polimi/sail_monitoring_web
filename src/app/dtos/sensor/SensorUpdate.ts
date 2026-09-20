//dtos/sensor/SensorUpdate.ts
import { SensorType } from './SensorType';

export interface SensorUpdate {
  type: SensorType;
  value: number;
  unit: string;
  timestamp: number;
}
