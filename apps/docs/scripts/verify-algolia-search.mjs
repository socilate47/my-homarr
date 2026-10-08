const appId = process.env.DOCS_ALGOLIA_APP_ID;
const searchKey = process.env.DOCS_ALGOLIA_SEARCH_KEY;
const indexName = process.env.DOCS_ALGOLIA_INDEX_NAME;

async function main() {
  if (!appId && !searchKey && !indexName) {
    console.log('Search verification skipped: configure your DOCS_ALGOLIA_APP_ID, DOCS_ALGOLIA_SEARCH_KEY and DOCS_ALGOLIA_INDEX_NAME first.');
    return;
  }
  if (!appId || !searchKey || !indexName) {
    throw new Error('Set all three DOCS_ALGOLIA settings to verify your own documentation index.');
  }
  for (const term of ['Proxmox', 'discovery', 'dashboard']) {
    const response = await fetch(`https://${appId}-dsn.algolia.net/1/indexes/${encodeURIComponent(indexName)}/query`, {
      method: 'POST',
      headers: { 'X-Algolia-Application-Id': appId, 'X-Algolia-API-Key': searchKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: term, hitsPerPage: 1 }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Search query failed with HTTP ${response.status}.`);
    const result = await response.json();
    if (!result.nbHits) throw new Error(`Your index has no results for "${term}". Check its crawl configuration.`);
    console.log(`OK: ${term} returns results from your documentation index.`);
  }
}

await main().catch((error) => { console.error(error.message); process.exitCode = 1; });
