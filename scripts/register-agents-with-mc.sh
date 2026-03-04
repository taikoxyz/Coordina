#!/usr/bin/env bash
set -euo pipefail

MC_URL="${MC_URL:?MC_URL required (e.g. https://mc.example.com)}"
MC_API_KEY="${MC_API_KEY:?MC_API_KEY required}"
NAMESPACE="${NAMESPACE:?NAMESPACE required}"

if [ $# -eq 0 ]; then
  echo "Usage: MC_URL=... MC_API_KEY=... NAMESPACE=... $0 slug1:name1:role1 slug2:name2:role2 ..."
  echo "Example: MC_URL=https://mc.example.com MC_API_KEY=key123 NAMESPACE=eng-alpha $0 alice:Alice:Lead bob:Bob:Engineer"
  exit 1
fi

for entry in "$@"; do
  IFS=: read -r slug name role <<< "$entry"
  host="agent-${slug}.${NAMESPACE}.svc.cluster.local"
  printf "Registering %s (%s) at %s:18789... " "$slug" "$name" "$host"

  curl -sf -X POST "${MC_URL}/api/gateways" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${MC_API_KEY}" \
    -d "{\"name\":\"${name}\",\"host\":\"${host}\",\"port\":18789}" > /dev/null

  curl -sf -X POST "${MC_URL}/api/agents" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${MC_API_KEY}" \
    -d "{\"slug\":\"${slug}\",\"name\":\"${name}\",\"role\":\"${role}\",\"host\":\"${host}\",\"port\":18789}" > /dev/null \
    && echo "OK" || echo "FAILED"
done
