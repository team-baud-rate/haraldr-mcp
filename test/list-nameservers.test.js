import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { listNameservers } from "../src/tools/list-nameservers.js";

test("list_nameservers exposes tool metadata", () => {
  assert.equal(listNameservers.definition.name, "list_nameservers");
});

test("list_nameservers requires a saved session", async () => {
  await withTempConfig(async () => {
    await assert.rejects(
      () => listNameservers.handler({ domain: "example.com" }),
      /Not logged in/,
    );
  });
});

test("list_nameservers renders a domain on Haraldr DNS", async () => {
  await withTempConfig(async (configHome) => {
    await writeSession(configHome);
    const originalFetch = globalThis.fetch;
    process.env.HARALDR_API_URL = "https://api.example.test";
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          ok: true,
          fqdn: "example.com",
          nameservers: ["ns1.openprovider.nl", "ns2.openprovider.be"],
          nsGroup: "dns-openprovider",
          usesOpenproviderDns: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    try {
      const text = await listNameservers.handler({ domain: "example.com" });
      assert.match(text, /uses Haraldr DNS/);
      assert.match(text, /ns1\.openprovider\.nl, ns2\.openprovider\.be/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("list_nameservers renders a domain on custom nameservers", async () => {
  await withTempConfig(async (configHome) => {
    await writeSession(configHome);
    const originalFetch = globalThis.fetch;
    process.env.HARALDR_API_URL = "https://api.example.test";
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          ok: true,
          fqdn: "example.com",
          nameservers: ["aria.ns.cloudflare.com", "rick.ns.cloudflare.com"],
          nsGroup: null,
          usesOpenproviderDns: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    try {
      const text = await listNameservers.handler({ domain: "example.com" });
      assert.match(text, /custom nameservers/);
      assert.match(text, /Haraldr DNS management is disabled/);
      assert.match(text, /aria\.ns\.cloudflare\.com/);
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
