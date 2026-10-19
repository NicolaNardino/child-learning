/* Smoke test: serves the app, opens every Learning subject and every game in a headless browser,
   presses Play where there is one, and fails if any page throws an error.
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

await visit("#/grownups", false);   // the Grown-ups page (report and backup) too
console.log(`${failures.some(f => f.startsWith("#/grownups:")) ? "FAIL" : "ok  "} #/grownups`);

await browser.close();
server.close();
if (failures.length) { console.error("\nErrors:\n" + failures.join("\n")); process.exit(1); }
console.log("\nAll apps opened without errors.");
