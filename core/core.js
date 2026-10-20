/* Learn & Play core: the saved progress, trophies and fun effects every app shares,
   the list of apps, and the screens that switch between them.

   Every app is a script that calls Hub.register({...}) when it loads:
     id, section ("learning" or "games"), title, icon, blurb,
     stat()   optional: a short line for its card, like "Best: 2:15"
     badges   optional: [{ id, icon, name, desc, test() }] for the section's trophy shelf
     mount(host) builds the app inside host the first time it's opened, and returns { open(), close() }
   Routes live in the address bar: #/ (home), #/games (a section), #/games/pacman (an app).
   Hub.page(id, { title, mount(host) -> { open(), close() } }) adds a plain page at #/id (the Grown-ups page). */
(function(){
  "use strict";

  /* ---------------- saved progress: one object in localStorage, shared by every app ---------------- */
  const STORE_KEY = "numberline:v1"; // Fast Math's old key, so progress saved before the split carries over
  const store = (() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {};
  })();
  if (!store.badges) store.badges = {};
  function saveStore(){
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) {}
  }

  function formatTime(sec){
    const m = Math.floor(sec / 60), s = sec % 60;
    return m + ":" + String(s).padStart(2, "0");
  }

  /* ---------------- fun effects ---------------- */
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const CONFETTI_COLOURS = ["#ff4d4d", "#ff9f1c", "#ffe14d", "#4dd66b", "#4da6ff", "#b46bff", "#ff6bd6"];

  // Every button flashes through the rainbow when clicked.
  document.addEventListener("click", e => {
    const btn = e.target.closest("button");
    if (!btn || btn.disabled) return;
    btn.classList.remove("rainbow");
    void btn.offsetWidth; // restart the animation on quick repeat clicks
    btn.classList.add("rainbow");
  });
  document.addEventListener("animationend", e => {
    if (e.animationName === "rainbow-flash") e.target.classList.remove("rainbow");
  });

  // A burst of confetti that shoots up from an element and falls down.
  function confettiBurst(fromEl){
    if (reduceMotion.matches) return;
    const r = fromEl.getBoundingClientRect();
    const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
    const layer = document.createElement("div");
    layer.className = "confetti-layer";
    document.body.appendChild(layer);
    let left = 70;
    for (let i = 0; i < 70; i++) {
      const piece = document.createElement("div");
      piece.className = "confetti-piece";
      piece.style.left = x0 + "px";
      piece.style.top = y0 + "px";
      piece.style.background = CONFETTI_COLOURS[i % CONFETTI_COLOURS.length];
      if (i % 3 === 0) piece.style.borderRadius = "50%";
      layer.appendChild(piece);
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
      const speed = 160 + Math.random() * 220;
      const dx = Math.cos(angle) * speed, dy = Math.sin(angle) * speed;
      const spin = (Math.random() - 0.5) * 1440;
      piece.animate([
        { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${dx * 1.5}px, ${dy + 420 + Math.random() * 200}px) rotate(${spin}deg)`, opacity: 0 }
      ], { duration: 1300 + Math.random() * 700, easing: "cubic-bezier(.2,.6,.4,1)" })
        .finished.then(() => { if (--left === 0) layer.remove(); });
    }
  }

  /* ---------------- the apps ---------------- */
  const SECTIONS = {
    learning: { title: "Learning", icon: "📚", blurb: "Practise a subject, with a worked answer for every question.", noun: ["subject", "subjects"] },
    games:    { title: "Games",    icon: "🎮", blurb: "Run, chomp and blast your way to a new best score.",          noun: ["game", "games"] }
  };
  const apps = [];
  function register(app){
    if (!SECTIONS[app.section]) throw new Error(`Unknown section "${app.section}" for app "${app.id}"`);
    apps.push(Object.assign({ badges: [], ctrl: null, host: null }, app));
  }
  const appsIn = section => apps.filter(a => a.section === section);
  // the games are grouped on their page; anything new and not listed here goes under "More games"
  const CATEGORIES = [
    { title: "🏁 Racing", ids: ["wheels", "turbo"] },
    { title: "⚽ Sports", ids: ["soccer", "hoops", "pool", "bowling", "minigolf", "ping-pong"] },
    { title: "🗺️ Adventure", ids: ["forest", "parkour", "robot-tag", "tag-rush", "zombie-blaster", "egg-heist", "brainrot-heist"] },
    { title: "👾 Arcade", ids: ["pacman", "pacman-3d", "tower", "fishing"] },
    { title: "🧱 Build & grow", ids: ["blocks", "garden", "potato-tycoon"] },
    { title: "🧠 Brain games", ids: ["chess"] }
  ];

  /* ---------------- trophies: every app brings its own, each section has a shelf ---------------- */
  function checkBadges(){
    if (window.Daily) Daily.check();   // today's challenges read the same progress
    const fresh = apps.flatMap(a => a.badges).filter(b => !store.badges[b.id] && b.test());
    if (!fresh.length) return;
    fresh.forEach(b => { store.badges[b.id] = true; });
    if (store.coins !== undefined) store.coins += 20 * fresh.length;   // every new trophy is worth 20 coins in the shop
    saveStore();
    if (current && current.section && !current.app) renderSection(current.section);
    fresh.forEach((b, i) => setTimeout(() => showToast(b), i * 900));
  }

  let toastStack = null;
  function showToast(b, title){
    if (!toastStack) {
      toastStack = document.createElement("div");
      toastStack.className = "toast-stack";
      toastStack.setAttribute("aria-live", "polite");
      document.body.appendChild(toastStack);
    }
    const t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = `<span class="icon"></span><div><div class="t1"></div><div class="t2"></div></div>`;
    t.querySelector(".icon").textContent = b.icon;
    t.querySelector(".t1").textContent = title || "New trophy! +20 🪙";
    t.querySelector(".t2").textContent = b.name;
    toastStack.appendChild(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 400); }, 3200);
  }

  /* ---------------- screens ---------------- */
  // plain pages that aren't an app or a section, like #/grownups
  const pages = {};
  function page(id, p){ pages[id] = Object.assign({ host: null, ctrl: null }, p); }
  const homeView = document.getElementById("homeView");
  const sectionView = document.getElementById("sectionView");
  const appViews = document.getElementById("appViews");
  let current = null; // { section, app } of what's on screen

  function renderHome(){
    document.getElementById("homeName").textContent = store.name || "there";
    if (window.Daily) Daily.renderHome(document.getElementById("dailyCard"));
    // jump back in: the last few apps opened
    const recent = (store.recent || []).map(id => apps.find(a => a.id === id)).filter(Boolean).slice(0, 6);
    document.getElementById("recentRow").hidden = !recent.length;
    const rl = document.getElementById("recentList"); rl.innerHTML = "";
    recent.forEach(a => rl.appendChild(appCard(a, true)));
    renderSearch();
    Object.keys(SECTIONS).forEach(id => {
      const n = appsIn(id).length, noun = SECTIONS[id].noun[n === 1 ? 0 : 1];
      document.getElementById(id + "Count").textContent = `${n} ${noun}`;
    });
  }

  function appCard(a, small){
    const card = document.createElement("a");
    card.className = "app-card" + (small ? " small" : "");
    card.href = `#/${a.section}/${a.id}`;
    card.innerHTML = `<span class="app-icon"></span><span class="app-title"></span><span class="app-blurb"></span><span class="app-stat mono"></span>`;
    card.querySelector(".app-icon").textContent = a.icon;
    card.querySelector(".app-title").textContent = a.title;
    card.querySelector(".app-blurb").textContent = small ? "" : a.blurb;
    card.querySelector(".app-stat").textContent = a.stat ? a.stat() : "";
    return card;
  }
  // the home screen's search: titles and blurbs of every app
  function renderSearch(){
    const q = document.getElementById("appSearch").value.trim().toLowerCase(), out = document.getElementById("searchResults");
    out.innerHTML = "";
    out.hidden = !q;
    if (!q) return;
    const hits = apps.filter(a => (a.title + " " + a.blurb).toLowerCase().includes(q));
    if (!hits.length) { const p = document.createElement("p"); p.className = "search-none"; p.textContent = "Nothing found. Try another word!"; out.appendChild(p); }
    hits.forEach(a => out.appendChild(appCard(a)));
  }

  function renderSection(id){
    const sec = SECTIONS[id];
    document.getElementById("sectionTitle").textContent = `${sec.icon} ${sec.title}`;
    document.getElementById("sectionBlurb").textContent = sec.blurb;
    const grid = document.getElementById("appGrid");
    grid.innerHTML = "";
    if (id === "games") {
      const listed = new Set(CATEGORIES.flatMap(c => c.ids));
      const groups = CATEGORIES.map(c => ({ title: c.title, list: c.ids.map(x => apps.find(a => a.id === x)).filter(Boolean) }));
      groups.push({ title: "✨ More games", list: appsIn(id).filter(a => !listed.has(a.id)) });
      groups.filter(g => g.list.length).forEach(g => {
        const h = document.createElement("h2"); h.className = "cat-head"; h.textContent = g.title; grid.appendChild(h);
        g.list.forEach(a => grid.appendChild(appCard(a)));
      });
    } else appsIn(id).forEach(a => grid.appendChild(appCard(a)));
    // this section's trophy shelf
    const badges = appsIn(id).flatMap(a => a.badges);
    const shelf = document.getElementById("trophySection");
    shelf.hidden = !badges.length;
    const trophyGrid = document.getElementById("trophyGrid");
    trophyGrid.innerHTML = "";
    let earned = 0;
    badges.forEach(b => {
      const got = !!store.badges[b.id];
      if (got) earned++;
      const el = document.createElement("div");
      el.className = "badge " + (got ? "earned" : "locked");
      el.innerHTML = `<span class="icon">${b.icon}</span><span class="name"></span><span class="desc"></span>`;
      el.querySelector(".name").textContent = b.name;
      el.querySelector(".desc").textContent = b.desc;
      trophyGrid.appendChild(el);
    });
    document.getElementById("trophyCount").textContent = `${earned} / ${badges.length}`;
  }

  function show(next){
    if (current && current.app && current.app !== next.app) current.app.ctrl.close();
    if (current && current.page && current.page !== next.page && current.page.ctrl) current.page.ctrl.close();
    current = next;
    homeView.hidden = !!(next.section || next.app || next.page);
    sectionView.hidden = !next.section || !!next.app;
    Object.values(pages).forEach(p => { if (p.host) p.host.hidden = p !== next.page; });
    if (next.page) {
      const p = next.page;
      if (!p.host) { p.host = document.createElement("div"); p.host.className = "app-view"; appViews.appendChild(p.host); p.ctrl = p.mount(p.host); }
      p.host.hidden = false;
      document.title = `${p.title} · Learn & Play`;
      p.ctrl.open();
      window.scrollTo(0, 0);
      return;
    }
    apps.forEach(a => { if (a.host) a.host.hidden = a !== next.app; });
    if (next.app) {
      const a = next.app;
      if (!a.host) {
        a.host = document.createElement("div");
        a.host.className = "app-view";
        a.host.id = "app-" + a.id;
        appViews.appendChild(a.host);
        a.ctrl = a.mount(a.host);
      }
      a.host.hidden = false;
      document.title = `${a.title} · Learn & Play`;
      // remember it for "Jump back in" and for today's challenges
      store.recent = [a.id, ...(store.recent || []).filter(x => x !== a.id)].slice(0, 8);
      const d = new Date(), day = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      if (!store.playedDay || store.playedDay.day !== day) store.playedDay = { day, ids: [] };
      if (!store.playedDay.ids.includes(a.id)) store.playedDay.ids.push(a.id);
      saveStore();
      a.ctrl.open();
      if (window.Daily) Daily.check();
    } else if (next.section) {
      renderSection(next.section);
      document.title = `${SECTIONS[next.section].title} · Learn & Play`;
    } else {
      renderHome();
      document.title = "Learn & Play";
    }
    window.scrollTo(0, 0);
  }

  function route(){
    const [section, appId] = location.hash.replace(/^#\/?/, "").split("/");
    const app = apps.find(a => a.section === section && a.id === appId);
    if (pages[section]) show({ section: null, app: null, page: pages[section] });
    else if (app) show({ section, app });
    else if (SECTIONS[section]) show({ section, app: null });
    else show({ section: null, app: null });
  }

  // leave the open app and go back to its section's list
  function leave(){
    location.hash = current && current.section ? "#/" + current.section : "#/";
  }

  // the name lives on the home screen; apps read store.name
  const kidName = document.getElementById("kidName");
  kidName.value = store.name || "";
  kidName.addEventListener("input", () => {
    store.name = kidName.value.trim();
    saveStore();
    document.getElementById("homeName").textContent = store.name || "there";
  });

  document.getElementById("appSearch").addEventListener("input", renderSearch);

  window.addEventListener("hashchange", route);
  // the app scripts load after this one, so wait for all of them before showing anything
  window.addEventListener("DOMContentLoaded", () => {
    checkBadges();
    route();
  });

  // what the Grown-ups page needs to know about the apps and the trophies
  const appList = () => apps.map(a => ({ id: a.id, section: a.section, title: a.title, icon: a.icon, stat: a.stat ? a.stat() : "", badges: a.badges.length, earned: a.badges.filter(b => store.badges[b.id]).length }));
  const toast = (icon, line1, line2) => showToast({ icon, name: line2 }, line1);
  window.Hub = { store, saveStore, formatTime, confettiBurst, checkBadges, register, leave, page, appList, toast, STORE_KEY };
})();
