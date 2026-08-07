# 🖥️ Folderlan Frontend · [![NodeJS CI](https://github.com/ImMau14/Folderlan/actions/workflows/node-ci.yaml/badge.svg)](https://github.com/ImMau14/Folderlan/actions/workflows/node-ci.yaml)

The official web client for the Folderlan file‑sharing platform — a responsive, themeable, multilingual React SPA that talks to the [Folderlan Backend](https://github.com/ImMau14/Folderlan/tree/main/backend).

---

## Index

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Scripts](#scripts)
- [Tech Stack](#tech-stack)
- [Architecture & Core Concepts](#architecture--core-concepts)
- [UI & Design System](#ui--design-system)
- [Feature Pages](#feature-pages)
- [Adding a Language](#adding-a-language)
- [Code Quality & Tooling](#code-quality--tooling)
- [License](#license)

---

## Overview

The frontend is a single‑page application (SPA) built with **React 19**, **TypeScript**, and **Vite**. It provides the entire user experience of Folderlan: guided first‑run setup, login and owner password recovery, a dashboard with _Upload_, _Download_, _Users_ (owner only) and _Config_ areas, drag‑and‑drop uploads with a per‑file queue, a paginated filterable file grid with bulk actions, owner‑only user management and an audit log explorer — all with full internationalization, light/dark themes and a low‑detail performance mode.

The app is typically served by the backend itself: the Rust server embeds the compiled `dist/` output and serves it from the same origin, which means **no CORS issues and no separate web server** in production.

> [!NOTE]
> The frontend has **no UI state library** (no Redux/Zustand). All state is managed with React Context providers (auth, theme, i18n, toasts, modals, database status, low‑detail) plus local component state.

<details>
<summary><strong>Project structure</strong></summary>

```
frontend/
├── public/                    # Static assets served as-is (favicon, fonts)
├── src/
│   ├── app/                   # Entry point, root providers, router
│   ├── features/
│   │   ├── auth/              # Auth context, guards, login/recovery pages
│   │   ├── dashboard/         # Dashboard layout + Upload/Download/Users/Config pages
│   │   ├── database/          # DB status context + setup guard
│   │   ├── i18n/              # Locales (en/es/it/pt) + context + switcher
│   │   ├── modal/             # Global modal system context
│   │   ├── setup/             # First-run setup flow
│   │   ├── theme/             # Theme context + toggle
│   │   └── toast/             # Toast notification system
│   └── shared/
│       ├── assets/            # Animated background video, logo assets
│       ├── components/        # Button, Input, Select, overlays, etc.
│       ├── config/            # Environment configuration loader
│       ├── hooks/             # useLowDetail
│       ├── styles/            # Global CSS + fonts
│       └── utils/             # ApiClient, formatBytes, formatDatetime, etc.
├── index.html                 # HTML shell with locale pre-bootstrap script
├── vite.config.ts             # Vite + React plugin + @ alias map
├── tailwind.config.ts         # Full design system (palette, components, animations)
├── tsconfig.json / tsconfig.node.json
└── package.json
```

</details>

---

## Quick Start

### Development mode

Requires **Node.js 24+** and **pnpm 11+** (the repo uses `pnpm` — the lockfile is `pnpm-lock.yaml`).

```bash
# From the repo root
cd frontend

# Install dependencies
pnpm install

# Start the Vite dev server (default port 5173)
pnpm dev
```

The dev server proxies nothing by itself: the API base URL is resolved at runtime (see [Environment Configuration](#environment-configuration)). If the backend runs on `localhost:8080`, launch Vite with `VITE_API_URL=localhost pnpm dev`.

> [!TIP]
> In dev mode, serve the backend in parallel with `cargo run --release` inside `backend/`. The special `localhost` value makes the frontend call the backend on port `8080` of the same host.

### Production build

```bash
cd frontend
pnpm install
pnpm build
```

Output goes to `frontend/dist/`. In the monorepo build script (`scripts/build.sh`), this folder is copied to `backend/dist/`, where the Rust backend embeds it into the final binary with `include_dir`.

---

## Scripts

| Script              | Command                                           | Purpose                                                                   |
| ------------------- | ------------------------------------------------- | ------------------------------------------------------------------------- |
| `dev`               | `vite`                                            | Start the dev server with HMR.                                            |
| `build`             | `vite build`                                      | Production build to `dist/`.                                              |
| `type-check`        | `tsgo --noEmit --incremental`                     | Type‑check with the **native TypeScript preview compiler** (much faster). |
| `type-check:legacy` | `tsc --noEmit --incremental`                      | Type‑check with the classic `tsc`.                                        |
| `lint`              | `oxlint`                                          | Lint with oxlint.                                                         |
| `lint:fix`          | `oxlint --fix`                                    | Lint and auto‑fix.                                                        |
| `format`            | `oxfmt`                                           | Format with oxfmt.                                                        |
| `format:check`      | `oxfmt --check`                                   | Verify formatting.                                                        |
| `check`             | `pnpm lint && pnpm type-check`                    | CI‑style lint + type‑check gate.                                          |
| `check:fix`         | `pnpm lint:fix && pnpm format && pnpm type-check` | Fix everything, then verify.                                              |
| `preview`           | `vite preview`                                    | Preview the production build locally.                                     |

---

## Tech Stack

<details>
<summary><strong>Runtime dependencies</strong></summary>

| Package                                     | Version          | Purpose                                                     |
| ------------------------------------------- | ---------------- | ----------------------------------------------------------- |
| `react` / `react-dom`                       | ^19.2.8          | UI framework.                                               |
| `react-router-dom`                          | ^7.18.1          | Routing (`createBrowserRouter`).                            |
| `axios`                                     | ^1.18.1          | HTTP client (interceptors, cancel tokens, progress events). |
| `zod`                                       | ^4.4.3           | Runtime validation of every API response.                   |
| `framer-motion`                             | ^12.42.2         | Animations (page entrances, micro‑interactions, overlays).  |
| `@headlessui/react`                         | ^2.2.10          | Accessible headless UI primitives (menus, modals).          |
| `lucide-react` / `react-icons`              | ^1.25.0 / ^5.7.0 | Icon sets.                                                  |
| `clsx`                                      | ^2.1.1           | Conditional class composition.                              |
| `@fontsource-variable/inter` / `montserrat` | ^5.3.0           | Self‑hosted variable fonts.                                 |

</details>

<details>
<summary><strong>Dev tooling</strong></summary>

| Package                                             | Purpose                                                     |
| --------------------------------------------------- | ----------------------------------------------------------- |
| `vite` + `@vitejs/plugin-react`                     | Build tooling and HMR.                                      |
| `tailwindcss` 3.4 (+ `forms`, `typography` plugins) | Styling.                                                    |
| `oxlint`                                            | Linting (drop‑in ESLint replacement).                       |
| `oxfmt`                                             | Formatting.                                                 |
| `tsgo` / `typescript`                               | Type‑checking (native preview compiler + classic fallback). |
| `eslint-plugin-tailwindcss`                         | Tailwind class‑order linting.                               |

</details>

---

## Architecture & Core Concepts

<details>
<summary><strong>Application bootstrapping — provider tree</strong></summary>

Entry point is `src/app/main.tsx`. Providers wrap the app **in order** — order matters because some contexts depend on others:

```tsx
<StrictMode>
  <I18nProvider>
    {" "}
    {/* 1. Locale resolution (storage → browser) */}
    <ThemeProvider>
      {" "}
      {/* 2. Theme resolution (storage → system) */}
      <AuthProvider>
        {" "}
        {/* 3. Session restore (token TTL check + /api/user/me) */}
        <ToastProvider>
          {" "}
          {/* 4. Global toasts (used by every other provider) */}
          <DatabaseProvider>
            {" "}
            {/* 5. Blocks render until GET /api/db finishes */}
            <LowDetailProvider>
              <ModalProvider>
                <App /> {/* RouterProvider with the route tree */}
              </ModalProvider>
            </LowDetailProvider>
          </DatabaseProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  </I18nProvider>
</StrictMode>
```

`App` applies the `dark` class to the root element based on the current theme, then mounts the router.

</details>

<details>
<summary><strong>Routing & route guards</strong></summary>

The router is built with `createBrowserRouter` in `src/app/router.tsx`:

| Path                  | Element            | Guard                                                                     |
| --------------------- | ------------------ | ------------------------------------------------------------------------- |
| `/`                   | `RootRedirect`     | Redirects to `/setup`, `/login` or `/dashboard` based on DB + auth state. |
| `/setup`              | `SetupPage`        | `SetupGuard` — redirects away if the DB already exists.                   |
| `/login`              | `LoginPage`        | `RequireDb` — redirects to `/setup` if the DB is missing.                 |
| `/owner-recover`      | `OwnerRecoverPage` | `RequireDb`.                                                              |
| `/dashboard`          | `DashboardLayout`  | `RequireAuth` — redirects to `/setup`/`/login`.                           |
| `/dashboard/upload`   | `UploadPage`       | `RequireAuth`.                                                            |
| `/dashboard/download` | `DownloadPage`     | `RequireAuth`.                                                            |
| `/dashboard/config`   | `ConfigPage`       | `RequireAuth`.                                                            |
| `/dashboard/users`    | `UsersPage`        | `RequireAuth` + `RequireOwner` (owner only).                              |
| `*`                   | `NotFoundPage`     | —                                                                         |

Guards:

- **`RequireAuth`** — checks `dbExists` (redirects to `/setup`) and `isAuthenticated` (redirects to `/login`).
- **`RequireOwner`** — only users with `role === "owner"` pass; visitors are bounced back to `/dashboard`.
- **`SetupGuard`** — prevents visiting `/setup` once the database exists.
- **`RequireDb`** — prevents auth pages when the DB has not been initialized.

</details>

<details>
<summary><strong>API layer (`ApiClient`)</strong></summary>

`src/shared/utils/ApiClient/index.ts` is a thin, fully typed wrapper over an **axios instance**:

- **Runtime validation:** every response is validated against a **Zod schema** (`ApiClient/types.ts`) before being returned. A mismatch yields a `"Response validation failed"` error instead of a silent crash.
- **Error model:** all results are discriminated unions — `{ success: true, data, status, headers }` or `{ success: false, error: ApiError, status }`. Helpers `unwrap()` and `handleResult()` convert between the two styles.
- **Cancellation:** `createCancelToken()` exposes an axios `CancelTokenSource`; cancelled requests return code **499** (`"Request cancelled"`). The upload page uses this for pause/cancel.
- **Progress:** `onUploadProgress` / `onDownloadProgress` callbacks wired through request options.
- **Token injection:** a request interceptor adds `Authorization: Bearer <token>` when a token is set; `setToken()`/`clearToken()` manage it.
- **Timeouts:** default 30 s; timeouts map to `ApiError(408)`.
- **Blob downloads:** `requestBlob()` fetches with `responseType: "blob"` and parses `Content-Disposition` to recover the server filename; JSON error payloads are still extracted and surfaced with the correct message.
- **FormData handling:** `Content-Type` is explicitly unset when the payload is `FormData` so the browser sets the multipart boundary.

The client exposes one method per backend endpoint: `checkDb`, `initDb`, `login`, `registerVisitor`, `ownerRegister`, `ownerResetPassword`, `visitorResetPassword`, `getAudit`, `uploadFile`, `listFiles`, `deleteFile`, `downloadFile`, `grantFilePerms`, `listFilePerms`, `revokeFilePerm`, `getUsers`, `deleteUser`, `toggleUser`, `updateUserPerms`, `getAccessibleFiles`, `getMe`, `toggleFilePublic`.

**Important:** boolean fields like `is_active`, `can_upload`, etc. arrive from the backend as **integers (0/1)**. The Zod schemas normalize them with `.transform(v => Boolean(v))` — always type them accordingly when consuming raw API data.

</details>

<details>
<summary><strong>Environment configuration</strong></summary>

`src/shared/config/env.ts` validates configuration with Zod at startup. The only variable is `VITE_API_URL`, resolved at runtime in this order:

| Value       | Result                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------ |
| _(unset)_   | `window.location.origin` — the default. Correct when the backend serves the SPA from the same origin (production). |
| `localhost` | `http://<current host>:8080` — dev mode with the backend on the default port.                                      |
| any URL     | Used verbatim (e.g., `https://files.example.com`).                                                                 |

Invalid values throw `TypeError: No valid environment variables was detected` at startup. Because the API URL falls back to the page origin, the same build works in LAN mode and behind a reverse proxy with zero rebuilds.

</details>

<details>
<summary><strong>Authentication & session management</strong></summary>

Managed by `AuthContext` (`src/features/auth/context/AuthContext.tsx`):

- **Storage keys** (localStorage): `auth_token`, `auth_token_ts`, `auth_user`.
- **Client‑side TTL:** tokens are considered valid for **1 hour** (`TOKEN_TTL_MS`), mirrored by the backend's JWT `exp`.
- **Session restore:** on mount, if a token exists and is not expired, `GET /api/user/me` is called to re‑validate it and refresh the cached user (permission flags included). Any failure → storage is cleared and the user lands on `/login`.
- **`refresh()`** re‑stamps the timestamp if the token is still valid, or logs out.
- **User shape:** `{ id, username, role: "owner" | "visitor", can_upload, can_delete_own_files, has_upload_limits, upload_limit }` — the role and flags drive most UI decisions (guards, button visibility, permission‑based rendering).

**Caution:** sessions live in `localStorage`, which is readable by any script on the same origin. This is an acceptable trade‑off for a self‑hosted app, but never add third‑party script CDNs to the served page.

</details>

<details>
<summary><strong>Internationalization (i18n)</strong></summary>

`I18nContext` implements a dependency‑free translation engine:

- **Locales:** `en`, `es`, `it`, `pt` — plain JSON dictionaries in `src/features/i18n/locales/` (`SUPPORTED_LOCALES`).
- **Nested keys:** `t("menu.upload")` walks the JSON tree by dot segments.
- **Interpolation:** `{{var}}` placeholders are replaced from a replacements object.
- **Plurals:** if a replacement named `count` is passed and its value is not `1`, the key `{lastSegment}_plural` is used when present.
- **Persistence & detection:** the locale is stored in localStorage under `folderlan:locale`; on first visit the browser language is detected (`navigator.language`, normalized from `es-ES` → `es`), falling back to `en`.
- **FOUC prevention:** `index.html` contains an inline script that writes the initial locale to localStorage and sets `<html lang>` **before React mounts**, so the first paint is already in the right language.
- `document.documentElement.lang` is kept in sync on change.

</details>

<details>
<summary><strong>Theming</strong></summary>

`ThemeContext` (`src/features/theme/context/ThemeContext.tsx`):

- **Storage:** localStorage key `folderlan:theme` (`"light"` / `"dark"`), default light.
- **System preference:** `prefers-color-scheme: dark` is honored when nothing is stored, and the app **live‑tracks system changes** (`matchMedia` change listener).
- **Application:** the `dark` class is toggled on `<html>` (Tailwind `darkMode: "selector"`) and `data-theme` is set; the meta `theme-color` is synced (`#020617` dark / `#ffffff` light) so mobile browser chrome matches.
- The palette itself is defined with **HSL CSS custom properties** in `tailwind.config.ts` and exposed as Tailwind colors (`ui-*`).

</details>

<details>
<summary><strong>Low‑detail mode, toasts & modals</strong></summary>

- **Low‑detail mode** (`useLowDetail`, localStorage key `folderlan:lowDetail`, toggle in Config) disables expensive visual effects — primarily blur/backdrop‑filter surfaces — for low‑power devices.
- **Toasts** (`ToastContext`): programmatic notifications with `type` (`success | error | warning | info`), title, description, and duration. Toasts can be globally disabled from the Config page (`toastEnabled`).
- **Modals** (`ModalContext`): `openComponent(Component, props, options)` mounts any component into a shared modal shell (`{ paddingless: true }` for full‑bleed content). Used by the download page (filters, permissions, delete), users page (create, perms, delete, reset password) and config page.

</details>

---

## UI & Design System

<details>
<summary><strong>Tailwind configuration — the four plugins</strong></summary>

`tailwind.config.ts` defines the entire design system as four custom plugins:

1. **Palette plugin** — dual‑theme HSL CSS variables for backgrounds, text, borders, semantic colors (primary/secondary/danger/warning/success/info) and their hover/active variants, plus card shadows and glassmorphism variables (light and dark).
2. **Scrollbar plugin** — `.scrollbar`, `.scrollbar-rounded`, `.scrollbar-thin` utilities plus `scrollbar-thumb-*` / `scrollbar-track-*` color utilities.
3. **Animations plugin** — JIT‑safe `@keyframes` (`stagger-fade-up`, `fall-and-slide-*`), a `.stagger-group` system that staggers up to 10 children, `.animate-fall-on-{1..10}` entrance classes, and a `.scroll-fade-y` CSS‑mask fade utility.
4. **Components plugin** — reusable classes: `.card` (gradient + shadow + hover scale), `.glass` / `.glass-smoked` (glassmorphism surfaces), `.btn-glass` (translucent glass button).

**Design tokens:**

- **Fonts:** Montserrat Variable for headings (`font-heading`), Inter Variable for body (`font-body`), both self‑hosted via Fontsource.
- **Type scale:** modular ratio 1.25 from 12 px (`text-xs`) up to 39 px (`text-4xl`); every size ships a matching `lineHeight` and optical `letterSpacing`.
- **Colors:** consumed as `ui-*` Tailwind colors (e.g. `bg-ui-back`, `text-ui-text-muted`, `bg-ui-primary`).
- **Extra spacing:** `128/144/152` (32–38 rem) for wide layouts.
- **Motion:** entrance animations use a consistent `ease [0.2, 0, 0, 1]` curve with 0.3 s durations and incremental delays for stagger.

</details>

<details>
<summary><strong>Shared components</strong></summary>

| Component                                   | Purpose                                                                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `Button`, `Input`, `Select`, `LabeledInput` | Form primitives styled with the `ui-*` tokens.                                                                            |
| `AnimatedBackground`                        | Full‑screen background video (`bg.webm`) with a 5 s fallback timeout and graceful degradation when the video cannot load. |
| `GlobalControlsOverlay`                     | Fixed top‑right glass pill exposing the language switcher + theme toggle on auth/setup pages.                             |
| `FolderlanSvg`                              | Brand logo component.                                                                                                     |
| `LoadingPage` / `NotFoundPage`              | Boot loading screen and 404 page.                                                                                         |
| `FloatingContainer`                         | Floating glass panel used as a page section wrapper.                                                                      |

Utilities: `formatBytes` (human readable sizes), `formatDatetime` (localized timestamps), `setPageName` (syncs the top bar title), `setThemeColor` (meta theme‑color sync).

</details>

---

## Feature Pages

<details>
<summary><strong>Setup — first‑run wizard</strong></summary>

`SetupPage` (reachable only when the DB is missing) orchestrates the 3‑step bootstrap in order:

1. `POST /api/db` — run migrations.
2. `POST /api/auth/owner_register` — create the single owner account.
3. `POST /api/auth/login` — **auto‑login** as the owner.

It shows a welcome screen (`SetupWelcome`) first, then the form (`SetupForm`). All three steps are gated by the backend's `LocalOnly` middleware, so the API calls must originate from the host machine.

</details>

<details>
<summary><strong>Login & owner recovery</strong></summary>

- **LoginPage** — credential form; on success it calls `AuthContext.login(token, user)` and navigates to `/dashboard`. It renders over the animated background with the global controls overlay (language/theme) available pre‑login.
- **OwnerRecoverPage** — lets the owner reset their password through the local‑only `POST /api/auth/owner_reset_password` endpoint. Shown on the login page as a fallback link for locked‑out owners; requires being on the host machine (LocalOnly).

</details>

<details>
<summary><strong>Upload — queue‑based drag & drop uploads</strong></summary>

`UploadPage` (`src/features/dashboard/pages/UploadPage/index.tsx`):

- **DropZone:** click‑to‑browse or drag‑and‑drop (with `copy` drop effect and active‑state styling).
- **Queue (`FileQueue`):** one entry per file with per‑file state machine: `idle → uploading → done | error | paused`.
- **Deduplication:** files are keyed by `name-size-lastModified`; adding the same file twice is ignored.
- **Progress:** `onUploadProgress` drives a live percentage per file.
- **Pause / cancel:** an axios `CancelTokenSource` per file is created on start and stored in a ref map; pausing cancels the in‑flight request (backend aborts and the file is left unregistered). Cancelled → status `paused`; the file can be started again.
- **Bulk controls:** _Upload all_ and _Pause all_; individual files can be paused/resumed/removed.
- **Summary toast:** after the batch finishes, a toast reports `N/M succeeded` (success, partial‑warning, or all‑failed error).
- **Permission gating:** users without `can_upload` see an explanatory empty state instead of the dropzone.

Each upload is a **single streaming multipart request** to `POST /api/files/upload`. There is no client‑side chunking; large files are streamed by the backend directly to disk.

</details>

<details>
<summary><strong>Download — paginated file explorer with bulk actions</strong></summary>

`DownloadPage` is the largest screen and acts as the single source of truth for its child components (props‑only communication):

- **Listing:** paginated at **25 files/page** (`PAGE_SIZE`), refetched on page change or filter application.
- **Search:** name search is **debounced 400 ms**; the other filters open in a modal: size range (min/max bytes), date range (start/end), visibility (public/private) and uploader.
- **Selection:** click toggles a file into the selection `Set`; clicking elsewhere (outside `[data-file-card]`, `[data-action-bar]`, `[data-modal]`) clears it.
- **Floating ActionBar:** appears only when files are selected, with bulk _download_ (sequential, to avoid flooding the server), _visibility_ (open the permission modal) and _delete_.
- **Management gating:** a file is manageable when `my_access` (returned by the backend per file) is `owner` or `collaborator`; bulk buttons only enable when **every** selected file is manageable, preventing partial 403s. Falls back to the user's role when the field is absent.
- **Download:** double‑click fetches the blob, creates a temporary `<a download>` and clicks it; the server filename from `Content-Disposition` is preferred.
- **Visibility:** per‑file public/private toggle; the permission modal precomputes the state of the selection (`true` / `false` / `"mixed"`).
- **Prefetch:** the user list is prefetched on mount so the filters/permission modals open instantly.
- **Permissions modal:** grants/revokes `viewer`/`collaborator` access and toggles public visibility across the selected files.

</details>

<details>
<summary><strong>Users — owner‑only user administration</strong></summary>

`UsersPage` (route wrapped in `RequireOwner`):

- **Listing:** paginated at **10 users/page**, debounced name search (400 ms), status filter (`active`/`inactive`) and permission filters (`can_upload`, `can_upload:false`, `can_delete_own_files`, `can_delete_own_files:false`).
- **Create user modal:** username + password + all permission flags (`can_upload`, `can_delete_own_files`, `has_upload_limits`, `upload_limit` in bytes).
- **Row actions:** toggle active status (with per‑row busy state), edit permissions (PermsModal), reset password (owner reset endpoint), delete (with confirmation modal).
- The owner row cannot be toggled or deleted.

</details>

<details>
<summary><strong>Config — dashboard, preferences and audit explorer</strong></summary>

`ConfigPage` combines four areas:

- **SummarySection** — for the current user: accessible file count, accessible bytes, own bytes, quota (if `has_upload_limits`), and (owner only) active user count. Computed from `GET /api/user/{id}/accessible` and a user count query.
- **UI preferences** — theme pills (light/dark), language select, low‑detail mode toggle, toast notifications toggle.
- **AccountSection** — account summary and storage usage.
- **Audit log explorer (owner only)** — filters (event type, success/failed, user, start/end date), paginated table at **15 rows/page**, with the total derived from the first row's `total_count` (windowed pagination).

</details>

---

## Adding a Language

<details>
<summary><strong>Step by step</strong></summary>

1. Copy `src/features/i18n/locales/en.json` to `src/features/i18n/locales/<code>.json` and translate all values (keep keys untouched).
2. Register the code in `SUPPORTED_LOCALES` in `src/features/i18n/context/I18nContext.tsx`.
3. Add the display name to the `language.*` keys in every locale file.
4. Add the code to the `supported` array of the inline script in `index.html` (so browser detection knows about it).
5. Type‑check and lint: `pnpm check`.

</details>

---

## Code Quality & Tooling

The project uses the **Oxc toolchain** for speed:

- **`oxlint`** — fast linting with Tailwind class‑order rules via `eslint-plugin-tailwindcss`.
- **`oxfmt`** — opinionated formatting (no config files needed).
- **`tsgo`** — the TypeScript native preview compiler for type‑checking; `type-check:legacy` falls back to `tsc`.
- CI runs the `node-ci.yaml` workflow, which executes `pnpm lint && pnpm type-check` (the `check` script) and a production build.

> [!TIP]
> Run `pnpm check:fix` before committing to auto‑fix lint issues, format, and type‑check in one shot.

---

## License

MIT — see the [LICENSE](https://github.com/ImMau14/Folderlan/blob/main/LICENSE) file in the repository root.
