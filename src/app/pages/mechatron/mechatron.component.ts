import { CommandService } from '../../core/services/command.service';
// FE/src/app/pages/mechatron/mechatron.component.ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';

import { SensorUpdate } from '../../dtos/sensor/SensorUpdate';
import { SensorType } from '../../dtos/sensor/SensorType';
import { MechatronicsService } from '../../core/services/mechatronics.service';
import { MechatronicsSensorCardComponent } from '../../components/mechatronics-sensor-card/mechatronics-sensor-card.component';
import { SensorUnitMap } from '../../dtos/sensor/SensorType';
import { MethodType } from '../../dtos/indicator/MethodType';
import { IndicatorType } from '../../dtos/indicator/IndicatorType';
import { ActiveSensor } from '../../dtos/indicator/ActiveSensor';

import { TelemetryService } from '../../core/services/telemetry.service';
import {
  MqttConnectionState,
  MqttConnectionStateMessage,
} from '../../dtos/mqtt/Mqtt.connection.model';
import { IndicatorsState } from '../../dtos/indicator/Indicator.telemetry';
import { RecordingState } from '../../dtos/state/RecordingState';
import { TestFlapCommand } from '../../dtos/servo/TestFlapCommand';
import { SettingsService } from '../../core/services/settings.service';

@Component({
  selector: 'app-mechatron',
  imports: [CommonModule, MechatronicsSensorCardComponent],
  templateUrl: './mechatron.component.html',
  styleUrl: './mechatron.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MechatronComponent {
  readonly commands = inject(CommandService);
  sensorUnitMap = SensorUnitMap;
  readonly IndicatorType = IndicatorType;
  readonly MethodType = MethodType;
  readonly ActiveSensor = ActiveSensor;
  readonly TestFlapCommand = TestFlapCommand;

  readonly MqttConnectionState = MqttConnectionState;

  mqttState$: Observable<MqttConnectionStateMessage>;
  sensorData$: Observable<Record<SensorType, SensorUpdate & { failed: boolean }> | null>;
  recordingState$: Observable<RecordingState | null>;
  isRecording$: Observable<boolean>;
  indicatorState$: Observable<IndicatorsState | null>;
  
  // 🟢 AGGIUNGI QUESTA DICHIARAZIONE QUI:
  activeSensor$: Observable<ActiveSensor | null>;

  constructor(
    private mechatronicsService: MechatronicsService,
    private settingsService: SettingsService, // <-- Iniettato qui
    private dataWss: TelemetryService
  ) {
    this.mqttState$ = this.dataWss.mqttState$;

    this.sensorData$ = this.mechatronicsService.snapshot$;
    this.recordingState$ = this.mechatronicsService.recordingState$;

    this.isRecording$ = this.mechatronicsService.recordingState$.pipe(
      map((state) => !!state?.recording),
      distinctUntilChanged()
    );

    this.indicatorState$ = this.mechatronicsService.indicatorsState$;
    
    // 🟢 COLLEGA L'OBSERVABLE DELLO COMPONENTE A QUELLO DEL SERVIZIO:
    this.activeSensor$ = this.settingsService.activeSensor$;
  }

  startRecording(): void {
    this.mechatronicsService.sendStartRecording();
  }

  stopRecording(): void {
    this.mechatronicsService.sendStopRecording();
  }

  updateIndicator(indicator: IndicatorType, method: MethodType): void {
    switch (indicator) {
      case IndicatorType.SERVO_LIMIT_MAX:
      case IndicatorType.SERVO_LIMIT_MIN:
      case IndicatorType.KP:
      case IndicatorType.KI:
      case IndicatorType.KD:
      case IndicatorType.HEIGHT_TARGET:
        this.mechatronicsService.sendUpdate(indicator, method);
        break;
    }
  }

  sendTestCommand(command: TestFlapCommand): void {
    this.mechatronicsService.sendTestCommand(command);
  }
}
