# haraldr

Search and register domain names directly from your AI agent.

This MCP server connects Claude Code, Claude Desktop, Cursor, and other compatible AI tools to [Haraldr](https://haraldr.joel.net) so you can find a great domain name and buy it without leaving the conversation.

## Install

One command sets it up for every AI agent it finds on your machine:

```sh
npx haraldr@latest install
```

That's it — restart your agent and the tools are ready to use.

> The `@latest` tag is intentional: `npx` caches packages under `~/.npm/_npx/`, so the bare form may reuse a stale install command months later. `@latest` always pulls the newest version. The MCP server entry it writes into your agent config uses the cached form, so agent startup stays fast.

To remove it later:

```sh
npx haraldr@latest uninstall
```

## What you can do

Ask your agent things like:

- *"Find me an available `.com` domain for a coffee subscription startup."*
- *"Is `mycoolapp.io` available?"*
- *"Order `example.com` for me."*
- *"Did my domain payment go through?"*

## Tools

| Tool | What it does |
|---|---|
| `request_login_code` | Email yourself a 6-digit login code. |
| `verify_login_code` | Sign in with the code. |
| `whoami` | Show who's currently signed in. |
| `logout` | Sign out. |
| `search_domains` | Check exact names and discover keyword-based ideas. |
| `order_domain` | Order a domain for $15 — returns a Stripe checkout link. |
| `confirm_payment` | Confirm payment and registration after checkout. |
| `list_domains` | List the domains registered through Haraldr. |
| `list_dns_records` | List the DNS records for a registered domain. |
| `update_dns_records` | Add, remove, or change DNS records for a registered domain. |
| `list_nameservers` | Show a registered domain's authoritative nameservers. |
| `update_nameservers` | Point a registered domain at custom nameservers (e.g. Cloudflare) or reset to Haraldr DNS. |

## Buying a domain

1. Ask your agent to **search** for a name you like.
2. Ask it to **order** the domain — you'll get a Stripe checkout URL.
3. Open the URL, pay, and Stripe collects the billing details used as your registrant contact.
4. Tell your agent you've paid, and it'll **confirm** the order and register the domain for you.

## Links

- Haraldr — <https://haraldr.joel.net>
- Source & contributing — see [DEV.md](./DEV.md)

## License

MIT
