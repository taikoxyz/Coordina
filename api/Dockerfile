FROM golang:1.22-alpine AS builder
RUN apk add --no-cache build-base
WORKDIR /app
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod download
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=1 go build -o /platform-api .

FROM alpine:3.19
RUN apk add --no-cache ca-certificates sqlite-libs
COPY --from=builder /platform-api /platform-api
EXPOSE 8080
CMD ["/platform-api"]
