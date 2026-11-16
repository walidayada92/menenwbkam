import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
const cookie = "mw_session";
async function limitedBody(request: NextRequest) {
  const reader = request.body?.getReader();
  if (!reader) return undefined;
  const chunks: Uint8Array[] = [];
  let size = 0;
  const limit = request.headers.get("content-type")?.startsWith("multipart/")
    ? 6 * 1024 * 1024
    : 1024 * 1024;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new RangeError("Request too large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
async function proxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  if (!["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin)
      return NextResponse.json(
        { message: "Invalid request origin" },
        { status: 403 },
      );
    if (request.headers.get("sec-fetch-site") === "cross-site")
      return NextResponse.json(
        { message: "Invalid request origin" },
        { status: 403 },
      );
  }
  if (path.join("/") === "session" && request.method === "DELETE") {
    const response = NextResponse.json({ signedOut: true });
    response.cookies.set(cookie, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    response.cookies.set("mw_store", "", { path: "/", maxAge: 0 });
    return response;
  }
  if (
    ![
      "auth",
      "catalog",
      "seller",
      "admin",
      "orders",
      "operations",
      "shopper",
      "uploads",
    ].includes(path[0])
  )
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const token = request.cookies.get(cookie)?.value;
  if (token) headers.set("authorization", "Bearer " + token);
  const store = request.cookies.get("mw_store")?.value;
  if (store) headers.set("x-store-id", store);
  const base = process.env.API_URL || "http://127.0.0.1:3000";
  try {
    const upstream = await fetch(
      base +
        "/" +
        path.map(encodeURIComponent).join("/") +
        request.nextUrl.search,
      {
        method: request.method,
        headers,
        body: ["GET", "HEAD"].includes(request.method)
          ? undefined
          : await limitedBody(request),
        cache: "no-store",
        signal: AbortSignal.timeout(35000),
      },
    );
    if (path.join("/") === "auth/login" && upstream.ok) {
      const { access_token, user } = await upstream.json();
      const response = NextResponse.json({ user });
      response.cookies.set(cookie, access_token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 86400,
      });
      response.cookies.set("mw_store", "", { path: "/", maxAge: 0 });
      return response;
    }
    if (
      upstream.ok &&
      ["seller/workspaces", "seller/workspaces/select"].includes(path.join("/"))
    ) {
      const data = await upstream.json();
      const selected =
        path.join("/") === "seller/workspaces"
          ? data.selectedId
          : data.sellerId;
      const response = NextResponse.json(data);
      response.cookies.set("mw_store", selected || "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: selected ? 86400 : 0,
      });
      return response;
    }
    const response = new NextResponse(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
    const disposition = upstream.headers.get("content-disposition");
    if (disposition) response.headers.set("Content-Disposition", disposition);
    return response;
  } catch (error) {
    if (error instanceof RangeError)
      return NextResponse.json(
        { message: "Request too large" },
        { status: 413 },
      );
    return NextResponse.json(
      { message: "Service unavailable. Please try again." },
      { status: 503 },
    );
  }
}
export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE };
