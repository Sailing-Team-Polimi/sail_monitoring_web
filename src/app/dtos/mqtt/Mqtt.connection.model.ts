// FE/src/app/dtos/mqtt/Mqtt.connection.model.ts
import type { TimeStamp } from '../common/TimeStamp';

export enum MqttConnectionState {
  CONNECTED = 'connected',
  CONNECTING = 'connecting',
  RECONNECTING = 'reconnecting',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  OFFLINE = 'offline',
}

export interface MqttConnectionStateMessage {
  status: MqttConnectionState;
  stamp: TimeStamp;
}
