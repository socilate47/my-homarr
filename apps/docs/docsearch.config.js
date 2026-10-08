// Optional Algolia crawler template for My Homarr.
// Replace the application/admin key placeholders and adjust the site URL before use.

new Crawler({
  appId: "YOUR_ALGOLIA_APP_ID",
  apiKey: "YOUR_CRAWLER_ADMIN_API_KEY",
  indexPrefix: "",
  rateLimit: 32,
  maxDepth: 4,
  startUrls: ["https://socilate47.github.io/my-homarr/"],
  sitemaps: ["https://socilate47.github.io/my-homarr/sitemap.xml"],
  ignoreCanonicalTo: true,
  discoveryPatterns: ["https://socilate47.github.io/my-homarr/**"],
  exclusionPatterns: [
    "https://socilate47.github.io/my-homarr/docs/tags/**",
    "https://socilate47.github.io/my-homarr/blog/tags/**",
    "https://socilate47.github.io/my-homarr/blog/authors/**",
    "https://socilate47.github.io/my-homarr/blog/archive/**",
    "https://socilate47.github.io/my-homarr/search/**",
    "https://socilate47.github.io/my-homarr/docs/category/**",
  ],
  actions: [
    {
      indexName: "my-homarr",
      pathsToMatch: ["https://socilate47.github.io/my-homarr/**"],
      recordExtractor: ({ $, helpers }) => {
        const lvl0 =
          $(".menu__link.menu__link--sublist.menu__link--active, .navbar__item.navbar__link--active").last().text() ||
          "Documentation";

        return helpers.docsearch({
          recordProps: {
            lvl0: {
              selectors: "",
              defaultValue: lvl0,
            },
            lvl1: ["header h1", "article h1"],
            lvl2: "article h2",
            lvl3: "article h3",
            lvl4: "article h4",
            lvl5: "article h5, article td:first-child",
            lvl6: "article h6",
            content: "article p, article li, article td:last-child",
          },
          indexHeadings: true,
          aggregateContent: true,
          recordVersion: "v3",
        });
      },
    },
    {
      indexName: "my-homarr-markdown",
      pathsToMatch: ["https://socilate47.github.io/my-homarr/**"],
      recordExtractor: ({ $, url, helpers }) => {
        const text = helpers.markdown("article > *:not(nav):not(header):not(.breadcrumb)");

        if (text === "") {
          return [];
        }

        const language = $("html").attr("lang") || "en";
        const title = $("head > title").text();
        const h1 = $("article h1").first().text();

        return helpers.splitTextIntoRecords({
          text,
          baseRecord: {
            url,
            objectID: url,
            title: title || h1,
            heading: h1,
            lang: language,
            language,
            version: "current",
            docusaurus_tag: "docs-default-current",
          },
          maxRecordBytes: 100000,
          orderingAttributeName: "part",
        });
      },
    },
  ],
  initialIndexSettings: {
    Docusaurus: {
      attributesForFaceting: ["type", "lang", "language", "version", "docusaurus_tag"],
      attributesToRetrieve: ["hierarchy", "content", "anchor", "url", "url_without_anchor", "type"],
      attributesToHighlight: ["hierarchy", "content"],
      attributesToSnippet: ["content:10"],
      camelCaseAttributes: ["hierarchy", "content"],
      searchableAttributes: [
        "unordered(hierarchy.lvl0)",
        "unordered(hierarchy.lvl1)",
        "unordered(hierarchy.lvl2)",
        "unordered(hierarchy.lvl3)",
        "unordered(hierarchy.lvl4)",
        "unordered(hierarchy.lvl5)",
        "unordered(hierarchy.lvl6)",
        "content",
      ],
      distinct: true,
      attributeForDistinct: "url",
      customRanking: ["desc(weight.pageRank)", "desc(weight.level)", "asc(weight.position)"],
      ranking: ["words", "filters", "typo", "attribute", "proximity", "exact", "custom"],
      highlightPreTag: '<span class="algolia-docsearch-suggestion--highlight">',
      highlightPostTag: "</span>",
      minWordSizefor1Typo: 3,
      minWordSizefor2Typos: 7,
      allowTyposOnNumericTokens: false,
      minProximity: 1,
      ignorePlurals: true,
      advancedSyntax: true,
      attributeCriteriaComputedByMinProximity: true,
      removeWordsIfNoResults: "allOptional",
    },
    markdown: {
      attributesForFaceting: ["lang", "language", "version", "docusaurus_tag"],
      ignorePlurals: true,
      minProximity: 1,
      removeStopWords: false,
      searchableAttributes: ["title", "heading", "unordered(text)"],
      removeWordsIfNoResults: "lastWords",
      attributesToHighlight: ["title", "text"],
      typoTolerance: false,
      advancedSyntax: false,
    },
  },
  apiKey: "YOUR_CRAWLER_ADMIN_API_KEY",
  schedule: "on saturday",
  renderJavaScript: false,
  maxUrls: null,
  cache: { enabled: false },
  safetyChecks: { beforeIndexPublishing: { maxLostRecordsPercentage: 99 } },
});
