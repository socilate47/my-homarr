import type { ColorScheme } from "@homarr/definitions";
import type { SupportedLanguage } from "@homarr/translation";

export const defaultServerSettingsKeys = [
  "analytics",
  "crawlingAndIndexing",
  "board",
  "user",
  "appearance",
  "culture",
  "search",
  "discovery",
] as const;

export interface DiscoveryService {
  id: string;
  name: string;
  url: string;
  port: number | null;
  protocol: "http" | "https";
  icon: string | null;
  group: string | null;
  source: "agent" | "proxmox";
  online: boolean;
  lastSeenAt: string;
}

export interface DiscoveryResource {
  id: string;
  name: string;
  type: "qemu" | "lxc";
  node: string;
  status: string;
  ipAddresses: string[];
  services: DiscoveryService[];
  lastSeenAt: string;
  lastAgentSeenAt?: string;
  lastInventorySeenAt?: string;
  reportIntervalSeconds?: number;
}

export interface DiscoveryMapping {
  boardId: string;
  resourceId: string;
  serviceId: string;
  appId: string;
  itemId: string;
  managedUrl: string;
  suppressed: boolean;
  restoreRequested?: boolean;
}

export interface DiscoverySettings {
  enabled: boolean;
  agentToken: string | null;
  proxmoxIntegrationId: string | null;
  resources: DiscoveryResource[];
  targetBoardId: string | null;
  mappings: DiscoveryMapping[];
  lastSyncAt: string | null;
  syncError: string | null;
  dashboardError: string | null;
}

export type ServerSettingsRecord = {
  [K in Exclude<(typeof defaultServerSettingsKeys)[number], "discovery">]: Record<string, unknown>;
} & {
  discovery: DiscoverySettings;
};

export const defaultServerSettings = {
  analytics: {
    enableGeneral: true,
    instanceId: null as string | null,
  },
  crawlingAndIndexing: {
    noIndex: true,
    noFollow: true,
    noTranslate: true,
    noSiteLinksSearchBox: false,
  },
  board: {
    homeBoardId: null as string | null,
    mobileHomeBoardId: null as string | null,
    enableStatusByDefault: true,
    forceDisableStatus: false,
  },
  user: {
    enableGravatar: true,
  },
  appearance: {
    defaultColorScheme: "auto" as ColorScheme,
  },
  culture: {
    defaultLocale: "en" as SupportedLanguage,
  },
  search: {
    defaultSearchEngineId: null as string | null,
  },
  discovery: {
    enabled: false,
    agentToken: null as string | null,
    proxmoxIntegrationId: null as string | null,
    resources: [] as DiscoveryResource[],
    targetBoardId: null as string | null,
    mappings: [] as DiscoveryMapping[],
    lastSyncAt: null as string | null,
    syncError: null as string | null,
    dashboardError: null as string | null,
  },
} satisfies ServerSettingsRecord;

export type ServerSettings = typeof defaultServerSettings;

export * from "./discovery";
