#!/bin/sh
set -e
cd "$(dirname "$0")"

BUILD=0
VERBOSE=info
PORT=
OPTIMIZE=0

for arg in "$@"; do
  case "$arg" in
    --build)       BUILD=1 ;;
    --optimize)    OPTIMIZE=1 ;;
    --verbose=*)   VERBOSE="${arg#--verbose=}" ;;
    --port=*)      PORT="${arg#--port=}" ;;
    --help|-h)
      echo "Usage: start.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --build              Force rebuild of Docker images before starting"
      echo "  --optimize           Enable compiler optimizations (default: off)"
      echo "  --port=N             Bind the UI to host port N (default: auto-detect free port from 3000)"
      echo "  --verbose=LEVEL      Output verbosity:"
      echo "                         info   quiet pull, detached, print URL (default)"
      echo "                         debug  plain build output, detached, then follow logs"
      echo "                         trace  foreground mode, full output (blocks until Ctrl-C)"
      echo "  --help, -h           Show this help message"
      exit 0
      ;;
    *) echo "Unknown option: $arg" >&2; echo "Run 'start.sh --help' for usage." >&2; exit 1 ;;
  esac
done

case "$VERBOSE" in
  info|debug|trace) ;;
  *) echo "Error: --verbose must be info, debug, or trace" >&2; exit 1 ;;
esac

# Find a free local port starting at N (ignoring our own running containers)
find_free_port() {
  p="${1:-3000}"
  # If the port is occupied by our own compose stack, reuse it
  running=$(docker compose port ui 3000 2>/dev/null | grep -oE '[0-9]+$' || echo "")
  if [ -n "$running" ]; then
    printf '%s' "$running"
    return
  fi
  while nc -z 127.0.0.1 "$p" 2>/dev/null; do
    p=$((p + 1))
  done
  printf '%s' "$p"
}

if [ -z "$PORT" ]; then
  PORT=$(find_free_port 3000)
fi

export UI_PORT="$PORT"
export OPTIMIZE
export GOOGLE_REDIRECT_BASE="${GOOGLE_REDIRECT_BASE:-http://localhost:$PORT}"

# Check gcloud CLI on the host (needed to complete Google sign-in)
if ! command -v gcloud >/dev/null 2>&1; then
  echo ""
  echo "WARNING: gcloud CLI not found on this machine."
  echo "Google account sign-in requires gcloud on your local machine."
  echo ""
  echo "Install options:"
  echo "  macOS (Homebrew): brew install --cask google-cloud-sdk"
  echo "  Linux:            curl https://sdk.cloud.google.com | bash"
  echo "  All platforms:    https://cloud.google.com/sdk/docs/install"
  echo ""
  printf "Continue without gcloud? [y/N] "
  read -r _ans
  case "$_ans" in
    y|Y) ;;
    *) exit 1 ;;
  esac
  echo ""
fi

# Build flags
BUILD_FLAGS=
case "$VERBOSE" in
  debug|trace) BUILD_FLAGS="--progress=plain" ;;
esac

if [ "$BUILD" = "1" ]; then
  docker compose build $BUILD_FLAGS
fi

# Up
case "$VERBOSE" in
  trace)
    docker compose up
    ;;
  debug)
    docker compose up -d
    echo "http://localhost:$PORT"
    docker compose logs -f
    ;;
  *)
    docker compose up -d --quiet-pull
    echo "http://localhost:$PORT"
    ;;
esac
