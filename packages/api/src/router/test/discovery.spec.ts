import { describe, expect, it } from "vitest";

import type { Session } from "@homarr/auth";
import { updateDiscoveryAsync } from "@homarr/db/queries";
import { createDb } from "@homarr/db/test";

import { discoveryRouter } from "../discovery";

const session = { user: { id: "admin", permissions: ["admin"], colorScheme: "dark" }, expires: new Date().toISOString() } satisfies Session;
const report = { token: "test-token", resourceId: "qemu/100", name: "web", type: "qemu" as const, services: [], ipAddresses: ["10.0.0.7"] };

describe("discovery agent enrollment", () => {
  it("rejects a heartbeat when discovery is disabled", async () => {
    const db = createDb();
    await updateDiscoveryAsync(db, (state) => { state.agentToken = "test-token"; });
    const caller = discoveryRouter.createCaller({ db, deviceType: undefined, session: null });
    await expect(caller.heartbeat(report)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("rejects an invalid token when discovery is enabled", async () => {
    const db = createDb();
    await updateDiscoveryAsync(db, (state) => { state.agentToken = "test-token"; state.enabled = true; });
    const caller = discoveryRouter.createCaller({ db, deviceType: undefined, session: null });
    await expect(caller.heartbeat({ ...report, token: "wrong" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("accepts a valid heartbeat and omits the secret from routine settings", async () => {
    const db = createDb();
    await updateDiscoveryAsync(db, (state) => { state.agentToken = "test-token"; state.enabled = true; });
    const caller = discoveryRouter.createCaller({ db, deviceType: undefined, session });
    expect(await caller.heartbeat(report)).toMatchObject({ accepted: true });
    const settings = await caller.getSettings();
    expect(settings).not.toHaveProperty("agentToken");
    expect(settings.hasAgentToken).toBe(true);
    expect(settings.resources[0]?.ipAddresses).toEqual(["10.0.0.7"]);
    expect(await caller.getAgentToken()).toBe("test-token");
  });
});
