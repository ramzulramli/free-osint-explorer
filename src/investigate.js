import { extractEntityCandidates, extractTitle, extractReadableText } from "./index.js";
import { search } from "./search.js";

const LIMITS = {
  maxSearchResults: 5,
  maxPages: 5,
  maxEntitiesPerSource: 50,
  maxRankedEntities: 50,
  maxDiscoveries: 25,
  maxDepth: 2,
  maxQueueItems: 5,
  maxSearchRequests: 5,
  maxVisitedQueries: 10
};

const PROFILE_HOSTS = new Map([
  ["linkedin.com", "LinkedIn"], ["my.linkedin.com", "LinkedIn"],
  ["shutterstock.com", "Shutterstock"], ["www.shutterstock.com", "Shutterstock"],
  ["facebook.com", "Facebook"], ["www.facebook.com", "Facebook"],
  ["instagram.com", "Instagram"], ["www.instagram.com", "Instagram"],
  ["x.com", "X"], ["twitter.com", "X"],
  ["tiktok.com", "TikTok"], ["www.tiktok.com", "TikTok"],
  ["youtube.com", "YouTube"], ["www.youtube.com", "YouTube"]
]);

function normalize(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function isPerson(entity, seed) {
  if (entity?.type !== "person_candidate") return false;
  const value = normalize(entity.value);
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5 || value.length > 80) return false;
  const seedWords = new Set(normalize(seed).split(/\s+/));
  return words.some(w => !seedWords.has(w));
}

function accountFromUrl(url, title = "") {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const platform = PROFILE_HOSTS.get(host);
    if (!platform) return null;
    const path = u.pathname.replace(/^\/+|\/+$/g, "");
    let username = null;
    if (platform === "LinkedIn") username = path.match(/^in\/([^/]+)/i)?.[1] || null;
    else if (platform === "Shutterstock") username = path.match(/^g\/([^/]+)/i)?.[1] || null;
    else if (platform === "YouTube") username = path.match(/^@?([^/]+)/i)?.[1] || path.match(/^(?:channel|user)\/([^/]+)/i)?.[1] || null;
    else username = path.split("/")[0] || null;
    if (!username) return null;
    username = username.replace(/^@/, "");
    return {
      type: "account",
      platform,
      username,
      value: `${platform}: ${username}`,
      normalized: normalize(`${platform}:${username}`),
      confidence: 0.75,
      url: u.toString(),
      title
    };
  } catch { return null; }
}

function add(map, entity, source, evidence = false) {
  if (!entity?.type || !entity?.normalized) return;
  const key = `${entity.type}:${normalize(entity.normalized)}`;
  let item = map.get(key);
  if (!item) {
    item = {
      type: entity.type,
      value: entity.value,
      normalized: entity.normalized,
      confidence: Number(entity.confidence || 0),
      platform: entity.platform || null,
      username: entity.username || null,
      sourceCount: 0,
      evidenceCount: 0,
      sources: []
    };
    map.set(key, item);
  }
  item.confidence = Math.max(item.confidence, Number(entity.confidence || 0));
  if (!item.sources.some(s => s.url === source.url)) {
    item.sourceCount += 1;
    item.sources.push({
      title: source.title || "",
      url: source.url,
      evidence: Boolean(evidence),
      httpStatus: source.httpStatus ?? null,
      textLength: source.textLength ?? 0
    });
    if (evidence) item.evidenceCount += 1;
  } else if (evidence) {
    const ref = item.sources.find(s => s.url === source.url);
    if (ref) ref.evidence = true;
  }
}

function score(entity, seed) {
  const weights = { account: 1, email: 1, phone: .95, username: .9, person_candidate: .85, organisation_candidate: .8, location_candidate: .65 };
  const sourceBoost = Math.min(1, entity.sourceCount / 3);
  const evidenceBoost = Math.min(1, entity.evidenceCount / 3);
  const exact = normalize(entity.value) === normalize(seed) ? 1 : 0;
  return Number(Math.min(1, Number(entity.confidence || 0) * .5 + sourceBoost * .2 + evidenceBoost * .2 + (weights[entity.type] || .25) * .1 + exact * .1).toFixed(4));
}

function extractSearchEntities(result) {
  const title = String(result.title || "").trim();
  const snippet = String(result.snippet || "").trim();
  const entities = extractEntityCandidates(`${title}. ${snippet}`);
  const account = accountFromUrl(result.url, title);
  if (account) entities.push(account);

  // LinkedIn search titles commonly contain "Person - Company | LinkedIn".
  if (/\blinkedin\b/i.test(title)) {
    const m = title.match(/\s[-–—]\s+([^|]+?)\s*\|\s*LinkedIn/i);
    if (m?.[1]) {
      const org = m[1].replace(/\s+/g, " ").trim();
      if (org.length >= 2 && org.length <= 100) {
        entities.push({ type: "organisation_candidate", value: org, normalized: normalize(org), confidence: .78 });
      }
    }
  }
  return entities;
}

async function fetchPage(url) {
  try {
    const target = new URL(url);
    if (!["http:", "https:"].includes(target.protocol)) throw new Error("Only HTTP/HTTPS URLs are allowed");
    const response = await fetch(target.toString(), { headers: { "User-Agent": "Mozilla/5.0 (compatible; FreeOSINTExplorer/0.8)" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const text = extractReadableText(html);
    return {
      ok: true,
      title: extractTitle(html),
      url: target.toString(),
      httpStatus: response.status,
      textLength: text.length,
      entities: extractEntityCandidates(text),
      account: accountFromUrl(target.toString(), extractTitle(html))
    };
  } catch (error) {
    return { ok: false, url, error: error.message || "Fetch failed" };
  }
}

function buildPivotQueries(subject, accounts, organisations) {
  const queries = [];
  const seen = new Set();
  const push = q => {
    const n = normalize(q);
    if (!n || seen.has(n)) return;
    seen.add(n); queries.push(q);
  };

  // High-value pivots first: discovered accounts, then employment/org context.
  for (const account of accounts.slice(0, 3)) {
    push(`"${subject}" ${account.platform}`);
    if (account.platform === "LinkedIn") push(`site:linkedin.com/in "${subject}"`);
    if (account.platform === "Shutterstock") push(`site:shutterstock.com/g/ "${account.username}"`);
  }
  for (const org of organisations.slice(0, 2)) push(`"${subject}" "${org.value}"`);
  return queries.slice(0, LIMITS.maxQueueItems);
}

async function investigateQuery(query, state, env, provider, depth, { fatal = false } = {}) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery || state.visited.has(normalizedQuery) || state.searchRequests >= LIMITS.maxSearchRequests) return null;
  state.visited.add(normalizedQuery);
  state.searchRequests += 1;

  let searchData;
  try {
    searchData = await search(query, env, provider);
  } catch (error) {
    if (fatal) throw error;
    state.skippedSearches.push({ query, depth, reason: error.message || "Search failed" });
    return null;
  }

  const results = Array.isArray(searchData.results) ? searchData.results.slice(0, LIMITS.maxSearchResults) : [];
  const entityMap = new Map();
  const successful = [];
  const failed = [];

  for (const result of results) {
    const source = { title: result.title || "Search result", url: result.url, httpStatus: null, textLength: 0 };
    for (const entity of extractSearchEntities(result).slice(0, LIMITS.maxEntitiesPerSource)) add(entityMap, entity, source, true);
  }

  for (const result of results.slice(0, LIMITS.maxPages)) {
    state.pagesRead += 1;
    const page = await fetchPage(result.url);
    if (!page.ok) {
      failed.push({ title: result.title || "", url: result.url, reason: page.error });
      continue;
    }
    const source = { title: page.title || result.title || "", url: page.url, httpStatus: page.httpStatus, textLength: page.textLength };
    successful.push(source);
    const evidence = page.textLength > 0 && page.entities.length > 0;
    for (const entity of page.entities.slice(0, LIMITS.maxEntitiesPerSource)) add(entityMap, entity, source, evidence);
    if (page.account) add(entityMap, page.account, source, evidence);
  }

  const entities = [...entityMap.values()].map(e => ({ ...e, score: score(e, state.subject) }))
    .sort((a, b) => b.score - a.score || b.evidenceCount - a.evidenceCount || b.sourceCount - a.sourceCount)
    .slice(0, LIMITS.maxRankedEntities);

  return {
    query,
    depth,
    search: {
      provider: searchData.provider,
      instance: searchData.instance,
      attemptedProviders: searchData.attemptedProviders || [searchData.provider],
      attemptedInstances: searchData.attemptedInstances || [],
      resultCount: searchData.results?.length || 0,
      processedCount: results.length
    },
    sources: { successful, failed, successfulCount: successful.length, failedCount: failed.length },
    entities
  };
}

function report(investigations, state, query, depth, startedAt) {
  const people = new Map(), organisations = new Map(), locations = new Map(), accounts = new Map(), evidence = [];
  const allSources = new Map();
  const addCompact = (map, e, extra = {}) => {
    const key = `${e.type}:${e.normalized}`;
    if (!map.has(key)) map.set(key, { ...extra, value: e.value, score: e.score, sources: e.sourceCount });
  };

  for (const inv of investigations) {
    for (const source of inv.sources.successful) allSources.set(source.url, source);
    for (const e of inv.entities) {
      if (!e.evidenceCount) continue;
      if (e.type === "person_candidate" && isPerson(e, query)) addCompact(people, e);
      else if (e.type === "organisation_candidate") addCompact(organisations, e);
      else if (e.type === "location_candidate") addCompact(locations, e);
      else if (e.type === "account") addCompact(accounts, e, { type: "profile", platform: e.platform, username: e.username, url: e.sources?.[0]?.url });
      else if (["username", "email", "phone"].includes(e.type)) addCompact(accounts, e, { type: e.type });

      if (["person_candidate", "organisation_candidate", "location_candidate", "account", "username", "email", "phone"].includes(e.type)) {
        evidence.push({ type: e.type, value: e.value, score: e.score, sources: e.sources.filter(s => s.evidence).slice(0, 3).map(s => ({ title: s.title, url: s.url })) });
      }
    }
  }

  const sort = map => [...map.values()].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 10);
  const topPerson = sort(people)[0];
  return {
    status: "success",
    query,
    subject: state.subject || topPerson?.value || query,
    confidence: topPerson?.score || 0,
    summary: { people: sort(people), organisations: sort(organisations), locations: sort(locations), accounts: sort(accounts) },
    evidence: evidence.slice(0, 20),
    sources: [...allSources.values()].map(s => ({ title: s.title, url: s.url, status: s.httpStatus, textLength: s.textLength })),
    stats: { searchResults: investigations[0]?.search?.resultCount || 0, pagesRead: state.pagesRead, investigations: investigations.length, evidenceItems: evidence.length, searchRequests: state.searchRequests, skippedSearches: state.skippedSearches.length, durationMs: Date.now() - startedAt },
    skippedSearches: state.skippedSearches,
    limits: LIMITS,
    depth
  };
}

async function investigate(request, env) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim();
  if (!query) return Response.json({ status: "error", error: "Missing search query", usage: "/investigate?q=keyword" }, { status: 400 });

  const requestedDepth = Number.parseInt(url.searchParams.get("depth") || "1", 10);
  const depth = Number.isFinite(requestedDepth) ? Math.max(0, Math.min(LIMITS.maxDepth, requestedDepth)) : 1;
  const provider = url.searchParams.get("provider")?.trim().toLowerCase() || null;
  const startedAt = Date.now();
  const state = { visited: new Set(), searchRequests: 0, pagesRead: 0, subject: query, skippedSearches: [] };
  const investigations = [];

  const root = await investigateQuery(query, state, env, provider, 0, { fatal: true });
  if (root) investigations.push(root);

  // Automatically pivot from discovered accounts / organisation relationships.
  if (depth > 0 && root && state.searchRequests < LIMITS.maxSearchRequests) {
    const accountEntities = root.entities.filter(e => e.type === "account" && e.username);
    const organisationEntities = root.entities.filter(e => e.type === "organisation_candidate");
    const person = root.entities.find(e => e.type === "person_candidate" && normalize(e.value) === normalize(query))
      || root.entities.find(e => e.type === "person_candidate");
    if (person) state.subject = person.value;

    const pivots = buildPivotQueries(state.subject, accountEntities, organisationEntities);
    for (const pivot of pivots) {
      if (state.searchRequests >= LIMITS.maxSearchRequests) break;
      const inv = await investigateQuery(pivot, state, env, provider, 1);
      if (inv) investigations.push(inv);
    }
  }

  return report(investigations, state, query, depth, startedAt);
}

export { investigate };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/") return Response.json({ name: "Free OSINT Explorer", status: "online", version: "0.8.0", endpoints: ["/search", "/investigate"] });

    if (url.pathname === "/search") {
      const query = url.searchParams.get("q")?.trim();
      if (!query) return Response.json({ status: "error", error: "Missing search query", usage: "/search?q=keyword" }, { status: 400 });
      try {
        return Response.json({ status: "success", ...(await search(query, env, url.searchParams.get("provider")?.trim().toLowerCase() || null)) });
      } catch (error) {
        return Response.json({ status: "error", message: error.message }, { status: 502 });
      }
    }

    if (url.pathname === "/investigate") {
      try { return Response.json(await investigate(request, env)); }
      catch (error) { return Response.json({ status: "error", message: error.message || "Investigation failed" }); }
    }

    return Response.json({ status: "error", error: "Not found" }, { status: 404 });
  }
};