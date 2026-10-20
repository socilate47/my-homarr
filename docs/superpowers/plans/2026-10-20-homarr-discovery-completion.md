# Homarr discovery completion plan

**Goal:** Deliver a verified, deployable custom Homarr build with automatic Proxmox guest discovery, Linux service tiles, and video wallpapers.

**Source of requirements:** [Homelab dashboard design](../specs/2026-10-05-homelab-dashboard-design.md) and [implementation plan](2026-10-05-homelab-dashboard.md).

**Current state:** The implementation is on `homarr-discovery`. The connected GitHub plugin can read workflow runs and publish commits even though the shell cannot reach GitHub. Node/pnpm and Docker daemon access are unavailable locally. Run `39504567200` exposed unresolved workspace imports under the isolated linker; the Dockerfile and root dependency changes have been restored to the prior hoisted install used by successful run `37759038282`.

## Completion gates

- [x] **1. Establish the build state.** Run `37761282489` passed `verify` and failed Docker `build` at `pnpm exec turbo typecheck`: TypeScript could not find the `node` type definition under the isolated pnpm layout.
- [ ] **2. Fix reproducible blockers.** For each failure, add or update focused coverage where it proves behavior, make the smallest fix, and run the affected check. Keep the lockfile and package manifests consistent.
- [ ] **3. Verify the full delivery path.** Run Go tests and vet, installer and deployment setup checks, affected TypeScript checks, targeted discovery/media tests, docs build where changed, and the production Docker build. Record exact results and unavailable checks in `docs/homarr-discovery-verification.md`.
- [x] **4. Publish the candidate.** Run `39505538054` passed verification and Docker build, publishing `ghcr.io/socilate47/my-homarr:discovery` at digest `sha256:6f47ed26367ff603009ca132df2be90efe4a59d9b0e35e88ff876f304780d3c4`.
- [x] **5. Prepare the VM handoff.** `deployments/homelab-discovery/README.md` covers setup, health checks, Proxmox configuration, Linux guest-agent installation, tile behavior, and wallpaper controls. The user will run the live VM test.

## Definition of done

The workflow and Docker build pass, automated checks cover guest reports, tile refresh and video wallpaper behavior, and the VM setup and validation instructions are complete. The verification record lists the commands and observed results. A live VM result is reported separately when access is available; it is not required to call the build deployment-ready.
