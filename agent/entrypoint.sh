#!/bin/bash
set -e

echo "=== ClawTeam Agent Container ==="
echo "Member ID:    ${MEMBER_ID}"
echo "Role:         ${MEMBER_ROLE}"
echo "Model:        ${MEMBER_MODEL_PROVIDER}/${MEMBER_MODEL_ID}"

# Generate zeroclaw config from env vars
mkdir -p /home/zeroclaw/.config/zeroclaw
envsubst < /app/config/zeroclaw.toml.tmpl > /home/zeroclaw/.config/zeroclaw/config.toml
echo "Generated ZeroClaw config for: ${MEMBER_ID}"

# Seed memory directory from team volume if first boot
MEMBER_DIR="${TEAM_VOLUME}/members/${MEMBER_ID}"
LOCAL_MEM="/home/zeroclaw/.local/share/zeroclaw"
mkdir -p "${LOCAL_MEM}"
if [ ! -f "${LOCAL_MEM}/.initialized" ] && [ -d "${MEMBER_DIR}/seed" ]; then
    cp -rn "${MEMBER_DIR}/seed/." "${LOCAL_MEM}/" 2>/dev/null || true
    touch "${LOCAL_MEM}/.initialized"
    echo "Seeded memory from team volume"
fi

# Ensure mailbox directory exists
mkdir -p "${TEAM_VOLUME}/members/${MEMBER_ID}/mailbox"

# Start coordination sidecar in background
echo "Starting coordination sidecar on port ${SIDECAR_PORT}"
/usr/local/bin/sidecar \
    --member-id "${MEMBER_ID}" \
    --team-volume "${TEAM_VOLUME}" \
    --port "${SIDECAR_PORT}" \
    --platform-api "${PLATFORM_API_URL}" &

SIDECAR_PID=$!
echo "Sidecar PID: ${SIDECAR_PID}"

# Brief wait for sidecar to bind to port
sleep 1

# Start ZeroClaw (Phase 0: mock; Phase 1+: real binary)
echo "Starting ZeroClaw for member: ${MEMBER_ID}"
exec /usr/local/bin/zeroclaw
