# 🎒 Learn & Play

Learning and games for a 5th grader. The home screen asks **Learning** or **Games**, and each one lists its apps and has its own 🏆 trophy shelf.

There's nothing to install and no build step. Just open `index.html` in a browser.

## 📚 Learning

- 🔢 **Fast Math**: a maths practice notebook. It gives you endless new questions, and every answer comes with a worked explanation.
  - Six topics: ➕ Add & Subtract, ✖️ Multiply & Divide, 🍕 Fractions, 💯 Decimals & Percents, 🧮 Order of Operations, 📐 Shapes.
  - Three levels: **Warm-up**, **Practice** and **Challenge**.
  - ⏱️ **Time Trial**: answer 16 questions in 2 minutes and earn a rating, from *Keep practicing* up to *Outstanding!*
  - 🏁 **Race to the finish**: every right answer moves your car forward, while Robo 🤖 drives on its own. Pick Robo's speed (🐢 Easy, 🚗 Medium, 🚀 Hard) and get 10 right before Robo crosses the line!
  - 🔥 Streaks, accuracy and 🎊 confetti for every right answer.

## 🎮 Games

- 🏃 **Robot Tag**: a 3D-style parkour game. Run, double-jump and wall-jump to escape the robot taggers for 3 minutes. Another robot joins every minute, and they keep getting faster. The robots plan a real route to you, but they can't tag you through a wall or from under a platform.
- 👻 **Pac-Man**: eat every dot and dodge the four ghosts. Gobble a big flashing dot and the ghosts turn blue, so you can chase them for bonus points.
- 🧟 **Zombie Blaster**: a 3D-style shooter in a moonlit graveyard. Point the mouse and click to blast goo. Waves get bigger, with speedy runners from wave 2 and big brutes from wave 3. Clear a wave to win back a heart.
- 🧗 **Parkour Run**: a 3D obby high in the sky. Jump across orange, yellow, blue, green and black blocks that climb up and drop down: rainbow steps, a kill brick run, skinny beams, a spiral tower and a big drop. Touch a red kill brick or fall off and you go back to your last 🚩 checkpoint. Reach the 🏆 as fast as you can!

Every game fills the screen and has touch buttons on phones and tablets.

## How it's built

```
index.html                 the launcher: home, section lists, and the list of apps
core/
  core.css                 the shared look: theme, buttons, effects, trophies, launcher
  core.js                  saved progress, trophies, confetti, the app list and screen switching (window.Hub)
learning/
  math/                    Fast Math (math.css, math.js)
games/
  game-frame.css           the full-screen frame every game sits in
  robot-tag/               Robot Tag
  pacman/                  Pac-Man
  zombie-blaster/          Zombie Blaster
  parkour/                 Parkour Run
```

The address bar keeps track of where you are: `#/` is home, `#/games` is a section, and `#/games/pacman` is an app. That makes the browser's back button work, and you can bookmark a game.

Progress is saved in this browser's `localStorage` under one key, shared by every app.

### Adding a new app

1. Make a folder, like `learning/spelling/` or `games/snake/`, with a `.js` file (and a `.css` file if it needs one).
2. In the `.js` file, register the app:

   ```js
   (function(){
     "use strict";
     const store = Hub.store; // saved progress; call Hub.saveStore() after changing it

     Hub.register({
       id: "spelling", section: "learning",          // section is "learning" or "games"
       title: "Spelling Bee", icon: "🐝",
       blurb: "One line about the app, for its card.",
       stat: () => store.spellingBest ? "Best: " + store.spellingBest : "", // optional
       badges: [                                     // optional: trophies for the section's shelf
         { id: "spell10", icon: "🐝", name: "Busy Bee", desc: "Spell 10 words right", test: () => (store.spellingRight || 0) >= 10 }
       ],
       mount
     });

     // called the first time the app is opened: build it inside host
     function mount(host){
       host.innerHTML = `<div class="wrap"><a class="back-link" href="#/learning">← Learning</a> ...</div>`;
       return {
         open(){ /* shown: start timers or game loops */ },
         close(){ /* hidden: stop them */ }
       };
     }
   })();
   ```

3. Add its `<link>` and `<script>` lines to `index.html`, next to the other apps.

The app shows up in its section's list, and its trophies go on that section's shelf. Call `Hub.checkBadges()` after progress changes to award new trophies. Games can reuse the `game-screen` frame from `games/game-frame.css`, and call `Hub.leave()` from their Exit button.
