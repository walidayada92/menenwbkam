export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch("/api/" + path, {
    ...init,
    headers: {
      ...(init.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...init.headers,
    },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      Array.isArray(body.message)
        ? body.message.join(", ")
        : body.message || "Request failed (" + response.status + ")",
      response.status,
    );
  if (typeof window !== "undefined") {
    if (path === "auth/login" && init.method === "POST") {
      window.dispatchEvent(
        new CustomEvent("mw:session-changed", { detail: body.user }),
      );
    } else if (path === "session" && init.method === "DELETE") {
      window.dispatchEvent(
        new CustomEvent("mw:session-changed", { detail: null }),
      );
    }
  }
  return body;
}
export async function catalog<T>(path: string): Promise<T> {
  const response = await fetch(
    (process.env.API_URL || "http://127.0.0.1:3000") + "/catalog/" + path,
    {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: process.env.API_PROXY_SECRET
        ? { "x-api-key": process.env.API_PROXY_SECRET }
        : {},
    },
  );
  if (!response.ok) throw new Error("Catalog unavailable");
  return response.json();
}
