import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { APP_CONFIG } from '../../core/mqtt/app-config';

@Component({
  selector: 'app-login', imports: [FormsModule],
  templateUrl: './login.component.html', styleUrl: './login.component.scss',
})
export class LoginComponent {
  username = '';
  password = '';
  errorMsg = '';
  isLoading = false;
  readonly configured = Boolean(APP_CONFIG.brokerUrl);
  private readonly auth = inject(AuthService);
  async onSubmit(): Promise<void> {
    if (this.isLoading) return;
    this.isLoading = true; this.errorMsg = '';
    const password = this.password;
    this.password = '';
    try { await this.auth.login(this.username, password); }
    catch (error) { this.errorMsg = (error as Error).message; }
    finally { this.isLoading = false; }
  }
}
