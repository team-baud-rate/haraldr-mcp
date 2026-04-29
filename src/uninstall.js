import { promises as fs } from "node:fs";
import os from "node:os";

import {
  SERVER_NAME,
  candidates,
  dirExists,
  formatRow,
  readJson,
  userSkillDir,
  writeJsonAtomic,
} from "./install.js";

/** @typedef {import('./types.js').InstallTarget} InstallTarget */
/** @typedef {import('./types.js').UninstallResult} UninstallResult */
/** @typedef {import('./types.js').SkillResult} SkillResult */

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
 * Remove the user-level skill directory installed by `installSkill`. Never
 * touches `~/.claude/skills/` itself.
 *
 * @param {boolean} dryRun
 * @returns {Promise<SkillResult>}
 */
export async function uninstallSkill(dryRun) {
  const dest = userSkillDir();
  if (!(await dirExists(dest))) {
    return { destPath: dest, status: "not-installed" };
  }
  if (!dryRun) {
    await fs.rm(dest, { recursive: true, force: true });
  }
  return { destPath: dest, status: "removed" };
}

/**
 * Render a path relative to $HOME as `~/...` for compact reporting.
 *
 * @param {string} p
 * @returns {string}
 */
function displayPath(p) {
  const home = os.homedir();
  return p.startsWith(home) ? `~${p.slice(home.length)}` : p;
}

/**
 * CLI entry point for `haraldr-domain-tools uninstall`. Removes the server
 * entry from every detected agent config, removes the bundled skill from
 * ~/.claude/skills/, and prints a per-target report.
 *
 * @param {string[]} args
 * @returns {Promise<void>}
 */
export async function runUninstall(args) {
  const dryRun = args.includes("--dry-run");
  const noSkill = args.includes("--no-skill");

  console.log(
    `Removing "${SERVER_NAME}" from agent configs${dryRun ? " (dry run)" : ""}\n`,
  );

  const targets = candidates();
  const results = await Promise.all(
    targets.map((t) => unpatchTarget(t, dryRun)),
  );

  for (const r of results) {
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
    console.log(
      `${mark} ${formatRow(r.target.agent, displayPath(r.target.filePath), note)}`,
    );
  }

  const skill = noSkill ? null : await uninstallSkill(dryRun);
  if (skill) {
    let mark;
    let note;
    if (skill.status === "removed") {
      mark = dryRun ? "~" : "✓";
      note = dryRun ? "would remove" : "removed";
    } else if (skill.status === "not-installed") {
      mark = "=";
      note = "not installed";
    } else {
      mark = "·";
      note = skill.reason ?? "skipped";
    }
    console.log(
      `${mark} ${formatRow("Skill", displayPath(skill.destPath), note)}`,
    );
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
