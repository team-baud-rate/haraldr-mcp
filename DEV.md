# Development

## Local install

To register the server against a local checkout (before publishing to npm), use `--local`:

```sh
node src/cli.js install --local
```

This writes a `node <abs-path-to-src/cli.js>` entry instead of `npx haraldr`. Use `--dry-run` to preview changes.

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `HARALDR_API_URL` | `https://haraldr.joel.net` | Override API origin for local development (e.g. `http://localhost:8787`). |

`search_domains` calls `POST /api/domains/search`, so the Haraldr API Worker must be configured with Openprovider credentials or a current Openprovider bearer token.

## Session storage

The session cookie is stored at `~/.config/haraldr/session.json` (mode `0600`). Honours `XDG_CONFIG_HOME` if set. Delete the file to force a re-login.

## Config file locations

The `install` command patches the `mcpServers` object in any of these files that exist:

- Claude Code — `~/.claude.json`
- Claude Desktop — `~/.config/Claude/claude_desktop_config.json` (Linux), `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS), `%APPDATA%/Claude/claude_desktop_config.json` (Windows)
- Cursor — `~/.cursor/mcp.json`

## Scripts

```sh
npm test          # Run the test suite
npm run lint      # ESLint (runs typecheck first)
npm run lint:fix  # ESLint with --fix
npm run typecheck # tsc against jsconfig.json
```
