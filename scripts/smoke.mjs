import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { resolve } from "node:path";
import { unlink } from "node:fs/promises";
const database = process.env.TEST_DATABASE_URL;
if (!database || !new URL(database).pathname.endsWith("_test"))
  throw new Error(
    "Set TEST_DATABASE_URL to a disposable migrated database ending in _test",
  );
process.env.DATABASE_URL = database;
const require = createRequire(import.meta.url);
const { prisma } = require("../packages/database/index.js");
const root = resolve(import.meta.dirname, "..");
const apiPort = Number(process.env.SMOKE_API_PORT || 3300),
  webPort = Number(process.env.SMOKE_WEB_PORT || 3301);
const base = "http://localhost:" + webPort;
const run = randomUUID(),
  email = "smoke-" + run + "@example.com",
  password = "smoke-test-password-123";
const brandId = "smoke-" + run,
  categoryId = "smoke-" + run;
const children = [];
let logs = "",
  cookie = "",
  userId = "",
  verificationPath = "";
let shopperId = "",
  orderId = "";
function launch(args, cwd, env) {
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, ...env },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (data) => {
    logs = (logs + data).slice(-15000);
  });
  child.stderr.on("data", (data) => {
    logs = (logs + data).slice(-15000);
  });
  children.push(child);
}
async function wait(url) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    if (children.some((child) => child.exitCode !== null))
      throw new Error("Server exited before readiness");
    await delay(200);
  }
  throw new Error("Server readiness timed out");
}
async function call(path, method = "GET", body, expected = 200) {
  const headers = { cookie, origin: base };
  if (body && !(body instanceof FormData))
    headers["content-type"] = "application/json";
  const response = await fetch(base + "/api/" + path, {
    method,
    headers,
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  assert.equal(
    response.status,
    expected,
    path + ": " + (await response.clone().text()),
  );
  return response;
}
try {
  launch(["dist/main.js"], resolve(root, "apps/api"), {
    NODE_ENV: "production",
    PORT: String(apiPort),
    JWT_SECRET: "smoke-only-secret-longer-than-32-characters",
    WEB_ORIGIN: base,
    UPLOAD_DIR: resolve(root, ".local/smoke-uploads"),
  });
  launch(
    [
      resolve(root, "node_modules/next/dist/bin/next"),
      "start",
      "-p",
      String(webPort),
    ],
    resolve(root, "apps/web"),
    { API_URL: "http://127.0.0.1:" + apiPort },
  );
  await wait("http://127.0.0.1:" + apiPort + "/auth/health");
  await wait(base + "/en");
  const ar = await fetch(base + "/ar");
  assert.equal(ar.status, 200);
  assert.match(await ar.text(), /dir="rtl"/);
  const en = await fetch(base + "/en");
  assert.match(await en.text(), /dir="ltr"/);
  const redirect = await fetch(base, { redirect: "manual" });
  assert.match(redirect.headers.get("location"), /\/ar$/);
  assert.equal((await fetch(base + "/xx")).status, 404);
  const template = await fetch(base + "/import-template.csv");
  assert.equal(template.status, 200);
  assert.match(await template.text(), /^title,brandId/);
  await call("seller/profile", "GET", undefined, 401);
  const registered = await (
    await call(
      "auth/register",
      "POST",
      { email, password, role: "SELLER" },
      201,
    )
  ).json();
  userId = registered.id;
  assert.equal(registered.passwordHash, undefined);
  const login = await call("auth/login", "POST", { email, password }, 200);
  const session = login.headers.get("set-cookie");
  assert.match(session, /HttpOnly/i);
  assert.match(session, /SameSite=lax/i);
  cookie = session.split(";")[0];
  assert.equal((await login.json()).access_token, undefined);
  assert.equal((await (await call("auth/me")).json()).role, "SELLER");
  await call("admin/sellers", "GET", undefined, 403);
  const saved = await (
    await call("seller/profile", "PUT", {
      businessName: "Smoke store",
      commercialRegNo: "1234567890",
    })
  ).json();
  const upload = new FormData();
  upload.set(
    "file",
    new Blob(["%PDF-1.4\nsmoke test"], { type: "application/pdf" }),
    "registration.pdf",
  );
  await call("seller/verification", "POST", upload, 201);
  const seller = await prisma.seller.update({
    where: { id: saved.id },
    data: { status: "APPROVED" },
  });
  verificationPath = seller.verificationPath;
  const billingState = await (await call("seller/billing")).json();
  assert.equal(billingState.testEnabled, false);
  await call("seller/billing/trial", "POST", { planId: "pro" }, 403);
  for (const path of [
    "/en/seller/billing",
    "/ar/seller/billing",
    "/en/admin/billing",
  ])
    assert.equal((await fetch(base + path)).status, 200);
  await prisma.brand.create({
    data: { id: brandId, nameAr: "اختبار", nameEn: "Smoke brand" },
  });
  await prisma.category.create({
    data: { id: categoryId, nameAr: "اختبار", nameEn: "Smoke category" },
  });
  const offer = await (
    await call(
      "seller/offers",
      "POST",
      {
        title: "Smoke Phone " + run,
        brandId,
        categoryId,
        price: 123.45,
        stock: 2,
        images: [],
        productUrl: "https://example.com/buy",
      },
      201,
    )
  ).json();
  const listing = await fetch(base + "/en?q=" + encodeURIComponent(run));
  const html = await listing.text();
  assert.match(html, new RegExp("Smoke Phone " + run));
  const detail = await fetch(base + "/en/products/" + offer.productId);
  assert.equal(detail.status, 200);
  assert.match(await detail.text(), /Best price/);
  const shopperEmail = "shopper-" + run + "@example.com";
  shopperId = (
    await (
      await call(
        "auth/register",
        "POST",
        { email: shopperEmail, password, role: "SHOPPER" },
        201,
      )
    ).json()
  ).id;
  const shopperLogin = await call("auth/login", "POST", {
    email: shopperEmail,
    password,
  });
  cookie = shopperLogin.headers.get("set-cookie").split(";")[0];
  const placed = await (
    await call(
      "orders",
      "POST",
      {
        checkoutKey: randomUUID(),
        items: [
          { offerId: offer.id, quantity: 1, expectedUnitPrice: "123.45" },
        ],
        recipientName: "Smoke shopper",
        contactPhone: "+966500000001",
        shippingAddress: "Smoke street, test district, building 10",
      },
      201,
    )
  ).json();
  orderId = placed.id;
  assert.equal(
    (await (await call("orders/" + orderId)).json()).status,
    "PENDING",
  );
  assert.ok((await (await call("operations/notifications")).json()).unread > 0);
  await call("orders/" + orderId + "/status", "PUT", { status: "CANCELLED" });
  for (const path of [
    "/en/orders",
    "/en/notifications",
    "/ar/admin/operations",
    "/en/checkout/" + offer.id,
  ])
    assert.equal((await fetch(base + path)).status, 200);
  const csrf = await fetch(base + "/api/seller/profile", {
    method: "PUT",
    headers: {
      cookie,
      origin: "https://untrusted.example",
      "content-type": "application/json",
    },
    body: "{}",
  });
  assert.equal(csrf.status, 403);
  await call("session", "DELETE");
  cookie = "";
  await call("auth/me", "GET", undefined, 401);
  console.log(
    "PASS: production HTTP smoke checks (ar/en, RTL, redirect, 404, template, cookie login/logout, CSRF, authorization, upload, listing, SSR search and comparison).",
  );
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  for (const child of children) child.kill();
  if (orderId) {
    await prisma.orderItem.deleteMany({ where: { orderId } });
    await prisma.order.deleteMany({ where: { id: orderId } });
  }
  if (shopperId) await prisma.user.delete({ where: { id: shopperId } });
  if (userId) {
    const seller = await prisma.seller.findUnique({ where: { userId } });
    if (seller) {
      await prisma.offer.deleteMany({ where: { sellerId: seller.id } });
      await prisma.seller.delete({ where: { id: seller.id } });
    }
    await prisma.product.deleteMany({ where: { brandId } });
    await prisma.user.delete({ where: { id: userId } });
  }
  await prisma.brand.deleteMany({ where: { id: brandId } });
  await prisma.category.deleteMany({ where: { id: categoryId } });
  if (verificationPath)
    await unlink(resolve(root, ".local/smoke-uploads", verificationPath)).catch(
      () => {},
    );
  await prisma.$disconnect();
}
