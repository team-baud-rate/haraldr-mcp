# @haraldr/domain-tools

MCP server that lets AI agents (Claude Code, Claude Desktop, Cursor, …) authenticate against the Haraldr API and search domain availability.

## Install

Auto-detect installed AI agents and add the server to each:

```sh
npx @haraldr/domain-tools install
```

This patches the `mcpServers` object in any of these files that exist:

- Claude Code — `~/.claude.json`
- Claude Desktop — `~/.config/Claude/claude_desktop_config.json` (Linux), `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS), `%APPDATA%/Claude/claude_desktop_config.json` (Windows)
- Cursor — `~/.cursor/mcp.json`

Use `--dry-run` to preview changes. For local development against a checkout (before publishing to npm), use `--local`:

```sh
node src/cli.js install --local
```

This writes a `node <abs-path-to-src/cli.js>` entry instead of `npx @haraldr/domain-tools`.

## Tools

| Tool | Purpose |
|---|---|
| `request_login_code` | Request a 6-digit login code by email. |
| `verify_login_code` | Verify the code; persists session cookie to `~/.config/haraldr/session.json`. |
| `whoami` | Show the currently logged-in user. |
| `logout` | Clear the session locally and on the server. |
| `search_domains` | Search exact domains and keyword-generated ideas. Requires login. |
| `order_domain` | Order a domain for $15. Returns a Stripe Checkout URL the user opens in a browser. Requires login. |
| `confirm_payment` | Verify a previously created order has been paid and report whether the domain has been registered. Requires login. |

### Ordering a domain

1. Use `search_domains` to find an available name.
2. Call `order_domain` with the FQDN (e.g. `example.com`). The tool returns a Stripe Checkout URL.
3. Open the URL in a browser, complete payment with the billing details Stripe collects (these are reused as the Openprovider registrant contact).
4. Tell the agent you've paid; the agent calls `confirm_payment` with the order id from step 2. The API verifies via Stripe webhook (with a polling fallback) and registers the domain through Openprovider.

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `HARALDR_API_URL` | `https://haraldr.joel.net` | Override API origin for local development (e.g. `http://localhost:8787`). |

`search_domains` calls `POST /api/domains/search`, so the Haraldr API Worker must be configured with Openprovider credentials or a current Openprovider bearer token.

## Session storage

The session cookie is stored at `~/.config/haraldr/session.json` (mode `0600`). Honours `XDG_CONFIG_HOME` if set. Delete the file to force a re-login.
