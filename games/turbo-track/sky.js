/* Turbo Track's sky: the track floats high up, so looking down past it you see the sky far below.
   Layers, from farthest to nearest: a blue sky with the sun's glow, far clouds, near clouds,
   birds and hot-air balloons, floating grassy islands, then (after the track and cars) a few
   wispy clouds drifting above it all. Farther layers move less as the camera moves, which makes
   it feel deep. Clouds and islands are painted once into little canvases, then just copied. */
(function(){
  "use strict";

  // the same "random" numbers every time, so the sky looks the same every race
  function seeded(seed){
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const mod = (a, n) => ((a % n) + n) % n;

  /* ---------------- clouds ---------------- */
  function makeCloud(seed){
    const rnd = seeded(seed);
    const c = document.createElement("canvas");
    c.width = 420; c.height = 240;
    const g = c.getContext("2d");
    const puffs = [];
    for (let k = 0; k < 16; k++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd());
      puffs.push([210 + Math.cos(a) * d * 130, 125 + Math.sin(a) * d * 55, 34 + rnd() * 38]);
    }
    // a blue-grey underside, the white puffs, then a bright top
    g.fillStyle = "#c9dbf2";
    puffs.forEach(([x, y, r]) => { g.beginPath(); g.arc(x + 6, y + 12, r, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = "#ffffff";
    puffs.forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = "rgba(255,255,255,0.9)";
    puffs.forEach(([x, y, r]) => { g.beginPath(); g.arc(x - r * 0.25, y - r * 0.3, r * 0.55, 0, Math.PI * 2); g.fill(); });
    return c;
  }

  /* ---------------- floating islands ---------------- */
  function makeIsland(r, seed, extras){
    const rnd = seeded(seed);
    const pad = 30, depth = r * 0.35;
    const c = document.createElement("canvas");
    c.width = r * 2 + pad * 2; c.height = r * 2 + pad * 2 + depth;
    const g = c.getContext("2d");
    const cx = r + pad, cy = r + pad;
    // a wobbly round shape
    const pts = [];
    const bumps = [rnd() * 6, rnd() * 6, rnd() * 6];
    for (let k = 0; k < 48; k++) {
      const a = k / 48 * Math.PI * 2;
      const rr = r * (0.84 + 0.07 * Math.sin(a * 3 + bumps[0]) + 0.05 * Math.sin(a * 5 + bumps[1]) + 0.03 * Math.sin(a * 9 + bumps[2]));
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.92]);
    }
    const shape = (dy, scale) => {
      g.beginPath();
      pts.forEach(([x, y], k) => {
        const px = cx + (x - cx) * scale, py = cy + (y - cy) * scale + dy;
        if (k) g.lineTo(px, py); else g.moveTo(px, py);
      });
      g.closePath();
    };
    // the rocky underside, in layers that get smaller further down
    [[depth, 0.7, "#5a3b22"], [depth * 0.7, 0.85, "#6e4a2b"], [depth * 0.4, 0.95, "#83593a"], [depth * 0.15, 1, "#946944"]].forEach(([dy, s, col]) => {
      g.fillStyle = col; shape(dy, s); g.fill();
    });
    // grass on top
    const grass = g.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    grass.addColorStop(0, "#8fdc5a"); grass.addColorStop(1, "#4fa83a");
    g.fillStyle = grass; shape(0, 1); g.fill();
    g.strokeStyle = "#3d8a2c"; g.lineWidth = 4; g.stroke();
    // grass texture: little light and dark blades
    g.save(); shape(0, 1); g.clip();
    for (let k = 0; k < r * 6; k++) {
      const x = cx + (rnd() - 0.5) * 2 * r, y = cy + (rnd() - 0.5) * 2 * r;
      g.strokeStyle = rnd() < 0.5 ? "rgba(255,255,200,0.25)" : "rgba(20,70,10,0.22)";
      g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 4, y - 4 - rnd() * 4); g.stroke();
    }
    g.restore();
    const inside = () => { const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r * 0.62; return [cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.9]; };
    if (extras.pond) {
      const [x, y] = [cx + r * 0.25, cy + r * 0.2];
      g.fillStyle = "#3d8a2c"; g.beginPath(); g.ellipse(x, y, r * 0.24, r * 0.16, 0.3, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#3fa9f5"; g.beginPath(); g.ellipse(x, y, r * 0.21, r * 0.13, 0.3, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(255,255,255,0.6)"; g.beginPath(); g.ellipse(x - r * 0.06, y - r * 0.04, r * 0.06, r * 0.025, 0.3, 0, Math.PI * 2); g.fill();
    }
    if (extras.house) {
      const [x, y] = [cx - r * 0.2, cy - r * 0.1], s = r * 0.14;
      g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(x - s + 6, y - s + 8, s * 2, s * 1.6);
      g.fillStyle = "#f3e2c0"; g.fillRect(x - s, y - s, s * 2, s * 1.6);
      g.fillStyle = "#d8452f"; g.beginPath(); g.moveTo(x - s * 1.15, y - s * 0.2); g.lineTo(x, y - s * 1.25); g.lineTo(x + s * 1.15, y - s * 0.2); g.closePath(); g.fill();
      g.fillStyle = "#a83222"; g.beginPath(); g.moveTo(x - s * 1.15, y - s * 0.2); g.lineTo(x, y + s * 0.75); g.lineTo(x + s * 1.15, y - s * 0.2); g.closePath(); g.fill();
      g.fillStyle = "#7a4a2a"; g.fillRect(x - s * 0.15, y + s * 0.15, s * 0.3, s * 0.45);
    }
    // flowers
    for (let k = 0; k < (extras.flowers || 0); k++) {
      const [x, y] = inside();
      g.fillStyle = ["#fff", "#ffe14d", "#ff6bd6", "#ff4d4d"][k % 4];
      g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
    }
    // trees: a shadow, a dark round top and a sunny highlight
    for (let k = 0; k < (extras.trees || 0); k++) {
      const [x, y] = inside(), tr = 12 + rnd() * 14;
      g.fillStyle = "rgba(0,40,0,0.3)"; g.beginPath(); g.arc(x + 6, y + 8, tr, 0, Math.PI * 2); g.fill();
      g.fillStyle = rnd() < 0.3 ? "#2f7d3a" : "#3c9b44"; g.beginPath(); g.arc(x, y, tr, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(190,255,140,0.35)"; g.beginPath(); g.arc(x - tr * 0.3, y - tr * 0.3, tr * 0.5, 0, Math.PI * 2); g.fill();
    }
    return { canvas: c, ox: cx, oy: cy };
  }

  /* ---------------- hot-air balloons and birds ---------------- */
  function makeBalloon(colours){
    const c = document.createElement("canvas");
    c.width = 120; c.height = 120;
    const g = c.getContext("2d");
    g.fillStyle = "rgba(30,60,120,0.25)"; g.beginPath(); g.arc(68, 72, 48, 0, Math.PI * 2); g.fill();
    for (let k = 0; k < 12; k++) {
      g.fillStyle = colours[k % colours.length];
      g.beginPath(); g.moveTo(60, 60); g.arc(60, 60, 50, k / 12 * Math.PI * 2, (k + 1) / 12 * Math.PI * 2); g.closePath(); g.fill();
    }
    const shine = g.createRadialGradient(45, 42, 4, 60, 60, 50);
    shine.addColorStop(0, "rgba(255,255,255,0.55)"); shine.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = shine; g.beginPath(); g.arc(60, 60, 50, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#8a5a2b"; g.fillRect(53, 53, 14, 14); // the basket
    g.strokeStyle = "#5a3b1a"; g.lineWidth = 2; g.strokeRect(53, 53, 14, 14);
    return c;
  }

  let ready = null;
  function setup(){
    if (ready) return ready;
    const rnd = seeded(7);
    const clouds = [0, 1, 2, 3, 4].map(k => makeCloud(100 + k));
    // screen-sized tiles that repeat; each layer has its own depth (how much it moves with the camera)
    const layer = (n, depth, scale, alpha, wind) => ({
      depth, scale, alpha, wind,
      items: Array.from({ length: n }, (_, k) => ({ x: rnd() * 1600, y: rnd() * 1000, img: clouds[k % clouds.length], s: 0.7 + rnd() * 0.6 }))
    });
    ready = {
      far: layer(9, 0.3, 0.45, 0.75, 6),
      near: layer(7, 0.55, 0.8, 0.95, 10),
      top: layer(4, 1.35, 1.8, 0.15, 16),
      islands: [
        [1700, 1150, 330, 11, { trees: 9, house: true, pond: true, flowers: 26 }],
        [2380, 960, 120, 12, { trees: 3, flowers: 8 }],
        [620, 1330, 150, 13, { trees: 4, flowers: 12 }],
        [3300, 2250, 210, 14, { trees: 6, pond: true, flowers: 14 }],
        [-150, 200, 200, 15, { trees: 5, flowers: 10 }],
        [3350, 250, 160, 16, { trees: 4, house: true, flowers: 8 }],
        [1500, 2450, 180, 17, { trees: 5, flowers: 12 }],
        [2150, 650, 90, 18, { trees: 2 }]
      ].map(([x, y, r, seed, extras]) => Object.assign({ x, y }, makeIsland(r, seed, extras))),
      balloons: [
        { x: 300, y: 300, img: makeBalloon(["#ff4d4d", "#ffe14d"]), vx: 9, vy: 4 },
        { x: 1100, y: 650, img: makeBalloon(["#4da6ff", "#ffffff", "#b46bff"]), vx: -7, vy: 3 }
      ],
      birds: Array.from({ length: 6 }, (_, k) => ({ x: 200 + k * 26 + rnd() * 10, y: 160 + Math.abs(k - 2.5) * 16, f: rnd() * 6 }))
    };
    return ready;
  }

  // a repeating layer in screen space: camera movement times depth, plus a slow drift in the wind
  function drawLayer(ctx, L, cam, zoom, W, H, t){
    const TW = W + 900, TH = H + 600;
    ctx.globalAlpha = L.alpha;
    L.items.forEach(it => {
      const w = it.img.width * L.scale * it.s * zoom, h = it.img.height * L.scale * it.s * zoom;
      const x = mod(it.x * (TW / 1600) - cam.x * zoom * L.depth + t * L.wind, TW) - 450;
      const y = mod(it.y * (TH / 1000) - cam.y * zoom * L.depth + t * L.wind * 0.3, TH) - 300;
      ctx.drawImage(it.img, x - w / 2, y - h / 2, w, h);
    });
    ctx.globalAlpha = 1;
  }

  // everything below the track
  function drawBelow(ctx, cam, zoom, W, H, t){
    const S = setup();
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#7cc4ff"); sky.addColorStop(0.6, "#a9dbff"); sky.addColorStop(1, "#cdeaff");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    const sun = ctx.createRadialGradient(W * 0.12, H * 0.1, 10, W * 0.12, H * 0.1, W * 0.55);
    sun.addColorStop(0, "rgba(255,250,210,0.85)"); sun.addColorStop(0.2, "rgba(255,245,200,0.35)"); sun.addColorStop(1, "rgba(255,245,200,0)");
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);

    drawLayer(ctx, S.far, cam, zoom, W, H, t);
    drawLayer(ctx, S.near, cam, zoom, W, H, t);

    // birds flapping across, far down
    const bx = mod(t * 40 - cam.x * zoom * 0.5, W + 600) - 300, by = mod(-cam.y * zoom * 0.5 + 120, H + 400) - 200;
    ctx.strokeStyle = "rgba(40,50,70,0.75)"; ctx.lineWidth = 2;
    S.birds.forEach(b => {
      const flap = Math.sin(t * 9 + b.f) * 4;
      ctx.beginPath();
      ctx.moveTo(bx + b.x - 7, by + b.y - flap); ctx.lineTo(bx + b.x, by + b.y); ctx.lineTo(bx + b.x + 7, by + b.y - flap);
      ctx.stroke();
    });

    // hot-air balloons, drifting
    S.balloons.forEach(b => {
      const s = 0.85 * zoom;
      const x = mod(b.x + t * b.vx - cam.x * zoom * 0.7, W + 400) - 200, y = mod(b.y + t * b.vy - cam.y * zoom * 0.7, H + 400) - 200;
      ctx.drawImage(b.img, x - 60 * s, y - 60 * s, 120 * s, 120 * s);
    });

    // floating islands, a little below the track
    const d = 0.86;
    S.islands.forEach(is => {
      const s = zoom * d;
      const x = W / 2 + (is.x - cam.x) * s, y = H / 2 + (is.y - cam.y) * s;
      const w = is.canvas.width * s, h = is.canvas.height * s;
      if (x + w < 0 || x - w > W || y + h < 0 || y - h > H) return;
      ctx.drawImage(is.canvas, x - is.ox * s, y - is.oy * s, w, h);
    });
  }

  // wispy clouds drifting above the track
  function drawAbove(ctx, cam, zoom, W, H, t){
    drawLayer(ctx, setup().top, cam, zoom, W, H, t);
  }

  window.TurboTrackSky = { drawBelow, drawAbove };
})();
