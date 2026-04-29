import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

/** @typedef {import('./types.js').Session} Session */

/**
 * Resolve the directory under which Haraldr stores its per-user state,
 * honoring `XDG_CONFIG_HOME` when set.
 *
 * @returns {string}
 */
function configDir() {
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg && xdg.length > 0 ? xdg : path.join(os.homedir(), ".config");
  return path.join(base, "haraldr");
}

/**
 * Absolute path to the persisted session JSON.
 *
 * @returns {string}
 */
function sessionPath() {
  return path.join(configDir(), "session.json");
}

/**
 * Read the persisted session, or `null` if no session file exists or its
 * contents are invalid (missing cookie/email or non-JSON).
 *
 * @returns {Promise<Session | null>}
 */
export async function loadSession() {
  try {
    const raw = await fs.readFile(sessionPath(), "utf8");
    /** @type {Partial<Session>} */
    const parsed = JSON.parse(raw);
    if (!parsed.cookie || !parsed.email) return null;
    return /** @type {Session} */ (parsed);
  } catch {
    return null;
  }
}

/**
 * Persist a session record atomically (write to a sibling tmp file, then
 * rename) with restricted permissions on both the directory and the file.
 *
 * @param {Session} session
 * @returns {Promise<void>}
 */
export async function saveSession(session) {
  const dir = configDir();
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const file = sessionPath();
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(session, null, 2), { mode: 0o600 });
  await fs.rename(tmp, file);
}

/**
 * Remove the persisted session file, if present. Errors other than "file
 * not found" are propagated.
 *
 * @returns {Promise<void>}
 */
export async function clearSession() {
  try {
    await fs.unlink(sessionPath());
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code !== "ENOENT") throw err;
  }
}

/**
 * Return the absolute path where the session file is (or would be) stored.
 *
 * @returns {string}
 */
export function getSessionPath() {
  return sessionPath();
}
