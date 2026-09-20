// FE/src/app/core/services/mechatronics.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CommandService } from './command.service';
import { TelemetryService } from './telemetry.service';
import { MechatronicsData } from '../../dtos/MechatronicsData';
import { SensorType, SensorUnitMap } from '../../dtos/sensor/SensorType';
import { ClientCommandFactory } from '../../dtos/commands/ClientCommandFactory';
import { RecordingState } from '../../dtos/state/RecordingState';
import { ClientCommandUnion } from '../../dtos/commands/ClientCommand';
import { IndicatorType } from '../../dtos/indicator/IndicatorType';
import { MethodType } from '../../dtos/indicator/MethodType';
import { IndicatorsState } from '../../dtos/indicator/Indicator.telemetry';
import { TestFlapCommand } from '../../dtos/servo/TestFlapCommand';

@Injectable({
  providedIn: 'root',
})
export class MechatronicsService implements OnDestroy {
  private readonly destroy$ = new Subject<void>();
  
  private readonly snapshotSubject = new BehaviorSubject<Record<string, any>>({});
  public readonly snapshot$ = this.snapshotSubject.asObservable();

  private readonly recordingStateSubject = new BehaviorSubject<RecordingState | null>(null);
  public readonly recordingState$ = this.recordingStateSubject.asObservable();

  private readonly indicatorsStateSubject = new BehaviorSubject<IndicatorsState | null>(null);
  public readonly indicatorsState$ = this.indicatorsStateSubject.asObservable();

  constructor(private dataWs: TelemetryService, private commandWs: CommandService) {
    this.dataWs.mechatronicsData$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data: MechatronicsData | null) => {
        if (!data) { this.snapshotSubject.next({}); return; }

        const mappedData: Record<string, any> = {
          [SensorType.SERVO_LIMIT_MAX]: { value: data.servo_limit_max, unit: SensorUnitMap[SensorType.SERVO_LIMIT_MAX], failed: false },
          [SensorType.SERVO_LIMIT_MIN]: { value: data.servo_limit_min, unit: SensorUnitMap[SensorType.SERVO_LIMIT_MIN], failed: false },
          [SensorType.KP]: { value: data.kp, unit: SensorUnitMap[SensorType.KP], failed: false },
          [SensorType.KI]: { value: data.ki, unit: SensorUnitMap[SensorType.KI], failed: false },
          [SensorType.KD]: { value: data.kd, unit: SensorUnitMap[SensorType.KD], failed: false },
          [SensorType.CURRENT_HEIGHT_EST_WAND]: { value: data.current_height_est_wand, unit: SensorUnitMap[SensorType.CURRENT_HEIGHT_EST_WAND], failed: false },
          [SensorType.CURRENT_HEIGHT_EST_ULTRASOUND]: { value: data.current_height_est_ultrasound, unit: SensorUnitMap[SensorType.CURRENT_HEIGHT_EST_ULTRASOUND], failed: false },
          [SensorType.ULTRASOUND_DATA]: { value: data.ultrasound_data, unit: SensorUnitMap[SensorType.ULTRASOUND_DATA], failed: false },
          [SensorType.HEIGHT_TARGET]: { value: data.height_target, unit: SensorUnitMap[SensorType.HEIGHT_TARGET], failed: false },
          [SensorType.FLAP_ANGLE_OUT]: { value: data.flap_angle_out, unit: SensorUnitMap[SensorType.FLAP_ANGLE_OUT], failed: false },
          [SensorType.SERVO_ANGLE_OUT]: { value: data.servo_angle_out, unit: SensorUnitMap[SensorType.SERVO_ANGLE_OUT], failed: false },
          [SensorType.ROLL]: { value: data.roll, unit: SensorUnitMap[SensorType.ROLL], failed: false },
          [SensorType.PITCH]: { value: data.pitch, unit: SensorUnitMap[SensorType.PITCH], failed: false },
          [SensorType.WAND_ANGLE]: { value: data.wand_angle, unit: SensorUnitMap[SensorType.WAND_ANGLE], failed: false }
        };

        this.snapshotSubject.next(mappedData);
      });

    this.dataWs.recordingState$
      .pipe(takeUntil(this.destroy$))
      .subscribe((state: RecordingState | null) => {
        this.recordingStateSubject.next(state);
      });

    this.dataWs.indicatorsState$
      .pipe(takeUntil(this.destroy$))
      .subscribe((state: IndicatorsState | null) => {
        this.indicatorsStateSubject.next(state);
      });
  }

  public sendStartRecording(): void {
    const cmd = ClientCommandFactory.startRecording();
    this.commandWs.sendCommand(cmd);
  }

  public sendStopRecording(): void {
    const cmd = ClientCommandFactory.stopRecording();
    this.commandWs.sendCommand(cmd);
  }

  public sendUpdate(indicator: IndicatorType, method: MethodType) : void {
    const cmd: ClientCommandUnion = ClientCommandFactory.update(indicator, method);
    this.commandWs.sendCommand(cmd);
  }

  public sendTestCommand(command: TestFlapCommand): void {
    const cmd: ClientCommandUnion = ClientCommandFactory.sendTestCommand(command); 
    this.commandWs.sendCommand(cmd);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}