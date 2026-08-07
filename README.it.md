# 📁 Folderlan · [![NodeJS CI](https://github.com/ImMau14/Folderlan/actions/workflows/node-ci.yaml/badge.svg)](https://github.com/ImMau14/Folderlan/actions/workflows/node-ci.yaml) [![Rust CI](https://github.com/ImMau14/Folderlan/actions/workflows/rust-ci.yaml/badge.svg)](https://github.com/ImMau14/Folderlan/actions/workflows/rust-ci.yaml)

**Dimentica le limitazioni. Condividi file all'istante, direttamente tra dispositivi.**

[English](README.MD) · [Español](README.es.md) · **Italiano** · [Português](README.pt.md)

Folderlan è una piattaforma di condivisione file self‑hosted. Un server, qualsiasi dispositivo con un browser. Nessuna connessione internet richiesta sulla tua LAN, nessun cloud di terze parti, nessun abbonamento — i tuoi file restano sul tuo hardware.

---

<img width="1200" height="630" alt="Dashboard di Folderlan" src="docs/screenshot.webp" />

---

## Indice dei contenuti

- [Cos'è Folderlan?](#cosè-folderlan)
- [Casi d'uso](#casi-duso)
- [Caratteristiche principali](#caratteristiche-principali)
- [Avvio rapido](#avvio-rapido)
- [Accesso da altri dispositivi (LAN)](#accesso-da-altri-dispositivi-lan)
- [Distribuzione come cloud privato (VPS)](#distribuzione-come-cloud-privato-vps)
- [Configurazione](#configurazione)
- [Come funziona](#come-funziona)
- [Sicurezza e privacy](#sicurezza-e-privacy)
- [Compilazione dai sorgenti](#compilazione-dai-sorgenti)
- [Manutenzione](#manutenzione)
- [Licenza](#licenza)

---

## Cos'è Folderlan?

Folderlan è un'**applicazione client‑server impacchettata in un singolo binario**. Il backend (Rust + Actix‑web) è un'API REST che salva i file su disco, conserva i metadati in un database SQLite incorporato, gestisce l'autenticazione e sorveglia la propria cartella `uploads/` per registrare i file che compaiono senza passare dall'interfaccia web. Il frontend (React) è compilato ed **incorporato nel binario**, quindi un singolo eseguibile *è* l'intera applicazione: server, API e interfaccia web.

Esegui un programma, apri `http://<host>:8080` in qualsiasi browser e hai un server di condivisione file completamente funzionante con utenti, permessi, quote e un registro di audit.

---

## Casi d'uso

### 🏠 Trasferimento file in LAN — senza internet, senza cavi

Il caso d'uso originale: due dispositivi sulla stessa Wi‑Fi, zero internet.

- Invia documenti, foto, video e file grandi tra laptop, telefono e desktop.
- Funziona completamente offline — i dati non lasciano mai la tua rete.
- Ideale per case, uffici o viaggi con internet inaffidabile.

### ☁️ Cloud privato su un VPS — il tuo "Google Drive" minimalista

Grazie all'architettura client‑server, lo stesso binario diventa un **cloud self‑hosted minimalista** quando viene distribuito su un VPS noleggiato.

- Accedi ai tuoi file da qualsiasi parte del mondo, su qualsiasi dispositivo.
- Dai a familiari, amici o colleghi i propri account con permessi granulari.
- Imponi quote di archiviazione per utente così nessuno riempie il disco.
- Registro di audit completo di chi ha fatto cosa, quando e da quale IP.
- Nessun account richiesto da terzi — i dati sono tuoi, sul tuo server.

### 👥 Condivisione file per team e uffici

Piccoli team che hanno solo bisogno di uno spazio condiviso senza adottare un SaaS completo.

- **Proprietario** (uno) ha il controllo totale; i **visitatori** ricevono esattamente i permessi che gli assegni.
- Ruoli e accesso per file: `viewer` (vedere/scaricare) vs `collaborator` (anche eliminare, condividere, rendere pubblico).
- Visibilità pubblica/privata per file.
- Reimposta password, sospendi account, elimina utenti in qualsiasi momento.

### 📥 Automazione con cartelle di destinazione

Folderlan sorveglia la sua cartella `uploads/` in tempo reale.

- Copia o trasferisci file direttamente nella cartella (o fai scrivere lì un altro programma) e compaiono nell'interfaccia web automaticamente — registrati, ricercabili e condivisibili, senza passaggi manuali.
- Funziona anche al contrario: eliminare il file dal disco lo segna come eliminato nell'interfaccia.
- Utile per bucket di caricamento, depositi di backup o per alimentare una libreria condivisa da uno script di automazione.

### 🔒 Libreria multimediale privata e hub di backup

- Conserva foto di famiglia, backup di progetti e documenti su una macchina che controlli.
- L'autenticazione JWT e l'hashing delle password con Argon2 tengono fuori gli ospiti indesiderati.
- Il registro di audit ti dà visibilità totale su chi ha acceduto a cosa.

---

## Caratteristiche principali

### Gestione file

- **Upload in streaming** — i file grandi vengono trasmessi direttamente su disco con avanzamento in tempo reale nell'interfaccia; pausa, ripresa e annullamento per file.
- **Archiviazione intelligente** — nomi file sanificati, deduplicazione automatica `name (1).ext`, rilevamento MIME.
- **Ricerca e filtri** — per nome, intervallo di dimensione, data di upload, visibilità e caricatore.
- **Download sicuri** — in streaming con verifica dei permessi in tempo reale su ogni richiesta.
- **Visibilità pubblica/privata** — per file, attivabile con un clic.
- **Condivisione granulare** — concedi accesso `viewer` o `collaborator` su un file a utenti specifici.
- **Azioni in blocco** — seleziona più file per scaricarli, eliminarli o cambiarne la visibilità in una volta.

### Utenti, ruoli e quote

- **Un proprietario** — accesso amministratore completo, creato durante la configurazione iniziale.
- **Visitatori illimitati** — account creati dal proprietario con permessi configurabili:
  - `can_upload` — consente/impedisce gli upload.
  - `can_delete_own_files` — consente di eliminare i propri upload.
  - `has_upload_limits` + `upload_limit` — quota di archiviazione per utente in byte.
- **Livelli di accesso per file:** `viewer` (download) o `collaborator` (eliminazione, condivisione, visibilità pubblica).
- **Gestione account** — attiva/sospendi utenti, reimposta password, account con eliminazione soft (revocabile).

### Monitoraggio, audit e sicurezza

- **File System Watcher** — rileva all'istante i file aggiunti o rimossi in `uploads/`, con controlli di stabilità (attende che il file smetta di crescere), deduplicazione e protezione dalla concorrenza basata su lock.
- **Registro di audit completo** — ogni azione rilevante per la sicurezza viene registrata con timestamp, utente, indirizzo IP, tipo di evento ed esito; esplorabile nell'interfaccia con filtri.
- **Autenticazione JWT** — token di 1 ora, firma HS256, hash delle password con Argon2.
- **Avvio solo‑locale** — configurazione, registrazione del proprietario e reset della password del proprietario accettano richieste solo dalla macchina host.
- **CORS configurabile** — bloccato sul tuo origin di default; modalità permissiva disponibile.

### Interfaccia ed esperienza

- **Binario singolo** — server + API + interfaccia web incorporata; nient'altro da installare.
- **Avvio senza configurazione** — il database SQLite si inizializza da solo al primo avvio.
- **4 lingue** — inglese, spagnolo, italiano, portoghese.
- **Temi chiaro e scuro** con rilevamento della preferenza di sistema.
- **Responsive** — layout completo per desktop, navigazione inferiore per mobile.
- **Modalità a basso dettaglio** — disattiva gli effetti pesanti sui dispositivi poco potenti.

---

## Avvio rapido

1. **Scarica l'ultima release** per la tua piattaforma dalla [pagina delle release](https://github.com/ImMau14/Folderlan/releases). Sono disponibili binari precompilati per **Windows (32 e 64 bit)** e **Linux (64 bit)**, compilati automaticamente da GitHub Actions.
2. **Esegui il binario** sulla macchina che ospiterà i tuoi file.
3. **Apri un browser** su quella macchina e vai su `http://localhost:8080` (la porta predefinita).
4. **Completa la configurazione iniziale:** l'interfaccia web si apre sulla schermata di configurazione — fai clic su *Start*, scegli un **nome utente e password del proprietario** (il proprietario è l'amministratore della tua istanza Folderlan) e vieni automaticamente autenticato, pronto per caricare.
5. **Inizia a condividere.**

> [!WARNING]
> La configurazione iniziale (creazione del database, registrazione del proprietario) deve essere eseguita **dalla macchina host stessa** (`localhost`). Questi passaggi vengono volutamente rifiutati da altri dispositivi.

Il server crea un database SQLite (`db/app.db` di default) e una cartella `uploads/` accanto al binario. Tutti i file che carichi finiscono in `uploads/`.

> [!TIP]
> All'avvio il server stampa gli indirizzi in cui è disponibile l'interfaccia web — `Local` (stessa macchina) e `Network` (il tuo IP LAN, es. `http://192.168.1.50:8080`). Usa l'indirizzo di rete per aprire Folderlan da altri dispositivi.

---

## Accesso da altri dispositivi (LAN)

1. Trova l'IP del server sulla rete — il modo più semplice: copialo dall'URL **Network** stampato all'avvio.
2. Da qualsiasi dispositivo sulla stessa Wi‑Fi, apri `http://<ip‑del‑server>:8080` nel browser.
3. I visitatori accedono con gli account creati dal proprietario (sezione Users della dashboard).
4. Per creare account visitatore, accedi come proprietario → **Users** → *Create user* e imposta i permessi (upload, eliminazione dei propri file, quota di archiviazione).

> [!WARNING]
> Folderlan viene servito su HTTP in chiaro, non TLS. Usalo solo su reti di cui ti fidi — su Wi‑Fi pubblica o condivisa, password e file trasferiti possono essere intercettati. Per dati sensibili, preferisci la distribuzione [VPS + HTTPS](#distribuzione-come-cloud-privato-vps).

> [!TIP]
> Su Windows, consenti la porta nel firewall (`netsh advfirewall firewall add rule name="Folderlan" dir=in action=allow protocol=TCP localport=8080`) così altri dispositivi possono connettersi.

---

## Distribuzione come cloud privato (VPS)

Qualsiasi cosa che possa eseguire il binario Linux ed essere raggiungibile da internet va bene — un VPS noleggiato, un vecchio PC a casa con port forwarding o un Raspberry Pi.

Ti serve:
- Un dominio (o semplicemente l'IP del server).
- Un reverse proxy (es. Nginx o Caddy) per terminare HTTPS — *fortemente consigliato*.
- Opzionalmente, systemd per mantenere il server in esecuzione.

> [!CAUTION]
> Non esporre Folderlan a internet senza un reverse proxy + HTTPS. Password e trasferimenti di file viaggerebbero in chiaro. Gli endpoint di configurazione integrati sono protetti da `LOCAL_ONLY` — mantieni quella protezione finché il proxy non è pronto, e solo allora imposta `LOCAL_ONLY=false`.

### Passo 1 — Configurare le variabili d'ambiente

Impostale prima del primo avvio. Come minimo `SECRET_JWT`, `LOCAL_ONLY=false` e (opzionalmente) `OFF_CORS=true`:

```bash
export PORT=8080
export ADDRESS=0.0.0.0
export SECRET_JWT="$(openssl rand -hex 32)"   # conserva questo valore!
export LOCAL_ONLY=false                        # gli endpoint di configurazione diventano raggiungibili tramite il proxy
export OFF_CORS=true                           # dietro un reverse proxy, rilassa il CORS verso l'origin del proxy
```

> [!IMPORTANT]
> `SECRET_JWT` firma i tuoi token di autenticazione. Se non viene impostata, **a ogni avvio viene generata una chiave casuale**, che invalida tutte le sessioni esistenti dopo un riavvio. Generala una volta e conservala.

### Passo 2 — Esecuzione come servizio systemd (Linux)

<details>
<summary><strong>File di unità systemd completo</strong></summary>

Crea `/etc/systemd/system/folderlan.service`:

```ini
[Unit]
Description=Folderlan file-sharing server
After=network.target

[Service]
Type=simple
User=folderlan
WorkingDirectory=/opt/folderlan
Environment=SECRET_JWT=REPLACE_WITH_YOUR_SECRET
Environment=LOCAL_ONLY=false
Environment=OFF_CORS=true
ExecStart=/opt/folderlan/folderlan
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now folderlan
```

</details>

### Passo 3 — Reverse proxy con HTTPS

<details>
<summary><strong>Esempio di configurazione Nginx</strong></summary>

```nginx
server {
    listen 443 ssl;
    server_name files.example.com;

    ssl_certificate     /etc/letsencrypt/live/files.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/files.example.com/privkey.pem;

    client_max_body_size 0;   # consente upload grandi; il server li trasmette in streaming

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}

server {
    listen 80;
    server_name files.example.com;
    return 301 https://$host$request_uri;
}
```

</details>

### Passo 4 — Primo avvio sul server

1. Avvia il servizio e apri `https://files.example.com` **dal server** (o usa il proxy) per completare la configurazione e registrare il proprietario.
2. `LOCAL_ONLY=false` consente di raggiungere l'endpoint di configurazione tramite il tuo dominio una volta che il proxy è attivo.
3. Crea account visitatore, imposta le quote e condividi.

> [!NOTE]
> Esegui il backup della cartella `db/` (database SQLite) e di `uploads/` (i tuoi file) per il ripristino in caso di disastro — insieme sono l'intera tua istanza.

---

## Configurazione

<details>
<summary><strong>Variabili d'ambiente — server</strong></summary>

| Variabile     | Tipo   | Valore predefinito | Descrizione |
|---------------|--------|--------------------|-------------|
| `PORT`        | u16    | `8080`             | Porta TCP a cui associarsi. |
| `ADDRESS`     | string | `0.0.0.0`          | Indirizzo di bind. Usa `127.0.0.1` per l'esposizione solo locale. |
| `SQLITE_FILE` | string | `db/app.db`        | Percorso del database SQLite. Le directory padre vengono create automaticamente. |
| `SECRET_JWT`  | string | *hex casuale*      | Chiave di firma JWT (HS256). Se non impostata, **a ogni avvio** viene generata una nuova chiave casuale, invalidando tutti i token. Impostala per la persistenza. |
| `OFF_CORS`    | bool   | `false`            | `true` → consente tutti gli origin; `false` → limita a `http://{ADDRESS}:{PORT}` con `GET, POST, DELETE, PATCH, OPTIONS` e header `Content-Type, Authorization`. |
| `LOCAL_ONLY`  | bool   | `true`             | Quando è `true`, gli endpoint di configurazione/recupero del proprietario accettano richieste solo da `127.0.0.1` / `::1`. Imposta `false` dietro un reverse proxy. |

</details>

<details>
<summary><strong>Variabili d'ambiente — file watcher</strong></summary>

Regolano il monitor che sorveglia `uploads/` in tempo reale.

| Variabile                     | Tipo   | Valore predefinito | Descrizione |
|-------------------------------|--------|--------------------|-------------|
| `WATCHER_IGNORE_TTL_SECS`     | u64    | `30`               | Secondi in cui un file appena elaborato viene ignorato (deduplicazione). |
| `WATCHER_STABILITY_CHECK_MS`  | u64    | `300`              | Intervallo tra i controlli di dimensione mentre si attende che un file smetta di crescere. |
| `WATCHER_STABILITY_REQUIRED`  | usize  | `3`                | Controlli consecutivi di dimensione stabile prima che un file sia considerato completamente scritto. |
| `WATCHER_LOCK_TTL_SECS`       | u64    | `300`              | Durata dei lock per file inattivi. |
| `WATCHER_PRUNE_INTERVAL_SECS` | u64    | `10`               | Intervallo per ripulire le strutture interne. |
| `WATCHER_CHANNEL_CAPACITY`    | usize  | `64`               | Dimensione del buffer del canale interno degli eventi. |

Per filesystem lenti o remoti (NFS, SMB), aumenta i valori di stabilità per evitare di registrare file scritti parzialmente.

</details>

---

## Come funziona

<details>
<summary><strong>Panoramica dell'architettura</strong></summary>

```
┌────────────────────────────── Folderlan binary ─────────────────────────────┐
│                                                                            │
│   React SPA (embedded, served on the same origin)                          │
│        │  HTTP / JSON (REST API)                                           │
│   Actix‑web API ──▶ Auth (JWT + Argon2)                                    │
│        │              Users & roles & quotas                               │
│        │              Files & permissions                                  │
│        │              Audit log                                            │
│        ▼                                                                    │
│   SQLite (metadata)    uploads/ (files)    File System Watcher ──▶ auto‑reg │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Un binario, un origin.** L'interfaccia web è compilata nel binario del server e viene servita dallo stesso indirizzo dell'API — nessun web server separato, nessun CORS in produzione.
- **File su disco, metadati in SQLite.** I file fisici vivono in `uploads/`, con nomi sanificati e deduplicazione automatica `name (1).ext` in caso di collisione; il database tiene traccia di nomi, dimensioni, proprietà, visibilità e permessi.
- **Il watcher li mantiene sincronizzati.** I file inseriti in `uploads/` con altri mezzi vengono registrati automaticamente (di proprietà dell'account proprietario); i file eliminati dal disco vengono segnati automaticamente come eliminati. Un controllo di stabilità garantisce che i file scritti parzialmente non vengano mai registrati.
- **I permessi vengono valutati a ogni richiesta.** Il proprietario bypassa tutto; i file pubblici sono visibili; i caricatori vedono sempre i propri file; le concessioni esplicite (`viewer`/`collaborator`) sbloccano azioni specifiche — tutto il resto restituisce `403`.

</details>

---

## Sicurezza e privacy

<details>
<summary><strong>Cosa è protetto, e come</strong></summary>

- **Password:** hash con **Argon2** (memory‑hard) — mai memorizzate in chiaro.
- **Sessioni:** token **JWT** di breve durata (1 ora) firmati con il tuo `SECRET_JWT`.
- **Superficie di bootstrap:** inizializzazione del database, registrazione del proprietario e reset della sua password sono **solo‑locale** di default.
- **Modello di eliminazione:** utenti e file vengono **eliminati in modo soft** — reversibile dal proprietario finché non vengono rimossi fisicamente.
- **Registro di audit:** chi, cosa, quando, da quale IP e se ha avuto successo.
- **I tuoi dati:** tutti i file restano sulla tua macchina. Nessuna telemetria, nessuna archiviazione di terze parti.

</details>

---

## Compilazione dai sorgenti

<details>
<summary><strong>Requisiti</strong></summary>

Per il corretto funzionamento degli script di compilazione sono richiesti i seguenti strumenti. Le versioni mostrate sono quelle consigliate e testate; versioni simili dovrebbero funzionare.

- **Rust 1.96.0** o superiore
- **NodeJS 24.16.0** o superiore
- **PNPM 11.6.0** o superiore

</details>

<details>
<summary><strong>Passaggi di compilazione</strong></summary>

1. **Clona il repository:**
   ```bash
   git clone --depth 1 https://github.com/ImMau14/Folderlan.git
   ```

2. **Compila il progetto** — lo script installa le dipendenze del frontend, compila l'app React, la copia in `backend/dist/` e compila il backend Rust (che incorpora il frontend):
   ```bash
   # Su Linux o Git‑Bash
   bash scripts/build.sh

   # Su Windows (Prompt dei comandi)
   scripts/build.cmd

   # Su Windows (PowerShell)
   ./scripts/build.ps1
   ```

   Aggiungi il flag `--release` per un binario Rust ottimizzato:
   ```bash
   bash scripts/build.sh --release
   ```

3. **Esegui:**
   ```bash
   cd backend
   cargo run --release
   # oppure, se hai compilato senza --release:
   cargo run
   ```

4. Apri `http://localhost:8080` e completa la configurazione iniziale.

</details>

---

## Manutenzione

Folderlan è un **progetto personale** creato per risolvere una necessità personale e
mantenuto nel tempo libero. È stabile, ma issue e pull request possono richiedere
tempo per ricevere risposta. Segnalazioni di bug e problemi di sicurezza si
gestiscono tramite i [modelli di issue](.github/ISSUE_TEMPLATE/) e si applica la
[policy di sicurezza](SECURITY.md) — le aspettative devono restare allineate a un
progetto hobbistico con un unico manutentore.

---

## Licenza

Questo progetto è concesso in licenza MIT — consulta il file [LICENSE](LICENSE) per i dettagli.
