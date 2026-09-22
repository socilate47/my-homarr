"use client";

import { Button, Group, Select, Switch } from "@mantine/core";
import { IconRefresh, IconRotate } from "@tabler/icons-react";

import { clientApi } from "@homarr/api/client";
import { showErrorNotification, showSuccessNotification } from "@homarr/notifications";

interface DiscoveryActionsProps {
  initialSettings: {
    enabled: boolean;
    proxmoxIntegrationId: string | null;
  };
  integrations: { id: string; name: string }[];
}

export function DiscoveryActions({ initialSettings, integrations }: DiscoveryActionsProps) {
  const utils = clientApi.useUtils();
  const saveSettings = clientApi.discovery.saveSettings.useMutation({
    onSuccess: async () => {
      await utils.discovery.getSettings.invalidate();
      showSuccessNotification({ title: "Discovery updated", message: "Discovery settings were saved." });
    },
    onError: (error) => showErrorNotification({ title: "Discovery update failed", message: error.message }),
  });
  const rotateToken = clientApi.discovery.rotateAgentToken.useMutation({
    onSuccess: async () => {
      await utils.discovery.getSettings.invalidate();
      showSuccessNotification({ title: "Agent token rotated", message: "Existing agents must be reconfigured." });
    },
    onError: (error) => showErrorNotification({ title: "Token rotation failed", message: error.message }),
  });
  const syncProxmox = clientApi.discovery.syncProxmox.useMutation({
    onSuccess: async () => {
      await utils.discovery.getSettings.invalidate();
      showSuccessNotification({ title: "Proxmox synchronized", message: "The resource inventory was updated." });
    },
    onError: (error) => showErrorNotification({ title: "Proxmox sync failed", message: error.message }),
  });
  const selectedIntegration = integrations.some(({ id }) => id === initialSettings.proxmoxIntegrationId)
    ? initialSettings.proxmoxIntegrationId
    : null;

  return (
    <Group align="end">
      <Select
        label="Proxmox integration"
        placeholder="Select Proxmox"
        data={integrations.map((integration) => ({ value: integration.id, label: integration.name }))}
        value={selectedIntegration}
        onChange={(value) =>
          saveSettings.mutate({
            enabled: initialSettings.enabled,
            proxmoxIntegrationId: value,
          })
        }
        w={220}
      />
      <Switch
        label="Enabled"
        checked={initialSettings.enabled}
        onChange={(event) =>
          saveSettings.mutate({
            enabled: event.currentTarget.checked,
            proxmoxIntegrationId: initialSettings.proxmoxIntegrationId,
          })
        }
      />
      <Button
        leftSection={<IconRefresh size={16} />}
        loading={syncProxmox.isPending}
        disabled={!initialSettings.proxmoxIntegrationId}
        onClick={() => selectedIntegration && syncProxmox.mutate({ integrationId: selectedIntegration })}
      >
        Sync Proxmox
      </Button>
      <Button
        variant="subtle"
        leftSection={<IconRotate size={16} />}
        loading={rotateToken.isPending}
        onClick={() => rotateToken.mutate()}
      >
        Rotate token
      </Button>
    </Group>
  );
}
