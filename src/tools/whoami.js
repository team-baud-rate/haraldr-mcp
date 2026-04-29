import { ApiError, apiRequest } from "../api.js";
import { clearSession, loadSession } from "../session.js";

/** @typedef {import('../types.js').Tool} Tool */
/** @typedef {import('../types.js').MeResponse} MeResponse */

/** @type {Tool} */
export const whoami = {
  definition: {
    name: "whoami",
    description:
      "Show the currently logged-in Haraldr user, or report that no session exists.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  /**
   * Return a human-readable description of the current Haraldr session, or
   * clear it and prompt for a new login if the API rejects the cookie.
   *
   * @returns {Promise<string>}
   */
  async handler() {
    const session = await loadSession();
    if (!session) return "Not logged in. Call request_login_code to start.";
    try {
      const { data } = await apiRequest("/api/auth/me", { requireAuth: true });
      const payload = /** @type {MeResponse | undefined} */ (data);
      const user = payload?.user;
      if (!user) return "Session present but API returned no user.";
      return `Logged in as ${user.email} (id ${user.id}).`;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await clearSession();
        return "Session expired. Call request_login_code to log in again.";
      }
      throw err;
    }
  },
};
