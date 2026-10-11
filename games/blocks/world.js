/* Block World's world: the 16 × 16 block textures, the list of blocks, and the terrain.
   Everything is made from seeded noise, so the textures and the first world look the same every time. */
(function(){
  "use strict";

  const WW = 64, WH = 32, WD = 64;      // 64 blocks wide, 32 tall, 64 deep
  const world = new Uint8Array(WW * WH * WD);
  const at = (x, y, z) => (y * WD + z) * WW + x;

  /* ---------------- textures: one Uint32Array of 256 pixels each (little-endian RGBA) ---------------- */
  const clamp = v => v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
  const pack = (r, g, b) => (255 << 24) | (clamp(b) << 16) | (clamp(g) << 8) | clamp(r);
  function seeded(seed){ return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
  const rnd = seeded(42);
  const make = fn => {
    const t = new Uint32Array(256);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t[y * 16 + x] = fn(x, y);
    return t;
  };
  // a colour with a bit of noise, so flat areas look like they have grain
  const speckle = (c, amt) => { const n = (rnd() - 0.5) * 2 * amt; return pack(c[0] + n, c[1] + n, c[2] + n); };

  const dirtPx = () => rnd() < 0.09 ? speckle([104, 74, 50], 8) : speckle([134, 96, 67], 14);
  const dirt = make(dirtPx);
  const grassTop = make(() => speckle([98, 160, 56], 18));
  const drop = Array.from({ length: 16 }, () => 3 + Math.floor(rnd() * 3)); // ragged green edge down the side
  const grassSide = make((x, y) => y < drop[x] ? speckle([98, 160, 56], 16) : dirtPx());
  const stone = make(() => rnd() < 0.12 ? speckle([100, 100, 100], 10) : speckle([128, 128, 128], 12));
  const streak = Array.from({ length: 16 }, () => rnd() - 0.5);
  const logSide = make(x => speckle([104 + streak[x] * 30, 82 + streak[x] * 24, 52 + streak[x] * 16], 6));
  const logTop = make((x, y) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return speckle([104, 82, 52], 6); // bark round the edge
    const ring = Math.floor(Math.hypot(x - 7.5, y - 7.5) * 0.9) % 2;
    return speckle(ring ? [188, 150, 94] : [152, 120, 72], 6);
  });
  const leaves = make(() => rnd() < 0.15 ? speckle([28, 78, 24], 8) : speckle([58, 130, 42], 22));
  const boardTone = Array.from({ length: 4 }, () => rnd() - 0.5);
  const planks = make((x, y) => {
    const tone = boardTone[y >> 2];
    if ((y & 3) === 3) return speckle([118, 90, 52], 4);                     // the gap between boards
    if ((y & 3) === 1 && (x === 2 || x === 13)) return pack(110, 84, 50);    // nails
    return speckle([166 + tone * 22, 133 + tone * 18, 80 + tone * 12], 5);
  });
  const sand = make(() => speckle([219, 207, 152], 9));
  const brick = make((x, y) => {
    const row = y >> 2;
    if ((y & 3) === 3 || ((x + (row & 1) * 4) & 7) === 7) return speckle([172, 166, 158], 6); // mortar
    return speckle([152, 72, 56], 14);
  });

  const TEX = [dirt, grassTop, grassSide, stone, logSide, logTop, leaves, planks, sand, brick];
  const T = { DIRT: 0, GRASS_TOP: 1, GRASS_SIDE: 2, STONE: 3, LOG_SIDE: 4, LOG_TOP: 5, LEAVES: 6, PLANKS: 7, SAND: 8, BRICK: 9 };

  // block ids are the positions in this list; 0 is air. The first 8 are the hotbar.
  const BLOCKS = [null,
    { name: "Grass",  side: T.GRASS_SIDE, top: T.GRASS_TOP, bottom: T.DIRT },
    { name: "Dirt",   side: T.DIRT,       top: T.DIRT,      bottom: T.DIRT },
    { name: "Stone",  side: T.STONE,      top: T.STONE,     bottom: T.STONE },
    { name: "Log",    side: T.LOG_SIDE,   top: T.LOG_TOP,   bottom: T.LOG_TOP },
    { name: "Leaves", side: T.LEAVES,     top: T.LEAVES,    bottom: T.LEAVES },
    { name: "Planks", side: T.PLANKS,     top: T.PLANKS,    bottom: T.PLANKS },
    { name: "Sand",   side: T.SAND,       top: T.SAND,      bottom: T.SAND },
    { name: "Brick",  side: T.BRICK,      top: T.BRICK,     bottom: T.BRICK }
  ];
  const GRASS = 1, DIRT = 2, STONE = 3, LOG = 4, LEAVES = 5, SAND = 7;
  // FACE[id * 3 + k] is the texture for a block's side (k 0), top (1) or bottom (2)
  const FACE = new Uint8Array(BLOCKS.length * 3);
  BLOCKS.forEach((b, id) => { if (b) { FACE[id * 3] = b.side; FACE[id * 3 + 1] = b.top; FACE[id * 3 + 2] = b.bottom; } });

  /* ---------------- terrain: hills made of smooth noise, beaches, and trees ---------------- */
  function hash2(x, z, s){
    let h = (Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(s, 1274126177)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, z, s){
    const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi;
    const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
    const a = hash2(xi, zi, s), b = hash2(xi + 1, zi, s), c = hash2(xi, zi + 1, s), d = hash2(xi + 1, zi + 1, s);
    return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
  }
  // the y of the highest block in a column
  function heightAt(x, z){
    for (let y = WH - 1; y >= 0; y--) if (world[at(x, y, z)]) return y;
    return 0;
  }

  const BEACH = 9; // columns this low or lower are sand
  function generate(seed, edits){
    world.fill(0);
    const heights = new Uint8Array(WW * WD);
    for (let z = 0; z < WD; z++) for (let x = 0; x < WW; x++) {
      let h = 7 + 12 * vnoise(x / 26, z / 26, seed) + 5 * vnoise(x / 11, z / 11, seed + 1) + 2 * vnoise(x / 5, z / 5, seed + 2);
      h = Math.max(2, Math.min(WH - 8, Math.floor(h)));
      heights[z * WW + x] = h;
      for (let y = 0; y <= h; y++) {
        let id = STONE;
        if (y === h) id = h <= BEACH ? SAND : GRASS;
        else if (y >= h - 3) id = h <= BEACH ? SAND : DIRT;
        world[at(x, y, z)] = id;
      }
    }
    // trees, leaving a clearing in the middle where you start
    for (let z = 3; z < WD - 3; z++) for (let x = 3; x < WW - 3; x++) {
      const h = heights[z * WW + x];
      if (h <= BEACH || h >= 22 || hash2(x, z, seed + 7) >= 0.012) continue;
      if (Math.hypot(x - WW / 2, z - WD / 2) < 5) continue;
      const th = 4 + (hash2(x, z, seed + 9) < 0.5 ? 0 : 1);
      for (let dy = 1; dy <= th; dy++) world[at(x, h + dy, z)] = LOG;
      for (let dy = th - 1; dy <= th + 2; dy++) {
        const r = dy <= th ? 2 : dy === th + 1 ? 1 : 0;
        for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
          if (r > 0 && Math.abs(dx) === r && Math.abs(dz) === r) continue; // round the corners off
          const i = at(x + dx, h + dy, z + dz);
          if (!world[i]) world[i] = LEAVES;
        }
      }
    }
    // then everything the player built or dug
    if (edits) Object.keys(edits).forEach(k => { world[+k] = edits[k]; });
  }

  window.BlockWorld = { WW, WH, WD, world, at, TEX, BLOCKS, FACE, generate, heightAt };
})();
