/* Tag Rush: a blocky tag game on a flat baseplate, like the ones on Roblox.
   You and 4 bots have to run from one safe zone to the other without getting tagged.
   Round 1 has 1 tagger, and every round adds one more. Get tagged (or run out of time) and it's over.
   The bots that get tagged are out until the next round. Jump over a tagger to dodge them! */
(function(){
  "use strict";
  const store = Hub.store;

  Hub.register({
    id: "tag-rush", section: "games", title: "Tag Rush", icon: "🏁",
    blurb: "Run across the baseplate with 4 bots. Every round there's one more tagger!",
    stat: () => store.tagRushBest ? "Best: " + store.tagRushBest + " rounds" : "",
    badges: [
      { id: "tagrush5",  icon: "🏁", name: "Rusher",       desc: "Clear 5 rounds in Tag Rush",  test: () => (store.tagRushBest || 0) >= 5 },
      { id: "tagrush10", icon: "⚡", name: "Untouchable", desc: "Clear 10 rounds in Tag Rush", test: () => (store.tagRushBest || 0) >= 10 }
    ],
    mount
  });

  /* ---------------- the field: x is across, z is along, y is up (in studs) ---------------- */
  const HALF_W = 15, END = 33, SAFE = 26;           // the safe zones are past z = ±26
  const ROUND_TIME = 20, MAX_TAGGERS = 12;
  const RUN = 8.6, BOT_RUN = 7.6, GRAVITY = 28, JUMP = 10, TAG_R = 1.25, JUMP_CLEAR = 1.3;
  const BOTS = [
    { name: "Noob_Max",  shirt: "#2fbf5a", pants: "#2a4d8f", head: "#ffd23f" },
    { name: "BloxLuna",  shirt: "#b46bff", pants: "#3a2a5a", head: "#f2c49b" },
    { name: "Turbo_Kai", shirt: "#ff9f1c", pants: "#333a48", head: "#a8704c" },
    { name: "PixelMia",  shirt: "#2fd0c0", pants: "#1f5f7a", head: "#ffd23f" }
  ];

  function mount(host){
    host.innerHTML = `
    <section class="game-screen" id="trOverlay" hidden aria-label="Tag Rush">
      <div class="game-box">
        <div class="game-hud">
          <h2>🏁 Tag Rush</h2>
          <span class="mono game-stat" id="trRound">Round 1</span>
          <span class="mono game-stat" id="trTaggers">🟥 ×1</span>
          <span class="mono game-stat" id="trTime">⏱ 20</span>
          <button class="btn ghost small" id="trCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas id="trCanvas" width="960" height="540"></canvas>
          <div class="game-panel tr-panel" id="trPanel">
            <div class="game-panel-title" id="trPanelTitle">Tag Rush</div>
            <div class="game-panel-text" id="trPanelText"></div>
            <button class="btn" id="trPlayBtn" type="button">▶ Play</button>
          </div>
        </div>
        <div class="game-help">W A S D or the arrow keys to run · Space to jump (jump over a tagger to dodge!) · get to the green side before the time runs out</div>
        <div class="game-touch">
          <button class="btn ghost" data-trkey="left" type="button" aria-label="Run left">◀</button>
          <button class="btn ghost" data-trkey="up" type="button" aria-label="Run forward">▲</button>
          <button class="btn ghost" data-trkey="down" type="button" aria-label="Run back">▼</button>
          <button class="btn ghost" data-trkey="right" type="button" aria-label="Run right">▶</button>
          <button class="btn" data-trkey="jump" type="button" aria-label="Jump">JUMP</button>
        </div>
      </div>
    </section>`;

    const $ = id => document.getElementById(id);
    const overlay = $("trOverlay"), canvas = $("trCanvas"), ctx = canvas.getContext("2d");
    const panel = $("trPanel"), panelTitle = $("trPanelTitle"), panelText = $("trPanelText"), playBtn = $("trPlayBtn");
    const roundEl = $("trRound"), taggersEl = $("trTaggers"), timeEl = $("trTime");

    const W = 960, H = 540;
    const FOCAL = 600, NEAR = 0.3, PITCH = 0.3, CAM_BACK = 10, CAM_UP = 6.5;
    const SIN_P = Math.sin(PITCH), COS_P = Math.cos(PITCH);
    const HORIZON = H / 2 - FOCAL * Math.tan(PITCH);
    const LIGHT = (() => { const l = [0.4, 0.85, -0.35], n = Math.hypot(...l); return l.map(v => v / n); })();

    let open = false, running = false, last = 0, clock = 0, frameDt = 1 / 60;
    let phase = "ready", phaseT = 0, round = 1, dir = 1, timeLeft = ROUND_TIME;
    let you = null, bots = [], taggers = [];
    let banner = { text: "", sub: "", t: 0 };
    const keys = { left: false, right: false, up: false, down: false, jump: false };
    const cam = { x: 0, y: 0, z: 0, a: 0, s: 0, c: 1 };
    const fx = Fun.pops();

    /* ----- the people: a body is a blocky avatar with a spot, a speed and a way it faces ----- */
    function makeBody(x, z, look, name){
      return { x, y: 0, z, vx: 0, vy: 0, vz: 0, face: dir > 0 ? 0 : Math.PI, walk: 0, safe: false, out: false, outT: 0, name, look, wait: 0, jitter: 0, wobble: Math.random() * 6 };
    }
    const startZ = () => -dir * (SAFE + 3);   // the middle of the safe zone you start in
    function placeRunner(b, i){
      b.x = -8 + i * 4 + (Math.random() - 0.5); b.z = startZ() + (Math.random() - 0.5) * 2;
      b.vx = b.vz = b.vy = 0; b.y = 0; b.face = dir > 0 ? 0 : Math.PI;
    }
    function placeTaggers(){
      taggers = [];
      const n = Math.min(MAX_TAGGERS, round);
      for (let i = 0; i < n; i++) {
        const x = n === 1 ? 0 : -HALF_W + 2 + (i / (n - 1)) * (HALF_W * 2 - 4);
        const z = (i % 2 ? 4 : -4) * (n > 4 ? 1 : 0.4) + (Math.random() - 0.5) * 3;
        const t = makeBody(x, z, { shirt: "#e8332b", pants: "#6b1410", head: "#ffd23f" }, "TAGGER");
        t.face = dir > 0 ? Math.PI : 0;
        t.speed = Math.min(8.4, 5.9 + round * 0.3) * (0.92 + Math.random() * 0.1);
        t.think = 0; t.target = null;
        taggers.push(t);
      }
    }
    function newRound(first){
      if (!first) { round++; dir = -dir; }
      phase = "ready"; phaseT = 2.6; timeLeft = ROUND_TIME;
      // runners who made it start where they are; everyone else goes back to the start
      [you, ...bots].forEach((b, i) => {
        const wasSafe = b.safe && !first;
        b.safe = false; b.out = false; b.outT = 0;
        if (!wasSafe) placeRunner(b, i);
        else { b.z = startZ() + (Math.random() - 0.5) * 2; b.vx = b.vz = 0; }
        b.wait = 0.1 + Math.random() * 1.2; b.lane = (Math.random() * 2 - 1) * (HALF_W - 3);
      });
      placeTaggers();
      banner = { text: `Round ${round}`, sub: round === 1 ? "1 tagger. Get to the green side!" : `${Math.min(MAX_TAGGERS, round)} taggers now! 😬`, t: 2.4 };
      if (running) Fun.sfx.beep();
    }
    function reset(){
      round = 1; dir = 1; clock = 0;
      you = makeBody(0, 0, { shirt: "#2f7bff", pants: "#2a2e38", head: "#ffd23f" }, "You");
      you.me = true;
      bots = BOTS.map(b => makeBody(0, 0, b, b.name));
      newRound(true);
      cam.a = 0;
    }

    /* ----- moving ----- */
    function keepIn(b, isTagger){
      b.x = Math.max(-HALF_W + 0.5, Math.min(HALF_W - 0.5, b.x));
      const lim = isTagger ? SAFE - 0.6 : END;
      b.z = Math.max(-lim, Math.min(lim, b.z));
    }
    function moveBody(b, wantX, wantZ, speed, dt){
      const len = Math.hypot(wantX, wantZ);
      const tx = len > 0.01 ? wantX / len * speed : 0, tz = len > 0.01 ? wantZ / len * speed : 0;
      const k = Math.min(1, dt * (b.y > 0 ? 4 : 12));    // you can't steer as well in the air
      b.vx += (tx - b.vx) * k; b.vz += (tz - b.vz) * k;
      b.x += b.vx * dt; b.z += b.vz * dt;
      b.vy -= GRAVITY * dt; b.y += b.vy * dt;
      if (b.y <= 0) { b.y = 0; b.vy = 0; }
      const sp = Math.hypot(b.vx, b.vz);
      if (sp > 0.5) {
        const want = Math.atan2(b.vx, b.vz), d = ((want - b.face) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        b.face += d * Math.min(1, dt * 12);
        if (b.y === 0) b.walk += dt * sp * 1.6;
      }
    }
    const jump = b => { if (b.y === 0) b.vy = JUMP; };
    const inStart = b => b.z * dir < -SAFE;
    const inGoal = b => b.z * dir > SAFE;

    function stepYou(dt){
      if (you.out) { you.vx *= 0.9; you.vz *= 0.9; return; }
      const fwd = (keys.up ? 1 : 0) - (keys.down ? 1 : 0), side = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      // forward is always toward the far side, the way the camera looks
      moveBody(you, side * dir, fwd * dir, RUN, dt);
      if (keys.jump) jump(you);
      if (phase === "ready") you.z = dir > 0 ? Math.min(you.z, -SAFE) : Math.max(you.z, SAFE);
      keepIn(you);
    }
    function stepBot(b, dt){
      if (b.out) { b.outT += dt; b.vx *= 0.9; b.vz *= 0.9; return; }
      if (phase === "ready" || (b.wait -= dt) > 0) { moveBody(b, 0, 0, BOT_RUN, dt); return; }
      if (b.safe) {   // made it: wander about in the safe zone and cheer
        moveBody(b, Math.sin(clock + b.wobble) * 0.3, dir * 0.15, 2, dt);
        if (Math.random() < dt * 0.4) jump(b);
        keepIn(b); return;
      }
      // run for the far side, along your own lane, swerving away from taggers that are close
      let wx = (b.lane - b.x) * 0.12, wz = dir;
      let danger = 0;
      taggers.forEach(t => {
        const dx = b.x - t.x, dz = b.z - t.z, d = Math.hypot(dx, dz);
        if (d > 8) return;
        const ahead = (t.z - b.z) * dir > -1.5;       // only the ones in front matter much
        const push = (8 - d) / 8 * (ahead ? 2.2 : 0.8);
        wx += dx / (d || 1) * push; wz += dz / (d || 1) * push * 0.5;
        danger = Math.max(danger, push);
        // a tagger right in the way and very close: jump over it!
        if (d < 2.4 && ahead && Math.random() < dt * 3) jump(b);
      });
      // don't run backwards into the start zone again
      if (wz * dir < 0.25) wz = dir * 0.25;
      b.jitter += (Math.random() - 0.5) * dt * 4; b.jitter *= 0.97;
      wx += b.jitter;
      if (Math.abs(b.x) > HALF_W - 2) wx -= Math.sign(b.x) * 1.5;
      moveBody(b, wx, wz, BOT_RUN * (danger > 1.2 ? 1.05 : 1), dt);
      keepIn(b);
    }
    function stepTagger(t, i, dt){
      if (phase === "ready") { moveBody(t, 0, 0, t.speed, dt); return; }
      // every so often pick who to chase: the closest runner still out on the field (two taggers spread out)
      t.think -= dt;
      if (t.think <= 0 || !t.target || t.target.safe || t.target.out) {
        t.think = 0.4 + Math.random() * 0.3;
        let best = null, bestD = Infinity;
        [you, ...bots].forEach(r => {
          if (r.out || r.safe) return;
          let d = Math.hypot(r.x - t.x, r.z - t.z);
          if (taggers.some((o, j) => j < i && o.target === r)) d += 6;   // somebody's already after them
          if (r.me) d -= 1.5;                                             // they like chasing you a little bit more
          if (d < bestD) { bestD = d; best = r; }
        });
        t.target = best;
      }
      const r = t.target;
      if (!r) { moveBody(t, (i % 3 - 1) * 0.3, -t.z * 0.2, t.speed * 0.5, dt); keepIn(t, true); return; }
      // aim a bit ahead of where they're running
      const d = Math.hypot(r.x - t.x, r.z - t.z), lead = Math.min(0.8, d / t.speed) * 0.7;
      moveBody(t, r.x + r.vx * lead - t.x, r.z + r.vz * lead - t.z, t.speed, dt);
      if (d < 2.6 && r.y > 0.4 && Math.random() < dt * 2) jump(t);   // jump up to catch a jumper
      keepIn(t, true);
    }
    function tagged(r){
      r.out = true;
      const sp = toScreenAt(r.x, 3.2, r.z);
      if (r.me) {
        if (sp) fx.pop("TAGGED!", sp[0], sp[1], "#ff4a3d", 44);
        Fun.shake(canvas); Fun.sfx.bonk();
        gameOver("tagged");
      } else {
        if (sp) fx.pop(["Tagged!", "Noooo!", "Got me!", "Oof!"][Math.floor(Math.random() * 4)], sp[0], sp[1], "#ffffff", 22);
        Fun.sfx.pop();
      }
    }

    function step(dt){
      clock += dt;
      if (banner.t > 0) banner.t -= dt;
      if (phase === "ready") {
        const before = Math.ceil(phaseT);
        phaseT -= dt;
        if (Math.ceil(phaseT) !== before && phaseT > 0) Fun.sfx.beep();
        if (phaseT <= 0) { phase = "run"; fx.pop("GO!", W / 2, H * 0.4, "#7bd68a", 60); Fun.sfx.zap(); }
      } else if (phase === "run") {
        timeLeft -= dt;
      } else if (phase === "between") {
        phaseT -= dt;
        if (phaseT <= 0) newRound(false);
      }
      stepYou(dt);
      bots.forEach(b => stepBot(b, dt));
      taggers.forEach((t, i) => stepTagger(t, i, dt));
      // nobody stands inside anybody else
      const all = [you, ...bots, ...taggers];
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
        if (d >= 0.9 || d === 0) continue;
        const p = (0.9 - d) / 2;
        a.x -= dx / d * p; a.z -= dz / d * p; b.x += dx / d * p; b.z += dz / d * p;
      }
      if (phase !== "run") return;
      // tags: a tagger touching a runner who isn't jumping clear over them
      [you, ...bots].forEach(r => {
        if (r.out || r.safe || !running) return;
        if (taggers.some(t => Math.hypot(t.x - r.x, t.z - r.z) < TAG_R && Math.abs(r.y - t.y) < JUMP_CLEAR)) tagged(r);
      });
      if (!running) return;
      // made it to the far side?
      [you, ...bots].forEach(r => {
        if (r.out || r.safe || !inGoal(r)) return;
        r.safe = true;
        const sp = toScreenAt(r.x, 3.2, r.z);
        if (r.me) { if (sp) fx.pop("SAFE! 🎉", sp[0], sp[1], "#7bd68a", 38); Fun.sfx.coin(); }
        else if (sp) fx.pop("Safe!", sp[0], sp[1], "#bff5c8", 18);
      });
      const left = [you, ...bots].filter(r => !r.out && !r.safe);
      if (timeLeft <= 0 && !you.safe) { gameOver("time"); return; }
      if (!left.length || timeLeft <= 0) {
        // round cleared: anybody still out on the field when time's up is out too
        left.forEach(r => { r.out = true; });
        phase = "between"; phaseT = 1.8;
        banner = { text: `Round ${round} cleared! ✅`, sub: `Next round: ${Math.min(MAX_TAGGERS, round + 1)} taggers`, t: 1.8 };
        Fun.sfx.tada();
        if (round > (store.tagRushBest || 0)) { store.tagRushBest = round; Hub.saveStore(); Hub.checkBadges(); }
      }
    }

    /* ----- 3D drawing: a camera up behind you, looking toward the far side ----- */
    function placeCamera(dt){
      const want = dir > 0 ? 0 : Math.PI;
      const d = ((want - cam.a) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      cam.a += d * Math.min(1, dt * 3);
      cam.s = Math.sin(cam.a); cam.c = Math.cos(cam.a);
      const tx = you.x - cam.s * CAM_BACK, tz = you.z - cam.c * CAM_BACK;
      const k = dt ? Math.min(1, dt * 8) : 1;
      cam.x += (tx - cam.x) * k; cam.z += (tz - cam.z) * k;
      cam.y += (you.y * 0.5 + CAM_UP - cam.y) * k;
    }
    function camSpace(x, y, z){
      const dx = x - cam.x, dz = z - cam.z, h = y - cam.y;
      const rx = dx * cam.c - dz * cam.s, fd = dx * cam.s + dz * cam.c;
      return [rx, h * COS_P + fd * SIN_P, fd * COS_P - h * SIN_P];
    }
    const toScreen = q => [W / 2 + q[0] * FOCAL / q[2], H / 2 - q[1] * FOCAL / q[2]];
    function toScreenAt(x, y, z){ const q = camSpace(x, y, z); return q[2] > NEAR ? toScreen(q) : null; }
    // a flat shape in the world, cut off where it goes behind the camera
    function polyPath(pts){
      const q = pts.map(p => camSpace(p[0], p[1], p[2])), out = [];
      for (let i = 0; i < q.length; i++) {
        const a = q[i], b = q[(i + 1) % q.length], ain = a[2] >= NEAR, bin = b[2] >= NEAR;
        if (ain) out.push(a);
        if (ain !== bin) { const t = (NEAR - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]); }
      }
      if (out.length < 3) return false;
      ctx.beginPath();
      out.forEach((p, i) => { const [sx, sy] = toScreen(p); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
      ctx.closePath();
      return true;
    }
    function line3(a, b){
      let p = camSpace(...a), q = camSpace(...b);
      if (p[2] < NEAR && q[2] < NEAR) return;
      if (p[2] < NEAR || q[2] < NEAR) {
        const t = (NEAR - p[2]) / (q[2] - p[2]), m = p.map((v, i) => v + (q[i] - v) * t);
        if (p[2] < NEAR) p = m; else q = m;
      }
      const s = toScreen(p), e = toScreen(q);
      ctx.moveTo(s[0], s[1]); ctx.lineTo(e[0], e[1]);
    }
    const shadeCache = new Map();
    function shade(hex, f){
      const key = hex + f.toFixed(2);
      if (!shadeCache.has(key)) {
        const n = parseInt(hex.slice(1), 16), ch = v => Math.round(Math.min(255, v * f));
        shadeCache.set(key, `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`);
      }
      return shadeCache.get(key);
    }

    function drawSky(){
      const g = ctx.createLinearGradient(0, 0, 0, HORIZON);
      g.addColorStop(0, "#3d8de0"); g.addColorStop(1, "#b9e1ff");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, HORIZON + 2);
      // blocky clouds drifting by
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      for (let k = 0; k < 7; k++) {
        const x = ((k * 190 + clock * 6 - cam.a * 300) % (W + 300) + W + 300) % (W + 300) - 150, y = 20 + (k * 41) % 90;
        ctx.fillRect(x, y, 90 + (k % 3) * 30, 22); ctx.fillRect(x + 20, y - 14, 50, 16);
      }
      ctx.fillStyle = "#9fd0f5"; ctx.fillRect(0, HORIZON, W, H - HORIZON);
    }
    function drawGround(){
      // the big grey baseplate, and the field painted on it
      if (polyPath([[-70, 0, -90], [70, 0, -90], [70, 0, 90], [-70, 0, 90]])) { ctx.fillStyle = "#a3a8ad"; ctx.fill(); }
      if (polyPath([[-HALF_W, 0, -END - 1], [HALF_W, 0, -END - 1], [HALF_W, 0, END + 1], [-HALF_W, 0, END + 1]])) { ctx.fillStyle = "#4fae4a"; ctx.fill(); }
      const zone = (z0, z1, col) => { if (polyPath([[-HALF_W, 0.01, z0], [HALF_W, 0.01, z0], [HALF_W, 0.01, z1], [-HALF_W, 0.01, z1]])) { ctx.fillStyle = col; ctx.fill(); } };
      // where you start is blue, where you're going is bright green with a flashing edge
      zone(-dir * (END + 1), -dir * SAFE, "#3f7fd8");
      zone(dir * SAFE, dir * (END + 1), Math.sin(clock * 5) > 0 ? "#7fe07a" : "#6fd36a");
      // the studs: a grid of little lines, like a Roblox baseplate
      ctx.strokeStyle = "rgba(0,0,0,0.08)"; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = -HALF_W; x <= HALF_W; x += 2) line3([x, 0.02, -END - 1], [x, 0.02, END + 1]);
      for (let z = -END - 1; z <= END + 1; z += 2) line3([-HALF_W, 0.02, z], [HALF_W, 0.02, z]);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 3; ctx.beginPath();
      [-SAFE, SAFE].forEach(z => line3([-HALF_W, 0.03, z], [HALF_W, 0.03, z]));
      line3([-HALF_W, 0.03, 0], [HALF_W, 0.03, 0]);
      ctx.stroke();
      // low walls down both sides
      [-1, 1].forEach(s => {
        const x = s * HALF_W, xo = s * (HALF_W + 0.8);
        if (polyPath([[x, 0, -END - 1], [x, 1, -END - 1], [x, 1, END + 1], [x, 0, END + 1]])) { ctx.fillStyle = "#6b7280"; ctx.fill(); }
        if (polyPath([[x, 1, -END - 1], [xo, 1, -END - 1], [xo, 1, END + 1], [x, 1, END + 1]])) { ctx.fillStyle = "#9aa1ab"; ctx.fill(); }
      });
      // shadows under everybody
      [you, ...bots, ...taggers].forEach(b => {
        const r = 0.7 / (1 + b.y * 0.3), pts = [];
        for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; pts.push([b.x + Math.cos(a) * r, 0.02, b.z + Math.sin(a) * r]); }
        if (polyPath(pts)) { ctx.fillStyle = `rgba(0,0,0,${0.3 / (1 + b.y * 0.4)})`; ctx.fill(); }
      });
    }

    // one box of an avatar: lx, ly, lz is the middle of its bottom in the body's own space, turned with the body
    function boxFaces(b, lx, ly, lz, w, h, d, colour, pitch, out, isHead){
      const c = Math.cos(b.face), s = Math.sin(b.face), cp = Math.cos(pitch || 0), sp = Math.sin(pitch || 0);
      // swing (pitch) turns the box round its top, for arms and legs
      const local = (x, y, z) => {
        const yy = y - (ly + h), y2 = yy * cp - z * sp, z2 = yy * sp + z * cp;
        return [x + lx, y2 + ly + h, z2 + lz];
      };
      const world = ([x, y, z]) => [b.x + x * c + z * s, b.y + y, b.z - x * s + z * c];
      const X = [-w / 2, w / 2], Y = [ly, ly + h], Z = [-d / 2, d / 2];
      const corner = (i, j, k) => world(local(X[i], Y[j], Z[k]));
      const FACES = [
        { n: [1, 0, 0], q: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] }, { n: [-1, 0, 0], q: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
        { n: [0, 1, 0], q: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] }, { n: [0, -1, 0], q: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
        { n: [0, 0, 1], q: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], front: true }, { n: [0, 0, -1], q: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] }
      ];
      const ctr = world(local(0, ly + h / 2, 0));
      FACES.forEach(f => {
        // the face's direction in the world: swung like the box, then turned with the body
        const nx = f.n[0], ny = f.n[1] * cp - f.n[2] * sp, nz = f.n[1] * sp + f.n[2] * cp;
        const wn = [nx * c + nz * s, ny, -nx * s + nz * c];
        const pts = f.q.map(([i, j, k]) => corner(i, j, k));
        const mid = pts.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4, a[2] + p[2] / 4], [0, 0, 0]);
        if (wn[0] * (cam.x - mid[0]) + wn[1] * (cam.y - mid[1]) + wn[2] * (cam.z - mid[2]) <= 0) return;
        const light = 0.6 + 0.4 * Math.max(0, wn[0] * LIGHT[0] + wn[1] * LIGHT[1] + wn[2] * LIGHT[2]);
        out.push({ pts, colour, light, face: isHead && f.front ? b : null, depth: camSpace(...ctr)[2] });
      });
    }
    function drawAvatar(b){
      const look = b.out ? { shirt: "#8a8f98", pants: "#5b606a", head: "#c9ccd2" } : b.look;
      const run = b.y > 0 ? 0.6 : Math.sin(b.walk) * Math.min(1, Math.hypot(b.vx, b.vz) / 5) * 0.8;
      const arms = b.y > 0 ? -2.6 : -run;   // arms swing against the legs, and go up when jumping
      const parts = [];
      boxFaces(b, -0.25, 0, 0, 0.48, 1, 0.48, look.pants, run, parts);
      boxFaces(b, 0.25, 0, 0, 0.48, 1, 0.48, look.pants, -run, parts);
      boxFaces(b, 0, 1, 0, 1, 1, 0.5, look.shirt, 0, parts);
      boxFaces(b, -0.75, 1, 0, 0.48, 1, 0.48, look.head, arms, parts);
      boxFaces(b, 0.75, 1, 0, 0.48, 1, 0.48, look.head, b.y > 0 ? -2.6 : run, parts);
      boxFaces(b, 0, 2, 0, 0.62, 0.6, 0.62, look.head, 0, parts, true);
      // the box parts: farther boxes first, and each box's faces together
      parts.sort((p, q) => q.depth - p.depth);
      parts.forEach(p => {
        if (!polyPath(p.pts)) return;
        ctx.fillStyle = shade(p.colour, p.light); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.15)"; ctx.lineWidth = 1; ctx.stroke();
        if (p.face) drawFace(p.pts, p.face);
      });
    }
    // the classic smiley, painted on the front of the head
    function drawFace(pts, b){
      // pts: bottom-left, bottom-right, top-right, top-left of the front face (as seen from the front)
      const at = (u, v) => {
        const bot = pts[0].map((x, i) => x + (pts[1][i] - x) * u), top = pts[3].map((x, i) => x + (pts[2][i] - x) * u);
        const p = bot.map((x, i) => x + (top[i] - x) * v), q = camSpace(...p);
        return q[2] > NEAR ? toScreen(q) : null;
      };
      const e1 = at(0.33, 0.62), e2 = at(0.67, 0.62), m = [0.25, 0.35, 0.5, 0.65, 0.75].map((u, i) => at(u, 0.38 - Math.sin(i / 4 * Math.PI) * 0.12));
      if (!e1 || !e2 || m.some(p => !p)) return;
      const size = Math.max(1.2, Math.hypot(e2[0] - e1[0], e2[1] - e1[1]) * 0.18);
      ctx.fillStyle = "#1b1f2a";
      [e1, e2].forEach(e => { ctx.beginPath(); ctx.ellipse(e[0], e[1], size * 0.6, size, 0, 0, 7); ctx.fill(); });
      ctx.strokeStyle = "#1b1f2a"; ctx.lineWidth = Math.max(1, size * 0.6); ctx.lineCap = "round";
      ctx.beginPath(); m.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
      if (b.out) { ctx.beginPath(); ctx.moveTo(m[0][0], m[2][1]); ctx.lineTo(m[4][0], m[2][1]); }   // a flat mouth when you're out
      ctx.stroke(); ctx.lineCap = "butt";
    }
    function drawLabel(b){
      const sp = toScreenAt(b.x, b.y + 3.2, b.z);
      if (!sp) return;
      const q = camSpace(b.x, b.y, b.z), size = Math.round(Math.max(10, Math.min(20, 220 / q[2])));
      ctx.font = `800 ${size}px 'Bricolage Grotesque', sans-serif`; ctx.textAlign = "center";
      const text = b.out ? "OUT" : b.safe ? "✅ " + b.name : b.name;
      ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,0.55)"; ctx.strokeText(text, sp[0], sp[1]);
      ctx.fillStyle = b.name === "TAGGER" ? "#ff6b5c" : b.me ? "#ffe14d" : b.out ? "#c9ccd2" : "#ffffff";
      ctx.fillText(text, sp[0], sp[1]);
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
      drawSky();
      drawGround();
      const people = [you, ...bots, ...taggers].map(b => ({ b, d: camSpace(b.x, 1, b.z)[2] })).filter(p => p.d > NEAR);
      people.sort((p, q) => q.d - p.d).forEach(p => drawAvatar(p.b));
      people.forEach(p => drawLabel(p.b));
      // a red edge when a tagger is right behind you
      if (running && !you.safe && !you.out) {
        let danger = 0;
        taggers.forEach(t => { const d = Math.hypot(t.x - you.x, t.z - you.z); if (d < 4) danger = Math.max(danger, 1 - d / 4); });
        if (danger > 0) {
          const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.6);
          v.addColorStop(0, "rgba(255,0,0,0)"); v.addColorStop(1, `rgba(255,30,30,${0.5 * danger})`);
          ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
        }
      }
      fx.draw(ctx, frameDt);
      if (phase === "ready" && running) {
        const n = Math.ceil(phaseT);
        ctx.font = "900 90px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center";
        ctx.lineWidth = 8; ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.strokeText(String(n), W / 2, H * 0.4);
        ctx.fillStyle = "#ffe14d"; ctx.fillText(String(n), W / 2, H * 0.4);
      }
      if (banner.t > 0) {
        ctx.globalAlpha = Math.min(1, banner.t * 2);
        ctx.textAlign = "center"; ctx.lineWidth = 6; ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.font = "800 40px 'Bricolage Grotesque', sans-serif";
        ctx.strokeText(banner.text, W / 2, 70); ctx.fillStyle = "#fff"; ctx.fillText(banner.text, W / 2, 70);
        ctx.font = "700 20px 'Bricolage Grotesque', sans-serif";
        ctx.strokeText(banner.sub, W / 2, 102); ctx.fillText(banner.sub, W / 2, 102);
        ctx.globalAlpha = 1;
      }
      drawMap();
    }
    // a little map of the field in the corner, with everybody on it
    function drawMap(){
      const mw = 70, mh = 150, ox = W - mw - 14, oy = 14, sx = mw / (HALF_W * 2), sz = mh / ((END + 1) * 2);
      const mx = x => ox + (x + HALF_W) * sx, my = z => oy + (END + 1 - z * dir) * sz;   // the far side is always at the top
      ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(ox - 4, oy - 4, mw + 8, mh + 8);
      ctx.fillStyle = "#4fae4a"; ctx.fillRect(ox, oy, mw, mh);
      ctx.fillStyle = "#7fe07a"; ctx.fillRect(ox, oy, mw, (END + 1 - SAFE) * sz);
      ctx.fillStyle = "#3f7fd8"; ctx.fillRect(ox, oy + mh - (END + 1 - SAFE) * sz, mw, (END + 1 - SAFE) * sz);
      const dot = (b, col, r) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(mx(b.x), my(b.z), r, 0, 7); ctx.fill(); };
      bots.forEach(b => dot(b, b.out ? "#8a8f98" : b.look.shirt, 2.6));
      taggers.forEach(t => dot(t, "#e8332b", 3));
      dot(you, "#ffe14d", 3.6);
    }

    function updateHud(){
      roundEl.textContent = "Round " + round;
      taggersEl.textContent = "🟥 ×" + Math.min(MAX_TAGGERS, round);
      timeEl.textContent = "⏱ " + Math.max(0, Math.ceil(timeLeft));
      timeEl.classList.toggle("low", phase === "run" && timeLeft < 6);
    }
    function loop(now){
      if (!open) return;
      const dt = Math.min(1 / 30, (now - last) / 1000 || 0);
      last = now; frameDt = dt;
      if (running) step(dt);
      else clock += dt;
      placeCamera(dt);
      draw();
      updateHud();
      requestAnimationFrame(loop);
    }

    function start(){
      reset();
      placeCamera(0);
      running = true;
      panel.hidden = true;
      Object.keys(keys).forEach(k => { keys[k] = false; });
      canvas.focus();
    }
    function gameOver(why){
      running = false;
      Fun.sfx.wah();
      const made = round - 1;
      Hub.saveStore(); Hub.checkBadges();
      panelTitle.textContent = why === "time" ? "⏱ Out of time!" : "🟥 You got tagged!";
      panelText.textContent = (made ? `You cleared ${made} ${made === 1 ? "round" : "rounds"}` : "You didn't clear a round this time")
        + (why === "time" ? ` and ran out of time in round ${round}.` : ` and got tagged in round ${round}.`)
        + (store.tagRushBest ? ` Your best: ${store.tagRushBest} ${store.tagRushBest === 1 ? "round" : "rounds"}.` : "");
      playBtn.textContent = "▶ Play again";
      panel.hidden = false;
      if (made && made >= (store.tagRushBest || 0)) Hub.confettiBurst(playBtn);
      playBtn.focus();
    }
    function openGame(){
      open = true; running = false;
      reset(); placeCamera(0);
      overlay.hidden = false;
      document.body.style.overflow = "hidden";
      panelTitle.textContent = "🏁 Tag Rush";
      panelText.textContent = "You and 4 bots have to run across the baseplate to the green side without getting tagged by the red taggers. Every round there's one more tagger! Jump over a tagger to dodge it."
        + (store.tagRushBest ? ` Your best: ${store.tagRushBest} ${store.tagRushBest === 1 ? "round" : "rounds"}.` : "");
      playBtn.textContent = "▶ Play";
      panel.hidden = false;
      last = performance.now();
      requestAnimationFrame(loop);
      playBtn.focus();
    }
    function closeGame(){
      open = false; running = false;
      overlay.hidden = true;
      document.body.style.overflow = "";
    }

    const KEYMAP = {
      ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
      ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", Space: "jump"
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
    host.querySelectorAll("[data-trkey]").forEach(btn => {
      const k = btn.dataset.trkey;
      btn.addEventListener("pointerdown", e => { e.preventDefault(); keys[k] = true; });
      ["pointerup", "pointercancel", "pointerleave"].forEach(ev => btn.addEventListener(ev, () => { keys[k] = false; }));
    });
    canvas.tabIndex = 0;

    $("trCloseBtn").addEventListener("click", () => Hub.leave());
    Fun.soundButton($("trCloseBtn"));
    playBtn.addEventListener("click", start);

    return { open: openGame, close: closeGame };
  }
})();
