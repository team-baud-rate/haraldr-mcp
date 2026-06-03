import { ApiError, apiRequest } from "../api.js";
import { normalizeDnsDomain } from "./list-dns-records.js";
import { formatNameservers } from "./list-nameservers.js";

/** @typedef {import('../types.js').Tool} Tool */
/** @typedef {import('../types.js').NameserversResponse} NameserversResponse */

/** @type {Tool} */
export const updateNameservers = {
  definition: {
    name: "update_nameservers",
    description:
      "Change the authoritative nameservers for a domain registered through Haraldr. Provide `nameservers` (2-13 hostnames) to delegate to custom nameservers — e.g. to manage DNS at Cloudflare. Doing so disables Haraldr's built-in DNS management for the domain (its DNS records are no longer authoritative), so the first attempt returns a warning that must be acknowledged by re-running with `confirm: true`. Alternatively pass `reset: true` to return the domain to Openprovider's nameservers, re-enabling Haraldr DNS. Provide exactly one of `nameservers` or `reset`. Requires a logged-in Haraldr session.",
    inputSchema: {
      type: "object",
      required: ["domain"],
      properties: {
        domain: {
          type: "string",
          description:
            "Full domain whose nameservers to change, e.g. example.com.",
        },
        nameservers: {
          type: "array",
          minItems: 2,
          maxItems: 13,
          items: { type: "string" },
          description:
            "Custom nameserver hostnames to delegate to, e.g. aria.ns.cloudflare.com.",
        },
        reset: {
          type: "boolean",
          description:
            "Set true to reset the domain to Openprovider DNS. Mutually exclusive with nameservers.",
        },
        confirm: {
          type: "boolean",
          description:
            "Set true to acknowledge that switching to custom nameservers disables Haraldr DNS management for this domain.",
        },
      },
      additionalProperties: false,
    },
  },
  /**
   * Delegate a domain to custom nameservers, or reset it to Openprovider DNS.
   *
   * @param {Record<string, unknown>} args
   * @returns {Promise<string>}
   */
  async handler(args) {
    const fqdn = normalizeDnsDomain(args.domain);
    const hasNameservers =
      Array.isArray(args.nameservers) && args.nameservers.length > 0;
    const wantsReset = args.reset === true;
    if (hasNameservers === wantsReset) {
      throw new Error(
        "Provide exactly one of `nameservers` (2-13 hostnames) or `reset: true`.",
      );
    }

    const body = wantsReset
      ? { reset: true }
      : { nameservers: args.nameservers, confirm: args.confirm === true };

    let data;
    try {
      ({ data } = await apiRequest(
        `/api/domains/${encodeURIComponent(fqdn)}/nameservers`,
        { method: "PUT", body, requireAuth: true },
      ));
    } catch (err) {
      // The API gates the DNS-disabling switch behind a confirmation. Surface the
      // warning as a normal result so the user can confirm and re-run, rather than
      // a hard error.
      if (err instanceof ApiError && err.code === "confirmation_required") {
        return `${err.message}\n\nRe-run update_nameservers with confirm: true to apply this change.`;
      }
      throw err;
    }

    const payload = /** @type {NameserversResponse | undefined} */ (data);
    const header = wantsReset
      ? `${fqdn} reset to Openprovider DNS.`
      : `${fqdn} now delegates to custom nameservers.`;
    return `${header}\n\n${formatNameservers(fqdn, payload)}`;
  },
};
