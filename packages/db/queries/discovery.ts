import superjson from "superjson";

import { createId } from "@homarr/common";
import { emptySuperJSON } from "@homarr/definitions";
import type { DiscoverySettings } from "@homarr/server-settings";
import { isDiscoveryAgentOnline, normalizeDiscoverySettings } from "@homarr/server-settings";

import type { Database } from "..";
import { and, eq, handleTransactionsAsync, sql } from "..";
import { apps, boards, itemLayouts, items, serverSettings } from "../schema";

class DiscoveryConflict extends Error {}

interface TileChanges {
  apps: (typeof apps.$inferInsert)[];
  items: (typeof items.$inferInsert)[];
  layouts: (typeof itemLayouts.$inferInsert)[];
  urls: { id: string; previous: string; next: string }[];
}

const defaultIcon = "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons@master/svg/homarr.svg";
const iconUrl = (icon: string | null) => {
  if (!icon) return defaultIcon;
  if (/^https?:\/\//.test(icon) || icon.startsWith("/api/user-medias/")) return icon;
  return /^[a-z0-9-]+$/.test(icon)
    ? `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons@master/svg/${icon}.svg`
    : defaultIcon;
};

const prepareTilesAsync = async (db: Database, state: DiscoverySettings): Promise<TileChanges> => {
  const changes: TileChanges = { apps: [], items: [], layouts: [], urls: [] };
  state.dashboardError = null;
  if (!state.enabled || !state.targetBoardId) return changes;
  const board = await db.query.boards.findFirst({
    where: eq(boards.id, state.targetBoardId),
    with: { sections: true, layouts: true, items: { with: { layouts: true } } },
  });
  const section = board?.sections.filter(({ kind }) => kind === "empty").sort((a, b) => (a.yOffset ?? 0) - (b.yOffset ?? 0))[0];
  if (!board || !section || board.layouts.length === 0) {
    state.dashboardError = !board ? "The destination dashboard is unavailable. Choose another dashboard." : "The destination dashboard needs an empty section and a layout before tiles can be added.";
    return changes;
  }
  const existingLayouts = board.items.flatMap((item) => item.layouts);
  const itemIds = new Set(board.items.map(({ id }) => id));

  for (const resource of state.resources) {
    for (const service of resource.services) {
      if (!/^https?:\/\//.test(service.url)) continue;
      const mapping = state.mappings.find((row) => row.boardId === board.id && row.resourceId === resource.id && row.serviceId === service.id);
      if (mapping?.suppressed) continue;
      const app = mapping ? await db.query.apps.findFirst({ where: eq(apps.id, mapping.appId) }) : undefined;
      if (mapping) {
        if ((!itemIds.has(mapping.itemId) || !app) && !mapping.restoreRequested) {
          mapping.suppressed = true;
          continue;
        }
        if (app && service.url !== app.href && state.mappings.some((row) => row.appId === app.id && row.managedUrl === app.href)) {
          changes.urls.push({ id: app.id, previous: app.href ?? mapping.managedUrl, next: service.url });
          for (const row of state.mappings) {
            if (row.appId === app.id) row.managedUrl = service.url;
          }
        }
        if (itemIds.has(mapping.itemId) && app) { mapping.restoreRequested = false; continue; }
      }
      if (!mapping?.restoreRequested && (!service.online || !isDiscoveryAgentOnline(resource) || resource.status !== "running")) continue;
      const appId = mapping?.appId ?? createId();
      const itemId = mapping?.itemId ?? createId();
      if (!app) {
        changes.apps.push({ id: appId, name: service.name, iconUrl: iconUrl(service.icon), href: service.url, pingUrl: service.url });
        if (mapping) mapping.managedUrl = service.url;
      }
      if (!itemIds.has(itemId)) {
      changes.items.push({ id: itemId, boardId: board.id, kind: "app", options: superjson.stringify({ appId, openInNewTab: true, showTitle: true }), advancedOptions: emptySuperJSON });
      for (const layout of board.layouts) {
        const occupied = new Set<string>();
        for (const placement of [...existingLayouts, ...changes.layouts]) {
          if (placement.layoutId !== layout.id || placement.sectionId !== section.id) continue;
          for (let y = placement.yOffset; y < placement.yOffset + placement.height; y++) {
            for (let x = placement.xOffset; x < placement.xOffset + placement.width; x++) occupied.add(`${x},${y}`);
          }
        }
        const columns = Math.max(1, layout.columnCount);
        let position = 0;
        while (occupied.has(`${position % columns},${Math.floor(position / columns)}`)) position++;
        changes.layouts.push({ itemId, layoutId: layout.id, sectionId: section.id, xOffset: position % columns, yOffset: Math.floor(position / columns), width: 1, height: 1 });
      }
      }
      if (mapping) mapping.restoreRequested = false;
      else state.mappings.push({ boardId: board.id, resourceId: resource.id, serviceId: service.id, appId, itemId, managedUrl: service.url, suppressed: false });
    }
  }
  return changes;
};

/** All discovery writers use this compare-and-retry transaction, including polling and enrollment. */
export const updateDiscoveryAsync = async (
  db: Database,
  update: (state: DiscoverySettings) => void,
  reconcile = true,
): Promise<DiscoverySettings> => {
  for (let attempt = 0; attempt < 8; attempt++) {
    let previous = await db.query.serverSettings.findFirst({ where: eq(serverSettings.settingKey, "discovery") });
    if (!previous) {
      try {
        await db.insert(serverSettings).values({ settingKey: "discovery", value: superjson.stringify(normalizeDiscoverySettings({})) });
      } catch (error) {
        // A competing first writer may have initialized the unique settings row.
        if (!await db.query.serverSettings.findFirst({ where: eq(serverSettings.settingKey, "discovery") })) throw error;
      }
      previous = await db.query.serverSettings.findFirst({ where: eq(serverSettings.settingKey, "discovery") });
    }
    if (!previous) throw new Error("Could not initialize discovery settings");
    const expected = previous.value;
    const state = normalizeDiscoverySettings(superjson.parse<DiscoverySettings>(expected));
    update(state);
    const changes = reconcile ? await prepareTilesAsync(db, state) : { apps: [], items: [], layouts: [], urls: [] } satisfies TileChanges;
    const value = superjson.stringify(state);
    try {
      await handleTransactionsAsync(db, {
        handleSync(database) {
          database.transaction((tx) => {
            // Acquire the write lock before comparing the snapshot used for placement.
            tx.update(serverSettings).set({ value: sql`${serverSettings.value}` }).where(eq(serverSettings.settingKey, "discovery")).run();
            const current = tx.select().from(serverSettings).where(eq(serverSettings.settingKey, "discovery")).get();
            if (current?.value !== expected) throw new DiscoveryConflict();
            for (const row of changes.apps) tx.insert(apps).values(row).run();
            for (const row of changes.items) tx.insert(items).values(row).run();
            for (const row of changes.layouts) tx.insert(itemLayouts).values(row).run();
            for (const row of changes.urls) {
              tx.update(apps).set({ href: row.next }).where(and(eq(apps.id, row.id), eq(apps.href, row.previous))).run();
              tx.update(apps).set({ pingUrl: row.next }).where(and(eq(apps.id, row.id), eq(apps.pingUrl, row.previous))).run();
            }
            tx.update(serverSettings).set({ value }).where(eq(serverSettings.settingKey, "discovery")).run();
          });
        },
        async handleAsync(database, schema) {
          await database.transaction(async (tx) => {
            await tx.update(schema.serverSettings).set({ value: sql`${schema.serverSettings.value}` }).where(eq(schema.serverSettings.settingKey, "discovery"));
            const [current] = await tx.select().from(schema.serverSettings).where(eq(schema.serverSettings.settingKey, "discovery"));
            if (current?.value !== expected) throw new DiscoveryConflict();
            for (const row of changes.apps) await tx.insert(schema.apps).values(row);
            for (const row of changes.items) await tx.insert(schema.items).values(row);
            for (const row of changes.layouts) await tx.insert(schema.itemLayouts).values(row);
            for (const row of changes.urls) {
              await tx.update(schema.apps).set({ href: row.next }).where(and(eq(schema.apps.id, row.id), eq(schema.apps.href, row.previous)));
              await tx.update(schema.apps).set({ pingUrl: row.next }).where(and(eq(schema.apps.id, row.id), eq(schema.apps.pingUrl, row.previous)));
            }
            await tx.update(schema.serverSettings).set({ value }).where(eq(schema.serverSettings.settingKey, "discovery"));
          });
        },
      });
      return state;
    } catch (error) {
      if (!(error instanceof DiscoveryConflict)) throw error;
    }
  }
  throw new Error("Discovery is busy; retry the update");
};
