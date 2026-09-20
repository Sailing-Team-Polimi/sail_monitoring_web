import { StateCell as BehaviorSubject } from './state-cell';
import type { IClientOptions, MqttClient } from 'mqtt';
import { type AppConfig, brokerUrl, roleForUsername } from './app-config';
import { TOPICS } from './topics';
import { commandPayload, dashboardPayload, indicatorsPayload, mapPayload, mechatronicsPayload, object, recordingPayload } from './payloads';
import { AuthRoles } from '../../dtos/auth/auth-roles';
import type { DashboardData } from '../../dtos/DashboardData';
import type { MapData } from '../../dtos/MapData';
import type { MechatronicsData } from '../../dtos/MechatronicsData';
import type { IndicatorsState } from '../../dtos/indicator/Indicator.telemetry';
import type { RecordingState } from '../../dtos/state/RecordingState';
import type { ClientCommandUnion } from '../../dtos/commands/ClientCommand';
import { ClientCommandType } from '../../dtos/commands/ClientCommandType';
import { MethodType } from '../../dtos/indicator/MethodType';
import { MqttConnectionState as State, type MqttConnectionStateMessage } from '../../dtos/mqtt/Mqtt.connection.model';

export type Connector = (url: string, options: IClientOptions) => MqttClient;
type Credentials = {url: string; username: string; password: string; role: AuthRoles};
type Pending = {id: string; topic: string; timer: ReturnType<typeof setTimeout>};

/** Browser-side transport. Broker ACLs, not this class, are the security boundary. */
export class MqttSession {
  readonly role$ = new BehaviorSubject<AuthRoles | null>(null);
  readonly connection$ = new BehaviorSubject<MqttConnectionStateMessage>({status: State.DISCONNECTED, stamp: {sec: 0, nanosec: 0}});
  readonly dashboard$ = new BehaviorSubject<DashboardData | null>(null);
  readonly map$ = new BehaviorSubject<MapData | null>(null);
  readonly mechatronics$ = new BehaviorSubject<MechatronicsData | null>(null);
  readonly indicators$ = new BehaviorSubject<IndicatorsState | null>(null);
  readonly recording$ = new BehaviorSubject<RecordingState | null>(null);
  readonly feedback$ = new BehaviorSubject('');
  readonly pending$ = new BehaviorSubject(false);
  readonly tick$ = new BehaviorSubject(0);
  private client?: MqttClient;
  private credentials?: Credentials;
  private ready = false;
  private seen = new Map<string, number>();
  private retry?: ReturnType<typeof setTimeout>;
  private deadline?: ReturnType<typeof setTimeout>;
  private pending?: Pending;
  private resolveLogin?: () => void;
  private rejectLogin?: (error: Error) => void;
  private readonly expiryTimer: ReturnType<typeof setInterval>;

  constructor(private readonly connector: Connector, readonly config: AppConfig) {
    this.expiryTimer = setInterval(() => this.expire(), 500);
  }

  async login(username: string, password: string): Promise<void> {
    this.logout();
    const name = username.trim();
    const role = roleForUsername(name, this.config);
    if (!role) throw new Error('Utente non configurato per questa applicazione.');
    if (!password) throw new Error('Inserisci la password.');
    this.credentials = {url: brokerUrl(this.config.brokerUrl), username: name, password, role};
    return new Promise<void>((resolve, reject) => {
      this.resolveLogin = resolve;
      this.rejectLogin = reject;
      this.open();
    });
  }

  logout(): void {
    const reject = this.rejectLogin;
    this.rejectLogin = undefined;
    this.resolveLogin = undefined;
    this.credentials = undefined;
    clearTimeout(this.retry);
    clearTimeout(this.deadline);
    this.dropClient();
    this.cancelPending();
    this.clearData();
    this.role$.next(null);
    this.feedback$.next('');
    this.setState(State.DISCONNECTED);
    reject?.(new Error('Accesso annullato.'));
  }

  destroy(): void { this.logout(); clearInterval(this.expiryTimer); }

  private open(): void {
    const credentials = this.credentials;
    if (!credentials) return;
    this.setState(this.role$.value ? State.RECONNECTING : State.CONNECTING);
    let client: MqttClient;
    try {
      client = this.connector(credentials.url, {
        username: credentials.username, password: credentials.password,
        clientId: `polisail_web_${crypto.randomUUID()}`,
        protocolVersion: 5, clean: true, reconnectPeriod: 0,
        connectTimeout: this.config.connectTimeoutMs, queueQoSZero: false,
        resubscribe: false, keepalive: 30, properties: {sessionExpiryInterval: 0},
      });
    } catch { this.fail('Impossibile aprire la connessione al broker.'); return; }
    this.client = client;
    const current = () => this.client === client;
    this.deadline = setTimeout(() => {
      if (!current()) return;
      if (this.role$.value) this.connectionLost();
      else this.fail('Broker non raggiungibile o connessione scaduta.');
    }, this.config.connectTimeoutMs);

    client.on('connect', () => {
      if (!current()) return;
      // Visualization needs heights/active sensor even for guests. Hidden pages do not hide data.
      const subscriptions: string[] = [TOPICS.dashboard, TOPICS.mechatronics, TOPICS.indicators];
      if (credentials.role === AuthRoles.Admin) subscriptions.push(TOPICS.map, TOPICS.recording, TOPICS.startResponse, TOPICS.stopResponse);
      client.subscribe(subscriptions, {qos: 0, rap: false}, (error, grants) => {
        if (!current()) return;
        if (error || !grants || subscriptions.some(topic => !grants.some(grant => grant.topic === topic && Number(grant.qos) < 128))) {
          this.fail('Accesso ai dati negato. Verifica i permessi assegnati a questo utente.');
          return;
        }
        clearTimeout(this.deadline);
        this.ready = true;
        this.role$.next(credentials.role);
        this.setState(State.CONNECTED);
        this.feedback$.next('Connesso. In attesa dei dati della barca.');
        const resolve = this.resolveLogin;
        this.resolveLogin = undefined; this.rejectLogin = undefined;
        resolve?.();
      });
    });
    client.on('message', (topic, bytes, packet) => {
      if (!current() || !this.ready || packet.retain || bytes.length > this.config.maxPayloadBytes) return;
      try { this.receive(topic, JSON.parse(bytes.toString())); }
      catch { /* Reject invalid data; its last valid sample expires normally. */ }
    });
    client.on('disconnect', packet => {
      if (!current()) return;
      if ([0x86, 0x87, 0x8a].includes(packet.reasonCode ?? 0)) this.fail('Accesso rifiutato dal broker. Controlla credenziali e permessi.');
    });
    client.on('error', error => {
      if (!current()) return;
      const code = Number((error as Error & {code?: number}).code);
      if (!this.role$.value || [4, 5, 0x86, 0x87, 0x8a].includes(code)) {
        this.fail('Accesso non riuscito. Controlla credenziali, connessione e permessi.');
      } else this.connectionLost();
    });
    client.on('close', () => {
      if (!current()) return;
      if (!this.role$.value) this.fail('Connessione interrotta prima di completare l’accesso.');
      else this.connectionLost();
    });
  }

  private fail(message: string): void {
    const reject = this.rejectLogin;
    const uncertain = this.pending !== undefined;
    this.rejectLogin = undefined; this.resolveLogin = undefined;
    this.logout();
    this.feedback$.next(message + (uncertain ? ' Esito del comando in corso sconosciuto: verifica lo stato della barca.' : ''));
    this.setState(State.ERROR);
    reject?.(new Error(message));
  }

  private dropClient(): void {
    this.ready = false;
    const client = this.client;
    this.client = undefined;
    if (!client) return;
    // A new MQTT.js client is used after every outage: no old command queue is replayed.
    client.end(true);
    client.options.password = undefined;
    client.options.username = undefined;
  }

  private connectionLost(): void {
    clearTimeout(this.deadline);
    clearTimeout(this.retry);
    this.dropClient();
    this.cancelPending();
    this.clearData();
    this.feedback$.next('Connessione persa. I comandi non vengono reinviati; verifica lo stato al rientro.');
    this.setState(State.RECONNECTING);
    this.retry = setTimeout(() => this.open(), this.config.reconnectMs);
  }

  private setState(status: State): void {
    const ms = Date.now();
    this.connection$.next({status, stamp: {sec: Math.floor(ms / 1000), nanosec: (ms % 1000) * 1e6}});
  }

  private receive(topic: string, data: unknown): void {
    switch (topic) {
      case TOPICS.dashboard: this.dashboard$.next(dashboardPayload(data)); break;
      case TOPICS.map: this.map$.next(mapPayload(data)); break;
      case TOPICS.mechatronics: this.mechatronics$.next(mechatronicsPayload(data)); break;
      case TOPICS.indicators: this.indicators$.next(indicatorsPayload(data)); break;
      case TOPICS.recording: this.recording$.next(recordingPayload(data)); break;
      case TOPICS.startResponse:
      case TOPICS.stopResponse: this.response(topic, data); return;
      default: return;
    }
    this.seen.set(topic, Date.now());
    this.tick$.next(this.tick$.value + 1);
  }

  fresh(topic: string): boolean {
    const time = this.seen.get(topic);
    const ttl = topic === TOPICS.recording ? this.config.recordingTimeoutMs : this.config.dataTimeoutMs;
    return time !== undefined && Date.now() - time < ttl;
  }

  canCommand(command: ClientCommandUnion): boolean {
    if (!this.ready || !this.client?.connected || this.role$.value !== AuthRoles.Admin) return false;
    switch (command.type) {
      case ClientCommandType.StartRecording: return !this.pending && this.fresh(TOPICS.recording) && this.recording$.value?.recording === false;
      case ClientCommandType.StopRecording: return !this.pending && this.fresh(TOPICS.recording) && this.recording$.value?.recording === true;
      case ClientCommandType.SetMark: return this.fresh(TOPICS.map);
      case ClientCommandType.Update: {
        const indicator = this.indicators$.value?.[command.payload.indicator];
        if (!this.fresh(TOPICS.indicators) || !indicator || indicator.failed) return false;
        if (command.payload.method === MethodType.INCREASE) return indicator.canIncrease;
        if (command.payload.method === MethodType.DECREASE) return indicator.canDecrease;
        return true;
      }
      case ClientCommandType.TestCommand: return this.fresh(TOPICS.mechatronics);
    }
  }

  send(command: ClientCommandUnion): void {
    if (!this.canCommand(command)) {
      this.feedback$.next('Comando non inviato: controlla accesso, connessione e disponibilità di dati aggiornati.');
      return;
    }
    if (command.type === ClientCommandType.StartRecording || command.type === ClientCommandType.StopRecording) {
      const start = command.type === ClientCommandType.StartRecording;
      const id = crypto.randomUUID();
      const timer = setTimeout(() => this.recordingUnknown(id, 'Risposta non ricevuta: esito sconosciuto. Attendi un nuovo stato della barca.'), this.config.commandTimeoutMs);
      this.pending = {id, topic: start ? TOPICS.startResponse : TOPICS.stopResponse, timer};
      this.pending$.next(true);
      this.feedback$.next('Richiesta inviata. In attesa della conferma della barca…');
      this.publish(start ? TOPICS.start : TOPICS.stop, {requestId: id}, 1, () => this.recordingUnknown(id, 'Invio non confermato: esito sconosciuto. Verifica lo stato della barca.'));
    } else {
      try {
        const {topic, payload} = commandPayload(command);
        // Increment/toggle commands are not idempotent: never queue or retransmit them.
        this.feedback$.next('Comando inviato. Verifica l’aggiornamento nei dati della barca.');
        this.publish(topic, payload, 0, () => this.feedback$.next('Invio non confermato. Verifica lo stato della barca prima di riprovare.'));
      } catch (error) { this.feedback$.next((error as Error).message); }
    }
  }

  private publish(topic: string, payload: unknown, qos: 0 | 1, failed: () => void): void {
    const client = this.client;
    if (!this.ready || !client?.connected) { failed(); return; }
    try {
      client.publish(topic, JSON.stringify(payload), {qos, retain: false}, error => {
        if (this.client === client && error) failed();
      });
    } catch { failed(); }
  }

  private response(topic: string, raw: unknown): void {
    const data = object(raw);
    if (!this.pending || this.pending.topic !== topic || data['requestId'] !== this.pending.id || typeof data['success'] !== 'boolean') return;
    this.cancelPending();
    // Do not guess the state from an ACK (or from an error). Wait for live boat telemetry.
    this.recording$.next(null);
    this.seen.delete(TOPICS.recording);
    this.feedback$.next(data['success'] ? 'Richiesta confermata dalla barca. In attesa dello stato aggiornato.'
      : `La barca segnala: ${typeof data['error_message'] === 'string' ? data['error_message'] : 'operazione non riuscita'}. Verifica lo stato aggiornato.`);
  }

  private recordingUnknown(id: string, message: string): void {
    if (this.pending?.id !== id) return;
    this.cancelPending();
    this.recording$.next(null);
    this.seen.delete(TOPICS.recording);
    this.feedback$.next(message);
  }
  private cancelPending(): void {
    clearTimeout(this.pending?.timer);
    this.pending = undefined;
    this.pending$.next(false);
  }
  private clearData(): void {
    this.seen.clear();
    this.dashboard$.next(null); this.map$.next(null); this.mechatronics$.next(null);
    this.indicators$.next(null); this.recording$.next(null);
    this.tick$.next(this.tick$.value + 1);
  }
  private expire(): void {
    if (!this.fresh(TOPICS.dashboard) && this.dashboard$.value) this.dashboard$.next(null);
    if (!this.fresh(TOPICS.map) && this.map$.value) this.map$.next(null);
    if (!this.fresh(TOPICS.mechatronics) && this.mechatronics$.value) this.mechatronics$.next(null);
    if (!this.fresh(TOPICS.indicators) && this.indicators$.value) this.indicators$.next(null);
    if (!this.fresh(TOPICS.recording) && this.recording$.value) this.recording$.next(null);
    this.tick$.next(this.tick$.value + 1);
  }
}
