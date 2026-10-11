/* Block World: a Minecraft-style sandbox. Walk, jump, swim and fly around a world made of blocks, dig them
   out and build whatever you like. The picture comes from gl.js (WebGL, or soft.js on a device without it);
   this file is the game itself: moving, digging, building, the hotbar and saving.
   Your builds are saved (only the blocks you changed, not the whole world). */
(function(){
  "use strict";
  const store = Hub.store;
  const BW = window.BlockWorld;
  const { WW, WH, WD, world, at, ID, K, TEX, FACE, KIND, IS_SOLID, HOTBAR, BLOCKS, generate, spawnPoint, skyState } = BW;
  const CYCLE = 360;              // a whole day and night takes 6 minutes
  const SLOTS = HOTBAR.length;
  // the times the clock button jumps to
  const TIMES = [{ t: 0.04, icon: "🌅", name: "Morning" }, { t: 0.25, icon: "☀️", name: "Day" }, { t: 0.47, icon: "🌇", name: "Sunset" }, { t: 0.75, icon: "🌙", name: "Night" }];
  const WORLD_VERSION = 2; // bumped when the terrain changed shape, so an old save doesn't land in the wrong place

  Hub.register({
    id: "blocks", section: "games", title: "Block World", icon: "⛏️",
    blurb: "Dig, build and explore a world made of blocks. Make anything you can imagine!",
    stat: () => store.blocksPlaced ? "Built " + store.blocksPlaced + " blocks" : "",
    badges: [
      { id: "blockBuild", icon: "🧱", name: "Builder",  desc: "Place 50 blocks in Block World", test: () => (store.blocksPlaced || 0) >= 50 },
      { id: "blockDig",   icon: "⛏️", name: "Miner",    desc: "Dig up 100 blocks",              test: () => (store.blocksBroken || 0) >= 100 },
      { id: "blockHigh",  icon: "☁️", name: "Sky High", desc: "Climb up to the clouds",         test: () => (store.blocksHigh || 0) >= 26 }
    ],
    mount
  });

  // what the pointer can land on: everything but air and water
  const HIT = new Uint8Array(256);
  BLOCKS.forEach((b, id) => { if (b && b.kind !== K.WATER) HIT[id] = 1; });

  function mount(host){
    host.innerHTML = `
    <section class="game-screen" id="blOverlay" hidden aria-label="Block World">
      <div class="game-box">
        <div class="game-hud">
          <h2>⛏️ Block World</h2>
          <span class="mono game-stat" id="blPos">📍 0 0 0</span>
          <button class="mono game-stat bl-time" id="blTime" type="button" title="Change the time of day">☀️ Day</button>
          <span class="mono game-stat" id="blMode">🚶 Walking</span>
          <button class="btn ghost small" id="blCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas id="blCanvas" width="960" height="540"></canvas>
          <div class="bl-water" id="blWater" hidden></div>
          <div class="bl-cross" aria-hidden="true"></div>
          <div class="bl-name" id="blName" aria-live="polite"></div>
          <div class="bl-hotbar" id="blHotbar"></div>
          <div class="game-panel bl-panel" id="blPanel">
            <div class="game-panel-title">⛏️ Block World</div>
            <div class="game-panel-text" id="blPanelText"></div>
            <button class="btn" id="blPlayBtn" type="button">▶ Play</button>
            <button class="btn ghost small" id="blNewBtn" type="button">🌱 New world</button>
          </div>
        </div>
        <div class="game-help">W A S D to move · mouse or ← → ↑ ↓ to look · Space to jump or swim up · left click to dig · right click to build · 1–9, 0 or the mouse wheel to pick a block · F to fly (Space up, Shift down) · T for another time of day</div>
        <div class="game-touch bl-touch">
          <button class="btn ghost" data-bkey="left" type="button" aria-label="Step left">◀</button>
          <button class="btn ghost" data-bkey="forward" type="button" aria-label="Walk forward">▲</button>
          <button class="btn ghost" data-bkey="back" type="button" aria-label="Walk back">▼</button>
          <button class="btn ghost" data-bkey="right" type="button" aria-label="Step right">▶</button>
          <button class="btn" data-bkey="jump" type="button" aria-label="Jump">JUMP</button>
          <button class="btn" data-bkey="mine" type="button" aria-label="Dig">⛏</button>
          <button class="btn" data-bkey="place" type="button" aria-label="Build">🧱</button>
          <button class="btn ghost" data-bkey="fly" type="button" aria-label="Fly or walk">✈</button>
        </div>
      </div>
    </section>`;

    let canvas = document.getElementById("blCanvas");
    // the real picture needs WebGL; if that's missing, fall back to the plain ray-caster on a fresh canvas
    let renderer = null;
    try { renderer = BW.createGL(canvas); } catch (e) { renderer = null; }
    if (!renderer) {
      const fresh = canvas.cloneNode(false);
      canvas.replaceWith(fresh);
      canvas = fresh;
      renderer = BW.createSoft(canvas);
    }
    const gpu = !!renderer.gl;

    const overlay = document.getElementById("blOverlay");
    const panel = document.getElementById("blPanel");
    const panelText = document.getElementById("blPanelText");
    const playBtn = document.getElementById("blPlayBtn");
    const newBtn = document.getElementById("blNewBtn");
    const posEl = document.getElementById("blPos");
    const modeEl = document.getElementById("blMode");
    const hotbar = document.getElementById("blHotbar");
    const nameEl = document.getElementById("blName");
    const waterEl = document.getElementById("blWater");
    const timeEl = document.getElementById("blTime");

    const HALF = 0.3, HEIGHT = 1.8, EYE = 1.62, REACH = 6;
    const GRAVITY = 26, JUMP = 8.2, WALK = 4.6, FLY = 10;
    const approach = (v, target, step) => v < target ? Math.min(v + step, target) : Math.max(v - step, target);

    let isOpen = false, running = false, last = 0, frame = 0, loadedSeed = 0;
    const p = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, onGround: false, fly: false, wet: false };
    let yaw = 0, pitch = 0, sel = 0, mineT = 0, saveT = 0, swing = 0, nameT = 0;
    let dayT = typeof store.blockTime === "number" ? store.blockTime : 0.1;  // 0 sunrise, 0.25 noon, 0.5 sunset, 0.75 midnight
    let target = null;
    const bits = []; // the flying bits of a dug block
    const keys = { forward: false, back: false, left: false, right: false, jump: false, down: false, mine: false, lookL: false, lookR: false, lookU: false, lookD: false };

    /* ---------------- the world around you ---------------- */
    const idAt = (x, y, z) => (x < 0 || x >= WW || z < 0 || z >= WD || y < 0 || y >= WH) ? 0 : world[at(x, y, z)];
    function solidAt(x, y, z){
      if (y < 0 || x < 0 || x >= WW || z < 0 || z >= WD) return true; // the floor and the edges are walls
      if (y >= WH) return false;
      return IS_SOLID[world[at(x, y, z)]] === 1;
    }
    // would a body standing with its feet here be inside a block?
    function collides(x, y, z){
      const x0 = Math.floor(x - HALF), x1 = Math.floor(x + HALF), z0 = Math.floor(z - HALF), z1 = Math.floor(z + HALF);
      const y0 = Math.floor(y), y1 = Math.floor(y + HEIGHT - 0.001);
      for (let yy = y0; yy <= y1; yy++) for (let zz = z0; zz <= z1; zz++) for (let xx = x0; xx <= x1; xx++) if (solidAt(xx, yy, zz)) return true;
      return false;
    }
    // the first block along a line, and which side of it the line came in through
    function cast(ox, oy, oz, dx, dy, dz, max){
      let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
      const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
      const tdx = dx !== 0 ? Math.abs(1 / dx) : 1e30, tdy = dy !== 0 ? Math.abs(1 / dy) : 1e30, tdz = dz !== 0 ? Math.abs(1 / dz) : 1e30;
      let tmx = dx > 0 ? (x + 1 - ox) * tdx : dx < 0 ? (ox - x) * tdx : 1e30;
      let tmy = dy > 0 ? (y + 1 - oy) * tdy : dy < 0 ? (oy - y) * tdy : 1e30;
      let tmz = dz > 0 ? (z + 1 - oz) * tdz : dz < 0 ? (oz - z) * tdz : 1e30;
      let nx = 0, ny = 0, nz = 0;
      for (let n = 0; n < 64; n++) {
        if (x >= 0 && x < WW && y >= 0 && y < WH && z >= 0 && z < WD && HIT[world[at(x, y, z)]]) return { x, y, z, nx, ny, nz };
        let t;
        if (tmx < tmy) {
          if (tmx < tmz) { t = tmx; tmx += tdx; x += sx; nx = -sx; ny = 0; nz = 0; } else { t = tmz; tmz += tdz; z += sz; nx = 0; ny = 0; nz = -sz; }
        } else if (tmy < tmz) { t = tmy; tmy += tdy; y += sy; nx = 0; ny = -sy; nz = 0; } else { t = tmz; tmz += tdz; z += sz; nx = 0; ny = 0; nz = -sz; }
        if (t > max) return null;
      }
      return null;
    }
    function aim(){
      const cp = Math.cos(pitch);
      return cast(p.x, p.y + EYE, p.z, cp * Math.sin(yaw), Math.sin(pitch), cp * Math.cos(yaw), REACH);
    }

    /* ---------------- digging and building ---------------- */
    function saveSoon(){ clearTimeout(saveT); saveT = setTimeout(Hub.saveStore, 600); }
    function setBlock(x, y, z, id){
      const i = at(x, y, z);
      world[i] = id;
      store.blockEdits[i] = id;
      renderer.updateBlock(x, y, z);
    }
    function inPlayer(x, y, z){
      return p.x + HALF > x && p.x - HALF < x + 1 && p.y + HEIGHT > y && p.y < y + 1 && p.z + HALF > z && p.z - HALF < z + 1;
    }
    // a little shower of bits in the colours of the block
    function debris(x, y, z, id){
      const tex = TEX[FACE[id * 3]];
      for (let n = 0; n < 14; n++) {
        const c = tex[(Math.random() * 256) | 0];
        if ((c >>> 24) < 128) continue;
        bits.push({
          x: x + Math.random(), y: y + Math.random(), z: z + Math.random(),
          vx: (Math.random() - 0.5) * 3, vy: Math.random() * 3 + 1, vz: (Math.random() - 0.5) * 3,
          r: (c & 255) / 255 * 0.92, g: ((c >> 8) & 255) / 255 * 0.92, b: ((c >> 16) & 255) / 255 * 0.92,
          size: 0.07 + Math.random() * 0.07, life: 0.5 + Math.random() * 0.5
        });
      }
    }
    function dig(){
      const t = aim();
      if (!t || t.y === 0) return; // the very bottom layer can't be dug
      const id = world[at(t.x, t.y, t.z)];
      setBlock(t.x, t.y, t.z, 0);
      debris(t.x, t.y, t.z, id);
      swing = 0.001;
      store.blocksBroken = (store.blocksBroken || 0) + 1;
      Hub.checkBadges(); saveSoon();
    }
    function build(){
      const t = aim();
      if (!t) return;
      // pointing at a flower: the new block takes its place
      const x = KIND[world[at(t.x, t.y, t.z)]] === K.PLANT ? t.x : t.x + t.nx;
      const y = KIND[world[at(t.x, t.y, t.z)]] === K.PLANT ? t.y : t.y + t.ny;
      const z = KIND[world[at(t.x, t.y, t.z)]] === K.PLANT ? t.z : t.z + t.nz;
      if (x < 0 || x >= WW || y < 0 || y >= WH || z < 0 || z >= WD) return;
      const there = world[at(x, y, z)];
      if (there && KIND[there] !== K.PLANT && KIND[there] !== K.WATER) return;
      if (inPlayer(x, y, z)) return;
      setBlock(x, y, z, HOTBAR[sel]);
      swing = 0.001;
      store.blocksPlaced = (store.blocksPlaced || 0) + 1;
      Hub.checkBadges(); saveSoon();
    }

    /* ---------------- moving ---------------- */
    function move(h){
      // gravity is part of every little step, so standing on the floor is felt on each one
      if (!p.fly) p.vy = Math.max(p.vy - (p.wet ? GRAVITY * 0.2 : GRAVITY) * h, p.wet ? -3.2 : -32);
      let nx = p.x + p.vx * h;
      if (collides(nx, p.y, p.z)) { nx = p.vx > 0 ? Math.floor(nx + HALF) - HALF - 0.001 : Math.floor(nx - HALF) + 1 + HALF + 0.001; p.vx = 0; }
      p.x = nx;
      let nz = p.z + p.vz * h;
      if (collides(p.x, p.y, nz)) { nz = p.vz > 0 ? Math.floor(nz + HALF) - HALF - 0.001 : Math.floor(nz - HALF) + 1 + HALF + 0.001; p.vz = 0; }
      p.z = nz;
      let ny = p.y + p.vy * h;
      p.onGround = false;
      if (collides(p.x, ny, p.z)) {
        if (p.vy < 0) { ny = Math.floor(ny) + 1; p.onGround = true; }   // land on top of the block
        else ny = Math.floor(ny + HEIGHT) - HEIGHT - 0.001;             // bump your head
        p.vy = 0;
      }
      p.y = ny;
    }

    function step(dt){
      yaw += ((keys.lookR ? 1 : 0) - (keys.lookL ? 1 : 0)) * 2 * dt;
      pitch = Math.max(-1.5, Math.min(1.5, pitch + ((keys.lookU ? 1 : 0) - (keys.lookD ? 1 : 0)) * 1.6 * dt));
      p.wet = !p.fly && idAt(Math.floor(p.x), Math.floor(p.y + 0.5), Math.floor(p.z)) === ID.WATER;
      const f = (keys.forward ? 1 : 0) - (keys.back ? 1 : 0), s = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      const sy = Math.sin(yaw), cy = Math.cos(yaw);
      let wx = sy * f + cy * s, wz = cy * f - sy * s;
      const len = Math.hypot(wx, wz);
      if (len > 1) { wx /= len; wz /= len; }
      const speed = p.fly ? FLY : p.wet ? WALK * 0.55 : WALK, acc = (p.onGround || p.fly || p.wet ? 45 : 22) * dt;
      p.vx = approach(p.vx, wx * speed, acc);
      p.vz = approach(p.vz, wz * speed, acc);
      if (p.fly) p.vy = approach(p.vy, ((keys.jump ? 1 : 0) - (keys.down ? 1 : 0)) * FLY * 0.8, 40 * dt);
      else if (p.wet) { if (keys.jump) p.vy = approach(p.vy, 3.6, 30 * dt); } // kick to swim up
      else if (keys.jump && p.onGround) { p.vy = JUMP; p.onGround = false; }
      for (let k = 0; k < 3; k++) move(dt / 3); // little steps, so you can't fall through a block
      if (p.fly && p.y > 70) p.y = 70;
      if (keys.mine) { mineT -= dt; if (mineT <= 0) { dig(); mineT = 0.22; } }
      const high = Math.floor(p.y);
      if (high > (store.blocksHigh || 0)) { store.blocksHigh = high; Hub.checkBadges(); saveSoon(); }
    }

    /* ---------------- the hotbar: little 3D block icons, like the real one ---------------- */
    const atlas = BW.atlasCanvas();
    function icon(id){
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const g = c.getContext("2d");
      g.imageSmoothingEnabled = false;
      const tile = k => FACE[id * 3 + k];
      // each face is the 16 × 16 texture squashed into a diamond or a slanted square
      const faces = [
        { k: 1, m: [1.75, -0.875, 1.75, 0.875, 4, 18], dark: 0,    poly: [[32, 4], [60, 18], [32, 32], [4, 18]] },
        { k: 0, m: [1.75, 0.875, 0, 1.75, 4, 18],      dark: 0.26, poly: [[4, 18], [32, 32], [32, 60], [4, 46]] },
        { k: 0, m: [1.75, -0.875, 0, 1.75, 32, 32],    dark: 0.46, poly: [[32, 32], [60, 18], [60, 46], [32, 60]] }
      ];
      faces.forEach(f => {
        const t = tile(f.k), sx = (t % 6) * 16, sy = Math.floor(t / 6) * 16;
        g.setTransform(f.m[0], f.m[1], f.m[2], f.m[3], f.m[4], f.m[5]);
        g.drawImage(atlas, sx, sy, 16, 16, 0, 0, 16, 16);
        g.setTransform(1, 0, 0, 1, 0, 0);
        if (f.dark) {
          g.fillStyle = `rgba(0,0,0,${f.dark})`;
          g.beginPath(); f.poly.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill();
        }
      });
      return c;
    }
    function select(i, quiet){
      sel = ((i % SLOTS) + SLOTS) % SLOTS;
      [...hotbar.children].forEach((el, n) => el.classList.toggle("sel", n === sel));
      renderer.setSelected(HOTBAR[sel]);
      if (quiet) return;
      nameEl.textContent = BLOCKS[HOTBAR[sel]].name;
      nameEl.classList.add("show");
      nameT = 1.6;
    }
    HOTBAR.forEach((id, i) => {
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "bl-slot"; btn.title = BLOCKS[id].name; btn.setAttribute("aria-label", BLOCKS[id].name);
      const num = document.createElement("span");
      num.textContent = String(i + 1);
      btn.append(icon(id), num);
      btn.addEventListener("pointerdown", e => { e.preventDefault(); select(i); });
      hotbar.appendChild(btn);
    });
    select(0, true);

    // morning, day, sunset or night, as a name for the clock button
    function timeLabel(){
      const t = dayT % 1;
      if (t < 0.06 || t >= 0.96) return "🌅 Sunrise";
      if (t < 0.42) return "☀️ Day";
      if (t < 0.56) return "🌇 Sunset";
      return "🌙 Night";
    }
    // jump to the next time of day: morning, day, sunset, night, and round again
    function nextTime(){
      const t = dayT % 1;
      const next = TIMES.find(x => x.t > t + 0.02) || TIMES[0];
      dayT = next.t;
      store.blockTime = dayT;
      saveSoon();
      timeEl.textContent = next.icon + " " + next.name;
    }
    timeEl.addEventListener("click", () => nextTime());

    function toggleFly(){
      p.fly = !p.fly;
      p.vy = 0;
      modeEl.textContent = p.fly ? "🕊️ Flying" : "🚶 Walking";
    }

    /* ---------------- starting and stopping ---------------- */
    function spawn(){
      const s = spawnPoint();
      p.x = s[0] + 0.5; p.y = s[1]; p.z = s[2] + 0.5;
      p.vx = p.vy = p.vz = 0; yaw = 0; pitch = -0.15;
    }
    function ensureWorld(){
      if (store.blockVer !== WORLD_VERSION) { // an older world: start fresh rather than land builds in the wrong place
        store.blockVer = WORLD_VERSION; store.blockSeed = 0; store.blockEdits = {}; store.blockPos = null;
      }
      if (!store.blockSeed) store.blockSeed = 1 + Math.floor(Math.random() * 99999);
      if (!store.blockEdits) store.blockEdits = {};
      if (loadedSeed === store.blockSeed) return;
      generate(store.blockSeed, store.blockEdits);
      renderer.rebuildAll();
      loadedSeed = store.blockSeed;
      const s = store.blockPos;
      spawn();
      if (s && s.length === 5 && !collides(s[0], s[1], s[2])) { p.x = s[0]; p.y = s[1]; p.z = s[2]; yaw = s[3]; pitch = s[4]; }
    }
    function lockMouse(){
      if (document.pointerLockElement === canvas) return;
      try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {}
    }
    function releaseKeys(){ Object.keys(keys).forEach(k => { keys[k] = false; }); }

    function start(){
      running = true;
      panel.hidden = true;
      releaseKeys();
      canvas.focus();
      lockMouse();
    }
    newBtn.addEventListener("click", () => {
      if (!confirm("Start a brand new world? The one you've built will be gone.")) return;
      store.blockSeed = 1 + Math.floor(Math.random() * 99999);
      store.blockEdits = {};
      store.blockPos = null;
      Hub.saveStore();
      ensureWorld();
      p.fly = false; modeEl.textContent = "🚶 Walking";
      panelText.textContent = "A brand new world is ready. Have fun!";
    });
    playBtn.addEventListener("click", start);

    function open(){
      isOpen = true; running = false;
      ensureWorld();
      overlay.hidden = false;
      document.body.style.overflow = "hidden";
      releaseKeys();
      panelText.textContent = "Dig, build and explore! Left click digs a block and right click puts one down. Pick what to build with in the bar at the bottom. Swim in the lakes, and press F to fly. Your builds are saved."
        + (store.blocksPlaced ? ` You have built ${store.blocksPlaced} blocks so far.` : "");
      playBtn.textContent = store.blocksPlaced || store.blocksBroken ? "▶ Continue" : "▶ Play";
      panel.hidden = false;
      last = performance.now();
      requestAnimationFrame(loop);
      playBtn.focus();
    }
    function close(){
      isOpen = false; running = false;
      overlay.hidden = true;
      document.body.style.overflow = "";
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      store.blockPos = [p.x, p.y, p.z, yaw, pitch];
      store.blockTime = dayT;
      clearTimeout(saveT);
      Hub.saveStore();
    }

    function loop(now){
      if (!isOpen) return;
      const dt = Math.min(1 / 30, (now - last) / 1000 || 0);
      last = now; frame++;
      if (running) { step(dt); dayT = (dayT + dt / CYCLE) % 1; }
      for (let i = bits.length - 1; i >= 0; i--) {
        const b = bits[i];
        b.vy -= 16 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.life -= dt;
        if (b.life <= 0) bits.splice(i, 1);
      }
      if (swing > 0) { swing += dt / 0.26; if (swing >= 1) swing = 0; }
      if (nameT > 0 && (nameT -= dt) <= 0) nameEl.classList.remove("show");
      if (gpu) { // draw at the screen's real size, so every block texture is sharp
        const w = Math.min(1920, Math.round(canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 2)));
        if (w > 0 && canvas.width !== w) { canvas.width = w; canvas.height = Math.round(w * 9 / 16); }
      }
      target = aim();
      const eyeY = p.y + EYE;
      const under = idAt(Math.floor(p.x), Math.floor(eyeY), Math.floor(p.z)) === ID.WATER;
      const sky = skyState(dayT);
      waterEl.hidden = !under;
      waterEl.style.opacity = String(0.3 + 0.7 * sky.day);
      renderer.draw({
        eye: [p.x, eyeY, p.z], yaw, pitch, time: now / 1000, swing, held: true, underwater: under, sky,
        target: target ? [target.x, target.y, target.z] : null, particles: bits
      });
      if (frame % 8 === 0) {
        posEl.textContent = `📍 ${Math.floor(p.x)} ${Math.floor(p.y)} ${Math.floor(p.z)}`;
        const lbl = timeLabel();
        if (timeEl.textContent !== lbl) timeEl.textContent = lbl;
        store.blockTime = dayT;
      }
      requestAnimationFrame(loop);
    }

    /* ---------------- controls ---------------- */
    const KEYMAP = {
      KeyW: "forward", KeyS: "back", KeyA: "left", KeyD: "right", Space: "jump",
      ShiftLeft: "down", ShiftRight: "down",
      ArrowLeft: "lookL", ArrowRight: "lookR", ArrowUp: "lookU", ArrowDown: "lookD"
    };
    window.addEventListener("keydown", e => {
      if (!isOpen) return;
      if (e.key === "Escape") { Hub.leave(); return; }
      if (!running) return;
      if (e.code === "KeyF") { if (!e.repeat) toggleFly(); return; }
      if (e.code === "KeyT") { if (!e.repeat) nextTime(); return; }
      const digit = /^Digit([0-9])$/.exec(e.code);
      if (digit) { select((+digit[1] + 9) % 10); return; }
      const k = KEYMAP[e.code];
      if (!k) return;
      e.preventDefault();
      keys[k] = true;
    });
    window.addEventListener("keyup", e => {
      const k = KEYMAP[e.code];
      if (k) keys[k] = false;
    });
    window.addEventListener("blur", releaseKeys);

    // mouse: once the pointer is locked, moving it turns you; left digs, right builds
    let lockedAt = 0;
    document.addEventListener("pointerlockchange", () => { lockedAt = performance.now(); });
    document.addEventListener("mousemove", e => {
      if (!isOpen || !running || document.pointerLockElement !== canvas) return;
      // some browsers send one huge fake movement just as the pointer locks: skip it
      if (performance.now() - lockedAt < 250 || Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return;
      yaw += e.movementX * 0.0025;
      pitch = Math.max(-1.5, Math.min(1.5, pitch - e.movementY * 0.0025));
    });
    let lookId = null, lookX = 0, lookY = 0;
    canvas.addEventListener("pointerdown", e => {
      if (!running) return;
      if (e.pointerType === "touch") { // a finger dragging on the picture turns you
        lookId = e.pointerId; lookX = e.clientX; lookY = e.clientY;
        canvas.setPointerCapture(e.pointerId);
        return;
      }
      e.preventDefault();
      lockMouse();
      if (e.button === 2) build();
      else { dig(); keys.mine = true; mineT = 0.3; }
    });
    canvas.addEventListener("pointermove", e => {
      if (e.pointerId !== lookId) return;
      yaw += (e.clientX - lookX) / canvas.clientWidth * 3.2;
      pitch = Math.max(-1.5, Math.min(1.5, pitch - (e.clientY - lookY) / canvas.clientHeight * 2.4));
      lookX = e.clientX; lookY = e.clientY;
    });
    ["pointerup", "pointercancel"].forEach(ev => canvas.addEventListener(ev, e => {
      if (e.pointerId === lookId) lookId = null;
      else keys.mine = false;
    }));
    canvas.addEventListener("contextmenu", e => e.preventDefault());
    overlay.addEventListener("wheel", e => {
      if (!running) return;
      e.preventDefault();
      select(sel + (e.deltaY > 0 ? 1 : -1));
    }, { passive: false });
    canvas.tabIndex = 0;

    host.querySelectorAll("[data-bkey]").forEach(btn => {
      const k = btn.dataset.bkey;
      btn.addEventListener("pointerdown", e => {
        e.preventDefault();
        if (!running) return;
        if (k === "place") build();
        else if (k === "fly") toggleFly();
        else if (k === "mine") { dig(); keys.mine = true; mineT = 0.3; }
        else keys[k] = true;
      });
      ["pointerup", "pointercancel", "pointerleave"].forEach(ev => btn.addEventListener(ev, () => {
        if (k === "mine") keys.mine = false;
        else if (k !== "place" && k !== "fly") keys[k] = false;
      }));
    });

    document.getElementById("blCloseBtn").addEventListener("click", () => Hub.leave());

    return { open, close };
  }
})();
