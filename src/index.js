const SEARCH_PROVIDERS = {
  demo: async (query) => {
    return {
      provider: "demo",
      query,
      results: []
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

      const provider = SEARCH_PROVIDERS.demo;
      const result = await provider(query);

      return Response.json({
        status: "success",
        ...result
      });
    }

    return Response.json(
      {
        error: "Not found"
      },
      { status: 404 }
    );
  }
};
