export enum ActuationMode {
  PUSH = 0,
  PULL = 1,
}

export function actuationModeFromIndicatorValue(value: number | null | undefined): ActuationMode | null {
  if (value === ActuationMode.PUSH) return ActuationMode.PUSH;
  if (value === ActuationMode.PULL) return ActuationMode.PULL;
  return null;
}
