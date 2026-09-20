import { CommandService } from '../../core/services/command.service';
// FE/src/app/pages/map/map.component.ts
import { Component, OnInit, OnDestroy, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';

import { MapService } from '../../core/services/map.service';
import { TelemetryService } from '../../core/services/telemetry.service';

import { MapData } from '../../dtos/MapData';
import { MarkType } from '../../dtos/mark/MarkType';
import { Mark } from '../../dtos/mark/Mark';
import { getMarkOfType } from '../../utils/marks';

import { MqttConnectionState, MqttConnectionStateMessage, } from '../../dtos/mqtt/Mqtt.connection.model';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
  imports: [CommonModule, FormsModule],
})
export class MapComponent implements OnInit, OnDestroy {
  readonly commands = inject(CommandService);
  private readonly destroyRef = inject(DestroyRef);
  ngOnDestroy(): void { this.mapService.getMap()?.remove(); }
  public twd: number = 0;
  public tws: number = 0;
  mqttState$: Observable<MqttConnectionStateMessage>;
  readonly MqttConnectionState = MqttConnectionState;

  private currentLat: number | null = null;
  private currentLon: number | null = null;
  
  // Variabili esportate all'HTML
  public dtl: number | null = null;
  public ttl: number | null = null;

  private pinCoordinates: Mark | null = null;
  private comitatoCoordinates: Mark | null = null;
  private bolinaCoordinates: Mark | null = null;

  public markTypes = MarkType;
  public selectedMarkType: MarkType = Object.values(MarkType)[0] as MarkType;

  constructor(private mapService: MapService, private dataWs: TelemetryService) {
    this.mqttState$ = this.dataWs.mqttState$;
  }

  ngOnInit(): void {
    this.mapService.initMap('map');
    this.setupMapDataSubscription();
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event): void {
    this.mapService.invalidateMapSize();
  }

  private setupMapDataSubscription(): void {
    this.mapService.getMapDataStream().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data: MapData | null) => {
      if (!data) { this.currentLat = null; this.currentLon = null; this.dtl = null; this.ttl = null; this.mapService.clearTrajectory(); return; }
      this.currentLat = data.lat;
      this.currentLon = data.lon;
      this.twd = data.twd;
      this.tws = data.tws;
      
      this.dtl = data.dtl;
      this.ttl = data.ttl;

      this.mapService.updateBoatPosition(data.lat, data.lon, data.yaw);

      const marks = data.marks ?? [];
      const buoyTypes: { type: MarkType; setter: (m: Mark) => void }[] = [
        { type: MarkType.COMITATO, setter: (m) => (this.comitatoCoordinates = m) },
        { type: MarkType.PIN, setter: (m) => (this.pinCoordinates = m) },
        { type: MarkType.BOLINA, setter: (m) => (this.bolinaCoordinates = m) },
      ];

      for (const { type, setter } of buoyTypes) {
        const mark = getMarkOfType(marks, type);
        if (mark) {
          setter(mark);
          this.mapService.addBuoyMarker(mark);
        }
      }

      // --- DISEGNO TRAIETTORIA ---
      if (this.ttl !== -1 && this.ttl !== null && 
          this.comitatoCoordinates && this.pinCoordinates && 
          this.currentLat && this.currentLon) {
        
        const intersection = this.calculateIntersection(
          this.currentLat, this.currentLon, data.yaw, 
          this.comitatoCoordinates, this.pinCoordinates
        );

        if (intersection) {
          // Disegna la retta e aggancia il tooltip col tempo
          this.mapService.drawTrajectory(
            this.currentLat, this.currentLon, 
            intersection.lat, intersection.lon, 
            this.ttl
          );
        } else {
          this.mapService.clearTrajectory();
        }
      } else {
        // ttl è -1, la barca non interseca o si allontana
        this.mapService.clearTrajectory();
      }
    });
  }

  private calculateIntersection(latC: number, lonC: number, yaw: number, comitato: Mark, pin: Mark): {lat: number, lon: number} | null {
    const yawRad = yaw * Math.PI / 180;
    const vx = Math.sin(yawRad); 
    const vy = Math.cos(yawRad); 

    const latA = comitato.lat;
    const lonA = comitato.lon;
    const latB = pin.lat;
    const lonB = pin.lon;

    const denom = (lonB - lonA) * vy - (latB - latA) * vx;
    if (Math.abs(denom) < 0.000001) return null;

    const t = ((lonC - lonA) * vy - (latC - latA) * vx) / denom;

    // t tra 0 e 1 assicura che il colpo avvenga ESATTAMENTE sul segmento tra le due boe
    if (t >= 0 && t <= 1) {
      return {
        lat: latA + t * (latB - latA),
        lon: lonA + t * (lonB - lonA)
      };
    }
    return null;
  }

  pingBoa(): void {
    if (this.currentLat === null || this.currentLon === null) {
      console.warn('[Ping] Nessuna posizione barca disponibile.');
      return;
    }
    const newMark: Mark = {
      type: this.selectedMarkType,
      lat: this.currentLat,
      lon: this.currentLon,
    };
    this.mapService.sendSetMark(newMark);
  }

  drawLine(): void {
    if (this.comitatoCoordinates && this.pinCoordinates) {
      this.mapService.drawStartLine(this.comitatoCoordinates, this.pinCoordinates);
    }
  }

  resetTrack(): void {
    this.mapService.resetTrack();
  }
}