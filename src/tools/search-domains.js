import { apiRequest } from "../api.js";

export const searchDomains = {
  definition: {
    name: "search_domains",
    description:
      "Search domain availability through Haraldr. Requires a logged-in Haraldr session.",
    inputSchema: {
      type: "object",
      properties: {
        domains: {
          type: "array",
          items: { type: "string" },
          description: "Exact domain names to check, such as example.com.",
        },
        query: {
          type: "string",
          description: "Keyword phrase used to generate deterministic domain ideas.",
        },
        tlds: {
          type: "array",
          items: { type: "string" },
          description: "TLDs to use for keyword ideas, such as com or io.",
        },
        includePrice: {
          type: "boolean",
          description: "Include Openprovider create pricing when available. Defaults to true.",
        },
      },
      additionalProperties: false,
    },
  },
  async handler({ domains, query, tlds, includePrice } = {}) {
    const body = {};
    if (domains !== undefined) body.domains = domains;
    if (query !== undefined) body.query = query;
    if (tlds !== undefined) body.tlds = tlds;
    if (includePrice !== undefined) body.includePrice = includePrice;

    const { data } = await apiRequest("/api/domains/search", {
      method: "POST",
      body,
      requireAuth: true,
    });

    const results = Array.isArray(data?.results) ? data.results : [];
    if (results.length === 0) return "No domain results returned.";
    return results.map(formatDomainResult).join("\n");
  },
};

function formatDomainResult(result) {
  const domain = result.domain || "(unknown)";
  const status = result.available ? "available" : result.status || "unavailable";
  const premium = result.premium ? "premium" : "standard";
  const price = formatPrice(result.price);
  return `${domain}: ${status}; ${premium}${price ? `; ${price}` : ""}`;
}

function formatPrice(price) {
  if (!price || typeof price.create !== "number") return "";
  const currency = price.currency || "USD";
  return `${currency} ${price.create}`;
}
