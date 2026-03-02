#!/bin/bash
# Phase 0 mock: ZeroClaw binary placeholder.
# Replace with real ZeroClaw binary in Phase 1.
echo "Mock ZeroClaw started"
echo "  Member: ${MEMBER_ID}"
echo "  Role:   ${MEMBER_ROLE}"
echo "  Model:  ${MEMBER_MODEL_PROVIDER}/${MEMBER_MODEL_ID}"
echo "  Note:   Real ZeroClaw will be wired in Phase 1"
echo ""
echo "The coordination sidecar handles all chat in Phase 0."

# Keep the container alive; sidecar handles all traffic
while true; do
    sleep 60
done
