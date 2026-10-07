import type { DiscoveryResource, DiscoverySettings } from "./index";

export const normalizeDiscoverySettings = (value: Partial<DiscoverySettings>): DiscoverySettings => ({
  enabled: false,
  agentToken: null,
  proxmoxIntegrationId: null,
  resources: [],
  targetBoardId: null,
  mappings: [],
  lastSyncAt: null,
  syncError: null,
  dashboardError: null,
  ...value,
});

export const mergeAgentResource = (
  previous: DiscoveryResource | undefined,
  report: DiscoveryResource,
  now: string,
): DiscoveryResource => {
  const reportedIds = new Set(report.services.map(({ id }) => id));
  return {
    ...report,
    name: previous?.lastInventorySeenAt ? previous.name : report.name,
    node: previous?.node || report.node,
    status: previous?.lastInventorySeenAt ? previous.status : report.status,
    lastInventorySeenAt: previous?.lastInventorySeenAt,
    lastAgentSeenAt: now,
    lastSeenAt: now,
    services: [
      ...report.services.map((service) => ({ ...service, lastSeenAt: now })),
      ...(previous?.services ?? []).filter(({ id }) => !reportedIds.has(id)).map((service) => ({ ...service, online: false })),
    ],
  };
};

export const mergeProxmoxInventory = (
  previous: DiscoveryResource[],
  inventory: Pick<DiscoveryResource, "id" | "name" | "type" | "node" | "status">[],
  now: string,
): DiscoveryResource[] => {
  const byId = new Map(previous.map((resource) => [resource.id, resource]));
  const ids = new Set(inventory.map(({ id }) => id));
  return [
    ...inventory.map((resource) => ({
      ipAddresses: [],
      services: [],
      ...byId.get(resource.id),
      ...resource,
      lastInventorySeenAt: now,
      lastSeenAt: now,
    })),
    ...previous.filter(({ id }) => !ids.has(id)).map((resource) => ({ ...resource, status: "missing" })),
  ];
};

export const isDiscoveryAgentOnline = (resource: DiscoveryResource, now = Date.now()) =>
  Boolean(resource.lastAgentSeenAt) &&
  now - Date.parse(resource.lastAgentSeenAt ?? "") <= (resource.reportIntervalSeconds ?? 60) * 3 * 1000;
