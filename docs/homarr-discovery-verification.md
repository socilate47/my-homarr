# Homelab discovery delivery status

## Implemented locally

- Automatic Proxmox VM/LXC inventory polling, with agent-needed and stale status.
- Token-authenticated guest reports and transactional reconciliation into normal Homarr apps and board tiles.
- Stable service IDs, multiple published ports, bound-interface addresses, IPv6 links, tile suppression and restoration.
- Preservation of names, icons, positions and manually edited URLs during refresh.
- Administrator destination-board selection, installation commands and explicit token reveal/rotation.
- Uploaded MP4/WebM wallpapers, image-only icon upload, media metadata detection, pause controls and reduced-motion behavior.
- Documentation and a GitHub verification gate before image publication.

## Verification evidence

- All 10 Go agent tests pass locally; `go vet ./...` passes.
- Installer passes `bash -n` and the diff passes `git diff --check`.
- Linux amd64 and arm64 binaries are built under `/root/homarr-agent-build/`.
- Database/API/media regression tests were added. They have not run: Node and pnpm are not installed, and DNS prevents downloading them.
- No TypeScript typecheck, lint/format run, application build or browser verification has succeeded in this environment.
- The UI static auditor reports 87 findings across the existing monorepo. The finding in the changed discovery page treats Mantine's imported `Select` as a native HTML select; the canonical owner is documented in DESIGN.md. The audit is not a runtime accessibility check.
- An independent review identified address binding, endpoint identity and deleted-app restoration defects; fixes and regression coverage were added. That review stopped at a usage limit before a final verdict. Remaining review was performed by the author.

## Delivery and setup

Push only to `https://github.com/socilate47/my-homarr.git`, branch `homarr-discovery`. The local `my-homarr` remote points there. GitHub DNS resolution currently fails, so no push has succeeded.

When connectivity is restored:

```bash
git -C /root/homarr push my-homarr HEAD:refs/heads/homarr-discovery
```

The image workflow runs the Go checks, affected workspace typechecks and targeted regression tests before publishing `ghcr.io/socilate47/my-homarr:discovery`. Review that workflow result before using the image.

Install the resulting Homarr build, select your Proxmox integration and dashboard in Manage → Discovery, and install an agent inside each guest. Build/publish agent binaries or use `HOMARR_AGENT_BINARY_URL` with a local/internal binary; the default installer download requires an agent release in this fork. No live Proxmox guest or Homarr instance has been configured or deployed by this session.

See `apps/docs/docs/advanced/discovery.mdx` for complete setup instructions.
