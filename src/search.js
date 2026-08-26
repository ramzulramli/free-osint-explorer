const SEARCH_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

// Keep provider fan-out deliberately small to protect the Cloudflare Worker
// subrequest budget.
const DEFAULT_SEARXNG_URL = "https://search.mectov.my.id";

function stripHtml(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/https?:\/\/[^\s]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function searchTerms(query) {
  return [...new Set(normalizeSearchText(query).split(" ").filter(term => term.length >= 2))];
}

function tokenizeName(value) {
  return normalizeSearchText(value).split(" ").filter(Boolean);
}

function isNameLikeQuery(query) {
  const terms = searchTerms(query);
  return terms.length >= 2 && terms.length <= 5 && terms.every(term => /^[a-z]+$/.test(term));
}

function buildQueryVariants(query) {
  const q = String(query || "").trim();
  if (!isNameLikeQuery(q)) return [q];
  const terms = q.split(/\s+/).filter(Boolean);
  const variants = [q, `"${q}"`];
  if (terms.length === 2 && !/\b(bin|binti)\b/i.test(q)) variants.push(`"${terms[0]} bin ${terms[1]}"`);
  return [...new Set(variants)];
}

function scoreSearchResult(result, query) {
  const terms = searchTerms(query);
  const title = normalizeSearchText(result.title);
  const snippet = normalizeSearchText(result.snippet);
  const titleWords = title.split(" ").filter(Boolean);
  const snippetWords = snippet.split(" ").filter(Boolean);
  if (!titleWords.length && !snippetWords.length) return { score: 0, matchType: "none", matchedTerms: [] };

  const exactPhrase = normalizeSearchText(query);
  const titleHasExactPhrase = exactPhrase.length > 0 && (` ${title} `).includes(` ${exactPhrase} `);
  const snippetHasExactPhrase = exactPhrase.length > 0 && (` ${snippet} `).includes(` ${exactPhrase} `);
  const matchedTerms = terms.filter(term => titleWords.includes(term) || snippetWords.includes(term));
  const titleMatches = terms.filter(term => titleWords.includes(term)).length;
  const snippetMatches = terms.filter(term => !titleWords.includes(term) && snippetWords.includes(term)).length;

  let score = titleMatches * 0.35 + snippetMatches * 0.10;
  let matchType = "partial";
  if (titleHasExactPhrase) { score = 1.0; matchType = "exact_phrase"; }
  else if (titleMatches === terms.length) { score = 0.90; matchType = "all_terms_in_title"; }
  else if (titleMatches >= 1 && snippetMatches >= 1) { score = 0.65; matchType = "split_name"; }
  else if (titleMatches >= 1) { score = 0.45; matchType = "partial_title"; }
  else if (snippetMatches >= 1) { score = 0.20; matchType = "snippet_only"; }

  if (isNameLikeQuery(query) && !titleHasExactPhrase) {
    const titleNameWords = tokenizeName(result.title);
    const compoundMatches = terms.filter(term => titleNameWords.some(word => word.length > term.length && word.startsWith(term)));
    if (compoundMatches.length && !titleWords.includes(compoundMatches[0])) { score = Math.min(score, 0.35); matchType = "compound_name_partial"; }
  }
  if (snippetHasExactPhrase && score < 0.75) { score = Math.max(score, 0.55); matchType = "exact_phrase_in_snippet"; }
  return { score, matchType, matchedTerms };
}

function validateAndRankResults(results, query) {
  const terms = searchTerms(query);
  if (!terms.length) throw new Error("Search query must contain at least one usable term");
  const ranked = results
    .map((result, index) => {
      const relevance = scoreSearchResult(result, query);
      return { ...result, relevance: relevance.score, matchType: relevance.matchType, matchedTerms: relevance.matchedTerms, _index: index };
    })
    .filter(result => result.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance || a._index - b._index)
    .map(({ _index, ...result }) => result);
  if (!ranked.length) throw new Error("Search provider returned no relevant results for this query");
  return ranked;
}

function parseDuckDuckGoResults(html) {
  const results = [], seenUrls = new Set();
  const blocks = html.split(/class=["']result(?:\s+results_links)?["']/i);
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    if (/result--ad|ad_provider|ad_domain/i.test(block)) continue;
    const linkMatch = block.match(/class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i) || block.match(/<a[^>]+href=["']([^"']+)["'][^>]+class=["'][^"']*result__a[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;
    let rawUrl = linkMatch[1]; if (rawUrl.startsWith("//")) rawUrl = "https:" + rawUrl;
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

function looksLikeChallenge(html) { return /captcha|robot|unusual traffic|automated|bot detection|challenge/i.test(String(html || "")); }

async function duckduckgo(query) {
  if (!query || query.length > 499) throw new Error("Search query must be between 1 and 499 characters");
  const attempts = [
    { url: "https://html.duckduckgo.com/html/", body: { q: query, b: "" } },
    { url: "https://lite.duckduckgo.com/lite/", body: { q: query } }
  ];
  let lastStatus = null, challengeDetected = false;
  for (const attempt of attempts) {
    const response = await fetch(attempt.url, { method: "POST", headers: { "User-Agent": SEARCH_USER_AGENT, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9", "Content-Type": "application/x-www-form-urlencoded", "Referer": "https://html.duckduckgo.com/" }, body: new URLSearchParams(attempt.body).toString() });
    const html = await response.text(); lastStatus = response.status;
    if (!response.ok) continue;
    if (looksLikeChallenge(html)) { challengeDetected = true; continue; }
    const results = parseDuckDuckGoResults(html);
    if (results.length) return { provider: "duckduckgo", query, results: validateAndRankResults(results, query) };
    if (/result__a|result__snippet|result[_\-]links|no-results/i.test(html)) return { provider: "duckduckgo", query, results: [] };
  }
  if (challengeDetected) throw new Error("DuckDuckGo returned a bot/challenge response; search was not parsed");
  if (lastStatus && lastStatus !== 200) throw new Error(`Search provider returned ${lastStatus}`);
  throw new Error("DuckDuckGo response could not be parsed as a search-results page");
}

function buildSearxSearchUrl(baseUrl, query) {
  const base = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) throw new Error("SearXNG URL must be HTTP or HTTPS");
  const endpoint = /\/search$/i.test(base) ? base : `${base}/search`;
  const url = new URL(endpoint); url.searchParams.set("q", query); url.searchParams.set("format", "json"); url.searchParams.set("language", "en"); url.searchParams.set("categories", "general");
  return url.toString();
}

async function querySearxInstance(instance, query) {
  const response = await fetch(buildSearxSearchUrl(instance, query), { headers: { "User-Agent": SEARCH_USER_AGENT, "Accept": "application/json" } });
  const text = await response.text(); if (!response.ok) throw new Error(`HTTP ${response.status}`);
  let data; try { data = JSON.parse(text); } catch { throw new Error("non-JSON response; JSON API may be disabled"); }
  const seen = new Set();
  const rawResults = (Array.isArray(data.results) ? data.results : []).map(result => ({ title: stripHtml(result.title || ""), url: String(result.url || result.link || ""), snippet: stripHtml(result.content || result.snippet || "") })).filter(result => /^https?:\/\//i.test(result.url) && !seen.has(result.url) && seen.add(result.url)).filter(result => result.title || result.snippet);
  if (!rawResults.length) throw new Error("empty results");
  return validateAndRankResults(rawResults, query);
}

async function searxng(query, env = {}) {
  const primary = String(env.SEARXNG_URL || DEFAULT_SEARXNG_URL).trim();
  const fallback = String(env.SEARXNG_FALLBACK_URL || "").trim();
  const instances = [primary, fallback].filter((value, index, list) => value && list.indexOf(value) === index).slice(0, 2);
  const failures = [], attemptedInstances = [];
  for (const instance of instances) {
    attemptedInstances.push(instance);
    try { const results = await querySearxInstance(instance, query); return { provider: "searxng", instance, query, results, attemptedInstances }; }
    catch (error) { failures.push(`${instance}: ${error.message}`); }
  }
  throw new Error(`All SearXNG instances failed: ${failures.join("; ")}`);
}

async function searchSingle(query, env = {}, requestedProvider = null) {
  const preferred = String(requestedProvider || env.SEARCH_PROVIDER || "auto").trim().toLowerCase();
  if (!["auto", "duckduckgo", "searxng"].includes(preferred)) throw new Error("Invalid search provider; use auto, duckduckgo, or searxng");
  if (preferred === "duckduckgo") return duckduckgo(query);
  if (preferred === "searxng") return searxng(query, env);
  const attempts = [];
  try { const result = await duckduckgo(query); attempts.push("duckduckgo"); return { ...result, attemptedProviders: attempts }; }
  catch (error) { attempts.push(`duckduckgo:error:${error.message}`); }
  const fallback = await searxng(query, env);
  return { ...fallback, attemptedProviders: [...attempts, "searxng"] };
}

async function search(query, env = {}, requestedProvider = null) {
  const variants = buildQueryVariants(query).slice(0, 3);
  if (variants.length === 1) return searchSingle(query, env, requestedProvider);
  const merged = new Map(), attemptedProviders = [], attemptedQueries = [], failures = [];
  for (const variant of variants) {
    try {
      const result = await searchSingle(variant, env, requestedProvider);
      attemptedQueries.push(variant);
      if (result.attemptedProviders) attemptedProviders.push(...result.attemptedProviders);
      for (const item of (result.results || [])) {
        const key = item.url;
        const existing = merged.get(key);
        const relevance = scoreSearchResult(item, query).score;
        const enriched = { ...item, relevance: Math.max(Number(item.relevance || 0), relevance), queryVariant: variant };
        if (!existing || enriched.relevance > existing.relevance) merged.set(key, enriched);
      }
    } catch (error) { failures.push(`${variant}: ${error.message}`); }
  }
  const results = [...merged.values()].sort((a,b)=>b.relevance-a.relevance).slice(0,5);
  if (!results.length) throw new Error(`All name-search variants failed: ${failures.join("; ")}`);
  return { provider: attemptedProviders.includes("searxng") ? "searxng" : "duckduckgo", query, results, attemptedProviders:[...new Set(attemptedProviders)], attemptedQueries, queryVariantCount:variants.length };
}

export async function searchPublic(query, env = {}, requestedProvider = null) { return search(query, env, requestedProvider); }
export { duckduckgo, searxng, DEFAULT_SEARXNG_URL, validateAndRankResults, scoreSearchResult, buildQueryVariants };
