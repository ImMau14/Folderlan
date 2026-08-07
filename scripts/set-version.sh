#!/usr/bin/env bash
set -euo pipefail

# Usage: scripts/set-version.sh <x.y.z>
# Updates the app version in backend/Cargo.toml, backend/Cargo.lock and frontend/package.json.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

NEW_VERSION="${1:-}"
if [[ -z "$NEW_VERSION" ]]; then
  echo "Usage: $0 <version>" >&2
  echo "Example: $0 1.2.0" >&2
  exit 1
fi

if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: version must match 'major.minor.patch' (e.g. 1.2.0)" >&2
  exit 1
fi

# backend/Cargo.toml
if [[ ! -f backend/Cargo.toml ]]; then
  echo "backend/Cargo.toml not found at $REPO_ROOT/backend" >&2
  exit 1
fi
sed -i -E "s/^version = \"[0-9]+\.[0-9]+\.[0-9]+\"$/version = \"$NEW_VERSION\"/" backend/Cargo.toml

# backend/Cargo.lock (root package only)
if [[ -f backend/Cargo.lock ]]; then
  sed -i -E "/^name = \"backend\"$/,+1s/version = \"[0-9]+\.[0-9]+\.[0-9]+\"/version = \"$NEW_VERSION\"/" backend/Cargo.lock
fi

# frontend/package.json
if [[ ! -f frontend/package.json ]]; then
  echo "frontend/package.json not found at $REPO_ROOT/frontend" >&2
  exit 1
fi
sed -i -E "s/^(\s*\"version\":\s*)\"[0-9]+\.[0-9]+\.[0-9]+\"/\1\"$NEW_VERSION\"/" frontend/package.json

echo "Version updated to $NEW_VERSION in backend/Cargo.toml, backend/Cargo.lock and frontend/package.json"
echo "Frontend displays it at build time via import.meta.env.APP_VERSION."