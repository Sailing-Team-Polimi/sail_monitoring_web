import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GenericSensorCardComponent } from '../generic-sensor-card/generic-sensor-card.component';

@Component({
  selector: 'app-yaw-card',
  imports: [CommonModule, GenericSensorCardComponent],
  templateUrl: './yaw-card.component.html',
  styleUrls: ['./yaw-card.component.scss']
})
export class YawCardComponent {
  @Input() cardClass: string = '';
  @Input() title: string = 'YAW';
  @Input() value!: number;
  @Input() unit: string = '°';
  @Input() failed: boolean = false;

  previousAngle = 0;
  displayAngle = 0;

  ngOnChanges() {
    if (!this.failed) {
      const raw = Number(this.value);
      const diff = raw - (this.previousAngle % 360);

      // Semplificazione per capire se giro in avanti o indietro
      const shortest = ((diff + 540) % 360) - 180;
      this.displayAngle += shortest;
      this.previousAngle = raw;
    }
  }

}
