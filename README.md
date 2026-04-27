# @haraldr/domain-tools

MCP server that lets AI agents (Claude Code, Claude Desktop, Cursor, …) authenticate against the Haraldr API and (eventually) manage domains.

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

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `HARALDR_API_URL` | `https://haraldr.joel.net` | Override API origin for local development (e.g. `http://localhost:8787`). |

## Session storage

The session cookie is stored at `~/.config/haraldr/session.json` (mode `0600`). Honours `XDG_CONFIG_HOME` if set. Delete the file to force a re-login.
