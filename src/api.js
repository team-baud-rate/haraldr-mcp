import { loadSession } from "./session.js";

/** @typedef {import('./types.js').ApiRequestOptions} ApiRequestOptions */

const DEFAULT_API_URL = "https://haraldr.joel.net";

/**
 * Resolve the base URL of the Haraldr API. Honors the `HARALDR_API_URL`
 * environment variable (with any trailing slash stripped) and otherwise
 * falls back to the public hosted endpoint.
 *
 * @returns {string}
 */
export function apiBaseUrl() {
  const override = process.env.HARALDR_API_URL;
  return override && override.length > 0
    ? override.replace(/\/$/, "")
    : DEFAULT_API_URL;
}

/**
 * Error thrown for any non-2xx response from the Haraldr API as well as
 * network/transport failures. Carries a stable `code` identifier and the
 * HTTP status (or 0 for transport-level errors).
 */
export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {string} code
   * @param {number} status
   */
  constructor(message, code, status) {
    super(message);
    this.name = "ApiError";
    /** @type {string} */
    this.code = code;
    /** @type {number} */
    this.status = status;
  }
}

/**
 * Pull the `harldr_session=...` cookie out of a `Set-Cookie` response header,
 * if present, and return it formatted for use as a `Cookie` request header.
 *
 * @param {string | null} setCookie
 * @returns {string | null}
 */
function extractSessionCookie(setCookie) {
  if (!setCookie) return null;
  const match = setCookie.match(/harldr_session=([^;]*)/);
  if (!match) return null;
  const value = match[1];
  if (!value) return null;
  return `harldr_session=${value}`;
}

/**
 * Issue a JSON request against the Haraldr API. Adds the JSON content-type
 * header when a body is provided, attaches the persisted session cookie when
 * `requireAuth` is true, and parses the response as JSON. Any non-2xx
 * response or transport failure is thrown as an `ApiError`.
 *
 * @template T
 * @param {string} pathname
 * @param {ApiRequestOptions} [options]
 * @returns {Promise<{ data: T | undefined, cookie: string | null }>}
 */
export async function apiRequest(pathname, options = {}) {
  const { method = "GET", body, requireAuth = false } = options;
  /** @type {Record<string, string>} */
  const headers = { Accept: "application/json" };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (requireAuth) {
    const session = await loadSession();
    if (!session) {
      throw new ApiError(
        "Not logged in. Call request_login_code, then verify_login_code.",
        "not_logged_in",
        401,
      );
    }
    headers["Cookie"] = session.cookie;
  }

  let response;
  try {
    response = await fetch(`${apiBaseUrl()}${pathname}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new ApiError(
      `Network error contacting Haraldr API: ${reason}`,
      "network_error",
      0,
    );
  }

  const cookie = extractSessionCookie(response.headers.get("set-cookie"));

  if (response.status === 204) {
    return { data: undefined, cookie };
  }

  /** @type {import('./types.js').ApiErrorBody & Record<string, unknown> | null} */
  let parsed = null;
  const text = await response.text();
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new ApiError(
        `Invalid JSON from API (status ${response.status})`,
        "bad_response",
        response.status,
      );
    }
  }

  if (!response.ok) {
    const code = parsed?.error?.code ?? `http_${response.status}`;
    const message =
      parsed?.error?.message ?? `Request failed with status ${response.status}`;
    throw new ApiError(message, code, response.status);
  }

  return { data: /** @type {T | undefined} */ (parsed ?? undefined), cookie };
}
