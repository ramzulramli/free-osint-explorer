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

      const title = linkMatch[2]
        .replace(/<[^>]*>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .trim();

      const snippetMatch = block.match(
        /class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|div)>/
      );

      const snippet = snippetMatch
        ? snippetMatch[1]
            .replace(/<[^>]*>/g, "")
            .replace(/&amp;/g, "&")
            .replace(/&quot;/g, '"')
            .replace(/&#x27;/g, "'")
            .trim()
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
    .replace(/&gt;/gi, ">");
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
CLOUDFLARE WORKER
==================================================
*/

export default {
  async fetch(request, env) {

    const url = new URL(request.url);


    /*
    ==================================================
    HOME
    ==================================================
    */

    if (url.pathname === "/") {
      return Response.json({
        name: "Free OSINT Explorer",
        status: "online",
        version: "0.1.0"
      });
    }


    /*
    ==================================================
    SEARCH
    ==================================================
    */

    if (url.pathname === "/search") {

      const query = url.searchParams.get("q")?.trim();

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
            usage: "/fetch?url=https://example.com"
          },
          { status: 400 }
        );
      }

      try {

        const targetUrl = new URL(target);

        if (
          !["http:", "https:"]
            .includes(targetUrl.protocol)
        ) {
          throw new Error(
            "Only HTTP and HTTPS URLs are allowed"
          );
        }

        const response = await fetch(
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
          url: targetUrl.toString(),
          httpStatus: response.status,
          contentType:
            response.headers.get("content-type"),
          contentLength: html.length,
          preview: html.substring(0, 1000)
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
            usage: "/read?url=https://example.com"
          },
          { status: 400 }
        );
      }

      try {

        const targetUrl = new URL(target);

        if (
          !["http:", "https:"]
            .includes(targetUrl.protocol)
        ) {
          throw new Error(
            "Only HTTP and HTTPS URLs are allowed"
          );
        }

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

        const html =
          await response.text();


        // Extract title
        const title =
          extractTitle(html);


        // Extract readable text
        const text =
          extractReadableText(html);


        // Extract hyperlinks
        const links =
          extractLinks(
            html,
            targetUrl.toString()
          );


        return Response.json({

          status: "success",

          url:
            targetUrl.toString(),

          httpStatus:
            response.status,

          title,

          textLength:
            text.length,

          text:
            text.substring(0, 10000),

          linkCount:
            links.length,

          links:
            links.slice(0, 100)

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
