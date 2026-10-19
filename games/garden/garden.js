/* Garden Grow: a game like "Grow a Garden" on Roblox. Buy seeds at Sam's shop (it restocks every five
   minutes, and the rare seeds are hardly ever in stock), plant them, and they grow in real time, even
   while the game is closed. Carrots and pumpkins are picked once; strawberry bushes and apple trees
   keep growing new fruit. Every fruit has its own weight, and the weather can change it: rain makes
   it Wet, snow makes it Chilled (Wet and Chilled make Frozen), lightning makes it Shocked, and once in
   a while one grows Gold or even Rainbow, worth a fortune. Sell your basket at Steven's stand. */
(function(){
  "use strict";
  const store = Hub.store;
  const money = n => "$" + (n >= 1e9 ? (n / 1e9).toFixed(1) + "B" : n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + "M" : n >= 1e4 ? Math.round(n / 1e3) + "K" : Math.floor(n).toLocaleString("en"));
  const S = () => (store.garden = store.garden || { cash: 20, seeds: { carrot: 3 }, plots: [], basket: [], stock: null, restockAt: 0, earned: 0, harvested: 0, best: {} });

  const COLS = 8, ROWS = 6, TILE = 2;
  const RARITY = {
    common: { name: "Common", colour: "#c9ced6" }, uncommon: { name: "Uncommon", colour: "#6bd66b" },
    rare: { name: "Rare", colour: "#4da3ff" }, legendary: { name: "Legendary", colour: "#ffcc33" },
    mythical: { name: "Mythical", colour: "#c77dff" }, divine: { name: "Divine", colour: "#ff8a3d" },
    prismatic: { name: "Prismatic", colour: "#ff6bd6", rainbow: true }
  };
  // grow: seconds until it's ready; regrow: seconds for each new fruit (bushes and trees); kg: a normal fruit's weight
  const SEEDS = [
    { id: "carrot",     name: "Carrot",        em: "🥕", r: "common",    price: 10,     grow: 25,  sell: 22,    kg: 0.3, stock: [1, 5, 20] },
    { id: "strawberry", name: "Strawberry",    em: "🍓", r: "common",    price: 50,     grow: 40,  sell: 14,    kg: 0.3, regrow: 20, fruits: 4, bush: true, stock: [1, 2, 8] },
    { id: "blueberry",  name: "Blueberry",     em: "🫐", r: "uncommon",  price: 400,    grow: 60,  sell: 38,    kg: 0.2, regrow: 25, fruits: 5, bush: true, stock: [0.8, 1, 5] },
    { id: "tulip",      name: "Orange Tulip",  em: "🌷", r: "uncommon",  price: 600,    grow: 50,  sell: 1100,  kg: 0.05, stock: [0.7, 1, 4] },
    { id: "tomato",     name: "Tomato",        em: "🍅", r: "rare",      price: 800,    grow: 90,  sell: 70,    kg: 0.5, regrow: 30, fruits: 4, bush: true, stock: [0.6, 1, 4] },
    { id: "corn",       name: "Corn",          em: "🌽", r: "rare",      price: 1300,   grow: 120, sell: 120,   kg: 2,   regrow: 40, fruits: 3, bush: true, stock: [0.5, 1, 3] },
    { id: "watermelon", name: "Watermelon",    em: "🍉", r: "rare",      price: 2500,   grow: 150, sell: 5000,  kg: 7,   stock: [0.4, 1, 3] },
    { id: "pumpkin",    name: "Pumpkin",       em: "🎃", r: "legendary", price: 3000,   grow: 180, sell: 6500,  kg: 6,   stock: [0.3, 1, 2] },
    { id: "apple",      name: "Apple",         em: "🍎", r: "legendary", price: 3250,   grow: 240, sell: 260,   kg: 3,   regrow: 45, fruits: 6, tree: "#3f9e3a", stock: [0.25, 1, 2] },
    { id: "coconut",    name: "Coconut",       em: "🥥", r: "mythical",  price: 6000,   grow: 300, sell: 520,   kg: 14,  regrow: 60, fruits: 4, tree: "#5bbf3a", stock: [0.15, 1, 2] },
    { id: "mango",      name: "Mango",         em: "🥭", r: "mythical",  price: 15000,  grow: 360, sell: 1250,  kg: 15,  regrow: 60, fruits: 5, tree: "#2f8f3f", stock: [0.1, 1, 1] },
    { id: "grape",      name: "Grape",         em: "🍇", r: "divine",    price: 85000,  grow: 420, sell: 5200,  kg: 3,   regrow: 80, fruits: 6, tree: "#4f9e3a", stock: [0.06, 1, 1] },
    { id: "candy",      name: "Candy Blossom", em: "🍬", r: "prismatic", price: 500000, grow: 600, sell: 42000, kg: 4,   regrow: 120, fruits: 6, tree: "#ff9ed8", stock: [0.03, 1, 1] }
  ];
  const SEED = Object.fromEntries(SEEDS.map(s => [s.id, s]));
  const MUT = {
    wet:     { name: "Wet",     x: 2,   colour: "#5fb8ff" },
    chilled: { name: "Chilled", x: 2,   colour: "#bfefff" },
    frozen:  { name: "Frozen",  x: 10,  colour: "#7fe3ff" },
    shocked: { name: "Shocked", x: 100, colour: "#ffe14d" },
    gold:    { name: "Gold",    x: 20,  colour: "#ffcc00" },
    rainbow: { name: "Rainbow", x: 50,  colour: "#ff6bd6" }
  };
  const RESTOCK = 5 * 60 * 1000;
  const WEATHER = {
    clear:   { name: "☀️ Sunny" },
    rain:    { name: "🌧️ Rain: crops get Wet ×2 and grow faster" },
    snow:    { name: "❄️ Snow: crops get Chilled ×2 (Wet + Chilled = Frozen ×10)" },
    thunder: { name: "⛈️ Thunderstorm: lightning makes crops Shocked ×100!" }
  };

  function valueOf(c){
    const def = SEED[c.s];
    return def.sell * c.w * c.w * (c.m || []).reduce((a, k) => a * MUT[k].x, 1);
  }
  // a new crop: its weight, and maybe Gold or Rainbow
  function newCrop(){
    const huge = Math.random() < 0.04;
    const w = huge ? 2.2 + Math.random() * 1.3 : 0.75 + Math.random() * 0.75;
    const roll = Math.random(), m = roll < 0.004 ? ["rainbow"] : roll < 0.025 ? ["gold"] : [];
    return { w: Math.round(w * 100) / 100, m };
  }
  function addMut(c, k){
    c.m = c.m || [];
    if (c.m.includes(k) || c.m.includes("frozen") && (k === "wet" || k === "chilled")) return false;
    if (k === "wet" && c.m.includes("chilled") || k === "chilled" && c.m.includes("wet")) { c.m = c.m.filter(x => x !== "wet" && x !== "chilled"); c.m.push("frozen"); return "frozen"; }
    c.m.push(k);
    return k;
  }

  Hub.register({
    id: "garden", section: "games", title: "Garden Grow", icon: "🌱",
    blurb: "Like Grow a Garden on Roblox: plant seeds, wait for rain and lightning, and harvest Gold and Rainbow fruit!",
    stat: () => S().earned ? `Earned ${money(S().earned)}` : "",
    badges: [
      { id: "ggHarvest", icon: "🧺", name: "First Harvest", desc: "Pick your first crop in Garden Grow",     test: () => (S().harvested || 0) >= 1 },
      { id: "ggGold",    icon: "✨", name: "Golden Touch",  desc: "Harvest a Gold or Rainbow crop",          test: () => !!(S().best.gold || S().best.rainbow) },
      { id: "ggShock",   icon: "⚡", name: "Shocking!",     desc: "Harvest a crop hit by lightning",         test: () => !!S().best.shocked },
      { id: "ggRich",    icon: "💰", name: "Garden Tycoon", desc: "Earn $1M in Garden Grow",                 test: () => S().earned >= 1e6 }
    ],
    mount
  });

  function mount(host){
    host.innerHTML = `
    <section class="game-screen gg-screen" id="ggOverlay" hidden aria-label="Garden Grow">
      <div class="game-box">
        <div class="game-hud">
          <h2>🌱 Garden Grow</h2>
          <span class="mono game-stat gg-cash" id="ggCash">$0</span>
          <span class="mono game-stat" id="ggRestock">🛒 5:00</span>
          <button class="btn ghost small" id="ggCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas class="gg-canvas" id="ggCanvas" width="960" height="540"></canvas>
          <div class="gg-shop" id="ggShop" hidden>
            <div class="gg-shop-head"><b>🌰 Sam's Seed Shop</b><span id="ggShopTimer"></span><button class="btn ghost small" id="ggShopClose" type="button">✕</button></div>
            <div class="gg-shop-list" id="ggShopList"></div>
          </div>
          <div class="game-panel gg-panel" id="ggPanel">
            <div class="game-panel-title" id="ggTitle">🌱 Garden Grow</div>
            <div class="game-panel-text" id="ggText"></div>
            <button class="btn" id="ggPlayBtn" type="button">▶ Play</button>
          </div>
        </div>
        <div class="gg-bar">
          <button class="btn ghost small" data-tool="hand" type="button">✋ Plant & pick</button>
          <button class="btn ghost small" data-tool="water" type="button">💧 Water</button>
          <button class="btn ghost small" data-tool="shovel" type="button">⛏️ Dig up</button>
          <button class="btn ghost small" id="ggShopBtn" type="button">🌰 Seed shop</button>
          <button class="btn small gg-sell" id="ggSell" type="button">💰 Sell</button>
        </div>
        <div class="gg-seeds" id="ggSeeds"></div>
        <div class="game-help">Click a patch of soil to plant the seed you picked · click a plant to pick its fruit · drag to look around</div>
      </div>
    </section>`;
    const $ = id => document.getElementById(id);
    const overlay = $("ggOverlay"), canvas = $("ggCanvas"), ctx = canvas.getContext("2d");
    const panel = $("ggPanel"), titleEl = $("ggTitle"), textEl = $("ggText"), playBtn = $("ggPlayBtn");
    const cashEl = $("ggCash"), restockEl = $("ggRestock"), shopEl = $("ggShop"), shopList = $("ggShopList"), shopTimer = $("ggShopTimer");
    const seedsEl = $("ggSeeds"), sellBtn = $("ggSell");
    const W = 960, H = 540, FOC = 640, NEAR = 0.4;
    const fx = Fun.pops(), tip = Fun.hint(canvas.parentElement);

    let open = false, running = false, last = 0, clock = 0, saveT = 0, tickT = 0;
    let tool = "hand", pick = "carrot", camYaw = 0, flash = 0;
    let weather = "clear", weatherT = 50, boltT = 6, drops = [];
    const SAM = { x: -11.2, z: 8 }, STEVEN = { x: 11.2, z: 8 };
    const me = { x: 0, z: 9, yaw: Math.PI, walk: 0, moving: false, goal: null, job: null, act: 0 };

    /* ---------------- the garden ---------------- */
    const plots = () => { const st = S(); if (st.plots.length !== COLS * ROWS) st.plots = Array.from({ length: COLS * ROWS }, (_, i) => st.plots[i] || null); return st.plots; };
    const tileXZ = i => [(i % COLS - (COLS - 1) / 2) * TILE, (Math.floor(i / COLS) - (ROWS - 1) / 2) * TILE];
    const growth = (p, now) => Math.min(1, (now - p.t0) / (SEED[p.s].grow * 1000));
    function plant(i){
      const st = S(), def = SEED[pick];
      if (!def || !(st.seeds[pick] > 0)) { tip.show("🌰 No seeds! Buy some at Sam's shop", 2500); Fun.sfx.nope(); openShop(); return; }
      st.seeds[pick]--;
      if (!st.seeds[pick]) delete st.seeds[pick];
      plots()[i] = { s: pick, t0: Date.now(), crop: def.regrow ? null : newCrop(), fruits: [] };
      const [x, z] = tileXZ(i), p = proj(x, 0.5, z);
      if (p) { fx.pop("🌱 Planted!", p.x, p.y - 20, "#9be37a", 24); fx.burst(p.x, p.y, "#8a5a2b", 10, 90); }
      Fun.sfx.pop(); drawSeeds(); save();
      if (!st.seeds[pick]) { const k = Object.keys(st.seeds)[0]; if (k) pick = k; drawSeeds(); }
    }
    // bushes and trees: fruit appears once the plant is grown, and a new one grows after each is picked
    function growFruit(p, now){
      const def = SEED[p.s];
      if (!def.regrow || growth(p, now) < 1) return;
      const ready = p.t0 + def.grow * 1000;
      while (p.fruits.length < def.fruits) {
        const k = p.fruits.length;
        p.fruits.push({ ...newCrop(), at: ready + k * def.regrow * 300, slot: k });
      }
    }
    function ripe(p, now){
      if (SEED[p.s].regrow) return p.fruits.filter(f => now >= f.at);
      return growth(p, now) >= 1 ? [p.crop] : [];
    }
    function harvest(i){
      const st = S(), p = plots()[i], now = Date.now();
      if (!p) return;
      const def = SEED[p.s], [x, z] = tileXZ(i);
      const r = ripe(p, now);
      const at = proj(x, def.tree ? 3 : 1, z) || { x: W / 2, y: H / 2 };
      if (!r.length) {
        const left = def.regrow && growth(p, now) >= 1 ? Math.min(...p.fruits.map(f => f.at)) - now : p.t0 + def.grow * 1000 - now;
        fx.pop(`⏳ ${Math.ceil(left / 1000)}s`, at.x, at.y, "#ffffff", 24); Fun.sfx.nope();
        return;
      }
      const worth = c => valueOf({ ...c, s: p.s }), c = r.reduce((a, b) => worth(b) > worth(a) ? b : a);
      st.basket.push({ s: p.s, w: c.w, m: (c.m || []).slice() });
      st.harvested = (st.harvested || 0) + 1;
      (c.m || []).forEach(k => { st.best[k] = true; });
      if (def.regrow) {
        const k = p.fruits.indexOf(c);
        p.fruits[k] = { ...newCrop(), at: now + def.regrow * 1000, slot: c.slot };
      } else plots()[i] = null;
      const muts = (c.m || []).map(k => MUT[k].name).join(" ");
      fx.pop(`${def.em} ${muts ? muts + " " : ""}${def.name} ${(c.w * def.kg).toFixed(1)}kg`, at.x, at.y, c.m && c.m.length ? MUT[c.m[c.m.length - 1]].colour : "#ffffff", c.m && c.m.length ? 30 : 24);
      if (c.w > 2) fx.pop("HUGE! 😲", at.x, at.y - 34, "#ff9f43", 34);
      if (c.m && (c.m.includes("gold") || c.m.includes("rainbow") || c.m.includes("shocked"))) { fx.burst(at.x, at.y, MUT[c.m[0]].colour, 30, 220); Fun.sfx.tada(); }
      else { fx.burst(at.x, at.y, "#9be37a", 10, 100); Fun.sfx.chomp(); }
      Hub.checkBadges(); save();
    }
    function water(i){
      const p = plots()[i], [x, z] = tileXZ(i), at = proj(x, 1, z);
      if (at) { for (let k = 0; k < 14; k++) drops.push({ x: at.x + (Math.random() - 0.5) * 40, y: at.y - 60 - Math.random() * 30, vy: 200 + Math.random() * 100, life: 0.5, splash: true }); }
      Fun.sfx.splash();
      if (!p) return;
      const def = SEED[p.s], now = Date.now();
      if (now - (p.watered || 0) < 3000) { if (at) fx.pop("Already wet!", at.x, at.y - 40, "#5fb8ff", 22); return; }
      p.watered = now;
      if (growth(p, now) < 1) p.t0 -= def.grow * 1000 * 0.1;
      else p.fruits.forEach(f => { if (f.at > now) f.at -= def.regrow * 1000 * 0.2; });
      if (at) fx.pop("💧 Grow faster!", at.x, at.y - 40, "#5fb8ff", 24);
      save();
    }
    function dig(i){
      const p = plots()[i];
      if (!p) return;
      const [x, z] = tileXZ(i), at = proj(x, 1, z);
      if (SEED[p.s].price >= 3000 && !confirm(`Dig up your ${SEED[p.s].name}? It's gone for good!`)) return;
      plots()[i] = null;
      if (at) { fx.pop("Dug up!", at.x, at.y, "#c58a4a", 26); fx.burst(at.x, at.y, "#8a5a2b", 16, 140); }
      Fun.sfx.thunk(); save();
    }
    function sell(){
      const st = S();
      if (!st.basket.length) { tip.show("🧺 Your basket is empty. Pick some crops first!", 2500); Fun.sfx.nope(); return; }
      const total = st.basket.reduce((a, c) => a + valueOf(c), 0);
      st.cash += total; st.earned += total;
      const n = st.basket.length; st.basket = [];
      const at = proj(STEVEN.x, 3.5, STEVEN.z) || { x: W * 0.8, y: H * 0.4 };
      fx.pop(`+${money(total)}`, at.x, at.y, "#7bd68a", total >= 10000 ? 46 : 34);
      fx.pop(`Steven: "Thanks for the ${n} crops!"`, at.x - 60, at.y + 40, "#ffffff", 20);
      fx.burst(at.x, at.y, "#ffe14d", 24, 200); Fun.sfx.coin();
      Hub.checkBadges(); save();
    }

    /* ---------------- Sam's seed shop ---------------- */
    function restock(force){
      const st = S(), now = Date.now();
      if (!force && st.stock && now < st.restockAt) return false;
      st.stock = {};
      SEEDS.forEach(s => { const [chance, lo, hi] = s.stock; st.stock[s.id] = Math.random() < chance ? lo + Math.floor(Math.random() * (hi - lo + 1)) : 0; });
      st.restockAt = now + RESTOCK;
      return true;
    }
    function openShop(){ walkTo(SAM.x + 2.2, SAM.z + 1.6, () => { shopEl.hidden = false; drawShop(); Fun.sfx.ding(); }); }
    function drawShop(){
      const st = S();
      shopList.innerHTML = SEEDS.map(s => {
        const n = st.stock[s.id] || 0, R = RARITY[s.r];
        return `<div class="gg-row${n ? "" : " gg-out"}">
          <span class="gg-em">${s.em}</span>
          <span class="gg-name">${s.name}<small style="color:${R.colour}">${R.name}${s.regrow ? " · keeps fruiting" : ""}</small></span>
          <span class="gg-stock">${n ? "×" + n : "No stock"}</span>
          <button class="btn small" data-buy="${s.id}" type="button" ${n ? "" : "disabled"}>${money(s.price)}</button>
        </div>`;
      }).join("");
    }
    shopList.addEventListener("click", e => {
      const b = e.target.closest("[data-buy]");
      if (!b) return;
      const st = S(), s = SEED[b.dataset.buy];
      if (!(st.stock[s.id] > 0)) return;
      if (st.cash < s.price) { Fun.sfx.nope(); b.textContent = "Need " + money(s.price); setTimeout(drawShop, 900); return; }
      st.cash -= s.price; st.stock[s.id]--; st.seeds[s.id] = (st.seeds[s.id] || 0) + 1; pick = s.id;
      Fun.sfx.coin();
      if (RARITY[s.r] && ["legendary", "mythical", "divine", "prismatic"].includes(s.r)) { fx.pop(`${s.em} ${s.name.toUpperCase()} SEED!`, W / 2, H * 0.3, RARITY[s.r].colour, 40); fx.burst(W / 2, H * 0.3, RARITY[s.r].colour, 30, 220); Fun.sfx.tada(); }
      drawShop(); drawSeeds(); save();
    });
    $("ggShopClose").addEventListener("click", () => { shopEl.hidden = true; canvas.focus(); });
    $("ggShopBtn").addEventListener("click", () => { if (running) openShop(); });
    sellBtn.addEventListener("click", () => { if (running) walkTo(STEVEN.x - 2.2, STEVEN.z + 1.6, sell); });

    function drawSeeds(){
      const st = S(), ids = Object.keys(st.seeds).filter(k => st.seeds[k] > 0 && SEED[k]).sort((a, b) => SEED[a].price - SEED[b].price);
      if (!ids.includes(pick) && ids.length) pick = ids[0];
      seedsEl.innerHTML = ids.length ? ids.map(k => `<button class="btn ghost small${k === pick ? " gg-on" : ""}" data-seed="${k}" type="button">${SEED[k].em} ${SEED[k].name} ×${st.seeds[k]}</button>`).join("")
        : `<span class="gg-none">No seeds. Visit 🌰 Sam's shop!</span>`;
    }
    seedsEl.addEventListener("click", e => { const b = e.target.closest("[data-seed]"); if (!b) return; pick = b.dataset.seed; tool = "hand"; drawTools(); drawSeeds(); canvas.focus(); });
    function drawTools(){ host.querySelectorAll("[data-tool]").forEach(b => b.classList.toggle("gg-on", b.dataset.tool === tool)); }
    host.querySelectorAll("[data-tool]").forEach(b => b.addEventListener("click", () => { tool = b.dataset.tool; drawTools(); canvas.focus(); }));

    /* ---------------- walking about ---------------- */
    function walkTo(x, z, job){ me.goal = { x, z }; me.job = job; }
    function useTile(i){
      const [x, z] = tileXZ(i);
      const side = me.z > z ? 1 : -1;
      walkTo(x, z + side * 1.4, () => {
        me.act = 0.3;
        const p = plots()[i];
        if (tool === "water") water(i);
        else if (tool === "shovel") dig(i);
        else if (!p) plant(i);
        else harvest(i);
      });
    }

    /* ---------------- each frame ---------------- */
    function step(dt){
      clock += dt;
      const st = S(), now = Date.now();
      if (restock()) { tip.show("🛒 Sam's shop has new seeds!", 3000); Fun.sfx.ding(); if (!shopEl.hidden) drawShop(); }
      if (me.goal) {
        const dx = me.goal.x - me.x, dz = me.goal.z - me.z, d = Math.hypot(dx, dz);
        if (d < 0.15) { me.goal = null; me.moving = false; const j = me.job; me.job = null; if (j) j(); }
        else { const v = Math.min(d, 11 * dt); me.x += dx / d * v; me.z += dz / d * v; me.yaw = Math.atan2(dx, dz); me.moving = true; me.walk += dt * 12; }
      } else me.moving = false;
      me.act = Math.max(0, me.act - dt);
      // the weather
      weatherT -= dt;
      if (weatherT <= 0) {
        if (weather === "clear") {
          const r = Math.random();
          weather = r < 0.5 ? "rain" : r < 0.78 ? "snow" : "thunder";
          weatherT = 50; tip.show(WEATHER[weather].name, 5000);
          fx.pop(weather === "rain" ? "🌧️ IT'S RAINING!" : weather === "snow" ? "❄️ SNOW!" : "⛈️ THUNDERSTORM!", W / 2, H * 0.35, "#ffffff", 44);
          Fun.sfx.whoosh();
        } else { weather = "clear"; weatherT = 70 + Math.random() * 40; tip.show("☀️ The sun is back", 2500); }
      }
      // rain makes everything grow faster
      if (weather === "rain") plots().forEach(p => { if (p) { p.t0 -= dt * 500; p.fruits.forEach(f => { if (f.at > now) f.at -= dt * 500; }); } });
      tickT += dt;
      if (tickT >= 1) {
        tickT = 0;
        plots().forEach((p, i) => {
          if (!p) return;
          growFruit(p, now);
          if (weather === "clear" || weather === "thunder") return;
          ripe(p, now).concat(SEED[p.s].regrow ? p.fruits.filter(f => f.at > now) : []).forEach(c => {
            if (Math.random() < 0.05) {
              const got = addMut(c, weather === "rain" ? "wet" : "chilled");
              const [x, z] = tileXZ(i), at = proj(x, 1.5, z);
              if (got && at) fx.pop(MUT[got].name + "!", at.x, at.y, MUT[got].colour, got === "frozen" ? 30 : 20);
            }
          });
        });
      }
      if (weather === "thunder") {
        boltT -= dt;
        if (boltT <= 0) {
          boltT = 4 + Math.random() * 6;
          const full = plots().map((p, i) => p ? i : -1).filter(i => i >= 0);
          flash = 0.35; Fun.sfx.zap(); Fun.sfx.crash(); Fun.shake(canvas);
          if (full.length) {
            const i = full[Math.floor(Math.random() * full.length)], p = plots()[i];
            growFruit(p, now);
            const hit = SEED[p.s].regrow ? p.fruits : [p.crop];
            hit.forEach(c => addMut(c, "shocked"));
            bolt = { i, t: 0.35 };
            const [x, z] = tileXZ(i), at = proj(x, 2, z);
            if (at) { fx.pop("⚡ SHOCKED! ×100", at.x, at.y, "#ffe14d", 36); fx.burst(at.x, at.y, "#ffe14d", 30, 260); }
            save();
          }
        }
      }
      flash = Math.max(0, flash - dt);
      if (bolt) { bolt.t -= dt; if (bolt.t <= 0) bolt = null; }
      if (weather !== "clear") for (let k = 0; k < (weather === "snow" ? 2 : 6); k++) drops.push({ x: Math.random() * W, y: -10, vy: weather === "snow" ? 60 + Math.random() * 40 : 700 + Math.random() * 200, life: 2, snow: weather === "snow" });
      for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i]; d.y += d.vy * dt; d.life -= dt; if (d.snow) d.x += Math.sin(clock * 2 + i) * 20 * dt; if (d.y > H || d.life <= 0) drops.splice(i, 1); }
      if (!dragging && !me.goal) camYaw *= 1 - Math.min(1, dt * 0.3);
      saveT += dt;
      if (saveT > 5) { saveT = 0; save(); }
    }
    let bolt = null;
    function save(){ Hub.saveStore(); }

    /* ---------------- the camera and drawing ---------------- */
    let cam = { x: 0, y: 0, z: 0, R: [1, 0, 0], U: [0, 1, 0], F: [0, 0, 1] };
    function placeCam(){
      const sy = Math.sin(camYaw), cy = Math.cos(camYaw), D = 22;
      const cx = sy * D, cz = cy * D, ch = 16;
      let F = [0 - cx, 0 - ch, -1.5 - cz]; const l = Math.hypot(...F); F = F.map(v => v / l);
      const rl = Math.hypot(F[2], F[0]), R = [F[2] / rl, 0, -F[0] / rl];
      const U = [F[1] * R[2] - F[2] * R[1], F[2] * R[0] - F[0] * R[2], F[0] * R[1] - F[1] * R[0]];
      cam = { x: cx, y: ch, z: cz, R, U, F };
    }
    function camSpace(x, y, z){
      const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
      return [dx * cam.R[0] + dy * cam.R[1] + dz * cam.R[2], dx * cam.U[0] + dy * cam.U[1] + dz * cam.U[2], dx * cam.F[0] + dy * cam.F[1] + dz * cam.F[2]];
    }
    function proj(x, y, z){
      const q = camSpace(x, y, z);
      if (q[2] < NEAR) return null;
      return { x: W / 2 + q[0] * FOC / q[2], y: H / 2 - q[1] * FOC / q[2], s: FOC / q[2], d: q[2] };
    }
    // which bit of ground is under the mouse
    function ground(sx, sy){
      const a = (sx - W / 2) / FOC, b = -(sy - H / 2) / FOC;
      const dir = [0, 1, 2].map(k => cam.R[k] * a + cam.U[k] * b + cam.F[k]);
      if (dir[1] >= 0) return null;
      const t = -cam.y / dir[1];
      return [cam.x + dir[0] * t, cam.z + dir[2] * t];
    }
    function path3(pts){
      const q = pts.map(p => camSpace(p[0], p[1], p[2])), out = [];
      for (let i = 0; i < q.length; i++) {
        const a = q[i], b = q[(i + 1) % q.length], ain = a[2] >= NEAR, bin = b[2] >= NEAR;
        if (ain) out.push(a);
        if (ain !== bin) { const t = (NEAR - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]); }
      }
      if (out.length < 3) return false;
      ctx.beginPath();
      out.forEach((p, i) => { const sx = W / 2 + p[0] * FOC / p[2], sy = H / 2 - p[1] * FOC / p[2]; if (i) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy); });
      ctx.closePath();
      return true;
    }
    function quad(pts, fill, stroke){ if (!path3(pts)) return; ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); } }
    const shadeCache = new Map();
    function shade(hex, f){
      const key = hex + f;
      if (!shadeCache.has(key)) {
        const n = parseInt(hex.slice(1), 16), c = v => Math.min(255, Math.round(v * f));
        shadeCache.set(key, `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`);
      }
      return shadeCache.get(key);
    }
    function box(cx, y0, cz, w, h, d, colour, yaw, onFront){
      const c = Math.cos(yaw || 0), s = Math.sin(yaw || 0);
      const P = (lx, ly, lz) => [cx + lx * c + lz * s, y0 + ly, cz - lx * s + lz * c];
      const X = [-w / 2, w / 2], Y = [0, h], Z = [-d / 2, d / 2];
      const faces = [
        { n: [1, 0, 0], q: [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]], l: 0.78 }, { n: [-1, 0, 0], q: [[0, 0, 1], [0, 0, 0], [0, 1, 0], [0, 1, 1]], l: 0.7 },
        { n: [0, 1, 0], q: [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]], l: 1 }, { n: [0, -1, 0], q: [[0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 0, 0]], l: 0.5 },
        { n: [0, 0, 1], q: [[1, 0, 1], [0, 0, 1], [0, 1, 1], [1, 1, 1]], l: 0.88, front: true }, { n: [0, 0, -1], q: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], l: 0.82 }
      ];
      faces.forEach(f => {
        const wn = [f.n[0] * c + f.n[2] * s, f.n[1], -f.n[0] * s + f.n[2] * c];
        const mid = P(f.n[0] ? X[(f.n[0] + 1) / 2] : 0, f.n[1] ? Y[(f.n[1] + 1) / 2] : h / 2, f.n[2] ? Z[(f.n[2] + 1) / 2] : 0);
        if (wn[0] * (cam.x - mid[0]) + wn[1] * (cam.y - mid[1]) + wn[2] * (cam.z - mid[2]) <= 0) return;
        if (!path3(f.q.map(([i, j, k]) => P(X[i], Y[j], Z[k])))) return;
        ctx.fillStyle = shade(colour, f.l); ctx.fill();
        ctx.strokeStyle = shade(colour, f.l * 0.75); ctx.lineWidth = 1; ctx.stroke();
        if (f.front && onFront) onFront(P, w, h, d);
      });
    }
    const EMOJI_FONT = `system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    // an emoji standing in the world, its bottom at y
    function emo(e, x, y, z, size, alpha){
      const p = proj(x, y, z);
      if (!p) return null;
      const px = Math.max(4, Math.min(200, size * p.s));
      ctx.globalAlpha = alpha === undefined ? 1 : alpha;
      ctx.font = `${px}px ${EMOJI_FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      ctx.fillText(e, p.x, p.y + px * 0.08);
      ctx.globalAlpha = 1;
      return { x: p.x, y: p.y - px / 2, r: px / 2 };
    }
    // a shine round a crop to show its mutation
    function glow(at, m){
      if (!at || !m || !m.length) return;
      const k = m.includes("rainbow") ? "rainbow" : m.includes("gold") ? "gold" : m[m.length - 1];
      const col = k === "rainbow" ? `hsl(${(clock * 200) % 360},90%,65%)` : MUT[k].colour;
      ctx.save();
      ctx.globalAlpha = 0.45 + 0.25 * Math.sin(clock * 5);
      ctx.strokeStyle = col; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(at.x, at.y, at.r * 0.85, 0, 7); ctx.stroke();
      if (Math.floor(clock * 6 + at.x) % 5 === 0) { ctx.fillStyle = col; ctx.fillRect(at.x + (Math.random() - 0.5) * at.r * 2, at.y + (Math.random() - 0.5) * at.r * 2, 3, 3); }
      ctx.restore();
    }
    function drawPlant(i, now){
      const p = plots()[i];
      if (!p) return;
      const def = SEED[p.s], [x, z] = tileXZ(i), g = growth(p, now);
      if (g < 0.2) { emo("🌱", x, 0.1, z, 0.5 + g * 3); return; }
      if (!def.regrow) {
        const big = def.kg > 4 ? 1.6 : 1.1, s = (0.35 + 0.65 * g) * big * (g >= 1 ? Math.min(1.5, Math.sqrt(p.crop.w)) : 1);
        if (g < 1) emo("🌿", x, 0.1, z, s * 0.9, 0.9);
        const at = emo(def.em, x, 0.05, z, s, g >= 1 ? 1 : 0.55 + g * 0.3);
        if (g >= 1) { glow(at, p.crop.m); if (Math.sin(clock * 3 + i) > 0.95) fx.burst(at.x, at.y - at.r, "#ffffff", 2, 40, 0); }
        return;
      }
      if (def.tree) {
        const h = 0.6 + 2.6 * g, leaf = 1.2 + 1.4 * g;
        box(x, 0, z, 0.35, h, 0.35, "#8a5a2b");
        const col = def.r === "prismatic" ? "#ff9ed8" : def.tree;
        box(x, h - 0.2, z, leaf, leaf * 0.8, leaf, col);
        if (g >= 1) fruitsOn(p, now, i, (k, n) => {
          const a = k / n * 6.283 + 0.4, r = leaf * 0.52;
          return [x + Math.sin(a) * r, h - 0.1 + (k % 2) * leaf * 0.35, z + Math.cos(a) * r];
        }, 0.75);
      } else {
        emo("🌿", x, 0.05, z, 0.8 + 0.9 * g);
        if (g >= 1) fruitsOn(p, now, i, (k, n) => { const a = k / n * 6.283; return [x + Math.sin(a) * 0.55, 0.25 + (k % 2) * 0.45, z + Math.cos(a) * 0.55]; }, def.kg > 1 ? 0.75 : 0.55);
      }
    }
    function fruitsOn(p, now, i, place, size){
      const def = SEED[p.s];
      p.fruits.forEach(f => {
        const [fx_, fy, fz] = place(f.slot, def.fruits);
        const k = f.at <= now ? 1 : Math.max(0.15, 1 - (f.at - now) / (def.regrow * 1000));
        const at = emo(def.em, fx_, fy, fz, size * (0.4 + 0.6 * k) * Math.min(1.4, Math.sqrt(f.w)), k >= 1 ? 1 : 0.5);
        if (k >= 1) glow(at, f.m);
      });
    }
    // a blocky Roblox-style gardener, and the two shopkeepers
    function drawPerson(c, look){
      const sw = c.moving ? Math.sin(c.walk) * 0.35 : 0;
      const sy = Math.sin(c.yaw), cy = Math.cos(c.yaw);
      const at = (lx, lz) => [c.x + lx * cy + lz * sy, c.z - lx * sy + lz * cy];
      const sh = proj(c.x, 0.02, c.z);
      if (sh) { ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, 0.7 * sh.s, 0.25 * sh.s, 0, 0, 7); ctx.fill(); }
      const bend = c.act > 0 ? 0.5 : 0;
      const parts = [
        { l: [-0.25, sw * 0.5], y: 0, w: 0.48, h: 1.0, d: 0.5, col: look.pants },
        { l: [0.25, -sw * 0.5], y: 0, w: 0.48, h: 1.0, d: 0.5, col: look.pants },
        { l: [0, 0], y: 1.0, w: 1.0, h: 1.0, d: 0.5, col: look.shirt },
        { l: [-0.72, -sw * 0.5 + bend], y: 1.05 - bend * 0.3, w: 0.42, h: 0.95, d: 0.45, col: look.skin },
        { l: [0.72, sw * 0.5 + bend], y: 1.05 - bend * 0.3, w: 0.42, h: 0.95, d: 0.45, col: look.skin },
        { l: [0, 0], y: 2.0, w: 0.62, h: 0.62, d: 0.62, col: look.skin, face: true }
      ];
      if (look.hat) parts.push({ l: [0, 0], y: 2.58, w: 1.1, h: 0.1, d: 1.1, col: look.hat }, { l: [0, 0], y: 2.6, w: 0.62, h: 0.3, d: 0.62, col: look.hat });
      parts.map(p => { const [x, z] = at(...p.l); return { p, x, z, d: camSpace(x, p.y + p.h / 2, z)[2] }; })
        .sort((a, b) => b.d - a.d)
        .forEach(({ p, x, z }) => box(x, p.y, z, p.w, p.h, p.d, p.col, c.yaw, p.face ? drawFace : null));
    }
    function drawFace(P, w, h, d){
      const pt = (u, v) => proj(...P(u * w / 2, v * h, d / 2 + 0.01));
      const e1 = pt(-0.38, 0.62), e2 = pt(0.38, 0.62), m = pt(0, 0.3);
      if (!e1 || !e2 || !m) return;
      const r = Math.max(1.2, Math.hypot(e2.x - e1.x, e2.y - e1.y) * 0.13);
      ctx.fillStyle = "#1b1b1b";
      ctx.beginPath(); ctx.ellipse(e1.x, e1.y, r * 0.75, r * 1.3, 0, 0, 7); ctx.ellipse(e2.x, e2.y, r * 0.75, r * 1.3, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = "#1b1b1b"; ctx.lineWidth = Math.max(1, r * 0.6); ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(m.x, m.y - r * 2.2, r * 2.4, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); ctx.lineCap = "butt";
    }
    const LOOK_ME = { shirt: "#1f6bff", pants: "#2fa84f", skin: "#f5cd30", hat: "#e8c66a" };
    const LOOK_SAM = { shirt: "#7a4a2a", pants: "#3a3f55", skin: "#f2c49b", hat: "#3f9e3a" };
    const LOOK_STEVEN = { shirt: "#d62b2b", pants: "#2a2d34", skin: "#c68863", hat: null };
    function stand(s, roof, sign){
      box(s.x, 0, s.z, 3.4, 1.1, 1.4, "#c58a4a");
      box(s.x - 1.5, 0, s.z - 0.5, 0.2, 2.8, 0.2, "#8a5a2b"); box(s.x + 1.5, 0, s.z - 0.5, 0.2, 2.8, 0.2, "#8a5a2b");
      box(s.x, 2.8, s.z, 3.8, 0.35, 2, roof);
      const p = proj(s.x, 3.6, s.z);
      if (p) {
        ctx.font = `bold ${Math.max(10, p.s * 0.55)}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.strokeText(sign, p.x, p.y); ctx.fillStyle = "#fff"; ctx.fillText(sign, p.x, p.y);
      }
    }

    function draw(dt){
      placeCam();
      const now = Date.now(), dark = weather === "clear" ? 0 : weather === "thunder" ? 0.35 : 0.18;
      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.5);
      sky.addColorStop(0, weather === "clear" ? "#58a8ff" : weather === "snow" ? "#9fb6cf" : "#5b6b80");
      sky.addColorStop(1, weather === "clear" ? "#cfe9ff" : "#d9e2ec");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      quad([[-80, 0, -80], [80, 0, -80], [80, 0, 80], [-80, 0, 80]], weather === "snow" ? "#dfeef0" : "#6cc04a");
      // the soil
      const hw = COLS * TILE / 2 + 0.4, hd = ROWS * TILE / 2 + 0.4;
      quad([[-hw, 0.01, -hd], [hw, 0.01, -hd], [hw, 0.01, hd], [-hw, 0.01, hd]], "#7a4f2a");
      for (let i = 0; i < COLS * ROWS; i++) {
        const [x, z] = tileXZ(i), h = TILE / 2 - 0.12, p = plots()[i];
        const wet = p && now - (p.watered || 0) < 4000 || weather === "rain";
        quad([[x - h, 0.03, z - h], [x + h, 0.03, z - h], [x + h, 0.03, z + h], [x - h, 0.03, z + h]], wet ? "#5a3820" : (i + Math.floor(i / COLS)) % 2 ? "#946238" : "#8a5a33", hover === i ? "#ffe14d" : null);
      }
      if (bolt) { const [x, z] = tileXZ(bolt.i), a = proj(x, 14, z), b = proj(x, 0, z); if (a && b) { ctx.strokeStyle = "#fff8a0"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(a.x, a.y); for (let k = 1; k <= 6; k++) ctx.lineTo(a.x + (b.x - a.x) * k / 6 + (k < 6 ? (Math.random() - 0.5) * 40 : 0), a.y + (b.y - a.y) * k / 6); ctx.stroke(); } }
      // everything standing up, back to front
      const things = [];
      for (let i = 0; i < COLS * ROWS; i++) if (plots()[i]) { const [x, z] = tileXZ(i); things.push({ d: camSpace(x, 0.5, z)[2], f: () => drawPlant(i, now) }); }
      things.push({ d: camSpace(me.x, 1, me.z)[2], f: () => drawPerson(me, LOOK_ME) });
      things.push({ d: camSpace(SAM.x, 1, SAM.z)[2] + 0.5, f: () => stand(SAM, "#3f9e3a", "🌰 Seeds") });
      things.push({ d: camSpace(SAM.x, 1, SAM.z + 1.5)[2], f: () => drawPerson({ x: SAM.x, z: SAM.z + 1.5, yaw: 0, walk: 0, act: 0 }, LOOK_SAM) });
      things.push({ d: camSpace(STEVEN.x, 1, STEVEN.z)[2] + 0.5, f: () => stand(STEVEN, "#d62b2b", "💰 Sell") });
      things.push({ d: camSpace(STEVEN.x, 1, STEVEN.z + 1.5)[2], f: () => drawPerson({ x: STEVEN.x, z: STEVEN.z + 1.5, yaw: 0, walk: 0, act: 0 }, LOOK_STEVEN) });
      [[-16, -10], [16, -9], [-18, 2], [18, 1], [-7, -14], [8, -15]].forEach(([x, z]) => things.push({ d: camSpace(x, 1, z)[2], f: () => { box(x, 0, z, 0.7, 2, 0.7, "#8a5a2b"); box(x, 2, z, 2.6, 2.2, 2.6, weather === "snow" ? "#e8f4f4" : "#3f9e3a"); } }));
      things.sort((a, b) => b.d - a.d).forEach(t => t.f());
      // a tool in your hand
      const hand = proj(me.x, 2.8, me.z);
      if (hand) { ctx.font = `${Math.max(12, hand.s * 0.7)}px ${EMOJI_FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(tool === "water" ? "🚿" : tool === "shovel" ? "⛏️" : pick && S().seeds[pick] ? SEED[pick].em : "✋", hand.x, hand.y); }

      if (dark) { ctx.fillStyle = `rgba(20,30,50,${dark})`; ctx.fillRect(0, 0, W, H); }
      drops.forEach(d => {
        if (d.snow) { ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.fillRect(d.x, d.y, 3, 3); }
        else { ctx.strokeStyle = d.splash ? "rgba(120,190,255,0.9)" : "rgba(200,220,255,0.6)"; ctx.lineWidth = d.splash ? 2 : 1.5; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 2, d.y + 12); ctx.stroke(); }
      });
      if (flash > 0) { ctx.fillStyle = `rgba(255,255,230,${flash * 2})`; ctx.fillRect(0, 0, W, H); }
      fx.draw(ctx, dt);
      // the basket and the weather
      const st = S(), bv = st.basket.reduce((a, c) => a + valueOf(c), 0);
      ctx.fillStyle = "rgba(10,20,45,0.55)"; round(10, 10, 250, 54, 10); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.font = "bold 16px system-ui";
      ctx.fillText(`🧺 ${st.basket.length} crops · ${money(bv)}`, 20, 16);
      ctx.font = "13px system-ui"; ctx.fillText(st.basket.length ? "Sell them at Steven's stand 💰" : "Click a ripe plant to pick it", 20, 40);
      ctx.fillStyle = "rgba(10,20,45,0.55)"; round(W - 200, 10, 190, 34, 10); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.textAlign = "right"; ctx.font = "bold 15px system-ui";
      ctx.fillText(WEATHER[weather].name.split(":")[0], W - 20, 19);
    }
    function round(x, y, w, h, r){ ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

    function hud(){
      const st = S(), left = Math.max(0, st.restockAt - Date.now()) / 1000;
      const t = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")}`;
      cashEl.textContent = money(st.cash);
      restockEl.textContent = `🛒 New seeds in ${t}`;
      shopTimer.textContent = `New seeds in ${t}`;
      const bv = st.basket.reduce((a, c) => a + valueOf(c), 0);
      sellBtn.textContent = bv ? `💰 Sell ${money(bv)}` : "💰 Sell";
    }

    /* ---------------- the loop ---------------- */
    let scale = 1;
    function fit(){
      const s = Fun.res(canvas.clientWidth, W, 2);
      if (Math.abs(s - scale) > 0.01) { scale = s; canvas.width = Math.round(W * s); canvas.height = Math.round(H * s); }
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    }
    function loop(now){
      if (!open) return;
      const dt = Math.min(1 / 30, (now - last) / 1000 || 0);
      last = now;
      if (running) step(dt); else clock += dt;
      fit(); draw(dt); hud();
      requestAnimationFrame(loop);
    }
    function start(){
      running = true; panel.hidden = true;
      canvas.focus();
      tip.show(Object.keys(S().seeds).length ? "🌱 Click the soil to plant a seed!" : "🌰 Buy seeds at Sam's shop!", 4000);
    }
    function openGame(){
      open = true; running = false;
      overlay.hidden = false; document.body.style.overflow = "hidden";
      const st = S(), now = Date.now();
      plots(); restock();
      let ready = 0;
      plots().forEach(p => { if (p) { growFruit(p, now); ready += ripe(p, now).length; } });
      fx.clear(); drops = []; bolt = null; flash = 0; weather = "clear"; weatherT = 40;
      me.x = 0; me.z = ROWS + 2.5; me.goal = null; me.job = null; shopEl.hidden = true;
      drawSeeds(); drawTools();
      titleEl.textContent = "🌱 Garden Grow";
      textEl.textContent = (st.harvested ? `Welcome back! ${ready ? `${ready} crops are ready to pick. 🧺` : "Your plants kept growing while you were away."}` : "Plant seeds and watch them grow, even while you're away!") +
        " Rain, snow and lightning make crops worth way more, and a few grow Gold or Rainbow! ✨";
      playBtn.textContent = "▶ Garden!";
      panel.hidden = false;
      last = performance.now();
      requestAnimationFrame(loop);
      playBtn.focus();
    }
    function closeGame(){
      if (open) save();
      open = false; running = false;
      overlay.hidden = true; document.body.style.overflow = "";
    }

    /* ---------------- controls ---------------- */
    let dragging = false, dragX = 0, dragged = 0, hover = -1;
    const toCanvas = e => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
    function tileAt(sx, sy){
      const g = ground(sx, sy);
      if (!g) return { kind: "none" };
      const [gx, gz] = g;
      if (Math.hypot(gx - SAM.x, gz - SAM.z) < 2.6) return { kind: "sam" };
      if (Math.hypot(gx - STEVEN.x, gz - STEVEN.z) < 2.6) return { kind: "steven" };
      const c = Math.round(gx / TILE + (COLS - 1) / 2), r = Math.round(gz / TILE + (ROWS - 1) / 2);
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return { kind: "ground", x: gx, z: gz };
      return { kind: "tile", i: r * COLS + c };
    }
    canvas.addEventListener("pointerdown", e => {
      if (!running) return;
      dragging = true; dragX = e.clientX; dragged = 0;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", e => {
      if (dragging) {
        const dx = e.clientX - dragX; dragX = e.clientX; dragged += Math.abs(dx);
        if (dragged > 8) camYaw = Math.max(-1.2, Math.min(1.2, camYaw - dx / canvas.clientWidth * 3));
        return;
      }
      const t = tileAt(...toCanvas(e)); hover = t.kind === "tile" ? t.i : -1;
    });
    canvas.addEventListener("pointerup", e => {
      if (!dragging) return;
      dragging = false;
      if (dragged >= 8 || !running) return;
      const t = tileAt(...toCanvas(e));
      if (t.kind === "tile") useTile(t.i);
      else if (t.kind === "sam") openShop();
      else if (t.kind === "steven") walkTo(STEVEN.x - 2.2, STEVEN.z + 1.6, sell);
      else if (t.kind === "ground") walkTo(Math.max(-20, Math.min(20, t.x)), Math.max(-15, Math.min(14, t.z)));
    });
    canvas.addEventListener("pointercancel", () => { dragging = false; });
    canvas.addEventListener("pointerleave", () => { hover = -1; });
    canvas.addEventListener("contextmenu", e => e.preventDefault());
    canvas.tabIndex = 0;
    window.addEventListener("keydown", e => {
      if (!open) return;
      if (e.key === "Escape") { if (!shopEl.hidden) { shopEl.hidden = true; return; } if (running) { running = false; save(); titleEl.textContent = "⏸ Paused"; textEl.textContent = "Your garden keeps growing while you're away!"; playBtn.textContent = "▶ Keep gardening"; panel.hidden = false; playBtn.focus(); return; } Hub.leave(); return; }
      if (!running) return;
      if (e.code === "Digit1") { tool = "hand"; drawTools(); }
      if (e.code === "Digit2") { tool = "water"; drawTools(); }
      if (e.code === "Digit3") { tool = "shovel"; drawTools(); }
    });
    $("ggCloseBtn").addEventListener("click", () => Hub.leave());
    Fun.soundButton($("ggCloseBtn"));
    playBtn.addEventListener("click", start);

    // for tests: peek at the garden, and fast-forward time
    window.__garden = {
      state: () => ({ cash: S().cash, seeds: { ...S().seeds }, basket: S().basket.length, plots: plots().map(p => p && p.s), weather, me: [me.x, me.z], stock: { ...S().stock } }),
      skip: secs => { plots().forEach(p => { if (p) { p.t0 -= secs * 1000; p.fruits.forEach(f => { f.at -= secs * 1000; }); } }); },
      use: i => useTile(i), cash: n => { S().cash = n; }, weather: (w, t) => { weather = w; weatherT = t || 30; boltT = 0.5; },
      seeds: (id, n) => { S().seeds[id] = n; pick = id; drawSeeds(); }, sell: () => sell(), shop: () => openShop(), tool: t => { tool = t; drawTools(); }
    };

    return { open: openGame, close: closeGame };
  }
})();
