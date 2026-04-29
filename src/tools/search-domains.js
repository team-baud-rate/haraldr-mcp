import { apiRequest } from "../api.js";

/** @typedef {import('../types.js').Tool} Tool */
/** @typedef {import('../types.js').DomainPrice} DomainPrice */
/** @typedef {import('../types.js').DomainSearchResult} DomainSearchResult */
/** @typedef {import('../types.js').DomainSearchResponse} DomainSearchResponse */
/** @typedef {import('../types.js').DomainSearchRequestBody} DomainSearchRequestBody */

/** @type {Tool} */
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
          description:
            "Keyword phrase used to generate deterministic domain ideas.",
        },
        tlds: {
          type: "array",
          items: { type: "string" },
          description: "TLDs to use for keyword ideas, such as com or io.",
        },
        includePrice: {
          type: "boolean",
          description:
            "Include Openprovider create pricing when available. Defaults to true.",
        },
      },
      additionalProperties: false,
    },
  },
  /**
   * Forward a domain availability search to the API and render each result
   * as a single line `domain: status; tier; price`.
   *
   * @param {Record<string, unknown>} args
   * @returns {Promise<string>}
   */
  async handler(args) {
    const { domains, query, tlds, includePrice } =
      /** @type {{ domains?: string[], query?: string, tlds?: string[], includePrice?: boolean }} */ (
        args
      );
    /** @type {DomainSearchRequestBody} */
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

    const payload = /** @type {DomainSearchResponse | undefined} */ (data);
    const results = Array.isArray(payload?.results) ? payload.results : [];
    if (results.length === 0) return "No domain results returned.";
    return results.map(formatDomainResult).join("\n");
  },
};

/**
 * Render a single search result as a line.
 *
 * @param {DomainSearchResult} result
 * @returns {string}
 */
function formatDomainResult(result) {
  const domain = result.domain || "(unknown)";
  const status = result.available
    ? "available"
    : result.status || "unavailable";
  const premium = result.premium ? "premium" : "standard";
  const price = formatPrice(result.price);
  return `${domain}: ${status}; ${premium}${price ? `; ${price}` : ""}`;
}

/**
 * Render a price record as `CURRENCY AMOUNT`, or an empty string when no
 * price information is available.
 *
 * @param {DomainPrice | undefined} price
 * @returns {string}
 */
function formatPrice(price) {
  if (!price || typeof price.create !== "number") return "";
  const currency = price.currency || "USD";
  return `${currency} ${price.create}`;
}
