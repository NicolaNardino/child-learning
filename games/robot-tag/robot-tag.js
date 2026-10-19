/* Robot Tag: a 3D-style parkour game. Run, double-jump and wall-jump away from the robot
   taggers for 3 minutes. The robots plan real routes to you, and another joins every minute. */
(function(){
  "use strict";
  const store = Hub.store;

  Hub.register({
    id: "robot-tag", section: "games", title: "Robot Tag", icon: "🏃",
    blurb: "Run, double-jump and wall-jump away from the robots for 3 minutes.",
    stat: () => store.tagBest ? "Best: " + Hub.formatTime(store.tagBest) : "",
    badges: [
      { id: "tag60",  icon: "🦎", name: "Slippery",    desc: "Last 1 minute in Robot Tag",      test: () => (store.tagBest || 0) >= 60 },
      { id: "tag180", icon: "🏃", name: "Uncatchable", desc: "Escape the robots for 3 minutes", test: () => (store.tagBest || 0) >= 180 }
    ],
    mount
  });

  function mount(host){
    host.innerHTML = `
    <section class="game-screen" id="tagOverlay" hidden aria-label="Tag game">
      <div class="game-box">
        <div class="game-hud">
          <h2>🏃 Robot Tag</h2>
          <span class="mono game-stat" id="tagTimer">3:00</span>
          <span class="mono game-stat" id="tagRobots">🤖 ×1</span>
          <span class="mono game-stat" id="tagSpeed">Speed ×1.0</span>
          <button class="btn ghost small" id="tagCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas id="tagCanvas" width="960" height="540"></canvas>
          <div class="game-panel" id="tagPanel">
            <div class="game-panel-title" id="tagPanelTitle">Robot Tag</div>
            <div class="game-panel-text" id="tagPanelText"></div>
            <button class="btn" id="tagPlayBtn" type="button">▶ Play</button>
          </div>
        </div>
        <div class="game-help">← → or A D to run · ↑ W or Space to jump (jump again in the air, or off a wall!) · ↓ S to drop down</div>
        <div class="game-touch">
          <button class="btn ghost fun-dpad" data-key="left" type="button" aria-label="Run left">◀</button>
          <button class="btn ghost fun-dpad" data-key="down" type="button" aria-label="Drop down">▼</button>
          <button class="btn ghost fun-dpad" data-key="right" type="button" aria-label="Run right">▶</button>
          <button class="btn" data-key="jump" type="button" aria-label="Jump">JUMP</button>
        </div>
      </div>
    </section>`;

    const tagOverlay = document.getElementById("tagOverlay");
    const tagCanvas = document.getElementById("tagCanvas");
    const tagCtx = tagCanvas.getContext("2d");
    const tagPanel = document.getElementById("tagPanel");
    const tagPanelTitle = document.getElementById("tagPanelTitle");
    const tagPanelText = document.getElementById("tagPanelText");
    const tagPlayBtn = document.getElementById("tagPlayBtn");
    const tagTimerEl = document.getElementById("tagTimer");
    const tagRobotsEl = document.getElementById("tagRobots");
    const tagSpeedEl = document.getElementById("tagSpeed");

    // the world is bigger than the screen; it's drawn zoomed out so lots of platforms fit
    const TW = 1280, TH = 720, VIEW_W = 960, VIEW_H = 540, ZOOM = VIEW_W / TW;
    const TAG_SECONDS = 180;
    const GRAVITY = 1800;
    const PLAYER_SPEED = 270;
    const ROBOT_SPEED = 150;      // at the start; grows to ×1.9 by the end
    const NEW_ROBOT_EVERY = 60;   // seconds
    const MAX_ROBOTS = 3;

    // solid blocks: you can't pass through them (and can wall-jump off their sides)
    const SOLIDS = [
      { x: 0, y: 690, w: 1280, h: 30 },
      { x: 300, y: 620, w: 18, h: 70 },
      { x: 962, y: 620, w: 18, h: 70 },
      { x: 631, y: 220, w: 18, h: 90 }
    ];
    // thin platforms: jump up through them from below, press down to drop through
    // (rows are 95 apart, so a robot's single jump can always reach the next row up)
    const PLATFORMS = [
      { x: 60, y: 595, w: 180 }, { x: 360, y: 595, w: 170 }, { x: 750, y: 595, w: 170 }, { x: 1040, y: 595, w: 180 },
      { x: 0, y: 500, w: 100 }, { x: 220, y: 500, w: 160 }, { x: 560, y: 500, w: 160 }, { x: 900, y: 500, w: 160 }, { x: 1180, y: 500, w: 100 },
      { x: 80, y: 405, w: 170 }, { x: 380, y: 405, w: 150 }, { x: 750, y: 405, w: 150 }, { x: 1030, y: 405, w: 170 },
      { x: 0, y: 310, w: 110 }, { x: 230, y: 310, w: 150 }, { x: 565, y: 310, w: 150 }, { x: 900, y: 310, w: 150 }, { x: 1170, y: 310, w: 110 },
      { x: 90, y: 215, w: 160 }, { x: 380, y: 215, w: 160 }, { x: 740, y: 215, w: 160 }, { x: 1030, y: 215, w: 160 },
      { x: 230, y: 120, w: 140 }, { x: 570, y: 120, w: 140 }, { x: 910, y: 120, w: 140 },
      { x: 410, y: 40, w: 140 }, { x: 730, y: 40, w: 140 }
    ];

    let tagOpen = false, tagRunning = false;
    let tagTime = 0, tagCountdown = 0, tagLast = 0, tagFrame = 0;
    let player = null, robots = [];
    let tagFlash = { text: "", t: 0 };
    const tagKeys = { left: false, right: false, down: false, jump: false };
    let jumpQueued = false;
    const fx = Fun.pops();
    let frameDt = 1 / 60, phewT = 0, chatT = 5, warned = false;
    // a comic word just above a body
    function popOver(b, text, colour, size){ const [x, y] = proj(b.x + b.w / 2, b.y - 12, ACTOR_Z0); fx.pop(text, x, y, colour, size || 30); }

    function makeBody(x, y, w, h){
      return { x, y, w, h, vx: 0, vy: 0, onGround: false, on: null, wallL: false, wallR: false, dropT: 0 };
    }
    function overlap(a, b){
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }
    function approach(v, target, step){ return v < target ? Math.min(v + step, target) : Math.max(v - step, target); }

    function moveBody(b, dt){
      b.vy = Math.min(b.vy + GRAVITY * dt, 950);
      b.dropT = Math.max(0, b.dropT - dt);

      b.x += b.vx * dt;
      if (b.x < 0) { b.x = 0; b.vx = 0; }
      if (b.x + b.w > TW) { b.x = TW - b.w; b.vx = 0; }
      SOLIDS.forEach(s => {
        if (!overlap(b, s)) return;
        if (b.x + b.w / 2 < s.x + s.w / 2) b.x = s.x - b.w; else b.x = s.x + s.w;
        b.vx = 0;
      });

      const prevBottom = b.y + b.h;
      b.y += b.vy * dt;
      b.onGround = false; b.on = null;
      SOLIDS.forEach(s => {
        if (!overlap(b, s)) return;
        if (b.vy > 0) { b.y = s.y - b.h; b.onGround = true; b.on = s; } else { b.y = s.y + s.h; }
        b.vy = 0;
      });
      if (b.vy >= 0 && b.dropT <= 0) {
        PLATFORMS.forEach(p => {
          if (b.x + b.w <= p.x || b.x >= p.x + p.w) return;
          if (prevBottom <= p.y + 0.5 && b.y + b.h >= p.y) {
            b.y = p.y - b.h; b.vy = 0; b.onGround = true; b.on = p;
          }
        });
      }
      if (b.y < 0) { b.y = 0; b.vy = 0; }

      // touching a wall on either side? (used for wall jumps)
      const touches = side => SOLIDS.some(s => {
        if (b.y + b.h <= s.y || b.y >= s.y + s.h) return false;
        return side < 0 ? Math.abs(b.x - (s.x + s.w)) < 1 : Math.abs(b.x + b.w - s.x) < 1;
      });
      b.wallL = b.x <= 0.5 || touches(-1);
      b.wallR = b.x + b.w >= TW - 0.5 || touches(1);
    }

    function speedMult(){ return 1 + 0.9 * Math.min(tagTime, TAG_SECONDS) / TAG_SECONDS; }

    function spawnRobot(){
      // drop in on the side far away from you
      const left = player.x > TW / 2;
      const r = makeBody(left ? 20 : TW - 46, 20, 26, 30);
      r.jumpCd = 0; r.stuckT = 0; r.lastX = r.x; r.hue = [0, 200, 120, 280, 40][robots.length % 5];
      robots.push(r);
    }

    function resetTag(){
      player = makeBody(TW / 2 - 11, SOLIDS[0].y - 40, 22, 30);
      player.jumps = 1; player.coyote = 0; player.wallLock = 0; player.face = 1; player.lastSpot = null;
      robots = [];
      tagTime = 0;
      // the first robot starts up on the far left ledge
      spawnRobot();
      robots[0].x = 20; robots[0].y = 470;
      tagFlash = { text: "", t: 0 };
      fx.clear(); phewT = 0; chatT = 5; warned = false;
    }

    function updatePlayer(dt){
      const p = player;
      Fun.stickKeys(stick, tagKeys, { left: "left", right: "right", down: "down" });
      const input = (tagKeys.right ? 1 : 0) - (tagKeys.left ? 1 : 0);
      if (input) p.face = input;
      p.wallLock = Math.max(0, p.wallLock - dt);
      if (p.wallLock <= 0) p.vx = approach(p.vx, input * PLAYER_SPEED, (p.onGround ? 2600 : 1700) * dt);
      if (p.onGround) { p.coyote = 0.08; p.jumps = 1; } else p.coyote = Math.max(0, p.coyote - dt);

      if (jumpQueued) {
        jumpQueued = false;
        if (p.onGround || p.coyote > 0) { p.vy = -640; p.coyote = 0; p.squash = 0.75; Fun.sfx.pop(); }
        else if (p.wallL || p.wallR) {
          // wall jump: kick off the wall, away from it
          p.vy = -600; p.vx = (p.wallL ? 1 : -1) * 340; p.wallLock = 0.16; p.jumps = 1;
          popOver(p, "WALL JUMP!", "#7fe3ff", 26); Fun.sfx.boing();
        }
        else if (p.jumps > 0) { p.vy = -560; p.jumps = 0; p.squash = 0.8; popOver(p, "Double!", "#ffe14d", 24); Fun.sfx.boing(); }
      }
      if (!tagKeys.jump && p.vy < -200) p.vy = -200; // let go early for a small hop
      if (tagKeys.down && p.on && !SOLIDS.includes(p.on)) p.dropT = 0.25;
      if (p.onGround) p.lastSpot = spotAt(p.on, p.x + p.w / 2);

      // slide slowly down walls you're pushing into
      if (!p.onGround && p.vy > 120 && ((p.wallL && input < 0) || (p.wallR && input > 0))) p.vy = 120;
      const wasGround = p.onGround, fall = p.vy;
      moveBody(p, dt);
      if (!wasGround && p.onGround && fall > 380) {
        p.squash = 1.4;
        const [x, y] = proj(p.x + p.w / 2, p.y + p.h, ACTOR_Z0);
        fx.burst(x, y, "rgba(255,230,190,0.9)", 8, 90, 60);
      }
      p.squash = (p.squash || 1) + (1 - (p.squash || 1)) * Math.min(1, dt * 12);
      p.scared = Math.max(0, (p.scared || 0) - dt);
    }

    /* ----- robot brain: a map of every jump and drop a robot can make ----- */
    const RW = 26, RH = 30;
    // every place you can stand; a pillar standing on a floor cuts it into two pieces
    const SPOTS = [];
    [...SOLIDS, ...PLATFORMS].forEach(s => {
      let pieces = [[s.x, s.x + s.w]];
      SOLIDS.forEach(b => {
        if (b === s || Math.abs(b.y + b.h - s.y) > 1) return;
        pieces = pieces.flatMap(([a, z]) => [[a, Math.min(z, b.x)], [Math.max(a, b.x + b.w), z]]).filter(([a, z]) => z > a);
      });
      pieces.forEach(([a, z]) => SPOTS.push({ x: a, y: s.y, w: z - a, base: s }));
    });
    // which piece of this platform or block is x on?
    function spotAt(surface, x){
      let best = null, bestD = Infinity;
      SPOTS.forEach(p => {
        if (p.base !== surface) return;
        const d = Math.max(0, p.x - x, x - p.x - p.w);
        if (d < bestD) { bestD = d; best = p; }
      });
      return best;
    }

    // try one move in a pretend world and see which surface the robot lands on
    function tryMove(from, sx, kind, tx, speed){
      const b = makeBody(sx - RW / 2, from.y - RH, RW, RH);
      if (SOLIDS.some(s => overlap(b, s))) return null; // can't start inside a wall
      b.onGround = true; b.on = from.base;
      if (kind === "jump") b.vy = -660;
      if (kind === "drop") b.dropT = 0.3;
      for (let t = 0; t < 2.5; t += 1 / 60) {
        const cx = b.x + RW / 2;
        const dir = Math.abs(tx - cx) < 4 ? 0 : Math.sign(tx - cx);
        b.vx = approach(b.vx, dir * speed, 2000 / 60);
        moveBody(b, 1 / 60);
        if (!b.onGround) continue;
        const to = spotAt(b.on, b.x + RW / 2);
        if (to !== from) return { to, lx: b.x + RW / 2 };
        if (kind === "jump") return null; // landed back where it started
      }
      return null;
    }

    function buildRobotMoves(){
      const moves = new Map(SPOTS.map(s => [s, []]));
      const seen = new Set();
      const add = (from, sx, kind, tx) => {
        const slow = tryMove(from, sx, kind, tx, ROBOT_SPEED);
        const fast = tryMove(from, sx, kind, tx, ROBOT_SPEED * 1.9);
        // only keep moves that work at every robot speed
        if (!slow || !fast || slow.to !== fast.to) return;
        const key = [SPOTS.indexOf(from), SPOTS.indexOf(slow.to), kind, Math.round(sx / 24), Math.sign(tx - sx)].join();
        const old = seen.has(key) && moves.get(from).find(m => m.key === key);
        if (old && Math.abs(old.tx - old.sx) <= Math.abs(tx - sx)) return;
        if (old) moves.get(from).splice(moves.get(from).indexOf(old), 1);
        seen.add(key);
        moves.get(from).push({ key, kind, sx, tx, to: slow.to, lx: slow.lx });
      };
      SPOTS.forEach(from => {
        const edge = Math.min(RW / 2 + 1, from.w / 2); // skinny pillars: stand in the middle
        const lo = from.x + edge, hi = from.x + from.w - edge;
        for (let sx = lo; sx <= hi + 0.1; sx += Math.max(1, Math.min(24, (hi - lo) / 2))) {
          for (let off = -160; off <= 160; off += 20) {
            const tx = Math.min(TW - RW / 2, Math.max(RW / 2, sx + off));
            add(from, sx, "jump", tx);
            if (!SOLIDS.includes(from.base)) add(from, sx, "drop", tx);
          }
        }
        // walk right off either end
        for (let off = 10; off <= 150; off += 20) {
          add(from, lo, "walk", Math.max(RW / 2, from.x - RW / 2 - off));
          add(from, hi, "walk", Math.min(TW - RW / 2, from.x + from.w + RW / 2 + off));
        }
      });
      return moves;
    }
    const ROBOT_MOVES = buildRobotMoves();

    // the spot you're standing on, or the one you'll land on if you're in the air.
    // While you're jumping up from a ledge it's still that ledge, so hopping about doesn't fool the robots.
    function spotUnder(b){
      const cx = b.x + b.w / 2, feet = b.y + b.h;
      if (b.onGround) return spotAt(b.on, cx);
      const ledge = b.lastSpot;
      if (ledge && feet <= ledge.y + 4 && cx >= ledge.x - 40 && cx <= ledge.x + ledge.w + 40) return ledge;
      let best = null;
      SPOTS.forEach(s => {
        if (cx < s.x || cx > s.x + s.w || s.y < feet - 1) return;
        if (!best || s.y < best.y) best = s;
      });
      return best;
    }

    // shortest chain of moves from where the robot stands to you (at gx on goal); returns the first move.
    // Moves other robots are already making cost extra, so they come at you different ways.
    function planRoute(from, x, goal, gx, taken){
      const done = new Set(), cost = new Map([[from, 0]]), at = new Map([[from, x]]), first = new Map([[from, null]]);
      while (true) {
        let s = null;
        cost.forEach((c, k) => { if (!done.has(k) && (s === null || c < cost.get(s))) s = k; });
        if (s === null) return null;
        if (s === goal) return first.get(s);
        done.add(s);
        ROBOT_MOVES.get(s).forEach(m => {
          const c = cost.get(s) + Math.abs(at.get(s) - m.sx) + 60 + (m.to === goal ? Math.abs(m.lx - gx) : 0)
            + (s === from && taken.has(m) ? 150 : 0);
          if (done.has(m.to) || (cost.has(m.to) && cost.get(m.to) <= c)) return;
          cost.set(m.to, c); at.set(m.to, m.lx); first.set(m.to, first.get(s) || m);
        });
      }
    }

    function updateRobot(r, dt){
      const speed = ROBOT_SPEED * speedMult();
      const rx = r.x + r.w / 2;
      // aim a little ahead of where you're running, not just where you are right now
      const px = Math.min(TW, Math.max(0, player.x + player.w / 2 + player.vx * 0.25));
      let targetX = px, wantJump = false, chasing = true;
      r.jumpCd = Math.max(0, r.jumpCd - dt);

      if (r.onGround) {
        const here = spotAt(r.on, rx), goal = spotUnder(player);
        const taken = new Set(robots.filter(o => o !== r && o.move).map(o => o.move));
        r.move = goal && goal !== here ? planRoute(here, rx, goal, px, taken) : null;
        const m = r.move;
        if (m) {
          chasing = false;
          targetX = m.kind === "walk" ? m.tx : m.sx;
          if (m.kind !== "walk" && Math.abs(rx - m.sx) < 6) {
            // standing on the take-off spot: go!
            if (m.kind === "drop") { r.dropT = 0.3; r.vx = 0; targetX = m.tx; }
            else if (r.jumpCd <= 0) { r.vy = -660; r.vx = 0; r.jumpCd = 0.35; targetX = m.tx; }
          }
        } else if (goal === here && player.y + player.h < r.y + r.h - 40 && Math.abs(px - rx) < 50) {
          wantJump = true; // you jumped right above it
        }
      } else if (r.move) {
        chasing = false;
        targetX = r.move.tx; // in the air: steer to where the move lands
      }

      const dir = Math.abs(targetX - rx) < 4 ? 0 : Math.sign(targetX - rx);
      r.vx = approach(r.vx, dir * speed, 2000 * dt);
      if (chasing && r.onGround && ((dir < 0 && r.wallL) || (dir > 0 && r.wallR))) wantJump = true;

      // stuck in one spot for a while? hop!
      if (Math.abs(r.x - r.lastX) < 1.5 && r.onGround) r.stuckT += dt; else r.stuckT = 0;
      r.lastX = r.x;
      if (r.stuckT > 1.2 && Math.abs(px - rx) > 20) { wantJump = true; r.stuckT = 0; }

      if (wantJump && r.onGround && r.jumpCd <= 0) { r.vy = -660; r.jumpCd = 0.35; }
      moveBody(r, dt);
    }

    // does the straight line from (ax, ay) to (bx, by) pass through this box?
    function lineHitsBox(ax, ay, bx, by, r){
      let t0 = 0, t1 = 1;
      const dx = bx - ax, dy = by - ay;
      for (const [p, q] of [[-dx, ax - r.x], [dx, r.x + r.w - ax], [-dy, ay - r.y], [dy, r.y + r.h - ay]]) {
        if (p === 0) { if (q < 0) return false; continue; }
        const t = q / p;
        if (p < 0) { if (t > t1) return false; t0 = Math.max(t0, t); }
        else { if (t < t0) return false; t1 = Math.min(t1, t); }
      }
      return true;
    }
    // platforms are drawn 12px thick, so they count as walls too
    const TAG_WALLS = [...SOLIDS, ...PLATFORMS.map(p => ({ x: p.x, y: p.y, w: p.w, h: 12 }))];
    function wallBetween(a, b){
      const ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
      // squeezing through a platform counts as being behind it
      return TAG_WALLS.some(w => lineHitsBox(ax, ay, bx, by, w) || overlap(a, w) || overlap(b, w));
    }

    function tagStep(dt){
      if (tagCountdown > 0) { tagCountdown -= dt; if (tagCountdown <= 0) { popOver(player, "RUN!", "#7bd68a", 40); Fun.sfx.beep(); } return; }
      tagTime += dt;
      const wanted = Math.min(MAX_ROBOTS, 1 + Math.floor(tagTime / NEW_ROBOT_EVERY));
      if (robots.length < wanted) { spawnRobot(); tagFlash = { text: "⚠ A new robot joined!", t: 2 }; popOver(robots[robots.length - 1], "I'm here! 🤖", "#ff9a9a", 24); Fun.sfx.beep(); }
      if (!warned && TAG_SECONDS - tagTime <= 30) { warned = true; popOver(player, "30 seconds left!", "#ffe14d", 28); Fun.sfx.ding(); }
      // the robots chat a bit while they chase you
      chatT -= dt; phewT = Math.max(0, phewT - dt);
      if (chatT <= 0) {
        chatT = 6 + Math.random() * 6;
        const r = robots[Math.floor(Math.random() * robots.length)];
        popOver(r, ["BEEP BOOP!", "Tag time!", "Come back!", "I'm SO fast!", "Zzzt!", "Wait for me!"][Math.floor(Math.random() * 6)], "#ffffff", 22);
      }
      if (tagFlash.t > 0) tagFlash.t -= dt;
      updatePlayer(dt);
      robots.forEach(r => updateRobot(r, dt));
      const shrunk = { x: player.x + 3, y: player.y + 3, w: player.w - 6, h: player.h - 6 };
      // a robot can't tag you through a wall or from under a platform
      if (robots.some(r => overlap(shrunk, r) && !wallBetween(player, r))) { endTag(false); return; }
      // a robot zoomed right past you
      const close = robots.some(r => Math.hypot(r.x - player.x, r.y - player.y) < 52);
      if (close) player.scared = 0.6;
      if (close && phewT <= 0) { phewT = 5; popOver(player, "Phew!", "#ffffff", 24); }
      if (tagTime >= TAG_SECONDS) endTag(true);
    }

    /* ----- 3D drawing: a simple perspective camera ----- */
    const EYE_X = TW / 2, EYE_Y = 253;  // where the vanishing point sits
    const FOCAL = 600, WORLD_DEPTH = 70, ACTOR_Z0 = 22, ACTOR_Z1 = 48;
    const BLOCK_COLOURS = { front: "#1d2b44", top: "#46638f", side: "#14203a", bottom: "#0f1830", edge: "#ffb15c" };
    function proj(x, y, z){
      const k = FOCAL / (FOCAL + z);
      return [EYE_X + (x - EYE_X) * k, EYE_Y + (y - EYE_Y) * k];
    }
    function eyeDist(b){ return Math.hypot(b.x + b.w / 2 - EYE_X, b.y + b.h / 2 - EYE_Y); }
    function quad(ctx, pts, fill){
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    }
    // a box: front face at z0, back face at z1; only the faces you can see get drawn
    function drawBox(ctx, x, y, w, h, z0, z1, c){
      const f = (px, py) => proj(px, py, z0), k = (px, py) => proj(px, py, z1);
      if (y > EYE_Y) quad(ctx, [f(x, y), f(x + w, y), k(x + w, y), k(x, y)], c.top);
      if (y + h < EYE_Y) quad(ctx, [f(x, y + h), f(x + w, y + h), k(x + w, y + h), k(x, y + h)], c.bottom);
      if (x > EYE_X) quad(ctx, [f(x, y), f(x, y + h), k(x, y + h), k(x, y)], c.side);
      if (x + w < EYE_X) quad(ctx, [f(x + w, y), f(x + w, y + h), k(x + w, y + h), k(x + w, y)], c.side);
      quad(ctx, [f(x, y), f(x + w, y), f(x + w, y + h), f(x, y + h)], c.front);
      if (c.edge) quad(ctx, [f(x, y), f(x + w, y), f(x + w, y + 3), f(x, y + 3)], c.edge);
    }
    // draw flat 2D art on an actor's front face, scaled to its depth
    function onFront(ctx, draw){
      const k = FOCAL / (FOCAL + ACTOR_Z0);
      ctx.save();
      ctx.translate(EYE_X, EYE_Y); ctx.scale(k, k); ctx.translate(-EYE_X, -EYE_Y);
      draw();
      ctx.restore();
    }
    function drawShadow(ctx, b){
      // find the floor right under this body
      const feet = b.y + b.h;
      let floorY = TH;
      [...SOLIDS, ...PLATFORMS].forEach(s => {
        if (b.x + b.w <= s.x || b.x >= s.x + s.w) return;
        if (s.y >= feet - 1 && s.y < floorY) floorY = s.y;
      });
      if (floorY >= TH) return;
      const fade = Math.max(0.12, 0.45 - (floorY - feet) / 600);
      const [cx, cy] = proj(b.x + b.w / 2, floorY, (ACTOR_Z0 + ACTOR_Z1) / 2);
      ctx.fillStyle = `rgba(0,0,0,${fade})`;
      ctx.beginPath(); ctx.ellipse(cx, cy, b.w * 0.75, 5, 0, 0, Math.PI * 2); ctx.fill();
    }
    function drawRobot(ctx, r){
      const hue = r.hue, Z0 = ACTOR_Z0, Z1 = ACTOR_Z1;
      const col = l => `hsl(${hue} 18% ${l}%)`;
      const look = player.x + player.w / 2 > r.x + r.w / 2 ? 1 : -1;
      const roll = (r.x / 6) % (Math.PI * 2);
      // a wheel underneath
      drawBox(ctx, r.x + 3, r.y + r.h - 7, r.w - 6, 7, Z0 + 4, Z1 - 4, { front: "#2a2e3a", top: "#3a3f4f", side: "#1c1f28", bottom: "#111" });
      // the body, and a head with a visor
      drawBox(ctx, r.x, r.y + 11, r.w, r.h - 18, Z0, Z1, { front: col(68), top: col(84), side: col(48), bottom: col(38) });
      drawBox(ctx, r.x + 3, r.y, r.w - 6, 11, Z0 + 2, Z1 - 2, { front: col(76), top: col(88), side: col(54), bottom: col(44) });
      // an arm reaching for you
      const reach = Math.abs(player.x - r.x) < 150 ? 7 : 2;
      drawBox(ctx, look > 0 ? r.x + r.w : r.x - reach, r.y + 14 + Math.sin(tagFrame * 0.3) * 1.5, reach, 4, Z0 + 8, Z1 - 8, { front: col(58), top: col(76), side: col(44), bottom: col(34) });
      onFront(ctx, () => {
        const cx = r.x + r.w / 2;
        ctx.fillStyle = "#1b1f2a"; ctx.fillRect(r.x + 5, r.y + 2.5, r.w - 10, 6);
        ctx.fillStyle = (tagFrame >> 3) % 2 ? "#ff3b3b" : "#ff7a7a";
        const ex = look * 1.5;
        ctx.fillRect(cx - 6 + ex, r.y + 4, 4, 3); ctx.fillRect(cx + 2 + ex, r.y + 4, 4, 3);
        // grumpy eyebrows
        ctx.strokeStyle = "#ff3b3b"; ctx.lineWidth = 1.4; ctx.beginPath();
        ctx.moveTo(cx - 7 + ex, r.y + 1.5); ctx.lineTo(cx - 2 + ex, r.y + 3.5); ctx.moveTo(cx + 7 + ex, r.y + 1.5); ctx.lineTo(cx + 2 + ex, r.y + 3.5); ctx.stroke();
        // a grill mouth on the belly, a bolt, and the wheel's spokes
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        for (let i = 0; i < 4; i++) ctx.fillRect(r.x + 6 + i * 4, r.y + 16, 2, 5);
        ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1.2; ctx.beginPath();
        for (let i = 0; i < 3; i++) { const a = roll + i * 2.09; ctx.moveTo(cx, r.y + r.h - 3.5); ctx.lineTo(cx + Math.cos(a) * 3.5, r.y + r.h - 3.5 + Math.sin(a) * 3.5); }
        ctx.stroke();
        // the antenna, with a blinking light
        ctx.strokeStyle = "#1b1f2a"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx, r.y); ctx.lineTo(cx + Math.sin(tagFrame * 0.2) * 2, r.y - 7); ctx.stroke();
        ctx.fillStyle = (tagFrame >> 4) % 2 ? "#ffe14d" : "#ff3b3b";
        ctx.beginPath(); ctx.arc(cx + Math.sin(tagFrame * 0.2) * 2, r.y - 8, 3, 0, Math.PI * 2); ctx.fill();
      });
    }
    function drawPlayer(ctx, p){
      const Z0 = ACTOR_Z0, Z1 = ACTOR_Z1;
      const sq = p.squash || 1, feet = p.y + p.h, cx = p.x + p.w / 2;
      const running = p.onGround && Math.abs(p.vx) > 30;
      const ph = running ? tagFrame * 0.45 : 0;
      const H = p.h / sq, k = H / 30, W = p.w * Math.min(1.25, sq);
      const legH = 7 * k, bodyH = 9 * k, headH = 14 * k;
      const yLeg = feet - legH, yBody = yLeg - bodyH, yHead = yBody - headH;
      const air = !p.onGround;
      // legs (they run), arms (they swing), a red shirt, and a big yellow head
      const lift = i => running ? Math.max(0, Math.sin(ph + i * Math.PI)) * 3 : air ? (i ? 2 : 0) : 0;
      [0, 1].forEach(i => drawBox(ctx, cx - 7 + i * 8, yLeg - lift(i), 6, legH, Z0 + 6, Z1 - 6, { front: "#2b4fd6", top: "#4a6cf0", side: "#1d379c", bottom: "#142a78" }));
      drawBox(ctx, cx - W * 0.36, yBody, W * 0.72, bodyH, Z0 + 3, Z1 - 3, { front: "#ff3b2f", top: "#ff7a6f", side: "#c4241a", bottom: "#8e1a12" });
      const swing = running ? Math.sin(ph) * 3 : air ? -4 : 0;
      drawBox(ctx, cx - W * 0.36 - 4, yBody + 1 + swing, 4, 8 * k, Z0 + 8, Z1 - 8, { front: "#ffd400", top: "#fff07a", side: "#c9a400", bottom: "#9c7f00" });
      drawBox(ctx, cx + W * 0.36, yBody + 1 - swing, 4, 8 * k, Z0 + 8, Z1 - 8, { front: "#ffd400", top: "#fff07a", side: "#c9a400", bottom: "#9c7f00" });
      drawBox(ctx, cx - W / 2, yHead, W, headH, Z0, Z1, { front: "#ffd400", top: "#fff07a", side: "#c9a400", bottom: "#9c7f00" });
      onFront(ctx, () => {
        ctx.strokeStyle = "#3a2a00"; ctx.lineWidth = 1.5; ctx.strokeRect(cx - W / 2, yHead, W, headH);
        ctx.fillStyle = "#ff3b2f"; ctx.fillRect(cx - W / 2 - 1, yHead + 1, W + 2, 3.5); // headband
        // the headband's ends flap behind you
        ctx.beginPath(); const bx = cx - p.face * (W / 2), fl = Math.sin(tagFrame * 0.5) * 2;
        ctx.moveTo(bx, yHead + 2); ctx.lineTo(bx - p.face * 8, yHead + fl); ctx.lineTo(bx - p.face * 7, yHead + 5 + fl); ctx.closePath(); ctx.fill();
        const mood = p.tagged ? "dizzy" : air ? "wow" : p.scared > 0 ? "sad" : "happy";
        Fun.face(ctx, cx + p.face * 2, yHead + 8.5 * k, 6.5 * k, mood, tagFrame / 60, p.face * 0.7, air ? -0.3 : 0);
      });
    }
    // the game fills the screen now, so draw it at the real size to keep it sharp
    let tagScale = 1;
    function fitTagCanvas(){
      const s = Fun.res(tagCanvas.clientWidth, VIEW_W, 3);
      if (Math.abs(s - tagScale) < 0.01) return;
      tagScale = s;
      tagCanvas.width = Math.round(VIEW_W * s); tagCanvas.height = Math.round(VIEW_H * s);
    }
    function drawTag(){
      const ctx = tagCtx;
      fitTagCanvas();
      ctx.setTransform(tagScale * ZOOM, 0, 0, tagScale * ZOOM, 0, 0);
      const sky = ctx.createLinearGradient(0, 0, 0, TH);
      sky.addColorStop(0, "#2f6fd6"); sky.addColorStop(0.55, "#6fa3e6"); sky.addColorStop(1, "#ff9a3c");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, TW, TH);
      // big orange sun and a few clouds
      const sun = ctx.createRadialGradient(1067, 560, 13, 1067, 560, 200);
      sun.addColorStop(0, "rgba(255,190,90,0.95)"); sun.addColorStop(1, "rgba(255,150,60,0)");
      ctx.fillStyle = sun; ctx.fillRect(800, 333, 480, 387);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      [[160, 90], [930, 70], [440, 270], [1150, 180]].forEach(([cx, cy]) => {
        ctx.beginPath(); ctx.ellipse(cx, cy, 66, 18, 0, 0, Math.PI * 2); ctx.ellipse(cx + 40, cy - 10, 40, 16, 0, 0, Math.PI * 2); ctx.fill();
      });

      // 3D world: every thing is a box with depth, seen from a camera in front
      const ground = SOLIDS[0];
      ctx.strokeStyle = "rgba(255,177,92,0.35)"; ctx.lineWidth = 1;
      const boxes = [
        ...PLATFORMS.map(p => ({ x: p.x, y: p.y, w: p.w, h: 12, kind: "plat" })),
        ...SOLIDS.map(s => ({ x: s.x, y: s.y, w: s.w, h: s.h, kind: "solid" }))
      ];
      // draw boxes farthest from the eye first, so the nearer ones cover them
      boxes.sort((m, n) => eyeDist(n) - eyeDist(m));
      boxes.forEach(bx => drawBox(ctx, bx.x, bx.y, bx.w, bx.h, 0, WORLD_DEPTH, BLOCK_COLOURS));
      // lane lines on the ground, running away from you
      for (let gx = 0; gx <= TW; gx += 64) {
        const [x0, y0] = proj(gx, ground.y, 0), [x1, y1] = proj(gx, ground.y, WORLD_DEPTH);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }

      const actors = [...robots.map(r => ({ b: r, robot: true })), { b: player, robot: false }];
      actors.forEach(a => drawShadow(ctx, a.b));
      actors.sort((m, n) => eyeDist(n.b) - eyeDist(m.b));
      // drawn a bit bigger than they really are, so you can see their faces (standing on the same spot)
      actors.forEach(a => {
        const [fx0, fy0] = proj(a.b.x + a.b.w / 2, a.b.y + a.b.h, ACTOR_Z0);
        ctx.save(); ctx.translate(fx0, fy0); ctx.scale(1.35, 1.35); ctx.translate(-fx0, -fy0);
        if (a.robot) drawRobot(ctx, a.b); else drawPlayer(ctx, a.b);
        ctx.restore();
      });

      if (tagCountdown > 0) {
        ctx.fillStyle = "#fff"; ctx.font = "800 120px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center";
        ctx.fillText(String(Math.ceil(tagCountdown)), TW / 2, TH / 2 - 40);
      }
      fx.draw(ctx, frameDt);
      if (tagFlash.t > 0) {
        ctx.fillStyle = "#fff"; ctx.font = "800 37px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center";
        ctx.fillText(tagFlash.text, TW / 2, 53);
      }
    }

    function updateTagHud(){
      const left = Math.max(0, Math.ceil(TAG_SECONDS - tagTime));
      tagTimerEl.textContent = "⏱ " + Hub.formatTime(left);
      tagTimerEl.classList.toggle("low", left <= 30);
      tagRobotsEl.textContent = "🤖 ×" + robots.length;
      tagSpeedEl.textContent = "Speed ×" + speedMult().toFixed(1);
    }

    function tagLoop(now){
      if (!tagOpen) return;
      const dt = Math.min(1 / 30, (now - tagLast) / 1000 || 0);
      tagLast = now; frameDt = dt;
      tagFrame++;
      if (tagRunning) tagStep(dt);
      drawTag();
      updateTagHud();
      requestAnimationFrame(tagLoop);
    }

    function startTag(){
      resetTag();
      tagCountdown = 3;
      tagRunning = true;
      tagPanel.hidden = true;
      jumpQueued = false;
      Object.keys(tagKeys).forEach(k => { tagKeys[k] = false; });
      tagCanvas.focus();
    }

    function endTag(won){
      tagRunning = false;
      if (won) { popOver(player, "YOU ESCAPED! 🏆", "#ffe14d", 34); Fun.sfx.tada(); }
      else { player.tagged = true; popOver(player, "TAGGED! 😱", "#ff6b6b", 36); Fun.shake(tagCanvas); Fun.sfx.wah(); }
      const secs = Math.floor(tagTime);
      const wasBest = secs > (store.tagBest || 0);
      if (wasBest) store.tagBest = secs;
      Hub.saveStore();
      Hub.checkBadges();
      tagPanelTitle.textContent = won ? "🏆 You escaped!" : "🤖 Tagged!";
      tagPanelText.textContent = won
        ? "You survived all 3 minutes. The robots couldn't catch you!"
        : `You lasted ${Hub.formatTime(secs)}.` + (wasBest ? " That's a new best! 🎉" : ` Your best is ${Hub.formatTime(store.tagBest)}.`);
      tagPlayBtn.textContent = "▶ Play again";
      tagPanel.hidden = false;
      if (won) Hub.confettiBurst(tagPlayBtn);
      tagPlayBtn.focus();
    }

    function openTag(){
      tagOpen = true;
      tagRunning = false;
      resetTag();
      tagOverlay.hidden = false;
      document.body.style.overflow = "hidden";
      tagPanelTitle.textContent = "🏃 Robot Tag";
      tagPanelText.textContent = "The robots want to tag you! Run, jump and wall-jump to stay away for 3 minutes. Every minute another robot joins, and they get faster and faster…"
        + (store.tagBest ? ` Your best: ${Hub.formatTime(store.tagBest)}.` : "");
      tagPlayBtn.textContent = "▶ Play";
      tagPanel.hidden = false;
      tagLast = performance.now();
      requestAnimationFrame(tagLoop);
      tagPlayBtn.focus();
    }

    function closeTag(){
      tagOpen = false;
      tagRunning = false;
      tagOverlay.hidden = true;
      document.body.style.overflow = "";
    }

    const TAG_KEYMAP = {
      ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
      ArrowUp: "jump", KeyW: "jump", Space: "jump", ArrowDown: "down", KeyS: "down"
    };
    function setTagKey(k, down){
      if (k === "jump" && down && !tagKeys.jump) jumpQueued = true;
      tagKeys[k] = down;
    }
    window.addEventListener("keydown", e => {
      if (!tagOpen) return;
      if (e.key === "Escape") { Hub.leave(); return; }
      const k = TAG_KEYMAP[e.code];
      if (!k || !tagRunning) return;
      e.preventDefault();
      setTagKey(k, true);
    });
    window.addEventListener("keyup", e => {
      const k = TAG_KEYMAP[e.code];
      if (k) tagKeys[k] = false;
    });
    host.querySelectorAll(".game-touch [data-key]").forEach(btn => {
      const k = btn.dataset.key;
      btn.addEventListener("pointerdown", e => { e.preventDefault(); setTagKey(k, true); });
      ["pointerup", "pointercancel", "pointerleave"].forEach(ev => btn.addEventListener(ev, () => { tagKeys[k] = false; }));
    });
    tagCanvas.tabIndex = 0;
    const stick = Fun.joystick(tagCanvas.parentElement);   // on phones: run and drop down; the JUMP button stays

    document.getElementById("tagCloseBtn").addEventListener("click", () => Hub.leave());
    Fun.soundButton(document.getElementById("tagCloseBtn"));
    tagPlayBtn.addEventListener("click", startTag);

    return { open: openTag, close: closeTag };
  }
})();
