import os from "node:os";

import {
  SERVER_NAME,
  candidates,
  dirExists,
  formatRow,
  readJson,
  writeJsonAtomic,
} from "./install.js";

/** @typedef {import('./types.js').InstallTarget} InstallTarget */
/** @typedef {import('./types.js').UninstallResult} UninstallResult */

/**
 * Remove the haraldr-domain-tools entry from a single agent's config file.
 *
 * @param {InstallTarget} target
 * @param {boolean} dryRun
 * @returns {Promise<UninstallResult>}
 */
async function unpatchTarget(target, dryRun) {
  if (!(await dirExists(target.parentDir))) {
    return { target, status: "skipped", reason: "agent not detected" };
  }

  const config = await readJson(target.filePath);
  if (
    !config.mcpServers ||
    typeof config.mcpServers !== "object" ||
    !(SERVER_NAME in config.mcpServers)
  ) {
    return { target, status: "not-installed" };
  }

  delete config.mcpServers[SERVER_NAME];

  if (!dryRun) {
    await writeJsonAtomic(target.filePath, config);
  }
  return { target, status: "removed" };
}

/**
 * CLI entry point for `haraldr-domain-tools uninstall`. Removes the server
 * entry from every detected agent config and prints a per-target report.
 *
 * @param {string[]} args
 * @returns {Promise<void>}
 */
export async function runUninstall(args) {
  const dryRun = args.includes("--dry-run");

  console.log(
    `Removing "${SERVER_NAME}" from agent configs${dryRun ? " (dry run)" : ""}\n`,
  );

  const targets = candidates();
  const results = await Promise.all(
    targets.map((t) => unpatchTarget(t, dryRun)),
  );

  for (const r of results) {
    const home = os.homedir();
    const display = r.target.filePath.startsWith(home)
      ? `~${r.target.filePath.slice(home.length)}`
      : r.target.filePath;
    let mark;
    let note;
    if (r.status === "removed") {
      mark = dryRun ? "~" : "✓";
      note = dryRun ? "would remove" : "removed";
    } else if (r.status === "not-installed") {
      mark = "=";
      note = "not installed";
    } else {
      mark = "·";
      note = r.reason ?? "skipped";
    }
    console.log(`${mark} ${formatRow(r.target.agent, display, note)}`);
  }

  const removed = results.filter((r) => r.status === "removed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  console.log(
    `\nDone. ${removed} ${dryRun ? "would be" : ""} removed, ${skipped} skipped.`,
  );
  if (!dryRun && removed > 0) {
    console.log("Restart your AI agent to drop the MCP server.");
  }
}
