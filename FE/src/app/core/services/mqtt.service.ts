import { Injectable, OnDestroy } from '@angular/core';
import mqtt from 'mqtt';
import { APP_CONFIG } from '../mqtt/app-config';
import { MqttSession } from '../mqtt/mqtt-session';

@Injectable({providedIn: 'root'})
export class MqttService extends MqttSession implements OnDestroy {
  constructor() {
    super((url, options) => mqtt.connect(url, options), APP_CONFIG);
    window.addEventListener('pagehide', this.onPageHide);
  }
  private readonly onPageHide = () => this.logout();
  ngOnDestroy(): void {
    window.removeEventListener('pagehide', this.onPageHide);
    this.destroy();
  }
}
