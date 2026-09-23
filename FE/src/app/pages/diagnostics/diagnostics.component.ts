import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { TelemetryService } from '../../core/services/telemetry.service';
import type { BatteryDiagnostic, DiagnosticStatus } from '../../dtos/DiagnosticData';

const waitingBatteries: BatteryDiagnostic[] = [1, 2].map(index => ({
  id: `waiting-${index}`, name: `Batteria ${index}`, level_percent: null,
  voltage_v: null, current_a: null, temperature_c: null, status: 'unknown',
}));

@Component({
  selector: 'app-diagnostics',
  imports: [DatePipe],
  templateUrl: './diagnostics.component.html',
  styleUrl: './diagnostics.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiagnosticsComponent {
  readonly data = toSignal(inject(TelemetryService).diagnosticData$, {initialValue: null});
  readonly raspberry = computed(() => this.data()?.raspberry ?? null);
  readonly batteries = computed(() => this.data()?.batteries ?? waitingBatteries);
  readonly sampleTime = computed(() => {
    const stamp = this.data()?.stamp;
    return stamp ? stamp.sec * 1000 + stamp.nanosec / 1e6 : null;
  });

  format(value: number | null | undefined, unit: string): string {
    return value == null ? '—' : `${value.toLocaleString('it-IT', {maximumFractionDigits: 1})} ${unit}`;
  }

  uptime(seconds: number | null | undefined): string {
    if (seconds == null) return '—';
    return `${Math.floor(seconds / 3600)} h ${Math.floor(seconds % 3600 / 60)} min`;
  }

  statusLabel(status: DiagnosticStatus | undefined): string {
    switch (status) {
      case 'ok': return 'Regolare';
      case 'warning': return 'Attenzione';
      case 'error': return 'Errore';
      default: return 'Non disponibile';
    }
  }
}
