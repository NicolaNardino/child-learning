/* Turbo Track: a toy-car race seen from above, on an orange track across a bedroom floor.
   Pick your car and its colour, then race three robot cars for 3 laps against the clock.
   Speed boosters, a ramp jump over a gap, a loop-the-loop and sharp turns. Too slow for the
   jump or the loop and you have to go back and try again! The course itself is in track.js. */
(function(){
  "use strict";
  const store = Hub.store;
  if (!store.turbo) store.turbo = {};
  const T = store.turbo;
  const fmtTime = s => Math.floor(s / 60) + ":" + (s % 60).toFixed(1).padStart(4, "0");

  Hub.register({
    id: "turbo", section: "games", title: "Turbo Track", icon: "🏎️",
    blurb: "Race robot cars round an orange toy track, with loops, jumps and speed boosters!",
    stat: () => T.bestTime ? "Best: " + fmtTime(T.bestTime) : "",
    badges: [
      { id: "turbo1",    icon: "🏎️", name: "Turbo Winner",  desc: "Win a race on Turbo Track",   test: () => (T.wins || 0) >= 1 },
      { id: "turbo5",    icon: "🏆", name: "Track Champ",   desc: "Win 5 races on Turbo Track",  test: () => (T.wins || 0) >= 5 },
      { id: "turboHard", icon: "🤖", name: "Robot Crusher", desc: "Beat the Hard robots",        test: () => (T.hardWins || 0) >= 1 },
      { id: "turboLap",  icon: "⚡", name: "Lightning Lap", desc: "Drive a lap in under 23 seconds", test: () => (T.bestLap || Infinity) < 23 }
    ],
    mount
  });

  /* ---------------- cars and colours ---------------- */
  const MODELS = [
    { id: "muscle",  name: "Muscle",  emoji: "🔥", speed: 5, turn: 3 },
    { id: "formula", name: "Formula", emoji: "⚡", speed: 4, turn: 4 },
    { id: "shark",   name: "Shark",   emoji: "🦈", speed: 5, turn: 3 },
    { id: "monster", name: "Monster", emoji: "💪", speed: 3, turn: 5 },
    { id: "bubble",  name: "Bubble",  emoji: "🫧", speed: 3, turn: 5 }
  ];
  const COLOURS = [
    { id: "red", hex: "#e8262b" }, { id: "orange", hex: "#ff7a00" }, { id: "yellow", hex: "#ffd21f" },
    { id: "lime", hex: "#6be03a" }, { id: "blue", hex: "#1f6bff" }, { id: "aqua", hex: "#20d0e0" },
    { id: "purple", hex: "#8a3cff" }, { id: "pink", hex: "#ff4fb0" }, { id: "black", hex: "#2a2d34" },
    { id: "white", hex: "#f2f2f2" }, { id: "gold", hex: "#e0b232" }, { id: "rainbow", hex: "#ff4d4d" }
  ];
  const ROBOTS = [
    { id: "easy",   label: "🐢 Easy",   skill: 0.8 },
    { id: "medium", label: "🚗 Medium", skill: 0.91 },
    { id: "hard",   label: "🚀 Hard",   skill: 1.0 }
  ];
  const LAPS = 3;

  // the paint for a car: plain colours, or gradients for gold and rainbow
  function paint(ctx, colour, len){
    if (colour === "rainbow") {
      const g = ctx.createLinearGradient(-len / 2, 0, len / 2, 0);
      ["#ff4d4d", "#ff9f1c", "#ffe14d", "#4dd66b", "#4da6ff", "#b46bff"].forEach((c, i) => g.addColorStop(i / 5, c));
      return g;
    }
    if (colour === "gold") {
      const g = ctx.createLinearGradient(0, -12, 0, 12);
      g.addColorStop(0, "#fff1a8"); g.addColorStop(0.45, "#e0b232"); g.addColorStop(1, "#8a6512");
      return g;
    }
    return (COLOURS.find(c => c.id === colour) || COLOURS[0]).hex;
  }

  function roundRect(ctx, x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // a car seen from above, pointing along +x, about 46 long and 24 wide
  function drawCar(ctx, model, colour, flame){
    const body = paint(ctx, colour, 46);
    const ink = "#14161b", glass = "#9fdde0";
    const wheel = (x, y, w, h) => { ctx.fillStyle = ink; roundRect(ctx, x - w / 2, y - h / 2, w, h, 2); ctx.fill(); };
    if (flame) {
      ctx.fillStyle = "rgba(255,160,40,0.9)";
      ctx.beginPath(); ctx.moveTo(-22, -6); ctx.lineTo(-34 - Math.random() * 10, 0); ctx.lineTo(-22, 6); ctx.fill();
      ctx.fillStyle = "rgba(255,240,120,0.95)";
      ctx.beginPath(); ctx.moveTo(-22, -3); ctx.lineTo(-28 - Math.random() * 6, 0); ctx.lineTo(-22, 3); ctx.fill();
    }
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = ink;
    if (model === "formula") {
      wheel(13, -11, 10, 6); wheel(13, 11, 10, 6); wheel(-13, -12, 11, 7); wheel(-13, 12, 11, 7);
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.moveTo(24, 0); ctx.lineTo(10, -5); ctx.lineTo(-18, -7); ctx.lineTo(-18, 7); ctx.lineTo(10, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
      roundRect(ctx, 18, -11, 5, 22, 1); ctx.fill(); ctx.stroke();      // front wing
      roundRect(ctx, -24, -12, 6, 24, 1); ctx.fill(); ctx.stroke();     // back wing
      ctx.fillStyle = ink; ctx.beginPath(); ctx.ellipse(-2, 0, 5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.fillRect(4, -1, 14, 2);
    } else if (model === "monster") {
      wheel(13, -12, 15, 9); wheel(13, 12, 15, 9); wheel(-13, -12, 15, 9); wheel(-13, 12, 15, 9);
      ctx.fillStyle = body; roundRect(ctx, -19, -9, 38, 18, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = glass; roundRect(ctx, -3, -7, 10, 14, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = ink; ctx.fillRect(-16, -6, 8, 12);
    } else if (model === "bubble") {
      wheel(11, -11, 9, 5); wheel(11, 11, 9, 5); wheel(-11, -11, 9, 5); wheel(-11, 11, 9, 5);
      ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 0, 21, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = glass; ctx.beginPath(); ctx.ellipse(1, 0, 10, 8.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.beginPath(); ctx.ellipse(4, -3, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
    } else if (model === "shark") {
      wheel(10, -11, 9, 5); wheel(10, 11, 9, 5); wheel(-12, -11, 10, 6); wheel(-12, 11, 10, 6);
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.moveTo(25, 0); ctx.quadraticCurveTo(14, -12, -20, -11); ctx.lineTo(-22, 11); ctx.quadraticCurveTo(14, 12, 25, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = glass; ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(0, -7); ctx.lineTo(-6, -6); ctx.lineTo(-6, 6); ctx.lineTo(0, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = ink; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-20, -3); ctx.lineTo(-20, 3); ctx.closePath(); ctx.fill(); // fin
      ctx.fillStyle = "#fff"; [14, 17, 20].forEach(x => ctx.fillRect(x, -6 + (x - 14) / 3, 1.5, 3));                    // gills
    } else { // muscle
      wheel(12, -11, 10, 6); wheel(12, 11, 10, 6); wheel(-12, -11, 11, 7); wheel(-12, 11, 11, 7);
      ctx.fillStyle = body; roundRect(ctx, -22, -11, 45, 22, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.fillRect(-22, -3.5, 45, 2.5); ctx.fillRect(-22, 1, 45, 2.5); // racing stripes
      ctx.fillStyle = glass; roundRect(ctx, -6, -9, 12, 18, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = ink; roundRect(ctx, 10, -4, 7, 8, 1.5); ctx.fill();                                          // hood scoop
    }
  }

  /* ---------------- the course ---------------- */
  const C = TurboTrackCourse.build();
  const { samples, N, L, DS, HALF, wrap } = C;

  // the track drawn as paths: the road (without the gap), the part of the loop that crosses over, the middle line
  function trackPath(filter){
    const p = new Path2D();
    let open = false;
    for (let i = 0; i <= N; i++) {
      const s = samples[i % N];
      if (filter(s)) { if (open) p.lineTo(s.x, s.y); else { p.moveTo(s.x, s.y); open = true; } }
      else open = false;
    }
    return p;
  }
  const ROAD = trackPath(s => s.kind !== "gap");
  const DECK = trackPath(s => s.deck);
  const LINE = trackPath(s => s.kind === "road" || s.kind === "loop");

  // the floor: wooden planks, a rug in the middle, and some toy blocks
  let planks = null;
  function plankPattern(ctx){
    if (planks) return planks;
    const c = document.createElement("canvas");
    c.width = 240; c.height = 240;
    const g = c.getContext("2d");
    const tones = ["#c8935a", "#bf8a50", "#d09c62", "#c48f55"];
    for (let r = 0; r < 4; r++) {
      g.fillStyle = tones[r];
      g.fillRect(0, r * 60, 240, 60);
      g.fillStyle = "rgba(90,50,20,0.35)";
      g.fillRect(0, r * 60, 240, 2);
      g.fillRect(((r * 97) % 240), r * 60, 2, 60);
      g.strokeStyle = "rgba(120,70,30,0.18)";
      for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(0, r * 60 + 14 + k * 15); g.bezierCurveTo(80, r * 60 + 10 + k * 15, 160, r * 60 + 20 + k * 15, 240, r * 60 + 14 + k * 15); g.stroke(); }
    }
    planks = ctx.createPattern(c, "repeat");
    return planks;
  }
  const TOYS = [
    { x: 1700, y: 1150, kind: "rug" },
    { x: 2350, y: 900, kind: "block", c: "#e8262b", letter: "A", r: 0.3 },
    { x: 2450, y: 1000, kind: "block", c: "#1f6bff", letter: "B", r: -0.2 },
    { x: 2300, y: 1050, kind: "block", c: "#ffd21f", letter: "C", r: 0.1 },
    { x: 180, y: 250, kind: "ball" },
    { x: 3250, y: 2150, kind: "block", c: "#6be03a", letter: "D", r: 0.4 },
    { x: 1600, y: 2200, kind: "book" },
    { x: 3250, y: 300, kind: "ball" }
  ];
  function drawFloorThings(ctx){
    TOYS.forEach(t => {
      ctx.save();
      ctx.translate(t.x, t.y);
      if (t.kind === "rug") {
        ["#3b5bdb", "#f8f0e3", "#e8262b", "#f8f0e3", "#3b5bdb"].forEach((c, i) => {
          ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, 0, 520 - i * 90, 300 - i * 52, 0, 0, Math.PI * 2); ctx.fill();
        });
      } else if (t.kind === "block") {
        ctx.rotate(t.r);
        ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(-28, -22, 60, 60);
        ctx.fillStyle = t.c; ctx.fillRect(-32, -32, 64, 64);
        ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 3; ctx.strokeRect(-32, -32, 64, 64);
        ctx.fillStyle = "#fff"; ctx.font = "800 40px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(t.letter, 0, 2);
      } else if (t.kind === "ball") {
        ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(10, 14, 54, 46, 0, 0, Math.PI * 2); ctx.fill();
        ["#e8262b", "#ffd21f", "#1f6bff", "#6be03a"].forEach((c, i) => {
          ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 55, i * Math.PI / 2, (i + 1) * Math.PI / 2); ctx.fill();
        });
      } else if (t.kind === "book") {
        ctx.rotate(-0.15);
        ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(-110, -60, 230, 140);
        ctx.fillStyle = "#7a3b8f"; ctx.fillRect(-118, -72, 230, 140);
        ctx.fillStyle = "#f8f0e3"; ctx.fillRect(-118, 56, 230, 10);
        ctx.fillStyle = "#ffd21f"; ctx.font = "800 30px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center";
        ctx.fillText("RACING", -3, 10);
      }
      ctx.restore();
    });
  }

  function mount(host){
    host.innerHTML = `
    <section class="game-screen" id="ttOverlay" hidden aria-label="Turbo Track">
      <div class="game-box">
        <div class="game-hud">
          <h2>🏎️ Turbo Track</h2>
          <span class="mono game-stat" id="ttTime">⏱ 0:00.0</span>
          <span class="mono game-stat" id="ttLap">Lap 1/${LAPS}</span>
          <span class="mono game-stat" id="ttPos">🏁 1st</span>
          <button class="btn ghost small" id="ttCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas id="ttCanvas" width="960" height="540"></canvas>
          <div class="game-panel tt-panel" id="ttPanel">
            <div class="game-panel-title" id="ttPanelTitle">🏎️ Turbo Track</div>
            <div class="game-panel-text" id="ttPanelText"></div>
            <div class="tt-results" id="ttResults" hidden></div>
            <div class="tt-garage" id="ttGarage">
              <canvas class="tt-preview" id="ttPreview" width="300" height="150" aria-hidden="true"></canvas>
              <div class="tt-models" id="ttModels" role="group" aria-label="Car"></div>
              <div class="tt-stats" id="ttStats"></div>
              <div class="tt-colours" id="ttColours" role="group" aria-label="Colour"></div>
              <div class="tt-robots"><span>Robots:</span><div class="segmented" id="ttRobots" role="group" aria-label="Robot drivers"></div></div>
            </div>
            <div class="tt-actions">
              <button class="btn" id="ttPlayBtn" type="button">▶ Race!</button>
              <button class="btn ghost" id="ttGarageBtn" type="button" hidden>🚗 Change car</button>
            </div>
          </div>
        </div>
        <div class="game-help">↑ or W to drive · ↓ or S to brake · ← → or A D to steer · hit the ⚡ boosters before the jump and the loop!</div>
        <div class="game-touch">
          <button class="btn ghost" data-key="left" type="button" aria-label="Steer left">◀</button>
          <button class="btn ghost" data-key="right" type="button" aria-label="Steer right">▶</button>
          <button class="btn ghost" data-key="brake" type="button" aria-label="Brake">🛑</button>
          <button class="btn" data-key="gas" type="button" aria-label="Drive">⛽ GO</button>
        </div>
      </div>
    </section>`;

    const $ = id => document.getElementById(id);
    const overlay = $("ttOverlay"), canvas = $("ttCanvas"), ctx = canvas.getContext("2d");
    const panel = $("ttPanel"), panelTitle = $("ttPanelTitle"), panelText = $("ttPanelText");
    const results = $("ttResults"), garage = $("ttGarage"), playBtn = $("ttPlayBtn"), garageBtn = $("ttGarageBtn");
    const timeEl = $("ttTime"), lapEl = $("ttLap"), posEl = $("ttPos");
    const W = canvas.width, H = canvas.height;
    let ZOOM = 0.78;

    if (!T.model) T.model = "muscle";
    if (!T.colour) T.colour = "red";
    if (!T.robots) T.robots = "easy";

    /* ---------------- the garage: pick a car, a colour and the robots ---------------- */
    const preview = $("ttPreview"), pctx = preview.getContext("2d");
    function drawPreview(){
      pctx.clearRect(0, 0, preview.width, preview.height);
      pctx.save();
      pctx.translate(150, 78);
      pctx.scale(2.6, 2.6);
      pctx.fillStyle = "rgba(0,0,0,0.3)";
      pctx.beginPath(); pctx.ellipse(2, 5, 25, 14, 0, 0, Math.PI * 2); pctx.fill();
      drawCar(pctx, T.model, T.colour, false);
      pctx.restore();
    }
    function renderGarage(){
      const models = $("ttModels"); models.innerHTML = "";
      MODELS.forEach(m => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "btn ghost small";
        b.textContent = `${m.emoji} ${m.name}`;
        b.setAttribute("aria-pressed", String(m.id === T.model));
        b.addEventListener("click", () => { T.model = m.id; Hub.saveStore(); renderGarage(); });
        models.appendChild(b);
      });
      const m = MODELS.find(x => x.id === T.model) || MODELS[0];
      $("ttStats").textContent = `Speed ${"●".repeat(m.speed)}${"○".repeat(5 - m.speed)}   Turning ${"●".repeat(m.turn)}${"○".repeat(5 - m.turn)}`;
      const colours = $("ttColours"); colours.innerHTML = "";
      COLOURS.forEach(c => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "tt-swatch tt-" + c.id;
        b.style.background = c.id === "rainbow" ? "" : c.id === "gold" ? "" : c.hex;
        b.setAttribute("aria-label", c.id);
        b.setAttribute("aria-pressed", String(c.id === T.colour));
        b.addEventListener("click", () => { T.colour = c.id; Hub.saveStore(); renderGarage(); });
        colours.appendChild(b);
      });
      const robots = $("ttRobots"); robots.innerHTML = "";
      ROBOTS.forEach(r => {
        const b = document.createElement("button");
        b.type = "button"; b.textContent = r.label;
        b.setAttribute("aria-pressed", String(r.id === T.robots));
        b.addEventListener("click", () => { T.robots = r.id; Hub.saveStore(); renderGarage(); });
        robots.appendChild(b);
      });
      drawPreview();
    }

    /* ---------------- the race ---------------- */
    let open = false, state = "garage"; // garage · countdown · racing · done
    let last = 0, raceT = 0, countT = 0, cars = [], me = null, sparks = [], msg = null;
    const keys = { left: false, right: false, gas: false, brake: false };

    function makeCar(opts, row, lane){
      const prog = -50 - row * 70;
      const p = C.at(prog, lane);
      return Object.assign({
        prog, i: wrap(Math.floor(prog / DS)), x: p.x, y: p.y, angle: p.angle, v: 0, lat: lane, z: 0,
        boostT: 0, rail: null, finishT: null, lapStart: 0, lapsDone: 0, bestLap: Infinity
      }, opts);
    }

    function newRace(){
      const skill = (ROBOTS.find(r => r.id === T.robots) || ROBOTS[0]).skill;
      const m = MODELS.find(x => x.id === T.model) || MODELS[0];
      const others = COLOURS.filter(c => c.id !== T.colour && c.id !== "rainbow" && c.id !== "gold");
      const pickColour = () => others.splice(Math.floor(Math.random() * others.length), 1)[0].id;
      const botModels = MODELS.map(x => x.id).sort(() => Math.random() - 0.5);
      me = makeCar({ name: "You", me: true, model: m.id, colour: T.colour,
        maxV: 470 + m.speed * 16, turnRate: 2.4 + m.turn * 0.22 }, 1, -36);
      cars = [
        makeCar({ name: "Robo Max", model: botModels[0], colour: pickColour(), skill, phase: 0 }, 0, -36),
        makeCar({ name: "Robo Zip", model: botModels[1], colour: pickColour(), skill: skill * 0.97, phase: 2 }, 0, 36),
        makeCar({ name: "Robo Bolt", model: botModels[2], colour: pickColour(), skill: skill * 0.94, phase: 4 }, 1, 36),
        me
      ];
      cars.forEach(c => { if (!c.me) { c.robot = true; c.lane = c.lat; c.maxV = 540 * c.skill; } });
      sparks = []; msg = null; raceT = 0; countT = 3.2;
      state = "countdown";
      panel.hidden = true;
      canvas.focus();
    }

    function say(text, secs){ msg = { text, t: secs || 1.6 }; }

    // a car riding the loop or the jump by itself
    function rideRail(c, dt){
      c.prog += c.v * dt;
      const rel = c.prog - c.rail.from;
      if (c.rail.zone.kind === "loop") c.lat *= Math.pow(0.02, dt);
      if (rel >= c.rail.len) {
        c.rail = null;
        if (c.me) say(c.lastZone === "loop" ? "🌀 LOOP!" : "🚀 Nice jump!", 1.1);
      }
      const p = C.at(c.prog, c.lat);
      c.x = p.x; c.y = p.y; c.angle = p.angle; c.z = c.rail ? p.z : 0;
      c.i = p.i;
    }

    function startRail(c, zone){
      const from = zone.start * DS + Math.floor(c.prog / L) * L;
      c.rail = { zone, from, len: (zone.end - zone.start + 1) * DS };
      c.prog = from;
      c.lastZone = zone.kind;
    }

    function driveMe(dt){
      const c = me;
      if (c.rail) { rideRail(c, dt); return; }
      const top = c.boostT > 0 ? c.maxV * 1.45 : c.maxV;
      if (keys.gas) c.v = Math.min(top, c.v + (c.v < top ? 430 : -300) * dt);
      else if (keys.brake) c.v = c.v > 0 ? Math.max(0, c.v - 800 * dt) : Math.max(-160, c.v - 260 * dt);
      else c.v -= Math.sign(c.v) * Math.min(Math.abs(c.v), 170 * dt);
      if (c.v > top) c.v = Math.max(top, c.v - 300 * dt); // boost wearing off
      const steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      c.angle += steer * c.turnRate * Math.min(1, Math.abs(c.v) / 180) * Math.sign(c.v) * dt;
      c.x += Math.cos(c.angle) * c.v * dt;
      c.y += Math.sin(c.angle) * c.v * dt;

      // which bit of track are we on? look near where we were
      let best = c.i, bestD = Infinity;
      for (let k = -25; k <= 40; k++) {
        const j = wrap(c.i + k), s = samples[j];
        const d = (s.x - c.x) ** 2 + (s.y - c.y) ** 2;
        if (d < bestD) { bestD = d; best = j; }
      }
      let step = best - c.i;
      if (step > N / 2) step -= N; else if (step < -N / 2) step += N;
      c.prog += step * DS;
      c.i = best;
      const s = samples[best];

      // the orange walls: scrape along them and slow down
      const lat = (c.x - s.x) * s.nx + (c.y - s.y) * s.ny, room = HALF - 13;
      if (Math.abs(lat) > room) {
        const push = lat - Math.sign(lat) * room;
        c.x -= s.nx * push; c.y -= s.ny * push;
        c.v *= Math.pow(0.25, dt);
        let da = s.angle - c.angle;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) < Math.PI / 2) c.angle += da * Math.min(1, 6 * dt);
        if (Math.abs(c.v) > 120 && Math.random() < 0.6) sparks.push({ x: c.x - s.nx * Math.sign(lat) * 10, y: c.y - s.ny * Math.sign(lat) * 10, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120, t: 0.35 });
      }
      c.lat = (c.x - s.x) * s.nx + (c.y - s.y) * s.ny;

      if (s.boost && c.v > 0) { if (c.boostT <= 0) say("⚡ BOOST!", 0.8); c.boostT = 1.4; }

      // the jump and the loop: fast enough and you ride it, too slow and you go back for another try
      const zone = s.zone;
      if (zone) {
        const into = wrap(best - zone.start);
        if (into < 8 && c.v > 0) {
          if (c.v >= zone.min) startRail(c, zone);
          else {
            say(zone.kind === "loop" ? "😬 Too slow for the loop! Hit the ⚡ booster first." : "😬 Too slow to jump! Hit the ⚡ booster first.", 2.2);
            backTo(c, zone.start - 60);
          }
        } else if (into >= 8 && into < zone.end - zone.start - 6) {
          backTo(c, zone.start - 60); // drove in backwards
        }
      }
    }

    function backTo(c, index){
      const lapBase = Math.floor(c.prog / L) * L;
      c.prog = lapBase + index * DS;
      const p = C.at(c.prog, 0);
      c.x = p.x; c.y = p.y; c.angle = p.angle; c.i = p.i; c.v = 0; c.lat = 0;
    }

    function driveRobot(c, dt){
      const s = samples[wrap(Math.floor(c.prog / DS))];
      if (s.boost) c.boostT = 1.4;
      let target = Math.min(s.safe * c.skill, c.boostT > 0 ? c.maxV * 1.35 : c.maxV);
      // stay in the race: a little slower when far ahead of you, a little faster when far behind
      const gap = c.prog - me.prog;
      if (gap > 700) target *= 0.93; else if (gap < -900) target *= 1.06;
      c.v = c.v < target ? Math.min(target, c.v + 400 * dt) : Math.max(target, c.v - 900 * dt);
      if (c.rail) { rideRail(c, dt); return; }
      if (s.zone && wrap(Math.floor(c.prog / DS) - s.zone.start) < 8) { startRail(c, s.zone); rideRail(c, dt); return; }
      c.prog += c.v * dt;
      c.lat += ((c.lane + 16 * Math.sin(raceT * 0.6 + c.phase)) - c.lat) * Math.min(1, 2 * dt);
      const p = C.at(c.prog, c.lat);
      c.x = p.x; c.y = p.y; c.angle = p.angle; c.i = p.i; c.z = 0;
    }

    function bumpCars(){
      cars.forEach(a => cars.forEach(b => {
        if (a === b || !a.me || Math.abs(a.z - b.z) > 0.2 || a.rail || b.rail) return;
        const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
        if (d > 0 && d < 30) {
          a.x += dx / d * (30 - d); a.y += dy / d * (30 - d);
          a.v *= 0.92; b.v *= 0.95;
        }
      }));
    }

    function lapsAndFinish(c){
      const done = Math.floor(c.prog / L);
      if (done > c.lapsDone && c.finishT === null) {
        const lapTime = raceT - c.lapStart;
        c.lapStart = raceT;
        c.lapsDone = done;
        c.bestLap = Math.min(c.bestLap, lapTime);
        if (done >= LAPS) c.finishT = raceT;
        else if (c.me) say(done === LAPS - 1 ? "🔔 Final lap!" : `Lap ${done + 1}! (${fmtTime(lapTime)})`, 1.4);
      }
    }

    function standings(){
      return cars.slice().sort((a, b) => {
        if (a.finishT !== null || b.finishT !== null) return (a.finishT ?? Infinity) - (b.finishT ?? Infinity);
        return b.prog - a.prog;
      });
    }
    const ordinal = n => n + (["st", "nd", "rd"][n - 1] || "th");

    function step(dt){
      if (state === "countdown") {
        countT -= dt;
        if (countT <= 0) { state = "racing"; say("GO GO GO! 🏁", 1); }
        return;
      }
      if (state !== "racing" && state !== "done") return;
      if (state === "racing") raceT += dt;
      cars.forEach(c => {
        c.boostT -= dt;
        if (c.me && state === "racing") driveMe(dt);
        else if (c.robot) driveRobot(c, dt);
        else if (c.me) { c.v *= Math.pow(0.3, dt); c.x += Math.cos(c.angle) * c.v * dt; c.y += Math.sin(c.angle) * c.v * dt; }
        lapsAndFinish(c);
      });
      bumpCars();
      sparks.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.t -= dt; });
      sparks = sparks.filter(p => p.t > 0);
      if (msg && (msg.t -= dt) <= 0) msg = null;
      if (state === "racing" && me.finishT !== null) finish();
    }

    function finish(){
      state = "done";
      const order = standings();
      // robots still racing: guess when they'd finish
      order.forEach(c => { if (c.finishT === null) c.guessT = raceT + (LAPS * L - c.prog) / Math.max(200, c.v || 200); });
      order.sort((a, b) => (a.finishT ?? a.guessT) - (b.finishT ?? b.guessT));
      const place = order.indexOf(me) + 1;
      const won = place === 1;
      const newBest = !T.bestTime || me.finishT < T.bestTime;
      if (won) { T.wins = (T.wins || 0) + 1; if (T.robots === "hard") T.hardWins = (T.hardWins || 0) + 1; }
      if (newBest) T.bestTime = me.finishT;
      if (me.bestLap < (T.bestLap || Infinity)) T.bestLap = me.bestLap;
      Hub.saveStore();
      Hub.checkBadges();

      panelTitle.textContent = won ? "🏆 You won!" : `🏁 You came ${ordinal(place)}!`;
      panelText.textContent = `Your time: ${fmtTime(me.finishT)} · best lap ${fmtTime(me.bestLap)}` + (newBest ? " · a new best! 🎉" : ` · your best is ${fmtTime(T.bestTime)}`);
      results.innerHTML = "";
      order.forEach((c, k) => {
        const row = document.createElement("div");
        row.className = "tt-row" + (c.me ? " me" : "");
        row.textContent = `${["🥇", "🥈", "🥉", "4."][k]} ${c.name}  ${fmtTime(c.finishT ?? c.guessT)}`;
        results.appendChild(row);
      });
      results.hidden = false;
      garage.hidden = true;
      garageBtn.hidden = false;
      playBtn.textContent = "▶ Race again";
      panel.hidden = false;
      if (won) Hub.confettiBurst(playBtn);
      playBtn.focus();
    }

    /* ---------------- drawing ---------------- */
    function draw(){
      const focus = me || cars[0];
      ZOOM = canvas.clientWidth && canvas.clientWidth < 600 ? 1.05 : 0.78; // closer up on small screens, so the cars aren't tiny
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      let camX = C.start[0], camY = C.start[1];
      if (focus) {
        camX = focus.x + Math.cos(focus.angle) * Math.min(160, Math.abs(focus.v) * 0.3);
        camY = focus.y + Math.sin(focus.angle) * Math.min(160, Math.abs(focus.v) * 0.3);
      }
      ctx.setTransform(ZOOM, 0, 0, ZOOM, W / 2 - camX * ZOOM, H / 2 - camY * ZOOM);
      const view = { x: camX - W / 2 / ZOOM, y: camY - H / 2 / ZOOM, w: W / ZOOM, h: H / ZOOM };

      ctx.fillStyle = plankPattern(ctx);
      ctx.fillRect(view.x, view.y, view.w, view.h);
      drawFloorThings(ctx);

      // the track: shadow, dark edges, orange road
      ctx.lineJoin = "round"; ctx.lineCap = "butt";
      ctx.save(); ctx.translate(8, 10); ctx.strokeStyle = "rgba(40,20,0,0.3)"; ctx.lineWidth = HALF * 2 + 14; ctx.stroke(ROAD); ctx.restore();
      ctx.strokeStyle = "#b84a00"; ctx.lineWidth = HALF * 2 + 12; ctx.stroke(ROAD);
      ctx.strokeStyle = "#ff7a00"; ctx.lineWidth = HALF * 2; ctx.stroke(ROAD);
      ctx.strokeStyle = "rgba(255,200,120,0.55)"; ctx.lineWidth = 3; ctx.setLineDash([26, 22]); ctx.stroke(LINE); ctx.setLineDash([]);
      drawSpecials();
      // the loop's top crosses over the road, so it's drawn again on top
      ctx.save(); ctx.translate(14, 18); ctx.strokeStyle = "rgba(40,20,0,0.35)"; ctx.lineWidth = HALF * 2 + 14; ctx.stroke(DECK); ctx.restore();
      ctx.strokeStyle = "#b84a00"; ctx.lineWidth = HALF * 2 + 12; ctx.stroke(DECK);
      ctx.strokeStyle = "#ff8f1f"; ctx.lineWidth = HALF * 2; ctx.stroke(DECK);

      // cars: low ones first, so cars up the loop or in the air go on top
      cars.slice().sort((a, b) => a.z - b.z).forEach(c => {
        const sc = 1 + c.z * 0.45;
        ctx.save();
        ctx.translate(c.x + 4 + c.z * 30, c.y + 6 + c.z * 36);
        ctx.rotate(c.angle);
        ctx.fillStyle = "rgba(0,0,0,0.28)";
        ctx.beginPath(); ctx.ellipse(0, 0, 24 * sc, 13 * sc, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.angle);
        ctx.scale(sc, sc);
        drawCar(ctx, c.model, c.colour, c.boostT > 0);
        ctx.restore();
        if (c.me) {
          ctx.fillStyle = "#fff"; ctx.strokeStyle = "#000"; ctx.lineWidth = 4;
          ctx.font = "800 22px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center";
          ctx.strokeText("YOU", c.x, c.y - 30 * sc); ctx.fillText("YOU", c.x, c.y - 30 * sc);
        }
      });
      sparks.forEach(p => { ctx.fillStyle = p.t > 0.2 ? "#fff3a0" : "#ff9f1c"; ctx.fillRect(p.x - 3, p.y - 3, 6, 6); });

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawMinimap();
      if (state === "countdown") drawLights();
      if (msg) {
        ctx.font = "800 30px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center";
        ctx.lineWidth = 6; ctx.strokeStyle = "rgba(0,0,0,0.7)"; ctx.fillStyle = "#fff";
        ctx.strokeText(msg.text, W / 2, 70); ctx.fillText(msg.text, W / 2, 70);
      }
      if (me && state === "racing") {
        const kmh = Math.round(Math.abs(me.v) / 4);
        ctx.font = "800 26px 'IBM Plex Mono', monospace"; ctx.textAlign = "left";
        ctx.lineWidth = 5; ctx.strokeStyle = "rgba(0,0,0,0.7)"; ctx.fillStyle = me.boostT > 0 ? "#ffe14d" : "#fff";
        ctx.strokeText(kmh + " km/h", 16, H - 18); ctx.fillText(kmh + " km/h", 16, H - 18);
      }
    }

    // boosters, the ramp and landing, and the checkered start line
    function drawSpecials(){
      for (let i = 0; i < N; i++) {
        const s = samples[i];
        if (s.boost && i % 3 === 0) {
          ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.angle);
          ctx.fillStyle = (i / 3) % 2 ? "#ffe14d" : "#20d0e0";
          ctx.beginPath(); ctx.moveTo(-6, -50); ctx.lineTo(12, 0); ctx.lineTo(-6, 50); ctx.lineTo(-18, 50); ctx.lineTo(0, 0); ctx.lineTo(-18, -50); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        if ((s.kind === "ramp" || s.kind === "land") && i % 2 === 0) {
          ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.angle);
          const z = s.kind === "ramp" ? C.heightAt(i) : 0;
          ctx.fillStyle = s.kind === "ramp" ? `rgb(${255},${150 + z * 300},${60 + z * 200})` : "#ff9a3c";
          ctx.fillRect(-6, -HALF, 13, HALF * 2);
          if (i % 6 === 0) { ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.fillRect(-2, -HALF, 4, HALF * 2); }
          ctx.restore();
        }
        if (s.kind === "gap" && samples[wrap(i - 1)].kind !== "gap") {
          ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.angle);
          ctx.fillStyle = "#fff"; ctx.strokeStyle = "#000"; ctx.lineWidth = 5;
          ctx.font = "800 26px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "left";
          ctx.strokeText("JUMP!", 20, -HALF - 18); ctx.fillText("JUMP!", 20, -HALF - 18);
          ctx.restore();
        }
      }
      const s = samples[0];
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.angle);
      for (let r = 0; r < 12; r++) for (let k = 0; k < 2; k++) {
        ctx.fillStyle = (r + k) % 2 ? "#111" : "#fff";
        ctx.fillRect(k * 12 - 12, -HALF + r * HALF / 6, 12, HALF / 6);
      }
      ctx.restore();
    }

    // the whole track, small, in the corner, with a dot for every car
    const MINI = { w: 170, h: 115 };
    const miniScale = Math.min(MINI.w / C.world.w, MINI.h / C.world.h);
    function drawMinimap(){
      ctx.save();
      ctx.translate(W - MINI.w - 12, 12);
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      roundRect(ctx, -6, -6, MINI.w + 12, MINI.h + 12, 8); ctx.fill();
      ctx.scale(miniScale, miniScale);
      ctx.strokeStyle = "#ff7a00"; ctx.lineWidth = 2.2 / miniScale; ctx.stroke(ROAD);
      cars.forEach(c => {
        ctx.fillStyle = c.me ? "#fff" : paint(ctx, c.colour, 46);
        ctx.beginPath(); ctx.arc(c.x, c.y, (c.me ? 5 : 3.5) / miniScale, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();
    }

    function drawLights(){
      const lit = Math.min(3, Math.floor(3.2 - countT) + 1);
      ctx.save();
      ctx.translate(W / 2, 120);
      ctx.fillStyle = "#222"; roundRect(ctx, -105, -38, 210, 76, 14); ctx.fill();
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = k < lit ? (lit === 3 && countT < 0.4 ? "#4dd66b" : "#ff3b3b") : "#444";
        ctx.beginPath(); ctx.arc(-62 + k * 62, 0, 24, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    function updateHud(){
      timeEl.textContent = "⏱ " + fmtTime(raceT);
      if (!me) return;
      lapEl.textContent = `Lap ${Math.min(LAPS, Math.max(1, me.lapsDone + 1))}/${LAPS}`;
      posEl.textContent = "🏁 " + ordinal(standings().indexOf(me) + 1);
    }

    function loop(now){
      if (!open) return;
      const dt = Math.min(1 / 30, (now - last) / 1000 || 0);
      last = now;
      step(dt);
      draw();
      updateHud();
      requestAnimationFrame(loop);
    }

    function showGarage(){
      state = "garage";
      panelTitle.textContent = "🏎️ Turbo Track";
      panelText.textContent = `Pick your car and colour, then race the robots for ${LAPS} laps!` + (T.bestTime ? ` Your best: ${fmtTime(T.bestTime)}.` : "");
      results.hidden = true;
      garage.hidden = false;
      garageBtn.hidden = true;
      playBtn.textContent = "▶ Race!";
      panel.hidden = false;
      renderGarage();
      playBtn.focus();
    }

    function openGame(){
      open = true;
      overlay.hidden = false;
      document.body.style.overflow = "hidden";
      if (!cars.length) newPreviewRace();
      showGarage();
      last = performance.now();
      requestAnimationFrame(loop);
    }
    // cars parked on the grid behind the garage panel
    function newPreviewRace(){
      newRace();
      state = "garage";
      panel.hidden = false;
    }
    function closeGame(){
      open = false;
      overlay.hidden = true;
      document.body.style.overflow = "";
      Object.keys(keys).forEach(k => { keys[k] = false; });
      if (state !== "garage") { newPreviewRace(); state = "garage"; }
    }

    /* ---------------- controls ---------------- */
    const KEYMAP = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "gas", KeyW: "gas", ArrowDown: "brake", KeyS: "brake", Space: "brake" };
    window.addEventListener("keydown", e => {
      if (!open) return;
      if (e.key === "Escape") { Hub.leave(); return; }
      const k = KEYMAP[e.code];
      if (!k || !panel.hidden) return;
      e.preventDefault();
      keys[k] = true;
    });
    window.addEventListener("keyup", e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
    host.querySelectorAll(".game-touch [data-key]").forEach(btn => {
      const k = btn.dataset.key;
      btn.addEventListener("pointerdown", e => { e.preventDefault(); btn.setPointerCapture(e.pointerId); keys[k] = true; });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach(ev => btn.addEventListener(ev, () => { keys[k] = false; }));
    });
    canvas.tabIndex = 0;

    $("ttCloseBtn").addEventListener("click", () => Hub.leave());
    playBtn.addEventListener("click", newRace);
    garageBtn.addEventListener("click", () => { newPreviewRace(); showGarage(); });

    return { open: openGame, close: closeGame };
  }
})();
