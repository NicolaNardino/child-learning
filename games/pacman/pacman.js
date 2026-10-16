/* Pac-Man: eat every dot in the maze and dodge the four ghosts.
   A big flashing dot turns the ghosts blue, so you can chase them for bonus points. */
(function(){
  "use strict";
  const store = Hub.store;

  Hub.register({
    id: "pacman", section: "games", title: "Pac-Man", icon: "👻",
    blurb: "Gobble every dot, dodge the ghosts, and chase them when they turn blue.",
    stat: () => store.pacBest ? "Best: " + store.pacBest : "",
    mount
  });

  function mount(host){
    host.innerHTML = `
    <section class="game-screen" id="pacOverlay" hidden aria-label="Pac-Man">
      <div class="game-box pac-box">
        <div class="game-hud">
          <h2>👻 Pac-Man</h2>
          <span class="mono game-stat" id="pacScore">⭐ 0</span>
          <span class="mono game-stat" id="pacLives">🟡 ×3</span>
          <span class="mono game-stat" id="pacLevel">Level 1</span>
          <button class="btn ghost small" id="pacCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas id="pacCanvas" width="600" height="480"></canvas>
          <div class="game-panel pac-panel" id="pacPanel">
            <div class="game-panel-title" id="pacPanelTitle">Pac-Man</div>
            <div class="game-panel-text" id="pacPanelText"></div>
            <button class="btn" id="pacPlayBtn" type="button">▶ Play</button>
          </div>
        </div>
        <div class="game-help">← ↑ → ↓ or W A S D to steer · eat a big dot to make the ghosts turn blue, then chase them!</div>
        <div class="pac-pad">
          <button class="btn ghost" data-dir="up" type="button" aria-label="Up">▲</button>
          <button class="btn ghost" data-dir="left" type="button" aria-label="Left">◀</button>
          <button class="btn ghost" data-dir="down" type="button" aria-label="Down">▼</button>
          <button class="btn ghost" data-dir="right" type="button" aria-label="Right">▶</button>
        </div>
      </div>
    </section>`;

    function choice(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

    const pacOverlay = document.getElementById("pacOverlay");
    const pacCanvas = document.getElementById("pacCanvas");
    const pacCtx = pacCanvas.getContext("2d");
    const pacPanel = document.getElementById("pacPanel");
    const pacPanelTitle = document.getElementById("pacPanelTitle");
    const pacPanelText = document.getElementById("pacPanelText");
    const pacPlayBtn = document.getElementById("pacPlayBtn");
    const pacScoreEl = document.getElementById("pacScore");
    const pacLivesEl = document.getElementById("pacLives");
    const pacLevelEl = document.getElementById("pacLevel");

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

    function movePac(dt){
      // turning straight around works at any moment
      if (pacWant && pacWant === OPPOSITE[pac.dir] && pac.prog > 0) {
        [pac.x, pac.y] = stepTile(pac, pac.dir); pac.dir = pacWant; pac.prog = 1 - pac.prog;
      }
      let move = 7.5 * levelBoost() * dt;
      while (move > 0) {
        if (pac.prog === 0) {
          eatAt(pac.x, pac.y);
          if (canGo(pac, pacWant)) pac.dir = pacWant;
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
    /* ----- drawing: the maze in 3D, seen from above and behind, with raised walls ----- */
    const CW = 600, CH = 480, WALL_H = 0.8;
    const CAM = [9.5, 26, 27], LOOK = [9.5, 0, 9.6];
    const norm3 = v => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
    const FWD = norm3([LOOK[0] - CAM[0], LOOK[1] - CAM[1], LOOK[2] - CAM[2]]);
    const RGT = norm3([-FWD[2], 0, FWD[0]]);
    const UP = [RGT[1] * FWD[2] - RGT[2] * FWD[1], RGT[2] * FWD[0] - RGT[0] * FWD[2], RGT[0] * FWD[1] - RGT[1] * FWD[0]];
    function raw(x, y, z){
      const dx = x - CAM[0], dy = y - CAM[1], dz = z - CAM[2];
      const zc = dx * FWD[0] + dy * FWD[1] + dz * FWD[2];
      return [(dx * RGT[0] + dy * RGT[1] + dz * RGT[2]) / zc, -(dx * UP[0] + dy * UP[1] + dz * UP[2]) / zc, zc];
    }
    // fit the whole board (floor and wall tops) into the canvas
    const FIT = (() => {
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      [[0, 0], [PCOLS, 0], [0, PROWS], [PCOLS, PROWS]].forEach(([x, z]) => [0, WALL_H].forEach(y => {
        const [sx, sy] = raw(x, y, z); x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
      }));
      const k = Math.min((CW - 8) / (x1 - x0), (CH - 8) / (y1 - y0));
      return { k, ox: CW / 2 - (x0 + x1) / 2 * k, oy: CH / 2 - (y0 + y1) / 2 * k };
    })();
    const P = { x: 0, y: 0, s: 0 };
    function proj(x, y, z, out){
      const [sx, sy, zc] = raw(x, y, z);
      out = out || P;
      out.x = FIT.ox + sx * FIT.k; out.y = FIT.oy + sy * FIT.k; out.s = FIT.k / zc;
      return out;
    }
    function poly(ctx, pts, fill){
      ctx.beginPath();
      pts.forEach(([x, y, z], i) => { proj(x, y, z); if (i) ctx.lineTo(P.x, P.y); else ctx.moveTo(P.x, P.y); });
      ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    }
    const wallAt = (x, y) => x >= 0 && x < PCOLS && y >= 0 && y < PROWS && MAZE[y][x] === "#";
    function shadow(ctx, x, z, r){
      proj(x, 0.01, z);
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath(); ctx.ellipse(P.x, P.y, r * P.s * 1.1, r * P.s * 0.55, 0, 0, 7); ctx.fill();
    }
    function ball(ctx, x, y, z, r, c0, c1, c2){
      proj(x, y, z);
      const R = r * P.s, g = ctx.createRadialGradient(P.x - R * 0.35, P.y - R * 0.4, R * 0.1, P.x, P.y, R);
      g.addColorStop(0, c0); g.addColorStop(0.45, c1); g.addColorStop(1, c2);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(P.x, P.y, R, 0, 7); ctx.fill();
    }
    function drawWall(ctx, x, z, flash){
      const H = WALL_H;
      if (!wallAt(x, z + 1)) poly(ctx, [[x, 0, z + 1], [x + 1, 0, z + 1], [x + 1, H, z + 1], [x, H, z + 1]], flash ? "#6a7bd6" : "#10206e");
      if (x + 0.5 < 9.5 && !wallAt(x + 1, z)) poly(ctx, [[x + 1, 0, z], [x + 1, 0, z + 1], [x + 1, H, z + 1], [x + 1, H, z]], flash ? "#7d8de0" : "#18308f");
      if (x + 0.5 > 9.5 && !wallAt(x - 1, z)) poly(ctx, [[x, 0, z], [x, 0, z + 1], [x, H, z + 1], [x, H, z]], flash ? "#7d8de0" : "#18308f");
      poly(ctx, [[x, H, z], [x + 1, H, z], [x + 1, H, z + 1], [x, H, z + 1]], flash ? "#c8d2ff" : "#2f55e6");
      // a bright edge where the top meets a corridor
      ctx.strokeStyle = flash ? "#fff" : "#8fb0ff"; ctx.lineWidth = 1.6; ctx.beginPath();
      const edge = (a, b) => { proj(a[0], H, a[1]); ctx.moveTo(P.x, P.y); proj(b[0], H, b[1]); ctx.lineTo(P.x, P.y); };
      if (!wallAt(x, z - 1)) edge([x, z], [x + 1, z]);
      if (!wallAt(x, z + 1)) edge([x, z + 1], [x + 1, z + 1]);
      if (!wallAt(x - 1, z)) edge([x, z], [x, z + 1]);
      if (!wallAt(x + 1, z)) edge([x + 1, z], [x + 1, z + 1]);
      ctx.stroke();
    }
    function drawDot(ctx, x, z, c){
      if (c === "o") {
        const bob = 0.32 + Math.sin(pacFrame * 0.12 + x) * 0.08;
        shadow(ctx, x + 0.5, z + 0.5, 0.2);
        proj(x + 0.5, bob, z + 0.5);
        const glowR = 0.6 * P.s, g = ctx.createRadialGradient(P.x, P.y, 0, P.x, P.y, glowR);
        g.addColorStop(0, "rgba(255,230,160,0.6)"); g.addColorStop(1, "rgba(255,230,160,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(P.x, P.y, glowR, 0, 7); ctx.fill();
        ball(ctx, x + 0.5, bob, z + 0.5, 0.22, "#ffffff", "#ffd9b0", "#d08a3c");
      } else {
        shadow(ctx, x + 0.5, z + 0.5, 0.08);
        ball(ctx, x + 0.5, 0.2, z + 0.5, 0.09, "#ffffff", "#ffe2c0", "#c99560");
      }
    }
    // which way is "forward" on the screen for a direction on the board
    function screenDir(wx, wz, dir){
      const [dx, dz] = DIRS[dir];
      const a = proj(wx, 0.45, wz, {}), b = proj(wx + dx * 0.5, 0.45, wz + dz * 0.5, {});
      return Math.atan2(b.y - a.y, b.x - a.x);
    }
    function drawPacman(ctx){
      const [cx, cy] = centre(pac), wx = cx / PT, wz = cy / PT;
      const dead = pausedFor("dead");
      const bounce = pac.stopped || dead ? 0 : Math.abs(Math.sin(pacFrame * 0.35)) * 0.1;
      shadow(ctx, wx, wz, 0.42);
      const angle = screenDir(wx, wz, pac.dir);
      let mouth = pac.stopped ? 0.2 : 0.05 + 0.2 * Math.abs(Math.sin(pacFrame * 0.35));
      if (dead) mouth = Math.min(0.99, 0.2 + (1.5 - pacPause) / 1.5);
      proj(wx, 0.45 + bounce, wz);
      const R = 0.46 * P.s, X = P.x, Y = P.y;
      const g = ctx.createRadialGradient(X - R * 0.35, Y - R * 0.45, R * 0.1, X, Y, R);
      g.addColorStop(0, "#fffbd0"); g.addColorStop(0.4, "#ffe600"); g.addColorStop(1, "#d99a00");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(X, Y);
      ctx.arc(X, Y, R, angle + mouth * Math.PI, angle - mouth * Math.PI + Math.PI * 2);
      ctx.closePath(); ctx.fill();
      if (mouth > 0.9) return;
      // a cartoon eye on the side of the head that faces up the screen
      const ux = Math.cos(angle), uy = Math.sin(angle);
      let nx = -uy, ny = ux; if (ny > 0) { nx = -nx; ny = -ny; }
      const ex = X + nx * R * 0.5 + ux * R * 0.12, ey = Y + ny * R * 0.5 + uy * R * 0.12, er = R * 0.2;
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(ex, ey, er, er * 1.15, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "#1a1030";
      if (dead) { ctx.font = `900 ${Math.round(er * 2)}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("×", ex, ey); }
      else { ctx.beginPath(); ctx.arc(ex + ux * er * 0.4, ey + uy * er * 0.4, er * 0.55, 0, 7); ctx.fill(); }
      ctx.strokeStyle = "#7a5200"; ctx.lineWidth = Math.max(1, R * 0.08); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(ex - er * 1.1, ey - er * 1.5); ctx.lineTo(ex + er * 1.1, ey - er * (frightT > 0 ? 2 : 1.3)); ctx.stroke(); ctx.lineCap = "butt";
    }
    function drawGhost(ctx, g){
      const [cx, cy] = centre(g), wx = cx / PT, wz = cy / PT;
      const bob = Math.sin(pacFrame * 0.15 + wx * 2) * 0.06;
      const shiver = g.scared ? Math.sin(pacFrame * 1.7) * 0.03 : 0;
      if (g.state !== "eyes") shadow(ctx, wx, wz, 0.4);
      proj(wx + shiver, 0.55 + bob, wz);
      const r = 0.46 * P.s, X = P.x, Y = P.y, u = r / (PT * 0.45);
      const look = screenDir(wx, wz, g.dir), lx = Math.cos(look), ly = Math.sin(look);
      if (g.state !== "eyes") {
        const blink = g.scared && frightT < 2 && (pacFrame >> 3) % 2;
        const col = g.scared ? (blink ? "#ffffff" : "#2b3bff") : g.colour;
        const grad = ctx.createLinearGradient(X - r, Y - r, X + r, Y + r);
        grad.addColorStop(0, "#ffffff"); grad.addColorStop(0.25, col); grad.addColorStop(1, col);
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
        if (g.scared) {
          ctx.fillStyle = ctx.strokeStyle = blink ? "#ff3b3b" : "#ffd9b0";
          ctx.beginPath(); ctx.arc(X - 4 * u, Y - 3 * u, 2.2 * u, 0, 7); ctx.arc(X + 4 * u, Y - 3 * u, 2.2 * u, 0, 7); ctx.fill();
          ctx.lineWidth = 1.5 * u; ctx.beginPath();
          for (let i = 0; i <= 4; i++) ctx.lineTo(X - 6 * u + i * 3 * u, Y + 4 * u + (i % 2 ? -2 * u : 0));
          ctx.stroke();
          return;
        }
      }
      [-4, 4].forEach(ox => {
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.ellipse(X + ox * u, Y - 3 * u, 3.6 * u, 4.6 * u, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#1b3bff";
        ctx.beginPath(); ctx.arc(X + ox * u + lx * 1.8 * u, Y - 3 * u + ly * 2 * u, 2.1 * u, 0, 7); ctx.fill();
      });
      if (g.state !== "eyes") {   // a cheeky little mouth
        ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 1.4 * u; ctx.beginPath(); ctx.arc(X, Y + 3 * u, 3 * u, 0.2, Math.PI - 0.2); ctx.stroke();
      }
    }
    // the maze fills the screen, so draw it at the real size to keep it sharp
    let pacScale = 1;
    function fitPacCanvas(){
      const s = Math.min(3, Math.max(1, pacCanvas.clientWidth * (window.devicePixelRatio || 1) / CW));
      if (Math.abs(s - pacScale) < 0.01) return;
      pacScale = s;
      pacCanvas.width = Math.round(CW * s); pacCanvas.height = Math.round(CH * s);
    }
    const fx = Fun.pops();
    let fxLast = performance.now();
    function drawPac(){
      const ctx = pacCtx;
      fitPacCanvas();
      ctx.setTransform(pacScale, 0, 0, pacScale, 0, 0);
      const bgr = ctx.createLinearGradient(0, 0, 0, CH);
      bgr.addColorStop(0, "#05061a"); bgr.addColorStop(1, "#0d1240");
      ctx.fillStyle = bgr; ctx.fillRect(0, 0, CW, CH);
      // the floor, with a faint grid
      poly(ctx, [[0, 0, 0], [PCOLS, 0, 0], [PCOLS, 0, PROWS], [0, 0, PROWS]], "#070b2a");
      ctx.strokeStyle = "rgba(80,110,255,0.08)"; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = 0; x <= PCOLS; x++) { proj(x, 0, 0); ctx.moveTo(P.x, P.y); proj(x, 0, PROWS); ctx.lineTo(P.x, P.y); }
      for (let z = 0; z <= PROWS; z++) { proj(0, 0, z); ctx.moveTo(P.x, P.y); proj(PCOLS, 0, z); ctx.lineTo(P.x, P.y); }
      ctx.stroke();
      const flash = pausedFor("clear") && (pacFrame >> 3) % 2;
      // things that move, sorted into the row they're on, so walls in front can hide them
      const rows = Array.from({ length: PROWS }, () => []);
      const showGhosts = !pausedFor("clear") && !pausedFor("dead");
      if (showGhosts) ghosts.forEach(g => { const r = Math.floor(centre(g)[1] / PT); rows[Math.max(0, Math.min(PROWS - 1, r))].push(() => drawGhost(ctx, g)); });
      if (!pausedFor("eat")) { const r = Math.floor(centre(pac)[1] / PT); rows[Math.max(0, Math.min(PROWS - 1, r))].push(() => drawPacman(ctx)); }
      // far rows first; in each row the outer walls first
      const order = [...Array(PCOLS).keys()].sort((a, b) => Math.abs(b + 0.5 - 9.5) - Math.abs(a + 0.5 - 9.5));
      for (let z = 0; z < PROWS; z++) {
        for (const x of order) {
          const c = MAZE[z][x];
          if (c === "#") drawWall(ctx, x, z, flash);
          else if (c === "-") poly(ctx, [[x, 0.3, z + 0.45], [x + 1, 0.3, z + 0.45], [x + 1, 0.3, z + 0.55], [x, 0.3, z + 0.55]], "#ffb8de");
          else if (dots[z][x]) drawDot(ctx, x, z, dots[z][x]);
        }
        rows[z].forEach(f => f());
      }
      const now = performance.now();
      fx.draw(ctx, Math.min(0.05, (now - fxLast) / 1000)); fxLast = now;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      if (pacRunning && pausedFor("ready")) {
        ctx.font = "900 30px 'Bricolage Grotesque', sans-serif"; ctx.lineWidth = 6; ctx.strokeStyle = "#1a1030";
        ctx.strokeText("READY?", CW / 2, CH * 0.5); ctx.fillStyle = "#ffe600"; ctx.fillText("READY?", CW / 2, CH * 0.5);
      }
    }
    // comic words over a spot on the board
    function popAt(wx, wz, s, colour, size){ proj(wx, 1.2, wz); fx.pop(s, P.x, P.y, colour, size); }
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
      const wasBest = pacScore > (store.pacBest || 0);
      if (wasBest) store.pacBest = pacScore;
      Hub.saveStore();
      pacPanelTitle.textContent = "👻 Game over!";
      pacPanelText.textContent = `You scored ${pacScore} and reached level ${pacLevel}.`
        + (wasBest ? " That's a new best! 🎉" : ` Your best is ${store.pacBest}.`);
      pacPlayBtn.textContent = "▶ Play again";
      pacPanel.hidden = false;
      if (wasBest) Hub.confettiBurst(pacPlayBtn);
      pacPlayBtn.focus();
    }
    function openPac(){
      pacOpen = true;
      pacRunning = false;
      resetPac();
      pacOverlay.hidden = false;
      document.body.style.overflow = "hidden";
      pacPanelTitle.textContent = "👻 Pac-Man";
      pacPanelText.textContent = "Gobble up every dot and don't let the ghosts catch you! Eat a big flashing dot and the ghosts turn blue — then you can chase them for extra points."
        + (store.pacBest ? ` Your best: ${store.pacBest}.` : "");
      pacPlayBtn.textContent = "▶ Play";
      pacPanel.hidden = false;
      pacLast = performance.now();
      requestAnimationFrame(pacLoop);
      pacPlayBtn.focus();
    }
    function closePac(){
      pacOpen = false;
      pacRunning = false;
      pacOverlay.hidden = true;
      document.body.style.overflow = "";
    }

    const PAC_KEYMAP = {
      ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
      ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down"
    };
    window.addEventListener("keydown", e => {
      if (!pacOpen) return;
      if (e.key === "Escape") { Hub.leave(); return; }
      const d = PAC_KEYMAP[e.code];
      if (!d || !pacRunning) return;
      e.preventDefault();
      pacWant = d;
    });
    host.querySelectorAll(".pac-pad [data-dir]").forEach(btn => {
      btn.addEventListener("pointerdown", e => { e.preventDefault(); pacWant = btn.dataset.dir; });
    });
    // swipe on the maze to steer
    let swipeFrom = null;
    pacCanvas.addEventListener("pointerdown", e => { swipeFrom = [e.clientX, e.clientY]; });
    pacCanvas.addEventListener("pointermove", e => {
      if (!swipeFrom) return;
      const dx = e.clientX - swipeFrom[0], dy = e.clientY - swipeFrom[1];
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
      pacWant = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
      swipeFrom = [e.clientX, e.clientY];
    });
    ["pointerup", "pointercancel"].forEach(ev => pacCanvas.addEventListener(ev, () => { swipeFrom = null; }));
    pacCanvas.tabIndex = 0;

    document.getElementById("pacCloseBtn").addEventListener("click", () => Hub.leave());
    Fun.soundButton(document.getElementById("pacCloseBtn"));
    pacPlayBtn.addEventListener("click", startPac);

    return { open: openPac, close: closePac };
  }
})();
