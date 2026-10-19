/* Grown-ups: a page at #/grownups for parents, with two things.
   1. A progress report: how much was practised the last 7 days, and for every subject how accurate the answers
      are in each topic, so you can see at a glance what needs more practice.
   2. A backup: progress only lives in this browser, so here you can copy a "progress code" (or save it as a file)
      and paste it on another phone, tablet or computer to carry everything over.
   Nothing leaves the device unless you copy the code yourself. */
(function(){
  "use strict";
  const store = Hub.store;

  /* ---------------- the backup code: the saved progress, squashed and written in letters ---------------- */
  const b64 = bytes => { let s = ""; bytes.forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
  const unb64 = t => { const s = atob(t.replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(s, c => c.charCodeAt(0)); };
  async function pipe(bytes, stream){
    const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await out.arrayBuffer());
  }
  async function makeCode(){
    const raw = new TextEncoder().encode(JSON.stringify(store));
    if (typeof CompressionStream === "function") return "LP2-" + b64(await pipe(raw, new CompressionStream("gzip")));
    return "LP1-" + b64(raw);
  }
  async function readCode(text){
    const t = text.replace(/\s+/g, "");
    const m = /^(LP[12])-([A-Za-z0-9_-]+)$/.exec(t);
    if (!m) throw new Error("That doesn't look like a progress code.");
    let bytes = unb64(m[2]);
    if (m[1] === "LP2") {
      if (typeof DecompressionStream !== "function") throw new Error("This browser can't open that code. Try a newer one.");
      bytes = await pipe(bytes, new DecompressionStream("gzip"));
    }
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("That code is damaged.");
    return data;
  }

  /* ---------------- the report ---------------- */
  const dayKey = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  function lastDays(n){
    const out = [];
    for (let i = n - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); out.push({ key: dayKey(d), label: d.toLocaleDateString("en-GB", { weekday: "short" }) }); }
    return out;
  }
  const pct = (c, a) => a ? Math.round(c / a * 100) : null;
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const tone = p => p === null ? "none" : p >= 85 ? "great" : p >= 65 ? "ok" : "low";

  function report(){
    const subjects = (window.Notebook && Notebook.subjects) || [];
    const days = lastDays(7);
    const perDay = days.map(d => {
      let a = 0, c = 0;
      subjects.forEach(s => { const e = s.data.log && s.data.log[d.key]; if (e) { a += e.a; c += e.c; } });
      const t = store.typing && store.typing.log && store.typing.log[d.key];
      return { ...d, a, c, lessons: t ? t.a : 0 };
    });
    const week = perDay.reduce((n, d) => n + d.a, 0), weekRight = perDay.reduce((n, d) => n + d.c, 0);
    const lessonsWeek = perDay.reduce((n, d) => n + d.lessons, 0), activeDays = perDay.filter(d => d.a || d.lessons).length;
    const max = Math.max(5, ...perDay.map(d => d.a + d.lessons * 5));
    const apps = Hub.appList();
    const trophies = apps.reduce((n, a) => n + a.earned, 0), trophiesAll = apps.reduce((n, a) => n + a.badges, 0);

    let html = `<section class="gu-card">
      <h2>This week</h2>
      <div class="gu-summary">
        <div><b>${activeDays}</b><span>of 7 days practised</span></div>
        <div><b>${week}</b><span>questions answered</span></div>
        <div><b>${pct(weekRight, week) === null ? "-" : pct(weekRight, week) + "%"}</b><span>answered right</span></div>
        <div><b>${lessonsWeek}</b><span>typing lessons</span></div>
      </div>
      <div class="gu-days">${perDay.map(d => `<div class="gu-day"><div class="gu-bar" style="height:${Math.round((d.a + d.lessons * 5) / max * 100)}%" title="${d.a} questions, ${d.lessons} typing lessons"></div><span>${d.label}</span></div>`).join("")}</div>
      <p class="gu-note">Counted from today on. Older practice shows up in the totals below.</p>
    </section>`;

    subjects.forEach(s => {
      const d = s.data;
      let tA = 0, tC = 0;
      const rows = s.topics.map(t => {
        const e = d.topics && d.topics[t.id] || { attempted: 0, correct: 0 };
        tA += e.attempted; tC += e.correct;
        const p = pct(e.correct, e.attempted), low = p !== null && p < 65 && e.attempted >= 5;
        return `<div class="gu-topic"><span class="gu-tname">${esc(t.icon || "")} ${esc(t.label)}</span>
          <span class="gu-meter ${tone(p)}"><i style="width:${p === null ? 0 : p}%"></i></span>
          <span class="gu-pct">${p === null ? "not tried" : p + "%"}</span>
          <span class="gu-flag">${low ? "needs practice" : e.attempted >= 5 && p >= 85 ? "strong" : ""}</span></div>`;
      }).join("");
      const best = d.best || 0, races = d.racesWon || 0, trials = Object.keys(d.trialBest || {}).length;
      html += `<section class="gu-card">
        <h2>${esc(s.icon)} ${esc(s.title)} <small>${tA ? tA + " questions · " + pct(tC, tA) + "% right" : "not started"}</small></h2>
        ${rows}
        <p class="gu-note">Best streak ${best} · races won ${races} · time trials tried ${trials}</p>
      </section>`;
    });

    const T = store.typing;
    if (T) {
      const best = T.best || {}, passed = Object.keys(best).length, stars = Object.values(best).reduce((n, b) => n + (b.stars || 0), 0);
      html += `<section class="gu-card">
        <h2>⌨️ Tipp-Meister <small>${passed ? passed + " of 80 lessons passed" : "not started"}</small></h2>
        <div class="gu-topic"><span class="gu-tname">Lessons passed</span><span class="gu-meter ok"><i style="width:${Math.round(passed / 80 * 100)}%"></i></span><span class="gu-pct">${passed}/80</span><span class="gu-flag"></span></div>
        <p class="gu-note">${stars} stars · fastest ${T.topApm || 0} strokes a minute${T.roboWins ? " · beat Robo " + T.roboWins + " times" : ""}</p>
      </section>`;
    }

    const learn = apps.filter(a => a.section === "learning" && a.stat && !(window.Notebook && Notebook.subjects.some(s => s.id === a.id)) && a.id !== "typing");
    const games = apps.filter(a => a.section === "games" && a.stat);
    const lines = [...learn, ...games];
    html += `<section class="gu-card">
      <h2>🏆 Games and trophies <small>${trophies} of ${trophiesAll} trophies</small></h2>
      ${lines.length ? `<ul class="gu-list">${lines.map(a => `<li><span>${esc(a.icon)} ${esc(a.title)}</span><b>${esc(a.stat)}</b></li>`).join("")}</ul>` : `<p class="gu-note">No scores yet.</p>`}
    </section>`;
    return html;
  }

  /* ---------------- the page ---------------- */
  Hub.page("grownups", {
    title: "Grown-ups",
    mount(host){
      host.innerHTML = `
      <div class="wrap gu">
        <header class="hub-head">
          <a class="back-link" href="#/">← Home</a>
          <h1>👪 Grown-ups</h1>
          <p class="tagline">How practice is going, and a way to take progress to another device.</p>
        </header>
        <div id="guReport"></div>
        <section class="gu-card" id="guBackup">
          <h2>💾 Back up or move progress</h2>
          <p class="gu-note">Progress is saved in this browser only. If the browser is cleared, or you switch to a new phone, it would be lost. Copy the progress code below, keep it somewhere safe, and paste it on the other device to bring everything back.</p>
          <div class="gu-row">
            <button class="btn" id="guMake" type="button">1. Make my progress code</button>
          </div>
          <textarea id="guCode" class="gu-code" rows="4" readonly placeholder="Your progress code will show up here" aria-label="Progress code"></textarea>
          <div class="gu-row">
            <button class="btn ghost" id="guCopy" type="button" disabled>📋 Copy</button>
            <button class="btn ghost" id="guSave" type="button" disabled>⬇ Save as a file</button>
            <span class="gu-msg" id="guMsg1" aria-live="polite"></span>
          </div>
          <hr>
          <h3>Bring progress back</h3>
          <textarea id="guPaste" class="gu-code" rows="3" placeholder="Paste a progress code here, or choose a saved file" aria-label="Paste a progress code"></textarea>
          <div class="gu-row">
            <button class="btn" id="guRestore" type="button">Restore from this code</button>
            <label class="btn ghost gu-file">📂 Choose a saved file<input id="guFile" type="file" accept=".txt,.lpcode,text/plain" hidden></label>
            <span class="gu-msg" id="guMsg2" aria-live="polite"></span>
          </div>
          <p class="gu-note">Restoring replaces the progress on this device with the progress in the code.</p>
        </section>
      </div>`;
      const $ = id => host.querySelector("#" + id);
      let code = "";
      $("guMake").addEventListener("click", async () => {
        try {
          code = await makeCode();
          $("guCode").value = code; $("guCopy").disabled = false; $("guSave").disabled = false;
          $("guMsg1").textContent = `Done: ${code.length.toLocaleString("en")} characters`;
          $("guCode").focus(); $("guCode").select();
        } catch (e) { $("guMsg1").textContent = "Sorry, that didn't work: " + e.message; }
      });
      $("guCopy").addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(code); $("guMsg1").textContent = "Copied!"; }
        catch (e) { $("guCode").select(); document.execCommand && document.execCommand("copy"); $("guMsg1").textContent = "Copied (or select it and copy by hand)"; }
      });
      $("guSave").addEventListener("click", () => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([code], { type: "text/plain" }));
        a.download = "learn-and-play-" + dayKey(new Date()) + ".lpcode";
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        $("guMsg1").textContent = "Saved";
      });
      $("guFile").addEventListener("change", async e => {
        const f = e.target.files[0]; if (!f) return;
        $("guPaste").value = (await f.text()).trim(); $("guMsg2").textContent = "File loaded. Now tap Restore."; e.target.value = "";
      });
      $("guRestore").addEventListener("click", async () => {
        try {
          const data = await readCode($("guPaste").value);
          const names = Object.keys(data).length;
          if (!confirm(`Replace the progress on this device with the progress in this code (${names} saved things)?`)) return;
          localStorage.setItem(Hub.STORE_KEY, JSON.stringify(data));
          $("guMsg2").textContent = "Restored! Loading...";
          setTimeout(() => { location.hash = "#/"; location.reload(); }, 600);
        } catch (e) { $("guMsg2").textContent = e.message || "That didn't work."; }
      });
      return {
        open(){ $("guReport").innerHTML = report(); },
        close(){}
      };
    }
  });
})();
