import { apiRequest } from "../api.js";

/** @typedef {import('../types.js').Tool} Tool */
/** @typedef {import('../types.js').DnsRecord} DnsRecord */
/** @typedef {import('../types.js').DnsRecordsResponse} DnsRecordsResponse */

/** @type {Tool} */
export const listDnsRecords = {
  definition: {
    name: "list_dns_records",
    description:
      "List the DNS records for a domain registered through Haraldr. Returns one line per record (name, type, value, TTL, and priority for MX/SRV). Requires a logged-in Haraldr session.",
    inputSchema: {
      type: "object",
      required: ["domain"],
      properties: {
        domain: {
          type: "string",
          description:
            "Full domain whose DNS records to list, e.g. example.com.",
        },
      },
      additionalProperties: false,
    },
  },
  /**
   * Fetch and render the DNS records for an owned domain.
   *
   * @param {Record<string, unknown>} args
   * @returns {Promise<string>}
   */
  async handler(args) {
    const fqdn = normalizeDnsDomain(args.domain);
    const { data } = await apiRequest(
      `/api/domains/${encodeURIComponent(fqdn)}/dns`,
      { method: "GET", requireAuth: true },
    );
    const payload = /** @type {DnsRecordsResponse | undefined} */ (data);
    return formatDnsRecords(fqdn, payload);
  },
};

/** A single DNS label: 1–63 alphanumerics with internal hyphens only. */
const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Validate and normalize a user-supplied domain into a lowercase FQDN.
 * Shared by the list_dns_records and update_dns_records tools.
 *
 * Rejects anything the Worker's `[a-z0-9.-]` route would not accept — domains
 * with underscores, non-ASCII characters, empty labels, or labels that start or
 * end with a hyphen — so invalid input fails here with a clear message instead
 * of reaching the API as a confusing 404.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeDnsDomain(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("domain is required");
  }
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, "");
  const labels = normalized.split(".");
  const valid =
    normalized.length <= 253 &&
    labels.length >= 2 &&
    labels.every((label) => DOMAIN_LABEL.test(label));
  if (!valid) {
    throw new Error(
      `Invalid domain "${value}". Use a full domain like example.com.`,
    );
  }
  return normalized;
}

/**
 * Render a DNS records response as human-readable text.
 *
 * @param {string} fqdn
 * @param {DnsRecordsResponse | undefined} payload
 * @returns {string}
 */
export function formatDnsRecords(fqdn, payload) {
  if (payload?.zoneExists === false) {
    return `No DNS zone exists for ${fqdn} yet. Add a record to create one.`;
  }
  const records = Array.isArray(payload?.records) ? payload.records : [];
  if (records.length === 0) {
    return `No DNS records for ${fqdn}.`;
  }
  return records.map(formatDnsRecord).join("\n");
}

/**
 * Render a single DNS record as `name  TYPE  value  ttl=…  [prio=…]`.
 *
 * @param {DnsRecord} record
 * @returns {string}
 */
function formatDnsRecord(record) {
  const parts = [
    record.name || "(unknown)",
    record.type || "?",
    record.value || "",
  ];
  if (typeof record.ttl === "number") parts.push(`ttl=${record.ttl}`);
  if (typeof record.prio === "number") parts.push(`prio=${record.prio}`);
  return parts.join("  ");
}
