#!/usr/bin/env bash
set -euo pipefail

command -v go >/dev/null || {
  echo "Go is required to build the agent." >&2
  exit 1
}

mkdir -p dist
GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" \
  -o dist/homarr-discovery-agent-linux-amd64 .
GOOS=linux GOARCH=arm64 go build -trimpath -ldflags="-s -w" \
  -o dist/homarr-discovery-agent-linux-arm64 .
sha256sum dist/homarr-discovery-agent-*
