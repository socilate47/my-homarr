"use client";

import { useState } from "react";
import { Alert, Anchor, Badge, Button, Card, Code, CopyButton, Group, Select, SimpleGrid, Stack, Switch, Text, Title } from "@mantine/core";

import type { RouterOutputs } from "@homarr/api";
import { clientApi } from "@homarr/api/client";
import { showSuccessNotification } from "@homarr/notifications";
import { isDiscoveryAgentOnline } from "@homarr/server-settings";
import { useCurrentLocale, useScopedI18n } from "@homarr/translation/client";

interface DiscoveryActionsProps {
  initialSettings: RouterOutputs["discovery"]["getSettings"];
  integrations: { id: string; name: string }[];
  boards: { id: string; name: string; isHome: boolean }[];
}
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const installerUrl = "https://raw.githubusercontent.com/socilate47/my-homarr/homarr-discovery/tools/homarr-discovery-agent/install-agent.sh";

export function DiscoveryActions({ initialSettings, integrations, boards }: DiscoveryActionsProps) {
  const t = useScopedI18n("discovery");
  const locale = useCurrentLocale();
  const utils = clientApi.useUtils();
  const settingsQuery = clientApi.discovery.getSettings.useQuery(undefined, { initialData: initialSettings, refetchInterval: 15000 });
  const settings = settingsQuery.data ?? initialSettings;
  const [enabled, setEnabled] = useState(initialSettings.enabled);
  const [integrationId, setIntegrationId] = useState(initialSettings.proxmoxIntegrationId);
  const [boardId, setBoardId] = useState(initialSettings.targetBoardId ?? boards.find((board) => board.isHome)?.id ?? null);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [installId, setInstallId] = useState<string | null>(null);
  const reveal = clientApi.discovery.getAgentToken.useMutation();
  const refresh = async () => { await utils.discovery.getSettings.invalidate(); };
  const save = clientApi.discovery.saveSettings.useMutation({ onSuccess: async () => {
    reveal.reset(); setInstallId(null); await refresh(); showSuccessNotification({ message: t("saved") });
  } });
  const sync = clientApi.discovery.syncProxmox.useMutation({ onSuccess: refresh });
  const rotate = clientApi.discovery.rotateAgentToken.useMutation({ onSuccess: async () => {
    reveal.reset(); setInstallId(null); setConfirmRotate(false); await refresh(); showSuccessNotification({ message: t("rotated") });
  } });
  const restore = clientApi.discovery.restoreService.useMutation({ onSuccess: refresh });
  const error = save.error ?? sync.error ?? rotate.error ?? reveal.error ?? restore.error ?? settingsQuery.error;
  const destinationMissing = settings.targetBoardId && !boards.some(({ id }) => id === settings.targetBoardId);

  return <Stack>
    <div><Title order={1}>{t("title")}</Title><Text c="dimmed">{t("description")}</Text></div>
    <Card withBorder>
      <form noValidate onSubmit={(event) => { event.preventDefault(); save.mutate({ enabled, proxmoxIntegrationId: integrationId, targetBoardId: boardId }); }}>
        <Stack>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select label={t("integration")} placeholder={t("chooseIntegration")} data={integrations.map(({ id, name }) => ({ value: id, label: name }))} value={integrationId} onChange={setIntegrationId} searchable disabled={save.isPending} />
            <Select label={t("dashboard")} placeholder={t("chooseDashboard")} data={boards.map(({ id, name }) => ({ value: id, label: name }))} value={boardId} onChange={setBoardId} searchable disabled={save.isPending} />
          </SimpleGrid>
          <Switch label={t("enabled")} checked={enabled} onChange={(event) => setEnabled(event.currentTarget.checked)} disabled={save.isPending} />
          <Group><Button type="submit" loading={save.isPending}>{t("save")}</Button><Button variant="default" loading={sync.isPending} disabled={!settings.enabled || !settings.proxmoxIntegrationId || save.isPending} onClick={() => settings.proxmoxIntegrationId && sync.mutate({ integrationId: settings.proxmoxIntegrationId })}>{t("sync")}</Button></Group>
          <Text size="sm" c="dimmed">{t("schedule")}</Text>
          <Text size="sm" c="dimmed">{t("dashboardChangeHelp")}</Text>
          {settings.lastSyncAt && <Text size="sm">{t("lastSync", { time: new Date(settings.lastSyncAt).toLocaleString(locale) })}</Text>}
        </Stack>
      </form>
    </Card>
    {(error || settings.syncError || settings.dashboardError) && <Alert color="red" role="alert">{error?.message ?? settings.syncError ?? settings.dashboardError}</Alert>}
    {destinationMissing && <Alert color="yellow">{t("missingDashboard")}</Alert>}
    {integrations.length === 0 && <Alert>{t("noIntegration")}</Alert>}
    {boards.length === 0 && <Alert>{t("noDashboard")}</Alert>}
    <Card withBorder><Stack gap="sm">
      <Text fw={600}>{t("agentSetup")}</Text><Text size="sm" c="dimmed">{t("agentHelp")}</Text>
      <Group>
        <Button variant="default" disabled={!settings.hasAgentToken || !settings.enabled} loading={reveal.isPending} onClick={() => reveal.data ? reveal.reset() : reveal.mutate()}>{reveal.data ? t("hideToken") : t("revealToken")}</Button>
        <Button variant="subtle" color="red" disabled={!settings.hasAgentToken} onClick={() => setConfirmRotate(true)}>{t("rotateToken")}</Button>
      </Group>
      {reveal.data && <Code block style={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{reveal.data}</Code>}
      {confirmRotate && <Alert color="yellow"><Stack gap="sm"><Text size="sm">{t("rotateWarning")}</Text><Group><Button color="red" loading={rotate.isPending} onClick={() => rotate.mutate()}>{t("confirmRotate")}</Button><Button variant="default" disabled={rotate.isPending} onClick={() => setConfirmRotate(false)}>{t("cancel")}</Button></Group></Stack></Alert>}
    </Stack></Card>
    <SimpleGrid cols={{ base: 1, md: 2 }}>
      {settings.resources.map((resource) => {
        const online = isDiscoveryAgentOnline(resource) && resource.status === "running";
        const command = reveal.data && installId === resource.id && typeof window !== "undefined"
          ? `curl -fsSL ${quote(installerUrl)} -o /tmp/install-homarr-agent.sh && sudo env HOMARR_URL=${quote(window.location.origin)} HOMARR_DISCOVERY_TOKEN=${quote(reveal.data)} DISCOVERY_RESOURCE_ID=${quote(resource.id)} DISCOVERY_NAME=${quote(resource.name)} DISCOVERY_TYPE=${quote(resource.type)} bash /tmp/install-homarr-agent.sh`
          : null;
        return <Card key={resource.id} withBorder><Stack gap="sm">
          <Group justify="space-between"><Text fw={600} style={{ overflowWrap: "anywhere" }}>{resource.name}</Text><Badge color={online ? "green" : "gray"}>{!resource.lastAgentSeenAt ? t("agentNeeded") : online ? t("online") : t("offline")}</Badge></Group>
          <Text size="sm" c="dimmed">{resource.id} · {resource.node} · {resource.status}</Text>
          <Text size="sm" style={{ overflowWrap: "anywhere" }}>{resource.ipAddresses.join(", ") || t("noAddress")}</Text>
          <Button variant="light" disabled={!settings.enabled || !settings.hasAgentToken} onClick={() => { setInstallId(resource.id); if (!reveal.data) reveal.mutate(); }}>{t("install")}</Button>
          {command && <Stack gap="xs"><Text size="sm">{t("installHelp")}</Text><Code block style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{command}</Code><CopyButton value={command}>{({ copied, copy }) => <Button variant="default" onClick={copy}>{copied ? t("copied") : t("copy")}</Button>}</CopyButton></Stack>}
          {resource.services.map((service) => {
            const mapping = settings.mappings.find((row) => row.boardId === settings.targetBoardId && row.resourceId === resource.id && row.serviceId === service.id);
            return <Group key={service.id} justify="space-between" align="start">
              <Stack gap={0} style={{ minWidth: 0, flex: 1 }}><Anchor href={/^https?:\/\//.test(service.url) ? service.url : undefined} target="_blank" rel="noopener noreferrer" style={{ overflowWrap: "anywhere" }}>{service.name}</Anchor><Text size="xs" c="dimmed" style={{ overflowWrap: "anywhere" }}>{service.url}</Text></Stack>
              {mapping?.suppressed ? <Button size="xs" variant="default" loading={restore.isPending && restore.variables?.serviceId === service.id} onClick={() => restore.mutate({ resourceId: resource.id, serviceId: service.id })}>{t("restore")}</Button> : <Badge size="sm" color={service.online && online ? "green" : "gray"}>{service.online && online ? t("online") : t("offline")}</Badge>}
            </Group>;
          })}
          {resource.services.length === 0 && <Text size="sm" c="dimmed">{t("noServices")}</Text>}
        </Stack></Card>;
      })}
    </SimpleGrid>
    {settings.resources.length === 0 && <Card withBorder><Text c="dimmed">{t("empty")}</Text></Card>}
  </Stack>;
}
