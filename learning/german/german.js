/* Deutsch Dash: German for English speakers. Words, numbers, der/die/das, phrases and verbs,
   at three levels, with a 🔊 button to hear the German and a tip for every answer. */
(function(){
  "use strict";
  const { pick, typed, sample, choice } = Notebook;
  const say = text => ({ text, lang: "de-DE" });
  const KEYS = ["ä", "ö", "ü", "ß"];
  const TYPE_HINT = "Use the ä ö ü ß buttons, or type ae, oe, ue, ss.";
  const art = a => `<span class="${a}">${a}</span>`;

  /* ---------------- words: [German, English (others that count after /), emoji] ---------------- */
  const WORDS = {
    warmup: [
      ["rot", "red", "🔴"], ["blau", "blue", "🔵"], ["grün", "green", "🟢"], ["gelb", "yellow", "🟡"],
      ["schwarz", "black", "⚫"], ["weiß", "white", "⚪"], ["braun", "brown", "🟤"], ["lila", "purple", "🟣"],
      ["der Hund", "dog", "🐶"], ["die Katze", "cat", "🐱"], ["das Pferd", "horse", "🐴"], ["die Kuh", "cow", "🐮"],
      ["der Vogel", "bird", "🐦"], ["die Maus", "mouse", "🐭"], ["der Fisch", "fish", "🐟"], ["das Schwein", "pig", "🐷"],
      ["die Mutter", "mother/mum/mom", "👩"], ["der Vater", "father/dad", "👨"], ["der Bruder", "brother", "👦"],
      ["die Schwester", "sister", "👧"], ["die Oma", "grandma/granny", "👵"], ["der Opa", "grandpa/grandad", "👴"]
    ],
    practice: [
      ["der Apfel", "apple", "🍎"], ["die Banane", "banana", "🍌"], ["das Brot", "bread", "🍞"], ["der Käse", "cheese", "🧀"],
      ["die Milch", "milk", "🥛"], ["das Wasser", "water", "💧"], ["das Ei", "egg", "🥚"], ["der Kuchen", "cake", "🍰"],
      ["die Erdbeere", "strawberry", "🍓"], ["das Eis", "ice cream/ice", "🍦"],
      ["die Schule", "school", "🏫"], ["das Buch", "book", "📕"], ["der Stift", "pen/pencil", "✏️"], ["der Tisch", "table", "🪑"],
      ["der Stuhl", "chair", "🪑"], ["die Tür", "door", "🚪"], ["das Fenster", "window", "🪟"], ["das Haus", "house", "🏠"],
      ["der Kopf", "head", "🙂"], ["die Hand", "hand", "✋"], ["der Fuß", "foot", "🦶"], ["das Auge", "eye", "👁️"],
      ["die Nase", "nose", "👃"], ["der Mund", "mouth", "👄"]
    ],
    challenge: [
      ["spielen", "to play/play", "⚽"], ["laufen", "to run/run", "🏃"], ["essen", "to eat/eat", "🍽️"],
      ["trinken", "to drink/drink", "🥤"], ["schlafen", "to sleep/sleep", "😴"], ["schwimmen", "to swim/swim", "🏊"],
      ["lesen", "to read/read", "📖"], ["springen", "to jump/jump", "🦘"],
      ["groß", "big/tall/large", "🦒"], ["klein", "small/little", "🐜"], ["schnell", "fast/quick", "⚡"],
      ["langsam", "slow", "🐢"], ["kalt", "cold", "🥶"], ["heiß", "hot", "🔥"], ["glücklich", "happy", "😄"], ["müde", "tired", "🥱"],
      ["das Auto", "car", "🚗"], ["der Zug", "train", "🚆"], ["das Fahrrad", "bike/bicycle", "🚲"],
      ["das Flugzeug", "plane/aeroplane/airplane", "✈️"], ["das Schiff", "ship", "🚢"],
      ["die Sonne", "sun", "☀️"], ["der Regen", "rain", "🌧️"], ["der Schnee", "snow", "❄️"], ["die Wolke", "cloud", "☁️"]
    ]
  };
  const english = w => w[1].split("/")[0];
  const bareNoun = de => de.replace(/^(der|die|das) /, "");

  function wordExplain(w){
    const m = w[0].match(/^(der|die|das) (.+)$/);
    let html = `${w[2]} <b>${w[0]}</b> = ${english(w)}`;
    if (m) html += `<br>💡 It's a ${art(m[1])} word. German nouns always start with a capital letter: <b>${m[2]}</b>.`;
    else if (english(w).startsWith("to ")) html += `<br>💡 Most German verbs end in <b>-en</b>, like ${w[0]}.`;
    return html;
  }

  function wordQuestion(level, mode){
    const list = WORDS[level];
    const w = choice(list);
    const others = sample(list.filter(o => o !== w), 3);
    const toEnglish = mode === "de2en";
    if (level === "challenge") {
      return toEnglish
        ? typed({
            prompt: `What does „${w[0]}“ mean?`, answers: w[1].split("/"), say: say(w[0]),
            hint: "Type it in English.", explain: wordExplain(w)
          })
        : typed({
            prompt: `How do you say “${english(w)}” in German?`,
            answers: [w[0], bareNoun(w[0])], answerDisplay: w[0], keys: KEYS,
            say: say(w[0]), sayAfter: true,
            hint: "You can leave out der/die/das. " + TYPE_HINT, explain: wordExplain(w)
          });
    }
    return toEnglish
      ? pick({
          prompt: `What does „${w[0]}“ mean?`, say: say(w[0]),
          answer: english(w), options: [english(w), ...others.map(english)], explain: wordExplain(w)
        })
      : pick({
          prompt: `How do you say “${english(w)}” in German?`, say: say(w[0]), sayAfter: true,
          answer: w[0], options: [w[0], ...others.map(o => o[0])], explain: wordExplain(w)
        });
  }

  /* ---------------- numbers ---------------- */
  const ONES = ["null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun",
                "zehn", "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn"];
  const TENS = ["", "", "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig"];
  // the German word, and the pieces it's built from (for the explanation)
  function germanNumber(n){
    if (n === 1000) return { word: "tausend", parts: [] };
    const parts = [];
    const h = Math.floor(n / 100), r = n % 100;
    if (h) parts.push([h === 1 ? "hundert" : ONES[h] + "hundert", h * 100]);
    if (r >= 20) {
      const o = r % 10, t = Math.floor(r / 10);
      if (o) parts.push([o === 1 ? "ein" : ONES[o], o], ["und", null]);
      parts.push([TENS[t], t * 10]);
    } else if (r || !h) {
      parts.push([ONES[r], r]);
    }
    return { word: parts.map(p => p[0]).join(""), parts };
  }
  function numberExplain(n){
    const { word, parts } = germanNumber(n);
    let html = `<b>${n}</b> = <b>${word}</b>`;
    if (parts.length > 1) html += `<br>${parts.map(p => p[1] === null ? "<i>und</i> (and)" : `${p[0]} (${p[1]})`).join(" + ")}`;
    if (parts.some(p => p[0] === "und")) html += `<br>💡 In German the ones come <b>before</b> the tens: “seven-and-twenty” for 27.`;
    return html;
  }
  const NUMBER_RANGE = { warmup: [0, 12], practice: [13, 100], challenge: [100, 1000] };

  function numberQuestion(level, mode){
    const [lo, hi] = NUMBER_RANGE[level];
    const n = lo + Math.floor(Math.random() * (hi - lo + 1));
    const word = germanNumber(n).word;
    if (mode === "read") {
      return typed({
        prompt: `„${word}“ = ?`, answers: [String(n)], say: say(word),
        hint: "Type the number in digits.", explain: numberExplain(n)
      });
    }
    // wrong answers that look close: digits swapped, one more or less, ten more or less
    const near = new Set();
    const swapped = n % 100 >= 10 ? Math.floor(n / 100) * 100 + (n % 10) * 10 + Math.floor(n / 10) % 10 : -1;
    [swapped, n + 1, n - 1, n + 10, n - 10, n + 2, n - 2].forEach(m => { if (m !== n && m >= 0 && m <= 1000 && near.size < 3) near.add(m); });
    return pick({
      prompt: `How do you say ${n} in German?`, say: say(word), sayAfter: true,
      answer: word, options: [word, ...[...near].map(m => germanNumber(m).word)], explain: numberExplain(n)
    });
  }

  /* ---------------- der / die / das: [noun, article, English, tip] ---------------- */
  const GENDERS = {
    warmup: [
      ["Hund", "der", "dog"], ["Katze", "die", "cat"], ["Haus", "das", "house"], ["Ball", "der", "ball"],
      ["Buch", "das", "book"], ["Mutter", "die", "mother"], ["Vater", "der", "father"], ["Auto", "das", "car"],
      ["Sonne", "die", "sun"], ["Mond", "der", "moon"], ["Baum", "der", "tree"], ["Blume", "die", "flower"],
      ["Bett", "das", "bed"], ["Tisch", "der", "table"], ["Tür", "die", "door"], ["Kind", "das", "child"]
    ],
    practice: [
      ["Apfel", "der", "apple"], ["Banane", "die", "banana"], ["Brot", "das", "bread"], ["Milch", "die", "milk"],
      ["Ei", "das", "egg"], ["Käse", "der", "cheese"], ["Schule", "die", "school"], ["Stift", "der", "pen"],
      ["Fenster", "das", "window"], ["Stuhl", "der", "chair"], ["Lampe", "die", "lamp"], ["Zimmer", "das", "room"],
      ["Garten", "der", "garden"], ["Straße", "die", "street"], ["Fahrrad", "das", "bike"], ["Zug", "der", "train"],
      ["Uhr", "die", "clock"], ["Wasser", "das", "water"], ["Hose", "die", "trousers"], ["Hemd", "das", "shirt"]
    ],
    challenge: [
      ["Mädchen", "das", "girl", "Words ending in <b>-chen</b> are always das, even <i>girl</i>!"],
      ["Kätzchen", "das", "kitten", "Words ending in <b>-chen</b> (little things) are always das."],
      ["Büchlein", "das", "little book", "Words ending in <b>-lein</b> (little things) are always das."],
      ["Zeitung", "die", "newspaper", "Words ending in <b>-ung</b> are always die."],
      ["Wohnung", "die", "flat", "Words ending in <b>-ung</b> are always die."],
      ["Freiheit", "die", "freedom", "Words ending in <b>-heit</b> are always die."],
      ["Gesundheit", "die", "health", "Words ending in <b>-heit</b> are always die. (You also say it when someone sneezes!)"],
      ["Freundschaft", "die", "friendship", "Words ending in <b>-schaft</b> are always die."],
      ["Station", "die", "station", "Words ending in <b>-ion</b> are always die."],
      ["Musik", "die", "music", "Words ending in <b>-ik</b> are usually die."],
      ["Montag", "der", "Monday", "Days of the week are always der."],
      ["Januar", "der", "January", "Months are always der."],
      ["Sommer", "der", "summer", "Seasons are always der."],
      ["Winter", "der", "winter", "Seasons are always der."],
      ["Lehrer", "der", "teacher", "A man or boy doing a job is der: der Lehrer. A woman is die Lehrerin."],
      ["Lehrerin", "die", "teacher (a woman)", "Words ending in <b>-in</b> for a woman or girl are die."],
      ["Tomate", "die", "tomato", "Lots of words ending in <b>-e</b> are die."]
    ]
  };

  function genderQuestion(level){
    const [noun, a, en, tip] = choice(GENDERS[level]);
    return pick({
      promptHtml: `___ ${noun}<span class="sub">(${en})</span>`, prompt: `___ ${noun}`,
      answer: a, options: ["der", "die", "das"], keepOrder: true,
      say: say(a + " " + noun), sayAfter: true,
      explain: `${art(a)} <b>${noun}</b> = the ${en}<br>💡 ${tip || "Learn every new noun with its der, die or das, like a little name tag."}`
    });
  }

  /* ---------------- phrases: [German, English, note] ---------------- */
  const PHRASES = {
    warmup: [
      ["Hallo!", "Hello!"], ["Tschüss!", "Bye!"], ["Guten Morgen!", "Good morning!"], ["Gute Nacht!", "Good night!"],
      ["Danke!", "Thank you!"], ["Bitte!", "Please!"], ["Ja", "Yes"], ["Nein", "No"],
      ["Wie geht's?", "How are you?", "Word for word it's “How goes it?”"],
      ["Mir geht's gut.", "I'm fine.", "Word for word it's “To me it goes well.”"]
    ],
    practice: [
      ["Wie heißt du?", "What's your name?", "Word for word it's “How are you called?”"],
      ["Ich heiße Max.", "My name is Max.", "Word for word it's “I am called Max.”"],
      ["Wie alt bist du?", "How old are you?"],
      ["Ich bin zehn Jahre alt.", "I'm ten years old."],
      ["Woher kommst du?", "Where are you from?"],
      ["Entschuldigung!", "Excuse me! / Sorry!"],
      ["Guten Appetit!", "Enjoy your meal!"],
      ["Alles Gute zum Geburtstag!", "Happy birthday!", "Word for word it's “All the best for your birthday!”"],
      ["Bis morgen!", "See you tomorrow!"],
      ["Ich habe Hunger.", "I'm hungry.", "Germans say “I have hunger.”"],
      ["Ich habe Durst.", "I'm thirsty.", "Germans say “I have thirst.”"]
    ],
    challenge: [
      ["Kannst du mir helfen?", "Can you help me?"],
      ["Ich verstehe das nicht.", "I don't understand."],
      ["Wo ist die Toilette?", "Where is the toilet?"],
      ["Wie spät ist es?", "What time is it?", "Word for word it's “How late is it?”"],
      ["Ich spiele gern Fußball.", "I like playing football.", "Put <b>gern</b> after a verb to say you like doing it."],
      ["Wie viel kostet das?", "How much is that?"],
      ["Das ist super!", "That's great!"],
      ["Ich habe einen Hund.", "I have a dog."],
      ["Meine Lieblingsfarbe ist Blau.", "My favourite colour is blue.", "<b>Lieblings-</b> means favourite: Lieblingsessen is favourite food."],
      ["Kannst du das wiederholen?", "Can you say that again?"],
      ["Ich bin müde.", "I'm tired."],
      ["Es regnet.", "It's raining."]
    ]
  };

  function phraseQuestion(level, mode){
    const list = PHRASES[level];
    const p = choice(list);
    const others = sample(list.filter(o => o !== p), 3);
    const explain = `<b>${p[0]}</b> = ${p[1]}` + (p[2] ? `<br>💡 ${p[2]}` : "");
    return mode === "de2en"
      ? pick({ prompt: `„${p[0]}“`, say: say(p[0]), answer: p[1], options: [p[1], ...others.map(o => o[1])], explain })
      : pick({ prompt: `How do you say “${p[1]}”?`, say: say(p[0]), sayAfter: true, answer: p[0], options: [p[0], ...others.map(o => o[0])], explain });
  }

  /* ---------------- verbs: [infinitive, English, ich, du, er/sie, wir, ihr, sie, end of the sentence, tip] ---------------- */
  const VERBS = {
    warmup: [
      ["sein", "to be", ["bin", "bist", "ist", "sind", "seid", "sind"], "sehr müde", "<i>sein</i> is irregular, so learn it by heart."],
      ["haben", "to have", ["habe", "hast", "hat", "haben", "habt", "haben"], "einen Hund", "<i>haben</i> drops the <b>b</b> with du and er/sie: du <b>hast</b>, er <b>hat</b>."]
    ],
    practice: [
      ["spielen", "to play", ["spiele", "spielst", "spielt", "spielen", "spielt", "spielen"], "Fußball"],
      ["wohnen", "to live", ["wohne", "wohnst", "wohnt", "wohnen", "wohnt", "wohnen"], "in Berlin"],
      ["machen", "to do / make", ["mache", "machst", "macht", "machen", "macht", "machen"], "Hausaufgaben"],
      ["lernen", "to learn", ["lerne", "lernst", "lernt", "lernen", "lernt", "lernen"], "Deutsch"],
      ["gehen", "to go", ["gehe", "gehst", "geht", "gehen", "geht", "gehen"], "nach Hause"]
    ],
    challenge: [
      ["essen", "to eat", ["esse", "isst", "isst", "essen", "esst", "essen"], "einen Apfel", "<i>essen</i> changes <b>e → i</b> with du and er/sie: du <b>isst</b>."],
      ["lesen", "to read", ["lese", "liest", "liest", "lesen", "lest", "lesen"], "ein Buch", "<i>lesen</i> changes <b>e → ie</b> with du and er/sie: du <b>liest</b>."],
      ["fahren", "to ride / drive", ["fahre", "fährst", "fährt", "fahren", "fahrt", "fahren"], "mit dem Bus", "<i>fahren</i> changes <b>a → ä</b> with du and er/sie: du <b>fährst</b>."],
      ["schlafen", "to sleep", ["schlafe", "schläfst", "schläft", "schlafen", "schlaft", "schlafen"], "sehr lange", "<i>schlafen</i> changes <b>a → ä</b> with du and er/sie: du <b>schläfst</b>."],
      ["sprechen", "to speak", ["spreche", "sprichst", "spricht", "sprechen", "sprecht", "sprechen"], "Deutsch", "<i>sprechen</i> changes <b>e → i</b> with du and er/sie: du <b>sprichst</b>."],
      ["sehen", "to see / watch", ["sehe", "siehst", "sieht", "sehen", "seht", "sehen"], "einen Film", "<i>sehen</i> changes <b>e → ie</b> with du and er/sie: du <b>siehst</b>."]
    ]
  };
  const PERSONS = ["ich", "du", "er/sie", "wir", "ihr", "sie"];
  const SUBJECTS = [["Ich"], ["Du"], ["Er", "Lena", "Max"], ["Wir"], ["Ihr"], ["Die Kinder"]];
  const REGULAR_TIP = "Take off <b>-en</b> and add the ending: ich <b>-e</b>, du <b>-st</b>, er/sie <b>-t</b>, wir <b>-en</b>, ihr <b>-t</b>, sie <b>-en</b>.";

  function verbQuestion(level){
    const [inf, en, forms, rest, tip] = choice(VERBS[level]);
    const i = Math.floor(Math.random() * 6);
    const subject = choice(SUBJECTS[i]);
    const answer = forms[i];
    const unique = [...new Set(forms)];
    const options = [answer, ...sample(unique.filter(f => f !== answer), 3)];
    const table = PERSONS.map((p, k) => `<tr${k === i ? ' class="hit"' : ""}><td>${p}</td><td>${forms[k]}</td></tr>`).join("");
    const who = i === 2 && subject !== "Er" ? ` (${subject} = er/sie)` : i === 5 ? " (die Kinder = sie)" : "";
    return pick({
      promptHtml: `${subject} ___ ${rest}.<span class="sub">${inf} = ${en}</span>`, prompt: `${subject} ___ ${rest}.`,
      answer, options,
      say: say(`${subject} ${answer} ${rest}.`), sayAfter: true,
      explain: `<b>${subject} ${answer} ${rest}.</b>${who}<br>💡 ${tip || REGULAR_TIP}<table class="verb">${table}</table>`
    });
  }

  /* ---------------- topics ---------------- */
  const TO_ENGLISH = { id: "de2en", label: "🇩🇪 → 🇬🇧" }, TO_GERMAN = { id: "en2de", label: "🇬🇧 → 🇩🇪" };
  const TOPICS = [
    {
      id: "words", label: "Words", icon: "🍎", title: "Wörter · words",
      levelDesc: { warmup: "Colours, animals and family", practice: "Food, school and your body", challenge: "Verbs, describing words and travel — type them!" },
      hint: "Tap 🔊 Listen to hear the German.",
      modes: [TO_ENGLISH, TO_GERMAN],
      generate: wordQuestion
    },
    {
      id: "numbers", label: "Numbers", icon: "🔢", title: "Zahlen · numbers",
      levelDesc: { warmup: "0 to 12", practice: "13 to 100", challenge: "100 to 1000" },
      hint: "German says the ones before the tens: 21 is “one-and-twenty”.",
      modes: [{ id: "pick", label: "Number → German" }, { id: "read", label: "German → number" }],
      generate: numberQuestion
    },
    {
      id: "gender", label: "der / die / das", icon: "🎩", title: "der, die or das?",
      levelDesc: { warmup: "Everyday things", practice: "Food, home and school", challenge: "Words with a rule you can learn" },
      hint: "Every German noun is der, die or das. Press 1, 2 or 3.",
      generate: genderQuestion
    },
    {
      id: "phrases", label: "Phrases", icon: "💬", title: "Sätze · things to say",
      levelDesc: { warmup: "Hello, please and thank you", practice: "Talking about you", challenge: "Asking for things" },
      hint: "Tap 🔊 Listen to hear how it sounds.",
      modes: [TO_ENGLISH, TO_GERMAN],
      generate: phraseQuestion
    },
    {
      id: "verbs", label: "Verbs", icon: "🏃", title: "Verben · doing words",
      levelDesc: { warmup: "sein and haben", practice: "Regular verbs like spielen", challenge: "Verbs that change: essen, fahren, lesen…" },
      hint: "Look at who is doing it: ich, du, er, wir…",
      generate: verbQuestion
    }
  ];

  const store = Hub.store;
  if (!store.german) store.german = {};

  Notebook.register({
    id: "german", title: "Deutsch Dash", icon: "🥨",
    blurb: "German: words, numbers, der/die/das, phrases and verbs, with 🔊 to hear it.",
    unit: "/// a German practice notebook",
    tagline: "Five German topics, a 🔊 button to hear every word, and a tip for every answer",
    nameFallback: "a German explorer",
    subject: "German",
    wordy: true,
    data: store.german,
    badgePrefix: "de-",
    badgeNames: {
      first: ["⭐", "Hallo!"], streak5: ["🔥", "Super!"], streak10: ["🚀", "Fantastisch!"],
      streak25: ["⚡", "Wunderbar!"], race1: ["🏁", "Schnell!"], race5: ["🏆", "Champion"],
      race20: ["👑", "Legende"], trial: ["⏱️", "Blitz"], challenge: ["💪", "Stark!"],
      century: ["💯", "Hundert!"]
    },
    topics: TOPICS
  });
})();
