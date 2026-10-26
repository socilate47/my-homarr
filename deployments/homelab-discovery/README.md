# Run your Homarr build

This deployment runs the verified `ghcr.io/socilate47/my-homarr` image (pinned by digest in `compose.yml`), stores its data in a persistent Docker volume, and includes Linux guest-agent downloads. It can also build the checked-out source instead.

## Start on your Homarr VM

Install [Docker Engine](https://docs.docker.com/engine/install/) with the Compose plugin and OpenSSL. From the repository root, run:

```bash
bash deployments/homelab-discovery/setup.sh
```

The package is private, so log Docker in to GitHub Container Registry once first (needs a token with `read:packages`, for example `gh auth refresh -h github.com -s read:packages`):

```bash
gh auth token | docker login ghcr.io -u socilate47 --password-stdin
```

The script creates a restricted `.env` file with a random encryption key, pulls the image, and waits for Homarr to become healthy. Open `http://YOUR-VM-ADDRESS:7575` and finish onboarding.

To change the port or timezone before starting:

```bash
bash deployments/homelab-discovery/setup.sh --init-only
```

Edit `deployments/homelab-discovery/.env`, then run the setup script again. Keep the encryption key unchanged with your data backups. Existing `.env` files are preserved; a shell-exported key cannot override the file's key during setup.

The Compose project is `my-homarr`; data lives in its `homarr-data` named volume. This creates a new instance and does not automatically import another Homarr installation's data. For existing data, use its original encryption key and configure the intended data volume before starting.

## Configure discovery

1. Create the dashboard you want to use as your homepage.
2. Add your Proxmox integration in Manage → Integrations.
3. Open Manage → Discovery, select Proxmox and the destination dashboard, enable discovery, and save.
4. Choose Sync Proxmox now. New guests also appear through scheduled polling.
5. Choose Show install command on each Linux guest and run it inside that guest.

The installer and matching Linux binary come from your Homarr instance at `/api/discovery-agent/`. If the displayed address is unreachable from a guest, change the Homarr address in the copied command.

Once an agent reports, discovered web services appear on the selected dashboard. Different ports become separate links. Uploaded icons, custom names and tile positions survive subsequent reports. Declare unusual native web ports through `DISCOVERY_WEB_SERVICES`, as described in the agent README.

Upload a background image or MP4/WebM video through Board settings → Background. Use the wallpaper control to pause or resume the video.

Windows VMs and appliances still appear in the Proxmox inventory. This version has a Linux agent only. Use existing Homarr integrations, such as OPNsense, and saved app links for appliances or Windows guests. No Windows agent was added.

## Updates and diagnostics

To deploy a newer image, set `HOMARR_IMAGE` in `.env` (or update the digest in `compose.yml`) and run the setup script again; it preserves `.env` and the data volume.

To build the checked-out source instead of pulling, run `setup.sh --build` (build and start) or `setup.sh --build-only`. The build needs several GB of memory and disk; a 2 GB VM is not enough.

From `deployments/homelab-discovery`, inspect the deployment:

```bash
docker compose --project-name my-homarr ps
docker compose --project-name my-homarr logs --tail=100 homarr
```

For a guest agent:

```bash
sudo systemctl status homarr-discovery-agent
sudo journalctl -u homarr-discovery-agent --since '10 minutes ago'
```

The Docker build runs affected TypeScript checks and the targeted discovery/media/download tests before producing the final image. Check failed build output before deployment. Local application and browser verification could not run in the authoring workspace because Node/pnpm are absent and Docker access is blocked.
