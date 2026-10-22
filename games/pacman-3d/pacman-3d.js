/* Pac-Man 3D: the same maze, ghosts and dots as Pac-Man, but you play it from inside Pac-Man's own eyes,
   down in the corridors. A little map in the corner shows where everyone is.
   It keeps its own best score (store.pac3dBest). */
(function(){
  "use strict";
  const store = Hub.store;

  Hub.register({
    id: "pacman-3d", section: "games", title: "Pac-Man 3D", icon: "🟡",
    blurb: "Be Pac-Man, deep inside the maze! Gobble the dots before the ghosts find you.",
    stat: () => store.pac3dBest ? "Best: " + store.pac3dBest : "",
    mount
  });

  function mount(host){
    host.innerHTML = `
    <section class="game-screen" id="p3dOverlay" hidden aria-label="Pac-Man 3D">
      <div class="game-box p3d-box">
        <div class="game-hud">
          <h2>🟡 Pac-Man 3D</h2>
          <span class="mono game-stat" id="p3dScore">⭐ 0</span>
          <span class="mono game-stat" id="p3dLives">🟡 ×3</span>
          <span class="mono game-stat" id="p3dLevel">Level 1</span>
          <button class="btn ghost small" id="p3dCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas id="p3dCanvas" width="600" height="480"></canvas>
          <div class="game-panel p3d-panel" id="p3dPanel">
            <div class="game-panel-title" id="p3dPanelTitle">Pac-Man 3D</div>
            <div class="game-panel-text" id="p3dPanelText"></div>
            <button class="btn" id="p3dPlayBtn" type="button">▶ Play</button>
          </div>
        </div>
        <div class="game-help">You're inside Pac-Man! ← → to turn at the next corner · ↑ go ahead · ↓ turn around · eat a big dot, then chase the blue ghosts!</div>
        <div class="p3d-pad fun-dpad">
          <button class="btn ghost" data-dir="up" type="button" aria-label="Up">▲</button>
          <button class="btn ghost" data-dir="left" type="button" aria-label="Left">◀</button>
          <button class="btn ghost" data-dir="down" type="button" aria-label="Down">▼</button>
          <button class="btn ghost" data-dir="right" type="button" aria-label="Right">▶</button>
        </div>
      </div>
    </section>`;

    function choice(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

    const pacOverlay = document.getElementById("p3dOverlay");
    const pacCanvas = document.getElementById("p3dCanvas");
    const pacCtx = pacCanvas.getContext("2d");
    const pacPanel = document.getElementById("p3dPanel");
    const pacPanelTitle = document.getElementById("p3dPanelTitle");
    const pacPanelText = document.getElementById("p3dPanelText");
    const pacPlayBtn = document.getElementById("p3dPlayBtn");
    const pacScoreEl = document.getElementById("p3dScore");
    const pacLivesEl = document.getElementById("p3dLives");
    const pacLevelEl = document.getElementById("p3dLevel");

    // # wall · . dot · o power pellet · - ghost door · space empty (row 9 is the side tunnel)
    const MAZE = [
      "###################",
      "#........#........#",
      "#o##.###.#.###.##o#",
      "#.................#",
      "#.##.#.#####.#.##.#",
      "#....#...#...#....#",
      "####.### # ###.####",
      "   #.#       #.#   ",
      "####.# ##-## #.####",
      "    .  #   #  .    ",
      "####.# ##### #.####",
      "   #.#       #.#   ",
      "####.# ##### #.####",
      "#........#........#",
      "#.##.###.#.###.##.#",
      "#o.#.....P.....#.o#",
      "##.#.#.#####.#.#.##",
      "#....#...#...#....#",
      "#.######.#.######.#",
      "#.................#",
      "###################"
    ];
    const PT = 24, PCOLS = 19, PROWS = 21;
    const DIRS = { up: [0, -1], left: [-1, 0], down: [0, 1], right: [1, 0] };
    const OPPOSITE = { left: "right", right: "left", up: "down", down: "up" };
    const GHOST_HOME = { x: 9, y: 9 }, GHOST_EXIT = { x: 9, y: 7 };
    const GHOSTS = [
      { colour: "#ff3b3b", x: 9,  y: 7, dir: "left",  corner: [18, -2], wait: 0 },
      { colour: "#ffb8de", x: 9,  y: 9, dir: "up",    corner: [0, -2],  wait: 1 },
      { colour: "#3bdcff", x: 8,  y: 9, dir: "right", corner: [18, 22], wait: 5 },
      { colour: "#ffb447", x: 10, y: 9, dir: "left",  corner: [0, 22],  wait: 9 }
    ];

    let pacOpen = false, pacRunning = false, pacLast = 0, pacFrame = 0;
    let dots = [], dotsLeft = 0, pac = null, ghosts = [];
    let pacScore = 0, pacLives = 3, pacLevel = 1;
    let frightT = 0, ghostCombo = 0, modeT = 0, lifeT = 0;
    let pacPause = 0, pacPauseKind = "", tauntT = 4;
    let pacWant = null;

    function isWall(x, y, door){
      if (y < 0 || y >= PROWS) return true;
      const c = MAZE[y][(x + PCOLS) % PCOLS];
      return c === "#" || (c === "-" && !door);
    }
    function stepTile(e, dir){ const [dx, dy] = DIRS[dir]; return [(e.x + dx + PCOLS) % PCOLS, e.y + dy]; }
    function canGo(e, dir, door){
      if (!dir) return false;
      const [nx, ny] = stepTile(e, dir);
      return !isWall(nx, ny, door);
    }
    function centre(e){
      const [dx, dy] = DIRS[e.dir];
      return [(e.x + dx * e.prog + 0.5) * PT, (e.y + dy * e.prog + 0.5) * PT];
    }

    // how many steps from every tile back to the ghost house (for eyes going home)
    const HOME_DIST = (() => {
      const d = MAZE.map(row => [...row].map(() => Infinity));
      const queue = [[GHOST_HOME.x, GHOST_HOME.y]];
      d[GHOST_HOME.y][GHOST_HOME.x] = 0;
      while (queue.length) {
        const [x, y] = queue.shift();
        Object.keys(DIRS).forEach(dir => {
          const [nx, ny] = stepTile({ x, y }, dir);
          if (!isWall(nx, ny, true) && d[ny][nx] === Infinity) { d[ny][nx] = d[y][x] + 1; queue.push([nx, ny]); }
        });
      }
      return d;
    })();

    function levelBoost(){ return 1 + 0.06 * Math.min(pacLevel - 1, 6); }
    function inTunnel(e){ return e.y === 9 && (e.x < 4 || e.x > 14); }

    function resetDots(){
      dots = MAZE.map(row => [...row].map(c => (c === "." || c === "o") ? c : ""));
      dotsLeft = dots.flat().filter(Boolean).length;
    }
    function resetActors(){
      pac = { x: 9, y: 15, dir: "left", prog: 0, stopped: true };
      view.a = DIR_ANGLE.left;
      pacWant = null;
      ghosts = GHOSTS.map(g => ({ ...g, prog: 0, state: g.wait ? "wait" : "free", scared: false }));
      frightT = 0; modeT = 0; lifeT = 0;
      pacPause = 2; pacPauseKind = "ready";
    }

    function eatAt(x, y){
      const c = dots[y] && dots[y][x];
      if (!c) return;
      dots[y][x] = "";
      dotsLeft--;
      if (c === ".") { pacScore += 10; Fun.sfx.waka(); return; }
      pacScore += 50;
      popAt(x + 0.5, y + 0.5, "POWER UP! 💪", "#ffe600", 24); Fun.sfx.zap();
      frightT = Math.max(2, 7 - (pacLevel - 1));
      ghostCombo = 0;
      ghosts.forEach(g => {
        if (g.state === "eyes") return;
        // scared ghosts turn right around
        if (g.state === "free" && !g.scared && g.prog > 0) { [g.x, g.y] = stepTile(g, g.dir); g.dir = OPPOSITE[g.dir]; g.prog = 1 - g.prog; }
        g.scared = true;
        const [gx, gy] = centre(g);
        popAt(gx / PT, gy / PT, "Eek!", "#9fc4ff", 16);
      });
    }

    let stickDir = null;
    function movePac(dt){
      const sd = stick.on && Math.hypot(stick.x, stick.y) > 0.5 ? (Math.abs(stick.x) > Math.abs(stick.y) ? (stick.x > 0 ? "right" : "left") : (stick.y > 0 ? "down" : "up")) : null;
      if (sd && sd !== stickDir) steer(sd);   // like the arrow keys: left, right, ahead, turn around
      stickDir = sd;
      // turning straight around works at any moment
      if (pacWant && pacWant === OPPOSITE[pac.dir] && pac.prog > 0) {
        [pac.x, pac.y] = stepTile(pac, pac.dir); pac.dir = pacWant; pac.prog = 1 - pac.prog;
      }
      let move = 7.5 * levelBoost() * dt;
      while (move > 0) {
        if (pac.prog === 0) {
          eatAt(pac.x, pac.y);
          if (canGo(pac, pacWant)) pac.dir = pacWant;
          // inside the maze, you go round a corner by yourself when there's only one way on
          if (!canGo(pac, pac.dir)) {
            const on = Object.keys(DIRS).filter(d => d !== OPPOSITE[pac.dir] && canGo(pac, d));
            if (on.length === 1) pac.dir = on[0];
          }
          pac.stopped = !canGo(pac, pac.dir);
          if (pac.stopped) return;
        }
        const left = 1 - pac.prog;
        if (move < left) { pac.prog += move; return; }
        move -= left;
        [pac.x, pac.y] = stepTile(pac, pac.dir); pac.prog = 0;
      }
    }

    function ghostTarget(g, i){
      if (g.state === "leave") return [GHOST_EXIT.x, GHOST_EXIT.y];
      if (modeT % 27 < 7) return g.corner; // scatter to their corners for 7s, then chase for 20s
      const [dx, dy] = DIRS[pac.dir];
      if (i === 0) return [pac.x, pac.y];
      if (i === 1) return [pac.x + 4 * dx, pac.y + 4 * dy];
      if (i === 2) { const b = ghosts[0]; return [2 * (pac.x + 2 * dx) - b.x, 2 * (pac.y + 2 * dy) - b.y]; }
      return Math.hypot(pac.x - g.x, pac.y - g.y) > 6 ? [pac.x, pac.y] : g.corner;
    }
    function chooseDir(g, i){
      const door = g.state !== "free";
      const all = Object.keys(DIRS).filter(d => canGo(g, d, door));
      if (g.state === "eyes") {
        return all.reduce((best, d) => {
          const [nx, ny] = stepTile(g, d), [bx, by] = stepTile(g, best);
          return HOME_DIST[ny][nx] < HOME_DIST[by][bx] ? d : best;
        });
      }
      let opts = all.filter(d => d !== OPPOSITE[g.dir]);
      if (!opts.length) opts = all;
      if (g.scared && g.state === "free") return choice(opts);
      const [tx, ty] = ghostTarget(g, i);
      const dist = d => { const [nx, ny] = stepTile(g, d); return (nx - tx) ** 2 + (ny - ty) ** 2; };
      return opts.reduce((best, d) => dist(d) < dist(best) ? d : best);
    }
    function ghostSpeed(g){
      if (g.state === "eyes") return 15;
      if (g.state === "leave" || g.scared) return 3;
      return (inTunnel(g) ? 2.5 : 5) * levelBoost(); // a good bit slower than you (7.5)
    }
    function moveGhost(g, i, dt){
      if (g.state === "wait") {
        if (lifeT < g.wait) return;
        g.state = "leave";
        g.dir = chooseDir(g, i);
      }
      let move = ghostSpeed(g) * dt;
      while (move > 0) {
        const left = 1 - g.prog;
        if (move < left) { g.prog += move; return; }
        move -= left;
        [g.x, g.y] = stepTile(g, g.dir); g.prog = 0;
        if (g.state === "leave" && g.x === GHOST_EXIT.x && g.y === GHOST_EXIT.y) g.state = "free";
        if (g.state === "eyes" && g.x === GHOST_HOME.x && g.y === GHOST_HOME.y) g.state = "leave";
        g.dir = chooseDir(g, i);
      }
    }

    function pacStep(dt){
      if (pacPause > 0) {
        pacPause -= dt;
        if (pacPause > 0) return;
        if (pacPauseKind === "ready") { fx.pop("GO!", CW / 2, CH * 0.5, "#7bd68a", 36); Fun.sfx.beep(); }
        if (pacPauseKind === "dead") {
          pacLives--;
          if (pacLives <= 0) { endPac(); return; }
          resetActors();
        } else if (pacPauseKind === "clear") {
          pacLevel++;
          resetDots();
          resetActors();
        }
        return;
      }
      lifeT += dt;
      if (frightT > 0) {
        frightT -= dt;
        if (frightT <= 0) ghosts.forEach(g => { g.scared = false; });
      } else {
        modeT += dt;
      }
      movePac(dt);
      if (dotsLeft === 0) { pacPause = 2; pacPauseKind = "clear"; fx.pop("LEVEL UP! 🎉", CW / 2, CH * 0.45, "#ffe600", 34); Fun.sfx.tada(); return; }
      // now and then a ghost says something cheeky
      tauntT -= dt;
      if (tauntT <= 0) {
        tauntT = 5 + Math.random() * 5;
        const g = choice(ghosts.filter(x => x.state === "free"));
        if (g) { const [gx, gy] = centre(g); popAt(gx / PT, gy / PT, g.scared ? choice(["Eek!", "Help!", "Mummy!"]) : choice(["Boo!", "Nom nom?", "Gotcha soon!", "Wheee!", "Hehehe"]), "#ffffff", 15); }
      }
      ghosts.forEach((g, i) => moveGhost(g, i, dt));
      const [px, py] = centre(pac);
      for (const g of ghosts) {
        if (g.state === "eyes") continue;
        const [gx, gy] = centre(g);
        if (Math.hypot(gx - px, gy - py) > PT * 0.6) continue;
        if (g.scared) {
          const pts = 200 * 2 ** ghostCombo;
          ghostCombo++;
          pacScore += pts;
          popAt(gx / PT, gy / PT, `+${pts} YUM!`, "#3bdcff", 20); Fun.sfx.chomp();
          g.state = "eyes"; g.scared = false;
          pacPause = 0.4; pacPauseKind = "eat";
        } else {
          pacPause = 1.5; pacPauseKind = "dead";
          popAt(px / PT, py / PT, "OUCH!", "#ff6b6b", 30); Fun.shake(pacCanvas); Fun.sfx.wah();
          return;
        }
      }
    }

    function pausedFor(kind){ return pacPauseKind === kind && pacPause > 0; }
    /* ----- drawing ----- */
    const CW = 600, CH = 480;
    // the last few dots are big, pulse and shine a beam of light, so you can find them
    const LAST_DOTS = 5, lastDots = () => dotsLeft <= LAST_DOTS;
    const pulse = () => 0.5 + 0.5 * Math.sin(pacFrame * 0.18);
    let pacScale = 1;
    function fitPacCanvas(){
      const s = Fun.res(pacCanvas.clientWidth, CW, 3);
      if (Math.abs(s - pacScale) < 0.01) return;
      pacScale = s;
      pacCanvas.width = Math.round(CW * s); pacCanvas.height = Math.round(CH * s);
    }
    const fx = Fun.pops();
    let fxLast = performance.now();
    function drawPac(){
      fitPacCanvas();
      pacCtx.setTransform(pacScale, 0, 0, pacScale, 0, 0);
      drawInside(pacCtx);
      const now = performance.now();
      fx.draw(pacCtx, Math.min(0.05, (now - fxLast) / 1000)); fxLast = now;
      if (pacRunning && pausedFor("ready")) {
        const ctx = pacCtx;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.font = "900 30px 'Bricolage Grotesque', sans-serif"; ctx.lineWidth = 6; ctx.strokeStyle = "#1a1030";
        ctx.strokeText("READY?", CW / 2, CH * 0.5); ctx.fillStyle = "#ffe600"; ctx.fillText("READY?", CW / 2, CH * 0.5);
      }
    }
    /* ----- drawing from inside: you are Pac-Man, looking down the corridors -----
       The walls are found by sending a ray out for every couple of screen columns until it hits a wall
       (the trick the first 3D games used); dots and ghosts are then stood up in front, nearest last. */
    const FOV_F = CW / 2 / Math.tan(0.66), EYE = 0.48, COL = 2;
    const zbuf = new Float32Array(Math.ceil(CW / COL));
    const view = { x: 9.5, z: 15.5, a: Math.PI };
    const DIR_ANGLE = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
    const angleDiff = (a, b) => ((a - b) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    // the wall panels: dark glossy blue tiles with a neon strip along the top, like an arcade
    const WALL_TEX = (() => {
      const c = document.createElement("canvas"); c.width = 64; c.height = 64;
      const g = c.getContext("2d");
      const grad = g.createLinearGradient(0, 0, 0, 64);
      grad.addColorStop(0, "#1b2d8c"); grad.addColorStop(0.5, "#13206a"); grad.addColorStop(1, "#0a1244");
      g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
      g.fillStyle = "#6f9bff"; g.fillRect(0, 2, 64, 3);
      g.fillStyle = "rgba(160,200,255,0.35)"; g.fillRect(0, 5, 64, 2);
      g.strokeStyle = "rgba(0,0,20,0.55)"; g.lineWidth = 1;
      [16, 40].forEach(y => { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(64, y + 0.5); g.stroke(); });
      [0, 32].forEach(x => { g.beginPath(); g.moveTo(x + 0.5, 8); g.lineTo(x + 0.5, 64); g.stroke(); });
      g.fillStyle = "rgba(255,255,255,0.05)"; g.fillRect(2, 18, 28, 20); g.fillRect(34, 42, 28, 20);
      return c;
    })();
    function eyeUpdate(dt){
      // your eyes sit at the back of your round head, so a wall right in front isn't squashed against your nose
      const [cx, cy] = centre(pac);
      view.a += angleDiff(DIR_ANGLE[pac.dir], view.a) * Math.min(1, dt * 11);
      view.x = cx / PT - Math.cos(view.a) * 0.4; view.z = cy / PT - Math.sin(view.a) * 0.4;
    }
    // a spot in the maze, seen from your eyes: [screen x, distance], or null when it's behind you
    function eyeSpace(x, z){
      const dx = x - view.x, dz = z - view.z, c = Math.cos(view.a), s = Math.sin(view.a);
      const fwd = dx * c + dz * s, side = -dx * s + dz * c;
      if (fwd < 0.08) return null;
      return [CW / 2 + side / fwd * FOV_F, fwd];
    }
    const groundY = (y, d) => CH / 2 + (EYE - y) * FOV_F / d;
    const fog = d => Math.min(0.92, d / 14);
    function drawInside(ctx){
      const flash = pausedFor("clear") && (pacFrame >> 3) % 2;
      // ceiling and floor, both fading into the dark far away
      let g = ctx.createLinearGradient(0, 0, 0, CH / 2);
      g.addColorStop(0, "#0b0f2e"); g.addColorStop(1, "#010106");
      ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH / 2);
      g = ctx.createLinearGradient(0, CH / 2, 0, CH);
      g.addColorStop(0, "#010106"); g.addColorStop(0.5, "#0a0d24"); g.addColorStop(1, "#1a1f48");
      ctx.fillStyle = g; ctx.fillRect(0, CH / 2, CW, CH / 2);
      // floor tiles: lines along the floor going away from you
      ctx.strokeStyle = "rgba(90,120,255,0.07)"; ctx.lineWidth = 1; ctx.beginPath();
      const c = Math.cos(view.a), s = Math.sin(view.a);
      for (let k = 1; k <= 12; k++) {   // lines across the floor, one per tile ahead of you
        const d = k - ((view.x * c + view.z * s) % 1 + 1) % 1;
        if (d < 0.3) continue;
        const y = groundY(0, d); ctx.moveTo(0, y); ctx.lineTo(CW, y);
      }
      ctx.stroke();
      // the walls, one thin slice at a time
      const ca = Math.cos(view.a), sa = Math.sin(view.a);
      for (let i = 0; i < zbuf.length; i++) {
        const k = (i * COL + COL / 2 - CW / 2) / FOV_F;
        const rx = ca - sa * k, rz = sa + ca * k;
        let mx = Math.floor(view.x), mz = Math.floor(view.z);
        const ddx = Math.abs(1 / rx), ddz = Math.abs(1 / rz);
        const stepX = rx < 0 ? -1 : 1, stepZ = rz < 0 ? -1 : 1;
        let sdx = (rx < 0 ? view.x - mx : mx + 1 - view.x) * ddx, sdz = (rz < 0 ? view.z - mz : mz + 1 - view.z) * ddz;
        let side = 0, hit = "", n = 0;
        while (n++ < 80) {
          if (sdx < sdz) { sdx += ddx; mx += stepX; side = 0; } else { sdz += ddz; mz += stepZ; side = 1; }
          if (mz < 0 || mz >= PROWS) { hit = "#"; break; }
          const cell = MAZE[mz][((mx % PCOLS) + PCOLS) % PCOLS];
          if (cell === "#" || cell === "-") { hit = cell; break; }
        }
        const d = Math.max(0.05, side ? sdz - ddz : sdx - ddx);
        zbuf[i] = d;
        const top = groundY(1, d), bot = groundY(0, d), x = i * COL;
        if (hit === "-") {  // the ghost house door: a glowing pink bar
          ctx.fillStyle = "rgba(255,150,210,0.85)";
          ctx.fillRect(x, groundY(0.62, d), COL, (bot - top) * 0.08);
          zbuf[i] = 99;   // you can see past it into the ghost house... but only darkness
          continue;
        }
        let u = side ? view.x + d * rx : view.z + d * rz;
        u -= Math.floor(u);
        ctx.drawImage(WALL_TEX, Math.floor(u * 63), 0, 1, 64, x, top, COL, bot - top);
        const shade = fog(d) + (side ? 0.18 : 0);
        ctx.fillStyle = flash ? `rgba(255,255,255,${0.5 - fog(d) * 0.4})` : `rgba(1,1,6,${Math.min(0.95, shade)})`;
        ctx.fillRect(x, top, COL, bot - top);
        // a soft reflection of the wall on the shiny floor
        ctx.fillStyle = `rgba(60,90,230,${0.12 * (1 - fog(d))})`;
        ctx.fillRect(x, bot, COL, (bot - top) * 0.35);
      }
      // dots, power pellets and ghosts, far ones first
      const things = [];
      for (let z = 0; z < PROWS; z++) for (let x = 0; x < PCOLS; x++) {
        const dot = dots[z][x];
        if (!dot) continue;
        const e = eyeSpace(x + 0.5, z + 0.5);
        if (e && (e[1] < 16 || lastDots())) things.push({ e, draw: () => drawDotInside(ctx, e, dot, x) });
      }
      if (!pausedFor("clear")) ghosts.forEach(gh => {
        const [gx, gz] = centre(gh), e = eyeSpace(gx / PT, gz / PT);
        if (e) things.push({ e, draw: () => drawGhostInside(ctx, gh, e) });
      });
      things.sort((a, b) => b.e[1] - a.e[1]).forEach(t => t.draw());
      // the edge of your own yellow head, chomping at the top and bottom of the screen
      drawLips(ctx);
      drawDotArrows(ctx);
      if (pac.stopped && pacRunning && pacPause <= 0) drawWayHints(ctx);
      drawMiniMap(ctx);
      if (pausedFor("dead")) {
        ctx.fillStyle = `rgba(255,0,0,${0.35 * Math.min(1, pacPause)})`; ctx.fillRect(0, 0, CW, CH);
      }
    }
    // is something at this screen column and distance hidden behind a wall?
    const hidden = (sx, d) => { const i = Math.floor(sx / COL); return i >= 0 && i < zbuf.length && zbuf[i] < d; };
    function drawDotInside(ctx, [sx, d], kind, x){
      if (lastDots()) { drawLastDotInside(ctx, sx, d, x); return; }
      if (sx < -40 || sx > CW + 40 || hidden(sx, d - 0.3)) return;
      const big = kind === "o", y = big ? 0.32 + Math.sin(pacFrame * 0.12 + x) * 0.08 : 0.25;
      const sy = groundY(y, d), r = (big ? 0.2 : 0.08) * FOV_F / d, a = 1 - fog(d);
      ctx.globalAlpha = a;
      if (big) {
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 3.5);
        glow.addColorStop(0, "rgba(255,230,160,0.55)"); glow.addColorStop(1, "rgba(255,230,160,0)");
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(sx, sy, r * 3.5, 0, 7); ctx.fill();
      }
      const g = ctx.createRadialGradient(sx - r * 0.35, sy - r * 0.4, r * 0.1, sx, sy, r);
      g.addColorStop(0, "#ffffff"); g.addColorStop(0.45, "#ffe2c0"); g.addColorStop(1, "#b9824c");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill();
      // its little glow on the floor
      ctx.fillStyle = "rgba(255,220,170,0.18)";
      ctx.beginPath(); ctx.ellipse(sx, groundY(0, d), r * 1.6, r * 0.4, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // one of the last few dots: a beam of light shines up from it and shows through the walls
    function drawLastDotInside(ctx, sx, d, x){
      if (sx < -60 || sx > CW + 60) return;
      const w = Math.max(6, 0.35 * FOV_F / d), p = pulse();
      const beam = ctx.createLinearGradient(sx - w, 0, sx + w, 0);
      beam.addColorStop(0, "rgba(120,255,160,0)"); beam.addColorStop(0.5, `rgba(150,255,180,${0.35 + 0.25 * p})`); beam.addColorStop(1, "rgba(120,255,160,0)");
      ctx.fillStyle = beam; ctx.fillRect(sx - w, 0, w * 2, groundY(0, d));
      if (hidden(sx, d - 0.3)) return;
      const sy = groundY(0.4 + Math.sin(pacFrame * 0.12 + x) * 0.08, d), r = (0.22 + 0.04 * p) * FOV_F / d;
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 4);
      glow.addColorStop(0, "rgba(160,255,180,0.8)"); glow.addColorStop(1, "rgba(160,255,180,0)");
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(sx, sy, r * 4, 0, 7); ctx.fill();
      const g = ctx.createRadialGradient(sx - r * 0.35, sy - r * 0.4, r * 0.1, sx, sy, r);
      g.addColorStop(0, "#ffffff"); g.addColorStop(0.45, "#9dffb0"); g.addColorStop(1, "#1f9a4a");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill();
    }
    // arrows at the edge of the screen pointing to last dots you can't see
    function drawDotArrows(ctx){
      if (!lastDots()) return;
      for (let z = 0; z < PROWS; z++) for (let x = 0; x < PCOLS; x++) {
        if (!dots[z][x]) continue;
        const e = eyeSpace(x + 0.5, z + 0.5);
        if (e && e[0] > 0 && e[0] < CW) continue;
        const rel = angleDiff(Math.atan2(z + 0.5 - view.z, x + 0.5 - view.x), view.a), right = rel > 0;
        const ax = right ? CW - 22 : 22, ay = CH / 2 + Math.sin(pacFrame * 0.2) * 4, k = right ? 1 : -1;
        ctx.fillStyle = `rgba(150,255,180,${0.6 + 0.4 * pulse()})`;
        ctx.beginPath(); ctx.moveTo(ax + k * 14, ay); ctx.lineTo(ax - k * 6, ay - 14); ctx.lineTo(ax - k * 6, ay + 14); ctx.closePath(); ctx.fill();
      }
    }
    // stuck at a wall: show which ways you can turn
    function drawWayHints(ctx){
      const i = CLOCKWISE.indexOf(pac.dir);
      [["←", 3, CW * 0.3], ["→", 1, CW * 0.7], ["↓", 2, CW * 0.5]].forEach(([label, turn, x]) => {
        if (!canGo(pac, CLOCKWISE[(i + turn) % 4])) return;
        ctx.font = "900 46px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.lineWidth = 6; ctx.strokeStyle = "rgba(0,0,20,0.7)"; ctx.strokeText(label, x, CH * 0.55);
        ctx.fillStyle = `rgba(255,255,255,${0.6 + 0.3 * pulse()})`; ctx.fillText(label, x, CH * 0.55);
      });
    }
    function drawGhostInside(ctx, gh, [sx, d]){
      const r = 0.42 * FOV_F / d;
      if (sx + r < 0 || sx - r > CW) return;
      // only the slices of the ghost that aren't behind a wall
      ctx.save(); ctx.beginPath();
      for (let x = Math.max(0, Math.floor((sx - r) / COL)); x <= Math.min(zbuf.length - 1, Math.ceil((sx + r) / COL)); x++) {
        if (zbuf[x] > d - 0.2) ctx.rect(x * COL, 0, COL, CH);
      }
      ctx.clip();
      const bob = Math.sin(pacFrame * 0.15 + gh.x * 2) * 0.05;
      const X = sx, Y = groundY(0.55 + bob, d), u = r / 11;
      ctx.globalAlpha = gh.state === "eyes" ? 1 : 1 - fog(d) * 0.7;
      if (gh.state !== "eyes") {
        // a soft shadow on the floor
        ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.ellipse(X, groundY(0, d), r * 0.9, r * 0.18, 0, 0, 7); ctx.fill();
        const blink = gh.scared && frightT < 2 && (pacFrame >> 3) % 2;
        const col = gh.scared ? (blink ? "#ffffff" : "#2b3bff") : gh.colour;
        // a glow around the ghost: they light up the corridor
        const glow = ctx.createRadialGradient(X, Y, r * 0.4, X, Y, r * 2.2);
        glow.addColorStop(0, col + "55"); glow.addColorStop(1, col + "00");
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(X, Y, r * 2.2, 0, 7); ctx.fill();
        const grad = ctx.createRadialGradient(X - r * 0.3, Y - r * 0.5, r * 0.1, X, Y, r * 1.2);
        grad.addColorStop(0, "#ffffff"); grad.addColorStop(0.3, col); grad.addColorStop(1, "#000000");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(X, Y - 2 * u, r, Math.PI, 0);
        ctx.lineTo(X + r, Y + r);
        const wave = (pacFrame >> 3) % 2 ? 2 * u : 0;
        for (let i = 0; i < 3; i++) {
          const x0 = X + r - (i * 2 * r) / 3;
          ctx.lineTo(x0 - r / 3, Y + r - 4 * u - wave);
          ctx.lineTo(x0 - (2 * r) / 3, Y + r);
        }
        ctx.closePath(); ctx.fill();
        if (gh.scared) {
          ctx.fillStyle = ctx.strokeStyle = blink ? "#ff3b3b" : "#ffd9b0";
          ctx.beginPath(); ctx.arc(X - 4 * u, Y - 3 * u, 2.2 * u, 0, 7); ctx.arc(X + 4 * u, Y - 3 * u, 2.2 * u, 0, 7); ctx.fill();
          ctx.lineWidth = 1.5 * u; ctx.beginPath();
          for (let i = 0; i <= 4; i++) ctx.lineTo(X - 6 * u + i * 3 * u, Y + 4 * u + (i % 2 ? -2 * u : 0));
          ctx.stroke();
          ctx.restore(); ctx.globalAlpha = 1;
          return;
        }
      }
      // eyes that look where the ghost is going (straight at you when it's coming your way)
      const ga = DIR_ANGLE[gh.dir] - view.a, lx = Math.sin(ga), ly = gh.dir === "up" || gh.dir === "down" ? 0 : 0.3;
      [-4, 4].forEach(ox => {
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.ellipse(X + ox * u, Y - 3 * u, 3.6 * u, 4.6 * u, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#1b3bff";
        ctx.beginPath(); ctx.arc(X + ox * u + lx * 1.8 * u, Y - 3 * u + ly * u, 2.1 * u, 0, 7); ctx.fill();
      });
      ctx.restore(); ctx.globalAlpha = 1;
    }
    function drawLips(ctx){
      const dead = pausedFor("dead");
      let open = pac.stopped ? 1 : 0.55 + 0.45 * Math.abs(Math.cos(pacFrame * 0.35));
      if (dead) open = Math.max(0, pacPause / 1.5);
      const lip = (1 - open) * CH * 0.42 + 26;
      ctx.fillStyle = "#e6b800";
      [[0, 1], [CH, -1]].forEach(([y0, dir]) => {
        const g = ctx.createLinearGradient(0, y0, 0, y0 + dir * lip);
        g.addColorStop(0, "#b88a00"); g.addColorStop(0.7, "#ffe14d"); g.addColorStop(1, "#fff3a8");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(0, y0);
        ctx.lineTo(0, y0 + dir * lip * 1.6);
        ctx.quadraticCurveTo(CW / 2, y0 + dir * lip * 0.2, CW, y0 + dir * lip * 1.6);
        ctx.lineTo(CW, y0); ctx.closePath(); ctx.fill();
      });
    }
    // a little map in the corner, so you know where the ghosts are
    function drawMiniMap(ctx){
      const T = 5, ox = CW - PCOLS * T - 10, oy = 10;
      ctx.fillStyle = "rgba(0,0,10,0.6)"; ctx.fillRect(ox - 4, oy - 4, PCOLS * T + 8, PROWS * T + 8);
      for (let z = 0; z < PROWS; z++) for (let x = 0; x < PCOLS; x++) {
        const c = MAZE[z][x];
        if (c === "#") { ctx.fillStyle = "#2f55e6"; ctx.fillRect(ox + x * T, oy + z * T, T, T); }
        else if (dots[z][x]) { ctx.fillStyle = lastDots() ? "#7dff9a" : dots[z][x] === "o" ? "#fff" : "#ffd9b0"; const r = lastDots() ? 2 + pulse() * 1.5 : dots[z][x] === "o" ? 1.6 : 0.8; ctx.fillRect(ox + x * T + T / 2 - r, oy + z * T + T / 2 - r, r * 2, r * 2); }
      }
      ghosts.forEach(gh => {
        const [gx, gz] = centre(gh);
        ctx.fillStyle = gh.state === "eyes" ? "#fff" : gh.scared ? "#2b3bff" : gh.colour;
        ctx.beginPath(); ctx.arc(ox + gx / PT * T, oy + gz / PT * T, 2.6, 0, 7); ctx.fill();
      });
      ctx.save(); ctx.translate(ox + view.x * T, oy + view.z * T); ctx.rotate(view.a);
      ctx.fillStyle = "#ffe600"; ctx.beginPath(); ctx.moveTo(4.5, 0); ctx.lineTo(-3, 3.2); ctx.lineTo(-3, -3.2); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // comic words over a spot on the board
    function popAt(wx, wz, s, colour, size){
      const e = eyeSpace(wx, wz);
      if (e) fx.pop(s, e[0], groundY(1.1, Math.max(1.2, e[1])), colour, size);
      else fx.pop(s, CW / 2, CH * 0.3, colour, size);
    }
    function updatePacHud(){
      pacScoreEl.textContent = "⭐ " + pacScore;
      pacLivesEl.textContent = "🟡 ×" + Math.max(0, pacLives);
      pacLevelEl.textContent = "Level " + pacLevel;
    }

    function pacLoop(now){
      if (!pacOpen) return;
      const dt = Math.min(1 / 30, (now - pacLast) / 1000 || 0);
      pacLast = now;
      pacFrame++;
      if (pacRunning) pacStep(dt);
      eyeUpdate(dt);
      drawPac();
      updatePacHud();
      requestAnimationFrame(pacLoop);
    }

    function resetPac(){
      pacScore = 0; pacLives = 3; pacLevel = 1;
      resetDots();
      resetActors();
    }
    function startPac(){
      resetPac();
      pacRunning = true;
      pacPanel.hidden = true;
      pacCanvas.focus();
    }
    function endPac(){
      pacRunning = false;
      const wasBest = pacScore > (store.pac3dBest || 0);
      if (wasBest) store.pac3dBest = pacScore;
      Hub.saveStore();
      pacPanelTitle.textContent = "👻 Game over!";
      pacPanelText.textContent = `You scored ${pacScore} and reached level ${pacLevel}.`
        + (wasBest ? " That's a new best! 🎉" : ` Your best is ${store.pac3dBest}.`);
      pacPlayBtn.textContent = "▶ Play again";
      pacPanel.hidden = false;
      if (wasBest) Hub.confettiBurst(pacPlayBtn);
      pacPlayBtn.focus();
    }
    function openPac(){
      pacOpen = true;
      pacRunning = false;
      resetPac();
      Fun.screen(pacOverlay, true);
      pacPanelTitle.textContent = "🟡 Pac-Man 3D";
      pacPanelText.textContent = "This time you ARE Pac-Man, deep inside the maze! Gobble up every dot and don't let the ghosts catch you. Eat a big flashing dot and the ghosts turn blue — then chase them for extra points. The little map shows where everyone is."
        + (store.pac3dBest ? ` Your best: ${store.pac3dBest}.` : "");
      pacPlayBtn.textContent = "▶ Play";
      pacPanel.hidden = false;
      pacLast = performance.now();
      requestAnimationFrame(pacLoop);
      pacPlayBtn.focus();
    }
    function closePac(){
      pacOpen = false;
      pacRunning = false;
      Fun.screen(pacOverlay, false);
    }

    const PAC_KEYMAP = {
      ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
      ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down"
    };
    // the keys are turns: ← left, → right, ↑ ahead, ↓ turn around
    const CLOCKWISE = ["up", "right", "down", "left"];
    function steer(d){
      const turn = { up: 0, right: 1, down: 2, left: 3 }[d];
      pacWant = CLOCKWISE[(CLOCKWISE.indexOf(pac.dir) + turn) % 4];
    }
    window.addEventListener("keydown", e => {
      if (!pacOpen) return;
      if (e.key === "Escape") { Hub.leave(); return; }
      const d = PAC_KEYMAP[e.code];
      if (!d || !pacRunning) return;
      e.preventDefault();
      if (!e.repeat) steer(d);
    });
    host.querySelectorAll(".p3d-pad [data-dir]").forEach(btn => {
      btn.addEventListener("pointerdown", e => { e.preventDefault(); steer(btn.dataset.dir); });
    });
    // swipe on the maze to steer
    let swipeFrom = null;
    const stick = Fun.joystick(pacCanvas.parentElement);   // on phones: push left or right to turn, down to turn around
    pacCanvas.addEventListener("pointerdown", e => { swipeFrom = [e.clientX, e.clientY]; });
    pacCanvas.addEventListener("pointermove", e => {
      if (!swipeFrom) return;
      const dx = e.clientX - swipeFrom[0], dy = e.clientY - swipeFrom[1];
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
      steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
      swipeFrom = [e.clientX, e.clientY];
    });
    ["pointerup", "pointercancel"].forEach(ev => pacCanvas.addEventListener(ev, () => { swipeFrom = null; }));
    pacCanvas.tabIndex = 0;

    document.getElementById("p3dCloseBtn").addEventListener("click", () => Hub.leave());
    Fun.soundButton(document.getElementById("p3dCloseBtn"));
    pacPlayBtn.addEventListener("click", startPac);

    return { open: openPac, close: closePac };
  }
})();
