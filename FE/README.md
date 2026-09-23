# Polimi Sailing Team — Sail Monitoring Web

La pagina Staff **Diagnostics** riceve `sail_gui/data/diagnostic`.
Il [contratto provvisorio v1](docs/diagnostics.md) descrive Raspberry, batterie e valori mancanti.
L'indicatore MQTT nella navbar è verde solo quando il broker è connesso, rosso negli altri stati.

WebApp Angular autonoma per la telemetria e i comandi del team. Mantiene le schermate
del progetto PoliMiSailGUI e comunica **direttamente con il broker MQTT attraverso WSS**.
Non richiede un backend Node, un database o un server ROS nel cloud.
Node serve per sviluppo e compilazione: sul PC può girare interamente in Docker.
Per l'ambiente Docker e gli script di avvio vedere il [README della repository](../README.md).

```text
GitHub Pages ── file HTML/CSS/JS ──> browser Angular
                                      │ MQTT 5 / WSS
                                 broker MQTT
                                      │ MQTT / TLS
                          Raspberry: web_communication
                                      │
                              topic e servizi ROS2
```

## Stato del progetto

- Interfaccia trasferita: login, dashboard, mappa, meccatronica, impostazioni, assetto.
- Nuovo collegamento MQTT, conversioni dei messaggi e comandi nel frontend.
- Workflow di verifica e pubblicazione automatica presente in `../.github/workflows/pages.yml`.
- Broker **non ancora configurato**: la pagina iniziale mostra un messaggio e non tenta connessioni.
- Nessuna credenziale reale inclusa. Nessun push o deploy remoto eseguito durante la migrazione.
- Test del protocollo eseguiti con un client simulato; integrazione con broker/ROS da verificare.
- Ambiente Docker predisposto per sviluppo; avvio e compilazione Angular
  da verificare sul PC. Docker non è stato avviato durante la preparazione, come richiesto.

## 1. Configurare broker e utenti

Modificare **`src/app/core/mqtt/app-config.ts`**:

```ts
brokerUrl: 'wss://IL-VOSTRO-CLUSTER.s1.eu.hivemq.cloud:8884/mqtt',
users: {
  guest: AuthRoles.Guest,
  operator: AuthRoles.Admin,
  // È possibile aggiungere username individuali:
  // mario: AuthRoles.Admin,
  // anna: AuthRoles.Guest,
},
```

Copiare l'indirizzo **WebSocket TLS** esatto dalla console del broker, compresi porta e percorso.
L'esempio non è un endpoint pronto all'uso. La porta MQTT/TLS 8883 non è la porta WSS.
L'app richiede un broker che supporti MQTT 5 via WSS, come HiveMQ Cloud.

Creare nella console del broker le credenziali MQTT corrispondenti a ciascuno username.
Le password si consegnano agli utenti separatamente e si inseriscono nella schermata di login.
Non sono le credenziali dell'account amministrativo HiveMQ.

**Non inserire password in questo file, in HTML, nei workflow o nelle variabili di build.**
Tutto ciò che viene compilato nel frontend può essere letto dai visitatori, anche se proveniva
da un GitHub Secret. La configurazione contiene esclusivamente endpoint, username e profili UI.

### Profili della WebApp

| Profilo | Pagine | Operazioni nell'interfaccia |
| --- | --- | --- |
| `Guest` | Dashboard, Visualization | Solo lettura |
| `Admin` (operatore) | Tutte, incluse Map, Mechatron e Settings | Lettura e comandi |

Le restrizioni delle pagine sono in `src/app/app.routes.ts` e nel menu header.
I profili sono una configurazione dell'interfaccia: **non sostituiscono le ACL del broker**.
Un visitatore può modificare il JavaScript nel proprio browser; il broker deve comunque
rifiutare le pubblicazioni effettuate con credenziali ospite.
Il login viene completato soltanto dopo connessione autenticata e autorizzazione delle
sottoscrizioni necessarie. Non vengono inviati comandi di prova per scoprire il ruolo.

### Permessi MQTT

Configurazione minima per il requisito concordato:

- Ospiti: `Subscribe Only`, nessun diritto di pubblicazione.
- Operatori: `Publish and Subscribe` sull'albero del team (o globale se il piano consente solo quello).
- Raspberry: credenziali proprie, separate da quelle dei browser.

HiveMQ Serverless documenta un solo permesso per credenziale. Non significa un solo utente.
La configurazione minima separa lettura e scrittura, ma un permesso globale di pubblicazione
consente all'operatore anche di pubblicare sui canali dei dati. Per impedirlo servono regole
distinte in lettura e scrittura, con un broker/piano che le supporti.

Regole più precise, se disponibili nel broker scelto:

| Credenziale | Subscribe | Publish |
| --- | --- | --- |
| Ospite | `sail_gui/data/dashboard_data`, `sail_gui/data/mechatronics_data`, `sail_gui/data/indicators` | Nessuno |
| Operatore | `sail_gui/data/#`, `sail_gui/rsp/#` | `sail_gui/cmd/#` |
| Raspberry telemetria | Nessuno | `sail_gui/data/#` |
| Raspberry comandi | `sail_gui/cmd/#` | `sail_gui/rsp/#` |

Il profilo ospite riceve altezza e indicatore del sensore attivo per la pagina Visualization:
**nascondere Mechatron non rende segreti i dati meccatronici**. Per proteggere singoli dati,
separare i relativi topic anche sul Raspberry e limitare le sottoscrizioni sul broker.

Verificare i filtri disponibili nella console del proprio cluster: la documentazione HiveMQ
non è uniforme su tutti i dettagli del piano Serverless. Non passare automaticamente a un
piano a pagamento. La distinzione base sola lettura / lettura e scrittura è documentata.

Fonti: [accessi HiveMQ](https://docs.hivemq.com/hivemq-cloud/authn-authz.html),
[piano Serverless e filtri](https://docs.hivemq.com/hivemq-cloud/quick-start-guide.html).

### Sessioni e disconnessioni

- Credenziali soltanto in memoria, necessarie per la riconnessione della pagina aperta.
- Nessuna password o token in cookie, localStorage o sessionStorage.
- Logout, chiusura e ricaricamento richiedono un nuovo login. Il password manager del browser
  può comunque compilare i campi, secondo le sue impostazioni.
- Ogni connessione ha un identificativo casuale: più browser non si espellono a vicenda.
- Un rifiuto di autorizzazione MQTT 5 termina la sessione e richiede un nuovo accesso.
- Un guasto di rete crea una connessione nuova, senza ripristinare code di vecchi comandi.

## 2. Avvio locale e verifiche

L'ambiente consigliato per questo progetto è Docker: dalla radice della repository
eseguire `bash Docker/build.sh`. Installa le dipendenze e lascia il container acceso,
senza avviare Angular. Collegarsi al container con VS Code oppure con
`docker compose -f Docker/compose.yaml exec web bash`, quindi eseguire `ng serve`
da `/app/FE`. I comandi sono nel [README principale](../README.md).

In alternativa, per lavorare **senza Docker**, installare **Node.js 24 LTS**, che include npm.
Dalla cartella `FE/`:

```sh
npm install
npm test
npm run test:types
npm run build -- --base-href ./
npm start
```

Aprire `http://localhost:4200/`. Il broker deve essere già configurato per fare login.
Per vedere la sola schermata iniziale non servono broker o credenziali.

Le versioni delle dipendenze dirette sono fissate in `package.json`. Alla prima installazione
riuscita, **aggiungere anche il `package-lock.json` generato al commit**: da quel momento il
workflow userà `npm ci` per riprodurre le dipendenze. Senza lock usa `npm install`.
Il vecchio lock del progetto FE non è stato riutilizzato perché non descrive le nuove dipendenze.

I test della logica MQTT possono girare anche senza `npm install`, con il solo Node 24:

```sh
node --experimental-transform-types --import ./tests/register.mjs --test tests/*.test.ts
```

Usano il test runner integrato in Node e un client MQTT simulato: non contattano la barca.
Gli avvisi di Node sul supporto sperimentale TypeScript non sono fallimenti dei test.
La compilazione Angular e `test:types` richiedono invece le dipendenze installate.

## 3. Pubblicazione su GitHub Pages

La repository remota configurata è `Sailing-Team-Polimi/sail_monitoring_web`.

1. Pubblicare l'intera repository, incluse `FE/`, `Docker/` e `.github/`, nel branch **`main`**.
2. Su GitHub aprire **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. Verificare che le Actions e l'ambiente `github-pages` siano consentiti dalle impostazioni
   dell'organizzazione. Con GitHub Free, Pages richiede una repository pubblica.
4. Aprire **Actions → Test and deploy GitHub Pages**. Il push su `main` avvia il workflow;
   se era fallito prima dell'attivazione di Pages, rieseguirlo oppure usare **Run workflow** su `main`.
5. Attendere il completamento dei job `build` e `deploy`.

L'indirizzo previsto, con la configurazione standard, è:

**https://sailing-team-polimi.github.io/sail_monitoring_web/**

È un indirizzo previsto, non una conferma di pubblicazione. L'URL effettivo appare in
Settings → Pages e nell'ambiente `github-pages` dopo un deploy riuscito.

Ogni successivo push su **`main`** esegue installazione, test, controllo TypeScript,
compilazione Angular e aggiornamento di Pages. Le pull request verso `main` eseguono le
verifiche ma non pubblicano. Se un controllo fallisce, la versione precedente resta online.
Non vengono creati container né avviati backend. Non sono richiesti segreti MQTT su GitHub.

La navigazione usa URL come `/#/dashboard` e `/#/map`, così ricaricare una pagina non causa
un 404 su Pages. Il percorso base relativo permette il deploy nella sottocartella della repo.
Font, icone e immagini locali seguono lo stesso percorso. Non usare `ng serve` come hosting.

Fonti: [workflow GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages),
[deploy Angular](https://angular.dev/tools/cli/deployment).

## 4. Protocollo e servizi ROS

I topic rimangono quelli definiti in `Sailing_ROS/ros2_ws/src/web_communication/config/endpoints.yaml`.
I nomi usati dal frontend sono centralizzati in `src/app/core/mqtt/topics.ts`.

| Topic MQTT | Uso |
| --- | --- |
| `sail_gui/data/dashboard_data` | Roll, pitch, yaw, velocità, VMG e vento |
| `sail_gui/data/map_data` | Posizione, vento, DTL/TTL e boe |
| `sail_gui/data/mechatronics_data` | Altezze, PID, servo e flap |
| `sail_gui/data/indicators` | Valori e disponibilità delle regolazioni |
| `sail_gui/data/recording_state` | Stato registrazione, nome bag, errore |
| `sail_gui/cmd/set_mark` | Imposta boa, codici ROS: Comitato=0, Pin=1, Bolina=2 |
| `sail_gui/cmd/update` | `{indicator, method}`, con INCREASE/DECREASE o CHANGE per i selettori |
| `sail_gui/cmd/show_servo_angle` | `{command: "FLAP_MAX"}` oppure `"FLAP_MIN"` |
| `sail_gui/cmd/start_recording` / `stop_recording` | Richiesta con `requestId` univoco |
| `sail_gui/rsp/start_recording` / `stop_recording` | Risposta ROS con lo stesso `requestId` |

Il gateway sul Raspberry chiama i servizi ROS `/local_cmd/start_recording` e
`/local_cmd/stop_recording`, implementati da `rosbag_manager`. Per gli indicatori pubblica
sul topic ROS `/local_cmd/update`. La rimozione del backend Node non rimuove questi servizi.
Le rosbag restano sul Raspberry: questa WebApp non le registra né le archivia nel cloud.

Le conversioni del vecchio backend sono in `payloads.ts`: codici delle boe, lista degli
indicatori trasformata in dizionario, flag snake_case → camelCase, `last_error` → `lastError`.
I messaggi sono validati; JSON errato, payload troppo grandi o coordinate impossibili vengono scartati.

### Conferme, dati non aggiornati e comandi

- Start/stop: QoS 1, `retain=false`, identificativo casuale, risposta abbinata per topic **e** ID.
- Una conferma MQTT non equivale a successo ROS. Anche dopo la risposta si aspetta uno stato
  di registrazione aggiornato dalla barca; non si modifica il booleano in modo ottimistico.
- Timeout, errore di invio o disconnessione lasciano l'esito incerto. Nessun reinvio automatico.
- Si consente una richiesta di registrazione alla volta per browser; i click ripetuti sono bloccati.
- Incrementi, selettori, boe e test: QoS 0 e nessuna coda offline. Non hanno una risposta ROS
  dedicata nel protocollo attuale: il messaggio dell'interfaccia chiede di verificarne l'effetto.
- Le pubblicazioni non sono retained. I campioni retained ricevuti alla sottoscrizione sono
  ignorati: si aspetta un messaggio live. MQTT 5 usa `rap=false` per distinguere il retained
  iniziale dagli aggiornamenti live, anche per lo stato registrazione pubblicato con retain.
- Telemetria e stato registrazione scadono dopo 5 secondi senza nuovi campioni, configurabili.
  Lo stato rosbag nel progetto ROS viene pubblicato ogni 0,5 secondi.
- La scadenza misura il tempo dall'arrivo nel browser, non certifica l'età del campione sul
  sensore. Validità dei sensori e controlli operativi rimangono responsabilità dei nodi ROS.
- Nessuna mutua esclusione fra operatori diversi: gli ID separano le risposte ma non danno
  il controllo esclusivo della barca. Le eventuali regole di precedenza vanno gestite a bordo.
- La traccia sulla mappa è locale alla sessione, limitata a 10.000 posizioni; non è uno storico condiviso.
  Lo sfondo cartografico usa il servizio OpenStreetMap già usato nell'app originale.

## 5. Collaudo con broker e Raspberry

Prima dell'utilizzo operativo:

1. Verificare login ospite/operatore e credenziali errate, senza inviare comandi fisici.
2. Con un client MQTT esterno e le credenziali ospite tentare una pubblicazione su un topic
   di prova **non collegato ad attuatori o servizi ROS**: il broker deve negarla.
3. Verificare che un ospite veda Dashboard e Visualization e che una rotta operatore lo riporti alla dashboard.
4. Verificare ricezione di posizione, boe, indicatori e stato registrazione reali.
5. A barca in condizioni di test, provare start/stop e controllare sia le risposte sia i file sul Raspberry.
6. Interrompere la rete: dati non aggiornati segnalati, comandi bloccati, nessun vecchio comando
   reinviato alla riconnessione. Provare logout/login con un altro utente.
7. Aprire due browser: telemetria a entrambi, risposte associate alla richiesta corretta.
8. Verificare da Pages navigazione, ricaricamento delle pagine, font e mappa anche da telefono.

I test automatici non verificano le ACL reali, la disponibilità del broker, i servizi ROS
o gli attuatori. Questi controlli devono essere completati sulla configurazione effettiva.
