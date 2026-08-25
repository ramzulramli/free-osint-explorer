import { extractEntityCandidates, extractTitle, extractReadableText } from "./index.js";
import { search } from "./search.js";

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
const PERSON_NOISE_WORDS = new Set(["safety","how","home","watch","channel","video","videos","official","music","news","search","help","about","contact","privacy","policy","facebook","explore","email","password","log","messenger","lite","meta","pay","store","quest","ban","bahasa","indonesia","create","account","settings","login","signup","sign","terms","cookies","download","share","certification","certified","tester","testing","number","member","board","software","malaysian","malaysia","profile","collection","collections","stock","image","images","photo","photos"]);
const GENERIC_DISCOVERY_VALUES = new Set(["youtube","facebook","instagram","twitter","x","linkedin","tiktok","wikipedia","google","gmail","meta","facebook explore"]);

function normalize(value) { return String(value || "").replace(/\s+/g, " ").trim().toLowerCase(); }
function isSeedComponent(value, seedQuery) {
  const seedWords = normalize(seedQuery).split(/\s+/).filter(word => word.length >= 3);
  const candidateWords = normalize(value).split(/\s+/).filter(Boolean);
  if (!candidateWords.length || !seedWords.length) return false;
  return candidateWords.every(word => seedWords.includes(word));
}
function isUsefulPerson(entity, seedQuery) {
  const raw = String(entity.value || "").replace(/\s+/g, " ").trim();
  const value = normalize(raw);
  if (!value || GENERIC_DISCOVERY_VALUES.has(value)) return false;
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4 || value.length > 60) return false;
  if (words.some(word => PERSON_NOISE_WORDS.has(normalize(word).replace(/[^a-z-]/g, "")))) return false;
  if (!words.every(word => /^[\p{L}.'-]+$/u.test(word))) return false;
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
  const typeWeights = { email:1, phone:.95, username:.95, person_candidate:.85, organisation_candidate:.80, location_candidate:.65, url:.55 };
  const confidence = Number(entity.confidence || 0);
  const sourceBoost = Math.min(1, entity.sourceCount / 3);
  const evidenceBoost = Math.min(1, (entity.evidenceCount || 0) / 3);
  const seed = normalize(seedQuery), value = normalize(entity.value);
  const seedMatch = seed && value && seed.includes(value) ? 1 : 0;
  return Number(Math.min(1, confidence*.50 + sourceBoost*.20 + evidenceBoost*.20 + (typeWeights[entity.type] || .25)*.10 + seedMatch*.10).toFixed(4));
}

async function fetchEntities(url) {
  const targetUrl = new URL(url);
  if (!["http:", "https:"].includes(targetUrl.protocol)) throw new Error("Only HTTP and HTTPS URLs are allowed");
  const response = await fetch(targetUrl.toString(), { headers:{ "User-Agent":"Mozilla/5.0 (compatible; FreeOSINTExplorer/0.6)" } });
  if (!response.ok) throw new Error(`Target returned HTTP ${response.status}`);
  const html = await response.text();
  const title = extractTitle(html), text = extractReadableText(html), entities = extractEntityCandidates(text);
  return { title, url:targetUrl.toString(), httpStatus:response.status, textLength:text.length, entities };
}

function addEntityToMap(entityMap, entity, source, isEvidence = false) {
  if (!entity?.type || !entity?.normalized) return;
  const key = `${entity.type}:${normalize(entity.normalized)}`;
  const existing = entityMap.get(key);
  if (existing) {
    const sourceRef = existing.sources.find(ref => ref.url === source.url);
    if (sourceRef) {
      if (isEvidence) sourceRef.evidence = true;
      if (source.httpStatus != null) sourceRef.httpStatus = source.httpStatus;
      if (source.textLength > 0) sourceRef.textLength = source.textLength;
      if (isEvidence && !existing.evidenceUrls.has(source.url)) { existing.evidenceCount += 1; existing.evidenceUrls.add(source.url); }
    } else {
      existing.sourceCount += 1;
      existing.sources.push({ title:source.title, url:source.url, evidence:Boolean(isEvidence), httpStatus:source.httpStatus ?? null, textLength:source.textLength ?? 0 });
      if (isEvidence && !existing.evidenceUrls.has(source.url)) { existing.evidenceCount += 1; existing.evidenceUrls.add(source.url); }
    }
    existing.confidence = Math.max(existing.confidence, Number(entity.confidence || 0));
    return;
  }
  entityMap.set(key, { type:entity.type, value:entity.value, normalized:entity.normalized, confidence:Number(entity.confidence || 0), sourceCount:1, evidenceCount:isEvidence ? 1 : 0, evidenceUrls:new Set(isEvidence ? [source.url] : []), sources:[{ title:source.title, url:source.url, evidence:Boolean(isEvidence), httpStatus:source.httpStatus ?? null, textLength:source.textLength ?? 0 }] });
}
function serializeEntity(entity, seedQuery) {
  const { evidenceUrls, ...safeEntity } = entity;
  return { ...safeEntity, score:scoreEntity(entity, seedQuery) };
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
    const resultSource = { title:result.title || "Search result", url:result.url, httpStatus:null, textLength:0 };
    const resultText = `${result.title || ""}. ${result.snippet || ""}`.trim();
    if (resultText) for (const entity of extractEntityCandidates(resultText).slice(0, LIMITS.maxEntitiesPerSource)) addEntityToMap(entityMap, entity, resultSource, false);
    state.pagesProcessed += 1;
    try {
      const entityData = await fetchEntities(result.url);
      const source = { title:entityData.title || result.title || "", url:result.url, httpStatus:entityData.httpStatus, textLength:entityData.textLength || 0, entityCount:entityData.entities.length };
      pages.push(source);
      const isEvidence = entityData.textLength > 0 && entityData.entities.length > 0;
      for (const entity of entityData.entities.slice(0, LIMITS.maxEntitiesPerSource)) addEntityToMap(entityMap, entity, source, isEvidence);
    } catch (error) { failedSources.push({ title:result.title || "", url:result.url, reason:error.message || "Unknown source error" }); }
  }
  const allEntities = [...entityMap.values()].map(entity => serializeEntity(entity, query));
  const rankedEntities = allEntities.sort((a,b) => b.score-a.score || b.evidenceCount-a.evidenceCount || b.sourceCount-a.sourceCount || b.confidence-a.confidence).slice(0, LIMITS.maxRankedEntities);
  const discoveries = rankedEntities.filter(entity => isUsefulDiscovery(entity, query)).map(entity => ({ type:entity.type, value:entity.value, normalized:entity.normalized, confidence:entity.confidence, score:entity.score, sourceCount:entity.sourceCount, evidenceCount:entity.evidenceCount, sources:entity.sources })).slice(0, LIMITS.maxDiscoveries);
  const metadata = allEntities.filter(entity => METADATA_TYPES.has(entity.type)).sort((a,b) => b.score-a.score).slice(0, LIMITS.maxRankedEntities);
  return { query, depth, search:{ provider:searchData.provider, instance:searchData.instance, attemptedProviders:searchData.attemptedProviders || [searchData.provider], attemptedInstances:searchData.attemptedInstances || [], resultCount:searchData.results.length, processedCount:searchResults.length }, sources:{ successful:pages, failed:failedSources, successfulCount:pages.length, failedCount:failedSources.length }, entities:rankedEntities, discoveries, metadata };
}

function buildReport(investigations, query, state, depth, startedAt) {
  const root = investigations[0] || null;
  const people = [], organisations = [], locations = [], accounts = [], evidence = [];
  const seen = new Set();
  const allSources = new Map();
  for (const item of investigations) {
    for (const source of item.sources?.successful || []) allSources.set(source.url, source);
    for (const e of item.entities || []) {
      if (!e.evidenceCount) continue;
      const key = `${e.type}:${e.normalized}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const compact = { value:e.value, score:e.score, sources:e.sourceCount };
      if (e.type === "person_candidate" && isUsefulPerson(e, query)) people.push(compact);
      else if (e.type === "organisation_candidate") organisations.push(compact);
      else if (e.type === "location_candidate") locations.push(compact);
      else if (["username","email","phone"].includes(e.type)) accounts.push({ type:e.type, ...compact });

      // Only promote person candidates that pass the same quality filter used by discoveries.
      // This prevents page labels such as "Certified Tester" and "Certification Number"
      // from leaking into the public-facing evidence section.
      const usefulForEvidence = e.type !== "person_candidate" || isUsefulPerson(e, query);
      if (usefulForEvidence && ["person_candidate","organisation_candidate","location_candidate","username","email","phone"].includes(e.type)) {
        evidence.push({ type:e.type, value:e.value, score:e.score, sources:e.sources.filter(s=>s.evidence).slice(0,3).map(s=>({title:s.title,url:s.url})) });
      }
    }
  }
  const unique = arr => arr.sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,10);
  const sourceList = [...allSources.values()].map(s=>({title:s.title,url:s.url,status:s.httpStatus,textLength:s.textLength}));
  return {
    status:"success",
    query,
    subject: people[0]?.value || query,
    confidence: people[0]?.score || 0,
    summary:{ people:unique(people), organisations:unique(organisations), locations:unique(locations), accounts:unique(accounts) },
    evidence:evidence.slice(0,20),
    sources:sourceList,
    stats:{ searchResults:root?.search?.resultCount || 0, pagesRead:state.pagesProcessed, investigations:investigations.length, evidenceItems:evidence.length, durationMs:Date.now()-startedAt },
    limits:LIMITS,
    depth
  };
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
    return Response.json(buildReport(investigations,query,state,depth,startedAt));
  } catch (error) { return Response.json({ status:"error", message:error.message, query, providerRequested:requestedProvider || env.SEARCH_PROVIDER || "auto" },{ status:502 }); }
}

export default { async fetch(request,env,ctx) {
  const url = new URL(request.url);
  if (url.pathname === "/investigate") return investigate(request,env);
  return import("./index.js").then(module => module.default.fetch(request,env,ctx));
} };