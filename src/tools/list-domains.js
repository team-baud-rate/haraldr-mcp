import { apiRequest } from "../api.js";

/** @typedef {import('../types.js').Tool} Tool */
/** @typedef {import('../types.js').ListedDomain} ListedDomain */
/** @typedef {import('../types.js').ListDomainsResponse} ListDomainsResponse */

/** @type {Tool} */
export const listDomains = {
  definition: {
    name: "list_domains",
    description:
      "List domains registered through Haraldr for the current account, including expiration and lock status. Requires a logged-in Haraldr session.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  /**
   * Fetch the caller's registered domains and render one summary line per
   * domain. Returns "No domains registered." when the list is empty.
   *
   * @returns {Promise<string>}
   */
  async handler() {
    const { data } = await apiRequest("/api/domains", {
      method: "GET",
      requireAuth: true,
    });

    const payload = /** @type {ListDomainsResponse | undefined} */ (data);
    const domains = Array.isArray(payload?.domains) ? payload.domains : [];
    if (domains.length === 0) return "No domains registered.";
    return domains.map(formatDomain).join("\n");
  },
};

/**
 * Render a single registered domain as `fqdn; key=value; ...`.
 *
 * @param {ListedDomain} d
 * @returns {string}
 */
function formatDomain(d) {
  const parts = [d.fqdn || "(unknown)"];
  if (d.status) parts.push(`status=${d.status}`);
  if (d.expiresAt) parts.push(`expires=${d.expiresAt}`);
  if (d.autoRenew !== null && d.autoRenew !== undefined) {
    parts.push(`autorenew=${d.autoRenew ? "on" : "off"}`);
  }
  if (typeof d.isLocked === "boolean") parts.push(`locked=${d.isLocked}`);
  if (Array.isArray(d.nameservers) && d.nameservers.length > 0) {
    parts.push(`ns=${d.nameservers.join(",")}`);
  }
  return parts.join("; ");
}
