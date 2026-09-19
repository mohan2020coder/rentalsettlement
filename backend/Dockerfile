# Multistage build for the rental-settlement API.

# ---- build stage ----------------------------------------------------------
FROM golang:1.25-alpine AS build
WORKDIR /src

RUN apk add --no-cache git

# Cache dependencies first.
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

# ---- run stage ------------------------------------------------------------
FROM alpine:3.20 AS run
WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata && \
    adduser -D -u 10001 appuser

COPY --from=build /out/server /app/server

RUN mkdir -p /data/storage && chown -R appuser:appuser /data

USER appuser
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1

ENTRYPOINT ["/app/server"]