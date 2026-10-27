<p>
  <img src="apps/docs/static/img/my-homarr-mark.svg" alt="My Homarr" width="56" height="56" />
</p>

# My Homarr

**Proxmox in view. Services within reach.**

My personal Homarr build for a Proxmox homelab. It finds my VMs and the web services running on them and puts them on a dashboard as tiles, so I never have to remember another IP address or port. Names, icons, layout and wallpaper stay mine to customize.

[![Build My Homarr](https://github.com/socilate47/my-homarr/actions/workflows/homarr-discovery-image.yml/badge.svg?branch=homarr-discovery)](https://github.com/socilate47/my-homarr/actions/workflows/homarr-discovery-image.yml)

[Setup guide](deployments/homelab-discovery/README.md) · [Guest agent](tools/homarr-discovery-agent/README.md) · [Discovery details](apps/docs/docs/advanced/discovery.mdx)

## What this build adds

- **Proxmox inventory:** every VM and LXC container appears on the Discovery page, kept in sync on a schedule.
- **Guest agent:** a small Linux service inside each guest reports its LAN address, web ports and Docker containers.
- **Automatic tiles:** each discovered service becomes a dashboard shortcut, with a separate tile per port.
- **Links that follow the guest:** when an address changes the link updates, while renamed tiles, custom icons and positions are kept. Deleted tiles stay deleted.
- **Video wallpapers:** silent MP4/WebM backgrounds with a pause control, plus uploaded icons.
- **Self-contained agent downloads:** the installer and Linux amd64/arm64 binaries are served by Homarr itself.

Everything above is specific to this fork; it is not part of official Homarr.

## Run it

The dashboard VM needs Docker Engine with the Compose plugin, and OpenSSL.

The image is published privately to GitHub Container Registry, so log Docker in once with a token that has `read:packages`:

```bash
gh auth refresh -h github.com -s read:packages
gh auth token | docker login ghcr.io -u socilate47 --password-stdin
```

Then clone and start:

```bash
git clone --branch homarr-discovery https://github.com/socilate47/my-homarr.git
cd my-homarr
bash deployments/homelab-discovery/setup.sh
```

The script creates a restricted `.env` file with a random encryption key, pulls the CI-verified image pinned in `compose.yml`, and waits until Homarr is healthy. Open `http://YOUR-VM-ADDRESS:7575` and create the admin account.

Keep `.env` with your data backups: the encryption key is needed to read the existing data. To change the port or timezone, run `setup.sh --init-only`, edit `deployments/homelab-discovery/.env`, then run the script again.

To build from source instead of pulling, use `setup.sh --build`. Building the monorepo needs several GB of memory and disk, which is more than a 2 GB VM has.

## Connect Proxmox

1. **Create a read-only API token.** In Proxmox, open Datacenter → Permissions → API Tokens and add a token. Either create a dedicated user such as `homarr@pve` with the **PVEAuditor** role and untick *Privilege Separation*, or create it under `root@pam`, keep *Privilege Separation* ticked and give the token itself PVEAuditor on `/`. Copy the secret; it is shown only once.
2. **Trust the Proxmox certificate.** Proxmox signs its HTTPS certificate with its own CA. Run `cat /etc/pve/pve-root-ca.pem` in the Proxmox shell, save the output as `proxmox-ca.pem` (or `.crt`), and upload it in Manage → Tools → Certificates. If the node's IP has changed since installation, correct `/etc/hosts` on the node and run `pvecm updatecerts --force && systemctl restart pveproxy` so the certificate matches the current address.
3. **Add the integration.** In Manage → Integrations, add Proxmox with the node URL (for example `https://192.168.0.110:8006`), the user name, realm, token ID and secret, then test the connection.

## Discover services

1. Create the dashboard you want tiles on. It needs an empty section, which a new board already has.
2. Open Manage → Tools → **Discovery**, select the Proxmox integration and the dashboard, enable discovery and save. Saving generates the agent token.
3. Choose **Sync Proxmox now**. Every guest appears, marked *agent needed*.
4. For each running Linux guest, choose **Show install command**, copy it and run it inside the guest. Its services appear on the dashboard within a minute.

The agent recognizes common web ports and published Docker container ports, and skips Docker, Podman and other container or VM bridge addresses. Add Docker labels such as `homarr.discovery.name` and `homarr.discovery.icon` to name containers, or set `DISCOVERY_WEB_SERVICES` for apps on unusual ports. See the [agent README](tools/homarr-discovery-agent/README.md) for details.

Treat the agent token like a password. If it leaks, rotate it on the Discovery page and reinstall the agents.

## Guest support

| Machine | What you get |
| --- | --- |
| Linux VM or LXC (amd64/arm64, systemd) | Proxmox inventory plus automatic service tiles from the agent |
| Windows VM | Inventory only; add links manually. There is no Windows agent |
| OPNsense or another appliance | Inventory, plus Homarr's existing integrations and manual links |
| Stopped guest | Inventory only, until it runs and its agent reports |

Each guest must be able to reach Homarr's address, for example `http://192.168.70.116:7575`.

## Update

1. Push changes to `homarr-discovery` and wait for the **Build My Homarr** workflow to pass.
2. Put the new image digest in `deployments/homelab-discovery/compose.yml`, or set `HOMARR_IMAGE` in `.env`.
3. Run `bash deployments/homelab-discovery/setup.sh` again. Data, settings and `.env` are preserved.

Guests pick up agent changes when you rerun their install command.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Certificate error when testing Proxmox | Upload the Proxmox CA (step 2 above). An *Invalid certificate* message usually means the file was damaged when copied, for example a missing `-` in the `END CERTIFICATE` line |
| Hostname mismatch | The Proxmox certificate was issued for an old IP. Regenerate it as described above, or accept the mismatch prompt in Homarr |
| Proxmox connects but no guests appear | The token has no permissions; check PVEAuditor and *Privilege Separation* |
| A tile links to an unreachable `10.x` address | The guest is running an agent older than the bridge-interface fix. Rerun the install command, or set `DISCOVERY_ADDRESS` in `/etc/homarr-discovery-agent/agent.env` |
| Agent not reporting | Check `sudo systemctl status homarr-discovery-agent` and `sudo journalctl -u homarr-discovery-agent -n 20` on the guest. `401 Unauthorized` means discovery is off or the token was rotated |

## Documentation development

The docs site has its own My Homarr identity. It needs Node.js 24.18 or newer and pnpm 11.15.1:

```bash
pnpm install --frozen-lockfile
pnpm dev:docs
```

The preview runs at `http://localhost:3003/my-homarr/`. Source and site configuration are in [apps/docs](apps/docs/README.md).

## Build and verification

Before publishing `ghcr.io/socilate47/my-homarr`, the image workflow runs the Go agent tests, the setup script tests, the TypeScript checks for the affected workspaces and the discovery regression tests. [Verification notes](docs/homarr-discovery-verification.md) record what ran and what still needs live testing.

## Based on Homarr

This is a personal fork of [Homarr](https://github.com/homarr-labs/homarr), not the official project. The dashboard, most integrations and the reference documentation come from Homarr and its contributors. The original attribution and the [Apache 2.0 license](LICENSE) are retained.
