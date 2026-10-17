
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { AuthRoles } from '../../dtos/auth/auth-roles';
import { TelemetryService } from '../../core/services/telemetry.service';
import { MqttConnectionState } from '../../dtos/mqtt/Mqtt.connection.model';

@Component({
    selector: 'app-header',
    imports: [RouterLink, RouterLinkActive, NgTemplateOutlet],
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
    private dataWs = inject(TelemetryService);
    mqttStateSignal = toSignal(this.dataWs.mqttState$, { initialValue: null });

    authRole = input.required<AuthRoles | null>();
    logout = output<void>();

    // Stato per il menu mobile
    showMobileMenu = false;

    // #region Computed Signals
    mqttStatus = computed(() => {
        const status = this.mqttStateSignal()?.status;
        if (status === MqttConnectionState.CONNECTED) return 'connected';
        if (status === MqttConnectionState.CONNECTING || status === MqttConnectionState.RECONNECTING) return 'connecting';
        return 'disconnected';
    });
    mqttDescription = computed(() => {
        switch (this.mqttStatus()) {
            case 'connected': return 'Connesso al broker; la disponibilità dei sensori è separata';
            case 'connecting': return 'Connessione al broker in corso';
            default: return 'Disconnesso dal broker';
        }
    });
    isAdmin = computed(() => this.authRole() === AuthRoles.Admin);
    // #endregion

    readonly MqttConnectionState = MqttConnectionState;
    readonly AuthRoles = AuthRoles;

    toggleMobileMenu() {
        this.showMobileMenu = !this.showMobileMenu;
    }
}
