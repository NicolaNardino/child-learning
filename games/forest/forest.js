/* 99 Nights: a game like "99 Nights in the Forest" on Roblox. Your campfire is the only safe place.
   In the day, chop trees for logs, pick berries and carrots, and grab scrap for the crafting bench.
   Feed the fire: the bigger it is, the bigger the circle of light. At night wolves come out, and the
   Deer, a tall shadow with red eyes, creeps up on anyone outside the light. Shine your flashlight
   right at it and it runs away! Four lost kids are somewhere in the forest: bring them back to the
   fire. Survive 99 nights to win. */
(function(){
  "use strict";
  const store = Hub.store;
  const DAY = 55, NIGHT = 45, WORLD = 64;
  const S = () => (store.forest = store.forest || { night: 1, t: 4, fire: 60, health: 100, hunger: 100, battery: 100, scrap: 0, sack: [], up: {}, kids: [], best: 0, deer: 0, won: false });

  const ITEM = {
    log:    { name: "Log",       em: "🪵", fuel: 18 },
    coal:   { name: "Coal",      em: "🪨", fuel: 40 },
    berry:  { name: "Berries",   em: "🫐", food: 15 },
    carrot: { name: "Carrot",    em: "🥕", food: 20 },
    meat:   { name: "Raw meat",  em: "🍖", food: 10 },
    steak:  { name: "Steak",     em: "🥩", food: 45 },
    scrap:  { name: "Scrap",     em: "⚙️" }
  };
  const UPGRADES = [
    { id: "sack",  icon: "🎒", name: "Big Sack",          desc: "Carry 10 things instead of 5",           cost: 5 },
    { id: "axe",   icon: "🪓", name: "Good Axe",          desc: "Chop trees and bonk wolves twice as fast", cost: 8 },
    { id: "light", icon: "🔦", name: "Strong Flashlight", desc: "A wider beam that scares the Deer faster", cost: 10 },
    { id: "pit",   icon: "🔥", name: "Stone Fire Pit",    desc: "The fire burns slower and shines further", cost: 12 }
  ];
  const KIDS = [
    { id: "dino",   name: "Dino Kid",   shirt: "#3fae4a", hat: "#2a7f33", a: 0.7 },
    { id: "kraken", name: "Kraken Kid", shirt: "#7d4bd6", hat: "#5a2fae", a: 2.3 },
    { id: "squid",  name: "Squid Kid",  shirt: "#ff6bae", hat: "#d63f86", a: 3.9 },
    { id: "koala",  name: "Koala Kid",  shirt: "#9aa3ad", hat: "#6d757e", a: 5.4 }
  ];
  function rng(seed){ return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  Hub.register({
    id: "forest", section: "games", title: "99 Nights", icon: "🌲",
    blurb: "Like 99 Nights in the Forest on Roblox: keep the campfire burning, scare off the Deer and survive 99 nights!",
    stat: () => S().best ? `Survived ${S().best} nights` : "",
    badges: [
      { id: "nfTen",  icon: "🌙", name: "Night Owl",       desc: "Survive 10 nights in 99 Nights",        test: () => S().best >= 10 },
      { id: "nfDeer", icon: "🦌", name: "Deer Scarer",     desc: "Scare the Deer away with your flashlight", test: () => S().deer >= 1 },
      { id: "nfKids", icon: "🧒", name: "Rescuer",         desc: "Bring all 4 lost kids back to the fire",  test: () => S().kids.length >= 4 },
      { id: "nf99",   icon: "🏆", name: "99 Nights!",      desc: "Survive all 99 nights",                   test: () => !!S().won }
    ],
    mount
  });

  function mount(host){
    host.innerHTML = `
    <section class="game-screen nf-screen" id="nfOverlay" hidden aria-label="99 Nights">
      <div class="game-box">
        <div class="game-hud">
          <h2>🌲 99 Nights</h2>
          <span class="mono game-stat nf-night" id="nfNight">Day 1</span>
          <button class="btn ghost small" id="nfCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas class="nf-canvas" id="nfCanvas" width="960" height="540"></canvas>
          <div class="nf-bench" id="nfBench" hidden>
            <div class="nf-bench-head"><b>🔨 Crafting Bench</b><span id="nfScrap"></span><button class="btn ghost small" id="nfBenchClose" type="button">✕</button></div>
            <div id="nfBenchList"></div>
          </div>
          <div class="game-panel nf-panel" id="nfPanel">
            <div class="game-panel-title" id="nfTitle">🌲 99 Nights</div>
            <div class="game-panel-text" id="nfText"></div>
            <button class="btn" id="nfPlayBtn" type="button">▶ Play</button>
          </div>
        </div>
        <div class="game-help">W A S D to walk · ← → or the mouse to turn (click the game to use the mouse, Esc to let go) · click or Space to swing the axe · E to pick up, feed the fire or rescue · Q to eat · F for the flashlight</div>
        <div class="game-touch nf-touch">
          <button class="btn ghost" data-k="left" type="button" aria-label="Turn left">↶</button>
          <button class="btn ghost" data-k="up" type="button" aria-label="Walk">▲</button>
          <button class="btn ghost" data-k="down" type="button" aria-label="Back">▼</button>
          <button class="btn ghost" data-k="right" type="button" aria-label="Turn right">↷</button>
          <button class="btn" data-k="act" type="button" aria-label="Pick up or use">E</button>
          <button class="btn" data-k="axe" type="button" aria-label="Swing the axe">🪓</button>
          <button class="btn" data-k="eat" type="button" aria-label="Eat">😋</button>
          <button class="btn" data-k="light" type="button" aria-label="Flashlight">🔦</button>
        </div>
      </div>
    </section>`;
    const $ = id => document.getElementById(id);
    const overlay = $("nfOverlay"), canvas = $("nfCanvas"), ctx = canvas.getContext("2d");
    const panel = $("nfPanel"), titleEl = $("nfTitle"), textEl = $("nfText"), playBtn = $("nfPlayBtn");
    const nightEl = $("nfNight"), benchEl = $("nfBench"), benchList = $("nfBenchList"), scrapEl = $("nfScrap");
    const W = 960, H = 540, FOC = 560, NEAR = 0.4, VIEW = 46;
    const fx = Fun.pops(), tip = Fun.hint(canvas.parentElement);
    const dark = document.createElement("canvas"); dark.width = W / 2; dark.height = H / 2;
    const dctx = dark.getContext("2d");

    let open = false, running = false, last = 0, clock = 0, saveT = 0;
    let trees = [], items = [], wolves = [], deer = null, kids = [], prompt = null, hurt = 0, eyes = [];
    let light = false;
    const me = { x: 0, z: 6, yaw: Math.PI, y: 0, vy: 0, walk: 0, moving: false, swing: 0 };
    const keys = { up: false, down: false, left: false, right: false, sleft: false, sright: false };

    /* ---------------- the forest ---------------- */
    const night = () => S().t >= DAY;
    const daylight = () => { const t = S().t; if (t < 6) return t / 6; if (t < DAY - 8) return 1; if (t < DAY) return (DAY - t) / 8; return 0; };
    const fireR = () => (4 + S().fire / 100 * 12) * (S().up.pit ? 1.25 : 1);
    const capacity = () => S().up.sack ? 10 : 5;
    const dmg = () => S().up.axe ? 2 : 1;
    const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
    const FIRE = { x: 0, z: 0 }, BENCH = { x: -4.5, z: -2.5 };
    function build(){
      const r = rng(Date.now() & 0xffff);
      trees = [];
      const kidSpots = KIDS.map(k => ({ x: Math.cos(k.a) * 52, z: Math.sin(k.a) * 52 }));
      for (let tries = 0; trees.length < 240 && tries < 6000; tries++) {
        const a = r() * 6.283, d = 9 + Math.sqrt(r()) * (WORLD - 9);
        const t = { x: Math.cos(a) * d, z: Math.sin(a) * d };
        if (trees.some(o => Math.abs(o.x - t.x) < 3.2 && Math.abs(o.z - t.z) < 3.2)) continue;
        if (kidSpots.some(k => dist(k, t) < 5)) continue;
        t.h = 3.5 + r() * 2.5; t.hp = 3; t.shake = 0; t.pine = r() < 0.6; t.col = ["#2f7d32", "#3a8f3a", "#2a6b30", "#4a9a3a"][Math.floor(r() * 4)];
        trees.push(t);
      }
      items = [];
      const scatter = (kind, n, lo, hi) => { for (let i = 0; i < n; i++) { const a = r() * 6.283, d = lo + r() * (hi - lo); items.push({ kind, x: Math.cos(a) * d, z: Math.sin(a) * d }); } };
      scatter("log", 4, 4, 9); scatter("berry", 14, 10, 60); scatter("carrot", 10, 10, 60); scatter("scrap", 22, 12, 62); scatter("coal", 8, 25, 62);
      kids = KIDS.map((k, i) => ({ ...k, x: kidSpots[i].x, z: kidSpots[i].z, home: { ...kidSpots[i] }, yaw: 0, walk: 0, moving: false,
        state: S().kids.includes(k.id) ? "safe" : "lost" }));
      kids.forEach((k, i) => { if (k.state === "safe") { const a = i * 1.57 + 0.4; k.x = Math.cos(a) * 3; k.z = Math.sin(a) * 3; } });
      wolves = []; deer = null;
    }
    function dawnItems(){
      const r = Math.random;
      for (let i = 0; i < 8; i++) { const a = r() * 6.283, d = 10 + r() * 50; items.push({ kind: ["berry", "carrot", "scrap", "scrap", "coal", "berry", "carrot", "scrap"][i], x: Math.cos(a) * d, z: Math.sin(a) * d }); }
    }
    function startNight(){
      const st = S(), n = Math.min(8, 2 + Math.floor(st.night / 4));
      wolves = [];
      for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, d = 30 + Math.random() * 25; wolves.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, yaw: 0, hp: 3, cd: 0, walk: 0, wander: Math.random() * 6.283, hit: 0 }); }
      const a = me.yaw + Math.PI + (Math.random() - 0.5);
      deer = { x: me.x + Math.sin(a) * 34, z: me.z + Math.cos(a) * 34, yaw: 0, stun: 0, gone: 0, walk: 0 };
      fx.pop(`🌙 NIGHT ${st.night}`, W / 2, H * 0.35, "#c9d7ff", 52);
      tip.show(st.night === 1 ? "🌙 Night is coming! Stay near the fire. If the Deer comes, shine your flashlight at it (F)" : "🌙 Night " + st.night + ": keep the fire burning!", 5000);
      Fun.sfx.wah();
    }
    function dawn(){
      const st = S();
      fx.pop(`☀️ You survived Night ${st.night}!`, W / 2, H * 0.35, "#ffe14d", 44);
      fx.burst(W / 2, H * 0.35, "#ffe14d", 30, 220); Fun.sfx.tada();
      st.best = Math.max(st.best, st.night);
      if (st.night >= 99 && !st.won) { st.won = true; win(); }
      st.night++;
      wolves = []; deer = null;
      dawnItems(); save(); Hub.checkBadges();
    }
    function win(){
      running = false;
      titleEl.textContent = "🏆 99 NIGHTS!";
      textEl.textContent = "You survived all 99 nights in the forest! You're a legend. Keep playing to see how far you can go!";
      playBtn.textContent = "▶ Keep going";
      panel.hidden = false;
      for (let i = 0; i < 6; i++) fx.burst(W * Math.random(), H * Math.random(), "#ffe14d", 30, 260);
      if (Hub.confettiBurst) Hub.confettiBurst();
    }

    /* ---------------- doing things ---------------- */
    function findPrompt(){
      const st = S();
      let best = null, bd = 1e9;
      const consider = (d, max, p) => { if (d < max && d < bd) { bd = d; best = p; } };
      items.forEach(it => consider(dist(it, me), 1.9, { kind: "pick", it, text: st.sack.length >= capacity() ? `🎒 Sack full! (${capacity()})` : `E: pick up ${ITEM[it.kind].em} ${ITEM[it.kind].name}` }));
      kids.forEach(k => { if (k.state === "lost") consider(dist(k, me), 3, { kind: "kid", k, text: `E: rescue ${k.name}!` }); });
      const fuel = st.sack.filter(k => ITEM[k].fuel).length, meat = st.sack.filter(k => k === "meat").length;
      if (fuel || meat) consider(dist(FIRE, me), 3.6, { kind: "fire", text: `E: ${fuel ? `throw ${fuel} fuel on the fire 🔥` : ""}${fuel && meat ? " and " : ""}${meat ? `cook ${meat} meat 🥩` : ""}` });
      consider(dist(BENCH, me), 2.6, { kind: "bench", text: "E: use the crafting bench 🔨" });
      return best;
    }
    function act(){
      if (!running) return;
      const st = S(), p = prompt;
      if (!p) return;
      if (p.kind === "pick") {
        if (st.sack.length >= capacity()) { Fun.sfx.nope(); fx.pop("Sack full! 🎒", W / 2, H * 0.6, "#ff9f43", 28); return; }
        items.splice(items.indexOf(p.it), 1);
        if (p.it.kind === "scrap") { st.scrap++; fx.pop("+1 ⚙️ scrap", W / 2, H * 0.6, "#c9d7ff", 26); Fun.sfx.beep(); }
        else { st.sack.push(p.it.kind); fx.pop(`+ ${ITEM[p.it.kind].em}`, W / 2, H * 0.6, "#ffffff", 30); Fun.sfx.pop(); }
      } else if (p.kind === "kid") {
        p.k.state = "follow"; Fun.sfx.tada();
        fx.pop(`${p.k.name}: "You found me! 😭"`, W / 2, H * 0.4, "#ffe14d", 30);
        tip.show(`🧒 Take ${p.k.name} back to the campfire!`, 4000);
      } else if (p.kind === "fire") {
        let fuel = 0, cooked = 0;
        st.sack = st.sack.filter(k => { if (ITEM[k].fuel) { fuel += ITEM[k].fuel; return false; } return true; }).map(k => { if (k === "meat") { cooked++; return "steak"; } return k; });
        if (fuel) { st.fire = Math.min(100, st.fire + fuel); fx.pop(`🔥 WHOOSH! Fire ${Math.round(st.fire)}%`, W / 2, H * 0.45, "#ff9f43", 38); fx.burst(W / 2, H * 0.5, "#ff9f43", 26, 200); Fun.sfx.whoosh(); }
        if (cooked) { fx.pop(`🥩 Cooked ${cooked} steak${cooked > 1 ? "s" : ""}!`, W / 2, H * 0.55, "#ffcf9f", 28); Fun.sfx.splat(); }
        save();
      } else if (p.kind === "bench") { openBench(); }
    }
    function eat(){
      if (!running) return;
      const st = S();
      const foods = st.sack.map((k, i) => ({ k, i })).filter(f => ITEM[f.k].food).sort((a, b) => ITEM[b.k].food - ITEM[a.k].food);
      if (!foods.length) { fx.pop("No food! Find berries 🫐", W / 2, H * 0.6, "#ff9f43", 26); Fun.sfx.nope(); return; }
      if (st.hunger > 95) { fx.pop("You're full! 😌", W / 2, H * 0.6, "#ffffff", 26); return; }
      const f = foods.find(f => f.k !== "meat") || foods[0];
      st.sack.splice(f.i, 1);
      st.hunger = Math.min(100, st.hunger + ITEM[f.k].food);
      fx.pop(f.k === "meat" ? "Yuck, raw! 🤢 Cook it at the fire" : `${ITEM[f.k].em} Yum! +${ITEM[f.k].food}`, W / 2, H * 0.6, "#9be37a", 28);
      Fun.sfx.chomp();
    }
    function swing(){
      if (!running || me.swing > 0) return;
      me.swing = 0.35; Fun.sfx.whoosh();
      const fwd = [Math.sin(me.yaw), Math.cos(me.yaw)];
      const facing = o => { const dx = o.x - me.x, dz = o.z - me.z, d = Math.hypot(dx, dz); return d > 0.01 ? (dx * fwd[0] + dz * fwd[1]) / d : 1; };
      const wolf = wolves.find(w => dist(w, me) < 2.6 && facing(w) > 0.3);
      if (wolf) {
        wolf.hp -= dmg(); wolf.hit = 0.3;
        const d = dist(wolf, me) || 1; wolf.x += (wolf.x - me.x) / d * 2.5; wolf.z += (wolf.z - me.z) / d * 2.5;
        const p = proj(wolf.x, 1.2, wolf.z);
        Fun.sfx.bonk();
        if (wolf.hp <= 0) {
          wolves.splice(wolves.indexOf(wolf), 1);
          items.push({ kind: "meat", x: wolf.x, z: wolf.z });
          if (p) { fx.pop("POOF! 💨", p.x, p.y, "#ffffff", 34); fx.burst(p.x, p.y, "#cccccc", 24, 180); }
        } else if (p) fx.pop(["BONK!", "Yelp!", "Go away!"][Math.floor(Math.random() * 3)], p.x, p.y, "#ffe14d", 28);
        return;
      }
      const tree = trees.find(t => t.hp > 0 && dist(t, me) < 2.3 && facing(t) > 0.4);
      if (!tree) return;
      tree.hp -= dmg(); tree.shake = 0.3; Fun.sfx.thunk();
      const p = proj(tree.x, 2, tree.z);
      if (tree.hp <= 0) {
        if (p) { fx.pop("TIMBER! 🌲", p.x, p.y, "#9be37a", 34); fx.burst(p.x, p.y, "#3a8f3a", 20, 160); }
        Fun.sfx.crash();
        for (let k = 0; k < 2; k++) items.push({ kind: "log", x: tree.x + (Math.random() - 0.5) * 2, z: tree.z + (Math.random() - 0.5) * 2 });
      } else if (p) fx.pop("CHOP!", p.x, p.y, "#ffffff", 24);
    }
    function faint(){
      const st = S();
      st.sack = []; st.health = 60; st.hunger = Math.max(st.hunger, 40);
      me.x = 0; me.z = 5; me.yaw = Math.PI;
      kids.forEach(k => { if (k.state === "follow") { k.state = "lost"; k.x = k.home.x; k.z = k.home.z; } });
      hurt = 1; Fun.sfx.wah(); Fun.shake(canvas);
      fx.pop("😵 You fainted!", W / 2, H * 0.4, "#ff6b6b", 46);
      tip.show("You woke up by the fire, but you dropped everything in your sack", 4000);
      if (deer) { deer.gone = 15; }
      save();
    }

    /* ---------------- the crafting bench ---------------- */
    function openBench(){ benchEl.hidden = false; drawBench(); if (document.pointerLockElement === canvas) document.exitPointerLock(); }
    function drawBench(){
      const st = S();
      scrapEl.textContent = `⚙️ ${st.scrap} scrap`;
      benchList.innerHTML = UPGRADES.map(u => `<div class="nf-row${st.up[u.id] ? " nf-have" : ""}">
        <span class="nf-em">${u.icon}</span><span class="nf-name">${u.name}<small>${u.desc}</small></span>
        <button class="btn small" data-up="${u.id}" type="button" ${st.up[u.id] ? "disabled" : ""}>${st.up[u.id] ? "✓ Got it" : `⚙️ ${u.cost}`}</button></div>`).join("");
    }
    benchList.addEventListener("click", e => {
      const b = e.target.closest("[data-up]"); if (!b) return;
      const st = S(), u = UPGRADES.find(u => u.id === b.dataset.up);
      if (st.up[u.id]) return;
      if (st.scrap < u.cost) { Fun.sfx.nope(); b.textContent = `Need ${u.cost} ⚙️`; setTimeout(drawBench, 900); return; }
      st.scrap -= u.cost; st.up[u.id] = true; Fun.sfx.tada();
      fx.pop(`${u.icon} ${u.name}!`, W / 2, H * 0.35, "#ffe14d", 40);
      drawBench(); save();
    });
    $("nfBenchClose").addEventListener("click", () => { benchEl.hidden = true; canvas.focus(); });

    /* ---------------- each frame ---------------- */
    function step(dt){
      clock += dt;
      const st = S(), wasNight = night();
      st.t += dt;
      if (st.t >= DAY + NIGHT) { st.t -= DAY + NIGHT; dawn(); if (!running) return; }
      if (!wasNight && night()) startNight();
      // you
      const turn = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
      me.yaw += turn * 2.6 * dt;
      const fwd = (keys.up ? 1 : 0) - (keys.down ? 1 : 0), side = (keys.sright ? 1 : 0) - (keys.sleft ? 1 : 0);
      const speed = st.hunger > 0 ? 6.5 : 4.5;
      const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
      let vx = (sy * fwd + cy * side), vz = (cy * fwd - sy * side);
      const l = Math.hypot(vx, vz);
      me.moving = l > 0;
      if (l) { vx /= l; vz /= l; me.x += vx * speed * dt; me.z += vz * speed * dt; me.walk += dt * 10; }
      trees.forEach(t => { const dx = me.x - t.x, dz = me.z - t.z, d = Math.hypot(dx, dz), R = t.hp > 0 ? 0.75 : 0.5; if (d < R && d > 0) { me.x = t.x + dx / d * R; me.z = t.z + dz / d * R; } });
      { const d = Math.hypot(me.x, me.z); if (d > WORLD) { me.x *= WORLD / d; me.z *= WORLD / d; } if (d < 1.4 && d > 0) { me.x *= 1.4 / d; me.z *= 1.4 / d; } }
      me.swing = Math.max(0, me.swing - dt);
      trees.forEach(t => { t.shake = Math.max(0, t.shake - dt); });
      // the fire, food and the flashlight
      const safe = dist(me, FIRE) < fireR();
      st.fire = Math.max(0, st.fire - dt * (night() ? 1.0 : 0.55) * (st.up.pit ? 0.7 : 1));
      if (st.fire < 15 && Math.floor(clock * 0.2) !== Math.floor((clock - dt) * 0.2)) tip.show("🔥 The fire is going out! Bring logs (E at the fire)", 3500);
      st.hunger = Math.max(0, st.hunger - dt * 0.45);
      if (st.hunger <= 0) st.health -= dt * 2;
      else if (st.hunger > 50 && st.health < 100) st.health = Math.min(100, st.health + dt * (safe ? 2 : 0.6));
      if (light) { st.battery = Math.max(0, st.battery - dt * (st.up.light ? 3 : 5)); if (st.battery <= 0) { light = false; tip.show("🔋 Flashlight's empty! It charges by the fire", 3000); } }
      else st.battery = Math.min(100, st.battery + dt * (safe ? 12 : 1.5));
      // kids follow you home
      kids.forEach((k, i) => {
        if (k.state !== "follow") { k.moving = false; return; }
        const d = dist(k, me);
        if (d > 1.8) { const v = Math.min(d - 1.6, 6.8 * dt); k.x += (me.x - k.x) / d * v; k.z += (me.z - k.z) / d * v; k.yaw = Math.atan2(me.x - k.x, me.z - k.z); k.moving = true; k.walk += dt * 12; } else k.moving = false;
        if (dist(k, FIRE) < 5) {
          k.state = "safe"; st.kids.push(k.id);
          const a = i * 1.57 + 0.4; k.x = Math.cos(a) * 3; k.z = Math.sin(a) * 3; k.moving = false;
          fx.pop(`🎉 ${k.name} is safe!`, W / 2, H * 0.35, "#ffe14d", 42); fx.burst(W / 2, H * 0.35, "#ffe14d", 30, 220); Fun.sfx.tada();
          if (st.kids.length === 4) tip.show("🏆 You rescued all four kids!", 4000);
          save(); Hub.checkBadges();
        }
      });
      kids.forEach(k => { if (k.state === "safe") k.yaw = Math.atan2(-k.x, -k.z); });
      if (night()) nightThings(dt, safe);
      if (st.health <= 0) faint();
      hurt = Math.max(0, hurt - dt * 1.5);
      prompt = findPrompt();
      saveT += dt;
      if (saveT > 5) { saveT = 0; save(); }
    }
    function nightThings(dt, safe){
      const st = S(), R = fireR();
      // wolves: they chase you outside the light, but they're scared of the fire
      wolves.forEach(w => {
        w.cd = Math.max(0, w.cd - dt); w.hit = Math.max(0, w.hit - dt);
        const d = dist(w, me);
        let tx, tz, sp;
        if (d < 17 && !safe) { tx = me.x; tz = me.z; sp = 5.2; }
        else { w.wander += (Math.random() - 0.5) * dt * 2; tx = w.x + Math.sin(w.wander) * 5; tz = w.z + Math.cos(w.wander) * 5; sp = 2; }
        const dx = tx - w.x, dz = tz - w.z, l = Math.hypot(dx, dz);
        if (l > 0.5 && w.hit <= 0) { w.x += dx / l * sp * dt; w.z += dz / l * sp * dt; w.yaw = Math.atan2(dx, dz); w.walk += dt * sp * 2; }
        const fd = dist(w, FIRE);
        if (fd < R + 1) { w.x *= (R + 1) / fd; w.z *= (R + 1) / fd; }
        if (Math.hypot(w.x, w.z) > WORLD) { w.wander += Math.PI; }
        if (d < 1.4 && w.cd <= 0 && !safe) {
          w.cd = 1.2; st.health -= 10; hurt = 0.6; Fun.sfx.oof();
          fx.pop("CHOMP! 🐺", W / 2, H * 0.5, "#ff6b6b", 32);
        }
      });
      // the Deer: creeps up when you're out of the light, runs from the flashlight
      if (!deer) return;
      if (deer.gone > 0) {
        deer.gone -= dt;
        if (deer.gone <= 0) { const a = me.yaw + Math.PI + (Math.random() - 0.5); deer.x = me.x + Math.sin(a) * 30; deer.z = me.z + Math.cos(a) * 30; deer.stun = 0; }
        return;
      }
      const d = dist(deer, me);
      let tx = me.x, tz = me.z, sp = Math.min(5.4, 2.6 + st.night * 0.03);
      if (safe) {
        // waits just outside the light, watching you
        const a = Math.atan2(me.x, me.z) + Math.sin(clock * 0.3) * 0.6;
        tx = Math.sin(a) * (R + 6); tz = Math.cos(a) * (R + 6); sp = 2.2;
      }
      const dx = tx - deer.x, dz = tz - deer.z, l = Math.hypot(dx, dz);
      if (l > 0.3) { deer.x += dx / l * sp * dt; deer.z += dz / l * sp * dt; deer.yaw = Math.atan2(me.x - deer.x, me.z - deer.z); deer.walk += dt * sp; }
      const fd = dist(deer, FIRE);
      if (fd < R + 1.5) { deer.x *= (R + 1.5) / fd; deer.z *= (R + 1.5) / fd; }
      if (!safe && d < 12 && !deerWarned) { deerWarned = true; tip.show("🦌 THE DEER! Shine your flashlight at it (F) or run to the fire!", 4000); Fun.sfx.honk(); }
      if (d > 20) deerWarned = false;
      // shine the light right at it
      if (light && d < (st.up.light ? 22 : 18)) {
        const ang = Math.atan2(deer.x - me.x, deer.z - me.z), diff = Math.abs(((ang - me.yaw) % 6.283 + 9.425) % 6.283 - 3.1416);
        if (diff < (st.up.light ? 0.5 : 0.32)) {
          deer.stun += dt;
          if (deer.stun > (st.up.light ? 0.6 : 1.1)) {
            deer.gone = 25; st.deer++; Hub.checkBadges();
            const p = proj(deer.x, 3, deer.z);
            fx.pop("🦌 The Deer ran away!", p ? p.x : W / 2, p ? p.y : H * 0.4, "#ffe14d", 36); Fun.sfx.tada();
          }
        }
      } else deer.stun = Math.max(0, deer.stun - dt * 0.5);
      if (d < 2 && !safe) {
        st.health -= 30; hurt = 1; Fun.sfx.crash(); Fun.shake(canvas);
        fx.pop("😱 THE DEER GOT YOU!", W / 2, H * 0.4, "#ff4d4d", 40);
        const a = Math.random() * 6.283; deer.x = me.x + Math.sin(a) * 26; deer.z = me.z + Math.cos(a) * 26;
      }
    }
    let deerWarned = false;
    function save(){ Hub.saveStore(); }

    /* ---------------- the camera and drawing ---------------- */
    let cam = { x: 0, y: 0, z: 0, R: [1, 0, 0], U: [0, 1, 0], F: [0, 0, 1] };
    function placeCam(){
      const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
      const cx = me.x - sy * 7, cz = me.z - cy * 7, ch = 4.4;
      const tx = me.x + sy * 4, ty = 1.4, tz = me.z + cy * 4;
      let F = [tx - cx, ty - ch, tz - cz]; const l = Math.hypot(...F); F = F.map(v => v / l);
      const R = [cy, 0, -sy];
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
    // a pine tree: three green layers getting smaller; or a round tree: one big leafy block
    function drawTree(t){
      const sh = t.shake > 0 ? Math.sin(clock * 60) * 0.12 : 0;
      if (t.hp <= 0) { box(t.x, 0, t.z, 0.8, 0.5, 0.8, "#8a5a2b"); return; }
      box(t.x, 0, t.z, 0.6, t.h * 0.45, 0.6, "#6b4423");
      if (t.pine) {
        for (let k = 0; k < 3; k++) { const s = 2.8 - k * 0.8; box(t.x + sh, t.h * 0.35 + k * t.h * 0.22, t.z, s, t.h * 0.26, s, t.col); }
      } else box(t.x + sh, t.h * 0.4, t.z, 2.6, t.h * 0.55, 2.6, t.col);
    }
    function drawPerson(c, look, scale){
      const s = scale || 1, sw = c.moving ? Math.sin(c.walk) * 0.35 : 0;
      const sy = Math.sin(c.yaw), cy = Math.cos(c.yaw);
      const at = (lx, lz) => [c.x + (lx * cy + lz * sy) * s, c.z + (-lx * sy + lz * cy) * s];
      const chop = c.swing > 0 ? Math.sin((1 - c.swing / 0.35) * Math.PI) : 0;
      const parts = [
        { l: [-0.25, sw * 0.5], y: 0, w: 0.48, h: 1.0, d: 0.5, col: look.pants },
        { l: [0.25, -sw * 0.5], y: 0, w: 0.48, h: 1.0, d: 0.5, col: look.pants },
        { l: [0, 0], y: 1.0, w: 1.0, h: 1.0, d: 0.5, col: look.shirt },
        { l: [-0.72, -sw * 0.5], y: 1.05, w: 0.42, h: 0.95, d: 0.45, col: look.skin },
        { l: [0.72, sw * 0.5 + chop * 0.5], y: 1.05 + chop * 0.6, w: 0.42, h: 0.95, d: 0.45, col: look.skin },
        { l: [0, 0], y: 2.0, w: 0.62, h: 0.62, d: 0.62, col: look.skin, face: true }
      ];
      if (look.hat) parts.push({ l: [0, -0.05], y: 2.5, w: 0.7, h: 0.28, d: 0.7, col: look.hat });
      if (look.axe) parts.push({ l: [0.78, 0.35 + chop * 0.6], y: 1.2 + chop * 0.8, w: 0.14, h: 1.0, d: 0.14, col: "#a8743c" }, { l: [0.78, 0.55 + chop * 0.7], y: 1.9 + chop * 0.8, w: 0.12, h: 0.35, d: 0.4, col: "#c9ced6" });
      parts.map(p => { const [x, z] = at(...p.l); return { p, x, z, d: camSpace(x, (p.y + p.h / 2) * s, z)[2] }; })
        .sort((a, b) => b.d - a.d)
        .forEach(({ p, x, z }) => box(x, p.y * s, z, p.w * s, p.h * s, p.d * s, p.col, c.yaw, p.face ? (P, w, h, d) => drawFace(P, w, h, d, look.scared) : null));
    }
    function drawFace(P, w, h, d, scared){
      const pt = (u, v) => proj(...P(u * w / 2, v * h, d / 2 + 0.01));
      const e1 = pt(-0.38, 0.62), e2 = pt(0.38, 0.62), m = pt(0, 0.3);
      if (!e1 || !e2 || !m) return;
      const r = Math.max(1.2, Math.hypot(e2.x - e1.x, e2.y - e1.y) * 0.13);
      ctx.fillStyle = "#1b1b1b";
      ctx.beginPath(); ctx.ellipse(e1.x, e1.y, r * 0.75, r * 1.3, 0, 0, 7); ctx.ellipse(e2.x, e2.y, r * 0.75, r * 1.3, 0, 0, 7); ctx.fill();
      if (scared) { ctx.beginPath(); ctx.ellipse(m.x, m.y - r, r, r * 1.3, 0, 0, 7); ctx.fill(); return; }
      ctx.strokeStyle = "#1b1b1b"; ctx.lineWidth = Math.max(1, r * 0.6); ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(m.x, m.y - r * 2.2, r * 2.4, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); ctx.lineCap = "butt";
    }
    function drawWolf(w){
      const sy = Math.sin(w.yaw), cy = Math.cos(w.yaw), leg = Math.sin(w.walk) * 0.25;
      const at = (lx, lz) => [w.x + lx * cy + lz * sy, w.z - lx * sy + lz * cy];
      const col = w.hit > 0 ? "#ffffff" : "#6d727a";
      const parts = [
        [[-0.3, 0.5 + leg], 0, 0.22, 0.6, 0.22, "#4a4e55"], [[0.3, 0.5 - leg], 0, 0.22, 0.6, 0.22, "#4a4e55"],
        [[-0.3, -0.5 - leg], 0, 0.22, 0.6, 0.22, "#4a4e55"], [[0.3, -0.5 + leg], 0, 0.22, 0.6, 0.22, "#4a4e55"],
        [[0, 0], 0.55, 0.8, 0.6, 1.6, col], [[0, 1.0], 0.8, 0.6, 0.55, 0.6, col], [[0, 1.45], 0.8, 0.35, 0.3, 0.4, "#4a4e55"],
        [[-0.2, 1.0], 1.35, 0.14, 0.25, 0.14, col], [[0.2, 1.0], 1.35, 0.14, 0.25, 0.14, col], [[0, -0.95], 0.9, 0.18, 0.18, 0.6, col]
      ];
      parts.map(([l, y, pw, ph, pd, c]) => { const [x, z] = at(...l); return { x, z, y, pw, ph, pd, c, d: camSpace(x, y, z)[2] }; })
        .sort((a, b) => b.d - a.d).forEach(p => box(p.x, p.y, p.z, p.pw, p.ph, p.pd, p.c, w.yaw));
      [-0.15, 0.15].forEach(dx => { const [x, z] = at(dx, 1.31); const p = proj(x, 1.15, z); if (p) eyes.push({ x: p.x, y: p.y, r: Math.max(1.5, p.s * 0.05), c: "#ffe14d" }); });
    }
    // the Deer: very tall and thin, with big antlers and glowing red eyes
    function drawDeer(dr){
      const sy = Math.sin(dr.yaw), cy = Math.cos(dr.yaw), leg = Math.sin(dr.walk * 2) * 0.2;
      const at = (lx, lz) => [dr.x + lx * cy + lz * sy, dr.z - lx * sy + lz * cy];
      const col = dr.stun > 0 ? "#5a3f2a" : "#2e2018";
      const parts = [
        [[-0.25, 0.45 + leg], 0, 0.16, 2.2, 0.16], [[0.25, 0.45 - leg], 0, 0.16, 2.2, 0.16],
        [[-0.25, -0.45 - leg], 0, 0.16, 2.2, 0.16], [[0.25, -0.45 + leg], 0, 0.16, 2.2, 0.16],
        [[0, 0], 2.1, 0.7, 0.8, 1.4], [[0, 0.65], 2.7, 0.35, 1.5, 0.35], [[0, 0.8], 4.1, 0.5, 0.6, 0.7],
        [[-0.35, 0.75], 4.6, 0.08, 0.9, 0.08], [[0.35, 0.75], 4.6, 0.08, 0.9, 0.08],
        [[-0.6, 0.75], 5.2, 0.55, 0.08, 0.08], [[0.6, 0.75], 5.2, 0.55, 0.08, 0.08],
        [[-0.85, 0.75], 5.2, 0.08, 0.5, 0.08], [[0.85, 0.75], 5.2, 0.08, 0.5, 0.08]
      ];
      parts.map(([l, y, pw, ph, pd]) => { const [x, z] = at(...l); return { x, z, y, pw, ph, pd, d: camSpace(x, y, z)[2] }; })
        .sort((a, b) => b.d - a.d).forEach(p => box(p.x, p.y, p.z, p.pw, p.ph, p.pd, col, dr.yaw));
      [-0.13, 0.13].forEach(dx => { const [x, z] = at(dx, 1.16); const p = proj(x, 4.5, z); if (p) eyes.push({ x: p.x, y: p.y, r: Math.max(2, p.s * 0.07), c: "#ff2a2a" }); });
    }
    const EMOJI_FONT = `system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    function drawItem(it){
      const p = proj(it.x, 0, it.z);
      if (!p) return;
      if (it.kind === "log") { box(it.x, 0, it.z, 1.2, 0.35, 0.4, "#8a5a2b", it.x); return; }
      const bob = Math.sin(clock * 3 + it.x) * 0.1, q = proj(it.x, 0.15 + bob, it.z);
      if (!q) return;
      const px = Math.min(80, q.s * 0.7);
      ctx.font = `${px}px ${EMOJI_FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      ctx.fillText(ITEM[it.kind].em, q.x, q.y);
    }
    function drawCamp(){
      // stones round the fire
      for (let k = 0; k < 10; k++) { const a = k / 10 * 6.283; box(Math.cos(a) * 1.3, 0, Math.sin(a) * 1.3, 0.5, 0.35, 0.5, "#8a8f99", a); }
      box(0, 0, 0, 1.6, 0.3, 0.4, "#6b4423", 0.5); box(0, 0.1, 0, 1.6, 0.3, 0.4, "#6b4423", -0.7);
      const f = S().fire / 100, p = proj(0, 0.2, 0);
      if (p && f > 0) {
        const px = Math.min(260, p.s * (0.8 + f * 1.8) * (1 + Math.sin(clock * 9) * 0.06));
        ctx.font = `${px}px ${EMOJI_FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
        ctx.fillText("🔥", p.x, p.y + px * 0.1);
      }
      // the crafting bench
      box(BENCH.x, 0, BENCH.z, 2, 1, 1, "#a8743c", 0.4);
      const b = proj(BENCH.x, 1.2, BENCH.z);
      if (b) { ctx.font = `${Math.min(60, b.s * 0.7)}px ${EMOJI_FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("🔨", b.x, b.y); }
    }
    function drawTent(k){
      const x = k.home.x, z = k.home.z, a = Math.atan2(-x, -z);
      box(x - Math.sin(a) * 2, 0, z - Math.cos(a) * 2, 2.6, 1.6, 2.6, "#c8553d", a);
    }

    function draw(dt){
      placeCam();
      const st = S(), L = daylight();
      eyes = [];
      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.55);
      sky.addColorStop(0, L > 0.5 ? "#6aa9e0" : "#0b1230"); sky.addColorStop(1, L > 0.5 ? "#cfe3f0" : "#1e2a50");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      if (L < 0.5) {
        ctx.fillStyle = "#fff";
        for (let k = 0; k < 60; k++) { const x = ((k * 131 - me.yaw * 300) % W + W) % W, y = (k * 37) % (H * 0.4); ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(clock + k)); ctx.fillRect(x, y, 2, 2); }
        ctx.globalAlpha = 1;
        const mx = ((W * 0.75 - me.yaw * 300) % (W + 200) + W + 200) % (W + 200) - 100;
        ctx.fillStyle = "#f2f0e0"; ctx.beginPath(); ctx.arc(mx, 70, 28, 0, 7); ctx.fill();
      }
      path3([[me.x - 90, 0, me.z - 90], [me.x + 90, 0, me.z - 90], [me.x + 90, 0, me.z + 90], [me.x - 90, 0, me.z + 90]]); ctx.fillStyle = "#3f7a34"; ctx.fill();
      const ring = []; for (let k = 0; k < 20; k++) { const a = k / 20 * 6.283; ring.push([Math.cos(a) * 7, 0.01, Math.sin(a) * 7]); }
      path3(ring); ctx.fillStyle = "#7a6a45"; ctx.fill();
      // everything standing up, back to front (only what's near and in front of you)
      const things = [];
      const near = (x, z, r) => { const q = camSpace(x, 1, z); return q[2] > -r && q[2] < VIEW && Math.abs(q[0]) < q[2] * 1.1 + r + 2 ? q[2] : null; };
      trees.forEach(t => { const d = near(t.x, t.z, 3); if (d !== null) things.push({ d, f: () => drawTree(t) }); });
      items.forEach(it => { const d = near(it.x, it.z, 1); if (d !== null) things.push({ d: d - 0.2, f: () => drawItem(it) }); });
      kids.forEach(k => {
        if (k.state === "lost") { const d = near(k.home.x, k.home.z, 3); if (d !== null) things.push({ d: d + 1.5, f: () => drawTent(k) }); }
        const d = near(k.x, k.z, 1); if (d !== null) things.push({ d, f: () => drawPerson(k, { shirt: k.shirt, pants: "#3a3f55", skin: "#f5cd30", hat: k.hat, scared: k.state === "lost" }, 0.65) });
      });
      wolves.forEach(w => { const d = near(w.x, w.z, 2); if (d !== null) things.push({ d, f: () => drawWolf(w) }); });
      if (deer && deer.gone <= 0) { const d = near(deer.x, deer.z, 3); if (d !== null) things.push({ d, f: () => drawDeer(deer) }); }
      { const d = near(0, 0, 4); if (d !== null) things.push({ d, f: drawCamp }); }
      things.push({ d: camSpace(me.x, 1, me.z)[2], f: () => drawPerson(me, { shirt: "#1f6bff", pants: "#2fa84f", skin: "#f5cd30", hat: "#c8553d", axe: true }) });
      things.sort((a, b) => b.d - a.d).forEach(t => t.f());
      // fog in the distance
      const fog = ctx.createLinearGradient(0, H * 0.25, 0, H * 0.5);
      fog.addColorStop(0, L > 0.5 ? "rgba(207,227,240,0.55)" : "rgba(30,42,80,0.4)"); fog.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = fog; ctx.fillRect(0, H * 0.25, W, H * 0.25);
      drawDark(L);
      // glowing eyes show through the dark
      eyes.forEach(e => { ctx.fillStyle = e.c; ctx.shadowColor = e.c; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 7); ctx.fill(); });
      ctx.shadowBlur = 0;
      if (hurt > 0) { ctx.fillStyle = `rgba(200,0,0,${hurt * 0.35})`; ctx.fillRect(0, 0, W, H); }
      fx.draw(ctx, dt);
      drawHud();
    }
    // the night: darkness everywhere except the firelight and your flashlight
    function drawDark(L){
      const a = (1 - L) * 0.93;
      if (a <= 0.01) return;
      const k = 0.5, st = S();
      dctx.setTransform(1, 0, 0, 1, 0, 0);
      dctx.globalCompositeOperation = "source-over";
      dctx.clearRect(0, 0, dark.width, dark.height);
      dctx.fillStyle = `rgba(4,6,18,${a})`; dctx.fillRect(0, 0, dark.width, dark.height);
      dctx.globalCompositeOperation = "destination-out";
      const R = fireR(), f = proj(0, 0.5, 0);
      const cut = (x, y, rx, ry, soft) => {
        dctx.save(); dctx.translate(x * k, y * k); dctx.scale(1, ry / rx);
        const g = dctx.createRadialGradient(0, 0, 0, 0, 0, rx * k);
        g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(soft, "rgba(0,0,0,0.85)"); g.addColorStop(1, "rgba(0,0,0,0)");
        dctx.fillStyle = g; dctx.beginPath(); dctx.arc(0, 0, rx * k, 0, 7); dctx.fill(); dctx.restore();
      };
      if (f && st.fire > 0) {
        const edge = proj(R, 0, 0), e2 = proj(0, 0, R), e3 = proj(-R, 0, 0), e4 = proj(0, 0, -R);
        const pts = [edge, e2, e3, e4].filter(Boolean);
        const rx = pts.length ? Math.max(...pts.map(p => Math.abs(p.x - f.x))) : R * f.s, ry = pts.length ? Math.max(...pts.map(p => Math.abs(p.y - f.y))) : rx * 0.4;
        cut(f.x, f.y, Math.max(rx, f.s * R * 0.6) * 1.1, Math.max(ry, f.s * 2) * 1.3 + f.s * 2, 0.6);
      }
      const mp = proj(me.x, 1, me.z);
      if (mp) cut(mp.x, mp.y, mp.s * 2.4, mp.s * 2.4, 0.3);
      if (light && st.battery > 0) {
        const len = st.up.light ? 22 : 17, half = st.up.light ? 0.5 : 0.32, sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
        const o = proj(me.x + sy * 0.6, 1.4, me.z + cy * 0.6);
        // the beam lights the ground and anything standing in it, up to the Deer's head
        const fan = [-half, -half / 2, 0, half / 2, half];
        const ends = fan.map(t => proj(me.x + Math.sin(me.yaw + t) * len, 0.2, me.z + Math.cos(me.yaw + t) * len))
          .concat(fan.slice().reverse().map(t => proj(me.x + Math.sin(me.yaw + t) * len, 6, me.z + Math.cos(me.yaw + t) * len)));
        if (o && ends.every(Boolean)) {
          const g = dctx.createRadialGradient(o.x * k, o.y * k, 0, o.x * k, o.y * k, Math.max(...ends.map(e => Math.hypot(e.x - o.x, e.y - o.y))) * k);
          g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(0.7, "rgba(0,0,0,0.9)"); g.addColorStop(1, "rgba(0,0,0,0.2)");
          dctx.fillStyle = g; dctx.beginPath(); dctx.moveTo(o.x * k, o.y * k); ends.forEach(e => dctx.lineTo(e.x * k, e.y * k)); dctx.closePath(); dctx.fill();
        }
      }
      dctx.globalCompositeOperation = "source-over";
      ctx.drawImage(dark, 0, 0, W, H);
      // a warm glow round the fire
      if (f && st.fire > 0) { const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.s * R * 0.8); g.addColorStop(0, `rgba(255,140,40,${0.25 * (1 - L)})`); g.addColorStop(1, "rgba(255,140,40,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    }
    function bar(x, y, w, v, col, label){
      ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(x, y, w, 14);
      ctx.fillStyle = col; ctx.fillRect(x + 2, y + 2, Math.max(0, (w - 4) * v / 100), 10);
      ctx.fillStyle = "#fff"; ctx.font = "bold 12px system-ui"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(label, x + w + 6, y + 7);
    }
    function drawHud(){
      const st = S();
      ctx.fillStyle = "rgba(10,14,30,0.55)"; round(8, 8, 236, 112, 10); ctx.fill();
      bar(16, 16, 130, st.health, st.health < 30 ? "#ff4d4d" : "#6bd66b", "❤️ Health");
      bar(16, 36, 130, st.hunger, "#ffb347", "🍗 Hunger");
      bar(16, 56, 130, st.fire, "#ff7a1a", "🔥 Fire");
      bar(16, 76, 130, st.battery, "#ffe14d", light ? "🔦 ON" : "🔦 Light");
      ctx.font = "bold 13px system-ui"; ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText(`🧒 ${st.kids.length}/4 kids   ⚙️ ${st.scrap} scrap`, 16, 96);
      // the sack
      const n = capacity();
      ctx.fillStyle = "rgba(10,14,30,0.55)"; round(W - 18 - n * 30, 8, n * 30 + 10, 40, 10); ctx.fill();
      ctx.font = `20px ${EMOJI_FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (let i = 0; i < n; i++) {
        const x = W - 13 - n * 30 + i * 30 + 15;
        ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(x - 13, 14, 26, 28);
        if (st.sack[i]) { ctx.fillStyle = "#fff"; ctx.fillText(ITEM[st.sack[i]].em, x, 29); }
      }
      if (prompt) {
        ctx.font = "bold 18px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const w = ctx.measureText(prompt.text).width + 30;
        ctx.fillStyle = "rgba(10,14,30,0.7)"; round(W / 2 - w / 2, H - 58, w, 36, 10); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.fillText(prompt.text, W / 2, H - 40);
      }
      // where the fire is, if you can't see it
      const fp = camSpace(0, 0, 0);
      if (Math.hypot(me.x, me.z) > 14) {
        const ang = Math.atan2(fp[0], fp[2]);
        ctx.save(); ctx.translate(W / 2, 70); ctx.rotate(ang);
        ctx.fillStyle = "rgba(255,140,40,0.9)"; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(10, 6); ctx.lineTo(-10, 6); ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.font = "bold 12px system-ui"; ctx.fillStyle = "#ffcf9f"; ctx.textAlign = "center"; ctx.fillText(`🔥 ${Math.round(Math.hypot(me.x, me.z))}m`, W / 2, 96);
      }
    }
    function round(x, y, w, h, r){ ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function hud(){
      const st = S();
      nightEl.textContent = night() ? `🌙 Night ${st.night} / 99` : `☀️ Day ${st.night}`;
    }

    /* ---------------- the loop ---------------- */
    let scale = 1;
    function fit(){
      const s = Math.min(2, Math.max(1, canvas.clientWidth * (window.devicePixelRatio || 1) / W));
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
      Object.keys(keys).forEach(k => { keys[k] = false; });
      canvas.focus();
      tip.show("🪓 Chop trees (click or Space), grab the logs (E) and feed the fire!", 4500);
    }
    function pause(){
      if (!running) return;
      running = false; save();
      titleEl.textContent = "⏸ Paused";
      textEl.textContent = "Your mouse is free. The forest is waiting...";
      playBtn.textContent = "▶ Keep playing";
      panel.hidden = false;
    }
    function openGame(){
      open = true; running = false;
      overlay.hidden = false; document.body.style.overflow = "hidden";
      const st = S();
      build();
      if (night()) startNight();
      me.x = 0; me.z = 5; me.yaw = Math.PI; light = false; hurt = 0; prompt = null; benchEl.hidden = true;
      fx.clear();
      titleEl.textContent = "🌲 99 Nights";
      textEl.textContent = (st.night > 1 ? `Welcome back! Day ${st.night}. ` : "") +
        "Keep the campfire burning: chop trees and throw on logs. Find food. At night, stay in the light! If the Deer 🦌 comes, shine your flashlight at it. Find the 4 lost kids and survive 99 nights!";
      playBtn.textContent = "▶ Play";
      panel.hidden = false;
      last = performance.now();
      requestAnimationFrame(loop);
      playBtn.focus();
    }
    function closeGame(){
      if (open) save();
      open = false; running = false;
      overlay.hidden = true; document.body.style.overflow = "";
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    }

    /* ---------------- controls ---------------- */
    const KEYMAP = { KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", KeyA: "sleft", KeyD: "sright" };
    let unlockedAt = 0;
    const looking = () => document.pointerLockElement === canvas;
    function toggleLight(){
      if (!running) return;
      if (!light && S().battery <= 2) { fx.pop("🔋 Empty! Charge it by the fire", W / 2, H * 0.6, "#ff9f43", 26); Fun.sfx.nope(); return; }
      light = !light; Fun.sfx.beep();
    }
    window.addEventListener("keydown", e => {
      if (!open) return;
      if (e.key === "Escape") {
        if (!benchEl.hidden) { benchEl.hidden = true; return; }
        if (looking() || performance.now() - unlockedAt < 400) { if (looking()) document.exitPointerLock(); return; }
        if (running) { pause(); return; }
        Hub.leave(); return;
      }
      if (!running) return;
      if (e.code === "KeyE") { e.preventDefault(); if (!e.repeat) act(); return; }
      if (e.code === "KeyQ") { e.preventDefault(); if (!e.repeat) eat(); return; }
      if (e.code === "KeyF") { e.preventDefault(); if (!e.repeat) toggleLight(); return; }
      if (e.code === "Space") { e.preventDefault(); swing(); return; }
      if (e.code === "KeyP") { pause(); return; }
      const k = KEYMAP[e.code];
      if (!k) return;
      e.preventDefault(); keys[k] = true;
    });
    window.addEventListener("keyup", e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
    window.addEventListener("blur", () => Object.keys(keys).forEach(k => { keys[k] = false; }));
    document.addEventListener("pointerlockchange", () => {
      if (looking()) tip.show("🖱️ Press Esc to get your mouse back");
      else { unlockedAt = performance.now(); tip.hide(); }
    });
    let dragX = null;
    canvas.addEventListener("pointerdown", e => {
      if (!running) return;
      if (e.pointerType === "mouse") {
        if (!looking() && canvas.requestPointerLock) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) {} }
        else swing();
        return;
      }
      dragX = e.clientX; canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", e => {
      if (looking()) { if (running) me.yaw += e.movementX * 0.0032; return; }
      if (dragX === null || !running) return;
      me.yaw += (e.clientX - dragX) / canvas.clientWidth * 4; dragX = e.clientX;
    });
    ["pointerup", "pointercancel"].forEach(ev => canvas.addEventListener(ev, () => { dragX = null; }));
    canvas.addEventListener("contextmenu", e => e.preventDefault());
    host.querySelectorAll(".nf-touch [data-k]").forEach(btn => {
      const k = btn.dataset.k;
      btn.addEventListener("pointerdown", e => {
        e.preventDefault();
        if (k === "act") { act(); return; }
        if (k === "axe") { swing(); return; }
        if (k === "eat") { eat(); return; }
        if (k === "light") { toggleLight(); return; }
        keys[k] = true;
      });
      ["pointerup", "pointercancel", "pointerleave"].forEach(ev => btn.addEventListener(ev, () => { if (k in keys) keys[k] = false; }));
    });
    canvas.tabIndex = 0;
    $("nfCloseBtn").addEventListener("click", () => Hub.leave());
    Fun.soundButton($("nfCloseBtn"));
    playBtn.addEventListener("click", start);

    // for tests: peek at the forest
    window.__forest = {
      state: () => { const st = S(); return { night: st.night, t: st.t, isNight: night(), fire: st.fire, health: st.health, hunger: st.hunger, sack: st.sack.slice(), scrap: st.scrap, kids: st.kids.slice(), me: [me.x, me.z, me.yaw], prompt: prompt && prompt.kind, wolves: wolves.length, deer: deer && { x: deer.x, z: deer.z, gone: deer.gone }, trees: trees.length, light }; },
      put: (x, z, yaw) => { me.x = x; me.z = z; if (yaw !== undefined) me.yaw = yaw; },
      time: t => { const st = S(), was = night(); st.t = t; if (!was && night()) startNight(); },
      nearestTree: () => { let b = null; trees.forEach(t => { if (t.hp > 0 && (!b || dist(t, me) < dist(b, me))) b = t; }); return b && { x: b.x, z: b.z }; },
      kid: i => ({ x: kids[i].home.x, z: kids[i].home.z }), deerAt: (x, z) => { if (deer) { deer.x = x; deer.z = z; deer.gone = 0; } },
      act, swing, eat, toggleLight
    };

    return { open: openGame, close: closeGame };
  }
})();
