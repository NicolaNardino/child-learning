/* Atom Builder: the 3D scene on top of the Quantum Quiz. Every right answer adds a proton, some neutrons and an
   electron, so the atom grows from hydrogen (1 right) to neon (10 right): electrons fill the first shell (2),
   then the second (8), like real atoms do. A wrong answer kicks an electron up a shell for a moment, and when
   it falls back it lets out a photon, which is how atoms really make light.
     const atom = QuantumAtom(box)   puts the scene in box: { answer(right), element(z), stop() } */
(function(){
  "use strict";
  const ELEMENTS = [
    null,
    { s: "H", name: "Hydrogen", n: 0, fact: "the stuff stars burn" },
    { s: "He", name: "Helium", n: 2, fact: "makes balloons float" },
    { s: "Li", name: "Lithium", n: 4, fact: "in phone batteries" },
    { s: "Be", name: "Beryllium", n: 5, fact: "in space telescope mirrors" },
    { s: "B", name: "Boron", n: 6, fact: "in slime" },
    { s: "C", name: "Carbon", n: 6, fact: "in diamonds, pencils and you" },
    { s: "N", name: "Nitrogen", n: 7, fact: "most of the air" },
    { s: "O", name: "Oxygen", n: 8, fact: "what you breathe" },
    { s: "F", name: "Fluorine", n: 10, fact: "in toothpaste" },
    { s: "Ne", name: "Neon", n: 10, fact: "glows in neon signs" }
  ];
  const W = 720, H = 260, CX = 470, CY = 132, F = 340, D = 300;
  const SHELLS = [{ r: 62, cap: 2, rx: 1.2, rz: 0.3, speed: 1.6 }, { r: 108, cap: 8, rx: 0.45, rz: -0.5, speed: 0.9 }];

  window.QuantumAtom = function(box){
    const c = document.createElement("canvas");
    c.className = "qm-atom3d"; c.width = W; c.height = H;
    box.appendChild(c);
    const ctx = c.getContext("2d");
    let z = 0, t = 0, last = performance.now(), alive = true, scale = 1;
    const pops = [], photons = [], stars = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.6 + 0.4, p: Math.random() * 6 }));
    const born = [];          // when each nucleon and electron appeared, for the pop-in
    let jump = null;          // an electron kicked up a shell by a wrong answer

    const nucleons = () => z + (z ? ELEMENTS[z].n : 0);
    function nucleonPos(i, N){
      if (N === 1) return [0, 0, 0];
      const r = 10 * Math.cbrt(N), k = (i + 0.5) / N, phi = Math.acos(1 - 2 * k), th = Math.PI * (1 + Math.sqrt(5)) * i;
      return [r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th)];
    }
    // turn the world, then look at it in perspective
    function view(p){
      const a = t * 0.35, ca = Math.cos(a), sa = Math.sin(a);
      let [x, y, zz] = p;
      [x, zz] = [x * ca + zz * sa, -x * sa + zz * ca];
      const tilt = 0.32, ct = Math.cos(tilt), st = Math.sin(tilt);
      [y, zz] = [y * ct - zz * st, y * st + zz * ct];
      const k = F / Math.max(D + zz, 120);   // never let anything get behind the camera
      return { x: CX + x * k, y: CY + y * k, k, z: zz };
    }
    function onShell(sh, ang, r){
      let x = r * Math.cos(ang), y = 0, zz = r * Math.sin(ang);
      const cx = Math.cos(sh.rx), sx = Math.sin(sh.rx);
      [y, zz] = [y * cx - zz * sx, y * sx + zz * cx];
      const cz = Math.cos(sh.rz), sz = Math.sin(sh.rz);
      [x, y] = [x * cz - y * sz, x * sz + y * cz];
      return [x, y, zz];
    }
    function electrons(){
      const out = [];
      let left = z;
      SHELLS.forEach((sh, si) => {
        const n = Math.min(sh.cap, left); left -= n;
        for (let i = 0; i < n; i++) {
          const idx = out.length, ang = t * sh.speed + (i / n) * Math.PI * 2;
          let r = sh.r;
          const b = born[idx];
          if (b !== undefined && t - b < 0.7) r = sh.r + (1 - (t - b) / 0.7) * 150;   // flies in from far away
          if (jump && jump.idx === idx) r += Math.sin(Math.min(1, jump.t / 0.9) * Math.PI) * 46;
          out.push({ p: onShell(sh, ang, r), si });
        }
      });
      return out;
    }

    function fit(){
      const s = window.Fun ? Fun.res(c.clientWidth || W, W, 2) : 1;
      if (Math.abs(s - scale) < 0.01) return;
      scale = s; c.width = Math.round(W * s); c.height = Math.round(H * s);
    }
    function ball(x, y, r, inner, outer){
      const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
      g.addColorStop(0, inner); g.addColorStop(1, outer);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
    function draw(dt){
      fit();
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#0b1030"); g.addColorStop(1, "#1d1758");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      stars.forEach(s => { ctx.globalAlpha = 0.4 + 0.4 * Math.sin(t * 2 + s.p); ctx.fillStyle = "#fff"; ctx.fillRect(s.x, s.y, s.s, s.s); });
      ctx.globalAlpha = 1;

      // the shells: faint rings, brighter where electrons live
      let left = z;
      SHELLS.forEach(sh => {
        const used = Math.min(sh.cap, left); left -= used;
        ctx.strokeStyle = used ? "rgba(120,200,255,0.45)" : "rgba(120,200,255,0.12)"; ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i <= 64; i++) { const v = view(onShell(sh, i / 64 * Math.PI * 2, sh.r)); i ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y); }
        ctx.stroke();
      });

      // nucleus and electrons, farthest first
      const items = [], N = nucleons();
      for (let i = 0; i < N; i++) {
        const v = view(nucleonPos(i, N)), proton = isProton(i, N);
        items.push({ v, draw: () => ball(v.x, v.y, 12 * v.k * popIn(i), proton ? "#ff8d8d" : "#e3e6f0", proton ? "#c61f2c" : "#7d8396") });
      }
      electrons().forEach(e => {
        const v = view(e.p);
        items.push({ v, draw: () => {
          const gl = ctx.createRadialGradient(v.x, v.y, 0, v.x, v.y, 16 * v.k);
          gl.addColorStop(0, "rgba(120,220,255,0.9)"); gl.addColorStop(1, "rgba(120,220,255,0)");
          ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(v.x, v.y, 16 * v.k, 0, 7); ctx.fill();
          ball(v.x, v.y, 7 * v.k, "#e9fbff", "#2b9cff");
        } });
      });
      items.sort((a, b) => b.v.z - a.v.z).forEach(it => it.draw());

      // photons: little wiggly light waves flying away
      for (let i = photons.length - 1; i >= 0; i--) {
        const ph = photons[i]; ph.t += dt;
        if (ph.t > 1.4) { photons.splice(i, 1); continue; }
        const d = ph.t * 260;
        ctx.strokeStyle = ph.colour; ctx.lineWidth = 3; ctx.globalAlpha = 1 - ph.t / 1.4;
        ctx.beginPath();
        for (let s = 0; s <= 40; s++) {
          const u = d - 60 + s * 1.5, w = Math.sin(u * 0.25) * 6;
          const x = ph.x + Math.cos(ph.a) * u - Math.sin(ph.a) * w, y = ph.y + Math.sin(ph.a) * u + Math.cos(ph.a) * w;
          s ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke(); ctx.globalAlpha = 1;
      }

      // the periodic-table tile for what you've built
      const el = ELEMENTS[z];
      ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.strokeStyle = el ? "#ffe14d" : "rgba(255,255,255,0.3)"; ctx.lineWidth = 3;
      ctx.fillRect(50, 30, 150, 150); ctx.strokeRect(50, 30, 150, 150);
      ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillStyle = "#cfe8ff";
      ctx.font = '800 18px "Bricolage Grotesque", system-ui, sans-serif'; ctx.fillText(String(z), 62, 40);
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fff";
      ctx.font = '900 64px "Bricolage Grotesque", system-ui, sans-serif'; ctx.fillText(el ? el.s : "?", 125, 100);
      ctx.font = '800 15px "Bricolage Grotesque", system-ui, sans-serif'; ctx.fillStyle = "#ffe14d";
      ctx.fillText(el ? el.name : "No atom yet", 125, 158);
      ctx.font = "600 13px system-ui, sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillText(el ? el.fact : "Answer right to build one!", 125, 206, 240);
      ctx.fillText(`${z} proton${z === 1 ? "" : "s"} · ${z} electron${z === 1 ? "" : "s"}`, 125, 228, 240);

      for (let i = pops.length - 1; i >= 0; i--) {
        const p = pops[i]; p.t += dt;
        if (p.t > 1.6) { pops.splice(i, 1); continue; }
        const s = p.t < 0.15 ? p.t / 0.15 * 1.2 : 1;
        ctx.globalAlpha = p.t > 1.1 ? 1 - (p.t - 1.1) / 0.5 : 1;
        ctx.save(); ctx.translate(CX, 28 - p.t * 8); ctx.scale(s, s);
        ctx.font = '900 26px "Bricolage Grotesque", system-ui, sans-serif'; ctx.lineWidth = 6; ctx.strokeStyle = "#14102c"; ctx.lineJoin = "round";
        ctx.strokeText(p.text, 0, 0); ctx.fillStyle = p.colour; ctx.fillText(p.text, 0, 0);
        ctx.restore(); ctx.globalAlpha = 1;
      }
    }
    // protons (red) and neutrons (grey) spread evenly through the nucleus
    function isProton(i, N){ return Math.floor((i + 1) * z / N) > Math.floor(i * z / N); }
    function popIn(i){ const b = born[100 + i]; return b === undefined || t - b > 0.4 ? 1 : 0.3 + 0.7 * (t - b) / 0.4; }

    function frame(now){
      if (!alive || !c.isConnected) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      if (jump) {
        jump.t += dt;
        if (!jump.fell && jump.t >= 0.9) {
          jump.fell = true;
          const e = electrons()[jump.idx], v = e ? view(e.p) : { x: CX, y: CY };
          photons.push({ x: v.x, y: v.y, a: Math.random() * Math.PI * 2, t: 0, colour: "#ff9a5a" });
        }
        if (jump.t > 1.2) jump = null;
      }
      draw(dt);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    return {
      answer(right){
        if (right && z < 10) {
          const before = nucleons();
          z++;
          born[z - 1] = t;
          for (let i = before; i < nucleons(); i++) born[100 + i] = t;
          pops.push({ text: ELEMENTS[z].name.toUpperCase() + "!", colour: "#ffe14d", t: 0 });
          photons.push({ x: CX, y: CY, a: -Math.PI / 2 + (Math.random() - 0.5), t: 0, colour: "#ffe14d" });
          if (window.Fun) Fun.sfx.zap();
        } else if (!right) {
          if (z) { jump = { idx: z - 1, t: 0, fell: false }; pops.push({ text: "ZAP! A PHOTON!", colour: "#ff9a5a", t: 0 }); }
          else pops.push({ text: "POOF!", colour: "#ff9a5a", t: 0 });
        }
      },
      element: n => ELEMENTS[n] || null,
      stop(){ alive = false; }
    };
  };
})();
