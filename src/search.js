const SEARCH_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

// Public instances are only a fallback pool. A user-configured SEARXNG_URL is preferred.
// The list is intentionally small to avoid hammering public instances.
const PUBLIC_SEARXNG_INSTANCES = [
  "https://searx.tiekoetter.com",
  "https://xka.cz",
  "https://search.mectov.my.id",
  "https://search.minus27315.dev",
  "https://searxng.cups.moe"
];

function stripHtml(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function parseDuckDuckGoResults(html) {
  const results = [], seenUrls = new Set();
  const blocks = html.split(/class=["']result(?:\s+results_links)?["']/i);
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    if (/result--ad|ad_provider|ad_domain/i.test(block)) continue;
    const linkMatch = block.match(/class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)
      || block.match(/<a[^>]+href=["']([^"']+)["'][^>]+class=["'][^"']*result__a[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;
    let rawUrl = linkMatch[1];
    if (rawUrl.startsWith("//")) rawUrl = "https:" + rawUrl;
    let finalUrl = "";
    try { const parsed = new URL(rawUrl); const destination = parsed.searchParams.get("uddg"); finalUrl = destination ? decodeURIComponent(destination) : parsed.toString(); } catch { continue; }
    if (!/^https?:\/\//i.test(finalUrl) || seenUrls.has(finalUrl)) continue;
    seenUrls.add(finalUrl);
    const title = stripHtml(linkMatch[2]);
    const snippetMatch = block.match(/class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div|span)>/i);
    const snippet = snippetMatch ? stripHtml(snippetMatch[1]) : "";
    if (title || snippet) results.push({ title, url: finalUrl, snippet });
  }
  return results;
}

function looksLikeChallenge(html) {
  return /captcha|robot|unusual traffic|automated|bot detection|challenge/i.test(String(html || ""));
}

async function duckduckgo(query) {
  if (!query || query.length > 499) throw new Error("Search query must be between 1 and 499 characters");
  const attempts = [
    { url: "https://html.duckduckgo.com/html/", body: { q: query, b: "" } },
    { url: "https://lite.duckduckgo.com/lite/", body: { q: query } }
  ];
  let lastStatus = null, challengeDetected = false;
  for (const attempt of attempts) {
    const response = await fetch(attempt.url, { method: "POST", headers: { "User-Agent": SEARCH_USER_AGENT, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9", "Content-Type": "application/x-www-form-urlencoded", "Referer": "https://html.duckduckgo.com/" }, body: new URLSearchParams(attempt.body).toString() });
    const html = await response.text();
    lastStatus = response.status;
    if (!response.ok) continue;
    if (looksLikeChallenge(html)) { challengeDetected = true; continue; }
    const results = parseDuckDuckGoResults(html);
    if (results.length) return { provider: "duckduckgo", query, results };
    if (/result__a|result__snippet|result[_\-]links|no-results/i.test(html)) return { provider: "duckduckgo", query, results: [] };
  }
  if (challengeDetected) throw new Error("DuckDuckGo returned a bot/challenge response; search was not parsed");
  if (lastStatus && lastStatus !== 200) throw new Error(`Search provider returned ${lastStatus}`);
  throw new Error("DuckDuckGo response could not be parsed as a search-results page");
}

function buildSearxSearchUrl(baseUrl, query) {
  const base = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) throw new Error("SEARXNG_URL must be an HTTP or HTTPS URL");
  const endpoint = /\/search$/i.test(base) ? base : `${base}/search`;
  const url = new URL(endpoint);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("language", "en");
  url.searchParams.set("categories", "general");
  return url.toString();
}

async function searxng(query, env) {
  const configuredUrl = String(env?.SEARXNG_URL || "").trim();
  const instances = configuredUrl ? [configuredUrl] : PUBLIC_SEARXNG_INSTANCES;
  const failures = [];

  for (const instance of instances) {
    try {
      const response = await fetch(buildSearxSearchUrl(instance, query), {
        headers: { "User-Agent": SEARCH_USER_AGENT, "Accept": "application/json" }
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      let data;
      try { data = JSON.parse(text); } catch { throw new Error("non-JSON response; JSON API may be disabled"); }
      const rawResults = Array.isArray(data.results) ? data.results : [];
      const seen = new Set();
      const results = rawResults
        .map(result => ({ title: stripHtml(result.title || ""), url: String(result.url || result.link || ""), snippet: stripHtml(result.content || result.snippet || "") }))
        .filter(result => /^https?:\/\//i.test(result.url) && !seen.has(result.url) && seen.add(result.url))
        .filter(result => result.title || result.snippet);

      if (results.length) return { provider: "searxng", instance, query, results, attemptedInstances: [...instances] };
      failures.push(`${instance}: empty results`);
    } catch (error) {
      failures.push(`${instance}: ${error.message}`);
    }
  }

  throw new Error(`All SearXNG instances failed: ${failures.join("; ")}`);
}

export async function search(query, env = {}, requestedProvider = null) {
  const preferred = String(requestedProvider || env.SEARCH_PROVIDER || "auto").trim().toLowerCase();
  if (!["auto", "duckduckgo", "searxng"].includes(preferred)) throw new Error("Invalid search provider; use auto, duckduckgo, or searxng");

  if (preferred === "duckduckgo") return duckduckgo(query);
  if (preferred === "searxng") return searxng(query, env);

  const attempts = [];
  try {
    const result = await duckduckgo(query);
    attempts.push("duckduckgo");
    if (result.results.length || !env.SEARXNG_URL) return { ...result, attemptedProviders: attempts };
    return { ...result, attemptedProviders: attempts };
  } catch (error) {
    attempts.push(`duckduckgo:error:${error.message}`);
  }

  const fallback = await searxng(query, env);
  return { ...fallback, attemptedProviders: [...attempts, "searxng"] };
}

export { duckduckgo, searxng, PUBLIC_SEARXNG_INSTANCES };
