import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** @typedef {import('./types.js').InstallTarget} InstallTarget */
/** @typedef {import('./types.js').McpServerEntry} McpServerEntry */
/** @typedef {import('./types.js').PatchResult} PatchResult */
/** @typedef {import('./types.js').AgentConfigFile} AgentConfigFile */

const SERVER_NAME = "haraldr-domain-tools";

/** @type {McpServerEntry} */
const NPX_ENTRY = {
  command: "npx",
  args: ["-y", "@haraldr/domain-tools"],
};

/**
 * Build the mcpServers entry that points at this local checkout instead of npx.
 *
 * @returns {McpServerEntry}
 */
function localEntry() {
  const cliPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "cli.js",
  );
  return { command: "node", args: [cliPath] };
}

/**
 * Compute the list of MCP-host config files we know how to patch on the
 * current platform.
 *
 * @returns {InstallTarget[]}
 */
function candidates() {
  const home = os.homedir();
  const xdg =
    process.env.XDG_CONFIG_HOME && process.env.XDG_CONFIG_HOME.length > 0
      ? process.env.XDG_CONFIG_HOME
      : path.join(home, ".config");

  /** @type {InstallTarget[]} */
  const list = [
    {
      agent: "Claude Code",
      filePath: path.join(home, ".claude.json"),
      parentDir: home,
    },
    {
      agent: "Cursor",
      filePath: path.join(home, ".cursor", "mcp.json"),
      parentDir: path.join(home, ".cursor"),
    },
  ];

  if (process.platform === "darwin") {
    const dir = path.join(home, "Library", "Application Support", "Claude");
    list.push({
      agent: "Claude Desktop",
      filePath: path.join(dir, "claude_desktop_config.json"),
      parentDir: dir,
    });
  } else if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    if (appData) {
      const dir = path.join(appData, "Claude");
      list.push({
        agent: "Claude Desktop",
        filePath: path.join(dir, "claude_desktop_config.json"),
        parentDir: dir,
      });
    }
  } else {
    const dir = path.join(xdg, "Claude");
    list.push({
      agent: "Claude Desktop",
      filePath: path.join(dir, "claude_desktop_config.json"),
      parentDir: dir,
    });
  }

  return list;
}

/**
 * @param {string} p
 * @returns {Promise<boolean>}
 */
async function dirExists(p) {
  try {
    const stat = await fs.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Read and parse a JSON file. Returns `{}` if the file is missing or empty.
 *
 * @param {string} filePath
 * @returns {Promise<AgentConfigFile>}
 */
async function readJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    if (raw.trim().length === 0) return {};
    return JSON.parse(raw);
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === "ENOENT") return {};
    throw err;
  }
}

/**
 * Write JSON atomically: serialize to a sibling tmp file, then rename.
 *
 * @param {string} filePath
 * @param {unknown} data
 * @returns {Promise<void>}
 */
async function writeJsonAtomic(filePath, data) {
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`);
  await fs.rename(tmp, filePath);
}

/**
 * Compare two mcpServers entries for structural equality.
 *
 * @param {McpServerEntry | undefined} a
 * @param {McpServerEntry} b
 * @returns {boolean}
 */
function entriesEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Patch a single agent's config file: add or replace the haraldr-domain-tools
 * entry under `mcpServers`. Returns a status describing what changed.
 *
 * @param {InstallTarget} target
 * @param {McpServerEntry} entry
 * @param {boolean} dryRun
 * @returns {Promise<PatchResult>}
 */
async function patchTarget(target, entry, dryRun) {
  if (!(await dirExists(target.parentDir))) {
    return { target, status: "skipped", reason: "agent not detected" };
  }

  const config = await readJson(target.filePath);
  if (!config.mcpServers || typeof config.mcpServers !== "object") {
    config.mcpServers = {};
  }

  const existing = config.mcpServers[SERVER_NAME];
  if (entriesEqual(existing, entry)) {
    return { target, status: "unchanged" };
  }

  config.mcpServers[SERVER_NAME] = entry;

  if (!dryRun) {
    await writeJsonAtomic(target.filePath, config);
  }
  return { target, status: "patched" };
}

/**
 * Format one row of the install report as fixed-width columns.
 *
 * @param {string} label
 * @param {string} file
 * @param {string} status
 * @returns {string}
 */
function formatRow(label, file, status) {
  const labelCol = label.padEnd(16);
  const fileCol = file.padEnd(60);
  return `${labelCol} ${fileCol} ${status}`;
}

/**
 * CLI entry point for `haraldr-domain-tools install`. Patches every detected
 * agent config and prints a per-target status report.
 *
 * @param {string[]} args
 * @returns {Promise<void>}
 */
export async function runInstall(args) {
  const dryRun = args.includes("--dry-run");
  const local = args.includes("--local");
  const entry = local ? localEntry() : NPX_ENTRY;

  const mode = local
    ? `local (${entry.args[0]})`
    : "npx (@haraldr/domain-tools)";
  console.log(
    `Installing @haraldr/domain-tools as "${SERVER_NAME}" — ${mode}${dryRun ? " (dry run)" : ""}\n`,
  );

  const targets = candidates();
  const results = await Promise.all(
    targets.map((t) => patchTarget(t, entry, dryRun)),
  );

  for (const r of results) {
    const home = os.homedir();
    const display = r.target.filePath.startsWith(home)
      ? `~${r.target.filePath.slice(home.length)}`
      : r.target.filePath;
    let mark;
    let note;
    if (r.status === "patched") {
      mark = dryRun ? "~" : "✓";
      note = dryRun ? "would patch" : "patched";
    } else if (r.status === "unchanged") {
      mark = "=";
      note = "already configured";
    } else {
      mark = "·";
      note = r.reason ?? "skipped";
    }
    console.log(`${mark} ${formatRow(r.target.agent, display, note)}`);
  }

  const patched = results.filter((r) => r.status === "patched").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  console.log(
    `\nDone. ${patched} ${dryRun ? "would be" : ""} updated, ${skipped} skipped.`,
  );
  if (!dryRun && patched > 0) {
    console.log("Restart your AI agent to pick up the new MCP server.");
  }
}
