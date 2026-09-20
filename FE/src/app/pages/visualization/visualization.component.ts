import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { DashboardService } from '../../core/services/dashboard.service';
import { MechatronicsService } from '../../core/services/mechatronics.service';
import { IndicatorType } from '../../dtos/indicator/IndicatorType';
import { ActiveSensor, activeSensorFromIndicatorValue } from '../../dtos/indicator/ActiveSensor';

@Component({
  selector: 'app-visualization',
  imports: [CommonModule],
  templateUrl: './visualization.component.html',
  styleUrl: './visualization.component.scss',
})
export class VisualizationComponent {
  dashboardData$;
  sensorData$;
  indicatorState$;

  readonly IndicatorType = IndicatorType;
  readonly ActiveSensor = ActiveSensor;

  readonly totalHeight = 6.601;
  readonly minCurrentHeight = -1.0;
  readonly maxCurrentHeight = 1.0;

  // Funzioni Clamp protette
  clampAngle(angle: number | null | undefined): number {
    const safeAngle = angle ?? 0;
    return Math.max(-90, Math.min(90, safeAngle));
  }

  clampHeight(height: number | null | undefined): number {
    const safeHeight = height ?? 0;
    return Math.max(this.minCurrentHeight, Math.min(this.maxCurrentHeight, safeHeight));
  }

  // Estrazione sicura: prende l'oggetto intero e restituisce SOLO un numero
  getActiveHeightValue(sensorData: any, indicatorState: any): number {
    if (!sensorData) return 0;
    
    const activeSensor = activeSensorFromIndicatorValue(indicatorState?.[IndicatorType.ACTIVE_SENSOR]?.value);
    const isUltrasoundActive = activeSensor === ActiveSensor.ULTRASOUND;
    
    if (isUltrasoundActive) {
      // Usiamo l'optional chaining fino in fondo
      return sensorData.CURRENT_HEIGHT_EST_ULTRASOUND?.value ?? 0;
    } else {
      return sensorData.CURRENT_HEIGHT_EST_WAND?.value ?? 0;
    }
  }

  // Estrazione sicura del Roll
  getRollValue(dashboard: any): number {
    return dashboard?.ROLL?.value ?? 0;
  }

  // Estrazione sicura del Pitch
  getPitchValue(dashboard: any): number {
    return dashboard?.PITCH?.value ?? 0;
  }

  constructor(
    private dashboardService: DashboardService,
    private mechatronicsService: MechatronicsService,
  ) {
    this.dashboardData$ = this.dashboardService.snapshot$;
    this.sensorData$ = this.mechatronicsService.snapshot$;
    this.indicatorState$ = this.mechatronicsService.indicatorsState$;
  }
}
