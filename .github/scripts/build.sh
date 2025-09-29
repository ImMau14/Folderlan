#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

TARGET=${1:-}
WORKSPACE=${2:-${GITHUB_WORKSPACE:-$(pwd)}}

if [[ -z "$TARGET" ]]; then
  echo "Usage: $0 <target> [workspace]"
  exit 2
fi

echo "Building target=$TARGET workspace=$WORKSPACE"

# Build
cd backend
cargo build --release --target "$TARGET"
cd ..

# Binary produced by cargo
SRC_BIN="backend/target/${TARGET}/release/backend"

if [[ ! -f "$SRC_BIN" ]]; then
  echo "ERROR: expected binary at $SRC_BIN but not found"
  ls -la "backend/target/${TARGET}/release" || true
  exit 3
fi

# PLATFORM
PLATFORM="linux"

ARCH="unknown"
if [[ "$TARGET" == *"x86_64"* || "$TARGET" == *"x86-64"* ]]; then
  ARCH="x86_64"
elif [[ "$TARGET" == *"i686"* || "$TARGET" == *"i386"* ]]; then
  ARCH="i686"
fi

FOLDER_NAME="folderlan-${PLATFORM}-${ARCH}"
ARCHIVE_NAME="${FOLDER_NAME}.zip"

# Prepare folder and copy the binary renamed to 'Folderlan'
mkdir -p "$WORKSPACE/$FOLDER_NAME"
DEST_NAME="Folderlan"

cp "$SRC_BIN" "$WORKSPACE/$FOLDER_NAME/$DEST_NAME"
chmod +x "$WORKSPACE/$FOLDER_NAME/$DEST_NAME" || true

# Create archive (include the folder itself inside the ZIP)
pushd "$WORKSPACE" >/dev/null
if command -v zip >/dev/null 2>&1; then
  zip -r "$ARCHIVE_NAME" "$FOLDER_NAME"
else
  # fallback: use python zip (if zip not present)
  python - <<PY
import shutil, sys
shutil.make_archive("${FOLDER_NAME}", 'zip', "${FOLDER_NAME}")
PY
  mv "${FOLDER_NAME}.zip" "$ARCHIVE_NAME"
fi
popd >/dev/null

echo "Created archive at: $WORKSPACE/$ARCHIVE_NAME"

# Export the archive name to the step outputs
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "archive_name=${ARCHIVE_NAME}" >> "$GITHUB_OUTPUT"
else
  # fallback (improbable)
  echo "archive_name=${ARCHIVE_NAME}"
fi
