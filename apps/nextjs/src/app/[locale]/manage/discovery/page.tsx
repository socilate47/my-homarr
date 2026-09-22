import { notFound } from "next/navigation";
import { Badge, Card, Code, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";

import { api } from "@homarr/api/server";
import { auth } from "@homarr/auth/next";

import { DiscoveryActions } from "./discovery-actions";

export default async function DiscoveryPage() {
  const session = await auth();
  if (!session?.user.permissions.includes("admin")) {
    notFound();
  }

  const settings = await api.discovery.getSettings();
  const integrations = (await api.integration.all()).filter((integration) => integration.kind === "proxmox");

  return (
    <Stack>
      <Group justify="space-between">
        <div>
          <Title order={1}>Discovery</Title>
          <Text c="dimmed">Automatically track Proxmox machines and services reported by VM agents.</Text>
        </div>
        <DiscoveryActions initialSettings={settings} integrations={integrations} />
      </Group>

      <Card withBorder>
        <Group justify="space-between">
          <Text fw={600}>Agent token</Text>
          <Code>{settings.agentToken ? `${settings.agentToken.slice(0, 8)}...` : "Not generated"}</Code>
        </Group>
        <Text size="sm" c="dimmed" mt="xs">
          Install the agent in a VM and configure it with the full token. Rotate it if it is ever exposed.
        </Text>
      </Card>

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        {settings.resources.map((resource) => (
          <Card key={resource.id} withBorder>
            <Group justify="space-between" mb="sm">
              <Text fw={600}>{resource.name}</Text>
              <Badge color={resource.status === "running" ? "green" : "gray"}>{resource.status}</Badge>
            </Group>
            <Text size="sm" c="dimmed">
              {resource.type.toUpperCase()} · {resource.node}
            </Text>
            <Text size="sm" mt="sm">
              IPs: {resource.ipAddresses.length > 0 ? resource.ipAddresses.join(", ") : "No IP reported"}
            </Text>
            <Stack gap="xs" mt="sm">
              {resource.services.map((service) => (
                <Group key={service.id} justify="space-between" wrap="nowrap">
                  <Text size="sm">{service.name}</Text>
                  <Text size="xs" c="dimmed" truncate>
                    {service.url}
                  </Text>
                </Group>
              ))}
              {resource.services.length === 0 && (
                <Text size="sm" c="dimmed">
                  No services reported
                </Text>
              )}
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
      {settings.resources.length === 0 && (
        <Card withBorder>
          <Text c="dimmed">No machines discovered yet. Enable discovery and run a Proxmox sync.</Text>
        </Card>
      )}
    </Stack>
  );
}
