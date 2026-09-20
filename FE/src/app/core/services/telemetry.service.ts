import { Injectable, inject } from '@angular/core';
import { MqttService } from './mqtt.service';
import { Observable } from 'rxjs';
import { StateCell } from '../mqtt/state-cell';

function stream<T>(cell: StateCell<T>): Observable<T> {
  return new Observable(subscriber => cell.subscribe(subscriber));
}

@Injectable({providedIn: 'root'})
export class TelemetryService {
  private readonly mqtt = inject(MqttService);
  readonly dashboardData$ = stream(this.mqtt.dashboard$);
  readonly mapData$ = stream(this.mqtt.map$);
  readonly mechatronicsData$ = stream(this.mqtt.mechatronics$);
  readonly indicatorsState$ = stream(this.mqtt.indicators$);
  readonly recordingState$ = stream(this.mqtt.recording$);
  readonly mqttState$ = stream(this.mqtt.connection$);
}
