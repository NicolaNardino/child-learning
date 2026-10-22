/* Blox Mini Golf: nine crazy-golf holes in a blocky Roblox world.
   Drag back from anywhere and let go to putt (like a slingshot): the further you pull, the harder.
   Keyboard: ← → to aim, hold Space and let go. Watch out for the windmill, the sliding block, sand,
   water (one stroke penalty, back to where you hit from), the hill and the speed pads. */
(function(){
  "use strict";
  const store = Hub.store;

  /* ---------------- the course: 240 x 130 units per hole, y grows towards you ---------------- */
  const CW = 240, CH = 130, R = 3, CUP = 4.6, WALL_H = 7;
  const HOLES = [
    { name: "Warm-up", par: 2, start: [30, 65], cup: [210, 65], walls: [[0, 0, 240, 32], [0, 98, 240, 32]] },
    { name: "Dogleg", par: 3, start: [25, 108], cup: [205, 25], walls: [[0, 0, 160, 86]] },
    { name: "Windmill", par: 3, start: [25, 65], cup: [215, 65], walls: [[0, 0, 240, 34], [0, 96, 240, 34], [110, 34, 20, 21], [110, 75, 20, 21]], spin: { x: 120, y: 65, len: 17, speed: 1.6 } },
    { name: "Sand Trap", par: 3, start: [25, 65], cup: [208, 65], walls: [[0, 0, 240, 14], [0, 116, 240, 14], [100, 36, 10, 10], [100, 60, 10, 10], [100, 84, 10, 10]], sand: [[150, 42, 38, 46]] },
    { name: "The Pond", par: 3, start: [25, 65], cup: [215, 65], walls: [[0, 0, 240, 14], [0, 116, 240, 14]], water: [[75, 34, 100, 62]] },
    { name: "Zig-Zag", par: 4, start: [25, 110], cup: [215, 22], walls: [[60, 0, 12, 92], [120, 38, 12, 92], [180, 0, 12, 92]] },
    { name: "Slider", par: 3, start: [25, 65], cup: [215, 65], walls: [[0, 0, 240, 30], [0, 100, 240, 30], [115, 30, 12, 25], [115, 75, 12, 25]], slider: { x: 140, w: 12, h: 22, y0: 32, y1: 76, speed: 1.3 } },
    { name: "The Hill", par: 3, start: [25, 100], cup: [205, 28], walls: [[0, 0, 240, 12], [0, 118, 240, 12]], hill: [[90, 12, 70, 106, 0, 120]] },
    { name: "Boost Finale", par: 4, start: [25, 22], cup: [212, 100], walls: [[70, 0, 10, 86], [150, 44, 10, 86], [185, 75, 8, 8], [200, 70, 8, 8]], pads: [[28, 96, 30, 22, 1, 0], [96, 14, 30, 22, 1, 0]] }
  ];
  const PAR = HOLES.reduce((s, h) => s + h.par, 0);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  Hub.register({
    id: "minigolf", section: "games", title: "Blox Mini Golf", icon: "⛳",
    blurb: "Nine blocky crazy-golf holes: windmills, sand, water and speed pads!",
    stat: () => store.golfBest ? `Best: ${store.golfBest} (par ${PAR})` : "",
    badges: [
      { id: "golfAce", icon: "⛳", name: "Hole in One!", desc: "Get a hole in one in Blox Mini Golf",         test: () => (store.golfAces || 0) >= 1 },
      { id: "golfPar", icon: "🏌️", name: "Par Master",   desc: `Finish all 9 holes in ${PAR} strokes or fewer`, test: () => store.golfBest > 0 && store.golfBest <= PAR }
    ],
    mount
  });

  // a slanted top-down view, the near side a bit wider
  const W = 960, H = 540, K = 3.45, CX = 480, Y0 = 92, HS = 360;
  const sc = t => 0.78 + 0.22 * t;
  const proj = (x, y, z) => { const t = y / CH, s = sc(t), k = K * s; return [CX + (x - CW / 2) * k, Y0 + t * HS - (z || 0) * k * 0.8, k]; };
  const unproj = (sx, sy) => { const t = (sy - Y0) / HS, s = sc(t); return [(sx - CX) / (K * s) + CW / 2, t * CH]; };
  const inRect = (x, y, r) => x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3];

  function mount(host){
    host.innerHTML = `
    <section class="game-screen" id="mgOverlay" hidden aria-label="Blox Mini Golf">
      <div class="game-box">
        <div class="game-hud">
          <h2>⛳ Blox Mini Golf</h2>
          <span class="mono game-stat" id="mgHole">Hole 1/9</span>
          <span class="mono game-stat" id="mgStroke">Par 2 · 0</span>
          <span class="mono game-stat" id="mgTotal">±0</span>
          <button class="btn ghost small" id="mgCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas id="mgCanvas" width="960" height="540"></canvas>
          <div class="game-panel mg-panel" id="mgPanel">
            <div class="game-panel-title" id="mgPanelTitle">Blox Mini Golf</div>
            <div class="game-panel-text" id="mgPanelText"></div>
            <button class="btn" id="mgPlayBtn" type="button">▶ Play</button>
          </div>
        </div>
        <div class="game-help">Drag back and let go to putt, like a slingshot (pull further = harder) · keys: ← → aim, hold Space and let go · water costs a stroke · get it in the hole in as few strokes as you can</div>
      </div>
    </section>`;

    const $ = id => document.getElementById(id);
    const overlay = $("mgOverlay"), canvas = $("mgCanvas"), ctx = canvas.getContext("2d");
    const panel = $("mgPanel"), panelTitle = $("mgPanelTitle"), panelText = $("mgPanelText"), playBtn = $("mgPlayBtn");
    const holeEl = $("mgHole"), strokeEl = $("mgStroke"), totalEl = $("mgTotal");
    const fx = Fun.pops();

    let open = false, running = false, last = 0, clock = 0, scale = 1;
    let hi = 0, hole = HOLES[0], ball = null, strokes = 0, card = [], state = "ready", aim = 0, power = 0, charging = false;
    let drag = null, from = null, settleT = 0, slowT = 0, sinkT = 0, padCool = 0, status = "";
    const keys = { left: false, right: false };

    /* ---------------- the moving bits ---------------- */
    function spinBar(){   // the windmill's sail: a thick line through its hub
      const s = hole.spin, a = clock * s.speed, dx = Math.cos(a) * s.len, dy = Math.sin(a) * s.len;
      return { ax: s.x - dx, ay: s.y - dy, bx: s.x + dx, by: s.y + dy, w: 2.5, vx: -Math.sin(a) * s.speed, vy: Math.cos(a) * s.speed };
    }
    function sliderRect(){ const s = hole.slider, u = (Math.sin(clock * s.speed) + 1) / 2; return [s.x, s.y0 + (s.y1 - s.y0) * u, s.w, s.h, Math.cos(clock * s.speed) * s.speed * (s.y1 - s.y0) / 2]; }
    const allWalls = () => {
      const w = hole.walls.slice();
      w.push([-10, -10, CW + 20, 10], [-10, CH, CW + 20, 10], [-10, 0, 10, CH], [CW, 0, 10, CH]);   // the edges
      return w;
    };

    /* ---------------- the physics ---------------- */
    function bounceRect(r, vyWall){
      const qx = clamp(ball.x, r[0], r[0] + r[2]), qy = clamp(ball.y, r[1], r[1] + r[3]);
      let dx = ball.x - qx, dy = ball.y - qy, d = Math.hypot(dx, dy);
      if (d >= R) return false;
      if (d === 0) {   // the middle got inside: push out the shortest way
        const opts = [[ball.x - r[0], -1, 0], [r[0] + r[2] - ball.x, 1, 0], [ball.y - r[1], 0, -1], [r[1] + r[3] - ball.y, 0, 1]].sort((a, b) => a[0] - b[0])[0];
        dx = opts[1]; dy = opts[2]; d = 1; ball.x += opts[1] * (opts[0] + R); ball.y += opts[2] * (opts[0] + R);
      } else { ball.x = qx + dx / d * R; ball.y = qy + dy / d * R; }
      const nx = dx / d, ny = dy / d, rvx = ball.vx, rvy = ball.vy - (vyWall || 0);
      const vn = rvx * nx + rvy * ny;
      if (vn < 0) { ball.vx -= 1.75 * vn * nx; ball.vy -= 1.75 * vn * ny; if (-vn > 40) Fun.sfx.thunk(); }
      if (vyWall && ny * vyWall > 0) ball.vy += vyWall * 0.9;   // the sliding block shoves you along
      return true;
    }
    function bounceBar(b){
      const ex = b.bx - b.ax, ey = b.by - b.ay, l2 = ex * ex + ey * ey;
      const u = clamp(((ball.x - b.ax) * ex + (ball.y - b.ay) * ey) / l2, 0, 1);
      const qx = b.ax + u * ex, qy = b.ay + u * ey, dx = ball.x - qx, dy = ball.y - qy, d = Math.hypot(dx, dy) || 0.001;
      if (d >= R + b.w) return;
      const nx = dx / d, ny = dy / d;
      ball.x = qx + nx * (R + b.w); ball.y = qy + ny * (R + b.w);
      const arm = (u - 0.5) * 2 * hole.spin.len, wvx = b.vx * arm, wvy = b.vy * arm;   // how fast the sail moves at that spot
      const vn = (ball.vx - wvx) * nx + (ball.vy - wvy) * ny;
      if (vn < 0) { ball.vx -= 1.8 * vn * nx; ball.vy -= 1.8 * vn * ny; Fun.sfx.bonk(); fx.pop("WHACK!", ...proj(ball.x, ball.y).slice(0, 2), "#ff9a3c", 26); }
    }
    function physics(h){
      ball.x += ball.vx * h; ball.y += ball.vy * h;
      const sp = Math.hypot(ball.vx, ball.vy);
      let fric = 95;
      if (hole.sand && hole.sand.some(r => inRect(ball.x, ball.y, r))) fric = 420;
      if (hole.hill) hole.hill.forEach(r => { if (inRect(ball.x, ball.y, r)) { ball.vx += r[4] * h; ball.vy += r[5] * h; } });
      if (hole.pads && padCool <= 0) hole.pads.forEach(r => { if (inRect(ball.x, ball.y, r)) { ball.vx += r[4] * 260; ball.vy += r[5] * 260; padCool = 0.6; Fun.sfx.zap(); fx.pop("ZOOM!", ...proj(ball.x, ball.y).slice(0, 2), "#4df2ff", 28); } });
      if (sp > 0) { const s2 = Math.max(0, sp - fric * h); if (s2 < 3 && !onHill()) { ball.vx = ball.vy = 0; } else { ball.vx *= s2 / sp; ball.vy *= s2 / sp; } }
      allWalls().forEach(r => bounceRect(r));
      if (hole.slider) { const s = sliderRect(); bounceRect(s, s[4]); }
      if (hole.spin) bounceBar(spinBar());
      // the cup: slow enough and close enough drops in; too fast rolls over the lip
      const cd = Math.hypot(ball.x - hole.cup[0], ball.y - hole.cup[1]);
      if (cd < CUP * 0.85 && sp < 170) sink();
      else if (cd < CUP && sp >= 170) { ball.vx *= 0.97; ball.vy *= 0.97; }
      if (hole.water && hole.water.some(r => inRect(ball.x, ball.y, r))) splash();
    }
    const onHill = () => hole.hill && hole.hill.some(r => inRect(ball.x, ball.y, r));

    /* ---------------- shots, holes and the scorecard ---------------- */
    function putt(a, pw){
      from = [ball.x, ball.y];
      const v = 30 + clamp(pw, 0, 1) * 390;
      ball.vx = Math.cos(a) * v; ball.vy = Math.sin(a) * v;
      strokes++; state = "roll"; settleT = 0; slowT = 0; power = 0; charging = false;
      Fun.sfx.pop();
    }
    function sink(){
      state = "sunk"; sinkT = 0; ball.vx = ball.vy = 0; ball.x = hole.cup[0]; ball.y = hole.cup[1];
      const d = strokes - hole.par;
      const word = strokes === 1 ? "HOLE IN ONE!" : d <= -2 ? "EAGLE!" : d === -1 ? "BIRDIE!" : d === 0 ? "PAR!" : d === 1 ? "Bogey" : d === 2 ? "Double bogey" : "In the hole!";
      const [sx, sy] = proj(hole.cup[0], hole.cup[1]);
      fx.pop(word, sx, sy - 30, strokes === 1 ? "#ffe14d" : d <= 0 ? "#7dff9a" : "#ffffff", strokes === 1 ? 46 : 36);
      fx.burst(sx, sy, "#ffe14d", 20, 160);
      if (d <= 0) { store.golfPars = (store.golfPars || 0) + 1; Hub.saveStore(); Hub.checkBadges(); }
      if (strokes === 1) { store.golfAces = (store.golfAces || 0) + 1; Hub.saveStore(); Hub.checkBadges(); Fun.sfx.tada(); Hub.confettiBurst(canvas); }
      else if (d <= 0) Fun.sfx.ding(); else Fun.sfx.coin();
      card[hi] = strokes;
    }
    function splash(){
      const [sx, sy] = proj(ball.x, ball.y);
      fx.pop("SPLASH! +1", sx, sy - 20, "#7fd0ff", 32); fx.burst(sx, sy, "#7fd0ff", 18, 150, 300); Fun.sfx.splash();
      strokes++; ball.x = from[0]; ball.y = from[1]; ball.vx = ball.vy = 0;
    }
    function loadHole(i){
      hi = i; hole = HOLES[i]; strokes = 0; from = hole.start.slice();
      ball = { x: hole.start[0], y: hole.start[1], vx: 0, vy: 0 };
      aim = Math.atan2(hole.cup[1] - ball.y, hole.cup[0] - ball.x);
      state = "aim"; fx.clear();
      status = `Hole ${i + 1}: ${hole.name} · par ${hole.par}`;
    }
    function finish(){
      state = "over"; running = false;
      const total = card.reduce((s, v) => s + v, 0), best = !store.golfBest || total < store.golfBest;
      if (best) store.golfBest = total;
      Hub.saveStore(); Hub.checkBadges();
      const d = total - PAR;
      panelTitle.textContent = d <= 0 ? "🏆 Brilliant round!" : "⛳ Round done!";
      panelText.textContent = `${total} strokes (par ${PAR}, ${d === 0 ? "level par" : d < 0 ? d + " under" : "+" + d}). Holes: ${card.join(" · ")}.` + (best ? " New best!" : ` Your best is ${store.golfBest}.`);
      if (d <= 0) { Fun.sfx.tada(); Hub.confettiBurst(playBtn); } else Fun.sfx.ding();
      playBtn.textContent = "▶ Play again"; panel.hidden = false; playBtn.focus();
    }

    /* ---------------- each frame ---------------- */
    function update(dt){
      clock += dt; padCool -= dt;
      if (state === "aim") {
        if (keys.left) aim -= dt * 1.4; if (keys.right) aim += dt * 1.4;
        if (charging) power = Math.min(1, power + dt * 0.8);
      } else if (state === "roll") {
        const n = Math.ceil(dt * 240);
        for (let i = 0; i < n && state === "roll"; i++) physics(dt / n);
        // a ball stuck creeping (against a wall on the hill) counts as stopped
        if (state === "roll") { slowT = Math.hypot(ball.vx, ball.vy) < 6 ? slowT + dt : 0; if (slowT > 0.5) { ball.vx = ball.vy = 0; } }
        if (state === "roll" && !ball.vx && !ball.vy) {
          settleT += dt;
          if (settleT > 0.25) {
            if (strokes >= 8) { fx.pop("Picked up", CX, 260, "#ffffff", 30); card[hi] = strokes; state = "sunk"; sinkT = 0; }
            else { state = "aim"; aim = Math.atan2(hole.cup[1] - ball.y, hole.cup[0] - ball.x); }
          }
        } else settleT = 0;
      } else if (state === "sunk") {
        sinkT += dt;
        if (sinkT > 1.8) { if (hi < HOLES.length - 1) loadHole(hi + 1); else finish(); }
      }
    }

    /* ---------------- drawing ---------------- */
    function fitCanvas(){ scale = Fun.fit(canvas, W, H, scale, 2); }
    function flat(r, fill, z){
      const pts = [[r[0], r[1]], [r[0] + r[2], r[1]], [r[0] + r[2], r[1] + r[3]], [r[0], r[1] + r[3]]];
      ctx.beginPath(); pts.forEach(([x, y], i) => { const [sx, sy] = proj(x, y, z); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    }
    function block(r, top, side, h){
      const z = h || WALL_H, x1 = r[0], y2 = r[1] + r[3], x2 = r[0] + r[2];
      // the front face, then the top
      const a = proj(x1, y2, 0), b = proj(x2, y2, 0), c = proj(x2, y2, z), d = proj(x1, y2, z);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fillStyle = side; ctx.fill();
      flat(r, top, z);
      ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1.5; ctx.stroke();
      // studs on top, the Roblox way
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      for (let x = r[0] + 4; x < r[0] + r[2] - 2; x += 8) for (let y = r[1] + 4; y < r[1] + r[3] - 2; y += 8) { const [sx, sy, k] = proj(x, y, z); ctx.fillRect(sx - k * 0.8, sy - k * 0.5, k * 1.6, k); }
    }
    function drawCourse(){
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#7cc8ff"); g.addColorStop(0.3, "#bfe6ff"); g.addColorStop(0.31, "#4a9a3a"); g.addColorStop(1, "#3c7f2f");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // blocky clouds
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      [[120, 30], [420, 18], [760, 36]].forEach(([x, y], i) => { const o = (clock * (6 + i * 3)) % (W + 200) - 100; ctx.fillRect((x + o) % (W + 200) - 100, y, 90, 22); ctx.fillRect((x + o) % (W + 200) - 70, y - 12, 50, 14); });
      // the turf, with a mown stripe pattern and studs
      flat([0, 0, CW, CH], "#38c25a");
      for (let x = 0; x < CW; x += 40) flat([x, 0, 20, CH], "rgba(255,255,255,0.06)");
      if (hole.hill) hole.hill.forEach(r => {
        flat(r, "rgba(20,90,30,0.35)");
        ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) { const y = r[1] + 20 + ((clock * 20 + i * 35) % (r[3] - 25)), x = r[0] + r[2] / 2, [a, b] = proj(x - 8, y), [c, d] = proj(x, y + 8), [e, f] = proj(x + 8, y); ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.lineTo(e, f); ctx.stroke(); }
        const [tx, ty] = proj(r[0] + r[2] / 2, r[1] + 6); ctx.fillStyle = "#fff"; ctx.font = "800 12px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillText("⬇ HILL ⬇", tx, ty);
      });
      if (hole.sand) hole.sand.forEach(r => { flat(r, "#f0d58a"); ctx.fillStyle = "rgba(160,120,40,0.35)"; for (let i = 0; i < 30; i++) { const [sx, sy] = proj(r[0] + (i * 37 % r[2]), r[1] + (i * 53 % r[3])); ctx.fillRect(sx, sy, 2, 2); } });
      if (hole.water) hole.water.forEach(r => {
        flat(r, "#2f8ff0");
        ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) { const y = r[1] + 8 + i * (r[3] - 16) / 5, x = r[0] + 10 + ((clock * 15 + i * 23) % (r[2] - 30)), [a, b] = proj(x, y), [c, d] = proj(x + 14, y); ctx.beginPath(); ctx.moveTo(a, b); ctx.quadraticCurveTo((a + c) / 2, b - 3, c, d); ctx.stroke(); }
      });
      if (hole.pads) hole.pads.forEach(r => {
        flat(r, `rgba(77,242,255,${0.45 + 0.25 * Math.sin(clock * 6)})`);
        ctx.fillStyle = "#fff"; ctx.font = "900 16px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const [sx, sy] = proj(r[0] + r[2] / 2, r[1] + r[3] / 2); ctx.fillText(r[4] > 0 ? "»»" : r[4] < 0 ? "««" : r[5] > 0 ? "▼" : "▲", sx, sy);
      });
      // the cup and its flag
      const [cx, cy, k] = proj(hole.cup[0], hole.cup[1]);
      ctx.fillStyle = "#0d1a0d"; ctx.beginPath(); ctx.ellipse(cx, cy, CUP * k, CUP * k * 0.62, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2; ctx.stroke();
      // the tee
      const [tx, ty, tk] = proj(hole.start[0], hole.start[1]);
      ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.beginPath(); ctx.ellipse(tx, ty, 6 * tk, 4 * tk, 0, 0, 7); ctx.fill();
    }
    function drawFlag(){
      const [cx, cy, k] = proj(hole.cup[0], hole.cup[1]), top = cy - 30 * k * 0.8, wave = Math.sin(clock * 5) * 3;
      ctx.strokeStyle = "#f4f4f4"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, top); ctx.stroke();
      ctx.fillStyle = "#ff3b30"; ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx + 26 + wave, top + 8); ctx.lineTo(cx, top + 17); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#14102c"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = "900 10px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillText(String(hi + 1), cx + 9, top + 9);
    }
    function drawBall(){
      if (state === "sunk" && sinkT > 0.2) return;
      const [sx, sy, k] = proj(ball.x, ball.y), r = R * k;
      ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(sx + r * 0.2, sy + r * 0.3, r, r * 0.55, 0, 0, 7); ctx.fill();
      const g = ctx.createRadialGradient(sx - r * 0.35, sy - r * 0.6, r * 0.1, sx, sy - r * 0.3, r);
      const look = Hub.cosmetic ? Hub.cosmetic("golfBall").colors : ["#ffffff", "#c9d2e3"];   // the shop can change your ball
      g.addColorStop(0, look[0]); g.addColorStop(1, look[1]);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy - r * 0.3, r, 0, 7); ctx.fill();
      ctx.strokeStyle = "#14102c"; ctx.lineWidth = 1.5; ctx.stroke();
    }
    function drawAim(){
      if (state !== "aim") return;
      const pw = drag ? drag.power : power, len = 14 + pw * 70;
      const dx = Math.cos(aim), dy = Math.sin(aim);
      ctx.fillStyle = "#ffffff";
      for (let i = 1; i <= 8; i++) {
        const s = i / 8 * len, [sx, sy, k] = proj(ball.x + dx * s, ball.y + dy * s);
        ctx.globalAlpha = 1 - i / 10; ctx.beginPath(); ctx.arc(sx, sy, k * 0.9, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (pw > 0) {
        const [sx, sy] = proj(ball.x, ball.y);
        ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(sx - 32, sy + 16, 64, 9);
        ctx.fillStyle = pw > 0.8 ? "#ff4b3a" : pw > 0.45 ? "#ffe14d" : "#38d96b"; ctx.fillRect(sx - 31, sy + 17, 62 * pw, 7);
      }
    }
    function draw(dt){
      fitCanvas();
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawCourse();
      // blocks and the ball, farthest first
      // every wall, cut down to a low rim where it lies outside the course
      const items = allWalls().map(r => {
        const x1 = Math.max(r[0], -6), y1 = Math.max(r[1], -6), x2 = Math.min(r[0] + r[2], CW + 6), y2 = Math.min(r[1] + r[3], CH + 6);
        const edge = r[0] < 0 || r[0] >= CW || r[1] < 0 || r[1] >= CH;
        return { y: y2, d: () => block([x1, y1, x2 - x1, y2 - y1], "#8a8fa8", "#5c6178", edge ? 4 : WALL_H) };
      });
      if (hole.slider) { const s = sliderRect(); items.push({ y: s[1] + s[3], d: () => block(s, "#ffb000", "#c47f00", 9) }); }
      items.push({ y: ball.y, d: drawBall });
      items.push({ y: hole.cup[1] + 0.1, d: drawFlag });
      if (hole.spin) {
        const sp = hole.spin;
        items.push({ y: sp.y + 1, d: () => {
          const b = spinBar(), [ax, ay] = proj(b.ax, b.ay, 6), [bx, by] = proj(b.bx, b.by, 6), [hx, hy, k] = proj(sp.x, sp.y, 6);
          ctx.lineCap = "round"; ctx.strokeStyle = "#14102c"; ctx.lineWidth = b.w * 2 * k + 3; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
          ctx.strokeStyle = "#ff4df0"; ctx.lineWidth = b.w * 2 * k; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.lineCap = "butt";
          ctx.fillStyle = "#ffe14d"; ctx.beginPath(); ctx.arc(hx, hy, 2.5 * k, 0, 7); ctx.fill();
        } });
      }
      items.sort((a, b) => a.y - b.y).forEach(it => it.d());
      drawAim();
      fx.draw(ctx, dt);
      if (status) {
        ctx.font = '800 16px "Bricolage Grotesque", system-ui, sans-serif'; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,0.55)"; ctx.fillStyle = "#fff";
        ctx.strokeText(status, CX, 520); ctx.fillText(status, CX, 520);
      }
    }
    let lastHud = "";
    function hud(){
      const done = card.slice(0, hi).reduce((s, v) => s + v, 0), parDone = HOLES.slice(0, hi).reduce((s, h) => s + h.par, 0), d = done - parDone;
      const t = `${hi}|${strokes}|${d}`;
      if (t === lastHud) return; lastHud = t;
      holeEl.textContent = `Hole ${hi + 1}/9`; strokeEl.textContent = `Par ${hole.par} · ${strokes}`; totalEl.textContent = d === 0 ? "±0" : (d > 0 ? "+" : "") + d;
    }
    function loop(now){
      if (!open) return;
      const dt = Fun.dt(now, last);
      last = now;
      if (running) update(dt); else clock += dt;
      draw(dt); hud();
      requestAnimationFrame(loop);
    }

    /* ---------------- starting and leaving ---------------- */
    function start(){ card = []; loadHole(0); running = true; panel.hidden = true; canvas.focus(); }
    function openGame(){
      open = true; running = false; card = []; loadHole(0); state = "ready"; status = "";
      Fun.screen(overlay, true);
      panelTitle.textContent = "⛳ Blox Mini Golf";
      panelText.textContent = `Nine crazy-golf holes, par ${PAR}. Drag back and let go to putt, like a slingshot. Dodge the windmill and the sliding block, keep out of the sand and the water, and use the speed pads!`
        + (store.golfBest ? ` Your best round: ${store.golfBest}.` : "");
      playBtn.textContent = "▶ Play"; panel.hidden = false;
      last = performance.now(); requestAnimationFrame(loop); playBtn.focus();
    }
    function closeGame(){ open = false; running = false; Fun.screen(overlay, false); }

    /* ---------------- controls ---------------- */
    const canPutt = () => running && state === "aim";
    window.addEventListener("keydown", e => {
      if (!open) return;
      if (e.key === "Escape") { Hub.leave(); return; }
      if (!canPutt()) return;
      if (e.code === "Space") { e.preventDefault(); if (!e.repeat) { charging = true; power = 0; } return; }
      if (e.code === "ArrowLeft" || e.code === "KeyA") { e.preventDefault(); keys.left = true; }
      if (e.code === "ArrowRight" || e.code === "KeyD") { e.preventDefault(); keys.right = true; }
    });
    window.addEventListener("keyup", e => {
      if (e.code === "Space" && open && charging) { charging = false; if (canPutt() && power > 0.04) putt(aim, power); else power = 0; return; }
      if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
    });
    window.addEventListener("blur", () => { keys.left = keys.right = false; charging = false; drag = null; });
    const local = e => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
    // slingshot: drag back from anywhere, the ball goes the other way
    canvas.addEventListener("pointerdown", e => {
      if (!canPutt()) return;
      e.preventDefault(); canvas.setPointerCapture(e.pointerId);
      drag = { p0: unproj(...local(e)), power: 0 };
    });
    canvas.addEventListener("pointermove", e => {
      if (!drag) return;
      const p = unproj(...local(e)), vx = drag.p0[0] - p[0], vy = drag.p0[1] - p[1], l = Math.hypot(vx, vy);
      if (l > 2) aim = Math.atan2(vy, vx);
      drag.power = clamp((l - 2) / 70, 0, 1);
    });
    canvas.addEventListener("pointerup", () => { const d = drag; drag = null; if (d && canPutt() && d.power > 0.03) putt(aim, d.power); });
    canvas.addEventListener("pointercancel", () => { drag = null; });
    canvas.tabIndex = 0;
    $("mgCloseBtn").addEventListener("click", () => Hub.leave());
    Fun.soundButton($("mgCloseBtn"));
    playBtn.addEventListener("click", start);
    window.__golf = { get state(){ return state; }, get hole(){ return hi; }, get strokes(){ return strokes; }, ball: () => ball, putt: (a, p) => putt(a, p), card: () => card, load: i => loadHole(i) };

    return { open: openGame, close: closeGame };
  }
})();
