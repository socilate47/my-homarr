#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this installer as root: sudo bash install-agent.sh" >&2
  exit 1
fi

prompt_value() {
  local name="$1"
  local prompt="$2"
  local default="${3:-}"
  local value
  if [[ -n "${!name:-}" ]]; then
    return
  fi
  if [[ -n "$default" ]]; then
    read -r -p "$prompt [$default]: " value
    value="${value:-$default}"
  else
    read -r -p "$prompt: " value
  fi
  if [[ -z "$value" ]]; then
    echo "$name is required" >&2
    exit 1
  fi
  printf -v "$name" '%s' "$value"
}

prompt_value HOMARR_URL "Homarr URL" "http://192.168.70.116:3000"
prompt_value HOMARR_DISCOVERY_TOKEN "Homarr discovery token"
prompt_value DISCOVERY_RESOURCE_ID "Proxmox resource ID (for example qemu/101)"
prompt_value DISCOVERY_NAME "VM name"
prompt_value DISCOVERY_TYPE "Resource type (qemu or lxc)" "qemu"

if [[ "$DISCOVERY_TYPE" != "qemu" && "$DISCOVERY_TYPE" != "lxc" ]]; then
  echo "DISCOVERY_TYPE must be qemu or lxc" >&2
  exit 1
fi

install -d -m 0755 /usr/local/bin /etc/homarr-discovery-agent

if [[ -n "${HOMARR_AGENT_BINARY_URL:-}" ]]; then
  curl --fail --silent --show-error --location "$HOMARR_AGENT_BINARY_URL" \
    --output /usr/local/bin/homarr-discovery-agent
  chmod 0755 /usr/local/bin/homarr-discovery-agent
elif [[ -x "$(dirname "$0")/homarr-discovery-agent" ]]; then
  install -m 0755 "$(dirname "$0")/homarr-discovery-agent" /usr/local/bin/homarr-discovery-agent
else
  arch="$(uname -m)"
  case "$arch" in
    x86_64) asset="homarr-discovery-agent-linux-amd64" ;;
    aarch64|arm64) asset="homarr-discovery-agent-linux-arm64" ;;
    *)
      echo "Unsupported Linux architecture: $arch" >&2
      exit 1
      ;;
  esac
  release_url="${HOMARR_AGENT_RELEASE_URL:-https://github.com/socilate47/setting-up-my-homelab/releases/latest/download/$asset}"
  echo "Downloading discovery agent for $arch..."
  curl --fail --silent --show-error --location "$release_url" \
    --output /usr/local/bin/homarr-discovery-agent
  chmod 0755 /usr/local/bin/homarr-discovery-agent
fi

cat > /etc/homarr-discovery-agent/agent.env <<EOF
HOMARR_URL=$HOMARR_URL
HOMARR_DISCOVERY_TOKEN=$HOMARR_DISCOVERY_TOKEN
DISCOVERY_RESOURCE_ID=$DISCOVERY_RESOURCE_ID
DISCOVERY_NAME=$DISCOVERY_NAME
DISCOVERY_TYPE=$DISCOVERY_TYPE
DISCOVERY_INTERVAL=${DISCOVERY_INTERVAL:-60s}
EOF
chmod 0600 /etc/homarr-discovery-agent/agent.env

cat > /etc/systemd/system/homarr-discovery-agent.service <<'EOF'
[Unit]
Description=Homarr VM discovery agent
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=/etc/homarr-discovery-agent/agent.env
ExecStart=/usr/local/bin/homarr-discovery-agent
Restart=always
RestartSec=10
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadOnlyPaths=/proc/net/tcp

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now homarr-discovery-agent.service
systemctl --no-pager --full status homarr-discovery-agent.service

echo
echo "Homarr discovery agent installed and enabled."
echo "Configuration: /etc/homarr-discovery-agent/agent.env"
