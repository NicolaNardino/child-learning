/* Quantum Lab: quantum physics for curious 11-year-olds, by doing experiments.
   Five labs, each with a short story, an experiment to play with, missions, where it's used in real life,
   and a few questions to finish the chapter: energy steps in atoms, the quantum coin (superposition and
   interference), the double slit, tunnelling through walls, and entangled twins with a real Bell test.
   Then a quiz. Everything is drawn on canvases; the numbers follow the real rules of quantum physics. */
(function(){
  "use strict";
  const store = Hub.store;
  const Q = () => (store.quantum = store.quantum || { done: {}, missions: {}, quizBest: 0, spooky: false });

  const doneCount = () => LABS.filter(l => Q().done[l.id]).length;

  Hub.register({
    id: "quantum", section: "learning", title: "Quantum Lab", icon: "⚛️",
    blurb: "Quantum physics by doing experiments: atoms, quantum coins, the double slit, tunnelling and spooky entangled twins.",
    stat: () => doneCount() ? `${doneCount()} of 5 labs` : "",
    badges: [
      { id: "qmFirst",  icon: "🔬", name: "Quantum Curious",  desc: "Finish your first Quantum Lab",           test: () => doneCount() >= 1 },
      { id: "qmAll",    icon: "⚛️", name: "Quantum Explorer", desc: "Finish all five Quantum Labs",             test: () => doneCount() >= 5 },
      { id: "qmSpooky", icon: "🔗", name: "Spooky Action",    desc: "Do a real Bell test with 100 entangled pairs", test: () => !!Q().spooky },
      { id: "qmQuiz",   icon: "🧠", name: "Quantum Whiz",     desc: "Score 9 or 10 in the Quantum Quiz",        test: () => (Q().quizBest || 0) >= 9 }
    ],
    mount
  });

  /* ---------------- little helpers ---------------- */
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pct = (k, n) => n ? Math.round(100 * k / n) + "%" : "–";
  const W = 720;     // every lab canvas is 720 wide inside; it's scaled to fit

  // the colour of light of a wavelength (in nanometres), as rgb
  function waveColour(nm){
    let r = 0, g = 0, b = 0;
    if (nm < 440) { r = -(nm - 440) / 60; b = 1; }
    else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
    else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
    else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
    else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
    else { r = 1; }
    const f = nm < 420 ? 0.4 + 0.6 * (nm - 400) / 20 : nm > 680 ? 0.4 + 0.6 * (700 - nm) / 20 : 1;
    const c = v => Math.round(255 * Math.pow(Math.max(0, v) * f, 0.8));
    return `rgb(${c(r)},${c(g)},${c(b)})`;
  }
  function glow(ctx, x, y, r, colour, a){
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, colour); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = a === undefined ? 1 : a;
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }
  function text(ctx, s, x, y, size, colour, align, weight){
    ctx.font = `${weight || 700} ${size}px "Karla", system-ui, sans-serif`;
    ctx.fillStyle = colour; ctx.textAlign = align || "center"; ctx.textBaseline = "middle";
    ctx.fillText(s, x, y);
  }
  function bg(ctx, h){
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#0b1030"); g.addColorStop(1, "#141b45");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, h);
    // a few faint stars, always in the same places
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    for (let i = 0; i < 40; i++) ctx.fillRect((i * 173) % W, (i * 97) % h, 1.5, 1.5);
  }

  /* ================= Lab 1: the atom's staircase ================= */
  // energies of the steps (in electron-volts, like the real hydrogen lines you can see)
  const STEPS = [0, 1.89, 2.55, 2.86];
  function labAtom(box, api){
    const H = 320, { ctx } = api.canvas(H);
    box.insertAdjacentHTML("beforeend", `
      <div class="qm-controls">
        <label class="qm-slider"><span>Colour of the light</span><input type="range" min="400" max="700" step="1" value="580" data-k="wave"></label>
        <div class="qm-readout" data-k="out"></div>
        <div class="qm-buttons">
          <button class="btn" type="button" data-k="fire">💡 Shoot a photon</button>
          <button class="btn ghost" type="button" data-k="burst">🔦 Shoot 10 at once</button>
        </div>
      </div>`);
    const $ = k => box.querySelector(`[data-k="${k}"]`);
    const slider = $("wave"), out = $("out");
    const AX = 210, AY = 160, RAD = [34, 60, 86, 110];
    let level = 0, upT = 0, ang = 0, flash = 0, lastJump = null;
    const photons = [];
    const energy = nm => 1240 / nm;
    function readout(){
      const nm = +slider.value;
      out.innerHTML = `<span class="qm-swatch" style="background:${waveColour(nm)}"></span>${nm} nm · energy <b>${energy(nm).toFixed(2)}</b>`;
    }
    slider.addEventListener("input", readout); readout();
    function shoot(n){
      const nm = +slider.value, e = energy(nm);
      for (let i = 0; i < n; i++) photons.push({ x: 20 - i * 16, y: AY + (n > 1 ? (Math.random() - 0.5) * 30 : 0), vx: 340, vy: 0, nm, e, out: false, a: 1 });
      if (n > 1 && !STEPS.some(s => s > 0 && Math.abs(s - e) < 0.035)) api.done("bright");
    }
    $("fire").addEventListener("click", () => shoot(1));
    $("burst").addEventListener("click", () => shoot(10));

    function frame(dt){
      ang += dt * 2.6 / (level + 1);
      flash = Math.max(0, flash - dt * 2);
      if (level > 0) {
        upT += dt;
        if (upT > 1.3) {   // it falls back down and sends out light of the same colour
          const e = STEPS[level], nm = 1240 / e, a = Math.random() * 6.28;
          photons.push({ x: AX, y: AY, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, nm, e, out: true, a: 1 });
          lastJump = { from: level, to: 0, nm, t: 0 };
          level = 0; flash = 0.6;
        }
      }
      if (lastJump) lastJump.t += dt;
      for (let i = photons.length - 1; i >= 0; i--) {
        const p = photons[i], wasLeft = p.x < AX;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (!p.out && wasLeft && p.x >= AX) {
          const j = STEPS.findIndex((s, k) => k > level && Math.abs(s - STEPS[level] - p.e) < 0.035);
          if (j > 0) {
            lastJump = { from: level, to: j, nm: p.nm, t: 0 };
            level = j; upT = 0; flash = 1;
            photons.splice(i, 1);
            api.done("jump" + j);
            continue;
          }
        }
        if (p.x > 380 || p.x < -40 || p.y < -20 || p.y > H + 20) { p.a -= dt * 3; if (p.a <= 0 || p.x > 420) photons.splice(i, 1); }
      }

      bg(ctx, H);
      // the atom: a nucleus and the steps around it
      RAD.forEach((r, k) => { ctx.strokeStyle = k === level ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.16)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(AX, AY, r, 0, 7); ctx.stroke(); });
      glow(ctx, AX, AY, 26, "rgba(255,120,80,0.8)");
      ctx.fillStyle = "#ff7a50"; ctx.beginPath(); ctx.arc(AX, AY, 9, 0, 7); ctx.fill();
      if (flash > 0) glow(ctx, AX, AY, 120, lastJump ? waveColour(lastJump.nm) : "#fff", flash * 0.5);
      const ex = AX + Math.cos(ang) * RAD[level], ey = AY + Math.sin(ang) * RAD[level];
      glow(ctx, ex, ey, 16, "rgba(110,200,255,0.9)");
      ctx.fillStyle = "#bfe8ff"; ctx.beginPath(); ctx.arc(ex, ey, 6, 0, 7); ctx.fill();
      // the light gun
      ctx.fillStyle = "#3a4370"; ctx.fillRect(4, AY - 12, 26, 24);
      ctx.fillStyle = waveColour(+slider.value); ctx.fillRect(28, AY - 6, 8, 12);
      // photons are little wiggles
      photons.forEach(p => {
        const c = waveColour(p.nm), len = 22, sp = Math.hypot(p.vx, p.vy), ux = p.vx / sp, uy = p.vy / sp;
        ctx.globalAlpha = Math.max(0, p.a);
        ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.beginPath();
        for (let s = 0; s <= len; s += 2) {
          const w = Math.sin(s / len * Math.PI * 4 + p.x * 0.1) * 4;
          const x = p.x - ux * s - uy * w, y = p.y - uy * s + ux * w;
          if (s) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke(); ctx.globalAlpha = 1;
      });
      // the staircase on the right
      const LX0 = 440, LX1 = 690, yOf = e => 285 - e / 3.0 * 230;
      text(ctx, "Energy steps", (LX0 + LX1) / 2, 22, 15, "#cfd6ff");
      STEPS.forEach((e, k) => {
        const y = yOf(e);
        ctx.strokeStyle = k === level ? "#ffd84d" : "rgba(255,255,255,0.6)"; ctx.lineWidth = k === level ? 3 : 2;
        ctx.beginPath(); ctx.moveTo(LX0 + 40, y); ctx.lineTo(LX1, y); ctx.stroke();
        text(ctx, `Step ${k + 1}`, LX0 + 34, y, 13, "#cfd6ff", "right");
        text(ctx, e.toFixed(2), LX1, y - 9, 11, "rgba(255,255,255,0.6)", "right", 600);
      });
      if (lastJump && lastJump.t < 2.5) {
        const x = LX0 + 110, y1 = yOf(STEPS[lastJump.from]), y2 = yOf(STEPS[lastJump.to]);
        ctx.strokeStyle = waveColour(lastJump.nm); ctx.lineWidth = 3; ctx.globalAlpha = Math.max(0, 1 - lastJump.t / 2.5);
        ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
        const d = y2 < y1 ? -1 : 1;
        ctx.beginPath(); ctx.moveTo(x - 6, y2 - d * 9); ctx.lineTo(x, y2); ctx.lineTo(x + 6, y2 - d * 9); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = "#bfe8ff"; ctx.beginPath(); ctx.arc(LX0 + 170, yOf(STEPS[level]) - 7, 6, 0, 7); ctx.fill();
    }
    return { frame };
  }

  /* ================= Lab 2: the quantum coin ================= */
  function labCoin(box, api){
    const H = 280, { ctx } = api.canvas(H);
    box.insertAdjacentHTML("beforeend", `
      <div class="qm-recipe" data-k="recipe"></div>
      <div class="qm-buttons">
        <button class="btn" type="button" data-g="H" title="Hadamard gate">🌀 H: spin it</button>
        <button class="btn" type="button" data-g="X" title="X gate">🔄 X: flip it</button>
        <button class="btn" type="button" data-g="Z" title="Z gate">➖ Z: secret minus</button>
        <button class="btn qm-look" type="button" data-k="look">👀 Look!</button>
      </div>
      <div class="qm-buttons">
        <button class="btn ghost" type="button" data-k="hundred">🔁 Do it 100 times</button>
        <button class="btn ghost" type="button" data-k="reset">↺ Start again with Heads</button>
      </div>
      <div class="qm-tally" data-k="tally"></div>`);
    const $ = k => box.querySelector(`[data-k="${k}"]`);
    let a = 1, b = 0, recipe = [], looked = null, lookedAgain = false, t = 0, flipAnim = 0;
    const S = Math.SQRT1_2;
    function gate(g, s){
      if (g === "H") return [(s[0] + s[1]) * S, (s[0] - s[1]) * S];
      if (g === "X") return [s[1], s[0]];
      if (g === "Z") return [s[0], -s[1]];
      return s;
    }
    const clean = v => Math.abs(v) < 1e-9 ? 0 : Math.abs(Math.abs(v) - 1) < 1e-9 ? Math.sign(v) : v;
    function renderRecipe(){
      $("recipe").innerHTML = "<span>Your recipe:</span> 🪙 Heads " + recipe.map(g => `<b>→ ${g === "M" ? "👀" : g}</b>`).join(" ");
    }
    box.querySelectorAll("[data-g]").forEach(btn => btn.addEventListener("click", () => {
      [a, b] = gate(btn.dataset.g, [a, b]).map(clean);
      recipe.push(btn.dataset.g); looked = null; flipAnim = 1;
      renderRecipe();
    }));
    function look(){
      const pHeads = a * a;
      const heads = Math.random() < pHeads;
      if (looked && !lookedAgain && recipe[recipe.length - 1] === "M") { lookedAgain = true; api.done("again"); }
      if (pHeads > 0.001 && pHeads < 0.999) api.done("spin");
      checkPuzzles(pHeads);
      [a, b] = heads ? [1, 0] : [0, 1];
      looked = heads ? "Heads" : "Tails";
      recipe.push("M"); renderRecipe();
    }
    function checkPuzzles(pHeads){
      const gates = recipe.filter(g => g !== "M").join("");
      if (gates.includes("HH") && pHeads > 0.999 && !recipe.includes("M")) api.done("hh");
      if (pHeads < 0.001 && !recipe.includes("X") && recipe.includes("Z") && !recipe.includes("M")) api.done("hzh");
    }
    $("look").addEventListener("click", look);
    $("reset").addEventListener("click", () => { a = 1; b = 0; recipe = []; looked = null; lookedAgain = false; renderRecipe(); $("tally").innerHTML = ""; });
    $("hundred").addEventListener("click", () => {
      // make a fresh coin 100 times, follow the recipe, and look at the end
      let heads = 0;
      for (let n = 0; n < 100; n++) {
        let s = [1, 0];
        recipe.forEach(g => {
          if (g === "M") s = Math.random() < s[0] * s[0] ? [1, 0] : [0, 1];
          else s = gate(g, s);
        });
        if (Math.random() < s[0] * s[0]) heads++;
      }
      let s = [1, 0]; recipe.forEach(g => { if (g !== "M") s = gate(g, s); });
      if (!recipe.includes("M")) { checkPuzzles(clean(s[0]) ** 2); if (s[0] * s[0] > 0.001 && s[0] * s[0] < 0.999) api.done("spin"); }
      $("tally").innerHTML = `<b>100 coins with your recipe:</b>
        <div class="qm-bar"><span>Heads</span><i style="width:${heads}%"></i><b>${heads}</b></div>
        <div class="qm-bar"><span>Tails</span><i class="t" style="width:${100 - heads}%"></i><b>${100 - heads}</b></div>`;
    });
    renderRecipe();

    function frame(dt){
      t += dt; flipAnim = Math.max(0, flipAnim - dt * 3);
      bg(ctx, H);
      const pH = a * a, both = pH > 0.001 && pH < 0.999;
      // the coin: spinning while it's both, still when it's one of them
      const cx = 170, cy = 140, r = 88;
      let sx = 1, face = pH > 0.5 ? "H" : "T";
      if (both) { sx = Math.cos(t * 9); face = sx > 0 ? "H" : "T"; }
      else if (flipAnim > 0) sx = Math.cos(flipAnim * Math.PI);
      ctx.save(); ctx.translate(cx, cy); ctx.scale(Math.max(0.04, Math.abs(sx)), 1);
      const cg = ctx.createRadialGradient(-20, -25, 10, 0, 0, r);
      cg.addColorStop(0, face === "H" ? "#ffe9a0" : "#d8e6ff"); cg.addColorStop(1, face === "H" ? "#c99a2e" : "#6f86b8");
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, r - 8, 0, 7); ctx.stroke();
      ctx.font = "800 64px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillText(face, 0, 4);
      ctx.restore();
      if (both) { glow(ctx, cx, cy, 140, "rgba(150,120,255,0.35)"); text(ctx, "Spinning: heads AND tails at once", cx, 258, 14, "#cfd6ff"); }
      else text(ctx, looked ? `You looked: ${looked}!` : (pH > 0.5 ? "Heads, for sure" : "Tails, for sure"), cx, 258, 15, "#ffd84d");
      // the arrows (amplitudes) and the chances
      const bars = [["Heads", a, "#ffd84d"], ["Tails", b, "#8fb4ff"]];
      text(ctx, "Arrows (amplitudes)", 515, 22, 14, "#cfd6ff");
      ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(380, 130); ctx.lineTo(690, 130); ctx.stroke();
      text(ctx, "+", 372, 70, 16, "rgba(255,255,255,0.5)"); text(ctx, "–", 372, 190, 16, "rgba(255,255,255,0.5)");
      bars.forEach(([name, amp, col], i) => {
        const x = 450 + i * 150, len = amp * 90;
        ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 7; ctx.lineCap = "round";
        if (Math.abs(len) > 1) {
          ctx.beginPath(); ctx.moveTo(x, 130); ctx.lineTo(x, 130 - len); ctx.stroke();
          const d = Math.sign(len);
          ctx.beginPath(); ctx.moveTo(x - 12, 130 - len + d * 12); ctx.lineTo(x, 130 - len - d * 4); ctx.lineTo(x + 12, 130 - len + d * 12); ctx.closePath(); ctx.fill();
        } else { ctx.beginPath(); ctx.arc(x, 130, 4, 0, 7); ctx.fill(); }
        ctx.lineCap = "butt";
        text(ctx, name, x, 236, 15, col);
        text(ctx, `chance ${Math.round(amp * amp * 100)}%`, x, 258, 13, "#cfd6ff", "center", 600);
      });
    }
    return { frame };
  }

  /* ================= Lab 3: the double slit ================= */
  function labSlits(box, api){
    const H = 330, { ctx } = api.canvas(H);
    box.insertAdjacentHTML("beforeend", `
      <div class="qm-buttons">
        <div class="segmented" role="group" aria-label="What to shoot" data-k="mode">
          <button type="button" data-m="electron" aria-pressed="true">⚛️ Electrons</button>
          <button type="button" data-m="ball" aria-pressed="false">🎾 Tennis balls</button>
        </div>
        <button class="btn ghost" type="button" data-k="watch" aria-pressed="false">👁 Watch the slits: off</button>
      </div>
      <div class="qm-buttons">
        <button class="btn" type="button" data-k="one">Shoot 1</button>
        <button class="btn" type="button" data-k="stream">▶ Shoot lots</button>
        <button class="btn ghost" type="button" data-k="clear">🧽 Clean the screen</button>
        <span class="qm-count mono" data-k="count"></span>
      </div>`);
    const $ = k => box.querySelector(`[data-k="${k}"]`);
    let mode = "electron", watch = false, streaming = false, acc = 0;
    const SX = 40, SY = 165, BX = 280, GAP = 30, SCX = 600, HALF = 140, BINS = 56;
    let hits = [], bins = new Array(BINS).fill(0), flying = [];
    const sinc = x => Math.abs(x) < 1e-6 ? 1 : Math.sin(x) / x;
    // where on the screen it lands, u from -1 (top) to 1 (bottom), using the real wave rules
    function landing(){
      if (mode === "ball") { const s = Math.random() < 0.5 ? -1 : 1; return { u: s * 0.47 + gauss() * 0.06, slit: s }; }
      for (;;) {
        const u = Math.random() * 2 - 1;
        const s1 = sinc(3.2 * (u - 0.22)), s2 = sinc(3.2 * (u + 0.22));
        const I = watch ? (s1 * s1 + s2 * s2) : (s1 * s1 + s2 * s2 + 2 * s1 * s2 * Math.cos(20 * u));
        if (Math.random() * 4 < I) {
          // when you watch, you see which slit it came through
          const slit = watch ? (Math.random() * (s1 * s1 + s2 * s2) < s1 * s1 ? 1 : -1) : 0;
          return { u, slit };
        }
      }
    }
    function gauss(){ return Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * Math.cos(6.283 * Math.random()); }
    function shoot(){
      const l = landing();
      flying.push({ t: 0, u: l.u, slit: l.slit, kind: mode });
    }
    function land(f){
      if (Math.abs(f.u) > 1) return;
      hits.push({ u: f.u, x: Math.random() });
      if (hits.length > 4000) hits.shift();
      bins[Math.min(BINS - 1, Math.floor((f.u + 1) / 2 * BINS))]++;
      const n = hits.length;
      if (mode === "electron" && !watch && n >= 200) api.done("stripes");
      if (mode === "electron" && watch && n >= 150) api.done("watch");
      if (mode === "ball" && n >= 150) api.done("balls");
    }
    function clear(){ hits = []; bins = new Array(BINS).fill(0); flying = []; }
    box.querySelectorAll("[data-m]").forEach(btn => btn.addEventListener("click", () => {
      mode = btn.dataset.m;
      box.querySelectorAll("[data-m]").forEach(b => b.setAttribute("aria-pressed", String(b === btn)));
      $("watch").disabled = mode === "ball";
      clear();
    }));
    $("watch").addEventListener("click", () => {
      watch = !watch; clear();
      $("watch").setAttribute("aria-pressed", String(watch));
      $("watch").textContent = "👁 Watch the slits: " + (watch ? "ON" : "off");
    });
    $("one").addEventListener("click", shoot);
    $("stream").addEventListener("click", () => { streaming = !streaming; $("stream").textContent = streaming ? "⏸ Stop" : "▶ Shoot lots"; });
    $("clear").addEventListener("click", clear);

    function frame(dt){
      if (streaming) { acc += dt * 40; while (acc >= 1) { acc--; shoot(); } }
      for (let i = flying.length - 1; i >= 0; i--) { flying[i].t += dt * 2.2; if (flying[i].t >= 1) { land(flying[i]); flying.splice(i, 1); } }
      $("count").textContent = `${hits.length} landed`;

      bg(ctx, H);
      // the gun, the wall with two slits, the screen
      ctx.fillStyle = "#3a4370"; ctx.fillRect(10, SY - 14, 30, 28);
      ctx.fillStyle = "#6b78b8";
      ctx.fillRect(BX - 5, 10, 10, SY - GAP - 6 - 10);
      ctx.fillRect(BX - 5, SY - GAP + 6, 10, 2 * GAP - 12);
      ctx.fillRect(BX - 5, SY + GAP + 6, 10, H - 10 - (SY + GAP + 6));
      if (watch && mode === "electron") { text(ctx, "👁", BX + 22, SY - GAP, 16, "#fff"); text(ctx, "👁", BX + 22, SY + GAP, 16, "#fff"); }
      ctx.fillStyle = "#0a0d22"; ctx.fillRect(SCX - 8, SY - HALF - 6, 16, 2 * HALF + 12);
      ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.strokeRect(SCX - 8, SY - HALF - 6, 16, 2 * HALF + 12);
      // ripples from both slits while a quantum particle is on its way and nobody watches
      if (mode === "electron" && !watch && flying.length) {
        ctx.strokeStyle = "rgba(120,190,255,0.12)"; ctx.lineWidth = 2;
        const ph = (performance.now() / 12) % 30;
        [-1, 1].forEach(s => { for (let r = ph; r < 330; r += 30) { ctx.beginPath(); ctx.arc(BX, SY + s * GAP, r, -1.2, 1.2); ctx.stroke(); } });
      }
      const dotCol = mode === "ball" ? "#d7f04a" : "#7fd0ff";
      // flying things
      flying.forEach(f => {
        let x, y;
        const ty = SY + f.u * HALF, sy = SY + (f.slit || 0) * GAP;
        if (f.t < 0.45) { const k = f.t / 0.45; x = SX + (BX - SX) * k; y = SY + (sy - SY) * k; }
        else { const k = (f.t - 0.45) / 0.55; x = BX + (SCX - BX) * k; y = sy + (ty - sy) * k; }
        if (mode === "electron" && !watch && f.t < 0.45) glow(ctx, x, y, 12, "rgba(127,208,255,0.7)");
        else if (mode === "electron" && !watch) glow(ctx, x, y, 10, "rgba(127,208,255,0.35)");
        else { ctx.fillStyle = dotCol; ctx.beginPath(); ctx.arc(x, y, mode === "ball" ? 5 : 3.5, 0, 7); ctx.fill(); }
      });
      // where they landed
      ctx.fillStyle = dotCol;
      hits.forEach(h => ctx.fillRect(SCX - 6 + h.x * 11, SY + h.u * HALF - 1, 2, 2));
      // and how many landed where
      const max = Math.max(5, ...bins), bh = 2 * HALF / BINS;
      ctx.fillStyle = mode === "ball" ? "rgba(215,240,74,0.75)" : "rgba(127,208,255,0.75)";
      bins.forEach((c, i) => ctx.fillRect(SCX + 14, SY - HALF + i * bh, c / max * 95, bh - 0.5));
      text(ctx, "Screen", SCX, 14, 12, "#cfd6ff");
      text(ctx, "How many", SCX + 60, 14, 12, "#cfd6ff");
    }
    return { frame };
  }

  /* ================= Lab 4: through the wall ================= */
  function labTunnel(box, api){
    const H = 270, { ctx } = api.canvas(H);
    box.insertAdjacentHTML("beforeend", `
      <div class="qm-controls">
        <label class="qm-slider"><span>Wall thickness</span><input type="range" min="1" max="5" step="1" value="2" data-k="thick"></label>
        <div class="qm-readout" data-k="chance"></div>
      </div>
      <div class="qm-buttons">
        <button class="btn" type="button" data-k="ball">⚽ Roll a ball</button>
        <button class="btn" type="button" data-k="electron">⚛️ Send an electron</button>
        <button class="btn ghost" type="button" data-k="many">Send 100 electrons</button>
      </div>
      <div class="qm-tally" data-k="tally"></div>`);
    const $ = k => box.querySelector(`[data-k="${k}"]`);
    const GY = 220, WX = 340, WALL_H = 130;
    let thick = 2, movers = [], leak = 0;
    const count = { ball: [0, 0], electron: [0, 0] };   // [sent, through]
    const chance = w => Math.exp(-1.2 * w);
    const wallW = () => 12 + thick * 14;
    function show(){
      $("chance").innerHTML = `Chance an electron gets through: about <b>${(chance(thick) * 100).toFixed(chance(thick) < 0.01 ? 1 : 0)}%</b>`;
      $("tally").innerHTML = `⚽ Balls: ${count.ball[0]} rolled, <b>${count.ball[1]}</b> got through · ⚛️ Electrons: ${count.electron[0]} sent, <b>${count.electron[1]}</b> got through (${pct(count.electron[1], count.electron[0])})`;
    }
    $("thick").addEventListener("input", () => { thick = +$("thick").value; count.electron = [0, 0]; show(); });
    function send(kind, animate){
      const through = kind === "electron" && Math.random() < chance(thick);
      count[kind][0]++; if (through) count[kind][1]++;
      if (through) api.done("through");
      if (kind === "ball" && count.ball[0] >= 5) api.done("balls");
      if (kind === "electron" && thick >= 4 && count.electron[0] >= 100) api.done("thick");
      if (animate) movers.push({ kind, x: 30, dir: 1, through, a: 1, hit: false });
      show();
    }
    $("ball").addEventListener("click", () => send("ball", true));
    $("electron").addEventListener("click", () => send("electron", true));
    $("many").addEventListener("click", () => { for (let i = 0; i < 100; i++) send("electron", i < 4); });
    show();

    function frame(dt){
      leak = Math.max(0, leak - dt * 1.5);
      const ww = wallW();
      movers.forEach(m => {
        m.x += m.dir * (m.kind === "ball" ? 260 : 300) * dt;
        if (!m.hit && m.dir > 0 && m.x > WX - 14) {
          m.hit = true;
          if (m.kind === "electron") leak = 1;
          if (m.through) m.x = WX + ww + 14; else m.dir = -1;
        }
        if (m.x < 0 || m.x > W) m.a -= dt * 3;
      });
      movers = movers.filter(m => m.a > 0 && m.x > -30);

      bg(ctx, H);
      ctx.fillStyle = "#2a3366"; ctx.fillRect(0, GY, W, H - GY);
      // the wall, and the electron's wave leaking into it, getting weaker
      ctx.fillStyle = "#7a5a3a"; ctx.fillRect(WX, GY - WALL_H, ww, WALL_H);
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      for (let y = GY - WALL_H + 16; y < GY; y += 16) { ctx.beginPath(); ctx.moveTo(WX, y); ctx.lineTo(WX + ww, y); ctx.stroke(); }
      if (leak > 0) {
        const g = ctx.createLinearGradient(WX, 0, WX + ww, 0);
        g.addColorStop(0, `rgba(127,208,255,${0.8 * leak})`); g.addColorStop(1, `rgba(127,208,255,${0.8 * leak * chance(thick)})`);
        ctx.fillStyle = g; ctx.fillRect(WX, GY - 70, ww, 50);
      }
      text(ctx, "Too high to jump over!", WX + ww / 2, GY - WALL_H - 16, 13, "#cfd6ff");
      text(ctx, "🏁 Made it!", W - 70, 30, 15, "#7bd68a");
      movers.forEach(m => {
        ctx.globalAlpha = Math.max(0, m.a);
        if (m.kind === "ball") {
          ctx.fillStyle = "#ff9f43"; ctx.beginPath(); ctx.arc(m.x, GY - 13, 13, 0, 7); ctx.fill();
          ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(m.x, GY - 13, 13, m.x / 13, m.x / 13 + 2); ctx.stroke();
        } else {
          glow(ctx, m.x, GY - 45, 22, "rgba(127,208,255,0.9)", Math.max(0, m.a));
          ctx.strokeStyle = "rgba(127,208,255,0.6)"; ctx.lineWidth = 2; ctx.beginPath();
          for (let s = -30; s <= 30; s += 2) { const y = GY - 45 + Math.sin(s * 0.5 + m.x * 0.2) * 9 * Math.exp(-(s * s) / 300); if (s === -30) ctx.moveTo(m.x + s, y); else ctx.lineTo(m.x + s, y); }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      });
    }
    return { frame };
  }

  /* ================= Lab 5: spooky twins (entanglement and a Bell test) ================= */
  function labTwins(box, api){
    const H = 260, { ctx } = api.canvas(H);
    const dialRow = who => `<div class="qm-dials"><span>${who}'s dial:</span>${[1, 2, 3].map(n => `<button type="button" class="qm-dial" data-who="${who}" data-v="${n}">${n}</button>`).join("")}<button type="button" class="qm-dial" data-who="${who}" data-v="0">🎲 random</button></div>`;
    box.insertAdjacentHTML("beforeend", `
      <div class="qm-buttons">
        <div class="segmented" role="group" aria-label="What kind of twins" data-k="mode">
          <button type="button" data-m="quantum" aria-pressed="true">🔗 Entangled twins</button>
          <button type="button" data-m="plan" aria-pressed="false">📝 Twins with a secret plan</button>
        </div>
      </div>
      <div class="qm-plan" data-k="planbox" hidden>
        <span>The secret plan both twins carry: if the dial says…</span>
        <div class="qm-buttons">${[0, 1, 2].map(i => `<button type="button" class="btn ghost small" data-plan="${i}"></button>`).join("")}</div>
      </div>
      ${dialRow("Alice")}${dialRow("Bob")}
      <div class="qm-buttons">
        <button class="btn" type="button" data-k="one">✨ Send 1 pair</button>
        <button class="btn" type="button" data-k="hundred">✨ Send 100 pairs</button>
        <button class="btn ghost" type="button" data-k="reset">↺ Reset the count</button>
        <button class="btn ghost" type="button" data-k="robot">🤖 Check every secret plan</button>
      </div>
      <div class="qm-tally" data-k="tally"></div>
      <div class="qm-tally" data-k="robotOut" hidden></div>`);
    const $ = k => box.querySelector(`[data-k="${k}"]`);
    let mode = "quantum", dial = { Alice: 1, Bob: 1 }, plan = [true, false, true];   // true = green
    let tally = null, pair = null, history = [], best = { quantum: null, plan: null };
    const resetTally = () => { tally = { n: 0, same: 0, sd: 0, sdSame: 0, dd: 0, ddSame: 0, random: true }; };
    resetTally();

    function renderControls(){
      box.querySelectorAll("[data-m]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.m === mode)));
      $("planbox").hidden = mode !== "plan";
      box.querySelectorAll("[data-plan]").forEach(b => { const i = +b.dataset.plan; b.textContent = `Dial ${i + 1} → ${plan[i] ? "🟢 green" : "🔴 red"}`; });
      box.querySelectorAll(".qm-dial").forEach(b => b.setAttribute("aria-pressed", String(dial[b.dataset.who] === +b.dataset.v)));
    }
    function renderTally(){
      const t = tally;
      let s = `<b>${t.n}</b> pairs · same colour <b>${t.same}</b> times (<b>${pct(t.same, t.n)}</b>)`;
      if (t.sd || t.dd) s += `<br>Dials the same: ${t.sdSame} of ${t.sd} matched (${pct(t.sdSame, t.sd)}) · Dials different: ${t.ddSame} of ${t.dd} matched (${pct(t.ddSame, t.dd)})`;
      if (best.quantum !== null || best.plan !== null) {
        s += `<div class="qm-compare">`;
        if (best.plan !== null) s += `<div class="qm-bar"><span>📝 Secret plan</span><i class="t" style="width:${best.plan}%"></i><b>${best.plan}%</b></div>`;
        if (best.quantum !== null) s += `<div class="qm-bar"><span>🔗 Entangled</span><i style="width:${best.quantum}%"></i><b>${best.quantum}%</b></div>`;
        s += `<small>Same colour, with both dials random (100 pairs or more). The dashed line is 5 out of 9 (56%).</small></div>`;
      }
      $("tally").innerHTML = s;
    }
    box.querySelectorAll("[data-m]").forEach(b => b.addEventListener("click", () => { mode = b.dataset.m; resetTally(); history = []; renderControls(); renderTally(); }));
    box.querySelectorAll("[data-plan]").forEach(b => b.addEventListener("click", () => { plan[+b.dataset.plan] = !plan[+b.dataset.plan]; resetTally(); renderControls(); renderTally(); }));
    box.querySelectorAll(".qm-dial").forEach(b => b.addEventListener("click", () => { dial[b.dataset.who] = +b.dataset.v; resetTally(); renderControls(); renderTally(); }));

    // one pair: the dials are set after the twins have flown apart, then both are measured
    function measure(){
      const sa = dial.Alice || 1 + Math.floor(Math.random() * 3), sb = dial.Bob || 1 + Math.floor(Math.random() * 3);
      let A, B;
      if (mode === "quantum") {
        // entangled: Alice's light is 50/50. Bob's matches always on the same dial, and 1 time in 4 on different dials
        A = Math.random() < 0.5;
        B = sa === sb ? A : (Math.random() < 0.25 ? A : !A);
      } else { A = plan[sa - 1]; B = plan[sb - 1]; }
      const t = tally; t.n++;
      if (A === B) t.same++;
      if (sa === sb) { t.sd++; if (A === B) t.sdSame++; } else { t.dd++; if (A === B) t.ddSame++; }
      t.random = t.random && !dial.Alice && !dial.Bob;
      history.push({ sa, sb, A, B }); if (history.length > 14) history.shift();
      if (mode === "quantum" && t.sd >= 10) api.done("same");
      if (t.random && t.n >= 100) {
        const p = Math.round(100 * t.same / t.n);
        if (mode === "quantum") { best.quantum = p; api.done("bell"); if (!Q().spooky) { Q().spooky = true; Hub.saveStore(); Hub.checkBadges(); } }
        else { best.plan = best.plan === null ? p : Math.min(best.plan, p); api.done("plan"); }
      }
      return { sa, sb, A, B };
    }
    $("one").addEventListener("click", () => { const r = measure(); pair = { t: 0, ...r }; renderTally(); });
    $("hundred").addEventListener("click", () => { let r; for (let i = 0; i < 100; i++) r = measure(); pair = { t: 0.99, ...r }; renderTally(); });
    $("reset").addEventListener("click", () => { resetTally(); history = []; renderTally(); });
    $("robot").addEventListener("click", () => {
      // try all 8 plans on all 9 dial pairs: how often would the colours match?
      let rows = "";
      for (let m = 0; m < 8; m++) {
        const p = [!!(m & 4), !!(m & 2), !!(m & 1)];
        let same = 0;
        for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) if (p[x] === p[y]) same++;
        rows += `<tr><td>${p.map(g => g ? "🟢" : "🔴").join("")}</td><td>${same} of 9</td><td><b>${Math.round(same / 9 * 100)}%</b></td></tr>`;
      }
      $("robotOut").hidden = false;
      $("robotOut").innerHTML = `<b>🤖 Every secret plan, with random dials:</b><table class="qm-table"><tr><th>Plan for dials 1 2 3</th><th>Match</th><th></th></tr>${rows}</table>
        Every plan matches at least <b>5 times out of 9 (56%)</b>. Entangled twins match only <b>50%</b> of the time, yet always match on the same dial. No secret plan can do that!`;
      api.done("robot");
    });
    renderControls(); renderTally();

    function frame(dt){
      bg(ctx, H);
      const CX = 360, CY = 110, AXp = 95, BXp = 625;
      glow(ctx, CX, CY, 30, "rgba(200,140,255,0.8)");
      text(ctx, "Twin maker", CX, CY + 40, 12, "#cfd6ff");
      // the two detectors with their dials and lamps
      [["Alice", AXp, "🌍 on Earth", "sa", "A"], ["Bob", BXp, "🪐 near Saturn", "sb", "B"]].forEach(([who, x, where, sk, rk]) => {
        ctx.fillStyle = "#273061"; ctx.fillRect(x - 60, CY - 55, 120, 110);
        ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.strokeRect(x - 60, CY - 55, 120, 110);
        text(ctx, who, x, CY - 72, 15, "#fff"); text(ctx, where, x, CY + 72, 12, "#cfd6ff", "center", 600);
        const set = pair ? pair[sk] : (dial[who] || 0);
        // the dial: three marks, the arrow on the setting
        [1, 2, 3].forEach(n => { const a = -Math.PI / 2 + (n - 1) * 2.094; ctx.fillStyle = "rgba(255,255,255,0.6)"; text(ctx, String(n), x - 25 + Math.cos(a) * 24, CY + Math.sin(a) * 24, 11, "#cfd6ff"); });
        ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.beginPath(); ctx.arc(x - 25, CY, 14, 0, 7); ctx.stroke();
        if (set) { const a = -Math.PI / 2 + (set - 1) * 2.094; ctx.strokeStyle = "#ffd84d"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 25, CY); ctx.lineTo(x - 25 + Math.cos(a) * 13, CY + Math.sin(a) * 13); ctx.stroke(); ctx.lineWidth = 1; }
        else text(ctx, "🎲", x - 25, CY, 14, "#fff");
        const lit = pair && pair.t >= 1 ? (pair[rk] ? "#4fdc6a" : "#ff5a5a") : "#3a3f55";
        if (pair && pair.t >= 1) glow(ctx, x + 25, CY, 30, lit);
        ctx.fillStyle = lit; ctx.beginPath(); ctx.arc(x + 25, CY, 14, 0, 7); ctx.fill();
      });
      // the twins flying apart, joined by a wiggly line when they're entangled
      if (pair && pair.t < 1) {
        pair.t = Math.min(1, pair.t + dt * 1.4);
        const ax = CX + (AXp + 60 - CX) * pair.t, bx = CX + (BXp - 60 - CX) * pair.t;
        if (mode === "quantum") {
          ctx.strokeStyle = "rgba(200,140,255,0.6)"; ctx.lineWidth = 2; ctx.beginPath();
          for (let x = ax; x <= bx; x += 4) { const y = CY + Math.sin(x * 0.08 + performance.now() / 80) * 6; if (x === ax) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
          ctx.stroke();
        }
        [ax, bx].forEach(x => { glow(ctx, x, CY, 16, "rgba(220,170,255,0.95)"); if (mode === "plan") text(ctx, "📝", x, CY - 20, 14, "#fff"); });
      }
      // the last few results
      text(ctx, "Last pairs (dial numbers and colours):", 20, 210, 12, "#cfd6ff", "left", 600);
      history.forEach((h, i) => {
        const x = 30 + i * 49, y = 236;
        ctx.fillStyle = h.A ? "#4fdc6a" : "#ff5a5a"; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill();
        ctx.fillStyle = h.B ? "#4fdc6a" : "#ff5a5a"; ctx.beginPath(); ctx.arc(x + 17, y, 7, 0, 7); ctx.fill();
        text(ctx, `${h.sa}·${h.sb}`, x + 8, y + 16, 10, "rgba(255,255,255,0.7)", "center", 600);
      });
    }
    return { frame };
  }

  /* ================= the five labs: story, missions, real life, questions ================= */
  const LABS = [
    {
      id: "atom", icon: "🪜", label: "Energy steps", title: "The atom's staircase",
      story: `<p>Everything is made of <b>atoms</b>: you, your bed, the air. They are so tiny that a million of them side by side would be thinner than a hair. In this tiny world, things work very differently from our big world. That's what <b>quantum physics</b> is about.</p>
        <p>Inside an atom, tiny <b>electrons</b> zoom around the middle. But an electron can't be just anywhere: it can only stand on certain <b>steps</b>, like on a staircase. Never in between!</p>
        <p>Light comes in tiny packets called <b>photons</b>. Each colour has its own energy: red photons have less, blue photons have more. An electron only jumps up a step if a photon brings <i>exactly</i> the right energy.</p>`,
      lab: labAtom,
      missions: [
        { id: "jump1", text: "Find the red colour that lifts the electron to step 2." },
        { id: "jump2", text: "Find the colour that lifts it to step 3. (Hint: blue-green.)" },
        { id: "jump3", text: "Find the colour that lifts it to step 4. (Hint: deep blue.)" },
        { id: "bright", text: "Shoot 10 photons of a wrong colour at once. Does more light help?" }
      ],
      real: "This is why neon signs and fireworks glow in their own colours: every kind of atom has its own staircase, so it gives out its own colours of light. Scientists can tell what faraway stars are made of just from their colours!",
      checks: [
        { q: "Bright yellow light doesn't make the electron jump, but a single red photon does. Why?", a: "Only a photon with exactly the right energy for a step works", w: ["Red light is brighter than yellow", "Electrons only like the colour red", "Yellow photons are too slow"], why: "The electron needs exactly the energy of one step. Lots of photons with the wrong energy don't add up." },
        { q: "Which photon has more energy?", a: "A blue photon", w: ["A red photon", "They are the same", "It depends on how bright it is"], why: "Blue and violet light have more energy per photon than red light." },
        { q: "Where can an electron in an atom be?", a: "Only on certain steps (energy levels)", w: ["Anywhere it likes", "Only in the very middle", "Only outside the atom"], why: "Energy in atoms comes in steps. The word 'quantum' means a fixed amount, like one step." }
      ]
    },
    {
      id: "coin", icon: "🪙", label: "Quantum coin", title: "The quantum coin",
      story: `<p>Imagine a magic coin. When you spin it, it's not heads <i>or</i> tails: it's a bit of <b>both at once</b>. That is called a <b>superposition</b>. Only when you <b>look</b> does it pick one, at random.</p>
        <p>In quantum physics every possibility has an invisible <b>arrow</b> (scientists say <i>amplitude</i>). The chance of seeing it is the arrow's length squared. And here's the magic: arrows can point <b>up</b> (+) or <b>down</b> (–). When a plus arrow and a minus arrow meet, they <b>cancel out</b>!</p>
        <p>Quantum computers use coins like this, called <b>qubits</b>. The buttons are the moves a quantum computer can make: <b>H</b> spins the coin, <b>X</b> flips it over, and <b>Z</b> secretly turns the tails arrow upside down.</p>`,
      lab: labCoin,
      missions: [
        { id: "spin", text: "Spin the coin with H, then look. Do it a few times: what do you get?" },
        { id: "again", text: "After looking, look again without any moves. Does it change?" },
        { id: "hh", text: "Spin it TWICE (H, H) and look, or do it 100 times. A surprise!" },
        { id: "hzh", text: "Puzzle: make it land on tails every time, using only H and Z. No flipping!" }
      ],
      real: "Quantum computers are built from qubits like this coin. Because the arrows can cancel out, a clever recipe can make the wrong answers cancel and the right answer get stronger. Big companies and universities, including ETH Zurich, are building them right now.",
      checks: [
        { q: "A quantum coin is in a superposition (spinning). What happens when you look?", a: "It becomes heads or tails, at random", w: ["It always shows heads", "You see both sides at once", "It disappears"], why: "Looking (measuring) makes it choose. Before that, it really is both." },
        { q: "You spin a quantum coin twice (H then H) and look. What do you get?", a: "Always heads", w: ["Heads or tails, 50/50", "Always tails", "The coin breaks"], why: "The two ways to get tails have a plus and a minus arrow, so they cancel out. That's called interference." },
        { q: "What is a qubit?", a: "A quantum bit that can be 0 and 1 at the same time", w: ["A very small coin", "A computer virus", "A part of an atom"], why: "A normal bit is 0 or 1. A qubit can be in a superposition of both, until you measure it." }
      ]
    },
    {
      id: "slits", icon: "🌊", label: "Wave or particle?", title: "The double slit",
      story: `<p>This is the most famous experiment in quantum physics. We shoot things one at a time at a wall with <b>two slits</b>, and see where they land on a screen behind it.</p>
        <p>Tennis balls go through one slit or the other, so they make <b>two stripes</b>. Now try electrons, one at a time. Each one lands in <b>one single spot</b>, like a tiny ball. But after many, a pattern of <b>lots of stripes</b> appears. That's the pattern <b>waves</b> make when they go through both slits and meet!</p>
        <p>So each electron goes through <b>both slits at once</b>, like a wave. But if you <b>watch</b> which slit it takes… try it and see what happens to the stripes!</p>`,
      lab: labSlits,
      missions: [
        { id: "stripes", text: "Shoot at least 200 electrons and look at the stripes." },
        { id: "watch", text: "Turn on 'Watch the slits' and shoot 150 electrons. What happens to the stripes?" },
        { id: "balls", text: "Shoot 150 tennis balls. How is it different?" }
      ],
      real: "The famous scientist Richard Feynman said this experiment holds 'the only mystery' of quantum physics. It works with light, electrons, atoms, and even big molecules made of 2000 atoms!",
      checks: [
        { q: "In the double-slit experiment, each single electron lands…", a: "in one spot, like a tiny ball", w: ["spread out over the whole screen", "in two places at once", "nowhere at all"], why: "Each electron makes one dot. The stripes only appear after many dots." },
        { q: "What happens to the stripes when you watch which slit each electron goes through?", a: "They disappear", w: ["They get brighter", "They turn into circles", "Nothing changes"], why: "When you find out which slit it took, it can't go through both anymore, so the waves can't meet and make stripes." },
        { q: "Where do the stripes come from?", a: "Waves from both slits adding up in some places and cancelling in others", w: ["Electrons bumping into each other", "Dirt on the screen", "The gun shaking"], why: "Where the waves meet top to top, they add up (bright). Where top meets bottom, they cancel (dark). That's interference." }
      ]
    },
    {
      id: "tunnel", icon: "👻", label: "Through walls", title: "Through the wall",
      story: `<p>Roll a ball at a wall that's too high to jump over, and it bounces back. Always. Every single time.</p>
        <p>But an electron isn't just a tiny ball: it's also a wave. When its wave hits the wall, a little bit of the wave <b>leaks into the wall</b>, getting weaker and weaker. If the wall is thin enough, a tiny bit comes out on the other side. That means there's a small <b>chance</b> the electron simply appears on the other side!</p>
        <p>This is called <b>quantum tunnelling</b>. The thicker the wall, the smaller the chance.</p>`,
      lab: labTunnel,
      missions: [
        { id: "balls", text: "Roll 5 balls at the wall. Does any get through?" },
        { id: "through", text: "Send electrons until one tunnels through the wall." },
        { id: "thick", text: "Make the wall thickness 4 or 5 and send 100 electrons. How many make it?" }
      ],
      real: "Without tunnelling, the Sun wouldn't shine! Inside the Sun, tiny particles tunnel through a wall that pushes them apart, so they can join together and make light and heat. The memory in USB sticks and phones also stores data using electrons that tunnel. And a microscope that uses tunnelling can even see single atoms.",
      checks: [
        { q: "Can an electron get through a wall it doesn't have enough energy to climb over?", a: "Sometimes, with a small chance. That's tunnelling", w: ["Never", "Always", "Only if it's a red electron"], why: "Its wave leaks through the wall, so there's a chance to find it on the other side." },
        { q: "What happens to the chance when the wall gets thicker?", a: "It gets much smaller", w: ["It gets bigger", "It stays the same", "It becomes 100%"], why: "The wave gets weaker and weaker inside the wall, so a thick wall lets almost nothing through." },
        { q: "Which of these needs quantum tunnelling?", a: "The Sun shining", w: ["A ball bouncing", "Ice melting", "A rainbow"], why: "In the Sun, particles tunnel close enough to fuse together and release energy." }
      ]
    },
    {
      id: "twins", icon: "🔗", label: "Spooky twins", title: "Entanglement: the spooky twins",
      story: `<p>Two particles can be made as <b>entangled twins</b>. Send one to Alice on Earth and one to Bob far, far away. Each of them turns a dial to 1, 2 or 3 and measures: a lamp shows <span class="qm-g">green</span> or <span class="qm-r">red</span>.</p>
        <p>Each lamp alone is completely random, like a coin. But when both dials are on the <b>same number</b>, the twins <b>always show the same colour</b>, however far apart they are! Albert Einstein called this <b>"spooky action at a distance"</b>.</p>
        <p>Einstein thought there must be a simpler reason: maybe the twins carry a <b>secret plan</b>, like "if the dial is 1, show green". Is he right? In 1964, John Bell found a test: with <b>random dials</b>, <i>every</i> secret plan matches the colours at least <b>5 times out of 9 (56%)</b>. Run the test yourself and see what real entangled twins do!</p>`,
      lab: labTwins,
      missions: [
        { id: "same", text: "Put both dials on the same number and send at least 10 entangled pairs. Do they match?" },
        { id: "plan", text: "Switch to 'secret plan', make any plan, set both dials to 🎲 random, and send 100 pairs." },
        { id: "bell", text: "Now the real Bell test: entangled twins, both dials 🎲 random, 100 pairs. Do they beat 56%?" },
        { id: "robot", text: "Ask the robot to check every possible secret plan." }
      ],
      real: "In 2022, Alain Aspect, John Clauser and Anton Zeilinger won the Nobel Prize in Physics for doing this test with real light. Near Geneva, scientists sent entangled light through cables to villages more than 10 km apart, and the twins still matched. Entanglement is used for super-secret codes that nobody can secretly listen in to. One important thing: Alice can't use it to send Bob a message faster than light, because what she sees is always random. They only find out how well it matched when they compare notes.",
      checks: [
        { q: "Two entangled twins are measured with the same dial setting. What do you see?", a: "Always the same colour", w: ["Always different colours", "The same colour about half the time", "No colour at all"], why: "Entangled twins always match on the same setting, even though each one alone is random." },
        { q: "With random dials, every secret plan matches at least 56% of the time. Entangled twins match only 50%. What does that show?", a: "The twins didn't carry a secret plan: they really decide when measured", w: ["The machine is broken", "Einstein was right", "The twins can talk to each other by phone"], why: "That's Bell's test. Real experiments show the 50%, so there is no hidden plan. Quantum physics really is that strange!" },
        { q: "Can Alice use entanglement to send Bob a message faster than light?", a: "No. Her results are random, so they carry no message", w: ["Yes, instantly", "Yes, but only short messages", "Only on Mars"], why: "Each side alone always looks like random coin flips. The connection only shows up when they compare their lists afterwards." }
      ]
    }
  ];
  const EXTRA_QUIZ = [
    { q: "Who called entanglement 'spooky action at a distance'?", a: "Albert Einstein", w: ["Isaac Newton", "Marie Curie", "Leonardo da Vinci"] },
    { q: "Quantum physics is mostly about…", a: "the world of very tiny things, like atoms and light", w: ["the weather", "very big things, like planets", "how plants grow"] },
    { q: "Schrödinger's cat is a famous thought experiment about…", a: "something being in two states at once until you look", w: ["cats that can see in the dark", "why cats always land on their feet", "teaching cats to count"] },
    { q: "What is a photon?", a: "A tiny packet of light", w: ["A part of a camera", "A kind of atom", "A small planet"] },
    { q: "In 2022 the Nobel Prize in Physics was won for experiments with…", a: "entangled photons", w: ["tennis balls", "rockets to Mars", "dinosaur bones"] }
  ];

  /* ================= the page ================= */
  function mount(host){
    host.innerHTML = `
    <div class="wrap qm">
      <header>
        <a class="back-link" href="#/learning">← Learning</a>
        <div class="wordmark"><h1>Quantum Lab</h1><span class="unit mono">/// physics of the very tiny</span></div>
        <p class="tagline">Hello! I'm Professor Whiskers 🐱, Schrödinger's cat. Let's do some real quantum experiments together!</p>
      </header>
      <nav class="line" aria-label="Labs"><div class="line-track" id="qmNav"></div></nav>
      <section class="page qm-page" id="qmPage"></section>
    </div>`;
    const nav = document.getElementById("qmNav"), page = document.getElementById("qmPage");
    let current = store.quantumLab || "atom", lab = null, open = false, last = 0, canvas = null;

    function renderNav(){
      nav.innerHTML = "";
      [...LABS, { id: "quiz", icon: "🧠", label: "Quiz" }].forEach(l => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "tick-btn";
        b.setAttribute("aria-pressed", String(l.id === current));
        b.innerHTML = `<span class="ring qm-ring">${Q().done[l.id] ? "✓" : l.icon}</span><span class="mark"></span><span class="label"></span>`;
        b.querySelector(".label").textContent = l.label;
        b.addEventListener("click", () => go(l.id));
        nav.appendChild(b);
      });
    }

    function go(id){
      current = id; store.quantumLab = id; Hub.saveStore();
      renderNav();
      lab = null; canvas = null;
      if (id === "quiz") renderQuiz(); else renderLab(LABS.find(l => l.id === id));
    }

    function makeApi(L){
      return {
        canvas(h){
          const c = document.createElement("canvas");
          c.className = "qm-canvas"; c.width = W; c.height = h;
          c.style.aspectRatio = `${W} / ${h}`;
          page.querySelector(".qm-labbox").prepend(c);
          canvas = { el: c, h, ctx: c.getContext("2d") };
          sizeCanvas();
          return { ctx: canvas.ctx };
        },
        done(mid){
          const key = L.id + ":" + mid;
          if (Q().missions[key]) return;
          Q().missions[key] = true; Hub.saveStore();
          const li = page.querySelector(`[data-mission="${mid}"]`);
          if (li) { li.classList.add("done"); li.querySelector(".qm-tick").textContent = "✓"; }
        }
      };
    }
    function sizeCanvas(){
      if (!canvas) return;
      const r = canvas.el.getBoundingClientRect();
      const k = Math.max(1, Math.min(2, (r.width || W) * (window.devicePixelRatio || 1) / W));
      canvas.el.width = Math.round(W * k); canvas.el.height = Math.round(canvas.h * k);
      canvas.ctx.setTransform(k, 0, 0, k, 0, 0);
    }
    window.addEventListener("resize", () => { if (open) sizeCanvas(); });

    function renderLab(L){
      const i = LABS.indexOf(L);
      page.innerHTML = `
        <div class="qm-title"><span class="qm-big">${L.icon}</span><div><span class="level-desc">Lab ${i + 1} of 5</span><h2></h2></div></div>
        <div class="qm-story">${L.story}</div>
        <div class="qm-labbox"></div>
        <div class="qm-missions"><h3>🎯 Missions</h3><ul>${L.missions.map(m => `<li data-mission="${m.id}" class="${Q().missions[L.id + ":" + m.id] ? "done" : ""}"><span class="qm-tick">${Q().missions[L.id + ":" + m.id] ? "✓" : "○"}</span><span></span></li>`).join("")}</ul></div>
        <div class="qm-real"><b>🌍 In real life:</b> <span></span></div>
        <div class="qm-checks"><h3>✏️ Check yourself</h3><div class="qm-qs"></div><div class="qm-finish" hidden></div></div>
        <div class="card-foot">
          <button class="btn ghost small" type="button" data-k="prev" ${i === 0 ? "disabled" : ""}>← Back</button>
          <button class="btn" type="button" data-k="next">${i === LABS.length - 1 ? "On to the quiz →" : "Next lab →"}</button>
        </div>`;
      page.querySelector("h2").textContent = L.title;
      L.missions.forEach((m, k) => { page.querySelectorAll(".qm-missions li")[k].lastElementChild.textContent = m.text; });
      page.querySelector(".qm-real span").textContent = L.real;
      page.querySelector('[data-k="prev"]').addEventListener("click", () => go(LABS[i - 1].id));
      page.querySelector('[data-k="next"]').addEventListener("click", () => go(i === LABS.length - 1 ? "quiz" : LABS[i + 1].id));
      lab = L.lab(page.querySelector(".qm-labbox"), makeApi(L));
      renderChecks(L);
      if (open) { last = performance.now(); }
    }

    // a question with tap-to-answer buttons; onRight is called once it's answered right
    function questionEl(c, n, onAnswer, oneTry){
      const el = document.createElement("div");
      el.className = "qm-q";
      el.innerHTML = `<p class="qm-qtext"><b>${n}.</b> <span></span></p><div class="choices wide"></div><div class="feedback"><div class="verdict"></div><div class="explain"></div></div>`;
      el.querySelector(".qm-qtext span").textContent = c.q;
      const box = el.querySelector(".choices"), fb = el.querySelector(".feedback");
      shuffle([c.a, ...c.w]).forEach(opt => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "choice"; b.textContent = opt;
        b.addEventListener("click", () => {
          const right = opt === c.a;
          b.classList.add(right ? "right" : "wrong");
          fb.className = "feedback show " + (right ? "correct" : "incorrect");
          fb.querySelector(".verdict").textContent = right ? "Right!" : (oneTry ? "Not quite. The answer is: " + c.a : "Not quite, try again!");
          fb.querySelector(".explain").textContent = right || oneTry ? (c.why || "") : "";
          if (right || oneTry) box.querySelectorAll("button").forEach(x => { x.disabled = true; if (x.textContent === c.a) x.classList.add("right"); });
          else b.disabled = true;
          onAnswer(right);
        });
        box.appendChild(b);
      });
      return el;
    }

    function renderChecks(L){
      const qs = page.querySelector(".qm-qs"), fin = page.querySelector(".qm-finish");
      let right = 0;
      L.checks.forEach((c, k) => qs.appendChild(questionEl(c, k + 1, ok => {
        if (!ok) return;
        right++;
        if (right === L.checks.length) {
          const first = !Q().done[L.id];
          Q().done[L.id] = true; Hub.saveStore(); Hub.checkBadges(); renderNav();
          fin.hidden = false;
          fin.innerHTML = `🎉 <b>Lab complete!</b> ${doneCount() === 5 ? "You've done all five labs: you're a real quantum explorer! Try the quiz." : `That's ${doneCount()} of 5 labs.`}`;
          if (first) Hub.confettiBurst(fin);
        }
      })));
      if (Q().done[L.id]) { fin.hidden = false; fin.innerHTML = "✓ You've finished this lab before. Answer again for practice!"; }
    }

    function renderQuiz(){
      const pool = shuffle([...LABS.flatMap(l => l.checks), ...EXTRA_QUIZ]).slice(0, 10);
      let k = 0, score = 0;
      page.innerHTML = `
        <div class="qm-title"><span class="qm-big">🧠</span><div><span class="level-desc">10 questions from all the labs${Q().quizBest ? ` · your best: ${Q().quizBest} / 10` : ""}</span><h2>The Quantum Quiz</h2></div></div>
        <div class="qm-quiz"></div>`;
      const box = page.querySelector(".qm-quiz");
      function next(){
        box.innerHTML = `<div class="level-desc">Question ${k + 1} of 10 · score ${score}</div>`;
        box.appendChild(questionEl(pool[k], k + 1, ok => {
          if (ok) score++;
          const b = document.createElement("button");
          b.type = "button"; b.className = "btn"; b.textContent = k === 9 ? "See my score" : "Next question →";
          b.addEventListener("click", () => { k++; if (k < 10) next(); else end(); });
          box.appendChild(b); b.focus();
        }, true));
      }
      function end(){
        const best = score > (Q().quizBest || 0);
        if (best) Q().quizBest = score;
        Hub.saveStore(); Hub.checkBadges();
        box.innerHTML = `<div class="qm-score"><div class="qm-big">${score >= 9 ? "🏆" : score >= 6 ? "⭐" : "🐱"}</div><h2>${score} / 10</h2>
          <p>${score >= 9 ? "Amazing! Professor Whiskers is very impressed." : score >= 6 ? "Great work! Visit the labs again to learn even more." : "Good try! Play with the labs again and come back."}${best ? " That's your new best!" : ""}</p>
          <button class="btn" type="button">↻ New quiz</button></div>`;
        box.querySelector("button").addEventListener("click", renderQuiz);
        if (score >= 9) Hub.confettiBurst(box.querySelector("h2"));
      }
      next();
    }

    function loop(now){
      if (!open) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (lab && canvas) lab.frame(dt);
      requestAnimationFrame(loop);
    }

    function openApp(){
      open = true; go(current);
      last = performance.now(); requestAnimationFrame(loop);
    }
    function closeApp(){ open = false; }
    return { open: openApp, close: closeApp };
  }
})();
