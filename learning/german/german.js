/* Deutsch Dash: Deutsch für die 5. Klasse in der Schweiz, passend zu «Die Sprachstarken 5»
   (Lehrplan 21): Wortarten, die vier Fälle, Verben und Zeitformen, Rechtschreibung,
   Satzzeichen und Morpheme. Schweizer Rechtschreibung: immer ss, nie ß, und «Anführungszeichen». */
(function(){
  "use strict";
  const { pick, choice } = Notebook;

  /* ---------------- Wortarten: Wörter in {Klammern|Art} können abgefragt werden ---------------- */
  const WORTARTEN = {
    n: ["Nomen", "Artikelprobe: Man kann <i>der, die</i> oder <i>das</i> davor setzen. Nomen schreibt man gross."],
    v: ["Verb", "Personalform-Probe: Verben verändern sich mit der Person (ich …, du …, er …) und mit der Zeit."],
    a: ["Adjektiv", "Vergleichsprobe: Adjektive kann man steigern (laut – lauter – am lautesten)."],
    p: ["Pronomen", "Pronomen begleiten ein Nomen oder stehen für ein Nomen: ich, er, mein, dieser …"],
    x: ["Partikel", "Partikeln verändern sich nie: und, auf, heute, sehr, nicht …"]
  };
  const WORTART_LEVELS = { warmup: ["n", "v", "a"], practice: ["n", "v", "a"], challenge: ["n", "v", "a", "p", "x"] };
  const WORTART_SAETZE = {
    warmup: [
      "Der {Hund|n} {bellt|v} {laut|a}.",
      "Meine {Schwester|n} {liest|v} ein {spannendes|a} {Buch|n}.",
      "Im {Sommer|n} {schwimmen|v} wir im {kalten|a} {See|n}.",
      "Die {Katze|n} {schläft|v} auf dem {weichen|a} {Sofa|n}.",
      "Die {Kinder|n} {bauen|v} eine {grosse|a} {Sandburg|n}.",
      "Der {rote|a} {Zug|n} {fährt|v} nach {Zug|n}.",
      "Mein {Bruder|n} {isst|v} einen {sauren|a} {Apfel|n}.",
      "Die {Lehrerin|n} {erzählt|v} eine {lustige|a} {Geschichte|n}."
    ],
    practice: [
      "Das {Lachen|n} der {Kinder|n} {war|v} {laut|a}.",
      "Die {Kinder|n} {warten|v} {geduldig|a} vor der {Schule|n}.",
      "Beim {Zeichnen|n} {vergisst|v} {Lena|n} die {Zeit|n}.",
      "Der {Lehrer|n} {erklärt|v} die {schwierige|a} {Aufgabe|n} {genau|a}.",
      "Das {Wetter|n} {wird|v} {wärmer|a} und {sonniger|a}.",
      "{Luca|n} {rennt|v} {schneller|a} als sein {Bruder|n}.",
      "Das {Schwimmen|n} im {See|n} {macht|v} {Spass|n}.",
      "Die {müden|a} {Wanderer|n} {ruhen|v} sich aus."
    ],
    challenge: [
      "{Er|p} {rennt|v} {schneller|a} {als|x} {sein|p} {Bruder|n}.",
      "{Wir|p} {spielen|v} {heute|x} {Fussball|n} {auf|x} dem {Pausenplatz|n}.",
      "{Sie|p} {trinkt|v} {warmen|a} {Tee|n}, {denn|x} {sie|p} {friert|v}.",
      "{Dieser|p} {Berg|n} {ist|v} {höher|a} {als|x} der {Pilatus|n}.",
      "{Ich|p} {habe|v} {mein|p} {Velo|n} {gestern|x} {geputzt|v}.",
      "{Unser|p} {Hund|n} {frisst|v} {nicht|x} gern {Gemüse|n}.",
      "{Morgen|x} {fahren|v} {wir|p} {mit|x} dem {Zug|n} nach {Luzern|n}.",
      "Die {Kinder|n} {lachen|v} {und|x} {singen|v} {sehr|x} {laut|a}."
    ]
  };

  function wortartQuestion(level){
    const allowed = WORTART_LEVELS[level];
    const tag = /\{([^|}]+)\|(\w)\}/g;
    const asks = [];
    WORTART_SAETZE[level].forEach((s, si) => {
      let ti = 0;
      s.replace(tag, (m, word, art) => { if (allowed.includes(art)) asks.push({ si, ti, word, art }); ti++; return m; });
    });
    const q = choice(asks);
    let ti = 0;
    const satz = WORTART_SAETZE[level][q.si].replace(tag, (m, word) => ti++ === q.ti ? `<mark>${word}</mark>` : word);
    const [name, probe] = WORTARTEN[q.art];
    return pick({
      promptHtml: `${satz}<span class="sub">Welche Wortart ist «${q.word}»?</span>`, prompt: satz.replace(/<[^>]+>/g, ""),
      answer: name, options: allowed.map(a => WORTARTEN[a][0]), keepOrder: true,
      explain: `<b>${q.word}</b> ist ein${q.art === "x" ? "e" : ""} <b>${name}</b>.<br>💡 ${probe}`
    });
  }

  /* ---------------- Die vier Fälle: [Satz mit {Nomengruppe}, Fall, Frage] ---------------- */
  const FAELLE = {
    N: ["Nominativ", "Wer oder was?"], A: ["Akkusativ", "Wen oder was?"],
    D: ["Dativ", "Wem?"], G: ["Genitiv", "Wessen?"]
  };
  const FALL_LEVELS = { warmup: ["N", "A"], practice: ["N", "A", "D"], challenge: ["N", "A", "D", "G"] };
  const FALL_SAETZE = {
    warmup: [
      ["{Der Bäcker} backt frisches Brot.", "N", "Wer backt frisches Brot?"],
      ["Mia füttert {den Hund}.", "A", "Wen oder was füttert Mia?"],
      ["{Die Kinder} spielen im Garten.", "N", "Wer spielt im Garten?"],
      ["Ich esse {einen Apfel}.", "A", "Wen oder was esse ich?"],
      ["{Mein Bruder} liest ein Comic.", "N", "Wer liest ein Comic?"],
      ["Wir besuchen {unsere Grossmutter}.", "A", "Wen besuchen wir?"],
      ["{Das Velo} steht vor dem Haus.", "N", "Wer oder was steht vor dem Haus?"],
      ["Leo sucht {seinen Schlüssel}.", "A", "Wen oder was sucht Leo?"],
      ["{Der Zug} fährt nach Zürich.", "N", "Wer oder was fährt nach Zürich?"],
      ["Die Lehrerin lobt {die Klasse}.", "A", "Wen lobt die Lehrerin?"]
    ],
    practice: [
      ["Ich schenke {meiner Mutter} Blumen.", "D", "Wem schenke ich Blumen?"],
      ["Der Ball gehört {dem Mädchen}.", "D", "Wem gehört der Ball?"],
      ["Tim hilft {seinem Freund}.", "D", "Wem hilft Tim?"],
      ["Wir danken {der Lehrerin}.", "D", "Wem danken wir?"],
      ["{Die Katze} jagt eine Maus.", "N", "Wer jagt eine Maus?"],
      ["Lena kauft {ein neues Heft}.", "A", "Wen oder was kauft Lena?"],
      ["Der Arzt gibt {dem Kind} ein Pflaster.", "D", "Wem gibt der Arzt ein Pflaster?"],
      ["Opa erzählt {den Enkeln} eine Geschichte.", "D", "Wem erzählt Opa eine Geschichte?"],
      ["Ich sehe {den Vogel} im Baum.", "A", "Wen oder was sehe ich im Baum?"],
      ["{Der Hund} bringt den Ball zurück.", "N", "Wer bringt den Ball zurück?"]
    ],
    challenge: [
      ["Das ist das Velo {meines Bruders}.", "G", "Wessen Velo ist das?"],
      ["Die Farbe {des Autos} ist rot.", "G", "Wessen Farbe ist rot?"],
      ["Das Dach {der Schule} ist neu.", "G", "Wessen Dach ist neu?"],
      ["Der Schwanz {der Katze} ist lang.", "G", "Wessen Schwanz ist lang?"],
      ["Ich bringe {dem Nachbarn} die Post.", "D", "Wem bringe ich die Post?"],
      ["Sie zeigt {dem Besuch} ihr Zimmer.", "D", "Wem zeigt sie ihr Zimmer?"],
      ["Der Lehrer erklärt {den Schülern} die Aufgabe.", "D", "Wem erklärt der Lehrer die Aufgabe?"],
      ["{Der Wind} weht kräftig.", "N", "Wer oder was weht kräftig?"],
      ["Wir bauen {eine Sandburg}.", "A", "Wen oder was bauen wir?"],
      ["Ich vermisse {meinen Freund}.", "A", "Wen vermisse ich?"]
    ]
  };

  function fallQuestion(level){
    const [satz, fall, frage] = choice(FALL_SAETZE[level]);
    const gruppe = satz.match(/\{([^}]+)\}/)[1];
    const html = satz.replace(/\{([^}]+)\}/, "<mark>$1</mark>");
    const [name, fragewort] = FAELLE[fall];
    return pick({
      promptHtml: `${html}<span class="sub">In welchem Fall steht «${gruppe}»?</span>`, prompt: satz.replace(/[{}]/g, ""),
      answer: name, options: FALL_LEVELS[level].map(f => FAELLE[f][0]), keepOrder: true,
      explain: `Frageprobe: <i>${frage}</i> → <b>${gruppe}</b><br>💡 <b>${fragewort}</b> fragt nach dem <b>${name}</b>.`
    });
  }

  /* ---------------- Verben: [Grundform, er-Form Präsens, Präteritum, Partizip, hat/ist, Subjekt, Rest] ---------------- */
  const REGELMAESSIG = [
    ["spielen", "spielt", "spielte", "gespielt", "hat", "Lena", "Fussball"],
    ["lachen", "lacht", "lachte", "gelacht", "hat", "Der Clown", "laut"],
    ["kaufen", "kauft", "kaufte", "gekauft", "hat", "Mama", "Brot"],
    ["lernen", "lernt", "lernte", "gelernt", "hat", "Tim", "für den Test"],
    ["wohnen", "wohnt", "wohnte", "gewohnt", "hat", "Oma", "in Baar"],
    ["malen", "malt", "malte", "gemalt", "hat", "Mia", "ein Bild"],
    ["hören", "hört", "hörte", "gehört", "hat", "Leo", "Musik"],
    ["baden", "badet", "badete", "gebadet", "hat", "Der Hund", "im See"],
    ["warten", "wartet", "wartete", "gewartet", "hat", "Ben", "auf den Bus"],
    ["wandern", "wandert", "wanderte", "gewandert", "ist", "Die Klasse", "auf den Zugerberg"]
  ];
  const UNREGELMAESSIG = [
    ["gehen", "geht", "ging", "gegangen", "ist", "Lena", "nach Hause"],
    ["kommen", "kommt", "kam", "gekommen", "ist", "Der Zug", "zu spät"],
    ["sehen", "sieht", "sah", "gesehen", "hat", "Tim", "einen Fuchs"],
    ["essen", "isst", "ass", "gegessen", "hat", "Mia", "einen Apfel"],
    ["trinken", "trinkt", "trank", "getrunken", "hat", "Der Hund", "Wasser"],
    ["schreiben", "schreibt", "schrieb", "geschrieben", "hat", "Leo", "einen Brief"],
    ["lesen", "liest", "las", "gelesen", "hat", "Oma", "die Zeitung"],
    ["fahren", "fährt", "fuhr", "gefahren", "ist", "Papa", "nach Zug"],
    ["schwimmen", "schwimmt", "schwamm", "geschwommen", "ist", "Die Ente", "über den See"],
    ["finden", "findet", "fand", "gefunden", "hat", "Ben", "einen Franken"],
    ["laufen", "läuft", "lief", "gelaufen", "ist", "Die Katze", "über die Wiese"],
    ["schlafen", "schläft", "schlief", "geschlafen", "hat", "Das Baby", "lange"],
    ["sprechen", "spricht", "sprach", "gesprochen", "hat", "Die Lehrerin", "leise"],
    ["singen", "singt", "sang", "gesungen", "hat", "Der Chor", "ein Lied"],
    ["springen", "springt", "sprang", "gesprungen", "ist", "Das Pferd", "über den Zaun"]
  ];
  const stamm = inf => inf.replace(/e?n$/, "");
  const reihe = v => `<b>${v[0]}</b> – ${v[2]} – ${v[4]} ${v[3]}`;

  function verbQuestion(level){
    const r = Math.random();
    if (level === "warmup" && r < 0.4) {
      const regel = Math.random() < 0.5, v = choice(regel ? REGELMAESSIG : UNREGELMAESSIG);
      return pick({
        prompt: `Ist «${v[0]}» regelmässig oder unregelmässig?`,
        answer: regel ? "regelmässig" : "unregelmässig", options: ["regelmässig", "unregelmässig"], keepOrder: true,
        explain: `${reihe(v)}<br>💡 ` + (regel
          ? "Der Stamm bleibt gleich, im Präteritum kommt <b>-te</b> dazu → regelmässig."
          : "Der Stammvokal ändert sich (z. B. geh → <b>ging</b>) → unregelmässig.")
      });
    }
    if (level === "warmup" || level === "practice") {
      const regel = level === "warmup";
      const v = choice(regel ? REGELMAESSIG : UNREGELMAESSIG);
      const falsch = regel
        ? [v[1], v[3], stamm(v[0]) + (v[2].endsWith("ete") ? "te" : "ete")]
        : [stamm(v[0]) + "te", v[1], v[3]];
      return pick({
        promptHtml: `Gestern: ${v[5]} ___ ${v[6]}.<span class="sub">Präteritum von «${v[0]}»</span>`, prompt: `${v[5]} ___ ${v[6]}.`,
        answer: v[2], options: [v[2], ...falsch],
        explain: `${v[5]} <b>${v[2]}</b> ${v[6]}.<br>${reihe(v)}<br>💡 ` + (regel
          ? "Regelmässig: Stamm + <b>-te</b>" + (v[2].endsWith("ete") ? " (nach d und t: <b>-ete</b>)." : ".")
          : "Unregelmässig: Der Stammvokal ändert sich. Diese Formen lernt man auswendig.")
      });
    }
    // challenge: Perfekt, entweder das Hilfsverb oder das Partizip
    const v = choice(REGELMAESSIG.concat(UNREGELMAESSIG));
    const satz = `${v[5]} ${v[4]} ${v[6]} ${v[3]}.`;
    if (Math.random() < 0.5) {
      return pick({
        promptHtml: `${v[5]} ___ ${v[6]} ${v[3]}.<span class="sub">Perfekt: hat oder ist?</span>`, prompt: `${v[5]} ___ ${v[6]} ${v[3]}.`,
        answer: v[4], options: ["hat", "ist"], keepOrder: true,
        explain: `${satz}<br>💡 Verben der Bewegung (gehen, fahren, laufen …) bilden das Perfekt meistens mit <b>sein</b>, die anderen mit <b>haben</b>.`
      });
    }
    const regel = REGELMAESSIG.includes(v);
    const falsch = regel ? [v[2], "ge" + v[0]] : ["ge" + stamm(v[0]) + "t", v[2]];
    return pick({
      promptHtml: `${v[5]} ${v[4]} ${v[6]} ___.<span class="sub">Partizip von «${v[0]}»</span>`, prompt: `${v[5]} ${v[4]} ${v[6]} ___.`,
      answer: v[3], options: [v[3], ...falsch],
      explain: `${satz}<br>${reihe(v)}<br>💡 ` + (regel ? "Regelmässig: <b>ge- … -t</b>." : "Unregelmässig: oft <b>ge- … -en</b> und ein anderer Stammvokal.")
    });
  }

  /* ---------------- Rechtschreibung: [Satz mit ___ oder null, richtig, [falsch], Tipp] ---------------- */
  const DOPPEL = "Nach einem <b>kurzen</b> Vokal hört man nur einen Konsonanten → er wird verdoppelt.";
  const RECHTSCHREIBUNG = {
    warmup: [
      [null, "Ball", ["Bal"], DOPPEL + " Ba<b>ll</b>"],
      [null, "kommen", ["komen"], DOPPEL + " ko<b>mm</b>en"],
      [null, "Sonne", ["Sone"], DOPPEL + " So<b>nn</b>e"],
      [null, "Schiff", ["Schif"], DOPPEL + " Schi<b>ff</b>"],
      [null, "Mutter", ["Muter"], DOPPEL + " Mu<b>tt</b>er"],
      [null, "schwimmen", ["schwimen"], DOPPEL + " schwi<b>mm</b>en"],
      [null, "Wasser", ["Waser"], DOPPEL + " Wa<b>ss</b>er"],
      [null, "Hut", ["Hutt"], "Nach einem <b>langen</b> Vokal steht nur ein Konsonant: H<b>u</b>t."],
      [null, "Hose", ["Hosse"], "Nach einem <b>langen</b> Vokal steht nur ein Konsonant: H<b>o</b>se."],
      [null, "Biene", ["Bine"], "Ein langes i schreibt man meistens <b>ie</b>: B<b>ie</b>ne."],
      [null, "spielen", ["spilen"], "Ein langes i schreibt man meistens <b>ie</b>: sp<b>ie</b>len."],
      [null, "Tiger", ["Tieger"], "Ausnahme! Tiger schreibt man mit einfachem <b>i</b>."]
    ],
    practice: [
      [null, "Strasse", ["Strase", "Straße"], "In der Schweiz schreibt man nie ß, sondern immer <b>ss</b>."],
      [null, "gross", ["gros", "groß"], "In der Schweiz schreibt man nie ß, sondern immer <b>ss</b>."],
      [null, "Fuss", ["Fus", "Fuß"], "In der Schweiz schreibt man nie ß, sondern immer <b>ss</b>."],
      [null, "Haus", ["Hauss"], "Verlängern: Häu<b>s</b>er – man hört ein weiches s → nur ein <b>s</b>."],
      [null, "Glas", ["Glass"], "Verlängern: Glä<b>s</b>er – man hört ein weiches s → nur ein <b>s</b>."],
      [null, "Katze", ["Kaze"], "Nach einem kurzen Vokal schreibt man <b>tz</b>: Ka<b>tz</b>e."],
      [null, "Brücke", ["Brüke"], "Nach einem kurzen Vokal schreibt man <b>ck</b>: Brü<b>ck</b>e."],
      [null, "Zucker", ["Zuker"], "Nach einem kurzen Vokal schreibt man <b>ck</b>: Zu<b>ck</b>er."],
      [null, "Onkel", ["Onckel"], "Nach l, n, r steht nie ck oder tz: O<b>nk</b>el."],
      [null, "Herz", ["Hertz"], "Nach l, n, r steht nie ck oder tz: He<b>rz</b>."],
      ["Ich freue mich ___.", "aufs Lesen", ["aufs lesen"], "Mit einem Begleiter (aufs = auf das) wird das Verb zum Nomen → gross."],
      ["Wir treffen uns ___.", "am Morgen", ["am morgen"], "Mit einem Begleiter (am = an dem) ist <i>Morgen</i> ein Nomen → gross."]
    ],
    challenge: [
      ["Ich weiss, ___ du kommst.", "dass", ["das"], "Man kann nicht <i>dieses</i> oder <i>welches</i> einsetzen → <b>dass</b>."],
      ["___ Velo ist neu.", "Das", ["Dass"], "Man kann <i>dieses</i> einsetzen (Dieses Velo) → <b>das</b>."],
      ["Das Buch, ___ ich lese, ist spannend.", "das", ["dass"], "Man kann <i>welches</i> einsetzen → <b>das</b>."],
      ["Ich hoffe, ___ es morgen schneit.", "dass", ["das"], "Man kann nicht <i>dieses</i> oder <i>welches</i> einsetzen → <b>dass</b>."],
      ["Er sagt, ___ er müde ist.", "dass", ["das"], "Man kann nicht <i>dieses</i> oder <i>welches</i> einsetzen → <b>dass</b>."],
      ["Siehst du ___ Haus dort?", "das", ["dass"], "Man kann <i>dieses</i> einsetzen → <b>das</b>."],
      ["Das Lied, ___ wir singen, ist schön.", "das", ["dass"], "Man kann <i>welches</i> einsetzen → <b>das</b>."],
      ["Ich wünsche dir ___.", "etwas Schönes", ["etwas schönes"], "Nach <i>etwas, nichts, viel, alles</i> wird das Adjektiv zum Nomen → gross."],
      ["Im Zoo gab es ___.", "viel Neues", ["viel neues"], "Nach <i>etwas, nichts, viel, alles</i> wird das Adjektiv zum Nomen → gross."],
      [null, "Maschine", ["Maschiene"], "Fremdwort: langes i ohne e. Ma-schi-ne."],
      [null, "Vogel", ["Fogel"], "Merkwort mit <b>V</b>: Vogel, Vater, viel, vier, vor."],
      [null, "Rhythmus", ["Rytmus", "Rhytmus"], "Merkwort: R-<b>h</b>-y-t-<b>h</b>-m-u-s."]
    ]
  };

  function rechtschreibQuestion(level){
    const [satz, richtig, falsch, tipp] = choice(RECHTSCHREIBUNG[level]);
    return pick({
      prompt: satz || "Welches Wort ist richtig geschrieben?",
      answer: richtig, options: [richtig, ...falsch],
      explain: (satz ? `${satz.replace("___", "<b>" + richtig + "</b>")}` : `<b>${richtig}</b>`) + `<br>💡 ${tipp}`
    });
  }

  /* ---------------- Satzzeichen: direkte Rede und Komma ---------------- */
  const SPRECHER = ["Mia", "Leo", "Lena", "Tim", "Oma", "die Lehrerin"];
  const REDEN = {
    aussage: { verb: "sagt", zeichen: ".", texte: ["Ich komme mit", "Heute ist es kalt", "Der Bus ist zu spät", "Ich habe Hunger"] },
    frage:   { verb: "fragt", zeichen: "?", texte: ["Kommst du mit", "Wo ist mein Etui", "Hast du Hunger", "Wann fährt der Zug"] },
    ausruf:  { verb: "ruft", zeichen: "!", texte: ["Pass auf", "Komm schnell", "Das ist super", "Hilfe"] }
  };
  const gross = s => s[0].toUpperCase() + s.slice(1);
  const KOMMA = [
    ["Ich bleibe zu Hause, weil ich krank bin.", ["Ich bleibe zu Hause weil ich krank bin.", "Ich bleibe, zu Hause weil ich krank bin."], "Zwischen zwei Verbgruppen steht ein Komma: <i>…bleibe…, weil…bin.</i>"],
    ["Wenn es regnet, nehme ich den Schirm.", ["Wenn es regnet nehme ich den Schirm.", "Wenn es, regnet nehme ich den Schirm."], "Zwischen zwei Verbgruppen steht ein Komma: <i>…regnet, nehme…</i>"],
    ["Ich weiss, dass du recht hast.", ["Ich weiss dass du recht hast.", "Ich weiss dass, du recht hast."], "Vor <i>dass</i> steht immer ein Komma."],
    ["Lena lacht, als sie den Clown sieht.", ["Lena lacht als sie den Clown sieht.", "Lena lacht als, sie den Clown sieht."], "Zwischen zwei Verbgruppen steht ein Komma: <i>…lacht, als…sieht.</i>"],
    ["Wir gehen baden, denn es ist heiss.", ["Wir gehen baden denn es ist heiss.", "Wir gehen, baden denn es ist heiss."], "Vor <i>denn</i> und <i>aber</i> steht ein Komma."],
    ["Er fragt, ob wir mitkommen.", ["Er fragt ob wir mitkommen.", "Er fragt ob, wir mitkommen."], "Zwischen zwei Verbgruppen steht ein Komma: <i>…fragt, ob…mitkommen.</i>"],
    ["Ich esse Brot, Käse und Äpfel.", ["Ich esse Brot, Käse, und Äpfel.", "Ich esse Brot Käse und Äpfel."], "Bei Aufzählungen steht ein Komma, aber nicht vor <i>und</i>."],
    ["Der Hund, der dort bellt, gehört Tim.", ["Der Hund der dort bellt gehört Tim.", "Der Hund, der dort bellt gehört Tim."], "Ein eingeschobener Satz wird vorne <b>und</b> hinten mit Komma abgetrennt."]
  ];

  function satzzeichenQuestion(level){
    if (level === "challenge" && Math.random() < 0.6) {
      const [richtig, falsch, tipp] = choice(KOMMA);
      return pick({
        prompt: "Wo stehen die Kommas richtig?", answer: richtig, options: [richtig, ...falsch],
        explain: `<b>${richtig}</b><br>💡 ${tipp}`
      });
    }
    const art = level === "warmup" ? "aussage" : choice(Object.keys(REDEN));
    const { verb, zeichen, texte } = REDEN[art];
    const wer = choice(SPRECHER), text = choice(texte);
    let richtig, falsch, tipp;
    if (level === "warmup") {
      richtig = `${gross(wer)} ${verb}: «${text}${zeichen}»`;
      falsch = [`${gross(wer)} ${verb} «${text}${zeichen}»`, `${gross(wer)} ${verb}: «${text}»${zeichen}`, `${gross(wer)} ${verb}: ${text}${zeichen}`];
      tipp = "Begleitsatz vorne: Doppelpunkt, dann die Rede in «…». Der Punkt steht <b>in</b> den Anführungszeichen.";
    } else {
      const innen = zeichen === "." ? "" : zeichen;
      richtig = `«${text}${innen}», ${verb} ${wer}.`;
      falsch = [
        zeichen === "." ? `«${text}.», ${verb} ${wer}.` : `«${text}», ${verb} ${wer}${zeichen}`,
        `«${text}${innen}» ${verb} ${wer}.`,
        `«${text}${innen}», ${gross(verb)} ${wer}.`
      ];
      tipp = zeichen === "."
        ? "Begleitsatz hinten: Der Punkt der Rede fällt weg, nach » kommt ein Komma."
        : `Begleitsatz hinten: Das ${zeichen === "?" ? "Fragezeichen" : "Ausrufezeichen"} bleibt in «…», danach kommt trotzdem ein Komma.`;
    }
    return pick({
      prompt: "Welcher Satz ist richtig?", answer: richtig, options: [richtig, ...falsch],
      explain: `<b>${richtig}</b><br>💡 ${tipp}`
    });
  }

  /* ---------------- Morpheme: [Wort, [Vormorpheme], Stamm, [Nachmorpheme], Tipp] ---------------- */
  const MORPHEME = {
    warmup: [
      ["Spieler", [], "spiel", ["er"]], ["Freiheit", [], "frei", ["heit"]], ["Kindheit", [], "kind", ["heit"]],
      ["lesbar", [], "les", ["bar"]], ["glücklich", [], "glück", ["lich"]], ["Wanderung", [], "wander", ["ung"]],
      ["Fahrer", [], "fahr", ["er"]], ["hilflos", [], "hilf", ["los"]], ["Mannschaft", [], "mann", ["schaft"]],
      ["Lehrerin", [], "lehr", ["er", "in"]]
    ],
    practice: [
      ["unfreundlich", ["un"], "freund", ["lich"]], ["Verpackung", ["ver"], "pack", ["ung"]],
      ["Entdeckung", ["ent"], "deck", ["ung"]], ["Erzählung", ["er"], "zähl", ["ung"]],
      ["Besucher", ["be"], "such", ["er"]], ["unglücklich", ["un"], "glück", ["lich"]],
      ["Zerstörung", ["zer"], "stör", ["ung"]], ["vergesslich", ["ver"], "gess", ["lich"]],
      ["untrinkbar", ["un"], "trink", ["bar"]], ["Abfahrt", ["ab"], "fahr", ["t"]]
    ],
    challenge: [
      ["Unfreundlichkeit", ["un"], "freund", ["lich", "keit"]], ["Erfindung", ["er"], "find", ["ung"]],
      ["Verkäuferin", ["ver"], "käuf", ["er", "in"], "Der Stamm ist <b>kauf</b>, hier mit Umlaut: <b>käuf</b>."],
      ["Unsicherheit", ["un"], "sicher", ["heit"]], ["Bewohnerin", ["be"], "wohn", ["er", "in"]],
      ["Entschuldigung", ["ent"], "schuld", ["ig", "ung"]], ["unvergesslich", ["un", "ver"], "gess", ["lich"]],
      ["Ungeduld", ["un", "ge"], "duld", []], ["Beleuchtung", ["be"], "leucht", ["ung"]],
      ["Häuschen", [], "häus", ["chen"], "Der Stamm ist <b>haus</b>, hier mit Umlaut: <b>häus</b>."]
    ]
  };

  function morphemQuestion(level){
    const [wort, vor, st, nach, extra] = choice(MORPHEME[level]);
    const kinds = ["stamm"];
    if (level !== "warmup" && vor.length) kinds.push("vor");
    if (level !== "warmup" && nach.length) kinds.push("nach");
    const kind = choice(kinds);
    const vorStr = vor.join(""), nachStr = nach.join("");
    let frage, answer, options;
    if (kind === "stamm") {
      frage = "Wie heisst das Stammmorphem?";
      answer = st;
      options = [st, vorStr + st, st + (nach[0] || ""), vorStr || nachStr || st.slice(0, -1)];
    } else if (kind === "vor") {
      frage = vor.length > 1 ? "Welches ist ein Vormorphem?" : "Wie heisst das Vormorphem?";
      answer = vor[0];
      options = [vor[0], vorStr + st, st, nach[0] || st + "en"];
    } else {
      frage = nach.length > 1 ? "Welches ist das letzte Nachmorphem?" : "Wie heisst das Nachmorphem?";
      answer = nach[nach.length - 1];
      options = [answer, st, st + nachStr, vor[0] || st.slice(0, -1)];
    }
    const others = [...new Set(options)].filter(o => o && o !== answer);
    const teile = [...vor.map(m => `<span class="m-pre">${m}</span>`), `<span class="m-stem">${st}</span>`, ...nach.map(m => `<span class="m-suf">${m}</span>`)];
    return pick({
      promptHtml: `«${wort}»<span class="sub">${frage}</span>`, prompt: wort,
      answer, options: [answer, ...others.slice(0, 3)],
      explain: `${teile.join(" | ")}<br>` +
        `<span class="m-pre">Vormorphem</span> · <span class="m-stem">Stammmorphem</span> · <span class="m-suf">Nachmorphem</span>` +
        (extra ? `<br>💡 ${extra}` : "")
    });
  }

  /* ---------------- topics ---------------- */
  const TOPICS = [
    {
      id: "wortarten", label: "Wortarten", icon: "🧩", title: "Welche Wortart ist das?",
      levelDesc: { warmup: "Nomen, Verb, Adjektiv", practice: "Nomen, Verb, Adjektiv – mit Stolpersteinen", challenge: "Alle fünf: auch Pronomen und Partikel" },
      hint: "Mach die Probe: Artikelprobe, Personalform-Probe, Vergleichsprobe.",
      generate: wortartQuestion
    },
    {
      id: "faelle", label: "Die 4 Fälle", icon: "🎯", title: "In welchem Fall?",
      levelDesc: { warmup: "Nominativ und Akkusativ", practice: "…dazu der Dativ", challenge: "Alle vier, auch der Genitiv" },
      hint: "Frag: Wer oder was? Wen oder was? Wem? Wessen?",
      generate: fallQuestion
    },
    {
      id: "verben", label: "Verben", icon: "🏃", title: "Verben und Zeitformen",
      levelDesc: { warmup: "Regelmässig oder unregelmässig? Präteritum", practice: "Unregelmässige Verben im Präteritum", challenge: "Perfekt: hat oder ist? Partizip" },
      hint: "Sag die Reihe auf: gehen – ging – ist gegangen.",
      generate: verbQuestion
    },
    {
      id: "rechtschreibung", label: "Rechtschreibung", icon: "✍️", title: "Richtig geschrieben?",
      levelDesc: { warmup: "Doppelkonsonanten-Regel und ie", practice: "ss, ck, tz und Grossschreibung", challenge: "das oder dass? Merkwörter" },
      hint: "Sprich das Wort langsam: Ist der Vokal kurz oder lang?",
      generate: rechtschreibQuestion
    },
    {
      id: "satzzeichen", label: "Satzzeichen", icon: "💬", title: "Satzzeichen setzen",
      levelDesc: { warmup: "Direkte Rede: Begleitsatz vorne", practice: "Direkte Rede: Begleitsatz hinten", challenge: "Kommas zwischen Verbgruppen" },
      hint: "Schau genau auf : « » , und .",
      generate: satzzeichenQuestion
    },
    {
      id: "morpheme", label: "Morpheme", icon: "🧱", title: "Wörterwerkstatt",
      levelDesc: { warmup: "Das Stammmorphem finden", practice: "Vor- und Nachmorpheme", challenge: "Lange Wörter zerlegen" },
      hint: "Vormorphem | Stammmorphem | Nachmorphem: un | freund | lich.",
      generate: morphemQuestion
    }
  ];

  const store = Hub.store;
  if (!store.german) store.german = {};

  Notebook.register({
    id: "german", title: "Deutsch Dash", icon: "🥨",
    blurb: "Deutsch für die 5. Klasse, wie in den Sprachstarken 5: Wortarten, Fälle, Verben, Rechtschreibung.",
    unit: "/// ein Deutsch-Übungsheft",
    tagline: "Deutsch für die 5. Klasse, passend zu den Sprachstarken 5, mit einem Tipp zu jeder Antwort",
    taglineFor: "für",
    nameFallback: "dich",
    subject: "German",
    wordy: true,
    verdicts: { right: "Richtig!", wrong: "Nicht ganz – richtig ist:" },
    data: store.german,
    badgePrefix: "de-",
    badgeNames: {
      first: ["⭐", "Los geht's!"], streak5: ["🔥", "Super!"], streak10: ["🚀", "Fantastisch!"],
      streak25: ["⚡", "Wunderbar!"], race1: ["🏁", "Schnell!"], race5: ["🏆", "Champion"],
      race20: ["👑", "Legende"], trial: ["⏱️", "Blitz"], challenge: ["💪", "Stark!"],
      century: ["💯", "Hundert!"]
    },
    topics: TOPICS,
    // the Fehlerteufel-Jagd above the questions: run through Switzerland, ahead of the mistake devil
    scene: el => DeutschDash(el, store.german.dash = store.german.dash || {})
  });
})();
