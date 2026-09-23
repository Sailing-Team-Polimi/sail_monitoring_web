# Diagnostica: contratto provvisorio v1

La pagina **Diagnostics** è accessibile al profilo Staff (`AuthRoles.Admin`).
Guest non ha il link nel menu, viene reindirizzato se apre `/#/diagnostics` e non
sottoscrive il topic diagnostico. Per rendere i dati riservati anche fuori dalla WebApp,
le ACL del broker devono negare quel topic alle credenziali Guest: il permesso globale
Subscribe Only permette comunque di leggerlo con un altro client MQTT.

Il nodo ROS e il relativo messaggio custom **non sono ancora implementati**.
Questo documento propone il JSON atteso dal frontend, da concordare con chi sviluppa ROS.
DTO: `src/app/dtos/DiagnosticData.ts`; validazione: `src/app/core/mqtt/diagnostic-payload.ts`.

## Trasporto

- Topic esatto: `sail_gui/data/diagnostic` (singolare).
- Un messaggio è una fotografia completa: non viene unito al precedente.
- JSON UTF-8; misure numeriche, senza unità nel valore.
- Pubblicazione periodica suggerita: ogni 2–5 secondi, `retain=false`.
- Dopo 15 secondi senza campioni validi la pagina mostra dati non disponibili.
  La durata è configurabile con `diagnosticTimeoutMs` in `app-config.ts`.
- Disconnessione e logout cancellano i dati. Il retained iniziale viene ignorato.
- Il verde MQTT nella navbar conferma la connessione al broker, non la presenza di dati ROS.
- La pagina non pubblica comandi.

## Esempio di payload (valori illustrativi, non mostrati come dati reali)

```json
{
  "schema_version": 1,
  "stamp": { "sec": 1790182800, "nanosec": 0 },
  "raspberry": {
    "temperature_c": 48.2,
    "cpu_usage_percent": 23.5,
    "memory_usage_percent": 41.0,
    "uptime_s": 7200,
    "status": "ok"
  },
  "batteries": [
    {
      "id": "main",
      "name": "Batteria principale",
      "level_percent": 82,
      "voltage_v": 12.6,
      "current_a": 1.4,
      "temperature_c": 28.3,
      "status": "ok"
    },
    {
      "id": "aux",
      "name": "Batteria ausiliaria",
      "level_percent": 35,
      "voltage_v": 12.1,
      "current_a": null,
      "temperature_c": null,
      "status": "unknown"
    }
  ]
}
```

## Campi e valori mancanti

`schema_version: 1`, `stamp` e `batteries` sono obbligatori. `stamp` usa il formato ROS
con secondi Unix interi non negativi e nanosecondi interi fra 0 e 999999999.
La pagina mostra l'orario del campione nel fuso del browser. La scadenza è invece
misurata dall'arrivo: non garantisce l'età del campione sul sensore.

`raspberry` può essere assente o null. Tutte le misure possono essere omesse o null:
la pagina mostra **—**, mai uno zero inventato. Zero è un valore valido, anche per la carica.
Le percentuali usano l'intervallo **0–100**, non 0–1. Tensione e uptime sono non negativi;
la corrente può essere negativa (convenzione proposta: positiva in scarica, negativa in carica).
Le temperature sono in °C. Il frontend non decide soglie di allarme per hardware ancora da definire.

`status` ammette `ok`, `warning`, `error`, `unknown`; omesso/null equivale a `unknown`.
Lo stato proviene dal nodo diagnostico: ricevere un messaggio non implica che il dispositivo sia sano.

`batteries` è una lista dinamica (0–32 elementi). Ogni batteria richiede un `id` univoco,
stabile e non vuoto (massimo 80 caratteri); `name` è facoltativo e ha lo stesso limite.
L'assenza di una batteria nel nuovo messaggio la rimuove dalla pagina.
In assenza di campioni compaiono due schede vuote; non indicano il rilevamento di due batterie.

Versione sconosciuta, misure malformate, percentuali fuori intervallo e ID duplicati
fanno scartare l'intero messaggio. Il vecchio campione scade normalmente, senza rinnovo
del timeout. I campi aggiuntivi vengono ignorati per facilitare estensioni compatibili.

## Verifica

I test locali usano un client simulato per validazione, ruoli, scadenza e disconnessione.
Quando sarà disponibile il nodo ROS, verificare il payload reale, la frequenza e le ACL.
Staff deve poter sottoscrivere il nuovo topic; con una ACL limitata ai vecchi topic
il login Staff fallisce finché non viene autorizzata anche la nuova sottoscrizione.
