import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { HeaderComponent } from './components/header/header.component';
import { AuthService } from './core/services/auth.service';
import { MqttService } from './core/services/mqtt.service';

@Component({
  selector: 'app-root', imports: [RouterOutlet, HeaderComponent],
  templateUrl: './app.component.html', styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly mqtt = inject(MqttService);
  readonly isLoggedIn = this.auth.isLoggedIn;
  readonly authRole = this.auth.authRole;
  readonly feedback = toSignal(this.mqtt.feedback$, {requireSync: true});
  readonly dashboard = toSignal(this.mqtt.dashboard$, {requireSync: true});
  constructor() {
    effect(() => {
      if (!this.isLoggedIn()) void this.router.navigate(['/login']);
      else if (this.router.url === '/login' || this.router.url === '/') void this.router.navigate(['/dashboard']);
    });
  }
  onLogout(): void { this.auth.logout(); }
}
