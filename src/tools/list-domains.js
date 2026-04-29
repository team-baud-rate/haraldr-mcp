import { apiRequest } from "../api.js";

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
  async handler() {
    const { data } = await apiRequest("/api/domains", {
      method: "GET",
      requireAuth: true,
    });

    const domains = Array.isArray(data?.domains) ? data.domains : [];
    if (domains.length === 0) return "No domains registered.";
    return domains.map(formatDomain).join("\n");
  },
};

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
