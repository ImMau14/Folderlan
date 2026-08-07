# Security Policy

Folderlan is a self-hosted file-sharing server with user authentication, quotas,
and permissions. Security is taken seriously.

## Supported versions

Only the **latest stable release** is supported with security fixes. Please
upgrade to the newest release (`v1.x` line) as soon as possible.

## Reporting a vulnerability

**Do not open a public issue** for security vulnerabilities.

Report security issues privately by email to **immau140@gmail.com**.

Please include:

- The Folderlan version affected (e.g. `v1.0.0`)
- How you deployed it (pre-built binary, built from source, on a VPS)
- A description of the vulnerability and its impact
- Steps to reproduce, if possible
- Whether you would like public credit for the discovery

### What happens next

- You will receive an acknowledgment as soon as possible. Folderlan is a
  side project maintained on free time, so expect a few days — there is no
  guaranteed response time.
- The issue is investigated and a fix is prepared in a private branch.
- The fix lands in the next stable release.
- After the release, the vulnerability is disclosed publicly (advisory) with
  credit to the reporter unless they prefer otherwise.

## Security notes for deployments

- Set a strong `SECRET_JWT` on every deployment — a default or weak value
  compromises all sessions.
- If the server is reachable from the internet, expose it only through HTTPS
  (for example a reverse proxy with a TLS certificate).
- Prefer binding to `ADDRESS=0.0.0.0` behind a firewall rather than relying on
  `LOCAL_ONLY` to protect the file watcher.
- Upgrade regularly: security fixes are only provided for the latest release.
