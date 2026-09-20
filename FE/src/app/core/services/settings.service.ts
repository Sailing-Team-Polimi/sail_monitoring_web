// FE/src/app/core/services/settings.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import { Subject, BehaviorSubject, Observable } from 'rxjs';
import { distinctUntilChanged, map, shareReplay, takeUntil } from 'rxjs/operators';
import { CommandService } from './command.service';
import { TelemetryService } from './telemetry.service';
import { MechatronicsData } from '../../dtos/MechatronicsData';
import { SensorType, SensorUnitMap } from '../../dtos/sensor/SensorType';
import { ClientCommandFactory } from '../../dtos/commands/ClientCommandFactory';
import { ClientCommandUnion } from '../../dtos/commands/ClientCommand';
import { IndicatorType } from '../../dtos/indicator/IndicatorType';
import { MethodType } from '../../dtos/indicator/MethodType';
import { TestFlapCommand } from '../../dtos/servo/TestFlapCommand';
import { ActiveSensor, activeSensorFromIndicatorValue } from '../../dtos/indicator/ActiveSensor';
import { ActuationMode, actuationModeFromIndicatorValue } from '../../dtos/indicator/ActuationMode';

@Injectable({
  providedIn: 'root',
})
export class SettingsService implements OnDestroy {
  private readonly destroy$ = new Subject<void>();
  
  private readonly snapshotSubject = new BehaviorSubject<Record<string, any>>({});
  public readonly snapshot$ = this.snapshotSubject.asObservable();

  public readonly activeSensor$: Observable<ActiveSensor | null>;
  public readonly actuationMode$: Observable<ActuationMode | null>;

  constructor(private dataWs: TelemetryService, private commandWs: CommandService) {
    this.activeSensor$ = this.dataWs.indicatorsState$.pipe(
      map((state) => activeSensorFromIndicatorValue(state?.[IndicatorType.ACTIVE_SENSOR]?.value)),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    );
    this.actuationMode$ = this.dataWs.indicatorsState$.pipe(
      map((state) => actuationModeFromIndicatorValue(state?.[IndicatorType.ACTUATION_MODE]?.value)),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.dataWs.mechatronicsData$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data: MechatronicsData | null) => {
        if (!data) { this.snapshotSubject.next({}); return; }

        const mappedData: Record<string, any> = {
          [SensorType.SERVO_LIMIT_MAX]: { value: data.servo_limit_max, unit: SensorUnitMap[SensorType.SERVO_LIMIT_MAX], failed: false },
          [SensorType.SERVO_LIMIT_MIN]: { value: data.servo_limit_min, unit: SensorUnitMap[SensorType.SERVO_LIMIT_MIN], failed: false },
        };

        this.snapshotSubject.next(mappedData);
      });
  }

  public sendUpdate(indicator: IndicatorType, method: MethodType): void {
    const cmd: ClientCommandUnion = ClientCommandFactory.update(indicator, method);
    this.commandWs.sendCommand(cmd);
  }

  public requestActiveSensorChange(): void {
    this.sendUpdate(IndicatorType.ACTIVE_SENSOR, MethodType.CHANGE);
  }

  public requestActuationModeChange(): void {
    this.sendUpdate(IndicatorType.ACTUATION_MODE, MethodType.CHANGE);
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
