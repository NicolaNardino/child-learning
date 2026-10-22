/* Parkour Run: a first-person 3D obby high up in the sky, seen through your own eyes. Jump across orange, yellow, blue, green and black
   blocks that climb up and drop down, don't touch the red kill bricks, and reach the trophy.
   Fall off or touch red and you go back to your last checkpoint flag. */
(function(){
  "use strict";
  const store = Hub.store;
  const fmtTime = s => Math.floor(s / 60) + ":" + (s % 60).toFixed(1).padStart(4, "0");

  Hub.register({
    id: "parkour", section: "games", title: "Parkour Run", icon: "🧗",
    blurb: "Jump across colourful blocks high in the sky. Don't touch the red kill bricks!",
    stat: () => store.parkourBest ? "Best: " + fmtTime(store.parkourBest) : "",
    badges: [
      { id: "parkour1",   icon: "🧗", name: "Parkour Pro",  desc: "Finish Parkour Run",                    test: () => (store.parkourWins || 0) >= 1 },
      { id: "parkour120", icon: "💨", name: "Speed Runner", desc: "Finish Parkour Run in under 2 minutes", test: () => (store.parkourBest || Infinity) < 120 }
    ],
    mount
  });

  /* ---------------- the course: x is left/right, y is up, z is forward ---------------- */
  const COLOURS = { orange: "#ff8a1f", yellow: "#ffd21f", blue: "#2f7bff", green: "#2fcf4f", black: "#2a2e38", red: "#ff2b2b", gold: "#ffc928" };
  const BLOCKS = [], CHECKPOINTS = [];
  let finish = null;

  // a block, given the middle of its top: x, z, how high the top is, width (x) and depth (z)
  function block(x, z, top, w, d, colour, more){
    const th = (more && more.th) || 1;
    const b = Object.assign({ min: [x - w / 2, top - th, z - d / 2], max: [x + w / 2, top, z + d / 2], colour, kind: "block" }, more);
    BLOCKS.push(b);
    return b;
  }
  const kill = (x, z, top, w, d) => block(x, z, top, w, d, "red", { kind: "kill", th: 0.4 });
  const checkpoint = (x, z, top, colour) => {
    const b = block(x, z, top, 5, 5, colour, { kind: "check", stage: CHECKPOINTS.length });
    CHECKPOINTS.push(b);
    return b;
  };

  // start
  checkpoint(0, 0, 0, "green");
  // 1. rainbow steps going up
  block(0, 7, 0.5, 3, 3, "orange");
  block(2, 12, 1.5, 3, 3, "yellow");
  block(0, 17, 2.5, 3, 3, "blue");
  block(-2, 22, 3.5, 3, 3, "green");
  block(0, 27, 4.5, 3, 3, "orange");
  checkpoint(0, 33, 5, "black");
  // 2. a long black path with kill bricks to jump over
  block(0, 43, 5, 3, 14, "black");
  kill(0, 39, 5.4, 3, 1);
  kill(0, 43, 5.4, 3, 1);
  kill(0, 47, 5.4, 3, 1);
  block(0, 53, 5, 3, 3, "blue");
  checkpoint(0, 59.5, 4, "yellow");
  // 3. steps going down
  block(0, 66, 3, 3, 3, "blue");
  block(-1.5, 71, 1.5, 4, 3, "green");
  kill(-1.5, 71, 1.9, 1, 1);       // a little kill brick in the middle: land on the sides!
  block(0, 76, 0, 3, 3, "orange");
  block(1.5, 81, -1.5, 3, 3, "yellow");
  checkpoint(0, 87, -2, "black");
  // 4. skinny beams with a turn
  block(0, 95, -2, 1, 8, "black");
  block(3, 101, -2, 7, 1, "orange");
  block(6, 107, -2, 1, 10, "yellow");
  checkpoint(6, 116.5, -2, "green");
  // 5. a spiral tower going up around a black pillar
  block(6, 126, 12, 2, 2, "black", { th: 16 });
  ["orange", "yellow", "blue", "green", "black", "orange", "yellow", "blue", "green", "black"].forEach((colour, k) => {
    const ang = -Math.PI / 2 + k * 0.96;
    block(6 + Math.cos(ang) * 3.4, 126 + Math.sin(ang) * 3.4, -0.8 + k * 1.2, 2, 2, colour);
  });
  checkpoint(10.5, 134, 10.5, "blue");
  // 6. a big drop onto a floor of kill bricks, with stepping stones across
  block(10.5, 151, 2, 10, 22, "black");
  kill(10.5, 153, 2.4, 10, 8);
  block(8.5, 150.5, 3.4, 2, 2, "yellow");
  block(12.5, 153, 3.4, 2, 2, "orange");
  block(9, 155.5, 3.4, 2, 2, "green");
  // 7. the last climb to the trophy
  block(10.5, 166, 3.5, 3, 3, "orange");
  block(10.5, 171, 5, 3, 3, "blue");
  block(10.5, 176, 6.5, 3, 3, "green");
  finish = block(10.5, 183, 7, 6, 6, "gold", { kind: "finish" });

  /* ---------------- running and jumping ---------------- */
  const GRAVITY = 30, JUMP_SPEED = 11, RUN_SPEED = 7.5, HALF = 0.4, HEIGHT = 2, FALL_LIMIT = -14;
  function newPlayer(cp){
    return { x: (cp.min[0] + cp.max[0]) / 2, y: cp.max[1], z: (cp.min[2] + cp.max[2]) / 2,
      vx: 0, vy: 0, vz: 0, onGround: true, support: cp, coyote: 0, jumpBuf: 0, face: 0, walk: 0 };
  }
  const boxOf = p => ({ min: [p.x - HALF, p.y, p.z - HALF], max: [p.x + HALF, p.y + HEIGHT, p.z + HALF] });
  function touches(a, b, pad){
    for (let i = 0; i < 3; i++) if (a.max[i] <= b.min[i] - pad || a.min[i] >= b.max[i] + pad) return false;
    return true;
  }
  function approach(v, target, step){ return v < target ? Math.min(v + step, target) : Math.max(v - step, target); }
  // move along one axis, then push back out of any block we ran into
  function slide(p, axis, delta){
    if (!delta) return;
    const key = "xyz"[axis];
    p[key] += delta;
    BLOCKS.forEach(b => {
      if (!touches(boxOf(p), b, 0)) return;
      if (axis === 1) {
        if (delta < 0) { p.y = b.max[1]; p.onGround = true; p.support = b; } else p.y = b.min[1] - HEIGHT;
        p.vy = 0;
      } else p[key] = delta > 0 ? b.min[axis] - HALF - 1e-4 : b.max[axis] + HALF + 1e-4;
    });
  }
  // one step: move is the direction to run in the world (length 0 to 1)
  function stepPlayer(p, dt, move, jumpHeld, jumpPressed){
    p.jumpBuf = jumpPressed ? 0.15 : Math.max(0, p.jumpBuf - dt);   // a jump pressed just before landing still counts
    p.coyote = p.onGround ? 0.1 : Math.max(0, p.coyote - dt);      // and so does one just after running off the edge
    const accel = p.onGround ? 70 : 35;
    p.vx = approach(p.vx, move[0] * RUN_SPEED, accel * dt);
    p.vz = approach(p.vz, move[1] * RUN_SPEED, accel * dt);
    if (p.jumpBuf > 0 && p.coyote > 0) { p.vy = JUMP_SPEED; p.jumpBuf = 0; p.coyote = 0; }
    if (!jumpHeld && p.vy > 5) p.vy = 5; // let go early for a small hop
    p.vy = Math.max(p.vy - GRAVITY * dt, -32);
    p.onGround = false; p.support = null;
    for (let i = 0; i < 4; i++) { // small steps, so you can't fall through a thin kill brick
      slide(p, 0, p.vx * dt / 4); slide(p, 2, p.vz * dt / 4); slide(p, 1, p.vy * dt / 4);
    }
    if (move[0] || move[1]) {
      const want = Math.atan2(move[0], move[1]);
      const diff = ((want - p.face) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      p.face += diff * Math.min(1, dt * 12);
      if (p.onGround) p.walk += dt * 11;
    }
  }
  const touchingKill = p => BLOCKS.some(b => b.kind === "kill" && touches(boxOf(p), b, 0.05));

  /* ---------------- the game screen ---------------- */
  function mount(host){
    host.innerHTML = `
    <section class="game-screen" id="pkOverlay" hidden aria-label="Parkour Run">
      <div class="game-box">
        <div class="game-hud">
          <h2>🧗 Parkour Run</h2>
          <span class="mono game-stat" id="pkTime">⏱ 0:00.0</span>
          <span class="mono game-stat" id="pkStage">🚩 0 / ${CHECKPOINTS.length - 1}</span>
          <span class="mono game-stat" id="pkDeaths">💀 0</span>
          <button class="btn ghost small" id="pkCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas id="pkCanvas" width="960" height="540"></canvas>
          <div class="game-panel pk-panel" id="pkPanel">
            <div class="game-panel-title" id="pkPanelTitle">Parkour Run</div>
            <div class="game-panel-text" id="pkPanelText"></div>
            <button class="btn" id="pkPlayBtn" type="button">▶ Play</button>
          </div>
        </div>
        <div class="game-help">Click the game to look around with the mouse · W A S D to run · ← → or Q E to turn · Space to jump · R to go back to your flag · Esc lets go of the mouse</div>
        <div class="game-touch">
          <button class="btn ghost fun-dpad" data-pkey="left" type="button" aria-label="Turn left">↶</button>
          <button class="btn ghost fun-dpad" data-pkey="up" type="button" aria-label="Run forward">▲</button>
          <button class="btn ghost fun-dpad" data-pkey="down" type="button" aria-label="Back up">▼</button>
          <button class="btn ghost fun-dpad" data-pkey="right" type="button" aria-label="Turn right">↷</button>
          <button class="btn" data-pkey="jump" type="button" aria-label="Jump">JUMP</button>
        </div>
      </div>
    </section>`;

    const overlay = document.getElementById("pkOverlay");
    const canvas = document.getElementById("pkCanvas");
    const ctx = canvas.getContext("2d");
    const panel = document.getElementById("pkPanel");
    const panelTitle = document.getElementById("pkPanelTitle");
    const panelText = document.getElementById("pkPanelText");
    const playBtn = document.getElementById("pkPlayBtn");
    const timeEl = document.getElementById("pkTime");
    const stageEl = document.getElementById("pkStage");
    const deathsEl = document.getElementById("pkDeaths");

    const W = 960, H = 540;
    // the camera is your eyes, looking a little down so you can see where your feet will land
    const FOCAL = 520, NEAR = 0.12, EYE = 1.7, PITCH = 0.32, TURN = 2.4;
    const SIN_P = Math.sin(PITCH), COS_P = Math.cos(PITCH);
    const HORIZON = H / 2 - FOCAL * Math.tan(PITCH);
    const LIGHT = (() => { const l = [0.35, 0.85, -0.4], n = Math.hypot(...l); return l.map(v => v / n); })();

    let open = false, running = false, last = 0, clock = 0;
    let player = newPlayer(CHECKPOINTS[0]), stage = 0, deaths = 0, runTime = 0, deadT = 0;
    let flash = { text: "", t: 0 };
    const keys = { left: false, right: false, up: false, down: false, strafeL: false, strafeR: false, jump: false };
    let jumpQueued = false;
    const fx = Fun.pops();
    let frameDt = 1 / 60, deathText = "Oof!", screamed = false;
    const cam = { x: 0, y: 0, z: 0, a: 0, s: 0, c: 1 };

    /* ----- the camera is your head: it bobs as you run and dips when you land ----- */
    function placeCamera(dt){
      cam.s = Math.sin(cam.a); cam.c = Math.cos(cam.a);
      const run = Math.hypot(player.vx, player.vz) / RUN_SPEED;
      const bob = player.onGround ? Math.abs(Math.sin(player.walk * 0.5)) * 0.07 * run : 0;
      cam.x = player.x; cam.z = player.z;
      cam.y = player.y + EYE + bob - ((player.squash || 1) - 1) * 0.5;
    }
    function camSpace(x, y, z){
      const dx = x - cam.x, dz = z - cam.z, h = y - cam.y;
      const rx = dx * cam.c - dz * cam.s, fd = dx * cam.s + dz * cam.c;
      return [rx, h * COS_P + fd * SIN_P, fd * COS_P - h * SIN_P];
    }
    const toScreen = q => [W / 2 + q[0] * FOCAL / q[2], H / 2 - q[1] * FOCAL / q[2]];

    // a flat shape in the world: cut off where it goes behind the camera, then drawn as a path
    function polyPath(worldPts){
      const pts = worldPts.map(q => camSpace(q[0], q[1], q[2])), out = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length], ain = a[2] >= NEAR, bin = b[2] >= NEAR;
        if (ain) out.push(a);
        if (ain !== bin) { const t = (NEAR - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]); }
      }
      if (out.length < 3) return false;
      ctx.beginPath();
      out.forEach((q, i) => { const [sx, sy] = toScreen(q); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
      ctx.closePath();
      return true;
    }
    const shadeCache = new Map();
    function shade(hex, f){
      const key = hex + f.toFixed(2);
      if (!shadeCache.has(key)) {
        const n = parseInt(hex.slice(1), 16);
        const ch = v => Math.round(Math.min(255, v * f));
        shadeCache.set(key, `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`);
      }
      return shadeCache.get(key);
    }
    const lightFor = n => 0.55 + 0.45 * Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);

    /* ----- blocks ----- */
    function drawBlock(b){
      let colour = COLOURS[b.colour];
      if (b.kind === "kill") colour = Math.sin(clock * 6) > 0 ? "#ff2b2b" : "#ff5340"; // kill bricks glow
      const black = b.colour === "black";
      const camP = [cam.x, cam.y, cam.z];
      for (let ax = 0; ax < 3; ax++) for (let side = 0; side < 2; side++) {
        // only the faces turned toward the camera
        if (side ? camP[ax] <= b.max[ax] : camP[ax] >= b.min[ax]) continue;
        const v = side ? b.max[ax] : b.min[ax], u = (ax + 1) % 3, w = (ax + 2) % 3;
        const corner = (cu, cw) => { const q = [0, 0, 0]; q[ax] = v; q[u] = cu; q[w] = cw; return q; };
        const pts = [corner(b.min[u], b.min[w]), corner(b.max[u], b.min[w]), corner(b.max[u], b.max[w]), corner(b.min[u], b.max[w])];
        if (!polyPath(pts)) continue;
        const n = [0, 0, 0]; n[ax] = side ? 1 : -1;
        ctx.fillStyle = shade(colour, lightFor(n) * (black && ax === 1 && side ? 1.25 : 1));
        ctx.fill();
        ctx.strokeStyle = black ? "#5b6274" : b.kind === "kill" ? "#ffd0c8" : shade(colour, 0.62);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        if (ax === 1 && side && b === shadowOn) { ctx.save(); ctx.clip(); drawShadow(b.max[1]); ctx.restore(); }
      }
      if (b.kind === "check" && b.stage > 0) drawFlag(b);
      if (b.kind === "finish") drawTrophy(b);
    }
    function drawShadow(top){
      const near = Math.max(0, 1 - (player.y - top) / 10), pts = [];
      for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; pts.push([player.x + Math.cos(a) * 0.5, top + 0.01, player.z + Math.sin(a) * 0.5]); }
      if (!polyPath(pts)) return;
      ctx.fillStyle = `rgba(0,0,0,${0.15 + 0.3 * near})`;
      ctx.fill();
    }
    function drawFlag(b){
      const x = (b.min[0] + b.max[0]) / 2 + 1.6, z = (b.min[2] + b.max[2]) / 2 + 1.6, y = b.max[1];
      const reached = stage >= b.stage, wave = Math.sin(clock * 5 + b.stage) * 0.12;
      const p0 = camSpace(x, y, z), p1 = camSpace(x, y + 2.6, z);
      if (p0[2] < NEAR || p1[2] < NEAR) return;
      const [x0, y0] = toScreen(p0), [x1, y1] = toScreen(p1);
      ctx.strokeStyle = "#e9edf5"; ctx.lineWidth = Math.max(1.5, 0.1 * FOCAL / p1[2]);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      if (!polyPath([[x, y + 2.6, z], [x + 1.1, y + 2.25 + wave, z], [x, y + 1.9, z]])) return;
      ctx.fillStyle = reached ? "#2fcf4f" : "#ffffff"; ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1; ctx.stroke();
    }
    function drawTrophy(b){
      const q = camSpace((b.min[0] + b.max[0]) / 2, b.max[1] + 1.3 + Math.sin(clock * 2.5) * 0.2, (b.min[2] + b.max[2]) / 2);
      if (q[2] < NEAR) return;
      const [sx, sy] = toScreen(q), size = 2.2 * FOCAL / q[2];
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, size);
      glow.addColorStop(0, "rgba(255,240,150,0.7)"); glow.addColorStop(1, "rgba(255,240,150,0)");
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(sx, sy, size, 0, Math.PI * 2); ctx.fill();
      ctx.font = `${Math.round(size)}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("🏆", sx, sy);
      ctx.textBaseline = "alphabetic";
    }
    // your two hands at the bottom of the screen, pumping as you run and thrown up when you jump
    function drawHands(){
      const run = Math.hypot(player.vx, player.vz) / RUN_SPEED, sw = Math.sin(player.walk * 0.5) * run;
      const air = player.onGround ? 0 : Math.min(1, Math.abs(player.vy) / 10);
      [-1, 1].forEach(side => {
        const x = W / 2 + side * (300 - air * 40), y = H + 15 - air * 70 + side * sw * 38;
        ctx.save(); ctx.translate(x, y); ctx.rotate(side * (0.5 - air * 0.3));
        // the sleeve
        ctx.fillStyle = "#2f8a4a"; ctx.beginPath(); ctx.ellipse(0, 70, 62, 80, 0, 0, 7); ctx.fill();
        // the hand
        const g = ctx.createRadialGradient(-side * 10, -20, 5, 0, 0, 60);
        g.addColorStop(0, "#f6cba6"); g.addColorStop(1, "#b77c55");
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 44, 54, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(side * 40, 4, 14, 26, side * 0.6, 0, 7); ctx.fill();   // thumb
        ctx.strokeStyle = "rgba(120,70,40,0.45)"; ctx.lineWidth = 2;
        [-18, -4, 10].forEach(fx0 => { ctx.beginPath(); ctx.moveTo(fx0, -50); ctx.lineTo(fx0 + 2, -26); ctx.stroke(); });
        ctx.restore();
      });
    }
    // where a spot in the world is on the screen (or null when it's behind the camera)
    function popOver(text, colour, size){ fx.pop(text, W / 2, H * 0.36, colour, size || 34); }

    /* ----- painting far to near: a block goes in front when the camera is on its side of the gap between them ----- */
    function frontOf(a, b, camP){
      for (let ax = 0; ax < 3; ax++) {
        if (a.max[ax] <= b.min[ax] + 1e-6) return camP[ax] < a.max[ax] ? 1 : camP[ax] > b.min[ax] ? -1 : 0;
        if (b.max[ax] <= a.min[ax] + 1e-6) return camP[ax] < b.max[ax] ? -1 : camP[ax] > a.min[ax] ? 1 : 0;
      }
      return a.dist < b.dist ? 1 : -1; // they overlap: nearer goes in front
    }
    function paintOrder(items){
      const camP = [cam.x, cam.y, cam.z], n = items.length;
      const indeg = new Array(n).fill(0), after = items.map(() => []), done = new Array(n).fill(false), out = [];
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const A = items[i].sb, B = items[j].sb;
        if (A[2] < B[0] || B[2] < A[0] || A[3] < B[1] || B[3] < A[1]) continue; // not overlapping on screen
        const o = frontOf(items[i], items[j], camP);
        if (o > 0) { after[j].push(i); indeg[i]++; } else if (o < 0) { after[i].push(j); indeg[j]++; }
      }
      for (let k = 0; k < n; k++) {
        let pick = -1;
        for (let i = 0; i < n; i++) if (!done[i] && indeg[i] === 0 && (pick < 0 || items[i].dist > items[pick].dist)) pick = i;
        if (pick < 0) for (let i = 0; i < n; i++) if (!done[i] && (pick < 0 || items[i].dist > items[pick].dist)) pick = i;
        done[pick] = true; out.push(items[pick]);
        after[pick].forEach(j => indeg[j]--);
      }
      return out;
    }
    function screenBox(min, max){
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < 8; i++) {
        const q = camSpace(i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]);
        if (q[2] < NEAR) return [-Infinity, -Infinity, Infinity, Infinity]; // partly behind us: could be anywhere
        const [sx, sy] = toScreen(q);
        x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy);
      }
      return [x0, y0, x1, y1];
    }

    /* ----- the sky: everything behind the blocks ----- */
    // a seeded random, so the sky looks the same every run
    function skySeed(seed){ return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
    const SUN_ANG = 0.95;
    // puffy clouds in two layers: the near ones are bigger and slide past the far ones as you turn
    const CLOUDS = (() => {
      const rnd = skySeed(23), list = [];
      for (let i = 0; i < 17; i++) {
        const near = i % 3 === 0;
        list.push({
          ang: i * 0.37 + rnd() * 0.3,
          y: 8 + rnd() * (near ? 150 : 90),
          w: (near ? 64 : 34) + rnd() * 44,
          drift: near ? 0.015 : 0.006,
          // a few blobs stuck together make a lumpier cloud than one ellipse
          lobes: Array.from({ length: 4 + Math.floor(rnd() * 3) }, () => [rnd() * 2 - 1, rnd(), 0.34 + rnd() * 0.4])
        });
      }
      return list.sort((a, b) => a.w - b.w); // small ones first, so the big ones sit in front
    })();
    // the sea of cloud below: bunched up thick around the mountains, thinning out further down
    const BANKS = (() => {
      const rnd = skySeed(29), list = [];
      for (let i = 0; i < 30; i++) {
        const t = rnd();
        list.push({
          ang: i * 0.21 + rnd() * 0.2,
          y: HORIZON + 86 + t * t * 330,
          w: 70 + t * 150 + rnd() * 60,
          a: 0.5 - t * 0.28,
          lobes: Array.from({ length: 3 + Math.floor(rnd() * 3) }, () => [rnd() * 2 - 1, rnd() * 2 - 1, 0.3 + rnd() * 0.5])
        });
      }
      return list.sort((a, b) => a.y - b.y); // the ones up near the mountains are farthest, so they go first
    })();
    // thin streaks of cloud, just to give the empty air some texture
    const WISPS = Array.from({ length: 14 }, (_, i) => ({ ang: i * 0.45, y: HORIZON + 60 + (i * 71) % 400, w: 110 + (i * 37) % 170, a: 0.05 + (i % 4) * 0.02 }));
    const BIRDS = Array.from({ length: 8 }, (_, i) => ({ ang: i * 0.81, y: 46 + (i * 43) % 130, s: 5 + (i % 3) * 2.5, sp: 0.018 + (i % 4) * 0.005 }));
    const BALLOONS = [
      { ang: 2.0, y: 150, s: 30, cols: ["#ff5a5a", "#ffe14d"] },
      { ang: 4.5, y: 92,  s: 20, cols: ["#2fcf4f", "#2f7bff"] }
    ];
    // little islands floating out in the distance, each with a tree on top
    const ISLES = [
      { ang: 1.35, y: HORIZON + 150, s: 46 },
      { ang: 3.10, y: HORIZON + 96,  s: 26 },
      { ang: 5.00, y: HORIZON + 190, s: 112, fall: true },
      { ang: 6.05, y: HORIZON + 128, s: 34 }
    ];

    function skyX(ang){
      const d = ((ang - cam.a) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      return Math.abs(d) < 1.3 ? W / 2 + Math.tan(d) * FOCAL : null;
    }
    // a zig-zag wave: sharp tops and V-shaped valleys, far more mountain-like than a sine
    function zig(t){ const u = ((t / Math.PI) % 2 + 2) % 2; return 1 - 2 * Math.abs(u - 1); }
    // jagged peaks standing up out of the cloud sea; layer 1 is the far, paler range
    const FAR_BASE = HORIZON + 71, NEAR_BASE = HORIZON + 113;
    function ridgeY(ang, layer){
      return layer
        ? FAR_BASE  - (14 + 16 * zig(ang * 17 + 1.7) + 11 * zig(ang * 41 + 0.6) + 6 * zig(ang * 93 + 2.2))
        : NEAR_BASE - (16 + 21 * zig(ang * 13 + 0.4) + 14 * zig(ang * 33 + 1.9) + 8 * zig(ang * 71 + 0.9));
    }
    // walk a ridge across the screen, so it slides past properly as you turn
    function sweep(layer, yAt){
      ctx.beginPath();
      for (let x = 0; x <= W; x += 3) {
        const y = yAt(ridgeY(cam.a + Math.atan((x - W / 2) / FOCAL), layer));
        x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
    }
    function drawRidge(layer, colour, fade, line, snowY, fadeY){
      // the bottom of the range fades out instead of stopping in a straight line
      const g = ctx.createLinearGradient(0, HORIZON, 0, fadeY);
      g.addColorStop(0, colour); g.addColorStop(0.55, colour); g.addColorStop(1, fade);
      ctx.fillStyle = g;
      sweep(layer, y => y);
      ctx.lineTo(W, fadeY); ctx.lineTo(0, fadeY); ctx.closePath(); ctx.fill();
      // snow, but only on the very tops that poke above the snow line
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      sweep(layer, y => Math.min(snowY, y));
      ctx.lineTo(W, snowY); ctx.lineTo(0, snowY); ctx.closePath(); ctx.fill();
      // the faintest line along the ridge, just to keep the peaks crisp against the sky
      ctx.strokeStyle = line; ctx.lineWidth = 1;
      sweep(layer, y => y); ctx.stroke();
    }
    function drawPuffy(c){
      const x = skyX(c.ang + clock * c.drift);
      if (x === null) return;
      const bob = Math.sin(clock * 0.4 + c.ang) * 2;
      // the shaded underside first, then the bright top on top of it
      [[6, "rgba(170,202,238,0.8)"], [0, "rgba(255,255,255,0.93)"]].forEach(([drop, col]) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        c.lobes.forEach(([ox, oy, r]) => ctx.ellipse(x + ox * c.w * 0.5, c.y + bob + drop - oy * c.w * 0.26, r * c.w * 0.5, r * c.w * 0.3, 0, 0, Math.PI * 2));
        ctx.fill();
      });
    }
    function drawBank(c){
      const x = skyX(c.ang - clock * 0.006);
      if (x === null) return;
      const y = c.y + Math.sin(clock * 0.3 + c.ang) * 3;
      ctx.fillStyle = `rgba(255,255,255,${c.a * 0.6})`;
      ctx.beginPath();
      c.lobes.forEach(([ox, oy, r]) => ctx.ellipse(x + ox * c.w * 0.55, y + oy * 7, r * c.w * 0.6, r * c.w * 0.16, 0, 0, Math.PI * 2));
      ctx.fill();
      // a brighter lip along the top, like the sun catching the cloud
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, c.a + 0.22)})`;
      ctx.beginPath();
      c.lobes.forEach(([ox, oy, r]) => ctx.ellipse(x + ox * c.w * 0.55, y + oy * 7 - r * c.w * 0.07, r * c.w * 0.5, r * c.w * 0.08, 0, 0, Math.PI * 2));
      ctx.fill();
    }
    // water pouring off the edge of an island and falling away into the haze
    function fallPath(x, y, w, len){
      ctx.beginPath();
      ctx.moveTo(x - w * 0.5, y); ctx.lineTo(x + w * 0.5, y);
      ctx.lineTo(x + w * 0.95, y + len); ctx.lineTo(x - w * 0.95, y + len);
      ctx.closePath();
    }
    function drawFall(x, y, s){
      const w = s * 0.4, len = s * 4.6;
      const g = ctx.createLinearGradient(0, y, 0, y + len);
      g.addColorStop(0, "rgba(255,255,255,0.98)");
      g.addColorStop(0.35, "rgba(176,226,255,0.92)");
      g.addColorStop(1, "rgba(176,226,255,0)"); // it never lands, it just fades into the air
      ctx.fillStyle = g;
      fallPath(x, y, w, len); ctx.fill();
      // streaks running down the water, so you can see it moving
      ctx.save();
      fallPath(x, y, w, len); ctx.clip();
      const alpha = ctx.globalAlpha;
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < 7; i++) {
        const t = (clock * 0.5 + i / 7) % 1;
        ctx.globalAlpha = alpha * (1 - t) * 0.7;
        ctx.fillRect(x - w * (0.42 - i % 3 * 0.12), y + t * len, w * 0.2, s * 0.3);
      }
      ctx.restore();
      // spray where the water breaks up on the way down
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      for (let i = 0; i < 4; i++) {
        const t = 0.55 + i * 0.12, r = s * (0.14 + t * 0.16);
        ctx.beginPath();
        ctx.ellipse(x + Math.sin(clock * 1.4 + i * 2) * s * 0.07, y + t * len, r, r * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    function drawIsle(o){
      const x = skyX(o.ang + clock * 0.002);
      if (x === null) return;
      const y = o.y + Math.sin(clock * 0.5 + o.ang) * 4, s = o.s;
      ctx.globalAlpha = 0.45 + s / 170; // the little ones are further off, so they're fainter
      // a chunk of rock hanging down to a point
      ctx.fillStyle = "#6e6377";
      ctx.beginPath();
      ctx.moveTo(x - s * 0.5, y); ctx.lineTo(x + s * 0.5, y);
      ctx.lineTo(x + s * 0.2, y + s * 0.52); ctx.lineTo(x - s * 0.05, y + s * 0.88); ctx.lineTo(x - s * 0.32, y + s * 0.44);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.18)"; // shaded right-hand side
      ctx.beginPath();
      ctx.moveTo(x + s * 0.08, y); ctx.lineTo(x + s * 0.5, y); ctx.lineTo(x + s * 0.2, y + s * 0.52); ctx.lineTo(x - s * 0.05, y + s * 0.88);
      ctx.closePath(); ctx.fill();
      if (o.fall) drawFall(x - s * 0.4, y - s * 0.04, s);
      // grass on top, and a little tree
      ctx.fillStyle = "#3fae56";
      ctx.beginPath(); ctx.ellipse(x, y, s * 0.5, s * 0.14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#5ccb72";
      ctx.beginPath(); ctx.ellipse(x - s * 0.08, y - s * 0.04, s * 0.33, s * 0.08, 0, 0, Math.PI * 2); ctx.fill();
      if (o.fall) {
        ctx.fillStyle = "#bfeaff";
        ctx.beginPath(); ctx.ellipse(x - s * 0.32, y - s * 0.05, s * 0.2, s * 0.06, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.beginPath(); ctx.ellipse(x - s * 0.32, y - s * 0.08, s * 0.14, s * 0.035, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = "#5a4030"; ctx.fillRect(x + s * 0.15, y - s * 0.26, s * 0.05, s * 0.26);
      ctx.fillStyle = "#2f8f44";
      ctx.beginPath(); ctx.arc(x + s * 0.175, y - s * 0.33, s * 0.14, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    function drawBird(b){
      const x = skyX(b.ang + clock * b.sp);
      if (x === null) return;
      const y = b.y + Math.sin(clock * 0.8 + b.ang) * 4, flap = Math.sin(clock * 7 + b.ang * 3) * b.s * 0.55;
      ctx.beginPath();
      ctx.moveTo(x - b.s, y - flap);
      ctx.quadraticCurveTo(x - b.s * 0.4, y + 1.5, x, y);
      ctx.quadraticCurveTo(x + b.s * 0.4, y + 1.5, x + b.s, y - flap);
      ctx.stroke();
    }
    function drawBalloon(b){
      const x = skyX(b.ang + clock * 0.003);
      if (x === null) return;
      const y = b.y + Math.sin(clock * 0.6 + b.ang) * 7, s = b.s;
      ctx.fillStyle = b.cols[0];
      ctx.beginPath(); ctx.ellipse(x, y, s * 0.58, s * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = b.cols[1]; // a stripe down the middle
      ctx.beginPath(); ctx.ellipse(x, y, s * 0.2, s * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.beginPath(); ctx.ellipse(x, y + s * 0.34, s * 0.5, s * 0.3, 0, 0, Math.PI); ctx.fill();
      ctx.strokeStyle = "rgba(60,50,40,0.8)"; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.22, y + s * 0.62); ctx.lineTo(x - s * 0.14, y + s * 0.92);
      ctx.moveTo(x + s * 0.22, y + s * 0.62); ctx.lineTo(x + s * 0.14, y + s * 0.92);
      ctx.stroke();
      ctx.fillStyle = "#8a5a32"; ctx.fillRect(x - s * 0.16, y + s * 0.9, s * 0.32, s * 0.24);
    }
    function drawSky(){
      // more colour bands than a plain gradient, so the air has some depth to it
      const hz = Math.min(0.9, Math.max(0.04, HORIZON / H));
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#1b63d8");
      g.addColorStop(hz * 0.5, "#4a93f0");
      g.addColorStop(hz, "#cce6ff");
      g.addColorStop(Math.min(0.99, hz + 0.07), "#e7f3ff");
      g.addColorStop(0.5, "#9cc7ef");
      g.addColorStop(1, "#5e9bdd");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      // the sun, with rays and a wide glow around it
      const sx = skyX(SUN_ANG);
      if (sx !== null) {
        ctx.save();
        ctx.translate(sx, 44);
        ctx.fillStyle = "rgba(255,246,190,0.13)";
        for (let i = 0; i < 10; i++) {
          ctx.rotate(Math.PI / 5 + 0.02 * Math.sin(clock * 0.5 + i));
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-13, -230); ctx.lineTo(13, -230); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
        const glow = ctx.createRadialGradient(sx, 44, 8, sx, 44, 190);
        glow.addColorStop(0, "rgba(255,248,206,0.9)"); glow.addColorStop(0.3, "rgba(255,240,170,0.28)"); glow.addColorStop(1, "rgba(255,240,170,0)");
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(sx, 44, 190, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fffce8"; ctx.beginPath(); ctx.arc(sx, 44, 24, 0, Math.PI * 2); ctx.fill();
      }

      // far clouds go behind the mountains
      CLOUDS.forEach(c => { if (c.drift < 0.01) drawPuffy(c); });

      // two mountain ranges, standing up out of the cloud sea far below the course
      drawRidge(1, "#8fa9cd", "rgba(143,169,205,0)", "rgba(234,244,255,0.45)", HORIZON + 48, HORIZON + 160);
      drawRidge(0, "#55719e", "rgba(85,113,158,0)", "rgba(200,221,247,0.3)", HORIZON + 81, HORIZON + 250);

      // islands drifting out there, then the cloud sea rolling in over everything's feet
      ISLES.forEach(drawIsle);
      BANKS.forEach(drawBank);

      // thin streaks in the open air below
      ctx.fillStyle = "#fff";
      WISPS.forEach(w => {
        const x = skyX(w.ang - clock * 0.004);
        if (x === null) return;
        ctx.globalAlpha = w.a;
        ctx.beginPath(); ctx.ellipse(x, w.y + Math.sin(clock * 0.2 + w.ang) * 2, w.w, w.w * 0.035, 0, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;

      // near clouds float in front of the mountains
      CLOUDS.forEach(c => { if (c.drift >= 0.01) drawPuffy(c); });

      // hot air balloons, and birds doing laps
      BALLOONS.forEach(drawBalloon);
      ctx.strokeStyle = "rgba(40,55,80,0.65)"; ctx.lineWidth = 1.6; ctx.lineCap = "round";
      BIRDS.forEach(drawBird);
      ctx.lineCap = "butt";

      // a band of haze on the horizon, and the air going thicker toward the bottom
      const haze = ctx.createLinearGradient(0, HORIZON - 16, 0, HORIZON + 60);
      haze.addColorStop(0, "rgba(255,255,255,0)"); haze.addColorStop(0.4, "rgba(240,249,255,0.4)"); haze.addColorStop(1, "rgba(240,249,255,0)");
      ctx.fillStyle = haze; ctx.fillRect(0, HORIZON - 16, W, 76);
      const deep = ctx.createLinearGradient(0, H * 0.6, 0, H);
      deep.addColorStop(0, "rgba(90,150,210,0)"); deep.addColorStop(1, "rgba(70,130,200,0.35)");
      ctx.fillStyle = deep; ctx.fillRect(0, H * 0.6, W, H * 0.4);
    }

    let shadowOn = null; // the block your shadow lands on
    function draw(){
      fitCanvas();
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawSky();
      shadowOn = null;
      BLOCKS.forEach(b => {
        if (player.x < b.min[0] || player.x > b.max[0] || player.z < b.min[2] || player.z > b.max[2] || b.max[1] > player.y + 0.01) return;
        if (!shadowOn || b.max[1] > shadowOn.max[1]) shadowOn = b;
      });
      const items = [];
      BLOCKS.forEach(b => {
        const dist = Math.hypot((b.min[0] + b.max[0]) / 2 - cam.x, (b.min[1] + b.max[1]) / 2 - cam.y, (b.min[2] + b.max[2]) / 2 - cam.z);
        if (dist > 90) return;
        const sb = screenBox(b.min, b.max);
        if (sb[2] < 0 || sb[0] > W || sb[3] < 0 || sb[1] > H) return;
        items.push({ min: b.min, max: b.max, dist, sb, draw: () => drawBlock(b) });
      });
      paintOrder(items).forEach(it => {
        ctx.globalAlpha = Math.max(0.15, Math.min(1, (90 - it.dist) / 30)); // far blocks fade into the haze
        it.draw();
      });
      ctx.globalAlpha = 1;
      drawHands();
      // falling fast: the edges of your eyes blur with wind
      if (player.vy < -14) {
        const k = Math.min(1, (-player.vy - 14) / 14), v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.6);
        v.addColorStop(0, "rgba(255,255,255,0)"); v.addColorStop(1, `rgba(230,240,255,${0.5 * k})`);
        ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
      }

      fx.draw(ctx, frameDt);
      if (deadT > 0) {
        ctx.fillStyle = `rgba(255,40,40,${Math.min(0.45, deadT * 0.6)})`; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#fff"; ctx.font = "800 64px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center";
        ctx.fillText(deathText, W / 2, H / 2);
      }
      if (flash.t > 0) {
        ctx.globalAlpha = Math.min(1, flash.t * 2);
        ctx.fillStyle = "#fff"; ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 5;
        ctx.font = "800 34px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center";
        ctx.strokeText(flash.text, W / 2, 58); ctx.fillText(flash.text, W / 2, 58);
        ctx.globalAlpha = 1;
      }
    }
    let scale = 1;
    function fitCanvas(){ scale = Fun.fit(canvas, W, H, scale, 3); }

    /* ----- playing ----- */
    function respawn(){
      const cp = CHECKPOINTS[stage];
      player = newPlayer(cp);
      cam.a = 0;
      placeCamera(0);
    }
    function die(kill){
      if (deadT > 0) return;
      deaths++;
      deadT = 0.8;
      deathText = kill ? ["ZAPPED!", "Ouchie!", "Hot hot hot!", "Bzzzt!"][deaths % 4] : ["Oof!", "Whoopsie!", "Not again!", "SPLAT!", "Wheee… oops"][deaths % 5];
      fx.burst(W / 2, H / 2, kill ? "#ff5a4a" : "#ffd21f", 22, 260);
      Fun.shake(canvas);
      if (kill) Fun.sfx.zap(); else Fun.sfx.wah();
    }
    function step(dt){
      runTime += dt;
      if (flash.t > 0) flash.t -= dt;
      if (deadT > 0) {
        deadT -= dt;
        if (deadT <= 0) { deadT = 0; respawn(); }
        jumpQueued = false;
        return;
      }
      Fun.stickKeys(stick, keys, { left: "left", right: "right", up: "up", down: "down" });
      cam.a += ((keys.right ? 1 : 0) - (keys.left ? 1 : 0)) * TURN * dt;
      const fwd = (keys.up ? 1 : 0) - (keys.down ? 1 : 0), side = (keys.strafeR ? 1 : 0) - (keys.strafeL ? 1 : 0);
      let mx = Math.sin(cam.a) * fwd + Math.cos(cam.a) * side, mz = Math.cos(cam.a) * fwd - Math.sin(cam.a) * side;
      const len = Math.hypot(mx, mz);
      if (len > 1) { mx /= len; mz /= len; }
      const wasGround = player.onGround, vyBefore = player.vy;
      stepPlayer(player, dt, [mx, mz], keys.jump, jumpQueued);
      jumpQueued = false;
      if (player.vy > 8 && vyBefore <= 0.01) { player.squash = 0.8; Fun.sfx.pop(); }
      if (!wasGround && player.onGround) {
        screamed = false;
        if (vyBefore < -12) {
          player.squash = 1.35;
          fx.burst(W / 2, H - 40, "rgba(255,255,255,0.9)", 10, 120, 40);
        }
      }
      if (!screamed && player.vy < -22) { screamed = true; popOver("AAAAH!", "#ffffff", 30); }
      player.squash = (player.squash || 1) + (1 - (player.squash || 1)) * Math.min(1, dt * 12);
      if (touchingKill(player)) { die(true); return; }
      if (player.y < FALL_LIMIT) { die(false); return; }
      const on = player.onGround && player.support;
      if (on && on.kind === "check" && on.stage > stage) {
        stage = on.stage;
        flash = { text: `🚩 Checkpoint ${stage}!`, t: 1.8 };
        popOver("CHECKPOINT! 🎉", "#7bd68a", 32); Fun.sfx.tada();
        fx.burst(W / 2, H * 0.6, "#7bd68a", 20, 220);
      }
      if (on === finish) win();
    }
    function updateHud(){
      timeEl.textContent = "⏱ " + fmtTime(runTime);
      stageEl.textContent = `🚩 ${stage} / ${CHECKPOINTS.length - 1}`;
      deathsEl.textContent = "💀 " + deaths;
    }
    function loop(now){
      if (!open) return;
      const dt = Fun.dt(now, last);
      last = now; frameDt = dt;
      clock += dt;
      if (running) step(dt);
      placeCamera(dt);
      draw();
      updateHud();
      requestAnimationFrame(loop);
    }

    function reset(){
      stage = 0; deaths = 0; runTime = 0; deadT = 0;
      flash = { text: "", t: 0 };
      respawn();
    }
    function start(){
      reset();
      running = true;
      panel.hidden = true;
      Fun.release(keys);
      flash = { text: "Go! Reach the 🏆", t: 2 };
      canvas.focus();
    }
    function win(){
      running = false;
      letGo();
      Fun.sfx.tada(); popOver("YOU DID IT! 🏆", "#ffe14d", 40);
      store.parkourWins = (store.parkourWins || 0) + 1;
      const best = !store.parkourBest || runTime < store.parkourBest;
      if (best) store.parkourBest = runTime;
      Hub.saveStore();
      Hub.checkBadges();
      panelTitle.textContent = "🏆 You made it!";
      panelText.textContent = `Your time: ${fmtTime(runTime)}, with ${deaths} ${deaths === 1 ? "oof" : "oofs"}.`
        + (best ? " That's a new best! 🎉" : ` Your best is ${fmtTime(store.parkourBest)}.`);
      playBtn.textContent = "▶ Play again";
      panel.hidden = false;
      Hub.confettiBurst(playBtn); Hub.confettiBurst(playBtn);
      playBtn.focus();
    }
    function openGame(){
      open = true;
      running = false;
      reset();
      Fun.screen(overlay, true);
      panelTitle.textContent = "🧗 Parkour Run";
      panelText.textContent = "You're up in the sky, seeing it all through your own eyes! Click to look around with the mouse, jump across the blocks and reach the trophy. Don't touch the red kill bricks. If you fall or touch red, you go back to your last 🚩 flag."
        + (store.parkourBest ? ` Your best: ${fmtTime(store.parkourBest)}.` : "");
      playBtn.textContent = "▶ Play";
      panel.hidden = false;
      last = performance.now();
      requestAnimationFrame(loop);
      playBtn.focus();
    }
    function closeGame(){
      open = false;
      running = false;
      letGo();
      Fun.screen(overlay, false);
    }

    const KEYMAP = {
      ArrowLeft: "left", KeyQ: "left", ArrowRight: "right", KeyE: "right",
      ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
      KeyA: "strafeL", KeyD: "strafeR", Space: "jump"
    };
    function setKey(k, down){
      if (k === "jump" && down && !keys.jump) jumpQueued = true;
      keys[k] = down;
    }
    window.addEventListener("keydown", e => {
      if (!open) return;
      // Esc first lets the mouse go (the browser does that); only an Esc after that leaves the game
      if (e.key === "Escape") { if (looking() || performance.now() - unlockedAt < 400) { if (looking()) document.exitPointerLock(); return; } Hub.leave(); return; }
      if (e.code === "KeyR" && running && deadT <= 0) { respawn(); return; }
      const k = KEYMAP[e.code];
      if (!k || !running) return;
      e.preventDefault();
      setKey(k, true);
    });
    window.addEventListener("keyup", e => {
      const k = KEYMAP[e.code];
      if (k) keys[k] = false;
    });
    window.addEventListener("blur", () => Fun.release(keys));
    // click with the mouse and it turns your head (until Esc); on a touch screen, drag to turn
    const looking = () => document.pointerLockElement === canvas;
    let unlockedAt = 0;
    const tip = Fun.hint(canvas.parentElement);
    document.addEventListener("pointerlockchange", () => {
      if (looking()) tip.show("🖱️ Press Esc to get your mouse back");
      else { unlockedAt = performance.now(); tip.hide(); }
    });
    let dragX = null;
    const stick = Fun.joystick(canvas.parentElement);   // on phones: left and right turn, up and down run
    canvas.addEventListener("pointerdown", e => {
      if (e.pointerType === "mouse" && running && !looking() && canvas.requestPointerLock) {
        try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) {}
        return;
      }
      dragX = e.clientX; canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", e => {
      if (looking()) { if (running) cam.a += e.movementX * 0.0032; return; }
      if (dragX === null) return;
      cam.a += (e.clientX - dragX) / canvas.clientWidth * 4;
      dragX = e.clientX;
    });
    const letGo = () => { if (looking()) document.exitPointerLock(); };
    ["pointerup", "pointercancel"].forEach(ev => canvas.addEventListener(ev, () => { dragX = null; }));
    host.querySelectorAll("[data-pkey]").forEach(btn => {
      const k = btn.dataset.pkey;
      btn.addEventListener("pointerdown", e => { e.preventDefault(); setKey(k, true); });
      ["pointerup", "pointercancel", "pointerleave"].forEach(ev => btn.addEventListener(ev, () => { keys[k] = false; }));
    });
    canvas.tabIndex = 0;

    document.getElementById("pkCloseBtn").addEventListener("click", () => Hub.leave());
    Fun.soundButton(document.getElementById("pkCloseBtn"));
    playBtn.addEventListener("click", start);

    return { open: openGame, close: closeGame };
  }
})();
