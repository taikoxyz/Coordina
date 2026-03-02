FROM golang:1.22 AS builder
RUN apt-get update && apt-get install -y --no-install-recommends gcc libc6-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod download
COPY . .
ARG OPTIMIZE=0
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    if [ "$OPTIMIZE" = "1" ]; then \
      CGO_ENABLED=1 go build -o /platform-api .; \
    else \
      CGO_ENABLED=1 go build -gcflags="all=-N -l" -o /platform-api .; \
    fi

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl gnupg apt-transport-https python3-minimal && \
    echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" \
      > /etc/apt/sources.list.d/google-cloud-sdk.list && \
    curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg \
      | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg && \
    apt-get update && apt-get install -y --no-install-recommends \
      google-cloud-cli \
      google-cloud-cli-gke-gcloud-auth-plugin \
      kubectl && \
    rm -rf /var/lib/apt/lists/*
COPY --from=builder /platform-api /platform-api
EXPOSE 8080
CMD ["/platform-api"]
