/* Musik Maestro: Musik für die 5. Klasse (Lehrplan 21, Zyklus 2). Noten lesen im Violinschlüssel
   (mit h, wie in der Schweiz), Notenwerte und Pausen, Takt, Instrumente, Musikwörter und ein Hör-Quiz.
   Noten werden als kleine Bilder (SVG) gezeichnet, und Töne spielt der Browser selbst (Web Audio). */
(function(){
  "use strict";
  const { pick, sample, choice, shuffle } = Notebook;

  /* ---------------- Töne abspielen ---------------- */
  let audio = null;
  const hz = midi => 440 * Math.pow(2, (midi - 69) / 12);
  // notes: [[midi, start in seconds, length, volume]]
  function play(notes){
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audio) audio = new AC();
    if (audio.state === "suspended") audio.resume();
    const t0 = audio.currentTime + 0.05;
    notes.forEach(([midi, at, len, vol]) => {
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = "triangle";
      osc.frequency.value = hz(midi);
      const v = vol === undefined ? 0.3 : vol, s = t0 + at;
      gain.gain.setValueAtTime(0, s);
      gain.gain.linearRampToValueAtTime(v, s + 0.02);
      gain.gain.setValueAtTime(v, s + Math.max(0.03, len - 0.08));
      gain.gain.linearRampToValueAtTime(0, s + len);
      osc.connect(gain).connect(audio.destination);
      osc.start(s); osc.stop(s + len + 0.05);
    });
  }

  /* ---------------- Noten zeichnen ---------------- */
  // positions on the staff: 0 is the bottom line (e'), each step is one line or space
  const PITCHES = [
    { name: "c", pos: -2, midi: 60 }, { name: "d", pos: -1, midi: 62 }, { name: "e", pos: 0, midi: 64 },
    { name: "f", pos: 1, midi: 65 }, { name: "g", pos: 2, midi: 67 }, { name: "a", pos: 3, midi: 69 },
    { name: "h", pos: 4, midi: 71 }, { name: "c", pos: 5, midi: 72 }, { name: "d", pos: 6, midi: 74 },
    { name: "e", pos: 7, midi: 76 }, { name: "f", pos: 8, midi: 77 }, { name: "g", pos: 9, midi: 79 },
    { name: "a", pos: 10, midi: 81 }
  ];
  const NAMES = ["c", "d", "e", "f", "g", "a", "h"];
  const yOf = pos => 70 - pos * 5;

  // one note or rest at x. kind: 4 whole, 3 dotted half, 2 half, 1 quarter, 0.5 eighth, 0.25 sixteenth
  function noteSvg(x, pos, kind){
    const y = yOf(pos);
    let s = "";
    for (let p = -2; p >= pos; p -= 2) s += `<line x1="${x - 11}" x2="${x + 11}" y1="${yOf(p)}" y2="${yOf(p)}" class="mu-line"/>`;
    for (let p = 10; p <= pos; p += 2) s += `<line x1="${x - 11}" x2="${x + 11}" y1="${yOf(p)}" y2="${yOf(p)}" class="mu-line"/>`;
    const filled = kind <= 1;
    s += `<ellipse cx="${x}" cy="${y}" rx="6.6" ry="4.7" transform="rotate(-22 ${x} ${y})" class="${filled ? "mu-fill" : "mu-hollow"}"/>`;
    if (kind < 4) {
      const up = pos < 4, sx = up ? x + 5.8 : x - 5.8, ey = up ? y - 34 : y + 34;
      s += `<line x1="${sx}" x2="${sx}" y1="${y}" y2="${ey}" class="mu-stem"/>`;
      const flags = kind === 0.5 ? 1 : kind === 0.25 ? 2 : 0;
      for (let f = 0; f < flags; f++) {
        const fy = ey + (up ? f * 8 : -f * 8);
        s += up
          ? `<path d="M${sx} ${fy} q 4 8 10 12 q 3 4 0 10" class="mu-flag"/>`
          : `<path d="M${sx} ${fy} q 4 -8 10 -12 q 3 -4 0 -10" class="mu-flag"/>`;
      }
    }
    if (kind === 3) s += `<circle cx="${x + 11}" cy="${pos % 2 ? y : y - 4}" r="2.2" class="mu-fill"/>`;
    return s;
  }
  function restSvg(x, kind){
    if (kind === 4) return `<rect x="${x - 8}" y="40" width="16" height="5" class="mu-fill"/>`;
    if (kind === 2) return `<rect x="${x - 8}" y="45" width="16" height="5" class="mu-fill"/>`;
    if (kind === 1) return `<path d="M${x - 3} 34 l 7 8 l -6 7 l 7 8 q -8 -3 -6 6" class="mu-flag"/>`;
    return `<circle cx="${x - 3}" cy="44" r="2.6" class="mu-fill"/><path d="M${x - 3} 44 q 5 2 8 -3 l -7 20" class="mu-flag"/>`;
  }
  // a staff with a treble clef and things drawn on it; time is an optional "3/4"
  function staff(items, time){
    const lead = time ? 82 : 58, w = lead + items.length * 46 + 16;
    let s = `<svg class="mu-staff" viewBox="0 0 ${w} 105" width="${w * 1.6}" height="${105 * 1.6}" role="img" aria-label="Noten">`;
    for (let k = 0; k < 5; k++) s += `<line x1="6" x2="${w - 6}" y1="${30 + k * 10}" y2="${30 + k * 10}" class="mu-line"/>`;
    s += `<text x="8" y="82" class="mu-clef">𝄞</text>`;
    if (time) {
      const [a, b] = time.split("/");
      s += `<text x="${lead - 26}" y="49" class="mu-time">${a}</text><text x="${lead - 26}" y="69" class="mu-time">${b}</text>`;
    }
    items.forEach((it, k) => { s += it(lead + 20 + k * 46); });
    return s + `<line x1="${w - 6}" x2="${w - 6}" y1="30" y2="70" class="mu-line"/></svg>`;
  }

  /* ---------------- Notennamen ---------------- */
  // words you can spell with note names
  const WOERTER = ["AFFE", "DACH", "FACH", "CHEF", "HEFE", "FEE", "EHE", "ADE", "ACH"];

  function notennameQuestion(level){
    if (level === "challenge" && Math.random() < 0.5) {
      const wort = choice(WOERTER);
      const notes = [...wort.toLowerCase()].map(ch => choice(PITCHES.filter(p => p.name === ch && p.pos >= -1 && p.pos <= 9)));
      const falsch = sample(WOERTER.filter(w => w !== wort && w.length === wort.length), 3);
      while (falsch.length < 3) {
        const f = shuffle([...wort]).join("");
        if (f !== wort && !falsch.includes(f)) falsch.push(f);
      }
      return pick({
        promptHtml: `${staff(notes.map(n => x => noteSvg(x, n.pos, 1)))}<span class="sub">Welches Wort ergeben die Noten?</span>`,
        prompt: "Welches Wort ergeben die Noten?",
        answer: wort, options: [wort, ...falsch],
        say: () => play(notes.map((n, k) => [n.midi, k * 0.45, 0.4])), sayAfter: true,
        explain: `${notes.map(n => n.name).join(" – ")} = <b>${wort}</b>`
      });
    }
    const range = level === "warmup" ? [0, 8] : [-2, 10];
    const n = choice(PITCHES.filter(p => p.pos >= range[0] && p.pos <= range[1]));
    const wo = n.pos < 0 || n.pos > 8 ? "auf oder an einer Hilfslinie" : n.pos % 2 === 0 ? `auf der ${n.pos / 2 + 1}. Linie (von unten)` : `im ${(n.pos + 1) / 2}. Zwischenraum (von unten)`;
    return pick({
      promptHtml: `${staff([x => noteSvg(x, n.pos, 1)])}<span class="sub">Wie heisst diese Note?</span>`,
      prompt: "Wie heisst diese Note?",
      answer: n.name, options: NAMES, keepOrder: true,
      say: () => play([[n.midi, 0, 0.8]]), sayAfter: true,
      explain: `Das ist ein <b>${n.name}</b>, ${wo}.<br>💡 Die Linien von unten: <b>e – g – h – d – f</b>. Die Zwischenräume: <b>f – a – c – e</b>. In der Schweiz heisst es <b>h</b>, nicht b!`
    });
  }

  /* ---------------- Notenwerte und Pausen ---------------- */
  const WERTE = [
    { kind: 4, note: "ganze Note", rest: "ganze Pause", beats: "4 Schläge" },
    { kind: 2, note: "halbe Note", rest: "halbe Pause", beats: "2 Schläge" },
    { kind: 1, note: "Viertelnote", rest: "Viertelpause", beats: "1 Schlag" },
    { kind: 0.5, note: "Achtelnote", rest: "Achtelpause", beats: "½ Schlag" }
  ];
  const RECHNEN = {
    practice: [
      ["Wie viele Schläge dauert eine punktierte halbe Note?", "3", ["2", "4", "2½"], "Der Punkt verlängert die Note um die Hälfte: 2 + 1 = 3."],
      ["Wie viele Achtelnoten dauern so lange wie eine Viertelnote?", "2", ["4", "8", "1"], "1 Viertel = 2 Achtel."],
      ["Wie viele Viertelnoten passen in eine ganze Note?", "4", ["2", "8", "3"], "1 Ganze = 2 Halbe = 4 Viertel."],
      ["Wie viele Sechzehntel sind eine Viertelnote?", "4", ["2", "8", "16"], "1 Viertel = 2 Achtel = 4 Sechzehntel."],
      ["Wie viele halbe Noten sind eine ganze Note?", "2", ["4", "3", "1"], "Zwei halbe Noten dauern so lange wie eine ganze."]
    ],
    challenge: [
      ["halbe + Viertel + Achtel + Achtel = ? Schläge", "4", ["3", "5", "3½"], "2 + 1 + ½ + ½ = 4. Das füllt einen 4/4-Takt!"],
      ["Wie viele Sechzehntel sind eine halbe Note?", "8", ["4", "16", "6"], "1 Halbe = 2 Viertel = 4 Achtel = 8 Sechzehntel."],
      ["punktierte halbe + Viertel = ? Schläge", "4", ["3", "5", "3½"], "3 + 1 = 4."],
      ["Wie viele Schläge dauert eine punktierte Viertelnote?", "1½", ["1", "2", "3"], "1 + die Hälfte von 1 = 1½."],
      ["Viertel + Achtel + Achtel + halbe Pause = ? Schläge", "4", ["3", "2", "5"], "Pausen zählen auch: 1 + ½ + ½ + 2 = 4."]
    ]
  };

  function notenwertQuestion(level){
    if (level !== "warmup" && Math.random() < 0.4) {
      const [frage, antwort, falsch, tipp] = choice(RECHNEN[level]);
      return pick({ prompt: frage, answer: antwort, options: [antwort, ...falsch], explain: `<b>${antwort}</b><br>💡 ${tipp}` });
    }
    const w = choice(WERTE);
    const rest = level !== "warmup" && Math.random() < 0.5;
    if (level === "warmup" && Math.random() < 0.4) {
      return pick({
        prompt: `Wie lange dauert eine ${w.note} im 4/4-Takt?`, answer: w.beats, options: WERTE.map(x => x.beats), keepOrder: true,
        explain: `Eine <b>${w.note}</b> dauert <b>${w.beats}</b>.<br>💡 Ganze 4 · Halbe 2 · Viertel 1 · Achtel ½.`
      });
    }
    const name = rest ? w.rest : w.note;
    return pick({
      promptHtml: `${staff([x => rest ? restSvg(x, w.kind) : noteSvg(x, 4, w.kind)])}<span class="sub">Wie heisst ${rest ? "diese Pause" : "diese Note"}?</span>`,
      prompt: rest ? "Wie heisst diese Pause?" : "Wie heisst diese Note?",
      answer: name, options: WERTE.map(x => rest ? x.rest : x.note), keepOrder: true,
      explain: `Das ist eine <b>${name}</b>: sie dauert ${w.beats}.` + (rest ? "<br>💡 Die ganze Pause hängt an der Linie, die halbe Pause sitzt darauf." : "")
    });
  }

  /* ---------------- Takt ---------------- */
  // notes that add up to beats; eighths come in pairs
  function fillBar(beats, allowDotted){
    const out = [];
    let left = beats;
    while (left > 0) {
      const opts = [1, 1, 2, 0.5].concat(allowDotted ? [3] : []).filter(v => (v === 0.5 ? 1 : v) <= left);
      const v = choice(opts);
      if (v === 0.5) { out.push(0.5, 0.5); left -= 1; } else { out.push(v); left -= v; }
    }
    return out;
  }
  const beatText = n => {
    const s = n === 0.5 ? "½" : String(n).replace(".5", "½");
    return n <= 1 ? `${s} Schlag` : `${s} Schläge`;
  };

  function taktQuestion(level){
    const pos = () => choice([0, 1, 2, 3, 4, 5, 6, 7]);
    if (level === "challenge") {
      const total = choice([3, 4]);
      let bar;
      do bar = fillBar(total, true); while (bar.length < 2);
      // take away one or two notes at the end, so something is always missing
      const keep = bar.slice(0, bar.length - 1 - Math.floor(Math.random() * Math.min(2, bar.length - 1)));
      const used = keep.reduce((a, b) => a + b, 0), missing = total - used;
      const opts = [...new Set([missing, missing + 1, Math.max(0.5, missing - 1), missing + 0.5])].slice(0, 4);
      return pick({
        promptHtml: `${staff(keep.map(v => x => noteSvg(x, pos(), v)), total + "/4")}<span class="sub">Wie viele Schläge fehlen noch, bis der Takt voll ist?</span>`,
        prompt: "Wie viele Schläge fehlen noch?",
        answer: beatText(missing), options: opts.map(beatText),
        explain: `Ein ${total}/4-Takt hat ${total} Schläge. Da sind schon ${beatText(used)}, also fehlen noch <b>${beatText(missing)}</b>.`
      });
    }
    const total = choice([2, 3, 4]);
    const bar = fillBar(total, false);
    const notes = bar.map(v => x => noteSvg(x, pos(), v));
    const rhythm = () => { let t = 0; return bar.map(v => { const n = [choice([67, 69, 71, 72]), t * 0.5, v * 0.5 - 0.04]; t += v; return n; }); };
    if (level === "warmup") {
      return pick({
        promptHtml: `${staff(notes)}<span class="sub">Wie viele Schläge dauern diese Noten zusammen?</span>`,
        prompt: "Wie viele Schläge zusammen?",
        answer: beatText(total), options: [2, 3, 4, 5].map(beatText), keepOrder: true,
        say: () => play(rhythm()), sayAfter: true,
        explain: `${bar.map(v => String(v).replace("0.5", "½")).join(" + ")} = <b>${total}</b><br>💡 Viertel 1 · Halbe 2 · Achtel ½.`
      });
    }
    return pick({
      promptHtml: `${staff(notes)}<span class="sub">Welche Taktart passt zu diesem Takt?</span>`,
      prompt: "Welche Taktart passt?",
      answer: total + "/4", options: ["2/4", "3/4", "4/4"], keepOrder: true,
      say: () => play(rhythm()), sayAfter: true,
      explain: `Zusammen ${beatText(total)} → <b>${total}/4-Takt</b>.<br>💡 Ein Walzer ist im 3/4-Takt, ein Marsch oft im 2/4-Takt.`
    });
  }

  /* ---------------- Instrumente ---------------- */
  const FAMILIEN = {
    "Streichinstrument": "Streichinstrumente spielt man mit einem Bogen.",
    "Zupfinstrument": "Bei Zupfinstrumenten zupft man die Saiten mit den Fingern.",
    "Holzblasinstrument": "Holzblasinstrumente klingen durch ein Rohrblatt oder eine Kante – auch wenn sie aus Metall sind, wie die Querflöte oder das Saxofon.",
    "Blechblasinstrument": "Bei Blechblasinstrumenten summen die Lippen ins Mundstück.",
    "Schlaginstrument": "Schlaginstrumente schlägt, schüttelt oder reibt man.",
    "Tasteninstrument": "Tasteninstrumente spielt man mit Tasten."
  };
  const INSTRUMENTE = {
    warmup: [["Geige", "Streichinstrument"], ["Gitarre", "Zupfinstrument"], ["Blockflöte", "Holzblasinstrument"], ["Trompete", "Blechblasinstrument"],
      ["Trommel", "Schlaginstrument"], ["Klavier", "Tasteninstrument"], ["Triangel", "Schlaginstrument"], ["Cello", "Streichinstrument"]],
    practice: [["Harfe", "Zupfinstrument"], ["Klarinette", "Holzblasinstrument"], ["Posaune", "Blechblasinstrument"], ["Xylofon", "Schlaginstrument"],
      ["Orgel", "Tasteninstrument"], ["Bratsche", "Streichinstrument"], ["Tuba", "Blechblasinstrument"], ["Pauke", "Schlaginstrument"]],
    challenge: [["Querflöte", "Holzblasinstrument"], ["Saxofon", "Holzblasinstrument"], ["Kontrabass", "Streichinstrument"], ["Fagott", "Holzblasinstrument"],
      ["Waldhorn", "Blechblasinstrument"], ["Oboe", "Holzblasinstrument"], ["Hackbrett", "Schlaginstrument"]]
  };
  const INSTRUMENT_FRAGEN = {
    warmup: [
      ["Woraus ist ein Alphorn gemacht?", "aus Holz", ["aus Blech", "aus Plastik", "aus Glas"], "Das Alphorn ist meistens aus einer Fichte gemacht und bis zu 4 m lang."],
      ["Wer leitet ein Orchester?", "die Dirigentin oder der Dirigent", ["die erste Geige", "die Pauke", "das Publikum"], "Mit dem Taktstock zeigt sie oder er Tempo und Einsätze."],
      ["Wie viele Saiten hat eine Gitarre normalerweise?", "6", ["4", "5", "12"], "Die tiefste Saite ist das E."]
    ],
    practice: [
      ["Was ist ein Schwyzerörgeli?", "eine kleine Handorgel", ["eine kleine Orgel in der Kirche", "eine Trommel", "eine Flöte"], "Das Schwyzerörgeli gehört zur Schweizer Volksmusik."],
      ["Welches Streichinstrument klingt am tiefsten?", "Kontrabass", ["Geige", "Bratsche", "Cello"], "Je grösser das Instrument, desto tiefer der Ton."],
      ["Woher kommt das Hackbrett in der Schweiz besonders?", "aus dem Appenzell", ["aus dem Tessin", "aus Genf", "aus Basel"], "Man schlägt die Saiten mit zwei kleinen Holzschlegeln."]
    ],
    challenge: [
      ["Welches Instrument hat die meisten Tasten?", "Klavier (88 Tasten)", ["Akkordeon", "Xylofon", "Keyboard mit 61 Tasten"], "Ein Klavier hat 52 weisse und 36 schwarze Tasten."],
      ["Was macht ein Dämpfer bei der Trompete?", "Er macht den Ton leiser und anders", ["Er macht sie lauter", "Er stimmt sie", "Er putzt sie"], "Man steckt ihn vorne in den Schalltrichter."],
      ["Wie entsteht der Ton bei der Geige?", "Der Bogen bringt die Saiten zum Schwingen", ["Man bläst hinein", "Man drückt Tasten", "Man schlägt sie mit Schlegeln"], "Schwingungen sind Schall: Ohne Schwingung kein Ton."]
    ]
  };

  function instrumentQuestion(level){
    if (Math.random() < 0.3) {
      const [frage, antwort, falsch, tipp] = choice(INSTRUMENT_FRAGEN[level]);
      return pick({ prompt: frage, answer: antwort, options: [antwort, ...falsch], explain: `<b>${antwort}</b><br>💡 ${tipp}` });
    }
    const [inst, fam] = choice(INSTRUMENTE[level]);
    const opts = [fam, ...sample(Object.keys(FAMILIEN).filter(f => f !== fam), 3)];
    return pick({
      prompt: `Zu welcher Familie gehört: ${inst}?`, answer: fam, options: opts,
      explain: `<b>${inst}</b>: ${fam}<br>💡 ${FAMILIEN[fam]}`
    });
  }

  /* ---------------- Musikwörter ---------------- */
  const WOERTER_MUSIK = {
    warmup: [
      ["Was bedeutet «piano» (p)?", "leise", ["laut", "schnell", "langsam"], "Piano ist Italienisch für leise."],
      ["Was bedeutet «forte» (f)?", "laut", ["leise", "langsam", "kurz"], "Forte ist Italienisch für stark, also laut."],
      ["Wie klingt Dur meistens?", "fröhlich und hell", ["traurig und dunkel", "ganz leise", "ganz tief"], "Moll klingt oft traurig oder geheimnisvoll."],
      ["Was ist ein Refrain?", "der Teil, der im Lied immer wiederkommt", ["die erste Note", "eine Pause", "ein Instrument"], "Die Strophen haben verschiedene Texte, der Refrain bleibt gleich."],
      ["Was ist ein Kanon?", "Alle singen dasselbe, aber nacheinander", ["ein ganz leises Lied", "ein Instrument", "ein Tanz"], "Zum Beispiel «Bruder Jakob»."]
    ],
    practice: [
      ["Was bedeutet «crescendo»?", "lauter werden", ["leiser werden", "schneller werden", "aufhören"], "Das Zeichen ist eine Gabel, die sich öffnet: <"],
      ["Was bedeutet «decrescendo»?", "leiser werden", ["lauter werden", "langsamer werden", "wiederholen"], "Das Zeichen ist eine Gabel, die sich schliesst: >"],
      ["Was bedeutet «Allegro»?", "schnell und fröhlich", ["langsam", "sehr leise", "traurig"], "Allegro heisst auf Italienisch fröhlich."],
      ["Was bedeutet «Adagio»?", "langsam", ["schnell", "laut", "kurz"], "Adagio heisst gemächlich und ruhig."],
      ["Was bedeutet «mezzoforte» (mf)?", "mittellaut", ["sehr laut", "sehr leise", "schnell"], "Mezzo heisst halb: halb laut."],
      ["Was zeigt eine Fermate an?", "Den Ton länger halten", ["Den Ton weglassen", "Schneller spielen", "Lauter spielen"], "Die Fermate sieht aus wie ein Auge über der Note."]
    ],
    challenge: [
      ["Was bedeutet «pianissimo» (pp)?", "sehr leise", ["sehr laut", "leise werden", "sehr schnell"], "Von leise nach laut: pp – p – mp – mf – f – ff."],
      ["Was bedeutet «Presto»?", "sehr schnell", ["sehr langsam", "sehr leise", "gehend"], "Presto ist noch schneller als Allegro."],
      ["Was bedeutet «Andante»?", "gehend, gemächlich", ["sehr schnell", "stehend", "sehr laut"], "Andante kommt von «andare» – gehen."],
      ["Was zeigt ein Wiederholungszeichen?", "Den Teil noch einmal spielen", ["Aufhören", "Leiser spielen", "Das Lied beginnt"], "Zwei Punkte vor einem Doppelstrich: zurück zum Anfang des Teils."],
      ["Wie heisst die Nationalhymne der Schweiz?", "Schweizerpsalm", ["Bruder Jakob", "Guten Abend, gut' Nacht", "Lueget vo Berg und Tal"], "«Trittst im Morgenrot daher …»"],
      ["Wer komponierte «Die Zauberflöte»?", "Wolfgang Amadeus Mozart", ["Ludwig van Beethoven", "Johann Sebastian Bach", "Antonio Vivaldi"], "Mozart lebte in Salzburg und Wien und komponierte schon als Kind."],
      ["Wer komponierte «Die vier Jahreszeiten»?", "Antonio Vivaldi", ["Mozart", "Beethoven", "Bach"], "Vivaldi war ein Geiger aus Venedig."],
      ["Welcher Komponist wurde taub und komponierte trotzdem weiter?", "Ludwig van Beethoven", ["Mozart", "Vivaldi", "Bach"], "Seine 9. Sinfonie mit «Freude, schöner Götterfunken» schrieb er, als er schon taub war."]
    ]
  };

  /* ---------------- Hör-Quiz ---------------- */
  const LISTEN = "Hör gut zu! Tippe auf 🔊 Anhören.";
  function hoerQuestion(level){
    const kinds = { warmup: ["hoch", "laut"], practice: ["anzahl", "richtung", "hoch"], challenge: ["durmoll", "tempo", "gleich"] }[level];
    const kind = choice(kinds);
    const ask = (frage, answer, options, notes, explain) => pick({
      promptHtml: `${frage}<span class="sub">${LISTEN}</span>`, prompt: frage, answer, options, keepOrder: true,
      say: () => play(notes), explain
    });
    if (kind === "hoch") {
      const a = 60 + Math.floor(Math.random() * 13);
      let b = a + choice([-1, 1]) * (level === "warmup" ? choice([5, 7, 12]) : choice([2, 3, 4]));
      const higher = b > a ? "der zweite" : "der erste";
      return ask("Welcher Ton ist höher?", higher, ["der erste", "der zweite"], [[a, 0, 0.7], [b, 0.9, 0.7]],
        `<b>${higher}</b> Ton war höher.<br>💡 Hohe Töne klingen hell (wie ein Vogel), tiefe Töne dunkel (wie ein Bär).`);
    }
    if (kind === "laut") {
      const louder = Math.random() < 0.5;
      const notes = [0, 1, 2, 3, 4, 5].map(k => [67, k * 0.4, 0.35, louder ? 0.05 + k * 0.07 : 0.4 - k * 0.07]);
      const ans = louder ? "lauter (crescendo)" : "leiser (decrescendo)";
      return ask("Werden die Töne lauter oder leiser?", ans, ["lauter (crescendo)", "leiser (decrescendo)"], notes,
        `<b>${ans}</b><br>💡 crescendo = lauter werden, decrescendo = leiser werden.`);
    }
    if (kind === "anzahl") {
      const n = 2 + Math.floor(Math.random() * 4);
      return ask("Wie viele Töne hörst du?", String(n), ["2", "3", "4", "5"], Array.from({ length: n }, (_, k) => [choice([64, 67, 69, 72]), k * 0.45, 0.3]),
        `Es waren <b>${n}</b> Töne.`);
    }
    if (kind === "richtung") {
      const up = Math.random() < 0.5, scale = [60, 62, 64, 65, 67, 69, 71, 72];
      const seq = up ? scale : scale.slice().reverse();
      const ans = up ? "nach oben" : "nach unten";
      return ask("Geht die Melodie nach oben oder nach unten?", ans, ["nach oben", "nach unten"], seq.map((m, k) => [m, k * 0.3, 0.28]),
        `<b>${ans}</b> – das war eine C-Dur-Tonleiter: c d e f g a h c.`);
    }
    if (kind === "durmoll") {
      const dur = Math.random() < 0.5, root = 60 + Math.floor(Math.random() * 7);
      const chord = [root, root + (dur ? 4 : 3), root + 7];
      const notes = chord.map((m, k) => [m, k * 0.35, 0.3]).concat(chord.map(m => [m, 1.2, 1.2, 0.18]));
      const ans = dur ? "Dur (fröhlich)" : "Moll (traurig)";
      return ask("Klingt dieser Akkord nach Dur oder Moll?", ans, ["Dur (fröhlich)", "Moll (traurig)"], notes,
        `<b>${ans}</b><br>💡 Der mittlere Ton macht den Unterschied: bei Moll ist er einen Halbton tiefer.`);
    }
    if (kind === "tempo") {
      const fast = Math.random() < 0.5, step = fast ? 0.18 : 0.75;
      const ans = fast ? "Allegro (schnell)" : "Adagio (langsam)";
      return ask("Ist dieses Tempo schnell oder langsam?", ans, ["Allegro (schnell)", "Adagio (langsam)"],
        [67, 69, 71, 72, 71, 69, 67].map((m, k) => [m, k * step, step * 0.85]), `<b>${ans}</b>`);
    }
    // gleich oder verschieden
    const melody = Array.from({ length: 4 }, () => choice([60, 62, 64, 65, 67, 69]));
    const same = Math.random() < 0.5, second = melody.slice();
    if (!same) { const k = 1 + Math.floor(Math.random() * 3); second[k] += choice([-2, 2, 3]); }
    const ans = same ? "gleich" : "verschieden";
    return ask("Sind die zwei Melodien gleich oder verschieden?", ans, ["gleich", "verschieden"],
      melody.map((m, k) => [m, k * 0.35, 0.3]).concat(second.map((m, k) => [m, 1.9 + k * 0.35, 0.3])),
      `Die Melodien waren <b>${ans}</b>.`);
  }

  /* ---------------- Themen ---------------- */
  const TOPICS = [
    {
      id: "notennamen", label: "Notennamen", icon: "🎼", title: "Noten lesen im Violinschlüssel",
      levelDesc: { warmup: "Noten im Notensystem: e bis f", practice: "Mit Hilfslinien: c bis a", challenge: "Notenwörter lesen" },
      hint: "Linien: e g h d f · Zwischenräume: f a c e",
      generate: notennameQuestion
    },
    {
      id: "notenwerte", label: "Notenwerte", icon: "⏱️", title: "Notenwerte und Pausen",
      levelDesc: { warmup: "Ganze, Halbe, Viertel, Achtel", practice: "Pausen und punktierte Noten", challenge: "Notenwerte rechnen" },
      hint: "Ganze 4 · Halbe 2 · Viertel 1 · Achtel ½",
      generate: notenwertQuestion
    },
    {
      id: "takt", label: "Takt", icon: "📏", title: "Schläge und Takt",
      levelDesc: { warmup: "Schläge zusammenzählen", practice: "2/4, 3/4 oder 4/4?", challenge: "Was fehlt noch im Takt?" },
      hint: "Zähl die Schläge mit: 1 – 2 – 3 – 4.",
      generate: taktQuestion
    },
    {
      id: "instrumente", label: "Instrumente", icon: "🎻", title: "Instrumente und ihre Familien",
      levelDesc: { warmup: "Bekannte Instrumente", practice: "Orchester und Schweizer Volksmusik", challenge: "Seltene Instrumente" },
      hint: "Wie entsteht der Ton: streichen, zupfen, blasen, schlagen oder Tasten?",
      generate: instrumentQuestion
    },
    {
      id: "woerter", label: "Musikwörter", icon: "🔤", title: "Musikwörter und Komponisten",
      levelDesc: { warmup: "piano, forte, Dur, Kanon", practice: "crescendo, Allegro, Fermate", challenge: "Tempo, Hymne und Komponisten" },
      hint: "Viele Musikwörter kommen aus dem Italienischen.",
      generate: level => {
        const [frage, antwort, falsch, tipp] = choice(WOERTER_MUSIK[level]);
        return pick({ prompt: frage, answer: antwort, options: [antwort, ...falsch], explain: `<b>${antwort}</b><br>💡 ${tipp}` });
      }
    },
    {
      id: "hoeren", label: "Hör-Quiz", icon: "👂", title: "Gut zuhören",
      levelDesc: { warmup: "hoch oder tief, laut oder leise", practice: "Wie viele Töne? Nach oben oder unten?", challenge: "Dur oder Moll? Schnell oder langsam?" },
      hint: "Tippe auf 🔊 Anhören – so oft du willst.",
      generate: hoerQuestion
    }
  ];

  const store = Hub.store;
  if (!store.musik) store.musik = {};

  Notebook.register({
    id: "musik", title: "Musik Maestro", icon: "🎵",
    blurb: "Musik für die 5. Klasse: Noten lesen, Takt, Instrumente, Musikwörter und ein Hör-Quiz.",
    unit: "/// ein Musik-Übungsheft",
    tagline: "Noten lesen, Rhythmus, Instrumente und gut zuhören, mit einem Tipp zu jeder Antwort",
    taglineFor: "für",
    nameFallback: "dich",
    subject: "Musik",
    wordy: true,
    listenLabel: "🔊 Anhören",
    verdicts: { right: "Richtig!", wrong: "Nicht ganz – richtig ist:" },
    data: store.musik,
    badgePrefix: "mu-",
    badgeNames: {
      first: ["⭐", "Erster Ton"], streak5: ["🔥", "Im Takt"], streak10: ["🚀", "Rhythmus-Rakete"],
      streak25: ["⚡", "Maestro"], race1: ["🏁", "Presto!"], race5: ["🏆", "Musik-Champion"],
      race20: ["👑", "Superstar"], trial: ["⏱️", "Schnelles Gehör"], challenge: ["💪", "Fortissimo"],
      century: ["💯", "Hundert Töne"]
    },
    topics: TOPICS
  });
})();
