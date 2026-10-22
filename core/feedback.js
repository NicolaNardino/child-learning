/* Feedback: a 💬 button in every game's top bar for play-testing. Tap it when something is too hard, boring,
   broken or a great idea; pick what it was, add a few words if you like, and it's kept for the grown-ups.
   Notes are saved on this device in localStorage "lp:feedback" (the newest 200), with the game, the player and
   the time, and listed on the Grown-ups page, where they can be copied all at once.
     Feedback.all()     the notes, oldest first: [{ t, app, title, icon, kind, text, who }]
     Feedback.asText()  the notes as plain text, ready to paste into a message
     Feedback.clear()   forget them all */
(function(){
  "use strict";
  const KEY = "lp:feedback";
  const KINDS = [["hard", "😣 Too hard"], ["boring", "😴 Boring"], ["bug", "🐞 Broken or stuck"], ["idea", "💡 Idea"], ["love", "⭐ Love it"]];
  const all = () => { try { const a = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  const put = list => { try { localStorage.setItem(KEY, JSON.stringify(list.slice(-200))); } catch (e) {} };
  const label = id => (KINDS.find(k => k[0] === id) || ["", id])[1];
  function asText(){
    return all().map(n => `${new Date(n.t).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · ${n.title} · ${label(n.kind)}${n.text ? ": " + n.text : ""}${n.who ? " (" + n.who + ")" : ""}`).join("\n");
  }

  // the little window: one tap on what it was, then Save
  const box = document.createElement("div");
  box.className = "fb-modal"; box.hidden = true;
  box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", "Tell the grown-ups");
  box.innerHTML = `<div class="fb-card">
      <h2>💬 How is <span class="fb-game"></span>?</h2>
      <div class="fb-kinds" role="group" aria-label="What was it?">${KINDS.map(([id, t]) => `<button type="button" class="fb-kind" data-kind="${id}" aria-pressed="false">${t}</button>`).join("")}</div>
      <textarea class="fb-text" rows="3" maxlength="300" placeholder="What happened? (you can skip this)" aria-label="What happened?"></textarea>
      <div class="fb-row"><button type="button" class="btn ghost small fb-cancel">Cancel</button><button type="button" class="btn small fb-save" disabled>Save</button></div>
    </div>`;
  document.body.appendChild(box);
  const text = box.querySelector(".fb-text"), save = box.querySelector(".fb-save");
  let app = null, kind = null;
  // keys typed here must not drive the game underneath (arrows, Space, Escape...)
  ["keydown", "keyup"].forEach(ev => box.addEventListener(ev, e => { e.stopPropagation(); if (ev === "keydown" && e.key === "Escape") close(); }));
  function openBox(a){
    app = a; kind = null; text.value = ""; save.disabled = true;
    box.querySelector(".fb-game").textContent = a.title;
    box.querySelectorAll(".fb-kind").forEach(b => b.setAttribute("aria-pressed", "false"));
    box.hidden = false; box.querySelector(".fb-kind").focus();
  }
  function close(){ box.hidden = true; }
  box.addEventListener("click", e => {
    if (e.target === box || e.target.closest(".fb-cancel")) return close();
    const k = e.target.closest(".fb-kind");
    if (k) { kind = k.dataset.kind; box.querySelectorAll(".fb-kind").forEach(b => b.setAttribute("aria-pressed", String(b === k))); save.disabled = false; return; }
    if (e.target.closest(".fb-save") && kind) {
      const me = Hub.Profiles.active();
      put(all().concat([{ t: Date.now(), app: app.id, title: app.title, icon: app.icon, kind, text: text.value.trim().slice(0, 300), who: (me && me.name) || "" }]));
      close(); Hub.toast("💬", "Thanks!", "Saved for the grown-ups");
    }
  });

  // put the button in the top bar of every game when it opens
  document.addEventListener("hub:open", e => {
    const a = e.detail, hud = a.host.querySelector(".game-hud");
    if (!hud || hud.querySelector(".fb-btn")) return;
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn ghost small fb-btn"; b.textContent = "💬"; b.setAttribute("aria-label", "Tell the grown-ups how this game is going");
    b.addEventListener("click", () => openBox(a));
    hud.insertBefore(b, hud.lastElementChild);
  });

  window.Feedback = { all, asText, clear(){ put([]); } };
})();
