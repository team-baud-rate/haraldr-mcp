import { apiRequest } from "../api.js";
import { clearSession, loadSession } from "../session.js";

/** @typedef {import('../types.js').Tool} Tool */

/** @type {Tool} */
export const logout = {
  definition: {
    name: "logout",
    description:
      "Log out the current Haraldr session: notifies the API and removes the local cookie file.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  /**
   * Best-effort logout: notifies the API and clears the persisted cookie.
   * The local state is always cleared even if the API call fails.
   *
   * @returns {Promise<string>}
   */
  async handler() {
    const session = await loadSession();
    if (!session) {
      return "No session to log out of.";
    }
    try {
      await apiRequest("/api/auth/logout", {
        method: "POST",
        requireAuth: true,
      });
    } catch {
      // Best-effort: clear local state regardless of server response.
    }
    await clearSession();
    return "Logged out. Local session cleared.";
  },
};
