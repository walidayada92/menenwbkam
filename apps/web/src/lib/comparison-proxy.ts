import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "node:crypto";

export async function comparisonProxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const target = path.join("/");
  const read =
    /^catalog\/(external-prices|autocomplete|search-intent)$/.test(target) ||
    /^catalog\/comparison-products\/[A-Za-z0-9_-]{1,100}$/.test(target);
  const discover = target === "catalog/external-prices/discover";
  if (!read && !discover)
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  if (
    (read && request.method !== "GET") ||
    (discover && request.method !== "POST")
  )
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 },
    );
  if (
    discover &&
    ((request.headers.get("origin") &&
      request.headers.get("origin") !== request.nextUrl.origin) ||
      request.headers.get("sec-fetch-site") === "cross-site")
  )
    return NextResponse.json(
      { message: "Invalid request origin" },
      { status: 403 },
    );
  try {
    let body: string | undefined;
    if (discover) {
      const reader = request.body?.getReader();
      if (!reader)
        return NextResponse.json(
          { message: "Search query required" },
          { status: 400 },
        );
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 2048) {
          await reader.cancel();
          return NextResponse.json(
            { message: "Request too large" },
            { status: 413 },
          );
        }
        chunks.push(value);
      }
      body = Buffer.concat(chunks).toString("utf8");
    }
    const secret = process.env.API_PROXY_SECRET || "";
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (secret) {
      headers["x-api-key"] = secret;
      // Only the authenticated server proxy can supply this opaque limiter key.
      const address =
        request.headers.get("x-vercel-forwarded-for") ||
        request.headers.get("x-forwarded-for") ||
        "local";
      headers["x-mw-client"] = createHmac("sha256", secret)
        .update(address.split(",")[0].trim())
        .digest("hex");
    }
    const upstream = await fetch(
      (process.env.API_URL || "http://127.0.0.1:3000") +
        "/" +
        path.map(encodeURIComponent).join("/") +
        request.nextUrl.search,
      {
        method: request.method,
        headers,
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      },
    );
    const response = new NextResponse(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
    const retry = upstream.headers.get("retry-after");
    if (retry) response.headers.set("Retry-After", retry);
    return response;
  } catch {
    return NextResponse.json(
      { message: "Prices are temporarily unavailable. Please retry shortly." },
      { status: 503 },
    );
  }
}
