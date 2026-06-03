import { apiRequest } from "../api.js";
import { formatDnsRecords, normalizeDnsDomain } from "./list-dns-records.js";

/** @typedef {import('../types.js').Tool} Tool */
/** @typedef {import('../types.js').DnsRecordsResponse} DnsRecordsResponse */

/** JSON-Schema for a single DNS record argument. */
const recordSchema = {
  type: "object",
  required: ["name", "type", "value"],
  properties: {
    name: {
      type: "string",
      description:
        "Full record hostname, e.g. www.example.com (use the apex example.com for the root).",
    },
    type: {
      type: "string",
      enum: [
        "A",
        "AAAA",
        "CNAME",
        "MX",
        "TXT",
        "NS",
        "SRV",
        "CAA",
        "TLSA",
        "SSHFP",
        "SPF",
      ],
      description: "DNS record type.",
    },
    value: { type: "string", description: "Record value." },
    ttl: {
      type: "number",
      enum: [900, 3600, 10800, 21600, 43200, 86400],
      description: "Time to live in seconds. Defaults to 3600.",
    },
    prio: {
      type: "number",
      description: "Priority (0-65535). Required for MX and SRV records.",
    },
  },
  additionalProperties: false,
};

/** @type {Tool} */
export const updateDnsRecords = {
  definition: {
    name: "update_dns_records",
    description:
      "Add, remove, or change DNS records for a domain registered through Haraldr. Pass any combination of `add`, `remove`, and `update` operations. For `remove` and `update`, call list_dns_records first to obtain the exact current records (they must match exactly). If the domain has no DNS zone yet, the first call must contain only `add` operations — it creates the zone. Requires a logged-in Haraldr session.",
    inputSchema: {
      type: "object",
      required: ["domain"],
      properties: {
        domain: {
          type: "string",
          description: "Full domain whose DNS to edit, e.g. example.com.",
        },
        add: {
          type: "array",
          description: "Records to add to the zone.",
          items: recordSchema,
        },
        remove: {
          type: "array",
          description:
            "Records to remove. Each must exactly match an existing record.",
          items: recordSchema,
        },
        update: {
          type: "array",
          description:
            "Records to change in place; `original_record` must exactly match an existing record.",
          items: {
            type: "object",
            required: ["original_record", "record"],
            properties: {
              original_record: recordSchema,
              record: recordSchema,
            },
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    },
  },
  /**
   * Apply add/remove/update DNS operations to an owned domain.
   *
   * @param {Record<string, unknown>} args
   * @returns {Promise<string>}
   */
  async handler(args) {
    const fqdn = normalizeDnsDomain(args.domain);

    /** @type {Record<string, unknown>} */
    const body = {};
    let opCount = 0;
    for (const key of ["add", "remove", "update"]) {
      const value = args[key];
      if (value === undefined || value === null) continue;
      if (!Array.isArray(value)) {
        throw new Error(`"${key}" must be an array of records.`);
      }
      if (value.length > 0) {
        body[key] = value;
        opCount += value.length;
      }
    }
    if (opCount === 0) {
      throw new Error("Provide at least one record to add, remove, or update.");
    }

    const { data } = await apiRequest(
      `/api/domains/${encodeURIComponent(fqdn)}/dns`,
      { method: "PUT", body, requireAuth: true },
    );
    const payload = /** @type {DnsRecordsResponse | undefined} */ (data);

    const header = payload?.zoneCreated
      ? `Created a DNS zone for ${fqdn} and applied your changes.`
      : `DNS records for ${fqdn} updated.`;
    return `${header}\n\n${formatDnsRecords(fqdn, payload)}`;
  },
};
