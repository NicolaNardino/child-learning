/* Quantum Lab: quantum physics for 11-year-olds, by playing with it. Professor Whiskers (a cat, of course)
   says a few words, and the rest is cartoons: an electron that hops up energy stairs, a cat-and-fish
   quantum coin, shy electrons in the double slit, a ghost electron that walks through walls, and
   entangled twins that do a real Bell test. Then a quiz.
   The numbers follow the real rules of quantum physics; the faces and the "BONK!"s are extra. */
(function(){
  "use strict";
  const store = Hub.store;
  const Q = () => (store.quantum = store.quantum || { done: {}, missions: {}, quizBest: 0, spooky: false });

  const doneCount = () => LABS.filter(l => Q().done[l.id]).length;

  Hub.register({
    id: "quantum", section: "learning", title: "Quantum Lab", icon: "⚛️",
    blurb: "Zap atoms, spin a cat-and-fish coin, catch shy electrons, walk through walls and test spooky twins.",
    stat: () => doneCount() ? `${doneCount()} of 5 labs` : "",
    badges: [
      { id: "qmFirst",  icon: "🔬", name: "Quantum Curious",  desc: "Finish your first Quantum Lab",            test: () => doneCount() >= 1 },
      { id: "qmAll",    icon: "⚛️", name: "Quantum Explorer", desc: "Finish all five Quantum Labs",              test: () => doneCount() >= 5 },
      { id: "qmSpooky", icon: "🔗", name: "Spooky Action",    desc: "Do a real Bell test with 100 entangled pairs", test: () => !!Q().spooky },
      { id: "qmQuiz",   icon: "🧠", name: "Quantum Whiz",     desc: "Score 9 or 10 in the Quantum Quiz",         test: () => (Q().quizBest || 0) >= 9 },
      { id: "qmNeon",   icon: "💡", name: "Neon Builder",     desc: "Build a neon atom: 10 out of 10 in the quiz", test: () => !!(Q().elements && Q().elements.Ne) }
    ],
    mount
  });

  /* ---------------- helpers ---------------- */
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pct = (k, n) => n ? Math.round(100 * k / n) + "%" : "–";
  const lerp = (a, b, k) => a + (b - a) * k;
  const W = 720;     // every lab canvas is 720 wide inside; it's scaled to fit

  // the colour of light of a wavelength (in nanometres)
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
    ctx.font = `${weight || 800} ${size}px "Bricolage Grotesque", "Karla", system-ui, sans-serif`;
    ctx.fillStyle = colour; ctx.textAlign = align || "center"; ctx.textBaseline = "middle";
    ctx.fillText(s, x, y);
  }
  // a dark sky with twinkling stars
  function bg(ctx, h, t){
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#0b1030"); g.addColorStop(1, "#1a1f52");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, h);
    for (let i = 0; i < 46; i++) {
      ctx.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * (1 + i % 3) + i));
      ctx.fillStyle = "#fff"; ctx.fillRect((i * 173) % W, (i * 97) % h, 2, 2);
    }
    ctx.globalAlpha = 1;
  }
  // a cartoon face: eyes that blink and look around, and a mouth for the mood
  function face(ctx, x, y, r, mood, t, lx, ly){
    const blink = Math.sin(t * 1.3 + x * 0.05) > 0.97 ? 0.15 : 1;
    const ex = r * 0.36, ey = -r * 0.12, er = r * 0.27;
    [-1, 1].forEach(s => {
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(x + s * ex, y + ey, er, er * blink, 0, 0, 7); ctx.fill();
      if (blink > 0.5) { ctx.fillStyle = "#1a1030"; ctx.beginPath(); ctx.arc(x + s * ex + (lx || 0) * er * 0.4, y + ey + (ly || 0) * er * 0.4, er * 0.52, 0, 7); ctx.fill(); }
    });
    ctx.strokeStyle = "#1a1030"; ctx.fillStyle = "#1a1030"; ctx.lineWidth = Math.max(1.5, r * 0.11); ctx.lineCap = "round"; ctx.beginPath();
    if (mood === "wow") { ctx.ellipse(x, y + r * 0.42, r * 0.15, r * 0.2, 0, 0, 7); ctx.fill(); }
    else if (mood === "sad") { ctx.arc(x, y + r * 0.62, r * 0.28, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke(); }
    else if (mood === "dizzy") { ctx.moveTo(x - r * 0.25, y + r * 0.42); ctx.quadraticCurveTo(x, y + r * 0.25, x + r * 0.25, y + r * 0.45); ctx.stroke(); }
    else { ctx.arc(x, y + r * 0.18, r * 0.32, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); }
    ctx.lineCap = "butt";
  }
  // a round little character: squash > 1 is squashed flat, < 1 is stretched tall
  function blob(ctx, x, y, r, colour, mood, t, squash, look){
    const sq = squash || 1;
    glow(ctx, x, y, r * 2, colour, 0.35);
    ctx.save(); ctx.translate(x, y); ctx.scale(sq, 1 / sq);
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, "#ffffff"); g.addColorStop(0.25, colour); g.addColorStop(1, colour);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    face(ctx, 0, 0, r, mood, t, look ? look[0] : 0, look ? look[1] : 0);
    ctx.restore();
  }

  /* ---------------- comic words and sparkles, drawn on top of a lab ---------------- */
  function makeFx(){
    const pops = [], bits = [];
    return {
      pop(s, x, y, colour, size){ pops.push({ s, x, y, colour: colour || "#ffd84d", size: size || 30, t: 0, rot: (Math.random() - 0.5) * 0.35 }); },
      burst(x, y, colour, n, speed){
        for (let i = 0; i < (n || 14); i++) {
          const a = Math.random() * 6.283, v = (speed || 120) * (0.4 + Math.random() * 0.8);
          bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 0.5 + Math.random() * 0.4, colour });
        }
      },
      draw(ctx, dt){
        for (let i = bits.length - 1; i >= 0; i--) {
          const b = bits[i]; b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 120 * dt;
          if (b.t > b.life) { bits.splice(i, 1); continue; }
          ctx.globalAlpha = 1 - b.t / b.life; ctx.fillStyle = b.colour;
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.t * 8); ctx.fillRect(-3, -3, 6, 6); ctx.restore();
        }
        ctx.globalAlpha = 1;
        for (let i = pops.length - 1; i >= 0; i--) {
          const p = pops[i]; p.t += dt;
          if (p.t > 1.3) { pops.splice(i, 1); continue; }
          const s = p.t < 0.12 ? p.t / 0.12 * 1.25 : p.t < 0.24 ? 1.25 - (p.t - 0.12) / 0.12 * 0.25 : 1;
          ctx.globalAlpha = p.t > 0.9 ? Math.max(0, 1 - (p.t - 0.9) / 0.4) : 1;
          ctx.save(); ctx.translate(p.x, p.y - p.t * 22); ctx.rotate(p.rot); ctx.scale(s, s);
          ctx.font = `900 ${p.size}px "Bricolage Grotesque", system-ui, sans-serif`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
          ctx.lineWidth = p.size * 0.2; ctx.strokeStyle = "#1a1030"; ctx.strokeText(p.s, 0, 0);
          ctx.fillStyle = p.colour; ctx.fillText(p.s, 0, 0);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }
    };
  }

  /* ---------------- sounds (made by the browser) ---------------- */
  let ac = null;
  function blip(f0, f1, dur, vol, type, delay){
    if (store.sound === false) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ac) ac = new AC();
    if (ac.state === "suspended") ac.resume();
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + (delay || 0);
    o.type = type || "sine";
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  const SFX = {
    zap: () => blip(1400, 300, 0.14, 0.12, "square"),
    boing: () => { blip(160, 520, 0.12, 0.2, "sine"); blip(520, 260, 0.15, 0.15, "sine", 0.12); },
    bonk: () => blip(180, 60, 0.18, 0.3, "triangle"),
    whoosh: () => blip(250, 1500, 0.3, 0.08, "sawtooth"),
    pop: () => blip(500, 1300, 0.07, 0.2, "sine"),
    nope: () => { blip(320, 300, 0.07, 0.1, "square"); blip(240, 220, 0.09, 0.1, "square", 0.09); },
    ding: () => { blip(1320, 1320, 0.25, 0.12, "sine"); blip(1760, 1760, 0.3, 0.1, "sine", 0.08); },
    tada: () => [523, 659, 784, 1047].forEach((n, i) => blip(n, n, 0.14, 0.1, "square", i * 0.08))
  };

  /* ================= Lab 1: Elly the electron and the energy stairs ================= */
  const STEPS = [0, 1.89, 2.55, 2.86];      // energies of the steps, like the real colours hydrogen glows in
  function labAtom(box, api){
    const H = 300, { ctx } = api.canvas(H), fx = api.fx;
    box.insertAdjacentHTML("beforeend", `
      <div class="qm-controls">
        <input class="qm-rainbow" type="range" min="400" max="700" step="1" value="580" data-k="wave" aria-label="Colour of the light">
        <div class="qm-readout" data-k="out"></div>
      </div>
      <div class="qm-buttons">
        <button class="btn" type="button" data-k="fire">🔦 Zap!</button>
        <button class="btn ghost" type="button" data-k="burst">🔦 Mega zap ×10</button>
      </div>`);
    const $ = k => box.querySelector(`[data-k="${k}"]`);
    const slider = $("wave"), out = $("out");
    const AX = 150, AY = 150, RAD = [30, 52, 74, 96];
    const SX0 = 380, SW = 80, BASE = 272, topY = k => 248 - STEPS[k] * 58;
    const standX = k => SX0 + k * SW + SW / 2;
    let level = 0, upT = 0, ang = 0, flash = 0, flashCol = "#fff", t = 0, lastNope = -9;
    const elly = { x: standX(0), y: topY(0) - 20, jump: null, squash: 1, shake: 0, mood: "happy" };
    const photons = [];
    const energy = nm => 1240 / nm;
    function readout(){
      const nm = +slider.value;
      out.innerHTML = `<span class="qm-swatch" style="background:${waveColour(nm)}"></span>⚡ ${energy(nm).toFixed(2)}`;
    }
    slider.addEventListener("input", readout); readout();
    function hop(to){
      elly.jump = { x0: elly.x, y0: elly.y, x1: standX(to), y1: topY(to) - 20, t: 0, up: to > 0 };
    }
    function shoot(n){
      const nm = +slider.value, e = energy(nm);
      for (let i = 0; i < n; i++) photons.push({ x: 40 - i * 18, y: AY + (n > 1 ? (Math.random() - 0.5) * 30 : 0), vx: 360, vy: 0, nm, e, out: false, a: 1 });
      SFX.pop();
      if (n > 1 && !STEPS.some(s => s > 0 && Math.abs(s - e) < 0.035)) { api.done("bright"); setTimeout(() => fx.pop("Still NOPE! 🙅", 545, 60, "#ff8a8a", 28), 500); }
    }
    $("fire").addEventListener("click", () => shoot(1));
    $("burst").addEventListener("click", () => shoot(10));

    function frame(dt){
      t += dt; ang += dt * 2.6 / (level + 1);
      flash = Math.max(0, flash - dt * 2); elly.shake = Math.max(0, elly.shake - dt);
      elly.squash += (1 - elly.squash) * Math.min(1, dt * 10);
      if (level > 0) {
        upT += dt;
        if (upT > 1.4) {   // it falls back down, and the energy comes out as light of the same colour
          const e = STEPS[level], nm = 1240 / e, a = Math.random() * 6.28;
          photons.push({ x: AX, y: AY, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, nm, e, out: true, a: 1 });
          level = 0; flash = 0.6; flashCol = waveColour(nm);
          hop(0); SFX.boing(); fx.pop("Boing!", elly.x, elly.y - 40, "#9fe0ff", 24);
        }
      }
      if (elly.jump) {
        const j = elly.jump; j.t += dt / 0.5;
        const k = Math.min(1, j.t);
        elly.x = lerp(j.x0, j.x1, k); elly.y = lerp(j.y0, j.y1, k) - Math.sin(k * Math.PI) * (j.up ? 70 : 30);
        elly.squash = 0.8;
        if (j.t >= 1) { elly.jump = null; elly.squash = 1.35; elly.mood = j.up ? "wow" : "happy"; }
      }
      for (let i = photons.length - 1; i >= 0; i--) {
        const p = photons[i], wasLeft = p.x < AX;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (!p.out && wasLeft && p.x >= AX) {
          const j = STEPS.findIndex((s, k) => k > level && Math.abs(s - STEPS[level] - p.e) < 0.035);
          if (j > 0) {
            level = j; upT = 0; flash = 1; flashCol = waveColour(p.nm);
            hop(j); SFX.zap();
            fx.pop(["WHEEE!", "ZAP!", "YAY!"][j - 1], elly.x + 30, elly.y - 50, "#ffd84d", 32);
            fx.burst(AX, AY, waveColour(p.nm), 16, 140);
            photons.splice(i, 1);
            api.done("jump" + j);
            continue;
          }
          if (t - lastNope > 0.8) { lastNope = t; elly.shake = 0.4; SFX.nope(); fx.pop("Nope!", elly.x, elly.y - 42, "#ff8a8a", 22); }
        }
        if (p.x > 340 || p.x < -40 || p.y < -20 || p.y > H + 20) { p.a -= dt * 4; if (p.a <= 0) photons.splice(i, 1); }
      }

      bg(ctx, H, t);
      // the atom: a jiggly nucleus and the electron's paths
      RAD.forEach((r, k) => { ctx.strokeStyle = k === level ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.15)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(AX, AY, r, r * 0.8, 0, 0, 7); ctx.stroke(); });
      if (flash > 0) glow(ctx, AX, AY, 130, flashCol, flash * 0.6);
      [[0, 0, "#ff6a5c"], [6, 4, "#b8c0d8"], [-5, 5, "#ff6a5c"], [3, -6, "#b8c0d8"], [-4, -4, "#ff6a5c"]].forEach(([dx, dy, c], i) => {
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(AX + dx + Math.sin(t * 9 + i) * 1.2, AY + dy + Math.cos(t * 8 + i) * 1.2, 6, 0, 7); ctx.fill();
      });
      const ex = AX + Math.cos(ang) * RAD[level], ey = AY + Math.sin(ang) * RAD[level] * 0.8;
      glow(ctx, ex, ey, 16, "rgba(110,200,255,0.9)");
      ctx.fillStyle = "#bfe8ff"; ctx.beginPath(); ctx.arc(ex, ey, 6, 0, 7); ctx.fill();
      // the flashlight
      ctx.save(); ctx.translate(18, AY); ctx.fillStyle = "#59617f"; ctx.fillRect(-14, -9, 30, 18);
      ctx.fillStyle = "#8790b5"; ctx.beginPath(); ctx.moveTo(16, -9); ctx.lineTo(28, -15); ctx.lineTo(28, 15); ctx.lineTo(16, 9); ctx.fill();
      ctx.fillStyle = waveColour(+slider.value); ctx.fillRect(27, -13, 4, 26); ctx.restore();
      // photons are little wiggles with a sparkle
      photons.forEach(p => {
        const c = waveColour(p.nm), len = 24, sp = Math.hypot(p.vx, p.vy), ux = p.vx / sp, uy = p.vy / sp;
        ctx.globalAlpha = Math.max(0, p.a);
        ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.beginPath();
        for (let s = 0; s <= len; s += 2) {
          const w = Math.sin(s / len * Math.PI * 4 + t * 30) * 5;
          const x = p.x - ux * s - uy * w, y = p.y - uy * s + ux * w;
          if (s) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke(); glow(ctx, p.x, p.y, 9, c, Math.max(0, p.a)); ctx.globalAlpha = 1;
      });
      // the stairs, with Elly on them
      STEPS.forEach((e, k) => {
        const x = SX0 + k * SW, y = topY(k);
        const g = ctx.createLinearGradient(0, y, 0, BASE);
        g.addColorStop(0, k === level ? "#8a7cff" : "#4b4f8f"); g.addColorStop(1, "#262a5c");
        ctx.fillStyle = g; ctx.fillRect(x, y, SW - 4, BASE - y);
        ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.fillRect(x, y, SW - 4, 4);
        text(ctx, String(k + 1), x + SW / 2 - 2, (y + BASE) / 2 + 6, 22, "rgba(255,255,255,0.35)");
      });
      text(ctx, "ENERGY STAIRS", SX0 + 2 * SW, 20, 15, "#cfd6ff");
      const sx = elly.shake > 0 ? Math.sin(t * 60) * 4 : 0;
      blob(ctx, elly.x + sx, elly.y, 18, "#5cc8ff", elly.shake > 0 ? "sad" : elly.mood, t, elly.squash, [0, 0.2]);
      fx.draw(ctx, dt);
    }
    return { frame };
  }

  /* ================= Lab 2: the cat-and-fish quantum coin ================= */
  function labCoin(box, api){
    const H = 280, { ctx } = api.canvas(H), fx = api.fx;
    box.insertAdjacentHTML("beforeend", `
      <div class="qm-recipe" data-k="recipe"></div>
      <div class="qm-buttons">
        <button class="btn" type="button" data-g="H">🌀 H: spin</button>
        <button class="btn" type="button" data-g="X">🔄 X: flip</button>
        <button class="btn" type="button" data-g="Z">➖ Z: sneaky minus</button>
        <button class="btn qm-look" type="button" data-k="look">👀 LOOK!</button>
      </div>
      <div class="qm-buttons">
        <button class="btn ghost" type="button" data-k="hundred">🔁 Try it 100 times</button>
        <button class="btn ghost" type="button" data-k="reset">↺ Start again</button>
      </div>
      <div class="qm-tally" data-k="tally"></div>`);
    const $ = k => box.querySelector(`[data-k="${k}"]`);
    let a = 1, b = 0, recipe = [], looked = null, lookedAgain = false, t = 0, flipAnim = 0, slam = 0;
    const disp = { a: 1, b: 0 }, cancels = [];
    const S = Math.SQRT1_2;
    const HX = 470, TX = 620, MID = 130;
    function gate(g, s){
      if (g === "H") return [(s[0] + s[1]) * S, (s[0] - s[1]) * S];
      if (g === "X") return [s[1], s[0]];
      if (g === "Z") return [s[0], -s[1]];
      return s;
    }
    const clean = v => Math.abs(v) < 1e-9 ? 0 : Math.abs(Math.abs(v) - 1) < 1e-9 ? Math.sign(v) : v;
    function renderRecipe(){
      $("recipe").innerHTML = "😺 " + recipe.map(g => `<b>→ ${g === "M" ? "👀" : g}</b>`).join(" ");
    }
    box.querySelectorAll("[data-g]").forEach(btn => btn.addEventListener("click", () => {
      const g = btn.dataset.g, before = [a, b];
      [a, b] = gate(g, [a, b]).map(clean);
      // a + arrow and a – arrow met and cancelled out
      [[0, HX], [1, TX]].forEach(([i, x]) => {
        if (g === "H" && Math.abs(before[0]) > 0.01 && Math.abs(before[1]) > 0.01 && Math.abs([a, b][i]) < 0.01) {
          cancels.push({ x, t: 0 }); fx.pop("POOF!", x, MID - 60, "#d9c8ff", 30); SFX.pop();
        }
      });
      if (g === "Z" && Math.abs(b) > 0.01) fx.pop("sneaky ➖", TX, MID + 70, "#9fb8ff", 18);
      if (g === "H") SFX.whoosh(); else SFX.pop();
      recipe.push(g); looked = null; flipAnim = 1;
      renderRecipe();
    }));
    function look(){
      const pHeads = a * a;
      const heads = Math.random() < pHeads;
      if (looked && !lookedAgain && recipe[recipe.length - 1] === "M") { lookedAgain = true; api.done("again"); }
      if (pHeads > 0.001 && pHeads < 0.999) api.done("spin");
      checkPuzzles(pHeads);
      [a, b] = heads ? [1, 0] : [0, 1];
      looked = heads ? "cat" : "fish";
      recipe.push("M"); renderRecipe();
      slam = 1; SFX.tada();
      fx.pop(heads ? "CAT! 😺" : "FISH! 🐟", 160, 40, heads ? "#ffd84d" : "#9fc4ff", 30);
      fx.burst(160, 140, heads ? "#ffd84d" : "#9fc4ff", 20, 180);
    }
    function checkPuzzles(pHeads){
      const gates = recipe.filter(g => g !== "M").join("");
      if (gates.includes("HH") && pHeads > 0.999 && !recipe.includes("M")) api.done("hh");
      if (pHeads < 0.001 && !recipe.includes("X") && recipe.includes("Z") && !recipe.includes("M")) api.done("hzh");
    }
    $("look").addEventListener("click", look);
    $("reset").addEventListener("click", () => { a = 1; b = 0; recipe = []; looked = null; lookedAgain = false; renderRecipe(); $("tally").innerHTML = ""; });
    $("hundred").addEventListener("click", () => {
      // 100 fresh coins, each following the recipe, then a look at the end
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
      if (!recipe.includes("M")) { const p = clean(s[0]) ** 2; checkPuzzles(p); if (p > 0.001 && p < 0.999) api.done("spin"); }
      $("tally").innerHTML = `<div class="qm-bar"><span>😺 ${heads}</span><i style="width:${heads}%"></i></div>
        <div class="qm-bar"><span>🐟 ${100 - heads}</span><i class="t" style="width:${100 - heads}%"></i></div>`;
      SFX.ding();
    });
    renderRecipe();

    function frame(dt){
      t += dt; flipAnim = Math.max(0, flipAnim - dt * 3); slam = Math.max(0, slam - dt * 3);
      disp.a += (a - disp.a) * Math.min(1, dt * 8); disp.b += (b - disp.b) * Math.min(1, dt * 8);
      bg(ctx, H, t);
      const pH = a * a, both = pH > 0.001 && pH < 0.999;
      // the coin: spinning while it's both, still when it's one of them
      const cx = 160, cy = 140, r = 86 * (1 + slam * 0.25);
      let sx = 1, heads = pH > 0.5;
      if (both) { sx = Math.cos(t * 10); heads = sx > 0; }
      else if (flipAnim > 0) sx = Math.cos(flipAnim * Math.PI);
      if (both) {   // spinning swooshes
        ctx.strokeStyle = "rgba(200,170,255,0.5)"; ctx.lineWidth = 3;
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(cx, cy, r + 16 + k * 10, t * 6 + k * 2, t * 6 + k * 2 + 1.2); ctx.stroke(); }
        glow(ctx, cx, cy, 150, "rgba(150,120,255,0.35)");
      }
      ctx.save(); ctx.translate(cx, cy); ctx.scale(Math.max(0.05, Math.abs(sx)), 1);
      const cg = ctx.createRadialGradient(-20, -25, 10, 0, 0, r);
      cg.addColorStop(0, heads ? "#fff0b0" : "#dcebff"); cg.addColorStop(1, heads ? "#d29b2a" : "#5f7fc4");
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, r - 9, 0, 7); ctx.stroke();
      ctx.font = `${Math.round(r * 0.95)}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(heads ? "😺" : "🐟", 0, 6);
      ctx.restore();
      text(ctx, both ? "😺 AND 🐟 at once!" : looked ? "You looked!" : heads ? "😺 for sure" : "🐟 for sure", cx, 262, 17, both ? "#d9c8ff" : "#ffd84d");
      // the arrows (amplitudes): up is +, down is –; the chance is the length squared
      ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 1.5; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(390, MID); ctx.lineTo(700, MID); ctx.stroke(); ctx.setLineDash([]);
      text(ctx, "+", 380, MID - 60, 22, "rgba(255,255,255,0.55)"); text(ctx, "–", 380, MID + 60, 22, "rgba(255,255,255,0.55)");
      [[HX, disp.a, "#ffd84d", "😺", a], [TX, disp.b, "#8fb4ff", "🐟", b]].forEach(([x, amp, col, em, real]) => {
        const len = amp * 92;
        ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 9; ctx.lineCap = "round";
        if (Math.abs(len) > 2) {
          ctx.beginPath(); ctx.moveTo(x, MID); ctx.lineTo(x, MID - len); ctx.stroke();
          const d = Math.sign(len);
          ctx.beginPath(); ctx.moveTo(x - 15, MID - len + d * 14); ctx.lineTo(x, MID - len - d * 6); ctx.lineTo(x + 15, MID - len + d * 14); ctx.closePath(); ctx.fill();
        } else { ctx.beginPath(); ctx.arc(x, MID, 5, 0, 7); ctx.fill(); }
        ctx.lineCap = "butt";
        ctx.font = `30px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`; ctx.textAlign = "center"; ctx.fillText(em, x, 240);
        text(ctx, `${Math.round(real * real * 100)}%`, x, 268, 16, col);
      });
      // a + and a – arrow crashing into each other: poof
      for (let i = cancels.length - 1; i >= 0; i--) {
        const c = cancels[i]; c.t += dt;
        if (c.t > 0.9) { cancels.splice(i, 1); continue; }
        const k = Math.min(1, c.t / 0.4), len = (1 - k) * 65;
        ctx.globalAlpha = 1 - c.t / 0.9; ctx.lineWidth = 7;
        ctx.strokeStyle = "#ffffff"; ctx.beginPath(); ctx.moveTo(c.x - 22, MID); ctx.lineTo(c.x - 22, MID - len); ctx.stroke();
        ctx.strokeStyle = "#c99bff"; ctx.beginPath(); ctx.moveTo(c.x + 22, MID); ctx.lineTo(c.x + 22, MID + len); ctx.stroke();
        if (k >= 1) for (let p = 0; p < 7; p++) { ctx.fillStyle = "rgba(220,210,255,0.8)"; ctx.beginPath(); ctx.arc(c.x + Math.cos(p) * (c.t - 0.4) * 90, MID + Math.sin(p * 2.1) * (c.t - 0.4) * 50, 10, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
      fx.draw(ctx, dt);
    }
    return { frame };
  }

  /* ================= Lab 3: the double slit, with shy electrons ================= */
  function labSlits(box, api){
    const H = 320, { ctx } = api.canvas(H), fx = api.fx;
    box.insertAdjacentHTML("beforeend", `
      <div class="qm-buttons">
        <div class="segmented" role="group" aria-label="What to shoot">
          <button type="button" data-m="electron" aria-pressed="true">⚛️ Electrons</button>
          <button type="button" data-m="ball" aria-pressed="false">🎾 Tennis balls</button>
        </div>
        <button class="btn ghost" type="button" data-k="watch" aria-pressed="false">👁 Watch: off</button>
      </div>
      <div class="qm-buttons">
        <button class="btn" type="button" data-k="one">Shoot 1</button>
        <button class="btn" type="button" data-k="stream">▶ Shoot LOTS</button>
        <button class="btn ghost" type="button" data-k="clear">🧽 Clean</button>
        <span class="qm-count mono" data-k="count"></span>
      </div>`);
    const $ = k => box.querySelector(`[data-k="${k}"]`);
    let mode = "electron", watch = false, streaming = false, acc = 0, t = 0, shyCount = 0, cheered = {};
    const SX = 44, SY = 170, BX = 290, GAP = 30, SCX = 600, HALF = 135, BINS = 54;
    let hits = [], bins = new Array(BINS).fill(0), flying = [];
    const sinc = x => Math.abs(x) < 1e-6 ? 1 : Math.sin(x) / x;
    function gauss(){ return Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * Math.cos(6.283 * Math.random()); }
    // where it lands, u from -1 (top) to 1 (bottom), using the real wave rules
    function landing(){
      if (mode === "ball") { const s = Math.random() < 0.5 ? -1 : 1; return { u: s * 0.47 + gauss() * 0.06, slit: s }; }
      for (;;) {
        const u = Math.random() * 2 - 1;
        const s1 = sinc(3.2 * (u - 0.22)), s2 = sinc(3.2 * (u + 0.22));
        const I = watch ? (s1 * s1 + s2 * s2) : (s1 * s1 + s2 * s2 + 2 * s1 * s2 * Math.cos(20 * u));
        if (Math.random() * 4 < I) return { u, slit: watch ? (Math.random() * (s1 * s1 + s2 * s2) < s1 * s1 ? 1 : -1) : 0 };
      }
    }
    function shoot(){ const l = landing(); flying.push({ t: 0, u: l.u, slit: l.slit, kind: mode, shy: false }); }
    function land(f){
      if (Math.abs(f.u) > 1) return;
      hits.push({ u: f.u, x: Math.random() });
      if (hits.length > 4000) hits.shift();
      bins[Math.min(BINS - 1, Math.floor((f.u + 1) / 2 * BINS))]++;
      const n = hits.length;
      const cheer = (id, s, c) => { if (!cheered[id]) { cheered[id] = true; fx.pop(s, SCX - 80, 40, c, 30); SFX.ding(); } api.done(id); };
      if (mode === "electron" && !watch && n >= 200) cheer("stripes", "STRIPES! 🦓", "#7fd0ff");
      if (mode === "electron" && watch && n >= 150) cheer("watch", "No stripes?! 😮", "#ffd84d");
      if (mode === "ball" && n >= 150) cheer("balls", "Just 2 lines 🎾", "#d7f04a");
    }
    function clear(){ hits = []; bins = new Array(BINS).fill(0); flying = []; cheered = {}; }
    box.querySelectorAll("[data-m]").forEach(btn => btn.addEventListener("click", () => {
      mode = btn.dataset.m;
      box.querySelectorAll("[data-m]").forEach(b => b.setAttribute("aria-pressed", String(b === btn)));
      $("watch").disabled = mode === "ball";
      clear();
    }));
    $("watch").addEventListener("click", () => {
      watch = !watch; clear(); shyCount = 0;
      $("watch").setAttribute("aria-pressed", String(watch));
      $("watch").textContent = "👁 Watch: " + (watch ? "ON" : "off");
      if (watch) { fx.pop("I'm watching you 👀", BX + 70, 60, "#ffd84d", 20); }
    });
    $("one").addEventListener("click", () => { shoot(); SFX.pop(); });
    $("stream").addEventListener("click", () => { streaming = !streaming; $("stream").textContent = streaming ? "⏸ Stop" : "▶ Shoot LOTS"; });
    $("clear").addEventListener("click", clear);

    function frame(dt){
      t += dt;
      if (streaming) { acc += dt * 40; while (acc >= 1) { acc--; shoot(); } }
      for (let i = flying.length - 1; i >= 0; i--) {
        const f = flying[i]; f.t += dt * 1.9;
        if (watch && f.kind === "electron" && !f.shy && f.t > 0.45) { f.shy = true; if (shyCount++ < 3 || Math.random() < 0.03) fx.pop("Eek!", BX + 30, SY + f.slit * GAP - 22, "#ffb3c7", 20); }
        if (f.t >= 1) { land(f); flying.splice(i, 1); }
      }
      $("count").textContent = `${hits.length} landed`;

      bg(ctx, H, t);
      // the gun, the wall with two slits, the screen
      ctx.fillStyle = "#59617f"; ctx.fillRect(8, SY - 16, 36, 32); ctx.fillStyle = "#8790b5"; ctx.fillRect(40, SY - 8, 10, 16);
      ctx.fillStyle = "#6b78b8";
      ctx.fillRect(BX - 6, 10, 12, SY - GAP - 6 - 10);
      ctx.fillRect(BX - 6, SY - GAP + 6, 12, 2 * GAP - 12);
      ctx.fillRect(BX - 6, SY + GAP + 6, 12, H - 10 - (SY + GAP + 6));
      ctx.fillStyle = "#0a0d22"; ctx.fillRect(SCX - 8, SY - HALF - 6, 16, 2 * HALF + 12);
      ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 1; ctx.strokeRect(SCX - 8, SY - HALF - 6, 16, 2 * HALF + 12);
      // the big watching eye
      if (watch && mode === "electron") {
        const target = flying.find(f => f.t < 0.7);
        let lx = 0, ly = 0;
        if (target) { const tx = target.t < 0.45 ? lerp(SX, BX, target.t / 0.45) : BX + 40; lx = Math.max(-1, Math.min(1, (tx - (BX + 50)) / 120)); ly = 0.6; }
        const blink = Math.sin(t * 1.1) > 0.97 ? 0.1 : 1;
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(BX + 50, 34, 30, 18 * blink, 0, 0, 7); ctx.fill();
        if (blink > 0.5) { ctx.fillStyle = "#3a7bd5"; ctx.beginPath(); ctx.arc(BX + 50 + lx * 14, 34 + ly * 6, 10, 0, 7); ctx.fill(); ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(BX + 50 + lx * 14, 34 + ly * 6, 5, 0, 7); ctx.fill(); }
        ctx.strokeStyle = "#1a1030"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(BX + 50, 34, 30, 18 * blink, 0, 0, 7); ctx.stroke();
      }
      // ripples from both slits while unwatched electrons are on their way
      if (mode === "electron" && !watch && flying.length) {
        ctx.strokeStyle = "rgba(120,190,255,0.13)"; ctx.lineWidth = 2;
        const ph = (t * 80) % 30;
        [-1, 1].forEach(s => { for (let r = ph; r < 320; r += 30) { ctx.beginPath(); ctx.arc(BX, SY + s * GAP, r, -1.2, 1.2); ctx.stroke(); } });
      }
      // things flying: unwatched electrons split into two ghosts, one through each slit
      flying.forEach(f => {
        const ty = SY + f.u * HALF;
        if (f.t < 0.45) {
          const k = f.t / 0.45, x = lerp(SX, BX, k), y = lerp(SY, SY + (f.slit || 0) * GAP, k);
          if (f.kind === "ball") ball(x, y); else glow(ctx, x, y, 12, "rgba(127,208,255,0.9)");
        } else {
          const k = (f.t - 0.45) / 0.55;
          if (f.kind === "ball") ball(lerp(BX, SCX, k), lerp(SY + f.slit * GAP, ty, k));
          else if (f.slit) glow(ctx, lerp(BX, SCX, k), lerp(SY + f.slit * GAP, ty, k), 11, "rgba(255,200,120,0.9)");
          else [-1, 1].forEach(s => glow(ctx, lerp(BX, SCX, k), lerp(SY + s * GAP, ty, k), 11, "rgba(127,208,255,0.55)"));
        }
      });
      function ball(x, y){ ctx.fillStyle = "#d7f04a"; ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x - 4, y, 5, -1, 1); ctx.stroke(); }
      // where they landed, and how many landed where
      const dotCol = mode === "ball" ? "#d7f04a" : watch ? "#ffc878" : "#7fd0ff";
      ctx.fillStyle = dotCol;
      hits.forEach(h => ctx.fillRect(SCX - 6 + h.x * 11, SY + h.u * HALF - 1, 2, 2));
      const max = Math.max(5, ...bins), bh = 2 * HALF / BINS;
      ctx.fillStyle = dotCol; ctx.globalAlpha = 0.8;
      bins.forEach((c, i) => ctx.fillRect(SCX + 14, SY - HALF + i * bh, c / max * 96, bh - 0.5));
      ctx.globalAlpha = 1;
      fx.draw(ctx, dt);
    }
    return { frame };
  }

  /* ================= Lab 4: the ghost electron walks through walls ================= */
  function labTunnel(box, api){
    const H = 270, { ctx } = api.canvas(H), fx = api.fx;
    box.insertAdjacentHTML("beforeend", `
      <div class="qm-controls">
        <label class="qm-slider"><span>🧱 Wall</span><input type="range" min="1" max="5" step="1" value="2" data-k="thick" aria-label="Wall thickness"></label>
      </div>
      <div class="qm-buttons">
        <button class="btn" type="button" data-k="ball">⚽ Kick a ball</button>
        <button class="btn" type="button" data-k="electron">👻 Send an electron</button>
        <button class="btn ghost" type="button" data-k="many">×100 electrons</button>
      </div>
      <div class="qm-tally" data-k="tally"></div>`);
    const $ = k => box.querySelector(`[data-k="${k}"]`);
    const GY = 220, WX = 340, WALL_H = 140;
    let thick = 2, movers = [], leak = 0, t = 0;
    const count = { ball: [0, 0], electron: [0, 0] };   // [sent, through]
    const chance = w => Math.exp(-1.2 * w);
    const wallW = () => 12 + thick * 14;
    function show(){
      $("tally").innerHTML = `⚽ ${count.ball[1]} of ${count.ball[0]} got through · 👻 <b>${count.electron[1]} of ${count.electron[0]}</b> got through (${pct(count.electron[1], count.electron[0])})`;
    }
    $("thick").addEventListener("input", () => { thick = +$("thick").value; count.electron = [0, 0]; show(); });
    function send(kind, animate, slot){
      const through = kind === "electron" && Math.random() < chance(thick);
      count[kind][0]++; if (through) count[kind][1]++;
      if (through) api.done("through");
      if (kind === "ball" && count.ball[0] >= 5) api.done("balls");
      if (kind === "electron" && thick >= 4 && count.electron[0] >= 100) api.done("thick");
      if (animate) movers.push({ kind, x: 30 - (slot || 0) * 70, dir: 1, through, a: 1, hit: false, spin: 0, dizzy: 0, inWall: 0, happy: 0 });
      show();
    }
    $("ball").addEventListener("click", () => send("ball", true));
    $("electron").addEventListener("click", () => send("electron", true));
    $("many").addEventListener("click", () => {
      const before = count.electron[1];
      for (let i = 0; i < 100; i++) send("electron", i < 3, i);
      const got = count.electron[1] - before;
      fx.pop(`${got} made it!`, W - 90, 70, "#7bd68a", 24); SFX.ding();
    });
    show();

    function frame(dt){
      t += dt; leak = Math.max(0, leak - dt * 1.5);
      const ww = wallW();
      movers.forEach(m => {
        const v = m.kind === "ball" ? 280 : 300;
        m.x += m.dir * v * dt; m.spin += m.dir * v * dt / 14;
        m.dizzy = Math.max(0, m.dizzy - dt); m.happy = Math.max(0, m.happy - dt);
        if (!m.hit && m.dir > 0 && m.x > WX - 16) {
          m.hit = true;
          if (m.kind === "ball") { m.dir = -0.6; m.dizzy = 1.2; SFX.bonk(); fx.pop("BONK!", WX - 20, GY - 70, "#ff9f43", 34); }
          else if (m.through) { m.inWall = 1; leak = 1; SFX.whoosh(); fx.pop("WHOOSH!", WX + ww / 2, GY - 120, "#9fe0ff", 30); }
          else { m.dir = -1; leak = 1; SFX.nope(); fx.pop("Nope!", WX - 30, GY - 90, "#ff8a8a", 22); }
        }
        if (m.inWall && m.x > WX + ww + 10) { m.inWall = 0; m.happy = 1; fx.burst(m.x, GY - 45, "#9fe0ff", 14, 120); }
        if (m.x > W - 80 && m.dir > 0 && !m.done) { m.done = true; fx.pop("Made it! 🎉", W - 80, GY - 100, "#7bd68a", 22); }
        if (m.x < 0 || m.x > W - 40) m.a -= dt * 2.5;
      });
      movers = movers.filter(m => m.a > 0 && (m.x > -30 || m.dir > 0));

      bg(ctx, H, t);
      ctx.fillStyle = "#2a3366"; ctx.fillRect(0, GY, W, H - GY);
      ctx.fillStyle = "#3a4580"; for (let x = 0; x < W; x += 40) ctx.fillRect(x, GY, 20, 4);
      // the brick wall, and the electron's wave leaking into it, getting weaker
      for (let row = 0; row * 20 < WALL_H; row++) {
        const y = GY - (row + 1) * 20;
        for (let c = -1; c * 30 < ww; c++) {
          const x = WX + c * 30 + (row % 2) * 15;
          const x0 = Math.max(WX, x), x1 = Math.min(WX + ww, x + 28);
          if (x1 <= x0) continue;
          ctx.fillStyle = (row + c) % 3 ? "#9a5b3c" : "#a8663f"; ctx.fillRect(x0, y + 1, x1 - x0, 18);
        }
      }
      if (leak > 0) {
        const g = ctx.createLinearGradient(WX, 0, WX + ww, 0);
        g.addColorStop(0, `rgba(127,208,255,${0.85 * leak})`); g.addColorStop(1, `rgba(127,208,255,${0.85 * leak * chance(thick)})`);
        ctx.fillStyle = g; ctx.fillRect(WX, GY - 75, ww, 60);
      }
      text(ctx, `👻 chance: ${(chance(thick) * 100).toFixed(chance(thick) < 0.01 ? 1 : 0)}%`, WX + ww / 2, GY - WALL_H - 18, 17, "#cfd6ff");
      // the finish flag
      ctx.strokeStyle = "#ddd"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(W - 40, GY); ctx.lineTo(W - 40, GY - 70); ctx.stroke();
      ctx.fillStyle = "#7bd68a"; ctx.beginPath(); ctx.moveTo(W - 40, GY - 70); ctx.lineTo(W - 40 + 26 + Math.sin(t * 5) * 3, GY - 60); ctx.lineTo(W - 40, GY - 50); ctx.fill();
      movers.forEach(m => {
        ctx.globalAlpha = Math.max(0, m.a) * (m.inWall ? 0.45 : 1);
        if (m.kind === "ball") {
          const y = GY - 15;
          ctx.save(); ctx.translate(m.x, y); ctx.rotate(m.spin);
          ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, 15, 0, 7); ctx.fill();
          ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fill();
          for (let k = 0; k < 5; k++) { const an = k * 1.257; ctx.beginPath(); ctx.arc(Math.cos(an) * 11, Math.sin(an) * 11, 3, 0, 7); ctx.fill(); }
          ctx.restore();
          if (m.dizzy > 0) for (let k = 0; k < 3; k++) { const an = t * 6 + k * 2.1; text(ctx, "⭐", m.x + Math.cos(an) * 18, y - 26 + Math.sin(an) * 5, 12, "#ffd84d"); }
        } else {
          const y = GY - 45 - (m.happy > 0 ? Math.abs(Math.sin(m.happy * 9)) * 22 : 0);
          // a wavy ghost tail
          ctx.strokeStyle = "rgba(127,208,255,0.6)"; ctx.lineWidth = 3; ctx.beginPath();
          for (let s = 0; s <= 40; s += 2) { const yy = y + Math.sin(s * 0.4 - t * 14) * 6 * (s / 40); if (s) ctx.lineTo(m.x - m.dir * (16 + s), yy); else ctx.moveTo(m.x - m.dir * 16, yy); }
          ctx.stroke();
          blob(ctx, m.x, y, 16, "#7fd0ff", m.dir < 0 ? "sad" : m.inWall ? "wow" : "happy", t, 1, [m.dir > 0 ? 0.6 : -0.6, 0]);
        }
        ctx.globalAlpha = 1;
      });
      fx.draw(ctx, dt);
    }
    return { frame };
  }

  /* ================= Lab 5: spooky twins (entanglement and a real Bell test) ================= */
  function labTwins(box, api){
    const H = 270, { ctx } = api.canvas(H), fx = api.fx;
    const dialRow = who => `<div class="qm-dials"><span>${who === "Alice" ? "🌍 Alice" : "🪐 Bob"}:</span>${[1, 2, 3].map(n => `<button type="button" class="qm-dial" data-who="${who}" data-v="${n}">${n}</button>`).join("")}<button type="button" class="qm-dial" data-who="${who}" data-v="0">🎲</button></div>`;
    box.insertAdjacentHTML("beforeend", `
      <div class="qm-buttons">
        <div class="segmented" role="group" aria-label="What kind of twins">
          <button type="button" data-m="quantum" aria-pressed="true">🔗 Entangled</button>
          <button type="button" data-m="plan" aria-pressed="false">📝 Secret plan</button>
        </div>
      </div>
      <div class="qm-plan" data-k="planbox" hidden>
        <span>📝 The plan: on dial…</span>
        <div class="qm-buttons">${[0, 1, 2].map(i => `<button type="button" class="btn ghost small" data-plan="${i}"></button>`).join("")}</div>
      </div>
      ${dialRow("Alice")}${dialRow("Bob")}
      <div class="qm-buttons">
        <button class="btn" type="button" data-k="one">✨ Send twins</button>
        <button class="btn" type="button" data-k="hundred">✨ ×100</button>
        <button class="btn ghost" type="button" data-k="reset">↺ Reset</button>
        <button class="btn ghost" type="button" data-k="robot">🤖 Check all plans</button>
      </div>
      <div class="qm-tally" data-k="tally"></div>
      <div class="qm-tally" data-k="robotOut" hidden></div>`);
    const $ = k => box.querySelector(`[data-k="${k}"]`);
    let mode = "quantum", dial = { Alice: 1, Bob: 1 }, plan = [true, false, true];   // true = green
    let tally = null, pair = null, history = [], best = { quantum: null, plan: null }, t = 0, dance = 0;
    const resetTally = () => { tally = { n: 0, same: 0, sd: 0, sdSame: 0, dd: 0, ddSame: 0, random: true }; };
    resetTally();

    function renderControls(){
      box.querySelectorAll("[data-m]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.m === mode)));
      $("planbox").hidden = mode !== "plan";
      box.querySelectorAll("[data-plan]").forEach(b => { const i = +b.dataset.plan; b.textContent = `${i + 1} → ${plan[i] ? "🟢" : "🔴"}`; });
      box.querySelectorAll(".qm-dial").forEach(b => b.setAttribute("aria-pressed", String(dial[b.dataset.who] === +b.dataset.v)));
    }
    function renderTally(){
      const tl = tally;
      let s = `<b>${tl.n}</b> pairs · same colour: <b>${pct(tl.same, tl.n)}</b>`;
      if (tl.sd && tl.dd) s += ` <span class="qm-soft">(same dial ${pct(tl.sdSame, tl.sd)}, different dial ${pct(tl.ddSame, tl.dd)})</span>`;
      if (best.quantum !== null || best.plan !== null) {
        s += `<div class="qm-compare">`;
        if (best.plan !== null) s += `<div class="qm-bar"><span>📝 ${best.plan}%</span><i class="t" style="width:${best.plan}%"></i></div>`;
        if (best.quantum !== null) s += `<div class="qm-bar"><span>🔗 ${best.quantum}%</span><i style="width:${best.quantum}%"></i></div>`;
        s += `<small>Random dials. Dashed line = 56%, the lowest any secret plan can do.</small></div>`;
      }
      $("tally").innerHTML = s;
    }
    box.querySelectorAll("[data-m]").forEach(b => b.addEventListener("click", () => { mode = b.dataset.m; resetTally(); history = []; pair = null; renderControls(); renderTally(); }));
    box.querySelectorAll("[data-plan]").forEach(b => b.addEventListener("click", () => { plan[+b.dataset.plan] = !plan[+b.dataset.plan]; resetTally(); renderControls(); renderTally(); }));
    box.querySelectorAll(".qm-dial").forEach(b => b.addEventListener("click", () => { dial[b.dataset.who] = +b.dataset.v; resetTally(); renderControls(); renderTally(); }));

    // one pair: the dials are set after the twins have flown apart, then both are measured
    function measure(){
      const sa = dial.Alice || 1 + Math.floor(Math.random() * 3), sb = dial.Bob || 1 + Math.floor(Math.random() * 3);
      let A, B;
      if (mode === "quantum") {
        // entangled: Alice's colour is 50/50; Bob's always matches on the same dial, and 1 time in 4 on different dials
        A = Math.random() < 0.5;
        B = sa === sb ? A : (Math.random() < 0.25 ? A : !A);
      } else { A = plan[sa - 1]; B = plan[sb - 1]; }
      const tl = tally; tl.n++;
      if (A === B) tl.same++;
      if (sa === sb) { tl.sd++; if (A === B) tl.sdSame++; } else { tl.dd++; if (A === B) tl.ddSame++; }
      tl.random = tl.random && !dial.Alice && !dial.Bob;
      history.push({ sa, sb, A, B }); if (history.length > 13) history.shift();
      if (mode === "quantum" && tl.sd >= 10) api.done("same");
      if (tl.random && tl.n >= 100) {
        const p = Math.round(100 * tl.same / tl.n);
        if (mode === "quantum") { best.quantum = p; api.done("bell"); if (!Q().spooky) { Q().spooky = true; Hub.saveStore(); Hub.checkBadges(); } }
        else { best.plan = best.plan === null ? p : Math.min(best.plan, p); api.done("plan"); }
      }
      return { sa, sb, A, B };
    }
    $("one").addEventListener("click", () => { const r = measure(); pair = { t: 0, said: false, ...r }; SFX.whoosh(); renderTally(); });
    $("hundred").addEventListener("click", () => {
      let r; for (let i = 0; i < 100; i++) r = measure();
      pair = { t: 0.99, said: true, ...r }; renderTally();
      fx.pop(`${pct(tally.same, tally.n)} same`, 360, 50, "#ffd84d", 26); SFX.ding();
    });
    $("reset").addEventListener("click", () => { resetTally(); history = []; renderTally(); });
    $("robot").addEventListener("click", () => {
      // try all 8 plans on all 9 dial pairs: how often would the colours match?
      let cells = "";
      for (let m = 0; m < 8; m++) {
        const p = [!!(m & 4), !!(m & 2), !!(m & 1)];
        let same = 0;
        for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) if (p[x] === p[y]) same++;
        cells += `<span>${p.map(g => g ? "🟢" : "🔴").join("")} <b>${Math.round(same / 9 * 100)}%</b></span>`;
      }
      $("robotOut").hidden = false;
      $("robotOut").innerHTML = `🤖 <b>Every secret plan:</b><div class="qm-plans">${cells}</div>All at least <b>56%</b>. Real twins: <b>50%</b>. No plan can do that! 🤯`;
      api.done("robot"); SFX.ding();
    });
    renderControls(); renderTally();

    function frame(dt){
      t += dt; dance = Math.max(0, dance - dt);
      const CX = 360, CY = 115, AXp = 110, BXp = 610;
      bg(ctx, H, t);
      // the twin maker machine, with blinking lights
      ctx.fillStyle = "#3b3f7a"; ctx.fillRect(CX - 40, CY - 30, 80, 60);
      ["#ff5a5a", "#ffd84d", "#4fdc6a"].forEach((c, i) => { ctx.fillStyle = Math.sin(t * 5 + i * 2) > 0 ? c : "#2a2d55"; ctx.beginPath(); ctx.arc(CX - 20 + i * 20, CY - 14, 5, 0, 7); ctx.fill(); });
      glow(ctx, CX, CY + 8, 24, "rgba(200,140,255,0.7)");
      text(ctx, "TWIN-O-MATIC", CX, CY + 46, 11, "#cfd6ff");
      // where the twins end up: Alice on Earth, Bob near Saturn
      [["🌍", AXp, "sa", "Alice"], ["🪐", BXp, "sb", "Bob"]].forEach(([em, x, sk, who]) => {
        ctx.font = `34px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(em, x, CY + 62);
        const set = pair ? pair[sk] : (dial[who] || "🎲");
        ctx.fillStyle = "#273061"; ctx.beginPath(); ctx.arc(x, CY - 62, 15, 0, 7); ctx.fill();
        ctx.strokeStyle = "#ffd84d"; ctx.lineWidth = 2; ctx.stroke();
        text(ctx, String(set), x, CY - 61, 15, "#ffd84d");
        text(ctx, "dial", x, CY - 86, 11, "#cfd6ff", "center", 700);
      });
      // the twins fly apart (holding a wiggly string when they're entangled), then light up
      if (pair) {
        pair.t = Math.min(1, pair.t + dt * 1.3);
        const k = 1 - Math.pow(1 - pair.t, 2);
        const ax = lerp(CX - 10, AXp, k), bx = lerp(CX + 10, BXp, k);
        if (pair.t >= 1 && !pair.said) {
          pair.said = true;
          if (pair.A === pair.B) { dance = 1.2; fx.pop("SAME! 🎉", CX, 40, "#ffd84d", 30); SFX.tada(); }
          else { fx.pop("different", CX, 40, "#cfd6ff", 20); SFX.pop(); }
        }
        if (mode === "quantum") {
          ctx.strokeStyle = pair.t < 1 ? "rgba(200,140,255,0.7)" : "rgba(200,140,255,0.25)"; ctx.lineWidth = 2.5; ctx.beginPath();
          for (let x = ax; x <= bx; x += 4) { const y = CY + Math.sin(x * 0.07 + t * 10) * 7; if (x === ax) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
          ctx.stroke();
        }
        [[ax, pair.A, -1], [bx, pair.B, 1]].forEach(([x, green, side]) => {
          const lit = pair.t >= 1;
          const col = lit ? (green ? "#4fdc6a" : "#ff5a5a") : "#c99bff";
          const jump = dance > 0 ? Math.abs(Math.sin(dance * 10)) * 18 : 0;
          blob(ctx, x, CY - jump, 22, col, lit ? (pair.A === pair.B ? "wow" : "happy") : "happy", t, dance > 0 ? 1 + Math.sin(dance * 20) * 0.1 : 1, [side * -0.6, 0]);
          if (mode === "plan" && !lit) text(ctx, "📝", x + side * 22, CY - 24, 14, "#fff");
        });
      } else {
        blob(ctx, CX - 14, CY + 6, 12, "#c99bff", "happy", t, 1, [-0.5, 0]);
        blob(ctx, CX + 14, CY + 6, 12, "#c99bff", "happy", t + 1, 1, [0.5, 0]);
      }
      // the last few results
      history.forEach((h, i) => {
        const x = 40 + i * 50, y = 240;
        ctx.fillStyle = h.A ? "#4fdc6a" : "#ff5a5a"; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill();
        ctx.fillStyle = h.B ? "#4fdc6a" : "#ff5a5a"; ctx.beginPath(); ctx.arc(x + 17, y, 7, 0, 7); ctx.fill();
        if (h.A === h.B) text(ctx, "=", x + 8.5, y, 12, "#fff");
      });
      fx.draw(ctx, dt);
    }
    return { frame };
  }

  /* ================= the five labs: a few words from the cat, missions, and questions ================= */
  const LABS = [
    {
      id: "atom", icon: "🪜", label: "Energy stairs", title: "Elly and the energy stairs",
      chat: [
        "Everything is made of atoms. SUPER tiny: a million in a row is as thin as a hair! 🤏",
        "This is Elly the electron. She lives on energy STAIRS. On a step, never in between! 🪜",
        "Light comes in tiny packets called photons. Blue ones pack more punch than red ones. ⚡",
        "Only the EXACT right colour makes Elly jump. Slide the rainbow and zap! 🌈"
      ],
      lab: labAtom,
      missions: [
        { id: "jump1", text: "Jump to step 2 (try red) 🔴" },
        { id: "jump2", text: "Jump to step 3 (try blue-green) 🩵" },
        { id: "jump3", text: "Jump to step 4 (try deep blue) 🔵" },
        { id: "bright", text: "Mega zap with a WRONG colour 🙅" }
      ],
      real: "🎆 Fireworks and neon signs glow in their colours because every atom has its own stairs.",
      checks: [
        { q: "Bright yellow light doesn't make Elly jump. Why?", a: "Wrong energy for a step", w: ["Electrons hate yellow", "It's too dark", "Elly is asleep 😴"], why: "Only a photon with exactly one step's worth of energy works. More photons don't add up." },
        { q: "Which photon packs more energy?", a: "Blue 🔵", w: ["Red 🔴", "They're the same", "The bigger one"], why: "Blue and violet photons carry more energy than red ones." }
      ]
    },
    {
      id: "coin", icon: "🪙", label: "Quantum coin", title: "The cat-and-fish coin",
      chat: [
        "My quantum coin: 😺 on one side, 🐟 on the other. Mmm, fish.",
        "🌀 Spin it and it's BOTH at once. Scientists call that a superposition!",
        "👀 Look, and it has to pick one. Totally random!",
        "The arrows can point up ➕ or down ➖. When a ➕ meets a ➖… POOF! They cancel. 💨"
      ],
      lab: labCoin,
      missions: [
        { id: "spin", text: "🌀 then 👀. Do it a few times!" },
        { id: "again", text: "Look twice in a row. Does it change?" },
        { id: "hh", text: "🌀 🌀 then look… what?! 😲" },
        { id: "hzh", text: "Puzzle: 🐟 every time, using only 🌀 and ➖" }
      ],
      real: "💻 Quantum computers are built from qubits: coins just like this one.",
      checks: [
        { q: "The coin is spinning. You look 👀. What happens?", a: "It picks 😺 or 🐟 at random", w: ["Always 😺", "You see both at once", "It explodes 💥"], why: "Looking makes it choose. Before that, it really is both." },
        { q: "🌀 then 🌀 again, then look. You get…", a: "Always 😺", w: ["50/50", "Always 🐟", "A dizzy cat 😵"], why: "The two ways to 🐟 have a ➕ and a ➖ arrow, so they cancel out. POOF!" }
      ]
    },
    {
      id: "slits", icon: "🌊", label: "Shy electrons", title: "The shy electrons",
      chat: [
        "A wall with two slits, and a screen behind it. Shoot stuff through! 🎯",
        "Tennis balls 🎾 go through one slit or the other. Boring.",
        "Electrons go through BOTH slits at once, like a wave 🌊, and paint stripes!",
        "But electrons are shy. If you watch them 👁 … try it!"
      ],
      lab: labSlits,
      missions: [
        { id: "stripes", text: "200 electrons: find the stripes 🦓" },
        { id: "watch", text: "Turn on 👁 and shoot 150" },
        { id: "balls", text: "Shoot 150 tennis balls 🎾" }
      ],
      real: "🔬 This even works with giant molecules made of 2000 atoms!",
      checks: [
        { q: "Each electron lands…", a: "in one single spot", w: ["everywhere at once", "on the ceiling", "nowhere"], why: "Every electron makes one dot. The stripes appear after lots of dots." },
        { q: "You watch the slits 👁. The stripes…", a: "disappear!", w: ["get brighter", "turn into spirals 🌀", "start dancing 💃"], why: "Once you know which slit it took, it can't go through both, so there are no stripes." }
      ]
    },
    {
      id: "tunnel", icon: "👻", label: "Through walls", title: "The ghost electron",
      chat: [
        "Ball vs. wall: the wall wins. Every. Single. Time. BONK! ⚽",
        "Electrons are a bit wavy. Their wave leaks INTO the wall… 👻",
        "Thin wall? Sometimes the electron just pops out the other side! That's tunnelling."
      ],
      lab: labTunnel,
      missions: [
        { id: "balls", text: "Kick 5 balls. Any get through? ⚽" },
        { id: "through", text: "Get an electron through! 👻" },
        { id: "thick", text: "Thickest wall (4 or 5), ×100 electrons 🧱" }
      ],
      real: "☀️ The Sun only shines thanks to tunnelling. Your USB stick uses it too!",
      checks: [
        { q: "An electron hits a wall that's too high. It can…", a: "sometimes pass through 👻", w: ["never get past", "always pass through", "climb it with tiny legs 🦵"], why: "Its wave leaks through the wall, so there's a small chance it's on the other side." },
        { q: "A thicker wall means…", a: "a much smaller chance", w: ["a bigger chance", "no change", "a sad wall 😢"], why: "The wave gets weaker and weaker inside the wall." }
      ]
    },
    {
      id: "twins", icon: "🔗", label: "Spooky twins", title: "The spooky twins",
      chat: [
        "These two are entangled twins. Best friends, even when they're planets apart! 👯",
        "Each one turns 🟢 or 🔴 at random… but on the same dial, they ALWAYS match!",
        "Einstein called it 'spooky action at a distance' 👻. He guessed they had a secret plan 📝.",
        "With random dials 🎲, any secret plan matches at least 56%. Real twins? Test it! 🧪"
      ],
      lab: labTwins,
      missions: [
        { id: "same", text: "Same dial on both, send 10 twins 🟢🟢" },
        { id: "plan", text: "📝 Secret plan, both 🎲, ×100" },
        { id: "bell", text: "🔗 Entangled, both 🎲, ×100: beat 56%?" },
        { id: "robot", text: "🤖 Check all plans" }
      ],
      real: "🏆 Nobel Prize 2022 for this test! Near Geneva, twins matched 10 km apart. But no, you can't send messages with it.",
      checks: [
        { q: "Entangled twins, same dial. The colours…", a: "always match!", w: ["never match", "match half the time", "turn purple 🟣"], why: "Each one is random, but on the same dial they always match." },
        { q: "Real twins match 50%, secret plans at least 56%. So…", a: "There's no secret plan! 🤯", w: ["Einstein was right", "The machine is broken", "Twins can't count"], why: "That's Bell's test. Real experiments get 50%, so the twins really decide when they're measured." },
        { q: "Can Alice send Bob a message this way, faster than light?", a: "No, her colours are random", w: ["Yes, instantly! ⚡", "Only on Tuesdays", "Only by phone 📞"], why: "Each side alone looks like coin flips. The magic only shows when they compare lists." }
      ]
    }
  ];
  const EXTRA_QUIZ = [
    { q: "Who said 'spooky action at a distance'?", a: "Albert Einstein", w: ["Isaac Newton", "Marie Curie", "Professor Whiskers 🐱"] },
    { q: "Quantum physics is about…", a: "super tiny things, like atoms", w: ["the weather", "giant planets", "how cats nap 😴"] },
    { q: "Schrödinger's cat is…", a: "half asleep, half awake until you look", w: ["a cat that can fly", "a cat that counts", "a robot cat 🤖"] },
    { q: "A photon is…", a: "a tiny packet of light", w: ["a camera part", "a kind of atom", "a small planet"] },
    { q: "The 2022 Nobel Prize in Physics was for…", a: "entangled light", w: ["tennis balls", "rockets", "dinosaur bones 🦖"] }
  ];

  const CAT_SVG = `<svg class="qm-cat" viewBox="0 0 120 120" aria-hidden="true">
    <path class="qm-tail" d="M86 98 q 30 -4 24 -36" stroke="#e8892b" stroke-width="9" fill="none" stroke-linecap="round"/>
    <ellipse cx="60" cy="96" rx="30" ry="21" fill="#f39c3c"/>
    <path d="M40 90 q20 26 40 0 v18 h-40z" fill="#ffffff" opacity="0.92"/>
    <g class="qm-head">
      <path d="M31 40 L35 10 L54 28 Z" fill="#f39c3c"/><path d="M89 40 L85 10 L66 28 Z" fill="#f39c3c"/>
      <path d="M36 32 L38 18 L48 28 Z" fill="#ffb3c7"/><path d="M84 32 L82 18 L72 28 Z" fill="#ffb3c7"/>
      <circle cx="60" cy="50" r="30" fill="#f6a54a"/>
      <g class="qm-eyes"><circle cx="48" cy="48" r="4" fill="#222"/><circle cx="72" cy="48" r="4" fill="#222"/></g>
      <circle cx="48" cy="48" r="9.5" fill="none" stroke="#333" stroke-width="2.5"/><circle cx="72" cy="48" r="9.5" fill="none" stroke="#333" stroke-width="2.5"/>
      <line x1="57.5" y1="48" x2="62.5" y2="48" stroke="#333" stroke-width="2.5"/>
      <path d="M56 60 h8 l-4 4z" fill="#e5566b"/>
      <path d="M53 66 q3.5 4 7 0 q3.5 4 7 0" stroke="#333" fill="none" stroke-width="2" stroke-linecap="round"/>
      <g stroke="#7a4a1a" stroke-width="1.5"><line x1="30" y1="60" x2="44" y2="62"/><line x1="30" y1="66" x2="44" y2="65"/><line x1="90" y1="60" x2="76" y2="62"/><line x1="90" y1="66" x2="76" y2="65"/></g>
    </g>
  </svg>`;

  /* ================= the page ================= */
  function mount(host){
    host.innerHTML = `
    <div class="wrap qm">
      <header>
        <a class="back-link" href="#/learning">← Learning</a>
        <div class="wordmark"><h1>Quantum Lab</h1><span class="unit mono">/// tiny stuff is WEIRD</span></div>
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
        b.innerHTML = `<span class="ring qm-ring">${Q().done[l.id] ? "✅" : l.icon}</span><span class="mark"></span><span class="label"></span>`;
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
      const fx = makeFx();
      return {
        fx,
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
          if (li) { li.classList.add("done", "just"); li.querySelector(".qm-tick").textContent = "✅"; }
          SFX.ding();
          say(["Purr-fect! 🎯", "Meow-velous! 🎯", "Nailed it! 🎯", "You're a natural! 🎯"][Math.floor(Math.random() * 4)], true);
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

    // Professor Whiskers talks: one short line at a time
    let chatLines = [], chatAt = 0, chatTimer = null;
    function say(line, quick){
      const bubble = page.querySelector(".qm-bubble"), cat = page.querySelector(".qm-cat");
      if (!bubble) return;
      bubble.querySelector(".qm-say").textContent = line;
      bubble.classList.remove("pop"); void bubble.offsetWidth; bubble.classList.add("pop");
      cat.classList.remove("talk"); void cat.getBoundingClientRect(); cat.classList.add("talk");
      clearTimeout(chatTimer);
      if (quick) chatTimer = setTimeout(() => showChat(), 2200);
    }
    function showChat(){
      const page2 = page.querySelector(".qm-bubble");
      if (!page2 || !chatLines.length) return;
      say(chatLines[chatAt]);
      page.querySelector(".qm-next").textContent = chatAt < chatLines.length - 1 ? "▶" : "↺";
      page.querySelector(".qm-dots").innerHTML = chatLines.map((_, i) => `<i class="${i === chatAt ? "on" : ""}"></i>`).join("");
    }
    function nextChat(){ chatAt = (chatAt + 1) % chatLines.length; showChat(); SFX.pop(); }

    function renderLab(L){
      const i = LABS.indexOf(L);
      page.innerHTML = `
        <div class="qm-title"><h2></h2><button class="btn ghost small qm-mute" type="button" aria-label="Sound on or off">${store.sound === false ? "🔇" : "🔊"}</button></div>
        <div class="qm-chat">
          <button class="qm-catbtn" type="button" aria-label="Professor Whiskers: next">${CAT_SVG}</button>
          <div class="qm-bubble"><span class="qm-say"></span><div class="qm-bubble-foot"><span class="qm-dots"></span><button class="qm-next" type="button" aria-label="Next">▶</button></div></div>
        </div>
        <div class="qm-labbox"></div>
        <div class="qm-missions"><h3>🎯 Missions</h3><ul>${L.missions.map(m => `<li data-mission="${m.id}" class="${Q().missions[L.id + ":" + m.id] ? "done" : ""}"><span class="qm-tick">${Q().missions[L.id + ":" + m.id] ? "✅" : "⬜"}</span><span></span></li>`).join("")}</ul></div>
        <div class="qm-real"></div>
        <div class="qm-checks"><h3>✏️ Quick check</h3><div class="qm-qs"></div><div class="qm-finish" hidden></div></div>
        <div class="card-foot">
          <button class="btn ghost small" type="button" data-k="prev" ${i === 0 ? "disabled" : ""}>← Back</button>
          <button class="btn" type="button" data-k="next">${i === LABS.length - 1 ? "Quiz time →" : "Next lab →"}</button>
        </div>`;
      page.querySelector("h2").textContent = `${L.icon} ${L.title}`;
      L.missions.forEach((m, k) => { page.querySelectorAll(".qm-missions li")[k].lastElementChild.textContent = m.text; });
      page.querySelector(".qm-real").textContent = L.real;
      page.querySelector(".qm-mute").addEventListener("click", e => { store.sound = store.sound === false; Hub.saveStore(); e.currentTarget.textContent = store.sound === false ? "🔇" : "🔊"; });
      page.querySelector('[data-k="prev"]').addEventListener("click", () => go(LABS[i - 1].id));
      page.querySelector('[data-k="next"]').addEventListener("click", () => go(i === LABS.length - 1 ? "quiz" : LABS[i + 1].id));
      page.querySelector(".qm-catbtn").addEventListener("click", nextChat);
      page.querySelector(".qm-next").addEventListener("click", nextChat);
      chatLines = L.chat; chatAt = 0; showChat();
      lab = L.lab(page.querySelector(".qm-labbox"), makeApi(L));
      renderChecks(L);
      if (open) last = performance.now();
    }

    // a question with tap-to-answer buttons
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
          fb.querySelector(".verdict").textContent = right ? ["Right! 🎉", "Yes! 😺", "Correct! ⭐"][Math.floor(Math.random() * 3)] : (oneTry ? "Nope! It's: " + c.a : "Nope, try again! 🙀");
          fb.querySelector(".explain").textContent = right || oneTry ? (c.why || "") : "";
          if (right) SFX.ding(); else SFX.nope();
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
          fin.textContent = doneCount() === 5 ? "🎉 All 5 labs done! You're a quantum explorer! Try the quiz 🧠" : `🎉 Lab done! ${doneCount()} of 5.`;
          if (first) { Hub.confettiBurst(fin); SFX.tada(); }
          say("Lab complete! Have a fish 🐟", true);
        }
      })));
      if (Q().done[L.id]) { fin.hidden = false; fin.textContent = "✅ Done before! Play again any time."; }
    }

    function renderQuiz(){
      const pool = shuffle([...LABS.flatMap(l => l.checks), ...EXTRA_QUIZ]).slice(0, 10);
      let k = 0, score = 0;
      page.innerHTML = `
        <div class="qm-title"><h2>🧠 Quantum Quiz</h2><span class="level-desc">${Q().quizBest ? `Best: ${Q().quizBest} / 10` : "10 questions"}</span></div>
        <div class="qm-atom-box"></div>
        <div class="qm-quiz"></div>`;
      const box = page.querySelector(".qm-quiz");
      const atom = QuantumAtom(page.querySelector(".qm-atom-box"));   // every right answer builds the atom up
      function next(){
        box.innerHTML = `<div class="qm-progress">${pool.map((_, i) => `<i class="${i < k ? "past" : i === k ? "on" : ""}"></i>`).join("")}<b>⭐ ${score}</b></div>`;
        box.appendChild(questionEl(pool[k], k + 1, ok => {
          if (ok) score++;
          atom.answer(ok);
          const b = document.createElement("button");
          b.type = "button"; b.className = "btn"; b.textContent = k === 9 ? "My score! 🏁" : "Next →";
          b.addEventListener("click", () => { k++; if (k < 10) next(); else end(); });
          box.appendChild(b); b.focus();
        }, true));
      }
      function end(){
        const best = score > (Q().quizBest || 0);
        if (best) Q().quizBest = score;
        const el = atom.element(score);
        if (el) Q().elements = Object.assign(Q().elements || {}, { [el.s]: true });
        Hub.saveStore(); Hub.checkBadges();
        box.innerHTML = `<div class="qm-score"><div class="qm-big">${score >= 9 ? "🏆" : score >= 6 ? "⭐" : "🐱"}</div><h2>${score} / 10</h2>
          <p>${score >= 9 ? "Professor Whiskers is SO impressed! 😻" : score >= 6 ? "Great work! 😺" : "Good try! Play the labs and come back 😸"}${best ? " New best!" : ""}</p>
          <p>${el ? `You built <b>${el.name}</b> (${el.s}): ${el.fact}! ⚛️` : "No atom this time."}${Object.keys(Q().elements || {}).length ? ` Atoms you've built: ${Object.keys(Q().elements).join(" ")}` : ""}</p>
          <button class="btn" type="button">↻ Again</button></div>`;
        box.querySelector("button").addEventListener("click", renderQuiz);
        if (score >= 9) { Hub.confettiBurst(box.querySelector("h2")); SFX.tada(); }
      }
      next();
    }

    function loop(now){
      if (!open) return;
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000 || 0)); last = now;
      if (lab && canvas) lab.frame(dt);
      requestAnimationFrame(loop);
    }

    function openApp(){
      open = true; go(current);
      last = performance.now(); requestAnimationFrame(loop);
    }
    function closeApp(){ open = false; clearTimeout(chatTimer); }
    return { open: openApp, close: closeApp };
  }
})();
