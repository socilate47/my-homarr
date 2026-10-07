# Homelab discovery delivery status

## Implemented locally

- Automatic Proxmox VM/LXC inventory polling, with agent-needed and stale status.
- Token-authenticated guest reports and transactional reconciliation into normal Homarr apps and board tiles.
- Stable service IDs, multiple published ports, bound-interface addresses, IPv6 links, tile suppression and restoration.
- Preservation of names, icons, positions and manually edited URLs during refresh.
- Administrator destination-board selection, installation commands and explicit token reveal/rotation.
- Uploaded MP4/WebM wallpapers, image-only icon upload, media metadata detection, pause controls and reduced-motion behavior.
- Documentation and a GitHub verification gate before image publication.
- A deployment Compose file and startup script with a persistent encryption key and health wait.
- Built-in installer and agent binary downloads, eliminating the requirement for a GitHub agent release.

## Verification evidence

- All 11 Go agent tests pass locally; `go vet ./...` passes. Native Linux web apps on custom ports can be declared through `DISCOVERY_WEB_SERVICES`, retaining automatic address detection.
- Installer passes `bash -n` and the diff passes `git diff --check`.
- Four deployment setup tests pass: key creation/permissions, repeat-run preservation, concurrent initialization and preventing an exported key from overriding the persisted key.
- Prepared installer and both Linux binaries pass their SHA256 manifest checks.
- Linux amd64 and arm64 binaries are built under `/root/homarr-agent-build/`.
- Database/API/media regression tests were added. They have not run: Node and pnpm are not installed, and DNS prevents downloading them.
- Explicit restoration now permits a known tile to be recreated while its guest is offline; a database regression test was added for this behavior.
- No TypeScript typecheck, lint/format run, application build or browser verification has succeeded in this environment.
- Docker daemon access is denied, and the Compose plugin is not installed in this workspace. Container startup could not be verified locally.
- The UI static auditor reports 87 findings across the existing monorepo. The finding in the changed discovery page treats Mantine's imported `Select` as a native HTML select; the canonical owner is documented in DESIGN.md. The audit is not a runtime accessibility check.
- An independent review identified address binding, endpoint identity and deleted-app restoration defects; fixes and regression coverage were added. That review stopped at a usage limit before a final verdict. Remaining review was performed by the author.
- A follow-up packaging review found the exported-encryption-key override defect. It was corrected and covered by a passing setup test. The reviewer found no other concrete packaging defect and explicitly did not judge unavailable runtime checks.

## Delivery and setup

Push only to `https://github.com/socilate47/my-homarr.git`, branch `homarr-discovery`. The local `my-homarr` remote points there. GitHub DNS resolution currently fails, so no push has succeeded.

When connectivity is restored:

```bash
git -C /root/homarr push my-homarr HEAD:refs/heads/homarr-discovery
```

The image workflow runs Go checks, setup checks, affected workspace typechecks and targeted regression tests before publishing `ghcr.io/socilate47/my-homarr:discovery`. The Dockerfile also gates its final image on affected TypeScript checks and the targeted tests. Review the build result before using the image.

Run `bash deployments/homelab-discovery/setup.sh` on your Homarr VM. It builds from the local source and includes the installer and Linux amd64/arm64 binaries at `/api/discovery-agent/`. Select your Proxmox integration and dashboard in Manage → Discovery, and install an agent inside each Linux guest. No live Proxmox guest or Homarr instance has been configured or deployed by this session. Windows-agent support was declined and is not included.

See `deployments/homelab-discovery/README.md` and `apps/docs/docs/advanced/discovery.mdx` for setup instructions.
