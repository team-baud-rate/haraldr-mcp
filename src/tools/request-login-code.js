import { apiRequest } from "../api.js";

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
  async handler({ email }) {
    const { data } = await apiRequest("/auth/request-code", {
      method: "POST",
      body: { email },
    });
    const debugSuffix = data?.debugCode ? ` (debug code: ${data.debugCode})` : "";
    return `Login code sent to ${email}${debugSuffix}. Ask the user to read the 6-digit code from their email, then call verify_login_code.`;
  },
};
