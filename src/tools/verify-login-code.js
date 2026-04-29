import { apiBaseUrl, apiRequest } from "../api.js";
import { saveSession } from "../session.js";

/** @typedef {import('../types.js').Tool} Tool */
/** @typedef {import('../types.js').VerifyCodeResponse} VerifyCodeResponse */

/** @type {Tool} */
export const verifyLoginCode = {
  definition: {
    name: "verify_login_code",
    description:
      "Verify the 6-digit login code emailed to the user. On success, persists a session cookie at ~/.config/haraldr/session.json.",
    inputSchema: {
      type: "object",
      properties: {
        email: {
          type: "string",
          description: "Email address used in request_login_code.",
        },
        code: {
          type: "string",
          description: "The 6-digit code from the user's email.",
        },
      },
      required: ["email", "code"],
      additionalProperties: false,
    },
  },
  /**
   * Exchange the 6-digit code for a session cookie. On success, persists the
   * cookie alongside the resolved email so subsequent tools can authenticate.
   *
   * @param {Record<string, unknown>} args
   * @returns {Promise<string>}
   */
  async handler(args) {
    const email = /** @type {string} */ (args.email);
    const code = /** @type {string} */ (args.code);
    const { data, cookie } = await apiRequest("/api/auth/verify-code", {
      method: "POST",
      body: { email, code },
    });
    if (!cookie) {
      throw new Error(
        "Verification succeeded but no session cookie was returned.",
      );
    }
    const payload = /** @type {VerifyCodeResponse | undefined} */ (data);
    const resolvedEmail = payload?.user?.email ?? email;
    await saveSession({
      apiUrl: apiBaseUrl(),
      cookie,
      email: resolvedEmail,
      savedAt: Math.floor(Date.now() / 1000),
    });
    return `Logged in as ${resolvedEmail}. Session saved to ~/.config/haraldr/session.json.`;
  },
};
