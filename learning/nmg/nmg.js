/* NMG Entdecker: Natur, Mensch, Gesellschaft für die 5. Klasse in Zug (Lehrplan 21, Zyklus 2).
   Kantone, Schweizer Geografie, Geschichte, Mensch und Körper, Tiere und Pflanzen, Natur und Technik,
   mit vielen Beispielen aus Zug und Baar, und einem Tipp zu jeder Antwort. */
(function(){
  "use strict";
  const { pick, sample, choice } = Notebook;

  // a question from a list: [Frage, Antwort, [falsche Antworten], Tipp]
  function fromList(list){
    const [frage, antwort, falsch, tipp] = choice(list);
    return pick({
      prompt: frage, answer: antwort, options: [antwort, ...falsch],
      explain: `<b>${antwort}</b><br>💡 ${tipp}`
    });
  }

  /* ---------------- Kantone: [Name, Kürzel, Hauptort, Sprache] ---------------- */
  const KANTONE = [
    ["Zürich", "ZH", "Zürich", "Deutsch"], ["Bern", "BE", "Bern", "Deutsch und Französisch"], ["Luzern", "LU", "Luzern", "Deutsch"],
    ["Uri", "UR", "Altdorf", "Deutsch"], ["Schwyz", "SZ", "Schwyz", "Deutsch"], ["Obwalden", "OW", "Sarnen", "Deutsch"],
    ["Nidwalden", "NW", "Stans", "Deutsch"], ["Glarus", "GL", "Glarus", "Deutsch"], ["Zug", "ZG", "Zug", "Deutsch"],
    ["Freiburg", "FR", "Freiburg", "Französisch und Deutsch"], ["Solothurn", "SO", "Solothurn", "Deutsch"], ["Basel-Stadt", "BS", "Basel", "Deutsch"],
    ["Basel-Landschaft", "BL", "Liestal", "Deutsch"], ["Schaffhausen", "SH", "Schaffhausen", "Deutsch"], ["Appenzell Ausserrhoden", "AR", "Herisau", "Deutsch"],
    ["Appenzell Innerrhoden", "AI", "Appenzell", "Deutsch"], ["St. Gallen", "SG", "St. Gallen", "Deutsch"], ["Graubünden", "GR", "Chur", "Deutsch, Rätoromanisch und Italienisch"],
    ["Aargau", "AG", "Aarau", "Deutsch"], ["Thurgau", "TG", "Frauenfeld", "Deutsch"], ["Tessin", "TI", "Bellinzona", "Italienisch"],
    ["Waadt", "VD", "Lausanne", "Französisch"], ["Wallis", "VS", "Sitten", "Französisch und Deutsch"], ["Neuenburg", "NE", "Neuenburg", "Französisch"],
    ["Genf", "GE", "Genf", "Französisch"], ["Jura", "JU", "Delsberg", "Französisch"]
  ];
  const ZENTRALSCHWEIZ = ["LU", "UR", "SZ", "OW", "NW", "ZG"];
  const ZUG_NACHBARN = ["ZH", "SZ", "LU", "AG"];

  function kantonQuestion(level){
    const pool = level === "warmup" ? KANTONE.filter(k => ZENTRALSCHWEIZ.includes(k[1])) : KANTONE;
    if (level === "challenge" && Math.random() < 0.5) {
      if (Math.random() < 0.5) {
        const nicht = choice(KANTONE.filter(k => !ZUG_NACHBARN.includes(k[1]) && k[1] !== "ZG"));
        const opts = [nicht[0], ...sample(KANTONE.filter(k => ZUG_NACHBARN.includes(k[1])), 3).map(k => k[0])];
        return pick({
          prompt: "Welcher Kanton grenzt NICHT an den Kanton Zug?", answer: nicht[0], options: opts,
          explain: `<b>${nicht[0]}</b><br>💡 Zug hat vier Nachbarkantone: Zürich, Schwyz, Luzern und Aargau.`
        });
      }
      const sprachen = [["Italienisch", "TI"], ["Französisch", "GE"], ["Französisch", "JU"], ["Rätoromanisch", "GR"], ["Französisch", "NE"]];
      const [sprache, kz] = choice(sprachen);
      const k = KANTONE.find(x => x[1] === kz);
      const andere = sample(KANTONE.filter(x => !x[3].includes(sprache) && x[3] === "Deutsch"), 3).map(x => x[0]);
      return pick({
        prompt: `In welchem Kanton spricht man ${sprache}?`, answer: k[0], options: [k[0], ...andere],
        explain: `<b>${k[0]}</b> (${k[1]}): ${k[3]}<br>💡 Die Schweiz hat vier Landessprachen: Deutsch, Französisch, Italienisch und Rätoromanisch.`
      });
    }
    // Hauptort fragen, wenn er anders heisst als der Kanton; sonst das Kürzel
    const k = choice(pool);
    if (k[0] !== k[2] && Math.random() < 0.6) {
      const falsch = sample(KANTONE.filter(x => x !== k && x[2] !== k[2]), 3).map(x => x[2]);
      return pick({
        prompt: `Wie heisst der Hauptort des Kantons ${k[0]}?`, answer: k[2], options: [k[2], ...falsch],
        explain: `Der Hauptort von <b>${k[0]}</b> (${k[1]}) ist <b>${k[2]}</b>.`
      });
    }
    const falsch = sample((level === "warmup" ? pool : KANTONE).filter(x => x !== k), 3).map(x => x[0]);
    return pick({
      prompt: `Welcher Kanton hat das Kürzel ${k[1]}?`, answer: k[0], options: [k[0], ...falsch],
      explain: `<b>${k[1]}</b> = ${k[0]}. Das Kürzel siehst du auf jedem Autonummernschild!`
    });
  }

  /* ---------------- Schweizer Geografie ---------------- */
  const GEOGRAFIE = {
    warmup: [
      ["Wie heisst die Bundesstadt der Schweiz?", "Bern", ["Zürich", "Genf", "Luzern"], "In Bern stehen das Bundeshaus und die Regierung der Schweiz."],
      ["Welcher See liegt bei Baar?", "Zugersee", ["Bodensee", "Genfersee", "Thunersee"], "Der Zugersee liegt zwischen Zug, Cham, Risch und der Rigi."],
      ["Welcher Fluss fliesst durch Baar?", "Lorze", ["Reuss", "Aare", "Rhein"], "Die Lorze kommt aus dem Ägerisee, fliesst durch das Lorzentobel und Baar und dann in den Zugersee."],
      ["Wie viele Landessprachen hat die Schweiz?", "4", ["2", "3", "5"], "Deutsch, Französisch, Italienisch und Rätoromanisch."],
      ["Wie viele Kantone hat die Schweiz?", "26", ["20", "24", "30"], "26 Kantone bilden zusammen die Schweiz."],
      ["Welches Land ist KEIN Nachbarland der Schweiz?", "Spanien", ["Deutschland", "Italien", "Österreich"], "Die Nachbarn sind Deutschland, Frankreich, Italien, Österreich und Liechtenstein."],
      ["Welche Höhlen kann man in Baar besuchen?", "Höllgrotten", ["Beatushöhlen", "Hölloch", "Grotte di Rescia"], "Die Höllgrotten liegen im Lorzentobel bei Baar – mit Tropfsteinen!"],
      ["Welcher Berg liegt gleich über der Stadt Zug?", "Zugerberg", ["Pilatus", "Säntis", "Eiger"], "Auf den Zugerberg fährt eine Standseilbahn."],
      ["Wie heisst die grösste Stadt der Schweiz?", "Zürich", ["Bern", "Basel", "Lausanne"], "Zürich hat mehr als 400 000 Einwohnerinnen und Einwohner."],
      ["Am 1. August feiert die Schweiz …", "den Nationalfeiertag", ["Weihnachten", "Ostern", "das Sechseläuten"], "Am 1. August gibt es Höhenfeuer und Lampions."]
    ],
    practice: [
      ["Welche drei Grossräume hat die Schweiz?", "Jura, Mittelland, Alpen", ["Jura, Seen, Berge", "Norden, Mitte, Süden", "Alpen, Voralpen, Tessin"], "Baar liegt im Mittelland, ganz nahe bei den Voralpen."],
      ["In welches Meer fliesst der Rhein?", "Nordsee", ["Mittelmeer", "Schwarzes Meer", "Ostsee"], "Der Rhein fliesst durch Deutschland und die Niederlande in die Nordsee."],
      ["In welches Meer fliesst die Rhone?", "Mittelmeer", ["Nordsee", "Atlantik", "Schwarzes Meer"], "Die Rhone fliesst durch den Genfersee und Frankreich ins Mittelmeer."],
      ["Wo ist der Rheinfall?", "bei Schaffhausen", ["bei Basel", "bei Chur", "bei Luzern"], "Der Rheinfall bei Neuhausen am Rheinfall (SH) ist der grösste Wasserfall Mitteleuropas."],
      ["Welcher Fluss ist der längste, der ganz in der Schweiz fliesst?", "Aare", ["Rhein", "Reuss", "Lorze"], "Die Aare ist 295 km lang und fliesst bei Koblenz (AG) in den Rhein."],
      ["Welcher See ist der grösste, der ganz in der Schweiz liegt?", "Neuenburgersee", ["Zugersee", "Vierwaldstättersee", "Zürichsee"], "Der Genfersee ist grösser, gehört aber auch zu Frankreich."],
      ["In welchem Kanton steht das Matterhorn?", "Wallis", ["Graubünden", "Bern", "Uri"], "Das Matterhorn (4478 m) steht bei Zermatt im Wallis."],
      ["Welcher Berg liegt zwischen Zugersee und Vierwaldstättersee?", "Rigi", ["Pilatus", "Titlis", "Säntis"], "Die Rigi heisst «Königin der Berge». Die erste Bergbahn Europas fuhr hier."],
      ["In welchem Teil der Schweiz liegt Genf?", "im Südwesten", ["im Nordosten", "im Süden", "in der Mitte"], "Genf liegt ganz im Südwesten, am Ende des Genfersees."],
      ["In welchem Teil der Schweiz liegt das Tessin?", "im Süden", ["im Norden", "im Westen", "im Osten"], "Das Tessin liegt südlich der Alpen und grenzt an Italien."],
      ["Wie heisst der grösste Gletscher der Alpen?", "Aletschgletscher", ["Rhonegletscher", "Morteratschgletscher", "Gornergletscher"], "Der Aletschgletscher im Wallis ist etwa 20 km lang."],
      ["Welcher See liegt auch im Kanton Zug?", "Ägerisee", ["Sihlsee", "Sempachersee", "Walensee"], "Der Ägerisee liegt bei Ober- und Unterägeri."]
    ],
    challenge: [
      ["Wie heisst der höchste Berg der Schweiz?", "Dufourspitze", ["Matterhorn", "Eiger", "Jungfrau"], "Die Dufourspitze im Monte-Rosa-Massiv ist 4634 m hoch."],
      ["Wie lang ist der Gotthard-Basistunnel?", "57 km", ["17 km", "27 km", "100 km"], "Er ist der längste Eisenbahntunnel der Welt und wurde 2016 eröffnet."],
      ["Wohin fliesst das Wasser des Inn?", "ins Schwarze Meer", ["in die Nordsee", "ins Mittelmeer", "in die Adria"], "Der Inn fliesst vom Engadin in die Donau, und die Donau ins Schwarze Meer."],
      ["Woher kommt die Reuss?", "vom Gotthard", ["aus dem Bodensee", "vom Säntis", "aus dem Jura"], "Die Reuss fliesst vom Gotthard durch Uri, den Vierwaldstättersee und Luzern."],
      ["Wie heissen die Bergketten im Nordwesten der Schweiz?", "Jura", ["Voralpen", "Engadin", "Emmental"], "Der Jura zieht sich von Genf bis nach Schaffhausen."],
      ["Welches ist der flächengrösste Kanton?", "Graubünden", ["Bern", "Wallis", "Zürich"], "Graubünden ist mit 7105 km² grösser als Bern oder Wallis."],
      ["Welches ist der flächenkleinste Kanton?", "Basel-Stadt", ["Zug", "Appenzell Innerrhoden", "Genf"], "Zug ist der drittkleinste Kanton."],
      ["Welcher Pass verbindet Uri mit dem Tessin?", "Gotthardpass", ["Julierpass", "Grimselpass", "Brünigpass"], "Über den Gotthard führen Strasse, Bahn und Tunnel in den Süden."],
      ["In welche Richtung fliesst die Lorze vom Ägerisee aus?", "nach Nordwesten, Richtung Baar", ["nach Süden, Richtung Schwyz", "nach Osten, Richtung Zürich", "nach Westen, Richtung Bern"], "Vom Ägerisee fliesst die Lorze durchs Lorzentobel nach Baar und weiter in den Zugersee."],
      ["Auf welchem Höhenniveau liegt der Zugersee etwa?", "413 m ü. M.", ["113 m ü. M.", "913 m ü. M.", "1413 m ü. M."], "«ü. M.» heisst «über Meer» – also über dem Meeresspiegel."]
    ]
  };

  /* ---------------- Geschichte ---------------- */
  const GESCHICHTE = {
    warmup: [
      ["Wo bauten die Pfahlbauer ihre Häuser?", "am Ufer von Seen", ["auf Bergspitzen", "in Höhlen", "in Bäumen"], "Sie bauten Häuser auf Pfählen an Seeufern – auch am Zugersee!"],
      ["Wer lebte in einer Burg?", "ein Ritter mit seiner Familie", ["die Pfahlbauer", "die Römer", "die Mönche"], "Im Mittelalter wohnten Ritter und Adlige in Burgen."],
      ["Welche Sprache sprachen die Römer?", "Latein", ["Griechisch", "Deutsch", "Englisch"], "Viele Wörter kommen aus dem Latein, z. B. «Fenster» von «fenestra»."],
      ["Wer schoss laut der Sage einen Apfel vom Kopf seines Sohnes?", "Wilhelm Tell", ["Winkelried", "Julius Cäsar", "Karl der Grosse"], "Die Tell-Sage spielt in Altdorf im Kanton Uri."],
      ["Wie heisst die Wiese, auf der sich die Eidgenossen laut der Sage trafen?", "Rütli", ["Morgarten", "Sempach", "Bundesplatz"], "Das Rütli liegt am Urnersee."],
      ["Was ist eine Zugbrücke?", "eine Brücke, die man hochziehen kann", ["eine Brücke für Züge", "eine Brücke aus Zug", "eine Hängebrücke"], "Mit der Zugbrücke über den Burggraben schützte man die Burg vor Feinden."],
      ["Wer schrieb im Mittelalter Bücher von Hand ab?", "Mönche im Kloster", ["Ritter", "Bauern", "Könige"], "Darum waren Bücher damals sehr wertvoll – zum Beispiel im Kloster Einsiedeln."],
      ["Was feiern wir am 1. August?", "die Gründung der Eidgenossenschaft", ["das Ende des Winters", "die Römer", "den ersten Zug"], "Der 1. August erinnert an den Bundesbrief von 1291."]
    ],
    practice: [
      ["In welchem Jahr wurde der Bundesbrief geschrieben?", "1291", ["1191", "1315", "1848"], "Uri, Schwyz und Unterwalden versprachen sich gegenseitig Hilfe."],
      ["Welche drei Orte schlossen 1291 den Bund?", "Uri, Schwyz, Unterwalden", ["Zug, Luzern, Zürich", "Bern, Genf, Basel", "Uri, Zug, Glarus"], "Man nennt sie die «Urkantone» oder «Waldstätte»."],
      ["Wo fand 1315 die Schlacht am Morgarten statt?", "am Ägerisee", ["am Bodensee", "in Basel", "auf dem Gotthard"], "Die Eidgenossen besiegten dort die Habsburger – ganz nahe bei Baar!"],
      ["Wann trat Zug der Eidgenossenschaft bei?", "1352", ["1291", "1515", "1848"], "Zug war einer der ersten Orte, die dazukamen."],
      ["Wie hiessen die Kelten, die vor den Römern in der Schweiz lebten?", "Helvetier", ["Germanen", "Wikinger", "Etrusker"], "Darum heisst die Schweiz auf Latein «Helvetia» – das steht auf unseren Münzen!"],
      ["Wie hiess eine grosse Römerstadt bei Basel?", "Augusta Raurica", ["Rom", "Aventicum", "Turicum"], "Augusta Raurica bei Augst (BL) hat ein grosses Theater."],
      ["Was brachten die Römer in die Schweiz?", "Strassen, Bäder und Steinhäuser", ["Autos und Strom", "Kartoffeln und Schokolade", "Pfahlbauten"], "Die Römer bauten gute Strassen und warme Bäder (Thermen)."],
      ["Wie wurde ein Junge zum Ritter? Zuerst war er …", "Page, dann Knappe", ["Mönch, dann König", "Bauer, dann Händler", "Knappe, dann Page"], "Mit etwa 7 Jahren Page, mit 14 Knappe und mit 21 Ritter."],
      ["Wie heisst der Hauptturm einer Burg?", "Bergfried", ["Palas", "Zinne", "Kapelle"], "Der Bergfried war der höchste und stärkste Turm, die letzte Zuflucht."]
    ],
    challenge: [
      ["Was war zuerst?", "die Pfahlbauer", ["die Römer", "die Ritter", "der Bundesbrief"], "Pfahlbauer (ab 4000 v. Chr.) → Römer → Ritter im Mittelalter → Bundesbrief 1291."],
      ["Was war zuletzt?", "der Bundesstaat von 1848", ["die Schlacht am Morgarten", "der Bundesbrief", "die Römerzeit"], "1848 bekam die Schweiz ihre Bundesverfassung, und Bern wurde Bundesstadt."],
      ["Was bedeutet «v. Chr.»?", "vor Christi Geburt", ["vor Christoph", "viel Chronik", "vom Christentum"], "Jahre vor Christi Geburt zählt man rückwärts: 100 v. Chr. ist früher als 50 v. Chr."],
      ["Was war früher: 58 v. Chr. oder 15 n. Chr.?", "58 v. Chr.", ["15 n. Chr.", "beides gleich", "man kann es nicht wissen"], "58 v. Chr. besiegte Julius Cäsar die Helvetier bei Bibracte. 15 n. Chr. war 72 Jahre später (ein Jahr 0 gibt es nicht)."],
      ["Gegen wen kämpften die Eidgenossen am Morgarten?", "die Habsburger", ["die Römer", "die Franzosen", "die Helvetier"], "Die Habsburger waren eine mächtige Adelsfamilie aus dem Aargau."],
      ["Wie heisst das Wohnhaus des Burgherrn in der Burg?", "Palas", ["Bergfried", "Burggraben", "Wehrgang"], "Im Palas gab es den Rittersaal mit Kamin."],
      ["Wie lange ist das Jahr 1291 her (im Jahr 2026)?", "735 Jahre", ["635 Jahre", "835 Jahre", "1291 Jahre"], "2026 − 1291 = 735."],
      ["Wie heisst die Römerstadt Avenches auf Latein?", "Aventicum", ["Augusta Raurica", "Vindonissa", "Turicum"], "Aventicum war die Hauptstadt der Helvetier zur Römerzeit."]
    ]
  };

  /* ---------------- Mensch und Körper ---------------- */
  const KOERPER = {
    warmup: [
      ["Welches Organ pumpt das Blut durch den Körper?", "Herz", ["Lunge", "Magen", "Leber"], "Dein Herz schlägt etwa 80- bis 100-mal pro Minute."],
      ["Mit welchem Organ atmen wir?", "Lunge", ["Herz", "Niere", "Magen"], "Die Lunge holt Sauerstoff aus der Luft."],
      ["Mit welchem Sinnesorgan riechen wir?", "Nase", ["Zunge", "Ohr", "Haut"], "Die fünf Sinne: sehen, hören, riechen, schmecken, tasten."],
      ["Mit welchem Sinnesorgan tasten wir?", "Haut", ["Auge", "Nase", "Zunge"], "Die Haut ist das grösste Organ des Körpers."],
      ["Was schützt das Gehirn?", "der Schädel", ["die Rippen", "die Wirbelsäule", "das Becken"], "Darum trägt man beim Velofahren einen Helm!"],
      ["Wie viele Milchzähne hat ein Kind?", "20", ["10", "32", "28"], "Später bekommst du 32 bleibende Zähne (mit den Weisheitszähnen)."],
      ["Was steht ganz unten in der Lebensmittelpyramide?", "Getränke wie Wasser", ["Süssigkeiten", "Fleisch", "Brot"], "Was unten steht, braucht man am meisten: viel trinken!"],
      ["Was steht ganz oben in der Lebensmittelpyramide?", "Süsses und Snacks", ["Gemüse", "Wasser", "Obst"], "Was oben steht, soll man nur wenig essen."]
    ],
    practice: [
      ["Wo wird das Essen zuerst verdaut, nach dem Mund?", "im Magen", ["in der Lunge", "im Herz", "in der Niere"], "Mund → Speiseröhre → Magen → Dünndarm → Dickdarm."],
      ["Was machen die Nieren?", "Sie reinigen das Blut und bilden Urin", ["Sie pumpen Blut", "Sie denken", "Sie atmen"], "Die zwei Nieren filtern jeden Tag sehr viel Blut."],
      ["Was schützen die Rippen?", "Herz und Lunge", ["das Gehirn", "die Beine", "den Magen allein"], "Die Rippen bilden zusammen den Brustkorb."],
      ["Wie heisst der längste Knochen im Körper?", "Oberschenkelknochen", ["Oberarmknochen", "Schienbein", "Wirbelsäule"], "Der Oberschenkelknochen ist auch einer der stärksten Knochen."],
      ["Wie viele Zähne hat ein Erwachsener (mit Weisheitszähnen)?", "32", ["20", "24", "40"], "Schneidezähne, Eckzähne und Backenzähne."],
      ["Welche Zähne beissen ab?", "Schneidezähne", ["Backenzähne", "Weisheitszähne", "Milchzähne"], "Die Backenzähne zermahlen das Essen."],
      ["Was transportieren die roten Blutkörperchen?", "Sauerstoff", ["Essen", "Gedanken", "Wasser allein"], "Sie bringen Sauerstoff von der Lunge in den ganzen Körper."],
      ["Wo werden Nährstoffe ins Blut aufgenommen?", "im Dünndarm", ["im Mund", "in der Lunge", "im Herz"], "Der Dünndarm ist mehrere Meter lang!"]
    ],
    challenge: [
      ["Wie viele Knochen hat ein Erwachsener etwa?", "206", ["106", "306", "56"], "Babys haben sogar mehr; einige wachsen später zusammen."],
      ["Wo ist der kleinste Knochen des Körpers?", "im Ohr", ["im Finger", "in der Nase", "im Zeh"], "Der Steigbügel im Ohr ist nur etwa 3 mm gross."],
      ["Was machen die weissen Blutkörperchen?", "Sie bekämpfen Krankheitserreger", ["Sie tragen Sauerstoff", "Sie färben das Blut rot", "Sie verdauen Essen"], "Sie sind die Polizei deines Körpers."],
      ["Was passiert, wenn du den Arm beugst?", "Der Bizeps zieht sich zusammen", ["Der Trizeps zieht sich zusammen", "Der Knochen wird kürzer", "Das Herz hört auf"], "Muskeln arbeiten als Paar: Der Bizeps beugt, der Trizeps streckt."],
      ["Was helfen die Blutplättchen?", "eine Wunde zu verschliessen", ["Sauerstoff zu tragen", "zu denken", "zu atmen"], "Sie bilden einen Pfropfen, und es entsteht Schorf."],
      ["Was braucht dein Körper als «Baustoff» für Muskeln?", "Eiweiss", ["Zucker", "Salz", "Farbstoff"], "Eiweiss steckt in Fleisch, Fisch, Eiern, Milch, Bohnen und Linsen."],
      ["Welches Organ steuert den ganzen Körper?", "Gehirn", ["Herz", "Leber", "Lunge"], "Das Gehirn schickt Befehle über die Nerven."],
      ["Was macht die Leber?", "Sie entgiftet das Blut", ["Sie pumpt Blut", "Sie hört", "Sie bewegt die Arme"], "Die Leber ist das grösste innere Organ."]
    ]
  };

  /* ---------------- Tiere und Pflanzen ---------------- */
  const KLASSEN = [
    ["Frosch", "Amphibie"], ["Salamander", "Amphibie"], ["Kröte", "Amphibie"], ["Molch", "Amphibie"],
    ["Wal", "Säugetier"], ["Fledermaus", "Säugetier"], ["Delfin", "Säugetier"], ["Igel", "Säugetier"], ["Murmeltier", "Säugetier"],
    ["Pinguin", "Vogel"], ["Strauss", "Vogel"], ["Eule", "Vogel"], ["Steinadler", "Vogel"],
    ["Eidechse", "Reptil"], ["Schildkröte", "Reptil"], ["Krokodil", "Reptil"], ["Blindschleiche", "Reptil"],
    ["Hai", "Fisch"], ["Forelle", "Fisch"], ["Seepferdchen", "Fisch"], ["Hecht", "Fisch"]
  ];
  const KLASSE_TIPP = {
    "Säugetier": "Säugetiere säugen ihre Jungen mit Milch und haben meistens Fell.",
    "Vogel": "Vögel haben Federn und legen Eier mit harter Schale – auch die, die nicht fliegen.",
    "Reptil": "Reptilien haben trockene Schuppen und legen Eier an Land.",
    "Amphibie": "Amphibien leben zuerst im Wasser (Kaulquappe) und später auch an Land. Ihre Haut ist feucht.",
    "Fisch": "Fische atmen mit Kiemen und haben Schuppen und Flossen."
  };
  const NATUR = {
    warmup: [
      ["Wie viele Beine hat ein Insekt?", "6", ["4", "8", "10"], "Insekten haben 6 Beine und drei Körperteile: Kopf, Brust, Hinterleib."],
      ["Wie viele Beine hat eine Spinne?", "8", ["6", "10", "4"], "Darum ist eine Spinne kein Insekt!"],
      ["Was wird aus einer Raupe?", "ein Schmetterling", ["ein Käfer", "eine Biene", "ein Wurm"], "Raupe → Puppe → Schmetterling. Das heisst Metamorphose."],
      ["Was wird aus einer Kaulquappe?", "ein Frosch", ["ein Fisch", "eine Schlange", "eine Libelle"], "Die Kaulquappe bekommt Beine und verliert den Schwanz."],
      ["Welcher Baum ist ein Nadelbaum?", "Fichte", ["Buche", "Eiche", "Ahorn"], "Fichte und Tanne sind Nadelbäume; Buche, Eiche und Ahorn sind Laubbäume."],
      ["Was fressen Rehe?", "Pflanzen", ["Mäuse", "Fische", "Insekten"], "Rehe sind Pflanzenfresser: Gras, Kräuter, Knospen."],
      ["Was brauchen Pflanzen zum Wachsen?", "Licht, Wasser und Luft", ["nur Erde", "nur Wasser", "Dunkelheit"], "Mit Sonnenlicht machen Pflanzen aus Wasser und Luft ihre Nahrung."]
    ],
    practice: [
      ["Wie heisst die unterste Schicht im Wald?", "Moosschicht", ["Baumschicht", "Strauchschicht", "Krautschicht"], "Von unten: Moosschicht, Krautschicht, Strauchschicht, Baumschicht."],
      ["Welcher Nadelbaum verliert im Herbst seine Nadeln?", "Lärche", ["Fichte", "Tanne", "Föhre"], "Die Lärche wird im Herbst goldgelb und wirft ihre Nadeln ab."],
      ["In der Nahrungskette Gras → Maus → Fuchs: Wer ist der Produzent?", "das Gras", ["die Maus", "der Fuchs", "niemand"], "Pflanzen produzieren ihre Nahrung selbst mit Sonnenlicht."],
      ["Was ist ein Wildschwein?", "ein Allesfresser", ["ein Pflanzenfresser", "ein Fleischfresser", "ein Insekt"], "Wildschweine fressen Eicheln, Wurzeln, Würmer und Mäuse."],
      ["Was ist ein Luchs?", "ein Fleischfresser", ["ein Pflanzenfresser", "ein Allesfresser", "ein Nagetier"], "Der Luchs jagt vor allem Rehe und Gämsen."],
      ["Was produzieren Pflanzen bei der Fotosynthese?", "Sauerstoff und Zucker", ["Kohlendioxid und Salz", "Wasser und Erde", "Strom"], "Den Sauerstoff atmen wir ein!"],
      ["Welches Tier hält Winterschlaf?", "Murmeltier", ["Reh", "Fuchs", "Gämse"], "Das Murmeltier schläft von Oktober bis April in seinem Bau."]
    ],
    challenge: [
      ["Was zersetzt im Wald das Laub zu Erde?", "Würmer, Pilze und Bakterien", ["die Sonne allein", "die Rehe", "der Regen allein"], "Man nennt sie Zersetzer. Sie machen aus Laub neuen Humus."],
      ["Woran erkennt man das Alter eines gefällten Baumes?", "an den Jahrringen", ["an der Höhe", "an den Blättern", "an der Rinde allein"], "Jedes Jahr wächst ein neuer Ring dazu."],
      ["Welche Tiergruppe hat kein inneres Skelett?", "Insekten", ["Vögel", "Fische", "Säugetiere"], "Insekten sind Wirbellose mit einem harten Panzer aussen."],
      ["Was ist eine Schnecke?", "ein Weichtier", ["ein Insekt", "ein Reptil", "eine Amphibie"], "Schnecken und Muscheln sind Weichtiere."],
      ["Welche Teile hat eine Blüte?", "Kelch-, Blüten-, Staub- und Fruchtblätter", ["Wurzel, Stamm, Ast", "Rinde, Holz, Mark", "Nur Blütenblätter"], "In den Staubblättern ist der Pollen, im Fruchtblatt wachsen die Samen."],
      ["Wer bestäubt viele Blüten?", "Bienen und andere Insekten", ["Regenwürmer", "Fische", "Maulwürfe"], "Sie tragen den Pollen von Blüte zu Blüte."]
    ]
  };

  function naturQuestion(level){
    if (Math.random() < 0.4) {
      const [tier, klasse] = choice(KLASSEN);
      return pick({
        prompt: `Zu welcher Tierklasse gehört: ${tier}?`, answer: klasse,
        options: ["Säugetier", "Vogel", "Reptil", "Amphibie", "Fisch"], keepOrder: true,
        explain: `<b>${tier}</b>: ${klasse}<br>💡 ${KLASSE_TIPP[klasse]}`
      });
    }
    return fromList(NATUR[level]);
  }

  /* ---------------- Natur und Technik ---------------- */
  const TECHNIK = {
    warmup: [
      ["Bei wie viel Grad gefriert Wasser?", "0 °C", ["10 °C", "−10 °C", "100 °C"], "Unter 0 °C wird Wasser zu Eis."],
      ["Bei wie viel Grad siedet Wasser?", "100 °C", ["50 °C", "0 °C", "200 °C"], "Beim Sieden wird Wasser zu Wasserdampf."],
      ["Was zieht ein Magnet an?", "eine Büroklammer aus Eisen", ["ein Stück Holz", "einen Glasstein", "ein Gummiband"], "Magnete ziehen Eisen, Nickel und Kobalt an."],
      ["Was schwimmt im Wasser?", "ein Stück Holz", ["ein Stein", "ein Nagel", "eine Münze"], "Holz ist leichter als gleich viel Wasser."],
      ["Wie viele Planeten hat unser Sonnensystem?", "8", ["7", "9", "12"], "Merkur, Venus, Erde, Mars, Jupiter, Saturn, Uranus, Neptun."],
      ["Was ist die Sonne?", "ein Stern", ["ein Planet", "ein Mond", "ein Komet"], "Die Sonne ist der Stern, der uns am nächsten ist."],
      ["Was misst ein Thermometer?", "die Temperatur", ["den Wind", "den Regen", "die Zeit"], "Das Thermometer zeigt Grad Celsius (°C)."]
    ],
    practice: [
      ["Was sind die drei Zustände von Wasser?", "fest, flüssig, gasförmig", ["kalt, warm, heiss", "hart, weich, nass", "klein, mittel, gross"], "Eis ist fest, Wasser flüssig, Wasserdampf gasförmig."],
      ["Was passiert, wenn zwei gleiche Magnetpole sich nähern?", "Sie stossen sich ab", ["Sie ziehen sich an", "Sie werden heiss", "Nichts"], "Nord–Nord oder Süd–Süd stossen sich ab, Nord–Süd ziehen sich an."],
      ["Welches Material leitet Strom?", "Kupfer", ["Holz", "Plastik", "Glas"], "Metalle leiten Strom. Holz, Plastik und Glas sind Isolatoren."],
      ["Wann leuchtet ein Lämpchen im Stromkreis?", "wenn der Stromkreis geschlossen ist", ["wenn der Stromkreis offen ist", "nur am Tag", "wenn die Batterie leer ist"], "Der Strom muss im Kreis von der Batterie zur Lampe und zurück fliessen."],
      ["Warum gibt es Tag und Nacht?", "weil sich die Erde dreht", ["weil die Sonne ausgeht", "weil der Mond die Sonne verdeckt", "wegen der Wolken"], "Die Erde dreht sich in 24 Stunden einmal um sich selbst."],
      ["Wie lange braucht die Erde für eine Runde um die Sonne?", "ein Jahr", ["einen Tag", "einen Monat", "eine Woche"], "Etwa 365 Tage – darum gibt es Jahreszeiten."],
      ["Welcher Planet ist der grösste?", "Jupiter", ["Erde", "Mars", "Saturn"], "In Jupiter hätten mehr als 1000 Erden Platz!"],
      ["Wie heisst es, wenn Wasser zu Dampf wird, ohne zu kochen?", "verdunsten", ["gefrieren", "schmelzen", "kondensieren"], "Pfützen verdunsten in der Sonne."]
    ],
    challenge: [
      ["Wie heisst es, wenn Wasserdampf wieder zu Wasser wird?", "kondensieren", ["verdunsten", "schmelzen", "erstarren"], "Das siehst du am beschlagenen Spiegel nach dem Duschen."],
      ["Was zeigt ein Kompass an?", "Norden", ["die Temperatur", "die Uhrzeit", "den Regen"], "Die Kompassnadel ist ein kleiner Magnet."],
      ["Wie heisst der rote Planet?", "Mars", ["Venus", "Jupiter", "Merkur"], "Der Mars ist rot, weil sein Boden viel Rost enthält."],
      ["Warum sehen wir den Mond?", "weil er das Sonnenlicht spiegelt", ["weil er selbst leuchtet", "weil er brennt", "weil er aus Eis ist"], "Der Mond leuchtet nicht selbst."],
      ["Was ist ein Isolator?", "ein Stoff, der keinen Strom leitet", ["ein Stoff, der Strom gut leitet", "eine Batterie", "ein Magnet"], "Kabel sind mit Plastik isoliert, damit man sie gefahrlos anfassen kann."],
      ["Was treibt den Wasserkreislauf an?", "die Sonne", ["der Mond", "der Wind allein", "die Fische"], "Die Sonne lässt Wasser verdunsten; es bildet Wolken und fällt als Regen."],
      ["Warum kommt im Winter weniger Sonnenwärme an?", "weil die Sonne flacher scheint", ["weil die Sonne weiter weg ist", "weil die Sonne kleiner wird", "weil es mehr Wolken gibt"], "Die schräge Erdachse macht die Jahreszeiten."]
    ]
  };

  /* ---------------- Themen ---------------- */
  const TOPICS = [
    {
      id: "kantone", label: "Kantone", icon: "🗺️", title: "Kantone und Hauptorte",
      levelDesc: { warmup: "Zug und die Zentralschweiz", practice: "Alle 26 Kantone", challenge: "Nachbarn von Zug und Landessprachen" },
      hint: "Tipp: Die Kürzel stehen auf jedem Autonummernschild.",
      generate: kantonQuestion
    },
    {
      id: "geografie", label: "Geografie", icon: "⛰️", title: "Die Schweiz entdecken",
      levelDesc: { warmup: "Zug, Baar und die Schweiz", practice: "Flüsse, Seen und Berge", challenge: "Schweizer Rekorde" },
      hint: "Stell dir die Schweizer Karte vor.",
      generate: level => fromList(GEOGRAFIE[level])
    },
    {
      id: "geschichte", label: "Geschichte", icon: "🏰", title: "Früher in der Schweiz",
      levelDesc: { warmup: "Pfahlbauer, Römer und Ritter", practice: "Eidgenossen, Morgarten und Zug", challenge: "Zeitstrahl und Jahreszahlen" },
      hint: "Pfahlbauer → Römer → Ritter → Eidgenossen.",
      generate: level => fromList(GESCHICHTE[level])
    },
    {
      id: "koerper", label: "Mensch & Körper", icon: "🫀", title: "Mein Körper",
      levelDesc: { warmup: "Organe, Sinne und Zähne", practice: "Verdauung, Blut und Knochen", challenge: "Muskeln, Blut und Organe genauer" },
      hint: "Denk an deinen eigenen Körper.",
      generate: level => fromList(KOERPER[level])
    },
    {
      id: "natur", label: "Tiere & Pflanzen", icon: "🦊", title: "Tiere, Pflanzen und der Wald",
      levelDesc: { warmup: "Tierklassen, Insekten und Bäume", practice: "Wald und Nahrungskette", challenge: "Zersetzer, Blüten und Wirbellose" },
      hint: "Säugetier, Vogel, Reptil, Amphibie oder Fisch?",
      generate: naturQuestion
    },
    {
      id: "technik", label: "Natur & Technik", icon: "🧲", title: "Stoffe, Energie und Weltall",
      levelDesc: { warmup: "Wasser, Magnete und Planeten", practice: "Zustände, Strom und Erde", challenge: "Kondensieren, Kompass und Jahreszeiten" },
      hint: "Überleg, was du schon ausprobiert hast.",
      generate: level => fromList(TECHNIK[level])
    }
  ];

  const store = Hub.store;
  if (!store.nmg) store.nmg = {};

  Notebook.register({
    id: "nmg", title: "NMG Entdecker", icon: "🌍",
    blurb: "NMG für die 5. Klasse: Kantone, Geografie, Geschichte, Körper, Tiere und Technik – mit Zug und Baar.",
    unit: "/// ein NMG-Übungsheft",
    tagline: "Natur, Mensch, Gesellschaft für die 5. Klasse, mit Zug und Baar, und einem Tipp zu jeder Antwort",
    taglineFor: "für",
    nameFallback: "dich",
    subject: "NMG",
    wordy: true,
    verdicts: { right: "Richtig!", wrong: "Nicht ganz – richtig ist:" },
    data: store.nmg,
    badgePrefix: "nmg-",
    badgeNames: {
      first: ["⭐", "Entdecker"], streak5: ["🔥", "Forscher"], streak10: ["🚀", "Super-Forscher"],
      streak25: ["⚡", "Professor"], race1: ["🏁", "Schnell gewusst"], race5: ["🏆", "Wissens-Champion"],
      race20: ["👑", "Wissens-König"], trial: ["⏱️", "Blitzmerker"], challenge: ["💪", "Schlaukopf"],
      century: ["💯", "Hundert Fakten"]
    },
    topics: TOPICS
  });
})();
