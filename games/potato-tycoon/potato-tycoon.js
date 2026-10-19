/* Potato Tycoon: a Roblox-style tycoon. Grab potatoes from the farm, peel them, fry them and sell the fries.
   Step on the green buttons to buy upgrades: a bigger bag (up to 20 potatoes in your hands), machines that
   peel and fry by themselves, tastier fries that sell for more, and faster shoes.
   The farm has 10,000 potatoes in total; sell them all to finish the game. Progress is saved (store.potato). */
(function(){
  "use strict";
  const store = Hub.store;
  const TOTAL = 10000;

  Hub.register({
    id: "potato-tycoon", section: "games", title: "Potato Tycoon", icon: "🥔",
    blurb: "Peel, fry and sell potatoes, then buy machines that do it for you. 10,000 potatoes to go!",
    stat: () => store.potato ? `🍟 ${store.potato.sold.toLocaleString("de-CH")} sold` : "",
    badges: [
      { id: "potato100",   icon: "🍟", name: "Chip Shop",      desc: "Sell 100 fries in Potato Tycoon",              test: () => store.potato && store.potato.sold >= 100 },
      { id: "potatoAuto",  icon: "🤖", name: "Fry Factory",    desc: "Buy the Auto Peeler and the Auto Fryer",       test: () => store.potato && store.potato.up.autoPeel > 0 && store.potato.up.autoFry > 0 },
      { id: "potatoAll",   icon: "👑", name: "Potato King",    desc: "Sell all 10,000 potatoes in Potato Tycoon",    test: () => store.potato && store.potato.sold >= TOTAL }
    ],
    mount
  });

  /* ---------------- the upgrades: each has levels, a price for the next level, and what it does ---------------- */
  const UPGRADES = [
    { id: "bag",      icon: "🎒", name: "Bigger Bag",   costs: [25, 60, 120, 250, 500], what: lv => `Hold ${[5, 8, 11, 14, 17, 20][lv]}` },
    { id: "autoPeel", icon: "🔪", name: "Auto Peeler",  costs: [100, 400, 1200],        what: lv => lv ? `${PEEL_RATE[lv]}/sec` : "Off" },
    { id: "autoFry",  icon: "🍳", name: "Auto Fryer",   costs: [150, 500, 1500],        what: lv => lv ? `${FRY_RATE[lv]}/sec` : "Off" },
    { id: "price",    icon: "🧂", name: "Tastier Fries", costs: [200, 800, 2500],        what: lv => `$${PRICE[lv]} each` },
    { id: "shoes",    icon: "👟", name: "Speedy Shoes", costs: [80, 300],                what: lv => ["Normal", "Fast", "Super fast"][lv] }
  ];
  const BAG = [5, 8, 11, 14, 17, 20], PEEL_RATE = [0, 0.5, 1, 2], FRY_RATE = [0, 0.5, 1, 2], PRICE = [2, 3, 5, 8], SPEED = [7, 9, 11];
  const BIN_MAX = 100;

  function freshSave(){
    return { money: 0, farm: TOTAL, sold: 0, peeledBin: 0, friesBin: 0, hand: { raw: 0, peeled: 0, fries: 0 },
      up: { bag: 0, autoPeel: 0, autoFry: 0, price: 0, shoes: 0 } };
  }

  function mount(host){
    host.innerHTML = `
    <section class="game-screen" id="ptOverlay" hidden aria-label="Potato Tycoon">
      <div class="game-box">
        <div class="game-hud">
          <h2>🥔 Potato Tycoon</h2>
          <span class="mono game-stat" id="ptMoney">💰 $0</span>
          <span class="mono game-stat" id="ptHand">🎒 0/5</span>
          <span class="mono game-stat" id="ptFarm">🌱 10,000 left</span>
          <button class="btn ghost small" id="ptCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas id="ptCanvas" width="960" height="540"></canvas>
          <div class="game-panel pt-panel" id="ptPanel">
            <div class="game-panel-title" id="ptPanelTitle">Potato Tycoon</div>
            <div class="game-panel-text" id="ptPanelText"></div>
            <div class="pt-actions">
              <button class="btn" id="ptPlayBtn" type="button">▶ Play</button>
              <button class="btn ghost" id="ptNewBtn" type="button" hidden>🔄 New farm</button>
            </div>
          </div>
        </div>
        <div class="game-help">W A S D or the arrow keys to walk · Q E or drag the screen to turn the camera · Space to jump · walk up to a station and it works by itself · step on a green button to buy an upgrade</div>
        <div class="game-touch">
          <button class="btn ghost fun-dpad" data-ptkey="left" type="button" aria-label="Walk left">◀</button>
          <button class="btn ghost fun-dpad" data-ptkey="up" type="button" aria-label="Walk forward">▲</button>
          <button class="btn ghost fun-dpad" data-ptkey="down" type="button" aria-label="Walk back">▼</button>
          <button class="btn ghost fun-dpad" data-ptkey="right" type="button" aria-label="Walk right">▶</button>
          <button class="btn" data-ptkey="jump" type="button" aria-label="Jump">JUMP</button>
        </div>
      </div>
    </section>`;

    const $ = id => document.getElementById(id);
    const overlay = $("ptOverlay"), canvas = $("ptCanvas"), ctx = canvas.getContext("2d");
    const panel = $("ptPanel"), panelTitle = $("ptPanelTitle"), panelText = $("ptPanelText"), playBtn = $("ptPlayBtn"), newBtn = $("ptNewBtn");
    const moneyEl = $("ptMoney"), handEl = $("ptHand"), farmEl = $("ptFarm");

    const W = 960, H = 540;
    const B = Blocky(ctx, W, H, { back: 11, up: 7.5, pitch: 0.36 }), { polyPath, line3, part } = B;
    const fx = Fun.pops();
    const keys = { left: false, right: false, up: false, down: false, jump: false, turnL: false, turnR: false };
    let stick = null;   // on phones: a joystick to walk with
    let open = false, running = false, last = 0, clock = 0, frameDt = 1 / 60, camYaw = 0, saveT = 0;
    let S = null, you = null, onPad = null, prompt = null;
    const timers = { farm: 0, peel: 0, fry: 0, sell: 0, autoPeel: 0, autoFry: 0 };

    /* ----- the world: stations you walk up to, and upgrade buttons on the floor ----- */
    const STATIONS = {
      farm: { x: -11, z: 6,  r: 3.4, name: "🥔 Potato Farm" },
      peel: { x: -3.5, z: 10, r: 2.7, name: "🔪 Peeler" },
      fry:  { x: 4,  z: 10, r: 2.7, name: "🍳 Fryer" },
      sell: { x: 11, z: 6,  r: 3,   name: "💰 Sell Fries" }
    };
    const PADS = UPGRADES.map((u, i) => ({ u, x: -12 + i * 6, z: -6 }));
    const LIMIT = { x0: -18, x1: 18, z0: -14, z1: 17 };
    const customer = { x: 13.8, y: 0, z: 6, face: -Math.PI / 2, walk: 0, vx: 0, vz: 0 };

    const handCount = () => S.hand.raw + S.hand.peeled + S.hand.fries;
    const cap = () => BAG[S.up.bag];
    const money = n => "$" + Math.floor(n).toLocaleString("de-CH");

    function load(){
      S = store.potato ? Object.assign(freshSave(), store.potato) : freshSave();
      S.up = Object.assign(freshSave().up, S.up); S.hand = Object.assign(freshSave().hand, S.hand);
      you = { x: 0, y: 0, z: -1, vx: 0, vy: 0, vz: 0, face: 0, walk: 0 };
      camYaw = 0;
    }
    function save(){ store.potato = S; Hub.saveStore(); }

    /* ----- moving ----- */
    function stepYou(dt){
      if (keys.turnL) camYaw -= 2.2 * dt;
      if (keys.turnR) camYaw += 2.2 * dt;
      let fwd = (keys.up ? 1 : 0) - (keys.down ? 1 : 0), side = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      if (stick && stick.on && Math.hypot(stick.x, stick.y) > 0.15) { fwd = -stick.y; side = stick.x; }
      const s = Math.sin(camYaw), c = Math.cos(camYaw);
      let wx = s * fwd + c * side, wz = c * fwd - s * side;
      const len = Math.hypot(wx, wz), speed = SPEED[S.up.shoes];
      const tx = len ? wx / len * speed : 0, tz = len ? wz / len * speed : 0, k = Math.min(1, dt * (you.y > 0 ? 4 : 12));
      you.vx += (tx - you.vx) * k; you.vz += (tz - you.vz) * k;
      you.x += you.vx * dt; you.z += you.vz * dt;
      if (keys.jump && you.y === 0) you.vy = 10;
      you.vy -= 28 * dt; you.y = Math.max(0, you.y + you.vy * dt); if (you.y === 0) you.vy = Math.min(0, you.vy);
      const sp = Math.hypot(you.vx, you.vz);
      if (sp > 0.5) {
        const d = ((Math.atan2(you.vx, you.vz) - you.face) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        you.face += d * Math.min(1, dt * 12);
        if (you.y === 0) you.walk += dt * sp * 1.6;
      }
      // bump into the stations, and stay on the plate
      Object.values(STATIONS).forEach(st => {
        const dx = you.x - st.x, dz = you.z - st.z, d = Math.hypot(dx, dz), min = st.r - 1.2;
        if (d < min && d > 0) { you.x = st.x + dx / d * min; you.z = st.z + dz / d * min; }
      });
      you.x = Math.max(LIMIT.x0, Math.min(LIMIT.x1, you.x)); you.z = Math.max(LIMIT.z0, Math.min(LIMIT.z1, you.z));
    }

    /* ----- working: stand next to a station and it happens one potato at a time ----- */
    function every(name, secs, dt, doOne){
      timers[name] += dt;
      while (timers[name] >= secs) { timers[name] -= secs; if (!doOne()) { timers[name] = 0; break; } }
    }
    function popAt(x, y, z, text, colour, size){ const p = B.at(x, y, z); if (p) fx.pop(text, p[0], p[1], colour, size); }
    function nearStation(){
      let best = null;
      Object.entries(STATIONS).forEach(([id, st]) => { if (Math.hypot(you.x - st.x, you.z - st.z) < st.r) best = id; });
      return best;
    }
    function work(dt){
      const at = nearStation(), room = () => handCount() < cap();
      prompt = null;
      Object.keys(STATIONS).forEach(id => { if (id !== at) timers[id] = 0; });
      if (at === "farm") {
        if (S.farm <= 0) prompt = "The farm is empty!";
        else if (!room()) prompt = "Your hands are full! 🎒";
        else { prompt = "Picking potatoes…"; every("farm", 0.1, dt, () => { if (S.farm <= 0 || !room()) return false; S.farm--; S.hand.raw++; Fun.sfx.pop(); return true; }); }
      } else if (at === "peel") {
        if (S.hand.raw > 0) { prompt = "Peeling… 🥔 → ⚪"; every("peel", 0.3, dt, () => { if (!S.hand.raw) return false; S.hand.raw--; S.hand.peeled++; return true; }); }
        else if (S.peeledBin > 0 && room()) { prompt = "Taking peeled potatoes"; every("peel", 0.06, dt, () => { if (!S.peeledBin || !room()) return false; S.peeledBin--; S.hand.peeled++; return true; }); }
        else prompt = "Bring raw potatoes 🥔 to peel";
      } else if (at === "fry") {
        if (S.hand.peeled > 0) { prompt = "Frying… ⚪ → 🍟"; every("fry", 0.4, dt, () => { if (!S.hand.peeled) return false; S.hand.peeled--; S.hand.fries++; Fun.sfx.splat(); return true; }); }
        else if (S.friesBin > 0 && room()) { prompt = "Taking fries"; every("fry", 0.06, dt, () => { if (!S.friesBin || !room()) return false; S.friesBin--; S.hand.fries++; return true; }); }
        else prompt = "Bring peeled potatoes ⚪ to fry";
      } else if (at === "sell") {
        if (S.hand.fries > 0) {
          prompt = "Selling! 🍟 → 💰";
          every("sell", 0.12, dt, () => {
            if (!S.hand.fries) return false;
            S.hand.fries--; S.money += PRICE[S.up.price]; S.sold++;
            popAt(STATIONS.sell.x, 3.4, STATIONS.sell.z, "+$" + PRICE[S.up.price], "#7bd68a", 26); Fun.sfx.coin();
            if (S.sold % 100 === 0) Hub.checkBadges();
            return true;
          });
        } else prompt = "Bring fries 🍟 to sell";
      }
      // the machines work on their own, even when you're away
      if (S.up.autoPeel) every("autoPeel", 1 / PEEL_RATE[S.up.autoPeel], dt, () => { if (S.farm <= 0 || S.peeledBin >= BIN_MAX) return false; S.farm--; S.peeledBin++; return true; });
      if (S.up.autoFry) every("autoFry", 1 / FRY_RATE[S.up.autoFry], dt, () => { if (S.peeledBin <= 0 || S.friesBin >= BIN_MAX) return false; S.peeledBin--; S.friesBin++; return true; });
      // the buttons: step on one to buy (step off and on again to buy the next level)
      const pad = PADS.find(p => Math.abs(you.x - p.x) < 1.3 && Math.abs(you.z - p.z) < 1.3 && you.y < 0.3);
      if (pad && pad !== onPad) buy(pad);
      onPad = pad || null;
      if (S.farm === 0 && !S.peeledBin && !S.friesBin && !handCount() && running) finish();
    }
    function buy(pad){
      const u = pad.u, lv = S.up[u.id];
      if (lv >= u.costs.length) { popAt(pad.x, 1.5, pad.z, "MAXED! ⭐", "#ffe14d", 26); Fun.sfx.nope(); return; }
      const cost = u.costs[lv];
      if (S.money < cost) { popAt(pad.x, 1.5, pad.z, `Need ${money(cost - S.money)} more`, "#ff8a7a", 22); Fun.sfx.nope(); return; }
      S.money -= cost; S.up[u.id]++;
      popAt(pad.x, 2, pad.z, `${u.icon} ${u.name}!`, "#7bd68a", 30); Fun.sfx.tada();
      const p = B.at(pad.x, 0.5, pad.z); if (p) fx.burst(p[0], p[1], "#7bd68a", 20, 220);
      save(); Hub.checkBadges();
    }
    function finish(){
      running = false; save(); Hub.checkBadges();
      Fun.sfx.tada();
      panelTitle.textContent = "👑 You're the Potato King!";
      panelText.textContent = `You sold all ${TOTAL.toLocaleString("de-CH")} potatoes and made ${money(S.money)}! Start a new farm to play again.`;
      playBtn.hidden = true; newBtn.hidden = false;
      panel.hidden = false;
      Hub.confettiBurst(newBtn); Hub.confettiBurst(newBtn);
    }

    /* ----- drawing ----- */
    function ground(){
      if (polyPath([[-70, 0, -70], [70, 0, -70], [70, 0, 80], [-70, 0, 80]])) { ctx.fillStyle = "#4fae4a"; ctx.fill(); }
      // the shop floor, with Roblox studs
      if (polyPath([[LIMIT.x0, 0.01, LIMIT.z0], [LIMIT.x1, 0.01, LIMIT.z0], [LIMIT.x1, 0.01, LIMIT.z1], [LIMIT.x0, 0.01, LIMIT.z1]])) { ctx.fillStyle = "#a3a8ad"; ctx.fill(); }
      ctx.strokeStyle = "rgba(0,0,0,0.08)"; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = LIMIT.x0; x <= LIMIT.x1; x += 2) line3([x, 0.02, LIMIT.z0], [x, 0.02, LIMIT.z1]);
      for (let z = LIMIT.z0; z <= LIMIT.z1; z += 2) line3([LIMIT.x0, 0.02, z], [LIMIT.x1, 0.02, z]);
      ctx.stroke();
      // the potato field behind the farm
      if (polyPath([[-18, 0.02, 8], [-6, 0.02, 8], [-6, 0.02, 17], [-18, 0.02, 17]])) { ctx.fillStyle = "#7a5230"; ctx.fill(); }
      ctx.strokeStyle = "rgba(60,35,15,0.6)"; ctx.lineWidth = 2; ctx.beginPath();
      for (let x = -17; x <= -7; x += 2) line3([x, 0.03, 9], [x, 0.03, 16]);
      ctx.stroke();
      // the buttons on the floor
      PADS.forEach(p => {
        const lv = S.up[p.u.id], maxed = lv >= p.u.costs.length, afford = !maxed && S.money >= p.u.costs[lv];
        const col = maxed ? "#8a8f98" : afford ? (Math.sin(clock * 6) > 0 ? "#3fe05a" : "#2fc94a") : "#2f8a3f";
        if (polyPath([[p.x - 1.2, 0.05, p.z - 1.2], [p.x + 1.2, 0.05, p.z - 1.2], [p.x + 1.2, 0.05, p.z + 1.2], [p.x - 1.2, 0.05, p.z + 1.2]])) {
          ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 2; ctx.stroke();
        }
      });
      B.shadow(you.x, you.z, 0.7 / (1 + you.y * 0.3), 0.3 / (1 + you.y * 0.4));
    }
    // a heap of little boxes: raw potatoes, peeled ones or boxes of fries
    const ITEM = { raw: ["#a8743c", 0.38], peeled: ["#f2dc9b", 0.36], fries: ["#e8332b", 0.36] };
    function heap(list, body, n, kind, lx, ly, lz, cols){
      const [colour, s] = ITEM[kind];
      for (let i = 0; i < n; i++) {
        const cx = (i % cols) - (cols - 1) / 2, cy = Math.floor(i / (cols * cols)), cz = Math.floor(i / cols) % cols - (cols - 1) / 2;
        part(list, body, lx + cx * s * 1.1, ly + cy * s, lz + cz * s * 1.1, s, s * 0.9, s, colour);
        if (kind === "fries") part(list, body, lx + cx * s * 1.1, ly + cy * s + s * 0.9, lz + cz * s * 1.1, s * 0.7, s * 0.3, s * 0.7, "#ffd23f");
      }
    }
    function objects(){
      const objs = [];
      const add = (x, z, build) => { const list = []; build(list); objs.push({ d: B.depth(x, 1, z), list }); };
      const st = STATIONS;
      // the farm: a big brown pile of potatoes in a wooden crate; it shrinks as the farm runs out
      add(st.farm.x, st.farm.z, L => {
        const b = { x: st.farm.x, z: st.farm.z, face: 0 };
        part(L, b, 0, 0, -1.6, 4.2, 1, 0.3, "#9c6a35"); part(L, b, 0, 0, 1.6, 4.2, 1, 0.3, "#9c6a35");
        part(L, b, -2, 0, 0, 0.3, 1, 3.2, "#9c6a35"); part(L, b, 2, 0, 0, 0.3, 1, 3.2, "#9c6a35");
        const n = Math.ceil(Math.min(1, S.farm / TOTAL) * 3);
        for (let k = 0; k < n; k++) part(L, b, 0, 0.2 + k * 0.5, 0, 3.6 - k * 1.1, 0.6, 2.8 - k * 0.8, "#b07a40");
      });
      // the peeler: a table with a peeling machine on it, and the tray the Auto Peeler fills
      add(st.peel.x, st.peel.z, L => {
        const b = { x: st.peel.x, z: st.peel.z, face: 0 };
        part(L, b, 0, 0, 0, 3, 1.2, 1.6, "#c98a4b");
        part(L, b, 0, 1.2, 0, 1, 0.9, 0.9, "#7b8494");
        part(L, b, 0, 2.1, 0, 0.3, 0.3 + Math.abs(Math.sin(clock * (timers.peel ? 20 : 2))) * 0.1, 0.3, "#c9ccd2");
        heap(L, b, Math.min(8, S.peeledBin), "peeled", 1.1, 1.2, 0, 2);
        if (S.up.autoPeel) {   // the Auto Peeler: a machine with a chute from the farm
          const m = { x: st.peel.x - 3, z: st.peel.z + 1.5, face: 0 };
          part(L, m, 0, 0, 0, 1.8, 2.2, 1.8, "#3f7fd8");
          part(L, m, 0, 2.2, 0, 1.2, 0.5, 1.2, "#2a5fb0");
          part(L, m, 0, 2.7 + Math.abs(Math.sin(clock * 8)) * 0.15, 0, 0.5, 0.3, 0.5, "#ffd23f");
        }
      });
      // the fryer: a steel fryer with bubbling oil, and the Auto Fryer next to it
      add(st.fry.x, st.fry.z, L => {
        const b = { x: st.fry.x, z: st.fry.z, face: 0 };
        part(L, b, 0, 0, 0, 3, 1.3, 1.6, "#9aa1ab");
        part(L, b, -0.6, 1.3, 0, 1.2, 0.08, 1.1, Math.sin(clock * 12) > 0 ? "#f0c43a" : "#e0a82a");
        part(L, b, 0.8, 1.3, 0, 0.6, 1.2, 0.2, "#5b606a");
        heap(L, b, Math.min(8, S.friesBin), "fries", 0.9, 1.3, 0.4, 2);
        if (S.up.autoFry) {
          const m = { x: st.fry.x + 3, z: st.fry.z + 1.5, face: 0 };
          part(L, m, 0, 0, 0, 1.8, 2, 1.8, "#e8332b");
          part(L, m, 0, 2, 0, 1.4, 0.15, 1.4, Math.sin(clock * 10) > 0 ? "#f0c43a" : "#e0a82a");
          part(L, m, 0, 2.15 + Math.abs(Math.sin(clock * 6)) * 0.4, 0, 0.3, 0.3, 0.3, "#f4f4f4");
        }
      });
      // the shop counter with a red and white awning, and a hungry customer
      add(st.sell.x, st.sell.z, L => {
        const b = { x: st.sell.x, z: st.sell.z, face: 0 };
        part(L, b, 0, 0, 0, 1.4, 1.3, 4, "#f4f4f4");
        part(L, b, 0, 1.3, 0, 1.6, 0.15, 4.2, "#e8332b");
        part(L, b, 0.6, 0, -1.9, 0.2, 3.2, 0.2, "#c9ccd2"); part(L, b, 0.6, 0, 1.9, 0.2, 3.2, 0.2, "#c9ccd2");
        for (let k = 0; k < 4; k++) part(L, b, 0.6, 3.2, -1.5 + k, 1.6, 0.25, 1, k % 2 ? "#ffffff" : "#e8332b");
      });
      add(customer.x, customer.z, L => B.avatar(L, customer, { shirt: "#2fd0c0", pants: "#1f5f7a", head: "#f2c49b" }));
      // you, with your potatoes in a stack on your back
      add(you.x, you.z, L => {
        B.avatar(L, you, { shirt: "#ff9f1c", pants: "#2a4d8f", head: "#ffd23f" });
        let n = 0;
        [["raw", S.hand.raw], ["peeled", S.hand.peeled], ["fries", S.hand.fries]].forEach(([kind, k]) => {
          const [colour, s] = ITEM[kind];
          for (let i = 0; i < k; i++, n++) {
            part(L, you, 0, 1.2 + n * 0.27, -0.55, s, 0.25, s, colour);
            if (kind === "fries") part(L, you, 0, 1.2 + n * 0.27 + 0.2, -0.55, s * 0.6, 0.08, s * 0.6, "#ffd23f");
          }
        });
      });
      objs.sort((a, b) => b.d - a.d).forEach(o => B.paint(o.list));
    }
    function labels(){
      Object.values(STATIONS).forEach(st => B.label(st.x, 4.4, st.z, st.name, "#ffffff", 22));
      B.label(STATIONS.farm.x, 3.6, STATIONS.farm.z, `${S.farm.toLocaleString("de-CH")} left`, "#ffe14d", 16);
      if (S.up.autoPeel) B.label(STATIONS.peel.x - 3, 3.6, STATIONS.peel.z + 1.5, `Auto Peeler ⚪${S.peeledBin}`, "#9fc4ff", 15);
      if (S.up.autoFry) B.label(STATIONS.fry.x + 3, 3.6, STATIONS.fry.z + 1.5, `Auto Fryer 🍟${S.friesBin}`, "#ffb0a0", 15);
      PADS.forEach(p => {
        const lv = S.up[p.u.id], maxed = lv >= p.u.costs.length;
        B.label(p.x, 2.2, p.z, `${p.u.icon} ${p.u.name}`, "#ffffff", 17);
        B.label(p.x, 1.3, p.z, maxed ? "MAX ⭐" : money(p.u.costs[lv]) + " → " + p.u.what(lv + 1), maxed ? "#ffe14d" : S.money >= p.u.costs[lv] ? "#7dff9a" : "#ffb0a0", 15);
      });
      B.label(you.x, you.y + 3.3 + handCount() * 0.27, you.z, store.name || "You", "#ffe14d", 18);
    }
    // what you're doing right now, and what you're holding, like a Roblox prompt at the bottom
    function hud(){
      if (prompt) {
        ctx.font = "800 22px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center";
        const w = ctx.measureText(prompt).width + 36;
        ctx.fillStyle = "rgba(0,0,0,0.55)"; roundRect(W / 2 - w / 2, H - 70, w, 40, 10); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.fillText(prompt, W / 2, H - 42);
      }
      // the leaderstats box in the corner
      const rows = [["💰 Money", money(S.money)], ["🍟 Sold", S.sold.toLocaleString("de-CH")], ["🥔 🍳 🍟", `${S.hand.raw} · ${S.hand.peeled} · ${S.hand.fries}`]];
      ctx.fillStyle = "rgba(0,0,0,0.45)"; roundRect(W - 214, 12, 202, 26 + rows.length * 24, 10); ctx.fill();
      ctx.font = "700 15px 'Bricolage Grotesque', sans-serif";
      ctx.fillStyle = "#c9d6ff"; ctx.textAlign = "left"; ctx.fillText("leaderstats", W - 202, 32);
      rows.forEach(([k, v], i) => {
        ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.fillText(k, W - 202, 56 + i * 24);
        ctx.textAlign = "right"; ctx.fillText(v, W - 22, 56 + i * 24);
      });
    }
    function roundRect(x, y, w, h, r){
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
    let scale = 1;
    function fitCanvas(){
      const s = Math.min(3, Math.max(1, canvas.clientWidth * (window.devicePixelRatio || 1) / W));
      if (Math.abs(s - scale) < 0.01) return;
      scale = s; canvas.width = Math.round(W * s); canvas.height = Math.round(H * s);
    }
    function draw(){
      fitCanvas();
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      B.sky(clock);
      ground();
      objects();
      labels();
      fx.draw(ctx, frameDt);
      hud();
    }
    function updateHud(){
      moneyEl.textContent = "💰 " + money(S.money);
      handEl.textContent = `🎒 ${handCount()}/${cap()}`;
      handEl.classList.toggle("low", handCount() >= cap());
      farmEl.textContent = `🌱 ${S.farm.toLocaleString("de-CH")} left`;
    }

    function loop(now){
      if (!open) return;
      const dt = Math.min(1 / 30, (now - last) / 1000 || 0);
      last = now; frameDt = dt; clock += dt;
      if (running) {
        stepYou(dt);
        work(dt);
        if ((saveT += dt) > 3) { saveT = 0; save(); }
      }
      customer.walk += dt * 3; customer.vx = Math.sin(clock) * 0.3;   // hopping from foot to foot, waiting for fries
      B.follow(you, camYaw, dt);
      draw();
      updateHud();
      requestAnimationFrame(loop);
    }

    function start(){
      if (S.farm === 0 && !handCount() && !S.peeledBin && !S.friesBin) return;
      running = true;
      panel.hidden = true;
      Object.keys(keys).forEach(k => { keys[k] = false; });
      if (stick) stick.reset();
      canvas.focus();
    }
    function newFarm(){
      store.potato = freshSave(); Hub.saveStore();
      load(); B.follow(you, camYaw, 0);
      playBtn.hidden = false; newBtn.hidden = true;
      start();
    }
    function openGame(){
      open = true; running = false;
      load(); B.follow(you, camYaw, 0);
      overlay.hidden = false;
      document.body.style.overflow = "hidden";
      const fresh = !store.potato;
      panelTitle.textContent = "🥔 Potato Tycoon";
      panelText.textContent = fresh
        ? "Walk to the 🥔 farm to grab potatoes, take them to the 🔪 peeler, then the 🍳 fryer, then 💰 sell your fries! Step on the green buttons to buy upgrades: a bigger bag (up to 20), an Auto Peeler and an Auto Fryer. There are 10,000 potatoes on the farm. Can you sell them all?"
        : `Welcome back! You have ${money(S.money)} and ${S.farm.toLocaleString("de-CH")} potatoes left on the farm.`;
      playBtn.textContent = fresh ? "▶ Play" : "▶ Keep going";
      const done = S.farm === 0 && !handCount() && !S.peeledBin && !S.friesBin;
      playBtn.hidden = done; newBtn.hidden = !done && fresh;
      panel.hidden = false;
      last = performance.now();
      requestAnimationFrame(loop);
      (done ? newBtn : playBtn).focus();
    }
    function closeGame(){
      if (open && S) save();
      open = false; running = false;
      overlay.hidden = true;
      document.body.style.overflow = "";
    }

    const KEYMAP = {
      ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
      ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", Space: "jump", KeyQ: "turnL", KeyE: "turnR"
    };
    window.addEventListener("keydown", e => {
      if (!open) return;
      if (e.key === "Escape") { Hub.leave(); return; }
      const k = KEYMAP[e.code];
      if (!k || !running) return;
      e.preventDefault();
      keys[k] = true;
    });
    window.addEventListener("keyup", e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
    window.addEventListener("blur", () => Object.keys(keys).forEach(k => { keys[k] = false; }));
    // drag the screen to turn the camera round you
    let dragX = null;
    canvas.addEventListener("pointerdown", e => { dragX = e.clientX; try { canvas.setPointerCapture(e.pointerId); } catch (err) {} });
    canvas.addEventListener("pointermove", e => {
      if (dragX === null) return;
      camYaw += (e.clientX - dragX) / canvas.clientWidth * 4;
      dragX = e.clientX;
    });
    ["pointerup", "pointercancel"].forEach(ev => canvas.addEventListener(ev, () => { dragX = null; }));
    host.querySelectorAll("[data-ptkey]").forEach(btn => {
      const k = btn.dataset.ptkey;
      btn.addEventListener("pointerdown", e => { e.preventDefault(); keys[k] = true; });
      ["pointerup", "pointercancel", "pointerleave"].forEach(ev => btn.addEventListener(ev, () => { keys[k] = false; }));
    });
    canvas.tabIndex = 0;
    stick = Fun.joystick(canvas.parentElement);

    $("ptCloseBtn").addEventListener("click", () => Hub.leave());
    Fun.soundButton($("ptCloseBtn"));
    playBtn.addEventListener("click", start);
    newBtn.addEventListener("click", () => {
      if (store.potato && store.potato.farm < TOTAL && !confirm("Start a new farm? Your money and upgrades start again from zero.")) return;
      newFarm();
    });

    return { open: openGame, close: closeGame };
  }
})();
