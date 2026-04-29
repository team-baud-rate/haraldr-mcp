/// <reference path="../node_modules/@types/node/globals.d.ts" />
/// <reference path="../node_modules/@types/node/fs.d.ts" />
/// <reference path="../node_modules/@types/node/os.d.ts" />
/// <reference path="../node_modules/@types/node/path.d.ts" />
/// <reference path="../node_modules/@types/node/url.d.ts" />
/**
 * Shared type definitions for the @haraldr/domain-tools MCP server.
 * This file is never imported at runtime — only used by tsc via JSDoc.
 *
 * The triple-slash references above selectively pull in just the
 * @types/node declarations we need (the `process` global plus the four
 * `node:*` modules used here). Doing it this way — instead of
 * `<reference types="node" />` — avoids dragging in `process.d.ts`, whose
 * `BuiltInModule` map references `import("punycode")` and would otherwise
 * cause TypeScript to typecheck the JavaScript source of the transitively
 * installed `punycode` package (which `checkJs: true` does not skip).
 */

/**
 * MCP tool definition (subset of the SDK's Tool schema actually used here).
 *
 * @typedef {Object} ToolDefinition
 * @property {string} name
 * @property {string} description
 * @property {{
 *   type: 'object',
 *   properties?: Record<string, unknown>,
 *   required?: string[],
 *   additionalProperties?: boolean,
 * }} inputSchema
 */

/**
 * A registered MCP tool: a JSON-Schema definition plus an async handler that
 * accepts the parsed `arguments` object and returns the human-readable response
 * text shown to the user.
 *
 * @typedef {Object} Tool
 * @property {ToolDefinition} definition
 * @property {(args: Record<string, unknown>) => Promise<string>} handler
 */

/**
 * Options accepted by apiRequest().
 *
 * @typedef {Object} ApiRequestOptions
 * @property {'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'} [method]
 * @property {unknown} [body]
 * @property {boolean} [requireAuth]
 */

/**
 * Result returned by apiRequest(). `data` is the parsed JSON body (or
 * undefined for 204 responses); `cookie` is the extracted Haraldr session
 * cookie if the response set one.
 *
 * @template T
 * @typedef {Object} ApiResponse
 * @property {T | undefined} data
 * @property {string | null} cookie
 */

/**
 * Persisted session record stored at ~/.config/haraldr/session.json.
 *
 * @typedef {Object} Session
 * @property {string} cookie
 * @property {string} email
 * @property {string} [apiUrl]
 * @property {number} [savedAt]
 */

/**
 * One entry from the GET /api/auth/me response.
 *
 * @typedef {Object} AuthUser
 * @property {string} id
 * @property {string} email
 */

/**
 * Server response to POST /api/auth/request-code.
 *
 * @typedef {Object} RequestCodeResponse
 * @property {string} [debugCode]
 */

/**
 * Server response to POST /api/auth/verify-code.
 *
 * @typedef {Object} VerifyCodeResponse
 * @property {AuthUser} [user]
 */

/**
 * Server response to GET /api/auth/me.
 *
 * @typedef {Object} MeResponse
 * @property {AuthUser} [user]
 */

/**
 * One entry from the GET /api/orders/:id response (subset actually consumed).
 *
 * @typedef {Object} Order
 * @property {string} id
 * @property {string} fqdn
 * @property {'pending' | 'paid' | 'registered' | 'failed' | string} status
 * @property {number} [amountCents]
 * @property {string} [currency]
 * @property {string} [openproviderDomainId]
 * @property {string} [failureReason]
 */

/**
 * Server response to GET /api/orders/:id.
 *
 * @typedef {Object} OrderDetailResponse
 * @property {Order} [order]
 * @property {string} [checkoutUrl]
 */

/**
 * Server response to POST /api/orders.
 *
 * @typedef {Object} CreateOrderResponse
 * @property {Order} [order]
 * @property {string} [checkoutUrl]
 */

/**
 * One entry from the GET /api/domains response.
 *
 * @typedef {Object} ListedDomain
 * @property {string} [fqdn]
 * @property {string} [status]
 * @property {string} [expiresAt]
 * @property {boolean | null} [autoRenew]
 * @property {boolean} [isLocked]
 * @property {string[]} [nameservers]
 */

/**
 * Server response to GET /api/domains.
 *
 * @typedef {Object} ListDomainsResponse
 * @property {ListedDomain[]} [domains]
 */

/**
 * Domain price record returned in domain search results.
 *
 * @typedef {Object} DomainPrice
 * @property {string} [currency]
 * @property {number} [create]
 */

/**
 * One entry in the POST /api/domains/search response.
 *
 * @typedef {Object} DomainSearchResult
 * @property {string} [domain]
 * @property {boolean} [available]
 * @property {string} [status]
 * @property {boolean} [premium]
 * @property {DomainPrice} [price]
 */

/**
 * Server response to POST /api/domains/search.
 *
 * @typedef {Object} DomainSearchResponse
 * @property {DomainSearchResult[]} [results]
 */

/**
 * Body accepted by POST /api/domains/search.
 *
 * @typedef {Object} DomainSearchRequestBody
 * @property {string[]} [domains]
 * @property {string} [query]
 * @property {string[]} [tlds]
 * @property {boolean} [includePrice]
 */

/**
 * Generic shape of an error envelope returned by the Haraldr API.
 *
 * @typedef {Object} ApiErrorBody
 * @property {{ code?: string, message?: string }} [error]
 */

/**
 * One MCP target the install command knows how to patch.
 *
 * @typedef {Object} InstallTarget
 * @property {string} agent
 * @property {string} filePath
 * @property {string} parentDir
 */

/**
 * The mcpServers entry value injected into an agent's config.
 *
 * @typedef {Object} McpServerEntry
 * @property {string} command
 * @property {string[]} args
 */

/**
 * Result of patching a single agent config.
 *
 * @typedef {Object} PatchResult
 * @property {InstallTarget} target
 * @property {'patched' | 'unchanged' | 'skipped'} status
 * @property {string} [reason]
 */

/**
 * Result of removing the haraldr entry from a single agent config.
 *
 * @typedef {Object} UninstallResult
 * @property {InstallTarget} target
 * @property {'removed' | 'not-installed' | 'skipped'} status
 * @property {string} [reason]
 */

/**
 * Shape of an agent's config file that we read/write (we only touch mcpServers).
 *
 * @typedef {Object} AgentConfigFile
 * @property {Record<string, McpServerEntry>} [mcpServers]
 */

export {};
