// @vitest-environment node
import { readFile, stat } from "node:fs/promises";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, HEAD } from "./[asset]/route";

vi.mock("node:fs/promises", async (importOriginal) => ({
  ...await importOriginal<typeof import("node:fs/promises")>(),
  readFile: vi.fn(),
  stat: vi.fn(),
}));

const request = new Request("https://homarr.example.com/api/discovery-agent/install-agent.sh");
const context = (asset: string) => ({ params: Promise.resolve({ asset }) });

beforeEach(() => {
  vi.mocked(stat).mockReset();
  vi.mocked(readFile).mockReset();
});

describe("built-in agent downloads", () => {
  it("rejects arbitrary file paths before opening a file", async () => {
    const response = await GET(request, context("../../../../etc/passwd"));
    expect(response.status).toBe(404);
    expect(stat).not.toHaveBeenCalled();
    expect(readFile).not.toHaveBeenCalled();
  });
  it("serves the installer with download headers", async () => {
    const source = Buffer.from("#!/bin/sh\n");
    vi.mocked(stat).mockResolvedValue({ size: source.length, isFile: () => true } as Awaited<ReturnType<typeof stat>>);
    vi.mocked(readFile).mockResolvedValue(source);
    const response = await GET(request, context("install-agent.sh"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain("install-agent.sh");
    expect(await response.text()).toBe(source.toString());
  });
  it("supports availability checks without reading a binary", async () => {
    vi.mocked(stat).mockResolvedValue({ size: 123, isFile: () => true } as Awaited<ReturnType<typeof stat>>);
    const response = await HEAD(request, context("homarr-discovery-agent-linux-amd64"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Length")).toBe("123");
    expect(await response.text()).toBe("");
    expect(readFile).not.toHaveBeenCalled();
  });
  it("reports missing distribution files without exposing filesystem details", async () => {
    vi.mocked(stat).mockRejectedValue(Object.assign(new Error("missing"), { code: "ENOENT" }));
    const response = await GET(request, context("install-agent.sh"));
    expect(response.status).toBe(503);
    expect(await response.text()).toContain("Agent downloads are missing");
  });
});
