# Automatic homelab dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically discover Proxmox guests and add their reported web services as stable, customizable Homarr tiles, with uploaded video wallpapers.

**Architecture:** Keep Proxmox as the source of guest inventory and the existing guest agent as the source of addresses and service endpoints. A reusable server-side discovery reconciler updates inventory and board apps/items idempotently; scheduled polling keeps Proxmox state fresh. Reuse Homarr's media store and board background UI for icons and videos.

**Tech Stack:** TypeScript, tRPC, Drizzle, existing Homarr board/app/item APIs and cache channels, Croner, Go agent, Vitest, Docusaurus.

**Spec:** `docs/superpowers/specs/2026-10-05-homelab-dashboard-design.md`

## Global Constraints

- Proxmox remains authoritative for guest identity, node, name and lifecycle state.
- Agent reports are accepted only when discovery is enabled and the token matches.
- A service identity must remain stable across IP changes and Docker restarts.
- Repeated or concurrent syncs must not create duplicate tiles.
- Preserve custom app names, icons, and item positions; stale guests/services remain visible.
- Do not create web tiles for loopback-only or ambiguous non-web listeners.
- Preserve legacy discovery settings with defaults.
- Keep uploads within the existing 32 MB limit and only accept MP4/WebM for video backgrounds.
- Update corresponding user documentation for API, task and media behavior.

## Review Focus

- Missing or deleted destination board: reconciliation must fail safely without losing guest inventory.
- Concurrent agent heartbeat and Proxmox poll: one service mapping and one tile must survive.
- Multi-interface guests and IPv6: generated service URLs must use the selected reachable address and valid bracketed IPv6.
- Edited or removed discovered tile: automatic refresh must preserve edits and honor suppression until restored.
- Extensionless media URLs and browser autoplay/reduced-motion behavior: determine correct video rendering and fallback.

---

### Task 1: Stable agent service reports

**Files:**
- Modify: `tools/homarr-discovery-agent/main.go`
- Modify: `tools/homarr-discovery-agent/install-agent.sh`
- Modify: `tools/homarr-discovery-agent/README.md`
- Test: `tools/homarr-discovery-agent/main_test.go`

**Interfaces:**
- Produces heartbeat `resourceId`, `type`, `name`, `ipAddresses`, and services with stable IDs and valid URLs for later discovery tasks.

- [ ] **Step 1: Write Go tests** for address selection excluding loopback, link-local and bridge interfaces; include explicit address override and IPv6 URL formatting.
- [ ] **Step 2: Run `go test ./...` in `tools/homarr-discovery-agent` and confirm the new cases fail.**
- [ ] **Step 3: Update agent collection** to collect addresses once, select a useful routable address, support override, parse all published Docker web endpoints, combine eligible host listeners, and skip loopback-only and non-web listeners. Use stable endpoint/container-name IDs, request timeout and retry.
- [ ] **Step 4: Fix installer configuration** so noninteractive piped install accepts environment variables and does not default to a private Homarr IP; document expected configuration and limits.
- [ ] **Step 5: Run `go test ./...` and `go vet ./...`** in `tools/homarr-discovery-agent`.

### Task 2: Discovery state and idempotent board reconciliation

**Files:**
- Modify: `packages/server-settings/src/index.ts`
- Create: `packages/server-settings/src/discovery-reconciler.ts`
- Modify: `packages/server-settings/src/index.ts` exports
- Modify: `packages/api/src/router/discovery.ts`
- Modify: board/app/item cache update paths identified in `packages/api/src/router/board.ts` and `packages/boards/src/updater.ts`
- Test: `packages/server-settings/src/test/discovery-reconciler.spec.ts` (or the package's established test directory)

**Interfaces:**
- `reconcileDiscoveryAsync(db, settings, resource, now): Promise<DiscoverySettings>` merges one validated guest heartbeat while preserving Proxmox-owned metadata.
- `reconcileServiceTilesAsync(db, settings, resource): Promise<void>` creates or updates mapped apps and board items, honoring suppression and preserving user-owned fields.

- [ ] **Step 1: Add tests** for stable service identity, IP URL changes, duplicate/concurrent reconciliation, preservation of custom names/icons/layouts, suppression, and deleted destination boards.
- [ ] **Step 2: Run the focused server-settings test and confirm new cases fail.**
- [ ] **Step 3: Extend discovery settings** with target board, stable service mappings, last-applied fields and suppression records; supply defaults when reading legacy records.
- [ ] **Step 4: Implement reusable transactional reconciliation** using existing database transaction, ID and board layout/cache patterns; append new tile layouts without moving existing tiles.
- [ ] **Step 5: Run focused tests and server-settings/API typechecks.**

### Task 3: Automatic Proxmox inventory polling

**Files:**
- Create: `packages/cron-jobs/src/jobs/proxmox-discovery.ts`
- Modify: `packages/cron-jobs/src/index.ts`
- Modify: `packages/api/src/router/discovery.ts`
- Modify: `packages/server-settings/src/discovery-reconciler.ts`
- Test: `packages/api/src/router/test/discovery.spec.ts`

**Interfaces:**
- `syncProxmoxDiscoveryAsync(db): Promise<void>` loads enabled discovery settings, fetches the chosen Proxmox integration, merges its VM/LXC snapshot, preserves heartbeat data, and marks missing resources without deleting them.

- [ ] **Step 1: Add API/reconciler tests** for Proxmox metadata merge, failed poll retaining prior data, missing guests, disabled discovery, and invalid token heartbeat.
- [ ] **Step 2: Run focused discovery tests and confirm expected failures.**
- [ ] **Step 3: Implement shared Proxmox synchronization** with safe error reporting and no secret logging; keep manual `syncProxmox` as an immediate invocation of the same code.
- [ ] **Step 4: Register a once-per-minute cron job** that skips cleanly when disabled or unconfigured.
- [ ] **Step 5: Run focused tests plus API and cron-jobs typechecks.**

### Task 4: Discovery setup and dashboard customization UI

**Files:**
- Modify: `apps/nextjs/src/app/[locale]/manage/discovery/page.tsx`
- Modify: `apps/nextjs/src/app/[locale]/manage/discovery/discovery-actions.tsx`
- Modify: `packages/api/src/router/discovery.ts`
- Modify: translations under `packages/translation/src/locales/`
- Test: discovery UI/API tests at established paths

**Interfaces:**
- Admin settings expose `targetBoardId`, `enabled`, `proxmoxIntegrationId`; inventory indicates agent-needed, active, stale, missing and service state.
- Admin restore action clears a service suppression record.

- [ ] **Step 1: Add tests** for board selection validation, missing-agent status and restore action authorization.
- [ ] **Step 2: Run the focused tests and confirm failure.**
- [ ] **Step 3: Add target-board selection** defaulting to the configured home board when available; validate selection and show manual sync outcome.
- [ ] **Step 4: Add per-guest agent install guidance** with copyable resource-specific configuration, explicit token reveal and restore controls. Never include tokens in routine responses or logs.
- [ ] **Step 5: Run targeted tests and Next.js/API typechecks.**

### Task 5: Uploaded live video wallpapers

**Files:**
- Modify: `packages/validation/src/media.ts`
- Modify: `packages/api/src/router/medias/media-router.ts`
- Modify: `apps/nextjs/src/app/[locale]/boards/[name]/settings/_background.tsx`
- Modify: `apps/nextjs/src/components/layout/background.tsx`
- Modify: `packages/forms-collection/src/upload-media/upload-media.tsx` only if a purpose-specific accept override is needed
- Modify: media and board translations/docs
- Test: media validation and background component tests at established paths

**Interfaces:**
- Media upload validates supported image types plus `video/mp4` and `video/webm`, maximum 32 MB.
- Background rendering detects uploaded video by stored media content type or supported external URL extension, loops muted behind content, and pauses for hidden pages/reduced motion.

- [ ] **Step 1: Add validation/component tests** for accepted/rejected formats, size limit, extensionless uploaded URLs, query-string external URLs and reduced-motion fallback.
- [ ] **Step 2: Run focused tests and confirm failures.**
- [ ] **Step 3: Extend media validation and upload control** with an explicit background-media purpose so icon pickers remain image-only.
- [ ] **Step 4: Render MP4/WebM backgrounds using media metadata** for uploaded assets and extension parsing for external assets; keep image behavior unchanged and add pause/error fallback.
- [ ] **Step 5: Run focused tests, media/Next.js typechecks and update media/background docs.**

### Task 6: End-to-end documentation and integration review

**Files:**
- Modify: `apps/docs/docs/advanced/discovery.mdx`
- Modify: `tools/homarr-discovery-agent/README.md`
- Modify: media and board background documentation under `apps/docs/docs/`
- Test: existing e2e coverage only if the repository already provides a stable board/discovery fixture

- [ ] **Step 1: Document setup and limitations** for Proxmox integration, guest agent install, service detection, dashboard selection, icon customization and video uploads.
- [ ] **Step 2: Run affected package lint/format checks and targeted Vitest suites** for all changed packages.
- [ ] **Step 3: Run repository typechecks for affected workspaces and inspect the final diff.**
- [ ] **Step 4: Report what works locally, what remains to configure in the user's Proxmox/Homarr instance, and any browser verification limits.**
