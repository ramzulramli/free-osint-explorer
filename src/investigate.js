import { SEARCH_PROVIDERS, extractEntityCandidates, extractTitle, extractReadableText } from "./index.js";

const LIMITS = {
  maxSearchResults: 5,
  maxPages: 5,
  maxEntitiesPerSource: 50,
  maxRankedEntities: 50,
  maxDiscoveries: 25
};

const DISCOVERY_TYPES = new Set(["person_candidate", "organisation_candidate", "location_candidate", "email", "phone", "username", "url"]);
const METADATA_TYPES = new Set(["date", "year", "keyword"]);

const PERSON_NOISE_WORDS = new Set([
  "safety", "how", "home", "watch", "channel", "video", "videos", "official", "music", "news", "search", "help", "about", "contact", "privacy", "policy", "facebook", "explore", "email", "password", "log", "messenger", "lite", "meta", "pay", "store", "quest", "ban", "bahasa", "indonesia", "create", "account", "settings", "login", "signup", "sign", "terms", "cookies", "download", "share"
]);

const GENERIC_DISCOVERY_VALUES = new Set(["youtube", "facebook", "instagram", "twitter", "x", "linkedin", "tiktok", "wikipedia", "google", "gmail", "meta", "facebook explore"]);

function normalize(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

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
  if (isSeedComponent(value, seedQuery)) return false;
  return true;
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
  const typeWeights = { email: 1.00, phone: 0.95, username: 0.95, person_candidate: 0.85, organisation_candidate: 0.80, location_candidate: 0.65, url: 0.55, date: 0.35, year: 0.20, keyword: 0.15 };
  const confidence = Number(entity.confidence || 0);
  const sourceBoost = Math.min(1, entity.sourceCount / 3);
  const seed = normalize(seedQuery);
  const value = normalize(entity.value);
  const seedMatch = seed && value && seed.includes(value) ? 1 : 0;
  return Number(Math.min(1, confidence * 0.55 + sourceBoost * 0.30 + (typeWeights[entity.type] || 0.25) * 0.15 + seedMatch * 0.10).toFixed(4));
}

async function fetchEntities(url) {
  const targetUrl = new URL(url);
  if (!["http:", "https:"].includes(targetUrl.protocol)) throw new Error("Only HTTP and HTTPS URLs are allowed");

  const response = await fetch(targetUrl.toString(), { headers: { "User-Agent": "Mozilla/5.0 (compatible; FreeOSINTExplorer/0.1)" } });
  if (!response.ok) throw new Error(`Target returned HTTP ${response.status}`);

  const html = await response.text();
  const title = extractTitle(html);
  const text = extractReadableText(html);
  const entities = extractEntityCandidates(text);

  return { title, url: targetUrl.toString(), httpStatus: response.status, textLength: text.length, entities };
}

async function investigate(request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim();
  if (!query) return Response.json({ status: "error", error: "Missing search query", usage: "/investigate?q=keyword" }, { status: 400 });

  const startedAt = Date.now();

  try {
    // Shared provider: no internal /search Worker fetch and no recursive Worker call.
    const searchData = await SEARCH_PROVIDERS.duckduckgo(query);
    const searchResults = Array.isArray(searchData.results) ? searchData.results.slice(0, LIMITS.maxSearchResults) : [];
    const pages = [];
    const failedSources = [];
    const entityMap = new Map();

    for (const result of searchResults.slice(0, LIMITS.maxPages)) {
      try {
        const entityData = await fetchEntities(result.url);
        const source = { title: entityData.title || result.title || "", url: result.url, httpStatus: entityData.httpStatus, textLength: entityData.textLength || 0, entityCount: entityData.entities.length };
        pages.push(source);

        for (const entity of entityData.entities.slice(0, LIMITS.maxEntitiesPerSource)) {
          if (!entity?.type || !entity?.normalized) continue;
          const key = `${entity.type}:${normalize(entity.normalized)}`;
          const existing = entityMap.get(key);
          if (existing) {
            if (!existing.sources.some(sourceRef => sourceRef.url === source.url)) {
              existing.sourceCount += 1;
              existing.sources.push({ title: source.title, url: source.url });
            }
            existing.confidence = Math.max(existing.confidence, Number(entity.confidence || 0));
          } else {
            entityMap.set(key, { type: entity.type, value: entity.value, normalized: entity.normalized, confidence: Number(entity.confidence || 0), sourceCount: 1, sources: [{ title: source.title, url: source.url }] });
          }
        }
      } catch (error) {
        failedSources.push({ title: result.title || "", url: result.url, reason: error.message || "Unknown source error" });
      }
    }

    const allEntities = [...entityMap.values()].map(entity => ({ ...entity, score: scoreEntity(entity, query) }));
    const rankedEntities = allEntities.sort((a, b) => b.score - a.score || b.sourceCount - a.sourceCount || b.confidence - a.confidence).slice(0, LIMITS.maxRankedEntities);
    const discoveries = rankedEntities.filter(entity => isUsefulDiscovery(entity, query)).map(entity => ({ type: entity.type, value: entity.value, normalized: entity.normalized, confidence: entity.confidence, score: entity.score, sourceCount: entity.sourceCount, sources: entity.sources })).slice(0, LIMITS.maxDiscoveries);
    const metadata = allEntities.filter(entity => METADATA_TYPES.has(entity.type)).sort((a, b) => b.score - a.score).slice(0, LIMITS.maxRankedEntities);

    return Response.json({
      status: "success",
      query,
      limits: LIMITS,
      search: { provider: searchData.provider, resultCount: searchData.results.length, processedCount: searchResults.length },
      sources: { successful: pages, failed: failedSources, successfulCount: pages.length, failedCount: failedSources.length },
      entityCount: rankedEntities.length,
      entities: rankedEntities,
      discoveryCount: discoveries.length,
      discoveries,
      metadata,
      timing: { durationMs: Date.now() - startedAt }
    });
  } catch (error) {
    return Response.json({ status: "error", message: error.message, query }, { status: 502 });
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/investigate") return investigate(request);
    return import("./index.js").then(module => module.default.fetch(request, env, ctx));
  }
};