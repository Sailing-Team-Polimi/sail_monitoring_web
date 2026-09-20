// FE/src/app/core/services/map.service.ts
import { Injectable, DestroyRef, inject } from '@angular/core';
import * as L from 'leaflet';
import 'leaflet-rotatedmarker';
import { Observable } from 'rxjs';
import { MqttService } from './mqtt.service';

import { TelemetryService } from './telemetry.service';
import { CommandService } from './command.service';
import { MapData } from '../../dtos/MapData';
import { Mark } from '../../dtos/mark/Mark';
import { MarkType } from '../../dtos/mark/MarkType';
import { ClientCommandUnion } from '../../dtos/commands/ClientCommand';
import { ClientCommandFactory } from '../../dtos/commands/ClientCommandFactory';

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private map!: L.Map;
  private boatMarker: L.Marker | null = null;
  private boatIcon: L.Icon;
  private boatPath: L.LatLng[] = [];
  private trackLine: L.Polyline | null = null;

  private startLine: L.Polyline | null = null;
  private buoyMarkers: Map<MarkType, L.Marker> = new Map();
  
  // Variabile per la linea di predizione verso la linea di partenza
  private trajectoryLine: L.Polyline | null = null;

  // Malcesine
  private readonly initialLat = 45.7605;
  private readonly initialLng = 10.8091;

  constructor(private dataWsService: TelemetryService, private commandWsService: CommandService, private mqtt: MqttService) {
    const subscription = this.mqtt.role$.subscribe(role => {
      if (!role) {
        this.resetTrack();
        this.boatMarker?.remove(); this.boatMarker = null;
        this.buoyMarkers.forEach(marker => marker.remove()); this.buoyMarkers.clear();
        this.startLine?.remove(); this.startLine = null;
        this.trajectoryLine?.remove(); this.trajectoryLine = null;
      }
    });
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
    this.boatIcon = L.icon({
      iconUrl: 'assets/markers/nav.png',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  }

  public getMapDataStream(): Observable<MapData | null> {
    return this.dataWsService.mapData$;
  }

  public sendSetMark(mark: Mark): void {
    const cmd: ClientCommandUnion = ClientCommandFactory.setMark(mark);
    this.commandWsService.sendCommand(cmd);
  }

  initMap(elementId: string): void {
    if (this.map) {
      this.map.off();
      this.map.remove();
    }

    this.map = L.map(elementId, {
      center: [this.initialLat, this.initialLng],
      zoom: 10,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      minZoom: 5,  
      maxZoom: 19, 
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);

    if (!this.trackLine) {
      this.trackLine = L.polyline(this.boatPath, {
        color: 'cyan',
        weight: 2
      }).addTo(this.map);
    } else {
      this.trackLine.addTo(this.map);
    }

    if (this.trajectoryLine) this.trajectoryLine.addTo(this.map);
    if (this.boatMarker) { this.boatMarker.addTo(this.map)};
    if (this.startLine) { this.startLine.addTo(this.map)};
    this.buoyMarkers.forEach(marker => marker.addTo(this.map));
  }

  updateBoatPosition(lat: number, lon: number, yaw: number = 0): void {
    const position = L.latLng(lat, lon);
    this.boatPath.push(position);
    if (this.boatPath.length > 10000) this.boatPath.shift();

    if (this.trackLine) {
      this.trackLine.setLatLngs(this.boatPath);
    }

    if (!this.boatMarker) {
      this.boatMarker = L.marker(position, {
        icon: this.boatIcon,
        rotationAngle: yaw,
        rotationOrigin: 'center center'
      } as any).addTo(this.map);
    } else {
      this.boatMarker.setLatLng(position);
      (this.boatMarker as any).setRotationAngle(yaw);
    }
  }

  addBuoyMarker(newMark: Mark): void {
    const latLng: L.LatLngExpression = [newMark.lat, newMark.lon];
    const buoyIcon = L.icon({
      iconUrl: 'assets/markers/boa.png',
      iconSize: [30, 30],
      iconAnchor: [15, 27]
    });

    const existing = this.buoyMarkers.get(newMark.type);
    if (existing) {
      existing.setLatLng(latLng);
    } else {
      const marker = L.marker(latLng, { icon: buoyIcon }).addTo(this.map);
      this.buoyMarkers.set(newMark.type, marker);
    }
  }

  drawStartLine(comitato: Mark, pin: Mark): void {
    if (this.startLine) {
      this.map.removeLayer(this.startLine);
    }
    this.startLine = L.polyline(
      [[comitato.lat, comitato.lon], [pin.lat, pin.lon]],
      { color: 'red', weight: 2 }
    ).addTo(this.map);
  }

  // --- GESTIONE TRAIETTORIA ROSSA ---
  drawTrajectory(startLat: number, startLon: number, endLat: number, endLon: number, ttl: number): void {
    const latlngs: L.LatLngExpression[] = [
      [startLat, startLon],
      [endLat, endLon]
    ];

    if (!this.trajectoryLine) {
      this.trajectoryLine = L.polyline(latlngs, {
        color: 'red',
        dashArray: '5, 5', // Tratteggiata
        weight: 2
      }).addTo(this.map);

      // Crea l'etichetta del tempo al centro della linea
      this.trajectoryLine.bindTooltip('', { 
        permanent: true, 
        direction: 'center', 
        className: 'ttl-map-tooltip' 
      });
    } else {
      this.trajectoryLine.setLatLngs(latlngs);
    }
    
    // Aggiorna il testo con un decimale
    this.trajectoryLine.setTooltipContent(`${ttl.toFixed(1)}s`);
  }

  clearTrajectory(): void {
    if (this.trajectoryLine) {
      this.map.removeLayer(this.trajectoryLine);
      this.trajectoryLine = null;
    }
  }

  getMap(): L.Map { return this.map; }

  resetTrack(): void {
    this.boatPath = [];
    if (this.trackLine) {
      this.trackLine.setLatLngs([]);
    }
  }

  public invalidateMapSize(): void {
    if (this.map) {
      this.map.invalidateSize();
    }
  }
}
