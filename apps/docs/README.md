# My Homarr documentation

The personal field guide for [socilate47/my-homarr](https://github.com/socilate47/my-homarr), built with Docusaurus in this monorepo.

The homepage, branding and My Homarr guides describe this fork. General integration/widget references retain their upstream Homarr origins. Original license files and attribution remain in the project.

## Preview

From the repository root:

```bash
pnpm dev:docs
```

Default address: `http://localhost:3003/my-homarr/`.

## Check and build

```bash
pnpm exec turbo typecheck --filter=@homarr/docs
pnpm exec turbo build --filter=@homarr/docs
```

The My Homarr documentation workflow runs these checks after documentation changes. It uploads the static build as an artifact; it does not publish the site automatically.

## Site settings

| Variable | Purpose | Default |
| --- | --- | --- |
| `DOCS_SITE_URL` | Production site origin | `https://socilate47.github.io` |
| `DOCS_BASE_URL` | Path where the docs are served | `/my-homarr/` |
| `DOCS_ALGOLIA_APP_ID` | Your Algolia application | Unset |
| `DOCS_ALGOLIA_SEARCH_KEY` | Your public search-only key | Unset |
| `DOCS_ALGOLIA_INDEX_NAME` | Your documentation index | Unset |

Search appears only when all three Algolia settings are present. The site does not reuse upstream Homarr’s search index, analytics project or assistant widget.

## Content

- `docs/my-homarr/` — the personal start, setup and dashboard guides.
- `docs/advanced/discovery.mdx` — the full discovery and guest-agent reference.
- `docs/management/`, `docs/integrations/`, `docs/widgets/` — shared technical references.
- `src/pages/` — the My Homarr homepage and project/about page.
- `src/css/custom.css` — shared documentation colors and typography.
- `static/img/my-homarr-mark.svg` — this fork’s documentation mark.

Edit links point to this repository’s `homarr-discovery` branch. New content is checked for broken links and missing feature references during the docs build.

For optional search, adapt `docsearch.config.js` to your site and index. With your three search settings configured, `pnpm --filter @homarr/docs verify:search` checks Proxmox, discovery and dashboard queries against that index. It skips requests when search is unconfigured.
