export enum ActiveSensor {
  WAND = 0,
  ULTRASOUND = 1,
}

export function activeSensorFromIndicatorValue(value: number | null | undefined): ActiveSensor | null {
  if (value === ActiveSensor.WAND) return ActiveSensor.WAND;
  if (value === ActiveSensor.ULTRASOUND) return ActiveSensor.ULTRASOUND;
  return null;
}
