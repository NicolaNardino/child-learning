/* Race Off physics check: a simple autopilot drives a few career levels and the test fails if the car gets
   stuck (gas held but standing still for a while), if the wheels sink into the ground more than a handful of
   times, or if a level ends before 150 m. This is the bug where wheels got stuck in the terrain.
     node tests/raceoff.mjs */
import { start } from "./serve.mjs";

const LEVELS = [0, 3, 7, 12], MAX_SINKS = 30, MIN_METRES = 150, LEVEL_TIME = 60000;
const { BASE, browser, close } = await start();
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
const errors = [], failures = [];
page.on("pageerror", e => errors.push(e.message));
await page.goto(BASE + "#/games/raceoff", { waitUntil: "load" });
await page.waitForTimeout(500);
await page.evaluate(() => {
  const st = {}; for (let i = 0; i < 30; i++) st[i] = 1;
  __ro.R().stars = st; __ro.R().assist = true;
  // the autopilot: on the ground keep the car level with the slope, in the air aim it at the landing
  // and every frame count wheels sunk deep into the ground, and frames standing still with the gas on
  window.__check = { sinks: 0, still: 0, stuck: false };
  (function pilot(){
    const w = __ro, k = w.keys, c = w.car, chk = window.__check;
    if (c && w.state === "race") {
      if (c.wheels.some(x => x.on)) { const err = c.a - w.slope(); k.gas = err > -0.55; k.brake = err < -0.9; }
      else { const g = w.slopeAt(c.x + Math.max(0, c.vx) * 0.45), e = (c.a - (g === null ? 0.2 : g)) + 0.22 * c.w; k.gas = e > 0.08; k.brake = e < -0.08; }
      c.wheels.forEach(wh => { if (wh.sx === undefined) return; const gy = w.groundY(wh.sx); if (gy !== null && wh.sy + c.S.wr - gy > c.S.wr * 0.6) chk.sinks++; });
      if (Math.hypot(c.vx, c.vy) < 25 && k.gas && w.fuel > 0) { if (++chk.still > 90) chk.stuck = true; } else chk.still = 0;
    }
    requestAnimationFrame(pilot);
  })();
});
for (const n of LEVELS) {
  await page.evaluate(n => { window.__check = { sinks: 0, still: 0, stuck: false }; __ro.level(n); }, n);
  const t0 = Date.now();
  while (Date.now() - t0 < LEVEL_TIME) {
    const s = await page.evaluate(() => __ro.state);
    if (s === "finish" || s === "over") break;
    await page.waitForTimeout(250);
  }
  const r = await page.evaluate(() => ({ state: __ro.state, why: __ro.stats && __ro.stats.why, m: Math.round(__ro.dist / 20), ...window.__check }));
  const ok = !r.stuck && r.sinks <= MAX_SINKS && (r.why === "finish" || r.m >= MIN_METRES);
  console.log(`${ok ? "ok  " : "FAIL"} level ${n + 1}: ${r.why || "still driving"} at ${r.m} m, wheel sinks ${r.sinks}${r.stuck ? ", STUCK" : ""}`);
  if (!ok) failures.push(n + 1);
  await page.waitForTimeout(1600);   // let the results panel come up before the next level
}
await close();
if (errors.length) { console.log("Page errors:\n" + errors.join("\n")); process.exit(1); }
if (failures.length) { console.log(`\nRace Off physics failed on level ${failures.join(", ")}.`); process.exit(1); }
console.log("\nRace Off physics: all levels drove fine.");
