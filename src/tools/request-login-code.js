import { apiRequest } from "../api.js";

/** @typedef {import('../types.js').Tool} Tool */
/** @typedef {import('../types.js').RequestCodeResponse} RequestCodeResponse */

/** @type {Tool} */
export const requestLoginCode = {
  definition: {
    name: "request_login_code",
    description:
      "Request a 6-digit login code by email from the Haraldr API. The code is delivered to the user's inbox; ask the user for it, then call verify_login_code.",
    inputSchema: {
      type: "object",
      properties: {
        email: {
          type: "string",
          description: "Email address to send the login code to.",
        },
      },
      required: ["email"],
      additionalProperties: false,
    },
  },
  /**
   * Trigger the API to mint and send a 6-digit login code, and return a
   * confirmation message that includes the debug code if the API exposed one.
   *
   * @param {Record<string, unknown>} args
   * @returns {Promise<string>}
   */
  async handler(args) {
    const email = /** @type {string} */ (args.email);
    const { data } = await apiRequest("/api/auth/request-code", {
      method: "POST",
      body: { email },
    });
    const payload = /** @type {RequestCodeResponse | undefined} */ (data);
    const debugSuffix = payload?.debugCode
      ? ` (debug code: ${payload.debugCode})`
      : "";
    return `Login code sent to ${email}${debugSuffix}. Ask the user to read the 6-digit code from their email, then call verify_login_code.`;
  },
};
