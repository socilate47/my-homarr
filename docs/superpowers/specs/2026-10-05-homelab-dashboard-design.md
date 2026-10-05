# Automatic homelab dashboard

## Outcome and scope

The user wants a Homarr homepage that discovers their Proxmox VMs and, after a one-time agent installation in each guest, shows clickable application tiles without manually remembering IP addresses or ports. Multiple services on one address must remain distinct. Users can upload custom icons and use uploaded videos as live wallpapers.

The selected approach is Proxmox inventory plus the existing local discovery agent. This extends the current Homarr checkout. The target is one administrator-selected existing board; selecting a board is required before automatic tile insertion. The existing home board is suggested when available. Discovery does not change which board is the user's homepage.

## Existing implementation

- `packages/api/src/router/discovery.ts` provides administrator settings, manual Proxmox synchronization and token-authenticated agent heartbeats.
- `packages/server-settings/src/index.ts` stores inventory and discovery settings as server settings.
- `tools/homarr-discovery-agent` contains the Go agent, systemd installer and Docker deployment.
- Agents enumerate local interfaces and ports; Docker discovery currently replaces host-port discovery and uses unstable container IDs.
- `manage/discovery` displays inventory but does not create dashboard tiles.
- IconPicker already supports uploaded images.
- BoardBackgroundVideo supports video URLs by filename extension. Upload validation accepts only images, and uploaded media URLs have no filename extension.

## User flow

1. Administrator adds their Proxmox integration, enables discovery and selects the destination board.
2. Scheduled synchronization runs every minute and discovers QEMU VMs and LXC containers. Manual Sync remains available.
3. Machines without heartbeats display “Agent needed” in Discovery, with resource-specific installation configuration and a copyable installation command. The full enrollment token is visible only through an explicit administrator action; it is never logged.
4. Administrator installs the agent inside each intended guest using the displayed configuration. No VM IP is entered. The guest must be able to reach Homarr.
5. An authenticated heartbeat records addresses and web services and inserts missing app tiles on the selected board. Connected browsers receive the existing board cache/update notifications.
6. Administrator customizes tiles with existing app editing, icon uploads and layout controls. Later reports preserve names, icons and positions while updating addresses managed by discovery.
7. In board background settings, users select or upload an image or an MP4/WebM video. Video loops silently behind the board.

## Architecture and persistence

Move inventory merge and dashboard reconciliation into a reusable discovery service accessible from the API and scheduled jobs, without introducing a dependency from cron jobs back to the API.

Extend discovery settings with a nullable target board ID, persistent resource/service-to-app/item mappings, and separate inventory and agent timestamps. Read legacy settings with defaults so existing installations retain their data.

Use stable resource IDs from Proxmox and stable per-service IDs based on container name/published endpoint or host endpoint, rather than container instance IDs. IP changes must not change identity. Docker services and host web services are merged; duplicates are collapsed.

Create normal Homarr apps and board items using the established board layout and cache mechanisms. New tiles append into available space for the board's layouts. Reconciliation is idempotent: repeated heartbeats and concurrent requests cannot create duplicate tiles. Use database transactions and a serialization mechanism compatible with the deployed database/Redis setup; a process-local lock alone is insufficient.

Persist the last automatically applied values. On refresh, update managed URLs only when they still match that last applied value, preserving manually edited URLs. Never overwrite existing app names or icons during reconciliation. Preserve all existing item positions. Persist suppression when users remove a discovery tile so heartbeats do not immediately recreate it; provide a deliberate restore action in Discovery.

Changing the target board affects new tile insertion and offers an explicit import of existing services to that board. Existing tiles on the previous board are retained. Disabling discovery stops inventory polling and rejects heartbeat writes; it does not delete apps or tiles.

## Inventory, status and failures

Proxmox synchronization owns guest identity, node, name and lifecycle status. Heartbeats update guest addresses and services without erasing the Proxmox node or stopped state with empty/default agent metadata.

Maintain separate agent-last-seen time. A heartbeat older than three configured report intervals is stale. Display stale/offline status rather than removing customized tiles. Proxmox failures retain previous inventory and report the failure; they do not erase machines. A VM missing from a successful inventory snapshot is marked missing, with its existing tiles retained.

Use existing reachability status support for app tiles and disclose that guest heartbeat health and application reachability are separate. A listening TCP port alone is not proof of a web application.

## Agent behavior

Keep detection local to the installed guest. Select a useful non-loopback, non-link-local LAN address, excluding Docker/bridge interfaces by default. Add an optional explicit interface/address override for guests with several routable networks. Collect addresses once per report and support IPv6 URL formatting.

Read listening endpoints including bind addresses; do not publish loopback-only services as LAN links. Recognize Docker published endpoints and explicitly declared web services. Do not turn every unknown TCP listener, such as SSH or a database, into an HTTP tile. Undeclared ambiguous listeners can be shown in discovery details without automatically creating app tiles. Port-number names are suggestions rather than authoritative application identification.

Add bounded request timeouts and retry behavior. Keep token files restricted. Fix installer input for piped/noninteractive execution and remove the hardcoded private Homarr URL. Provide Debian/Ubuntu systemd installation plus the existing Docker option. For LXC, install inside that container; a host agent must not impersonate a container.

## Icons and wallpapers

Reuse image upload and IconPicker for custom tile icons. Preserve existing media-upload permissions and image-only validation for icon selection.

Extend the shared media backend to accept MP4 and WebM using the existing 32 MB upload limit. Separate accepted media types by picker purpose. Detect uploaded backgrounds by stored media content type rather than URL suffix alone; external URLs continue to support the existing video formats, including URL query strings.

Render video only on board pages, behind interactive content. Provide reduced-motion behavior and pause playback when the document is hidden. Show useful upload/type/size errors and preserve a usable background if video loading or autoplay fails. Avoid executing or interpreting wallpaper content as application code.

## Authorization and compatibility

Only administrators configure discovery, reveal/rotate enrollment tokens and select writable destination boards. Validate the destination board at save time and reconciliation time. Heartbeats require an enabled discovery configuration and a valid token; validate bounded payload sizes and service protocols. Tokens must not appear in errors or logs.

Use existing Homarr UI components, localization and accessibility conventions. Update API, discovery, tasks and media/background documentation as required by AGENTS.md. This work produces local code and reviewable deployment instructions; deployment into the user's live Proxmox guests requires actual environment access and configuration.

## Verification and acceptance

- Meaningful tests prove that repeated and concurrent reports produce one app/tile per stable service identity.
- IP changes and Docker restarts update links without losing uploaded icons, names or positions.
- Multiple web services on the same IP produce distinct links; loopback-only and non-web listeners do not become broken web tiles.
- Tests cover disabled discovery, invalid tokens, target-board deletion, legacy settings, suppressed tiles, stale heartbeats and failed Proxmox polling.
- Go tests cover address selection, published-port parsing, endpoint identity and heartbeat timeout behavior; run `go test ./...` and `go vet ./...`.
- Media tests cover valid videos, rejected types, size limits and content-type detection for extensionless uploaded URLs.
- Verify board insertion and refresh, image icon upload, video upload/playback, keyboard access, mobile layout and reduced motion in a browser where available.
- Run affected package typechecks, lint/format and targeted Vitest suites. Report environment limitations separately from passing checks.

## Implementation sequence

1. Shared discovery state, stable identity and reconciliation with regression tests.
2. Scheduled Proxmox inventory synchronization and stale-state handling.
3. Destination-board selection, installation guidance and tile suppression/restoration.
4. Agent and installer corrections.
5. Uploaded video backgrounds and purpose-specific media selection.
6. Documentation, focused integration verification and delivery instructions.
