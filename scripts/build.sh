set -euo pipefail

# Determine repo root (parent of scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Ensure we return to repo root on exit (success or failure)
cleanup() {
  cd "$REPO_ROOT" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Move to repo root
cd "$REPO_ROOT" || { echo "Cannot change to repo root: $REPO_ROOT"; exit 1; }

# Check dependencies
if ! command -v pnpm &> /dev/null; then
  echo "pnpm is not installed."
  exit 1
fi
if ! command -v rustc &> /dev/null; then
  echo "Rust is not installed."
  exit 1
fi

# Determine build mode
BUILD_MODE=""
if [[ "${1:-}" == "--release" ]]; then
  BUILD_MODE="--release"
fi

# Frontend: install & build
if [[ ! -d "frontend" ]]; then
  echo "frontend directory not found at $REPO_ROOT/frontend"
  exit 1
fi

echo "Running pnpm install in frontend..."
pushd frontend >/dev/null
call_pnpm_install() { pnpm install; }

pnpm install
if [[ $? -ne 0 ]]; then
  echo "pnpm install failed."
  popd >/dev/null
  exit 1
fi

echo "Building frontend..."
pnpm build
if [[ $? -ne 0 ]]; then
  echo "pnpm build failed."
  popd >/dev/null
  exit 1
fi
popd >/dev/null

# Replace backend/dist with frontend/dist
if [[ ! -d "backend" ]]; then
  echo "backend directory not found at $REPO_ROOT/backend"
  exit 1
fi
echo "Removing existing backend/dist (if any)..."
rm -rf backend/dist
mkdir -p backend/dist
echo "Copying frontend/dist to backend/dist..."
cp -r frontend/dist/. backend/dist/

# Backend: build
pushd backend >/dev/null
echo "Building backend with cargo $BUILD_MODE..."
cargo build $BUILD_MODE
if [[ $? -ne 0 ]]; then
  echo "cargo build failed."
  popd >/dev/null
  exit 1
fi
popd >/dev/null

# Explicitly ensure we are at repo root before finishing (trap also covers this)
cd "$REPO_ROOT" || true
echo "Build completed successfully."
