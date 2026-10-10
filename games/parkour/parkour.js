/* Parkour Run: a 3D obby high up in the sky. Jump across orange, yellow, blue, green and black
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
        <div class="game-help">← → or A D to turn (or drag the screen) · ↑ W to run · ↓ S to back up · Q E to sidestep · Space to jump · R to go back to your flag</div>
        <div class="game-touch">
          <button class="btn ghost" data-pkey="left" type="button" aria-label="Turn left">↶</button>
          <button class="btn ghost" data-pkey="up" type="button" aria-label="Run forward">▲</button>
          <button class="btn ghost" data-pkey="down" type="button" aria-label="Back up">▼</button>
          <button class="btn ghost" data-pkey="right" type="button" aria-label="Turn right">↷</button>
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
    const FOCAL = 620, NEAR = 0.2, CAM_BACK = 8, CAM_UP = 4.6, PITCH = 0.36, TURN = 2.4;
    const SIN_P = Math.sin(PITCH), COS_P = Math.cos(PITCH);
    const HORIZON = H / 2 - FOCAL * Math.tan(PITCH);
    const LIGHT = (() => { const l = [0.35, 0.85, -0.4], n = Math.hypot(...l); return l.map(v => v / n); })();

    let open = false, running = false, last = 0, clock = 0;
    let player = newPlayer(CHECKPOINTS[0]), stage = 0, deaths = 0, runTime = 0, deadT = 0;
    let flash = { text: "", t: 0 };
    const keys = { left: false, right: false, up: false, down: false, strafeL: false, strafeR: false, jump: false };
    let jumpQueued = false;
    const cam = { x: 0, y: 0, z: 0, a: 0, s: 0, c: 1 };

    /* ----- the camera follows behind you ----- */
    function placeCamera(dt){
      cam.s = Math.sin(cam.a); cam.c = Math.cos(cam.a);
      cam.x = player.x - cam.s * CAM_BACK;
      cam.z = player.z - cam.c * CAM_BACK;
      const wantY = player.y + CAM_UP;
      cam.y = dt ? cam.y + (wantY - cam.y) * Math.min(1, dt * 7) : wantY; // smooth out the jumps
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

    /* ----- you: a blocky runner made of little boxes that turn with you ----- */
    function drawPart(lx, ly, lz, w, h, d, colour, face){
      const p = player, c = Math.cos(p.face), s = Math.sin(p.face);
      const world = (x, y, z) => [p.x + x * c + z * s, p.y + y, p.z - x * s + z * c];
      const X = [lx - w / 2, lx + w / 2], Y = [ly, ly + h], Z = [lz - d / 2, lz + d / 2];
      const sides = [
        { n: [1, 0, 0], q: [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]] }, { n: [-1, 0, 0], q: [[0, 0, 1], [0, 0, 0], [0, 1, 0], [0, 1, 1]] },
        { n: [0, 1, 0], q: [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]] }, { n: [0, -1, 0], q: [[0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 0, 0]] },
        { n: [0, 0, 1], q: [[1, 0, 1], [0, 0, 1], [0, 1, 1], [1, 1, 1]], front: true }, { n: [0, 0, -1], q: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]] }
      ];
      sides.forEach(f => {
        const wn = [f.n[0] * c + f.n[2] * s, f.n[1], -f.n[0] * s + f.n[2] * c];
        const mid = world(f.n[0] ? X[(f.n[0] + 1) / 2] : lx, f.n[1] ? Y[(f.n[1] + 1) / 2] : ly + h / 2, f.n[2] ? Z[(f.n[2] + 1) / 2] : lz);
        if (wn[0] * (cam.x - mid[0]) + wn[1] * (cam.y - mid[1]) + wn[2] * (cam.z - mid[2]) <= 0) return;
        if (!polyPath(f.q.map(([i, j, k]) => world(X[i], Y[j], Z[k])))) return;
        ctx.fillStyle = shade(colour, lightFor(wn)); ctx.fill();
        ctx.strokeStyle = shade(colour, 0.6); ctx.lineWidth = 1; ctx.stroke();
        if (f.front && face) face(world, lz + d / 2 + 0.01);
      });
    }
    function drawPlayer(){
      if (deadT > 0) return;
      const swing = player.onGround ? Math.sin(player.walk) * 0.2 : 0.15;
      const parts = [
        [-0.18, 0, swing, 0.34, 0.8, 0.4, "#2fa84f"],          // legs
        [0.18, 0, -swing, 0.34, 0.8, 0.4, "#2fa84f"],
        [0, 0.8, 0, 0.8, 0.8, 0.45, "#2f6fd6"],                // body
        [-0.56, 0.85, -swing, 0.3, 0.75, 0.38, "#ffd21f"],     // arms
        [0.56, 0.85, swing, 0.3, 0.75, 0.38, "#ffd21f"],
        [0, 1.6, 0, 0.52, 0.5, 0.5, "#ffd21f", drawFace]       // head
      ];
      // farthest part first
      parts.map(pt => ({ pt, z: camSpace(player.x + pt[0] * Math.cos(player.face) + pt[2] * Math.sin(player.face), player.y + pt[1] + pt[4] / 2, player.z - pt[0] * Math.sin(player.face) + pt[2] * Math.cos(player.face))[2] }))
        .sort((a, b) => b.z - a.z)
        .forEach(({ pt }) => drawPart(...pt));
    }
    function drawFace(world, fz){
      ctx.fillStyle = "#1b1f2a";
      [[-0.11, 1.9], [0.11, 1.9]].forEach(([x, y]) => {
        if (polyPath([world(x - 0.04, y - 0.05, fz), world(x + 0.04, y - 0.05, fz), world(x + 0.04, y + 0.05, fz), world(x - 0.04, y + 0.05, fz)])) ctx.fill();
      });
      if (polyPath([world(-0.13, 1.75, fz), world(0.13, 1.75, fz), world(0.08, 1.7, fz), world(-0.08, 1.7, fz)])) ctx.fill();
    }

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

    /* ----- the sky ----- */
    const CLOUDS = Array.from({ length: 9 }, (_, i) => ({ ang: i * 0.7, y: 18 + (i * 37) % 60, w: 50 + (i * 23) % 50 }));
    const BELOW = Array.from({ length: 12 }, (_, i) => ({ ang: i * 0.53, y: HORIZON + 40 + (i * 53) % 260, w: 90 + (i * 41) % 90 }));
    function skyX(ang){
      const d = ((ang - cam.a) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      return Math.abs(d) < 1.3 ? W / 2 + Math.tan(d) * FOCAL : null;
    }
    function drawSky(){
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#3d8bff"); g.addColorStop(Math.min(0.9, Math.max(0.05, HORIZON / H)), "#bfe0ff"); g.addColorStop(1, "#7fb6f0");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      CLOUDS.forEach(c => {
        const x = skyX(c.ang + clock * 0.01);
        if (x === null) return;
        ctx.beginPath(); ctx.ellipse(x, c.y, c.w, c.w * 0.25, 0, 0, Math.PI * 2); ctx.ellipse(x + c.w * 0.3, c.y - 8, c.w * 0.45, c.w * 0.22, 0, 0, Math.PI * 2); ctx.fill();
      });
      // a sea of clouds far below you
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      BELOW.forEach(c => {
        const x = skyX(c.ang - clock * 0.006);
        if (x === null) return;
        ctx.beginPath(); ctx.ellipse(x, c.y, c.w, c.w * 0.22, 0, 0, Math.PI * 2); ctx.fill();
      });
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
      const pMin = [player.x - 0.75, player.y, player.z - 0.75], pMax = [player.x + 0.75, player.y + 2.1, player.z + 0.75];
      items.push({ min: pMin, max: pMax, dist: CAM_BACK, sb: screenBox(pMin, pMax), draw: drawPlayer });
      paintOrder(items).forEach(it => {
        ctx.globalAlpha = Math.max(0.15, Math.min(1, (90 - it.dist) / 30)); // far blocks fade into the haze
        it.draw();
      });
      ctx.globalAlpha = 1;

      if (deadT > 0) {
        ctx.fillStyle = `rgba(255,40,40,${Math.min(0.45, deadT * 0.6)})`; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#fff"; ctx.font = "800 64px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center";
        ctx.fillText("Oof!", W / 2, H / 2);
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
    function fitCanvas(){
      const s = Math.min(3, Math.max(1, canvas.clientWidth * (window.devicePixelRatio || 1) / W));
      if (Math.abs(s - scale) < 0.01) return;
      scale = s;
      canvas.width = Math.round(W * s); canvas.height = Math.round(H * s);
    }

    /* ----- playing ----- */
    function respawn(){
      const cp = CHECKPOINTS[stage];
      player = newPlayer(cp);
      cam.a = 0;
      placeCamera(0);
    }
    function die(){
      if (deadT > 0) return;
      deaths++;
      deadT = 0.8;
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
      cam.a += ((keys.right ? 1 : 0) - (keys.left ? 1 : 0)) * TURN * dt;
      const fwd = (keys.up ? 1 : 0) - (keys.down ? 1 : 0), side = (keys.strafeR ? 1 : 0) - (keys.strafeL ? 1 : 0);
      let mx = Math.sin(cam.a) * fwd + Math.cos(cam.a) * side, mz = Math.cos(cam.a) * fwd - Math.sin(cam.a) * side;
      const len = Math.hypot(mx, mz);
      if (len > 1) { mx /= len; mz /= len; }
      stepPlayer(player, dt, [mx, mz], keys.jump, jumpQueued);
      jumpQueued = false;
      if (player.y < FALL_LIMIT || touchingKill(player)) { die(); return; }
      const on = player.onGround && player.support;
      if (on && on.kind === "check" && on.stage > stage) {
        stage = on.stage;
        flash = { text: `🚩 Checkpoint ${stage}!`, t: 1.8 };
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
      const dt = Math.min(1 / 30, (now - last) / 1000 || 0);
      last = now;
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
      Object.keys(keys).forEach(k => { keys[k] = false; });
      flash = { text: "Go! Reach the 🏆", t: 2 };
      canvas.focus();
    }
    function win(){
      running = false;
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
      overlay.hidden = false;
      document.body.style.overflow = "hidden";
      panelTitle.textContent = "🧗 Parkour Run";
      panelText.textContent = "Jump across the blocks high up in the sky and reach the trophy! Don't touch the red kill bricks. If you fall or touch red, you go back to your last 🚩 flag."
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
      overlay.hidden = true;
      document.body.style.overflow = "";
    }

    const KEYMAP = {
      ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
      ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
      KeyQ: "strafeL", KeyE: "strafeR", Space: "jump"
    };
    function setKey(k, down){
      if (k === "jump" && down && !keys.jump) jumpQueued = true;
      keys[k] = down;
    }
    window.addEventListener("keydown", e => {
      if (!open) return;
      if (e.key === "Escape") { Hub.leave(); return; }
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
    window.addEventListener("blur", () => Object.keys(keys).forEach(k => { keys[k] = false; }));
    // drag the screen to turn the camera
    let dragX = null;
    canvas.addEventListener("pointerdown", e => { dragX = e.clientX; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", e => {
      if (dragX === null) return;
      cam.a += (e.clientX - dragX) / canvas.clientWidth * 4;
      dragX = e.clientX;
    });
    ["pointerup", "pointercancel"].forEach(ev => canvas.addEventListener(ev, () => { dragX = null; }));
    host.querySelectorAll("[data-pkey]").forEach(btn => {
      const k = btn.dataset.pkey;
      btn.addEventListener("pointerdown", e => { e.preventDefault(); setKey(k, true); });
      ["pointerup", "pointercancel", "pointerleave"].forEach(ev => btn.addEventListener(ev, () => { keys[k] = false; }));
    });
    canvas.tabIndex = 0;

    document.getElementById("pkCloseBtn").addEventListener("click", () => Hub.leave());
    playBtn.addEventListener("click", start);

    return { open: openGame, close: closeGame };
  }
})();
