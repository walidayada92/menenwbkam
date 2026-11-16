import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { setTimeout as delay } from "node:timers/promises";
const root = resolve(import.meta.dirname, "..");
try {
  loadEnvFile(resolve(root, ".env"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (!process.env.DATABASE_URL)
  throw Error(
    "DATABASE_URL required (read-only checks; no fixtures are created)",
  );
const secret = randomBytes(32).toString("hex");
const apiPort = Number(process.env.SMOKE_API_PORT || 3300),
  webPort = Number(process.env.SMOKE_WEB_PORT || 3301);
const api = "http://127.0.0.1:" + apiPort,
  base = "http://127.0.0.1:" + webPort;
const children = [];
let logs = "";
function launch(args, cwd, env) {
  const child = spawn(process.execPath, args, {
    cwd,
    env: {
      ...process.env,
      NODE_ENV: "production",
      API_PROXY_SECRET: secret,
      ...env,
    },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(child);
  for (const stream of [child.stdout, child.stderr])
    stream.on("data", (data) => {
      logs = (logs + data).slice(-12000);
    });
}
async function wait(url) {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    if (children.some((child) => child.exitCode !== null))
      throw Error("Server exited");
    await delay(200);
  }
  throw Error("Server readiness timeout");
}
try {
  launch(["dist/main.js"], resolve(root, "apps/api"), {
    PORT: String(apiPort),
    PUBLIC_DISCOVERY_ENABLED: "false",
  });
  launch(
    [
      resolve(root, "node_modules/next/dist/bin/next"),
      "start",
      "-p",
      String(webPort),
    ],
    resolve(root, "apps/web"),
    { API_URL: api, NEXT_PUBLIC_SITE_URL: base },
  );
  await wait(api + "/health/ready");
  await wait(base + "/en");
  for (const locale of ["ar", "en"]) {
    const response = await fetch(base + "/" + locale);
    assert.equal(response.status, 200);
    const text = await response.text();
    assert.ok(text.includes('dir="' + (locale === "ar" ? "rtl" : "ltr") + '"'));
    assert.ok(!/href="\/(ar|en)\/(signup|account|cart|seller)/.test(text));
    for (const path of ["about", "privacy", "terms"])
      assert.equal((await fetch(base + "/" + locale + "/" + path)).status, 200);
    for (const path of [
      "signup",
      "account",
      "cart",
      "seller",
      "orders",
      "checkout/item",
    ])
      assert.equal((await fetch(base + "/" + locale + "/" + path)).status, 404);
  }
  for (const path of [
    "auth/register",
    "auth/login",
    "seller/products",
    "shopper/cart",
    "orders",
    "admin/external-pipeline/status",
  ]) {
    assert.equal(
      (
        await fetch(base + "/api/" + path, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        })
      ).status,
      404,
    );
  }
  assert.equal((await fetch(api + "/catalog/autocomplete?q=tv")).status, 401);
  for (const q of ["tv", "iphone 17", "تيليفيزون"]) {
    const response = await fetch(
      base +
        "/api/catalog/external-prices?q=" +
        encodeURIComponent(q) +
        "&sort=price_asc",
    );
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.ok(Array.isArray(data.listings));
    const suggestions = await fetch(
      base + "/api/catalog/autocomplete?q=" + encodeURIComponent(q),
    );
    assert.equal(suggestions.status, 200);
    assert.ok(Array.isArray(await suggestions.json()));
  }
  const disabled = await fetch(base + "/api/catalog/external-prices/discover", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ q: "tv" }),
  });
  assert.equal((await disabled.json()).status, "unsupported");
  assert.equal(
    (await fetch(base + "/api/catalog/autocomplete?q=" + "a".repeat(101)))
      .status,
    400,
  );
  assert.equal(
    (await fetch(base + "/api/catalog/autocomplete", { method: "POST" }))
      .status,
    405,
  );
  assert.equal((await fetch(base + "/robots.txt")).status, 200);
  assert.equal((await fetch(base + "/sitemap.xml")).status, 200);
  console.log(
    "Comparison production smoke passed: ar/en, information pages, no marketplace routes, protected API, prices, aliases, autocomplete and metadata.",
  );
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  for (const child of children) child.kill();
}
