import { loadSession } from "./session.js";

const DEFAULT_API_URL = "https://haraldr.joel.net";

export function apiBaseUrl() {
  const override = process.env.HARALDR_API_URL;
  return override && override.length > 0 ? override.replace(/\/$/, "") : DEFAULT_API_URL;
}

export class ApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

function extractSessionCookie(setCookie) {
  if (!setCookie) return null;
  const match = setCookie.match(/harldr_session=([^;]*)/);
  if (!match) return null;
  const value = match[1];
  if (!value) return null;
  return `harldr_session=${value}`;
}

export async function apiRequest(pathname, options = {}) {
  const { method = "GET", body, requireAuth = false } = options;
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
    throw new ApiError(`Network error contacting Haraldr API: ${reason}`, "network_error", 0);
  }

  const cookie = extractSessionCookie(response.headers.get("set-cookie"));

  if (response.status === 204) {
    return { data: undefined, cookie };
  }

  let parsed = null;
  const text = await response.text();
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new ApiError(`Invalid JSON from API (status ${response.status})`, "bad_response", response.status);
    }
  }

  if (!response.ok) {
    const code = parsed?.error?.code ?? `http_${response.status}`;
    const message = parsed?.error?.message ?? `Request failed with status ${response.status}`;
    throw new ApiError(message, code, response.status);
  }

  return { data: parsed, cookie };
}
