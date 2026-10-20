/* Smoke test: serves the app, opens every Learning subject and every game in a headless browser,
   presses Play where there is one, then plays a little (arrow keys, Space and a mouse drag on the game),
   and fails if any page throws an error. Then it opens everything again on a phone-sized screen and fails
   if anything sticks out sideways or a game's canvas runs off the bottom.
     node tests/smoke.mjs
   Needs Playwright with Chromium (npm install playwright && npx playwright install chromium). */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };

// a tiny static file server for the repo
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  const file = p.endsWith(path.sep) ? path.join(p, "index.html") : p;
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const failures = [];

// a few seconds of button mashing: hold the arrows, tap Space, drag across the game with the mouse
async function playALittle(page){
  const canvas = page.locator(".game-screen:not([hidden]) canvas, .app-view:not([hidden]) canvas").first();
  for (const key of ["ArrowUp", "ArrowLeft", "Space", "ArrowRight", "ArrowDown"]) {
    await page.keyboard.down(key); await page.waitForTimeout(220); await page.keyboard.up(key);
  }
  if (await canvas.count() && await canvas.isVisible()) {
    const r = await canvas.boundingBox();
    if (r) {
      await page.mouse.move(r.x + r.width * 0.5, r.y + r.height * 0.6); await page.mouse.down();
      await page.mouse.move(r.x + r.width * 0.3, r.y + r.height * 0.8, { steps: 6 }); await page.waitForTimeout(150);
      await page.mouse.up(); await page.waitForTimeout(600);
    }
  }
}

// a phone held upright: nothing may stick out sideways, and a game's canvas must fit on the screen
async function phoneCheck(hash, ctx){
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(BASE + hash, { waitUntil: "load" });
  await page.waitForTimeout(500);
  const btn = page.locator(".game-screen:not([hidden]) .game-panel:not([hidden]) .btn").first();
  if (await btn.count() && await btn.isVisible()) {
    try { await btn.tap({ timeout: 3000 }); await page.waitForTimeout(500); }
    catch (e) { errors.push("the Play button can't be tapped (something covers it)"); }
  }
  const r = await page.evaluate(() => {
    const c = document.querySelector(".game-screen:not([hidden]) canvas"), b = c && c.getBoundingClientRect();
    return { over: document.documentElement.scrollWidth - innerWidth, offBottom: b ? b.bottom - innerHeight : 0 };
  });
  await page.close();
  if (r.over > 1) errors.push(`sticks out ${r.over}px sideways on a phone`);
  if (r.offBottom > 2) errors.push(`game runs ${Math.round(r.offBottom)}px off the bottom of a phone screen`);
  if (errors.length) failures.push(`${hash} (phone): ${[...new Set(errors)].join(" | ")}`);
}

async function visit(hash, play){
  const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(BASE + hash, { waitUntil: "load" });
  await page.waitForTimeout(700);
  let links = [];
  if (play) {
    // press the Play button of the game's start panel, if it has one
    const btn = page.locator(".game-screen:not([hidden]) .game-panel:not([hidden]) .btn").first();
    if (await btn.count() && await btn.isVisible()) { await btn.click(); await page.waitForTimeout(1500); }
    await playALittle(page);
  } else {
    links = await page.$$eval(`a[href^="${hash}/"]`, as => [...new Set(as.map(a => a.getAttribute("href")))]);
  }
  await page.close();
  if (errors.length) failures.push(`${hash}: ${[...new Set(errors)].join(" | ")}`);
  return links;
}

const apps = [];
for (const section of ["#/learning", "#/games"]) apps.push(...await visit(section, false));
console.log(`Found ${apps.length} apps`);
if (apps.length < 10) failures.push(`only ${apps.length} apps were listed`);
for (const hash of apps) {
  await visit(hash, true);
  console.log(`${failures.some(f => f.startsWith(hash + ":")) ? "FAIL" : "ok  "} ${hash}`);
}

for (const p of ["#/grownups", "#/shop"]) {   // the Grown-ups page (report and backup) and the shop too
  await visit(p, false);
  console.log(`${failures.some(f => f.startsWith(p + ":")) ? "FAIL" : "ok  "} ${p}`);
}

const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
for (const hash of ["#/", "#/learning", "#/games", "#/grownups", "#/shop", ...apps]) await phoneCheck(hash, phone);
console.log(`${failures.some(f => f.includes("(phone)")) ? "FAIL" : "ok  "} everything fits on a phone`);
await phone.close();

await browser.close();
server.close();
if (failures.length) { console.error("\nErrors:\n" + failures.join("\n")); process.exit(1); }
console.log("\nAll apps opened without errors.");
