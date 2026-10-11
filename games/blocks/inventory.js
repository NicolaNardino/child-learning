/* Block World's inventory screens, for Survival: your inventory (with a small 2 × 2 crafting grid), the
   crafting table (3 × 3) and the furnace. They work like the real ones: click a slot to pick up what's in it
   and click again to put it down, right click to pick up half or put down one, shift-click to send it
   across. The recipe book lists everything you can make: pick one and it's laid out for you if you have
   what it takes, or shown faintly in the grid so you can see what you still need. */
(function(){
  "use strict";
  const BW = window.BlockWorld, S = BW.Survival;

  function createInventoryUI(opts){
    const root = document.createElement("div");
    root.className = "bl-inv";
    root.hidden = true;
    root.innerHTML = `
      <div class="bl-inv-box" role="dialog" aria-label="Inventory">
        <div class="bl-inv-head"><span class="bl-inv-title"></span><button type="button" class="btn ghost small bl-inv-close">✕ Close</button></div>
        <div class="bl-inv-top">
          <div class="bl-inv-left">
            <div class="bl-craft"><div class="bl-grid"></div><div class="bl-arrow">➜</div><div class="bl-result"></div></div>
            <div class="bl-furnace">
              <div class="bl-fcol"><div class="bl-fin"></div><div class="bl-flame"><div></div></div><div class="bl-ffuel"></div></div>
              <div class="bl-fprog"><div></div></div>
              <div class="bl-fout"></div>
            </div>
            <div class="bl-inv-note" aria-live="polite"></div>
          </div>
          <div class="bl-book"><div class="bl-book-title">📖 Recipes</div><div class="bl-book-list"></div></div>
        </div>
        <div class="bl-inv-main"></div>
        <div class="bl-inv-hot"></div>
      </div>
      <div class="bl-cursor" aria-hidden="true"></div>`;
    opts.stage.appendChild(root);
    const $ = sel => root.querySelector(sel);
    const titleEl = $(".bl-inv-title"), noteEl = $(".bl-inv-note"), cursorEl = $(".bl-cursor");
    const craftEl = $(".bl-craft"), gridEl = $(".bl-grid"), furnEl = $(".bl-furnace"), bookEl = $(".bl-book"), bookList = $(".bl-book-list");
    const mainEl = $(".bl-inv-main"), hotEl = $(".bl-inv-hot");

    let mode = "inventory", size = 2, cursor = null, furnace = null;
    let grid = new Array(9).fill(null), ghost = new Array(9).fill(0);
    const inv = () => opts.getInv();

    /* ----- little pictures of items, made once each ----- */
    const pics = new Map();
    const pic = id => { if (!pics.has(id)) pics.set(id, opts.icon(id).toDataURL()); return pics.get(id); };
    function draw(el, it, ghostId){
      const img = el.querySelector("img"), num = el.querySelector("span");
      const id = it ? it.id : ghostId || 0;
      if (id) { img.src = pic(id); img.hidden = false; } else img.hidden = true;
      el.classList.toggle("ghost", !it && !!ghostId);
      num.textContent = it && it.n > 1 ? String(it.n) : "";
      el.title = it ? S.nameOf(it.id) + (it.n > 1 ? " × " + it.n : "") : ghostId ? S.nameOf(ghostId) + " goes here" : "";
    }
    function slotEl(){
      const el = document.createElement("div");
      el.className = "bl-islot";
      el.innerHTML = "<img alt='' draggable='false' hidden><span></span>";
      return el;
    }

    /* ----- every slot on the screen, and what it's linked to ----- */
    const slots = [];   // { el, get, set, kind, i }
    function addSlot(parent, kind, i, get, set){
      const el = slotEl();
      parent.appendChild(el);
      const s = { el, kind, i, get, set };
      el.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); click(s, e.button, e.shiftKey); });
      slots.push(s);
      return s;
    }
    for (let i = 9; i < S.SLOTS; i++) addSlot(mainEl, "inv", i, () => inv()[i], v => { inv()[i] = v; });
    for (let i = 0; i < 9; i++) addSlot(hotEl, "inv", i, () => inv()[i], v => { inv()[i] = v; });
    for (let k = 0; k < 9; k++) addSlot(gridEl, "grid", k, () => grid[k], v => { grid[k] = v; ghost.fill(0); });
    const resultSlot = addSlot($(".bl-result"), "result", 0, () => { const r = recipe(); return r ? { id: r.out, n: r.n } : null; }, () => {});
    addSlot($(".bl-fin"), "fin", 0, () => furnace && furnace.input, v => { furnace.input = v; });
    addSlot($(".bl-ffuel"), "ffuel", 0, () => furnace && furnace.fuel, v => { furnace.fuel = v; });
    addSlot($(".bl-fout"), "fout", 0, () => furnace && furnace.output, v => { furnace.output = v; });

    const recipe = () => mode === "book" ? null : S.craft(grid.slice(0, size * size).map(s => s ? s.id : 0), size);

    /* ----- clicking a slot ----- */
    function say(text){ noteEl.textContent = text || ""; }
    function click(s, button, shift){
      say("");
      if (mode === "book") return;
      if (s.kind === "result") { takeResult(shift); render(); opts.onChange(); return; }
      if (shift) { quickMove(s); render(); opts.onChange(); return; }
      const it = s.get();
      // a slot that only takes some things: the furnace's fuel takes fuel, and its output takes nothing
      const fits = id => s.kind === "fout" ? false : s.kind === "ffuel" ? !!S.FUEL[id] : true;
      const max = id => S.stackOf(id);
      if (button === 2) {                         // right click: half, or just one
        if (!cursor && it) {
          const half = Math.ceil(it.n / 2);
          cursor = { id: it.id, n: half };
          s.set(it.n - half > 0 ? { id: it.id, n: it.n - half } : null);
        } else if (cursor && fits(cursor.id) && (!it || (it.id === cursor.id && it.n < max(it.id)))) {
          s.set(it ? { id: it.id, n: it.n + 1 } : { id: cursor.id, n: 1 });
          if (--cursor.n <= 0) cursor = null;
        }
      } else {                                    // left click: pick it all up, put it all down, top up, or swap
        if (!cursor && it) { cursor = { id: it.id, n: it.n }; s.set(null); }
        else if (cursor && !it) { if (fits(cursor.id)) { s.set(cursor); cursor = null; } }
        else if (cursor && it) {
          if (it.id === cursor.id && fits(it.id)) {
            const k = Math.min(cursor.n, max(it.id) - it.n);
            s.set({ id: it.id, n: it.n + k });
            if ((cursor.n -= k) <= 0) cursor = null;
          } else if (fits(cursor.id)) { s.set(cursor); cursor = { id: it.id, n: it.n }; }
          else if (s.kind === "fout") { /* can't put anything in the output */ }
        }
      }
      render(); opts.onChange();
    }
    // shift-click: send it to the other part of the screen
    function quickMove(s){
      const it = s.get();
      if (!it) return;
      const bag = inv();
      if (s.kind === "inv") {
        if (mode === "furnace") {
          const into = S.SMELT[it.id] !== undefined && (!furnace.input || furnace.input.id === it.id) ? "input" : S.FUEL[it.id] && (!furnace.fuel || furnace.fuel.id === it.id) ? "fuel" : null;
          if (into) {
            const cur = furnace[into], room = S.stackOf(it.id) - (cur ? cur.n : 0), k = Math.min(room, it.n);
            furnace[into] = { id: it.id, n: (cur ? cur.n : 0) + k };
            s.set(it.n - k > 0 ? { id: it.id, n: it.n - k } : null);
            return;
          }
        }
        // between the hotbar and the rest of the bag
        s.set(null);
        const left = s.i < 9 ? S.addItem(bag, it.id, it.n, 9, S.SLOTS) : S.addItem(bag, it.id, it.n, 0, 9);
        if (left > 0) { const back = s.get(); s.set(back ? { id: it.id, n: back.n + left } : { id: it.id, n: left }); }
        return;
      }
      // out of the grid or the furnace and into the bag
      const left = S.addItem(bag, it.id, it.n);
      s.set(left > 0 ? { id: it.id, n: left } : null);
    }
    function useUpGrid(){ for (let k = 0; k < size * size; k++) if (grid[k] && --grid[k].n <= 0) grid[k] = null; }
    function takeResult(shift){
      let r = recipe();
      if (!r) return;
      if (shift) { // make as many as will fit in the bag
        for (let n = 0; n < 64 && r; n++) {
          const test = inv().map(s => s && { id: s.id, n: s.n });
          if (S.addItem(test, r.out, r.n) > 0) { say("Your bag is full."); break; }
          S.addItem(inv(), r.out, r.n);
          useUpGrid();
          const next = recipe();
          if (next !== r) break;
        }
        opts.onCraft && opts.onCraft();
        return;
      }
      if (!cursor) cursor = { id: r.out, n: r.n };
      else if (cursor.id === r.out && cursor.n + r.n <= S.stackOf(r.out)) cursor.n += r.n;
      else return;
      useUpGrid();
      opts.onCraft && opts.onCraft();
    }

    /* ----- the recipe book ----- */
    const bookButtons = S.RECIPES.map(r => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "bl-recipe";
      b.innerHTML = `<img alt='' draggable='false' src='${pic(r.out)}'><span class='bl-recipe-name'></span>`;
      b.querySelector(".bl-recipe-name").textContent = S.nameOf(r.out) + (r.n > 1 ? " × " + r.n : "");
      b.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); pickRecipe(r); });
      bookList.appendChild(b);
      return { b, r };
    });
    // what you'd have if everything in the grid went back in the bag
    function have(id){ return S.countItem(inv(), id) + grid.reduce((a, s) => a + (s && s.id === id ? s.n : 0), 0); }
    const canMake = r => Object.keys(r.needs).every(id => have(+id) >= r.needs[id]);
    function pickRecipe(r){
      const showGhost = () => { ghost.fill(0); const g = mode === "book" ? 3 : size; r.cells.forEach((row, y) => row.forEach((id, x) => { if (id) ghost[y * g + x] = id; })); };
      if (mode === "book") { showGhost(); say("To make " + S.nameOf(r.out).toLowerCase() + ", lay it out like this in Survival."); render(); return; }
      if (r.size > size) { say("That needs a crafting table: put one down and right-click it."); render(); return; }
      returnGrid();
      if (!canMake(r)) {
        showGhost();
        const missing = Object.keys(r.needs).filter(id => have(+id) < r.needs[id]).map(id => {
          const n = r.needs[id] - have(+id), name = S.nameOf(+id).toLowerCase();
          return n + " " + (n > 1 && !/s$|stone$|glass$|sand$|dirt$|coal$|clay$/.test(name) ? name + "s" : name);
        });
        say("You still need " + missing.join(" and ") + ".");
        render(); opts.onChange();
        return;
      }
      r.cells.forEach((row, y) => row.forEach((id, x) => { if (id && S.takeItem(inv(), id, 1)) grid[y * size + x] = { id, n: 1 }; }));
      ghost.fill(0);
      render(); opts.onChange();
    }

    /* ----- opening and closing ----- */
    function returnGrid(){
      for (let k = 0; k < 9; k++) if (grid[k]) { const left = S.addItem(inv(), grid[k].id, grid[k].n); grid[k] = left > 0 ? { id: grid[k].id, n: left } : null; }
    }
    function show(m, title){
      mode = m; titleEl.textContent = title;
      size = m === "crafting" || m === "book" ? 3 : 2;
      ghost.fill(0); say("");
      gridEl.className = "bl-grid g" + size;
      [...gridEl.children].forEach((el, k) => { el.hidden = k >= size * size; });
      craftEl.hidden = m === "furnace";
      furnEl.hidden = m !== "furnace";
      bookEl.hidden = m === "furnace";
      mainEl.hidden = hotEl.hidden = m === "book";
      root.classList.toggle("book", m === "book");
      root.hidden = false;
      render();
    }
    function close(){
      if (root.hidden) return;
      returnGrid();
      if (cursor) { S.addItem(inv(), cursor.id, cursor.n); cursor = null; } // back in the bag (if the bag is completely full, it's lost)
      furnace = null;
      root.hidden = true;
      opts.onChange();
      opts.onClose && opts.onClose();
    }
    root.querySelector(".bl-inv-close").addEventListener("click", close);
    root.addEventListener("contextmenu", e => e.preventDefault());
    // what you're carrying follows the pointer
    root.addEventListener("pointermove", e => {
      const r = root.getBoundingClientRect();
      cursorEl.style.left = (e.clientX - r.left) + "px";
      cursorEl.style.top = (e.clientY - r.top) + "px";
    });

    function render(){
      slots.forEach(s => {
        if (s.kind === "grid") draw(s.el, s.get(), ghost[s.i]);
        else draw(s.el, s.get());
      });
      resultSlot.el.classList.toggle("ready", !!recipe());
      cursorEl.hidden = !cursor;
      if (cursor) { cursorEl.innerHTML = `<img alt='' src='${pic(cursor.id)}'><span>${cursor.n > 1 ? cursor.n : ""}</span>`; }
      bookButtons.forEach(({ b, r }) => {
        b.classList.toggle("can", mode !== "book" && r.size <= size && canMake(r));
        b.classList.toggle("big", mode !== "book" && r.size > size);
      });
      tick();
    }
    // the furnace's flame and arrow, every frame while it's open
    function tick(){
      if (mode !== "furnace" || !furnace || root.hidden) return;
      $(".bl-flame div").style.height = (furnace.burnMax ? 100 * furnace.burn / furnace.burnMax : 0) + "%";
      $(".bl-fprog div").style.width = (100 * furnace.cook / S.SMELT_TIME) + "%";
      // the output can fill up on its own
      const out = furnace.output, el = root.querySelector(".bl-fout .bl-islot");
      const shown = el.dataset.n || "";
      const now = out ? out.id + ":" + out.n : "";
      if (shown !== now) { el.dataset.n = now; render(); }
    }

    return {
      root,
      openInventory(){ show("inventory", "🎒 Inventory"); },
      openCrafting(){ show("crafting", "🛠️ Crafting table"); },
      openFurnace(f){ furnace = f; show("furnace", "🔥 Furnace"); },
      openBook(){ show("book", "📖 Recipe book"); say("In Creative you already have every block. Switch to Survival to craft. Pick a recipe to see how it's made."); },
      close, tick, render,
      isOpen: () => !root.hidden,
      furnaceOpen: f => !root.hidden && mode === "furnace" && furnace === f
    };
  }

  BW.createInventoryUI = createInventoryUI;
})();
