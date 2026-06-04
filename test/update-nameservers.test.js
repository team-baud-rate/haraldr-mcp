import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { updateNameservers } from "../src/tools/update-nameservers.js";

test("update_nameservers exposes tool metadata", () => {
  assert.equal(updateNameservers.definition.name, "update_nameservers");
});

test("update_nameservers rejects providing both nameservers and reset", async () => {
  await withTempConfig(async (configHome) => {
    await writeSession(configHome);
    await assert.rejects(
      () =>
        updateNameservers.handler({
          domain: "example.com",
          nameservers: ["ns1.example.net", "ns2.example.net"],
          reset: true,
        }),
      /exactly one/,
    );
  });
});

test("update_nameservers rejects providing neither nameservers nor reset", async () => {
  await withTempConfig(async (configHome) => {
    await writeSession(configHome);
    await assert.rejects(
      () => updateNameservers.handler({ domain: "example.com" }),
      /exactly one/,
    );
  });
});

test("update_nameservers requires a saved session", async () => {
  await withTempConfig(async () => {
    await assert.rejects(
      () =>
        updateNameservers.handler({
          domain: "example.com",
          nameservers: ["ns1.example.net", "ns2.example.net"],
          confirm: true,
        }),
      /Not logged in/,
    );
  });
});

test("update_nameservers sends a custom-nameserver change", async () => {
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
          nameservers: ["aria.ns.cloudflare.com", "rick.ns.cloudflare.com"],
          nsGroup: null,
          usesOpenproviderDns: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    try {
      const text = await updateNameservers.handler({
        domain: "example.com",
        nameservers: ["aria.ns.cloudflare.com", "rick.ns.cloudflare.com"],
        confirm: true,
      });

      assert.equal(calls.length, 1);
      assert.equal(
        calls[0].url,
        "https://api.example.test/api/domains/example.com/nameservers",
      );
      assert.equal(calls[0].method, "PUT");
      assert.equal(calls[0].headers.Cookie, "harldr_session=session-token");
      assert.deepEqual(calls[0].body, {
        nameservers: ["aria.ns.cloudflare.com", "rick.ns.cloudflare.com"],
        confirm: true,
      });
      assert.match(text, /now delegates to custom nameservers/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("update_nameservers sends a reset to Openprovider DNS", async () => {
  await withTempConfig(async (configHome) => {
    await writeSession(configHome);
    const calls = [];
    const originalFetch = globalThis.fetch;
    process.env.HARALDR_API_URL = "https://api.example.test";
    globalThis.fetch = async (url, init = {}) => {
      calls.push({ url, method: init.method, body: JSON.parse(init.body) });
      return new Response(
        JSON.stringify({
          ok: true,
          fqdn: "example.com",
          nameservers: ["ns1.openprovider.nl", "ns2.openprovider.be"],
          nsGroup: "dns-openprovider",
          usesOpenproviderDns: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    try {
      const text = await updateNameservers.handler({
        domain: "example.com",
        reset: true,
      });
      assert.deepEqual(calls[0].body, { reset: true });
      assert.match(text, /reset to Openprovider DNS/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("update_nameservers surfaces the confirmation warning instead of erroring", async () => {
  await withTempConfig(async (configHome) => {
    await writeSession(configHome);
    const originalFetch = globalThis.fetch;
    process.env.HARALDR_API_URL = "https://api.example.test";
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: "confirmation_required",
            message:
              "Changing example.com to custom nameservers will disable Haraldr's DNS management for this domain — its DNS records will no longer be authoritative. Re-run with confirm to proceed.",
          },
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      );

    try {
      const text = await updateNameservers.handler({
        domain: "example.com",
        nameservers: ["aria.ns.cloudflare.com", "rick.ns.cloudflare.com"],
      });
      assert.match(text, /disable Haraldr's DNS management/);
      assert.match(text, /confirm: true/);
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
