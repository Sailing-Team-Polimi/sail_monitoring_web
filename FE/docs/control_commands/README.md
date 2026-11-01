# Validità dei comandi e degli indicatori

_Ultimo aggiornamento: 01/11/2026_

[English](README_ENG.md)

Il PID ROS pubblica i riferimenti di flap e servo come `trajectory_msgs/msg/JointTrajectory`, con un solo giunto, una posizione in radianti e il timestamp del calcolo. Non sono misure della posizione fisica. `Indicators` conserva i valori e le capacità specifiche del sistema e aggiunge un header con il tempo ROS di generazione.

Il frontend riceve questi dati tramite MQTT, già aggregati. Gli angoli nella telemetria restano in gradi. `flap_command_fresh`, `servo_command_fresh` e `indicators_fresh` indicano la validità dei rispettivi valori: il solo arrivo di un nuovo aggregato non li rende tutti recenti. Quando scadono, i campi vengono segnati come non validi e i pulsanti dipendenti dallo stato degli indicatori non sono abilitati.

Il JSON unico di `sail_gui/data/mechatronics_data` contiene `header` per l’aggregato e `indicators` con il messaggio PID completo e il suo header originale. Include inoltre:

```json
"control_freshness": {
  "sent_at_unix_ms": 1793538000000,
  "remaining_ms": {"flap": 900, "servo": 900, "indicators": 1900}
}
```

Il gateway calcola le durate residue dai timestamp ROS originali, anche durante il replay con `/clock`; `sent_at_unix_ms` usa invece l'orologio di sistema. Il browser sottrae il tempo trascorso durante il trasporto MQTT, tollera un invio fino a 1 s nel futuro per piccoli scarti fra gli orologi e limita la validità ricevuta a un massimo di 5 s. Metadati assenti o non validi non abilitano i controlli. Nuovi aggregati che contengono lo stesso header degli indicatori non ne rinnovano la scadenza.

I limiti predefiniti nel gateway sono 1 s per gli angoli sul display (telemetria a 2 Hz) e 2 s per gli indicatori. Il nodo che invia il comando al CAN mantiene un limite separato di 0,3 s. Un flag già falso nella telemetria ROS rimane falso. La verifica visiva avviene ogni 500 ms; i controlli sui pulsanti vengono ripetuti al clic. Le durate non sono una conferma che il servo abbia raggiunto la posizione comandata.

Aggiornare insieme ROS, gateway e frontend. Raspberry e browser devono avere orologi di sistema sufficientemente allineati. Il controllo di `RecordingState` rimane separato: vedere la [guida dedicata](../recording_state/README.md).

## Validità dei sensori elaborati

La dashboard rispetta `imu_fresh`, `velocity_fresh` e `wind_fresh`; la meccatronica anche `wand_fresh`, `height_wand_fresh` e `height_ultrasound_fresh`. I campi scaduti sono mostrati come non validi pur conservando internamente l'ultimo numero. La mappa mantiene la posizione GPS utilizzabile anche senza vento o orientamento: nasconde la freccia del vento non valido e usa un punto senza direzione quando manca l'IMU. Flag assenti o diversi dal booleano `true` non indicano validità.

Questi flag vengono ricalcolati da `data_elaboration` a 10 Hz configurabili e trasmessi dal gateway alle frequenze MQTT già impostate. La notifica della scadenza arriva quindi con la successiva telemetria. Se si interrompe l'intero flusso MQTT, resta attivo il timeout di ricezione della pagina.

## Canale unico e comando manuale

La sessione si iscrive solo a `sail_gui/data/mechatronics_data` per dati e indicatori: il vecchio canale `sail_gui/data/indicators` è rimosso. I due flussi interni dell'interfaccia vengono aggiornati dallo stesso pacchetto. I pacchetti privi dell'header dell'aggregato sono rifiutati; indicatori privi di un header valido o scaduti non abilitano i pulsanti. Il gateway controlla l'aggregato con `telemetry.mechatronics_max_age_s: 1.0`, gli indicatori con il loro timestamp e il limite di 2 s.

La richiesta manuale resta sul percorso comandi MQTT esistente; in ROS `mec_elaboration_node` la traduce in `/processed/manual_servo_cmd` (`ServoCmd`) con `header.stamp` assegnato in quel momento. Il PID verifica un'età massima predefinita di 0,5 s e scarta duplicati, timestamp futuri e tipi non validi. Il comando viene emesso una volta per richiesta e non viene ripetuto dalla telemetria.
