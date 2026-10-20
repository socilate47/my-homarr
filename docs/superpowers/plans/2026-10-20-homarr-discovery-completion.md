# Homarr discovery completion plan

**Goal:** Deliver a verified, deployable custom Homarr build with automatic Proxmox guest discovery, Linux service tiles, and video wallpapers.

**Source of requirements:** [Homelab dashboard design](../specs/2026-10-05-homelab-dashboard-design.md) and [implementation plan](2026-10-05-homelab-dashboard.md).

**Current state:** The implementation is on `homarr-discovery`. The connected GitHub plugin can read workflow runs and publish commits even though the shell cannot reach GitHub. Node/pnpm and Docker daemon access are unavailable locally. Run `39504567200` exposed unresolved workspace imports under the isolated linker; the Dockerfile and root dependency changes have been restored to the prior hoisted install used by successful run `37759038282`.

## Completion gates

- [x] **1. Establish the build state.** Run `37761282489` passed `verify` and failed Docker `build` at `pnpm exec turbo typecheck`: TypeScript could not find the `node` type definition under the isolated pnpm layout.
- [x] **2. Fix reproducible blockers.** Restored the proven hoisted Docker install after isolated dependency resolution failed. Cleared the inherited docs `baseUrl` for TypeScript 7. Runs `39507666690` and `39507666988` passed.
- [x] **3. Verify the available delivery path.** Local Go tests/vet, installer and deployment checks passed. Image run `39507666690` passed affected TypeScript checks, targeted discovery/media tests and production Docker build. Docs run `39507666988` passed typecheck and site build. See `docs/homarr-discovery-verification.md` for commands and limits.
- [x] **4. Publish the candidate.** Run `39507666690` passed verification and Docker build, publishing `ghcr.io/socilate47/my-homarr:discovery` at digest `sha256:94dee1b19b8c87eb6d4edb4b97b2e876fff9e12f924d122a11adfd864a77e156`.
- [x] **5. Prepare the VM handoff.** `deployments/homelab-discovery/README.md` covers setup, health checks, Proxmox configuration, Linux guest-agent installation, tile behavior, and wallpaper controls. The user will run the live VM test.

## Definition of done

The workflow and Docker build pass, available automated checks cover discovery and media behavior, and the VM setup and validation instructions are complete. The verification record lists commands and observed results. The user will run the live VM and browser checks.
