// FE/src/app/pages/dashboard/dashboard.component.ts
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SensorUpdate } from '../../dtos/sensor/SensorUpdate';
import { SensorType } from '../../dtos/sensor/SensorType';
import { DashboardService } from '../../core/services/dashboard.service';
import { GenericSensorCardComponent } from '../../components/generic-sensor-card/generic-sensor-card.component';

import { YawCardComponent } from '../../components/yaw-card/yaw-card.component';

import { SensorUnitMap } from '../../dtos/sensor/SensorType';
import { Observable } from 'rxjs/internal/Observable';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, GenericSensorCardComponent, YawCardComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent {
  sensorUnitMap = SensorUnitMap;
  sensorData$: Observable<Record<SensorType, SensorUpdate & { failed: boolean }> | null>;

  constructor(private dashboardService: DashboardService) {
    this.sensorData$ = this.dashboardService.snapshot$;
  }
}