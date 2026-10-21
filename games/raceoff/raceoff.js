/* Race Off: physics hill-climb racing, in the style of the old Hot Wheels Race Off game.
   The car is a real little physics body: springy wheels grip the ground, the chassis rolls, wheelies when
   you floor it, and flips in the air. Hold GAS to go, BRAKE to slow down or reverse, NITRO for a burst. In the
   air GAS rolls the car nose up and BRAKE nose down. Land on your wheels: if the roof (and the driver's head)
   touches the ground, the run is over. Fuel drains, so grab the red fuel cans. Coins you collect are yours to
   keep: spend them in the garage on new cars and five upgrades each (engine, tires, suspension, fuel tank,
   nitro). 30 career levels in five worlds, each with three missions for stars, plus an Endless run.
   Assist makes it kinder (narrower gaps, fuel lasts longer) for levels that feel too hard. Every finished level
   records a ghost: a see-through copy of your fastest run that races you next time, with the gap in metres.
   Stunts (flips, wheelies, big air) pay coins and chain into combos up to x5. Rocks slow you down, purple zones
   weaken gravity, rain and snow cost grip, and night drives by headlight. The last level of each world is a race
   against a rival car, and a Daily track is the same for everybody on a given date. Paint and wheel styles are
   bought in the Style tab. Gamepad and (experimental) phone tilt work too, and any run can be replayed or shared.
   The soundtrack is the same original loop as Stunt Wheels (games/wheels/music.js). */
(function(){
  "use strict";
  const store = Hub.store;
  const R = () => (store.raceoff = store.raceoff || { coins: 0, car: "flame", owned: { flame: true }, up: {}, stars: {}, best: 0, music: true, cos: {}, paint: null, rim: "chrome", rivals: {} });

  /* ---------------- cars and upgrades ---------------- */
  const CARS = [
    { id: "flame",   name: "Flame Racer",  body: "#ff3b1f", trim: "#ffd400", price: 0,    power: 1.0,  grip: 1.0,  susp: 1.0, wr: 15, style: "rod",   awd: false },
    { id: "shark",   name: "Shark Bite",   body: "#2f7bff", trim: "#bfe3ff", price: 300,  power: 1.06, grip: 1.05, susp: 1.0, wr: 15, style: "fin",   awd: false },
    { id: "bones",   name: "Bone Rattler", body: "#f2f2f2", trim: "#1a1a24", price: 700,  power: 1.12, grip: 1.0,  susp: 1.1, wr: 16, style: "rod",   awd: false },
    { id: "comet",   name: "Neon Comet",   body: "#24e07a", trim: "#ff4df0", price: 1300, power: 1.18, grip: 1.1,  susp: 1.0, wr: 14, style: "wedge", awd: false },
    { id: "rocket",  name: "Rocket Rod",   body: "#8b3dff", trim: "#ffe14d", price: 2200, power: 1.35, grip: 1.0,  susp: 1.0, wr: 15, style: "fin",   awd: false },
    { id: "monster", name: "Monster Mash", body: "#ff8a00", trim: "#1a1a24", price: 3500, power: 1.2,  grip: 1.3,  susp: 1.35, wr: 21, style: "truck", awd: true },
    { id: "gold",    name: "Gold Rush",    body: "#ffc400", trim: "#ff3b1f", price: 5500, power: 1.45, grip: 1.2,  susp: 1.15, wr: 16, style: "wedge", awd: true }
  ];
  const UPS = [
    { id: "e", name: "Engine",     icon: "⚙️", text: "more power and speed" },
    { id: "t", name: "Tires",      icon: "🛞", text: "more grip" },
    { id: "s", name: "Suspension", icon: "🔩", text: "softer, steadier landings" },
    { id: "f", name: "Fuel tank",  icon: "⛽", text: "fuel lasts longer" },
    { id: "n", name: "Nitro",      icon: "🔥", text: "stronger, longer boost" }
  ];
  const PAINTS = [
    { id: "stock", name: "Stock", c: null, price: 0 },
    { id: "red", name: "Red", c: "#e5201a", price: 120 }, { id: "blue", name: "Blue", c: "#1f6bff", price: 120 },
    { id: "green", name: "Green", c: "#22c55e", price: 120 }, { id: "yellow", name: "Yellow", c: "#ffd400", price: 120 },
    { id: "pink", name: "Pink", c: "#ff4fa8", price: 120 }, { id: "black", name: "Black", c: "#23232e", price: 120 },
    { id: "white", name: "White", c: "#f4f4f4", price: 120 }, { id: "teal", name: "Teal", c: "#14c8c0", price: 120 },
    { id: "purple", name: "Purple", c: "#8b3dff", price: 120 }, { id: "orange", name: "Orange", c: "#ff8a00", price: 120 }
  ];
  const RIMS = [
    { id: "chrome", name: "Chrome", c: "#c9ced8", st: "spokes", price: 0 }, { id: "gold", name: "Gold", c: "#ffd84d", st: "spokes", price: 200 },
    { id: "neon", name: "Neon", c: "#4df2ff", st: "star", price: 250 }, { id: "pink", name: "Pink", c: "#ff4df0", st: "disc", price: 250 },
    { id: "lime", name: "Lime", c: "#7dff6a", st: "star", price: 250 }, { id: "flame", name: "Flame", c: "#ff7a00", st: "disc", price: 300 }
  ];
  const paintOf = () => PAINTS.find(p => p.id === R().paint) || PAINTS[0];
  const rimOf = () => RIMS.find(r => r.id === R().rim) || RIMS[0];
  const WX_ICON = { clear: "", rain: "🌧️", snow: "🌨️", night: "🌙", ash: "🔥" };
  const WX_GRIP = { clear: 1, rain: 0.8, snow: 0.88, night: 1, ash: 1 };
  const WX_BY_WORLD = [["clear", "rain", "night", "clear"], ["clear", "clear", "night"], ["clear", "snow", "snow", "night"], ["clear", "ash", "night"], ["clear"]];
  const upCost = lvl => Math.round(40 * Math.pow(lvl + 1, 1.7));
  const upsOf = id => (R().up[id] = R().up[id] || { e: 0, t: 0, s: 0, f: 0, n: 0 });

  /* ---------------- the worlds and levels ---------------- */
  const WORLDS = [
    { name: "Backyard",  icon: "🌳", sky: ["#6fc3ff", "#d8f0ff"], far: "#9fc2e8", near: "#7fb36a", top: "#4cc24a", dirt: ["#8a5a32", "#5e3a1e"], pit: "#2f8ff0", g: 1, kind: "hills" },
    { name: "Desert",    icon: "🌵", sky: ["#ffb35c", "#ffe7b0"], far: "#e09a5a", near: "#c47a3e", top: "#f0c070", dirt: ["#d9a066", "#a8703a"], pit: "#b86a2a", g: 1, kind: "mesa" },
    { name: "Snow",      icon: "❄️", sky: ["#9fd8ff", "#f2fbff"], far: "#cfe8ff", near: "#a8cce8", top: "#ffffff", dirt: ["#9fb8d0", "#6c88a6"], pit: "#4d9cff", g: 1, kind: "peaks" },
    { name: "Volcano",   icon: "🌋", sky: ["#3a0a0a", "#ff6a2a"], far: "#5a1a14", near: "#3a0f0c", top: "#6a3a2a", dirt: ["#4a2a20", "#2a1410"], pit: "#ff6a1a", g: 1, kind: "peaks" },
    { name: "Moon",      icon: "🌙", sky: ["#05051a", "#1b1650"], far: "#2a2266", near: "#14103a", top: "#c9c9d6", dirt: ["#8a8aa0", "#5a5a70"], pit: "#0a0a22", g: 0.6, kind: "stars" }
  ];
  const LEVELS = [];
  for (let n = 0; n < 30; n++) LEVELS.push({ n, world: Math.floor(n / 6), goal: 300 + 45 * n, d: n / 29, boss: n % 6 === 5 });
  const PX_M = 20;                                   // pixels per metre

  Hub.register({
    id: "raceoff", section: "games", title: "Race Off", icon: "🚙",
    blurb: "Physics stunt racing: springy wheels, flips, fuel and a garage to upgrade your cars!",
    stat: () => R().best ? `Best: ${R().best} m` : "",
    badges: [
      { id: "roFirst",  icon: "🏁", name: "Off the Line",  desc: "Finish a Race Off level",             test: () => (store.raceoffWins || 0) >= 1 },
      { id: "roStars",  icon: "⭐", name: "Star Collector", desc: "Earn 30 mission stars in Race Off",  test: () => totalStars() >= 30 },
      { id: "roLong",   icon: "🛣️", name: "Long Haul",     desc: "Drive 2000 m in Endless mode",        test: () => (R().best || 0) >= 2000 },
      { id: "roGarage", icon: "🔧", name: "Garage King",   desc: "Own 4 cars in Race Off",              test: () => Object.keys(R().owned || {}).length >= 4 },
      { id: "roFlip",   icon: "🔄", name: "Stunt Driver",  desc: "Do a flip in Race Off",               test: () => !!R().flipped },
      { id: "roCombo",  icon: "💥", name: "Combo Master",  desc: "Chain a x4 stunt combo in Race Off",  test: () => (R().bestCombo || 0) >= 4 },
      { id: "roRival",  icon: "🏎️", name: "Rival Beater",  desc: "Beat a rival car in Race Off",        test: () => Object.keys(R().rivals || {}).length >= 1 },
      { id: "roStyle",  icon: "🎨", name: "Custom Paint",  desc: "Buy paint or wheels in Race Off",     test: () => Object.keys(R().cos || {}).length >= 1 }
    ],
    mount
  });
  const weatherFor = (seed, world) => { const r = seeded(seed ^ 0x5bd1e995); r(); r(); const o = WX_BY_WORLD[world]; return o[Math.floor(r() * o.length)]; };
  const today = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
  function totalStars(){ const s = R().stars || {}; return Object.values(s).reduce((a, m) => a + (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1), 0); }
  const starsOf = n => { const m = (R().stars || {})[n] || 0; return (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1); };

  const seeded = seed => { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  // the three missions of a level: finish it, then two picked from the date-free seed of the level number
  function missionsOf(L){
    const rnd = seeded(7000 + L.n * 31);
    const a = [
      { id: "coins", text: `Collect ${25 + L.n * 3} coins`, goal: 25 + L.n * 3 },
      { id: "air",   text: `Fly for ${(0.9 + L.n * 0.025).toFixed(1)} s in one jump`, goal: 0.9 + L.n * 0.025 },
      { id: "nonitro", text: "Finish without nitro" }
    ];
    const b = [
      { id: "flip", text: "Do a flip" },
      { id: "fuel", text: "Finish with over a third of the fuel left" },
      { id: "time", text: `Finish in under ${Math.round(L.goal * PX_M / 640)} s`, goal: L.goal * PX_M / 640 }
    ];
    const pa = a[Math.floor(rnd() * a.length)], pb = b[Math.floor(rnd() * b.length)];
    return [{ id: "finish", text: "Finish the level" }, pa, L.boss ? { id: "rival", text: "Beat the rival car" } : pb];
  }

  function mount(host){
    host.innerHTML = `
    <section class="game-screen" id="roOverlay" hidden aria-label="Race Off">
      <div class="game-box">
        <div class="game-hud">
          <h2>🚙 Race Off</h2>
          <span class="mono game-stat" id="roLevel">Level 1</span>
          <span class="mono game-stat" id="roBank">🪙 0</span>
          <button class="btn ghost small" id="roMusic" type="button" aria-label="Music on or off">🎵</button>
          <button class="btn ghost small" id="roCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas id="roCanvas" width="960" height="540"></canvas>
          <div class="sw-pedals">
            <button class="sw-pedal sw-brake" data-rokey="brake" type="button" aria-label="Brake, and nose down in the air">◀ BRAKE</button>
            <button class="sw-pedal sw-nitro" data-rokey="nitro" type="button" aria-label="Nitro">🔥 NITRO</button>
            <button class="sw-pedal sw-gas" data-rokey="gas" type="button" aria-label="Gas, and nose up in the air">GAS ▶</button>
          </div>
          <div class="game-panel ro-panel" id="roPanel">
            <div class="game-panel-title" id="roTitle">Race Off</div>
            <div class="game-panel-text" id="roText"></div>
            <button class="btn" id="roPlayBtn" type="button">▶ Race</button>
            <div class="ro-tabs" role="group" aria-label="Menu"><button class="btn ghost small" type="button" data-tab="play">🏁 Play</button><button class="btn ghost small" type="button" data-tab="garage">🔧 Garage</button><button class="btn ghost small" type="button" data-tab="style">🎨 Style</button></div>
            <div class="ro-body" id="roBody"></div>
          </div>
        </div>
        <div class="game-help">→ or D: gas (nose up in the air) · ← or A: brake / reverse (nose down in the air) · Space: nitro · gamepad works too · wheelies, flips and big air chain into combos · don't land on your roof! · grab ⛽ fuel cans</div>
      </div>
    </section>`;

    const $ = id => document.getElementById(id);
    const overlay = $("roOverlay"), canvas = $("roCanvas"), ctx = canvas.getContext("2d");
    const panel = $("roPanel"), titleEl = $("roTitle"), textEl = $("roText"), playBtn = $("roPlayBtn"), body = $("roBody");
    const fx = Fun.pops(), music = WheelsMusic();
    const W = 960, H = 540;

    let open = false, running = false, last = 0, clock = 0, scale = 1;
    let tab = "play", mode = "career", pickLvl = 0, pickWorld = 0, garageCar = null;
    let state = "ready", W0 = WORLDS[0], lvl = null, missions = [], done = {};
    let terrain, car, cam = { x: 0, y: 0, z: 1 }, pickups = [], pads = [], runCoins = 0, fuel = 1, nitro = 0.4, time = 0, dist = 0;
    let airT = 0, airRot = 0, maxAir = 0, flips = 0, usedNitro = false, outT = 0, endT = 0, shake = 0, lastGroundY = 0, goalX = 0, dust = [], sparks = [], stats = null;
    const keys = { gas: false, brake: false, nitro: false };
    let ghost = null, rec = [], recT = 0, ghostGap = null;   // the best run to race against, and the run being recorded
    let weather = "clear", rocks = [], zones = [], rival = null, rivalWon = false, rivalGap = null;
    let combo = 0, comboT = 0, stunts = 0, bestCombo = 0, wheelieT = 0, wheelie = false, hitCool = 0;
    let lastRun = null, resultsOn = false, replayT = 0, tiltRoll = 0, tiltSeen = false;
    const srcOn = { pad: {}, tilt: {} };

    /* ---------------- the ground: a polyline that is made as you drive ---------------- */
    function newTerrain(seed, d0, endless, goalPx){
      const T = { assist: !!R().assist, pieces: [], x: 0, y: 0, rnd: seeded(seed), d: d0, endless, goalPx, nextFuel: 3800, nextNitro: 6200, cur: null, maxY: 0, haz: 0, hrnd: seeded(seed + 99), world: 0 };
      T.cur = { pts: [{ x: -400, y: 0 }, { x: 0, y: 0 }] }; T.pieces.push(T.cur);
      return T;
    }
    function addPts(T, len, f, step){
      step = step || 22;
      const n = Math.max(2, Math.round(len / step)), x0 = T.x, y0 = T.y;
      for (let i = 1; i <= n; i++) { const t = i / n, y = y0 + f(t); T.cur.pts.push({ x: x0 + len * t, y }); }
      T.x = x0 + len; T.y = T.cur.pts[T.cur.pts.length - 1].y; T.maxY = Math.max(T.maxY, T.y);
    }
    // coins along the last stretch of ground, then maybe a fuel or nitro can
    function decorate(T, x0, x1, density){
      const rnd = T.rnd;
      let x = x0 + 60;
      while (x < x1 - 40) {
        if (rnd() < density) {
          const run = 3 + Math.floor(rnd() * 5);
          for (let i = 0; i < run && x < x1 - 40; i++, x += 70) { const g = groundAt(T, x); if (g) pickups.push({ x, y: g.y - 44 - Math.sin(i / run * Math.PI) * 26, t: rnd() < 0.08 ? "gold" : "coin", got: false }); }
        }
        x += 160 + rnd() * 260;
      }
      const place = (key, t, gapMul) => { if (x1 > T[key]) { const px = Math.max(x0 + 80, Math.min(x1 - 80, T[key])), g = groundAt(T, px); if (g) { pickups.push({ x: px, y: g.y - 54, t, got: false }); T[key] = px + (t === "fuel" ? 3800 + rnd() * 1800 * T.d : 6800 + rnd() * 3000) * gapMul; } else T[key] += 200; } };
      place("nextFuel", "fuel", 1); place("nextNitro", "nitro", 1);
    }
    // rocks on the flat bits and low-gravity zones over some gaps, from a second random stream so the roads stay the same
    function genSegment(T){
      const x0 = T.x, n0 = T.pieces.length;
      genRoad(T);
      const h = T.hrnd;
      if (T.pieces.length > n0 && h() < T.haz * 0.9) { const lip = T.pieces[n0 - 1].pts; zones.push({ x0: lip[lip.length - 1].x - 30, x1: T.pieces[n0].pts[0].x + 160 }); }
      if (h() < T.haz) {
        const x = x0 + (T.x - x0) * (0.2 + 0.6 * h()), g = groundAt(T, x);
        if (g && x > 900 && Math.abs(g.ty) < 0.16 && !(T.goalPx && Math.abs(x - T.goalPx) < 500) && !pads.some(p => x > p.x0 - 60 && x < p.x1 + 60)) rocks.push({ x, y: g.y, r: 15 + h() * 10, hit: false });
      }
    }
    function genRoad(T){
      const rnd = T.rnd, d = T.d, startX = T.x, pickSeg = rnd();
      const y0 = T.y, bias = y0 > 500 ? -1 : y0 < -700 ? 1 : 0;
      let dens = 0.55;
      if (pickSeg < 0.26) { // rolling hills
        const len = 700 + rnd() * 500, A = 10 + d * 44 + rnd() * 10, k = Math.max(1, Math.round(len / (260 + rnd() * 160)));
        addPts(T, len, t => A * Math.sin(Math.PI * 2 * k * t) + bias * 0);
      } else if (pickSeg < 0.46) { // a long climb or descent
        const len = 520 + rnd() * 420, dy = (bias ? bias * -1 : rnd() < 0.55 ? -1 : 1) * (70 + rnd() * (110 + d * 120));
        addPts(T, len, t => dy * (1 - Math.cos(Math.PI * t)) / 2);
      } else if (pickSeg < 0.58) { // bumps
        const len = 520 + rnd() * 220, A = 8 + d * 12, wl = 78 + rnd() * 30;
        addPts(T, len, t => A * Math.sin(len * t / wl * Math.PI * 2), 14);
      } else if (pickSeg < 0.86) { // a ramp and a gap to jump
        const gap = (200 + d * 170 + rnd() * 60) * (T.assist ? 0.78 : 1);
        const flat = 200 + rnd() * 120; addPts(T, flat, () => 0);
        if (gap > 300 || rnd() < 0.5) pads.push({ x0: T.x - flat * 0.9, x1: T.x - 10 });
        const rise = 50 + rnd() * 40 + d * 50;
        addPts(T, 260, t => -rise * Math.pow(t, 1.7));
        decorate(T, startX, T.x, 0.4);
        const lipX = T.x, lipY = T.y;
        const landY = lipY + 40 + rnd() * 90 - (rnd() < 0.3 ? 70 : 0);
        T.cur = { pts: [{ x: lipX + gap, y: landY }] }; T.pieces.push(T.cur); T.x = lipX + gap; T.y = landY;
        for (let i = 1; i < 7; i++) { const t = i / 7; pickups.push({ x: lipX + gap * t, y: lipY + (landY - lipY) * t - 70 - Math.sin(Math.PI * t) * (70 + gap * 0.1), t: i === 3 ? "gold" : "coin", got: false }); }
        addPts(T, 300, t => 50 * (1 - Math.cos(Math.PI * t)) / 2);
        addPts(T, 160 + rnd() * 120, () => 0);
        decorate(T, lipX + gap, T.x, 0.5);
        return;
      } else { // a flat with pickups and a speed pad
        const len = 360 + rnd() * 240; if (rnd() < 0.6) pads.push({ x0: T.x + 60, x1: T.x + 60 + 220 });
        addPts(T, len, () => 0); dens = 0.9;
      }
      decorate(T, startX, T.x, dens);
    }
    function extend(T, toX){ while (T.x < toX) genSegment(T); }
    function groundAt(T, x){
      // the piece whose span holds x, then the segment inside it
      for (let pi = T.pieces.length - 1; pi >= 0; pi--) {
        const pts = T.pieces[pi].pts;
        if (x < pts[0].x) continue;
        if (x > pts[pts.length - 1].x) return null;
        let lo = 0, hi = pts.length - 1;
        while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].x <= x) lo = m; else hi = m; }
        const a = pts[lo], b = pts[hi], dx = b.x - a.x || 1e-6, l = Math.hypot(dx, b.y - a.y), u = (x - a.x) / dx;
        return { y: a.y + (b.y - a.y) * u, nx: (b.y - a.y) / l, ny: -dx / l, tx: dx / l, ty: (b.y - a.y) / l };
      }
      return null;
    }
    // the point on the ground nearest to (px, py) within r: its distance, how far the centre is above it, and which way is out
    function contact(T, px, py, r){
      let best = null;
      for (let pi = T.pieces.length - 1; pi >= 0; pi--) {
        const pts = T.pieces[pi].pts;
        if (px + r + 30 < pts[0].x) continue;
        if (px - r - 30 > pts[pts.length - 1].x) { if (pi === T.pieces.length - 1) break; continue; }
        let lo = 0, hi = pts.length - 1;
        while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].x <= px - r - 30) lo = m; else hi = m; }
        for (let i = Math.max(0, lo); i < pts.length - 1 && pts[i].x < px + r + 30; i++) {
          const a = pts[i], b = pts[i + 1], ex = b.x - a.x, ey = b.y - a.y, l2 = ex * ex + ey * ey || 1e-6;
          let u = ((px - a.x) * ex + (py - a.y) * ey) / l2; u = Math.max(0, Math.min(1, u));
          const qx = a.x + ex * u, qy = a.y + ey * u, dx = px - qx, dy = py - qy, dd = Math.hypot(dx, dy);
          if (dd >= r) continue;
          const l = Math.sqrt(l2); let nx = ey / l, ny = -ex / l;
          if ((u === 0 || u === 1) && dd > 0.01) { nx = dx / dd; ny = dy / dd; }   // round a corner the push goes straight away from the corner
          const sd = dx * nx + dy * ny;
          const pen = r - sd;
          if (!best || pen > best.pen) best = { pen, nx, ny, tx: -ny, ty: nx, qx, qy };
        }
      }
      if (best && best.tx < 0) { best.tx = -best.tx; best.ty = -best.ty; }
      return best;
    }

    /* ---------------- the car ---------------- */
    function carStats(){
      const C = CARS.find(c => c.id === R().car) || CARS[0], U = upsOf(C.id);
      return {
        C, wr: C.wr,
        engine: 1750 * C.power * (1 + 0.12 * U.e), vmax: 1050 * (0.9 + 0.1 * C.power) * (1 + 0.06 * U.e),
        grip: 1.0 * C.grip * (1 + 0.1 * U.t),
        k: 150 * C.susp * (1 + 0.06 * U.s), damp: 15 * Math.sqrt(C.susp) * (1 + 0.16 * U.s),
        drain: 1 / (1 + 0.15 * U.f), nitroPow: 1 + 0.12 * U.n, nitroUse: 1 / (1 + 0.1 * U.n)
      };
    }
    function spawn(x){
      const g = groundAt(terrain, x) || { y: 0 };
      car = { x, y: g.y - 70, vx: 0, vy: 0, a: 0, w: 0, wheels: [{ ang: 0, len: 22, on: false }, { ang: 0, len: 22, on: false }], air: true, head: false, S: carStats() };
      lastGroundY = g.y; airT = 0; airRot = 0;
    }
    const WHEELS = [[-36, 10], [36, 10]];
    function physics(h){
      const c = car, S = c.S, zone = zones.length && zones.some(z => c.x > z.x0 && c.x < z.x1), G = 1500 * W0.g * (zone ? 0.55 : 1), Lmax = 24, Lmin = 8, I = 5400, wr = S.wr;
      const sa = Math.sin(c.a), ca = Math.cos(c.a), dn = [-sa, ca];
      let ax = 0, ay = G, tq = 0, touching = 0;
      const racing = state === "race" || state === "finish";
      const drive = racing && keys.gas && fuel > 0, brake = racing && keys.brake;
      const boostOn = racing && keys.nitro && nitro > 0 && fuel > 0;
      WHEELS.forEach(([lx, ly], wi) => {
        const wh = c.wheels[wi], Px = c.x + lx * ca - ly * sa, Py = c.y + lx * sa + ly * ca;
        const Cx = Px + dn[0] * Lmax, Cy = Py + dn[1] * Lmax;
        const ct = contact(terrain, Cx, Cy, wr);
        wh.on = !!ct;
        if (!ct) { wh.len += (Lmax - wh.len) * Math.min(1, h * 14); wh.ang += (drive ? 26 : 5) * h; wh.sx = Px + dn[0] * wh.len; wh.sy = Py + dn[1] * wh.len; return; }
        touching++;
        const Wx = Cx + ct.nx * ct.pen, Wy = Cy + ct.ny * ct.pen;
        let ex = Px - Wx, ey = Py - Wy, len = Math.hypot(ex, ey) || 1; ex /= len; ey /= len;
        const L = Math.max(Lmin, Math.min(Lmax, len)); let comp = Lmax - L, extra = len < Lmin ? Lmin - len : 0;
        const rx = Px - c.x, ry = Py - c.y, vPx = c.vx - c.w * ry, vPy = c.vy + c.w * rx;
        const cv = -(vPx * ex + vPy * ey);
        let F = S.k * (comp + extra * 3) + S.damp * cv * (cv > 0 ? 1 : 0.6);
        F = Math.max(0, F);
        ax += ex * F; ay += ey * F; tq += (rx * ey * F - ry * ex * F) / I;
        wh.len += (L - wh.len) * Math.min(1, h * 30); wh.sx = Wx; wh.sy = Wy;
        // grip: engine, brakes and rolling along the ground
        const Fn = F * Math.max(0.15, ex * ct.nx + ey * ct.ny), mu = 1.6 * S.grip * WX_GRIP[weather], vt = vPx * ct.tx + vPy * ct.ty;
        let Ft = 0;
        const driven = S.C.awd || wi === 0, pad = pads.find(p => c.x > p.x0 && c.x < p.x1);
        if (drive && driven) Ft += S.engine * (S.C.awd ? 0.5 : 1) * (boostOn ? 1.25 * S.nitroPow : 1) * Math.max(0, 1 - Math.max(0, vt) / (S.vmax * (boostOn ? 1.35 : 1)));
        if (boostOn && !driven) Ft += S.engine * 0.3 * S.nitroPow;
        if (pad && driven) Ft += 1400;
        if (brake) { if (vt > 40) Ft -= Math.min(900, mu * Fn); else if (driven) Ft -= S.engine * 0.5 * (S.C.awd ? 0.5 : 1) * Math.max(0, 1 - Math.max(0, -vt) / (S.vmax * 0.4)); }
        else if (!drive) Ft -= Math.max(-0.2 * Fn, Math.min(0.2 * Fn, vt * 1.4));
        Ft = Math.max(-mu * Fn, Math.min(mu * Fn, Ft));
        // pushes sideways of the ground, no more than the wheel can grip
        const fx2 = ct.tx * Ft, fy2 = ct.ty * Ft;
        const ay0 = Py + (Wy - Py) * 0.3;     // the push is felt a little below the axle, so full gas lifts the nose without flipping the car
        ax += fx2; ay += fy2; tq += (rx * fy2 - (ay0 - c.y) * fx2) / I;
        wh.ang += vt * h / wr;
        lastGroundY = ct.qy;
      });
      wheelie = c.wheels[0].on && !c.wheels[1].on && c.a < -0.22;
      // rocks slow the car down, unless the wheels sail over them
      if (rocks.length && racing && hitCool <= 0) rocks.forEach(rk => {
        if (rk.hit || Math.abs(rk.x - c.x) > 130) return;
        c.wheels.forEach(wh => { if (!rk.hit && wh.sx !== undefined && Math.hypot(wh.sx - rk.x, wh.sy - rk.y) < rk.r + S.wr - 3) { rk.hit = true; hitCool = 0.4; c.vx *= 0.45; c.vy -= 160; c.w -= 1.2; shake = 7; Fun.sfx.thunk(); fx.pop("OUCH!", W / 2, H * 0.3, "#ff9a8a", 30); for (let i = 0; i < 8; i++) sparks.push({ x: rk.x, y: rk.y - rk.r, vx: (Math.random() - 0.5) * 260, vy: -Math.random() * 220, t: 0 }); } });
      });
      // the bumpers and the driver's head
      [[52, 10], [-52, 10], [-4, -30], [14, -24], [-22, -22]].forEach(([lx, ly], i) => {
        const qx = c.x + lx * ca - ly * sa, qy = c.y + lx * sa + ly * ca, g = groundAt(terrain, qx);
        if (!g || qy < g.y) return;
        const pen = qy - g.y;
        if (pen > 60) return;                      // through a cliff face, not on top of the ground
        if (i >= 2) { if (pen > 2) c.head = true; }
        const vq = c.vy + c.w * (qx - c.x);
        const F = Math.max(0, 900 * pen - 8 * vq * (vq > 0 ? 1 : 0));
        ay -= F; tq += ((qx - c.x) * -F) / I;
        if (i < 2 && pen > 3 && Math.random() < 0.3) sparks.push({ x: qx, y: g.y, vx: (Math.random() - 0.5) * 200, vy: -Math.random() * 160, t: 0 });
      });
      // in the air: gas rolls the nose up, brake rolls it down
      if (!touching) { if (racing && keys.gas) c.w -= 9 * h; if (racing && keys.brake) c.w += 9 * h; c.w *= 1 - 0.5 * h; }
      else { c.w *= 1 - 2.2 * h; c.w = Math.max(-5, Math.min(5, c.w)); }
      ax -= c.vx * 0.012; ay -= c.vy * 0.004;
      c.vx += ax * h; c.vy += ay * h; c.w += tq * h;
      c.w = Math.max(-9, Math.min(9, c.w));
      c.x += c.vx * h; c.y += c.vy * h; c.a += c.w * h;
      const grounded = touching > 0;
      if (!grounded) { airT += h; airRot += c.w * h; }
      else if (c.air) landed();
      c.air = !grounded;
    }
    // a stunt pays coins, and doing another within six seconds raises the multiplier (up to x5)
    function stunt(name, pts, col){
      combo = comboT > 0 ? combo + 1 : 1; comboT = 6; stunts++; bestCombo = Math.max(bestCombo, combo);
      store.raceoffStunts = (store.raceoffStunts || 0) + 1;
      const mul = Math.min(5, combo), got = pts * mul; runCoins += got; Fun.sfx.tada();
      fx.pop(`${name} +${got}${mul > 1 ? "  x" + mul : ""}`, W / 2, H * 0.28, col, 34);
    }
    function landed(){
      maxAir = Math.max(maxAir, airT);
      const f = Math.round(Math.abs(airRot) / (Math.PI * 2));
      if (airT > 0.5 && f >= 1) {
        flips += f; R().flipped = true;
        stunt(`${f > 1 ? f + "x " : ""}${airRot > 0 ? "FRONT" : "BACK"} FLIP!`, 40 * f, "#ffe14d");
      } else if (airT > 1.2) stunt("BIG AIR " + airT.toFixed(1) + " s", Math.round(airT * 12), "#9be3ff");
      if (airT > 0.35) { shake = Math.min(10, airT * 8); for (let i = 0; i < 8; i++) dust.push({ x: car.x + (Math.random() - 0.5) * 70, y: lastGroundY, vx: (Math.random() - 0.5) * 240, vy: -Math.random() * 140, t: 0 }); Fun.sfx.thunk(); }
      airT = 0; airRot = 0;
    }

    /* ---------------- a run ---------------- */
    function startRun(){
      const endless = mode !== "career";
      lvl = endless ? null : LEVELS[pickLvl];
      W0 = endless ? WORLDS[Math.floor(Math.random() * WORLDS.length)] : WORLDS[lvl.world];
      goalX = endless ? 1e12 : lvl.goal * PX_M;
      const daily = mode === "daily", dseed = today();
      if (daily) W0 = WORLDS[dseed % 5];
      const seed = daily ? dseed : endless ? (Date.now() & 0xffff) : 100 + lvl.n * 7919;
      terrain = newTerrain(seed, daily ? 0.45 + (dseed % 7) / 20 : endless ? 0.05 : lvl.d, endless, goalX);
      terrain.haz = lvl ? (lvl.n < 2 ? 0 : 0.12 + 0.38 * lvl.d) : daily ? 0.35 : 0.25;
      weather = lvl ? (lvl.n === 0 ? "clear" : weatherFor(seed, lvl.world)) : weatherFor(seed, WORLDS.indexOf(W0));
      pickups = []; pads = []; dust = []; sparks = []; rocks = []; zones = [];
      extend(terrain, 2400); spawn(120);
      combo = 0; comboT = 0; stunts = 0; bestCombo = 0; wheelieT = 0; wheelie = false; hitCool = 0; resultsOn = false; lastRun = null;
      rivalWon = false; rivalGap = null; rival = null;
      if (lvl && lvl.boss) { const g = groundAt(terrain, 120); rival = { x: 120, y: g.y - 38, a: 0, v: (560 + 9 * lvl.n) * (R().assist ? 0.9 : 1) }; }
      fuel = 1; nitro = 0.4; time = 0; runCoins = 0; flips = 0; maxAir = 0; usedNitro = false; outT = 0; endT = 0; dist = 0; shake = 0; clock = 0;
      missions = endless ? [] : missionsOf(lvl); done = {};
      cam.x = car.x; cam.y = car.y; cam.z = 1; fx.clear();
      rec = []; recT = 0; ghostGap = null;
      ghost = !endless && R().ghost && R().ghost[lvl.n] ? R().ghost[lvl.n] : null;
      state = "count";
      stats = null;
    }
    function missionDone(m){
      switch (m.id) {
        case "finish": return state === "finish";
        case "coins": return runCoins >= m.goal;
        case "air": return maxAir >= m.goal;
        case "flip": return flips >= 1;
        case "nonitro": return state === "finish" && !usedNitro;
        case "fuel": return state === "finish" && fuel > 0.33;
        case "time": return state === "finish" && time <= m.goal;
        case "rival": return state === "finish" && !rivalWon;
      }
      return false;
    }
    function endRun(why){
      if (state === "over" || state === "finish") return;
      const finished = why === "finish";
      state = finished ? "finish" : "over";
      const S = R(), m = Math.round(dist / PX_M);
      let bonus = 0, newStars = 0, newBest = false;
      let dailyNote = "";
      S.bestCombo = Math.max(S.bestCombo || 0, bestCombo);
      if (mode === "endless") { if (m > S.best) { S.best = m; } }
      else if (mode === "daily") {
        const day = today();
        if (!S.dayBest || S.dayBest.date !== day) S.dayBest = { date: day, m: 0 };
        if (m > S.dayBest.m) S.dayBest.m = m;
        if (S.dayDone !== day && m >= 300) { S.dayDone = day; bonus = 100; store.raceoffDaily = (store.raceoffDaily || 0) + 1; dailyNote = "Daily bonus +100! "; }
      }
      else if (finished) {
        let mask = (S.stars || {})[lvl.n] || 0;
        missions.forEach((mi, i) => { if (missionDone(mi) && !(mask >> i & 1)) { mask |= 1 << i; newStars++; } });
        S.stars = S.stars || {}; S.stars[lvl.n] = mask;
        bonus = 100 + 100 * newStars; store.raceoffWins = (store.raceoffWins || 0) + 1;
        if (lvl.boss && !rivalWon) { S.rivals = S.rivals || {}; if (!S.rivals[lvl.n]) { S.rivals[lvl.n] = true; bonus += 300; dailyNote = "Rival beaten, +300! "; } }
        S.bestTime = S.bestTime || {}; S.ghost = S.ghost || {};
        const prev = S.bestTime[lvl.n];
        if (!prev || time < prev) { newBest = true; S.bestTime[lvl.n] = Math.round(time * 10) / 10; S.ghost[lvl.n] = { car: S.car, d: rec.concat([[Math.round(car.x), Math.round(car.y), Math.round(car.a * 100)]]) }; }
      }
      const earned = runCoins + bonus;
      S.coins += earned;
      lastRun = { d: rec.concat([[Math.round(car.x), Math.round(car.y), Math.round(car.a * 100)]]), m, why, time, car: S.car, finish: finished, label: mode === "career" ? `level ${lvl.n + 1}` : mode === "daily" ? "today's daily track" : "an endless run" };
      stats = { m, why, earned, bonus, runCoins, newStars, newBest, time, dailyNote, stunts, bestCombo, rivalWon, mission: missions.map(mi => ({ text: mi.text, ok: missionDone(mi) })) };
      Hub.saveStore(); Hub.checkBadges();
      if (finished) { Fun.sfx.tada(); Hub.confettiBurst(canvas); } else { Fun.sfx.crash(); if (why === "crash") fx.pop("CRASH!", W / 2, H * 0.35, "#ff6b6b", 48); if (why === "fuel") fx.pop("OUT OF FUEL!", W / 2, H * 0.35, "#ff6b4a", 44); if (why === "fell") fx.pop("SPLASH!", W / 2, H * 0.35, "#7fd0ff", 44); }
      setTimeout(() => showResults(), finished ? 1400 : 1100);
    }

    function update(dt){
      clock += dt;
      if (state === "replay") { updateReplay(dt); return; }
      if (state === "count") { if (clock > 1.9) { state = "race"; Fun.sfx.whoosh(); } else { physics(Math.min(dt, 1 / 60)); car.x = 120; car.vx = 0; } }   // held on the start line while the lights count down
      else if (state === "race") {
        time += dt;
        recT += dt; if (recT >= 0.1) { recT -= 0.1; if (rec.length < 6000) rec.push([Math.round(car.x), Math.round(car.y), Math.round(car.a * 100)]); }
        hitCool = Math.max(0, hitCool - dt);
        comboT = Math.max(0, comboT - dt); if (comboT <= 0) combo = 0;
        if (wheelie) wheelieT += dt; else { if (wheelieT > 1) stunt(`WHEELIE ${wheelieT.toFixed(1)} s`, Math.round(wheelieT * 10), "#ffb86b"); wheelieT = 0; }
        if (rival) updateRival(dt);
        const n = 4, S = car.S;
        for (let i = 0; i < n && state === "race"; i++) physics(dt / n);
        extend(terrain, car.x + 2200);
        dist = Math.max(dist, car.x - 120);
        // fuel and nitro
        const gasing = keys.gas && fuel > 0;
        fuel = Math.max(0, fuel - dt * (gasing ? 0.036 : 0.012) * S.drain * (R().assist ? 0.65 : 1));
        if (keys.nitro && nitro > 0 && fuel > 0) { nitro = Math.max(0, nitro - dt * 0.28 * S.nitroUse); usedNitro = true; }
        pickups.forEach(p => {
          if (p.got || Math.abs(p.x - car.x) > 70) return;
          if (Math.hypot(p.x - car.x, p.y - car.y) < (p.t === "coin" ? 46 : 56)) {
            p.got = true;
            if (p.t === "coin") { runCoins++; Fun.sfx.coin(); }
            else if (p.t === "gold") { runCoins += 5; Fun.sfx.coin(); fx.pop("+5", W * 0.5, 120, "#ffd84d", 24); }
            else if (p.t === "fuel") { fuel = Math.min(1, fuel + 0.5); Fun.sfx.ding(); fx.pop("FUEL!", W * 0.5, 120, "#ff6b4a", 30); }
            else { nitro = Math.min(1, nitro + 0.5); Fun.sfx.zap(); fx.pop("NITRO!", W * 0.5, 120, "#4df2ff", 30); }
          }
        });
        if (car.x < 60 && car.vx < 0) { car.x = 60; car.vx = 0; }
        const gc = groundAt(terrain, car.x);
        if (gc && car.y > gc.y + 30) car.head = true;   // the body is inside the ground
        if (rival) rivalGap = Math.round((car.x - rival.x) / PX_M);
        if (ghost) { const g = ghostAt(time); ghostGap = g ? Math.round((car.x - g.x) / PX_M) : null; }
        if (car.head) endRun("crash");
        else if (car.y > lastGroundY + 420) endRun("fell");
        else if (fuel <= 0 && Math.hypot(car.vx, car.vy) < 30) { outT += dt; if (outT > 1.4) endRun("fuel"); } else outT = 0;
        if (lvl && car.x >= goalX && state === "race") endRun("finish");
        if (pickups.length > 120) pickups = pickups.filter(p => p.x > car.x - 1200);
        if (pads.length > 20) pads = pads.filter(p => p.x1 > car.x - 1200);
      } else if (state === "finish" || state === "over") {
        endT += dt; if (rival && state === "finish") updateRival(dt);
        if (state === "finish") for (let i = 0; i < 4; i++) physics(dt / 4);
        else { car.vx *= 0.97; physics(dt); }
      }
      shake = Math.max(0, shake - dt * 28);
      for (let i = dust.length - 1; i >= 0; i--) { const d = dust[i]; d.t += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 400 * dt; if (d.t > 0.6) dust.splice(i, 1); }
      for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 900 * dt; if (s.t > 0.4) sparks.splice(i, 1); }
      const sp = Math.hypot(car.vx, car.vy), big = canvas.clientWidth && canvas.clientWidth < 700 ? 1.2 : 1;
      const tz = big * Math.max(0.62, 0.95 - sp / 3400);
      cam.z += (tz - cam.z) * Math.min(1, dt * 1.5);
      cam.x += (car.x + Math.min(240, sp * 0.18) - cam.x) * Math.min(1, dt * 6);
      cam.y += (car.y - 30 - cam.y) * Math.min(1, dt * 3.5);
      if (R().music !== false && store.sound !== false) music.engine(Math.min(1, sp / 1300), state === "race" || state === "count");
    }

    /* ---------------- the rival car: scripted, it follows the ground at a steady pace ---------------- */
    function updateRival(dt){
      const r = rival, g = groundAt(terrain, r.x);
      if (g) {
        const f = Math.max(0.55, Math.min(1.25, 1 + g.ty * (g.ty < 0 ? 1.1 : 0.5)));
        r.x += r.v * f * dt;
        const g2 = groundAt(terrain, r.x) || g;
        r.y += (g2.y - 38 - r.y) * Math.min(1, dt * 9);
        r.a += (Math.atan2(g2.ty, g2.tx) - r.a) * Math.min(1, dt * 8);
      } else { r.x += r.v * dt; r.a += (0.1 - r.a) * Math.min(1, dt * 3); }
      if (!rivalWon && r.x >= goalX && state === "race") { rivalWon = true; fx.pop("The rival finished first!", W / 2, H * 0.22, "#ff9a8a", 26); }
    }
    /* ---------------- replay: the recorded run again, with a close chase camera ---------------- */
    function startReplay(){
      if (!lastRun || lastRun.d.length < 3) return;
      replayT = 0; state = "replay"; running = true; panel.hidden = true; dust = []; sparks = []; fx.clear();
      car.S = carStats(); car.S.C = CARS.find(c => c.id === lastRun.car) || car.S.C; car.wheels.forEach(w => { w.sx = undefined; w.sy = undefined; });
    }
    function endReplay(){ state = lastRun && lastRun.finish ? "finish" : "over"; running = false; showPanel(playBtn.textContent); }
    function updateReplay(dt){
      replayT += dt; const d = lastRun.d, f = replayT / 0.1, i = Math.min(d.length - 1, Math.floor(f)), j = Math.min(d.length - 1, i + 1), u = Math.min(1, f - i);
      const x = d[i][0] + (d[j][0] - d[i][0]) * u, y = d[i][1] + (d[j][1] - d[i][1]) * u, a = (d[i][2] + (d[j][2] - d[i][2]) * u) / 100;
      car.vx = (d[j][0] - d[i][0]) * 10; car.vy = (d[j][1] - d[i][1]) * 10;
      car.wheels.forEach(w => { w.ang += car.vx * dt / car.S.wr; });
      car.x = x; car.y = y; car.a = a; car.air = false;
      cam.z += (1.2 * (canvas.clientWidth && canvas.clientWidth < 700 ? 1.15 : 1) - cam.z) * Math.min(1, dt * 2);
      cam.x += (car.x + 120 - cam.x) * Math.min(1, dt * 8); cam.y += (car.y - 30 - cam.y) * Math.min(1, dt * 6);
      if (f >= d.length - 1 + 8) endReplay();
    }

    /* ---------------- gamepad and phone tilt: extra sources for the same three controls ---------------- */
    function feed(src, want){
      Object.keys(want).forEach(k => { if (want[k]) { keys[k] = true; srcOn[src][k] = true; } else if (srcOn[src][k]) { keys[k] = false; srcOn[src][k] = false; } });
    }
    let padStart = false;
    function pollInputs(){
      const pads = navigator.getGamepads ? navigator.getGamepads() : [], gp = Array.prototype.find.call(pads || [], g => g && g.connected);
      if (gp) {
        const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed), ax = gp.axes[0] || 0;
        const a = b(0);
        if (!running && !panel.hidden && a && !padStart) start();
        padStart = a;
        feed("pad", { gas: running && (b(7) || a || b(15) || ax > 0.45), brake: running && (b(6) || b(1) || b(14) || ax < -0.45), nitro: running && (b(2) || b(3) || b(5)) });
      } else if (Object.values(srcOn.pad).some(Boolean)) feed("pad", { gas: false, brake: false, nitro: false });
      if (R().tilt && tiltSeen) feed("tilt", { gas: running && tiltRoll > 12, brake: running && tiltRoll < -12 });
    }
    function onMotion(e){
      const g = e.accelerationIncludingGravity; if (!g || g.x == null || g.y == null) return;
      const k = /iP(hone|ad)/.test(navigator.userAgent) ? -1 : 1, A = (((screen.orientation && screen.orientation.angle) || window.orientation || 0) * Math.PI) / 180;
      let r = ((-Math.atan2(k * g.x, k * g.y) + A) * 180) / Math.PI; r = ((r + 540) % 360) - 180; tiltRoll = r; tiltSeen = true;
    }
    window.addEventListener("devicemotion", onMotion);

    /* ---------------- drawing ---------------- */
    function fitCanvas(){ const s = Fun.res(canvas.clientWidth, W, 2); if (Math.abs(s - scale) < 0.01) return; scale = s; canvas.width = Math.round(W * s); canvas.height = Math.round(H * s); }
    const sx = x => (x - cam.x) * cam.z + W * 0.36, sy = y => (y - cam.y) * cam.z + H * 0.58;
    function drawBackground(){
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, W0.sky[0]); g.addColorStop(1, W0.sky[1]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (W0.kind === "stars" || W0.name === "Volcano") { ctx.fillStyle = "#fff"; for (let i = 0; i < 80; i++) { const x = ((i * 137 - cam.x * 0.04) % W + W) % W, y = (i * 59) % (H * 0.7); ctx.globalAlpha = (W0.name === "Volcano" ? 0.15 : 0.4) + 0.4 * Math.abs(Math.sin(clock + i)); ctx.fillRect(x, y, 2, 2); } ctx.globalAlpha = 1; }
      // the sun or the moon, then two layers of hills that slide slower than the road
      ctx.fillStyle = W0.name === "Moon" ? "#e8e8ff" : "rgba(255,244,200,0.9)"; ctx.beginPath(); ctx.arc(W * 0.8 - cam.x * 0.01 % 40, 90, 34, 0, 7); ctx.fill();
      [[0.1, W0.far, 0.62, 1], [0.25, W0.near, 0.74, 1.5]].forEach(([par, col, base, size]) => {
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H);
        for (let x = 0; x <= W + 40; x += 40) {
          const wx = x + cam.x * par, hgt = (50 + 38 * Math.sin(wx * 0.006 / size) + 26 * Math.sin(wx * 0.017 + 1)) * size * (W0.kind === "peaks" ? 1.4 : 1);
          ctx.lineTo(x, H * base - hgt - (cam.y * par * 0.15));
        }
        ctx.lineTo(W, H); ctx.fill();
      });
    }
    function drawTerrain(){
      const x0 = cam.x - (W * 0.36) / cam.z - 80, x1 = cam.x + (W * 0.7) / cam.z + 80, bottom = H + 40;
      terrain.pieces.forEach((pc, pi) => {
        const pts = pc.pts;
        if (pts[pts.length - 1].x < x0 || pts[0].x > x1) return;
        // the pit before this piece
        if (pi > 0) {
          const prev = terrain.pieces[pi - 1].pts, ex = prev[prev.length - 1], sx0 = sx(ex.x), sx1 = sx(pts[0].x);
          if (sx1 > -20 && sx0 < W + 20) {
            const ty = sy(Math.max(ex.y, pts[0].y) + 170), grd = ctx.createLinearGradient(0, ty, 0, bottom); grd.addColorStop(0, W0.pit); grd.addColorStop(1, "rgba(0,0,0,0.6)");
            ctx.fillStyle = grd; ctx.fillRect(sx0, ty + Math.sin(clock * 3) * 2, sx1 - sx0, bottom - ty);
            ctx.fillStyle = "rgba(255,255,255,0.25)"; for (let x = sx0; x < sx1; x += 26) ctx.fillRect(x + (clock * 30 % 26), ty + 4, 12, 3);
          }
        }
        let i0 = 0; while (i0 < pts.length - 1 && pts[i0 + 1].x < x0) i0++;
        let i1 = i0; while (i1 < pts.length - 1 && pts[i1].x < x1) i1++;
        ctx.beginPath(); ctx.moveTo(sx(pts[i0].x), bottom);
        for (let i = i0; i <= i1; i++) ctx.lineTo(sx(pts[i].x), sy(pts[i].y));
        ctx.lineTo(sx(pts[i1].x), bottom); ctx.closePath();
        const dg = ctx.createLinearGradient(0, H * 0.3, 0, bottom); dg.addColorStop(0, W0.dirt[0]); dg.addColorStop(1, W0.dirt[1]);
        ctx.fillStyle = dg; ctx.fill();
        // the grassy top edge
        ctx.beginPath(); for (let i = i0; i <= i1; i++) { const X = sx(pts[i].x), Y = sy(pts[i].y); i === i0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y); }
        ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 16 * cam.z; ctx.stroke();
        ctx.strokeStyle = W0.top; ctx.lineWidth = 11 * cam.z; ctx.stroke();
      });
      // speed pads
      pads.forEach(p => {
        const X0 = sx(p.x0), X1 = sx(p.x1); if (X1 < 0 || X0 > W) return;
        for (let x = p.x0 + 20; x < p.x1; x += 38) { const g = groundAt(terrain, x); if (!g) continue; const X = sx(x), Y = sy(g.y) - 6 * cam.z; ctx.fillStyle = Math.floor(clock * 8 - x / 38) % 3 === 0 ? "#fff" : "#4df2ff"; ctx.beginPath(); ctx.moveTo(X - 9 * cam.z, Y - 7 * cam.z); ctx.lineTo(X + 5 * cam.z, Y); ctx.lineTo(X - 9 * cam.z, Y + 7 * cam.z); ctx.lineTo(X - 4 * cam.z, Y); ctx.closePath(); ctx.fill(); }
      });
      // the finish arch
      if (lvl) { const X = sx(goalX), g = groundAt(terrain, goalX); if (g && X > -100 && X < W + 100) { const Y = sy(g.y), hh = 150 * cam.z; ctx.fillStyle = "#333"; ctx.fillRect(X - 4, Y - hh, 8, hh); ctx.fillRect(X + 100 * cam.z - 4, Y - hh, 8, hh); for (let i = 0; i < 14; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? "#111" : "#fff"; ctx.fillRect(X + i * 7.2 * cam.z, Y - hh + j * 9 * cam.z, 7.2 * cam.z, 9 * cam.z); } } }
    }
    function drawZones(){
      zones.forEach(z => {
        const X0 = sx(z.x0), X1 = sx(z.x1); if (X1 < 0 || X0 > W) return;
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "rgba(150,90,255,0.04)"); g.addColorStop(1, "rgba(170,110,255,0.28)");
        ctx.fillStyle = g; ctx.fillRect(X0, 0, X1 - X0, H);
        ctx.fillStyle = "rgba(220,200,255,0.7)";
        for (let i = 0; i < 26; i++) { const x = X0 + ((i * 97) % Math.max(40, X1 - X0)), y = H - (((i * 61) + clock * 40) % H); if (x < X1) ctx.fillRect(x, y, 3, 3); }
        ctx.font = "800 12px system-ui"; ctx.textAlign = "center"; ctx.fillStyle = "rgba(235,220,255,0.9)"; if ((X0 + X1) / 2 > 0 && (X0 + X1) / 2 < W) ctx.fillText("LOW GRAVITY", (X0 + X1) / 2, 150);
      });
    }
    function drawRocks(){
      rocks.forEach(rk => {
        const X = sx(rk.x), Y = sy(rk.y), r = rk.r * cam.z; if (X < -60 || X > W + 60) return;
        ctx.fillStyle = "#7d8290"; ctx.strokeStyle = "#2c303c"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(X - r * 1.15, Y + 2); ctx.lineTo(X - r * 0.8, Y - r * 0.8); ctx.lineTo(X - r * 0.1, Y - r * 1.15); ctx.lineTo(X + r * 0.7, Y - r * 0.85); ctx.lineTo(X + r * 1.15, Y + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.22)"; ctx.beginPath(); ctx.moveTo(X - r * 0.7, Y - r * 0.7); ctx.lineTo(X - r * 0.1, Y - r * 1.05); ctx.lineTo(X + r * 0.1, Y - r * 0.6); ctx.closePath(); ctx.fill();
      });
    }
    function drawWeather(){
      if (weather === "clear") return;
      ctx.save();
      if (weather === "rain") {
        ctx.fillStyle = "rgba(20,32,58,0.22)"; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(200,225,255,0.55)"; ctx.lineWidth = 1.5; ctx.beginPath();
        for (let i = 0; i < 110; i++) { const x = ((i * 131 + clock * 160) % (W + 80)) - 40, y = ((i * 53 + clock * 950) % (H + 60)) - 30; ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 20); }
        ctx.stroke();
      } else if (weather === "snow") {
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        for (let i = 0; i < 90; i++) { const x = ((i * 113 + Math.sin(clock * 0.8 + i) * 24 + clock * 45) % (W + 20)), y = ((i * 47 + clock * (50 + (i % 5) * 16)) % (H + 10)); ctx.beginPath(); ctx.arc(x, y, 1.4 + (i % 3) * 0.8, 0, 7); ctx.fill(); }
      } else if (weather === "ash") {
        for (let i = 0; i < 50; i++) { const x = ((i * 157 - clock * 30) % (W + 20) + W + 20) % (W + 20), y = H - (((i * 71) + clock * (30 + (i % 4) * 14)) % H); ctx.fillStyle = i % 3 ? "rgba(255,140,50,0.8)" : "rgba(60,40,40,0.7)"; ctx.fillRect(x, y, 2.5, 2.5); }
      } else if (weather === "night") {
        ctx.fillStyle = "rgba(4,6,32,0.58)"; ctx.fillRect(0, 0, W, H);
        if (car && state !== "ready") {
          ctx.globalCompositeOperation = "lighter"; ctx.translate(sx(car.x), sy(car.y)); ctx.rotate(car.a); ctx.scale(cam.z, cam.z);
          const g = ctx.createLinearGradient(50, 0, 340, 0); g.addColorStop(0, "rgba(255,240,170,0.5)"); g.addColorStop(1, "rgba(255,240,170,0)");
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(50, -2); ctx.lineTo(340, -78); ctx.lineTo(340, 84); ctx.closePath(); ctx.fill();
        }
      }
      ctx.restore();
    }
    function drawPickups(){
      pickups.forEach(p => {
        if (p.got) return; const X = sx(p.x), Y = sy(p.y) + Math.sin(clock * 3 + p.x) * 3 * cam.z; if (X < -40 || X > W + 40) return;
        const k = cam.z;
        if (p.t === "coin" || p.t === "gold") {
          const r = (p.t === "gold" ? 14 : 11) * k, w = Math.abs(Math.cos(clock * 4 + p.x * 0.01)) * r + 1.5;
          ctx.fillStyle = p.t === "gold" ? "#ffd84d" : "#ffcc00"; ctx.beginPath(); ctx.ellipse(X, Y, w, r, 0, 0, 7); ctx.fill(); ctx.strokeStyle = "#b8860b"; ctx.lineWidth = 2; ctx.stroke();
          if (p.t === "gold") { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(X - w * 0.2, Y - r * 0.3, 2, 0, 7); ctx.fill(); }
        } else {
          const col = p.t === "fuel" ? "#e8241b" : "#2aa0ff", glow = p.t === "fuel" ? "255,120,80" : "80,200,255";
          const g = ctx.createRadialGradient(X, Y, 2, X, Y, 36 * k); g.addColorStop(0, `rgba(${glow},0.5)`); g.addColorStop(1, `rgba(${glow},0)`); ctx.fillStyle = g; ctx.fillRect(X - 36 * k, Y - 36 * k, 72 * k, 72 * k);
          ctx.save(); ctx.translate(X, Y); ctx.rotate(Math.sin(clock * 2 + p.x) * 0.15); ctx.scale(k, k);
          ctx.lineJoin = "round"; ctx.lineWidth = 2.5; ctx.strokeStyle = "#140a20"; ctx.fillStyle = col;
          ctx.beginPath(); ctx.moveTo(-13, -14); ctx.lineTo(9, -14); ctx.lineTo(14, -9); ctx.lineTo(14, 16); ctx.lineTo(-13, 16); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = "#ffcc00"; ctx.fillRect(10, -21, 5, 8); ctx.strokeRect(10, -21, 5, 8);
          ctx.fillStyle = "#fff"; ctx.font = "900 15px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(p.t === "fuel" ? "⛽" : "N", -1, 3);
          ctx.restore();
        }
      });
    }
    // where your best run was after t seconds
    function ghostAt(t){
      const d = ghost.d, f = Math.max(0, t / 0.1), i = Math.min(d.length - 1, Math.floor(f)), j = Math.min(d.length - 1, i + 1), u = Math.min(1, f - i);
      if (!d[i]) return null;
      return { x: d[i][0] + (d[j][0] - d[i][0]) * u, y: d[i][1] + (d[j][1] - d[i][1]) * u, a: (d[i][2] + (d[j][2] - d[i][2]) * u) / 100, done: f >= d.length - 1 };
    }
    // a see-through copy of the car that set your best time
    function drawGhost(){
      const g = ghostAt(state === "count" ? 0 : time); if (!g) return;
      silhouette(g, (CARS.find(c => c.id === ghost.car) || CARS[0]).wr, "#9bd8ff", "#e8f8ff", 0.42);
    }
    function drawRival(){
      if (!rival) return;
      silhouette(rival, 15, "#7a1020", "#ff5a6a", 1);
      const X = sx(rival.x), Y = sy(rival.y) - 46 * cam.z; ctx.font = '900 13px system-ui'; ctx.textAlign = "center"; ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.fillStyle = "#ff9aa6"; ctx.strokeText("RIVAL", X, Y); ctx.fillText("RIVAL", X, Y);
    }
    function silhouette(g, wr, fill, stroke, alpha){
      const ca = Math.cos(g.a), sa = Math.sin(g.a);
      ctx.save(); ctx.globalAlpha = alpha;
      WHEELS.forEach(([lx, ly]) => { const wx = g.x + lx * ca - (ly + 14) * sa, wy = g.y + lx * sa + (ly + 14) * ca; ctx.fillStyle = alpha < 1 ? fill : "#16161d"; ctx.beginPath(); ctx.arc(sx(wx), sy(wy), wr * cam.z, 0, 7); ctx.fill(); });
      ctx.translate(sx(g.x), sy(g.y)); ctx.rotate(g.a); ctx.scale(cam.z, cam.z);
      ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 2.5; ctx.beginPath();
      ctx.moveTo(-50, 9); ctx.lineTo(-50, -6); ctx.lineTo(-36, -10); ctx.lineTo(-16, -10); ctx.quadraticCurveTo(-8, -28, 8, -12); ctx.lineTo(42, -6); ctx.quadraticCurveTo(54, -3, 53, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    function drawCar(){
      const c = car, S = c.S, C = S.C, RIM = rimOf(), bodyCol = paintOf().c || C.body;
      const ca = Math.cos(c.a), sa = Math.sin(c.a);
      // the wheels sit where the suspension has put them
      c.wheels.forEach((wh, wi) => {
        const lx = WHEELS[wi][0], ly = WHEELS[wi][1], Px = c.x + lx * ca - ly * sa, Py = c.y + lx * sa + ly * ca;
        const wx = wh.sx !== undefined ? wh.sx : Px - sa * 24, wy = wh.sy !== undefined ? wh.sy : Py + ca * 24;
        // the spring
        ctx.strokeStyle = "#8a93a8"; ctx.lineWidth = 4 * cam.z; ctx.beginPath(); ctx.moveTo(sx(Px), sy(Py)); ctx.lineTo(sx(wx), sy(wy)); ctx.stroke();
        ctx.save(); ctx.translate(sx(wx), sy(wy)); ctx.rotate(wh.ang); ctx.scale(cam.z, cam.z); const r = S.wr;
        ctx.fillStyle = "#16161d"; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
        ctx.fillStyle = RIM.c; ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, 7); ctx.fill();
        ctx.strokeStyle = "rgba(20,20,40,0.55)"; ctx.lineWidth = RIM.st === "star" ? 1.6 : 2.5; ctx.beginPath();
        if (RIM.st === "disc") { ctx.arc(0, 0, r * 0.34, 0, 7); } else { const sp = RIM.st === "star" ? 8 : 5; for (let k = 0; k < sp; k++) { const a = k / sp * Math.PI * 2; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55); } }
        ctx.stroke();
        ctx.fillStyle = C.trim; ctx.beginPath(); ctx.arc(0, 0, r * 0.18, 0, 7); ctx.fill();
        ctx.restore();
      });
      ctx.save(); ctx.translate(sx(c.x), sy(c.y)); ctx.rotate(c.a); ctx.scale(cam.z, cam.z);
      const truck = C.style === "truck", lift = truck ? -10 : 0;
      if ((keys.gas || keys.nitro) && fuel > 0 && state === "race") {
        const big = keys.nitro && nitro > 0, len = (big ? 2 : 0.9) * (22 + Math.random() * 16);
        const g = ctx.createLinearGradient(-50, 0, -50 - len, 0); g.addColorStop(0, big ? "#bff4ff" : "#fff3a0"); g.addColorStop(0.4, big ? "#3aa8ff" : "#ff8a00"); g.addColorStop(1, "rgba(255,60,0,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-46, -6 + lift); ctx.lineTo(-50 - len, -1 + lift); ctx.lineTo(-46, 4 + lift); ctx.fill();
      }
      ctx.translate(0, lift); ctx.lineJoin = "round"; ctx.lineWidth = 2.5; ctx.strokeStyle = "#140a20"; ctx.fillStyle = bodyCol; ctx.beginPath();
      if (C.style === "wedge") { ctx.moveTo(-50, 8); ctx.lineTo(-50, -8); ctx.lineTo(-22, -12); ctx.quadraticCurveTo(-4, -26, 16, -10); ctx.lineTo(54, 2); ctx.lineTo(54, 8); }
      else { ctx.moveTo(-50, 9); ctx.lineTo(-50, -6); ctx.lineTo(-36, -10); ctx.lineTo(-16, -10); ctx.quadraticCurveTo(-8, -28, 8, -12); ctx.lineTo(42, -6); ctx.quadraticCurveTo(54, -3, 53, 9); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = C.trim; ctx.beginPath(); ctx.moveTo(46, 2); ctx.quadraticCurveTo(22, -8, 6, 0); ctx.quadraticCurveTo(14, -4, 0, -6); ctx.quadraticCurveTo(-10, 0, -22, -2); ctx.quadraticCurveTo(-6, 6, 18, 6); ctx.quadraticCurveTo(32, 4, 46, 2); ctx.fill();
      ctx.fillStyle = "#9be3ff"; ctx.beginPath(); ctx.ellipse(-3, -16, 11, 8, -0.15, Math.PI, 0); ctx.fill(); ctx.stroke();
      // the driver, bobbing
      const bob = c.air ? -2 : Math.sin(clock * 14) * 1;
      ctx.fillStyle = "#ffd84d"; ctx.fillRect(-8, -26 + bob, 9, 9); ctx.strokeRect(-8, -26 + bob, 9, 9); ctx.fillStyle = "#e8402c"; ctx.fillRect(-9, -29 + bob, 11, 4);
      if (C.style === "rod" || truck) { ctx.fillStyle = "#c9ced8"; ctx.fillRect(-34, -20, 14, 10); ctx.strokeRect(-34, -20, 14, 10); }
      if (C.style === "fin") { ctx.fillStyle = C.trim; ctx.beginPath(); ctx.moveTo(-48, -6); ctx.lineTo(-44, -26); ctx.lineTo(-30, -8); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.restore();
    }
    function drawHud(){
      ctx.textBaseline = "middle"; ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.fillStyle = "#fff"; ctx.textAlign = "left";
      const m = Math.round(dist / PX_M);
      ctx.font = '900 26px "Bricolage Grotesque", system-ui'; const t = lvl ? `${m} / ${lvl.goal} m` : `${m} m`;
      ctx.strokeText(t, 16, 26); ctx.fillText(t, 16, 26);
      ctx.font = '800 16px "Bricolage Grotesque", system-ui'; ctx.strokeText(`🪙 ${runCoins}`, 16, 54); ctx.fillText(`🪙 ${runCoins}`, 16, 54);
      if (ghost && ghostGap !== null && state === "race") { const txt = `👻 ${ghostGap >= 0 ? "+" : ""}${ghostGap} m ${ghostGap >= 0 ? "ahead" : "behind"}`; ctx.fillStyle = ghostGap >= 0 ? "#7dff9a" : "#ff9a8a"; ctx.strokeText(txt, 84, 54); ctx.fillText(txt, 84, 54); ctx.fillStyle = "#fff"; }
      if (rival && rivalGap !== null && state === "race") { const txt = `🏎️ rival ${Math.abs(rivalGap)} m ${rivalGap >= 0 ? "behind you" : "ahead"}`; ctx.textAlign = "center"; ctx.font = '800 15px "Bricolage Grotesque", system-ui'; ctx.fillStyle = rivalGap >= 0 ? "#7dff9a" : "#ff9a8a"; ctx.strokeText(txt, W / 2, 96); ctx.fillText(txt, W / 2, 96); ctx.fillStyle = "#fff"; ctx.textAlign = "left"; }
      if (combo > 1 && comboT > 0 && state === "race") { const txt = `COMBO x${Math.min(5, combo)}`; ctx.textAlign = "right"; ctx.font = '900 22px "Bricolage Grotesque", system-ui'; ctx.fillStyle = "#ffe14d"; ctx.strokeText(txt, W - 16, 52); ctx.fillText(txt, W - 16, 52); ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(W - 96, 62, 80, 4); ctx.fillStyle = "#ffe14d"; ctx.fillRect(W - 96, 62, 80 * comboT / 6, 4); ctx.fillStyle = "#fff"; ctx.textAlign = "left"; }
      if (wheelie && wheelieT > 0.4 && state === "race") { ctx.textAlign = "center"; ctx.font = '800 16px "Bricolage Grotesque", system-ui'; ctx.fillStyle = "#ffb86b"; ctx.strokeText(`WHEELIE ${wheelieT.toFixed(1)} s`, W / 2, H * 0.3); ctx.fillText(`WHEELIE ${wheelieT.toFixed(1)} s`, W / 2, H * 0.3); ctx.fillStyle = "#fff"; ctx.textAlign = "left"; }
      if (state === "replay") { ctx.textAlign = "center"; ctx.font = '900 24px "Bricolage Grotesque", system-ui'; ctx.fillStyle = "#fff"; ctx.strokeText("⏪ REPLAY  (tap to stop)", W / 2, 36); ctx.fillText("⏪ REPLAY  (tap to stop)", W / 2, 36); ctx.textBaseline = "alphabetic"; return; }
      // missions
      if (missions.length && (state === "race" || state === "count")) {
        ctx.font = "700 12px system-ui"; missions.forEach((mi, i) => { const ok = missionDone(mi) && !["finish", "nonitro", "fuel", "time", "rival"].includes(mi.id); const txt = `${ok ? "✔" : "○"} ${mi.text}`; ctx.fillStyle = ok ? "#7dff9a" : "#fff"; ctx.strokeText(txt, 16, 78 + i * 16); ctx.fillText(txt, 16, 78 + i * 16); });
      }
      ctx.textAlign = "right"; ctx.font = '800 18px "Bricolage Grotesque", system-ui'; ctx.fillStyle = "#fff";
      const kmh = Math.round(Math.hypot(car.vx, car.vy) * 0.16); ctx.strokeText(`${kmh} km/h`, W - 16, 24); ctx.fillText(`${kmh} km/h`, W - 16, 24);
      // fuel and nitro gauges
      const gauge = (y, v, col, label) => { ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(W / 2 - 100, y, 200, 16); ctx.fillStyle = col; ctx.fillRect(W / 2 - 98, y + 2, 196 * v, 12); ctx.fillStyle = "#fff"; ctx.font = "800 11px system-ui"; ctx.textAlign = "center"; ctx.fillText(label, W / 2, y + 8); };
      gauge(12, fuel, fuel > 0.5 ? "#38d96b" : fuel > 0.25 ? "#ffcc00" : "#ff4b3a", "⛽ FUEL"); gauge(32, nitro, "#3aa8ff", "🔥 NITRO");
      if (fuel < 0.25 && state === "race" && Math.floor(clock * 4) % 2) { ctx.font = '900 20px "Bricolage Grotesque", system-ui'; ctx.textAlign = "center"; ctx.fillStyle = "#ff6b4a"; ctx.strokeText(fuel <= 0 ? "OUT OF FUEL!" : "LOW FUEL!", W / 2, 70); ctx.fillText(fuel <= 0 ? "OUT OF FUEL!" : "LOW FUEL!", W / 2, 70); }
      if (lvl) { const prog = Math.max(0, Math.min(1, (car.x - 120) / (goalX - 120))); ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(W / 2 - 160, H - 18, 320, 6); ctx.fillStyle = "#ff7a00"; ctx.fillRect(W / 2 - 160, H - 18, 320 * prog, 6); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(W / 2 - 160 + 320 * prog, H - 15, 6, 0, 7); ctx.fill(); }
      if (state === "count") { const n = 3 - Math.floor(clock / 0.6); ctx.font = '900 96px "Bricolage Grotesque", system-ui'; ctx.lineWidth = 8; ctx.strokeStyle = "#140a20"; ctx.textAlign = "center"; ctx.fillStyle = n > 0 ? "#ffe14d" : "#7dff9a"; const txt = n > 0 ? String(n) : "GO!"; ctx.strokeText(txt, W / 2, H * 0.4); ctx.fillText(txt, W / 2, H * 0.4); }
      ctx.textBaseline = "alphabetic";
    }
    function draw(dt){
      fitCanvas(); ctx.setTransform(scale, 0, 0, scale, 0, 0);
      if (!terrain) { ctx.fillStyle = "#6fc3ff"; ctx.fillRect(0, 0, W, H); return; }
      if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      drawBackground(); drawZones(); drawTerrain(); drawRocks(); drawPickups();
      dust.forEach(d => { ctx.fillStyle = `rgba(230,220,200,${Math.max(0, 0.6 - d.t)})`; ctx.beginPath(); ctx.arc(sx(d.x), sy(d.y), (4 + d.t * 14) * cam.z, 0, 7); ctx.fill(); });
      if (ghost && (state === "race" || state === "count" || state === "finish")) drawGhost();
      if (rival && state !== "replay") drawRival();
      drawCar();
      drawWeather();
      sparks.forEach(s => { ctx.fillStyle = "#ffd84d"; ctx.fillRect(sx(s.x), sy(s.y), 3, 3); });
      fx.draw(ctx, dt); drawHud();
    }
    function loop(now){
      if (!open) return;
      const dt = Math.max(0, Math.min(1 / 30, (now - last) / 1000 || 0)); last = now;
      pollInputs();
      if (running && terrain) update(dt); else clock += dt;
      draw(dt);
      requestAnimationFrame(loop);
    }

    /* ---------------- the menu: play and garage ---------------- */
    function showResults(){
      running = false;
      const s = stats, L = lvl;
      if (!s) return;
      resultsOn = true;
      const stuntLine = s.stunts ? ` ${s.stunts} stunt${s.stunts > 1 ? "s" : ""}, best combo x${Math.min(5, s.bestCombo)}.` : "";
      const endWhy = s.why === "fuel" ? "Out of fuel" : s.why === "fell" ? "You fell in!" : s.why === "crash" ? "Roof down!" : "Run over";
      if (mode === "endless") {
        titleEl.textContent = `🛣️ ${s.m} m`;
        textEl.textContent = `${endWhy}. +${s.earned} coins.` + (s.m >= R().best ? " New best!" : ` Best: ${R().best} m.`) + stuntLine;
        showPanel("↻ Again");
      } else if (mode === "daily") {
        titleEl.textContent = `📅 ${s.m} m`;
        textEl.textContent = `${endWhy}. ${s.dailyNote}+${s.earned} coins. Today's best: ${R().dayBest.m} m.` + stuntLine + " Come back tomorrow for a new track!";
        showPanel("↻ Again");
      } else if (s.why === "finish") {
        titleEl.textContent = `🏁 ${"⭐".repeat(starsOf(L.n))}${"☆".repeat(3 - starsOf(L.n))}`;
        textEl.textContent = `${L.boss ? (s.rivalWon ? "The rival got there first. " : "You beat the rival! ") : ""}${s.dailyNote}Level ${L.n + 1} done in ${s.time.toFixed(1)} s${s.newBest ? ' (new best! 👻 your ghost will race you next time)' : ` (best ${R().bestTime[L.n]} s)`}: +${s.earned} coins (${s.runCoins} collected, ${s.bonus} bonus).` + s.mission.map(m => ` ${m.ok ? "✔" : "✘"} ${m.text}.`).join("") + stuntLine;
        pickLvl = Math.min(LEVELS.length - 1, L.n + 1); showPanel(L.n < LEVELS.length - 1 ? "▶ Next level" : "↻ Again");
      } else {
        titleEl.textContent = s.why === "fuel" ? "⛽ Out of fuel" : s.why === "fell" ? "💦 You fell in!" : "💥 Crash!";
        textEl.textContent = `${s.m} of ${L.goal} m. You keep the ${s.earned} coins you collected.${stuntLine} Try the garage for upgrades!`;
        showPanel("↻ Try again");
      }
    }
    function bankLabel(){ $("roBank").textContent = "🪙 " + R().coins; }
    function showPanel(label){
      playBtn.textContent = label || "▶ Race"; bankLabel(); renderBody(); panel.hidden = false; playBtn.focus();
    }
    const unlocked = n => n === 0 || ((R().stars || {})[n - 1] & 1);
    let S0;
    function renderBody(){
      S0 = R(); S0.cos = S0.cos || {};
      body.parentNode.querySelectorAll("[data-tab]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.tab === tab)));
      const S = R();
      if (tab === "play") {
        const w = Math.floor(pickLvl / 6);
        let h = `<div class="ro-modes" role="group"><button type="button" class="sw-world${mode === "career" ? " on" : ""}" data-mode="career">🏁 Career</button><button type="button" class="sw-world${mode === "endless" ? " on" : ""}" data-mode="endless">🛣️ Endless${S.best ? ` <small>${S.best} m</small>` : ""}</button><button type="button" class="sw-world${mode === "daily" ? " on" : ""}" data-mode="daily">📅 Daily${S.dayBest && S.dayBest.date === today() ? ` <small>${S.dayBest.m} m</small>` : ""}</button></div>`;
        if (resultsOn && lastRun) h = `<div class="ro-modes"><button type="button" class="btn small" data-replay="1">⏪ Replay</button><button type="button" class="btn small" data-share="1">📤 Share</button></div>` + h;
        if (mode === "career") {
          h += `<div class="sw-worlds">` + WORLDS.map((wd, wi) => `<button type="button" class="sw-world${wi === pickWorld ? " on" : ""}" data-world="${wi}" ${unlocked(wi * 6) ? "" : "disabled"}>${unlocked(wi * 6) ? wd.icon : "🔒"} ${wd.name}</button>`).join("") + `</div><div class="sw-levels">` +
            LEVELS.filter(L => L.world === pickWorld).map(L => { const st = starsOf(L.n), ok = unlocked(L.n); return `<button type="button" class="sw-lvl${L.n === pickLvl ? " on" : ""}" data-lvl="${L.n}" ${ok ? "" : "disabled"}><b>${ok ? L.n + 1 : "🔒"}</b><span>${L.boss ? "🏎️ " : ""}${L.goal} m</span><i>${"★".repeat(st)}${"☆".repeat(3 - st)}</i>${(S.bestTime || {})[L.n] ? `<em>👻 ${S.bestTime[L.n]} s</em>` : ""}</button>`; }).join("") + `</div>`;
          h += `<div class="ro-missions"><b>Missions, level ${pickLvl + 1}:</b> ` + missionsOf(LEVELS[pickLvl]).map(m => `<span>${((S.stars || {})[pickLvl] >> missionsOf(LEVELS[pickLvl]).indexOf(m) & 1) ? "✔" : "○"} ${m.text}</span>`).join("") + `</div>`;
        } else if (mode === "daily") h += `<p class="ro-note">Today's track (${WORLDS[today() % 5].icon} ${WORLDS[today() % 5].name}) is the same for everybody. Reach 300 m for a daily bonus and beat your best distance.</p>`;
        else h += `<p class="ro-note">Drive as far as you can. The ground never ends, and neither does the fuel hunt: grab the red cans!</p>`;
        h += `<button type="button" class="sw-world${S.assist ? " on" : ""}" data-assist="1">🛟 Assist: ${S.assist ? "ON" : "OFF"} <small>${S.assist ? "narrower gaps, fuel lasts longer" : "tap if a level feels too hard"}</small></button>`;
        h += `<button type="button" class="sw-world${S.tilt ? " on" : ""}" data-tilt="1">📱 Tilt steering: ${S.tilt ? "ON" : "OFF"} <small>${S.tilt ? "tip right = gas, left = brake" : "experimental, for phones"}</small></button>`;
        body.innerHTML = h;
      } else if (tab === "style") {
        const sw = (arr, key, cur, own) => arr.map(o => { const have = o.price === 0 || !!S.cos[key + ":" + o.id]; return `<button type="button" class="ro-swb${o.id === cur ? " on" : ""}" data-${key}="${o.id}" aria-label="${o.name}" style="--c:${o.c || "#888"}"><i></i><span>${o.name}</span><small>${o.id === cur ? "✓" : have ? "Owned" : "🪙 " + o.price}</small></button>`; }).join("");
        body.innerHTML = `<div class="ro-bank">🪙 ${S.coins} coins</div><div class="ro-note"><b>Paint</b> (all cars)</div><div class="ro-swatches">${sw(PAINTS, "paint", S.paint || "stock")}</div><div class="ro-note"><b>Wheels</b></div><div class="ro-swatches">${sw(RIMS, "rim", S.rim || "chrome")}</div>`;
      } else {
        const gc = garageCar || S.car, C = CARS.find(c => c.id === gc), U = upsOf(C.id);
        let h = `<div class="ro-bank">🪙 ${S.coins} coins</div><div class="sw-cars">` + CARS.map(c => {
          const own = !!S.owned[c.id];
          return `<button type="button" class="sw-car${c.id === gc ? " on" : ""}${c.id === S.car ? " using" : ""}" data-car="${c.id}" style="--c:${c.body};--t:${c.trim}"><i></i><span>${c.name}</span><small>${own ? (c.id === S.car ? "✓ Using" : "Owned") : "🪙 " + c.price}</small></button>`;
        }).join("") + `</div>`;
        const own = !!S.owned[C.id];
        h += `<div class="ro-carbar"><b>${C.name}</b> `;
        if (!own) h += `<button type="button" class="btn small" data-buycar="${C.id}" ${S.coins >= C.price ? "" : "disabled"}>Buy 🪙 ${C.price}</button>`;
        else if (S.car !== C.id) h += `<button type="button" class="btn small" data-usecar="${C.id}">Use this car</button>`;
        h += `</div><div class="ro-ups">` + UPS.map(u => {
          const lv = U[u.id], cost = upCost(lv), max = lv >= 5;
          return `<div class="ro-up"><span class="ro-upname">${u.icon} ${u.name}<small>${u.text}</small></span><span class="ro-pips">${"●".repeat(lv)}${"○".repeat(5 - lv)}</span><button type="button" class="btn small" data-up="${u.id}" ${!own || max || S.coins < cost ? "disabled" : ""}>${max ? "MAX" : "🪙 " + cost}</button></div>`;
        }).join("") + `</div>`;
        body.innerHTML = h;
      }
    }
    body.addEventListener("click", e => {
      const S = R(), b = e.target.closest("button"); if (!b || b.disabled) return;
      if (b.dataset.replay) { startReplay(); return; }
      if (b.dataset.share) { shareRun(); return; }
      if (b.dataset.tilt) { toggleTilt(); }
      else if (b.dataset.paint || b.dataset.rim) {
        const key = b.dataset.paint ? "paint" : "rim", id = b.dataset[key], o = (key === "paint" ? PAINTS : RIMS).find(x => x.id === id), have = o.price === 0 || S.cos[key + ":" + id];
        if (!have) { if (S.coins < o.price) { Fun.sfx.pop(); return; } S.coins -= o.price; S.cos[key + ":" + id] = true; Fun.sfx.coin(); Hub.checkBadges(); }
        else Fun.sfx.pop();
        S[key] = id; Hub.saveStore();
      }
      else if (b.dataset.assist) { S.assist = !S.assist; Hub.saveStore(); Fun.sfx.pop(); }
      else if (b.dataset.mode) { mode = b.dataset.mode; Fun.sfx.pop(); }
      else if (b.dataset.world) { pickWorld = +b.dataset.world; const first = pickWorld * 6; pickLvl = LEVELS.slice(first, first + 6).find(L => unlocked(L.n) && !starsOf(L.n))?.n ?? first; Fun.sfx.pop(); }
      else if (b.dataset.lvl) { pickLvl = +b.dataset.lvl; Fun.sfx.pop(); }
      else if (b.dataset.car) { garageCar = b.dataset.car; Fun.sfx.pop(); }
      else if (b.dataset.buycar) { const C = CARS.find(c => c.id === b.dataset.buycar); if (S.coins >= C.price) { S.coins -= C.price; S.owned[C.id] = true; S.car = C.id; Fun.sfx.tada(); Hub.confettiBurst(b); Hub.saveStore(); Hub.checkBadges(); } }
      else if (b.dataset.usecar) { S.car = b.dataset.usecar; Fun.sfx.ding(); Hub.saveStore(); }
      else if (b.dataset.up) { const C = CARS.find(c => c.id === (garageCar || S.car)), U = upsOf(C.id), cost = upCost(U[b.dataset.up]); if (S.coins >= cost && U[b.dataset.up] < 5) { S.coins -= cost; U[b.dataset.up]++; Fun.sfx.coin(); Hub.saveStore(); } }
      else return;
      bankLabel(); renderBody();
    });
    function shareRun(){
      const r = lastRun; if (!r) return;
      const txt = `I ${r.finish ? "finished" : "drove"} ${r.label} in Race Off: ${r.m} m${r.finish ? ` in ${r.time.toFixed(1)} s` : ""} in the ${(CARS.find(c => c.id === r.car) || CARS[0]).name}. Can you beat it? ${location.origin}${location.pathname}`;
      if (navigator.share) navigator.share({ title: "Race Off", text: txt }).catch(() => {});
      else if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => Hub.toast("📋", "Copied", "Paste it to share it")).catch(() => {});
    }
    function toggleTilt(){
      const S = R();
      if (S.tilt) { S.tilt = false; feed("tilt", { gas: false, brake: false }); Hub.saveStore(); return; }
      const ask = window.DeviceMotionEvent && DeviceMotionEvent.requestPermission ? DeviceMotionEvent.requestPermission() : Promise.resolve("granted");
      ask.then(r => { S.tilt = r === "granted"; Hub.saveStore(); renderBody(); if (S.tilt) Hub.toast("📱", "Tilt steering on", "Tip the phone right for gas, left for brake"); }).catch(() => {});
    }
    panel.querySelector(".ro-tabs").addEventListener("click", e => { const b = e.target.closest("[data-tab]"); if (!b) return; tab = b.dataset.tab; if (tab === "garage") garageCar = R().car; Fun.sfx.pop(); renderBody(); });

    function start(){
      if (mode === "career" && !unlocked(pickLvl)) pickLvl = 0;
      startRun();
      $("roLevel").textContent = (mode === "endless" ? "Endless" : mode === "daily" ? "Daily" : `Level ${lvl.n + 1}${lvl.boss ? " 🏎️" : ""}`) + (WX_ICON[weather] ? " " + WX_ICON[weather] : "");
      running = true; panel.hidden = true;
      Object.keys(keys).forEach(k => { keys[k] = false; });
      if (R().music !== false && store.sound !== false) music.start();
      canvas.focus();
    }
    function setMusicBtn(){ $("roMusic").textContent = R().music !== false ? "🎵" : "🔇🎵"; }
    $("roMusic").addEventListener("click", () => { R().music = R().music === false; Hub.saveStore(); setMusicBtn(); if (R().music && running && store.sound !== false) music.start(); else music.stop(); });
    function openGame(){
      open = true; running = false; state = "ready"; terrain = terrain || null;
      overlay.hidden = false; document.body.style.overflow = "hidden";
      const S = R(); if (!S.owned[S.car]) S.car = "flame";
      pickLvl = LEVELS.find(L => unlocked(L.n) && !(((S.stars || {})[L.n] || 0) & 1))?.n ?? 0; pickWorld = Math.floor(pickLvl / 6);
      tab = "play"; resultsOn = false; titleEl.textContent = "🚙 Race Off";
      textEl.textContent = "Physics stunt racing! Spring over hills, jump gaps, flip in the air and don't land on your roof. Collect coins and fuel, finish the missions for stars, and spend your coins in the garage.";
      setMusicBtn(); showPanel("▶ Race");
      last = performance.now(); requestAnimationFrame(loop);
    }
    function closeGame(){ open = false; running = false; overlay.hidden = true; document.body.style.overflow = ""; music.stop(); }

    /* ---------------- controls ---------------- */
    const KEYMAP = { ArrowRight: "gas", KeyD: "gas", ArrowUp: "gas", KeyW: "gas", ArrowLeft: "brake", KeyA: "brake", ArrowDown: "brake", KeyS: "brake", Space: "nitro", ShiftLeft: "nitro", KeyN: "nitro" };
    window.addEventListener("keydown", e => {
      if (!open) return;
      if (e.key === "Escape") { Hub.leave(); return; }
      if (!running) return;
      const k = KEYMAP[e.code]; if (!k) return;
      e.preventDefault(); keys[k] = true;
    });
    window.addEventListener("keyup", e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
    window.addEventListener("blur", () => { Object.keys(keys).forEach(k => { keys[k] = false; }); });
    host.querySelectorAll("[data-rokey]").forEach(btn => {
      const k = btn.dataset.rokey;
      btn.addEventListener("pointerdown", e => { e.preventDefault(); btn.setPointerCapture(e.pointerId); keys[k] = true; btn.classList.add("on"); });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach(n => btn.addEventListener(n, () => { keys[k] = false; btn.classList.remove("on"); }));
    });
    canvas.tabIndex = 0;
    canvas.addEventListener("pointerdown", () => { if (state === "replay") endReplay(); });
    $("roCloseBtn").addEventListener("click", () => Hub.leave());
    Fun.soundButton($("roCloseBtn"));
    playBtn.addEventListener("click", start);
    window.__ro = { get weather(){ return weather; }, get rocks(){ return rocks; }, get zones(){ return zones; }, get rival(){ return rival; }, get combo(){ return combo; }, get stunts(){ return stunts; }, get lastRun(){ return lastRun; }, stunt, startReplay, get ghost(){ return ghost; }, get gap(){ return ghostGap; }, keys, get state(){ return state; }, get car(){ return car; }, get fuel(){ return fuel; }, get dist(){ return dist; }, get coins(){ return runCoins; }, get stats(){ return stats; }, get flips(){ return flips; }, get maxAir(){ return maxAir; },
      level: i => { mode = "career"; pickLvl = i; start(); }, endless: () => { mode = "endless"; start(); }, slope: () => { const g = groundAt(terrain, car.x); return g ? Math.atan2(g.ty, g.tx) : 0; }, slopeAt: x => { const g = groundAt(terrain, x); return g ? Math.atan2(g.ty, g.tx) : null; }, groundY: x => { const g = groundAt(terrain, x); return g ? g.y : null; }, R };

    return { open: openGame, close: closeGame };
  }
})();
