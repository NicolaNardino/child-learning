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
          <canvas id="pacCanvas" width="456" height="504"></canvas>
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
    let pacPause = 0, pacPauseKind = "", pacPops = [];
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
      frightT = 0; modeT = 0; lifeT = 0; pacPops = [];
      pacPause = 2; pacPauseKind = "ready";
    }

    function eatAt(x, y){
      const c = dots[y] && dots[y][x];
      if (!c) return;
      dots[y][x] = "";
      dotsLeft--;
      if (c === ".") { pacScore += 10; return; }
      pacScore += 50;
      frightT = Math.max(2, 7 - (pacLevel - 1));
      ghostCombo = 0;
      ghosts.forEach(g => {
        if (g.state === "eyes") return;
        // scared ghosts turn right around
        if (g.state === "free" && !g.scared && g.prog > 0) { [g.x, g.y] = stepTile(g, g.dir); g.dir = OPPOSITE[g.dir]; g.prog = 1 - g.prog; }
        g.scared = true;
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
      pacPops.forEach(p => { p.t -= dt; });
      pacPops = pacPops.filter(p => p.t > 0);
      if (pacPause > 0) {
        pacPause -= dt;
        if (pacPause > 0) return;
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
      if (dotsLeft === 0) { pacPause = 2; pacPauseKind = "clear"; return; }
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
          pacPops.push({ x: gx, y: gy, text: String(pts), t: 1 });
          g.state = "eyes"; g.scared = false;
          pacPause = 0.4; pacPauseKind = "eat";
        } else {
          pacPause = 1.5; pacPauseKind = "dead";
          return;
        }
      }
    }

    /* ----- drawing ----- */
    function pausedFor(kind){ return pacPauseKind === kind && pacPause > 0; }
    function drawPacMaze(ctx){
      const flash = pausedFor("clear") && (pacFrame >> 3) % 2;
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, PCOLS * PT, PROWS * PT);
      ctx.strokeStyle = flash ? "#fff" : "#3b6bff"; ctx.lineWidth = 2;
      const open = (nx, ny) => nx >= 0 && nx < PCOLS && ny >= 0 && ny < PROWS && MAZE[ny][nx] !== "#";
      for (let y = 0; y < PROWS; y++) for (let x = 0; x < PCOLS; x++) {
        const c = MAZE[y][x];
        if (c === "-") { ctx.fillStyle = "#ffb8de"; ctx.fillRect(x * PT, y * PT + PT / 2 - 2, PT, 4); continue; }
        if (c !== "#") continue;
        ctx.fillStyle = flash ? "#1b2a8f" : "#0b1450";
        ctx.fillRect(x * PT, y * PT, PT, PT);
        // outline only the sides that face a corridor
        ctx.beginPath();
        if (open(x, y - 1)) { ctx.moveTo(x * PT, y * PT + 1); ctx.lineTo((x + 1) * PT, y * PT + 1); }
        if (open(x, y + 1)) { ctx.moveTo(x * PT, (y + 1) * PT - 1); ctx.lineTo((x + 1) * PT, (y + 1) * PT - 1); }
        if (open(x - 1, y)) { ctx.moveTo(x * PT + 1, y * PT); ctx.lineTo(x * PT + 1, (y + 1) * PT); }
        if (open(x + 1, y)) { ctx.moveTo((x + 1) * PT - 1, y * PT); ctx.lineTo((x + 1) * PT - 1, (y + 1) * PT); }
        ctx.stroke();
      }
      ctx.fillStyle = "#ffd9b0";
      for (let y = 0; y < PROWS; y++) for (let x = 0; x < PCOLS; x++) {
        const c = dots[y][x];
        if (!c || (c === "o" && (pacFrame >> 4) % 2)) continue; // power pellets blink
        ctx.beginPath(); ctx.arc((x + 0.5) * PT, (y + 0.5) * PT, c === "o" ? 6 : 2.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    function drawPacman(ctx){
      const [cx, cy] = centre(pac);
      const angle = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[pac.dir];
      let mouth = pac.stopped ? 0.2 : 0.05 + 0.2 * Math.abs(Math.sin(pacFrame * 0.35));
      if (pausedFor("dead")) mouth = Math.min(0.99, 0.2 + (1.5 - pacPause) / 1.5);
      ctx.fillStyle = "#ffe600";
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, PT * 0.45, angle + mouth * Math.PI, angle - mouth * Math.PI + Math.PI * 2);
      ctx.closePath(); ctx.fill();
    }
    function drawGhost(ctx, g){
      const [cx, cy] = centre(g);
      const r = PT * 0.45;
      const [lx, ly] = DIRS[g.dir];
      if (g.state !== "eyes") {
        const blink = g.scared && frightT < 2 && (pacFrame >> 3) % 2;
        ctx.fillStyle = g.scared ? (blink ? "#fff" : "#2b3bff") : g.colour;
        ctx.beginPath();
        ctx.arc(cx, cy - 2, r, Math.PI, 0);
        ctx.lineTo(cx + r, cy + r);
        const wave = (pacFrame >> 3) % 2 ? 2 : 0;
        for (let i = 0; i < 3; i++) {
          const x0 = cx + r - (i * 2 * r) / 3;
          ctx.lineTo(x0 - r / 3, cy + r - 4 - wave);
          ctx.lineTo(x0 - (2 * r) / 3, cy + r);
        }
        ctx.closePath(); ctx.fill();
        if (g.scared) {
          ctx.fillStyle = ctx.strokeStyle = blink ? "#ff3b3b" : "#ffd9b0";
          ctx.fillRect(cx - 5, cy - 4, 3, 3); ctx.fillRect(cx + 2, cy - 4, 3, 3);
          ctx.lineWidth = 1.5; ctx.beginPath();
          for (let i = 0; i <= 4; i++) ctx.lineTo(cx - 6 + i * 3, cy + 4 + (i % 2 ? -2 : 0));
          ctx.stroke();
          return;
        }
      }
      [-4, 4].forEach(ox => {
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.ellipse(cx + ox, cy - 3, 3.5, 4.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#1b3bff";
        ctx.beginPath(); ctx.arc(cx + ox + lx * 1.8, cy - 3 + ly * 2, 2, 0, Math.PI * 2); ctx.fill();
      });
    }
    // the maze fills the screen now, so draw it at the real size to keep it sharp
    let pacScale = 1;
    function fitPacCanvas(){
      const s = Math.min(3, Math.max(1, pacCanvas.clientWidth * (window.devicePixelRatio || 1) / (PCOLS * PT)));
      if (Math.abs(s - pacScale) < 0.01) return;
      pacScale = s;
      pacCanvas.width = Math.round(PCOLS * PT * s); pacCanvas.height = Math.round(PROWS * PT * s);
    }
    function drawPac(){
      const ctx = pacCtx;
      fitPacCanvas();
      ctx.setTransform(pacScale, 0, 0, pacScale, 0, 0);
      drawPacMaze(ctx);
      if (!pausedFor("clear") && !pausedFor("dead")) ghosts.forEach(g => drawGhost(ctx, g));
      if (!pausedFor("eat")) drawPacman(ctx);
      ctx.textAlign = "center";
      ctx.fillStyle = "#3bdcff"; ctx.font = "800 14px 'Bricolage Grotesque', sans-serif";
      pacPops.forEach(p => ctx.fillText(p.text, p.x, p.y + 5));
      if (pacRunning && pausedFor("ready")) {
        ctx.fillStyle = "#ffe600"; ctx.font = "800 22px 'Bricolage Grotesque', sans-serif";
        ctx.fillText("READY!", 9.5 * PT, 11.7 * PT);
      }
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
    pacPlayBtn.addEventListener("click", startPac);

    return { open: openPac, close: closePac };
  }
})();
