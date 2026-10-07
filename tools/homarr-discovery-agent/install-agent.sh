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
  if [[ ! -t 0 ]]; then
    if [[ -n "$default" ]]; then
      printf -v "$name" '%s' "$default"
      return
    fi
    echo "$name is required for non-interactive installation; set it in the environment" >&2
    exit 1
  elif [[ -n "$default" ]]; then
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

prompt_value HOMARR_URL "Homarr URL"
prompt_value HOMARR_DISCOVERY_TOKEN "Homarr discovery token"
prompt_value DISCOVERY_RESOURCE_ID "Proxmox resource ID (for example qemu/101)"
prompt_value DISCOVERY_NAME "VM name"
prompt_value DISCOVERY_TYPE "Resource type (qemu or lxc)" "qemu"

if [[ "$DISCOVERY_TYPE" != "qemu" && "$DISCOVERY_TYPE" != "lxc" ]]; then
  echo "DISCOVERY_TYPE must be qemu or lxc" >&2
  exit 1
fi

install -d -m 0755 /usr/local/bin
install -d -m 0700 /etc/homarr-discovery-agent
umask 077

if [[ -n "${HOMARR_AGENT_BINARY_URL:-}" ]]; then
  if [[ -f "$HOMARR_AGENT_BINARY_URL" ]]; then
    install -m 0755 "$HOMARR_AGENT_BINARY_URL" /usr/local/bin/homarr-discovery-agent
  else
    curl --fail --silent --show-error --location "$HOMARR_AGENT_BINARY_URL" \
    --output /usr/local/bin/homarr-discovery-agent
    chmod 0755 /usr/local/bin/homarr-discovery-agent
  fi
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
  release_url="${HOMARR_AGENT_RELEASE_URL:-https://github.com/socilate47/my-homarr/releases/latest/download/$asset}"
  echo "Downloading discovery agent for $arch..."
  curl --fail --silent --show-error --location "$release_url" \
    --output /usr/local/bin/homarr-discovery-agent
  chmod 0755 /usr/local/bin/homarr-discovery-agent
fi

write_env() {
  local key="$1" value="$2"
  if [[ "$value" == *$'\n'* || "$value" == *$'\r'* ]]; then
    echo "$key cannot contain newlines" >&2
    exit 1
  fi
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '%s="%s"\n' "$key" "$value"
}
{
  write_env HOMARR_URL "$HOMARR_URL"
  write_env HOMARR_DISCOVERY_TOKEN "$HOMARR_DISCOVERY_TOKEN"
  write_env DISCOVERY_RESOURCE_ID "$DISCOVERY_RESOURCE_ID"
  write_env DISCOVERY_NAME "$DISCOVERY_NAME"
  write_env DISCOVERY_TYPE "$DISCOVERY_TYPE"
  write_env DISCOVERY_INTERVAL "${DISCOVERY_INTERVAL:-60s}"
  write_env DISCOVERY_ADDRESS "${DISCOVERY_ADDRESS:-}"
  write_env DISCOVERY_WEB_SERVICES "${DISCOVERY_WEB_SERVICES:-}"
} > /etc/homarr-discovery-agent/agent.env
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
