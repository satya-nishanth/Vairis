import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://localhost:3000";

const routes = [
  "/",
  "/all-products/rings",
  "/all-products/earrings",
  "/all-products/pendants",
  "/all-products/bracelets",
  "/all-products/necklaces",
  "/wishlist",
  "/cart",
  "/account",
  "/auth/login",
  "/auth/signup",
  "/auth/forgot-password",
  "/contact",
];

const browser = await chromium.launch();
const results = [];

for (const route of routes) {
  const page = await browser.newPage();
  const errors = [];
  const failedRequests = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("requestfailed", (req) => {
    failedRequests.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
  });
  page.on("response", (res) => {
    if (res.status() >= 400 && !res.url().includes("chrome-extension")) {
      failedRequests.push(`${res.status()} ${res.url()}`);
    }
  });

  let httpStatus = null;
  let title = null;
  try {
    const resp = await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 20000 });
    httpStatus = resp?.status();
    title = await page.title();
    await page.waitForTimeout(500);
  } catch (e) {
    errors.push(`navigation error: ${e.message}`);
  }

  results.push({ route, httpStatus, title, errors, failedRequests });
  await page.close();
}

await browser.close();

for (const r of results) {
  console.log(`\n=== ${r.route} (status ${r.httpStatus}) "${r.title}" ===`);
  if (r.errors.length) {
    console.log("  CONSOLE/PAGE ERRORS:");
    r.errors.forEach((e) => console.log(`    - ${e}`));
  }
  if (r.failedRequests.length) {
    console.log("  FAILED REQUESTS:");
    r.failedRequests.forEach((f) => console.log(`    - ${f}`));
  }
  if (!r.errors.length && !r.failedRequests.length) console.log("  clean");
}
