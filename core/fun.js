/* Fun: the silly bits every game can share.
     Fun.pops()          comic words ("BONK!") and sparkles drawn on a canvas: { pop, burst, draw, clear }
     Fun.sfx.name()      little sounds made by the browser: pop, boing, bonk, zap, whoosh, ding, tada, nope,
                         splat, chomp, coin, crash, honk, wah, waka, beep, splash,
                         oink, cluck, thunk
     Fun.face(ctx, ...)  a cartoon face with blinking eyes that look around, and a mouth for the mood
     Fun.soundButton(el) a 🔊/🔇 button put just before el (all the games share the one setting)
     Fun.shake(el)       wobbles an element, for a crash or a hit
   Sounds are on unless Hub.store.sound is false. */
(function(){
  "use strict";
  const store = Hub.store;

  /* ---------------- comic words and sparkles ---------------- */
  function pops(){
    const words = [], bits = [];
    return {
      // a word that pops in, wobbles and floats up; size is in canvas pixels
      pop(s, x, y, colour, size){ words.push({ s, x, y, colour: colour || "#ffd84d", size: size || 30, t: 0, rot: (Math.random() - 0.5) * 0.35 }); },
      burst(x, y, colour, n, speed, gravity){
        for (let i = 0; i < (n || 14); i++) {
          const a = Math.random() * 6.283, v = (speed || 120) * (0.4 + Math.random() * 0.8);
          bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 0.5 + Math.random() * 0.4, colour, g: gravity === undefined ? 160 : gravity });
        }
      },
      clear(){ words.length = 0; bits.length = 0; },
      draw(ctx, dt){
        for (let i = bits.length - 1; i >= 0; i--) {
          const b = bits[i]; b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vy += b.g * dt;
          if (b.t > b.life) { bits.splice(i, 1); continue; }
          ctx.globalAlpha = 1 - b.t / b.life; ctx.fillStyle = b.colour;
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.t * 8); ctx.fillRect(-3, -3, 6, 6); ctx.restore();
        }
        ctx.globalAlpha = 1;
        for (let i = words.length - 1; i >= 0; i--) {
          const p = words[i]; p.t += dt;
          if (p.t > 1.3) { words.splice(i, 1); continue; }
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

  /* ---------------- sounds ---------------- */
  let ac = null;
  function audio(){
    if (store.sound === false) return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ac) ac = new AC();
    if (ac.state === "suspended") ac.resume();
    return ac;
  }
  function blip(f0, f1, dur, vol, type, delay){
    const a = audio(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + (delay || 0);
    o.type = type || "sine";
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, f0, f1, delay){
    const a = audio(); if (!a) return;
    const n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime + (delay || 0);
    src.buffer = buf; f.type = "bandpass"; f.Q.value = 1.2;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(a.destination); src.start(t); src.stop(t + dur);
  }
  // sounds can't all play at once: the same one at most every 60 ms
  const lastAt = {};
  let wakaHigh = false;
  const limit = (name, fn) => () => { const now = performance.now(); if (now - (lastAt[name] || 0) < 60) return; lastAt[name] = now; fn(); };
  const sfx = {
    pop: () => blip(500, 1300, 0.07, 0.18),
    boing: () => { blip(160, 520, 0.12, 0.18); blip(520, 260, 0.15, 0.13, "sine", 0.12); },
    bonk: () => { blip(180, 60, 0.18, 0.28, "triangle"); noise(0.08, 0.15, 800, 300); },
    zap: () => blip(1400, 300, 0.14, 0.1, "square"),
    whoosh: () => noise(0.3, 0.2, 400, 2400),
    ding: () => { blip(1320, 1320, 0.25, 0.1); blip(1760, 1760, 0.3, 0.08, "sine", 0.08); },
    tada: () => [523, 659, 784, 1047].forEach((n, i) => blip(n, n, 0.14, 0.09, "square", i * 0.08)),
    nope: () => { blip(320, 300, 0.07, 0.09, "square"); blip(240, 220, 0.09, 0.09, "square", 0.09); },
    splat: () => { noise(0.18, 0.35, 900, 150); blip(200, 70, 0.15, 0.15, "sine"); },
    chomp: () => { blip(420, 220, 0.06, 0.12, "square"); blip(320, 160, 0.06, 0.1, "square", 0.07); },
    coin: () => { blip(988, 988, 0.06, 0.08, "square"); blip(1319, 1319, 0.16, 0.08, "square", 0.06); },
    crash: () => { noise(0.35, 0.35, 1500, 120); blip(120, 40, 0.3, 0.2, "sawtooth"); },
    honk: () => { blip(330, 320, 0.16, 0.1, "sawtooth"); blip(415, 405, 0.16, 0.07, "sawtooth"); },
    wah: () => [392, 370, 349, 294].forEach((n, i) => blip(n, n * 0.97, i === 3 ? 0.5 : 0.2, 0.09, "triangle", i * 0.22)),
    waka: () => { wakaHigh = !wakaHigh; blip(wakaHigh ? 480 : 300, wakaHigh ? 300 : 480, 0.09, 0.06, "triangle"); },
    oink: () => { blip(260, 180, 0.12, 0.16, "sawtooth"); blip(240, 160, 0.14, 0.12, "sawtooth", 0.14); },
    cluck: () => { blip(900, 600, 0.05, 0.1, "square"); blip(1100, 700, 0.05, 0.08, "square", 0.08); blip(800, 500, 0.08, 0.08, "square", 0.17); },
    thunk: () => { blip(240, 110, 0.08, 0.2, "triangle"); noise(0.05, 0.1, 600, 300); },
    beep: () => { blip(880, 880, 0.06, 0.07, "square"); blip(660, 660, 0.06, 0.07, "square", 0.08); },
    splash: () => { noise(0.4, 0.3, 2000, 300); blip(600, 200, 0.12, 0.08, "sine", 0.03); }
  };
  Object.keys(sfx).forEach(k => { sfx[k] = limit(k, sfx[k]); });

  /* ---------------- a cartoon face ---------------- */
  // mood: "happy", "wow", "sad", "dizzy", "angry", "grin"; lx, ly from -1 to 1 is where the eyes look
  function face(ctx, x, y, r, mood, t, lx, ly){
    const blink = Math.sin(t * 1.3 + x * 0.05) > 0.97 ? 0.15 : 1;
    const ex = r * 0.36, ey = -r * 0.12, er = r * 0.27;
    [-1, 1].forEach(s => {
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(x + s * ex, y + ey, er, er * blink, 0, 0, 7); ctx.fill();
      if (blink > 0.5) {
        ctx.fillStyle = "#1a1030"; ctx.beginPath();
        if (mood === "dizzy") { ctx.lineWidth = Math.max(1, r * 0.08); ctx.strokeStyle = "#1a1030"; ctx.moveTo(x + s * ex - er * 0.5, y + ey - er * 0.5); ctx.lineTo(x + s * ex + er * 0.5, y + ey + er * 0.5); ctx.moveTo(x + s * ex + er * 0.5, y + ey - er * 0.5); ctx.lineTo(x + s * ex - er * 0.5, y + ey + er * 0.5); ctx.stroke(); }
        else { ctx.arc(x + s * ex + (lx || 0) * er * 0.4, y + ey + (ly || 0) * er * 0.4, er * 0.52, 0, 7); ctx.fill(); }
      }
      if (mood === "angry") { ctx.strokeStyle = "#1a1030"; ctx.lineWidth = Math.max(1.5, r * 0.12); ctx.beginPath(); ctx.moveTo(x + s * ex - s * er, y + ey - er * 1.3); ctx.lineTo(x + s * ex + s * er * 0.7, y + ey - er * 0.7); ctx.stroke(); }
    });
    ctx.strokeStyle = "#1a1030"; ctx.fillStyle = "#1a1030"; ctx.lineWidth = Math.max(1.5, r * 0.11); ctx.lineCap = "round"; ctx.beginPath();
    if (mood === "wow") { ctx.ellipse(x, y + r * 0.42, r * 0.15, r * 0.2, 0, 0, 7); ctx.fill(); }
    else if (mood === "sad" || mood === "angry") { ctx.arc(x, y + r * 0.62, r * 0.28, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke(); }
    else if (mood === "dizzy") { ctx.moveTo(x - r * 0.25, y + r * 0.42); ctx.quadraticCurveTo(x, y + r * 0.25, x + r * 0.25, y + r * 0.45); ctx.stroke(); }
    else if (mood === "grin") { ctx.arc(x, y + r * 0.15, r * 0.36, Math.PI * 0.1, Math.PI * 0.9); ctx.closePath(); ctx.fill(); }
    else { ctx.arc(x, y + r * 0.18, r * 0.32, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); }
    ctx.lineCap = "butt";
  }

  /* ---------------- a sound on/off button, and a wobble ---------------- */
  function soundButton(beforeEl){
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn ghost small";
    b.setAttribute("aria-label", "Sound on or off");
    const show = () => { b.textContent = store.sound === false ? "🔇" : "🔊"; };
    b.addEventListener("click", () => { store.sound = store.sound === false; Hub.saveStore(); show(); if (store.sound) sfx.pop(); });
    // other games may flip the setting too; refresh whenever the button comes back into view
    b.addEventListener("focus", show);
    show();
    beforeEl.parentNode.insertBefore(b, beforeEl);
    return { el: b, refresh: show };
  }
  function shake(el){
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.classList.remove("fun-shake"); void el.offsetWidth; el.classList.add("fun-shake");
  }

  window.Fun = { pops, sfx, face, soundButton, shake };
})();
