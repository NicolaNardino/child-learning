/* Rainbow Beats: a rhythm game. Rainbow notes fall down four lanes; hit each one just as it reaches the
   line (D F J K, the arrow keys, or tap the lane) and it plays its note, so you play the song yourself.
   Perfect and Good hits build a combo, which multiplies the points. Every song ends with 1 to 3 stars.
   The tunes are old children's songs and classics, played by a little Web Audio synth. */
(function(){
  "use strict";
  const store = Hub.store;

  // a melody is "note:beats" pairs, like "C4:1 D4:0.5"; rests are "-:beats"
  const SONGS = [
    { id: "entchen", icon: "🦆", title: "Alle meine Entchen", level: "Easy", bpm: 100, fall: 1.9,
      tune: "C4:1 D4:1 E4:1 F4:1 G4:2 G4:2 A4:1 A4:1 A4:1 A4:1 G4:4 A4:1 A4:1 A4:1 A4:1 G4:4 F4:1 F4:1 F4:1 F4:1 E4:2 E4:2 D4:1 D4:1 D4:1 D4:1 C4:4" },
    { id: "twinkle", icon: "⭐", title: "Twinkle Twinkle Little Star", level: "Easy", bpm: 104, fall: 1.9,
      tune: "C4:1 C4:1 G4:1 G4:1 A4:1 A4:1 G4:2 F4:1 F4:1 E4:1 E4:1 D4:1 D4:1 C4:2 G4:1 G4:1 F4:1 F4:1 E4:1 E4:1 D4:2 G4:1 G4:1 F4:1 F4:1 E4:1 E4:1 D4:2 C4:1 C4:1 G4:1 G4:1 A4:1 A4:1 G4:2 F4:1 F4:1 E4:1 E4:1 D4:1 D4:1 C4:2" },
    { id: "jacques", icon: "🥐", title: "Frère Jacques", level: "Medium", bpm: 112, fall: 1.6,
      tune: "C4:1 D4:1 E4:1 C4:1 C4:1 D4:1 E4:1 C4:1 E4:1 F4:1 G4:2 E4:1 F4:1 G4:2 G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4:1 C4:1 G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4:1 C4:1 C4:1 G3:1 C4:2 C4:1 G3:1 C4:2" },
    { id: "joy", icon: "🎻", title: "Ode to Joy", level: "Medium", bpm: 120, fall: 1.5,
      tune: "E4:1 E4:1 F4:1 G4:1 G4:1 F4:1 E4:1 D4:1 C4:1 C4:1 D4:1 E4:1 E4:1.5 D4:0.5 D4:2 E4:1 E4:1 F4:1 G4:1 G4:1 F4:1 E4:1 D4:1 C4:1 C4:1 D4:1 E4:1 D4:1.5 C4:0.5 C4:2" },
    { id: "jingle", icon: "🔔", title: "Jingle Bells", level: "Hard", bpm: 150, fall: 1.25,
      tune: "E4:1 E4:1 E4:2 E4:1 E4:1 E4:2 E4:1 G4:1 C4:1.5 D4:0.5 E4:4 F4:1 F4:1 F4:1.5 F4:0.5 F4:1 E4:1 E4:1 E4:0.5 E4:0.5 E4:1 D4:1 D4:1 E4:1 D4:2 G4:2 E4:1 E4:1 E4:2 E4:1 E4:1 E4:2 E4:1 G4:1 C4:1.5 D4:0.5 E4:4 F4:1 F4:1 F4:1 F4:1 F4:1 E4:1 E4:1 E4:0.5 E4:0.5 G4:1 G4:1 F4:1 D4:1 C4:4" }
  ];
  const LANES = ["#ff4d6d", "#ffd84d", "#4dd96b", "#4db8ff"];
  const KEYS = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3, ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3 };
  const PERFECT = 0.08, GOOD = 0.16;         // seconds either side of the beat
  const LEAD = 2;                            // seconds before the first note
  const best = id => (store.beats && store.beats[id]) || { score: 0, stars: 0 };

  Hub.register({
    id: "beats", section: "games", title: "Rainbow Beats", icon: "🎹",
    blurb: "Hit the rainbow notes on the beat and play the song yourself!",
    stat: () => { const n = SONGS.reduce((s, x) => s + best(x.id).stars, 0); return n ? `⭐ ${n}/${SONGS.length * 3}` : ""; },
    badges: [
      { id: "beats1", icon: "🎵", name: "First Song", desc: "Finish a song in Rainbow Beats", test: () => SONGS.some(s => best(s.id).stars > 0) },
      { id: "beats3", icon: "🎸", name: "Rock Star", desc: "Get 3 stars on a song in Rainbow Beats", test: () => SONGS.some(s => best(s.id).stars >= 3) },
      { id: "beatsAll", icon: "🎼", name: "Music Legend", desc: "Get 3 stars on every song in Rainbow Beats", test: () => SONGS.every(s => best(s.id).stars >= 3) }
    ],
    mount
  });

  /* ---------------- a tiny synth ---------------- */
  let ac = null;
  function audio(){
    if (store.sound === false) return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ac) ac = new AC();
    if (ac.state === "suspended") ac.resume();
    return ac;
  }
  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const freq = n => 440 * Math.pow(2, (SEMI[n[0]] + (n.includes("#") ? 1 : 0) + 12 * (+n.slice(-1) + 1) - 69) / 12);
  // a soft bell-like piano note
  function play(note, dur){
    const a = audio(); if (!a) return;
    const t = a.currentTime, f = freq(note);
    [[1, 0.22, "triangle"], [2, 0.06, "sine"]].forEach(([mul, vol, type]) => {
      const o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.value = f * mul;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.3, dur) + 0.3);
      o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.7);
    });
  }
  // the beat underneath: a soft kick on every beat
  function kick(){
    const a = audio(); if (!a) return;
    const t = a.currentTime, o = a.createOscillator(), g = a.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.2);
  }

  // turn a tune into notes with a time and a lane: higher notes go further right
  function chart(song){
    const beat = 60 / song.bpm, notes = [];
    let t = LEAD;
    song.tune.split(/\s+/).forEach(p => {
      const [n, b] = p.split(":"), len = +b * beat;
      if (n !== "-") notes.push({ note: n, t, len, hit: null });
      t += len;
    });
    const pitches = [...new Set(notes.map(n => freq(n.note)))].sort((a, b) => a - b);
    notes.forEach(n => { n.lane = Math.min(3, Math.floor(pitches.indexOf(freq(n.note)) * 4 / pitches.length)); });
    return { notes, end: t + 1.5, beat };
  }

  function mount(host){
    host.innerHTML = `
    <section class="game-screen" id="btOverlay" hidden aria-label="Rainbow Beats">
      <div class="game-box bt-box">
        <div class="game-hud">
          <h2>🎹 Rainbow Beats</h2>
          <span class="mono game-stat" id="btScore">0</span>
          <span class="mono game-stat" id="btCombo">🔥 0</span>
          <button class="btn ghost small" id="btCloseBtn" type="button">✕ Exit</button>
        </div>
        <div class="game-stage">
          <canvas id="btCanvas" width="960" height="540"></canvas>
          <div class="game-panel bt-panel" id="btPanel">
            <div class="game-panel-title" id="btPanelTitle">🎹 Rainbow Beats</div>
            <div class="game-panel-text" id="btPanelText"></div>
            <div class="bt-songs" id="btSongs"></div>
          </div>
        </div>
        <div class="game-help">Press D F J K (or ← ↓ ↑ →) when a note reaches the line · or tap the lanes</div>
      </div>
    </section>`;

    const $ = id => document.getElementById(id);
    const overlay = $("btOverlay"), canvas = $("btCanvas"), ctx = canvas.getContext("2d");
    const panel = $("btPanel"), panelTitle = $("btPanelTitle"), panelText = $("btPanelText"), songsEl = $("btSongs");
    const W = 960, H = 540, LINE = 450, LW = 120, LX = W / 2 - LW * 2;
    const fx = Fun.pops();

    let isOpen = false, running = false, last = 0, clock = 0;
    let song = null, map = null, t = 0, nextBeat = 0, score = 0, combo = 0, maxCombo = 0, counts = null;
    let press = [0, 0, 0, 0], judge = null;   // how lit each lane's key is, and the last "PERFECT!"

    function showSongs(){
      songsEl.innerHTML = SONGS.map((s, i) => {
        const b = best(s.id);
        return `<button class="btn${i ? " ghost" : ""} bt-song" type="button" data-song="${i}">${s.icon} ${s.title} <small>${s.level} · ${"⭐".repeat(b.stars) + "☆".repeat(3 - b.stars)}</small></button>`;
      }).join("");
      panel.hidden = false;
      songsEl.querySelector("button").focus();
    }
    songsEl.addEventListener("click", e => { const b = e.target.closest("[data-song]"); if (b) start(SONGS[+b.dataset.song]); });

    function start(s){
      song = s; map = chart(s);
      t = -0.3; nextBeat = LEAD % map.beat; score = 0; combo = 0; maxCombo = 0; counts = { perfect: 0, good: 0, miss: 0 };
      judge = null; fx.clear();
      running = true; panel.hidden = true;
      audio();   // wake up the sound while we still have the click
      canvas.focus();
    }
    function finish(){
      running = false;
      const total = map.notes.length, acc = (counts.perfect + counts.good * 0.6) / total;
      const stars = acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : acc >= 0.4 ? 1 : 0;
      store.beats = store.beats || {};
      const was = best(song.id), newBest = score > was.score;
      store.beats[song.id] = { score: Math.max(was.score, score), stars: Math.max(was.stars, stars) };
      Hub.saveStore(); Hub.checkBadges();
      panelTitle.textContent = stars ? `${"⭐".repeat(stars)} ${song.title}` : `${song.icon} Nice try!`;
      panelText.textContent = `Score ${score} · 🎯 ${counts.perfect} perfect, ${counts.good} good, ${counts.miss} missed · best combo ${maxCombo}.`
        + (newBest ? " New best! 🎉" : "") + (stars < 3 ? " Hit 90% of the notes for 3 stars!" : " You're a star! 🌟");
      showSongs();
      if (stars === 3) Hub.confettiBurst(songsEl);
    }

    /* ----- hitting notes ----- */
    function hitLane(lane){
      if (!running) return;
      press[lane] = 1;
      // the closest note in this lane that hasn't been played yet
      let n = null;
      for (const m of map.notes) if (m.lane === lane && !m.hit && Math.abs(m.t - t) <= GOOD && (!n || Math.abs(m.t - t) < Math.abs(n.t - t))) n = m;
      const x = LX + lane * LW + LW / 2;
      if (!n) { Fun.sfx.nope(); return; }
      const off = Math.abs(n.t - t), perfect = off <= PERFECT;
      n.hit = perfect ? "perfect" : "good";
      counts[n.hit]++; combo++; maxCombo = Math.max(maxCombo, combo);
      score += (perfect ? 100 : 50) * (1 + Math.floor(combo / 10));
      play(n.note, n.len);
      judge = { text: perfect ? "PERFECT!" : "GOOD", colour: perfect ? "#ffe14d" : "#7df9ff", t: 0 };
      fx.burst(x, LINE, LANES[lane], perfect ? 18 : 10, 180);
      if (combo % 10 === 0) fx.pop(`🔥 ${combo} COMBO!`, W / 2, 120, "#ff9f1c", 36);
    }
    function miss(n){
      n.hit = "miss"; counts.miss++; combo = 0;
      judge = { text: "MISS", colour: "#ff6b6b", t: 0 };
    }

    /* ----- drawing ----- */
    function draw(dt){
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#160b33"); g.addColorStop(1, "#2a0f45");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // speakers pumping on the beat, on both sides
      const pump = running ? Math.max(0, 1 - ((t - LEAD) % map.beat + map.beat) % map.beat / map.beat * 3) : 0;
      [110, W - 110].forEach(x => {
        ctx.fillStyle = "#2b2140"; ctx.fillRect(x - 70, 120, 140, 300);
        [[200, 46], [340, 30]].forEach(([y, r]) => { ctx.fillStyle = "#120a22"; ctx.beginPath(); ctx.arc(x, y, r * (1 + pump * 0.12), 0, 7); ctx.fill(); ctx.strokeStyle = LANES[(Math.floor(clock * 2) + (y > 300 ? 2 : 0)) % 4]; ctx.lineWidth = 4; ctx.stroke(); });
      });
      // the lanes
      for (let i = 0; i < 4; i++) {
        const x = LX + i * LW;
        ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.09)"; ctx.fillRect(x, 0, LW, H);
        const lit = press[i]; press[i] = Math.max(0, lit - dt * 5);
        if (lit > 0) { const lg = ctx.createLinearGradient(0, LINE, 0, 0); lg.addColorStop(0, LANES[i] + "88"); lg.addColorStop(1, LANES[i] + "00"); ctx.fillStyle = lg; ctx.globalAlpha = lit; ctx.fillRect(x, 0, LW, LINE); ctx.globalAlpha = 1; }
      }
      // the hit line and the four keys
      ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.fillRect(LX, LINE - 2, LW * 4, 4);
      ["D", "F", "J", "K"].forEach((k, i) => {
        const x = LX + i * LW + LW / 2;
        ctx.fillStyle = press[i] > 0 ? LANES[i] : "#2b2140"; ctx.strokeStyle = LANES[i]; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(x, LINE, 34, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = "800 20px 'Bricolage Grotesque', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(k, x, LINE + 1);
      });
      // the notes falling towards the line
      if (map) map.notes.forEach(n => {
        if (n.hit === "perfect" || n.hit === "good") return;
        const y = LINE - (n.t - t) / song.fall * LINE;
        if (y < -40 || y > H + 40) return;
        const x = LX + n.lane * LW + LW / 2;
        ctx.globalAlpha = n.hit === "miss" ? 0.3 : 1;
        ctx.fillStyle = LANES[n.lane]; ctx.beginPath(); ctx.ellipse(x, y, 40, 18, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.beginPath(); ctx.ellipse(x - 10, y - 6, 16, 5, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#1a1030"; ctx.font = "700 14px system-ui"; ctx.fillText(n.note.replace(/\d/, ""), x, y + 2);
        ctx.globalAlpha = 1;
      });
      // PERFECT / GOOD / MISS, the progress through the song
      if (judge) {
        judge.t += dt;
        if (judge.t > 0.6) judge = null;
        else { const s = 1 + Math.max(0, 0.15 - judge.t) * 3; ctx.save(); ctx.translate(W / 2, 230); ctx.scale(s, s); ctx.font = "900 40px 'Bricolage Grotesque', sans-serif"; ctx.lineWidth = 6; ctx.strokeStyle = "#1a1030"; ctx.strokeText(judge.text, 0, 0); ctx.fillStyle = judge.colour; ctx.fillText(judge.text, 0, 0); ctx.restore(); }
      }
      if (running) {
        ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.fillRect(LX, 10, LW * 4, 8);
        ctx.fillStyle = LANES[Math.floor(clock * 3) % 4]; ctx.fillRect(LX, 10, LW * 4 * Math.min(1, Math.max(0, t / map.end)), 8);
        ctx.fillStyle = "#fff"; ctx.font = "700 15px system-ui"; ctx.textAlign = "center"; ctx.fillText(`${song.icon} ${song.title}`, W / 2, 34);
      }
      fx.draw(ctx, dt);
    }

    function loop(now){
      if (!isOpen) return;
      const dt = Fun.dt(now, last, 0.05); last = now; clock += dt;
      if (running) {
        t += dt;
        while (t >= nextBeat) { if (nextBeat >= LEAD - 0.01 && nextBeat < map.end - 1.5) kick(); nextBeat += map.beat; }
        map.notes.forEach(n => { if (!n.hit && t - n.t > GOOD) miss(n); });
        if (t >= map.end) finish();
      }
      draw(dt);
      $("btScore").textContent = "🎵 " + score;
      $("btCombo").textContent = "🔥 " + combo;
      requestAnimationFrame(loop);
    }

    window.addEventListener("keydown", e => {
      if (!isOpen) return;
      if (e.key === "Escape") { Hub.leave(); return; }
      const lane = KEYS[e.code];
      if (lane === undefined || !running) return;
      e.preventDefault();
      if (!e.repeat) hitLane(lane);
    });
    canvas.addEventListener("pointerdown", e => {
      const r = canvas.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width;
      const lane = Math.floor((x - LX) / LW);
      if (lane >= 0 && lane < 4) { e.preventDefault(); hitLane(lane); }
    });
    canvas.tabIndex = 0;

    function openGame(){
      isOpen = true; running = false; map = null;
      Fun.screen(overlay, true);
      panelTitle.textContent = "🎹 Rainbow Beats";
      panelText.textContent = "Rainbow notes fall down the four lanes. Press D F J K (or tap the lane) just as a note reaches the line, and it plays! Hit them all on time and you play the whole song. Pick a song:";
      showSongs();
      last = performance.now(); requestAnimationFrame(loop);
    }
    function closeGame(){ isOpen = false; running = false; Fun.screen(overlay, false); }

    $("btCloseBtn").addEventListener("click", () => Hub.leave());
    Fun.soundButton($("btCloseBtn"));
    return { open: openGame, close: closeGame };
  }
})();
