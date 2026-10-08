import type * as Preset from "@docusaurus/preset-classic";
import type { Config } from "@docusaurus/types";
import { themes as prismThemes } from "prism-react-renderer";

const a11yEmoji = require("@fec/remark-a11y-emoji");
const repositoryUrl = "https://github.com/socilate47/my-homarr";
const branch = "homarr-discovery";
const searchAppId = process.env.DOCS_ALGOLIA_APP_ID;
const searchKey = process.env.DOCS_ALGOLIA_SEARCH_KEY;
const searchIndex = process.env.DOCS_ALGOLIA_INDEX_NAME;
const search = searchAppId && searchKey && searchIndex
  ? { appId: searchAppId, apiKey: searchKey, indexName: searchIndex, contextualSearch: true, searchPagePath: "search", insights: false }
  : undefined;

const config: Config = {
  title: "My Homarr",
  tagline: "Proxmox in view. Services within reach.",
  url: process.env.DOCS_SITE_URL ?? "https://socilate47.github.io",
  baseUrl: process.env.DOCS_BASE_URL ?? "/my-homarr/",
  trailingSlash: undefined,
  favicon: "img/my-homarr-mark.svg",
  organizationName: "socilate47",
  projectName: "my-homarr",
  i18n: { defaultLocale: "en", locales: ["en"] },
  onBrokenLinks: "throw",
  onBrokenAnchors: "throw",
  onDuplicateRoutes: "throw",
  future: {
    v4: {
      removeLegacyPostBuildHeadAttribute: true,
      useCssCascadeLayers: true,
      siteStorageNamespacing: true,
      fasterByDefault: true,
      mdx1CompatDisabledByDefault: false,
    },
    faster: { swcHtmlMinimizer: false },
  },
  markdown: { mermaid: true, format: "detect", hooks: { onBrokenMarkdownLinks: "throw" } },
  themes: ["@docusaurus/theme-mermaid"],
  presets: [
    ["classic", {
      docs: {
        sidebarPath: require.resolve("./sidebars.js"),
        editUrl: ({ docPath }) => `${repositoryUrl}/edit/${branch}/apps/docs/docs/${docPath}`,
        remarkPlugins: [a11yEmoji],
        exclude: [],
        showLastUpdateAuthor: false,
        showLastUpdateTime: false,
      },
      blog: {
        showReadingTime: true,
        editUrl: `${repositoryUrl}/edit/${branch}/apps/docs`,
        authorsMapPath: "authors.yml",
      },
      theme: { customCss: require.resolve("./src/css/custom.css") },
      sitemap: {
        changefreq: "weekly",
        priority: 0.5,
        ignorePatterns: ["/tags/**", "/docs/category/**"],
        filename: "sitemap.xml",
      },
    } satisfies Preset.Options],
  ],
  themeConfig: {
    navbar: {
      title: "My Homarr",
      logo: { alt: "My Homarr", src: "img/my-homarr-mark.svg" },
      items: [
        { label: "Start here", type: "doc", position: "left", docId: "my-homarr/index" },
        { label: "Setup", type: "doc", position: "left", docId: "my-homarr/setup" },
        { label: "Make it yours", type: "doc", position: "left", docId: "my-homarr/dashboard" },
        { label: "About this build", to: "/about-us", position: "right" },
        { label: "GitHub", href: repositoryUrl, position: "right" },
        ...(search ? [{ type: "search" as const, position: "right" as const }] : []),
      ],
      hideOnScroll: false,
    },
    ...(search ? { algolia: search } : {}),
    footer: {
      links: [
        { title: "My homelab", items: [
          { label: "Start here", to: "/docs/my-homarr" },
          { label: "Run this build", to: "/docs/my-homarr/setup" },
          { label: "Personalize the dashboard", to: "/docs/my-homarr/dashboard" },
        ] },
        { title: "Reference", items: [
          { label: "Guest discovery", to: "/docs/advanced/discovery" },
          { label: "Integrations", to: "/docs/management/integrations" },
          { label: "API", to: "/docs/management/api" },
        ] },
        { title: "Project", items: [
          { label: "Source code", href: repositoryUrl },
          { label: "About this build", to: "/about-us" },
          { label: "Upstream Homarr", href: "https://github.com/homarr-labs/homarr" },
        ] },
      ],
      logo: { alt: "My Homarr", src: "img/my-homarr-mark.svg", height: 40 },
      copyright: 'My Homarr · A personal homelab build by socilate47. Based on <a href="https://github.com/homarr-labs/homarr">Homarr</a>.',
    },
    prism: { theme: prismThemes.github, darkTheme: prismThemes.dracula, defaultLanguage: "bash" },
    colorMode: { defaultMode: "dark", respectPrefersColorScheme: true },
    metadata: [{ name: "keywords", content: "My Homarr, socilate47, Proxmox, homelab, VM discovery, guest agents" }],
    zoom: {
      selector: ".markdown :not(em) > img",
      background: { light: "rgb(245, 248, 252)", dark: "rgb(16, 31, 44)" },
      config: { margin: 80 },
    },
    tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 4 },
  } satisfies Preset.ThemeConfig,
  plugins: [
    function homarrPackagesPlugin() {
      return { name: "resolve-homarr-packages", configureWebpack() { return { resolve: { symlinks: false } }; } };
    },
    "docusaurus-plugin-image-zoom",
    require.resolve("./plugins/validate-docs-coverage"),
    function disableExpensiveBundlerOptimizationPlugin() {
      return {
        name: "disable-expensive-bundler-optimizations",
        configureWebpack(_config: unknown, isServer: boolean) {
          return { optimization: { concatenateModules: process.env.CI != null && process.env.CI !== "false" ? !isServer : false } };
        },
      };
    },
    "@signalwire/docusaurus-plugin-llms-txt",
    async function tailwindCssPlugin() {
      return {
        name: "docusaurus-tailwindcss",
        configurePostCss(postcssOptions) { postcssOptions.plugins.push(require("@tailwindcss/postcss")); return postcssOptions; },
      };
    },
  ],
};

export default config;
