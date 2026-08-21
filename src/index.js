const SEARCH_PROVIDERS = {
  duckduckgo: async (query) => {
    const searchUrl =
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

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

      // Skip advertisements
      if (
        block.includes("result--ad") ||
        block.includes("ad_provider") ||
        block.includes("ad_domain")
      ) {
        continue;
      }

      const linkMatch = block.match(
        /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/
      );

      if (!linkMatch) {
        continue;
      }

      let rawUrl = linkMatch[1];

      // Convert relative URL to absolute URL
      if (rawUrl.startsWith("//")) {
        rawUrl = "https:" + rawUrl;
      }

      let finalUrl;

      try {
        const parsed = new URL(rawUrl);

        // DuckDuckGo redirect URL
        const destination = parsed.searchParams.get("uddg");

        if (destination) {
          finalUrl = decodeURIComponent(destination);
        } else {
          finalUrl = parsed.toString();
        }
      } catch {
        continue;
      }

      // Only accept HTTP/HTTPS
      if (
        !finalUrl.startsWith("http://") &&
        !finalUrl.startsWith("https://")
      ) {
        continue;
      }

      // Remove duplicate URLs
      if (seenUrls.has(finalUrl)) {
        continue;
      }

      seenUrls.add(finalUrl);

      const title = decodeHtmlEntities(
        linkMatch[2]
          .replace(/<[^>]*>/g, "")
          .trim()
      );

      const snippetMatch = block.match(
        /class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|div)>/
      );

      const snippet = snippetMatch
        ? decodeHtmlEntities(
            snippetMatch[1]
              .replace(/<[^>]*>/g, "")
              .trim()
          )
        : "";

      results.push({
        title,
        url: finalUrl,
        snippet
      });
    }

    return {
      provider: "duckduckgo",
      query,
      results
    };
  }
};


/*
==================================================
UTILITY FUNCTIONS
==================================================
*/

function decodeHtmlEntities(text) {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/gi, (match, dec) =>
      String.fromCharCode(dec)
    )
    .replace(/&#x([0-9a-f]+);/gi, (match, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}


function extractTitle(html) {
  const match = html.match(
    /<title[^>]*>([\s\S]*?)<\/title>/i
  );

  if (!match) {
    return "";
  }

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

  const linkRegex =
    /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1].trim();

    if (!href) {
      continue;
    }

    try {
      const absoluteUrl = new URL(href, baseUrl);

      // Only HTTP/HTTPS links
      if (
        absoluteUrl.protocol !== "http:" &&
        absoluteUrl.protocol !== "https:"
      ) {
        continue;
      }

      const finalUrl = absoluteUrl.toString();

      if (seenUrls.has(finalUrl)) {
        continue;
      }

      seenUrls.add(finalUrl);

      const linkText = decodeHtmlEntities(
        match[2]
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      );

      links.push({
        text: linkText,
        url: finalUrl
      });

    } catch {
      // Ignore malformed URLs
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
    .replace(/<!--[\s\S]*?-->/g, " ");

  return decodeHtmlEntities(
    cleaned
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}


/*
==================================================
PAGE READER
==================================================
*/

async function readPage(targetUrl) {

  const response = await fetch(
    targetUrl.toString(),
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; FreeOSINTExplorer/0.1)"
      }
    }
  );

  if (!response.ok) {
    throw new Error(
      `Target returned HTTP ${response.status}`
    );
  }

  const html = await response.text();

  const title =
    extractTitle(html);

  const text =
    extractReadableText(html);

  const links =
    extractLinks(
      html,
      targetUrl.toString()
    );

  return {
    url: targetUrl.toString(),
    httpStatus: response.status,
    title,
    text,
    links
  };
}


/*
==================================================
ENTITY EXTRACTION
==================================================
*/

function addEntity(
  entities,
  seen,
  type,
  value,
  confidence,
  evidence
) {
  const cleanedValue = value
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanedValue) {
    return;
  }

  const normalized =
    cleanedValue.toLowerCase();

  const key =
    `${type}:${normalized}`;

  if (seen.has(key)) {
    return;
  }

  seen.add(key);

  entities.push({
    type,
    value: cleanedValue,
    normalized,
    confidence,
    evidence
  });
}


function extractEntities(text, sourceUrl) {

  const entities = [];
  const seen = new Set();


  /*
  ================================================
  EMAIL
  ================================================
  */

  const emailRegex =
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

  for (const match of text.matchAll(emailRegex)) {

    addEntity(
      entities,
      seen,
      "email",
      match[0],
      1.0,
      `Email address found in page text`
    );
  }


  /*
  ================================================
  PHONE
  ================================================
  */

  const phoneRegex =
    /(?<!\d)(?:\+?60|0)(?:1\d|[3-9]\d)[ -]?\d{3,4}[ -]?\d{4}(?!\d)/g;

  for (const match of text.matchAll(phoneRegex)) {

    addEntity(
      entities,
      seen,
      "phone",
      match[0],
      0.95,
      `Possible Malaysian phone number found in page text`
    );
  }


  /*
  ================================================
  URL
  ================================================
  */

  const urlRegex =
    /\bhttps?:\/\/[^\s<>"']+/gi;

  for (const match of text.matchAll(urlRegex)) {

    let value = match[0]
      .replace(/[),.;]+$/, "");

    addEntity(
      entities,
      seen,
      "url",
      value,
      1.0,
      `URL found in page text`
    );
  }


  /*
  ================================================
  USERNAME
  ================================================
  */

  const usernameRegex =
    /(^|\s)@([a-zA-Z0-9._-]{2,50})\b/g;

  for (const match of text.matchAll(usernameRegex)) {

    addEntity(
      entities,
      seen,
      "username",
      `@${match[2]}`,
      0.95,
      `Username-style @mention found in page text`
    );
  }


  /*
  ================================================
  DATE
  ================================================
  */

  const dateRegex =
    /\b(?:\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/gi;

  for (const match of text.matchAll(dateRegex)) {

    addEntity(
      entities,
      seen,
      "date",
      match[0],
      0.95,
      `Date pattern found in page text`
    );
  }


  /*
  ================================================
  YEAR
  ================================================
  */

  const yearRegex =
    /\b(?:19|20)\d{2}\b/g;

  for (const match of text.matchAll(yearRegex)) {

    addEntity(
      entities,
      seen,
      "year",
      match[0],
      0.85,
      `Four-digit year found in page text`
    );
  }


  /*
  ================================================
  PERSON CANDIDATES
  ================================================
  */

  const personRegex =
    /\b(?:[A-Z][a-z]+(?:\s+(?:[A-Z][a-z]+|bin|binti|bt|bte|[A-Z]\.))+)\b/g;

  for (const match of text.matchAll(personRegex)) {

    const value = match[0]
      .replace(/\s+/g, " ")
      .trim();

    /*
     * Avoid obvious generic phrases.
     */
    const excluded = [
      "Main Menu",
      "Main Page",
      "Current Events",
      "Random Article",
      "About Wikipedia",
      "Contact Wikipedia",
      "Recent Changes",
      "Create Account",
      "Personal Tools",
      "Club Career",
      "International Career",
      "Career Statistics",
      "External Links"
    ];

    if (excluded.includes(value)) {
      continue;
    }

    addEntity(
      entities,
      seen,
      "person_candidate",
      value,
      0.60,
      `Name-like capitalized phrase found in page text`
    );
  }


  /*
  ================================================
  LOCATION / ORGANISATION CANDIDATES
  ================================================
  */

  const knownLocations = [
    "Malaysia",
    "Selangor",
    "Kuala Lumpur",
    "Kelantan",
    "Terengganu",
    "Johor",
    "Penang",
    "Perak",
    "Pahang",
    "Sabah",
    "Sarawak",
    "Tumpat",
    "Wakaf Bharu"
  ];

  for (const location of knownLocations) {

    const locationRegex =
      new RegExp(
        `\\b${location.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
        "gi"
      );

    if (locationRegex.test(text)) {

      addEntity(
        entities,
        seen,
        "location_candidate",
        location,
        0.85,
        `Known Malaysian location found in page text`
      );
    }
  }


  /*
  ================================================
  COMMON ORGANISATION PATTERNS
  ================================================
  */

  const organisationRegex =
    /\b[A-Z][A-Za-z0-9&.-]*(?:\s+[A-Z][A-Za-z0-9&.-]*)*\s+(?:FA|FC|F\.C\.|Berhad|Bhd|Sdn\.?\s+Bhd|Corporation|Company|University|Institute|Association|Department|Agency|Group|Foundation)\b/g;

  for (const match of text.matchAll(organisationRegex)) {

    addEntity(
      entities,
      seen,
      "organisation_candidate",
      match[0],
      0.65,
      `Organisation-like phrase found in page text`
    );
  }


  /*
  ================================================
  SOURCE INFORMATION
  ================================================
  */

  return {
    sourceUrl,
    entityCount: entities.length,
    entities
  };
}


/*
==================================================
CLOUDFLARE WORKER
==================================================
*/

export default {
  async fetch(request, env) {

    const url =
      new URL(request.url);


    /*
    ==================================================
    HOME
    ==================================================
    */

    if (url.pathname === "/") {

      return Response.json({
        name: "Free OSINT Explorer",
        status: "online",
        version: "0.2.0"
      });
    }


    /*
    ==================================================
    SEARCH
    ==================================================
    */

    if (url.pathname === "/search") {

      const query =
        url.searchParams.get("q")?.trim();

      if (!query) {

        return Response.json(
          {
            error: "Missing search query",
            usage: "/search?q=keyword"
          },
          { status: 400 }
        );
      }

      try {

        const result =
          await SEARCH_PROVIDERS.duckduckgo(query);

        return Response.json({
          status: "success",
          ...result
        });

      } catch (error) {

        return Response.json(
          {
            status: "error",
            message: error.message
          },
          { status: 502 }
        );
      }
    }


    /*
    ==================================================
    FETCH
    ==================================================
    */

    if (url.pathname === "/fetch") {

      const target =
        url.searchParams.get("url")?.trim();

      if (!target) {

        return Response.json(
          {
            error: "Missing URL",
            usage:
              "/fetch?url=https://example.com"
          },
          { status: 400 }
        );
      }

      try {

        const targetUrl =
          new URL(target);

        if (
          !["http:", "https:"]
            .includes(targetUrl.protocol)
        ) {

          throw new Error(
            "Only HTTP and HTTPS URLs are allowed"
          );
        }

        const response =
          await fetch(
            targetUrl.toString(),
            {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (compatible; FreeOSINTExplorer/0.1)"
              }
            }
          );

        const html =
          await response.text();

        return Response.json({

          status: "success",

          url:
            targetUrl.toString(),

          httpStatus:
            response.status,

          contentType:
            response.headers.get(
              "content-type"
            ),

          contentLength:
            html.length,

          preview:
            html.substring(0, 1000)

        });

      } catch (error) {

        return Response.json(
          {
            status: "error",
            message: error.message
          },
          { status: 502 }
        );
      }
    }


    /*
    ==================================================
    READ
    ==================================================
    */

    if (url.pathname === "/read") {

      const target =
        url.searchParams.get("url")?.trim();

      if (!target) {

        return Response.json(
          {
            error: "Missing URL",
            usage:
              "/read?url=https://example.com"
          },
          { status: 400 }
        );
      }

      try {

        const targetUrl =
          new URL(target);

        if (
          !["http:", "https:"]
            .includes(targetUrl.protocol)
        ) {

          throw new Error(
            "Only HTTP and HTTPS URLs are allowed"
          );
        }

        const page =
          await readPage(targetUrl);

        return Response.json({

          status: "success",

          url:
            page.url,

          httpStatus:
            page.httpStatus,

          title:
            page.title,

          textLength:
            page.text.length,

          text:
            page.text.substring(0, 10000),

          linkCount:
            page.links.length,

          links:
            page.links.slice(0, 100)

        });

      } catch (error) {

        return Response.json(
          {
            status: "error",
            message: error.message
          },
          { status: 502 }
        );
      }
    }


    /*
    ==================================================
    ENTITIES
    ==================================================
    */

    if (url.pathname === "/entities") {

      const target =
        url.searchParams.get("url")?.trim();

      if (!target) {

        return Response.json(
          {
            error: "Missing URL",
            usage:
              "/entities?url=https://example.com"
          },
          { status: 400 }
        );
      }

      try {

        const targetUrl =
          new URL(target);

        if (
          !["http:", "https:"]
            .includes(targetUrl.protocol)
        ) {

          throw new Error(
            "Only HTTP and HTTPS URLs are allowed"
          );
        }

        const page =
          await readPage(targetUrl);

        const extraction =
          extractEntities(
            page.text,
            page.url
          );

        return Response.json({

          status: "success",

          url:
            page.url,

          httpStatus:
            page.httpStatus,

          title:
            page.title,

          textLength:
            page.text.length,

          entityCount:
            extraction.entityCount,

          entities:
            extraction.entities

        });

      } catch (error) {

        return Response.json(
          {
            status: "error",
            message: error.message
          },
          { status: 502 }
        );
      }
    }


    /*
    ==================================================
    UNKNOWN ROUTE
    ==================================================
    */

    return Response.json(
      {
        error: "Not found"
      },
      { status: 404 }
    );

  }
};
