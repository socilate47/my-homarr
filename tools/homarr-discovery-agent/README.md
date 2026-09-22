# Homarr discovery agent

This small Linux agent reports a VM's IP addresses and listening TCP services to Homarr.

```bash
HOMARR_URL=http://192.168.70.116:3000 \
HOMARR_DISCOVERY_TOKEN=your-token \
DISCOVERY_RESOURCE_ID=qemu/100 \
DISCOVERY_NAME=media-server \
go run .
```

The agent uses the Homarr tRPC endpoint and requires a token generated from **Manage → Discovery**. It reads IPv4/IPv6 addresses from the host interfaces and reports listening TCP ports from `/proc/net/tcp`. Use Proxmox API synchronization for VM/LXC inventory; install this agent when you also want application/container discovery inside a VM.

When Docker is installed, the agent reads running container metadata and published ports. Optional labels provide accurate names, icons, groups, and protocols:

```yaml
labels:
  homarr.discovery.enable: "true"
  homarr.discovery.name: "Grafana"
  homarr.discovery.icon: "grafana"
  homarr.discovery.group: "Monitoring"
  homarr.discovery.protocol: "http"
```

The agent does not perform unrestricted network scanning. Proxmox remains the source of truth for VM/LXC inventory, and the agent reports only the machine on which it is installed.

## Automatic Linux installation

Build a release binary with `build-release.sh`, publish the installer and matching binary on an internal HTTPS URL, then run this on each Debian or Ubuntu VM:

```bash
curl -fsSL https://YOUR-HOMARR-HOST/agent/install-agent.sh -o /tmp/install-homarr-agent.sh
sudo HOMARR_AGENT_BINARY_URL=https://YOUR-HOMARR-HOST/agent/homarr-discovery-agent-linux-amd64 \
  bash /tmp/install-homarr-agent.sh
```

The installer creates `/etc/homarr-discovery-agent/agent.env`, installs a systemd unit, enables it at boot, and restarts it automatically if it fails. The token file is restricted to root.

For a local binary:

```bash
sudo HOMARR_AGENT_BINARY_URL=/path/to/homarr-discovery-agent \
  bash install-agent.sh
```

The installer downloads the matching binary from the latest GitHub release automatically. APT packaging can be added later if needed.

After the release workflow has run, the one-command installation is:

```bash
curl -fsSL https://raw.githubusercontent.com/socilate47/setting-up-my-homelab/homarr-discovery/tools/homarr-discovery-agent/install-agent.sh | sudo bash
```
