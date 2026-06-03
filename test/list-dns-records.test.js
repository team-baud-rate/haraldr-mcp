import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { listDnsRecords } from "../src/tools/list-dns-records.js";

test("list_dns_records exposes tool metadata", () => {
  assert.equal(listDnsRecords.definition.name, "list_dns_records");
});

test("list_dns_records requires a domain argument", async () => {
  await withTempConfig(async () => {
    await assert.rejects(
      () => listDnsRecords.handler({}),
      /domain is required/,
    );
  });
});

test("list_dns_records rejects malformed domains before calling the API", async () => {
  await withTempConfig(async (configHome) => {
    await writeSession(configHome);
    const originalFetch = globalThis.fetch;
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      return new Response("{}", { status: 200 });
    };

    try {
      for (const bad of [
        "example",
        "exa_mple.com",
        "a..com",
        "-bad.com",
        "exämple.com",
      ]) {
        await assert.rejects(
          () => listDnsRecords.handler({ domain: bad }),
          /Invalid domain/,
          `expected "${bad}" to be rejected`,
        );
      }
      assert.equal(called, false, "should not reach the API for bad domains");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("list_dns_records requires a saved session", async () => {
  await withTempConfig(async () => {
    await assert.rejects(
      () => listDnsRecords.handler({ domain: "example.com" }),
      /Not logged in/,
    );
  });
});

test("list_dns_records fetches and formats the records", async () => {
  await withTempConfig(async (configHome) => {
    await writeSession(configHome);
    const calls = [];
    const originalFetch = globalThis.fetch;
    process.env.HARALDR_API_URL = "https://api.example.test";
    globalThis.fetch = async (url, init = {}) => {
      calls.push({ url, method: init.method, headers: init.headers });
      return new Response(
        JSON.stringify({
          ok: true,
          fqdn: "example.com",
          zoneExists: true,
          records: [
            { name: "example.com", type: "A", value: "192.0.2.1", ttl: 3600 },
            {
              name: "example.com",
              type: "MX",
              value: "mail.example.com",
              ttl: 3600,
              prio: 10,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    try {
      const text = await listDnsRecords.handler({ domain: "Example.com" });

      assert.equal(calls.length, 1);
      assert.equal(
        calls[0].url,
        "https://api.example.test/api/domains/example.com/dns",
      );
      assert.equal(calls[0].method, "GET");
      assert.equal(calls[0].headers.Cookie, "harldr_session=session-token");
      assert.equal(
        text,
        "example.com  A  192.0.2.1  ttl=3600\n" +
          "example.com  MX  mail.example.com  ttl=3600  prio=10",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("list_dns_records reports when the domain has no zone", async () => {
  await withTempConfig(async (configHome) => {
    await writeSession(configHome);
    const originalFetch = globalThis.fetch;
    process.env.HARALDR_API_URL = "https://api.example.test";
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          ok: true,
          fqdn: "example.com",
          zoneExists: false,
          records: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    try {
      const text = await listDnsRecords.handler({ domain: "example.com" });
      assert.match(text, /No DNS zone exists for example\.com/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

async function withTempConfig(fn) {
  const originalConfigHome = process.env.XDG_CONFIG_HOME;
  const originalApiUrl = process.env.HARALDR_API_URL;
  const configHome = await fs.mkdtemp(
    path.join(os.tmpdir(), "haraldr-mcp-test-"),
  );
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
    JSON.stringify({
      cookie: "harldr_session=session-token",
      email: "person@example.com",
    }),
  );
}
