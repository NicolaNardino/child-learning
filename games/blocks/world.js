/* Block World's world: the 16 × 16 block textures, the list of blocks, and the terrain.
   Everything is made from seeded noise, so the textures and the first world look the same every time. */
(function(){
  "use strict";

  const WW = 64, WH = 32, WD = 64;      // 64 blocks wide, 32 tall, 64 deep
  const SEA = 8;                         // the water fills every hollow up to this height
  const world = new Uint8Array(WW * WH * WD);
  const at = (x, y, z) => (y * WD + z) * WW + x;

  // block ids. 1 to 8 are the original blocks (saved builds use these numbers, so they never change)
  const ID = { GRASS: 1, DIRT: 2, STONE: 3, LOG: 4, LEAVES: 5, PLANKS: 6, SAND: 7, BRICK: 8, COBBLE: 9, GLASS: 10, WATER: 11, TALLGRASS: 12, POPPY: 13, DANDELION: 14 };
  const K = { SOLID: 0, CUTOUT: 1, WATER: 2, PLANT: 3 }; // see-through holes, water, or a flower you walk through

  /* ---------------- noise ---------------- */
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

  /* ---------------- textures: one Uint32Array of 256 pixels each (little-endian RGBA) ---------------- */
  const clamp = v => v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
  const pack = (r, g, b, a) => (((a === undefined ? 255 : a) << 24) | (clamp(b) << 16) | (clamp(g) << 8) | clamp(r)) >>> 0;
  const make = fn => {
    const t = new Uint32Array(256);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t[y * 16 + x] = fn(x, y);
    return t;
  };
  const pick = (list, t) => list[Math.min(list.length - 1, Math.floor(t * list.length))];
  const paint = (list, t) => { const c = pick(list, t); return pack(c[0], c[1], c[2]); };
  // grainy noise: one value per pixel blended with one per 2 × 2 patch, so colours clump a little like real textures
  const grain = (x, y, s) => 0.55 * hash2(x, y, s) + 0.45 * hash2(x >> 1, y >> 1, s + 3);
  const shade = (c, f) => [c[0] * f, c[1] * f, c[2] * f];

  const GRASS_PAL = [[92, 150, 46], [102, 162, 52], [112, 174, 58], [122, 184, 66], [82, 138, 40]];
  const DIRT_PAL = [[134, 96, 67], [121, 85, 58], [146, 106, 76], [108, 75, 50], [156, 116, 86]];
  const STONE_PAL = [[128, 128, 128], [118, 118, 118], [138, 138, 138], [108, 108, 108], [124, 124, 124]];

  const dirtPx = (x, y) => paint(DIRT_PAL, grain(x, y, 11));
  const dirt = make(dirtPx);
  const grassPx = (x, y) => paint(GRASS_PAL, grain(x, y, 21));
  const grassTop = make(grassPx);
  const drop = Array.from({ length: 16 }, (_, x) => 2 + Math.floor(hash2(x, 5, 31) * 3)); // ragged green edge down the side
  const grassSide = make((x, y) => {
    if (y < drop[x]) return grassPx(x, y);
    if (y === drop[x] && hash2(x, y, 33) < 0.5) { const c = shade(pick(GRASS_PAL, hash2(x, y, 34)), 0.72); return pack(c[0], c[1], c[2]); }
    return dirtPx(x, y);
  });
  const stone = make((x, y) => {
    const n = hash2(x, y, 41);
    if (n < 0.05) return pack(92, 92, 92);
    return paint(STONE_PAL, 0.5 * hash2(x >> 1, y >> 1, 42) + 0.5 * hash2(x, y, 43));
  });
  const cobble = (() => {
    // 9 stones in a 3 × 3 patch that wraps round, each pixel belongs to the nearest one
    const seeds = [];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) seeds.push({ x: (i + 0.15 + hash2(i, j, 51) * 0.7) * 16 / 3, y: (j + 0.15 + hash2(i, j, 52) * 0.7) * 16 / 3, tone: hash2(i, j, 53) });
    return make((x, y) => {
      let d1 = 1e9, d2 = 1e9, best = null;
      seeds.forEach(s => {
        for (let ox = -16; ox <= 16; ox += 16) for (let oy = -16; oy <= 16; oy += 16) {
          const d = Math.hypot(x + 0.5 - (s.x + ox), y + 0.5 - (s.y + oy));
          if (d < d1) { d2 = d1; d1 = d; best = s; } else if (d < d2) d2 = d;
        }
      });
      if (d2 - d1 < 1.1) return pack(78, 78, 78);
      const c = shade(pick(STONE_PAL, best.tone), 0.85 + 0.2 * hash2(x, y, 54));
      return pack(c[0], c[1], c[2]);
    });
  })();
  const BARK = [[104, 82, 50], [92, 72, 44], [116, 92, 58], [80, 62, 38]];
  const logSide = make((x, y) => {
    const col = hash2(x, 0, 61), n = hash2(x, y, 62);
    const c = shade(pick(BARK, col * 0.7 + n * 0.3), 0.92 + 0.16 * hash2(x >> 1, y >> 2, 63));
    return pack(c[0], c[1], c[2]);
  });
  const logTop = make((x, y) => {
    if (x < 2 || y < 2 || x > 13 || y > 13) { const c = shade(pick(BARK, hash2(x, y, 64)), 1); return pack(c[0], c[1], c[2]); }
    const ring = Math.floor(Math.hypot(x - 7.5, y - 7.5) * 0.85) % 2;
    const c = ring ? [196, 160, 104] : [166, 130, 80];
    const f = 0.94 + 0.12 * hash2(x, y, 65);
    return pack(c[0] * f, c[1] * f, c[2] * f);
  });
  const LEAF_PAL = [[48, 112, 36], [60, 132, 44], [38, 96, 28], [74, 150, 52], [54, 122, 40]];
  const leaves = make((x, y) => {
    if (hash2(x, y, 71) < 0.2) return pack(30, 70, 24, 0);   // a hole you can see through
    return paint(LEAF_PAL, grain(x, y, 72));
  });
  const planks = make((x, y) => {
    const board = y >> 2, ry = y & 3;
    const tone = 0.9 + 0.2 * hash2(board, 0, 81);
    if (ry === 3) return pack(120, 92, 52);                                    // the gap between boards
    if (x === ((board * 7 + 3) & 15)) return pack(128, 100, 58);              // where one plank ends
    const grainLine = hash2(x >> 2, y, 82) < 0.28 ? 0.9 : 1;
    const f = tone * grainLine * (0.97 + 0.06 * hash2(x, y, 83));
    return pack(168 * f, 134 * f, 82 * f);
  });
  const SAND_PAL = [[219, 207, 152], [228, 216, 162], [210, 198, 142], [222, 210, 156]];
  const sand = make((x, y) => paint(SAND_PAL, grain(x, y, 91)));
  const brick = make((x, y) => {
    const row = y >> 2;
    if ((y & 3) === 3 || ((x + (row & 1) * 4) & 7) === 7) return pack(184, 178, 170);  // mortar
    const brickNo = ((x + (row & 1) * 4) >> 3) + row * 3;
    const f = 0.86 + 0.28 * hash2(brickNo, row, 101) + 0.08 * (hash2(x, y, 102) - 0.5);
    return pack(158 * f, 74 * f, 58 * f);
  });
  const glass = make((x, y) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return pack(178, 216, 226);
    if ((x === y && x < 7) || (x === y + 1 && x < 6)) return pack(255, 255, 255);  // a glint in the corner
    return pack(200, 230, 240, 0);
  });
  const water = make((x, y) => {
    const n = hash2(x >> 1, y, 111), w = (x + y * 2) % 7 === 0 ? 14 : 0;
    return pack(44 + n * 14 + w, 96 + n * 18 + w, 206 + n * 18, 255);
  });
  const tallGrass = make((x, y) => {
    // five blades, each a different height
    const blades = [[2, 9], [4, 12], [7, 8], [9, 13], [12, 10], [14, 7]];
    for (const [bx, h] of blades) {
      if (Math.abs(x - bx) < 1 && y >= 15 - h) { const c = pick(GRASS_PAL, hash2(x, y, 121)); return pack(c[0] - 10, c[1] - 6, c[2] - 10); }
    }
    return pack(0, 0, 0, 0);
  });
  const flower = (r, g, b) => make((x, y) => {
    if (x >= 7 && x <= 8 && y >= 8) return pack(54, 120, 36);                       // stem
    if ((x === 5 || x === 10) && y === 12) return pack(60, 130, 40);                // leaf
    const dx = x - 7.5, dy = y - 5.5;
    if (Math.abs(dx) < 3 && Math.abs(dy) < 3 && Math.abs(dx) + Math.abs(dy) < 4.6) {
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return pack(70, 40, 20);            // the middle
      return pack(r, g, b);
    }
    return pack(0, 0, 0, 0);
  });
  const poppy = flower(214, 40, 40), dandelion = flower(250, 214, 40);
  const white = make(() => pack(255, 255, 255));
  const ocean = make(() => pack(52, 108, 214));

  const TEX = [dirt, grassTop, grassSide, stone, cobble, logSide, logTop, leaves, planks, sand, brick, glass, water, tallGrass, poppy, dandelion, white, ocean];
  const T = { DIRT: 0, GRASS_TOP: 1, GRASS_SIDE: 2, STONE: 3, COBBLE: 4, LOG_SIDE: 5, LOG_TOP: 6, LEAVES: 7, PLANKS: 8, SAND: 9, BRICK: 10, GLASS: 11, WATER: 12, TALLGRASS: 13, POPPY: 14, DANDELION: 15, WHITE: 16, OCEAN: 17 };
  const TILE_COLS = 6, TILE_ROWS = 3;

  // all the textures side by side in one picture (raw bytes, for the graphics card)
  function atlasData(){
    const w = TILE_COLS * 16, h = TILE_ROWS * 16, data = new Uint8Array(w * h * 4), v = new Uint32Array(data.buffer);
    TEX.forEach((t, i) => {
      const ox = (i % TILE_COLS) * 16, oy = Math.floor(i / TILE_COLS) * 16;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) v[(oy + y) * w + ox + x] = t[y * 16 + x];
    });
    return { data, w, h };
  }
  // the same picture on a canvas, for drawing the little block icons
  function atlasCanvas(){
    const a = atlasData(), c = document.createElement("canvas");
    c.width = a.w; c.height = a.h;
    c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(a.data.buffer), a.w, a.h), 0, 0);
    return c;
  }

  /* ---------------- the block list. Block ids are the positions here; 0 is air. ---------------- */
  const BLOCKS = [null];
  const FACE = new Uint8Array(256 * 3);   // FACE[id * 3 + k] is the texture of a block's side (k 0), top (1) or bottom (2)
  const KIND = new Uint8Array(256);
  const IS_SOLID = new Uint8Array(256);   // you can't walk through it
  const IS_OPAQUE = new Uint8Array(256);  // it hides what's behind it (and makes the soft shadow in the corners)
  function def(id, name, side, top, bottom, kind, opaque){
    BLOCKS[id] = { id, name, side, top, bottom, kind };
    FACE[id * 3] = side; FACE[id * 3 + 1] = top; FACE[id * 3 + 2] = bottom;
    KIND[id] = kind;
    IS_SOLID[id] = kind === K.SOLID || kind === K.CUTOUT ? 1 : 0;
    IS_OPAQUE[id] = opaque ? 1 : 0;
  }
  def(ID.GRASS,  "Grass",     T.GRASS_SIDE, T.GRASS_TOP, T.DIRT,   K.SOLID, 1);
  def(ID.DIRT,   "Dirt",      T.DIRT,       T.DIRT,      T.DIRT,   K.SOLID, 1);
  def(ID.STONE,  "Stone",     T.STONE,      T.STONE,     T.STONE,  K.SOLID, 1);
  def(ID.LOG,    "Log",       T.LOG_SIDE,   T.LOG_TOP,   T.LOG_TOP, K.SOLID, 1);
  def(ID.LEAVES, "Leaves",    T.LEAVES,     T.LEAVES,    T.LEAVES, K.CUTOUT, 0);
  def(ID.PLANKS, "Planks",    T.PLANKS,     T.PLANKS,    T.PLANKS, K.SOLID, 1);
  def(ID.SAND,   "Sand",      T.SAND,       T.SAND,      T.SAND,   K.SOLID, 1);
  def(ID.BRICK,  "Brick",     T.BRICK,      T.BRICK,     T.BRICK,  K.SOLID, 1);
  def(ID.COBBLE, "Cobblestone", T.COBBLE,   T.COBBLE,    T.COBBLE, K.SOLID, 1);
  def(ID.GLASS,  "Glass",     T.GLASS,      T.GLASS,     T.GLASS,  K.CUTOUT, 0);
  def(ID.WATER,  "Water",     T.WATER,      T.WATER,     T.WATER,  K.WATER, 0);
  def(ID.TALLGRASS, "Tall grass", T.TALLGRASS, T.TALLGRASS, T.TALLGRASS, K.PLANT, 0);
  def(ID.POPPY,  "Poppy",     T.POPPY,      T.POPPY,     T.POPPY,  K.PLANT, 0);
  def(ID.DANDELION, "Dandelion", T.DANDELION, T.DANDELION, T.DANDELION, K.PLANT, 0);

  // what's on the hotbar, left to right
  const HOTBAR = [ID.GRASS, ID.DIRT, ID.COBBLE, ID.PLANKS, ID.LOG, ID.LEAVES, ID.SAND, ID.BRICK, ID.GLASS];

  /* ---------------- terrain: an island of hills and mountains with lakes, beaches, trees and flowers ---------------- */
  // the highest block you could stand on in a column
  function heightAt(x, z){
    for (let y = WH - 1; y >= 0; y--) if (IS_SOLID[world[at(x, y, z)]]) return y;
    return 0;
  }
  const BEACH = SEA + 1;
  function generate(seed, edits){
    world.fill(0);
    const heights = new Uint8Array(WW * WD);
    for (let z = 0; z < WD; z++) for (let x = 0; x < WW; x++) {
      let h = 2 + 19 * vnoise(x / 30, z / 30, seed) + 6 * vnoise(x / 12, z / 12, seed + 1) + 2 * vnoise(x / 5, z / 5, seed + 2);
      // sink toward the sea near the edge of the world, so it's an island with water all round
      const d = Math.min(x, z, WW - 1 - x, WD - 1 - z), k = Math.min(1, d / 12), kk = k * k * (3 - 2 * k);
      h = (SEA - 2) + (h - (SEA - 2)) * kk;
      h = Math.max(3, Math.min(WH - 8, Math.floor(h)));
      heights[z * WW + x] = h;
      const beach = h <= BEACH, peak = h >= 21;
      for (let y = 0; y <= h; y++) {
        let id = ID.STONE;
        if (y === h) id = beach ? ID.SAND : peak ? ID.STONE : ID.GRASS;
        else if (y >= h - 3) id = beach ? ID.SAND : peak ? ID.STONE : ID.DIRT;
        world[at(x, y, z)] = id;
      }
      for (let y = h + 1; y <= SEA; y++) world[at(x, y, z)] = ID.WATER;
    }
    const sp = spawnPoint();
    // trees, leaving a clearing where you start
    for (let z = 3; z < WD - 3; z++) for (let x = 3; x < WW - 3; x++) {
      const h = heights[z * WW + x];
      if (h <= BEACH || h >= 21 || hash2(x, z, seed + 7) >= 0.009) continue;
      if (Math.hypot(x - sp[0], z - sp[2]) < 5) continue;
      const th = 4 + Math.floor(hash2(x, z, seed + 9) * 3);
      for (let dy = 1; dy <= th; dy++) world[at(x, h + dy, z)] = ID.LOG;
      for (let dy = th - 1; dy <= th + 2; dy++) {
        const r = dy <= th ? 2 : dy === th + 1 ? 1 : 0;
        for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
          if (r > 0 && Math.abs(dx) === r && Math.abs(dz) === r && hash2(x + dx, z + dz, seed + 13) < 0.6) continue; // a ragged outline
          const i = at(x + dx, h + dy, z + dz);
          if (!world[i]) world[i] = ID.LEAVES;
        }
      }
    }
    // tall grass and flowers on the grass
    for (let z = 1; z < WD - 1; z++) for (let x = 1; x < WW - 1; x++) {
      const h = heights[z * WW + x];
      if (h <= BEACH || h >= 21 || world[at(x, h + 1, z)]) continue;
      const n = hash2(x, z, seed + 17);
      if (n < 0.1) world[at(x, h + 1, z)] = ID.TALLGRASS;
      else if (n < 0.116) world[at(x, h + 1, z)] = ID.POPPY;
      else if (n < 0.13) world[at(x, h + 1, z)] = ID.DANDELION;
    }
    // then everything the player built or dug
    if (edits) Object.keys(edits).forEach(k => { world[+k] = edits[k]; });
  }
  // where you start: the dry spot closest to the middle
  function spawnPoint(){
    const cx = WW >> 1, cz = WD >> 1;
    for (let r = 0; r < 30; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const x = cx + dx, z = cz + dz, h = heightAt(x, z);
      if (h > BEACH && world[at(x, h, z)] !== ID.LEAVES && world[at(x, h, z)] !== ID.LOG) return [x, h + 1, z];
    }
    return [cx, heightAt(cx, cz) + 1, cz];
  }

  window.BlockWorld = { WW, WH, WD, SEA, world, at, ID, K, TEX, T, TILE_COLS, TILE_ROWS, BLOCKS, FACE, KIND, IS_SOLID, IS_OPAQUE, HOTBAR, atlasData, atlasCanvas, generate, heightAt, spawnPoint, hash2 };
})();
