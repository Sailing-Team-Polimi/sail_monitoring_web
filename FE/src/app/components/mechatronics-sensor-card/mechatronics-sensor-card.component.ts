import { CommonModule } from '@angular/common';
import { Component, Input, ContentChild, TemplateRef } from '@angular/core';

@Component({
  selector: 'app-mechatronics-sensor-card',
  imports: [CommonModule],
  templateUrl: './mechatronics-sensor-card.component.html',
  styleUrl: './mechatronics-sensor-card.component.scss',
})
export class MechatronicsSensorCardComponent {
  @Input() value: number | string = '';
  @Input() unit?: string;
  @Input() failed: boolean = false;

  @ContentChild(TemplateRef) customContent?: TemplateRef<any>;

  get hasCustomContent(): boolean {
    return !!this.customContent;
  }
}
