FROM golang:1.22-alpine AS sidecar-builder
WORKDIR /build
COPY sidecar/go.mod ./
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod download
COPY sidecar/ ./
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build -o /sidecar .

FROM debian:bookworm-slim

# Phase 0: zeroclaw is a mock shell script.
# Phase 1+: replace with COPY --from=zeroclaw/zeroclaw:latest /usr/local/bin/zeroclaw /usr/local/bin/zeroclaw
COPY mock_zeroclaw.sh /usr/local/bin/zeroclaw
RUN chmod +x /usr/local/bin/zeroclaw

COPY --from=sidecar-builder /sidecar /usr/local/bin/sidecar
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
COPY config/ /app/config/

RUN apt-get update && apt-get install -y --no-install-recommends gettext-base curl && \
    rm -rf /var/lib/apt/lists/*

ENV MEMBER_ID=""
ENV MEMBER_ROLE=""
ENV MEMBER_MODEL_PROVIDER=""
ENV MEMBER_MODEL_ID=""
ENV MEMBER_PREFIX=""
ENV MEMBER_TOOLS=""
ENV ANTHROPIC_API_KEY=""
ENV TEAM_VOLUME="/mnt/team"
ENV SIDECAR_PORT="18788"
ENV PLATFORM_API_URL="http://platform-api:8080"

EXPOSE 18788

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:${SIDECAR_PORT}/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
