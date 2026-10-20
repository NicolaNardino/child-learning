/* Fishing Beach: stand on the beach and fish in the ocean. One button does everything: hold it to
   power up your cast and let go to throw; when the float dips hard, press to strike; then hold to keep
   the green bar on the fish until it's reeled in. There are 500 fish (fish.js) in four zones of the
   sea (scene.js). Better rods reach further out, and you unlock each one by catching a certain fish. */
(function(){
  "use strict";
  const store = Hub.store;
  if (!store.fishing) store.fishing = {};
  const F = store.fishing;
  if (!F.caught) F.caught = {};
  if (!F.rods) F.rods = ["bamboo"];
  if (!F.rod) F.rod = "bamboo";
  if (!F.total) F.total = 0;
  const kinds = () => Object.keys(F.caught).length;

  // reach: how many zones out you can cast · control: size of the green bar · luck: rarer fish · speed: quicker bites
  const RODS = [
    { id: "bamboo",     name: "Bamboo Rod",         colour: "#c8a060", reach: 1, control: 0.26, luck: 0,    speed: 0 },
    { id: "fiberglass", name: "Fiberglass Rod",     colour: "#f2f2f2", reach: 2, control: 0.28, luck: 0.1,  speed: 0.1,  need: "Perch" },
    { id: "carbon",     name: "Carbon Rod",         colour: "#30343c", reach: 2, control: 0.32, luck: 0.2,  speed: 0.2,  need: "Pufferfish" },
    { id: "deepsea",    name: "Deep Sea Rod",       colour: "#1f6bff", reach: 3, control: 0.33, luck: 0.25, speed: 0.25, need: "Seahorse" },
    { id: "lava",       name: "Lava Rod",           colour: "#ff5a1a", reach: 3, control: 0.37, luck: 0.4,  speed: 0.3,  need: "Lionfish" },
    { id: "moon",       name: "Moon Rod",           colour: "#b8c4ff", reach: 4, control: 0.39, luck: 0.5,  speed: 0.35, need: "Moonfish" },
    { id: "crystal",    name: "Crystal Rod",        colour: "#a0f0ff", reach: 4, control: 0.43, luck: 0.7,  speed: 0.4,  need: "Anglerfish" },
    { id: "legend",     name: "Rainbow Legend Rod", colour: "rainbow", reach: 4, control: 0.5,  luck: 1,    speed: 0.5,  need: "legendary" }
  ];
  const needText = r => r.need === "legendary" ? "Catch any Legendary fish" :
    `Catch a ${r.need}` + (r.need === "Moonfish" ? " (only at night, in the Deep Sea)" : "");
  const unlocks = (r, fish) => r.need === "legendary" ? fish.rarityIndex >= 4 : fish.species.name === r.need;

  Hub.register({
    id: "fishing", section: "games", title: "Fishing Beach", icon: "🎣",
    blurb: "Fish from the beach! 500 different fish to catch, and 8 rods to unlock.",
    stat: () => kinds() ? `🐟 ${kinds()}/500 fish` : "",
    badges: [
      { id: "fish1",      icon: "🎣", name: "First Catch",    desc: "Catch your first fish",            test: () => F.total >= 1 },
      { id: "fish50",     icon: "📖", name: "Fish Collector", desc: "Catch 50 different fish",          test: () => kinds() >= 50 },
      { id: "fishRods",   icon: "🏆", name: "Master Angler",  desc: "Unlock all 8 fishing rods",        test: () => F.rods.length >= RODS.length },
      { id: "fishLegend", icon: "👑", name: "Legend Hunter",  desc: "Catch a Legendary fish",           test: () => !!F.legend },
      { id: "fishMythic", icon: "✨", name: "Mythic Catch",   desc: "Catch a Mythic Celestial fish",    test: () => !!F.mythic }
    ],
    mount
  });

  function mount(host){
    const FF = FishingFish, SC = FishingScene;
    host.innerHTML = `
    <section class="game-screen" id="fsOverlay" hidden aria-label="Fishing Beach">
      <div class="game-box">
        <div class="game-hud">
          <h2>🎣 Fishing Beach</h2>
          <span class="mono game-stat" id="fsRodStat"></span>
          <span class="mono game-stat" id="fsCount"></span>
          <span class="mono game-stat" id="fsTime"></span>
          <button class="btn ghost small" id="fsBookBtn" type="button">📖 Fish Book</button>
          <button class="btn ghost small" id="fsRodsBtn" type="button">🎣 Rods</button>
          <button class="btn ghost small" id="fsCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas id="fsCanvas" width="960" height="540"></canvas>
          <div class="game-panel fs-panel" id="fsPanel">
            <div class="game-panel-title" id="fsTitle"></div>
            <div class="game-panel-text" id="fsText"></div>
            <canvas class="fs-catch-pic" id="fsCatchPic" width="360" height="200" hidden></canvas>
            <div class="fs-tabs" id="fsTabs" hidden></div>
            <div class="fs-book" id="fsBook" hidden></div>
            <div class="fs-rods" id="fsRods" hidden></div>
            <button class="btn" id="fsGoBtn" type="button">🎣 Go fishing!</button>
          </div>
        </div>
        <div class="game-help">Hold Space (or the mouse) to power up, let go to cast · press when the float dips · then hold to keep the green bar on the fish</div>
        <div class="game-touch"><button class="btn fs-hold" id="fsHoldBtn" type="button">🎣 Hold</button></div>
      </div>
    </section>`;
    const $ = id => document.getElementById(id);
    const overlay = $("fsOverlay"), canvas = $("fsCanvas"), ctx = canvas.getContext("2d");
    const panel = $("fsPanel"), title = $("fsTitle"), text = $("fsText"), goBtn = $("fsGoBtn");
    const catchPic = $("fsCatchPic"), tabs = $("fsTabs"), book = $("fsBook"), rodsEl = $("fsRods");
    const W = SC.W, H = SC.H;
    const ANGLER_X = 196;

    let open = false, last = 0, clock = 0, state = "menu", holding = false;
    let power = 0, powerT = 0, bob = null, hook = null, target = null, actor = null, timers = {}, reel = null, msg = null;
    let swimmers = [], splashes = [], chomp = null, dayStart = 0.32, camX = 0;
    const rod = () => RODS.find(r => r.id === F.rod) || RODS[0];
    const dayTime = () => (dayStart + clock / 360) % 1;       // a whole day lasts 6 minutes

    /* ---------------- the little fish swimming about ---------------- */
    function newSwimmer(zone){
      const [x0, x1] = SC.ZONE_X[zone];
      const night = SC.light(dayTime()).night;
      const fish = FF.pickFish(zone, night, 0);
      const x = x0 + Math.random() * (x1 - x0);
      const top = SC.SURFACE + 25, bottom = Math.min(H - 20, SC.seabedY(x) - 14);
      return { fish, x, y: top + Math.random() * Math.max(10, bottom - top), dir: Math.random() < 0.5 ? -1 : 1, v: 12 + Math.random() * 18, zone, w: 26 + Math.random() * 14, ph: Math.random() * 6 };
    }
    function resetSwimmers(){ swimmers = [0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3].map(newSwimmer); }

    function drawFish(fish, x, y, w, dir, alpha){
      const img = FF.picture(fish, 120, 72);
      const len = w * FF.lengthOf(fish);
      ctx.save();
      ctx.globalAlpha = alpha === undefined ? 1 : alpha;
      ctx.translate(x, y);
      ctx.scale(dir, 1);
      ctx.drawImage(img, -len / 2, -len * 0.3, len, len * 0.6);
      ctx.restore();
    }

    /* ---------------- you, on the beach ---------------- */
    function rodAngle(){
      if (state === "charging") return -0.95 - power * 1.25;
      if (state === "reeling") return -0.75 + Math.sin(clock * 20) * 0.03;
      if (state === "bite") return -0.7;
      if (bob) return -0.6;
      return -1.0 + Math.sin(clock * 1.5) * 0.03;
    }
    function hands(){ const fy = SC.sandY(ANGLER_X); return { x: ANGLER_X + 16, y: fy - 56 }; }
    function rodTip(){ const h = hands(), a = rodAngle(); return { x: h.x + Math.cos(a) * 130, y: h.y + Math.sin(a) * 130 }; }

    function drawAngler(){
      const fy = SC.sandY(ANGLER_X), x = ANGLER_X, breathe = Math.sin(clock * 2) * 0.8;
      ctx.save();
      ctx.lineCap = "round";
      // shadow
      ctx.fillStyle = "rgba(120,80,30,0.3)"; ctx.beginPath(); ctx.ellipse(x + 6, fy + 3, 26, 5, 0, 0, Math.PI * 2); ctx.fill();
      // legs and shoes
      ctx.strokeStyle = "#f0c8a0"; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(x - 6, fy - 30); ctx.lineTo(x - 8, fy - 3); ctx.moveTo(x + 7, fy - 30); ctx.lineTo(x + 10, fy - 3); ctx.stroke();
      ctx.fillStyle = "#1f6bff"; ctx.fillRect(x - 13, fy - 4, 12, 5); ctx.fillRect(x + 5, fy - 4, 12, 5);
      // shorts
      ctx.fillStyle = "#2f5fd8"; ctx.beginPath(); ctx.moveTo(x - 13, fy - 42); ctx.lineTo(x + 14, fy - 42); ctx.lineTo(x + 15, fy - 24); ctx.lineTo(x + 2, fy - 24); ctx.lineTo(x, fy - 30); ctx.lineTo(x - 2, fy - 24); ctx.lineTo(x - 14, fy - 24); ctx.closePath(); ctx.fill();
      // t-shirt with a fish on it
      ctx.fillStyle = "#ff7a1f"; ctx.beginPath(); ctx.moveTo(x - 14, fy - 76 + breathe); ctx.lineTo(x + 15, fy - 76 + breathe); ctx.lineTo(x + 15, fy - 40); ctx.lineTo(x - 14, fy - 40); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ffe14d"; ctx.beginPath(); ctx.ellipse(x + 1, fy - 58, 6, 3.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - 5, fy - 58); ctx.lineTo(x - 9, fy - 61); ctx.lineTo(x - 9, fy - 55); ctx.fill();
      // head, with a cap
      const hx = x + 1, hy = fy - 90 + breathe;
      ctx.fillStyle = "#f0c8a0"; ctx.beginPath(); ctx.arc(hx, hy, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#5a3a1a"; ctx.beginPath(); ctx.arc(hx - 3, hy - 2, 13, Math.PI * 0.95, Math.PI * 1.6); ctx.fill();
      ctx.fillStyle = "#e8262b"; ctx.beginPath(); ctx.arc(hx, hy - 4, 13.5, Math.PI, 0); ctx.fill(); ctx.fillRect(hx, hy - 6, 20, 4);
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(hx, hy - 10, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(hx + 7, hy + 1, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#a05a3a"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(hx + 6, hy + 5, 3.5, 0.2, 1.6); ctx.stroke();
      // arms reaching to the rod
      const h = hands();
      ctx.strokeStyle = "#f0c8a0"; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(x - 8, fy - 70); ctx.quadraticCurveTo(x - 2, fy - 52, h.x - 6, h.y + 4); ctx.moveTo(x + 10, fy - 70); ctx.lineTo(h.x + 4, h.y - 2); ctx.stroke();
      // the rod, bending when a fish pulls
      const tip = rodTip(), r = rod();
      const bend = state === "reeling" ? 26 + Math.sin(clock * 18) * 4 : state === "bite" ? 14 : 0;
      ctx.strokeStyle = r.colour === "rainbow" ? (() => { const g = ctx.createLinearGradient(h.x, h.y, tip.x, tip.y); ["#ff4d4d", "#ffe14d", "#4dd66b", "#4da6ff", "#b46bff"].forEach((c, i) => g.addColorStop(i / 4, c)); return g; })() : r.colour;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(h.x - 14, h.y + 10);
      ctx.quadraticCurveTo((h.x + tip.x) / 2 + bend * 0.6, (h.y + tip.y) / 2 + bend, tip.x + bend * 0.3, tip.y + bend * 1.2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = "#333"; ctx.beginPath(); ctx.arc(h.x - 4, h.y + 9, 5, 0, Math.PI * 2); ctx.fill();          // the reel
      ctx.strokeStyle = "#aaa"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(h.x - 4, h.y + 9); ctx.lineTo(h.x - 4 + Math.cos(clock * (state === "reeling" && holding ? 16 : 0)) * 6, h.y + 9 + Math.sin(clock * (state === "reeling" && holding ? 16 : 0)) * 6); ctx.stroke();
      ctx.restore();
      return { x: tip.x + bend * 0.3, y: tip.y + bend * 1.2 };
    }

    /* ---------------- casting, biting, reeling ---------------- */
    function say(t, secs){ msg = { text: t, t: secs || 2 }; }
    // comic words out in the world (drawn with the camera), and a fish that talks back while you reel
    const fx = Fun.pops();
    let fxDt = 1 / 60, tauntT = 1.5;
    const popW = (text, x, y, colour, size) => fx.pop(text, x, y, colour, size || 30);

    function press(){
      holding = true;
      if (state === "idle") { state = "charging"; powerT = 0; }
      else if (state === "waiting") { say("😬 Too early! The fish swam away.", 2); popW("Too early! 🙈", bob.x, SC.SURFACE - 40, "#ff8a8a"); Fun.sfx.nope(); scareFish(); }
      else if (state === "bite") startReel();
    }
    function release(){
      holding = false;
      if (state === "charging") cast();
    }

    // how far out a cast goes: the further the rod reaches, the further out the ocean you can throw
    const CAST_X = [720, 1180, 1700, 2170];
    const landX = p => SC.SHORE_X + 30 + Math.max(0.06, p) * (CAST_X[rod().reach - 1] - SC.SHORE_X - 30);
    function bobPos(){
      if (bob.flying) {
        const u = bob.t, far = Math.min(1, (bob.x - bob.x0) / 900);
        return { x: bob.x0 + (bob.x - bob.x0) * u, y: bob.y0 + (bob.y - bob.y0) * u - Math.sin(u * Math.PI) * (120 + far * 120) };
      }
      const x = state === "reeling" && hook ? hook.x : bob.x;
      return { x, y: SC.waveY(x, clock) + bob.dip };
    }
    function cast(){
      const x = landX(power);
      const from = rodTip();
      bob = { x0: from.x, y0: from.y, x, y: SC.SURFACE, t: 0, flying: true, dip: 0 };
      state = "flying";
      Fun.sfx.whoosh(); popW(power > 0.9 ? "MEGA CAST!" : "Whoosh!", from.x + 40, from.y - 20, "#ffffff", power > 0.9 ? 34 : 26);
    }

    function landed(){
      bob.flying = false;
      splashes.push({ x: bob.x, y: SC.SURFACE, t: 0 });
      Fun.sfx.splash(); popW("Plop!", bob.x, SC.SURFACE - 30, "#bfe8ff", 24);
      const zone = Math.max(0, SC.zoneAt(bob.x));
      const depth = Math.min(SC.seabedY(bob.x) - 18, SC.SURFACE + 40 + (SC.seabedY(bob.x) - SC.SURFACE) * 0.7);
      hook = { x: bob.x, y: SC.SURFACE + 4, depth };
      const r = rod(), night = SC.light(dayTime()).night;
      target = FF.pickFish(zone, night, r.luck);
      const side = Math.random() < 0.5 ? -1 : 1;
      const wait = (2 + Math.random() * 4) * (1 - r.speed * 0.6);
      actor = { fish: target, x: hook.x + side * 170, y: depth + (Math.random() - 0.5) * 40, dir: -side, arrive: wait * 0.7 };
      timers = { wait, nibbles: [wait * 0.45, wait * 0.75].filter(() => Math.random() < 0.8), t: 0 };
      state = "waiting";
      say(`${FF.ZONES[zone].emoji} ${FF.ZONES[zone].name}`, 1.4);
    }

    // the fish swims off, and you reel in an empty line
    function scareFish(){
      if (actor) { actor.flee = true; actor.fleeT = 1.5; }
      state = "idle"; bob = null; hook = null; reel = null; target = null;
    }

    const difficulty = fish => 0.25 + fish.rarityIndex * 0.13 + (fish.size[1] > 150 ? 0.1 : 0);
    function startReel(){
      const fish = target;
      reel = { fish, diff: difficulty(fish), fishPos: 0.5, fishTarget: 0.5, retarget: 0, zonePos: 0.3, zoneVel: 0, progress: 0.3, size: rod().control, t: 0 };
      // sometimes a bigger fish turns up and eats the one on your hook!
      const hunter = Math.random() < 0.2 && FF.pickHunter(fish, SC.light(dayTime()).night, rod().luck);
      if (hunter) reel.ambush = { fish: hunter, at: 1.2 + Math.random() * 2.5 };
      state = "reeling";
      say("❗ Hold to reel it in!", 1.2);
      popW("GOTCHA!", bob.x, SC.SURFACE - 50, "#ffe14d", 36); Fun.sfx.zap(); tauntT = 1.5;
    }

    // the big fish swims in, gulps down your fish, and now it's on your hook
    function updateAmbush(dt){
      const A = reel.ambush;
      if (!A || A.done || reel.t < A.at || !actor) return;
      if (!A.hunter) {
        const side = actor.x > SC.SHORE_X + 200 && Math.random() < 0.5 ? -1 : 1;
        A.hunter = { fish: A.fish, x: actor.x + side * 260, y: actor.y + 20, dir: -side };
        say(`⚠️ Something big is coming…`, 1.6);
      }
      const H = A.hunter;
      const sp = 230 * dt;
      const dx = actor.x - H.x, dy = actor.y - H.y, d = Math.hypot(dx, dy);
      H.dir = dx < 0 ? -1 : 1;
      if (d > 18) { H.x += dx / d * sp; H.y += dy / d * sp; return; }
      // CHOMP
      A.done = true;
      splashes.push({ x: actor.x, y: SC.SURFACE, t: 0, big: true });
      chomp = { x: actor.x, y: actor.y, t: 0 };
      Fun.sfx.chomp(); Fun.sfx.splat();
      say(`😱 A ${A.fish.name} ate your ${reel.fish.name}! Reel it in!`, 2.6);
      actor = { fish: A.fish, x: H.x, y: H.y, dir: H.dir };
      reel.eaten = reel.fish.name;
      reel.fish = A.fish;
      reel.diff = difficulty(A.fish) + 0.1;
      reel.progress = Math.max(reel.progress, 0.35);
      reel.ate = true;
    }

    function updateReel(dt){
      const R = reel;
      R.t += dt;
      updateAmbush(dt);
      if (state !== "reeling") return;
      tauntT -= dt;
      if (tauntT <= 0 && actor) {
        tauntT = 2 + Math.random() * 2;
        popW(["Blub blub!", "Catch me!", "Nope!", "Let me go!", "I'm slippery!", "Wheee!", "Not today!"][Math.floor(Math.random() * 7)], actor.x, actor.y - 30, "#ffffff", 20);
      }
      R.retarget -= dt;
      if (R.retarget <= 0) {
        R.fishTarget = Math.max(0.05, Math.min(0.95, R.fishPos + (Math.random() - 0.5) * (0.4 + R.diff)));
        R.retarget = (1.3 - R.diff * 0.7) * (0.5 + Math.random());
      }
      const sp = 0.25 + R.diff * 0.9;
      R.fishPos += Math.max(-sp * dt, Math.min(sp * dt, R.fishTarget - R.fishPos));
      R.zoneVel += (holding ? 2.8 : -2.4) * dt;
      R.zoneVel *= Math.pow(0.25, dt);
      R.zonePos += R.zoneVel * dt;
      if (R.zonePos < R.size / 2) { R.zonePos = R.size / 2; R.zoneVel = Math.max(0, R.zoneVel) * 0.3; }
      if (R.zonePos > 1 - R.size / 2) { R.zonePos = 1 - R.size / 2; R.zoneVel = Math.min(0, R.zoneVel) * 0.3; }
      const on = Math.abs(R.fishPos - R.zonePos) < R.size / 2;
      R.on = on;
      R.progress += on ? 0.3 * dt : -0.19 * dt * (1 + R.diff * 0.5);
      if (hook) hook.x = bob.x - (bob.x - SC.SHORE_X - 20) * Math.max(0, R.progress) * 0.5;
      if (R.progress >= 1) caught();
      else if (R.progress <= 0) { say("💨 It got away! Try again.", 2.2); if (actor) popW("See ya! 👋", actor.x, actor.y - 30, "#ffffff", 26); Fun.sfx.wah(); scareFish(); }
    }

    function caught(){
      const fish = reel.fish, eaten = reel.eaten;
      const [lo, hi] = fish.size;
      const cm = Math.round(lo + (hi - lo) * Math.pow(Math.random(), 1.6));
      const isNew = !F.caught[fish.id];
      const rec = F.caught[fish.id] || { n: 0, best: 0 };
      rec.n++; rec.best = Math.max(rec.best, cm);
      F.caught[fish.id] = rec;
      F.total++;
      if (fish.rarityIndex >= 4) F.legend = true;
      if (fish.rarityIndex >= 5) F.mythic = true;
      const newRods = RODS.filter(r => !F.rods.includes(r.id) && r.need && unlocks(r, fish));
      newRods.forEach(r => F.rods.push(r.id));
      Hub.saveStore();
      Hub.checkBadges();
      splashes.push({ x: hook ? hook.x : bob.x, y: SC.SURFACE, t: 0, big: true });
      Fun.sfx.splash(); Fun.sfx.tada();
      state = "caught";
      bob = null; hook = null; reel = null; actor = null;
      showCatch(fish, cm, isNew, rec, newRods, eaten);
    }

    /* ---------------- the panels: start, a catch, the fish book, the rods ---------------- */
    function showPanel(kind){
      [catchPic, tabs, book, rodsEl].forEach(el => { el.hidden = true; });
      panel.className = "game-panel fs-panel fs-mode-" + kind;
      title.style.color = "";
      panel.hidden = false;
    }
    function hidePanel(){
      panel.hidden = true;
      if (state === "menu" || state === "caught" || state === "paused") state = "idle";
      canvas.focus();
    }

    function showStart(){
      state = "menu";
      showPanel("start");
      title.textContent = "🎣 Fishing Beach";
      text.textContent = `Catch all 500 fish and unlock all 8 rods! You've caught ${kinds()} different fish so far. ` +
        "Hold to power up your cast and let go to throw. When the float dips hard, press! Then hold to keep the green bar on the fish.";
      goBtn.textContent = "🎣 Go fishing!";
    }

    function showCatch(fish, cm, isNew, rec, newRods, eaten){
      showPanel("catch");
      title.innerHTML = "";
      title.append(isNew ? "✨ NEW! " : "🎣 ", fish.name);
      title.style.color = fish.rarity.colour;
      text.innerHTML = `<b style="color:${fish.rarity.colour}">${fish.rarity.name}</b> · ${cm} cm · ${FF.ZONES[fish.zone].emoji} ${FF.ZONES[fish.zone].name}` +
        (fish.night ? " · 🌙 night only" : "") +
        (eaten ? `<br>😱 It gobbled up the ${eaten} on your hook!` : "") +
        `<br>You've caught ${rec.n} of these · biggest ${rec.best} cm · Fish Book ${kinds()}/500` +
        newRods.map(r => `<br><b class="fs-unlock">🎉 You unlocked the ${r.name}!</b>`).join("");
      catchPic.hidden = false;
      const g = catchPic.getContext("2d");
      g.clearRect(0, 0, 360, 200);
      const glow = g.createRadialGradient(180, 100, 10, 180, 100, 150);
      glow.addColorStop(0, fish.rarity.colour + "88"); glow.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = glow; g.fillRect(0, 0, 360, 200);
      g.drawImage(FF.picture(fish, 300, 180), 30, 10);
      goBtn.textContent = newRods.length ? "🎣 Try my new rod!" : "🎣 Keep fishing";
      if (newRods.length) F.rod = newRods[newRods.length - 1].id;
      Hub.confettiBurst(goBtn);
      if (isNew && fish.rarityIndex >= 3) Hub.confettiBurst(goBtn);
      goBtn.focus();
    }

    let bookZone = 0;
    // the book and the rods can be opened any time, except while a fish is on the line
    function canPause(){
      if (state === "bite" || state === "reeling" || state === "caught") return false;
      if (bob) scareFish();
      return true;
    }
    function showBook(){
      if (!canPause()) return;
      state = "paused";
      showPanel("book");
      title.textContent = `📖 Fish Book · ${kinds()} / 500`;
      text.textContent = "Every fish you've caught. The ??? ones are still out there!";
      tabs.hidden = false; book.hidden = false;
      tabs.innerHTML = "";
      FF.ZONES.forEach((z, k) => {
        const n = FF.FISH.filter(f => f.zone === k && F.caught[f.id]).length, all = FF.FISH.filter(f => f.zone === k).length;
        const b = document.createElement("button");
        b.type = "button"; b.className = "btn ghost small";
        b.setAttribute("aria-pressed", String(k === bookZone));
        b.textContent = `${z.emoji} ${z.name} ${n}/${all}`;
        b.addEventListener("click", () => { bookZone = k; showBook(); });
        tabs.appendChild(b);
      });
      book.innerHTML = "";
      FF.FISH.filter(f => f.zone === bookZone).forEach(f => {
        const got = F.caught[f.id];
        const cell = document.createElement("div");
        cell.className = "fs-cell" + (got ? "" : " missing");
        cell.style.borderColor = got ? f.rarity.colour : "";
        const c = document.createElement("canvas");
        c.width = 90; c.height = 54;
        const g = c.getContext("2d");
        g.drawImage(FF.picture(f, 90, 54), 0, 0);
        if (!got) { g.globalCompositeOperation = "source-in"; g.fillStyle = "#0d1a2c"; g.fillRect(0, 0, 90, 54); }
        const name = document.createElement("div");
        name.className = "fs-name";
        name.textContent = got ? f.name : "???";
        if (got) name.style.color = f.rarity.colour;
        cell.append(c, name);
        if (got) cell.title = `${f.name} · ${f.rarity.name} · caught ${got.n} · biggest ${got.best} cm`;
        book.appendChild(cell);
      });
      goBtn.textContent = "🎣 Back to fishing";
    }

    function showRods(){
      if (!canPause()) return;
      state = "paused";
      showPanel("rods");
      title.textContent = `🎣 Rods · ${F.rods.length} / ${RODS.length}`;
      text.textContent = "Catch the right fish to unlock a new rod. Better rods cast further, catch rarer fish and make reeling easier.";
      rodsEl.hidden = false;
      rodsEl.innerHTML = "";
      const bar = v => "●".repeat(Math.round(v)) + "○".repeat(5 - Math.round(v));
      RODS.forEach(r => {
        const have = F.rods.includes(r.id);
        const row = document.createElement("div");
        row.className = "fs-rod" + (have ? "" : " locked") + (r.id === F.rod ? " on" : "");
        const sw = document.createElement("span");
        sw.className = "fs-rod-swatch" + (r.colour === "rainbow" ? " rainbow" : "");
        if (r.colour !== "rainbow") sw.style.background = r.colour;
        const info = document.createElement("div");
        info.className = "fs-rod-info";
        info.innerHTML = `<b></b><span class="mono">Reach ${bar(r.reach + 1)} · Control ${bar((r.control - 0.2) * 16.7)} · Luck ${bar(r.luck * 5)}</span><span class="fs-need"></span>`;
        info.querySelector("b").textContent = r.name;
        info.querySelector(".fs-need").textContent = have ? `Reaches: ${FF.ZONES.slice(0, r.reach).map(z => z.name).join(", ")}` : "🔒 " + needText(r);
        const btn = document.createElement("button");
        btn.type = "button"; btn.className = "btn small";
        btn.textContent = r.id === F.rod ? "✓ Using" : have ? "Use" : "🔒";
        btn.disabled = !have || r.id === F.rod;
        btn.addEventListener("click", () => { F.rod = r.id; Hub.saveStore(); showRods(); });
        row.append(sw, info, btn);
        rodsEl.appendChild(row);
      });
      goBtn.textContent = "🎣 Back to fishing";
    }

    /* ---------------- each frame ---------------- */
    function step(dt){
      clock += dt;
      if (state === "charging") { powerT += dt; power = 1 - Math.abs(((powerT / 1.3) % 2) - 1); }
      if (bob && bob.flying) {
        bob.t += dt / (0.7 + (bob.x - bob.x0) / 1800);
        if (bob.t >= 1) landed();
      }
      if (hook && (state === "waiting" || state === "bite")) hook.y += (hook.depth - hook.y) * Math.min(1, dt * 2.5);
      if (state === "waiting") {
        timers.t += dt;
        if (timers.nibbles.length && timers.t >= timers.nibbles[0]) { timers.nibbles.shift(); bob.dip = 5; splashes.push({ x: bob.x, y: SC.SURFACE, t: 0, small: true }); }
        if (timers.t >= timers.wait) { state = "bite"; timers.bite = 0.85 + rod().speed * 0.4; bob.dip = 14; splashes.push({ x: bob.x, y: SC.SURFACE, t: 0 }); Fun.sfx.ding(); }
      } else if (state === "bite") {
        timers.bite -= dt;
        bob.dip = 12 + Math.sin(clock * 30) * 3;
        if (timers.bite <= 0) { say("💨 Too slow! It took the bait and left.", 2.2); popW("Bye-bye worm! 🪱", bob.x, SC.SURFACE - 40, "#ffb3c7"); Fun.sfx.nope(); scareFish(); }
      } else if (state === "reeling") updateReel(dt);
      if (bob && !bob.flying && state !== "bite") bob.dip *= Math.pow(0.02, dt);

      // the fish that is coming to your hook
      if (actor) {
        if (actor.flee) { actor.x += actor.dir * -160 * dt; if ((actor.fleeT -= dt) <= 0) actor = null; }
        else if (hook) {
          const tx = state === "waiting" && timers.t < actor.arrive ? hook.x - actor.dir * 40 : hook.x - actor.dir * 14;
          const ty = hook.y + (state === "reeling" ? Math.sin(clock * 9) * 8 : 0);
          actor.x += (tx - actor.x) * Math.min(1, dt * (state === "reeling" ? 6 : 1.2));
          actor.y += (ty - actor.y) * Math.min(1, dt * 1.5);
          if (state === "reeling") actor.dir = Math.sin(clock * 5) > 0 ? 1 : -1;
        }
      }
      swimmers.forEach((s, k) => {
        s.x += s.dir * s.v * dt;
        const [x0, x1] = SC.ZONE_X[s.zone];
        if (s.x < x0 - 30 || s.x > x1 + 30) swimmers[k] = newSwimmer(s.zone);
      });
      splashes.forEach(s => { s.t += dt; });
      if (chomp && (chomp.t += dt) > 0.9) chomp = null;
      splashes = splashes.filter(s => s.t < 0.8);
      if (msg && (msg.t -= dt) <= 0) msg = null;

      // the camera follows your float out to sea, and comes back to the beach (it stays still while you power up)
      if (state !== "charging") {
        const focus = bob ? bobPos().x : ANGLER_X;
        const want = Math.min(SC.WORLD - W, Math.max(0, focus - W * 0.55));
        camX += (want - camX) * Math.min(1, dt * (bob && bob.flying ? 4 : 2.5));
      }
    }

    // a little map of the whole beach and sea at the top, showing where your float is
    function drawMap(){
      const x0 = 16, y0 = 14, w = 240, sc = w / SC.WORLD;
      ctx.fillStyle = "rgba(0,0,0,0.45)"; roundRect(x0 - 6, y0 - 6, w + 12, 30, 8); ctx.fill();
      ctx.fillStyle = "#f2d38f"; ctx.fillRect(x0, y0, SC.SHORE_X * sc, 8);
      ["#5fd0e8", "#2fb0a8", "#1f6aa8", "#14204a"].forEach((c, k) => {
        const [a, b] = SC.ZONE_X[k];
        ctx.fillStyle = c; ctx.fillRect(x0 + a * sc, y0, (b - a) * sc, 8);
      });
      ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 1;
      ctx.strokeRect(x0 + camX * sc, y0 - 2, W * sc, 12);
      ctx.fillStyle = "#ff7a1f"; ctx.beginPath(); ctx.arc(x0 + ANGLER_X * sc, y0 + 4, 3, 0, Math.PI * 2); ctx.fill();
      if (state === "charging") {
        // where the float will land
        const lx = x0 + landX(power) * sc;
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(lx, y0 + 1); ctx.lineTo(lx - 5, y0 - 7); ctx.lineTo(lx + 5, y0 - 7); ctx.fill();
        ctx.font = "700 11px 'IBM Plex Mono', monospace"; ctx.textAlign = "left"; ctx.fillStyle = "#fff";
        ctx.fillText(`📏 ${Math.round((landX(power) - SC.SHORE_X) / 8)} m`, x0, y0 + 20);
      } else if (bob) {
        const bx = bobPos().x;
        ctx.fillStyle = "#e8262b"; ctx.beginPath(); ctx.arc(x0 + bx * sc, y0 + 4, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.font = "700 11px 'IBM Plex Mono', monospace"; ctx.textAlign = "left"; ctx.fillStyle = "#fff";
        ctx.fillText(`📏 ${Math.max(0, Math.round((bx - SC.SHORE_X) / 8))} m`, x0, y0 + 20);
      } else {
        ctx.font = "700 11px 'IBM Plex Mono', monospace"; ctx.textAlign = "left"; ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.fillText("🏖️ 🪸 🌊 🕳️ farther = rarer fish", x0, y0 + 20);
      }
    }

    function draw(){
      const L = SC.light(dayTime());
      SC.drawSky(ctx, clock, L, dayTime());
      // everything else is in the wide world, seen through the camera
      ctx.save();
      ctx.translate(-Math.round(camX), 0);
      SC.drawWater(ctx, clock, L);
      swimmers.forEach(s => drawFish(s.fish, s.x, s.y + Math.sin(clock * 2 + s.ph) * 3, s.w, s.dir, 0.9));
      if (actor) drawFish(actor.fish, actor.x, actor.y, 34 + Math.min(30, actor.fish.size[1] / 8) * (reel && reel.ate ? 1.4 : 1), actor.dir, 1);
      if (reel && reel.ambush && reel.ambush.hunter && !reel.ambush.done) {
        const Hn = reel.ambush.hunter;
        drawFish(Hn.fish, Hn.x, Hn.y + Math.sin(clock * 6) * 3, 34 + Math.min(30, Hn.fish.size[1] / 8) * 1.4, Hn.dir, 1);
      }
      if (chomp) {
        const u = chomp.t / 0.9;
        ctx.font = `800 ${28 + u * 16}px 'Bricolage Grotesque', sans-serif`; ctx.textAlign = "center";
        ctx.globalAlpha = 1 - u; ctx.lineWidth = 5; ctx.strokeStyle = "#000"; ctx.fillStyle = "#ff4d4d";
        ctx.strokeText("CHOMP!", chomp.x, chomp.y - 30 - u * 20); ctx.fillText("CHOMP!", chomp.x, chomp.y - 30 - u * 20);
        ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(chomp.x + Math.cos(k) * 20 * u * 2, chomp.y + Math.sin(k * 2) * 14 * u * 2, 3 * (1 - u), 0, Math.PI * 2); ctx.fill(); }
      }
      SC.drawSurface(ctx, clock, L);
      SC.drawBeachThings(ctx, clock);
      const tip = drawAngler();

      // the line, the float and the hook
      if (bob) {
        const { x: bx, y: by } = bobPos();
        ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(tip.x, tip.y);
        ctx.quadraticCurveTo((tip.x + bx) / 2, Math.max(tip.y, by) + (state === "reeling" ? -10 : 30), bx, by); ctx.stroke();
        if (hook && !bob.flying) {
          ctx.beginPath(); ctx.moveTo(bx, by + 6); ctx.lineTo(hook.x, hook.y); ctx.stroke();
          ctx.strokeStyle = "#c8ccd4"; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(hook.x, hook.y); ctx.lineTo(hook.x, hook.y + 8); ctx.arc(hook.x - 3, hook.y + 8, 3, 0, Math.PI); ctx.stroke();
          if (state !== "reeling") { ctx.strokeStyle = "#e88a9a"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(hook.x - 3, hook.y + 9); ctx.quadraticCurveTo(hook.x - 8, hook.y + 4 + Math.sin(clock * 6) * 2, hook.x - 4, hook.y + 1); ctx.stroke(); } // the worm
        }
        if (!(state === "reeling")) {
          ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(bx, by + 2, 5, 0, Math.PI); ctx.fill();
          ctx.fillStyle = "#e8262b"; ctx.beginPath(); ctx.arc(bx, by + 2, 5, Math.PI, 0); ctx.fill();
          ctx.strokeStyle = "#333"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(bx, by - 3); ctx.lineTo(bx, by - 9); ctx.stroke();
        }
        if (state === "bite") {
          ctx.font = "800 44px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#ffe14d";
          ctx.strokeStyle = "#000"; ctx.lineWidth = 6; ctx.strokeText("!", bx, by - 24); ctx.fillText("!", bx, by - 24);
        }
      }
      splashes.forEach(s => {
        const u = s.t / 0.8;
        ctx.strokeStyle = `rgba(255,255,255,${1 - u})`; ctx.lineWidth = s.big ? 3 : 2;
        ctx.beginPath(); ctx.ellipse(s.x, s.y + 2, (s.small ? 8 : s.big ? 30 : 16) * (0.4 + u), 4 * (0.4 + u), 0, 0, Math.PI * 2); ctx.stroke();
        if (!s.small) { ctx.fillStyle = `rgba(255,255,255,${0.8 - u})`; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.arc(s.x + k * 7, s.y - Math.sin(u * Math.PI) * (s.big ? 30 : 16) * (1 - Math.abs(k) * 0.25), 2.5, 0, Math.PI * 2); ctx.fill(); } }
      });
      // the power bar while charging a cast
      if (state === "charging") {
        const h = hands();
        ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(h.x - 70, h.y - 110, 18, 100);
        const g = ctx.createLinearGradient(0, h.y - 10, 0, h.y - 110);
        g.addColorStop(0, "#4dd66b"); g.addColorStop(0.6, "#ffe14d"); g.addColorStop(1, "#ff4d4d");
        ctx.fillStyle = g; ctx.fillRect(h.x - 67, h.y - 13 - power * 94, 12, power * 94);
        // where it would land
        const x = landX(power);
        ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.beginPath(); ctx.moveTo(x, SC.SURFACE - 18); ctx.lineTo(x - 7, SC.SURFACE - 30); ctx.lineTo(x + 7, SC.SURFACE - 30); ctx.fill();
      }
      fx.draw(ctx, fxDt);
      ctx.restore();
      SC.drawNight(ctx, L);

      if (state === "reeling" && reel) drawReel();
      drawMap();
      if (msg) {
        ctx.font = "800 26px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center";
        ctx.lineWidth = 6; ctx.strokeStyle = "rgba(0,0,0,0.65)"; ctx.fillStyle = "#fff";
        ctx.strokeText(msg.text, W / 2 + 60, 60); ctx.fillText(msg.text, W / 2 + 60, 60);
      }
      if (state === "idle" && !msg) {
        ctx.font = "700 18px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 4;
        const tx = "Hold to power up your cast!";
        ctx.strokeText(tx, W / 2 + 60, 60); ctx.fillText(tx, W / 2 + 60, 60);
      }
    }

    // the reeling meter: keep the green bar on the fish
    function drawReel(){
      const R = reel, x = W - 80, y = 110, h = 300;
      ctx.fillStyle = "rgba(5,15,35,0.75)"; roundRect(x - 10, y - 10, 70, h + 20, 12); ctx.fill();
      ctx.fillStyle = "#123a5a"; ctx.fillRect(x, y, 30, h);
      const zy = y + h * (1 - R.zonePos - R.size / 2);
      ctx.fillStyle = R.on ? "rgba(77,214,107,0.9)" : "rgba(77,214,107,0.55)"; ctx.fillRect(x, zy, 30, h * R.size);
      ctx.strokeStyle = "#bff5c8"; ctx.lineWidth = 2; ctx.strokeRect(x, zy, 30, h * R.size);
      const fy = y + h * (1 - R.fishPos);
      ctx.save(); ctx.translate(x + 15, fy); ctx.drawImage(FF.picture(R.fish, 60, 36), -20, -12, 40, 24); ctx.restore();
      ctx.fillStyle = "#333"; ctx.fillRect(x + 38, y, 12, h);
      const pg = Math.max(0, Math.min(1, R.progress));
      ctx.fillStyle = pg > 0.7 ? "#4dd66b" : pg > 0.3 ? "#ffe14d" : "#ff4d4d";
      ctx.fillRect(x + 38, y + h * (1 - pg), 12, h * pg);
      ctx.font = "800 14px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#fff";
      ctx.fillText(holding ? "⬆ REEL!" : "HOLD", x + 25, y + h + 28);
    }
    function roundRect(x, y, w, h, r){
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }

    function updateHud(){
      $("fsRodStat").textContent = "🎣 " + rod().name;
      $("fsCount").textContent = `📖 ${kinds()}/500`;
      const L = SC.light(dayTime());
      $("fsTime").textContent = L.night ? "🌙 Night" : L.sunset > 0.4 ? "🌅 Evening" : "☀️ Day";
    }

    function loop(now){
      if (!open) return;
      const dt = Math.max(0, Math.min(1 / 30, (now - last) / 1000 || 0));
      last = now; fxDt = dt;
      if (panel.hidden || state === "caught") step(dt); else clock += dt;
      draw();
      updateHud();
      requestAnimationFrame(loop);
    }

    function openGame(){
      open = true;
      overlay.hidden = false;
      document.body.style.overflow = "hidden";
      resetSwimmers();
      showStart();
      last = performance.now();
      requestAnimationFrame(loop);
      goBtn.focus();
    }
    function closeGame(){
      open = false; holding = false;
      overlay.hidden = true;
      document.body.style.overflow = "";
      if (state !== "menu") { bob = null; hook = null; reel = null; actor = null; state = "idle"; }
    }

    /* ---------------- controls: one button ---------------- */
    window.addEventListener("keydown", e => {
      if (!open) return;
      if (e.key === "Escape") { Hub.leave(); return; }
      if (e.code !== "Space" || !panel.hidden) return;
      e.preventDefault();
      if (!e.repeat) press();
    });
    window.addEventListener("keyup", e => { if (open && e.code === "Space") { e.preventDefault(); release(); } });
    const holdOn = e => { if (!panel.hidden) return; e.preventDefault(); press(); };
    const holdOff = () => { if (holding) release(); };
    [canvas, $("fsHoldBtn")].forEach(el => {
      el.addEventListener("pointerdown", e => { el.setPointerCapture && el.setPointerCapture(e.pointerId); holdOn(e); });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach(ev => el.addEventListener(ev, holdOff));
    });
    canvas.tabIndex = 0;
    goBtn.addEventListener("click", hidePanel);
    $("fsBookBtn").addEventListener("click", showBook);
    $("fsRodsBtn").addEventListener("click", showRods);
    $("fsCloseBtn").addEventListener("click", () => Hub.leave());
    Fun.soundButton($("fsCloseBtn"));

    return { open: openGame, close: closeGame };
  }
})();
