const SEARCH_PROVIDERS = {
  duckduckgo: async (query) => {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FreeOSINTExplorer/0.1)"
      }
    });

    if (!response.ok) {
      throw new Error(`Search provider returned ${response.status}`);
    }

    const html = await response.text();
    const results = [];
    const seenUrls = new Set();
    const resultBlocks = html.split('class="result results_links');

    for (let i = 1; i < resultBlocks.length; i++) {
      const block = resultBlocks[i];

      if (block.includes("result--ad") || block.includes("ad_provider") || block.includes("ad_domain")) {
        continue;
      }

      const linkMatch = block.match(
        /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/
      );

      if (!linkMatch) continue;

      let rawUrl = linkMatch[1];
      if (rawUrl.startsWith("//")) rawUrl = "https:" + rawUrl;

      let finalUrl;

      try {
        const parsed = new URL(rawUrl);
        const destination = parsed.searchParams.get("uddg");
        finalUrl = destination ? decodeURIComponent(destination) : parsed.toString();
      } catch {
        continue;
      }

      if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) continue;
      if (seenUrls.has(finalUrl)) continue;
      seenUrls.add(finalUrl);

      const title = decodeHtmlEntities(
        linkMatch[2].replace(/<[^>]*>/g, "").trim()
      );

      const snippetMatch = block.match(
        /class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|div)>/
      );

      const snippet = snippetMatch
        ? decodeHtmlEntities(snippetMatch[1].replace(/<[^>]*>/g, "").trim())
        : "";

      results.push({ title, url: finalUrl, snippet });
    }

    return { provider: "duckduckgo", query, results };
  }
};

/* ==================================================
   UTILITY FUNCTIONS
   ================================================== */

function decodeHtmlEntities(text) {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function normalizeEntity(value) {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function cleanTextForEntities(text) {
  return decodeHtmlEntities(text)
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return "";

  return decodeHtmlEntities(
    match[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function extractLinks(html, baseUrl) {
  const links = [];
  const seenUrls = new Set();
  const linkRegex = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1].trim();
    if (!href) continue;

    try {
      const absoluteUrl = new URL(href, baseUrl);
      if (absoluteUrl.protocol !== "http:" && absoluteUrl.protocol !== "https:") continue;

      const finalUrl = absoluteUrl.toString();
      if (seenUrls.has(finalUrl)) continue;
      seenUrls.add(finalUrl);

      const linkText = decodeHtmlEntities(
        match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      );

      links.push({ text: linkText, url: finalUrl });
    } catch {
      // Ignore malformed URLs.
    }
  }

  return links;
}

function extractReadableText(html) {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<template[\s\S]*?<\/template>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<!-- [\s\S]*? -->/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  return decodeHtmlEntities(
    cleaned
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/* ==================================================
   ENTITY EXTRACTION
   ================================================== */

const COMMON_NON_PERSON_WORDS = new Set([
  "wikipedia", "jump", "navigation", "main", "contents", "current", "about",
  "contact", "contribute", "help", "learn", "search", "appearance", "donate",
  "create", "account", "article", "talk", "english", "read", "edit", "view",
  "history", "tools", "actions", "general", "what", "from", "personal",
  "information", "date", "birth", "place", "height", "position", "youth",
  "career", "team", "league", "club", "cup", "season", "apps", "goals",
  "total", "international", "statistics", "reference", "references", "external",
  "links", "privacy", "policy", "creative", "commons", "attribution", "conduct",
  "developers", "cookie", "toggle", "hidden", "categories", "malaysian", "men",
  "forward", "striker", "senior", "junior", "personal", "years", "league"
]);

const COMMON_ORGANISATION_WORDS = new Set([
  "berhad", "bhd", "sdn", "sendirian", "foundation", "association", "university",
  "corporation", "company", "limited", "ltd", "fc", "f.c.", "fa", "f.a.",
  "team", "club"
]);

const MALAYSIAN_LOCATIONS = [
  "Malaysia", "Selangor", "Kuala Lumpur", "Terengganu", "Kelantan", "Johor",
  "Penang", "Perak", "Pahang", "Negeri Sembilan", "Melaka", "Sabah", "Sarawak",
  "Putrajaya", "Labuan", "Shah Alam", "Petaling Jaya", "Klang", "Tumpat",
  "Wakaf Bharu", "Kota Bharu", "Kuala Terengganu"
];

function isLikelyPersonName(value) {
  const cleaned = value.trim();
  if (!cleaned) return false;

  const words = cleaned.split(/\s+/);
  if (words.length < 2 || words.length > 5) return false;
  if (cleaned.length < 5 || cleaned.length > 80) return false;

  const lowerWords = words.map(word =>
    word.replace(/[^a-zA-ZÀ-ÿ'-]/g, "").toLowerCase()
  );

  if (lowerWords.some(word => COMMON_NON_PERSON_WORDS.has(word))) return false;
  if (lowerWords.some(word => COMMON_ORGANISATION_WORDS.has(word))) return false;

  const properNameWords = words.filter(word =>
    /^[A-ZÀ-Ý][a-zà-ÿ'-]*$/.test(word)
  ).length;

  if (properNameWords < 2) return false;

  return true;
}

function extractPersonCandidates(text) {
  const candidates = [];
  const seen = new Set();

  // Supports common Western names and Malaysian-style "bin/binti" names.
  const nameRegex = /\b[A-ZÀ-Ý][a-zà-ÿ'-]+(?:\s+(?:bin|binti|[A-ZÀ-Ý][a-zà-ÿ'-]+)){1,4}\b/g;
  let match;

  while ((match = nameRegex.exec(text)) !== null) {
    const value = match[0].trim();
    if (!isLikelyPersonName(value)) continue;

    const normalized = normalizeEntity(value);
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    let confidence = 0.60;
    if (/\b(bin|binti)\b/i.test(value)) confidence = 0.85;

    candidates.push({
      type: "person_candidate",
      value,
      normalized,
      confidence,
      evidence: "Name-like phrase found in page text"
    });
  }

  return candidates;
}

function extractOrganisationCandidates(text) {
  const candidates = [];
  const seen = new Set();

  const organisationRegex = /\b[A-ZÀ-Ý][A-Za-zÀ-ÿ&.'-]*(?:\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ&.'-]*){0,6}\s+(?:Berhad|Bhd|Sdn Bhd|Foundation|Association|University|Corporation|Company|Limited|Ltd|FA|F\.A\.|FC|F\.C\.)\b/g;
  let match;

  while ((match = organisationRegex.exec(text)) !== null) {
    const value = match[0].replace(/\s+/g, " ").trim();
    if (value.length < 4) continue;

    const normalized = normalizeEntity(value);
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    candidates.push({
      type: "organisation_candidate",
      value,
      normalized,
      confidence: 0.70,
      evidence: "Organisation-like phrase found in page text"
    });
  }

  return candidates;
}

function extractLocationCandidates(text) {
  const candidates = [];
  const seen = new Set();

  for (const location of MALAYSIAN_LOCATIONS) {
    const escaped = location.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    if (!regex.test(text)) continue;

    const normalized = normalizeEntity(location);
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    candidates.push({
      type: "location_candidate",
      value: location,
      normalized,
      confidence: 0.85,
      evidence: "Known Malaysian location found in page text"
    });
  }

  return candidates;
}

function extractEmails(text) {
  const candidates = [];
  const seen = new Set();
  const regex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const value = match[0];
    const normalized = normalizeEntity(value);
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    candidates.push({
      type: "email",
      value,
      normalized,
      confidence: 0.99,
      evidence: "Email address pattern found in page text"
    });
  }

  return candidates;
}

function extractPhoneNumbers(text) {
  const candidates = [];
  const seen = new Set();
  const regex = /(?:\+?6?0?1[0-9][\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,4}|\+?60[\s.-]?[0-9]{1,2}[\s.-]?[0-9]{3,4}[\s.-]?[0-9]{3,4})/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const value = match[0].trim();
    const digits = value.replace(/\D/g, "");
    if (digits.length < 9 || digits.length > 12) continue;

    const normalized = digits;
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    candidates.push({
      type: "phone",
      value,
      normalized,
      confidence: 0.90,
      evidence: "Phone number pattern found in page text"
    });
  }

  return candidates;
}

function extractUrls(text) {
  const candidates = [];
  const seen = new Set();
  const regex = /\bhttps?:\/\/[^\s<>"']+/gi;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const value = match[0].replace(/[),.;]+$/, "");
    const normalized = normalizeEntity(value);
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    candidates.push({
      type: "url",
      value,
      normalized,
      confidence: 0.99,
      evidence: "URL found in page text"
    });
  }

  return candidates;
}

function extractUsernames(text) {
  const candidates = [];
  const seen = new Set();

  // Conservative: only recognise explicit @handles, avoiding email addresses.
  const regex = /(^|[^\w])@([A-Za-z0-9._-]{2,30})\b/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const value = `@${match[2]}`;
    const normalized = normalizeEntity(value);
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    candidates.push({
      type: "username",
      value,
      normalized,
      confidence: 0.95,
      evidence: "Explicit @username found in page text"
    });
  }

  return candidates;
}

function extractDates(text) {
  const candidates = [];
  const seen = new Set();
  const regex = /\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/gi;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const value = match[0].trim();
    const normalized = normalizeEntity(value);
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    candidates.push({
      type: "date",
      value,
      normalized,
      confidence: 0.95,
      evidence: "Date pattern found in page text"
    });
  }

  return candidates;
}

function extractYears(text) {
  const candidates = [];
  const seen = new Set();
  const regex = /\b(?:19|20)\d{2}\b/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const value = match[0];
    if (seen.has(value)) continue;
    seen.add(value);

    candidates.push({
      type: "year",
      value,
      normalized: value,
      confidence: 0.85,
      evidence: "Four-digit year found in page text"
    });
  }

  return candidates;
}

function extractKeywords(text) {
  const stopWords = new Set([
    "the", "and", "for", "that", "with", "this", "from", "were", "have", "has",
    "had", "will", "would", "about", "their", "there", "which", "where", "when",
    "what", "who", "into", "than", "then", "them", "they", "you", "your", "his",
    "her", "its", "are", "was", "not", "but", "can", "all", "also", "more", "one",
    "two", "three", "page", "read", "edit", "view", "main", "search", "wikipedia"
  ]);

  const counts = new Map();
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(word => word.length >= 4 && word.length <= 40 && !stopWords.has(word));

  for (const word of words) {
    counts.set(word, (counts.get(word) || 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([value, count]) => ({
      type: "keyword",
      value,
      normalized: value,
      confidence: Math.min(0.95, 0.50 + count * 0.05),
      evidence: `Repeated keyword found ${count} times`
    }));
}

function deduplicateEntities(entities) {
  const map = new Map();

  for (const entity of entities) {
    const key = `${entity.type}:${entity.normalized}`;
    const existing = map.get(key);

    if (!existing || entity.confidence > existing.confidence) {
      map.set(key, entity);
    }
  }

  return [...map.values()];
}

function extractEntityCandidates(text) {
  const cleaned = cleanTextForEntities(text);

  const entities = [
    ...extractPersonCandidates(cleaned),
    ...extractOrganisationCandidates(cleaned),
    ...extractLocationCandidates(cleaned),
    ...extractEmails(cleaned),
    ...extractPhoneNumbers(cleaned),
    ...extractUrls(cleaned),
    ...extractUsernames(cleaned),
    ...extractDates(cleaned),
    ...extractYears(cleaned),
    ...extractKeywords(cleaned)
  ];

  return deduplicateEntities(entities);
}

/* ==================================================
   CLOUDFLARE WORKER
   ================================================== */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return Response.json({
        name: "Free OSINT Explorer",
        status: "online",
        version: "0.3.0"
      });
    }

    if (url.pathname === "/search") {
      const query = url.searchParams.get("q")?.trim();

      if (!query) {
        return Response.json(
          { error: "Missing search query", usage: "/search?q=keyword" },
          { status: 400 }
        );
      }

      try {
        const result = await SEARCH_PROVIDERS.duckduckgo(query);
        return Response.json({ status: "success", ...result });
      } catch (error) {
        return Response.json(
          { status: "error", message: error.message },
          { status: 502 }
        );
      }
    }

    if (url.pathname === "/fetch") {
      const target = url.searchParams.get("url")?.trim();

      if (!target) {
        return Response.json(
          { error: "Missing URL", usage: "/fetch?url=https://example.com" },
          { status: 400 }
        );
      }

      try {
        const targetUrl = new URL(target);
        if (!["http:", "https:"].includes(targetUrl.protocol)) {
          throw new Error("Only HTTP and HTTPS URLs are allowed");
        }

        const response = await fetch(targetUrl.toString(), {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; FreeOSINTExplorer/0.1)"
          }
        });

        const html = await response.text();

        return Response.json({
          status: "success",
          url: targetUrl.toString(),
          httpStatus: response.status,
          contentType: response.headers.get("content-type"),
          contentLength: html.length,
          preview: html.substring(0, 1000)
        });
      } catch (error) {
        return Response.json(
          { status: "error", message: error.message },
          { status: 502 }
        );
      }
    }

    if (url.pathname === "/read") {
      const target = url.searchParams.get("url")?.trim();

      if (!target) {
        return Response.json(
          { error: "Missing URL", usage: "/read?url=https://example.com" },
          { status: 400 }
        );
      }

      try {
        const targetUrl = new URL(target);
        if (!["http:", "https:"].includes(targetUrl.protocol)) {
          throw new Error("Only HTTP and HTTPS URLs are allowed");
        }

        const response = await fetch(targetUrl.toString(), {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; FreeOSINTExplorer/0.1)"
          }
        });

        if (!response.ok) {
          throw new Error(`Target returned HTTP ${response.status}`);
        }

        const html = await response.text();
        const title = extractTitle(html);
        const text = extractReadableText(html);
        const links = extractLinks(html, targetUrl.toString());

        return Response.json({
          status: "success",
          url: targetUrl.toString(),
          httpStatus: response.status,
          title,
          textLength: text.length,
          text: text.substring(0, 10000),
          linkCount: links.length,
          links: links.slice(0, 100)
        });
      } catch (error) {
        return Response.json(
          { status: "error", message: error.message },
          { status: 502 }
        );
      }
    }

    if (url.pathname === "/entities") {
      const target = url.searchParams.get("url")?.trim();

      if (!target) {
        return Response.json(
          { error: "Missing URL", usage: "/entities?url=https://example.com" },
          { status: 400 }
        );
      }

      try {
        const targetUrl = new URL(target);
        if (!["http:", "https:"].includes(targetUrl.protocol)) {
          throw new Error("Only HTTP and HTTPS URLs are allowed");
        }

        const response = await fetch(targetUrl.toString(), {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; FreeOSINTExplorer/0.1)"
          }
        });

        if (!response.ok) {
          throw new Error(`Target returned HTTP ${response.status}`);
        }

        const html = await response.text();
        const title = extractTitle(html);
        const text = extractReadableText(html);
        const entities = extractEntityCandidates(text);

        return Response.json({
          status: "success",
          url: targetUrl.toString(),
          httpStatus: response.status,
          title,
          textLength: text.length,
          entityCount: entities.length,
          entities
        });
      } catch (error) {
        return Response.json(
          { status: "error", message: error.message },
          { status: 502 }
        );
      }
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  }
};
