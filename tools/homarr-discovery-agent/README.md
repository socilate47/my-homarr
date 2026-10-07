# Homarr discovery agent

This small Linux agent reports a VM's IP addresses and listening TCP services to Homarr.
It selects a non-loopback, non-link-local IPv4 address when available, otherwise IPv6. Set `DISCOVERY_ADDRESS` to select one of the VM's reported addresses when it has multiple LAN interfaces.

```bash
HOMARR_URL=https://homarr.example.com \
HOMARR_DISCOVERY_TOKEN=your-token \
DISCOVERY_RESOURCE_ID=qemu/100 \
DISCOVERY_NAME=media-server \
DISCOVERY_ADDRESS=192.168.1.20 \
go run .
```

The agent uses the Homarr tRPC endpoint and requires a token generated from **Manage → Discovery**. It reads IPv4/IPv6 addresses and reports known web listeners bound to a non-loopback address. It does not turn arbitrary TCP listeners, such as SSH or database ports, into web links. Use Proxmox API synchronization for VM/LXC inventory; install this agent when you also want application/container discovery inside a VM.

When Docker is installed, the agent reads running container metadata and all published TCP ports that match a known web service. Set `homarr.discovery.enable=true` to include another explicitly selected TCP service. Optional labels provide names, icons, groups, and protocols:

```yaml
labels:
    homarr.discovery.enable: "true"
  homarr.discovery.name: "Grafana"
  homarr.discovery.icon: "grafana"
  homarr.discovery.group: "Monitoring"
  homarr.discovery.protocol: "http"
```

The agent does not perform unrestricted network scanning. Proxmox remains the source of truth for VM/LXC inventory, and the agent reports only the machine on which it is installed.

## Native applications on custom ports

For a web app running directly on Linux on an unrecognized port, set `DISCOVERY_WEB_SERVICES` to a JSON array. The agent still detects the address automatically and reports the app only when it finds a non-loopback listener on that port:

```bash
DISCOVERY_WEB_SERVICES='[{"name":"My frontend","port":5173,"protocol":"http"},{"name":"Admin console","port":10443,"protocol":"https"}]'
```

Pass this variable to the installer or set it in the agent environment. Each entry needs a name and port from 1 to 65535; protocol defaults to `http`. Ports cannot be declared twice. Custom services start with Homarr's default icon, which you can replace through the dashboard icon picker.

## Automatic Linux installation

Build a release binary with `build-release.sh`, host the installer and matching binary on an internal HTTPS URL, then run this on each Debian or Ubuntu VM. The installer prompts when run interactively. For piped or other non-interactive use, provide all configuration values in the environment:

```bash
curl -fsSL https://YOUR-HOMARR-HOST/agent/install-agent.sh -o /tmp/install-homarr-agent.sh
sudo HOMARR_URL=https://homarr.example.com HOMARR_DISCOVERY_TOKEN=your-token \
  DISCOVERY_RESOURCE_ID=qemu/100 DISCOVERY_NAME=media-server \
  HOMARR_AGENT_BINARY_URL=https://YOUR-HOMARR-HOST/agent/homarr-discovery-agent-linux-amd64 \
  bash /tmp/install-homarr-agent.sh
```

The installer creates `/etc/homarr-discovery-agent/agent.env`, installs a systemd unit, enables it at boot, and restarts it automatically if it fails. The token file is restricted to root.

For a local binary:

```bash
sudo HOMARR_AGENT_BINARY_URL=/path/to/homarr-discovery-agent \
  bash install-agent.sh
```

When no binary URL or local binary is provided, the installer downloads the matching binary from the latest GitHub release automatically. APT packaging can be added later if needed.

After the release workflow has run, a non-interactive one-command install includes your Homarr URL, token and guest identity:

```bash
curl -fsSL https://raw.githubusercontent.com/YOUR-ORG/YOUR-REPO/RELEASE/tools/homarr-discovery-agent/install-agent.sh | \
  sudo HOMARR_URL=https://homarr.example.com HOMARR_DISCOVERY_TOKEN=your-token \
  DISCOVERY_RESOURCE_ID=qemu/100 DISCOVERY_NAME=media-server bash
```
