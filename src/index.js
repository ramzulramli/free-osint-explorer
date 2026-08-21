const SEARCH_PROVIDERS = {
  duckduckgo: async (query) => {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "FreeOSINTExplorer/0.1"
      }
    });

    if (!response.ok) {
      throw new Error(`Search provider returned ${response.status}`);
    }

    const html = await response.text();

    return {
      provider: "duckduckgo",
      query,
      resultCount: (html.match(/result__a/g) || []).length,
      rawLength: html.length
    };
  }
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return Response.json({
        name: "Free OSINT Explorer",
        status: "online",
        version: "0.1.0"
      });
    }

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
        const provider = SEARCH_PROVIDERS.duckduckgo;
        const result = await provider(query);

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

    return Response.json(
      {
        error: "Not found"
      },
      { status: 404 }
    );
  }
};
