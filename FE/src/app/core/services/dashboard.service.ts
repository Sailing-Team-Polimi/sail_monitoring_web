// FE/src/app/core/services/dashboard.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { TelemetryService } from './telemetry.service';
import { DashboardData } from '../../dtos/DashboardData';
import { SensorType, SensorUnitMap } from '../../dtos/sensor/SensorType';

@Injectable({
  providedIn: 'root'
})
export class DashboardService implements OnDestroy {
  private readonly destroy$ = new Subject<void>();
  
  // Usiamo un BehaviorSubject per mantenere in memoria l'ultimo stato valido
  private readonly snapshotSubject = new BehaviorSubject<Record<string, any>>({});
  public readonly snapshot$ = this.snapshotSubject.asObservable();

  constructor(private dataWsService: TelemetryService) {
    this.dataWsService.dashboardData$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data: DashboardData | null) => {
        if (!data) { this.snapshotSubject.next({}); return; }
        
        // I flag delle sorgenti impediscono di mostrare valori memorizzati come validi.
        const mappedData: Record<string, any> = {
          [SensorType.ROLL]: { value: data.roll, unit: SensorUnitMap[SensorType.ROLL], failed: data.imu_fresh !== true },
          [SensorType.PITCH]: { value: data.pitch, unit: SensorUnitMap[SensorType.PITCH], failed: data.imu_fresh !== true },
          [SensorType.YAW]: { value: data.yaw, unit: SensorUnitMap[SensorType.YAW], failed: data.imu_fresh !== true },
          [SensorType.SOG]: { value: data.sog, unit: SensorUnitMap[SensorType.SOG], failed: data.velocity_fresh !== true },
          [SensorType.VMG]: { value: data.vmg, unit: SensorUnitMap[SensorType.VMG], failed: data.wind_fresh !== true },
          [SensorType.TWA]: { value: data.twa, unit: SensorUnitMap[SensorType.TWA], failed: data.wind_fresh !== true },
          [SensorType.TWD]: { value: data.twd, unit: SensorUnitMap[SensorType.TWD], failed: data.wind_fresh !== true },
          [SensorType.TWS]: { value: data.tws, unit: SensorUnitMap[SensorType.TWS], failed: data.wind_fresh !== true }
        };

        this.snapshotSubject.next(mappedData);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}