import { describe, expect, it } from "vitest";

import { mergeAgentResource, mergeProxmoxInventory } from "@homarr/server-settings";
import type { DiscoveryResource } from "@homarr/server-settings";

import { eq } from "../..";
import { updateDiscoveryAsync } from "../../queries/discovery";
import { apps, boards, items, layouts, sections } from "../../schema";
import { createDb } from "../db-mock";

const report = (): DiscoveryResource => ({
  id: "qemu/100", name: "media", type: "qemu", node: "", status: "running", ipAddresses: ["10.0.0.7"],
  lastSeenAt: new Date().toISOString(), lastAgentSeenAt: new Date().toISOString(),
  services: [{ id: "web-3000", name: "Grafana", url: "http://10.0.0.7:3000", port: 3000, protocol: "http", icon: null, group: null, source: "agent", online: true, lastSeenAt: new Date().toISOString() }],
});
const setup = async () => {
  const db = createDb();
  await db.insert(boards).values({ id: "board", name: "Home" });
  await db.insert(sections).values({ id: "section", boardId: "board", kind: "empty" });
  await db.insert(layouts).values({ id: "layout", boardId: "board", name: "Desktop", columnCount: 8 });
  await updateDiscoveryAsync(db, (state) => { state.enabled = true; state.targetBoardId = "board"; state.resources = [report()]; });
  return db;
};

describe("discovery reconciliation", () => {
  it("creates one app and tile after concurrent repeated reports", async () => {
    const db = await setup();
    await Promise.all(Array.from({ length: 4 }, () => updateDiscoveryAsync(db, (state) => { state.resources = [report()]; })));
    expect(await db.query.apps.findMany()).toHaveLength(1);
    expect(await db.query.items.findMany()).toHaveLength(1);
    expect(await db.query.itemLayouts.findMany()).toHaveLength(1);
  });
  it("updates addresses while preserving custom names, icons and placement", async () => {
    const db = await setup();
    const [app] = await db.query.apps.findMany();
    if (!app) throw new Error("Expected generated app");
    const before = await db.query.itemLayouts.findMany();
    await db.update(apps).set({ name: "My metrics", iconUrl: "/my-icon.png" }).where(eq(apps.id, app.id));
    await updateDiscoveryAsync(db, (state) => { state.resources[0]!.services[0]!.url = "http://10.0.0.8:3000"; });
    expect(await db.query.apps.findFirst()).toMatchObject({ name: "My metrics", iconUrl: "/my-icon.png", href: "http://10.0.0.8:3000" });
    expect(await db.query.itemLayouts.findMany()).toEqual(before);
  });
  it("suppresses removed tiles until explicitly restored and reuses the customized app", async () => {
    const db = await setup();
    const [tile] = await db.query.items.findMany();
    if (!tile) throw new Error("Expected tile");
    await db.delete(items).where(eq(items.id, tile.id));
    await updateDiscoveryAsync(db, () => {});
    expect(await db.query.items.findMany()).toHaveLength(0);
    await updateDiscoveryAsync(db, (state) => { state.mappings[0]!.suppressed = false; state.mappings[0]!.restoreRequested = true; });
    expect(await db.query.items.findMany()).toHaveLength(1);
    expect(await db.query.apps.findMany()).toHaveLength(1);
  });
  it("retains inventory if the destination board disappears", async () => {
    const db = await setup();
    await db.delete(boards).where(eq(boards.id, "board"));
    const state = await updateDiscoveryAsync(db, (state) => { state.resources = [report()]; });
    expect(state.resources[0]?.id).toBe("qemu/100");
  });
  it("restores a previously known tile even while its VM is offline", async () => {
    const db = await setup();
    const [tile] = await db.query.items.findMany();
    if (!tile) throw new Error("Expected tile");
    await db.delete(items).where(eq(items.id, tile.id));
    await updateDiscoveryAsync(db, (state) => {
      state.resources[0]!.status = "stopped";
      state.resources[0]!.lastAgentSeenAt = new Date(0).toISOString();
      state.resources[0]!.services[0]!.online = false;
    });
    await updateDiscoveryAsync(db, (state) => {
      state.mappings[0]!.suppressed = false;
      state.mappings[0]!.restoreRequested = true;
    });
    expect(await db.query.items.findMany()).toHaveLength(1);
    expect(await db.query.apps.findMany()).toHaveLength(1);
  });
  it("keeps URL management after restoring a deleted app at a new address", async () => {
    const db = await setup();
    const [app] = await db.query.apps.findMany();
    if (!app) throw new Error("Expected app");
    await db.delete(apps).where(eq(apps.id, app.id));
    await updateDiscoveryAsync(db, (state) => { state.resources[0]!.services[0]!.url = "http://10.0.0.8:3000"; });
    await updateDiscoveryAsync(db, (state) => { state.mappings[0]!.suppressed = false; state.mappings[0]!.restoreRequested = true; });
    await updateDiscoveryAsync(db, (state) => { state.resources[0]!.services[0]!.url = "http://10.0.0.9:3000"; });
    expect(await db.query.apps.findFirst()).toMatchObject({ href: "http://10.0.0.9:3000" });
  });
  it("preserves a manually changed URL", async () => {
    const db = await setup();
    const [app] = await db.query.apps.findMany();
    if (!app) throw new Error("Expected app");
    await db.update(apps).set({ href: "https://metrics.example.com" }).where(eq(apps.id, app.id));
    await updateDiscoveryAsync(db, (state) => { state.resources[0]!.services[0]!.url = "http://10.0.0.8:3000"; });
    expect(await db.query.apps.findFirst()).toMatchObject({ href: "https://metrics.example.com" });
  });
  it("preserves Proxmox node and stopped state on an agent heartbeat", () => {
    const now = new Date().toISOString();
    const previous = { ...report(), node: "pve", status: "stopped", lastInventorySeenAt: now };
    expect(mergeAgentResource(previous, report(), now)).toMatchObject({ node: "pve", status: "stopped", lastAgentSeenAt: now });
  });
  it("marks missing machines without deleting services or their history", () => {
    const previous = report();
    const [result] = mergeProxmoxInventory([previous], [], new Date().toISOString());
    expect(result).toMatchObject({ status: "missing", services: previous.services });
  });
});
