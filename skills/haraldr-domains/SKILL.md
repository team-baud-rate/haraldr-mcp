---
name: haraldr-domains
description: Search for available domain names and buy them through Haraldr. Use this skill whenever the user wants to find, check availability of, register, purchase, or buy a domain name (.com, .io, .net, etc.), brainstorm domain ideas for a project/startup/blog, confirm a Stripe payment for a domain, list domains they've already registered, view or edit DNS records, or change a domain's nameservers (e.g. point it at Cloudflare) — even if they don't explicitly mention "Haraldr" by name.
---

# Haraldr Domains

Help the user find a domain name, buy it, and manage its DNS. Haraldr is a domain registrar; this skill orchestrates the `haraldr` MCP tools so the user gets from "I want a domain" to "the domain is registered and pointing where I want" without re-deriving the workflow each session.

## When to use this skill

Trigger on any of these:

- Checking availability of a specific name (`is acme.io taken?`)
- Brainstorming names from a description (`a domain for my coffee subscription startup`)
- Buying / ordering / registering a domain
- Following up after Stripe checkout (`did my payment go through?`)
- Listing domains the user already owns through Haraldr
- Viewing or editing DNS records (`point acme.io at my server`, `add a TXT record`)
- Viewing or changing nameservers (`what nameservers does acme.io use?`, `move my DNS to Cloudflare`)

If the user wants to *manage a domain registered elsewhere*, this skill doesn't apply — Haraldr only manages domains it sold. DNS for domains registered **through Haraldr** is in scope (see [Managing DNS](#managing-dns)).

## Required MCP

This skill uses the `haraldr` MCP server. If `search_domains`, `order_domain`, etc. aren't in the available tools, tell the user to install it:

```sh
npx haraldr@latest install
```

…then restart their AI agent.

## Authentication

Every domain tool requires a logged-in session, so always confirm auth first.

1. Call `whoami`.
2. If it reports "Logged in as …", proceed.
3. If it reports no session or a session-expired state, run the login flow:
   - Ask the user for their email.
   - Call `request_login_code` with that email.
   - Tell the user to check their inbox for a 6-digit code from Haraldr and paste it into the chat.
   - Call `verify_login_code` with the email and code.

Don't fabricate a code or assume one. If the user can't find the email, suggest checking spam, then offer to call `request_login_code` again.

## Searching for a domain

Two modes, depending on intent.

**Exact-name lookup** — the user named a specific domain:

```
search_domains({ domains: ["acme.io"] })
```

You can pass several names at once when it's natural to compare (e.g., `acme.com`, `acme.io`, `acme.dev`).

**Idea generation** — the user described a concept but doesn't have a name:

```
search_domains({ query: "coffee subscription startup", tlds: ["com", "io", "co"] })
```

Pick TLDs that fit the use case (`.com` and `.io` for tech; `.dev` for developer tools; `.co` and `.app` as fallbacks). Pricing is included by default.

**Presenting results.** Show a compact table with columns: name, status, tier, price. Lead with available names; group taken ones at the bottom or omit them unless the user asked specifically. Example:

| Domain | Status | Price |
| --- | --- | --- |
| beanbox.io | available | USD 39 |
| beanbox.co | available | USD 25 |
| beanbox.com | unavailable | — |

If everything is taken, *don't give up* — propose 2-3 keyword variations (`bean-box`, `beandrop`, `morningbean`) and re-search.

## Ordering

Domains are a flat $15 USD through Haraldr regardless of TLD list price (Haraldr eats the difference for non-premium TLDs). Before calling `order_domain`:

- Confirm the **exact** name with the user (`To confirm: order beanbox.io for $15?`).
- Make sure they're aware payment happens via Stripe Checkout in their browser.

Then call:

```
order_domain({ domain: "beanbox.io" })
```

The response contains an order id and a Stripe Checkout URL. Surface the URL prominently — that's the next user action:

> Order `ord_abc123` created for **beanbox.io**. To pay, open this URL in your browser:
> https://checkout.stripe.com/...
>
> Once you've completed payment, tell me and I'll confirm the registration.

**Important:** the domain is *not* registered yet at this point. Don't say "you now own beanbox.io" until `confirm_payment` returns `registered`.

## Confirming payment

When the user reports paying (or asks "did it go through?"), call:

```
confirm_payment({ orderId: "ord_abc123" })
```

The order status walks through this state machine:

| Status | Meaning | What to do |
| --- | --- | --- |
| `pending` | Stripe hasn't reported payment yet | Re-share the checkout URL; offer to retry in ~30s |
| `paid` | Payment cleared, registration in flight | Wait ~10-30s, then call `confirm_payment` again |
| `registered` | Done | Tell the user the domain is theirs; offer `list_domains` |
| `failed` | Registration failed after payment | Show the failure reason; tell the user to contact support |

Stripe webhooks can take a moment, so a `pending` result right after a user pays usually just means the webhook hasn't landed. Don't assume failure on the first `pending` — offer a retry.

## Listing domains

For "what domains do I own?" or "show me my domains":

```
list_domains()
```

Output is one line per domain with status, expiration, autorenew, and lock state. Render as a small table when there's more than one.

## Managing DNS

For domains registered through Haraldr, you can view and edit DNS records.

These records are authoritative only while the domain uses Haraldr DNS — its default state. If the domain has been delegated to custom nameservers (see [Managing nameservers](#managing-nameservers)), the records here remain stored but have no effect. When DNS edits don't seem to take effect, or the user mentions an outside DNS provider, check `list_nameservers` before editing records.

**Viewing.** For "what DNS records does acme.io have?" or before any edit:

```
list_dns_records({ domain: "acme.io" })
```

Each line is `name  TYPE  value  ttl=…  [prio=…]`. If the domain has no DNS zone yet, the tool says so — the zone is created automatically on the first record you add.

**Editing.** Use `update_dns_records` with any combination of `add`, `remove`, and `update`:

```
update_dns_records({
  domain: "acme.io",
  add: [{ name: "acme.io", type: "A", value: "192.0.2.10" }],
})
```

Rules to follow:

- **Always `list_dns_records` first** before a `remove` or `update`. Those operations must match an existing record *exactly* (name, type, value, ttl, prio) — copy the values from the listing rather than guessing.
- An `update` entry needs both `original_record` (the current record) and `record` (the desired state).
- `name` is the full hostname: the apex is the bare domain (`acme.io`), a subdomain is `www.acme.io`.
- `ttl` defaults to 3600 and must be one of 900, 3600, 10800, 21600, 43200, 86400.
- `prio` is required for `MX` and `SRV` records and ignored for others.
- Confirm destructive edits with the user first (`To confirm: remove the A record for acme.io → 192.0.2.10?`). DNS changes take effect quickly and can break a live site.

If the user is changing where their domain points (web host, email provider), they usually have records to apply from that provider — ask for them rather than inventing values.

## Managing nameservers

A domain's nameservers control *where* its DNS is hosted. Domains registered through Haraldr start on Openprovider's nameservers, which is what makes the records in [Managing DNS](#managing-dns) authoritative. Delegating to custom nameservers (Cloudflare, Route 53, etc.) hands DNS control to that provider and makes Haraldr's DNS tools inert for the domain until it's reset.

**Viewing.** For "what nameservers does acme.io use?" or to check whether Haraldr DNS applies:

```
list_nameservers({ domain: "acme.io" })
```

The output says explicitly whether the domain uses Haraldr DNS or delegates to custom nameservers.

**Delegating to custom nameservers** — e.g. the user wants to manage DNS at Cloudflare:

```
update_nameservers({
  domain: "acme.io",
  nameservers: ["aria.ns.cloudflare.com", "rick.ns.cloudflare.com"],
})
```

Rules to follow:

- Provide 2-13 hostnames, copied from the target DNS provider. Ask the user for them rather than guessing — every provider assigns its own.
- If the domain currently uses Haraldr DNS, the first call does **not** apply the change — it returns a warning that switching disables Haraldr's DNS management (existing records stay stored but stop being authoritative). Relay that warning, get the user's explicit go-ahead, then re-run the same call with `confirm: true`.
- Never pass `confirm: true` on the first attempt or on the user's behalf — the confirmation exists so the user consciously accepts losing Haraldr DNS management.
- Registry propagation can take time. If the user immediately asks "why isn't it working", suggest waiting (minutes to hours) before debugging.

**Returning to Haraldr DNS:**

```
update_nameservers({ domain: "acme.io", reset: true })
```

This points the domain back at Openprovider's nameservers and re-enables its Haraldr-hosted zone — any records still in it (`list_dns_records`) become authoritative again. No confirmation is needed.

## Logout

Call `logout` when the user explicitly asks to sign out, or when they're handing the machine to someone else. Don't logout unprompted — sessions are durable and convenient.

## Error patterns

- **HTTP 401 / "session expired"** — call `request_login_code` again. The session file gets cleared automatically on 401.
- **Domain taken between search and order** — re-run `search_domains` for the exact name; if still unavailable, suggest alternatives.
- **`order_domain` succeeded but no checkout URL** — surface the error verbatim and stop; this is a Haraldr-side issue.
- **`confirm_payment` returns `failed`** — the user's card was charged but registration failed at the registry. Point them at support; don't retry the order (you'd double-charge).

## What not to do

- Don't invent prices, TLDs, or availability — always go through `search_domains`.
- Don't claim a domain is registered before `confirm_payment` returns `registered`.
- Don't echo the session cookie or any contents of `~/.config/haraldr/session.json`.
- Don't retry `order_domain` after a payment failure — that creates a second order.
- Don't ask the user for their password — Haraldr uses email codes only.
- Don't pass `confirm: true` to `update_nameservers` without first showing the user the warning and getting their explicit OK.
