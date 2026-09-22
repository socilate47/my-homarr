import { randomBytes } from "node:crypto";

import { z } from "zod/v4";

import { TRPCError } from "@trpc/server";

import { createIntegrationAsync } from "@homarr/integrations";
import type { DiscoveryResource, DiscoveryService, DiscoverySettings } from "@homarr/server-settings";
import {
  getServerSettingByKeyAsync,
  insertServerSettingByKeyAsync,
  updateServerSettingByKeyAsync,
} from "@homarr/db/queries";
import { eq } from "@homarr/db";
import { serverSettings } from "@homarr/db/schema";

import { createOneIntegrationMiddleware } from "../middlewares/integration";
import { createTRPCRouter, permissionRequiredProcedure, publicProcedure } from "../trpc";

const serviceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: z.string().url(),
  port: z.number().int().min(1).max(65535).nullable(),
  protocol: z.enum(["http", "https"]),
  icon: z.string().nullable(),
  group: z.string().nullable(),
  source: z.enum(["agent", "proxmox"]),
  online: z.boolean(),
  lastSeenAt: z.string(),
});

const resourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["qemu", "lxc"]),
  node: z.string(),
  status: z.string(),
  ipAddresses: z.array(z.string()),
  services: z.array(serviceSchema),
  lastSeenAt: z.string(),
});

const settingsSchema = z.object({
  enabled: z.boolean(),
  agentToken: z.string().nullable(),
  proxmoxIntegrationId: z.string().nullable(),
  resources: z.array(resourceSchema),
});

const saveSettingsAsync = async (
  db: Parameters<typeof getServerSettingByKeyAsync>[0],
  settings: DiscoverySettings,
) => {
  const existing = await db.query.serverSettings.findFirst({
    where: eq(serverSettings.settingKey, "discovery"),
  });

  if (existing) {
    await updateServerSettingByKeyAsync(db, "discovery", settings);
  } else {
    await insertServerSettingByKeyAsync(db, "discovery", settings);
  }
};

export const discoveryRouter = createTRPCRouter({
  getSettings: permissionRequiredProcedure
    .requiresPermission("admin")
    .query(async ({ ctx }) => await getServerSettingByKeyAsync(ctx.db, "discovery")),

  saveSettings: permissionRequiredProcedure
    .requiresPermission("admin")
    .input(
      settingsSchema.pick({
        enabled: true,
        proxmoxIntegrationId: true,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const current = await getServerSettingByKeyAsync(ctx.db, "discovery");
      const next = {
        ...current,
        ...input,
        agentToken: current.agentToken ?? randomBytes(32).toString("hex"),
      };
      await saveSettingsAsync(ctx.db, next);
      return next;
    }),

  rotateAgentToken: permissionRequiredProcedure
    .requiresPermission("admin")
    .mutation(async ({ ctx }) => {
      const current = await getServerSettingByKeyAsync(ctx.db, "discovery");
      const next = { ...current, agentToken: randomBytes(32).toString("hex") };
      await saveSettingsAsync(ctx.db, next);
      return next.agentToken;
    }),

  syncProxmox: permissionRequiredProcedure
    .requiresPermission("admin")
    .concat(createOneIntegrationMiddleware("query", "proxmox"))
    .input(z.object({ integrationId: z.string() }))
    .mutation(async ({ ctx }) => {
      const integration = await createIntegrationAsync(ctx.integration);
      if (!("getClusterInfoAsync" in integration) || typeof integration.getClusterInfoAsync !== "function") {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "The selected Proxmox integration does not support discovery",
        });
      }
      const cluster = await integration.getClusterInfoAsync();
      const current = await getServerSettingByKeyAsync(ctx.db, "discovery");
      const now = new Date().toISOString();
      const existingById = new Map(current.resources.map((resource) => [resource.id, resource]));
      const resources: DiscoveryResource[] = [...cluster.vms, ...cluster.lxcs].map((resource) => {
        const previous = existingById.get(resource.id);
        return {
          id: resource.id,
          name: resource.name,
          type: resource.type,
          node: resource.node,
          status: resource.status,
          ipAddresses: previous?.ipAddresses ?? [],
          services: previous?.services ?? [],
          lastSeenAt: now,
        };
      });

      await saveSettingsAsync(ctx.db, { ...current, resources });
      return resources;
    }),

  heartbeat: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        resourceId: z.string().min(1),
        name: z.string().min(1),
        type: z.enum(["qemu", "lxc"]),
        node: z.string().default(""),
        status: z.string().default("running"),
        ipAddresses: z.array(z.string().ip()).default([]),
        services: z.array(serviceSchema).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const current = await getServerSettingByKeyAsync(ctx.db, "discovery");
      if (!current.agentToken || input.token !== current.agentToken) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid discovery agent token",
        });
      }

      const now = new Date().toISOString();
      const resource: DiscoveryResource = {
        id: input.resourceId,
        name: input.name,
        type: input.type,
        node: input.node,
        status: input.status,
        ipAddresses: input.ipAddresses,
        services: input.services.map((service): DiscoveryService => ({
          ...service,
          source: "agent",
          lastSeenAt: now,
        })),
        lastSeenAt: now,
      };
      const resources = [...current.resources.filter(({ id }) => id !== input.resourceId), resource];
      await saveSettingsAsync(ctx.db, { ...current, resources });
      return { accepted: true, lastSeenAt: now };
    }),
});
