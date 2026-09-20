// FE/src/app/dtos/indicator/Indicator.telemetry.ts
import { IndicatorType } from './IndicatorType';

export interface IndicatorTelemetry {
  value: number;
  failed: boolean;
  canIncrease: boolean;
  canDecrease: boolean;
}

export type IndicatorsState = Record<IndicatorType, IndicatorTelemetry>;
