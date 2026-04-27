import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SERVER_NAME = "haraldr-domain-tools";

const NPX_ENTRY = {
  command: "npx",
  args: ["-y", "@haraldr/domain-tools"],
};

function localEntry() {
  const cliPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "cli.js");
  return { command: "node", args: [cliPath] };
}

function candidates() {
  const home = os.homedir();
  const xdg = process.env.XDG_CONFIG_HOME && process.env.XDG_CONFIG_HOME.length > 0
    ? process.env.XDG_CONFIG_HOME
    : path.join(home, ".config");

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

async function dirExists(p) {
  try {
    const stat = await fs.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    if (raw.trim().length === 0) return {};
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return {};
    throw err;
  }
}

async function writeJsonAtomic(filePath, data) {
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`);
  await fs.rename(tmp, filePath);
}

function entriesEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

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

function formatRow(label, file, status) {
  const labelCol = label.padEnd(16);
  const fileCol = file.padEnd(60);
  return `${labelCol} ${fileCol} ${status}`;
}

export async function runInstall(args) {
  const dryRun = args.includes("--dry-run");
  const local = args.includes("--local");
  const entry = local ? localEntry() : NPX_ENTRY;

  const mode = local ? `local (${entry.args[0]})` : "npx (@haraldr/domain-tools)";
  console.log(
    `Installing @haraldr/domain-tools as "${SERVER_NAME}" — ${mode}${dryRun ? " (dry run)" : ""}\n`,
  );

  const targets = candidates();
  const results = await Promise.all(targets.map((t) => patchTarget(t, entry, dryRun)));

  for (const r of results) {
    const home = os.homedir();
    const display = r.target.filePath.startsWith(home) ? `~${r.target.filePath.slice(home.length)}` : r.target.filePath;
    let mark = "-";
    let note = "";
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
