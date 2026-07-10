import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR || "/tmp/vairis-shots";
const EMAIL = "nish99.sn@gmail.com";
const PASSWORD = "Admin1234!";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("404")) errors.push(`console: ${m.text()}`);
});

const step = async (name, fn) => {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (e) {
    console.log(`FAIL  ${name}: ${e.message.split("\n")[0]}`);
    await page.screenshot({ path: `${SHOTS}/FAIL-${name.replace(/\W+/g, "-")}.png` }).catch(() => {});
  }
};

// ── Login page renders styled ──
await step("login page renders", async () => {
  await page.goto(`${BASE}/auth/login`, { waitUntil: "networkidle" });
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector(".auth-screen")).backgroundColor);
  if (bg === "rgba(0, 0, 0, 0)") throw new Error("auth-screen has no background — CSS not applied");
  await page.screenshot({ path: `${SHOTS}/01-login.png` });
});

await step("signup tab renders", async () => {
  await page.goto(`${BASE}/auth/login?mode=signup`, { waitUntil: "networkidle" });
  const btn = await page.locator('button[type="submit"]').textContent();
  if (!btn.includes("Create Account")) throw new Error(`unexpected submit label: ${btn}`);
  await page.screenshot({ path: `${SHOTS}/02-signup.png` });
});

await step("forgot mode renders", async () => {
  await page.goto(`${BASE}/auth/login?mode=forgot`, { waitUntil: "networkidle" });
  const h = await page.locator(".auth-heading").textContent();
  if (!h.includes("Reset Password")) throw new Error(`heading: ${h}`);
  await page.screenshot({ path: `${SHOTS}/03-forgot.png` });
});

await step("wrong password shows error", async () => {
  await page.goto(`${BASE}/auth/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', "wrongpass123");
  await page.click('button[type="submit"]');
  await page.waitForSelector(".auth-msg--error", { timeout: 15000 });
  await page.screenshot({ path: `${SHOTS}/04-login-error.png` });
});

// ── Real login ──
await step("login with valid creds lands on /", async () => {
  await page.goto(`${BASE}/auth/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20000 });
});

// ── Browse to PDP ──
let pdpUrl = null;
await step("PLP shows products, click through to PDP", async () => {
  await page.goto(`${BASE}/all-products/rings`, { waitUntil: "networkidle" });
  const links = page.locator('a[href^="/product/"]');
  const n = await links.count();
  if (n === 0) throw new Error("no product links on rings PLP");
  await page.screenshot({ path: `${SHOTS}/05-plp-rings.png` });
  const href = await links.first().getAttribute("href");
  pdpUrl = `${BASE}${href}`;
  await page.goto(pdpUrl, { waitUntil: "networkidle" });
  await page.waitForSelector(".pdp-info__title", { timeout: 15000 });
  await page.screenshot({ path: `${SHOTS}/06-pdp.png` });
});

// ── Add to cart ──
await step("add to cart → modal + badge", async () => {
  const addBtn = page.locator(".pdp-actions button", { hasText: /add to cart/i });
  await addBtn.click();
  await page.waitForSelector(".modal-overlay.is-open", { timeout: 15000 });
  await page.screenshot({ path: `${SHOTS}/07-added-modal.png` });
  const viewBag = page.locator(".modal-overlay.is-open a", { hasText: /view bag/i });
  const label = await viewBag.textContent();
  if (!/\(\s*[1-9]/.test(label)) throw new Error(`bag count not >0 in modal: "${label}"`);
});

// ── Cart page ──
await step("cart page shows item with price", async () => {
  await page.goto(`${BASE}/cart`, { waitUntil: "networkidle" });
  await page.waitForSelector(".cart-item", { timeout: 15000 });
  const price = await page.locator(".cart-item__price").first().textContent();
  if (!price.includes("₹")) throw new Error(`no price rendered: ${price}`);
  await page.screenshot({ path: `${SHOTS}/08-cart.png` });
});

await step("header badge shows count", async () => {
  const badge = await page.locator(".cart-badge__count").first().textContent();
  if (Number(badge) < 1) throw new Error(`badge: ${badge}`);
});

await step("increment quantity updates line", async () => {
  await page.click('button[aria-label="Increase quantity"]');
  await page.waitForTimeout(800);
  const qty = await page.locator(".cart-item__qty span").first().textContent();
  if (qty.trim() !== "2") throw new Error(`qty after +: ${qty}`);
});

await step("decrement quantity back to 1", async () => {
  await page.click('button[aria-label="Decrease quantity"]');
  await page.waitForTimeout(800);
  const qty = await page.locator(".cart-item__qty span").first().textContent();
  if (qty.trim() !== "1") throw new Error(`qty after -: ${qty}`);
});

await step("remove item → empty state", async () => {
  // remove every line (in case earlier runs left items)
  while ((await page.locator(".cart-item").count()) > 0) {
    await page.locator(".cart-item button", { hasText: /remove/i }).first().click();
    await page.waitForTimeout(800);
  }
  await page.waitForSelector("text=Your Cart is Empty", { timeout: 10000 });
  await page.screenshot({ path: `${SHOTS}/09-cart-empty.png` });
});

// ── Wishlist quick check ──
await step("wishlist toggle works on PDP", async () => {
  await page.goto(pdpUrl, { waitUntil: "networkidle" });
  const wish = page.locator(".product-card__wish").first();
  const before = await wish.getAttribute("aria-pressed");
  await wish.click();
  await page.waitForTimeout(600);
  const after = await wish.getAttribute("aria-pressed");
  if (after === before) throw new Error(`aria-pressed did not toggle: ${before} → ${after}`);
});

// ── Sign out via account page exists ──
await step("account page renders for logged-in user", async () => {
  await page.goto(`${BASE}/account`, { waitUntil: "networkidle" });
  const body = await page.textContent("body");
  if (!body.includes(EMAIL)) throw new Error("account page missing user email");
  await page.screenshot({ path: `${SHOTS}/10-account.png` });
});

if (errors.length) {
  console.log("\nJS ERRORS CAPTURED:");
  errors.forEach((e) => console.log("  - " + e));
} else {
  console.log("\nno JS errors captured");
}

await browser.close();
