# Contributing to Folderlan

Thanks for your interest in contributing! Folderlan is a single self-hosted binary
(Rust backend + React frontend) for sharing files over your LAN or private VPS.

This guide covers how to report issues, set up the project, and submit pull requests.

## Ways to contribute

- **Report a bug** — open an issue using the [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml). Include your OS, browser, version, and backend logs (remove secrets).
- **Request a feature** — open an issue using the [feature request template](.github/ISSUE_TEMPLATE/feature_request.yml).
- **Submit code** — fix bugs or add features. For non-trivial changes, open an issue first to discuss the approach.
- **Improve docs** — the README files live at the repo root (`README.MD`), `backend/README.md`, and `frontend/README.md`.

## Development setup

### Prerequisites

| Tool   | Version  |
| ------ | -------- |
| Rust   | 1.96.0+  |
| Node.js| 24.x     |
| pnpm   | 11.x     |

### Running the backend

```bash
cd backend
cargo run
```

On first start, the server prints the URLs to use:

```
INFO ➜  Local:   http://localhost:8080
INFO ➜  Network: http://192.168.1.101:8080
```

The first visit shows the setup page, where you create the owner user.

Configuration is done through environment variables — see `backend/README.md` for
the full reference (`PORT`, `ADDRESS`, `SQLITE_FILE`, `SECRET_JWT`, `LOCAL_ONLY`, etc.).

### Running the frontend in dev mode

```bash
cd frontend
pnpm install
pnpm dev
```

`pnpm dev` starts the Vite dev server and proxies API calls to the backend running
on port 8080.

### Building the full binary

```bash
scripts/build.sh            # debug build
scripts/build.sh --release  # release build
```

This builds the frontend, copies `frontend/dist` into `backend/dist` (where the
backend serves the SPA from), and compiles the Rust binary. Windows equivalents:
`scripts/build.cmd` and `scripts/build.ps1`.

## Project structure

```
backend/   Rust backend (Actix-web, SQLite via sqlx, JWT auth, file watcher)
frontend/  React 19 + TypeScript frontend (Vite, Tailwind, i18n, themes)
scripts/   Build scripts (bash, cmd, PowerShell)
.github/   CI workflows and GitHub templates
```

## Code style

- **Rust**: follow `rustfmt`. Clippy runs with `-D warnings` in CI, so keep it
  warning-free locally:
  ```bash
  cargo fmt
  cargo clippy -- -D warnings
  cargo test
  ```
- **Frontend**: lint with `oxlint`, type-check with `tsgo`, format with `oxfmt`:
  ```bash
  pnpm check    # oxlint + type-check
  pnpm format   # oxfmt
  ```
  Note: `pnpm format` also formats `frontend/README.md` — run it after editing
  docs inside `frontend/`, or the `format` CI check will fail.
- Follow the existing code conventions of the file you are touching.

## Commit conventions

Commits follow [Conventional Commits](https://www.conventionalcommits.org) with a
scope when useful:

```
feat(backend): Print Local and Network URLs at startup
fix(frontend): Guard the download route for logged-out users
docs(backend): Document access level and response codes
chore(frontend): Remove unused fonts dir
```

Allowed types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`, `ci`.
Scopes commonly used: `backend`, `frontend`, `docs`, `scripts`.

## Branching and pull requests

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feat/my-change
   ```
2. Make your changes and commit them with Conventional Commits.
3. Push the branch and open a pull request against `main` using the
   [PR template](.github/PULL_REQUEST_TEMPLATE.md).
4. CI (`rust-ci` and `node-ci`) must pass before the PR is merged. Check the
   result of all required checks and fix any failures.
5. Keep the scope of a PR focused: one feature or bug per PR.

If the PR changes user-facing behavior or endpoints, update the relevant
documentation in the same PR.

## Testing

- Backend: `cargo test` from `backend/`.
- Full build: `scripts/build.sh --release` — verifies the frontend bundles and the
  backend serves the SPA correctly.
- Manual smoke test: run the release binary, open the Network URL from another
  device, and exercise upload/download plus the user/permission flows.

## Releasing (maintainers only)

Releases follow [Semantic Versioning](https://semver.org). To publish a new
version:

1. Bump `version` in `backend/Cargo.toml` and `frontend/package.json`.
2. Tag and create the release:
   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   gh release create vX.Y.Z --title "vX.Y.Z" --notes "..." --latest
   ```
3. The `rust-cross-compilation-release` workflow builds the binaries (Linux
   x86_64, Windows x86_64, Windows i686) and attaches them to the release
   automatically.

## Code of Conduct

Be respectful and inclusive. The full terms are in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
