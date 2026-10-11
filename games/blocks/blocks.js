/* Block World: a Minecraft-style sandbox. Walk, jump and fly around a world made of blocks, dig them out
   and build whatever you like. The picture is drawn by shooting a ray through every pixel and stepping
   from block to block until it hits one, so there's no 3D library and every block is a real textured cube.
   Your builds are saved (only the blocks you changed, not the whole world). */
(function(){
  "use strict";
  const store = Hub.store;
  const { WW, WH, WD, world, at, TEX, BLOCKS, FACE, generate, heightAt } = window.BlockWorld;

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

  function mount(host){
    host.innerHTML = `
    <section class="game-screen" id="blOverlay" hidden aria-label="Block World">
      <div class="game-box">
        <div class="game-hud">
          <h2>⛏️ Block World</h2>
          <span class="mono game-stat" id="blSel">🧱 Grass</span>
          <span class="mono game-stat" id="blMode">🚶 Walking</span>
          <button class="btn ghost small" id="blCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas id="blCanvas" width="256" height="144"></canvas>
          <div class="bl-cross" aria-hidden="true"></div>
          <div class="bl-hotbar" id="blHotbar"></div>
          <div class="game-panel bl-panel" id="blPanel">
            <div class="game-panel-title">⛏️ Block World</div>
            <div class="game-panel-text" id="blPanelText"></div>
            <button class="btn" id="blPlayBtn" type="button">▶ Play</button>
            <button class="btn ghost small" id="blNewBtn" type="button">🌱 New world</button>
          </div>
        </div>
        <div class="game-help">W A S D to move · mouse or ← → ↑ ↓ to look · Space to jump · left click to dig · right click to build · 1–8 or the mouse wheel to pick a block · F to fly (Space up, Shift down)</div>
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

    const overlay = document.getElementById("blOverlay");
    const canvas = document.getElementById("blCanvas");
    const ctx = canvas.getContext("2d");
    const panel = document.getElementById("blPanel");
    const panelText = document.getElementById("blPanelText");
    const playBtn = document.getElementById("blPlayBtn");
    const newBtn = document.getElementById("blNewBtn");
    const selEl = document.getElementById("blSel");
    const modeEl = document.getElementById("blMode");
    const hotbar = document.getElementById("blHotbar");

    const HALF = 0.3, HEIGHT = 1.8, EYE = 1.62, REACH = 6;
    const GRAVITY = 26, JUMP = 8.2, WALK = 4.6, FLY = 10;
    const FOV = 70 * Math.PI / 180, MAXD = 44;
    const FOG = [196, 224, 250];
    const SUN = (() => { const l = [0.5, 0.75, 0.4], n = Math.hypot(...l); return l.map(v => v / n); })();
    const approach = (v, target, step) => v < target ? Math.min(v + step, target) : Math.max(v - step, target);

    let isOpen = false, running = false, last = 0, frame = 0, loadedSeed = 0;
    const p = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, onGround: false, fly: false };
    let yaw = 0, pitch = 0, sel = 0, mineT = 0, saveT = 0;
    let target = null, targetIdx = -1;
    const keys = { forward: false, back: false, left: false, right: false, jump: false, down: false, mine: false, lookL: false, lookR: false, lookU: false, lookD: false };

    /* ---------------- the picture: a ray through every pixel ---------------- */
    // it starts small and speeds up or slows down by itself, so slow computers still run smoothly
    let RW = 0, RH = 0, img = null, buf = null, frameMs = 8;
    function setRes(w){
      RW = w; RH = Math.round(w * 9 / 16);
      canvas.width = RW; canvas.height = RH;
      img = ctx.createImageData(RW, RH);
      buf = new Uint32Array(img.data.buffer);
    }
    setRes(256);

    function render(){
      const w = RW, h = RH;
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const fx = cp * sy, fy = sp, fz = cp * cy;      // forward
      const rx = cy, rz = -sy;                        // right
      const ux = -sp * sy, uy = cp, uz = -sp * cy;    // up
      const tY = Math.tan(FOV / 2), tX = tY * w / h;
      const ox = p.x, oy = p.y + EYE, oz = p.z;
      const sx0 = Math.floor(ox), sy0 = Math.floor(oy), sz0 = Math.floor(oz);
      const maxd2 = MAXD * MAXD, tgt = targetIdx;
      for (let j = 0; j < h; j++) {
        const ny = (1 - (j + 0.5) / h * 2) * tY;
        for (let i = 0; i < w; i++) {
          const nx = ((i + 0.5) / w * 2 - 1) * tX;
          let dx = fx + rx * nx + ux * ny, dy = fy + uy * ny, dz = fz + rz * nx + uz * ny;
          const inv = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);
          dx *= inv; dy *= inv; dz *= inv;

          // step from block to block along the ray until one isn't air
          let x = sx0, y = sy0, z = sz0;
          const stx = dx > 0 ? 1 : -1, sty = dy > 0 ? 1 : -1, stz = dz > 0 ? 1 : -1;
          const tdx = dx !== 0 ? Math.abs(1 / dx) : 1e30, tdy = dy !== 0 ? Math.abs(1 / dy) : 1e30, tdz = dz !== 0 ? Math.abs(1 / dz) : 1e30;
          let tmx = dx > 0 ? (x + 1 - ox) * tdx : dx < 0 ? (ox - x) * tdx : 1e30;
          let tmy = dy > 0 ? (y + 1 - oy) * tdy : dy < 0 ? (oy - y) * tdy : 1e30;
          let tmz = dz > 0 ? (z + 1 - oz) * tdz : dz < 0 ? (oz - z) * tdz : 1e30;
          let t = 0, face = 0, hit = 0;
          for (let n = 0; n < 160; n++) {
            if (tmx < tmy) {
              if (tmx < tmz) { t = tmx; tmx += tdx; x += stx; face = 0; } else { t = tmz; tmz += tdz; z += stz; face = 2; }
            } else if (tmy < tmz) { t = tmy; tmy += tdy; y += sty; face = 1; } else { t = tmz; tmz += tdz; z += stz; face = 2; }
            if (t > MAXD) break;
            if (x < 0 || x >= WW || z < 0 || z >= WD || y < 0) break;
            if (y >= WH) { if (sty > 0) break; continue; }
            const b = world[(y * WD + z) * WW + x];
            if (b) { hit = b; break; }
          }

          let r, g, bl;
          if (hit) {
            // where on the block's face did the ray land, and which texture is that face?
            const px = ox + dx * t, py = oy + dy * t, pz = oz + dz * t;
            let fu, fv, kind, shade;
            if (face === 1) { fu = px - x; fv = pz - z; kind = sty > 0 ? 2 : 1; shade = sty > 0 ? 0.55 : 1; }
            else if (face === 0) { fu = pz - z; fv = 1 - (py - y); kind = 0; shade = 0.78; }
            else { fu = px - x; fv = 1 - (py - y); kind = 0; shade = 0.9; }
            let tx = (fu * 16) | 0, ty = (fv * 16) | 0;
            tx = tx < 0 ? 0 : tx > 15 ? 15 : tx; ty = ty < 0 ? 0 : ty > 15 ? 15 : ty;
            const c = TEX[FACE[hit * 3 + kind]][ty * 16 + tx];
            r = c & 255; g = (c >> 8) & 255; bl = (c >> 16) & 255;
            // the block you're pointing at gets a bright face and dark edges
            if ((y * WD + z) * WW + x === tgt) shade *= (fu < 0.04 || fu > 0.96 || fv < 0.04 || fv > 0.96) ? 0.45 : 1.22;
            const ff = Math.min(1, t * t / maxd2);  // far blocks melt into the haze
            r = r * shade; g = g * shade; bl = bl * shade;
            r += (FOG[0] - r) * ff; g += (FOG[1] - g) * ff; bl += (FOG[2] - bl) * ff;
            if (r > 255) r = 255; if (g > 255) g = 255; if (bl > 255) bl = 255;
          } else {
            // sky: pale at the horizon, deeper blue overhead, and the sun
            const k = dy * 1.4 + 0.3, kk = k < 0 ? 0 : k > 1 ? 1 : k;
            r = FOG[0] + (84 - FOG[0]) * kk; g = FOG[1] + (140 - FOG[1]) * kk; bl = FOG[2] + (232 - FOG[2]) * kk;
            const sd = dx * SUN[0] + dy * SUN[1] + dz * SUN[2];
            if (sd > 0.9992) { r = 255; g = 250; bl = 215; }
            else if (sd > 0.985) { const a = (sd - 0.985) / 0.0142 * 0.55; r += (255 - r) * a; g += (250 - g) * a; bl += (210 - bl) * a; }
          }
          buf[j * w + i] = 0xff000000 | ((bl | 0) << 16) | ((g | 0) << 8) | (r | 0);
        }
      }
      ctx.putImageData(img, 0, 0);
    }

    /* ---------------- the world around you ---------------- */
    function solidAt(x, y, z){
      if (y < 0 || x < 0 || x >= WW || z < 0 || z >= WD) return true; // the floor and the edges are walls
      if (y >= WH) return false;
      return world[at(x, y, z)] !== 0;
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
        if (x >= 0 && x < WW && y >= 0 && y < WH && z >= 0 && z < WD && world[at(x, y, z)]) return { x, y, z, nx, ny, nz };
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
    }
    function inPlayer(x, y, z){
      return p.x + HALF > x && p.x - HALF < x + 1 && p.y + HEIGHT > y && p.y < y + 1 && p.z + HALF > z && p.z - HALF < z + 1;
    }
    function dig(){
      const t = aim();
      if (!t || t.y === 0) return; // the very bottom layer can't be dug
      setBlock(t.x, t.y, t.z, 0);
      store.blocksBroken = (store.blocksBroken || 0) + 1;
      Hub.checkBadges(); saveSoon();
    }
    function build(){
      const t = aim();
      if (!t) return;
      const x = t.x + t.nx, y = t.y + t.ny, z = t.z + t.nz;
      if (x < 0 || x >= WW || y < 0 || y >= WH || z < 0 || z >= WD || world[at(x, y, z)] || inPlayer(x, y, z)) return;
      setBlock(x, y, z, sel + 1);
      store.blocksPlaced = (store.blocksPlaced || 0) + 1;
      Hub.checkBadges(); saveSoon();
    }

    /* ---------------- moving ---------------- */
    function move(h){
      if (!p.fly) p.vy = Math.max(p.vy - GRAVITY * h, -32);
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
      const f = (keys.forward ? 1 : 0) - (keys.back ? 1 : 0), s = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      const sy = Math.sin(yaw), cy = Math.cos(yaw);
      let wx = sy * f + cy * s, wz = cy * f - sy * s;
      const len = Math.hypot(wx, wz);
      if (len > 1) { wx /= len; wz /= len; }
      const speed = p.fly ? FLY : WALK, acc = (p.onGround || p.fly ? 45 : 22) * dt;
      p.vx = approach(p.vx, wx * speed, acc);
      p.vz = approach(p.vz, wz * speed, acc);
      if (p.fly) p.vy = approach(p.vy, ((keys.jump ? 1 : 0) - (keys.down ? 1 : 0)) * FLY * 0.8, 40 * dt);
      else {
        if (keys.jump && p.onGround) { p.vy = JUMP; p.onGround = false; }
      }
      for (let k = 0; k < 3; k++) move(dt / 3); // little steps, so you can't fall through a block
      if (keys.mine) { mineT -= dt; if (mineT <= 0) { dig(); mineT = 0.22; } }
      const high = Math.floor(p.y);
      if (high > (store.blocksHigh || 0)) { store.blocksHigh = high; Hub.checkBadges(); saveSoon(); }
    }

    /* ---------------- the hotbar and the top bar ---------------- */
    function select(i){
      sel = ((i % 8) + 8) % 8;
      [...hotbar.children].forEach((el, n) => el.classList.toggle("sel", n === sel));
      selEl.textContent = "🧱 " + BLOCKS[sel + 1].name;
    }
    BLOCKS.slice(1, 9).forEach((b, i) => {
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "bl-slot"; btn.title = b.name; btn.setAttribute("aria-label", b.name);
      const c = document.createElement("canvas");
      c.width = c.height = 16;
      c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(TEX[b.side].buffer.slice(0)), 16, 16), 0, 0);
      const num = document.createElement("span");
      num.textContent = String(i + 1);
      btn.append(c, num);
      btn.addEventListener("pointerdown", e => { e.preventDefault(); select(i); });
      hotbar.appendChild(btn);
    });
    select(0);

    function toggleFly(){
      p.fly = !p.fly;
      p.vy = 0;
      modeEl.textContent = p.fly ? "🕊️ Flying" : "🚶 Walking";
    }

    /* ---------------- starting and stopping ---------------- */
    function spawn(){
      const sx = WW / 2, sz = WD / 2;
      p.x = sx + 0.5; p.z = sz + 0.5; p.y = heightAt(sx, sz) + 1;
      p.vx = p.vy = p.vz = 0; yaw = 0; pitch = -0.15;
    }
    function ensureWorld(){
      if (!store.blockSeed) store.blockSeed = 1 + Math.floor(Math.random() * 99999);
      if (!store.blockEdits) store.blockEdits = {};
      if (loadedSeed === store.blockSeed) return;
      generate(store.blockSeed, store.blockEdits);
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
      panelText.textContent = "Dig, build and explore! Left click digs a block and right click puts one down. Pick what to build with in the bar at the bottom. Press F to fly. Your builds are saved."
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
      clearTimeout(saveT);
      Hub.saveStore();
    }

    function loop(now){
      if (!isOpen) return;
      const dt = Math.min(1 / 30, (now - last) / 1000 || 0);
      last = now; frame++;
      if (running) step(dt);
      target = aim();
      targetIdx = target ? at(target.x, target.y, target.z) : -1;
      const t0 = performance.now();
      render();
      frameMs = frameMs * 0.9 + (performance.now() - t0) * 0.1;
      if (frame % 45 === 0) { // too slow: use fewer pixels. Plenty of time to spare: use more.
        if (frameMs > 22 && RW > 192) setRes(Math.round(RW * 0.85 / 16) * 16);
        else if (frameMs < 8 && RW < 384) setRes(Math.round(RW * 1.15 / 16) * 16);
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
      const digit = /^Digit([1-8])$/.exec(e.code);
      if (digit) { select(+digit[1] - 1); return; }
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
