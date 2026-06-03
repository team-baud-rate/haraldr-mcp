import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { updateDnsRecords } from "../src/tools/update-dns-records.js";

test("update_dns_records exposes tool metadata", () => {
  assert.equal(updateDnsRecords.definition.name, "update_dns_records");
});

test("update_dns_records rejects an empty change set", async () => {
  await withTempConfig(async (configHome) => {
    await writeSession(configHome);
    await assert.rejects(
      () => updateDnsRecords.handler({ domain: "example.com" }),
      /at least one record/,
    );
  });
});

test("update_dns_records requires a saved session", async () => {
  await withTempConfig(async () => {
    await assert.rejects(
      () =>
        updateDnsRecords.handler({
          domain: "example.com",
          add: [{ name: "www.example.com", type: "A", value: "192.0.2.5" }],
        }),
      /Not logged in/,
    );
  });
});

test("update_dns_records sends add/remove/update operations", async () => {
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
          fqdn: "example.com",
          zoneExists: true,
          zoneCreated: false,
          records: [
            {
              name: "www.example.com",
              type: "A",
              value: "192.0.2.5",
              ttl: 3600,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    try {
      const text = await updateDnsRecords.handler({
        domain: "example.com",
        add: [{ name: "www.example.com", type: "A", value: "192.0.2.5" }],
        remove: [{ name: "old.example.com", type: "A", value: "192.0.2.9" }],
        update: [
          {
            original_record: {
              name: "example.com",
              type: "TXT",
              value: "v1",
            },
            record: { name: "example.com", type: "TXT", value: "v2" },
          },
        ],
      });

      assert.equal(calls.length, 1);
      assert.equal(
        calls[0].url,
        "https://api.example.test/api/domains/example.com/dns",
      );
      assert.equal(calls[0].method, "PUT");
      assert.equal(calls[0].headers.Cookie, "harldr_session=session-token");
      assert.deepEqual(calls[0].body, {
        add: [{ name: "www.example.com", type: "A", value: "192.0.2.5" }],
        remove: [{ name: "old.example.com", type: "A", value: "192.0.2.9" }],
        update: [
          {
            original_record: {
              name: "example.com",
              type: "TXT",
              value: "v1",
            },
            record: { name: "example.com", type: "TXT", value: "v2" },
          },
        ],
      });
      assert.match(text, /DNS records for example\.com updated/);
      assert.match(text, /www\.example\.com {2}A {2}192\.0\.2\.5 {2}ttl=3600/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("update_dns_records reports when a zone was created", async () => {
  await withTempConfig(async (configHome) => {
    await writeSession(configHome);
    const originalFetch = globalThis.fetch;
    process.env.HARALDR_API_URL = "https://api.example.test";
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          ok: true,
          fqdn: "example.com",
          zoneExists: true,
          zoneCreated: true,
          records: [
            { name: "example.com", type: "A", value: "192.0.2.1", ttl: 3600 },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    try {
      const text = await updateDnsRecords.handler({
        domain: "example.com",
        add: [{ name: "example.com", type: "A", value: "192.0.2.1" }],
      });
      assert.match(text, /Created a DNS zone for example\.com/);
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
