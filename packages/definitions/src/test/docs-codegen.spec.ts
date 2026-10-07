import { describe, expect, it } from "vitest";

import { createSitemapPathType } from "../docs/sitemap-path-type";

describe("documentation route generation", () => {
  it("keeps the search route when the fetched sitemap excludes it", () => {
    const result = createSitemapPathType(["/docs/getting-started"]);
    expect(result).toContain('| "/search"');
    expect(result).toContain('| "/sitemap.xml"');
    expect(result).toContain('| "/docs/getting-started"');
  });

  it("retains required routes when only local slug paths are available", () => {
    const result = createSitemapPathType([]);
    expect(result).toContain('| "/search"');
    expect(result).toContain('| "/sitemap.xml"');
  });

  it("deduplicates normalized paths without changing the input", () => {
    const paths = ["/search", "/search/", "/docs/getting-started/"];
    const result = createSitemapPathType(paths);
    expect(result.match(/\| "\/search"/g)).toHaveLength(1);
    expect(result).toContain('| "/docs/getting-started"');
    expect(paths).toEqual(["/search", "/search/", "/docs/getting-started/"]);
  });
});
