import { randomBytes, timingSafeEqual } from "node:crypto";

import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { createId } from "@homarr/common";
import { syncProxmoxDiscoveryAsync } from "@homarr/cron-jobs/discovery";
import { eq } from "@homarr/db";
import { getServerSettingByKeyAsync, updateDiscoveryAsync } from "@homarr/db/queries";
import { boards, integrations } from "@homarr/db/schema";
import { mergeAgentResource } from "@homarr/server-settings";
import type { DiscoverySettings } from "@homarr/server-settings";

import { createTRPCRouter, permissionRequiredProcedure, publicProcedure } from "../trpc";
import { throwIfActionForbiddenAsync } from "./board/board-access";

const safeUrl = z.string().max(2048).url().refine((value) => {
  const url = new URL(value);
  return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
}, "Use an HTTP or HTTPS URL without credentials");
const serviceSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  url: safeUrl,
  port: z.number().int().min(1).max(65535).nullable(),
  protocol: z.enum(["http", "https"]),
  icon: z.string().max(2048).nullable(),
  group: z.string().max(100).nullable(),
  source: z.enum(["agent", "proxmox"]),
  online: z.boolean(),
  lastSeenAt: z.string().max(100),
}).refine((service) => new URL(service.url).protocol === `${service.protocol}:`, "URL protocol does not match service protocol");
const withoutToken = ({ agentToken, ...settings }: DiscoverySettings) => ({ ...settings, hasAgentToken: Boolean(agentToken) });

export const discoveryRouter = createTRPCRouter({
  boardRevision: publicProcedure.input(z.object({ boardId: z.string() })).query(async ({ ctx, input }) => {
    await throwIfActionForbiddenAsync(ctx, eq(boards.id, input.boardId), "view");
    const state = await getServerSettingByKeyAsync(ctx.db, "discovery");
    return { revision: JSON.stringify(state.mappings.filter((mapping) => mapping.boardId === input.boardId).map(({ itemId, managedUrl, suppressed }) => [itemId, managedUrl, suppressed])) };
  }),
  getSettings: permissionRequiredProcedure.requiresPermission("admin").query(async ({ ctx }) =>
    withoutToken(await getServerSettingByKeyAsync(ctx.db, "discovery"))),

  getAgentToken: permissionRequiredProcedure.requiresPermission("admin").mutation(async ({ ctx }) =>
    (await getServerSettingByKeyAsync(ctx.db, "discovery")).agentToken),

  saveSettings: permissionRequiredProcedure.requiresPermission("admin")
    .input(z.object({ enabled: z.boolean(), proxmoxIntegrationId: z.string().nullable(), targetBoardId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      if (input.targetBoardId && !await ctx.db.query.boards.findFirst({ where: eq(boards.id, input.targetBoardId) })) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Choose an existing destination dashboard" });
      }
      if (input.proxmoxIntegrationId) {
        const integration = await ctx.db.query.integrations.findFirst({ where: eq(integrations.id, input.proxmoxIntegrationId) });
        if (integration?.kind !== "proxmox") throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a Proxmox integration" });
      }
      if (input.enabled && (!input.targetBoardId || !input.proxmoxIntegrationId)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Select Proxmox and a destination dashboard before enabling discovery" });
      }
      const nextToken = randomBytes(32).toString("hex");
      const state = await updateDiscoveryAsync(ctx.db, (state) => {
        if (state.proxmoxIntegrationId !== input.proxmoxIntegrationId) {
          state.resources = [];
          state.mappings = [];
          state.agentToken = nextToken;
          state.lastSyncAt = null;
          state.syncError = null;
        }
        if (state.targetBoardId && input.targetBoardId && state.targetBoardId !== input.targetBoardId) {
          for (const resource of state.resources) {
            for (const service of resource.services) {
              if (state.mappings.some((row) => row.boardId === input.targetBoardId && row.resourceId === resource.id && row.serviceId === service.id)) continue;
              const previous = state.mappings.find((row) => row.boardId === state.targetBoardId && row.resourceId === resource.id && row.serviceId === service.id);
              state.mappings.push({ boardId: input.targetBoardId, resourceId: resource.id, serviceId: service.id, appId: previous?.appId ?? createId(), itemId: createId(), managedUrl: service.url, suppressed: true });
            }
          }
        }
        Object.assign(state, input);
        state.agentToken ??= nextToken;
      });
      return withoutToken(state);
    }),

  rotateAgentToken: permissionRequiredProcedure.requiresPermission("admin").mutation(async ({ ctx }) => {
    const token = randomBytes(32).toString("hex");
    await updateDiscoveryAsync(ctx.db, (state) => { state.agentToken = token; }, false);
    return { rotated: true };
  }),

  syncProxmox: permissionRequiredProcedure.requiresPermission("admin")
    .input(z.object({ integrationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const state = await getServerSettingByKeyAsync(ctx.db, "discovery");
      if (!state.enabled || state.proxmoxIntegrationId !== input.integrationId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Enable discovery for this Proxmox integration first" });
      }
      await syncProxmoxDiscoveryAsync(ctx.db);
      return withoutToken(await getServerSettingByKeyAsync(ctx.db, "discovery"));
    }),

  restoreService: permissionRequiredProcedure.requiresPermission("admin")
    .input(z.object({ resourceId: z.string(), serviceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await updateDiscoveryAsync(ctx.db, (state) => {
        const mapping = state.mappings.find((row) => row.boardId === state.targetBoardId && row.resourceId === input.resourceId && row.serviceId === input.serviceId);
        if (mapping) { mapping.suppressed = false; mapping.restoreRequested = true; }
      });
      return { restored: true };
    }),

  heartbeat: publicProcedure.input(z.object({
    token: z.string().min(1).max(128),
    resourceId: z.string().max(64).regex(/^(qemu|lxc)\/\d+$/),
    name: z.string().min(1).max(200),
    type: z.enum(["qemu", "lxc"]),
    node: z.string().max(200).default(""),
    status: z.string().max(50).default("running"),
    reportIntervalSeconds: z.number().int().min(10).max(86400).default(60),
    ipAddresses: z.array(z.union([z.ipv4(), z.ipv6()])).max(64).default([]),
    services: z.array(serviceSchema).max(256).default([]),
  }).refine((input) => input.resourceId.startsWith(`${input.type}/`), "Resource type must match its ID"))
    .mutation(async ({ ctx, input }) => {
      const now = new Date().toISOString();
      await updateDiscoveryAsync(ctx.db, (state) => {
        const token = Buffer.from(input.token);
        const expected = Buffer.from(state.agentToken ?? "");
        if (!state.enabled || !expected.length || token.length !== expected.length || !timingSafeEqual(token, expected)) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Discovery is disabled or the agent token is invalid" });
        }
        const previous = state.resources.find(({ id }) => id === input.resourceId);
        const resource = mergeAgentResource(previous, {
          id: input.resourceId, name: input.name, type: input.type, node: input.node,
          status: "running", ipAddresses: input.ipAddresses,
          services: [...new Map(input.services.map((service) => [service.id, { ...service, source: "agent" as const }])).values()],
          reportIntervalSeconds: input.reportIntervalSeconds, lastSeenAt: now,
        }, now);
        state.resources = [...state.resources.filter(({ id }) => id !== input.resourceId), resource];
      });
      return { accepted: true, lastSeenAt: now };
    }),
});
