import { decryptSecret } from "@homarr/common/server";
import type { Database } from "@homarr/db";
import { eq } from "@homarr/db";
import { getServerSettingByKeyAsync, updateDiscoveryAsync } from "@homarr/db/queries";
import { integrations } from "@homarr/db/schema";
import { createIntegrationAsync } from "@homarr/integrations";
import { mergeProxmoxInventory } from "@homarr/server-settings";

export const syncProxmoxDiscoveryAsync = async (db: Database) => {
  const settings = await getServerSettingByKeyAsync(db, "discovery");
  if (!settings.enabled || !settings.proxmoxIntegrationId) return;
  const integrationId = settings.proxmoxIntegrationId;
  try {
    const row = await db.query.integrations.findFirst({
      where: eq(integrations.id, integrationId),
      with: { secrets: true, app: true },
    });
    if (!row || row.kind !== "proxmox") throw new Error("Proxmox integration missing");
    const integration = await createIntegrationAsync({
      ...row,
      kind: "proxmox",
      externalUrl: row.app?.href ?? null,
      decryptedSecrets: row.secrets.map((secret) => ({ ...secret, value: decryptSecret(secret.value) })),
    });
    const snapshot = await integration.getClusterInfoAsync();
    const now = new Date().toISOString();
    await updateDiscoveryAsync(db, (state) => {
      if (!state.enabled || state.proxmoxIntegrationId !== integrationId) return;
      state.resources = mergeProxmoxInventory(state.resources, [...snapshot.vms, ...snapshot.lxcs], now);
      state.lastSyncAt = now;
      state.syncError = null;
    });
  } catch {
    await updateDiscoveryAsync(db, (state) => {
      if (state.proxmoxIntegrationId === integrationId) state.syncError = "Proxmox sync failed. Check the integration connection and API permissions.";
    }, false);
    throw new Error("Proxmox sync failed. Check the integration connection and API permissions.");
  }
};
