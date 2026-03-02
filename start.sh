#!/bin/sh
set -e
cd "$(dirname "$0")"

BUILD=0
VERBOSE=info
PORT=

for arg in "$@"; do
  case "$arg" in
    --build)       BUILD=1 ;;
    --verbose=*)   VERBOSE="${arg#--verbose=}" ;;
    --port=*)      PORT="${arg#--port=}" ;;
    *) echo "Usage: start.sh [--build] [--verbose=info|debug|trace] [--port=N]" >&2; exit 1 ;;
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
export GOOGLE_REDIRECT_BASE="${GOOGLE_REDIRECT_BASE:-http://localhost:$PORT}"

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
