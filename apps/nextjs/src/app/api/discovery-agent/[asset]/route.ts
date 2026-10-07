import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const assets = new Set([
  "install-agent.sh",
  "homarr-discovery-agent-linux-amd64",
  "homarr-discovery-agent-linux-arm64",
  "SHA256SUMS",
]);

type Context = { params: Promise<{ asset: string }> };

const respond = async (context: Context, head: boolean) => {
  const { asset } = await context.params;
  if (!assets.has(asset)) return NextResponse.json({ error: "Agent asset not found" }, { status: 404 });
  const directory = process.env.HOMARR_DISCOVERY_ASSET_DIR ?? join(process.cwd(), "public", "discovery-agent");
  const path = join(directory, asset);
  try {
    const file = await stat(path);
    if (!file.isFile()) return NextResponse.json({ error: "Agent asset not found" }, { status: 404 });
    const contentType = asset === "install-agent.sh" || asset === "SHA256SUMS"
      ? "text/plain; charset=utf-8"
      : "application/octet-stream";
    const content = head ? null : new Uint8Array(await readFile(path));
    return new NextResponse(content, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": file.size.toString(),
        "Content-Disposition": `attachment; filename="${asset}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return NextResponse.json({ error: "Agent downloads are missing from this build. Build using the Homarr Dockerfile or run tools/homarr-discovery-agent/prepare-homarr-assets.sh." }, { status: 503 });
    }
    throw error;
  }
};

export const GET = async (_request: Request, context: Context) => respond(context, false);
export const HEAD = async (_request: Request, context: Context) => respond(context, true);
