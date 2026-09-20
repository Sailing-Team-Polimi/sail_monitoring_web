# Sail Monitoring Web

WebApp Angular che comunica direttamente con il broker MQTT via WebSocket TLS.
Docker serve per lavorare sul PC senza installare Node, npm o Angular CLI.
Il deploy su GitHub Pages è indipendente da Docker.

## Preparare il container

Avvia Docker Desktop con container Linux. Da Git Bash, nella cartella della repository:

```bash
bash Docker/build.sh
```

Lo script costruisce il container, installa le dipendenze e lo lascia acceso in attesa.
**Non avvia Angular e non compila l'app.** Non accetta opzioni come `dev` o `shell`.

Il primo avvio può richiedere alcuni minuti. Lo script aspetta che l'installazione termini
e mostra i log se la preparazione fallisce.

## Lavorare sull'app

In VS Code usa **Dev Containers: Attach to Running Container**, scegli il container del
progetto `sail-monitoring-dev`, apri `/app/FE` e apri un terminale.

In alternativa, dalla radice della repository puoi entrare nel container con:

```sh
docker compose -f Docker/compose.yaml exec web bash
```

**Dentro il container**, nella cartella `/app/FE`, avvia Angular:

```sh
ng serve
```

Apri **http://localhost:4200**. Modifica i file in `FE/`: Angular ricompila e aggiorna
il browser. Con Ctrl+C fermi Angular; il container resta acceso.

`npm start` è un comando equivalente: in `FE/package.json` lo script `start` esegue
proprio `ng serve`. Il container rende disponibile il comando `ng` della versione
installata nel progetto, senza installare una seconda Angular CLI globale.

I parametri per Docker sono già impostati in `FE/angular.json`:

- `host: 0.0.0.0`: permette di raggiungere Angular attraverso la porta del container.
- `poll: 1000`: controlla ogni secondo le modifiche ai file condivisi da Windows.

Non devi riscriverli nel terminale. Compose espone la porta soltanto sul PC locale.

Per compilare i file statici, senza avviare un server, usa `ng build`.
Per eseguire test, controllo TypeScript e build insieme, usa `npm run check`.
Questi comandi si eseguono nel container. I messaggi di Angular appaiono nel terminale
in cui lo hai avviato.

Per fare login devi configurare il broker in `FE/src/app/core/mqtt/app-config.ts`.
Senza broker puoi comunque aprire la schermata iniziale.

## Dipendenze e arresto

Il codice resta sul PC. Dipendenze, cache e build restano nei volumi Docker:
non serve installare Node sul sistema host. In `FE/` possono comparire le cartelle
vuote usate come punti di montaggio.

Alla prima installazione viene creato `FE/package-lock.json`: aggiungilo al commit.
Agli avvii successivi l'entrypoint usa `npm ci` se trova il lock, altrimenti `npm install`.
Per aggiungere una dipendenza puoi eseguire `npm install nome-pacchetto` nel container.

Per arrestare il container, dalla radice della repository sul PC:

```sh
docker compose -f Docker/compose.yaml down
```

I volumi vengono conservati. Per ripartire esegui di nuovo `bash Docker/build.sh`.
Dopo modifiche alle dipendenze ricevute da Git, arresta e riavvia il container per reinstallarle.

## File Docker

- `Dockerfile`: definisce l'ambiente Node per lo sviluppo.
- `compose.yaml`: configura container, porta e cartelle condivise. È l'unico Compose.
- `entrypoint.sh`: installa le dipendenze all'avvio, segnala che sono pronte e lascia il container in attesa.
- `build.sh`: esegue i comandi Docker per preparare tutto.
- `Dockerfile.dockerignore`: esclude dalla build dipendenze locali, cache e altri file non necessari.

Non ci sono un container di produzione o una configurazione Nginx.

## GitHub Pages

Il workflow [pages.yml](.github/workflows/pages.yml) installa Node su un runner GitHub,
esegue i controlli e compila Angular nella cartella `FE/`. Poi pubblica i file statici
di `FE/dist/sail-monitoring-web/browser` a ogni push su `main`.

HTML, CSS e JavaScript vengono serviti da GitHub Pages ed eseguiti dal browser.
Non c'è un backend Node da tenere acceso: il browser si collega direttamente al broker MQTT.
Il workflow non usa il Dockerfile né Compose e non richiede Docker sul tuo PC.

Su GitHub seleziona **Settings → Pages → Source → GitHub Actions**.
Il broker MQTT e i servizi ROS sul Raspberry restano necessari per i dati e i comandi.

Configurazione MQTT, ruoli e protocollo: [documentazione dell'app](FE/README.md).

Container e compilazione Angular sono da verificare sul PC: Docker non è stato avviato
durante questa sistemazione, come richiesto.
