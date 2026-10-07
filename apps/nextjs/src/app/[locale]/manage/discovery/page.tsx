import { notFound } from "next/navigation";

import { api } from "@homarr/api/server";
import { auth } from "@homarr/auth/next";

import { DiscoveryActions } from "./discovery-actions";

export default async function DiscoveryPage() {
  const session = await auth();
  if (!session?.user.permissions.includes("admin")) notFound();
  const [settings, integrations, boards] = await Promise.all([
    api.discovery.getSettings(), api.integration.all(), api.board.getAllBoards(),
  ]);
  return <DiscoveryActions initialSettings={settings} integrations={integrations.filter((integration) => integration.kind === "proxmox")} boards={boards} />;
}
