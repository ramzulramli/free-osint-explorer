import legacyWorker from "./index.js";

const LIMITS = {
  maxSearchResults: 5,
  maxPages: 5,
  maxEntitiesPerSource: 50,
  maxRankedEntities: 50
};

function normalize(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function scoreEntity(entity, sourceCount, seedQuery) {
  const typeWeights = {
    email: 1.00,
    phone: 0.95,
    username: 0.95,
    person_candidate: 0.85,
    organisation_candidate: 0.80,
    location_candidate: 0.65,
    url: 0.55,
    date: 0.35,
    year: 0.20,
    keyword: 0.15
  };

  const confidence = Number(entity.confidence || 0);
  const sourceBoost = Math.min(1, sourceCount / 3);
  const seed = normalize(seedQuery);
  const value = normalize(entity.value);
  const seedMatch = seed && value && seed.includes(value) ? 1 : 0;

  return Number(
    Math.min(
      1,
      confidence * 0.55 +
      sourceBoost * 0.30 +
      (typeWeights[entity.type] || 0.25) * 0.15 +
      seedMatch * 0.10
    ).toFixed(4)
  );
}

async function callLegacy(request, path, params = {}) {
  const url = new URL(request.url);
  url.pathname = path;
  url.search = "";

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return legacyWorker.fetch(new Request(url.toString(), request));
}

async function investigate(request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim();

  if (!query) {
    return Response.json(
      {
        status: "error",
        error: "Missing search query",
        usage: "/investigate?q=keyword"
      },
      { status: 400 }
    );
  }

  const startedAt = Date.now();

  try {
    const searchResponse = await callLegacy(request, "/search", { q: query });
    const searchData = await searchResponse.json();

    if (searchData.status !== "success") {
      throw new Error(searchData.message || "Search failed");
    }

    const searchResults = Array.isArray(searchData.results)
      ? searchData.results.slice(0, LIMITS.maxSearchResults)
      : [];

    const pages = [];
    const entityMap = new Map();

    for (const result of searchResults.slice(0, LIMITS.maxPages)) {
      try {
        const entityResponse = await callLegacy(request, "/entities", {
          url: result.url
        });

        const entityData = await entityResponse.json();
        if (entityData.status !== "success") continue;

        const source = {
          title: entityData.title || result.title || "",
          url: result.url,
          httpStatus: entityData.httpStatus,
          textLength: entityData.textLength || 0,
          entityCount: entityData.entityCount || 0
        };

        pages.push(source);

        const entities = Array.isArray(entityData.entities)
          ? entityData.entities.slice(0, LIMITS.maxEntitiesPerSource)
          : [];

        for (const entity of entities) {
          if (!entity?.type || !entity?.normalized) continue;

          const key = `${entity.type}:${normalize(entity.normalized)}`;
          const existing = entityMap.get(key);

          if (existing) {
            existing.sourceCount += 1;
            existing.sources.push({
              title: source.title,
              url: source.url
            });
            existing.confidence = Math.max(
              existing.confidence,
              Number(entity.confidence || 0)
            );
          } else {
            entityMap.set(key, {
              type: entity.type,
              value: entity.value,
              normalized: entity.normalized,
              confidence: Number(entity.confidence || 0),
              sourceCount: 1,
              sources: [{
                title: source.title,
                url: source.url
              }]
            });
          }
        }
      } catch {
        // One bad source must not abort the entire investigation.
      }
    }

    const rankedEntities = [...entityMap.values()]
      .map(entity => ({
        ...entity,
        score: scoreEntity(entity, entity.sourceCount, query)
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.sourceCount !== a.sourceCount) return b.sourceCount - a.sourceCount;
        return b.confidence - a.confidence;
      })
      .slice(0, LIMITS.maxRankedEntities);

    return Response.json({
      status: "success",
      query,
      limits: LIMITS,
      search: {
        provider: searchData.provider,
        resultCount: Array.isArray(searchData.results) ? searchData.results.length : 0,
        processedCount: searchResults.length
      },
      sources: pages,
      sourceCount: pages.length,
      entityCount: rankedEntities.length,
      entities: rankedEntities,
      timing: {
        durationMs: Date.now() - startedAt
      }
    });
  } catch (error) {
    return Response.json(
      {
        status: "error",
        message: error.message,
        query
      },
      { status: 502 }
    );
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/investigate") {
      return investigate(request);
    }

    return legacyWorker.fetch(request, env, ctx);
  }
};
