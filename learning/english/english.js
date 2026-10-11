/* Word Wizard: school English for 5th grade in Switzerland (Lehrplan 21, the Young World 3 level,
   about A1–A2). Words with their German, opposites, spelling, verbs and grammar, at three levels,
   with a tip for every answer. British spelling, like the Swiss school books. */
(function(){
  "use strict";
  const { pick, typed, sample, choice } = Notebook;
  const say = text => ({ text, lang: "en-GB" });

  /* ---------------- words: [English (others that count after /), German] ---------------- */
  const WORDS = {
    warmup: [ // school
      ["classroom", "das Klassenzimmer"], ["timetable", "der Stundenplan"], ["break", "die Pause"],
      ["gym", "die Turnhalle"], ["playground", "der Pausenplatz"], ["teachers' room", "das Lehrerzimmer"],
      ["pencil case", "das Etui"], ["rubber/eraser", "der Radiergummi"], ["ruler", "das Lineal"],
      ["scissors", "die Schere"], ["glue", "der Leim"], ["exercise book", "das Heft"],
      ["homework", "die Hausaufgaben"], ["history", "Geschichte"], ["geography", "Geografie"],
      ["maths/math", "Mathematik"], ["music", "Musik"], ["changing room", "die Garderobe"]
    ],
    practice: [ // free time, food, clothes, weather
      ["ride a bike", "Velo fahren"], ["play the guitar", "Gitarre spielen"], ["go swimming", "schwimmen gehen"],
      ["read comics", "Comics lesen"], ["breakfast", "das Frühstück"], ["lunch", "das Mittagessen"],
      ["cheese", "der Käse"], ["strawberry", "die Erdbeere"], ["bread", "das Brot"],
      ["jumper/sweater", "der Pullover"], ["jacket", "die Jacke"], ["trousers/pants", "die Hose"],
      ["shoes", "die Schuhe"], ["sunny", "sonnig"], ["rainy", "regnerisch"], ["windy", "windig"],
      ["cloudy", "bewölkt"], ["snowy", "verschneit"]
    ],
    challenge: [ // town, traffic and emergencies
      ["traffic lights", "die Ampel"], ["zebra crossing", "der Fussgängerstreifen"], ["pavement/sidewalk", "das Trottoir"],
      ["ambulance", "der Krankenwagen"], ["hospital", "das Spital"], ["accident", "der Unfall"],
      ["injured", "verletzt"], ["dangerous", "gefährlich"], ["careful", "vorsichtig"],
      ["get help", "Hilfe holen"], ["turn left", "links abbiegen"], ["go straight on", "geradeaus gehen"],
      ["railway station/train station", "der Bahnhof"], ["bridge", "die Brücke"], ["police station", "der Polizeiposten"],
      ["fire engine", "das Feuerwehrauto"], ["helmet", "der Helm"], ["corner", "die Ecke"]
    ]
  };
  const first = w => w[0].split("/")[0];

  function wordQuestion(level, mode){
    const list = WORDS[level];
    const w = choice(list);
    const others = sample(list.filter(o => o !== w), 3);
    const explain = `<b>${first(w)}</b> = ${w[1]}` + (w[0].includes("/") ? `<br>💡 You can also say: ${w[0].split("/").slice(1).join(", ")}` : "");
    if (mode === "de2en" && level === "challenge") {
      return typed({
        prompt: `What's „${w[1]}“ in English?`, answers: w[0].split("/"), answerDisplay: first(w),
        say: say(first(w)), sayAfter: true, hint: "Type it in English.", explain
      });
    }
    return mode === "de2en"
      ? pick({ prompt: `What's „${w[1]}“ in English?`, say: say(first(w)), sayAfter: true,
               answer: first(w), options: [first(w), ...others.map(first)], explain })
      : pick({ prompt: `What does “${first(w)}” mean?`, say: say(first(w)),
               answer: w[1], options: [w[1], ...others.map(o => o[1])], explain });
  }

  /* ---------------- opposites: [word, opposite] ---------------- */
  const OPPOSITES = {
    warmup: [
      ["big", "small"], ["hot", "cold"], ["fast", "slow"], ["happy", "sad"], ["old", "new"],
      ["long", "short"], ["open", "closed"], ["full", "empty"], ["up", "down"], ["day", "night"],
      ["black", "white"], ["good", "bad"]
    ],
    practice: [
      ["cheap", "expensive"], ["early", "late"], ["heavy", "light"], ["clean", "dirty"], ["wet", "dry"],
      ["easy", "difficult"], ["quiet", "loud"], ["strong", "weak"], ["rich", "poor"], ["near", "far"],
      ["always", "never"], ["first", "last"]
    ],
    challenge: [
      ["buy", "sell"], ["win", "lose"], ["remember", "forget"], ["arrive", "leave"], ["push", "pull"],
      ["start", "finish"], ["ask", "answer"], ["give", "take"], ["laugh", "cry"], ["safe", "dangerous"],
      ["careful", "careless"], ["inside", "outside"]
    ]
  };

  function oppositeQuestion(level){
    const list = OPPOSITES[level];
    const p = choice(list);
    const flip = Math.random() < 0.5;
    const word = flip ? p[1] : p[0], answer = flip ? p[0] : p[1];
    const others = sample(list.filter(o => o !== p), 3).map(o => o[Math.random() < 0.5 ? 0 : 1]);
    return pick({
      promptHtml: `What's the <mark>opposite</mark> of “${word}”?`, prompt: `What's the opposite of “${word}”?`,
      say: say(word),
      answer, options: [answer, ...others],
      explain: `<b>${word}</b> ↔ <b>${answer}</b>`
    });
  }

  /* ---------------- spelling: [word, [wrong spellings], German, tip] ---------------- */
  const SPELLING = {
    warmup: [
      ["because", ["becuase", "becaus"], "weil", "<b>B</b>ig <b>E</b>lephants <b>C</b>an <b>A</b>lways <b>U</b>nderstand <b>S</b>mall <b>E</b>lephants."],
      ["friend", ["freind", "frend"], "der Freund", "A fri<b>end</b> is there to the <b>end</b>."],
      ["school", ["skool", "shcool"], "die Schule", "It starts with <b>sch</b>, like in German, but you say “sk”."],
      ["Wednesday", ["Wensday", "Wednsday"], "Mittwoch", "Say it like it's spelled: <b>Wed</b>-<b>nes</b>-day."],
      ["Thursday", ["Thirsday", "Thurstay"], "Donnerstag", "<b>Thur</b>s-day: think of <i>Thor</i>, the god of thunder (Donner)!"],
      ["February", ["Febuary", "Febraury"], "Februar", "Don't forget the first <b>r</b>: Feb-<b>r</b>u-ary."],
      ["people", ["peeple", "poeple"], "die Leute", "p<b>eo</b>ple: the <b>e</b> comes before the <b>o</b>."],
      ["beautiful", ["beutiful", "beautifull"], "schön", "<b>B</b>ig <b>E</b>lephants <b>A</b>re <b>U</b>gly: b-e-a-u, and only one <b>l</b> at the end."],
      ["tomorrow", ["tommorow", "tomorow"], "morgen", "One <b>m</b>, two <b>r</b>s: to-mo-<b>rr</b>ow."],
      ["birthday", ["birtday", "bierthday"], "der Geburtstag", "<b>birth</b> (Geburt) + <b>day</b> (Tag)."],
      ["brother", ["bruther", "brohter"], "der Bruder", "b-r-<b>o</b>-t-h-e-r: it's an <b>o</b>, but you say “u”."],
      ["write", ["rite", "writte"], "schreiben", "There's a silent <b>w</b> at the start: <b>w</b>rite."]
    ],
    practice: [
      ["forty", ["fourty", "forthy"], "vierzig", "four has a <b>u</b>, but f<b>o</b>rty doesn't!"],
      ["ninety", ["ninty", "nintey"], "neunzig", "nine + ty: keep the <b>e</b>: nin<b>e</b>ty."],
      ["eighth", ["eigth", "eightth"], "achte(r)", "eight + h: eigh<b>th</b>."],
      ["twelfth", ["twelvth", "twelth"], "zwölfte(r)", "The <b>v</b> turns into an <b>f</b>: twel<b>f</b>th."],
      ["science", ["sience", "scince"], "die Naturwissenschaft", "There's a <b>c</b> after the s: <b>sc</b>ience."],
      ["geography", ["geografy", "geograpy"], "Geografie", "The “f” sound is spelled <b>ph</b>: geogra<b>ph</b>y."],
      ["language", ["langauge", "languige"], "die Sprache", "lang-<b>ua</b>-ge: the <b>u</b> comes before the <b>a</b>."],
      ["breakfast", ["brekfast", "breackfast"], "das Frühstück", "You <b>break</b> your <b>fast</b> (the night without food)."],
      ["sandwich", ["sandwitch", "sendwich"], "das Sandwich", "No <i>t</i>: a sandwich isn't a witch!"],
      ["trousers", ["trowsers", "trausers"], "die Hose", "t-r-<b>ou</b>-s-e-r-s, like <b>ou</b>t."],
      ["favourite", ["favorit", "favourit"], "Lieblings-", "British spelling: fav-<b>our</b>-it<b>e</b>, with an e at the end."],
      ["colour", ["coulor", "colur"], "die Farbe", "British spelling: col-<b>our</b>."]
    ],
    challenge: [
      ["Switzerland", ["Swizerland", "Switzerlend"], "die Schweiz", "<b>Switz</b> + <b>er</b> + <b>land</b>."],
      ["mountain", ["mountin", "montain"], "der Berg", "m-<b>ou</b>-n-t-<b>ai</b>-n: two vowel pairs."],
      ["weather", ["wether", "wheather"], "das Wetter", "w-<b>ea</b>-ther, like h<b>ea</b>d."],
      ["dangerous", ["dangerus", "dengerous"], "gefährlich", "<b>danger</b> + <b>ous</b>."],
      ["ambulance", ["ambulence", "ambulanse"], "der Krankenwagen", "It ends in <b>-ance</b>."],
      ["accident", ["acident", "accidant"], "der Unfall", "Two <b>c</b>s: a<b>cc</b>ident."],
      ["hospital", ["hospitel", "hosptial"], "das Spital", "hos-pi-<b>tal</b>."],
      ["careful", ["carefull", "carful"], "vorsichtig", "<b>care</b> + <b>ful</b>: <i>-ful</i> has only one <b>l</b>."],
      ["interesting", ["intresting", "interessting"], "interessant", "Only one <b>s</b>, not two like German <i>interessant</i>: inter<b>e</b><b>s</b>ting."],
      ["address", ["adress", "addres"], "die Adresse", "Two <b>d</b>s and two <b>s</b>es: a<b>dd</b>re<b>ss</b>. German has only one d!"],
      ["different", ["diffrent", "differant"], "verschieden", "Say it slowly: dif-<b>fer</b>-<b>ent</b>."],
      ["neighbour", ["neighbur", "naighbour"], "der Nachbar", "British spelling: n-<b>eigh</b>-b-<b>our</b>."]
    ]
  };

  function spellingQuestion(level, mode){
    const [word, wrongs, german, tip] = choice(SPELLING[level]);
    const explain = `<b>${word}</b> = ${german}<br>💡 ${tip}`;
    if (mode === "type") {
      const hidden = word[0] + " _".repeat(word.length - 1);
      return typed({
        promptHtml: `Spell the English word for „${german}“<span class="sub">🔊 Tap Listen to hear it · ${hidden} (${word.length} letters)</span>`,
        prompt: `Spell the English word for „${german}“`,
        answers: [word], say: say(word),
        hint: "Tap 🔊 Listen to hear the word, then type it.",
        explain
      });
    }
    return pick({
      prompt: "Which spelling is right?",
      answer: word, options: [word, ...wrongs],
      say: say(word), sayAfter: true,
      explain
    });
  }

  /* ---------------- verbs and grammar: [sentence with ___ and a (clue), answer, [wrong], tip] ---------------- */
  const VERBS = {
    warmup: [ // present simple
      ["My sister ___ tennis every Monday. (play)", "plays", ["play", "playing"], "he / she / it: add <b>-s</b>. My sister plays."],
      ["I ___ to school by bus. (go)", "go", ["goes", "going"], "With I, you, we and they there's no -s: I go."],
      ["Tom ___ his teeth every morning. (brush)", "brushes", ["brushs", "brush"], "After <b>sh, ch, s, x</b> add <b>-es</b>: brushes."],
      ["She ___ TV after school. (watch)", "watches", ["watchs", "watch"], "After <b>ch</b> add <b>-es</b>: watches."],
      ["We ___ in Baar. (live)", "live", ["lives", "living"], "With we there's no -s: we live."],
      ["Mia ___ English at school. (learn)", "learns", ["learn", "learnes"], "he / she / it: add <b>-s</b>. Mia learns."],
      ["My dad ___ in Zug. (work)", "works", ["work", "workes"], "he / she / it: add <b>-s</b>. My dad works."],
      ["Lea ___ hard for her tests. (study)", "studies", ["studys", "study"], "Consonant + <b>y</b>: change y to <b>i</b> and add <b>-es</b>: studies."],
      ["___ you like pizza?", "Do", ["Does", "Are"], "Questions with I, you, we, they start with <b>Do</b>."],
      ["___ your brother play football?", "Does", ["Do", "Is"], "Questions with he, she, it start with <b>Does</b>."],
      ["He ___ like spiders.", "doesn't", ["don't", "isn't"], "he / she / it: <b>doesn't</b> + verb."],
      ["I ___ have a pet.", "don't", ["doesn't", "am not"], "I / you / we / they: <b>don't</b> + verb."]
    ],
    practice: [ // present continuous and present simple
      ["Look! The dog ___ in the garden. (run)", "is running", ["runs", "are running"], "<i>Look!</i> means it's happening now: <b>is + -ing</b>. Run → ru<b>nn</b>ing."],
      ["Listen! Somebody ___ the piano. (play)", "is playing", ["plays", "are playing"], "<i>Listen!</i> means it's happening now: <b>is playing</b>."],
      ["We ___ a test right now. (write)", "are writing", ["is writing", "are writeing"], "<i>right now</i>: <b>are + -ing</b>. Write loses its e: writing."],
      ["I ___ my homework at the moment. (do)", "am doing", ["is doing", "do"], "<i>at the moment</i>: <b>am + -ing</b> with I."],
      ["My mum always ___ coffee in the morning. (drink)", "drinks", ["is drinking", "drink"], "<i>always</i> means a habit: present simple, drinks."],
      ["It ___ now. Take an umbrella! (rain)", "is raining", ["rains", "raining"], "<i>now</i>: <b>is raining</b>."],
      ["Every Saturday we ___ football. (play)", "play", ["are playing", "plays"], "<i>Every Saturday</i> is a habit: present simple, we play."],
      ["Why ___ you laughing?", "are", ["do", "is"], "laughing (-ing) needs <b>am / is / are</b>: Why are you laughing?"],
      ["She ___ right now. (swim)", "is swimming", ["swims", "is swiming"], "<i>right now</i>: is + -ing. Swim → swi<b>mm</b>ing."],
      ["Look! The children ___ in the snow. (play)", "are playing", ["is playing", "play"], "<i>The children</i> is plural: <b>are playing</b>."],
      ["He usually ___ his bike to school. (ride)", "rides", ["is riding", "ride"], "<i>usually</i> means a habit: present simple, rides."],
      ["What ___ you doing?", "are", ["do", "is"], "doing (-ing) needs <b>are</b> with you."]
    ],
    challenge: [ // past simple
      ["Yesterday we ___ to the zoo. (go)", "went", ["goed", "go"], "go is irregular: go → <b>went</b>."],
      ["Last week I ___ my grandma. (visit)", "visited", ["visit", "visitted"], "Regular verbs add <b>-ed</b>: visited."],
      ["She ___ a big pizza last night. (eat)", "ate", ["eated", "eats"], "eat is irregular: eat → <b>ate</b>."],
      ["We ___ a great film on Saturday. (see)", "saw", ["seed", "seen"], "see is irregular: see → <b>saw</b>."],
      ["Our team ___ the match 3–1. (win)", "won", ["winned", "win"], "win is irregular: win → <b>won</b>."],
      ["I ___ my keys yesterday. (lose)", "lost", ["losed", "lose"], "lose is irregular: lose → <b>lost</b>."],
      ["He ___ a letter to his friend. (write)", "wrote", ["writed", "written"], "write is irregular: write → <b>wrote</b>."],
      ["The children ___ tired after the trip. (be)", "were", ["was", "are"], "be in the past: I / he / she / it <b>was</b>, we / you / they <b>were</b>."],
      ["It ___ very cold yesterday. (be)", "was", ["were", "is"], "it → <b>was</b>."],
      ["___ you go to the party on Friday?", "Did", ["Do", "Were"], "Questions in the past start with <b>Did</b>."],
      ["She didn't ___ the bus this morning. (catch)", "catch", ["caught", "catched"], "After <b>didn't</b> use the normal verb: didn't catch."],
      ["The ambulance ___ very quickly. (come)", "came", ["comed", "come"], "come is irregular: come → <b>came</b>."],
      ["I ___ in bed because I was ill. (stay)", "stayed", ["stay", "staied"], "Vowel + y just adds <b>-ed</b>: stayed."],
      ["We ___ a lot of photos in the mountains. (take)", "took", ["taked", "taken"], "take is irregular: take → <b>took</b>."]
    ]
  };

  const GRAMMAR = {
    warmup: [ // be, have got, there is/are, a/an, plurals
      ["I ___ eleven years old.", "am", ["is", "are"], "I <b>am</b>, you <b>are</b>, he / she / it <b>is</b>."],
      ["My friends ___ in the garden.", "are", ["is", "am"], "<i>My friends</i> is plural: they <b>are</b>."],
      ["She ___ got a new bike.", "has", ["have", "is"], "he / she / it <b>has got</b>."],
      ["We ___ got a cat.", "have", ["has", "are"], "I / you / we / they <b>have got</b>."],
      ["There ___ a cat on the sofa.", "is", ["are", "am"], "One thing: <b>there is</b>."],
      ["There ___ three books on the table.", "are", ["is", "be"], "More than one: <b>there are</b>."],
      ["I've got ___ umbrella.", "an", ["a"], "Use <b>an</b> before a vowel sound: an umbrella, an apple."],
      ["She's got ___ dog.", "a", ["an"], "Use <b>a</b> before a consonant sound: a dog."],
      ["Two ___ are playing outside.", "children", ["childs", "childrens"], "One child, two <b>children</b>."],
      ["I can see three ___.", "mice", ["mouses", "mices"], "One mouse, two <b>mice</b>."],
      ["My ___ are cold.", "feet", ["foots", "feets"], "One foot, two <b>feet</b>."],
      ["He ___ my best friend.", "is", ["are", "am"], "he / she / it <b>is</b>."]
    ],
    practice: [ // prepositions, question words, his/her, can
      ["The ball is ___ the box. (inside it)", "in", ["on", "under"], "<b>in</b> = inside."],
      ["The lamp is ___ the table. (on top of it)", "on", ["in", "under"], "<b>on</b> = on top of."],
      ["My shoes are ___ the bed. (below it)", "under", ["on", "in"], "<b>under</b> = below."],
      ["The bank is ___ the school and the shop.", "between", ["next", "under"], "<b>between</b> = in the middle of two things."],
      ["My house is ___ to the park.", "next", ["between", "in"], "<b>next to</b> = right beside."],
      ["___ do you live? – In Baar.", "Where", ["What", "When"], "<b>Where</b> asks about a place."],
      ["___ is that boy? – That's my brother.", "Who", ["What", "Where"], "<b>Who</b> asks about a person."],
      ["___ pets have you got? – Two.", "How many", ["How much", "What"], "<b>How many</b> asks for a number."],
      ["___ are you sad? – Because I lost my ball.", "Why", ["What", "Where"], "<b>Why</b> asks for a reason. The answer starts with <i>because</i>."],
      ["___ is your birthday? – In May.", "When", ["Where", "Who"], "<b>When</b> asks about a time."],
      ["This is Anna. ___ bag is red.", "Her", ["His", "She"], "For a girl or woman: <b>her</b> bag."],
      ["This is Tom. ___ dog is brown.", "His", ["Her", "He"], "For a boy or man: <b>his</b> dog."],
      ["I ___ swim very well.", "can", ["cans", "can to"], "<b>can</b> never changes and has no <i>to</i>: I can swim."],
      ["She ___ play the piano. She never learned it.", "can't", ["can", "cans"], "<b>can't</b> = can not."]
    ],
    challenge: [ // comparing, some/any, much/many
      ["An elephant is ___ than a mouse.", "bigger", ["more big", "biggest"], "Short words: add <b>-er</b>. Big → bi<b>gg</b>er."],
      ["The Matterhorn is ___ than the Rigi.", "higher", ["more high", "highest"], "Short words: add <b>-er</b>: higher."],
      ["This film is ___ than the book.", "more exciting", ["excitinger", "most exciting"], "Long words: use <b>more</b>: more exciting."],
      ["My test was ___ than last time.", "better", ["gooder", "best"], "good → <b>better</b> → best."],
      ["That was the ___ test ever!", "worst", ["baddest", "worse"], "bad → worse → <b>worst</b>."],
      ["Today is the ___ day of the year.", "hottest", ["hotest", "most hot"], "hot → hotter → the ho<b>tt</b>est."],
      ["She is the ___ girl in our class.", "tallest", ["most tall", "taller"], "The top of a group: <b>the -est</b>."],
      ["Zug is ___ than Zürich.", "smaller", ["more small", "smallest"], "Comparing two things: <b>-er than</b>."],
      ["There isn't ___ juice left.", "any", ["some", "many"], "In negative sentences use <b>any</b>."],
      ["I'd like ___ apples, please.", "some", ["any", "much"], "When you ask for things politely, use <b>some</b>."],
      ["How ___ money have you got?", "much", ["many"], "Things you can't count (money, water): <b>much</b>."],
      ["How ___ brothers have you got?", "many", ["much"], "Things you can count: <b>many</b>."],
      ["This is the ___ book in the library.", "most interesting", ["interestingest", "more interesting"], "Long words, top of a group: <b>the most</b>."],
      ["Lucerne is ___ from Baar than Zug.", "farther", ["more far", "farest"], "far → <b>farther</b> (or further) → farthest."]
    ]
  };

  function gapQuestion(list){
    const [sentence, answer, wrong, tip] = choice(list);
    const clue = sentence.match(/ \(([^)]+)\)$/);
    const shown = clue ? sentence.slice(0, clue.index) : sentence;
    return pick({
      promptHtml: clue ? `${shown}<span class="sub">(${clue[1]})</span>` : shown, prompt: shown,
      answer, options: [answer, ...wrong],
      say: say(shown.replace("___", answer)), sayAfter: true,
      explain: `“${shown.replace("___", "<b>" + answer + "</b>")}”<br>💡 ${tip}`
    });
  }

  /* ---------------- topics ---------------- */
  const TOPICS = [
    {
      id: "words", label: "Words", icon: "📚", title: "Vocabulary",
      levelDesc: { warmup: "At school", practice: "Free time, food, clothes and weather", challenge: "Town, traffic and emergencies" },
      hint: "Tap the answer, or press 1–4.",
      modes: [{ id: "en2de", label: "🇬🇧 → 🇨🇭" }, { id: "de2en", label: "🇨🇭 → 🇬🇧" }],
      generate: wordQuestion
    },
    {
      id: "opposites", label: "Opposites", icon: "↔️", title: "Find the opposite",
      levelDesc: { warmup: "Easy opposites", practice: "Describing words", challenge: "Doing words and more" },
      hint: "Opposites are as different as can be: hot ↔ cold.",
      generate: oppositeQuestion
    },
    {
      id: "spelling", label: "Spelling", icon: "🐝", title: "Spell it right",
      levelDesc: { warmup: "Days, months and everyday words", practice: "Numbers, school subjects and food", challenge: "Town, travel and tricky words" },
      hint: "Look closely at every letter!",
      modes: [{ id: "pick", label: "Pick it" }, { id: "type", label: "Type it 🔊" }],
      generate: spellingQuestion
    },
    {
      id: "verbs", label: "Verbs", icon: "🏃", title: "Verbs and tenses",
      levelDesc: { warmup: "Present simple: he plays, do / does", practice: "Present continuous: is playing", challenge: "Past simple: went, saw, did" },
      hint: "Look for signal words: every day, now, yesterday…",
      generate: level => gapQuestion(VERBS[level])
    },
    {
      id: "grammar", label: "Grammar", icon: "✏️", title: "Pick the right word",
      levelDesc: { warmup: "am / is / are, have got, there is, a / an", practice: "in / on / under, question words, his / her, can", challenge: "Comparing: bigger, the best, much / many" },
      hint: "Read the whole sentence in your head.",
      generate: level => gapQuestion(GRAMMAR[level])
    }
  ];

  const store = Hub.store;
  if (!store.english) store.english = {};

  Notebook.register({
    id: "english", title: "Word Wizard", icon: "🧙",
    blurb: "School English for 5th grade, like Young World: words, spelling, verbs and grammar.",
    unit: "/// an English practice notebook",
    tagline: "5th-grade school English, like in Young World, with a tip for every answer",
    nameFallback: "your word wizard",
    subject: "English",
    wordy: true,
    data: store.english,
    badgePrefix: "en-",
    badgeNames: {
      first: ["⭐", "First Word"], streak5: ["🔥", "Word Streak"], streak10: ["🚀", "Word Rocket"],
      streak25: ["⚡", "Word Wizard"], race1: ["🏁", "Word Racer"], race5: ["🏆", "Word Champion"],
      race20: ["👑", "Word Legend"], trial: ["⏱️", "Quick Thinker"], challenge: ["💪", "Big Brain"],
      century: ["💯", "Hundred Words"]
    },
    topics: TOPICS
  });
})();
