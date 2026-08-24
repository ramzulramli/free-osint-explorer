import { extractEntityCandidates, extractTitle, extractReadableText } from "./index.js";
import { search } from "./search.js";

// Keep recursive investigations comfortably below Cloudflare Worker subrequest limits.
const LIMITS = {
  maxSearchResults: 5,
  maxPages: 3,
  maxEntitiesPerSource: 50,
  maxRankedEntities: 50,
  maxDiscoveries: 25,
  maxDepth: 2,
  maxQueueItems: 5,
  maxSearchRequests: 5,
  maxVisitedQueries: 10
};

const DISCOVERY_TYPES = new Set(["person_candidate", "organisation_candidate", "location_candidate", "email", "phone", "username", "url"]);
const METADATA_TYPES = new Set(["date", "year", "keyword"]);
const PERSON_NOISE_WORDS = new Set(["safety","how","home","watch","channel","video","videos","official","music","news","search","help","about","contact","privacy","policy","facebook","explore","email","password","log","messenger","lite","meta","pay","store","quest","ban","bahasa","indonesia","create","account","settings","login","signup","sign","terms","cookies","download","share"]);
const GENERIC_DISCOVERY_VALUES = new Set(["youtube","facebook","instagram","twitter","x","linkedin","tiktok","wikipedia","google","gmail","meta","facebook explore"]);

function normalize(value) { return String(value || "").replace(/\s+/g, " ").trim().toLowerCase(); }

function isSeedComponent(value, seedQuery) {
  const seedWords = normalize(seedQuery).split(/\s+/).filter(word => word.length >= 3);
  const candidateWords = normalize(value).split(/\s+/).filter(Boolean);
  if (!candidateWords.length || !seedWords.length) return false;
  return candidateWords.every(word => seedWords.includes(word));
}

function isUsefulPerson(entity, seedQuery) {
  const value = normalize(entity.value);
  if (!value || GENERIC_DISCOVERY_VALUES.has(value)) return false;
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length > 4 || value.length > 60) return false;
  if (words.some(word => PERSON_NOISE_WORDS.has(word))) return false;
  return !isSeedComponent(value, seedQuery);
}

function isUsefulDiscovery(entity, seedQuery) {
  const value = normalize(entity.value);
  if (!value || GENERIC_DISCOVERY_VALUES.has(value)) return false;
  if (entity.type === "person_candidate") return isUsefulPerson(entity, seedQuery);
  if (METADATA_TYPES.has(entity.type)) return false;
  if (entity.type === "url") return value.startsWith("http://") || value.startsWith("https://");
  return DISCOVERY_TYPES.has(entity.type);
}

function scoreEntity(entity, seedQuery) {
  const typeWeights = { email:1, phone:.95, username:.95, person_candidate:.85, organisation_candidate:.80, location_candidate:.65, url:.55, date:.35, year:.20, keyword:.15 };
  const confidence = Number(entity.confidence || 0);
  const sourceBoost = Math.min(1, entity.sourceCount / 3);
  const seed = normalize(seedQuery), value = normalize(entity.value);
  const seedMatch = seed && value && seed.includes(value) ? 1 : 0;
  return Number(Math.min(1, confidence*.55 + sourceBoost*.30 + (typeWeights[entity.type] || .25)*.15 + seedMatch*.10).toFixed(4));
}

async function fetchEntities(url) {
  const targetUrl = new URL(url);
  if (!["http:", "https:"].includes(targetUrl.protocol)) throw new Error("Only HTTP and HTTPS URLs are allowed");
  const response = await fetch(targetUrl.toString(), { headers:{ "User-Agent":"Mozilla/5.0 (compatible; FreeOSINTExplorer/0.1)" } });
  if (!response.ok) throw new Error(`Target returned HTTP ${response.status}`);
  const html = await response.text();
  const title = extractTitle(html), text = extractReadableText(html), entities = extractEntityCandidates(text);
  return { title, url:targetUrl.toString(), httpStatus:response.status, textLength:text.length, entities };
}

function addEntityToMap(entityMap, entity, source) {
  if (!entity?.type || !entity?.normalized) return;
  const key = `${entity.type}:${normalize(entity.normalized)}`;
  const existing = entityMap.get(key);
  if (existing) {
    if (!existing.sources.some(ref => ref.url === source.url)) { existing.sourceCount += 1; existing.sources.push({ title:source.title, url:source.url }); }
    existing.confidence = Math.max(existing.confidence, Number(entity.confidence || 0));
    return;
  }
  entityMap.set(key, { type:entity.type, value:entity.value, normalized:entity.normalized, confidence:Number(entity.confidence || 0), sourceCount:1, sources:[{ title:source.title, url:source.url }] });
}

async function investigateQuery(query, depth, state, env, requestedProvider) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery || state.visitedQueries.has(normalizedQuery) || state.searchRequests >= LIMITS.maxSearchRequests) return null;
  state.visitedQueries.add(normalizedQuery);
  state.searchRequests += 1;

  const searchData = await search(query, env, requestedProvider);
  const searchResults = Array.isArray(searchData.results) ? searchData.results.slice(0, LIMITS.maxSearchResults) : [];
  const pages = [], failedSources = [], entityMap = new Map();

  for (const result of searchResults.slice(0, LIMITS.maxPages)) {
    const resultSource = { title:result.title || "Search result", url:result.url };
    const resultText = `${result.title || ""}. ${result.snippet || ""}`.trim();
    if (resultText) {
      for (const entity of extractEntityCandidates(resultText).slice(0, LIMITS.maxEntitiesPerSource)) addEntityToMap(entityMap, entity, resultSource);
    }

    state.pagesProcessed += 1;
    try {
      const entityData = await fetchEntities(result.url);
      const source = { title:entityData.title || result.title || "", url:result.url, httpStatus:entityData.httpStatus, textLength:entityData.textLength || 0, entityCount:entityData.entities.length };
      pages.push(source);
      for (const entity of entityData.entities.slice(0, LIMITS.maxEntitiesPerSource)) addEntityToMap(entityMap, entity, source);
    } catch (error) {
      failedSources.push({ title:result.title || "", url:result.url, reason:error.message || "Unknown source error" });
    }
  }

  const allEntities = [...entityMap.values()].map(entity => ({ ...entity, score:scoreEntity(entity, query) }));
  const rankedEntities = allEntities.sort((a,b) => b.score-a.score || b.sourceCount-a.sourceCount || b.confidence-a.confidence).slice(0, LIMITS.maxRankedEntities);
  const discoveries = rankedEntities.filter(entity => isUsefulDiscovery(entity, query)).map(entity => ({ type:entity.type, value:entity.value, normalized:entity.normalized, confidence:entity.confidence, score:entity.score, sourceCount:entity.sourceCount, sources:entity.sources })).slice(0, LIMITS.maxDiscoveries);
  const metadata = allEntities.filter(entity => METADATA_TYPES.has(entity.type)).sort((a,b) => b.score-a.score).slice(0, LIMITS.maxRankedEntities);

  return { query, depth, search:{ provider:searchData.provider, instance:searchData.instance, attemptedProviders:searchData.attemptedProviders || [searchData.provider], attemptedInstances:searchData.attemptedInstances || [], resultCount:searchData.results.length, processedCount:searchResults.length }, sources:{ successful:pages, failed:failedSources, successfulCount:pages.length, failedCount:failedSources.length }, entities:rankedEntities, discoveries, metadata };
}

async function investigate(request, env) {
  const url = new URL(request.url), query = url.searchParams.get("q")?.trim();
  if (!query) return Response.json({ status:"error", error:"Missing search query", usage:"/investigate?q=keyword" }, { status:400 });
  const requestedDepth = Number.parseInt(url.searchParams.get("depth") || "0",10);
  const depth = Number.isFinite(requestedDepth) ? Math.max(0,Math.min(LIMITS.maxDepth,requestedDepth)) : 0;
  const requestedProvider = url.searchParams.get("provider")?.trim().toLowerCase() || null;
  const startedAt = Date.now();
  const state = { visitedQueries:new Set(), searchRequests:0, pagesProcessed:0 };
  const queue = [{ query, depth:0, parent:null }], investigations = [], queued = new Set([normalize(query)]);

  try {
    while (queue.length && investigations.length < LIMITS.maxQueueItems && state.searchRequests < LIMITS.maxSearchRequests) {
      const item = queue.shift();
      const result = await investigateQuery(item.query,item.depth,state,env,requestedProvider);
      if (!result) continue;
      investigations.push({ ...result, parent:item.parent });
      if (item.depth >= depth) continue;
      for (const discovery of result.discoveries) {
        if (queue.length >= LIMITS.maxQueueItems || state.searchRequests + queue.length >= LIMITS.maxSearchRequests) break;
        const normalizedNext = normalize(discovery.value);
        if (!normalizedNext || queued.has(normalizedNext) || state.visitedQueries.has(normalizedNext)) continue;
        queued.add(normalizedNext);
        queue.push({ query:discovery.value, depth:item.depth+1, parent:result.query });
      }
    }

    const root = investigations[0] || null;
    const uniqueDiscoveryMap = new Map();
    for (const item of investigations) for (const discovery of item.discoveries) {
      const key = `${discovery.type}:${normalize(discovery.normalized || discovery.value)}`;
      const existing = uniqueDiscoveryMap.get(key);
      if (!existing || discovery.score > existing.score) uniqueDiscoveryMap.set(key,{ ...discovery, depth:item.depth, discoveredFrom:item.query });
    }

    return Response.json({ status:"success", query, limits:LIMITS, depth, providerRequested:requestedProvider || env.SEARCH_PROVIDER || "auto", search:root?.search || { provider:"none", attemptedProviders:[], attemptedInstances:[], resultCount:0, processedCount:0 }, sources:root?.sources || { successful:[], failed:[], successfulCount:0, failedCount:0 }, entityCount:root?.entities?.length || 0, entities:root?.entities || [], discoveryCount:uniqueDiscoveryMap.size, discoveries:[...uniqueDiscoveryMap.values()].sort((a,b)=>b.score-a.score).slice(0,LIMITS.maxDiscoveries), metadata:root?.metadata || [], queue:{ requestedDepth:depth, investigationsRun:investigations.length, searchRequests:state.searchRequests, pagesProcessed:state.pagesProcessed, queuedRemaining:queue.length, visitedQueries:[...state.visitedQueries] }, investigations:investigations.slice(0,LIMITS.maxQueueItems), timing:{ durationMs:Date.now()-startedAt } });
  } catch (error) {
    return Response.json({ status:"error", message:error.message, query, providerRequested:requestedProvider || env.SEARCH_PROVIDER || "auto" },{ status:502 });
  }
}

export default { async fetch(request,env,ctx) {
  const url = new URL(request.url);
  if (url.pathname === "/search") {
    const query = url.searchParams.get("q")?.trim();
    if (!query) return Response.json({ status:"error", error:"Missing search query", usage:"/search?q=keyword" },{ status:400 });
    try { return Response.json({ status:"success", ...(await search(query,env,url.searchParams.get("provider")?.trim().toLowerCase() || null)) }); }
    catch (error) { return Response.json({ status:"error", message:error.message },{ status:502 }); }
  }
  if (url.pathname === "/investigate") return investigate(request,env);
  return import("./index.js").then(module => module.default.fetch(request,env,ctx));
} };
