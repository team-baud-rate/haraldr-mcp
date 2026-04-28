import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { searchDomains } from "../src/tools/search-domains.js";

test("search_domains exposes tool metadata", () => {
  assert.equal(searchDomains.definition.name, "search_domains");
});

test("search_domains requires a saved session", async () => {
  await withTempConfig(async () => {
    await assert.rejects(
      () => searchDomains.handler({ domains: ["example.com"] }),
      /Not logged in/,
    );
  });
});

test("search_domains calls the API and formats results", async () => {
  await withTempConfig(async (configHome) => {
    await writeSession(configHome);
    const calls = [];
    const originalFetch = globalThis.fetch;
    process.env.HARALDR_API_URL = "https://api.example.test";
    globalThis.fetch = async (url, init = {}) => {
      calls.push({
        url,
        method: init.method,
        headers: init.headers,
        body: JSON.parse(init.body),
      });
      return new Response(
        JSON.stringify({
          ok: true,
          results: [
            {
              domain: "example.com",
              available: true,
              status: "free",
              premium: false,
              price: { currency: "USD", create: 8.06 },
            },
            {
              domain: "taken.com",
              available: false,
              status: "active",
              premium: true,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    try {
      const text = await searchDomains.handler({
        domains: ["example.com"],
        query: "example startup",
        tlds: ["com", "io"],
        includePrice: true,
      });

      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, "https://api.example.test/api/domains/search");
      assert.equal(calls[0].headers.Cookie, "harldr_session=session-token");
      assert.deepEqual(calls[0].body, {
        domains: ["example.com"],
        query: "example startup",
        tlds: ["com", "io"],
        includePrice: true,
      });
      assert.equal(
        text,
        "example.com: available; standard; USD 8.06\ntaken.com: active; premium",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

async function withTempConfig(fn) {
  const originalConfigHome = process.env.XDG_CONFIG_HOME;
  const originalApiUrl = process.env.HARALDR_API_URL;
  const configHome = await fs.mkdtemp(path.join(os.tmpdir(), "haraldr-mcp-test-"));
  process.env.XDG_CONFIG_HOME = configHome;
  delete process.env.HARALDR_API_URL;
  try {
    await fn(configHome);
  } finally {
    if (originalConfigHome === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = originalConfigHome;
    }
    if (originalApiUrl === undefined) {
      delete process.env.HARALDR_API_URL;
    } else {
      process.env.HARALDR_API_URL = originalApiUrl;
    }
    await fs.rm(configHome, { recursive: true, force: true });
  }
}

async function writeSession(configHome) {
  const dir = path.join(configHome, "haraldr");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, "session.json"),
    JSON.stringify({ cookie: "harldr_session=session-token", email: "person@example.com" }),
  );
}
