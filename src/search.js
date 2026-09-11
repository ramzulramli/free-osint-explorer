const SEARCH_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
const DEFAULT_SEARXNG_URL = "https://search.mectov.my.id";

function stripHtml(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
function normalize(value) {
  return String(value || "").toLowerCase().replace(/https?:\/\/[^\s]+/g, " ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
function terms(q) { return [...new Set(normalize(q).split(" ").filter(x => x.length >= 2))]; }
function isNameLike(q) { const t = terms(q); return t.length >= 2 && t.length <= 5 && t.every(x => /^[a-z]+$/.test(x)); }

function buildQueryVariants(q) {
  q = String(q || "").trim();
  if (!isNameLike(q)) return [q];
  const p = q.split(/\s+/).filter(Boolean), out = [q, `"${q}"`];
  const hasBin = /\b(bin|binti)\b/i.test(q);
  if (p.length === 2 && !hasBin) {
    out.push(`"${p[0]} bin ${p[1]}"`, `"${p[0]} b. ${p[1]}"`, `"${p[1]} ${p[0]}"`);
  } else if (p.length >= 3) {
    const compact = p.filter(x => !/^binti?$/i.test(x));
    if (compact.length >= 2 && compact.length < p.length) out.push(`"${compact.join(" ")}"`);
    if (!hasBin) { out.push(`"${p[0]} bin ${p.at(-1)}"`, `"${p[0]} binti ${p.at(-1)}"`); }
  }
  return [...new Set(out)].slice(0, 5);
}

function score(r, q) {
  const t = terms(q), title = normalize(r.title), snippet = normalize(r.snippet), tw = title.split(" "), sw = snippet.split(" ");
  const exact = title.includes(normalize(q)), tm = t.filter(x => tw.includes(x)).length, sm = t.filter(x => !tw.includes(x) && sw.includes(x)).length;
  let s = tm * .35 + sm * .1, type = "partial";
  if (exact) { s = 1; type = "exact_phrase"; }
  else if (tm === t.length) { s = .9; type = "all_terms_in_title"; }
  else if (tm && sm) { s = .65; type = "split_name"; }
  else if (tm) { s = .45; type = "partial_title"; }
  else if (sm) { s = .2; type = "snippet_only"; }
  if (isNameLike(q) && !exact && tw.some(w => t.some(x => w.startsWith(x) && w.length > x.length))) { s = Math.min(s, .35); type = "compound_name_partial"; }
  if (snippet.includes(normalize(q)) && s < .75) { s = Math.max(s, .55); type = "exact_phrase_in_snippet"; }
  return { score: s, matchType: type, matchedTerms: t.filter(x => tw.includes(x) || sw.includes(x)) };
}
function rank(results, q) {
  return results.map((r, i) => { const x = score(r, q); return { ...r, relevance: x.score, matchType: x.matchType, matchedTerms: x.matchedTerms, _i: i }; })
    .filter(x => x.relevance > 0).sort((a, b) => b.relevance - a.relevance || a._i - b._i).map(({ _i, ...r }) => r);
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
    try {
      const parsed = new URL(rawUrl), destination = parsed.searchParams.get("uddg");
      finalUrl = destination ? decodeURIComponent(destination) : parsed.toString();
    } catch { continue; }
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

async function fetchDuckPage(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "User-Agent": SEARCH_USER_AGENT,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Content-Type": "application/x-www-form-urlencoded",
      "Referer": "https://html.duckduckgo.com/",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin"
    },
    body: new URLSearchParams(body).toString()
  });
  return { response, html: await response.text() };
}

async function duckduckgo(query) {
  if (!query || query.length > 499) throw new Error("Search query must be between 1 and 499 characters");
  const attempts = [
    { url: "https://html.duckduckgo.com/html/", body: { q: query, b: "" } },
    { url: "https://lite.duckduckgo.com/lite/", body: { q: query } }
  ];
  let lastStatus = null, challengeDetected = false;
  for (const attempt of attempts) {
    const { response, html } = await fetchDuckPage(attempt.url, attempt.body);
    lastStatus = response.status;
    if (!response.ok) continue;
    if (looksLikeChallenge(html)) { challengeDetected = true; continue; }
    const results = parseDuckDuckGoResults(html);
    if (results.length) return { provider: "duckduckgo", query, results: rank(results, query) };
    if (/result__a|result__snippet|result[_\-]links|no-results/i.test(html)) return { provider: "duckduckgo", query, results: [] };
  }
  if (challengeDetected) throw new Error("DuckDuckGo returned a bot/challenge response; search was not parsed");
  if (lastStatus && lastStatus !== 200) throw new Error(`Search provider returned ${lastStatus}`);
  throw new Error("DuckDuckGo response could not be parsed as a search-results page");
}

function searxUrl(base, q, categories = "general") {
  const u = new URL(String(base || DEFAULT_SEARXNG_URL).replace(/\/+$/, ""));
  u.pathname = u.pathname.replace(/\/$/, "") + "/search";
  u.searchParams.set("q", q); u.searchParams.set("format", "json"); u.searchParams.set("language", "en"); u.searchParams.set("categories", categories);
  return u;
}
async function searxng(q, env = {}) {
  const instances = [env.SEARXNG_URL || DEFAULT_SEARXNG_URL, env.SEARXNG_FALLBACK_URL].filter(Boolean);
  let last = "";
  for (const instance of [...new Set(instances)].slice(0, 2)) {
    try {
      const r = await fetch(searxUrl(instance, q), { headers: { "User-Agent": SEARCH_USER_AGENT, "Accept": "application/json" } });
      const text = await r.text(); if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = JSON.parse(text);
      const raw = (data.results || []).map(x => ({ title: stripHtml(x.title), url: String(x.url || x.link || ""), snippet: stripHtml(x.content || x.snippet || "") })).filter(x => /^https?:\/\//i.test(x.url));
      const results = rank(raw, q); if (results.length) return { provider: "searxng", instance, query: q, results };
      last = `${instance}: empty results`;
    } catch (e) { last = `${instance}: ${e.message}`; }
  }
  throw new Error(`SearXNG failed: ${last}`);
}

async function imageSearch(query, env = {}, limit = 10) {
  const q = String(query || "").trim(); if (!q) throw new Error("Missing image search query");
  const instances = [env.SEARXNG_URL || DEFAULT_SEARXNG_URL, env.SEARXNG_FALLBACK_URL].filter(Boolean);
  let last = "";
  for (const instance of [...new Set(instances)].slice(0, 2)) {
    try {
      const r = await fetch(searxUrl(instance, q, "images"), { headers: { "User-Agent": SEARCH_USER_AGENT, "Accept": "application/json" } });
      const data = JSON.parse(await r.text()); if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const results = (data.results || []).map(x => ({ title: stripHtml(x.title) || "Image result", url: String(x.img_src || x.url || ""), thumbnail: String(x.thumbnail_src || x.thumbnail || x.img_src || ""), sourceUrl: String(x.url || x.img_src || ""), source: String(x.source || ""), snippet: stripHtml(x.content || "") })).filter(x => /^https?:\/\//i.test(x.url));
      if (results.length) return { provider: "searxng-images", instance, query: q, results: results.slice(0, Math.max(1, Math.min(10, limit))) };
      last = `${instance}: empty image results`;
    } catch (e) { last = `${instance}: ${e.message}`; }
  }
  throw new Error(`Image search failed: ${last}`);
}

async function searchSingle(q, env = {}, provider = null) {
  const p = String(provider || env.SEARCH_PROVIDER || "auto").toLowerCase();
  if (p === "duckduckgo") return duckduckgo(q);
  if (p === "searxng") return searxng(q, env);
  try { return { ...(await duckduckgo(q)), attemptedProviders: ["duckduckgo"] }; }
  catch (e) { const r = await searxng(q, env); return { ...r, attemptedProviders: ["duckduckgo:error:" + e.message, "searxng"] }; }
}

async function search(query, env = {}, requestedProvider = null) {
  const variants = buildQueryVariants(query);
  if (variants.length === 1) return searchSingle(query, env, requestedProvider);
  const merged = new Map(), attemptedQueries = [], attemptedProviders = [];
  for (const q of variants) {
    try {
      const r = await searchSingle(q, env, requestedProvider); attemptedQueries.push(q);
      if (r.attemptedProviders) attemptedProviders.push(...r.attemptedProviders);
      for (const item of r.results || []) {
        const relevance = score(item, query).score, value = { ...item, relevance: Math.max(item.relevance || 0, relevance), queryVariant: q }, old = merged.get(item.url);
        if (!old || value.relevance > old.relevance) merged.set(item.url, value);
      }
    } catch (e) { attemptedQueries.push(q); attemptedProviders.push(`variant:error:${e.message}`); }
  }
  const results = [...merged.values()].sort((a, b) => b.relevance - a.relevance).slice(0, 5);
  if (!results.length) throw new Error("All search variants failed");
  return { provider: attemptedProviders.includes("searxng") ? "searxng" : "duckduckgo", query, results, attemptedProviders: [...new Set(attemptedProviders)], attemptedQueries, queryVariantCount: variants.length };
}

export { search, duckduckgo, searxng, imageSearch, DEFAULT_SEARXNG_URL, buildQueryVariants };