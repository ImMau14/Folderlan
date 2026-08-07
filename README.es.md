# 📁 Folderlan · [![NodeJS CI](https://github.com/ImMau14/Folderlan/actions/workflows/node-ci.yaml/badge.svg)](https://github.com/ImMau14/Folderlan/actions/workflows/node-ci.yaml) [![Rust CI](https://github.com/ImMau14/Folderlan/actions/workflows/rust-ci.yaml/badge.svg)](https://github.com/ImMau14/Folderlan/actions/workflows/rust-ci.yaml)

**Olvídate de las limitaciones. Comparte archivos al instante, directamente entre dispositivos.**

[English](README.MD) · **Español** · [Italiano](README.it.md) · [Português](README.pt.md)

Folderlan es una plataforma de intercambio de archivos autoalojada. Un servidor, cualquier dispositivo con navegador. No necesitas internet en tu LAN, ni nube de terceros, ni suscripción — tus archivos permanecen en tu propio hardware.

---

<img width="1200" height="630" alt="Panel de Folderlan" src="docs/screenshot.webp" />

---

## Tabla de contenidos

- [¿Qué es Folderlan?](#qué-es-folderlan)
- [Casos de uso](#casos-de-uso)
- [Características principales](#características-principales)
- [Inicio rápido](#inicio-rápido)
- [Acceso desde otros dispositivos (LAN)](#acceso-desde-otros-dispositivos-lan)
- [Despliegue como nube privada (VPS)](#despliegue-como-nube-privada-vps)
- [Configuración](#configuración)
- [Cómo funciona](#cómo-funciona)
- [Seguridad y privacidad](#seguridad-y-privacidad)
- [Compilar desde el código fuente](#compilar-desde-el-código-fuente)
- [Mantenimiento](#mantenimiento)
- [Licencia](#licencia)

---

## ¿Qué es Folderlan?

Folderlan es una **aplicación cliente‑servidor empaquetada como un único binario**. El backend (Rust + Actix‑web) es una API REST que almacena los archivos en disco, guarda los metadatos en una base de datos SQLite embebida, gestiona la autenticación y vigila su propia carpeta `uploads/` para registrar los archivos que aparecen sin pasar por la interfaz web. El frontend (React) está compilado y **embebido dentro del binario**, de modo que un único ejecutable *es* toda la aplicación: servidor, API e interfaz web.

Ejecutas un programa, abres `http://<host>:8080` en cualquier navegador y tienes un servidor de intercambio de archivos totalmente funcional con usuarios, permisos, cuotas y un registro de auditoría.

---

## Casos de uso

### 🏠 Transferencia de archivos en LAN — sin internet, sin cables

El caso de uso original: dos dispositivos en el mismo Wi‑Fi, cero internet.

- Envía documentos, fotos, vídeos y archivos grandes entre tu portátil, móvil y escritorio.
- Funciona totalmente sin conexión — los datos nunca salen de tu red.
- Ideal para hogares, oficinas o viajes con internet poco fiable.

### ☁️ Nube privada en un VPS — tu propio "Google Drive" minimalista

Gracias a su arquitectura cliente‑servidor, el mismo binario se convierte en una **nube autoalojada minimalista** al desplegarlo en un VPS alquilado.

- Accede a tus archivos desde cualquier parte del mundo, en cualquier dispositivo.
- Da a familiares, amigos o compañeros sus propias cuentas con permisos granulares.
- Impón cuotas de almacenamiento por usuario para que nadie llene el disco.
- Registro de auditoría completo de quién hizo qué, cuándo y desde qué IP.
- No necesitas cuenta de terceros — los datos son tuyos, en tu servidor.

### 👥 Intercambio de archivos en equipos y oficinas

Equipos pequeños que solo necesitan un espacio compartido sin incorporar un SaaS completo.

- **Propietario** (uno) tiene control total; los **visitantes** reciben exactamente los permisos que les des.
- Roles y acceso por archivo: `viewer` (ver/descargar) vs `collaborator` (también eliminar, compartir, hacer público).
- Visibilidad pública/privada por archivo.
- Restablece contraseñas, suspende cuentas, elimina usuarios en cualquier momento.

### 📥 Automatización con carpetas de destino

Folderlan vigila su carpeta `uploads/` en tiempo real.

- Copia o transfiere archivos directamente a la carpeta (o haz que otro programa escriba allí) y aparecen en la interfaz web automáticamente — registrados, buscables y compartibles, sin pasos manuales.
- Funciona también al revés: eliminar el archivo del disco lo marca como eliminado en la interfaz.
- Útil para buckets de subida, descargas de copias de seguridad o alimentar una biblioteca compartida desde un script de automatización.

### 🔒 Biblioteca multimedia privada y centro de copias de seguridad

- Guarda fotos de la familia, copias de seguridad de proyectos y documentos en una máquina que controlas.
- La autenticación JWT y el hash de contraseñas con Argon2 mantienen fuera a los invitados no deseados.
- El registro de auditoría te da visibilidad total de quién accedió a qué.

---

## Características principales

### Gestión de archivos

- **Subidas en streaming** — los archivos grandes se transmiten directamente al disco con progreso en vivo en la interfaz; pausa, reanudación y cancelación por archivo.
- **Almacenamiento inteligente** — nombres de archivo saneados, deduplicación automática `name (1).ext`, detección MIME.
- **Búsqueda y filtros** — por nombre, rango de tamaño, fecha de subida, visibilidad y autor.
- **Descargas seguras** — transmitidas con verificación de permisos en tiempo real en cada petición.
- **Visibilidad pública/privada** — por archivo, activable con un clic.
- **Compartición granular** — concede acceso `viewer` o `collaborator` sobre un archivo a usuarios concretos.
- **Acciones masivas** — selecciona varios archivos para descargarlos, eliminarlos o cambiar su visibilidad de una vez.

### Usuarios, roles y cuotas

- **Un propietario** — acceso total de administrador, creado durante la configuración inicial.
- **Visitantes ilimitados** — cuentas creadas por el propietario con permisos configurables:
  - `can_upload` — permitir/denegar subidas.
  - `can_delete_own_files` — permitir eliminar las subidas propias.
  - `has_upload_limits` + `upload_limit` — cuota de almacenamiento por usuario en bytes.
- **Niveles de acceso por archivo:** `viewer` (descargar) o `collaborator` (eliminar, compartir, hacer público).
- **Gestión de cuentas** — activar/suspender usuarios, restablecer contraseñas, cuentas con borrado suave (revocable).

### Monitorización, auditoría y seguridad

- **File System Watcher** — detecta al instante los archivos añadidos o eliminados en `uploads/`, con comprobaciones de estabilidad (espera a que el archivo deje de crecer), deduplicación y protección de concurrencia basada en bloqueos.
- **Registro de auditoría completo** — cada acción relevante para la seguridad queda registrada con marca de tiempo, usuario, dirección IP, tipo de evento y éxito/fracaso; explorable en la interfaz con filtros.
- **Autenticación JWT** — tokens de 1 hora, firma HS256, hash de contraseñas Argon2.
- **Arranque solo‑local** — la configuración, el registro del propietario y el restablecimiento de la contraseña del propietario solo aceptan peticiones desde la máquina anfitriona.
- **CORS configurable** — bloqueado a tu origen por defecto; modo permisivo disponible.

### Interfaz y experiencia

- **Binario único** — servidor + API + interfaz web embebida; nada más que instalar.
- **Inicio sin configuración** — la base de datos SQLite se inicializa sola en el primer arranque.
- **4 idiomas** — inglés, español, italiano, portugués.
- **Temas claro y oscuro** con detección de la preferencia del sistema.
- **Responsiva** — diseño completo para escritorio, navegación inferior para móvil.
- **Modo de bajo detalle** — desactiva los efectos pesados en dispositivos de bajo rendimiento.

---

## Inicio rápido

1. **Descarga la última release** para tu plataforma desde la [página de releases](https://github.com/ImMau14/Folderlan/releases). Hay binarios precompilados para **Windows (32 y 64 bits)** y **Linux (64 bits)**, compilados automáticamente por GitHub Actions.
2. **Ejecuta el binario** en la máquina que alojará tus archivos.
3. **Abre un navegador** en esa máquina y ve a `http://localhost:8080` (el puerto por defecto).
4. **Completa la configuración inicial:** la interfaz web se abre en la pantalla de configuración — haz clic en *Start*, elige un **nombre de usuario y contraseña de propietario** (el propietario es el administrador de tu instancia de Folderlan) y quedas automáticamente conectado y listo para subir.
5. **Empieza a compartir.**

> [!WARNING]
> La configuración inicial (creación de la base de datos, registro del propietario) debe hacerse **desde la propia máquina anfitriona** (`localhost`). Estos pasos se rechazan a propósito desde otros dispositivos.

El servidor crea una base de datos SQLite (`db/app.db` por defecto) y una carpeta `uploads/` junto al binario. Todos los archivos que subes acaban en `uploads/`.

> [!TIP]
> Al arrancar, el servidor imprime las direcciones donde está disponible la interfaz web — `Local` (misma máquina) y `Network` (tu IP en la LAN, p. ej. `http://192.168.1.50:8080`). Usa la dirección de red para abrir Folderlan desde otros dispositivos.

---

## Acceso desde otros dispositivos (LAN)

1. Encuentra la IP del servidor en la red — la forma más fácil: cópiala de la URL **Network** impresa al arrancar.
2. Desde cualquier dispositivo en el mismo Wi‑Fi, abre `http://<ip‑del‑servidor>:8080` en el navegador.
3. Los visitantes acceden con las cuentas creadas por el propietario (sección Users del panel).
4. Para crear cuentas de visitante, entra como propietario → **Users** → *Create user* y establece los permisos (subir, eliminar archivos propios, cuota de almacenamiento).

> [!WARNING]
> Folderlan se sirve sobre HTTP plano, no TLS. Úsalo solo en redes de confianza — en Wi‑Fi público o compartido, las contraseñas y los archivos transferidos pueden ser interceptados. Para datos sensibles, prefiere el despliegue [VPS + HTTPS](#despliegue-como-nube-privada-vps).

> [!TIP]
> En Windows, permite el puerto en el firewall (`netsh advfirewall firewall add rule name="Folderlan" dir=in action=allow protocol=TCP localport=8080`) para que otros dispositivos puedan conectarse.

---

## Despliegue como nube privada (VPS)

Cualquier cosa que pueda ejecutar el binario de Linux y sea alcanzable desde internet sirve — un VPS alquilado, un PC viejo en casa con reenvío de puertos o una Raspberry Pi.

Necesitas:
- Un dominio (o simplemente la IP del servidor).
- Un proxy inverso (p. ej. Nginx o Caddy) para terminar HTTPS — *muy recomendado*.
- Opcionalmente, systemd para mantener el servidor en funcionamiento.

> [!CAUTION]
> No expongas Folderlan a internet sin un proxy inverso + HTTPS. Las contraseñas y las transferencias de archivos viajarían en texto plano. Los endpoints de configuración integrados están protegidos por `LOCAL_ONLY` — mantén esa protección hasta que el proxy esté listo, y solo entonces pon `LOCAL_ONLY=false`.

### Paso 1 — Configurar las variables de entorno

Establécelas antes del primer arranque. Como mínimo `SECRET_JWT`, `LOCAL_ONLY=false` y (opcionalmente) `OFF_CORS=true`:

```bash
export PORT=8080
export ADDRESS=0.0.0.0
export SECRET_JWT="$(openssl rand -hex 32)"   # ¡conserva este valor!
export LOCAL_ONLY=false                        # los endpoints de configuración pasan a ser alcanzables a través del proxy
export OFF_CORS=true                           # detrás de un proxy inverso, relaja CORS al origen del proxy
```

> [!IMPORTANT]
> `SECRET_JWT` firma tus tokens de autenticación. Si no se establece, se genera una **clave aleatoria en cada arranque**, lo que invalida todas las sesiones existentes tras un reinicio. Genérala una vez y consérvala.

### Paso 2 — Ejecutar como servicio systemd (Linux)

<details>
<summary><strong>Archivo de unidad systemd completo</strong></summary>

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

### Paso 3 — Proxy inverso con HTTPS

<details>
<summary><strong>Ejemplo de configuración de Nginx</strong></summary>

```nginx
server {
    listen 443 ssl;
    server_name files.example.com;

    ssl_certificate     /etc/letsencrypt/live/files.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/files.example.com/privkey.pem;

    client_max_body_size 0;   # permite subidas grandes; el servidor las transmite en streaming

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

### Paso 4 — Primer arranque en el servidor

1. Inicia el servicio y abre `https://files.example.com` **desde el servidor** (o usa el proxy) para completar la configuración y registrar al propietario.
2. `LOCAL_ONLY=false` permite que el endpoint de configuración se alcance a través de tu dominio una vez que el proxy esté activo.
3. Crea cuentas de visitante, establece cuotas y comparte.

> [!NOTE]
> Haz una copia de seguridad de la carpeta `db/` (base de datos SQLite) y de `uploads/` (tus archivos) para recuperación ante desastres — juntas son toda tu instancia.

---

## Configuración

<details>
<summary><strong>Variables de entorno — servidor</strong></summary>

| Variable      | Tipo   | Valor por defecto | Descripción |
|---------------|--------|-------------------|-------------|
| `PORT`        | u16    | `8080`            | Puerto TCP al que enlazar. |
| `ADDRESS`     | string | `0.0.0.0`         | Dirección de enlace. Usa `127.0.0.1` para exponer solo en local. |
| `SQLITE_FILE` | string | `db/app.db`       | Ruta de la base de datos SQLite. Los directorios superiores se crean automáticamente. |
| `SECRET_JWT`  | string | *hex aleatorio*   | Clave de firma JWT (HS256). Si no se establece, se genera una clave aleatoria nueva **en cada arranque**, invalidando todos los tokens. Establécala para persistencia. |
| `OFF_CORS`    | bool   | `false`           | `true` → permite todos los orígenes; `false` → restringe a `http://{ADDRESS}:{PORT}` con `GET, POST, DELETE, PATCH, OPTIONS` y cabeceras `Content-Type, Authorization`. |
| `LOCAL_ONLY`  | bool   | `true`            | Cuando es `true`, los endpoints de configuración/recuperación del propietario solo aceptan peticiones desde `127.0.0.1` / `::1`. Ponlo en `false` detrás de un proxy inverso. |

</details>

<details>
<summary><strong>Variables de entorno — file watcher</strong></summary>

Ajustan el monitor que vigila `uploads/` en tiempo real.

| Variable                      | Tipo   | Valor por defecto | Descripción |
|-------------------------------|--------|-------------------|-------------|
| `WATCHER_IGNORE_TTL_SECS`     | u64    | `30`              | Segundos que un archivo recién procesado se ignora (deduplicación). |
| `WATCHER_STABILITY_CHECK_MS`  | u64    | `300`             | Intervalo entre comprobaciones de tamaño mientras se espera a que un archivo deje de crecer. |
| `WATCHER_STABILITY_REQUIRED`  | usize  | `3`               | Comprobaciones consecutivas de tamaño estable antes de considerar un archivo completamente escrito. |
| `WATCHER_LOCK_TTL_SECS`       | u64    | `300`             | Vida útil de los bloqueos por archivo en reposo. |
| `WATCHER_PRUNE_INTERVAL_SECS` | u64    | `10`              | Intervalo para limpiar estructuras internas. |
| `WATCHER_CHANNEL_CAPACITY`    | usize  | `64`              | Tamaño del búfer del canal interno de eventos. |

Para sistemas de archivos lentos o remotos (NFS, SMB), aumenta los valores de estabilidad para evitar registrar archivos parcialmente escritos.

</details>

---

## Cómo funciona

<details>
<summary><strong>Visión general de la arquitectura</strong></summary>

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

- **Un binario, un origen.** La interfaz web está compilada en el binario del servidor y se sirve desde la misma dirección que la API — sin servidor web aparte, sin CORS en producción.
- **Archivos en disco, metadatos en SQLite.** Los archivos físicos viven en `uploads/`, con nombres saneados y deduplicación automática `name (1).ext` en caso de colisión; la base de datos registra nombres, tamaños, propiedad, visibilidad y permisos.
- **El watcher los mantiene sincronizados.** Los archivos colocados en `uploads/` por otros medios se registran automáticamente (propiedad de la cuenta de propietario); los archivos eliminados del disco se marcan automáticamente como eliminados. Una comprobación de estabilidad garantiza que los archivos parcialmente escritos nunca se registren.
- **Los permisos se evalúan en cada petición.** El propietario lo elude todo; los archivos públicos son visibles; los autores siempre ven sus propios archivos; las concesiones explícitas (`viewer`/`collaborator`) desbloquean acciones concretas — todo lo demás devuelve `403`.

</details>

---

## Seguridad y privacidad

<details>
<summary><strong>Qué está protegido, y cómo</strong></summary>

- **Contraseñas:** con hash **Argon2** (con uso intensivo de memoria) — nunca se almacenan en texto plano.
- **Sesiones:** tokens **JWT** de corta duración (1 hora) firmados con tu `SECRET_JWT`.
- **Superficie de arranque:** la inicialización de la base de datos, el registro del propietario y el restablecimiento de su contraseña son **solo‑local** por defecto.
- **Modelo de borrado:** los usuarios y archivos se eliminan con **borrado suave** — reversible por el propietario hasta que se eliminan físicamente.
- **Registro de auditoría:** quién, qué, cuándo, desde qué IP y si tuvo éxito.
- **Tus datos:** todos los archivos permanecen en tu máquina. Sin telemetría, sin almacenamiento de terceros.

</details>

---

## Compilar desde el código fuente

<details>
<summary><strong>Requisitos</strong></summary>

Se requieren las siguientes herramientas para que los scripts de compilación funcionen correctamente. Las versiones mostradas son las recomendadas y probadas; versiones similares deberían funcionar.

- **Rust 1.96.0** o superior
- **NodeJS 24.16.0** o superior
- **PNPM 11.6.0** o superior

</details>

<details>
<summary><strong>Pasos de compilación</strong></summary>

1. **Clona el repositorio:**
   ```bash
   git clone --depth 1 https://github.com/ImMau14/Folderlan.git
   ```

2. **Compila el proyecto** — el script instala las dependencias del frontend, compila la app de React, la copia en `backend/dist/` y compila el backend de Rust (que embebe el frontend):
   ```bash
   # En Linux o Git‑Bash
   bash scripts/build.sh

   # En Windows (Símbolo del sistema)
   scripts/build.cmd

   # En Windows (PowerShell)
   ./scripts/build.ps1
   ```

   Añade la opción `--release` para un binario Rust optimizado:
   ```bash
   bash scripts/build.sh --release
   ```

3. **Ejecuta:**
   ```bash
   cd backend
   cargo run --release
   # o, si compilaste sin --release:
   cargo run
   ```

4. Abre `http://localhost:8080` y completa la configuración inicial.

</details>

---

## Mantenimiento

Folderlan es un **proyecto personal** creado para resolver una necesidad propia y
mantenido en el tiempo libre. Es estable, pero las issues y las pull requests
pueden tardar en recibir respuesta. Los informes de errores y los problemas de
seguridad se gestionan mediante las [plantillas de issue](.github/ISSUE_TEMPLATE/),
y se aplica la [política de seguridad](SECURITY.md) — las expectativas deben
ajustarse a un proyecto aficionado con un único mantenedor.

---

## Licencia

Este proyecto está licenciado bajo la Licencia MIT — consulta el archivo [LICENSE](LICENSE) para más detalles.
