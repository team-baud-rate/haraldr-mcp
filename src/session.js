import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

function configDir() {
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg && xdg.length > 0 ? xdg : path.join(os.homedir(), ".config");
  return path.join(base, "haraldr");
}

function sessionPath() {
  return path.join(configDir(), "session.json");
}

export async function loadSession() {
  try {
    const raw = await fs.readFile(sessionPath(), "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed.cookie || !parsed.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveSession(session) {
  const dir = configDir();
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const file = sessionPath();
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(session, null, 2), { mode: 0o600 });
  await fs.rename(tmp, file);
}

export async function clearSession() {
  try {
    await fs.unlink(sessionPath());
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
}

export function getSessionPath() {
  return sessionPath();
}
