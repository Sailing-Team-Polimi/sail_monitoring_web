import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthRoles } from '../../dtos/auth/auth-roles';
import { MqttService } from './mqtt.service';

@Injectable({providedIn: 'root'})
export class AuthService {
  private readonly mqtt = inject(MqttService);
  readonly authRole = toSignal(this.mqtt.role$, {requireSync: true});
  readonly isLoggedIn = computed(() => this.authRole() !== null);
  readonly isAdmin = computed(() => this.authRole() === AuthRoles.Admin);
  login(username: string, password: string): Promise<void> { return this.mqtt.login(username, password); }
  logout(): void { this.mqtt.logout(); }
}
