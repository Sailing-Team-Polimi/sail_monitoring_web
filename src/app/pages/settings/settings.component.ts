import { CommandService } from '../../core/services/command.service';
// FE/src/app/pages/settings/settings.component.ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';

import { SensorUpdate } from '../../dtos/sensor/SensorUpdate';
import { SensorType, SensorUnitMap } from '../../dtos/sensor/SensorType';
import { SettingsService } from '../../core/services/settings.service';
import { MechatronicsSensorCardComponent } from '../../components/mechatronics-sensor-card/mechatronics-sensor-card.component';
import { IndicatorType } from '../../dtos/indicator/IndicatorType';
import { MethodType } from '../../dtos/indicator/MethodType';
import { TelemetryService } from '../../core/services/telemetry.service';
import { MqttConnectionState, MqttConnectionStateMessage } from '../../dtos/mqtt/Mqtt.connection.model';
import { TestFlapCommand } from '../../dtos/servo/TestFlapCommand';
import { ActiveSensor } from '../../dtos/indicator/ActiveSensor';
import { ActuationMode } from '../../dtos/indicator/ActuationMode';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, MechatronicsSensorCardComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  readonly commands = inject(CommandService);
  sensorUnitMap = SensorUnitMap;
  readonly IndicatorType = IndicatorType;
  readonly MethodType = MethodType;
  readonly ActiveSensor = ActiveSensor;
  readonly ActuationMode = ActuationMode;
  readonly TestFlapCommand = TestFlapCommand;
  readonly MqttConnectionState = MqttConnectionState;

  mqttState$: Observable<MqttConnectionStateMessage>;
  sensorData$: Observable<Record<SensorType, SensorUpdate & { failed: boolean }> | null>;
  activeSensor$: Observable<ActiveSensor | null>;
  actuationMode$: Observable<ActuationMode | null>;

  constructor(private settingsService: SettingsService, private dataWss: TelemetryService) {
    this.mqttState$ = this.dataWss.mqttState$;
    this.sensorData$ = this.settingsService.snapshot$;
    this.activeSensor$ = this.settingsService.activeSensor$;
    this.actuationMode$ = this.settingsService.actuationMode$;
  }

  changeActiveSensor(): void {
    this.settingsService.requestActiveSensorChange();
  }

  changeActuationMode(): void {
    this.settingsService.requestActuationModeChange();
  }

  updateIndicator(indicator: IndicatorType, method: MethodType): void {
    // Gestiamo solo i limiti del servo qui
    if (indicator === IndicatorType.SERVO_LIMIT_MAX || indicator === IndicatorType.SERVO_LIMIT_MIN) {
      this.settingsService.sendUpdate(indicator, method);
    }
  }

  sendTestCommand(command: TestFlapCommand): void {
    this.settingsService.sendTestCommand(command);
  }
}
