// dtos/sensor/SensorType.ts
export enum SensorType {
  PITCH = 'PITCH',
  WAND_ANGLE = 'WAND_ANGLE',
  SOG = 'SOG',
  VMG = 'VMG',
  TWA = 'TWA',
  TWD = 'TWD',
  TWS = 'TWS',
  YAW = 'YAW',

  SERVO_LIMIT_MAX = 'SERVO_LIMIT_MAX',
  SERVO_LIMIT_MIN = 'SERVO_LIMIT_MIN',
  
  // --- RIMOSSO CURRENT_HEIGHT, AGGIUNTI I NUOVI ---
  CURRENT_HEIGHT_EST_WAND = 'CURRENT_HEIGHT_EST_WAND',
  CURRENT_HEIGHT_EST_ULTRASOUND = 'CURRENT_HEIGHT_EST_ULTRASOUND',
  ULTRASOUND_DATA = 'ULTRASOUND_DATA',

  HEIGHT_TARGET = 'HEIGHT_TARGET',
  FLAP_ANGLE_OUT = 'FLAP_ANGLE_OUT',
  SERVO_ANGLE_OUT = 'SERVO_ANGLE_OUT',
  ROLL = 'ROLL',
  KP = 'KP',
  KI = 'KI',
  KD = 'KD',
}

export const SensorUnitMap: Record<SensorType, string> = {
  [SensorType.PITCH]: '°',
  [SensorType.WAND_ANGLE]: '°',
  [SensorType.SOG]: 'kn',
  [SensorType.VMG]: 'kn',
  [SensorType.TWA]: '°',
  [SensorType.TWD]: '°',
  [SensorType.TWS]: 'kn',

  [SensorType.SERVO_LIMIT_MAX]: '°',
  [SensorType.SERVO_LIMIT_MIN]: '°',
  
  [SensorType.CURRENT_HEIGHT_EST_WAND]: 'm',
  [SensorType.CURRENT_HEIGHT_EST_ULTRASOUND]: 'm',
  [SensorType.ULTRASOUND_DATA]: 'm',

  [SensorType.HEIGHT_TARGET]: 'm',
  [SensorType.FLAP_ANGLE_OUT]: '°',
  [SensorType.SERVO_ANGLE_OUT]: '°',
  [SensorType.ROLL]: '°',
  [SensorType.KP]: ' ',
  [SensorType.KI]: ' ',
  [SensorType.KD]: ' ',
  [SensorType.YAW]: '°',
};