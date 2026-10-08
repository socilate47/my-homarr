<p>
  <img src="apps/docs/static/img/my-homarr-mark.svg" alt="My Homarr" width="56" height="56" />
</p>

# My Homarr

**Proxmox in view. Services within reach.**

My personal Homarr build for a Proxmox homelab. It brings VMs and their web services onto a dashboard without needing to remember every IP address and port. The icons, names, tile layout and wallpaper can be mine.

[![Build My Homarr](https://github.com/socilate47/my-homarr/actions/workflows/homarr-discovery-image.yml/badge.svg?branch=homarr-discovery)](https://github.com/socilate47/my-homarr/actions/workflows/homarr-discovery-image.yml)

[Setup guide](deployments/homelab-discovery/README.md) · [Guest agent](tools/homarr-discovery-agent/README.md) · [Discovery details](apps/docs/docs/advanced/discovery.mdx)

## What this build adds

- Proxmox VM/LXC inventory updates and guest-agent service discovery.
- Automatic dashboard shortcuts, including separate services on one IP with different ports.
- Managed links that follow address changes while preserving names, icons and tile positions.
- Uploaded icons and silent MP4/WebM video wallpapers.
- Installer and Linux agent downloads served directly by the Homarr instance.
- A Docker deployment script with a persistent encryption key and health checks.

## Run it

On the VM chosen for the dashboard, install Docker Engine, its Compose plugin and OpenSSL. Then:

```bash
git clone --branch homarr-discovery https://github.com/socilate47/my-homarr.git
cd my-homarr
bash deployments/homelab-discovery/setup.sh
```

Open `http://YOUR-VM-ADDRESS:7575` and finish onboarding. The script creates a new data volume and restricted `.env` file. Keep the encryption key with the data backup; use the original key when reusing existing Homarr data.

To choose another port before starting, run `setup.sh --init-only`, edit `deployments/homelab-discovery/.env`, then rerun the setup script.

## Connect the lab

1. Create the dashboard to use as the homepage.
2. Add the Proxmox integration in Manage → Integrations.
3. In Manage → Discovery, select Proxmox and the destination dashboard, enable discovery and save.
4. Sync the inventory, then run the displayed install command inside each Linux guest.
5. Let its first report add the service shortcuts, then customize the board.

The agent detects its own addresses. Docker labels and `DISCOVERY_WEB_SERVICES` can describe services that need explicit names or custom web ports. No separate GitHub agent release is required for installation.

## Guest support

| Machine | Discovery approach |
| --- | --- |
| Linux VM or LXC | Proxmox inventory plus the Linux agent |
| Windows VM | Inventory and manually configured links; no Windows agent in this version |
| OPNsense or another appliance | Inventory, existing integrations/APIs and service links |
| VM without a running OS | Inventory only until it has a networked operating system |

## My documentation

The docs have their own My Homarr identity and are focused on this build. For local documentation development, use Node.js 24.18 or newer and pnpm 11.15.1:

```bash
pnpm install --frozen-lockfile
pnpm dev:docs
```

The default preview path is `http://localhost:3003/my-homarr/`. Documentation source and site configuration are in [apps/docs](apps/docs/README.md).

## Build and verification

The image workflow verifies the agent, setup script, TypeScript workspaces and regression tests before publishing `ghcr.io/socilate47/my-homarr:discovery`. The source deployment also runs the application checks during its Docker build.

[Verification notes](docs/homarr-discovery-verification.md) record the checks that ran and any remaining runtime limitations.

## Based on Homarr

This is a personal fork of [Homarr](https://github.com/homarr-labs/homarr), not the official upstream project. The dashboard foundation, many integrations and reference documentation come from Homarr and its contributors. Original attribution and the [Apache 2.0 license](LICENSE) are retained.
