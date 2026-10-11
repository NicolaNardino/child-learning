/* Block World's Survival rules: every item you can carry, what each block drops and how long it takes to dig
   (with your hand or a tool), the crafting recipes, what the furnace can cook, and what burns in it.
   Also the inventory itself: 36 slots, the first 9 of which are the hotbar. No drawing here. */
(function(){
  "use strict";
  const BW = window.BlockWorld;
  const { ID, T, BLOCKS, isFurnace } = BW;

  // things you can carry that aren't blocks (block items use the block's own id)
  const IT = { STICK: 100, COAL: 101, CLAY_BALL: 102, BRICK: 103, WOOD_PICK: 104, STONE_PICK: 105, WOOD_AXE: 106, STONE_AXE: 107, WOOD_SHOVEL: 108, STONE_SHOVEL: 109 };

  /* ---------------- items ---------------- */
  // ITEMS[id]: { id, name, block (the block it puts down) or tile (its picture), stack (how many fit in a slot), tool }
  const ITEMS = [];
  [ID.GRASS, ID.DIRT, ID.STONE, ID.COBBLE, ID.LOG, ID.PLANKS, ID.LEAVES, ID.SAND, ID.CLAY, ID.GLASS, ID.BRICK, ID.COAL_ORE,
   ID.GLOWSTONE, ID.TORCH, ID.CRAFTING, ID.FURNACE].forEach(id => { ITEMS[id] = { id, name: BLOCKS[id].name, block: id, stack: 64 }; });
  ITEMS[ID.BRICK].name = "Bricks";
  const item = (id, name, tile, more) => { ITEMS[id] = Object.assign({ id, name, tile, stack: 64 }, more); };
  item(IT.STICK, "Stick", T.STICK);
  item(IT.COAL, "Coal", T.COAL);
  item(IT.CLAY_BALL, "Clay ball", T.CLAY_BALL);
  item(IT.BRICK, "Brick", T.BRICK_ITEM);
  item(IT.WOOD_PICK, "Wooden pickaxe", T.WOOD_PICK, { stack: 1, tool: { kind: "pick", speed: 2 } });
  item(IT.STONE_PICK, "Stone pickaxe", T.STONE_PICK, { stack: 1, tool: { kind: "pick", speed: 4 } });
  item(IT.WOOD_AXE, "Wooden axe", T.WOOD_AXE, { stack: 1, tool: { kind: "axe", speed: 2 } });
  item(IT.STONE_AXE, "Stone axe", T.STONE_AXE, { stack: 1, tool: { kind: "axe", speed: 4 } });
  item(IT.WOOD_SHOVEL, "Wooden shovel", T.WOOD_SHOVEL, { stack: 1, tool: { kind: "shovel", speed: 2 } });
  item(IT.STONE_SHOVEL, "Stone shovel", T.STONE_SHOVEL, { stack: 1, tool: { kind: "shovel", speed: 4 } });
  const stackOf = id => ITEMS[id] ? ITEMS[id].stack : 64;
  const nameOf = id => ITEMS[id] ? ITEMS[id].name : BLOCKS[id] ? BLOCKS[id].name : "?";

  /* ---------------- digging: how hard each block is, which tool suits it, and what you get ---------------- */
  // hard: how tough it is; tool: the tool that's quicker; needs: without that tool you get nothing; drop: what you get
  const MINE = [];
  const mine = (ids, hard, tool, needs, drop) => [].concat(ids).forEach(id => { MINE[id] = { hard, tool, needs, drop }; });
  const one = id => () => [[id, 1]];
  mine(ID.GRASS, 0.6, "shovel", false, one(ID.DIRT));
  mine(ID.DIRT, 0.5, "shovel", false, one(ID.DIRT));
  mine(ID.SAND, 0.5, "shovel", false, one(ID.SAND));
  mine(ID.CLAY, 0.6, "shovel", false, () => [[IT.CLAY_BALL, 4]]);
  mine(ID.LOG, 2, "axe", false, one(ID.LOG));
  mine(ID.PLANKS, 2, "axe", false, one(ID.PLANKS));
  mine(ID.CRAFTING, 2.5, "axe", false, one(ID.CRAFTING));
  mine(ID.LEAVES, 0.2, null, false, () => Math.random() < 0.12 ? [[IT.STICK, 1]] : []);
  mine(ID.STONE, 1.5, "pick", true, one(ID.COBBLE));
  mine(ID.COBBLE, 2, "pick", true, one(ID.COBBLE));
  mine(ID.COAL_ORE, 3, "pick", true, one(IT.COAL));
  mine(ID.BRICK, 2, "pick", true, one(ID.BRICK));
  mine([ID.FURNACE, ID.FURNACE_NX, ID.FURNACE_PZ, ID.FURNACE_NZ], 3.5, "pick", true, one(ID.FURNACE));
  mine(ID.GLASS, 0.3, null, false, () => []);
  mine(ID.GLOWSTONE, 0.3, null, false, one(ID.GLOWSTONE));
  mine([ID.TORCH, ID.TORCH_PX, ID.TORCH_NX, ID.TORCH_PZ, ID.TORCH_NZ], 0, null, false, one(ID.TORCH));
  mine([ID.TALLGRASS, ID.POPPY, ID.DANDELION], 0, null, false, () => []);

  const toolOf = held => (ITEMS[held] && ITEMS[held].tool) || null;
  // the right tool for this block?
  const suits = (block, held) => { const m = MINE[block], t = toolOf(held); return !!(m && t && m.tool === t.kind); };
  // seconds to dig a block with what you're holding (like the real game: the right tool is quicker, and a block
  // that needs a tool takes much longer without one)
  function digTime(block, held){
    const m = MINE[block];
    if (!m) return Infinity;
    if (m.hard === 0) return 0.05;
    const right = suits(block, held);
    const speed = right ? toolOf(held).speed : 1;
    return m.hard * (!m.needs || right ? 1.5 : 5) / speed;
  }
  function drops(block, held){
    const m = MINE[block];
    if (!m || (m.needs && !suits(block, held))) return [];
    return m.drop();
  }

  /* ---------------- crafting ---------------- */
  // a shaped recipe is a little picture of the grid; it works anywhere in the grid, and mirrored too
  const shaped = (out, n, pattern, key) => ({ out, n, pattern, key });
  const RECIPES = [
    { out: ID.PLANKS, n: 4, shapeless: [ID.LOG] },
    shaped(IT.STICK, 4, ["P", "P"], { P: ID.PLANKS }),
    shaped(ID.CRAFTING, 1, ["PP", "PP"], { P: ID.PLANKS }),
    shaped(ID.TORCH, 4, ["C", "S"], { C: IT.COAL, S: IT.STICK }),
    shaped(IT.WOOD_PICK, 1, ["PPP", " S ", " S "], { P: ID.PLANKS, S: IT.STICK }),
    shaped(IT.WOOD_AXE, 1, ["PP", "PS", " S"], { P: ID.PLANKS, S: IT.STICK }),
    shaped(IT.WOOD_SHOVEL, 1, ["P", "S", "S"], { P: ID.PLANKS, S: IT.STICK }),
    shaped(IT.STONE_PICK, 1, ["CCC", " S ", " S "], { C: ID.COBBLE, S: IT.STICK }),
    shaped(IT.STONE_AXE, 1, ["CC", "CS", " S"], { C: ID.COBBLE, S: IT.STICK }),
    shaped(IT.STONE_SHOVEL, 1, ["C", "S", "S"], { C: ID.COBBLE, S: IT.STICK }),
    shaped(ID.FURNACE, 1, ["CCC", "C C", "CCC"], { C: ID.COBBLE }),
    shaped(ID.BRICK, 1, ["BB", "BB"], { B: IT.BRICK })
  ];
  // each recipe as a grid of item ids (0 for an empty spot), and how big a grid it needs
  RECIPES.forEach(r => {
    if (r.shapeless) { r.cells = [r.shapeless.slice()]; r.w = r.shapeless.length; r.h = 1; }
    else { r.cells = r.pattern.map(row => [...row].map(ch => ch === " " ? 0 : r.key[ch])); r.h = r.pattern.length; r.w = r.pattern[0].length; }
    r.size = Math.max(r.w, r.h) <= 2 ? 2 : 3;
    // how many of each thing it takes
    r.needs = {};
    r.cells.flat().forEach(id => { if (id) r.needs[id] = (r.needs[id] || 0) + 1; });
  });

  // what the grid makes, if anything. grid: size × size item ids, 0 for empty
  function craft(grid, size){
    let x0 = size, y0 = size, x1 = -1, y1 = -1;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (grid[y * size + x]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (x1 < 0) return null;
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const at = (x, y) => grid[(y0 + y) * size + x0 + x];
    const used = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (at(x, y)) used.push(at(x, y));
    for (const r of RECIPES) {
      if (r.shapeless) {
        const want = r.shapeless.slice().sort(), got = used.slice().sort();
        if (want.length === got.length && want.every((v, i) => v === got[i])) return r;
        continue;
      }
      if (r.w !== w || r.h !== h) continue;
      for (const mirror of [false, true]) {
        let ok = true;
        for (let y = 0; y < h && ok; y++) for (let x = 0; x < w && ok; x++) if ((r.cells[y][mirror ? w - 1 - x : x] || 0) !== (at(x, y) || 0)) ok = false;
        if (ok) return r;
      }
    }
    return null;
  }

  /* ---------------- the furnace ---------------- */
  const SMELT = { [ID.SAND]: ID.GLASS, [ID.COBBLE]: ID.STONE, [IT.CLAY_BALL]: IT.BRICK, [ID.LOG]: IT.COAL };
  const SMELT_TIME = 3;   // seconds to cook one thing
  // how many seconds each fuel burns for (coal cooks 8 things)
  const FUEL = { [IT.COAL]: 24, [ID.LOG]: 4.5, [ID.PLANKS]: 4.5, [ID.CRAFTING]: 4.5, [IT.STICK]: 1.5, [IT.WOOD_PICK]: 3, [IT.WOOD_AXE]: 3, [IT.WOOD_SHOVEL]: 3 };
  const newFurnace = () => ({ input: null, fuel: null, output: null, burn: 0, burnMax: 0, cook: 0 });
  // one step of a furnace: burn fuel, cook what's in it, and put the result out
  function tickFurnace(f, dt){
    const result = f.input ? SMELT[f.input.id] : undefined;
    const room = result !== undefined && (!f.output || (f.output.id === result && f.output.n < stackOf(result)));
    if (f.burn <= 0 && room && f.fuel && FUEL[f.fuel.id]) {
      f.burn = f.burnMax = FUEL[f.fuel.id];
      if (--f.fuel.n <= 0) f.fuel = null;
    }
    if (f.burn > 0) f.burn = Math.max(0, f.burn - dt);
    if (room && (f.burn > 0 || f.cook > 0) && f.burnMax > 0) {
      f.cook += dt;
      if (f.cook >= SMELT_TIME) {
        f.cook = 0;
        if (--f.input.n <= 0) f.input = null;
        if (f.output) f.output.n++; else f.output = { id: result, n: 1 };
      }
    } else f.cook = 0;
    if (f.burn <= 0 && !(f.fuel && room)) f.burnMax = 0;
  }

  /* ---------------- the inventory: 36 slots of { id, n } (or null); slots 0 to 8 are the hotbar ---------------- */
  const SLOTS = 36;
  const newInventory = () => new Array(SLOTS).fill(null);
  // put n of an item in: topping up stacks first (hotbar first), then empty slots. Gives back how many didn't fit.
  function addItem(inv, id, n, from, to){
    from = from || 0; to = to === undefined ? SLOTS : to;
    const max = stackOf(id);
    for (let i = from; i < to && n > 0; i++) {
      const s = inv[i];
      if (s && s.id === id && s.n < max) { const k = Math.min(n, max - s.n); s.n += k; n -= k; }
    }
    for (let i = from; i < to && n > 0; i++) {
      if (!inv[i]) { const k = Math.min(n, max); inv[i] = { id, n: k }; n -= k; }
    }
    return n;
  }
  const countItem = (inv, id) => inv.reduce((a, s) => a + (s && s.id === id ? s.n : 0), 0);
  // take n of an item out (from anywhere); gives back how many it managed to take
  function takeItem(inv, id, n){
    let got = 0;
    for (let i = SLOTS - 1; i >= 0 && got < n; i--) {
      const s = inv[i];
      if (!s || s.id !== id) continue;
      const k = Math.min(n - got, s.n);
      s.n -= k; got += k;
      if (s.n <= 0) inv[i] = null;
    }
    return got;
  }

  BW.Survival = { IT, ITEMS, stackOf, nameOf, MINE, digTime, drops, suits, RECIPES, craft, SMELT, SMELT_TIME, FUEL, newFurnace, tickFurnace,
    SLOTS, newInventory, addItem, countItem, takeItem, isFurnace };
})();
