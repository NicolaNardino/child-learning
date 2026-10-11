/* Fishing Beach: the 500 fish and how to draw them. There are 25 kinds of fish (species), each living
   in one part of the ocean, and every kind comes in 20 versions (variants), from plain Common ones up to
   a Mythic Celestial one: 25 × 20 = 500. Every fish is drawn from shapes and colours, facing right. */
(function(){
  "use strict";

  // zones of the ocean, from the beach out to the far deep water
  const ZONES = [
    { id: "shore", name: "Shallows", emoji: "🏖️" },
    { id: "reef",  name: "Coral Reef", emoji: "🪸" },
    { id: "deep",  name: "Deep Sea", emoji: "🌊" },
    { id: "abyss", name: "The Abyss", emoji: "🕳️" }
  ];

  const RARITIES = [
    { id: "common",    name: "Common",    colour: "#9aa6b2", weight: 60 },
    { id: "uncommon",  name: "Uncommon",  colour: "#4dd66b", weight: 25 },
    { id: "rare",      name: "Rare",      colour: "#4da6ff", weight: 10 },
    { id: "epic",      name: "Epic",      colour: "#b46bff", weight: 4 },
    { id: "legendary", name: "Legendary", colour: "#ffb020", weight: 0.9 },
    { id: "mythic",    name: "Mythic",    colour: "#ff4fb0", weight: 0.12 }
  ];

  // name, zone, shape, [body, belly, fin] colours, size in cm [min, max], how often it bites (1 = normal), night only
  const SPECIES = [
    ["Perch", 0, "perch", ["#7a9a3a", "#e8e0a0", "#e86a2a"], [15, 40], 1.2],
    ["Sardine", 0, "slim", ["#4a7aa8", "#e6eef4", "#7a9ab8"], [10, 20], 1.3],
    ["Mackerel", 0, "slim", ["#2f7a8a", "#f0f2f0", "#4a6a7a"], [25, 45], 1.1],
    ["Flounder", 0, "flat", ["#8a7050", "#c8b090", "#6a5038"], [20, 50], 0.9],
    ["Mullet", 0, "slim", ["#7a8a96", "#dde4ea", "#5a6874"], [30, 60], 1],
    ["Sea Bream", 0, "perch", ["#a8a8b8", "#f0f0f6", "#d86a8a"], [20, 50], 0.9],
    ["Goby", 0, "round", ["#a89060", "#efe2c0", "#7a6040"], [5, 15], 1],
    ["Clownfish", 1, "round", ["#ff7a1f", "#ffb060", "#1a1a1a"], [8, 12], 0.8, false, "banded"],
    ["Pufferfish", 1, "ball", ["#d8c070", "#fff4d0", "#a89040"], [15, 50], 0.8],
    ["Parrotfish", 1, "perch", ["#2fc0a0", "#a0f0d8", "#ff6aa0"], [30, 80], 1],
    ["Angelfish", 1, "disc", ["#ffd21f", "#fff6c0", "#1f6bff"], [15, 35], 0.9],
    ["Surgeonfish", 1, "disc", ["#1f4ad8", "#5a8aff", "#ffd21f"], [20, 40], 1],
    ["Seahorse", 1, "seahorse", ["#ff9f1c", "#ffd08a", "#d86a00"], [10, 30], 0.45],
    ["Barracuda", 1, "long", ["#8a9aa8", "#e8eef2", "#5a6a78"], [60, 180], 0.8],
    ["Tuna", 2, "torpedo", ["#1f3a6a", "#d8e2ea", "#ffd21f"], [80, 250], 1],
    ["Swordfish", 2, "sword", ["#3a4a6a", "#c8d2dc", "#2a3450"], [150, 450], 0.6],
    ["Lionfish", 2, "spiky", ["#c8402a", "#fff0e0", "#e8a090"], [20, 40], 0.8],
    ["Grouper", 2, "perch", ["#6a5a3a", "#c8b890", "#4a3a20"], [60, 200], 1],
    ["Moonfish", 2, "disc", ["#c83a5a", "#f0a0b0", "#ff5040"], [80, 150], 0.7, true],
    ["Shark", 2, "shark", ["#6a7a88", "#e8eef2", "#4a5864"], [150, 400], 0.5],
    ["Anglerfish", 3, "angler", ["#3a3040", "#5a4a60", "#2a2030"], [20, 100], 1],
    ["Gulper Eel", 3, "eel", ["#20202a", "#3a3a48", "#101018"], [60, 180], 0.9],
    ["Hatchetfish", 3, "hatchet", ["#a8b8c8", "#e8f0f8", "#7a8a9a"], [3, 12], 1.1],
    ["Oarfish", 3, "ribbon", ["#c8d0dc", "#eef2f6", "#ff3a3a"], [300, 800], 0.5],
    ["Coelacanth", 3, "big", ["#2a3a6a", "#5a6a9a", "#1a2a50"], [100, 200], 0.35]
  ].map(([name, zone, shape, colours, size, bite, night, pattern], i) => ({ i, name, zone, shape, colours, size, bite, night: !!night, pattern: pattern || null }));

  // the 20 versions every kind of fish comes in
  const VARIANTS = [
    { name: "", rarity: 0 },
    { name: "Spotted", rarity: 0, pattern: "spots" },
    { name: "Striped", rarity: 0, pattern: "stripes" },
    { name: "Little", rarity: 0, size: 0.55 },
    { name: "Speckled", rarity: 0, pattern: "speckles" },
    { name: "Silver", rarity: 1, colours: ["#c8d0d8", "#f4f7fa", "#9aa6b2"], shine: true },
    { name: "Blue", rarity: 1, colours: ["#2f6bd8", "#9cc4ff", "#1f4aa8"] },
    { name: "Red", rarity: 1, colours: ["#d8352f", "#ffb0a0", "#a01f1a"] },
    { name: "Banded", rarity: 1, pattern: "banded" },
    { name: "Golden", rarity: 2, colours: ["#f2c230", "#fff1a8", "#c9901a"], shine: true },
    { name: "Tiger", rarity: 2, colours: ["#ff8a1f", "#ffd6a0", "#c45a00"], pattern: "tiger" },
    { name: "Neon", rarity: 2, colours: ["#20f0e0", "#bafff8", "#00b0ff"], glow: "#40fff0" },
    { name: "Giant", rarity: 2, size: 2.2 },
    { name: "Rainbow", rarity: 3, rainbow: true },
    { name: "Crystal", rarity: 3, colours: ["rgba(190,245,255,0.8)", "rgba(240,255,255,0.9)", "rgba(150,220,255,0.8)"], pattern: "facets", glow: "#c0f8ff" },
    { name: "Lava", rarity: 3, colours: ["#3a1010", "#6a2010", "#ff5a1a"], pattern: "cracks", glow: "#ff6a1a" },
    { name: "Ghost", rarity: 3, colours: ["rgba(220,240,255,0.5)", "rgba(240,250,255,0.6)", "rgba(200,230,255,0.4)"], glow: "#d0ecff", night: true },
    { name: "Royal", rarity: 4, colours: ["#6a2bb8", "#e7c6ff", "#f2c230"], pattern: "gold", shine: true },
    { name: "Cosmic", rarity: 4, colours: ["#1a1040", "#3a2a80", "#b46bff"], pattern: "stars", glow: "#b46bff", night: true },
    { name: "Celestial", rarity: 5, celestial: true, glow: "#fff2a0" }
  ];

  const FISH = [];
  SPECIES.forEach(sp => VARIANTS.forEach((v, k) => {
    FISH.push({
      id: sp.i * VARIANTS.length + k,
      name: v.name ? `${v.name} ${sp.name}` : sp.name,
      species: sp, variant: v, zone: sp.zone,
      rarity: RARITIES[v.rarity], rarityIndex: v.rarity,
      night: sp.night || !!v.night,
      size: sp.size.map(s => Math.round(s * (v.size || 1)))
    });
  }));

  /* ---------------- picking a fish that bites ---------------- */
  // zone: where the hook is · night: true at night · luck: 0 (none) to 1 (lots) makes rare fish likelier
  function pickFish(zone, night, luck){
    const pool = FISH.filter(f => f.zone === zone && (night || !f.night));
    const weight = f => f.species.bite * f.rarity.weight * Math.pow(1 + 2.5 * luck, f.rarityIndex);
    const total = pool.reduce((s, f) => s + weight(f), 0);
    let r = Math.random() * total;
    for (const f of pool) { r -= weight(f); if (r <= 0) return f; }
    return pool[pool.length - 1];
  }

  /* ---------------- drawing ---------------- */
  // body outlines, about 100 long, nose at +x
  const SHAPES = {
    perch:   { h: 22, tail: "fork", dorsal: "spiny" },
    slim:    { h: 13, tail: "fork", dorsal: "soft", len: 1.1 },
    flat:    { h: 28, tail: "round", dorsal: "frill", flat: true },
    round:   { h: 24, tail: "round", dorsal: "soft", len: 0.85 },
    ball:    { h: 32, tail: "round", dorsal: "none", spikes: true, len: 0.8 },
    disc:    { h: 34, tail: "fork", dorsal: "tall" },
    long:    { h: 10, tail: "fork", dorsal: "soft", len: 1.35 },
    torpedo: { h: 20, tail: "crescent", dorsal: "finlets" },
    sword:   { h: 15, tail: "crescent", dorsal: "sail", sword: true, len: 1.1 },
    spiky:   { h: 20, tail: "round", dorsal: "lion" },
    shark:   { h: 17, tail: "shark", dorsal: "shark", len: 1.2 },
    angler:  { h: 30, tail: "round", dorsal: "none", lure: true, teeth: true, len: 0.9 },
    eel:     { h: 8, tail: "none", dorsal: "ribbon", len: 1.4, bigMouth: true },
    hatchet: { h: 30, tail: "fork", dorsal: "soft", hatchet: true, len: 0.75 },
    ribbon:  { h: 7, tail: "none", dorsal: "crest", len: 1.6 },
    big:     { h: 24, tail: "round", dorsal: "lobed" },
    seahorse:{ h: 0, seahorse: true }
  };

  function rainbow(ctx, x0, x1){
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    ["#ff4d4d", "#ff9f1c", "#ffe14d", "#4dd66b", "#4da6ff", "#b46bff"].forEach((c, i) => g.addColorStop(i / 5, c));
    return g;
  }
  function seeded(seed){ return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }

  function bodyPath(ctx, S){
    const H = S.h, n = S.flat ? 38 : 42;
    ctx.beginPath();
    if (S.hatchet) {
      ctx.moveTo(30, -6); ctx.lineTo(10, -H * 0.7); ctx.lineTo(-25, -H * 0.4); ctx.lineTo(-34, -4);
      ctx.lineTo(-34, 4); ctx.quadraticCurveTo(-5, H * 1.2, 30, 6); ctx.closePath();
      return;
    }
    ctx.moveTo(n, 0);
    ctx.bezierCurveTo(n - 8, -H, -14, -H * 1.02, -36, -H * 0.28);
    ctx.lineTo(-36, H * 0.28);
    ctx.bezierCurveTo(-14, H * 1.02, n - 8, H * 0.95, n, 0);
    ctx.closePath();
  }

  // the whole fish: tail, fins, body, pattern, eye. t is time, for wiggling
  function draw(ctx, fish, t){
    const S = SHAPES[fish.species.shape], v = fish.variant;
    const cols = v.colours || fish.species.colours;
    const body = v.rainbow ? rainbow(ctx, -40, 45) : v.celestial ? (() => { const g = ctx.createLinearGradient(0, -30, 0, 30); g.addColorStop(0, "#ffffff"); g.addColorStop(0.5, "#fff2a0"); g.addColorStop(1, "#ffc94d"); return g; })() : cols[0];
    const belly = v.rainbow || v.celestial ? "rgba(255,255,255,0.45)" : cols[1];
    const fin = v.rainbow ? "#ff6bd6" : v.celestial ? "#ffe680" : cols[2];
    const wig = Math.sin((t || 0) * 8) * 4;
    ctx.save();
    ctx.lineJoin = "round";
    if (v.glow) { ctx.shadowColor = v.glow; ctx.shadowBlur = 18; }

    if (S.seahorse) { drawSeahorse(ctx, body, belly, fin, wig); ctx.restore(); return; }

    // tail
    ctx.fillStyle = fin;
    ctx.beginPath();
    const tx = -34;
    if (S.tail === "fork") { ctx.moveTo(tx, 0); ctx.lineTo(tx - 20, -18 + wig); ctx.lineTo(tx - 13, 0); ctx.lineTo(tx - 20, 18 + wig); ctx.closePath(); }
    else if (S.tail === "crescent") { ctx.moveTo(tx, 0); ctx.quadraticCurveTo(tx - 10, -10, tx - 18, -26 + wig); ctx.quadraticCurveTo(tx - 12, 0, tx - 18, 26 + wig); ctx.quadraticCurveTo(tx - 10, 10, tx, 0); }
    else if (S.tail === "round") { ctx.ellipse(tx - 9, wig * 0.5, 12, 14, 0, 0, Math.PI * 2); }
    else if (S.tail === "shark") { ctx.moveTo(tx, -3); ctx.lineTo(tx - 22, -26 + wig); ctx.lineTo(tx - 14, 0); ctx.lineTo(tx - 16, 14 + wig); ctx.lineTo(tx, 4); ctx.closePath(); }
    else if (S.tail === "none") { ctx.moveTo(tx, -3); ctx.lineTo(tx - 22, wig); ctx.lineTo(tx, 3); ctx.closePath(); }
    ctx.fill();

    // fins on the back
    const H = S.h;
    ctx.beginPath();
    if (S.dorsal === "spiny") { ctx.moveTo(18, -H * 0.9); for (let k = 0; k < 6; k++) ctx.lineTo(14 - k * 7, -H * 1.35 + (k % 2) * 5); ctx.lineTo(-24, -H * 0.6); ctx.closePath(); }
    else if (S.dorsal === "soft") { ctx.moveTo(14, -H * 0.9); ctx.quadraticCurveTo(-4, -H * 1.6, -22, -H * 0.6); ctx.closePath(); }
    else if (S.dorsal === "tall") { ctx.moveTo(14, -H * 0.85); ctx.quadraticCurveTo(-6, -H * 2.1, -30, -H * 1.6 + wig); ctx.lineTo(-24, -H * 0.5); ctx.closePath();
      ctx.moveTo(14, H * 0.85); ctx.quadraticCurveTo(-6, H * 2.1, -30, H * 1.6 + wig); ctx.lineTo(-24, H * 0.5); ctx.closePath(); }
    else if (S.dorsal === "sail") { ctx.moveTo(22, -H * 0.8); ctx.quadraticCurveTo(0, -H * 3.2, -20, -H * 0.7); ctx.closePath(); }
    else if (S.dorsal === "shark") { ctx.moveTo(10, -H * 0.85); ctx.lineTo(-6, -H * 2.1); ctx.lineTo(-12, -H * 0.8); ctx.closePath(); ctx.moveTo(12, H * 0.6); ctx.lineTo(2, H * 1.6); ctx.lineTo(-2, H * 0.7); ctx.closePath(); }
    else if (S.dorsal === "lion") { for (let k = 0; k < 9; k++) { const a = -2.6 + k * 0.32; ctx.moveTo(4, 0); ctx.lineTo(4 + Math.cos(a) * 42, Math.sin(a) * 38 + wig * 0.3); ctx.lineTo(4 + Math.cos(a + 0.12) * 30, Math.sin(a + 0.12) * 28); } }
    else if (S.dorsal === "frill") { ctx.moveTo(30, -H * 0.7); ctx.quadraticCurveTo(-4, -H * 1.3, -32, -H * 0.3); ctx.lineTo(-30, H * 0.3); ctx.quadraticCurveTo(-4, H * 1.3, 30, H * 0.7); ctx.closePath(); }
    else if (S.dorsal === "ribbon" || S.dorsal === "crest") { ctx.moveTo(30, -H * 0.8); ctx.quadraticCurveTo(-5, -H * 2 + wig * 0.4, -38, -H * 0.4); ctx.closePath(); }
    else if (S.dorsal === "lobed") { ctx.ellipse(-4, -H * 1.05, 10, 6, -0.3, 0, Math.PI * 2); ctx.ellipse(-8, H * 1.05, 9, 5, 0.3, 0, Math.PI * 2); ctx.ellipse(14, H * 0.9, 8, 5, 0.6, 0, Math.PI * 2); }
    else if (S.dorsal === "finlets") { ctx.moveTo(8, -H * 0.9); ctx.lineTo(-4, -H * 1.6); ctx.lineTo(-10, -H * 0.8); ctx.closePath(); for (let k = 0; k < 5; k++) { ctx.rect(-14 - k * 4, -H * 0.55, 2.5, -4); ctx.rect(-14 - k * 4, H * 0.55, 2.5, 4); } }
    ctx.fill();
    if (S.flat) ctx.fill();

    // sword nose
    if (S.sword) { ctx.fillStyle = cols[2]; ctx.beginPath(); ctx.moveTo(38, -3); ctx.lineTo(80, 0); ctx.lineTo(38, 3); ctx.closePath(); ctx.fill(); }

    // body with belly shading
    ctx.save();
    if (S.len) { /* longer and shorter fish are scaled by the caller; the outline stays the same */ }
    bodyPath(ctx, S);
    ctx.fillStyle = body; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.clip();
    const bg = ctx.createLinearGradient(0, -S.h, 0, S.h);
    bg.addColorStop(0, "rgba(0,0,0,0.12)"); bg.addColorStop(0.5, "rgba(0,0,0,0)"); bg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = bg; ctx.fillRect(-50, -60, 120, 120);
    ctx.fillStyle = belly; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.ellipse(4, S.h * 0.75, 40, S.h * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    drawPattern(ctx, v.pattern || fish.species.pattern, S, fish.id);
    // scales: little arcs, for texture
    ctx.strokeStyle = "rgba(255,255,255,0.13)"; ctx.lineWidth = 0.8;
    for (let x = -30; x < 30; x += 6) for (let y = -S.h; y < S.h; y += 6) { ctx.beginPath(); ctx.arc(x + ((y / 6) % 2) * 3, y, 3, -0.6, 0.6); ctx.stroke(); }
    if (v.shine || v.celestial) {
      const sh = ctx.createLinearGradient(-30, -S.h, 30, S.h);
      sh.addColorStop(0.3, "rgba(255,255,255,0)"); sh.addColorStop(0.45, "rgba(255,255,255,0.55)"); sh.addColorStop(0.6, "rgba(255,255,255,0)");
      ctx.fillStyle = sh; ctx.fillRect(-50, -60, 120, 120);
    }
    ctx.restore();

    // outline, gill and side fin
    bodyPath(ctx, S);
    ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(30, 0, S.h * 0.55, 2.2, 4.1); ctx.stroke();
    ctx.fillStyle = fin; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.moveTo(14, 4); ctx.quadraticCurveTo(0, 14 + wig * 0.5, -4, 8); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;

    if (S.spikes) { ctx.fillStyle = cols[2]; for (let a = 0; a < Math.PI * 2; a += 0.45) { const x = Math.cos(a) * 34, y = Math.sin(a) * S.h; ctx.beginPath(); ctx.moveTo(x * 0.92, y * 0.92 - 2); ctx.lineTo(x * 1.18, y * 1.18); ctx.lineTo(x * 0.92 + 2, y * 0.92 + 2); ctx.fill(); } }
    if (S.teeth || S.bigMouth) {
      ctx.fillStyle = "#111"; ctx.beginPath(); ctx.moveTo(42, 0); ctx.lineTo(22, S.bigMouth ? 10 : 14); ctx.lineTo(26, -2); ctx.closePath(); ctx.fill();
      if (S.teeth) { ctx.fillStyle = "#fff"; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(38 - k * 4, 1 + k * 3); ctx.lineTo(36 - k * 4, 6 + k * 3); ctx.lineTo(34 - k * 4, 2 + k * 3); ctx.fill(); } }
    }
    if (S.lure) {
      ctx.strokeStyle = cols[2]; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(26, -S.h * 0.8); ctx.quadraticCurveTo(50, -S.h * 1.8, 60, -S.h * 0.9 + wig * 0.4); ctx.stroke();
      ctx.shadowColor = "#fffb9a"; ctx.shadowBlur = 16; ctx.fillStyle = "#fffb9a";
      ctx.beginPath(); ctx.arc(60, -S.h * 0.9 + wig * 0.4, 5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }

    // eye (flatfish have both eyes on top)
    const eyes = S.flat ? [[24, -10], [30, -4]] : [[S.hatchet ? 18 : 28, -S.h * 0.28]];
    eyes.forEach(([ex, ey]) => {
      const r = S.hatchet || S.angler ? 7 : 5;
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(ex + 1, ey, r * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex + 2, ey - 1.5, r * 0.2, 0, Math.PI * 2); ctx.fill();
    });
    if (v.celestial) sparkles(ctx, fish.id, t);
    ctx.restore();
  }

  function drawPattern(ctx, pattern, S, id){
    const rnd = seeded(id * 7 + 3);
    const H = S.h;
    if (pattern === "spots" || pattern === "gold") {
      ctx.fillStyle = pattern === "gold" ? "#f2c230" : "rgba(30,20,10,0.4)";
      for (let k = 0; k < 14; k++) { ctx.beginPath(); ctx.arc(-30 + rnd() * 62, -H + rnd() * H * 1.6, 2 + rnd() * 3, 0, Math.PI * 2); ctx.fill(); }
    } else if (pattern === "speckles") {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      for (let k = 0; k < 50; k++) ctx.fillRect(-34 + rnd() * 72, -H + rnd() * H * 2, 1.5, 1.5);
    } else if (pattern === "stripes" || pattern === "tiger") {
      ctx.fillStyle = pattern === "tiger" ? "rgba(20,10,0,0.75)" : "rgba(0,0,0,0.25)";
      for (let x = -28; x < 34; x += 10) { ctx.beginPath(); ctx.moveTo(x, -H * 1.2); ctx.quadraticCurveTo(x + 6, 0, x - 2, H * 1.2); ctx.lineTo(x + 4, H * 1.2); ctx.quadraticCurveTo(x + 10, 0, x + 4, -H * 1.2); ctx.fill(); }
    } else if (pattern === "banded") {
      [24, 2, -22].forEach(x => {
        ctx.fillStyle = "#111"; ctx.fillRect(x - 6, -H * 1.3, 12, H * 2.6);
        ctx.fillStyle = "#fff"; ctx.fillRect(x - 4, -H * 1.3, 8, H * 2.6);
      });
    } else if (pattern === "facets") {
      ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 1;
      for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.moveTo(-34 + rnd() * 70, -H + rnd() * H * 2); ctx.lineTo(-34 + rnd() * 70, -H + rnd() * H * 2); ctx.lineTo(-34 + rnd() * 70, -H + rnd() * H * 2); ctx.stroke(); }
    } else if (pattern === "cracks") {
      ctx.strokeStyle = "#ff8a1a"; ctx.lineWidth = 1.6; ctx.shadowColor = "#ff6a1a"; ctx.shadowBlur = 6;
      for (let k = 0; k < 7; k++) { let x = -30 + rnd() * 60, y = -H + rnd() * H * 2; ctx.beginPath(); ctx.moveTo(x, y); for (let j = 0; j < 3; j++) { x += -8 + rnd() * 16; y += -8 + rnd() * 16; ctx.lineTo(x, y); } ctx.stroke(); }
      ctx.shadowBlur = 0;
    } else if (pattern === "stars") {
      ctx.fillStyle = "#fff";
      for (let k = 0; k < 22; k++) { const r = rnd() < 0.2 ? 1.6 : 0.8; ctx.beginPath(); ctx.arc(-34 + rnd() * 72, -H + rnd() * H * 2, r, 0, Math.PI * 2); ctx.fill(); }
    }
  }

  function sparkles(ctx, id, t){
    const rnd = seeded(id + 11);
    ctx.fillStyle = "#fffbe0";
    for (let k = 0; k < 6; k++) {
      const x = -40 + rnd() * 90, y = -34 + rnd() * 68, s = 2 + 2 * Math.sin((t || 0) * 4 + k);
      ctx.beginPath(); ctx.moveTo(x, y - s * 2); ctx.lineTo(x + s * 0.5, y); ctx.lineTo(x, y + s * 2); ctx.lineTo(x - s * 0.5, y); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - s * 2, y); ctx.lineTo(x, y + s * 0.5); ctx.lineTo(x + s * 2, y); ctx.lineTo(x, y - s * 0.5); ctx.closePath(); ctx.fill();
    }
  }

  function drawSeahorse(ctx, body, belly, fin, wig){
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(8, -34); ctx.quadraticCurveTo(22, -40, 26, -30); ctx.lineTo(40, -28); ctx.lineTo(40, -23); ctx.lineTo(24, -22);
    ctx.quadraticCurveTo(18, -10, 16, 4); ctx.quadraticCurveTo(14, 22, 0, 28); ctx.quadraticCurveTo(-14, 32, -8, 40 + wig * 0.3);
    ctx.quadraticCurveTo(-2, 46, -10, 46); ctx.quadraticCurveTo(-24, 36, -6, 22); ctx.quadraticCurveTo(-2, 8, -4, -8); ctx.quadraticCurveTo(-4, -30, 8, -34);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    for (let y = -16; y < 26; y += 6) { ctx.beginPath(); ctx.moveTo(-3, y); ctx.lineTo(14, y + 2); ctx.stroke(); }
    ctx.fillStyle = fin; ctx.beginPath(); ctx.moveTo(-4, -6); ctx.quadraticCurveTo(-18 + wig * 0.5, 0, -4, 8); ctx.fill();
    ctx.fillStyle = belly; ctx.beginPath(); ctx.ellipse(10, 2, 4, 12, 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(16, -30, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(17, -30, 2.2, 0, Math.PI * 2); ctx.fill();
  }

  // how long a fish looks on screen, compared with a normal fish
  const lengthOf = fish => (SHAPES[fish.species.shape].len || 1);

  // a picture of a fish on its own little canvas, made once and kept
  const pictures = new Map();
  function picture(fish, w, h){
    const key = fish.id + ":" + w;
    if (pictures.has(key)) return pictures.get(key);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    const S = SHAPES[fish.species.shape];
    const span = S.seahorse ? 95 : (S.sword ? 140 : S.lure ? 120 : 110) * 1;
    const sc = Math.min(w / span, h / (S.seahorse ? 95 : S.dorsal === "tall" || S.dorsal === "sail" || S.dorsal === "lion" ? 120 : 80));
    g.translate(w / 2 - (S.sword ? 18 : S.lure ? 8 : -6) * sc, h / 2);
    g.scale(sc, sc);
    draw(g, fish, 0);
    pictures.set(key, c);
    return c;
  }

  window.FishingFish = { ZONES, RARITIES, SPECIES, VARIANTS, FISH, pickFish, draw, picture, lengthOf };
})();
