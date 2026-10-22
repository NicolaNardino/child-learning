/* Endless Tower: a game like "Build a Tower" on Roblox. A block slides back and forth on top of your tower:
   drop it at the right moment! Whatever hangs over the edge gets chopped off, and a PERFECT drop keeps
   the block whole. Every block in the tower makes money each second, the higher up the more it makes,
   and the money buys crates of better blocks (Stone, Brick, Gold, Diamond, Rainbow, Cosmic).
   The tower never ends: past the clouds, into space, the Moon, the galaxy and beyond.
   Rebirth for a bigger income forever, and after three rebirths a robot can build for you. */
(function(){
  "use strict";
  const store = Hub.store;
  const money = n => "$" + (n >= 1e9 ? (n / 1e9).toFixed(1) + "B" : n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + "M" : n >= 1e4 ? Math.round(n / 1e3) + "K" : Math.floor(n).toLocaleString("en"));
  const S = () => (store.tower = store.tower || { cash: 50, blocks: [], queue: [], rebirths: 0, best: 0, earned: 0, streakBest: 0, last: 0 });

  const BASE = 4;                     // the tower is 4 by 4 at the bottom
  const PERFECT = 0.2;                // closer than this and it snaps on perfectly
  const BLOCK = {
    dirt:    { name: "Dirt",    colour: "#9a6332", rate: 1,   rank: 0 },
    stone:   { name: "Stone",   colour: "#9aa3ad", rate: 3,   rank: 1 },
    brick:   { name: "Brick",   colour: "#c8553d", rate: 8,   rank: 2 },
    gold:    { name: "Gold",    colour: "#ffcc33", rate: 25,  rank: 3 },
    diamond: { name: "Diamond", colour: "#5fe3ff", rate: 80,  rank: 4 },
    rainbow: { name: "Rainbow", colour: "#ff6bd6", rate: 250, rank: 5, rainbow: true },
    cosmic:  { name: "Cosmic",  colour: "#5b2bd1", rate: 900, rank: 6 }
  };
  const CRATES = [
    { id: "wood",   icon: "📦", name: "Wood crate",   price: 50,    odds: { dirt: 45, stone: 38, brick: 15, gold: 2 } },
    { id: "gold",   icon: "🟨", name: "Gold crate",   price: 1500,  odds: { stone: 25, brick: 40, gold: 26, diamond: 8, rainbow: 1 } },
    { id: "galaxy", icon: "🌌", name: "Galaxy crate", price: 40000, odds: { gold: 35, diamond: 42, rainbow: 19, cosmic: 4 } }
  ];
  const WIDE_PRICE = 250;
  const ZONES = [
    { at: 0,   name: "Grasslands",  mult: 1,   sky: ["#58a8ff", "#cfe9ff"], things: ["🐦", "🦋", "🐝"] },
    { at: 20,  name: "Cloud Land",  mult: 1.5, sky: ["#7fb8ff", "#f4f9ff"], things: ["☁️", "✈️", "🎈", "🪁"] },
    { at: 50,  name: "Sky High",    mult: 2,   sky: ["#2f62d0", "#9fd0ff"], things: ["✈️", "🚁", "🦅", "🎈"] },
    { at: 100, name: "Space",       mult: 3,   sky: ["#05051a", "#1b1f4a"], things: ["🛰️", "🚀", "☄️", "👨‍🚀"], stars: true },
    { at: 200, name: "The Moon",    mult: 5,   sky: ["#000010", "#2a2a40"], things: ["🌕", "🛸", "👽", "🚀"], stars: true },
    { at: 400, name: "The Galaxy",  mult: 8,   sky: ["#14002a", "#4b1a7a"], things: ["🪐", "🌌", "⭐", "🛸"], stars: true },
    { at: 800, name: "The Void",    mult: 12,  sky: ["#000000", "#200020"], things: ["🌀", "👁️", "💫", "🌑"], stars: true }
  ];
  // past the Void it just keeps going, and the money keeps doubling
  function zoneAt(h){
    if (h >= 1600) {
      const lv = Math.floor((h - 800) / 800), hue = (lv * 67) % 360;
      return { at: 800 + lv * 800, name: `Beyond ${lv}`, mult: 12 * 2 ** lv, sky: [hsl(hue, 70, 6), hsl(hue, 70, 22)], things: ["🌀", "💫", "✨", "🌠"], stars: true };
    }
    for (let i = ZONES.length - 1; i >= 0; i--) if (h >= ZONES[i].at) return ZONES[i];
    return ZONES[0];
  }
  function hsl(h, s, l){
    s /= 100; l /= 100;
    const f = n => { const k = (n + h / 30) % 12, c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(c * 255).toString(16).padStart(2, "0"); };
    return "#" + f(0) + f(8) + f(4);
  }
  const rebirthAt = r => 50 * (r + 1);
  const multOf = r => 1 + r * 0.5;
  const blockIncome = (b, i) => BLOCK[b.r].rate * Math.max(0.25, b.w * b.d / (BASE * BASE)) * (b.p ? 1.5 : 1) * zoneAt(i).mult;

  Hub.register({
    id: "tower", section: "games", title: "Endless Tower", icon: "🏗️",
    blurb: "Like Build a Tower on Roblox: stack blocks to the sky, past the Moon and beyond. It never ends!",
    stat: () => S().best ? `Best ${S().best} high` : "",
    badges: [
      { id: "twClouds",  icon: "☁️", name: "Cloud Builder",  desc: "Build your tower up to Cloud Land",        test: () => S().best >= 20 },
      { id: "twSpace",   icon: "🚀", name: "Space Tower",    desc: "Build your tower all the way to space",     test: () => S().best >= 100 },
      { id: "twPerfect", icon: "🎯", name: "Perfect 10",     desc: "Drop 10 perfect blocks in a row",           test: () => S().streakBest >= 10 },
      { id: "twRebirth", icon: "🔁", name: "Tower Reborn",   desc: "Rebirth in Endless Tower",                  test: () => S().rebirths >= 1 }
    ],
    mount
  });

  function mount(host){
    host.innerHTML = `
    <section class="game-screen tw-screen" id="twOverlay" hidden aria-label="Endless Tower">
      <div class="game-box">
        <div class="game-hud">
          <h2>🏗️ Endless Tower</h2>
          <span class="mono game-stat tw-cash" id="twCash">$0</span>
          <span class="mono game-stat" id="twIncome">+$0/s</span>
          <span class="mono game-stat" id="twHeight">0 high</span>
          <button class="btn ghost small tw-rebirth" id="twRebirth" type="button" hidden>🔁 Rebirth</button>
          <button class="btn ghost small" id="twCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas class="tw-canvas" id="twCanvas" width="960" height="540"></canvas>
          <div class="game-panel tw-panel" id="twPanel">
            <div class="game-panel-title" id="twTitle">🏗️ Endless Tower</div>
            <div class="game-panel-text" id="twText"></div>
            <button class="btn" id="twPlayBtn" type="button">▶ Play</button>
          </div>
        </div>
        <div class="tw-shop">
          ${CRATES.map((c, i) => `<button class="btn ghost small" data-crate="${i}" type="button">${c.icon} ${money(c.price)}</button>`).join("")}
          <button class="btn ghost small" id="twWide" type="button">📏 Wide ${money(WIDE_PRICE)}</button>
          <button class="btn ghost small" id="twView" type="button">🔭 Look</button>
          <button class="btn ghost small" id="twAuto" type="button" hidden>🤖 Auto: off</button>
          <button class="btn tw-drop" id="twDrop" type="button">⬇ DROP</button>
        </div>
        <div class="game-help">Space, click or tap to drop the block · drag to look around · 1 2 3 buy crates · 4 wide block · V to look at the whole tower</div>
      </div>
    </section>`;
    const $ = id => document.getElementById(id);
    const overlay = $("twOverlay"), canvas = $("twCanvas"), ctx = canvas.getContext("2d");
    const panel = $("twPanel"), titleEl = $("twTitle"), textEl = $("twText"), playBtn = $("twPlayBtn");
    const cashEl = $("twCash"), incomeEl = $("twIncome"), heightEl = $("twHeight"), rebirthBtn = $("twRebirth");
    const autoBtn = $("twAuto"), viewBtn = $("twView");
    const W = 960, H = 540, FOC = 620, NEAR = 0.4;
    const fx = Fun.pops(), tip = Fun.hint(canvas.parentElement);

    let open = false, running = false, last = 0, clock = 0, saveT = 0;
    let mv = null, wait = 0, debris = [], streak = 0, income = 0;
    let camYaw = 0.6, camH = 7, far = false, auto = false;
    const me = { x: 0, y: 0, z: 0, from: null, hop: 1, cheer: 0, flail: 0 };

    /* ---------------- the tower ---------------- */
    const blocks = () => S().blocks;
    const top = () => { const b = blocks(); return b.length ? b[b.length - 1] : { x: 0, z: 0, w: BASE, d: BASE }; };
    function recount(){
      income = blocks().reduce((a, b, i) => a + blockIncome(b, i), 0) * multOf(S().rebirths);
    }
    function nextKind(){
      const q = S().queue;
      return q.length ? q[0] : "dirt";
    }
    // a new block appears at the edge and starts sliding over the top of the tower
    function spawn(){
      const n = blocks().length, t = top(), along = n % 2 ? "z" : "x", kind = nextKind();
      const wide = kind === "wide";
      const r = wide ? (S().queue[1] && S().queue[1] !== "wide" ? S().queue[1] : "dirt") : kind;
      mv = { along, x: t.x, z: t.z, y: n, w: wide ? BASE : t.w, d: wide ? BASE : t.d, r, wide, s: -7, dir: 1,
        speed: Math.min(9, 3.6 + n * 0.025) };
      mv[along] = (along === "x" ? t.x : t.z) - 7;
      me.from = { x: me.x, y: me.y, z: me.z }; me.hop = 0;
    }
    function drop(){
      if (!running || !mv || wait > 0) return;
      const st = S(), t = top(), a = mv.along, size = a === "x" ? t.w : t.d;
      const off = mv[a] - (a === "x" ? t.x : t.z);
      const at = proj(mv.x, mv.y + 1, mv.z) || { x: W / 2, y: H / 2 };
      // use up the block from the queue (a wide block uses itself and the block it carries)
      if (st.queue.length) { if (mv.wide) { st.queue.shift(); if (st.queue[0] && st.queue[0] !== "wide") st.queue.shift(); } else st.queue.shift(); }
      const piece = { x: mv.x, z: mv.z, w: mv.w, d: mv.d, r: mv.r };
      // a wide block only needs to touch the top; a normal one has to overlap it
      const reach = mv.wide ? (size + BASE) / 2 : size;
      if (Math.abs(off) >= reach) {
        // missed the tower completely
        debris.push({ ...piece, y: mv.y, vy: 0, vx: (a === "x" ? Math.sign(off) : 0) * 2, vz: (a === "z" ? Math.sign(off) : 0) * 2, spin: 0, life: 4 });
        fx.pop(["WHOOPS!", "MISSED! 😵", "NOOO!", "Oh no!"][Math.floor(Math.random() * 4)], at.x, at.y, "#ff6b6b", 40);
        Fun.sfx.wah(); Fun.shake(canvas);
        streak = 0; me.flail = 1; mv = null; wait = 0.45;
        return;
      }
      let perfect = false;
      if (mv.wide) {
        // a wide block is a whole new floor: it doesn't get chopped
        fx.pop("NEW FLOOR! 📏", at.x, at.y, "#7fe3ff", 36); Fun.sfx.thunk();
      } else if (Math.abs(off) <= PERFECT) {
        perfect = true; streak++;
        piece[a] = a === "x" ? t.x : t.z;
        if (streak >= 3 && size < BASE) {
          const grow = Math.min(BASE - size, 0.3);
          if (a === "x") piece.w += grow; else piece.d += grow;
        }
        st.streakBest = Math.max(st.streakBest || 0, streak);
        const words = streak >= 10 ? "UNSTOPPABLE!" : streak >= 5 ? "ON FIRE! 🔥" : streak >= 3 ? "GROWING! ↔" : "PERFECT!";
        fx.pop(`${words}${streak > 1 ? " ×" + streak : ""}`, at.x, at.y, "#ffe14d", 34 + Math.min(16, streak * 2));
        fx.burst(at.x, at.y, "#ffe14d", 20, 180);
        Fun.sfx.ding(); me.cheer = 1;
      } else {
        // chop off the bit that hangs over the edge, and let it fall
        const keep = size - Math.abs(off), cut = Math.abs(off), sgn = Math.sign(off);
        const keepC = (a === "x" ? t.x : t.z) + off / 2;
        if (a === "x") piece.w = keep; else piece.d = keep;
        piece[a] = keepC;
        const chunk = { ...piece, r: mv.r, y: mv.y, vy: 0, vx: 0, vz: 0, spin: 0, life: 4 };
        if (a === "x") { chunk.w = cut; chunk.x = keepC + sgn * (keep / 2 + cut / 2); chunk.vx = sgn * 1.5; }
        else { chunk.d = cut; chunk.z = keepC + sgn * (keep / 2 + cut / 2); chunk.vz = sgn * 1.5; }
        debris.push(chunk);
        streak = 0;
        Fun.sfx.thunk();
        if (keep < 1.2) fx.pop("Wobbly! Get a 📏 Wide block!", at.x, at.y, "#ff9f43", 26);
        else if (cut < 0.6) fx.pop(["Nice!", "Close!", "Good!"][Math.floor(Math.random() * 3)], at.x, at.y, "#ffffff", 28);
        else fx.pop("CHOP! 🪓", at.x, at.y, "#ff9f43", 30);
      }
      piece.p = perfect ? 1 : 0;
      piece.w = Math.round(piece.w * 1000) / 1000; piece.d = Math.round(piece.d * 1000) / 1000;
      piece.x = Math.round(piece.x * 1000) / 1000; piece.z = Math.round(piece.z * 1000) / 1000;
      blocks().push(piece);
      const h = blocks().length;
      if (BLOCK[piece.r].rank >= 3) { fx.pop(`${BLOCK[piece.r].name}! +${money(blockIncome(piece, h - 1) * multOf(st.rebirths))}/s`, at.x, at.y + 44, BLOCK[piece.r].colour, 24); }
      if (h > st.best) st.best = h;
      const z0 = zoneAt(h - 1), z1 = zoneAt(h);
      if (z1.name !== z0.name) {
        fx.pop(`${z1.name.toUpperCase()}!`, W / 2, H * 0.3, "#ffffff", 50);
        tip.show(`🌟 ${z1.name}! Blocks up here make ×${z1.mult} money`, 3500);
        Fun.sfx.tada(); fx.burst(W / 2, H * 0.3, "#ffffff", 30, 240);
      }
      if (h % 25 === 0) { st.queue.unshift("wide"); tip.show(`🏁 ${h} high! Here's a free wide block`, 3000); }
      if (h === rebirthAt(st.rebirths)) tip.show("🔁 You can rebirth now! Your money grows faster forever", 4000);
      recount(); Hub.checkBadges();
      me.from = null;
      mv = null; wait = 0.3;
    }

    /* ---------------- the shop ---------------- */
    function roll(odds){
      let w = Math.random() * Object.values(odds).reduce((a, b) => a + b, 0);
      for (const k in odds) { w -= odds[k]; if (w <= 0) return k; }
      return Object.keys(odds)[0];
    }
    function buyCrate(i){
      const st = S(), c = CRATES[i];
      if (!running) return;
      if (st.cash < c.price) { fx.pop(`Need ${money(c.price)}!`, W / 2, H * 0.55, "#ff6b6b", 30); Fun.sfx.nope(); return; }
      st.cash -= c.price;
      const got = [0, 1, 2, 3, 4].map(() => roll(c.odds)).sort((a, b) => BLOCK[b].rank - BLOCK[a].rank);
      // the best ones go first, after a wide block if one is waiting
      const q = st.queue;
      st.queue = q[0] === "wide" ? ["wide", ...got, ...q.slice(1)] : [...got, ...q];
      const best = got[0];
      const counts = {}; got.forEach(k => { counts[k] = (counts[k] || 0) + 1; });
      fx.pop(`${c.icon} ` + Object.entries(counts).map(([k, n]) => `${n} ${BLOCK[k].name}`).join(", "), W / 2, H * 0.62, "#ffffff", 26);
      if (BLOCK[best].rank >= 4) { fx.pop(`WOW! ${BLOCK[best].name.toUpperCase()}!`, W / 2, H * 0.45, BLOCK[best].colour, 46); fx.burst(W / 2, H * 0.45, BLOCK[best].colour, 34, 260); Fun.sfx.tada(); }
      else Fun.sfx.coin();
      if (mv && !mv.wide && st.queue[0] !== "wide") mv.r = nextKind();
      save();
    }
    function buyWide(){
      const st = S();
      if (!running) return;
      if (st.cash < WIDE_PRICE) { fx.pop(`Need ${money(WIDE_PRICE)}!`, W / 2, H * 0.55, "#ff6b6b", 30); Fun.sfx.nope(); return; }
      st.cash -= WIDE_PRICE; st.queue.unshift("wide");
      fx.pop("📏 Wide block next!", W / 2, H * 0.55, "#7fe3ff", 30); Fun.sfx.coin();
      if (mv) { const keep = mv[mv.along]; spawn(); mv[mv.along] = keep; me.hop = 1; }
      save();
    }

    /* ---------------- each frame ---------------- */
    function step(dt){
      clock += dt;
      const st = S();
      st.cash += income * dt; st.earned += income * dt;
      if (wait > 0) { wait -= dt; if (wait <= 0) spawn(); }
      if (mv) {
        const a = mv.along, t = top(), c = a === "x" ? t.x : t.z;
        mv[a] += mv.dir * mv.speed * dt;
        if (mv[a] > c + 7) { mv[a] = c + 7; mv.dir = -1; }
        if (mv[a] < c - 7) { mv[a] = c - 7; mv.dir = 1; }
        if (auto && Math.abs(mv[a] - c) < 0.15 && clock - autoT > 0.4) { autoT = clock; drop(); }
      }
      // you ride on the sliding block, and hop on to the next one
      const tx = mv ? mv.x : top().x, tz = mv ? mv.z : top().z, ty = mv ? mv.y + 1 : blocks().length;
      if (me.from && me.hop < 1) {
        me.hop = Math.min(1, me.hop + dt * 3.2);
        const k = me.hop;
        me.x = me.from.x + (tx - me.from.x) * k; me.z = me.from.z + (tz - me.from.z) * k;
        me.y = me.from.y + (ty - me.from.y) * k + Math.sin(k * Math.PI) * 1.2;
      } else { me.x = tx; me.z = tz; me.y = ty; }
      me.cheer = Math.max(0, me.cheer - dt * 1.2); me.flail = Math.max(0, me.flail - dt);
      for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i];
        d.vy -= 18 * dt; d.y += d.vy * dt; d.x += d.vx * dt; d.z += d.vz * dt; d.spin += dt * 3; d.life -= dt;
        if (d.life <= 0 || d.y < -5) debris.splice(i, 1);
      }
      if (!dragging) camYaw += dt * 0.12;
      saveT += dt;
      if (saveT > 4) { saveT = 0; save(); }
    }
    let autoT = 0;
    function save(){ S().last = Date.now(); Hub.saveStore(); }

    /* ---------------- the camera and drawing ---------------- */
    let cam = { x: 0, y: 0, z: 0, R: [1, 0, 0], U: [0, 1, 0], F: [0, 0, 1] };
    let viewY = 0, viewD = 14;
    function placeCam(dt){
      const n = blocks().length;
      const wantY = far ? n * 0.5 : n, wantD = far ? Math.max(16, n * 1.25 + 8) : 14;
      viewY += (wantY - viewY) * Math.min(1, dt * 4); viewD += (wantD - viewD) * Math.min(1, dt * 3);
      const sy = Math.sin(camYaw), cy = Math.cos(camYaw);
      const cx = -sy * viewD, cz = -cy * viewD, ch = viewY + camH * viewD / 14;
      let F = [0 - cx, viewY - 1.5 - ch, 0 - cz]; const l = Math.hypot(...F); F = F.map(v => v / l);
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
        if (shadeCache.size > 4000) shadeCache.clear();
        const n = parseInt(hex.slice(1), 16), c = v => Math.min(255, Math.round(v * f));
        shadeCache.set(key, `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`);
      }
      return shadeCache.get(key);
    }
    // a box, only the faces that face the camera; deco(face, P) adds a pattern to a face
    function box(cx, y0, cz, w, h, d, colour, yaw, deco){
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
        const pts = f.q.map(([i, j, k]) => P(X[i], Y[j], Z[k]));
        if (!path3(pts)) return;
        ctx.fillStyle = shade(colour, f.l); ctx.fill();
        ctx.strokeStyle = shade(colour, f.l * 0.72); ctx.lineWidth = 1; ctx.stroke();
        if (deco) deco(f, pts, P, w, h, d);
      });
    }
    const colourOf = (r, i) => BLOCK[r].rainbow ? hsl((i * 40 + clock * 90) % 360, 85, 62) : BLOCK[r].colour;
    // patterns on the sides so the blocks look like what they are
    function decoFor(r, i, perfect){
      return (f, pts) => {
        if (f.n[1] && r !== "cosmic") return;
        const sp = pts.map(p => proj(...p));
        if (sp.some(p => !p)) return;
        const lerp = (u, v) => { const a = sp[0], b = sp[1], c = sp[2], d = sp[3];
          const x1 = a.x + (b.x - a.x) * u, y1 = a.y + (b.y - a.y) * u, x2 = d.x + (c.x - d.x) * u, y2 = d.y + (c.y - d.y) * u;
          return [x1 + (x2 - x1) * v, y1 + (y2 - y1) * v]; };
        ctx.save();
        if (r === "brick") {
          ctx.strokeStyle = "rgba(255,235,210,0.55)"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(...lerp(0, 0.5)); ctx.lineTo(...lerp(1, 0.5));
          for (let u = 0.25; u < 1; u += 0.5) { ctx.moveTo(...lerp(u, 0)); ctx.lineTo(...lerp(u, 0.5)); }
          for (let u = 0.5; u < 1; u += 0.5) { ctx.moveTo(...lerp(u, 0.5)); ctx.lineTo(...lerp(u, 1)); }
          ctx.stroke();
        } else if (r === "dirt") {
          ctx.fillStyle = "#5fbf3a"; ctx.beginPath(); ctx.moveTo(...lerp(0, 1)); ctx.lineTo(...lerp(1, 1)); ctx.lineTo(...lerp(1, 0.78)); ctx.lineTo(...lerp(0, 0.78)); ctx.fill();
        } else if (r === "stone") {
          ctx.fillStyle = "rgba(60,64,72,0.35)";
          [[0.2, 0.3], [0.65, 0.6], [0.45, 0.2], [0.8, 0.25]].forEach(([u, v]) => { const [x, y] = lerp(u, v); ctx.fillRect(x - 2, y - 2, 4, 3); });
        } else if (r === "gold" || r === "diamond") {
          const k = (clock * 0.6 + i * 0.37) % 1.6;
          if (k < 1) { ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(...lerp(k, 0)); ctx.lineTo(...lerp(Math.max(0, k - 0.25), 1)); ctx.stroke(); }
        } else if (r === "cosmic") {
          ctx.fillStyle = "#ffffff";
          for (let s = 0; s < 4; s++) { const u = ((s * 0.37 + i * 0.13) % 1), v = ((s * 0.61 + i * 0.29) % 1), tw = 0.5 + 0.5 * Math.sin(clock * 4 + s + i); const [x, y] = lerp(u, v); ctx.globalAlpha = tw; ctx.fillRect(x - 1, y - 1, 2.5, 2.5); }
        }
        if (perfect && !f.n[1]) { ctx.globalAlpha = 1; ctx.strokeStyle = "rgba(255,240,120,0.9)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(...lerp(0, 1)); ctx.lineTo(...lerp(1, 1)); ctx.stroke(); }
        ctx.restore();
      };
    }
    function drawBlock(b, y, i){ box(b.x, y, b.z, b.w, 1, b.d, colourOf(b.r, i), 0, decoFor(b.r, i, b.p)); }

    // you: a blocky Roblox-style builder
    function drawMe(){
      const yaw = camYaw + Math.PI;  // face the camera
      const sy = Math.sin(yaw), cy = Math.cos(yaw);
      const at = (lx, lz) => [me.x + lx * cy + lz * sy, me.z - lx * sy + lz * cy];
      const y = me.y, s = 0.55;
      const up = me.cheer > 0 || me.flail > 0, wave = me.flail > 0 ? Math.sin(clock * 30) * 0.3 : 0;
      const parts = [
        { l: [-0.25 * s, 0], y: 0, w: 0.48, h: 1.0, col: "#2fa84f" },
        { l: [0.25 * s, 0], y: 0, w: 0.48, h: 1.0, col: "#2fa84f" },
        { l: [0, 0], y: 1.0, w: 1.0, h: 1.0, col: "#ff7a1a" },
        { l: [-0.72 * s, 0], y: up ? 1.6 + wave : 1.05, w: 0.42, h: up ? 1.0 : 0.95, col: "#f5cd30" },
        { l: [0.72 * s, 0], y: up ? 1.6 - wave : 1.05, w: 0.42, h: up ? 1.0 : 0.95, col: "#f5cd30" },
        { l: [0, 0], y: 2.0, w: 0.62, h: 0.62, col: "#f5cd30", face: true },
        { l: [0, -0.03], y: 2.55, w: 0.72, h: 0.22, col: "#ffcc00" }   // a builder's hard hat
      ];
      parts.map(p => { const [x, z] = at(...p.l); return { p, x, z, d: camSpace(x, y + (p.y + p.h / 2) * s, z)[2] }; })
        .sort((a, b) => b.d - a.d)
        .forEach(({ p, x, z }) => box(x, y + p.y * s, z, p.w * s, p.h * s, 0.5 * s, p.col, yaw, p.face ? drawFace : null));
    }
    function drawFace(f, pts, P, w, h, d){
      if (!f.front) return;
      const pt = (u, v) => proj(...P(u * w / 2, v * h, d / 2 + 0.01));
      const e1 = pt(-0.38, 0.62), e2 = pt(0.38, 0.62), m = pt(0, 0.3);
      if (!e1 || !e2 || !m) return;
      const r = Math.max(1.2, Math.hypot(e2.x - e1.x, e2.y - e1.y) * 0.13);
      ctx.fillStyle = "#1b1b1b";
      ctx.beginPath(); ctx.ellipse(e1.x, e1.y, r * 0.75, r * 1.3, 0, 0, 7); ctx.ellipse(e2.x, e2.y, r * 0.75, r * 1.3, 0, 0, 7); ctx.fill();
      if (me.flail > 0) { ctx.beginPath(); ctx.ellipse(m.x, m.y - r, r * 1.2, r * 1.6, 0, 0, 7); ctx.fill(); return; }
      ctx.strokeStyle = "#1b1b1b"; ctx.lineWidth = Math.max(1, r * 0.6); ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(m.x, m.y - r * 2.2, r * 2.4, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); ctx.lineCap = "butt";
    }

    // things flying past: birds low down, planes in the clouds, rockets in space
    function flyers(){
      const out = [], mid = Math.floor(viewY / 5);
      for (let b = mid - 4; b <= mid + 3; b++) {
        if (b < 1) continue;
        const rnd = k => { const v = Math.sin(b * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
        const y = b * 5 + rnd(1) * 5, z = zoneAt(Math.max(0, Math.round(y))), things = z.things;
        const ang = rnd(2) * 6.283 + clock * (0.12 + rnd(3) * 0.2) * (rnd(4) > 0.5 ? 1 : -1), rad = 9 + rnd(5) * 9;
        out.push({ em: things[Math.floor(rnd(6) * things.length)], x: Math.sin(ang) * rad, y, z: Math.cos(ang) * rad, size: 1.2 + rnd(7) });
      }
      return out;
    }
    function drawFlyer(f){
      const p = proj(f.x, f.y, f.z);
      if (!p || p.s < 4) return;
      ctx.font = `${Math.min(140, f.size * p.s)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(f.em, p.x, p.y);
    }
    const TREES = [[-9, -6], [8, -9], [-11, 7], [10, 6], [2, 12], [-4, -12], [13, -2]];

    function draw(dt){
      placeCam(dt);
      const n = blocks().length, z = zoneAt(Math.round(viewY));
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, z.sky[0]); sky.addColorStop(1, z.sky[1]);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      if (z.stars) {
        for (let k = 0; k < 90; k++) {
          const x = ((k * 97 - camYaw * 300) % W + W) % W, y = (k * 53) % H, tw = 0.4 + 0.6 * Math.abs(Math.sin(clock * 2 + k));
          ctx.fillStyle = `rgba(255,255,255,${tw})`; ctx.fillRect(x, y, 2, 2);
        }
      }
      if (z.name === "The Moon") { ctx.fillStyle = "#e9e6d8"; ctx.beginPath(); ctx.arc(W * 0.8, H * 0.22, 60, 0, 7); ctx.fill(); ctx.fillStyle = "#cfcabb"; [[-18, -10, 12], [20, 14, 9], [6, -26, 6]].forEach(([a, b, r]) => { ctx.beginPath(); ctx.arc(W * 0.8 + a, H * 0.22 + b, r, 0, 7); ctx.fill(); }); }
      if (z.at < 100) {
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        for (let k = 0; k < 6; k++) {
          const x = ((k * 210 - camYaw * 240) % (W + 300) + W + 300) % (W + 300) - 150, y = 60 + (k * 47) % 120;
          ctx.beginPath(); ctx.arc(x, y, 26, 0, 7); ctx.arc(x + 28, y + 6, 20, 0, 7); ctx.arc(x - 26, y + 8, 18, 0, 7); ctx.fill();
        }
      }
      // the ground, if we can see it
      const lo = Math.max(0, n - (far ? 400 : 40));
      if (lo === 0) {
        path3([[-60, 0, -60], [60, 0, -60], [60, 0, 60], [-60, 0, 60]]); ctx.fillStyle = "#6cc04a"; ctx.fill();
        path3([[-3.2, 0.01, -3.2], [3.2, 0.01, -3.2], [3.2, 0.01, 3.2], [-3.2, 0.01, 3.2]]); ctx.fillStyle = "#8a8f99"; ctx.fill();
      }
      const centre = camSpace(0, viewY, 0)[2];
      const things = [];
      if (lo === 0) TREES.forEach(([x, zz]) => things.push({ d: camSpace(x, 1.5, zz)[2], f: () => { box(x, 0, zz, 0.6, 1.6, 0.6, "#8a5a2b"); box(x, 1.6, zz, 2.2, 1.8, 2.2, "#3f9e3a"); } }));
      flyers().forEach(f => things.push({ d: camSpace(f.x, f.y, f.z)[2], f: () => drawFlyer(f) }));
      debris.forEach((d, i) => things.push({ d: camSpace(d.x, d.y, d.z)[2], f: () => box(d.x, d.y, d.z, d.w, 1, d.d, colourOf(d.r, i), d.spin) }));
      things.sort((a, b) => b.d - a.d);
      // behind the tower first, then the tower from the bottom up, then what's in front
      things.filter(t => t.d >= centre).forEach(t => t.f());
      const bl = blocks(), step = far && n - lo > 150 ? Math.ceil((n - lo) / 150) : 1;
      for (let i = lo; i < n; i += (i < n - 40 ? step : 1)) drawBlock(bl[i], i, i);
      if (mv) {
        const kind = mv.wide ? "wide" : mv.r;
        drawBlock({ x: mv.x, z: mv.z, w: mv.w, d: mv.d, r: mv.r }, mv.y, n);
        if (kind === "wide") { const p = proj(mv.x, mv.y + 0.5, mv.z); if (p) { ctx.font = `${Math.min(40, p.s * 0.6)}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("📏", p.x, p.y); } }
      }
      drawMe();
      things.filter(t => t.d < centre).forEach(t => t.f());

      fx.draw(ctx, dt);
      // what's coming next
      const q = S().queue.slice(0, 6);
      ctx.fillStyle = "rgba(10,20,45,0.55)"; roundRect(10, 10, 270, 58, 10); ctx.fill();
      ctx.font = "bold 14px system-ui"; ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText(q.length ? "Next blocks:" : "Next: Dirt (free) · buy crates!", 20, 16);
      q.forEach((k, j) => {
        const x = 20 + j * 32, y = 38;
        ctx.fillStyle = k === "wide" ? "#7fe3ff" : colourOf(k, j); ctx.fillRect(x, y, 24, 22);
        ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.strokeRect(x, y, 24, 22);
        if (k === "wide") { ctx.font = "14px system-ui"; ctx.fillText("📏", x + 3, y + 3); ctx.font = "bold 14px system-ui"; }
      });
      ctx.fillStyle = "rgba(10,20,45,0.55)"; roundRect(W - 230, 10, 220, 58, 10); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.textAlign = "right"; ctx.font = "bold 16px system-ui";
      ctx.fillText(`${zoneAt(n).name}  ×${zoneAt(n).mult}`, W - 20, 16);
      ctx.font = "14px system-ui";
      const nxt = ZONES.find(zz => zz.at > n);
      ctx.fillText(nxt ? `${nxt.at - n} more to ${nxt.name}` : `Streak: ${streak} 🎯`, W - 20, 42);
      if (streak >= 2) { ctx.textAlign = "center"; ctx.font = "bold 22px system-ui"; ctx.fillStyle = "#ffe14d"; ctx.fillText(`🎯 Perfect ×${streak}`, W / 2, 16); }
    }
    function roundRect(x, y, w, h, r){ ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

    function hud(){
      const st = S(), n = blocks().length;
      cashEl.textContent = money(st.cash);
      incomeEl.textContent = `+${money(income)}/s` + (st.rebirths ? ` · 🔁×${st.rebirths}` : "");
      heightEl.textContent = `🏗️ ${n} high`;
      rebirthBtn.hidden = n < rebirthAt(st.rebirths);
      autoBtn.hidden = st.rebirths < 3;
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
      const dt = Fun.dt(now, last);
      last = now;
      if (running) step(dt); else clock += dt;
      fit();
      draw(dt);
      hud();
      requestAnimationFrame(loop);
    }
    function start(){
      running = true; panel.hidden = true;
      if (!mv && wait <= 0) spawn();
      canvas.focus();
      tip.show("⬇ Drop the block right on top! Space, click or tap", 4000);
    }
    function pause(){
      if (!running) return;
      running = false; save();
      titleEl.textContent = "⏸ Paused";
      textEl.textContent = "Take a break! Your tower is waiting.";
      playBtn.textContent = "▶ Keep building";
      panel.hidden = false; playBtn.focus();
    }
    function openGame(){
      open = true; running = false;
      Fun.screen(overlay, true);
      const st = S();
      recount(); fx.clear(); debris = []; mv = null; wait = 0; streak = 0; far = false;
      viewY = blocks().length; viewD = 14;
      me.from = null; me.x = top().x; me.z = top().z; me.y = blocks().length;
      // money made while you were away (half speed, up to two hours)
      let away = "";
      if (st.last && income > 0) {
        const secs = Math.min(7200, (Date.now() - st.last) / 1000);
        if (secs > 60) { const got = income * secs * 0.5; st.cash += got; st.earned += got; away = ` While you were away your tower made ${money(got)}! 💰`; }
      }
      titleEl.textContent = "🏗️ Endless Tower";
      textEl.textContent = (blocks().length ? `Your tower is ${blocks().length} high.` : "Build a tower that never ends!") +
        " Drop each block right on top. Over the edge? CHOP! Every block makes money. Buy crates for Gold, Diamond and Cosmic blocks, and build past the clouds, to space and beyond! 🚀" + away;
      playBtn.textContent = "▶ Build!";
      panel.hidden = false;
      last = performance.now();
      requestAnimationFrame(loop);
      playBtn.focus();
    }
    function closeGame(){
      if (open) save();
      open = false; running = false;
      Fun.screen(overlay, false);
    }

    /* ---------------- controls ---------------- */
    window.addEventListener("keydown", e => {
      if (!open) return;
      if (e.key === "Escape") { if (running) pause(); else Hub.leave(); return; }
      if (!running) return;
      if (e.code === "Space" || e.code === "Enter" || e.code === "ArrowDown") { e.preventDefault(); if (!e.repeat) drop(); return; }
      if (e.code === "Digit1" || e.code === "Digit2" || e.code === "Digit3") { buyCrate(+e.code.slice(5) - 1); return; }
      if (e.code === "Digit4") { buyWide(); return; }
      if (e.code === "KeyV") { toggleView(); return; }
      if (e.code === "KeyP") { pause(); return; }
    });
    let dragging = false, dragX = 0, dragged = 0;
    canvas.addEventListener("pointerdown", e => {
      if (!running) return;
      dragging = true; dragX = e.clientX; dragged = 0;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", e => {
      if (!dragging) return;
      const dx = e.clientX - dragX; dragX = e.clientX; dragged += Math.abs(dx);
      camYaw += dx / canvas.clientWidth * 4;
    });
    canvas.addEventListener("pointerup", () => { if (dragging && dragged < 8) drop(); dragging = false; });
    canvas.addEventListener("pointercancel", () => { dragging = false; });
    canvas.addEventListener("contextmenu", e => e.preventDefault());
    canvas.tabIndex = 0;
    host.querySelectorAll("[data-crate]").forEach(b => b.addEventListener("click", () => { buyCrate(+b.dataset.crate); canvas.focus(); }));
    $("twWide").addEventListener("click", () => { buyWide(); canvas.focus(); });
    $("twDrop").addEventListener("pointerdown", e => { e.preventDefault(); drop(); });
    function toggleView(){ far = !far; viewBtn.textContent = far ? "🔭 Back up" : "🔭 Look"; }
    viewBtn.addEventListener("click", () => { toggleView(); canvas.focus(); });
    autoBtn.addEventListener("click", () => { auto = !auto; autoBtn.textContent = `🤖 Auto: ${auto ? "on" : "off"}`; canvas.focus(); });

    rebirthBtn.addEventListener("click", () => {
      const st = S();
      if (blocks().length < rebirthAt(st.rebirths)) return;
      const was = running; running = false;
      if (!confirm(`Rebirth? Your tower starts again from the ground, but every block makes ${multOf(st.rebirths + 1)}× money forever!` + (st.rebirths === 2 ? " And you unlock the 🤖 Auto builder!" : ""))) { running = was; return; }
      running = was;
      st.rebirths++; st.cash = 50; st.blocks = []; st.queue = [];
      debris = []; mv = null; wait = 0.3; streak = 0; viewY = 0;
      me.from = null; me.x = 0; me.z = 0; me.y = 0;
      recount(); save(); Hub.checkBadges();
      fx.pop(`🔁 REBIRTH ×${st.rebirths}!`, W / 2, H * 0.4, "#ffe14d", 48); fx.burst(W / 2, H * 0.4, "#ffe14d", 40, 260); Fun.sfx.tada();
      canvas.focus();
    });
    $("twCloseBtn").addEventListener("click", () => Hub.leave());
    Fun.soundButton($("twCloseBtn"));
    playBtn.addEventListener("click", start);

    // for tests: peek at the game, and line the block up
    window.__tower = {
      state: () => ({ cash: S().cash, height: blocks().length, top: top(), mv: mv && { along: mv.along, x: mv.x, z: mv.z, w: mv.w, d: mv.d, r: mv.r, wide: mv.wide }, queue: S().queue.slice(), income, streak, zone: zoneAt(blocks().length).name }),
      align: off => { if (!mv) return; const t = top(); mv[mv.along] = (mv.along === "x" ? t.x : t.z) + (off || 0); },
      drop, cash: n => { S().cash = n; }, build: (k, r) => { for (let i = 0; i < k; i++) blocks().push({ x: 0, z: 0, w: BASE, d: BASE, r: r || "dirt", p: 0 }); recount(); viewY = blocks().length; mv = null; wait = 0.05; }
    };

    return { open: openGame, close: closeGame };
  }
})();
