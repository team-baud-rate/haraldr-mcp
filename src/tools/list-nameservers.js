import { apiRequest } from "../api.js";
import { normalizeDnsDomain } from "./list-dns-records.js";

/** @typedef {import('../types.js').Tool} Tool */
/** @typedef {import('../types.js').NameserversResponse} NameserversResponse */

/** @type {Tool} */
export const listNameservers = {
  definition: {
    name: "list_nameservers",
    description:
      "Show the authoritative nameservers for a domain registered through Haraldr. If the domain uses Openprovider's nameservers, its DNS records (list_dns_records / update_dns_records) are authoritative; if it points at custom nameservers, those control the domain and the Haraldr-hosted DNS zone is dormant. Requires a logged-in Haraldr session.",
    inputSchema: {
      type: "object",
      required: ["domain"],
      properties: {
        domain: {
          type: "string",
          description:
            "Full domain whose nameservers to show, e.g. example.com.",
        },
      },
      additionalProperties: false,
    },
  },
  /**
   * Fetch and render a domain's authoritative nameservers.
   *
   * @param {Record<string, unknown>} args
   * @returns {Promise<string>}
   */
  async handler(args) {
    const fqdn = normalizeDnsDomain(args.domain);
    const { data } = await apiRequest(
      `/api/domains/${encodeURIComponent(fqdn)}/nameservers`,
      { method: "GET", requireAuth: true },
    );
    return formatNameservers(
      fqdn,
      /** @type {NameserversResponse | undefined} */ (data),
    );
  },
};

/**
 * Render a nameserver response as human-readable text, making the DNS-authority
 * consequence explicit so the caller knows whether Haraldr DNS editing applies.
 *
 * @param {string} fqdn
 * @param {NameserversResponse | undefined} payload
 * @returns {string}
 */
export function formatNameservers(fqdn, payload) {
  const nameservers = Array.isArray(payload?.nameservers)
    ? payload.nameservers
    : [];
  if (payload?.usesOpenproviderDns) {
    const list = nameservers.length > 0 ? nameservers.join(", ") : "(default)";
    return `${fqdn} uses Haraldr DNS (Openprovider group ${payload.nsGroup}); its DNS records are authoritative.\nNameservers: ${list}`;
  }
  if (nameservers.length === 0) {
    return `No nameservers reported for ${fqdn}.`;
  }
  return `${fqdn} delegates to custom nameservers (Haraldr DNS management is disabled for this domain):\n${nameservers
    .map((n) => `  ${n}`)
    .join("\n")}`;
}
