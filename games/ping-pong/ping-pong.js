/* Ping Pong 3D: table tennis against Pong-Bot, seen through your own eyes at your end of the table.
   Move the mouse (or a finger) and your paddle follows it; the ball bounces off it by itself.
   Swing fast for a harder shot, hit with the edge of the paddle to aim to the side,
   and swing down at a high ball to smash it. First to 11 wins (by 2 clear points).
   It's all drawn on a plain 2D canvas: every point of the room is put through a small 3D camera. */
(function(){
  "use strict";
  const store = Hub.store;

  const LEVELS = {
    easy:   { label: "🐢 Easy",   bot: "#3fc46b", time: 0.7,  speed: 1.6, err: 0.13, react: 0.28, T: 0.7,  Tvar: 0.12,  reach: 0.11, marker: true },
    medium: { label: "🤖 Medium", bot: "#3f8cf0", time: 0.85, speed: 2.4, err: 0.1,  react: 0.16, T: 0.6,  Tvar: 0.12, reach: 0.08, marker: true },
    hard:   { label: "🔥 Hard",   bot: "#f0503f", time: 1.0,  speed: 3.4, err: 0.07, react: 0.08, T: 0.5,  Tvar: 0.12, reach: 0.06, marker: false }
  };
  const WIN_AT = 11;

  function wins(){ const w = store.pongWins || {}; return (w.easy || 0) + (w.medium || 0) + (w.hard || 0); }

  Hub.register({
    id: "ping-pong", section: "games", title: "Ping Pong 3D", icon: "🏓",
    blurb: "Table tennis in 3D against Pong-Bot. Swing to hit, smash the high ones. First to 11 wins!",
    stat: () => wins() ? "Wins: " + wins() : (store.pongBestRally ? "Best rally: " + store.pongBestRally : ""),
    badges: [
      { id: "pongWin",   icon: "🏓", name: "Ping!",       desc: "Win a game of Ping Pong",         test: () => wins() >= 1 },
      { id: "pongRally", icon: "🔁", name: "Rally Star",  desc: "Play a 20-shot rally in Ping Pong", test: () => (store.pongBestRally || 0) >= 20 },
      { id: "pongHard",  icon: "🥇", name: "Table Champ", desc: "Beat Pong-Bot on Hard",           test: () => ((store.pongWins || {}).hard || 0) >= 1 }
    ],
    mount
  });

  /* ---------------- the table, in metres (x across, y up, z down the table, you're at -z) ---------------- */
  const TW = 0.7625, TL = 1.37, TY = 0.76;       // half width, half length, height of the top
  const NET_H = 0.1525, NET_W = 0.915;           // net height, half width (it sticks out past the sides)
  const BR = 0.034;                               // ball radius (a bit big, so it's easy to see)
  const G = 9.8, BOUNCE = 0.88;
  const PZ = -1.62, OZ = 1.62;                   // where the two paddles normally wait
  const PR = 0.115;                              // paddle radius
  const SERVE_Y = 0.95, SERVE_Z = 1.5;
  const STEP = 1 / 240;

  /* ---------------- the ball ---------------- */
  function stepBall(b, dt, ev){
    b.vy -= G * dt;
    const pz = b.z;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    // the net: the ball drops back the way it came
    if (!b.netted && (pz < 0) !== (b.z < 0) && Math.abs(b.x) < NET_W && b.y - BR < TY + NET_H && b.y > TY - 0.02) {
      b.z = pz; b.vz = -b.vz * 0.15; b.vx *= 0.3; b.netted = true;
      if (ev) ev("net");
    }
    // the table top
    if (b.vy < 0 && b.y - BR <= TY && b.y - BR > TY - 0.08 && Math.abs(b.x) <= TW && Math.abs(b.z) <= TL) {
      b.y = TY + BR; b.vy = -b.vy * BOUNCE; b.vx *= 0.97; b.vz *= 0.97;
      if (ev) ev("table", b.z < 0 ? "P" : "O");
    }
    // the floor
    if (b.vy < 0 && b.y - BR <= 0) {
      b.y = BR; b.vy = -b.vy * 0.55; b.vx *= 0.8; b.vz *= 0.8;
      if (ev) ev("floor");
    }
  }
  const copyBall = b => ({ x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, netted: b.netted });

  // a shot that lands on (tx, tz) after T seconds, raised until it clears the net
  function aimShot(b, tx, tz, T){
    for (let i = 0; i < 24; i++, T += 0.05) {
      b.vx = (tx - b.x) / T; b.vz = (tz - b.z) / T;
      b.vy = (TY + BR - b.y + 0.5 * G * T * T) / T;
      const tn = -b.z / b.vz, yn = b.y + b.vy * tn - 0.5 * G * tn * tn;
      if (yn > TY + NET_H + BR + 0.03) return;
    }
  }

  // a serve bounces once on your side, then once on the other side. Found once by trying lots of throws.
  let serveFit = null;
  function fitServe(){
    let best = null;
    for (let vz = 1.6; vz <= 4.6; vz += 0.1) for (let vy = -2; vy <= 2.5; vy += 0.05) {
      const s = { x: 0, y: SERVE_Y, z: -SERVE_Z, vx: 0, vy, vz, netted: false };
      const hits = []; let ok = true, t = 0, top = 0;
      while (t < 3 && ok && hits.length < 2) {
        stepBall(s, STEP, (k, side) => { if (k === "table") hits.push({ side, z: s.z, t }); else ok = false; });
        t += STEP; top = Math.max(top, s.y);
        if (s.y < TY - 0.1) ok = false;
      }
      if (!ok || hits.length < 2 || hits[0].side !== "P" || hits[1].side !== "O") continue;
      const score = Math.abs(hits[1].z - 0.95) + Math.max(0, top - 1.15) * 2 + Math.abs(hits[0].z + 0.8) * 0.3;
      if (!best || score < best.score) best = { score, vz, vy, t: hits[1].t };
    }
    return best;
  }

  /* ---------------- the camera ---------------- */
  // the camera is your head: it stands just behind your paddle and moves with you
  const W = 960, H = 540;
  const EYE_H = 1.42, EYE_BACK = 0.85;
  const F = (H / 2) / Math.tan(31 * Math.PI / 180);
  let CAM = [0, EYE_H, PZ - EYE_BACK], fwd, right, up;
  function aimCam(cam, look){
    CAM = cam;
    fwd = norm([look[0] - cam[0], look[1] - cam[1], look[2] - cam[2]]);
    right = norm([fwd[2], 0, -fwd[0]]);                 // world up × forward
    up = [fwd[1] * right[2] - fwd[2] * right[1], fwd[2] * right[0] - fwd[0] * right[2], fwd[0] * right[1] - fwd[1] * right[0]];
  }
  aimCam(CAM, [0, 0.8, 1.4]);
  function norm(v){ const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }

  const P = { x: 0, y: 0, s: 0 };
  // where a point lands on the screen; s is how many pixels one metre is at that distance
  function proj(x, y, z, out){
    const dx = x - CAM[0], dy = y - CAM[1], dz = z - CAM[2];
    const zc = Math.max(0.05, dx * fwd[0] + dy * fwd[1] + dz * fwd[2]);
    const s = F / zc;
    out = out || P;
    out.x = W / 2 + (dx * right[0] + dy * right[1] + dz * right[2]) * s;
    out.y = H / 2 - (dx * up[0] + dy * up[1] + dz * up[2]) * s;
    out.s = s; out.vis = zc > 0.35;
    return out;
  }
  function poly(ctx, pts){
    ctx.beginPath();
    pts.forEach((p, i) => { proj(p[0], p[1], p[2]); if (i) ctx.lineTo(P.x, P.y); else ctx.moveTo(P.x, P.y); });
    ctx.closePath();
  }
  function line3(ctx, a, b, w){
    proj(a[0], a[1], a[2]); const x1 = P.x, y1 = P.y, s1 = P.s;
    proj(b[0], b[1], b[2]);
    ctx.lineWidth = Math.max(1, w * (s1 + P.s) / 2);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(P.x, P.y); ctx.stroke();
  }

  /* ---------------- sounds ---------------- */
  let ac = null;
  function audio(){
    if (store.sound === false) return null;
    if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ac = new AC(); }
    if (ac.state === "suspended") ac.resume();
    return ac;
  }
  function blip(f0, f1, dur, vol, type){
    const a = audio(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
    o.type = type || "sine";
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  const sndPaddle = hard => { blip(hard ? 1500 : 1100, 500, 0.06, hard ? 0.5 : 0.35, "triangle"); };
  const sndTable = () => blip(2100, 1300, 0.04, 0.25, "triangle");
  const sndNet = () => blip(220, 90, 0.12, 0.3, "sine");
  function sndPoint(good){
    const notes = good ? [660, 880] : [440, 330];
    notes.forEach((n, i) => setTimeout(() => blip(n, n, 0.14, 0.18, "square"), i * 110));
  }
  function sndWin(){ [523, 659, 784, 1047].forEach((n, i) => setTimeout(() => blip(n, n, 0.2, 0.18, "square"), i * 140)); }

  /* ---------------- the room never changes, so its people are made once ---------------- */
  const CROWD = [];
  (function(){
    let s = 7;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const SHIRTS = ["#ff6b6b", "#ffd93d", "#6bcBff", "#8bd17c", "#c38bff", "#ff9f43", "#f8f8f8", "#4d7cff"];
    const SKIN = ["#f1c7a5", "#d9a27a", "#a8704c", "#6e4630", "#f6d8bf"];
    for (let row = 0; row < 3; row++) for (let i = 0; i < 17; i++) {
      if (rnd() < 0.18) continue;
      CROWD.push({
        x: -4.4 + i * 0.55 + (row % 2) * 0.27 + (rnd() - 0.5) * 0.12,
        y: 0.55 + row * 0.42, z: 5.1 + row * 0.6,
        shirt: SHIRTS[(rnd() * SHIRTS.length) | 0], skin: SKIN[(rnd() * SKIN.length) | 0],
        phase: rnd() * 6.28, hair: rnd() < 0.5 ? "#2b1d14" : rnd() < 0.5 ? "#c9a24a" : "#5a3a1e"
      });
    }
  })();

  function mount(host){
    host.innerHTML = `
    <section class="game-screen" id="ppOverlay" hidden aria-label="Ping Pong 3D">
      <div class="game-box">
        <div class="game-hud">
          <h2>🏓 Ping Pong 3D</h2>
          <span class="mono game-stat" id="ppScore">You 0 : 0 Bot</span>
          <span class="mono game-stat" id="ppRally">Rally 0</span>
          <span class="mono game-stat" id="ppServe"></span>
          <button class="btn ghost small" id="ppMute" type="button" aria-label="Sound on or off"></button>
          <button class="btn ghost small" id="ppCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas id="ppCanvas" width="960" height="540"></canvas>
          <div class="game-panel" id="ppPanel">
            <div class="game-panel-title" id="ppPanelTitle">Ping Pong 3D</div>
            <div class="game-panel-text" id="ppPanelText"></div>
            <div class="pp-levels"><span>Pong-Bot:</span><div class="segmented" id="ppLevels" role="group" aria-label="How good Pong-Bot is"></div></div>
            <button class="btn" id="ppPlayBtn" type="button">▶ Play</button>
          </div>
        </div>
        <div class="game-help">Move the mouse to move your paddle (or the arrow keys) · click or Space to serve · swing fast to hit hard · swing down on a high ball to smash</div>
        <div class="game-help pp-touch-help">Drag your finger to move the paddle · tap to serve · swing fast to hit hard</div>
      </div>
    </section>`;

    const $ = id => document.getElementById(id);
    const overlay = $("ppOverlay"), canvas = $("ppCanvas"), ctx = canvas.getContext("2d");
    const panel = $("ppPanel"), panelTitle = $("ppPanelTitle"), panelText = $("ppPanelText"), playBtn = $("ppPlayBtn");
    const scoreEl = $("ppScore"), rallyEl = $("ppRally"), serveEl = $("ppServe"), muteBtn = $("ppMute");
    canvas.tabIndex = 0;

    let open = false, last = 0, clock = 0;
    let mode = "menu";            // menu, serve, rally, point, over
    let L = LEVELS[store.pongLevel] || LEVELS.easy;
    let score = { P: 0, O: 0 }, server = "P", timer = 0;
    const ball = { x: 0, y: SERVE_Y, z: -SERVE_Z, vx: 0, vy: 0, vz: 0, netted: false, spin: 0 };
    let rally = null;             // { hitter, bounces, serving, serveStage, count, pred }
    const trail = [];
    const sparks = [];
    let msg = null;               // big words in the middle: { text, sub, t, good }
    let cheer = 0;

    // the paddles: tx/ty is where it's heading, vx/vy how fast it moves (for the swing)
    const me = { x: 0, y: 0.95, z: PZ, tx: 0, ty: 0.95, vx: 0, vy: 0, tilt: 0, push: 0 };
    const bot = { x: 0, y: 0.95, z: OZ, tx: 0, ty: 0.95, vx: 0, vy: 0, tilt: 0, push: 0, wait: 0, aimX: 0, aimY: 0, mood: 0 };
    const keys = { left: false, right: false, up: false, down: false };

    /* ---------- the level picker ---------- */
    function renderLevels(){
      const box = $("ppLevels"); box.innerHTML = "";
      Object.keys(LEVELS).forEach(id => {
        const b = document.createElement("button");
        b.type = "button"; b.textContent = LEVELS[id].label;
        b.setAttribute("aria-pressed", String(LEVELS[id] === L));
        b.addEventListener("click", () => { L = LEVELS[id]; store.pongLevel = id; Hub.saveStore(); renderLevels(); });
        box.appendChild(b);
      });
    }
    // one sound switch for all the games
    function renderMute(){ muteBtn.textContent = store.sound === false ? "🔇" : "🔊"; }
    muteBtn.addEventListener("click", () => { store.sound = store.sound === false; Hub.saveStore(); renderMute(); });

    function hud(){
      scoreEl.textContent = `You ${score.P} : ${score.O} Bot`;
      rallyEl.textContent = "Rally " + (rally ? rally.count : 0);
      serveEl.textContent = server === "P" ? "🏓 Your serve" : "🤖 Bot serves";
      serveEl.hidden = mode === "menu" || mode === "over";
    }
    function say(text, sub, good){ msg = { text, sub: sub || "", t: 0, good }; }

    /* ---------- the game ---------- */
    function newGame(){
      score = { P: 0, O: 0 }; server = "P";
      panel.hidden = true; canvas.focus();
      if (!serveFit) serveFit = fitServe();
      startServe();
    }
    function whoServes(){
      const n = score.P + score.O;
      const turn = n >= 2 * (WIN_AT - 1) ? n : Math.floor(n / 2);
      return turn % 2 === 0 ? "P" : "O";
    }
    function startServe(){
      server = whoServes();
      mode = "serve"; timer = 0;
      rally = null; trail.length = 0;
      Object.assign(ball, { vx: 0, vy: 0, vz: 0, netted: false });
      bot.mood = 0;
      if (server === "O") say("Pong-Bot serves", "", true); else say("Your serve!", matchMsg() || "Click or tap to serve", true);
      hud();
    }
    function matchMsg(){
      if (score.P >= WIN_AT - 1 && score.P > score.O) return "Game point!";
      if (score.O >= WIN_AT - 1 && score.O > score.P) return "Pong-Bot has game point";
      return "";
    }

    function serve(side){
      const s = side === "P" ? 1 : -1;
      const pad = side === "P" ? me : bot;
      ball.x = Math.max(-0.6, Math.min(0.6, pad.x));
      ball.y = SERVE_Y; ball.z = -s * SERVE_Z; ball.netted = false;
      ball.vz = serveFit.vz * s; ball.vy = serveFit.vy;
      const tx = side === "P"
        ? Math.max(-0.6, Math.min(0.6, -ball.x * 0.5 + me.vx * 0.15))
        : (Math.random() * 2 - 1) * 0.55;
      ball.vx = (tx - ball.x) / serveFit.t * 1.03;
      ball.spin = 0;
      rally = { hitter: side, bounces: 0, serving: true, serveStage: 0, count: 1, pred: null };
      rally.pred = predict(side === "P" ? "O" : "P");
      mode = "rally";
      pad.push = 1;
      sndPaddle(false);
      msg = null;
      if (side === "P") botPlan();
      hud();
    }

    // where will the ball be when the other player can hit it? Also where it'll bounce first on their side.
    function predict(recv){
      const s = copyBall(ball);
      const plane = recv === "P" ? PZ : OZ, dir = recv === "P" ? -1 : 1;
      let bounced = false, ownBounce = rally && rally.serving && rally.serveStage === 0, done = null, apex = null, first = null, t = 0;
      while (t < 3 && !done) {
        const before = s.vy;
        stepBall(s, STEP, (k, side) => {
          if (k === "table") {
            if (side !== recv) { if (ownBounce) ownBounce = false; else done = { out: true }; }
            else if (!bounced) { bounced = true; first = { x: s.x, z: s.z }; }
            else done = apex ? { x: apex.x, y: apex.y, z: apex.z, t: apex.t } : { out: true };
          } else if (k === "floor") done = { out: true };
        });
        t += STEP;
        if (bounced && before > 0 && s.vy <= 0) apex = { x: s.x, y: s.y, z: s.z, t };
        if (!done && (s.z - plane) * dir >= 0) done = bounced ? { x: s.x, y: s.y, z: plane, t } : { out: true };
      }
      if (!done) done = { out: true };
      done.first = first;
      // a short ball: the paddle steps in, but not over the table too far
      if (!done.out) done.z = recv === "P" ? Math.max(PZ, Math.min(-0.75, done.z)) : Math.min(OZ, Math.max(0.75, done.z));
      return done;
    }

    function botPlan(){
      const p = rally.pred;
      bot.wait = L.react;
      if (p.out) { bot.aimX = bot.x * 0.5; bot.aimY = 1.0; return; }
      // Pong-Bot isn't perfect: it aims a little off, and sometimes too far off
      const a = Math.random() * Math.PI * 2, r = L.err * (0.3 + Math.random() * Math.random() * 1.9);
      bot.aimX = p.x + Math.cos(a) * r; bot.aimY = p.y + Math.sin(a) * r * 0.7;
    }

    function onEvent(kind, side){
      if (!rally || mode !== "rally") return;
      if (kind === "net") { sndNet(); rally.netted = true; return; }
      if (kind === "floor") {
        if (rally.bounces >= 1) point(rally.hitter, "missed");
        else point(rally.hitter === "P" ? "O" : "P", rally.netted ? "net" : "out");
        return;
      }
      // the table
      sndTable();
      addSparks(ball.x, TY + 0.005, ball.z, "#ffffff", 5, 0.6);
      if (rally.serving) {
        if (rally.serveStage === 0 && side === rally.hitter) { rally.serveStage = 1; return; }
        if (rally.serveStage === 1 && side !== rally.hitter) { rally.serving = false; rally.bounces = 1; return; }
        point(rally.hitter === "P" ? "O" : "P", "serve");
        return;
      }
      if (side === rally.hitter) { point(side === "P" ? "O" : "P", rally.netted ? "net" : "own"); return; }
      rally.bounces++;
      if (rally.bounces >= 2) point(rally.hitter, "missed");
    }

    // Pong-Bot talks: a speech pop over its head
    const fx = Fun.pops();
    let fxDt = 1 / 60;
    function botSays(text, colour){ proj(bot.x - 0.28, 1.9, OZ + 0.45); fx.pop(text, P.x, P.y, colour || "#ffffff", 22); }
    function point(winner, why){
      mode = "point"; timer = 0;
      score[winner]++;
      const count = rally ? rally.count : 0;
      if (count > (store.pongBestRally || 0)) { store.pongBestRally = count; Hub.saveStore(); Hub.checkBadges(); }
      const WHY = { missed: winner === "P" ? "Pong-Bot missed it" : "You missed it", net: "Into the net", out: "Out!", own: "It bounced on the wrong side", serve: "Bad serve" };
      if (winner === "P") {
        say(why === "missed" ? ["Winner!", "Great shot!", "Ace!", "Nice one!"][(Math.random() * 4) | 0] : "Your point!", WHY[why] + (count >= 8 ? ` · ${count}-shot rally!` : ""), true);
        cheer = 1.4; bot.mood = -1;
        botSays(["Error 404!", "Does not compute!", "Lucky shot!", "My circuits! 😵", "Beep… boop… ouch", "Not fair!"][Math.floor(Math.random() * 6)], "#9fd8ff");
      } else {
        say("Point to Pong-Bot", WHY[why], false);
        bot.mood = 1;
        botSays(["Beep! Too easy!", "Calculated! 🤖", "Robot power!", "Boop boop!", "Try harder, human!", "Hehe"][Math.floor(Math.random() * 6)], "#ffb3a8");
      }
      sndPoint(winner === "P");
      hud();
    }

    function gameOver(){
      mode = "over";
      const won = score.P > score.O;
      const id = Object.keys(LEVELS).find(k => LEVELS[k] === L);
      store.pongPlayed = (store.pongPlayed || 0) + 1;
      if (won) { store.pongWins = store.pongWins || {}; store.pongWins[id] = (store.pongWins[id] || 0) + 1; }
      Hub.saveStore(); Hub.checkBadges();
      panelTitle.textContent = won ? "🏆 You win!" : "🤖 Pong-Bot wins";
      panelText.textContent = (won ? `You beat ${L.label.replace(/^\S+\s/, "")} Pong-Bot ${score.P} to ${score.O}!` : `Pong-Bot won ${score.O} to ${score.P}. Try again?`)
        + ((store.pongBestRally || 0) >= 5 ? ` Your longest rally ever: ${store.pongBestRally} shots.` : "");
      playBtn.textContent = "▶ Play again";
      renderLevels();
      panel.hidden = false; msg = null;
      if (won) { Hub.confettiBurst(playBtn); sndWin(); cheer = 3; }
      hud();
      playBtn.focus();
    }

    /* ---------- hitting ---------- */
    function hit(side, at){
      const pad = side === "P" ? me : bot, s = side === "P" ? 1 : -1;
      ball.x = at.x; ball.y = at.y; ball.z = pad.z + s * 0.002; ball.netted = false;
      let tx, tz, T, smash = false;
      if (side === "P") {
        const sp = Math.hypot(me.vx, me.vy), swing = Math.min(1, sp / 3.2);
        const off = (ball.x - me.x) / (PR + L.reach);           // hit with the edge to aim sideways
        tx = Math.max(-0.88, Math.min(0.88, ball.x * 0.25 + me.vx * 0.16 + off * 0.45));
        tz = 0.6 + swing * 0.55 + Math.random() * 0.12;
        T = 0.74 - swing * 0.28;
        if (ball.y > TY + 0.38 && me.vy < -1.1) { smash = true; T = 0.32; tz = 0.95 + Math.random() * 0.25; }
      } else {
        const hard = L === LEVELS.hard;
        tx = hard ? -Math.sign(me.x || 1) * (0.3 + Math.random() * 0.38) : (Math.random() * 2 - 1) * 0.6;
        tz = -(0.55 + Math.random() * 0.7);
        T = L.T + Math.random() * L.Tvar;
        if (ball.y > TY + 0.45 && Math.random() < (hard ? 0.7 : 0.25)) { smash = true; T = hard ? 0.36 : 0.46; tz = -1.0; }
        // now and then Pong-Bot hits it out (more often when it's easy)
        if (Math.random() < (hard ? 0.03 : L === LEVELS.medium ? 0.06 : 0.1)) tx = Math.sign(tx || 1) * (0.85 + Math.random() * 0.15);
      }
      aimShot(ball, tx, tz, T);
      ball.spin = (smash ? 30 : 14) * s;
      pad.push = 1;
      rally.hitter = side; rally.bounces = 0; rally.netted = false; rally.count++;
      if (rally.count === 10 || rally.count === 20 || rally.count === 30) { proj(0, 2.1, 4.5); fx.pop(rally.count === 10 ? "OOOOH! 👀" : rally.count === 20 ? "WOW! 20 hits! 🤩" : "LEGENDARY! 🔥", P.x, P.y, "#ffe14d", 30); cheer = 1; }
      rally.pred = predict(side === "P" ? "O" : "P");
      if (side === "P") botPlan();
      sndPaddle(smash);
      addSparks(ball.x, ball.y, ball.z, smash ? "#ffd84d" : "#ffffff", smash ? 18 : 8, smash ? 2.2 : 1.1);
      if (smash) say("SMASH!", "", side === "P");
      hud();
    }

    // did the ball just pass through a paddle's (moving) wall?
    function tryHit(side, prev){
      if (!rally || mode !== "rally" || rally.serving || rally.bounces !== 1) return;
      if (rally.hitter === side) return;
      const pad = side === "P" ? me : bot, dir = side === "P" ? -1 : 1;
      if ((prev.z - pad.z) * dir >= 0 || (ball.z - pad.z) * dir < 0) return;
      const f = (prev.z - pad.z) / (prev.z - ball.z);
      const at = { x: prev.x + (ball.x - prev.x) * f, y: prev.y + (ball.y - prev.y) * f };
      const reach = PR + (side === "P" ? L.reach : 0.02);
      if (Math.hypot(at.x - pad.x, (at.y - pad.y) * 0.9) < reach) hit(side, at);
    }

    /* ---------- moving ---------- */
    function movePaddle(pad, dt, maxSpeed){
      let dx = pad.tx - pad.x, dy = pad.ty - pad.y;
      const k = maxSpeed ? 1 : 1 - Math.exp(-dt * 28);
      dx *= k; dy *= k;
      if (maxSpeed) { const d = Math.hypot(dx, dy), m = maxSpeed * dt; if (d > m) { dx *= m / d; dy *= m / d; } }
      pad.x += dx; pad.y += dy;
      const vx = dx / Math.max(dt, 1e-4), vy = dy / Math.max(dt, 1e-4);
      const sm = 1 - Math.exp(-dt * 18);
      pad.vx += (vx - pad.vx) * sm; pad.vy += (vy - pad.vy) * sm;
      pad.tilt += (Math.max(-0.6, Math.min(0.6, -pad.vx * 0.12)) - pad.tilt) * sm;
      pad.push = Math.max(0, pad.push - dt * 5);
    }
    function clampMe(){
      me.tx = Math.max(-1.25, Math.min(1.25, me.tx));
      me.ty = Math.max(TY + 0.05, Math.min(1.6, me.ty));
    }

    function update(dt){
      clock += dt;
      // your paddle
      const kv = 1.8 * dt;
      Fun.stickKeys(stick, keys, { left: "left", right: "right", up: "up", down: "down" });
      if (keys.left) me.tx -= kv; if (keys.right) me.tx += kv;
      if (keys.up) me.ty += kv; if (keys.down) me.ty -= kv;
      clampMe();
      movePaddle(me, dt, 0);

      const play = mode === "serve" || mode === "rally" || mode === "point";
      const gdt = dt * L.time;
      // step in for short balls, step back after
      const wantMe = mode === "rally" && rally && rally.hitter === "O" && rally.pred && !rally.pred.out ? rally.pred.z : PZ;
      me.z += (wantMe - me.z) * (1 - Math.exp(-gdt * 6));
      const wantBot = mode === "rally" && rally && rally.hitter === "P" && rally.pred && !rally.pred.out ? rally.pred.z : OZ;
      bot.z += (wantBot - bot.z) * (1 - Math.exp(-gdt * 5));

      // Pong-Bot
      if (mode === "rally" && rally && rally.hitter === "P") {
        bot.wait -= gdt;
        if (bot.wait <= 0) { bot.tx = bot.aimX; bot.ty = bot.aimY; }
      } else if (mode === "serve" && server === "O") { bot.tx = Math.sin(clock * 0.9) * 0.3; bot.ty = SERVE_Y; }
      else { bot.tx += (0 - bot.tx) * Math.min(1, gdt * 1.5); bot.ty += (1.0 - bot.ty) * Math.min(1, gdt * 1.5); }
      movePaddle(bot, gdt, L.speed);

      if (mode === "serve") {
        timer += dt;
        const pad = server === "P" ? me : bot, s = server === "P" ? 1 : -1;
        ball.x = Math.max(-0.6, Math.min(0.6, pad.x));
        ball.y = SERVE_Y + 0.12 + Math.abs(Math.sin(clock * 3.2)) * 0.18;   // bouncing the ball, ready to serve
        ball.z = -s * SERVE_Z;
        if (server === "O" && timer > 1.3) serve("O");
      } else if (mode === "rally" || mode === "point") {
        let n = Math.ceil(gdt / STEP);
        const h = gdt / n;
        while (n--) {
          const prev = copyBall(ball);
          stepBall(ball, h, onEvent);
          tryHit("P", prev);
          tryHit("O", prev);
        }
        trail.push({ x: ball.x, y: ball.y, z: ball.z });
        if (trail.length > 7) trail.shift();
        if (mode === "point") {
          timer += dt;
          if (timer > 1.6) {
            const lead = Math.abs(score.P - score.O);
            if ((score.P >= WIN_AT || score.O >= WIN_AT) && lead >= 2) gameOver(); else startServe();
          }
        } else if (Math.abs(ball.z) > 6 || Math.abs(ball.x) > 6) point(rally.hitter === "P" ? "O" : "P", "out");
      }
      if (!play && mode !== "over") { ball.y = -1; }

      // little white bits, words, cheering
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i]; p.t += dt;
        p.vy -= 6 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.t > p.life) sparks.splice(i, 1);
      }
      if (msg) { msg.t += dt; if (msg.t > 2.2 && !(mode === "serve" && server === "P")) msg = null; }
      cheer = Math.max(0, cheer - dt);
    }

    function addSparks(x, y, z, color, n, sp){
      for (let i = 0; i < n; i++) {
        sparks.push({ x, y, z, vx: (Math.random() - 0.5) * sp, vy: Math.random() * sp, vz: (Math.random() - 0.5) * sp, t: 0, life: 0.35 + Math.random() * 0.25, color });
      }
    }

    /* ---------------- drawing ---------------- */
    function drawRoom(){
      // the walls and the ceiling
      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.55);
      sky.addColorStop(0, "#0b1330"); sky.addColorStop(1, "#1c2b57");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      poly(ctx, [[-7, 0, 7.5], [7, 0, 7.5], [7, 4.5, 7.5], [-7, 4.5, 7.5]]);
      const wall = ctx.createLinearGradient(0, proj(0, 4.5, 7.5).y, 0, proj(0, 0, 7.5).y);
      wall.addColorStop(0, "#14204a"); wall.addColorStop(1, "#2a3f7a");
      ctx.fillStyle = wall; ctx.fill();
      // a big banner on the back wall
      proj(0, 2.75, 7.5); const bs = P.s, bx = P.x, by = P.y;
      ctx.fillStyle = "#ff7a00";
      roundRect(bx - 2.2 * bs, by - 0.32 * bs, 4.4 * bs, 0.64 * bs, 0.08 * bs); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `800 ${Math.round(0.36 * bs)}px "Bricolage Grotesque", sans-serif`;
      ctx.fillText("LEARN & PLAY OPEN", bx, by + 0.02 * bs);
      // the scoreboard on the wall
      proj(-3.6, 2.6, 7.5); drawBoard(P.x, P.y, P.s);
      proj(3.6, 2.6, 7.5); drawBoard(P.x, P.y, P.s);

      // the floor
      const nz = CAM[2] + 0.5;   // the nearest bit of floor you can see
      poly(ctx, [[-7, 0, nz], [7, 0, nz], [7, 0, 7.5], [-7, 0, 7.5]]);
      const fl = ctx.createLinearGradient(0, proj(0, 0, 7.5).y, 0, H);
      fl.addColorStop(0, "#6e2a22"); fl.addColorStop(1, "#b5482f");
      ctx.fillStyle = fl; ctx.fill();
      ctx.fillRect(0, proj(0, 0, nz).y - 1, W, H);
      // floor boards
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      for (let x = -7; x <= 7; x += 0.5) line3(ctx, [x, 0, nz], [x, 0, 7.5], 0.01);
      // a pool of light under the table
      proj(0, 0, 0);
      const pool = ctx.createRadialGradient(P.x, P.y, 0, P.x, P.y, 3.2 * P.s);
      pool.addColorStop(0, "rgba(255,230,190,0.33)"); pool.addColorStop(1, "rgba(255,230,190,0)");
      ctx.save(); ctx.translate(P.x, P.y); ctx.scale(1, 0.32); ctx.translate(-P.x, -P.y);
      ctx.fillStyle = pool; ctx.beginPath(); ctx.arc(P.x, P.y, 3.2 * P.s, 0, 7); ctx.fill(); ctx.restore();

      // the crowd, behind the boards
      CROWD.forEach(c => {
        const jump = cheer > 0 ? Math.max(0, Math.sin(clock * 12 + c.phase)) * 0.12 * Math.min(1, cheer) : Math.sin(clock * 1.3 + c.phase) * 0.01;
        proj(c.x, c.y + jump, c.z);
        const s = P.s;
        ctx.fillStyle = c.shirt;
        roundRect(P.x - 0.17 * s, P.y - 0.05 * s, 0.34 * s, 0.4 * s, 0.1 * s); ctx.fill();
        ctx.fillStyle = c.skin;
        ctx.beginPath(); ctx.arc(P.x, P.y - 0.15 * s, 0.11 * s, 0, 7); ctx.fill();
        ctx.fillStyle = c.hair;
        ctx.beginPath(); ctx.arc(P.x, P.y - 0.18 * s, 0.11 * s, Math.PI, 0); ctx.fill();
        if (cheer > 0) {   // arms up
          ctx.strokeStyle = c.skin; ctx.lineWidth = Math.max(1, 0.05 * s);
          ctx.beginPath(); ctx.moveTo(P.x - 0.14 * s, P.y); ctx.lineTo(P.x - 0.22 * s, P.y - 0.3 * s);
          ctx.moveTo(P.x + 0.14 * s, P.y); ctx.lineTo(P.x + 0.22 * s, P.y - 0.3 * s); ctx.stroke();
        }
      });
      // the boards round the court
      boards([-4.6, 4.3], [4.6, 4.3]);
      boards([-4.6, nz], [-4.6, 4.3]);
      boards([4.6, 4.3], [4.6, nz]);

      // spotlights from the ceiling
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      [-2.2, 2.2].forEach(sx => {
        proj(sx, 4.6, 1.2); const x0 = P.x, y0 = P.y;
        proj(sx * 0.2, TY, 0); const x1 = P.x, y1 = P.y;
        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, "rgba(255,240,200,0.16)"); g.addColorStop(1, "rgba(255,240,200,0)");
        ctx.fillStyle = g; ctx.beginPath();
        ctx.moveTo(x0 - 6, y0); ctx.lineTo(x0 + 6, y0); ctx.lineTo(x1 + 170, y1); ctx.lineTo(x1 - 170, y1); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,245,220,0.9)"; ctx.beginPath(); ctx.arc(x0, y0, 5, 0, 7); ctx.fill();
      });
      ctx.restore();
    }
    function boards(a, b){
      const h = 0.7;
      poly(ctx, [[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], h, b[1]], [a[0], h, a[1]]]);
      ctx.fillStyle = "#1d3fa8"; ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.5)"; line3(ctx, [a[0], h, a[1]], [b[0], h, b[1]], 0.03);
      if (a[1] === b[1]) {   // the back boards get words on them
        ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        for (let x = a[0] + 1.1; x < b[0]; x += 2.3) {
          proj(x, h / 2, a[1]);
          ctx.font = `800 ${Math.round(0.26 * P.s)}px "Bricolage Grotesque", sans-serif`;
          ctx.fillText(x < 0 ? "PING" : "PONG", P.x, P.y);
        }
      }
    }
    function drawBoard(x, y, s){
      ctx.fillStyle = "#05070f"; roundRect(x - 0.75 * s, y - 0.4 * s, 1.5 * s, 0.8 * s, 0.06 * s); ctx.fill();
      ctx.strokeStyle = "#3a4a80"; ctx.lineWidth = Math.max(1, 0.03 * s); ctx.stroke();
      ctx.font = `700 ${Math.round(0.42 * s)}px "IBM Plex Mono", monospace`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffd84d"; ctx.fillText(String(score.P), x - 0.35 * s, y + 0.04 * s);
      ctx.fillStyle = "#ff6b5b"; ctx.fillText(String(score.O), x + 0.35 * s, y + 0.04 * s);
      ctx.fillStyle = "#8894c0"; ctx.font = `700 ${Math.round(0.14 * s)}px "IBM Plex Mono", monospace`;
      ctx.fillText("YOU   BOT", x, y - 0.29 * s);
    }
    function roundRect(x, y, w, h, r){
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }

    function drawTable(){
      // its shadow on the floor
      poly(ctx, [[-TW - 0.05, 0, -TL], [TW + 0.05, 0, -TL], [TW + 0.05, 0, TL + 0.1], [-TW - 0.05, 0, TL + 0.1]]);
      ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fill();
      // legs and the frame underneath
      ctx.strokeStyle = "#20242e";
      [[-0.66, -1.15], [0.66, -1.15], [-0.66, 1.15], [0.66, 1.15]].forEach(l => line3(ctx, [l[0], 0, l[1]], [l[0], TY - 0.03, l[1]], 0.05));
      ctx.strokeStyle = "#2c313c";
      line3(ctx, [-0.66, 0.25, -1.15], [-0.66, 0.25, 1.15], 0.03);
      line3(ctx, [0.66, 0.25, -1.15], [0.66, 0.25, 1.15], 0.03);
      // the edge you can see at your end
      poly(ctx, [[-TW, TY - 0.03, -TL], [TW, TY - 0.03, -TL], [TW, TY, -TL], [-TW, TY, -TL]]);
      ctx.fillStyle = "#0c2a52"; ctx.fill();
      // the top: white lines round a blue top, and the middle line
      poly(ctx, [[-TW, TY, -TL], [TW, TY, -TL], [TW, TY, TL], [-TW, TY, TL]]);
      ctx.fillStyle = "#f4f7ff"; ctx.fill();
      const e = 0.022;
      poly(ctx, [[-TW + e, TY, -TL + e], [TW - e, TY, -TL + e], [TW - e, TY, TL - e], [-TW + e, TY, TL - e]]);
      proj(0, TY, 0);
      const top = ctx.createRadialGradient(P.x, P.y, 10, P.x, P.y, 420);
      top.addColorStop(0, "#2f78d0"); top.addColorStop(1, "#174a93");
      ctx.fillStyle = top; ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      line3(ctx, [0, TY + 0.001, -TL + e], [0, TY + 0.001, TL - e], 0.005);
      // a shine from the lights
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      proj(0.15, TY, 0.6);
      const shine = ctx.createRadialGradient(P.x, P.y, 0, P.x, P.y, 140);
      shine.addColorStop(0, "rgba(140,190,255,0.22)"); shine.addColorStop(1, "rgba(140,190,255,0)");
      ctx.fillStyle = shine; ctx.fillRect(P.x - 140, P.y - 60, 280, 120);
      ctx.restore();
    }

    function drawNet(){
      // the net itself, a see-through mesh
      poly(ctx, [[-NET_W, TY, 0], [NET_W, TY, 0], [NET_W, TY + NET_H, 0], [-NET_W, TY + NET_H, 0]]);
      ctx.fillStyle = "rgba(10,14,30,0.35)"; ctx.fill();
      ctx.strokeStyle = "rgba(20,24,40,0.55)";
      for (let x = -NET_W; x <= NET_W + 0.001; x += 0.045) line3(ctx, [x, TY, 0], [x, TY + NET_H, 0], 0.002);
      for (let y = TY + 0.025; y < TY + NET_H; y += 0.025) line3(ctx, [-NET_W, y, 0], [NET_W, y, 0], 0.002);
      // the white tape along the top and the posts
      ctx.strokeStyle = "#ffffff"; line3(ctx, [-NET_W, TY + NET_H, 0], [NET_W, TY + NET_H, 0], 0.014);
      ctx.strokeStyle = "#1c1f28";
      line3(ctx, [-NET_W, TY - 0.02, 0], [-NET_W, TY + NET_H + 0.01, 0], 0.025);
      line3(ctx, [NET_W, TY - 0.02, 0], [NET_W, TY + NET_H + 0.01, 0], 0.025);
    }

    function drawShadow(){
      if (ball.y < 0) return;
      const over = Math.abs(ball.x) <= TW && Math.abs(ball.z) <= TL && ball.y >= TY;
      const gy = over ? TY + 0.001 : 0.001, hgt = ball.y - gy;
      const a = Math.max(0, 0.5 * (1 - hgt / 1.6));
      if (a <= 0) return;
      const r = BR * (1.1 + hgt * 0.5);
      proj(ball.x, gy, ball.z - r); const y1 = P.y;
      proj(ball.x, gy, ball.z + r); const y2 = P.y;
      proj(ball.x, gy, ball.z);
      if (!P.vis) return;
      ctx.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(P.x, P.y, r * P.s, Math.max(1, Math.abs(y1 - y2) / 2), 0, 0, 7); ctx.fill();
    }

    function drawMarker(){
      // on Easy and Medium, a ring shows where the ball is going to bounce on your side
      if (!L.marker || mode !== "rally" || !rally || rally.hitter !== "O" || rally.bounces > 0 || !rally.pred || !rally.pred.first) return;
      const f = rally.pred.first, pulse = 1 + Math.sin(clock * 10) * 0.12;
      const r = 0.07 * pulse;
      proj(f.x, TY + 0.001, f.z - r); const y1 = P.y;
      proj(f.x, TY + 0.001, f.z + r); const y2 = P.y;
      proj(f.x, TY + 0.001, f.z);
      ctx.strokeStyle = "rgba(255,216,77,0.85)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(P.x, P.y, r * P.s, Math.abs(y1 - y2) / 2, 0, 0, 7); ctx.stroke();
    }

    function drawBall(){
      if (ball.y < 0) return;
      const speed = Math.hypot(ball.vx, ball.vy, ball.vz);
      if (speed > 4 && mode === "rally") {
        trail.forEach((t, i) => {
          proj(t.x, t.y, t.z);
          if (!P.vis) return;
          ctx.fillStyle = `rgba(255,190,120,${(0.05 + i * 0.035).toFixed(3)})`;
          ctx.beginPath(); ctx.arc(P.x, P.y, BR * P.s * (0.5 + i * 0.07), 0, 7); ctx.fill();
        });
      }
      proj(ball.x, ball.y, ball.z);
      if (!P.vis) return;
      const r = Math.max(2.5, BR * P.s);
      const g = ctx.createRadialGradient(P.x - r * 0.35, P.y - r * 0.4, r * 0.1, P.x, P.y, r);
      g.addColorStop(0, "#ffffff"); g.addColorStop(0.35, "#ffd2a0"); g.addColorStop(1, "#f07a1c");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(P.x, P.y, r, 0, 7); ctx.fill();
      // a stripe that spins, so you can see the ball turning
      ctx.save(); ctx.beginPath(); ctx.arc(P.x, P.y, r, 0, 7); ctx.clip();
      ctx.strokeStyle = "rgba(170,70,10,0.45)"; ctx.lineWidth = Math.max(1, r * 0.22);
      const sp = clock * ball.spin;
      ctx.beginPath(); ctx.ellipse(P.x, P.y, r, Math.abs(Math.cos(sp)) * r, 0, 0, 7); ctx.stroke();
      ctx.restore();
    }

    function drawPaddle(pad, mine){
      const s = mine ? 1 : -1;
      const z = pad.z + s * pad.push * 0.08;
      proj(pad.x, pad.y, z);
      const cx = P.x, cy = P.y, sc = P.s, r = PR * sc;
      ctx.save();
      ctx.globalAlpha = mine ? 0.62 : 1;   // see-through, so it never hides the ball
      ctx.translate(cx, cy); ctx.rotate(pad.tilt * s);
      // the handle
      const hg = ctx.createLinearGradient(-0.02 * sc, 0, 0.02 * sc, 0);
      hg.addColorStop(0, "#b8834a"); hg.addColorStop(0.5, "#e8c08a"); hg.addColorStop(1, "#9c6a35");
      ctx.fillStyle = hg;
      roundRect(-0.017 * sc, r * 0.75, 0.034 * sc, 0.11 * sc, 0.012 * sc); ctx.fill();
      // the wooden edge and the rubber
      ctx.fillStyle = "#6b4423";
      ctx.beginPath(); ctx.ellipse(0, 0, r, r * 1.08, 0, 0, 7); ctx.fill();
      const rg = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
      if (mine) { rg.addColorStop(0, "#ff6a5c"); rg.addColorStop(1, "#b81c1c"); }
      else { rg.addColorStop(0, "#4a4f5c"); rg.addColorStop(1, "#14161c"); }
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.9, r * 0.98, 0, 0, 7); ctx.fill();
      if (mine) { ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.restore();
    }

    function drawBot(){
      const c = L.bot;
      const bx = bot.x - 0.28, bz = OZ + 0.45;
      // the body stands on a wheel
      proj(bx, 0.35, bz); const ws = P.s;
      ctx.fillStyle = "#2a2f3b";
      ctx.beginPath(); ctx.ellipse(P.x, P.y, 0.2 * ws, 0.08 * ws, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = "#555c6e"; line3(ctx, [bx, 0.35, bz], [bx, 0.75, bz], 0.07);
      proj(bx, 1.05, bz); const s = P.s, x = P.x, y = P.y;
      ctx.fillStyle = c; roundRect(x - 0.24 * s, y - 0.3 * s, 0.48 * s, 0.6 * s, 0.12 * s); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.25)"; roundRect(x - 0.14 * s, y - 0.18 * s, 0.28 * s, 0.18 * s, 0.05 * s); ctx.fill();
      // the arm reaches for the paddle
      proj(bx + 0.22, 1.18, bz); const sx = P.x, sy = P.y;
      proj(bot.x, bot.y - PR * 0.9, bot.z + 0.02);
      ctx.strokeStyle = "#555c6e"; ctx.lineCap = "round"; ctx.lineWidth = Math.max(2, 0.06 * s);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(P.x, P.y); ctx.stroke(); ctx.lineCap = "butt";
      // the head, with a screen for a face
      const hy = y - 0.52 * s;
      ctx.strokeStyle = "#555c6e"; ctx.lineWidth = Math.max(1, 0.02 * s);
      ctx.beginPath(); ctx.moveTo(x, hy - 0.16 * s); ctx.lineTo(x, hy - 0.3 * s); ctx.stroke();
      ctx.fillStyle = Math.sin(clock * 4) > 0 ? "#ff4d4d" : "#7a1f1f";
      ctx.beginPath(); ctx.arc(x, hy - 0.31 * s, 0.035 * s, 0, 7); ctx.fill();
      ctx.fillStyle = c; roundRect(x - 0.2 * s, hy - 0.16 * s, 0.4 * s, 0.3 * s, 0.07 * s); ctx.fill();
      ctx.fillStyle = "#0b1020"; roundRect(x - 0.16 * s, hy - 0.12 * s, 0.32 * s, 0.22 * s, 0.05 * s); ctx.fill();
      // eyes follow the ball
      proj(ball.x, Math.max(ball.y, 0), ball.z);
      const lx = Math.max(-1, Math.min(1, (P.x - x) / 200)), ly = Math.max(-1, Math.min(1, (P.y - hy) / 200));
      ctx.fillStyle = "#6ff3ff"; ctx.strokeStyle = "#6ff3ff"; ctx.lineWidth = Math.max(1.5, 0.025 * s);
      [-1, 1].forEach(side => {
        const ex = x + side * 0.07 * s + lx * 0.025 * s, ey = hy - 0.01 * s + ly * 0.02 * s, er = 0.035 * s;
        if (bot.mood > 0) { ctx.beginPath(); ctx.arc(ex, ey + er * 0.4, er, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
        else if (bot.mood < 0) { ctx.beginPath(); ctx.moveTo(ex - er, ey - er); ctx.lineTo(ex + er, ey + er); ctx.moveTo(ex + er, ey - er); ctx.lineTo(ex - er, ey + er); ctx.stroke(); }
        else { ctx.beginPath(); ctx.arc(ex, ey, er, 0, 7); ctx.fill(); }
      });
    }

    function drawSparks(){
      sparks.forEach(p => {
        proj(p.x, p.y, p.z);
        ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(P.x - 1.5, P.y - 1.5, 3, 3);
      });
      ctx.globalAlpha = 1;
    }

    function drawMsg(){
      if (!msg) return;
      const a = Math.min(1, msg.t * 6) * (msg.t > 1.8 && !(mode === "serve" && server === "P") ? Math.max(0, 1 - (msg.t - 1.8) / 0.4) : 1);
      const pop = 1 + Math.max(0, 0.25 - msg.t) * 1.2;
      ctx.save(); ctx.globalAlpha = a;
      ctx.translate(W / 2, H * 0.3); ctx.scale(pop, pop);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `800 52px "Bricolage Grotesque", sans-serif`;
      ctx.lineWidth = 8; ctx.strokeStyle = "rgba(0,0,0,0.45)"; ctx.strokeText(msg.text, 0, 0);
      ctx.fillStyle = msg.good ? "#ffd84d" : "#ff8a7a"; ctx.fillText(msg.text, 0, 0);
      if (msg.sub) {
        ctx.font = `700 20px "Bricolage Grotesque", sans-serif`;
        ctx.lineWidth = 5; ctx.strokeText(msg.sub, 0, 40);
        ctx.fillStyle = "#fff"; ctx.fillText(msg.sub, 0, 40);
      }
      ctx.restore();
    }

    // your head follows your paddle (not all the way), and leans in when you step in for a short ball
    let headX = 0;
    function placeHead(dt){
      headX += (me.x * 0.55 - headX) * Math.min(1, dt * 7);
      const sway = Math.sin(clock * 1.7) * 0.004;
      aimCam([headX, EYE_H + sway + (me.y - 1) * 0.12, me.z - EYE_BACK], [headX * 0.25, 0.8 + (me.y - 1) * 0.2, 1.4]);
    }
    // your arm, from the bottom corner of the screen up to the paddle's handle
    function drawArm(){
      const z = me.z;
      proj(me.x + 0.02, me.y - PR * 1.45, z - 0.02); const hx = P.x, hy = P.y, hs = P.s;
      const sx = W * 0.8 + headX * 40, sy = H + 60;
      const nx = -(hy - sy), ny = hx - sx, nl = Math.hypot(nx, ny) || 1;
      const w0 = 70, w1 = Math.max(10, 0.045 * hs);
      const g = ctx.createLinearGradient(sx, sy, hx, hy);
      g.addColorStop(0, "#c98d64"); g.addColorStop(1, "#f1c49f");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(sx + nx / nl * w0, sy + ny / nl * w0); ctx.lineTo(hx + nx / nl * w1, hy + ny / nl * w1);
      ctx.lineTo(hx - nx / nl * w1, hy - ny / nl * w1); ctx.lineTo(sx - nx / nl * w0, sy - ny / nl * w0);
      ctx.closePath(); ctx.fill();
      // a T-shirt sleeve
      const mx = sx + (hx - sx) * 0.25, my = sy + (hy - sy) * 0.25, wm = w0 + (w1 - w0) * 0.25 + 6;
      ctx.fillStyle = "#2f6fdc";
      ctx.beginPath();
      ctx.moveTo(sx + nx / nl * (w0 + 8), sy + ny / nl * (w0 + 8)); ctx.lineTo(mx + nx / nl * wm, my + ny / nl * wm);
      ctx.lineTo(mx - nx / nl * wm, my - ny / nl * wm); ctx.lineTo(sx - nx / nl * (w0 + 8), sy - ny / nl * (w0 + 8));
      ctx.closePath(); ctx.fill();
      // the fist round the handle
      ctx.fillStyle = "#e9b48c"; ctx.beginPath(); ctx.ellipse(hx, hy, w1 * 1.5, w1 * 1.25, 0, 0, 7); ctx.fill();
    }
    function draw(){
      ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
      drawRoom();
      // painter's order: far things first. Where the ball goes depends on where it is.
      const under = ball.y < TY && Math.abs(ball.x) < TW + 0.05 && Math.abs(ball.z) < TL;
      const stage = ball.z > bot.z ? 0 : under || (ball.y < TY && ball.z > 0) ? 1 : ball.z > 0 ? 2 : ball.z >= me.z ? 3 : 4;
      const showBall = () => { drawShadow(); drawBall(); };
      if (stage === 0) showBall();
      drawBot();
      drawPaddle(bot, false);
      if (stage === 1) showBall();
      drawTable();
      drawMarker();
      if (stage === 2) showBall();
      drawNet();
      if (stage === 3) showBall();
      drawSparks();
      drawArm();
      drawPaddle(me, true);
      if (stage === 4) showBall();
      // the edges of the room go a little dark, like real eyes see it
      const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.62);
      v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.35)");
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
      fx.draw(ctx, fxDt);
      drawMsg();
    }

    function loop(now){
      if (!open) return;
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000 || 0)); last = now; fxDt = dt;
      update(dt);
      placeHead(dt);
      draw();
      requestAnimationFrame(loop);
    }

    /* ---------------- controls ---------------- */
    function pointerAt(e){
      const r = canvas.getBoundingClientRect();
      let sx = (e.clientX - r.left) / r.width * W, sy = (e.clientY - r.top) / r.height * H;
      if (e.pointerType === "touch") sy -= 70;     // keep the paddle above your finger
      me.tx = (sx / W - 0.5) * 2.6;
      me.ty = TY + 0.05 + (1 - sy / H) * 0.95;
      clampMe();
    }
    const stick = Fun.joystick(canvas.parentElement);   // on phones: an alternative to dragging the paddle
    canvas.addEventListener("pointermove", e => { if (mode !== "menu" && mode !== "over") pointerAt(e); });
    canvas.addEventListener("pointerdown", e => {
      if (mode === "menu" || mode === "over") return;
      canvas.focus();
      if (e.pointerType === "touch") { try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* fine */ } }
      pointerAt(e);
      if (mode === "serve" && server === "P") serve("P");
    });
    canvas.addEventListener("contextmenu", e => e.preventDefault());

    const KEYMAP = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down" };
    window.addEventListener("keydown", e => {
      if (!open) return;
      if (e.key === "Escape") { Hub.leave(); return; }
      if (mode === "menu" || mode === "over") return;
      if (e.code === "Space") { e.preventDefault(); if (mode === "serve" && server === "P") serve("P"); return; }
      const k = KEYMAP[e.code];
      if (k) { e.preventDefault(); keys[k] = true; }
    });
    window.addEventListener("keyup", e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });

    function resize(){
      const r = canvas.getBoundingClientRect();
      const k = Fun.res(r.width, W, 2);
      const w = Math.round(W * k), h = Math.round(H * k);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    }
    window.addEventListener("resize", () => { if (open) resize(); });

    function openGame(){
      open = true; mode = "menu";
      overlay.hidden = false;
      document.body.style.overflow = "hidden";
      score = { P: 0, O: 0 }; rally = null; msg = null; ball.y = -1;
      panelTitle.textContent = "🏓 Ping Pong 3D";
      panelText.textContent = "Play table tennis against Pong-Bot! Move your paddle to the ball and it bounces off. Swing fast to hit hard, hit with the edge to aim to the side, and swing down on a high ball to smash it. First to 11 wins."
        + (store.pongBestRally ? ` Your longest rally: ${store.pongBestRally} shots.` : "");
      playBtn.textContent = "▶ Play";
      renderLevels(); renderMute(); hud();
      panel.hidden = false;
      resize();
      last = performance.now();
      requestAnimationFrame(loop);
      playBtn.focus();
    }
    function closeGame(){
      open = false; mode = "menu";
      overlay.hidden = true;
      document.body.style.overflow = "";
    }

    $("ppCloseBtn").addEventListener("click", () => Hub.leave());
    playBtn.addEventListener("click", newGame);

    // for tests: peek at the game
    window.__pingPong = { state: () => ({ mode, score: { ...score }, server, rally, ball: { ...ball }, me: { ...me }, bot: { ...bot } }), toScreen: (x, y, z) => { proj(x, y, z); return { x: P.x / W, y: P.y / H }; }, setScore: (a, b) => { score = { P: a, O: b }; hud(); } };

    return { open: openGame, close: closeGame };
  }
})();
