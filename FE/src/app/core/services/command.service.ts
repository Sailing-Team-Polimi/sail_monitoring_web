import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MqttService } from './mqtt.service';
import { ClientCommandUnion } from '../../dtos/commands/ClientCommand';
import { ClientCommandFactory } from '../../dtos/commands/ClientCommandFactory';
import { AuthRoles } from '../../dtos/auth/auth-roles';
import { MqttConnectionState } from '../../dtos/mqtt/Mqtt.connection.model';
import { TOPICS } from '../mqtt/topics';

@Injectable({providedIn: 'root'})
export class CommandService {
  private readonly mqtt = inject(MqttService);
  private readonly tick = toSignal(this.mqtt.tick$, {requireSync: true});
  private readonly pending = toSignal(this.mqtt.pending$, {requireSync: true});
  private readonly state = toSignal(this.mqtt.connection$, {requireSync: true});
  private readonly role = toSignal(this.mqtt.role$, {requireSync: true});
  readonly recording = toSignal(this.mqtt.recording$, {requireSync: true});
  private available(topic: string): boolean {
    this.tick();
    return this.role() === AuthRoles.Admin && this.state().status === MqttConnectionState.CONNECTED && this.mqtt.fresh(topic);
  }
  readonly canUpdate = computed(() => this.available(TOPICS.indicators));
  readonly canTest = computed(() => this.available(TOPICS.mechatronics));
  readonly canSetMark = computed(() => this.available(TOPICS.map));
  readonly canStart = computed(() => {
    this.tick(); this.pending(); this.recording(); this.state(); this.role();
    return this.mqtt.canCommand(ClientCommandFactory.startRecording());
  });
  readonly canStop = computed(() => {
    this.tick(); this.pending(); this.recording(); this.state(); this.role();
    return this.mqtt.canCommand(ClientCommandFactory.stopRecording());
  });
  sendCommand(command: ClientCommandUnion): void { this.mqtt.send(command); }
}
