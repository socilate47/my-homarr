# Homarr discovery completion plan

**Goal:** Deliver a verified, deployable custom Homarr build with automatic Proxmox guest discovery, Linux service tiles, and video wallpapers.

**Source of requirements:** [Homelab dashboard design](../specs/2026-10-05-homelab-dashboard-design.md) and [implementation plan](2026-10-05-homelab-dashboard.md).

**Current state:** The implementation is on `homarr-discovery`. A root `@types/node` dependency change is uncommitted. Node/pnpm and Docker daemon access are unavailable locally. The connected GitHub plugin can read workflow runs even though the shell cannot reach GitHub.

## Completion gates

- [x] **1. Establish the build state.** The latest image run (`37761282489`) passed `verify` and failed Docker `build` at `pnpm exec turbo typecheck`: TypeScript could not find the `node` type definition under the isolated pnpm layout. Record the exact failing command and error. Preserve unrelated local changes.
- [ ] **2. Fix reproducible blockers.** For each failure, add or update focused coverage where it proves behavior, make the smallest fix, and run the affected check. Keep the lockfile and package manifests consistent.
- [ ] **3. Verify the full delivery path.** Run Go tests and vet, installer and deployment setup checks, affected TypeScript checks, targeted discovery/media tests, docs build where changed, and the production Docker build. Record exact results and unavailable checks in `docs/homarr-discovery-verification.md`.
- [ ] **4. Publish the candidate.** Commit reviewed changes, push only to `my-homarr/homarr-discovery`, and confirm the image workflow publishes `ghcr.io/socilate47/my-homarr:discovery`. Do not claim this gate passed from source inspection alone.
- [ ] **5. Validate on the Homarr VM.** Run `deployments/homelab-discovery/setup.sh`, confirm health and onboarding, connect a Proxmox integration and destination board, install an agent in a Linux guest, and confirm discovered service tiles and wallpaper controls in the browser. Capture any environment-specific gaps for the user.

## Definition of done

The workflow and Docker build pass, the VM instance is healthy, a guest report creates a usable tile without losing user edits on refresh, and video wallpaper playback and pause controls work in the browser. The verification record lists the commands and observed results. If VM access or external connectivity is unavailable, leave the corresponding gate open and state the exact handoff needed.
