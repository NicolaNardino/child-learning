/* Block Drop: a Tetris-style falling blocks game. Seven shapes fall into a 10 × 20 well; slide and turn
   them to fill whole rows, which vanish. 4 rows at once is a BLOCK BLAST! Every 10 rows is a new level,
   and the blocks fall faster. There's a ghost showing where the shape will land, the next 3 shapes, and a
   Hold box to save one for later. Shapes come in "bags" of all seven, so you never wait too long for a line. */
(function(){
  "use strict";
  const store = Hub.store;

  Hub.register({
    id: "blockdrop", section: "games", title: "Block Drop", icon: "🧱",
    blurb: "Tetris-style! Turn and drop the rainbow blocks to clear whole rows.",
    stat: () => store.blockBest ? "Best: " + store.blockBest : "",
    badges: [
      { id: "bd-blast", icon: "💥", name: "Block Blast", desc: "Clear 4 rows at once in Block Drop", test: () => !!store.blockBlast },
      { id: "bd-100", icon: "🧱", name: "Row Wrecker", desc: "Clear 100 rows in Block Drop (all games together)", test: () => (store.blockRows || 0) >= 100 },
      { id: "bd-lv10", icon: "🚀", name: "Speed Stacker", desc: "Reach level 10 in Block Drop", test: () => (store.blockLevel || 0) >= 10 }
    ],
    mount
  });

  const COLS = 10, ROWS = 20, T = 26;
  // each shape: its cells in a 4 × 4 box (rotation 0), and its colour
  const SHAPES = {
    I: { cells: [[0, 1], [1, 1], [2, 1], [3, 1]], colour: "#4dd9ff" },
    O: { cells: [[1, 0], [2, 0], [1, 1], [2, 1]], colour: "#ffe14d" },
    T: { cells: [[1, 0], [0, 1], [1, 1], [2, 1]], colour: "#b26bff" },
    S: { cells: [[1, 0], [2, 0], [0, 1], [1, 1]], colour: "#4dd96b" },
    Z: { cells: [[0, 0], [1, 0], [1, 1], [2, 1]], colour: "#ff4d6d" },
    J: { cells: [[0, 0], [0, 1], [1, 1], [2, 1]], colour: "#4d7bff" },
    L: { cells: [[2, 0], [0, 1], [1, 1], [2, 1]], colour: "#ff9f1c" }
  };
  const KINDS = Object.keys(SHAPES);
  const POINTS = [0, 100, 300, 500, 800];
  const WORDS = ["", "NICE!", "DOUBLE!", "TRIPLE!", "💥 BLOCK BLAST!"];
  // a shape turned r quarter-turns clockwise (the I and O turn in their 4 × 4 box, the rest in 3 × 3)
  function cellsOf(kind, r){
    const n = kind === "I" || kind === "O" ? 4 : 3;
    let cells = SHAPES[kind].cells;
    if (kind === "O") return cells;
    for (let k = 0; k < ((r % 4) + 4) % 4; k++) cells = cells.map(([x, y]) => [n - 1 - y, x]);
    return cells;
  }

  function mount(host){
    host.innerHTML = `
    <section class="game-screen" id="bdOverlay" hidden aria-label="Block Drop">
      <div class="game-box bd-box">
        <div class="game-hud">
          <h2>🧱 Block Drop</h2>
          <span class="mono game-stat" id="bdScore">⭐ 0</span>
          <span class="mono game-stat" id="bdRows">🧱 0</span>
          <span class="mono game-stat" id="bdLevel">Level 1</span>
          <button class="btn ghost small" id="bdCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas id="bdCanvas" width="580" height="560"></canvas>
          <div class="game-panel bd-panel" id="bdPanel">
            <div class="game-panel-title" id="bdPanelTitle">🧱 Block Drop</div>
            <div class="game-panel-text" id="bdPanelText"></div>
            <button class="btn" id="bdPlayBtn" type="button">▶ Play</button>
          </div>
        </div>
        <div class="game-help">← → move · ↑ or X turn · Z turn back · ↓ drop faster · Space drop all the way · C or Shift hold · P pause</div>
        <div class="game-touch bd-touch">
          <button class="btn ghost" data-bd="left" type="button" aria-label="Left">◀</button>
          <button class="btn ghost" data-bd="right" type="button" aria-label="Right">▶</button>
          <button class="btn ghost" data-bd="turn" type="button" aria-label="Turn">⟳</button>
          <button class="btn ghost" data-bd="down" type="button" aria-label="Drop faster">▼</button>
          <button class="btn ghost" data-bd="drop" type="button" aria-label="Drop all the way">⤓</button>
          <button class="btn ghost" data-bd="hold" type="button" aria-label="Hold">Hold</button>
        </div>
      </div>
    </section>`;

    const $ = id => document.getElementById(id);
    const overlay = $("bdOverlay"), canvas = $("bdCanvas"), ctx = canvas.getContext("2d");
    const panel = $("bdPanel"), panelTitle = $("bdPanelTitle"), panelText = $("bdPanelText"), playBtn = $("bdPlayBtn");
    const W = 580, H = 560, BX = (W - COLS * T) / 2, BY = 10;
    const fx = Fun.pops();

    let isOpen = false, running = false, paused = false, last = 0, clock = 0;
    let grid = [], piece = null, bag = [], next = [], hold = null, held = false;
    let score = 0, rows = 0, level = 1, fallT = 0, lockT = 0, soft = false, clearing = null, over = 0;

    const empty = () => Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    function draw7(){
      if (!bag.length) bag = KINDS.slice().sort(() => Math.random() - 0.5);
      return bag.pop();
    }
    const fallTime = () => Math.max(0.05, 0.8 * Math.pow(0.85, level - 1));

    function fits(kind, r, px, py){
      return cellsOf(kind, r).every(([x, y]) => {
        const gx = px + x, gy = py + y;
        return gx >= 0 && gx < COLS && gy < ROWS && (gy < 0 || !grid[gy][gx]);
      });
    }
    function spawn(kind){
      piece = { kind, r: 0, x: 3, y: kind === "I" ? -1 : 0 };
      fallT = 0; lockT = 0;
      if (!fits(piece.kind, piece.r, piece.x, piece.y)) gameOver();
    }
    function nextPiece(){
      next.push(draw7());
      spawn(next.shift());
      held = false;
    }

    /* ----- moving ----- */
    function move(dx){
      if (!piece || clearing) return;
      if (fits(piece.kind, piece.r, piece.x + dx, piece.y)) { piece.x += dx; lockT = 0; }
    }
    function turn(dir){
      if (!piece || clearing) return;
      const r = piece.r + dir;
      // try in place, then nudged sideways or up a little ("wall kicks")
      for (const [kx, ky] of [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]]) {
        if (fits(piece.kind, r, piece.x + kx, piece.y + ky)) { piece.r = r; piece.x += kx; piece.y += ky; lockT = 0; Fun.sfx.pop(); return; }
      }
    }
    function ghostY(){ let y = piece.y; while (fits(piece.kind, piece.r, piece.x, y + 1)) y++; return y; }
    function hardDrop(){
      if (!piece || clearing) return;
      const y = ghostY();
      score += 2 * (y - piece.y);
      piece.y = y;
      lock();
      Fun.sfx.thunk();
    }
    function holdPiece(){
      if (!piece || held || clearing) return;
      const k = piece.kind;
      if (hold) spawn(hold); else nextPiece();
      hold = k; held = true;
      Fun.sfx.whoosh();
    }

    /* ----- landing and clearing rows ----- */
    function lock(){
      cellsOf(piece.kind, piece.r).forEach(([x, y]) => { if (piece.y + y >= 0) grid[piece.y + y][piece.x + x] = SHAPES[piece.kind].colour; });
      const above = cellsOf(piece.kind, piece.r).some(([, y]) => piece.y + y < 0);
      piece = null;
      if (above) { gameOver(); return; }
      const full = grid.map((row, i) => row.every(Boolean) ? i : -1).filter(i => i >= 0);
      if (full.length) {
        clearing = { rows: full, t: 0 };
        const n = full.length;
        score += POINTS[n] * level; rows += n;
        store.blockRows = (store.blockRows || 0) + n;
        if (n === 4) { store.blockBlast = true; Fun.sfx.tada(); Hub.confettiBurst(canvas); } else Fun.sfx.ding();
        fx.pop(WORDS[n], W / 2, BY + full[0] * T, n === 4 ? "#ff4dd2" : "#ffe14d", n === 4 ? 40 : 30);
        full.forEach(i => { for (let x = 0; x < COLS; x++) fx.burst(BX + (x + 0.5) * T, BY + (i + 0.5) * T, grid[i][x], 3, 120); });
        const lv = Math.floor(rows / 10) + 1;
        if (lv > level) { level = lv; store.blockLevel = Math.max(store.blockLevel || 0, level); fx.pop("LEVEL " + level + "!", W / 2, H / 2, "#7df9ff", 38); }
        Hub.checkBadges();
      } else nextPiece();
    }
    function finishClear(){
      grid = grid.filter((row, i) => !clearing.rows.includes(i));
      while (grid.length < ROWS) grid.unshift(Array(COLS).fill(null));
      clearing = null;
      nextPiece();
    }
    function gameOver(){
      running = false; piece = null; over = 1;
      Fun.sfx.wah();
      const wasBest = score > (store.blockBest || 0);
      if (wasBest) store.blockBest = score;
      Hub.saveStore(); Hub.checkBadges();
      setTimeout(() => {
        if (!isOpen) return;
        panelTitle.textContent = "🧱 Game over!";
        panelText.textContent = `You cleared ${rows} row${rows === 1 ? "" : "s"}, reached level ${level} and scored ${score}.`
          + (wasBest ? " That's a new best! 🎉" : ` Your best is ${store.blockBest || 0}.`);
        playBtn.textContent = "▶ Play again"; panel.hidden = false;
        if (wasBest) Hub.confettiBurst(playBtn);
        playBtn.focus();
      }, 900);
    }

    /* ----- drawing ----- */
    function cell(x, y, colour, size, alpha){
      ctx.globalAlpha = alpha === undefined ? 1 : alpha;
      ctx.fillStyle = colour; ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
      ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(x + 1, y + 1, size - 2, size * 0.22);
      ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.fillRect(x + 1, y + size * 0.78, size - 2, size * 0.22 - 1);
      ctx.globalAlpha = 1;
    }
    function mini(kind, cx, cy){
      if (!kind) return;
      const s = 18, cells = cellsOf(kind, 0), xs = cells.map(c => c[0]), ys = cells.map(c => c[1]);
      const w = (Math.max(...xs) - Math.min(...xs) + 1) * s, h = (Math.max(...ys) - Math.min(...ys) + 1) * s;
      cells.forEach(([x, y]) => cell(cx - w / 2 + (x - Math.min(...xs)) * s, cy - h / 2 + (y - Math.min(...ys)) * s, SHAPES[kind].colour, s, held && kind === hold ? 0.45 : 1));
    }
    function box(x, y, w, h, title){
      ctx.fillStyle = "rgba(255,255,255,0.07)"; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = "#fff"; ctx.font = "800 15px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(title, x + w / 2, y + 14);
    }
    function draw(dt){
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#1b1035"); g.addColorStop(1, "#0d1b3a");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // the well
      ctx.fillStyle = "#0a0a18"; ctx.fillRect(BX, BY, COLS * T, ROWS * T);
      ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = 1;
      for (let x = 1; x < COLS; x++) { ctx.beginPath(); ctx.moveTo(BX + x * T, BY); ctx.lineTo(BX + x * T, BY + ROWS * T); ctx.stroke(); }
      for (let y = 1; y < ROWS; y++) { ctx.beginPath(); ctx.moveTo(BX, BY + y * T); ctx.lineTo(BX + COLS * T, BY + y * T); ctx.stroke(); }
      // the rainbow frame
      const rim = ctx.createLinearGradient(BX, 0, BX + COLS * T, 0);
      ["#ff4d6d", "#ff9f1c", "#ffe14d", "#4dd96b", "#4db8ff", "#b26bff"].forEach((c, i) => rim.addColorStop(i / 5, c));
      ctx.strokeStyle = rim; ctx.lineWidth = 4; ctx.strokeRect(BX - 2, BY - 2, COLS * T + 4, ROWS * T + 4);
      // the blocks already landed (full rows flash white before they vanish)
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const c = grid[y][x]; if (!c) continue;
        const flash = clearing && clearing.rows.includes(y);
        cell(BX + x * T, BY + y * T, flash && Math.floor(clearing.t * 16) % 2 ? "#fff" : c, T, over ? 0.5 : 1);
      }
      if (piece) {
        // the ghost, where it will land
        const gy = ghostY();
        cellsOf(piece.kind, piece.r).forEach(([x, y]) => {
          if (gy + y < 0) return;
          ctx.strokeStyle = SHAPES[piece.kind].colour; ctx.lineWidth = 2; ctx.globalAlpha = 0.6;
          ctx.strokeRect(BX + (piece.x + x) * T + 3, BY + (gy + y) * T + 3, T - 6, T - 6); ctx.globalAlpha = 1;
        });
        cellsOf(piece.kind, piece.r).forEach(([x, y]) => { if (piece.y + y >= 0) cell(BX + (piece.x + x) * T, BY + (piece.y + y) * T, SHAPES[piece.kind].colour, T); });
      }
      // hold on the left, next on the right
      box(14, BY, 120, 92, "HOLD"); mini(hold, 74, BY + 54);
      box(W - 134, BY, 120, 250, "NEXT");
      next.forEach((k, i) => mini(k, W - 74, BY + 62 + i * 70));
      ctx.fillStyle = "#fff"; ctx.font = "700 13px system-ui"; ctx.textAlign = "center";
      if (store.blockBest) ctx.fillText(`🏆 Best ${store.blockBest}`, 74, BY + 120);
      if (paused) {
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(BX, BY, COLS * T, ROWS * T);
        ctx.fillStyle = "#fff"; ctx.font = "900 34px 'Bricolage Grotesque', sans-serif"; ctx.fillText("PAUSED", W / 2, H / 2);
      }
      fx.draw(ctx, dt);
    }

    function loop(now){
      if (!isOpen) return;
      const dt = Fun.dt(now, last, 0.05); last = now; clock += dt;
      if (running && !paused) {
        if (clearing) { clearing.t += dt; if (clearing.t > 0.35) finishClear(); }
        else if (piece) {
          fallT += dt;
          const every = soft ? Math.min(0.04, fallTime()) : fallTime();
          while (piece && fallT >= every) {
            fallT -= every;
            if (fits(piece.kind, piece.r, piece.x, piece.y + 1)) { piece.y++; lockT = 0; if (soft) score += 1; }
            else break;
          }
          // a short moment to slide it after it touches down
          if (piece && !fits(piece.kind, piece.r, piece.x, piece.y + 1)) { lockT += dt; if (lockT > 0.5) lock(); }
        }
      }
      over = Math.max(0, over - dt * 0.5);
      draw(dt);
      $("bdScore").textContent = "⭐ " + score;
      $("bdRows").textContent = "🧱 " + rows;
      $("bdLevel").textContent = "Level " + level;
      requestAnimationFrame(loop);
    }

    /* ----- controls ----- */
    // holding ← or → slides the shape along after a short wait
    let slide = 0, slideT = 0;
    function act(a, on){
      if (!running || paused) { if (a === "down" && !on) soft = false; return; }
      if (a === "left" || a === "right") { if (on) { move(a === "left" ? -1 : 1); slide = a === "left" ? -1 : 1; slideT = -0.17; } else if (slide === (a === "left" ? -1 : 1)) slide = 0; }
      else if (a === "down") soft = on;
      else if (on && a === "turn") turn(1);
      else if (on && a === "back") turn(-1);
      else if (on && a === "drop") hardDrop();
      else if (on && a === "hold") holdPiece();
    }
    setInterval(() => {
      if (!slide || !running || paused) return;
      slideT += 0.05;
      if (slideT >= 0) move(slide);
    }, 50);
    const KEYMAP = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowDown: "down", KeyS: "down",
      ArrowUp: "turn", KeyX: "turn", KeyW: "turn", KeyZ: "back", Space: "drop", KeyC: "hold", ShiftLeft: "hold", ShiftRight: "hold" };
    window.addEventListener("keydown", e => {
      if (!isOpen) return;
      if (e.key === "Escape") { Hub.leave(); return; }
      if (e.code === "KeyP" && running) { paused = !paused; return; }
      const a = KEYMAP[e.code]; if (!a) return;
      e.preventDefault();
      if (e.repeat && a !== "down") return;
      act(a, true);
    });
    window.addEventListener("keyup", e => { const a = KEYMAP[e.code]; if (a) act(a, false); });
    window.addEventListener("blur", () => { slide = 0; soft = false; });
    host.querySelectorAll("[data-bd]").forEach(b => {
      const a = b.dataset.bd;
      b.addEventListener("pointerdown", e => { e.preventDefault(); b.setPointerCapture(e.pointerId); act(a, true); });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach(n => b.addEventListener(n, () => act(a, false)));
    });
    // on the well: tap to turn, swipe sideways to move, swipe down to drop
    let touch = null;
    canvas.addEventListener("pointerdown", e => { touch = { x: e.clientX, y: e.clientY, moved: false }; });
    canvas.addEventListener("pointermove", e => {
      if (!touch || !running) return;
      const cw = canvas.getBoundingClientRect().width / W * T, dx = e.clientX - touch.x;
      if (Math.abs(dx) > cw) { move(dx > 0 ? 1 : -1); touch.x = e.clientX; touch.moved = true; }
      if (e.clientY - touch.y > cw * 4 && !touch.moved) { hardDrop(); touch = null; }
    });
    canvas.addEventListener("pointerup", () => { if (touch && !touch.moved) act("turn", true); touch = null; });
    canvas.tabIndex = 0;

    function start(){
      grid = empty(); bag = []; next = [draw7(), draw7(), draw7()]; hold = null; held = false;
      score = 0; rows = 0; level = 1; soft = false; slide = 0; clearing = null; paused = false; over = 0;
      fx.clear();
      running = true; panel.hidden = true;
      nextPiece();
      canvas.focus();
    }
    function openGame(){
      isOpen = true; running = false; paused = false;
      grid = empty(); piece = null; next = []; hold = null;
      Fun.screen(overlay, true);
      panelTitle.textContent = "🧱 Block Drop";
      panelText.textContent = "Rainbow blocks fall from the top. Slide and turn them to fill a whole row, and the row vanishes! Clear 4 rows at once for a BLOCK BLAST. Every 10 rows the blocks fall faster. Don't let them stack up to the top!"
        + (store.blockBest ? ` Your best: ${store.blockBest}.` : "");
      playBtn.textContent = "▶ Play"; panel.hidden = false;
      last = performance.now(); requestAnimationFrame(loop);
      playBtn.focus();
    }
    function closeGame(){ isOpen = false; running = false; slide = 0; soft = false; Fun.screen(overlay, false); }

    playBtn.addEventListener("click", start);
    $("bdCloseBtn").addEventListener("click", () => Hub.leave());
    Fun.soundButton($("bdCloseBtn"));
    return { open: openGame, close: closeGame };
  }
})();
