/* Word Wizard: English for 5th graders. Word meanings, same & opposite words, spelling,
   word types and grammar, at three levels, with a worked answer every time. */
(function(){
  "use strict";
  const { pick, typed, sample, choice } = Notebook;
  const say = text => ({ text, lang: "en-GB" });

  /* ---------------- word meanings: [word, meaning, example] ---------------- */
  const MEANINGS = {
    warmup: [
      ["brave", "not scared to do something hard", "The brave firefighter ran into the smoke."],
      ["tiny", "very, very small", "A tiny ant crawled across my hand."],
      ["shout", "say something very loudly", "Please don't shout in the library."],
      ["gloomy", "dark and sad", "It was a gloomy, rainy day."],
      ["giggle", "laugh in a quiet, silly way", "The baby started to giggle."],
      ["swift", "very fast", "The swift cheetah caught up in seconds."],
      ["chilly", "a bit cold", "Take a jacket, it's chilly outside."],
      ["damp", "a little bit wet", "My socks were still damp."],
      ["gentle", "soft and kind, not rough", "Be gentle with the kitten."],
      ["weary", "very tired", "After the long hike we were weary."],
      ["grin", "a big smile", "He had a huge grin on his face."],
      ["sniff", "smell something with short breaths", "The dog sniffed my bag."],
      ["tumble", "fall over and roll", "The puppy tumbled down the hill."],
      ["clever", "smart and quick at learning", "The clever crow used a stick as a tool."],
      ["hurry", "move quickly because there isn't much time", "Hurry, the bus is coming!"]
    ],
    practice: [
      ["ancient", "very, very old", "The pyramids are ancient."],
      ["curious", "wanting to know or learn about something", "The curious cat peeked into the box."],
      ["delicious", "tasting really good", "Grandma's soup is delicious."],
      ["fragile", "easy to break", "Careful, that glass vase is fragile."],
      ["generous", "happy to share and give things", "It was generous of you to share your sweets."],
      ["hesitate", "stop for a moment because you're not sure", "She hesitated before diving in."],
      ["journey", "a long trip from one place to another", "The journey to the mountains took all day."],
      ["vanish", "disappear suddenly", "The magician made the coin vanish."],
      ["shiver", "shake because you're cold", "We shivered at the bus stop."],
      ["annoyed", "a little bit angry", "I was annoyed when my brother hid my book."],
      ["cautious", "careful to stay away from danger", "Be cautious when you cross the road."],
      ["exhausted", "extremely tired", "After the race I was exhausted."],
      ["predict", "say what you think will happen next", "Can you predict the end of the story?"],
      ["observe", "watch something carefully", "We observed the caterpillar every day."],
      ["rescue", "save someone from danger", "The lifeguard rescued the swimmer."]
    ],
    challenge: [
      ["enormous", "very, very big", "An enormous whale swam past the boat."],
      ["reluctant", "not wanting to do something", "He was reluctant to tidy his room."],
      ["abundant", "more than enough; lots and lots", "Apples are abundant in autumn."],
      ["peculiar", "strange or unusual", "There was a peculiar smell in the kitchen."],
      ["persuade", "get someone to agree by giving good reasons", "I persuaded Dad to let us stay up late."],
      ["meticulous", "very careful about every little detail", "She made a meticulous model of the castle."],
      ["triumph", "a big win or success", "Winning the cup was a triumph for the team."],
      ["elated", "extremely happy", "We were elated when the puppy came home."],
      ["scarce", "hard to find; there isn't much of it", "Water is scarce in the desert."],
      ["vivid", "very bright and clear", "The painting had vivid colours."],
      ["tranquil", "calm and peaceful", "The lake was tranquil in the morning."],
      ["ominous", "making you feel something bad will happen", "Ominous clouds filled the sky."],
      ["inevitable", "sure to happen; it can't be stopped", "With so much rain, a flood was inevitable."],
      ["feeble", "very weak", "The baby bird gave a feeble chirp."],
      ["conceal", "hide something", "He concealed the present behind his back."]
    ]
  };

  function meaningQuestion(level){
    const list = MEANINGS[level];
    const [word, meaning, example] = choice(list);
    const wrong = sample(list.filter(w => w[0] !== word), 3).map(w => w[1]);
    return pick({
      prompt: `What does “${word}” mean?`,
      answer: meaning, options: [meaning, ...wrong],
      say: say(word),
      explain: `<b>${word}</b> means <i>${meaning}</i>.<br>Example: “${example}”`
    });
  }

  /* ---------------- same & opposite: [word, same, opposite] ---------------- */
  const PAIRS = {
    warmup: [
      ["happy", "glad", "sad"], ["big", "large", "small"], ["fast", "quick", "slow"],
      ["start", "begin", "finish"], ["cold", "chilly", "hot"], ["easy", "simple", "hard"],
      ["loud", "noisy", "quiet"], ["shut", "close", "open"], ["smart", "clever", "foolish"],
      ["rich", "wealthy", "poor"], ["shout", "yell", "whisper"], ["laugh", "chuckle", "cry"]
    ],
    practice: [
      ["brave", "fearless", "cowardly"], ["ancient", "old", "modern"], ["difficult", "tricky", "easy"],
      ["huge", "gigantic", "tiny"], ["strong", "powerful", "weak"], ["polite", "respectful", "rude"],
      ["tidy", "neat", "messy"], ["brief", "short", "long"], ["shiny", "gleaming", "dull"],
      ["arrive", "come", "leave"], ["generous", "giving", "selfish"], ["remember", "recall", "forget"],
      ["accept", "take", "refuse"], ["victory", "win", "defeat"]
    ],
    challenge: [
      ["enormous", "massive", "minuscule"], ["courageous", "heroic", "timid"], ["fortunate", "lucky", "unlucky"],
      ["furious", "enraged", "serene"], ["abundant", "plentiful", "scarce"], ["hostile", "unfriendly", "welcoming"],
      ["transparent", "clear", "opaque"], ["expand", "enlarge", "shrink"], ["conceal", "hide", "reveal"],
      ["humble", "modest", "boastful"], ["frequent", "regular", "rare"], ["swift", "rapid", "sluggish"],
      ["ascend", "climb", "descend"], ["genuine", "real", "fake"], ["praise", "compliment", "criticise"]
    ]
  };

  function pairQuestion(level, mode){
    const list = PAIRS[level];
    const [word, same, opp] = choice(list);
    const askSame = mode === "same" || (mode === "mix" && Math.random() < 0.5);
    const answer = askSame ? same : opp, trap = askSame ? opp : same;
    // the other choices are words that mean the same as other words, so only one fits
    const others = sample(list.filter(w => w[0] !== word), 2).map(w => w[1]);
    return pick({
      promptHtml: askSame
        ? `Which word means the <mark>same</mark> as “${word}”?`
        : `Which word means the <mark>opposite</mark> of “${word}”?`,
      answer, options: [answer, trap, ...others],
      explain: `<b>${word}</b> and <b>${same}</b> mean the same thing (they're <i>synonyms</i>).<br>` +
        `<b>${word}</b> and <b>${opp}</b> mean opposite things (they're <i>antonyms</i>).`
    });
  }

  /* ---------------- spelling: [word, [wrong spellings], meaning, tip] ---------------- */
  const SPELLING = {
    warmup: [
      ["because", ["becuase", "becaus"], "for the reason that", "<b>B</b>ig <b>E</b>lephants <b>C</b>an <b>A</b>lways <b>U</b>nderstand <b>S</b>mall <b>E</b>lephants."],
      ["friend", ["freind", "frend"], "someone you like and trust", "A fri<b>end</b> is there to the <b>end</b>."],
      ["said", ["sed", "siad"], "spoke these words", "It's s<b>ai</b>d, with an <b>ai</b> in the middle."],
      ["people", ["peeple", "poeple"], "more than one person", "p<b>eo</b>ple: the <b>e</b> comes before the <b>o</b>."],
      ["beautiful", ["beutiful", "beautifull"], "very lovely to look at", "<b>B</b>ig <b>E</b>lephants <b>A</b>re <b>U</b>gly: b-e-a-u, and only one <b>l</b> at the end."],
      ["again", ["agian", "agen"], "one more time", "<b>a</b> + <b>gain</b>."],
      ["school", ["skool", "shcool"], "where you go to learn", "It starts with <b>sch</b>, like <b>sch</b>edule."],
      ["different", ["diffrent", "differant"], "not the same", "Say it slowly: dif-<b>fer</b>-<b>ent</b>."],
      ["answer", ["anser", "answr"], "what you say back to a question", "There's a silent <b>w</b>: ans<b>w</b>er."],
      ["tomorrow", ["tommorow", "tomorow"], "the day after today", "One <b>m</b>, two <b>r</b>s: to-mo-<b>rr</b>ow."],
      ["Wednesday", ["Wensday", "Wednsday"], "the day after Tuesday", "Say it like it's spelled: <b>Wed</b>-<b>nes</b>-day."],
      ["February", ["Febuary", "Febraury"], "the second month of the year", "Don't forget the first <b>r</b>: Feb-<b>r</b>u-ary."],
      ["library", ["libary", "liberry"], "a place full of books to borrow", "There are two <b>r</b>s: li-<b>br</b>a-<b>r</b>y."],
      ["enough", ["enuff", "enogh"], "as much as you need", "The <i>uff</i> sound is spelled <b>ough</b>, like in <i>tough</i>."]
    ],
    practice: [
      ["necessary", ["neccessary", "necesary"], "needed; you must have it", "One <b>C</b>ollar, two <b>S</b>leeves: one <b>c</b>, two <b>s</b>."],
      ["separate", ["seperate", "separete"], "apart; not together", "There's <b>a rat</b> in sep<b>arat</b>e."],
      ["definitely", ["definately", "definitly"], "for sure", "It has <b>finite</b> inside: de<b>finite</b>ly."],
      ["believe", ["beleive", "belive"], "think something is true", "Never be<b>lie</b>ve a <b>lie</b>."],
      ["receive", ["recieve", "receve"], "get something that's given to you", "<b>i</b> before <b>e</b>, except after <b>c</b>: re<b>cei</b>ve."],
      ["surprise", ["suprise", "surprize"], "something you didn't expect", "Two <b>r</b>s: su<b>r</b>p<b>r</b>ise, and it ends in <b>-ise</b>."],
      ["calendar", ["calender", "calandar"], "a chart of the days and months", "It ends in <b>-dar</b>, not <i>-der</i>."],
      ["island", ["iland", "ilsand"], "land with water all around it", "An island <b>is land</b>."],
      ["environment", ["enviroment", "envirnment"], "the world around us: air, land, water and nature", "There's <b>iron</b> in env<b>iron</b>ment."],
      ["restaurant", ["resturant", "restaraunt"], "a place where you buy and eat meals", "Say it slowly: rest-<b>au</b>-rant."],
      ["address", ["adress", "addres"], "where someone lives", "Two <b>d</b>s and two <b>s</b>es: a<b>dd</b>re<b>ss</b>."],
      ["tongue", ["tounge", "tung"], "the part of your mouth you taste with", "It's t-<b>on</b>-g-u-e: the <b>o</b> comes before the <b>u</b>."],
      ["weird", ["wierd", "weerd"], "very strange", "weird is weird: it breaks the <i>i before e</i> rule!"],
      ["piece", ["peice", "piese"], "one part of something", "A <b>pie</b>ce of <b>pie</b>."],
      ["disappear", ["dissapear", "disapear"], "go out of sight", "It's <b>dis</b> + <b>appear</b>: one <b>s</b>, two <b>p</b>s."]
    ],
    challenge: [
      ["accommodate", ["accomodate", "acommodate", "accommadate"], "have enough room for", "It's big enough for two <b>c</b>s and two <b>m</b>s."],
      ["embarrass", ["embarass", "embarras", "embarrasse"], "make someone feel silly or shy", "You go <b>r</b>eally <b>r</b>ed and <b>s</b>mile <b>s</b>hyly: two <b>r</b>s, two <b>s</b>es."],
      ["rhythm", ["rythm", "rhythym", "rhytm"], "a beat in music that repeats", "<b>R</b>hythm <b>H</b>elps <b>Y</b>our <b>T</b>wo <b>H</b>ips <b>M</b>ove."],
      ["conscious", ["concious", "consious", "conscous"], "awake and knowing what's going on", "It has <b>sci</b> in the middle: con<b>sci</b>ous."],
      ["occasionally", ["ocasionally", "occasionaly", "occassionally"], "now and then; not often", "Two <b>c</b>s, one <b>s</b>, two <b>l</b>s."],
      ["mischievous", ["mischievious", "mischevious", "mischivous"], "a little bit naughty in a playful way", "There's no <i>i</i> before the <b>ous</b>: mischie-<b>vous</b>."],
      ["pronunciation", ["pronounciation", "pronunsiation", "pronunciasion"], "the way you say a word", "The verb is <i>pronounce</i>, but the noun drops the <b>o</b>: pro<b>nun</b>ciation."],
      ["millennium", ["millenium", "milennium", "milenium"], "a thousand years", "Two <b>l</b>s and two <b>n</b>s: mi<b>ll</b>e<b>nn</b>ium."],
      ["privilege", ["priviledge", "privelege", "privilige"], "a special right or treat", "There's no <i>d</i>, and it's pr<b>i</b>v<b>i</b>l<b>e</b>ge."],
      ["guarantee", ["garantee", "guarentee", "gaurantee"], "a promise that something will happen", "<b>gu</b> at the start, like <b>gu</b>ard."],
      ["parallel", ["paralel", "parrallel", "paralell"], "lines that never meet", "The two <b>l</b>s in the middle are parallel, like the lines: pa-ra-<b>ll</b>-el."],
      ["recommend", ["reccomend", "recomend", "reccommend"], "say that something is good", "It's <b>re</b> + <b>commend</b>: one <b>c</b>, two <b>m</b>s."],
      ["foreign", ["foriegn", "forein", "foreighn"], "from another country", "It's for-<b>eign</b>, like a king's r<b>eign</b>."],
      ["vacuum", ["vaccum", "vacume", "vacum"], "a space with nothing in it; also a cleaner that sucks up dust", "One <b>c</b>, two <b>u</b>s: va<b>c</b>u<b>u</b>m."]
    ]
  };

  function spellingQuestion(level, mode){
    const [word, wrongs, meaning, tip] = choice(SPELLING[level]);
    const explain = `<b>${word}</b> means <i>${meaning}</i>.<br>💡 ${tip}`;
    if (mode === "type") {
      const hidden = word[0] + " _".repeat(word.length - 1);
      return typed({
        promptHtml: `Spell the word that means “${meaning}”<span class="sub">🔊 Tap Listen to hear it · ${hidden} (${word.length} letters)</span>`,
        prompt: `Spell the word that means “${meaning}”`,
        answers: [word], say: say(word),
        hint: "Tap 🔊 Listen to hear the word, then type it.",
        explain
      });
    }
    return pick({
      prompt: "Which spelling is right?",
      answer: word, options: [word, ...wrongs.slice(0, level === "challenge" ? 3 : 2)],
      say: say(word), sayAfter: true,
      explain
    });
  }

  /* ---------------- word types: words in {braces|type} can be asked about ---------------- */
  const TYPES = {
    noun: ["a noun", "a <i>person, place, thing or idea</i>"],
    verb: ["a verb", "an <i>action</i> word, or a <i>being</i> word like <i>is</i> and <i>was</i>"],
    adj:  ["an adjective", "a word that <i>describes a noun</i>: what kind, which one or how many"],
    adv:  ["an adverb", "a word that tells <i>how, when or where</i> something happens. Lots of them end in <b>-ly</b>"],
    pron: ["a pronoun", "a word that <i>takes the place of a noun</i>, like he, she, it, we and they"],
    prep: ["a preposition", "a word that shows <i>where or when</i>, like on, under, behind and after"],
    conj: ["a conjunction", "a word that <i>joins</i> words or ideas, like and, but, or and because"]
  };
  const TYPE_NAMES = { noun: "noun", verb: "verb", adj: "adjective", adv: "adverb", pron: "pronoun", prep: "preposition", conj: "conjunction" };
  const TYPE_LEVELS = {
    warmup: ["noun", "verb", "adj"],
    practice: ["noun", "verb", "adj", "adv"],
    challenge: ["noun", "verb", "adj", "adv", "pron", "prep", "conj"]
  };
  const TYPE_SENTENCES = [
    "The {hungry|adj} {cat|noun} {ate|verb} {quickly|adv}.",
    "{She|pron} {found|verb} a {shiny|adj} {coin|noun} {under|prep} the {sofa|noun}.",
    "My {little|adj} {brother|noun} {sings|verb} {loudly|adv} {in|prep} the {bath|noun}.",
    "We {played|verb} {football|noun} {and|conj} {they|pron} {watched|verb}.",
    "The {old|adj} {castle|noun} {stood|verb} {on|prep} a {steep|adj} {hill|noun}.",
    "{He|pron} {ran|verb} {fast|adv} {because|conj} he was {late|adj}.",
    "Five {ducks|noun} {swam|verb} {slowly|adv} {across|prep} the {pond|noun}.",
    "The {teacher|noun} {smiled|verb} {happily|adv} {at|prep} {us|pron}.",
    "{It|pron} {rained|verb} all {day|noun}, {but|conj} we {had|verb} {fun|noun}.",
    "A {giant|adj} {wave|noun} {crashed|verb} {onto|prep} the {beach|noun}.",
    "{They|pron} {climbed|verb} the {tall|adj} {tree|noun} {carefully|adv}.",
    "The {puppy|noun} {chewed|verb} my {new|adj} {shoe|noun}.",
    "{Yesterday|adv} we {visited|verb} {Grandma|noun}.",
    "The {spaceship|noun} {zoomed|verb} {past|prep} the {bright|adj} {moon|noun}.",
    "{I|pron} {like|verb} {apples|noun} {or|conj} {pears|noun}.",
    "{Suddenly|adv}, the {lights|noun} {flickered|verb}.",
    "The {clever|adj} {fox|noun} {hid|verb} {behind|prep} a {rock|noun}.",
    "{We|pron} {laughed|verb} {and|conj} {cheered|verb} {loudly|adv}."
  ];

  function wordTypeQuestion(level){
    const allowed = TYPE_LEVELS[level];
    const tag = /\{([^|}]+)\|(\w+)\}/g;
    const asks = [];
    TYPE_SENTENCES.forEach((s, si) => {
      let ti = 0;
      s.replace(tag, (m, word, type) => { if (allowed.includes(type)) asks.push({ si, ti, word, type }); ti++; return m; });
    });
    const q = choice(asks);
    let ti = 0;
    const sentence = TYPE_SENTENCES[q.si].replace(tag, (m, word) => ti++ === q.ti ? `<mark>${word}</mark>` : word);
    const answer = TYPE_NAMES[q.type];
    // warm-up and practice always show the same buttons in the same order; challenge picks 4 of the 7
    const options = level === "challenge"
      ? [answer, ...sample(allowed.filter(t => t !== q.type), 3).map(t => TYPE_NAMES[t])]
      : allowed.map(t => TYPE_NAMES[t]);
    const [name, what] = TYPES[q.type];
    return pick({
      promptHtml: `${sentence}<span class="sub">What kind of word is “${q.word}”?</span>`,
      prompt: sentence.replace(/<[^>]+>/g, ""),
      answer, options,
      keepOrder: level !== "challenge",
      explain: `<b>${q.word}</b> is ${name}. That's ${what}.`
    });
  }
  /* ---------------- grammar: [sentence with ___, answer, [wrong], why] ---------------- */
  const GRAMMAR = {
    warmup: [
      ["I saw two ___ in the field.", "sheep", ["sheeps", "sheepes"], "<i>Sheep</i> stays the same: one sheep, two sheep."],
      ["There are three ___ in the box.", "mice", ["mouses", "mices"], "One mouse, two <b>mice</b>."],
      ["She ate ___ apple.", "an", ["a"], "Use <b>an</b> before a vowel sound: <i>an apple, an egg</i>."],
      ["He is ___ good friend.", "a", ["an"], "Use <b>a</b> before a consonant sound: <i>a good friend</i>."],
      ["Yesterday I ___ to the park.", "went", ["goed", "go"], "<i>Go</i> is irregular: today I go, yesterday I <b>went</b>."],
      ["My two ___ are sore after the race.", "feet", ["foots", "feets"], "One foot, two <b>feet</b>."],
      ["The ___ are playing outside.", "children", ["childs", "childrens"], "One child, two <b>children</b>."],
      ["We ___ a movie last night.", "watched", ["watch", "watches"], "<i>Last night</i> is in the past, so add <b>-ed</b>: watched."],
      ["She ___ her lunch an hour ago.", "ate", ["eated", "eat"], "<i>Eat</i> is irregular: today I eat, yesterday I <b>ate</b>."],
      ["There ___ lots of cars on the road.", "are", ["is"], "<i>Lots of cars</i> is more than one, so use <b>are</b>."],
      ["I packed two ___ for the trip.", "boxes", ["boxs", "boxies"], "Words ending in <b>x</b> add <b>-es</b>: box → boxes."],
      ["Look at those cute ___!", "babies", ["babys", "babyes"], "Consonant + <b>y</b>: change the y to <b>i</b> and add <b>-es</b>: baby → babies."]
    ],
    practice: [
      ["___ going to the beach today.", "They're", ["Their", "There"], "<b>They're</b> is short for <i>they are</i>."],
      ["The kids forgot ___ bags.", "their", ["there", "they're"], "<b>Their</b> means <i>belonging to them</i>."],
      ["Put the box over ___.", "there", ["their", "they're"], "<b>There</b> is a place. It has <i>here</i> inside it: t<b>here</b>."],
      ["The cat licked ___ paw.", "its", ["it's"], "<b>Its</b> means <i>belonging to it</i>, with no apostrophe."],
      ["___ raining outside.", "It's", ["Its"], "<b>It's</b> is short for <i>it is</i>."],
      ["Is this ___ coat?", "your", ["you're"], "<b>Your</b> means <i>belonging to you</i>."],
      ["___ my best friend!", "You're", ["Your"], "<b>You're</b> is short for <i>you are</i>."],
      ["Can I come ___?", "too", ["to", "two"], "<b>Too</b> means <i>also</i> (or <i>very</i>): it has an extra <b>o</b>."],
      ["We ___ late for school.", "were", ["was"], "Use <b>were</b> with <i>we, you</i> and <i>they</i>."],
      ["She ___ happy to see us.", "was", ["were"], "Use <b>was</b> with <i>I, he, she</i> and <i>it</i>."],
      ["He played really ___.", "well", ["good"], "<b>Well</b> tells <i>how</i> you do something. <i>Good</i> describes a thing: a good game."],
      ["This pizza is ___ than that one.", "better", ["gooder", "more good"], "good → <b>better</b> → best."],
      ["That was the ___ day ever!", "best", ["goodest", "most good"], "good → better → <b>best</b>."],
      ["Mia and ___ went to the shop.", "I", ["me"], "Take away <i>Mia and</i>: “<b>I</b> went to the shop” sounds right."],
      ["Grandma gave sweets to Leo and ___.", "me", ["I"], "Take away <i>Leo and</i>: “gave sweets to <b>me</b>” sounds right."]
    ],
    challenge: [
      ["If I ___ you, I'd say sorry.", "were", ["was", "am"], "For <i>if</i> wishes and pretend ideas, use <b>were</b>: <i>If I were a bird…</i>"],
      ["There are ___ cookies than yesterday.", "fewer", ["less"], "Use <b>fewer</b> for things you can count, like cookies."],
      ["I have ___ time than you.", "less", ["fewer"], "Use <b>less</b> for things you can't count, like time or water."],
      ["She ___ already left when we arrived.", "had", ["has", "have"], "Something that happened <i>before</i> another past thing uses <b>had</b>."],
      ["He ___ his homework yesterday.", "did", ["done", "doed"], "<i>Done</i> needs a helper (<i>has done</i>). On its own in the past: <b>did</b>."],
      ["Between you and ___, it was boring.", "me", ["I"], "After words like <i>between, to, with</i>, use <b>me</b>."],
      ["She ran ___ than her brother.", "faster", ["more fast", "fastest"], "Short words add <b>-er</b> to compare two things: fast → <b>faster</b>."],
      ["This is the ___ book in the library.", "most interesting", ["interestingest", "more interesting"], "Long words use <b>most</b> for the top of a group: the <b>most interesting</b>."],
      ["We should ___ gone earlier.", "have", ["of"], "It's <b>should have</b>. It only <i>sounds</i> like “should of”."],
      ["The ___ toys were everywhere.", "children's", ["childrens'", "childrens"], "<i>Children</i> doesn't end in s, so add <b>'s</b>: children's."],
      ["Both ___ tails were wagging.", "dogs'", ["dog's", "dogs"], "More than one dog, so the apostrophe goes <b>after</b> the s: dogs'."],
      ["I ___ seen that film twice.", "have", ["has", "of"], "Use <b>have</b> with <i>I, you, we</i> and <i>they</i>."],
      ["Everyone ___ their own lunch.", "brought", ["brung", "bringed"], "<i>Bring</i> is irregular: today I bring, yesterday I <b>brought</b>."],
      ["The balloon ___ up into the sky.", "rose", ["rised", "raised"], "<i>Rise</i> is irregular: today it rises, yesterday it <b>rose</b>."]
    ]
  };

  function grammarQuestion(level){
    const [sentence, answer, wrong, why] = choice(GRAMMAR[level]);
    return pick({
      prompt: sentence,
      answer, options: [answer, ...wrong],
      explain: `“${sentence.replace("___", "<b>" + answer + "</b>")}”<br>💡 ${why}`
    });
  }

  /* ---------------- topics ---------------- */
  const TOPICS = [
    {
      id: "meanings", label: "Word Meanings", icon: "📚", title: "What does it mean?",
      levelDesc: { warmup: "Everyday words", practice: "5th-grade words", challenge: "Big brainy words" },
      hint: "Tap the meaning that fits, or press 1–4.",
      generate: meaningQuestion
    },
    {
      id: "pairs", label: "Same & Opposite", icon: "🔁", title: "Synonyms & antonyms",
      levelDesc: { warmup: "Easy word pairs", practice: "Trickier pairs", challenge: "Big brainy pairs" },
      hint: "Synonyms mean the same. Antonyms mean the opposite.",
      modes: [{ id: "mix", label: "Mix" }, { id: "same", label: "Same only" }, { id: "opposite", label: "Opposite only" }],
      generate: pairQuestion
    },
    {
      id: "spelling", label: "Spelling", icon: "🐝", title: "Spell it right",
      levelDesc: { warmup: "Words people often get wrong", practice: "Tricky 5th-grade words", challenge: "Super-tricky words" },
      hint: "Look closely at every letter!",
      modes: [{ id: "pick", label: "Pick it" }, { id: "type", label: "Type it 🔊" }],
      generate: spellingQuestion
    },
    {
      id: "types", label: "Word Types", icon: "🧩", title: "Nouns, verbs and more",
      levelDesc: { warmup: "Nouns, verbs and adjectives", practice: "…plus adverbs", challenge: "…plus pronouns, prepositions and conjunctions" },
      hint: "Look at what the word is doing in the sentence.",
      generate: wordTypeQuestion
    },
    {
      id: "grammar", label: "Grammar", icon: "✏️", title: "Pick the right word",
      levelDesc: { warmup: "Plurals, a/an and the past", practice: "their/there/they're, its/it's and more", challenge: "fewer/less, apostrophes and tricky verbs" },
      hint: "Read the whole sentence out loud in your head.",
      generate: grammarQuestion
    }
  ];

  const store = Hub.store;
  if (!store.english) store.english = {};

  Notebook.register({
    id: "english", title: "Word Wizard", icon: "🧙",
    blurb: "English: word meanings, spelling, word types and grammar, with a tip every time.",
    unit: "/// an English practice notebook",
    tagline: "Five English topics, endless fresh questions, and a tip for every answer",
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
