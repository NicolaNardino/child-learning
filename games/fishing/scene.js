/* Fishing Beach: the world, seen from the side. A sandy beach on the left with a palm tree, an umbrella,
   a sandcastle and a crab; the ocean on the right, cut open so you can see under the water: the sandy
   shallows, a colourful coral reef, the deep sea with a shipwreck, and the dark abyss. Above: a sky that
   turns from day to sunset to a starry night, with clouds, gulls and a sailboat on the horizon.
   The world is much wider than the screen (WORLD), so the game moves a camera along it; the sky stays put.
   Things that never move are painted once onto a hidden canvas; things that move are drawn every frame. */
(function(){
  "use strict";
  const W = 960, H = 540, WORLD = 2200, SURFACE = 250, SHORE_X = 318;
  // the zones along the sea floor, left to right
  const ZONE_X = [[SHORE_X, 720], [720, 1180], [1180, 1700], [1700, WORLD]];

  function seeded(seed){ return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }
  const lerp = (a, b, u) => a + (b - a) * u;
  const mix = (c1, c2, u) => {
    const p = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    const a = p(c1), b = p(c2);
    return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], u))).join(",")})`;
  };

  const smooth = u => u * u * (3 - 2 * u);
  // the beach, above the water: flat where you stand, sloping down into the sea
  const sandY = x => x < SHORE_X ? lerp(214, SURFACE + 4, Math.pow(Math.max(0, x) / SHORE_X, 2.2)) : seabedY(x);
  // how deep the ground is at x, from the beach out to the abyss
  function seabedY(x){
    if (x < SHORE_X) return sandY(x);
    if (x < 720) return lerp(SURFACE + 4, 342, smooth((x - SHORE_X) / (720 - SHORE_X)));
    if (x < 1180) return 342 + 16 * Math.sin((x - 720) / 460 * Math.PI) - 8 * Math.sin((x - 720) / 460 * Math.PI * 3);
    if (x < 1700) return lerp(342, 478, smooth((x - 1180) / 520)) + 6 * Math.sin(x * 0.02);
    return lerp(478 + 6 * Math.sin(1700 * 0.02), 610, smooth(Math.min(1, (x - 1700) / 110)));
  }
  const zoneAt = x => ZONE_X.findIndex(([a, b]) => x >= a && x < b);

  /* ---------------- painted once ---------------- */
  let still = null;
  function paintStill(){
    const c = document.createElement("canvas");
    c.width = WORLD; c.height = H;
    const g = c.getContext("2d");
    const rnd = seeded(42);
    const Wd = WORLD;

    // the ground: the sandy beach, the sandy sea floor, then darker rock going down
    const floor = g.createLinearGradient(0, 0, Wd, 0);
    floor.addColorStop(0, "#f6dfa4"); floor.addColorStop(SHORE_X / Wd, "#ead190"); floor.addColorStop(720 / Wd, "#d8bd80");
    floor.addColorStop(1180 / Wd, "#c9ae74"); floor.addColorStop(1500 / Wd, "#6a6a72"); floor.addColorStop(1, "#1a1a26");
    g.fillStyle = floor;
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= Wd; x += 3) g.lineTo(x, seabedY(x));
    g.lineTo(Wd, H); g.closePath(); g.fill();
    // sand ripples and pebbles
    for (let k = 0; k < 2200; k++) {
      const x = SHORE_X + rnd() * (Wd - SHORE_X), y = seabedY(x) + 3 + rnd() * 60;
      g.fillStyle = x < 1180 ? (rnd() < 0.5 ? "rgba(255,240,200,0.35)" : "rgba(120,90,40,0.25)") : (rnd() < 0.5 ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.2)");
      g.fillRect(x, y, 1.5 + rnd() * 2, 1.5);
    }
    g.strokeStyle = "rgba(150,120,70,0.35)"; g.lineWidth = 1.5;
    for (let x = SHORE_X + 10; x < 1170; x += 18) { const y = seabedY(x) + 8; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 6, y - 4, x + 12, y); g.stroke(); }
    // rocks
    const rock = (x, r) => {
      const y = seabedY(x);
      const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.5, 2, x, y, r * 1.2);
      gr.addColorStop(0, "#9a9aa4"); gr.addColorStop(1, "#4a4a56");
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, y + 2, r * 1.3, r * 0.8, 0, Math.PI, 0); g.fill();
      g.fillStyle = "rgba(60,120,60,0.45)"; g.beginPath(); g.ellipse(x - r * 0.3, y - r * 0.55, r * 0.5, r * 0.18, 0, 0, Math.PI * 2); g.fill();
    };
    [[400, 12], [560, 9], [690, 14], [1170, 14], [1260, 18], [1430, 14], [1650, 22], [1880, 18], [2060, 26]].forEach(([x, r]) => rock(x, r));
    // shells and starfish in the shallows
    for (let k = 0; k < 14; k++) {
      const x = SHORE_X + 20 + k * 27 + rnd() * 10, y = seabedY(x) + 4;
      g.fillStyle = ["#ffd0c0", "#fff0d8", "#ffb0a0"][k % 3];
      g.beginPath(); g.arc(x, y, 4, Math.PI, 0); g.fill();
    }
    star(g, 470, seabedY(470) + 2, 9, "#ff7a3a");
    star(g, 640, seabedY(640) + 2, 8, "#ff4fb0");
    star(g, 1010, seabedY(1010) + 2, 8, "#ffd21f");
    // coral reef
    const coralColours = ["#ff6a8a", "#ff9f1c", "#b46bff", "#ffd21f", "#ff4d4d", "#2fd0c0"];
    for (let k = 0; k < 44; k++) {
      const x = 728 + k * 10.3 + rnd() * 6, base = seabedY(x) + 3, col = coralColours[k % coralColours.length];
      if (k % 3 === 0) branchCoral(g, x, base, 30 + rnd() * 25, col, rnd);
      else if (k % 3 === 1) { g.fillStyle = col; g.beginPath(); g.ellipse(x, base - 6, 9 + rnd() * 5, 8, 0, Math.PI, 0); g.fill();
        g.strokeStyle = "rgba(0,0,0,0.2)"; g.lineWidth = 1; for (let j = 0; j < 4; j++) { g.beginPath(); g.arc(x, base - 4, 3 + j * 2, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); } }
      else fanCoral(g, x, base, 24 + rnd() * 12, col);
    }
    // a shipwreck and a treasure chest in the deep
    shipwreck(g, 1390, seabedY(1390) + 6);
    chest(g, 1300, seabedY(1300) + 2);
    chest(g, 1960, seabedY(1960) + 2);
    // anchor
    g.strokeStyle = "#3a3a44"; g.lineWidth = 4; g.lineCap = "round";
    const ax = 1580, ay = seabedY(ax) - 4;
    g.beginPath(); g.moveTo(ax, ay - 30); g.lineTo(ax, ay); g.moveTo(ax - 12, ay - 22); g.lineTo(ax + 12, ay - 22);
    g.moveTo(ax - 14, ay - 8); g.quadraticCurveTo(ax, ay + 6, ax + 14, ay - 8); g.stroke();
    // the abyss: a dark trench with glowing vents
    const trench = g.createLinearGradient(0, 430, 0, H);
    trench.addColorStop(0, "rgba(5,8,20,0)"); trench.addColorStop(1, "rgba(5,8,20,0.9)");
    g.fillStyle = trench; g.fillRect(1680, 400, Wd - 1680, H - 400);

    // the ground seen from the side: darker layers further down, under the beach and the sea floor
    const earth = g.createLinearGradient(0, 0, 0, H);
    earth.addColorStop(0, "rgba(90,60,30,0)"); earth.addColorStop(1, "rgba(90,60,30,0.5)");
    g.fillStyle = earth;
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= Wd; x += 3) g.lineTo(x, seabedY(x) + 26);
    g.lineTo(Wd, H); g.closePath(); g.fill();
    g.strokeStyle = "rgba(110,80,40,0.25)"; g.lineWidth = 3;
    [46, 80, 120].forEach(dy => { g.beginPath(); for (let x = 0; x <= Wd; x += 6) g.lineTo(x, seabedY(x) + dy + Math.sin(x * 0.03) * 4); g.stroke(); });
    // the beach: darker down in the sand, and wet near the water
    const deepSand = g.createLinearGradient(0, 220, 0, H);
    deepSand.addColorStop(0, "rgba(160,110,50,0)"); deepSand.addColorStop(1, "rgba(160,110,50,0.35)");
    g.fillStyle = deepSand;
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= Wd; x += 3) g.lineTo(x, seabedY(x));
    g.lineTo(Wd, H); g.closePath(); g.fill();
    const wet = g.createLinearGradient(SHORE_X - 70, 0, SHORE_X, 0);
    wet.addColorStop(0, "rgba(160,120,60,0)"); wet.addColorStop(1, "rgba(160,120,60,0.35)");
    g.fillStyle = wet;
    g.beginPath(); g.moveTo(SHORE_X - 70, H);
    for (let x = SHORE_X - 70; x <= SHORE_X; x += 3) g.lineTo(x, sandY(x));
    g.lineTo(SHORE_X, H); g.closePath(); g.fill();
    // sand grains
    for (let k = 0; k < 4500; k++) {
      const x = rnd() * 1180, y = seabedY(x) + rnd() * (H - seabedY(x));
      g.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.35)" : "rgba(150,110,50,0.3)";
      g.fillRect(x, y, 1.5, 1.5);
    }
    // footprints leading to where you stand
    g.fillStyle = "rgba(150,110,60,0.35)";
    for (let k = 0; k < 7; k++) { const x = 30 + k * 18, y = sandY(x) + 26 + (k % 2) * 8; g.beginPath(); g.ellipse(x, y, 5, 2.5, 0.2, 0, Math.PI * 2); g.fill(); }
    // shells, a starfish and a sandcastle
    star(g, 250, sandY(250) + 30, 10, "#ff8a5a");
    [[60, 40], [120, 70], [280, 60], [210, 120]].forEach(([x, dy]) => { g.fillStyle = "#fff0e0"; g.beginPath(); g.arc(x, sandY(x) + dy, 5, Math.PI, 0); g.fill(); g.strokeStyle = "rgba(200,140,100,0.6)"; g.lineWidth = 1; g.stroke(); });
    sandcastle(g, 70, sandY(70) + 50);
    // a towel and a bucket
    g.save(); g.translate(250, sandY(250) + 82); g.rotate(-0.06);
    for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? "#ffffff" : "#ff5a5a"; g.fillRect(-55 + k * 18, -14, 18, 28); }
    g.restore();
    g.fillStyle = "#1f6bff"; g.beginPath(); g.moveTo(120, sandY(120) + 100); g.lineTo(146, sandY(120) + 100); g.lineTo(142, sandY(120) + 126); g.lineTo(124, sandY(120) + 126); g.closePath(); g.fill();
    g.strokeStyle = "#ffd21f"; g.lineWidth = 2; g.beginPath(); g.arc(133, sandY(120) + 100, 13, Math.PI, 0); g.stroke();
    still = c;
    return c;
  }

  function star(g, x, y, r, col){
    g.fillStyle = col; g.beginPath();
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.6); }
    g.closePath(); g.fill();
    g.fillStyle = "rgba(255,255,255,0.4)"; g.beginPath(); g.arc(x, y, r * 0.2, 0, Math.PI * 2); g.fill();
  }
  function branchCoral(g, x, y, h, col, rnd){
    g.strokeStyle = col; g.lineCap = "round";
    const branch = (bx, by, a, len, w) => {
      if (len < 5) return;
      const ex = bx + Math.cos(a) * len, ey = by + Math.sin(a) * len;
      g.lineWidth = w; g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, ey); g.stroke();
      branch(ex, ey, a - 0.45 + rnd() * 0.2, len * 0.68, w * 0.72);
      branch(ex, ey, a + 0.45 - rnd() * 0.2, len * 0.68, w * 0.72);
    };
    branch(x, y, -Math.PI / 2, h * 0.45, 5);
  }
  function fanCoral(g, x, y, r, col){
    g.strokeStyle = col; g.lineWidth = 1.2;
    for (let a = -2.6; a <= -0.5; a += 0.16) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.stroke(); }
    g.beginPath(); g.arc(x, y, r, -2.6, -0.5); g.stroke();
    g.beginPath(); g.arc(x, y, r * 0.6, -2.6, -0.5); g.stroke();
  }
  function shipwreck(g, x, y){
    g.save(); g.translate(x, y); g.rotate(-0.18);
    g.fillStyle = "#4a3422";
    g.beginPath(); g.moveTo(-60, -10); g.lineTo(55, -22); g.lineTo(42, 14); g.lineTo(-48, 18); g.closePath(); g.fill();
    g.strokeStyle = "rgba(0,0,0,0.35)"; g.lineWidth = 1.5;
    for (let k = -3; k <= 2; k++) { g.beginPath(); g.moveTo(-56, -6 + k * -1 + k * 6 + 6); g.lineTo(50, -16 + k * 6 + 6); g.stroke(); }
    g.fillStyle = "#2a1c12"; g.fillRect(-6, -70, 6, 56);                       // the broken mast
    g.fillStyle = "rgba(220,210,180,0.55)"; g.beginPath(); g.moveTo(0, -66); g.lineTo(24, -50); g.lineTo(0, -34); g.fill(); // a torn sail
    g.fillStyle = "#1a120a"; [[-30, -2], [-10, -4], [10, -6]].forEach(([hx, hy]) => { g.beginPath(); g.arc(hx, hy, 4, 0, Math.PI * 2); g.fill(); });
    g.restore();
  }
  function chest(g, x, y){
    g.fillStyle = "#7a4a1a"; g.fillRect(x - 14, y - 14, 28, 14);
    g.fillStyle = "#8a5a22"; g.beginPath(); g.ellipse(x, y - 14, 14, 7, 0, Math.PI, 0); g.fill();
    g.fillStyle = "#ffd21f"; g.fillRect(x - 15, y - 15, 30, 3); g.fillRect(x - 2, y - 12, 4, 6);
    g.fillStyle = "rgba(255,230,100,0.8)"; [[-6, -20], [4, -21], [8, -18]].forEach(([cx, cy]) => { g.beginPath(); g.arc(x + cx, y + cy, 2.5, 0, Math.PI * 2); g.fill(); });
  }
  function sandcastle(g, x, y){
    g.fillStyle = "#e0bf78";
    g.fillRect(x - 26, y - 20, 52, 20);
    g.fillRect(x - 30, y - 34, 14, 34); g.fillRect(x + 16, y - 34, 14, 34); g.fillRect(x - 8, y - 42, 16, 22);
    g.fillStyle = "#cfa860";
    [[-30, -34], [16, -34], [-8, -42]].forEach(([dx, dy]) => { for (let k = 0; k < 3; k++) g.fillRect(x + dx + k * 5, y + dy - 4, 3, 4); });
    g.fillStyle = "#8a6a3a"; g.beginPath(); g.arc(x, y - 6, 5, Math.PI, 0); g.fill();
    g.strokeStyle = "#555"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y - 46); g.lineTo(x, y - 62); g.stroke();
    g.fillStyle = "#ff3b3b"; g.beginPath(); g.moveTo(x, y - 62); g.lineTo(x + 12, y - 58); g.lineTo(x, y - 54); g.fill();
  }

  /* ---------------- clouds, kelp, bubbles: things that move ---------------- */
  let clouds = null;
  function cloudSprites(){
    if (clouds) return clouds;
    clouds = [0, 1, 2].map(k => {
      const c = document.createElement("canvas"); c.width = 220; c.height = 90;
      const g = c.getContext("2d"), rnd = seeded(100 + k);
      const puffs = Array.from({ length: 9 }, () => [40 + rnd() * 140, 50 + rnd() * 16, 18 + rnd() * 18]);
      g.fillStyle = "#dfe8f4"; puffs.forEach(([x, y, r]) => { g.beginPath(); g.arc(x + 4, y + 6, r, 0, Math.PI * 2); g.fill(); });
      g.fillStyle = "#ffffff"; puffs.forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); });
      return c;
    });
    return clouds;
  }
  const KELP = Array.from({ length: 30 }, (_, k) => ({ x: 335 + k * 12.5 + (k % 3) * 4, h: 40 + (k * 37) % 50, ph: k * 0.7 }))
    .concat(Array.from({ length: 16 }, (_, k) => ({ x: 1190 + k * 30, h: 50 + (k * 23) % 50, ph: k, dark: true })));
  const bubbles = Array.from({ length: 90 }, (_, k) => ({ x: 330 + (k * 97) % (WORLD - 340), y: SURFACE + (k * 53) % 300, r: 1.5 + (k % 4), v: 14 + (k % 5) * 6 }));
  const STARS = Array.from({ length: 90 }, (_, k) => ({ x: (k * 137) % W, y: (k * 71) % (SURFACE - 30), r: k % 7 === 0 ? 1.6 : 0.9 }));

  // time of day from 0 to 1 (0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset)
  function light(day){
    const sunUp = Math.sin((day - 0.25) * Math.PI * 2);           // 1 at noon, -1 at midnight
    const dayness = Math.max(0, Math.min(1, (sunUp + 0.15) / 0.5));
    const sunset = Math.max(0, 1 - Math.abs(sunUp) / 0.35) * (sunUp > -0.3 ? 1 : 0);
    return { dayness, sunset, night: dayness < 0.35, sunUp };
  }

  function drawSky(ctx, t, L, day){
    const top = mix("#0b1030", "#3f8fe0", L.dayness), bottom = mix("#1a2350", "#bfe6ff", L.dayness);
    const sky = ctx.createLinearGradient(0, 0, 0, SURFACE);
    sky.addColorStop(0, top); sky.addColorStop(1, bottom);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, SURFACE + 2);
    if (L.sunset > 0) { ctx.fillStyle = `rgba(255,120,80,${0.25 * L.sunset})`; ctx.fillRect(0, SURFACE * 0.5, W, SURFACE * 0.5); }
    // stars and the moon at night
    if (L.dayness < 1) {
      ctx.fillStyle = "#fff";
      STARS.forEach((s, k) => { ctx.globalAlpha = (1 - L.dayness) * (0.5 + 0.5 * Math.sin(t * 2 + k)); ctx.fillRect(s.x, s.y, s.r * 2, s.r * 2); });
      ctx.globalAlpha = 1 - L.dayness;
      const mx = lerp(80, W - 80, ((day + 0.5) % 1 - 0.25) * 2), my = 150 - Math.max(0, -L.sunUp) * 110;
      ctx.fillStyle = "#f4f2e0"; ctx.beginPath(); ctx.arc(mx, my, 22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(200,200,180,0.6)"; [[-6, -5, 5], [7, 6, 4], [4, -9, 3]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(mx + dx, my + dy, r, 0, Math.PI * 2); ctx.fill(); });
      ctx.globalAlpha = 1;
    }
    // the sun, crossing the sky
    if (L.sunUp > -0.2) {
      const sx = lerp(80, W - 80, (day - 0.25) * 2), sy = SURFACE - 20 - Math.max(0, L.sunUp) * 190;
      const glow = ctx.createRadialGradient(sx, sy, 10, sx, sy, 120);
      glow.addColorStop(0, "rgba(255,250,210,0.9)"); glow.addColorStop(1, "rgba(255,240,180,0)");
      ctx.fillStyle = glow; ctx.fillRect(sx - 120, sy - 120, 240, 240);
      ctx.fillStyle = L.sunset > 0.3 ? "#ffb060" : "#fff6c0"; ctx.beginPath(); ctx.arc(sx, sy, 26, 0, Math.PI * 2); ctx.fill();
    }
    // clouds drifting
    const cs = cloudSprites();
    ctx.globalAlpha = 0.6 + 0.4 * L.dayness;
    [[0, 40, 0.8, 6], [1, 95, 0.6, 9], [2, 20, 1, 4], [0, 140, 0.5, 12]].forEach(([k, y, s, v], j) => {
      const x = ((t * v + j * 300) % (W + 260)) - 200;
      ctx.drawImage(cs[k], x, y, 220 * s, 90 * s);
    });
    ctx.globalAlpha = 1;
    // a far-away island with a lighthouse, and a sailboat
    ctx.fillStyle = mix("#1a2a40", "#5a7aa0", L.dayness);
    ctx.beginPath(); ctx.moveTo(560, SURFACE); ctx.quadraticCurveTo(640, SURFACE - 40, 720, SURFACE - 8); ctx.quadraticCurveTo(760, SURFACE - 26, 800, SURFACE); ctx.fill();
    ctx.fillRect(700, SURFACE - 52, 7, 36); ctx.fillStyle = L.night ? "#ffe680" : "#ff5a5a"; ctx.fillRect(699, SURFACE - 58, 9, 6);
    if (L.night) { ctx.fillStyle = "rgba(255,240,150,0.25)"; ctx.beginPath(); ctx.moveTo(703, SURFACE - 55); const a = t * 0.8; ctx.lineTo(703 + Math.cos(a) * 160, SURFACE - 55 + Math.sin(a) * 12 - 10); ctx.lineTo(703 + Math.cos(a) * 160, SURFACE - 55 + Math.sin(a) * 12 + 10); ctx.fill(); }
    const bx = ((t * 7) % (W + 200)) - 100;
    ctx.fillStyle = mix("#2a2a3a", "#6a4a2a", L.dayness); ctx.beginPath(); ctx.moveTo(bx - 16, SURFACE - 6); ctx.lineTo(bx + 16, SURFACE - 6); ctx.lineTo(bx + 10, SURFACE); ctx.lineTo(bx - 10, SURFACE); ctx.fill();
    ctx.fillStyle = mix("#8a8aa0", "#ffffff", L.dayness); ctx.beginPath(); ctx.moveTo(bx, SURFACE - 36); ctx.lineTo(bx + 14, SURFACE - 8); ctx.lineTo(bx, SURFACE - 8); ctx.fill();
    // seagulls
    if (L.dayness > 0.3) {
      ctx.strokeStyle = "rgba(40,40,50,0.8)"; ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        const gx = ((t * (22 + k * 5) + k * 300) % (W + 100)) - 50, gy = 70 + k * 30 + Math.sin(t + k) * 8, f = Math.sin(t * 7 + k) * 5;
        ctx.beginPath(); ctx.moveTo(gx - 10, gy - f); ctx.quadraticCurveTo(gx - 5, gy - 6, gx, gy); ctx.quadraticCurveTo(gx + 5, gy - 6, gx + 10, gy - f); ctx.stroke();
      }
    }
  }

  // the waterline: little moving waves
  const waveY = (x, t) => SURFACE + Math.sin(x * 0.035 + t * 1.6) * 3 + Math.sin(x * 0.09 - t * 2.3) * 1.5;

  function drawWater(ctx, t, L){
    // under the water: bright near the top and the beach, dark down deep and far out
    const deep = ctx.createLinearGradient(0, SURFACE, 0, H);
    deep.addColorStop(0, mix("#0a2a50", "#2fb0d8", L.dayness)); deep.addColorStop(1, mix("#020818", "#0a3a6a", L.dayness));
    ctx.fillStyle = deep; ctx.fillRect(SHORE_X - 60, SURFACE, WORLD, H - SURFACE);
    const far = ctx.createLinearGradient(SHORE_X, 0, WORLD, 0);
    far.addColorStop(0, "rgba(120,230,230,0.25)"); far.addColorStop(0.45, "rgba(0,0,0,0)"); far.addColorStop(1, "rgba(0,0,20,0.5)");
    ctx.fillStyle = far; ctx.fillRect(SHORE_X - 60, SURFACE, WORLD, H - SURFACE);
    // sunbeams through the water
    if (L.dayness > 0.2) {
      ctx.save(); ctx.globalAlpha = 0.12 * L.dayness;
      for (let k = 0; k < 20; k++) {
        const x = 360 + k * 90 + Math.sin(t * 0.4 + k) * 20;
        const g = ctx.createLinearGradient(0, SURFACE, 0, SURFACE + 220);
        g.addColorStop(0, "#ffffff"); g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, SURFACE); ctx.lineTo(x + 26, SURFACE); ctx.lineTo(x + 70, SURFACE + 240); ctx.lineTo(x + 20, SURFACE + 240); ctx.fill();
      }
      ctx.restore();
    }
    ctx.drawImage(paintStill(), 0, 0);
    // everything under the surface looks a bit blue, sea floor too
    ctx.fillStyle = L.dayness > 0.5 ? "rgba(30,140,190,0.32)" : "rgba(10,40,90,0.42)";
    ctx.beginPath(); ctx.moveTo(SHORE_X - 2, SURFACE + 2); ctx.lineTo(WORLD, SURFACE + 2);
    for (let x = WORLD; x >= SHORE_X - 2; x -= 6) ctx.lineTo(x, seabedY(x) + 6);
    ctx.closePath(); ctx.fill();
    // swaying kelp
    KELP.forEach(k => {
      const base = seabedY(k.x) + 4;
      ctx.strokeStyle = k.dark ? "#1f4a3a" : "#2f8a4a"; ctx.lineWidth = 4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(k.x, base);
      for (let s = 1; s <= 6; s++) { const y = base - k.h * s / 6; ctx.lineTo(k.x + Math.sin(t * 1.4 + k.ph + s * 0.6) * s * 1.8, y); }
      ctx.stroke();
      ctx.fillStyle = k.dark ? "#2a5a44" : "#4aa85a";
      for (let s = 2; s <= 6; s += 2) { const y = base - k.h * s / 6, x = k.x + Math.sin(t * 1.4 + k.ph + s * 0.6) * s * 1.8; ctx.beginPath(); ctx.ellipse(x + 5, y, 6, 2.5, 0.5, 0, Math.PI * 2); ctx.fill(); }
    });
    // glowing specks in the abyss
    ctx.fillStyle = "#7af0ff";
    for (let k = 0; k < 36; k++) { ctx.globalAlpha = 0.3 + 0.3 * Math.sin(t * 2 + k); ctx.fillRect(1720 + (k * 53) % 470, 470 + (k * 37) % 70 + Math.sin(t + k) * 4, 2, 2); }
    ctx.globalAlpha = 1;
    // bubbles rising
    ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 1;
    bubbles.forEach(b => {
      const y = SURFACE + 4 + ((b.y - t * b.v) % 300 + 300) % 300, x = b.x + Math.sin(t * 2 + b.y) * 3;
      if (y > seabedY(x)) return;
      ctx.beginPath(); ctx.arc(x, y, b.r, 0, Math.PI * 2); ctx.stroke();
    });
  }

  function drawSurface(ctx, t, L){
    // a see-through band just under the waves
    ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(SHORE_X, SURFACE, WORLD, 10);
    ctx.strokeStyle = mix("#7ab0d0", "#e8fbff", L.dayness); ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = SHORE_X - 6; x <= WORLD; x += 6) { const y = waveY(x, t); if (x === SHORE_X - 6) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
    // sparkles on the water
    if (L.dayness > 0.3) {
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      for (let k = 0; k < 36; k++) { const x = 360 + (k * 61) % (WORLD - 380), a = Math.sin(t * 3 + k * 1.7); if (a > 0.6) ctx.fillRect(x, waveY(x, t) - 1, 4, 1.5); }
    }
    // foam washing up the beach
    const reach = 6 + Math.sin(t * 0.9) * 8;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.beginPath(); ctx.moveTo(SHORE_X - 40 - reach, sandY(SHORE_X - 40 - reach) + 1);
    for (let x = SHORE_X - 40 - reach; x <= SHORE_X + 10; x += 4) ctx.lineTo(x, sandY(Math.min(x, SHORE_X)) + 2 + Math.sin(x * 0.4 + t * 3) * 1.2);
    ctx.lineTo(SHORE_X + 10, SURFACE + 8); ctx.lineTo(SHORE_X - 40 - reach, sandY(SHORE_X - 40 - reach) + 6); ctx.fill();
  }

  // the palm tree, the umbrella and the crab, on the beach
  function drawBeachThings(ctx, t){
    // palm tree
    const px = 40, py = sandY(px) + 10;
    ctx.strokeStyle = "#8a5a2a"; ctx.lineWidth = 14; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + 30, py - 110, px + 18, py - 210); ctx.stroke();
    ctx.strokeStyle = "rgba(60,30,10,0.4)"; ctx.lineWidth = 2;
    for (let k = 1; k < 12; k++) { const u = k / 12, x = (1 - u) * (1 - u) * px + 2 * (1 - u) * u * (px + 30) + u * u * (px + 18), y = py - 210 * u; ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y - 3); ctx.stroke(); }
    const tx = px + 18, ty = py - 210;
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI + k * (Math.PI / 6) + Math.sin(t * 1.2 + k) * 0.06;
      ctx.strokeStyle = "#2f8a3a"; ctx.lineWidth = 3; ctx.fillStyle = k % 2 ? "#3aa848" : "#2f9a3e";
      ctx.beginPath(); ctx.moveTo(tx, ty);
      const ex = tx + Math.cos(a) * 85, ey = ty + Math.sin(a) * 40 + 30;
      ctx.quadraticCurveTo(tx + Math.cos(a) * 45, ty + Math.sin(a) * 50 - 20, ex, ey);
      ctx.quadraticCurveTo(tx + Math.cos(a) * 40, ty + Math.sin(a) * 30 - 2, tx, ty); ctx.fill();
    }
    ctx.fillStyle = "#6a4a1a"; [[-6, 6], [6, 8], [0, 12]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.arc(tx + dx, ty + dy, 6, 0, Math.PI * 2); ctx.fill(); }); // coconuts
    // beach umbrella
    const ux = 255, uy = sandY(255) + 70;
    ctx.strokeStyle = "#ddd"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ux, uy); ctx.lineTo(ux - 10, uy - 110); ctx.stroke();
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = k % 2 ? "#ffffff" : "#1f9adf";
      ctx.beginPath(); ctx.moveTo(ux - 10, uy - 118);
      ctx.lineTo(ux - 70 + k * 20, uy - 92 + Math.abs(k - 2.5) * 2); ctx.lineTo(ux - 50 + k * 20, uy - 92 + Math.abs(k - 1.5) * 2); ctx.closePath(); ctx.fill();
    }
    // a crab scuttling along the wet sand
    const cx = 210 + Math.sin(t * 0.5) * 40, cy = sandY(cx) + 18 + Math.abs(Math.sin(t * 6)) * 1.5;
    ctx.fillStyle = "#e8432f";
    ctx.beginPath(); ctx.ellipse(cx, cy, 11, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#c8301f"; ctx.lineWidth = 2;
    for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(cx - 8, cy + k * 2 + 2); ctx.lineTo(cx - 15, cy + 6 + k * 3 + Math.sin(t * 12 + k) * 2); ctx.moveTo(cx + 8, cy + k * 2 + 2); ctx.lineTo(cx + 15, cy + 6 + k * 3 - Math.sin(t * 12 + k) * 2); ctx.stroke(); }
    ctx.fillStyle = "#e8432f"; ctx.beginPath(); ctx.arc(cx - 13, cy - 6, 4, 0, Math.PI * 2); ctx.arc(cx + 13, cy - 6, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(cx - 3, cy - 8, 1.6, 0, Math.PI * 2); ctx.arc(cx + 3, cy - 8, 1.6, 0, Math.PI * 2); ctx.fill();
  }

  // a dark blue layer at night (drawn last, so everything gets darker)
  function drawNight(ctx, L){
    const a = (1 - L.dayness) * 0.45;
    if (a > 0.01) { ctx.fillStyle = `rgba(8,16,48,${a})`; ctx.fillRect(0, 0, W, H); }
  }

  window.FishingScene = { W, H, WORLD, SURFACE, SHORE_X, ZONE_X, seabedY, sandY, zoneAt, waveY, light, drawSky, drawWater, drawSurface, drawBeachThings, drawNight };
})();
