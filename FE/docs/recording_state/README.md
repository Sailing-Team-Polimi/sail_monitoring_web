# Stato della registrazione

_Ultimo aggiornamento: 01/11/2026_

[English](README_ENG.md) · [Web app](../../README.md)

Il topic MQTT `sail_gui/data/recording_state` trasporta lo stato del recorder ROS. Il messaggio include un header:

```json
{
  "header": {"stamp": {"sec": 1793527200, "nanosec": 0}, "frame_id": ""},
  "recording": true,
  "bag_name": "rosbag2_esempio",
  "last_error": ""
}
```

Il timestamp nell’esempio è illustrativo: in un messaggio reale viene generato dal recorder dopo aver verificato il processo. Indica l’ora di sistema della verifica, non l’inizio della registrazione. `frame_id` resta vuoto. L’header arriva dal Raspberry senza essere riscritto dal gateway MQTT.

## Quando lo stato è aggiornato

In [app-config.ts](../../src/app/core/mqtt/app-config.ts), `recordingTimeoutMs: 5000` limita sia l’età dalla verifica sul Raspberry sia il tempo senza nuovi aggiornamenti ricevuti. Un campione arrivato con 4,5 secondi di ritardo ha soltanto mezzo secondo di validità residua, non altri cinque secondi.

La sessione controlla la scadenza ogni 500 ms e anche prima di inviare Start o Stop. Quando lo stato scade, il riquadro Mechatron mostra **STATO NON DISPONIBILE O SCADUTO**, spegne l’indicatore di registrazione e disabilita entrambi i pulsanti. Non mostra **NOT RECORDING** per deduzione: senza aggiornamenti lo stato effettivo è sconosciuto.

Sono ignorati messaggi senza header, timestamp zero, malformati, anticipati oltre la tolleranza, scaduti, duplicati o fuori ordine. Duplicati e vecchi pacchetti non sostituiscono uno stato più recente e non rinnovano il timeout. I messaggi retained iniziali vengono ignorati anche se il timestamp è recente. Le risposte ai comandi non inventano uno stato nuovo: dopo una risposta si attende un campione con timestamp successivo all’ultimo accettato.

Una disconnessione cancella lo stato; una nuova connessione deve ricevere telemetria valida. Se il broker resta connesso ma ROS si ferma, il controllo del timestamp e il timeout fanno comunque scadere lo stato.

## Configurazione coordinata

Il recorder pubblica a 2 Hz, configurabili nel suo `publish_rate_hz`. Il gateway invia nominalmente a 1 Hz, dando precedenza ai cambiamenti di `recording`, `bag_name` o `last_error`. Un semplice avanzamento del timestamp non è un cambiamento prioritario.

Il gateway ROS ha anche `telemetry.recording_max_age_s: 5.0` nel proprio YAML e controlla l’età sia alla ricezione sia prima dell’invio MQTT. Se si modifica la soglia web, valutare anche quella del gateway. Raspberry, gateway e dispositivo che apre la pagina devono avere orologi di sistema allineati entro la tolleranza descritta sotto. Il timestamp usa l’ora di sistema anche con `/clock` simulato fermo: si riferisce al processo recorder reale. Stati storici riprodotti da una rosbag non rappresentano lo stato attuale del recorder e vengono scartati.

L’aggiunta di `std_msgs/Header` a `sail_msgs/msg/RecordingState` cambia l’interfaccia ROS. Ricompilare `sail_msgs`, `rosbag_manager` e `web_communication` e distribuire la nuova web app insieme. La vecchia telemetria senza header non abilita i comandi. Le rosbag con il vecchio messaggio richiedono conversione o le precedenti interfacce.

## Verifica

Da `FE/`:

```bash
npm test
npm run test:types
npm run build -- --base-href ./
```

I test usano un client MQTT e orologi simulati: verificano campioni ritardati, scadenza senza disconnessione, duplicati, ordine, timestamp futuri o assenti, retained, risposte ai comandi e ripresa con uno stato valido. Non contattano il broker o la barca.

## Piccoli scarti d’orologio

`recordingClockSkewToleranceMs: 1000` in [app-config.ts](../../src/app/core/mqtt/app-config.ts) consente timestamp anticipati fino a 1 secondo incluso. Nel gateway ROS il parametro corrispondente è `telemetry.recording_clock_skew_tolerance_s: 1.0`. La tolleranza è configurabile, finita, non negativa e minore della scadenza; impostarla a zero ripristina il controllo rigido.

La scadenza resta di 5 secondi: la tolleranza **non** viene aggiunta all’età massima dei messaggi vecchi. Il timeout dall’ultima ricezione accettata impedisce anche a un timestamp leggermente nel futuro di prolungare lo stato oltre 5 secondi senza nuovi campioni. Duplicati e messaggi fuori ordine non azzerano questo timeout. Esempi: +300 ms e +1000 ms sono accettati, +1001 ms e un’età di 5000 ms sono scartati.

Gli orologi devono restare ragionevolmente allineati tramite sincronizzazione automatica: non è più richiesta una corrispondenza perfetta. Non viene stimato né corretto automaticamente lo scarto fra dispositivi. I test coprono entrambi i limiti, configurazione, scadenza con timestamp anticipato e assenza di rinnovo tramite duplicati.
