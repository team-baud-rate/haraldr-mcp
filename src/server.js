import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { requestLoginCode } from "./tools/request-login-code.js";
import { verifyLoginCode } from "./tools/verify-login-code.js";
import { whoami } from "./tools/whoami.js";
import { logout } from "./tools/logout.js";
import { searchDomains } from "./tools/search-domains.js";
import { orderDomain } from "./tools/order-domain.js";
import { confirmPayment } from "./tools/confirm-payment.js";
import { listDomains } from "./tools/list-domains.js";
import { listDnsRecords } from "./tools/list-dns-records.js";
import { updateDnsRecords } from "./tools/update-dns-records.js";

/** @typedef {import('./types.js').Tool} Tool */

/** @type {Tool[]} */
const tools = [
  requestLoginCode,
  verifyLoginCode,
  whoami,
  logout,
  searchDomains,
  orderDomain,
  confirmPayment,
  listDomains,
  listDnsRecords,
  updateDnsRecords,
];
/** @type {Map<string, Tool>} */
const byName = new Map(tools.map((t) => [t.definition.name, t]));

/**
 * Boot the MCP server: register the tool list/call handlers against the SDK,
 * connect a stdio transport, and resolve once the connection is established.
 * Used as the default entry point when the CLI is invoked with no subcommand.
 *
 * @returns {Promise<void>}
 */
export async function runServer() {
  const server = new Server(
    { name: "haraldr", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => t.definition),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = byName.get(request.params.name);
    if (!tool) {
      return {
        content: [
          { type: "text", text: `Unknown tool: ${request.params.name}` },
        ],
        isError: true,
      };
    }
    try {
      const text = await tool.handler(request.params.arguments ?? {});
      return { content: [{ type: "text", text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text", text: message }], isError: true };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
