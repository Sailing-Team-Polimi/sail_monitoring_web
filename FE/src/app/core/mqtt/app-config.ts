import { AuthRoles } from '../../dtos/auth/auth-roles';

// PUBLIC configuration: these values are shipped to every browser. No passwords here.
export const APP_CONFIG = {
  brokerUrl: 'wss://9b6cb923ef4f4f61975ac4342b2a3cbc.s1.eu.hivemq.cloud:8884/mqtt',
  users: {
    guest: AuthRoles.Guest,
    Guest: AuthRoles.Guest,
    operator: AuthRoles.Admin,
    Staff: AuthRoles.Admin,
    staff: AuthRoles.Admin,
  } as Record<string, AuthRoles>,
  connectTimeoutMs: 12000,
  reconnectMs: 5000,
  dataTimeoutMs: 5000,
  recordingTimeoutMs: 5000,
  commandTimeoutMs: 10000,
  maxPayloadBytes: 65536,
};

export type AppConfig = typeof APP_CONFIG;

// UI profiles only. The broker's ACLs must independently enforce every permission.
export function roleForUsername(username: string, config: AppConfig): AuthRoles | null {
  return Object.hasOwn(config.users, username) ? config.users[username] : null;
}

export function brokerUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); }
  catch { throw new Error('Indirizzo del broker non configurato. Contatta il responsabile del team.'); }
  if (url.protocol !== 'wss:' || url.username || url.password || url.hash || url.search) {
    throw new Error('Il broker deve usare un indirizzo wss:// senza credenziali o parametri.');
  }
  return url.toString();
}
