/* Zombie Blaster: a first-person shooter. Zombies climb out of a moonlit graveyard and you
   see it all through your own eyes, goo blaster in hand and a torch lighting the way.
   Waves get bigger, faster and tougher. */
(function(){
  "use strict";
  const store = Hub.store;

  Hub.register({
    id: "zombie-blaster", section: "games", title: "Zombie Blaster", icon: "🧟",
    blurb: "Blast the silly zombies climbing out of the graveyard. How many waves can you survive?",
    stat: () => store.zombieBest ? "Best: " + store.zombieBest : "",
    badges: [
      { id: "zombie5", icon: "🧟", name: "Zombie Buster", desc: "Reach wave 5 in Zombie Blaster", test: () => (store.zombieWave || 0) >= 5 }
    ],
    mount
  });

  function mount(host){
    host.innerHTML = `
    <section class="game-screen" id="zbOverlay" hidden aria-label="Zombie Blaster">
      <div class="game-box">
        <div class="game-hud">
          <h2>🧟 Zombie Blaster</h2>
          <span class="mono game-stat" id="zbScore">⭐ 0</span>
          <span class="mono game-stat" id="zbWave">🌊 Wave 1</span>
          <span class="mono game-stat" id="zbHearts">❤️❤️❤️</span>
          <button class="btn ghost small" id="zbCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas id="zbCanvas" width="960" height="540"></canvas>
          <div class="game-panel zb-panel" id="zbPanel">
            <div class="game-panel-title" id="zbPanelTitle">Zombie Blaster</div>
            <div class="game-panel-text" id="zbPanelText"></div>
            <button class="btn" id="zbPlayBtn" type="button">▶ Play</button>
          </div>
        </div>
        <div class="game-help">Click the game to look around with the mouse · W A S D to walk · ← → or Q E to turn · click or Space to blast · Esc lets go of the mouse</div>
        <div class="game-touch">
          <button class="btn ghost" data-zkey="left" type="button" aria-label="Turn left">↶</button>
          <button class="btn ghost" data-zkey="up" type="button" aria-label="Walk forward">▲</button>
          <button class="btn ghost" data-zkey="down" type="button" aria-label="Back up">▼</button>
          <button class="btn ghost" data-zkey="right" type="button" aria-label="Turn right">↷</button>
          <button class="btn" data-zkey="fire" type="button" aria-label="Blast">💥 BLAST</button>
        </div>
      </div>
    </section>`;

    let zbOpen = false;

    function roundRect(ctx, x, y, w, h, r){
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
    const zbOverlay = document.getElementById("zbOverlay");
    const zbCanvas = document.getElementById("zbCanvas");
    const zbCtx = zbCanvas.getContext("2d");
    const zbPanel = document.getElementById("zbPanel");
    const zbPanelTitle = document.getElementById("zbPanelTitle");
    const zbPanelText = document.getElementById("zbPanelText");
    const zbPlayBtn = document.getElementById("zbPlayBtn");
    const zbScoreEl = document.getElementById("zbScore");
    const zbWaveEl = document.getElementById("zbWave");
    const zbHeartsEl = document.getElementById("zbHearts");

    const ZW = 960, ZH = 540;
    const ARENA = 22;                 // the graveyard runs from -22 to 22 both ways
    const EYE_H = 1.65, PITCH = 0.03, FOCAL = 560, NEAR = 0.25; // the camera is your eyes
    const SIN_P = Math.sin(PITCH), COS_P = Math.cos(PITCH);
    const HORIZON = ZH / 2 - FOCAL * Math.tan(PITCH);
    const ZB_MOVE = 5.2, ZB_TURN = 2.6, SHOT_SPEED = 24, SHOT_EVERY = 0.2, MAX_HEARTS = 5;
    const ZOMBIE_TYPES = {
      walker: { hp: 2, speed: 1.5, size: 1,    shirt: "#3e5675", points: 10 },
      runner: { hp: 1, speed: 2.9, size: 0.82, shirt: "#7a4a2c", points: 15 },
      brute:  { hp: 6, speed: 1.1, size: 1.35, shirt: "#4d3b5c", points: 30 }
    };

    // a seeded random, so the graveyard looks the same every game
    function seeded(seed){ return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
    const PROPS = (() => {
      const rnd = seeded(7), list = [], kinds = ["stone", "stone", "tree", "stone", "pumpkin"];
      while (list.length < 30) {
        const x = (rnd() * 2 - 1) * (ARENA - 2), z = (rnd() * 2 - 1) * (ARENA - 2);
        if (Math.hypot(x, z) < 6) continue; // keep the middle clear for you
        if (list.some(p => Math.hypot(p.x - x, p.z - z) < 3.2)) continue;
        const kind = kinds[list.length % kinds.length];
        list.push({ x, z, kind, r: kind === "stone" ? 0.5 : 0.42, tilt: (rnd() - 0.5) * 0.25, lines: list.length % 3 === 0 });
      }
      return list;
    })();
    // fence posts all the way round, corner to corner
    const POSTS = [];
    [[-1, -1, 1, 0], [1, -1, 0, 1], [1, 1, -1, 0], [-1, 1, 0, -1]].forEach(([sx, sz, dx, dz]) => {
      for (let i = 0; i < ARENA; i++) POSTS.push([sx * ARENA + dx * i * 2, sz * ARENA + dz * i * 2]);
    });
    const STARS = (() => {
      const rnd = seeded(3), list = [];
      for (let i = 0; i < 70; i++) list.push({ ang: rnd() * Math.PI * 2, y: 8 + rnd() * (HORIZON - 50), r: rnd() < 0.2 ? 1.8 : 1.1, tw: rnd() * 6 });
      return list;
    })();
    const MOON_ANG = 0.5;
    // little things in the grass: tufts, flowers, glowing mushrooms and old bones
    const DECOR = (() => {
      const rnd = seeded(11), list = [], kinds = ["grass", "grass", "grass", "flower", "mushroom", "grass", "bone"];
      while (list.length < 120) {
        const x = (rnd() * 2 - 1) * (ARENA - 1), z = (rnd() * 2 - 1) * (ARENA - 1);
        if (PROPS.some(p => Math.hypot(p.x - x, p.z - z) < 1.2)) continue;
        list.push({ x, z, kind: kinds[list.length % kinds.length], color: ["#ff8ad8", "#ffe14d", "#9ad7ff"][list.length % 3], turn: rnd() * 6.28 });
      }
      return list;
    })();
    // dirt and grass patches that make the ground look less flat
    const PATCHES = (() => {
      const rnd = seeded(13), list = [], cols = ["rgba(20,45,25,0.55)", "rgba(70,55,35,0.45)", "rgba(90,140,80,0.22)", "rgba(30,60,30,0.5)"];
      for (let i = 0; i < 90; i++) list.push({ x: (rnd() * 2 - 1) * ARENA, z: (rnd() * 2 - 1) * ARENA, r: 0.6 + rnd() * 1.6, col: cols[i % cols.length] });
      return list;
    })();
    // sky stuff spread all the way round: clouds and the bumpy treeline
    const CLOUDS = (() => {
      const rnd = seeded(17), list = [];
      for (let i = 0; i < 8; i++) list.push({ ang: i * 0.785 + rnd() * 0.5, y: 30 + rnd() * 90, w: 60 + rnd() * 70 });
      return list;
    })();
    const TREELINE = (() => {
      const rnd = seeded(19), list = [];
      for (let a = 0; a < Math.PI * 2; a += 0.09 + rnd() * 0.12) list.push({ ang: a, h: 10 + rnd() * 16, dead: rnd() < 0.4 });
      return list;
    })();
    const HOUSE_ANG = MOON_ANG + 2.6;
    const FIREFLIES = (() => {
      const rnd = seeded(5), list = [];
      for (let i = 0; i < 22; i++) list.push({ x: (rnd() * 2 - 1) * (ARENA - 3), z: (rnd() * 2 - 1) * (ARENA - 3), ph: rnd() * 6.28 });
      return list;
    })();

    let zbRunning = false, zbLast = 0, zbFrame = 0, zbClock = 0;
    let hero = null, zombies = [], shots = [], puffs = [], pickups = [];
    let zbScore = 0, zbWave = 0, zbToSpawn = 0, zbSpawnT = 0, zbPhase = "break", zbBreak = 0;
    let zbFlash = { text: "", t: 0 };
    const zbKeys = { left: false, right: false, up: false, down: false, strafeL: false, strafeR: false, fire: false };
    const cam = { x: 0, y: EYE_H, z: 0, s: 0, c: 1 };
    let zbMouse = null; // where the mouse is on the game screen, or null when it's away

    function resetZb(){
      hero = { x: 0, z: 0, a: 0, r: 0.4, hearts: 3, inv: 0, cd: 0, walk: 0, moving: false, flash: 0 };
      zombies = []; shots = []; puffs = []; pickups = [];
      zbScore = 0; zbWave = 0; zbToSpawn = 0; zbClock = 0;
      zbPhase = "break"; zbBreak = 1.5;
      zbFlash = { text: "", t: 0 };
    }
    function startWave(){
      zbWave++;
      zbToSpawn = 3 + 3 * zbWave;
      zbSpawnT = 0;
      zbPhase = "wave";
      zbFlash = { text: `🌊 Wave ${zbWave}!`, t: 2 };
      Fun.sfx.beep();
    }

    function spawnZombie(){
      // climb out of the ground near the fence, not too close to you
      let x = 0, z = 0;
      const e = ARENA - 1.5;
      for (let tries = 0; tries < 20; tries++) {
        const side = Math.floor(Math.random() * 4), u = (Math.random() * 2 - 1) * e;
        [x, z] = [[u, -e], [e, u], [u, e], [-e, u]][side];
        if (Math.hypot(x - hero.x, z - hero.z) > 14) break;
      }
      const roll = Math.random();
      const type = zbWave >= 3 && roll < 0.15 ? "brute" : zbWave >= 2 && roll < 0.4 ? "runner" : "walker";
      const T = ZOMBIE_TYPES[type];
      zombies.push({ x, z, type, hp: T.hp, max: T.hp, size: T.size, r: 0.38 * T.size,
        speed: T.speed * (1 + 0.07 * Math.min(zbWave - 1, 10)), phase: Math.random() * 6.28, hit: 0, rise: 1 });
    }

    function pushOut(b, x, z, r){
      const dx = b.x - x, dz = b.z - z, d = Math.hypot(dx, dz), min = b.r + r;
      if (d >= min || d === 0) return;
      b.x = x + dx / d * min; b.z = z + dz / d * min;
    }
    function keepInside(b){
      const lim = ARENA - 0.6;
      b.x = Math.max(-lim, Math.min(lim, b.x)); b.z = Math.max(-lim, Math.min(lim, b.z));
    }
    function addPuff(x, y, z, kind, text){ puffs.push({ x, y, z, kind, text, t: 0 }); }
    // comic words over a spot in the world
    const fx = Fun.pops();
    let fxDt = 1 / 60, chatT = 3;
    function popAt(x, y, z, text, colour, size){
      const c = camSpace(x, y, z);
      if (c[2] < NEAR) return;
      const [sx, sy] = toScreen(c);
      fx.pop(text, sx, sy, colour, size || 28);
    }

    function updateHero(dt){
      const h = hero;
      h.a += ((zbKeys.right ? 1 : 0) - (zbKeys.left ? 1 : 0)) * ZB_TURN * dt;
      const fwd = (zbKeys.up ? 1 : 0) - (zbKeys.down ? 1 : 0), side = (zbKeys.strafeR ? 1 : 0) - (zbKeys.strafeL ? 1 : 0);
      const s = Math.sin(h.a), c = Math.cos(h.a);
      let mx = s * fwd + c * side, mz = c * fwd - s * side;
      const len = Math.hypot(mx, mz);
      h.moving = len > 0;
      if (h.moving) {
        const speed = ZB_MOVE * (fwd < 0 && !side ? 0.7 : 1); // backing up is a bit slower
        h.x += mx / len * speed * dt; h.z += mz / len * speed * dt;
        h.walk += dt * 10;
      }
      PROPS.forEach(p => pushOut(h, p.x, p.z, p.r));
      keepInside(h);
      h.inv = Math.max(0, h.inv - dt); h.cd = Math.max(0, h.cd - dt); h.flash = Math.max(0, h.flash - dt);
      if (zbKeys.fire && h.cd <= 0) {
        // goo ball out of the blaster in your right hand
        h.cd = SHOT_EVERY; h.flash = 0.07;
        const gx = h.x + s * 0.7 + c * 0.3, gz = h.z + c * 0.7 - s * 0.3;
        let dir = h.a, bestOff = 0.2;
        if (zbMouse) {
          // shoot right where the mouse is pointing
          const [tx, tz] = mouseTarget();
          dir = Math.atan2(tx - gx, tz - gz);
        } else {
          // a little aim help: lock onto a zombie that's nearly straight ahead
          zombies.forEach(z => {
            if (z.rise > 0.5 || Math.hypot(z.x - gx, z.z - gz) > 20) return;
            const toZ = Math.atan2(z.x - gx, z.z - gz), off = Math.abs(angleDiff(toZ, h.a));
            if (off < bestOff) { bestOff = off; dir = toZ; }
          });
        }
        Fun.sfx.pop();
        shots.push({ x: gx, z: gz, vx: Math.sin(dir) * SHOT_SPEED, vz: Math.cos(dir) * SHOT_SPEED, life: 1.1, r: 0.14 });
      }
      pickups = pickups.filter(p => {
        p.t += dt;
        if (Math.hypot(p.x - h.x, p.z - h.z) < 0.9) {
          h.hearts = Math.min(MAX_HEARTS, h.hearts + 1);
          addPuff(p.x, 0.8, p.z, "spark", "+❤️"); Fun.sfx.coin();
          return false;
        }
        return p.t < 12;
      });
    }

    function updateZombies(dt){
      zombies.forEach(zb => {
        zb.hit = Math.max(0, zb.hit - dt); zb.dizzy = Math.max(0, (zb.dizzy || 0) - dt);
        if (zb.rise > 0) { zb.rise = Math.max(0, zb.rise - dt); return; }
        const dx = hero.x - zb.x, dz = hero.z - zb.z, d = Math.hypot(dx, dz) || 1;
        const ux = dx / d, uz = dz / d;
        const wob = Math.sin(zbClock * 2 + zb.phase) * 0.35; // shamble from side to side
        zb.x += (ux - uz * wob) * zb.speed * dt;
        zb.z += (uz + ux * wob) * zb.speed * dt;
        PROPS.forEach(p => pushOut(zb, p.x, p.z, p.r));
        keepInside(zb);
      });
      // zombies don't squeeze into each other
      for (let i = 0; i < zombies.length; i++) for (let j = i + 1; j < zombies.length; j++) {
        const a = zombies[i], b = zombies[j];
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = a.r + b.r;
        if (d >= min || d === 0) continue;
        const push = (min - d) / 2;
        a.x -= dx / d * push; a.z -= dz / d * push; b.x += dx / d * push; b.z += dz / d * push;
      }
      const grabbed = zombies.some(z => z.rise <= 0 && Math.hypot(z.x - hero.x, z.z - hero.z) < z.r + hero.r + 0.1);
      if (grabbed && hero.inv <= 0) {
        hero.hearts--; hero.inv = 1.6;
        popAt(hero.x, 2.2, hero.z, ["OUCH!", "Get off!", "EWW, slimy!", "Gross!"][hero.hearts % 4], "#ff6b6b", 32);
        Fun.shake(zbCanvas); Fun.sfx.bonk();
        // shove everyone nearby back so you can get away
        zombies.forEach(z => {
          const dx = z.x - hero.x, dz = z.z - hero.z, d = Math.hypot(dx, dz) || 1;
          if (d < 3) { z.x += dx / d * (3 - d); z.z += dz / d * (3 - d); keepInside(z); }
        });
        if (hero.hearts <= 0) endZb();
      }
    }

    function zapZombie(zb){
      zombies.splice(zombies.indexOf(zb), 1);
      const pts = ZOMBIE_TYPES[zb.type].points;
      zbScore += pts;
      addPuff(zb.x, 0.9 * zb.size, zb.z, "poof", "+" + pts);
      popAt(zb.x, 2.3 * zb.size, zb.z, ["SPLAT!", "GOOPED!", "POP!", "SPLOOSH!", "BYE!"][Math.floor(Math.random() * 5)], "#9dff7a", 30);
      Fun.sfx.splat();
      if (hero.hearts < MAX_HEARTS && Math.random() < 0.08) pickups.push({ x: zb.x, z: zb.z, t: 0 });
    }
    function updateShots(dt){
      shots = shots.filter(s => {
        s.x += s.vx * dt; s.z += s.vz * dt; s.life -= dt;
        if (s.life <= 0 || Math.abs(s.x) > ARENA || Math.abs(s.z) > ARENA) return false;
        if (PROPS.some(p => Math.hypot(p.x - s.x, p.z - s.z) < p.r + s.r)) { addPuff(s.x, 1, s.z, "spark"); return false; }
        const zb = zombies.find(z => z.rise < 0.5 && Math.hypot(z.x - s.x, z.z - s.z) < z.r + s.r + 0.1);
        if (!zb) return true;
        zb.hp--; zb.hit = 0.12; zb.dizzy = 0.8;
        zb.x += s.vx / SHOT_SPEED * 0.35; zb.z += s.vz / SHOT_SPEED * 0.35; // knocked back a little
        if (zb.hp <= 0) zapZombie(zb); else addPuff(s.x, 1, s.z, "spark");
        return false;
      });
      puffs = puffs.filter(p => (p.t += dt) < 0.9);
    }

    function zbStep(dt){
      zbClock += dt;
      if (zbFlash.t > 0) zbFlash.t -= dt;
      updateHero(dt);
      if (zbPhase === "break") {
        zbBreak -= dt;
        if (zbBreak <= 0) startWave();
      } else if (zbToSpawn > 0) {
        zbSpawnT -= dt;
        if (zbSpawnT <= 0) { spawnZombie(); zbToSpawn--; zbSpawnT = Math.max(0.35, 1.1 - zbWave * 0.06); }
      } else if (!zombies.length) {
        const bonus = 50 * zbWave;
        zbScore += bonus;
        hero.hearts = Math.min(MAX_HEARTS, hero.hearts + 1);
        zbFlash = { text: `✅ Wave ${zbWave} cleared! +${bonus} and a ❤️`, t: 2.8 };
        Fun.sfx.tada();
        zbPhase = "break"; zbBreak = 3;
      }
      updateZombies(dt);
      // zombies mumble silly things
      chatT -= dt;
      if (chatT <= 0 && zombies.length) {
        chatT = 3 + Math.random() * 4;
        const z = zombies[Math.floor(Math.random() * zombies.length)];
        if (z.rise <= 0) popAt(z.x, 2.4 * z.size, z.z, ["Braaains!", "Hungry…", "Hug me!", "Mmm, snacks!", "I need a nap", "Wait up!", "Uuurgh", "Is it lunch?"][Math.floor(Math.random() * 8)], "#ffffff", 20);
      }
      if (!zbRunning) return;
      updateShots(dt);
    }

    /* ----- 3D drawing: a camera that follows behind you ----- */
    function camSpace(x, y, z){
      const dx = x - cam.x, dz = z - cam.z;
      const rx = dx * cam.c - dz * cam.s, fd = dx * cam.s + dz * cam.c, h = y - cam.y;
      return [rx, h * COS_P + fd * SIN_P, fd * COS_P - h * SIN_P];
    }
    function toScreen(p){ return [ZW / 2 + p[0] * FOCAL / p[2], ZH / 2 - p[1] * FOCAL / p[2]]; }
    // a line in the world, cut off where it goes behind the camera
    function zbLine(ctx, x0, y0, z0, x1, y1, z1){
      let a = camSpace(x0, y0, z0), b = camSpace(x1, y1, z1);
      if (a[2] < NEAR && b[2] < NEAR) return;
      if (a[2] < NEAR || b[2] < NEAR) {
        const t = (NEAR - a[2]) / (b[2] - a[2]);
        const m = a.map((v, i) => v + (b[i] - v) * t);
        if (a[2] < NEAR) a = m; else b = m;
      }
      const p = toScreen(a), q = toScreen(b);
      ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]);
    }
    // the spot under the mouse: a zombie if you're pointing at one, otherwise the ground
    function mouseTarget(){
      const [mx, my] = zbMouse;
      let best = null;
      zombies.forEach(z => {
        if (z.rise > 0.5) return;
        const p = camSpace(z.x, 0, z.z);
        if (p[2] < NEAR) return;
        const [sx, sy] = toScreen(p), s = FOCAL / p[2] * z.size;
        const over = Math.abs(mx - sx) < 0.5 * s && my < sy + 0.1 * s && my > sy - 2.2 * s;
        if (over && (!best || p[2] < best.d)) best = { z, d: p[2] };
      });
      if (best) return [best.z.x, best.z.z];
      // follow the line from the camera through the mouse until it reaches goo height
      const cx = (mx - ZW / 2) / FOCAL, cy = (ZH / 2 - my) / FOCAL;
      const up = cy * COS_P - SIN_P, fd = cy * SIN_P + COS_P;
      let t = up < 0 ? (1 - cam.y) / up : Infinity;
      t = Math.max(8 / fd, Math.min(40 / fd, t)); // never behind you, never past the fog
      return [cam.x + (cx * cam.c + fd * cam.s) * t, cam.z + (fd * cam.c - cx * cam.s) * t];
    }
    // how far apart two directions are, from -π to π
    function angleDiff(a, b){ return ((a - b) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI; }
    // where a far-away direction (like the moon) lands on screen
    function skyX(ang){
      const d = angleDiff(ang, hero.a);
      return Math.abs(d) < 1.3 ? ZW / 2 + Math.tan(d) * FOCAL : null;
    }

    function nearHillY(ang){ return HORIZON - 14 - 12 * Math.sin(ang * 3 + 1) - 7 * Math.sin(ang * 7) - 4 * Math.sin(ang * 13 + 2); }
    function drawSky(ctx){
      const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
      sky.addColorStop(0, "#04050f"); sky.addColorStop(0.7, "#161a36"); sky.addColorStop(1, "#2e2b4f");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, ZW, HORIZON + 1);
      STARS.forEach(st => {
        const x = skyX(st.ang);
        if (x === null) return;
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(zbClock * 2 + st.tw);
        ctx.fillStyle = "#fff"; ctx.fillRect(x, st.y, st.r, st.r);
      });
      ctx.globalAlpha = 1;
      const mx = skyX(MOON_ANG);
      if (mx !== null) {
        const glow = ctx.createRadialGradient(mx, 70, 20, mx, 70, 110);
        glow.addColorStop(0, "rgba(255,250,210,0.35)"); glow.addColorStop(1, "rgba(255,250,210,0)");
        ctx.fillStyle = glow; ctx.fillRect(mx - 110, 0, 220, 180);
        ctx.fillStyle = "#fff6cf"; ctx.beginPath(); ctx.arc(mx, 70, 34, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(200,190,150,0.5)";
        [[-10, -8, 7], [12, 6, 5], [-4, 14, 4]].forEach(([cx, cy, r]) => { ctx.beginPath(); ctx.arc(mx + cx, 70 + cy, r, 0, Math.PI * 2); ctx.fill(); });
      }
      // bats flapping around the moon
      ctx.fillStyle = "#07061a";
      for (let i = 0; i < 4; i++) {
        const x = skyX(MOON_ANG + (i - 1.5) * 0.25 + Math.sin(zbClock * 0.3 + i * 2.1) * 0.35);
        if (x === null) continue;
        const y = 55 + i * 22 + Math.sin(zbClock * 1.7 + i) * 12, flap = Math.sin(zbClock * 14 + i * 3) * 6;
        ctx.beginPath();
        ctx.moveTo(x - 13, y - flap); ctx.quadraticCurveTo(x - 6, y - 3, x, y);
        ctx.quadraticCurveTo(x + 6, y - 3, x + 13, y - flap);
        ctx.quadraticCurveTo(x + 7, y + 2, x, y + 4); ctx.quadraticCurveTo(x - 7, y + 2, x - 13, y - flap);
        ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - 2.5, y - 1); ctx.lineTo(x - 2, y - 5); ctx.lineTo(x, y - 2); ctx.lineTo(x + 2, y - 5); ctx.lineTo(x + 2.5, y - 1); ctx.fill();
      }
      // slow drifting clouds
      CLOUDS.forEach((c, i) => {
        const x = skyX(c.ang + zbClock * 0.004);
        if (x === null) return;
        ctx.fillStyle = "rgba(120,100,190,0.16)";
        ctx.beginPath();
        ctx.ellipse(x, c.y, c.w, c.w * 0.18, 0, 0, Math.PI * 2);
        ctx.ellipse(x - c.w * 0.35, c.y - 6, c.w * 0.45, c.w * 0.17, 0, 0, Math.PI * 2);
        ctx.ellipse(x + c.w * 0.3, c.y - 9, c.w * 0.4, c.w * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(200,190,255,0.08)";
        ctx.beginPath(); ctx.ellipse(x + c.w * 0.25, c.y - 13, c.w * 0.3, c.w * 0.08, 0, 0, Math.PI * 2); ctx.fill();
      });
      // a faraway row of hills
      const hillY = (ang, k) => HORIZON - k * (22 + 16 * Math.sin(ang * 2 + 4) + 8 * Math.sin(ang * 5 + 1));
      ctx.fillStyle = "#2a2358";
      ctx.beginPath(); ctx.moveTo(0, HORIZON + 1);
      for (let x = 0; x <= ZW; x += 8) ctx.lineTo(x, hillY(hero.a + Math.atan((x - ZW / 2) / FOCAL), 1));
      ctx.lineTo(ZW, HORIZON + 1); ctx.closePath(); ctx.fill();
      // a haunted house up on the far hill
      const hx = skyX(HOUSE_ANG);
      if (hx !== null) {
        const hy = hillY(HOUSE_ANG, 1) + 4;
        ctx.fillStyle = "#1f1946";
        ctx.fillRect(hx - 22, hy - 26, 44, 26); ctx.fillRect(hx + 8, hy - 44, 10, 22);
        ctx.beginPath(); ctx.moveTo(hx - 27, hy - 26); ctx.lineTo(hx - 6, hy - 44); ctx.lineTo(hx + 15, hy - 26); ctx.fill();
        ctx.beginPath(); ctx.moveTo(hx + 5, hy - 44); ctx.lineTo(hx + 13, hy - 56); ctx.lineTo(hx + 21, hy - 44); ctx.fill();
        ctx.fillStyle = Math.sin(zbClock * 3) > -0.8 ? "#ffd86b" : "#c99a3a";
        ctx.fillRect(hx - 14, hy - 18, 6, 7); ctx.fillRect(hx + 4, hy - 18, 6, 7); ctx.fillRect(hx + 11, hy - 38, 4, 5);
      }
      // far-off hills that slide past as you turn
      ctx.fillStyle = "#1a1640";
      ctx.beginPath(); ctx.moveTo(0, HORIZON + 1);
      for (let x = 0; x <= ZW; x += 8) {
        const ang = hero.a + Math.atan((x - ZW / 2) / FOCAL);
        ctx.lineTo(x, nearHillY(ang));
      }
      ctx.lineTo(ZW, HORIZON + 1); ctx.closePath(); ctx.fill();
      // spooky trees along the near hills
      ctx.strokeStyle = "#1a1640"; ctx.lineCap = "round";
      TREELINE.forEach(t => {
        const x = skyX(t.ang);
        if (x === null) return;
        const y = nearHillY(t.ang) + 2;
        if (t.dead) {
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - t.h);
          ctx.moveTo(x, y - t.h * 0.55); ctx.lineTo(x - t.h * 0.3, y - t.h * 0.85);
          ctx.moveTo(x, y - t.h * 0.7); ctx.lineTo(x + t.h * 0.3, y - t.h * 1.0); ctx.stroke();
        } else {
          ctx.beginPath(); ctx.moveTo(x - t.h * 0.32, y); ctx.lineTo(x, y - t.h * 1.3); ctx.lineTo(x + t.h * 0.32, y); ctx.fill();
        }
      });
    }

    function drawGround(ctx){
      const g = ctx.createLinearGradient(0, HORIZON, 0, ZH);
      g.addColorStop(0, "#1b2030"); g.addColorStop(0.35, "#17261c"); g.addColorStop(1, "#263f22");
      ctx.fillStyle = g; ctx.fillRect(0, HORIZON, ZW, ZH - HORIZON);
      // dirt and grass patches lying flat on the ground
      PATCHES.forEach(pt => {
        const p = camSpace(pt.x, 0, pt.z);
        if (p[2] < 1.5 || p[2] > 46) return;
        const [sx, sy] = toScreen(p), w = pt.r * FOCAL / p[2];
        if (sx + w < 0 || sx - w > ZW) return;
        ctx.globalAlpha = Math.min(1, (48 - p[2]) / 22);
        ctx.fillStyle = pt.col;
        ctx.beginPath(); ctx.ellipse(sx, sy, w, w * Math.min(0.5, 2.8 / p[2]), 0, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      // spooky mist hanging low over the far graves
      const fog = ctx.createLinearGradient(0, HORIZON - 30, 0, HORIZON + 70);
      fog.addColorStop(0, "rgba(150,140,210,0)"); fog.addColorStop(0.45, "rgba(150,140,210,0.22)"); fog.addColorStop(1, "rgba(150,140,210,0)");
      ctx.fillStyle = fog; ctx.fillRect(0, HORIZON - 30, ZW, 100);
      ctx.fillStyle = "rgba(170,160,230,0.08)";
      for (let i = 0; i < 6; i++) {
        const x = ((i * 260 + zbClock * 14 - hero.a * 400) % 1560 + 1560) % 1560 - 300;
        ctx.beginPath(); ctx.ellipse(x, HORIZON + 18 + (i % 3) * 14, 160, 16, 0, 0, Math.PI * 2); ctx.fill();
      }
    }

    function drawShadowAt(ctx, w){
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath(); ctx.ellipse(0, 0, w, w * 0.25, 0, 0, Math.PI * 2); ctx.fill();
    }
    function drawProp(ctx, p){
      if (p.kind === "stone") {
        drawShadowAt(ctx, 0.5);
        ctx.rotate(p.tilt);
        ctx.fillStyle = "#5d6275"; roundRect(ctx, -0.36, -1.0, 0.8, 1.0, 0.36); ctx.fill();
        ctx.fillStyle = "#8a90a6"; roundRect(ctx, -0.4, -1.0, 0.76, 1.0, 0.36); ctx.fill();
        ctx.strokeStyle = "#5d6275"; ctx.lineWidth = 0.07; ctx.lineCap = "round";
        if (p.lines) {
          // worn-out writing nobody can read anymore
          [[-0.68, 0.22], [-0.52, 0.28], [-0.36, 0.18]].forEach(([y, w]) => { ctx.beginPath(); ctx.moveTo(-0.02 - w, y); ctx.lineTo(-0.02 + w, y); ctx.stroke(); });
        } else {
          ctx.beginPath(); ctx.moveTo(-0.02, -0.8); ctx.lineTo(-0.02, -0.4); ctx.moveTo(-0.17, -0.65); ctx.lineTo(0.13, -0.65); ctx.stroke();
        }
        // a crack and some moss
        ctx.strokeStyle = "#4a4f60"; ctx.lineWidth = 0.03;
        ctx.beginPath(); ctx.moveTo(0.3, -0.85); ctx.lineTo(0.2, -0.72); ctx.lineTo(0.26, -0.6); ctx.lineTo(0.17, -0.48); ctx.stroke();
        ctx.fillStyle = "#4f8a46";
        ctx.beginPath(); ctx.ellipse(-0.28, -0.12, 0.13, 0.1, 0, 0, Math.PI * 2); ctx.ellipse(-0.33, -0.26, 0.06, 0.06, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#3f7a3a";
        [-0.3, 0, 0.25].forEach(x => { ctx.beginPath(); ctx.moveTo(x - 0.08, 0); ctx.lineTo(x, -0.18); ctx.lineTo(x + 0.08, 0); ctx.fill(); });
      } else if (p.kind === "tree") {
        drawShadowAt(ctx, 0.7);
        ctx.fillStyle = "#3b2a20";
        ctx.beginPath(); ctx.moveTo(-0.22, 0); ctx.lineTo(-0.08, -2.4); ctx.lineTo(0.08, -2.4); ctx.lineTo(0.22, 0); ctx.fill();
        ctx.strokeStyle = "#3b2a20"; ctx.lineCap = "round";
        [[0, -1.5, -0.7, -2.1, 0.1], [0, -1.8, 0.6, -2.4, 0.09], [0, -2.3, -0.4, -2.9, 0.07], [0, -2.3, 0.35, -2.8, 0.07], [-0.45, -1.85, -0.75, -1.75, 0.05], [0.4, -2.15, 0.7, -2.1, 0.05]]
          .forEach(([x0, y0, x1, y1, w]) => { ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); });
        // a sleepy owl keeping watch
        ctx.save(); ctx.translate(-0.5, -1.95);
        ctx.fillStyle = "#7a5a3c"; ctx.beginPath(); ctx.ellipse(0, -0.15, 0.13, 0.17, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-0.12, -0.24); ctx.lineTo(-0.1, -0.36); ctx.lineTo(-0.04, -0.28); ctx.moveTo(0.12, -0.24); ctx.lineTo(0.1, -0.36); ctx.lineTo(0.04, -0.28); ctx.fill();
        ctx.fillStyle = "#c9a57a"; ctx.beginPath(); ctx.ellipse(0, -0.09, 0.08, 0.09, 0, 0, Math.PI * 2); ctx.fill();
        if (Math.sin(zbClock * 0.8 + p.x) > 0.95) {
          ctx.fillStyle = "#3b2a20"; ctx.fillRect(-0.1, -0.22, 0.08, 0.025); ctx.fillRect(0.02, -0.22, 0.08, 0.025); // blink
        } else {
          ctx.fillStyle = "#ffd23a"; ctx.beginPath(); ctx.arc(-0.055, -0.21, 0.045, 0, Math.PI * 2); ctx.arc(0.055, -0.21, 0.045, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#1b1f2a"; ctx.beginPath(); ctx.arc(-0.055, -0.21, 0.02, 0, Math.PI * 2); ctx.arc(0.055, -0.21, 0.02, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = "#e8a020"; ctx.beginPath(); ctx.moveTo(-0.02, -0.17); ctx.lineTo(0.02, -0.17); ctx.lineTo(0, -0.13); ctx.fill();
        ctx.restore();
      } else {
        drawShadowAt(ctx, 0.45);
        ctx.fillStyle = "#e8741c"; ctx.beginPath(); ctx.ellipse(0, -0.32, 0.45, 0.33, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#b9560f"; ctx.lineWidth = 0.04;
        ctx.beginPath(); ctx.ellipse(0, -0.32, 0.18, 0.33, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "#3f7a3a"; ctx.fillRect(-0.04, -0.75, 0.08, 0.14);
        ctx.fillStyle = Math.sin(zbClock * 9 + p.x) > -0.6 ? "#ffe14d" : "#ffb23a"; // flickering candle
        ctx.beginPath(); ctx.moveTo(-0.26, -0.42); ctx.lineTo(-0.16, -0.56); ctx.lineTo(-0.06, -0.42); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0.06, -0.42); ctx.lineTo(0.16, -0.56); ctx.lineTo(0.26, -0.42); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-0.25, -0.28); ctx.lineTo(-0.12, -0.2); ctx.lineTo(0, -0.28); ctx.lineTo(0.12, -0.2); ctx.lineTo(0.25, -0.28); ctx.lineTo(0, -0.12); ctx.fill();
      }
    }
    function drawDecor(ctx, d){
      ctx.lineCap = "round";
      if (d.kind === "grass") {
        ctx.strokeStyle = "#3f7a3a"; ctx.lineWidth = 0.035;
        ctx.beginPath(); ctx.moveTo(-0.06, 0); ctx.lineTo(-0.12, -0.22); ctx.moveTo(0, 0); ctx.lineTo(0.01, -0.3); ctx.moveTo(0.06, 0); ctx.lineTo(0.13, -0.2); ctx.stroke();
      } else if (d.kind === "flower") {
        ctx.strokeStyle = "#3f7a3a"; ctx.lineWidth = 0.03;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -0.28); ctx.stroke();
        ctx.fillStyle = d.color;
        for (let i = 0; i < 5; i++) { const a = i * 1.257; ctx.beginPath(); ctx.arc(Math.cos(a) * 0.06, -0.3 + Math.sin(a) * 0.06, 0.045, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = "#fff6cf"; ctx.beginPath(); ctx.arc(0, -0.3, 0.035, 0, Math.PI * 2); ctx.fill();
      } else if (d.kind === "mushroom") {
        const glow = ctx.createRadialGradient(0, -0.15, 0, 0, -0.15, 0.4);
        glow.addColorStop(0, `rgba(190,110,255,${0.3 + 0.12 * Math.sin(zbClock * 2 + d.turn)})`); glow.addColorStop(1, "rgba(190,110,255,0)");
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, -0.15, 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#e9e3f5"; ctx.fillRect(-0.03, -0.16, 0.06, 0.16);
        ctx.fillStyle = "#b45cff"; ctx.beginPath(); ctx.ellipse(0, -0.16, 0.12, 0.08, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = "#f2dcff"; ctx.beginPath(); ctx.arc(-0.05, -0.19, 0.018, 0, Math.PI * 2); ctx.arc(0.04, -0.21, 0.018, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.rotate(Math.sin(d.turn) * 0.4);
        ctx.strokeStyle = "#e8e2cf"; ctx.lineWidth = 0.05;
        ctx.beginPath(); ctx.moveTo(-0.14, -0.04); ctx.lineTo(0.14, -0.04); ctx.stroke();
        ctx.fillStyle = "#e8e2cf";
        [[-0.16, -0.07], [-0.16, -0.01], [0.16, -0.07], [0.16, -0.01]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 0.035, 0, Math.PI * 2); ctx.fill(); });
      }
    }
    function drawFirefly(ctx, f){
      ctx.globalAlpha *= 0.25 + 0.75 * Math.max(0, Math.sin(zbClock * 2.5 + f.ph * 3));
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.16);
      g.addColorStop(0, "#fbffb0"); g.addColorStop(0.3, "rgba(230,255,120,0.8)"); g.addColorStop(1, "rgba(230,255,120,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 0.16, 0, Math.PI * 2); ctx.fill();
    }
    function drawPost(ctx){
      ctx.fillStyle = "#6b5844";
      ctx.beginPath(); ctx.moveTo(-0.07, 0); ctx.lineTo(-0.07, -1.0); ctx.lineTo(0, -1.12); ctx.lineTo(0.07, -1.0); ctx.lineTo(0.07, 0); ctx.fill();
    }
    function drawZombie(ctx, zb){
      const T = ZOMBIE_TYPES[zb.type];
      const skin = zb.hit > 0 ? "#ffffff" : "#8a9f78";
      ctx.scale(zb.size, zb.size);
      if (zb.rise > 0) {
        // climbing out of the ground
        ctx.fillStyle = "#4a3726"; ctx.beginPath(); ctx.ellipse(0, 0, 0.55, 0.14, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.rect(-1.5, -3, 3, 3); ctx.clip();
        ctx.translate(0, zb.rise * 1.9);
      } else drawShadowAt(ctx, 0.38);
      const step = Math.sin(zbClock * (zb.type === "runner" ? 14 : 7) + zb.phase);
      ctx.fillStyle = "#3b3550";
      ctx.fillRect(-0.21, -0.75 + Math.max(0, step) * 0.08, 0.16, 0.75 - Math.max(0, step) * 0.08);
      ctx.fillRect(0.05, -0.75 + Math.max(0, -step) * 0.08, 0.16, 0.75 - Math.max(0, -step) * 0.08);
      ctx.fillStyle = "#2a2433"; ctx.fillRect(-0.24, -0.08, 0.21, 0.08); ctx.fillRect(0.03, -0.08, 0.21, 0.08);
      // raggedy shirt
      ctx.fillStyle = zb.hit > 0 ? "#ffffff" : T.shirt;
      roundRect(ctx, -0.3, -1.32, 0.6, 0.6, 0.12); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-0.3, -0.78); for (let i = 0; i <= 6; i++) ctx.lineTo(-0.3 + i * 0.1, i % 2 ? -0.66 : -0.76); ctx.lineTo(0.3, -0.78); ctx.fill();
      // a patch sewn on with big stitches
      ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.fillRect(0.06, -1.1, 0.14, 0.12);
      ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 0.02;
      ctx.beginPath(); [0.08, 0.13, 0.18].forEach(x => { ctx.moveTo(x, -1.12); ctx.lineTo(x + 0.02, -1.08); }); ctx.stroke();
      if (zb.type === "walker") {
        // a droopy old tie
        ctx.fillStyle = zb.hit > 0 ? "#ffffff" : "#b8322a";
        ctx.beginPath(); ctx.moveTo(-0.05, -1.3); ctx.lineTo(0.05, -1.3); ctx.lineTo(0.03, -1.24); ctx.lineTo(0.07, -0.95); ctx.lineTo(0, -0.88); ctx.lineTo(-0.05, -0.97); ctx.lineTo(-0.03, -1.24); ctx.fill();
      }
      // arms reaching out for you
      const sway = Math.sin(zbClock * 3 + zb.phase) * 0.06;
      ctx.strokeStyle = skin; ctx.lineWidth = 0.13; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-0.27, -1.2); ctx.lineTo(-0.52, -1.27 + sway); ctx.moveTo(0.27, -1.2); ctx.lineTo(0.52, -1.27 - sway); ctx.stroke();
      // grabby hands with wiggly fingers
      ctx.fillStyle = skin; ctx.lineWidth = 0.035;
      [[-0.55, -1.27 + sway, -1], [0.55, -1.27 - sway, 1]].forEach(([x, y, d]) => {
        ctx.beginPath(); ctx.arc(x, y, 0.075, 0, Math.PI * 2); ctx.fill();
        const wig = Math.sin(zbClock * 8 + zb.phase + x) * 0.02;
        ctx.beginPath(); [-0.05, 0, 0.05].forEach(fy => { ctx.moveTo(x + d * 0.05, y + fy); ctx.lineTo(x + d * 0.13, y + fy * 1.4 + wig); }); ctx.stroke();
      });
      if (zb.type === "brute") {
        // Frankenstein bolts in the neck
        ctx.fillStyle = "#9aa0b4"; ctx.fillRect(-0.33, -1.38, 0.1, 0.06); ctx.fillRect(0.23, -1.38, 0.1, 0.06);
      }
      // big goofy head
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, -1.57, 0.27, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#3f7a3a"; ctx.beginPath(); ctx.moveTo(-0.2, -1.76); ctx.lineTo(-0.08, -1.92); ctx.lineTo(0, -1.8); ctx.lineTo(0.1, -1.94); ctx.lineTo(0.18, -1.76); ctx.fill();
      // a stitched-up scar on the cheek
      ctx.strokeStyle = "#4d7a3f"; ctx.lineWidth = 0.022;
      ctx.beginPath(); ctx.moveTo(0.08, -1.5); ctx.lineTo(0.22, -1.56);
      [0.11, 0.15, 0.19].forEach(x => { const y = -1.5 - (x - 0.08) * 0.43; ctx.moveTo(x - 0.01, y - 0.03); ctx.lineTo(x + 0.01, y + 0.03); });
      ctx.stroke();
      if (zb.type === "runner") {
        // a sporty sweatband
        ctx.fillStyle = zb.hit > 0 ? "#ffffff" : "#ff3b5c"; ctx.fillRect(-0.26, -1.77, 0.52, 0.07);
      } else if (zb.type === "brute") {
        // a bandage wrapped round the head
        ctx.fillStyle = "#efe8d6"; ctx.fillRect(-0.27, -1.78, 0.54, 0.08);
        ctx.strokeStyle = "#c9bfa6"; ctx.lineWidth = 0.02;
        ctx.beginPath(); ctx.moveTo(-0.1, -1.78); ctx.lineTo(-0.04, -1.7); ctx.moveTo(0.08, -1.78); ctx.lineTo(0.14, -1.7); ctx.stroke();
      }
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(-0.1, -1.6, 0.09, 0, Math.PI * 2); ctx.arc(0.11, -1.62, 0.065, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#1b1f2a";
      ctx.beginPath(); ctx.arc(-0.09, -1.59, 0.04, 0, Math.PI * 2); ctx.arc(0.11, -1.61, 0.03, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#1b1f2a"; ctx.lineWidth = 0.03;
      ctx.beginPath(); ctx.moveTo(-0.12, -1.44); ctx.lineTo(0.12, -1.46); ctx.stroke();
      // wonky eyebrows
      ctx.beginPath(); ctx.moveTo(-0.19, -1.72); ctx.lineTo(-0.03, -1.68); ctx.moveTo(0.05, -1.7); ctx.lineTo(0.17, -1.74); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.fillRect(-0.06, -1.45, 0.05, 0.05); ctx.fillRect(0.03, -1.46, 0.05, 0.05);
      if (zb.dizzy > 0) {   // knocked silly: stars spin round the head
        ctx.fillStyle = "#ffe14d";
        for (let i = 0; i < 3; i++) {
          const a = zbClock * 7 + i * 2.1, x = Math.cos(a) * 0.32, y = -1.95 + Math.sin(a) * 0.08;
          ctx.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 0.03 : 0.07, b = k * Math.PI / 5; ctx.lineTo(x + Math.cos(b) * r, y + Math.sin(b) * r); } ctx.fill();
        }
      }
      if (zb.hp < zb.max) {
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(-0.3, -2.12, 0.6, 0.08);
        ctx.fillStyle = "#6dff6d"; ctx.fillRect(-0.3, -2.12, 0.6 * zb.hp / zb.max, 0.08);
      }
    }
    // your own hands and goo blaster at the bottom of the screen: they sway as you walk and kick back when you blast
    function drawBlaster(ctx){
      const h = hero, sw = h.moving ? Math.sin(h.walk * 0.5) : 0, bob = h.moving ? Math.abs(Math.cos(h.walk * 0.5)) : 0;
      const kick = h.flash > 0 ? h.flash / 0.07 : 0;
      ctx.save();
      ctx.translate(ZW * 0.66 + sw * 10, ZH + 8 + bob * 9 + kick * 16);
      ctx.rotate(-0.08 + kick * 0.05);
      // the sleeve of your hoodie coming in from the corner
      let g = ctx.createLinearGradient(120, -40, 260, 60);
      g.addColorStop(0, "#9e2a24"); g.addColorStop(1, "#4a1210");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(150, -70); ctx.quadraticCurveTo(220, -60, 330, 20); ctx.lineTo(330, 80); ctx.lineTo(120, 80); ctx.quadraticCurveTo(110, -20, 150, -70); ctx.fill();
      // the blaster's body: dark metal, lit by the moon from the top
      g = ctx.createLinearGradient(0, -170, 0, -60);
      g.addColorStop(0, "#5b6170"); g.addColorStop(0.35, "#2c303a"); g.addColorStop(1, "#121419");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-34, -150); ctx.lineTo(40, -176); ctx.lineTo(150, -120); ctx.lineTo(170, -60); ctx.lineTo(40, -40); ctx.lineTo(-30, -96); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-30, -148); ctx.lineTo(40, -172); ctx.lineTo(146, -118); ctx.stroke();
      // the barrel, pointing in towards the middle of the screen
      g = ctx.createLinearGradient(0, -175, 0, -140);
      g.addColorStop(0, "#6c7282"); g.addColorStop(1, "#1a1d24");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-90, -168); ctx.lineTo(-20, -186); ctx.lineTo(-8, -150); ctx.lineTo(-80, -140); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#07080b"; ctx.beginPath(); ctx.ellipse(-86, -154, 7, 14, 0.25, 0, Math.PI * 2); ctx.fill();
      // the glass tank of glowing goo, sloshing as you move
      g = ctx.createLinearGradient(30, -160, 110, -100);
      g.addColorStop(0, "rgba(170,255,120,0.95)"); g.addColorStop(1, "rgba(40,140,40,0.95)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(70, -128 + sw * 2, 34, 20, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.beginPath(); ctx.ellipse(58, -138, 12, 5, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#1a1d24"; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(70, -128, 35, 21, -0.3, 0, Math.PI * 2); ctx.stroke();
      // your hand round the grip
      g = ctx.createRadialGradient(120, -70, 5, 120, -60, 70);
      g.addColorStop(0, "#e7b48e"); g.addColorStop(1, "#8a5638");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(80, -86); ctx.quadraticCurveTo(120, -110, 170, -84); ctx.quadraticCurveTo(190, -40, 160, -6); ctx.lineTo(100, -6); ctx.quadraticCurveTo(70, -40, 80, -86); ctx.fill();
      ctx.strokeStyle = "rgba(90,50,30,0.55)"; ctx.lineWidth = 2;
      [-62, -46, -30].forEach(y => { ctx.beginPath(); ctx.moveTo(86, y); ctx.quadraticCurveTo(110, y - 6, 132, y + 2); ctx.stroke(); });
      // muzzle flash
      if (h.flash > 0) {
        g = ctx.createRadialGradient(-92, -156, 0, -92, -156, 90);
        g.addColorStop(0, "rgba(240,255,210,1)"); g.addColorStop(0.3, "rgba(150,255,100,0.8)"); g.addColorStop(1, "rgba(120,255,80,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(-92, -156, 90, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    // night: only what your torch lights up is clear, the rest sinks into the dark
    function drawTorchlight(ctx){
      const h = hero, sw = h.moving ? Math.sin(h.walk * 0.5) * 14 : 0;
      const x = ZW / 2 + sw, y = ZH / 2 + 30;
      const g = ctx.createRadialGradient(x, y, 60, x, y, ZW * 0.62);
      g.addColorStop(0, "rgba(2,4,12,0)"); g.addColorStop(0.4, "rgba(2,4,12,0.5)"); g.addColorStop(1, "rgba(2,4,12,0.9)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, ZW, ZH);
      // a warm glow where the torch beam lands
      ctx.globalCompositeOperation = "lighter";
      const w = ctx.createRadialGradient(x, y + 40, 10, x, y + 40, 260);
      w.addColorStop(0, "rgba(255,230,170,0.10)"); w.addColorStop(1, "rgba(255,230,170,0)");
      ctx.fillStyle = w; ctx.fillRect(0, 0, ZW, ZH);
      ctx.globalCompositeOperation = "source-over";
    }
    function drawGoo(ctx){
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.22);
      g.addColorStop(0, "#f4ffd8"); g.addColorStop(0.45, "#8dff5a"); g.addColorStop(1, "rgba(120,255,80,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 0.22, 0, Math.PI * 2); ctx.fill();
    }
    function drawHeartPickup(ctx, p){
      drawShadowAt(ctx, 0.25);
      ctx.translate(0, -0.6 - 0.12 * Math.sin(zbClock * 4));
      ctx.fillStyle = "#ff3b5c";
      ctx.beginPath(); ctx.arc(-0.1, -0.08, 0.12, 0, Math.PI * 2); ctx.arc(0.1, -0.08, 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-0.22, -0.04); ctx.lineTo(0, 0.2); ctx.lineTo(0.22, -0.04); ctx.fill();
    }
    function drawPuff(ctx, p){
      const k = p.t / 0.9;
      ctx.globalAlpha *= 1 - k;
      if (p.kind === "poof") {
        ctx.fillStyle = "#9dff7a";
        [[0, 0], [-0.3, 0.15], [0.3, 0.12], [-0.15, -0.25], [0.18, -0.22]].forEach(([x, y]) => {
          ctx.beginPath(); ctx.arc(x * (1 + k * 2), y * (1 + k * 2), 0.28 * (1 + k), 0, Math.PI * 2); ctx.fill();
        });
        ctx.fillStyle = "#ffe14d";
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3 + k, r = 0.4 + k * 1.1;
          ctx.fillRect(Math.cos(a) * r - 0.05, Math.sin(a) * r - 0.05, 0.1, 0.1);
        }
      } else {
        ctx.fillStyle = "#d8ff8a";
        for (let i = 0; i < 5; i++) {
          const a = i * Math.PI * 0.4, r = 0.1 + k * 0.5;
          ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 0.07 * (1 - k), 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    function drawRadar(ctx){
      const cx = ZW - 72, cy = 72, R = 56, k = R / 22, s = cam.s, c = cam.c;
      ctx.fillStyle = "rgba(5,10,30,0.55)"; ctx.strokeStyle = "rgba(160,255,160,0.5)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      const dot = (x, z, col, size) => {
        const dx = x - hero.x, dz = z - hero.z;
        let px = (dx * c - dz * s) * k, py = -(dx * s + dz * c) * k;
        const d = Math.hypot(px, py);
        if (d > R - 4) { px *= (R - 4) / d; py *= (R - 4) / d; size *= 0.75; }
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx + px, cy + py, size, 0, Math.PI * 2); ctx.fill();
      };
      pickups.forEach(p => dot(p.x, p.z, "#ff7a9a", 3));
      zombies.forEach(z => dot(z.x, z.z, z.rise > 0 ? "rgba(255,90,90,0.5)" : "#ff4a4a", z.type === "brute" ? 4.5 : 3.2));
      ctx.fillStyle = "#ffe14d";
      ctx.beginPath(); ctx.moveTo(cx, cy - 7); ctx.lineTo(cx + 5, cy + 5); ctx.lineTo(cx - 5, cy + 5); ctx.closePath(); ctx.fill();
    }

    let zbScale = 1;
    function fitZbCanvas(){
      const s = Math.min(3, Math.max(1, zbCanvas.clientWidth * (window.devicePixelRatio || 1) / ZW));
      if (Math.abs(s - zbScale) < 0.01) return;
      zbScale = s;
      zbCanvas.width = Math.round(ZW * s); zbCanvas.height = Math.round(ZH * s);
    }
    function drawZb(){
      const ctx = zbCtx, h = hero;
      fitZbCanvas();
      ctx.setTransform(zbScale, 0, 0, zbScale, 0, 0);
      cam.s = Math.sin(h.a); cam.c = Math.cos(h.a);
      // you are the camera: it bobs a little with every step
      cam.x = h.x; cam.z = h.z;
      cam.y = EYE_H + (h.moving ? Math.abs(Math.sin(h.walk * 0.5)) * 0.06 : 0);
      drawSky(ctx);
      drawGround(ctx);

      // everything standing in the world, drawn far to near
      const items = [];
      const add = (x, y, z, draw) => {
        const p = camSpace(x, y, z);
        if (p[2] < NEAR) return;
        const [sx, sy] = toScreen(p);
        if (sx < -300 || sx > ZW + 300) return;
        items.push({ zz: p[2], sx, sy, draw });
      };
      PROPS.forEach(p => add(p.x, 0, p.z, ctx => drawProp(ctx, p)));
      DECOR.forEach(d => { if (Math.abs(d.x - h.x) + Math.abs(d.z - h.z) < 30) add(d.x, 0, d.z, ctx => drawDecor(ctx, d)); });
      FIREFLIES.forEach(f => {
        const t = zbClock * 0.4 + f.ph;
        add(f.x + Math.sin(t) * 1.6, 1.1 + 0.5 * Math.sin(t * 2.3), f.z + Math.cos(t * 1.3) * 1.6, ctx => drawFirefly(ctx, f));
      });
      POSTS.forEach(([x, z], i) => {
        add(x, 0, z, drawPost);
        const [nx, nz] = POSTS[(i + 1) % POSTS.length];
        const mid = camSpace((x + nx) / 2, 0, (z + nz) / 2);
        if (mid[2] > NEAR) items.push({ zz: mid[2], rail: [x, z, nx, nz] });
      });
      zombies.forEach(zb => add(zb.x, 0, zb.z, ctx => drawZombie(ctx, zb)));
      pickups.forEach(p => add(p.x, 0, p.z, ctx => drawHeartPickup(ctx, p)));
      shots.forEach(s => add(s.x, 1, s.z, drawGoo));
      puffs.forEach(p => add(p.x, p.y, p.z, ctx => drawPuff(ctx, p)));
      items.sort((a, b) => b.zz - a.zz);
      items.forEach(it => {
        ctx.globalAlpha = Math.max(0, Math.min(1, (48 - it.zz) / 22)); // fade into the fog
        if (ctx.globalAlpha <= 0) return;
        if (it.rail) {
          const [x, z, nx, nz] = it.rail;
          ctx.strokeStyle = "#6b5844"; ctx.lineWidth = Math.max(1, 0.07 * FOCAL / it.zz);
          ctx.beginPath(); zbLine(ctx, x, 0.4, z, nx, 0.4, nz); zbLine(ctx, x, 0.85, z, nx, 0.85, nz); ctx.stroke();
          return;
        }
        const s = FOCAL / it.zz;
        ctx.save(); ctx.translate(it.sx, it.sy); ctx.scale(s, s);
        it.draw(ctx);
        ctx.restore();
      });
      ctx.globalAlpha = 1;
      // floating points
      ctx.textAlign = "center";
      puffs.forEach(p => {
        if (!p.text) return;
        const c = camSpace(p.x, p.y + 1 + p.t * 1.2, p.z);
        if (c[2] < NEAR) return;
        const [sx, sy] = toScreen(c);
        ctx.globalAlpha = 1 - p.t / 0.9;
        ctx.fillStyle = "#ffe14d"; ctx.font = `800 ${Math.round(Math.max(14, Math.min(40, 0.5 * FOCAL / c[2])))}px 'Bricolage Grotesque', sans-serif`;
        ctx.fillText(p.text, sx, sy);
      });
      ctx.globalAlpha = 1;

      drawTorchlight(ctx);
      drawBlaster(ctx);
      // aiming circle where your goo flies: on the mouse, or straight ahead
      const [ax, ay] = zbMouse || [ZW / 2, ZH / 2];
      ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ax, ay, 9, 0, Math.PI * 2);
      ctx.moveTo(ax - 15, ay); ctx.lineTo(ax - 5, ay); ctx.moveTo(ax + 5, ay); ctx.lineTo(ax + 15, ay);
      ctx.moveTo(ax, ay - 15); ctx.lineTo(ax, ay - 5); ctx.moveTo(ax, ay + 5); ctx.lineTo(ax, ay + 15);
      ctx.stroke();

      // red glow when a zombie sneaks up behind you
      let danger = 0;
      zombies.forEach(z => {
        if (z.rise > 0) return;
        const dx = z.x - h.x, dz = z.z - h.z, d = Math.hypot(dx, dz);
        if (d < 4.5 && dx * cam.s + dz * cam.c < 0) danger = Math.max(danger, 1 - d / 4.5);
      });
      if (h.inv > 1.3) danger = 1;
      if (danger > 0) {
        const v = ctx.createRadialGradient(ZW / 2, ZH / 2, ZH * 0.35, ZW / 2, ZH / 2, ZW * 0.6);
        v.addColorStop(0, "rgba(255,0,0,0)"); v.addColorStop(1, `rgba(255,30,30,${0.55 * danger * (0.75 + 0.25 * Math.sin(zbClock * 12))})`);
        ctx.fillStyle = v; ctx.fillRect(0, 0, ZW, ZH);
      }
      fx.draw(ctx, fxDt);
      drawRadar(ctx);
      if (zbFlash.t > 0) {
        ctx.globalAlpha = Math.min(1, zbFlash.t * 2);
        ctx.fillStyle = "#fff"; ctx.font = "800 34px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center";
        ctx.fillText(zbFlash.text, ZW / 2, 60);
        ctx.globalAlpha = 1;
      }
    }

    function updateZbHud(){
      zbScoreEl.textContent = "⭐ " + zbScore;
      zbWaveEl.textContent = "🌊 Wave " + Math.max(1, zbWave);
      zbHeartsEl.textContent = "❤️".repeat(Math.max(0, hero.hearts)) || "💔";
    }

    function zbLoop(now){
      if (!zbOpen) return;
      const dt = Math.min(1 / 30, (now - zbLast) / 1000 || 0);
      zbLast = now; fxDt = dt;
      zbFrame++;
      if (zbRunning) zbStep(dt);
      drawZb();
      updateZbHud();
      requestAnimationFrame(zbLoop);
    }

    function startZb(){
      resetZb();
      zbRunning = true;
      zbPanel.hidden = true;
      Object.keys(zbKeys).forEach(k => { zbKeys[k] = false; });
      zbCanvas.focus();
    }
    function endZb(){
      zbRunning = false;
      letGo();
      Fun.sfx.wah();
      const bestScore = zbScore > (store.zombieBest || 0);
      if (bestScore) store.zombieBest = zbScore;
      if (zbWave > (store.zombieWave || 0)) store.zombieWave = zbWave;
      Hub.saveStore();
      Hub.checkBadges();
      zbPanelTitle.textContent = "🧟 The zombies got you!";
      zbPanelText.textContent = `You scored ${zbScore} and made it to wave ${zbWave}.`
        + (bestScore ? " That's a new best! 🎉" : ` Your best is ${store.zombieBest}.`);
      zbPlayBtn.textContent = "▶ Play again";
      zbPanel.hidden = false;
      if (bestScore) Hub.confettiBurst(zbPlayBtn);
      zbPlayBtn.focus();
    }
    function openZb(){
      zbOpen = true;
      zbRunning = false;
      resetZb();
      zbOverlay.hidden = false;
      document.body.style.overflow = "hidden";
      zbPanelTitle.textContent = "🧟 Zombie Blaster";
      zbPanelText.textContent = "Zombies are climbing out of the graveyard, and this time you're right there in it! Click to look around with the mouse and blast them with your goo blaster before they grab you. Clear a wave to win back a heart. Watch the radar so nobody sneaks up behind you!"
        + (store.zombieBest ? ` Your best: ${store.zombieBest}.` : "");
      zbPlayBtn.textContent = "▶ Play";
      zbPanel.hidden = false;
      zbLast = performance.now();
      requestAnimationFrame(zbLoop);
      zbPlayBtn.focus();
    }
    function closeZb(){
      zbOpen = false;
      zbRunning = false;
      letGo();
      zbOverlay.hidden = true;
      document.body.style.overflow = "";
      }

    const ZB_KEYMAP = {
      ArrowLeft: "left", KeyQ: "left", ArrowRight: "right", KeyE: "right",
      ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
      KeyA: "strafeL", KeyD: "strafeR", Space: "fire", KeyJ: "fire"
    };
    window.addEventListener("keydown", e => {
      if (!zbOpen) return;
      // Esc first lets the mouse go (the browser does that); only an Esc after that leaves the game
      if (e.key === "Escape") { if (looking() || performance.now() - unlockedAt < 400) { if (looking()) document.exitPointerLock(); return; } Hub.leave(); return; }
      const k = ZB_KEYMAP[e.code];
      if (!k || !zbRunning) return;
      e.preventDefault();
      zbKeys[k] = true;
    });
    window.addEventListener("keyup", e => {
      const k = ZB_KEYMAP[e.code];
      if (k) zbKeys[k] = false;
    });
    window.addEventListener("blur", () => Object.keys(zbKeys).forEach(k => { zbKeys[k] = false; }));
    // click the game and the mouse turns your head (the browser hides the pointer until Esc);
    // without that, point with the mouse and hold the button to keep blasting there
    const looking = () => document.pointerLockElement === zbCanvas;
    let unlockedAt = 0;
    const tip = Fun.hint(zbCanvas.parentElement);
    document.addEventListener("pointerlockchange", () => {
      if (looking()) tip.show("🖱️ Press Esc to get your mouse back");
      else { unlockedAt = performance.now(); tip.hide(); }
    });
    function trackMouse(e){
      if (looking()) {
        if (zbRunning) hero.a += e.movementX * 0.0032;
        zbMouse = null;
        return;
      }
      const r = zbCanvas.getBoundingClientRect();
      zbMouse = [(e.clientX - r.left) / r.width * ZW, (e.clientY - r.top) / r.height * ZH];
    }
    zbCanvas.addEventListener("pointermove", trackMouse);
    zbCanvas.addEventListener("pointerdown", e => {
      trackMouse(e);
      if (!zbRunning) return;
      e.preventDefault(); zbKeys.fire = true;
      if (e.pointerType === "mouse" && !looking() && zbCanvas.requestPointerLock) {
        try { const p = zbCanvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) {}
      }
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach(ev => zbCanvas.addEventListener(ev, e => {
      if (ev === "pointerleave" && looking()) return;
      zbKeys.fire = false;
      if (ev === "pointerleave" || e.pointerType === "touch") zbMouse = null; // a finger lifted isn't pointing anymore
    }));
    const letGo = () => { if (looking()) document.exitPointerLock(); };
    host.querySelectorAll("[data-zkey]").forEach(btn => {
      const k = btn.dataset.zkey;
      btn.addEventListener("pointerdown", e => { e.preventDefault(); zbKeys[k] = true; });
      ["pointerup", "pointercancel", "pointerleave"].forEach(ev => btn.addEventListener(ev, () => { zbKeys[k] = false; }));
    });
    zbCanvas.tabIndex = 0;

    document.getElementById("zbCloseBtn").addEventListener("click", () => Hub.leave());
    Fun.soundButton(document.getElementById("zbCloseBtn"));
    zbPlayBtn.addEventListener("click", startZb);

    return { open: openZb, close: closeZb };
  }
})();
