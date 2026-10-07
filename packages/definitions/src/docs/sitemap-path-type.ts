/** Search and sitemap endpoints exist even when they are omitted from the public sitemap. */
export const createSitemapPathType = (paths: readonly string[]) => {
  const allPaths = new Set(
    [...paths, "/search", "/sitemap.xml"].map((path) => path.replace(/\/$/, "")),
  );
  return "export type HomarrDocumentationPath =\n" + [...allPaths].map((path) => `  | "${path}"`).join("\n");
};
