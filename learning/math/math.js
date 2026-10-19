/* Fast Math: a maths practice notebook for 5th graders. Six topics, three levels,
   a worked explanation for every answer, Time Trials, and a race against Robo. */
(function(){
  "use strict";

  /* ---------------- utilities ---------------- */
  function randInt(min, max){ return Math.floor(Math.random() * (max - min + 1)) + min; }
  function choice(arr){ return arr[randInt(0, arr.length - 1)]; }
  function gcd(a, b){ a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }
  function simplifyFrac(n, d){ if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return [n / g, d / g]; }
  function fracStr(n, d){
    const [sn, sd] = simplifyFrac(n, d);
    if (sd === 1) return String(sn);
    const whole = Math.trunc(sn / sd);
    const rem = Math.abs(sn % sd);
    if (whole !== 0 && rem !== 0) return whole + " " + rem + "/" + sd;
    return sn + "/" + sd;
  }
  function fmtMoney(){ return ""; }
  function round2(x){ return Math.round(x * 100) / 100; }

  // parse "3/4", "-2/5", "1 1/2", "2" -> {n,d} or null
  function parseFraction(str){
    str = str.trim();
    if (!str) return null;
    const mixed = str.match(/^(-?\d+)\s+(\d+)\/(\d+)$/);
    if (mixed) {
      const w = parseInt(mixed[1], 10), n = parseInt(mixed[2], 10), d = parseInt(mixed[3], 10);
      if (d === 0) return null;
      const sign = w < 0 ? -1 : 1;
      return { n: w * d + sign * n, d: d };
    }
    const simple = str.match(/^(-?\d+)\/(\d+)$/);
    if (simple) {
      const n = parseInt(simple[1], 10), d = parseInt(simple[2], 10);
      if (d === 0) return null;
      return { n, d };
    }
    const whole = str.match(/^-?\d+$/);
    if (whole) return { n: parseInt(str, 10), d: 1 };
    return null;
  }
  function fractionsEqual(a, b){ return a.n * b.d === b.n * a.d; }

  function parseNumber(str){
    str = str.trim().replace(/,/g, "");
    if (!/^-?\d+(\.\d+)?$/.test(str)) return null;
    return parseFloat(str);
  }

  /* ---------------- topic problem generators ----------------
     each returns { prompt, explain(userCorrect), check(input), decimals, hint }
  */
  const TOPICS = [
    {
      id: "addsub", label: "Add & Subtract", icon: "➕",
      title: "Addition & subtraction",
      levelDesc: { warmup: "Numbers up to 20", practice: "Numbers up to 200", challenge: "Up to 1000, with negatives" },
      hint: "Type the number. Some challenge answers are negative — start with a − sign.",
      inputMode: "text",
      generate(level){
        if (level === "warmup") {
          const op = choice(["+", "−"]);
          let a = randInt(1, 20), b = randInt(1, 20);
          if (op === "−" && b > a) [a, b] = [b, a];
          const ans = op === "+" ? a + b : a - b;
          return mk(`${a} ${op} ${b} = ?`, ans, `${a} ${op} ${b} = ${ans}.`);
        }
        if (level === "practice") {
          const op = choice(["+", "−", "+3"]);
          if (op === "+3") {
            const a = randInt(10, 200), b = randInt(10, 200), c = randInt(10, 200);
            const ans = a + b + c;
            return mk(`${a} + ${b} + ${c} = ?`, ans, `Add left to right: ${a} + ${b} = ${a+b}, then ${a+b} + ${c} = ${ans}.`);
          }
          let a = randInt(10, 200), b = randInt(10, 200);
          if (op === "−" && b > a) [a, b] = [b, a];
          const ans = op === "+" ? a + b : a - b;
          return mk(`${a} ${op} ${b} = ?`, ans, `${a} ${op} ${b} = ${ans}.`);
        }
        // challenge
        const kind = choice(["big", "neg", "dec"]);
        if (kind === "big") {
          const op = choice(["+", "−"]);
          let a = randInt(100, 1000), b = randInt(100, 1000);
          if (op === "−" && b > a) [a, b] = [b, a];
          const ans = op === "+" ? a + b : a - b;
          return mk(`${a} ${op} ${b} = ?`, ans, `${a} ${op} ${b} = ${ans}.`);
        }
        if (kind === "neg") {
          const a = randInt(1, 50), b = randInt(1, 50);
          const ans = a - b;
          return mk(`${a} − ${b} = ?`, ans, `${a} is smaller than ${b}, so the answer dips below zero: ${a} − ${b} = ${ans}.`, { hint: "Answer may be negative — use a − sign." });
        }
        const op = choice(["+", "−"]);
        let a = round2(randInt(10, 900) / 10), b = round2(randInt(10, 900) / 10);
        if (op === "−" && b > a) [a, b] = [b, a];
        const ans = round2(op === "+" ? a + b : a - b);
        return mk(`${a} ${op} ${b} = ?`, ans, `${a} ${op} ${b} = ${ans}.`, { decimals: 1 });
      }
    },
    {
      id: "muldiv", label: "Multiply & Divide", icon: "✖️",
      title: "Multiplication & division",
      levelDesc: { warmup: "Up to 10 × 10", practice: "Up to 20 × 20", challenge: "Up to 300 × 300" },
      hint: "Type the number.",
      inputMode: "numeric",
      modes: [
        { id: "mix", label: "Mix" },
        { id: "multiply", label: "× only" },
        { id: "divide", label: "÷ only" }
      ],
      generate(level, mode){
        mode = mode || "mix";
        function wantMultiply(){ return mode === "multiply" ? true : mode === "divide" ? false : Math.random() < 0.5; }
        const [lo, hi] = level === "warmup" ? [1, 10] : level === "practice" ? [1, 20] : [1, 300];
        if (wantMultiply()) {
          const a = randInt(lo, hi), b = randInt(lo, hi);
          const ans = a * b;
          return mk(`${a} × ${b} = ?`, ans, `${a} × ${b} = ${ans}.`);
        }
        const b = randInt(lo, hi), q = randInt(lo, hi), a = b * q;
        return mk(`${a} ÷ ${b} = ?`, q, `${a} ÷ ${b} = ${q}, because ${b} × ${q} = ${a}.`);
      }
    },
    {
      id: "fractions", label: "Fractions", icon: "🍕",
      title: "Fractions",
      levelDesc: { warmup: "Simplify, same denominator", practice: "Add & subtract, different denominators", challenge: "Multiply, mixed numbers" },
      hint: "Type as a fraction, e.g. 3/4 or 1 1/2.",
      inputMode: "text",
      generate(level){
        if (level === "warmup") {
          if (Math.random() < 0.5) {
            const d = choice([4, 6, 8, 9, 10, 12]);
            const f = choice([2, 3]);
            let n = randInt(1, d - 1);
            n = n - (n % f === 0 ? 0 : n % f);
            if (n === 0) n = f;
            const un = n * f, ud = d * f;
            const [sn, sd] = simplifyFrac(un, ud);
            return mkFrac(`Simplify ${un}/${ud}`, sn, sd, `${un}/${ud} ÷ ${gcd(un,ud)} = ${sn}/${sd}.`);
          }
          const d = choice([5, 6, 7, 8]);
          const a = randInt(1, d - 1), b = randInt(1, d - a);
          const n = a + b;
          const [sn, sd] = simplifyFrac(n, d);
          return mkFrac(`${a}/${d} + ${b}/${d} = ?`, sn, sd, `${a}/${d} + ${b}/${d} = ${n}/${d}` + (sd !== d ? ` = ${sn}/${sd} in simplest form.` : "."));
        }
        if (level === "practice") {
          const pairs = [[2,4],[2,6],[3,6],[2,3],[3,4],[4,5]];
          const [d1, d2] = choice(pairs);
          const op = choice(["+", "−"]);
          let a = randInt(1, d1 - 1), b = randInt(1, d2 - 1);
          const lcm = (d1 * d2) / gcd(d1, d2);
          let n1 = a * (lcm / d1), n2 = b * (lcm / d2);
          if (op === "−" && n2 > n1) { [n1, n2] = [n2, n1]; [a, b] = [b, a]; }
          const n = op === "+" ? n1 + n2 : n1 - n2;
          const [sn, sd] = simplifyFrac(n, lcm);
          return mkFrac(`${a}/${d1} ${op} ${b}/${d2} = ?`, sn, sd,
            `Common denominator ${lcm}: ${n1}/${lcm} ${op} ${n2}/${lcm} = ${n}/${lcm}` + (sd !== lcm ? ` = ${sn}/${sd}.` : "."));
        }
        // challenge
        if (Math.random() < 0.5) {
          const d1 = choice([2,3,4,5]), d2 = choice([2,3,4,5]);
          const a = randInt(1, d1 - 1), b = randInt(1, d2 - 1);
          const n = a * b, d = d1 * d2;
          const [sn, sd] = simplifyFrac(n, d);
          return mkFrac(`${a}/${d1} × ${b}/${d2} = ?`, sn, sd, `Multiply straight across: (${a}×${b})/(${d1}×${d2}) = ${n}/${d}` + (sd !== d ? ` = ${sn}/${sd}.` : "."));
        }
        const w = randInt(1, 3), d = choice([3,4,5]), n = randInt(1, d - 1);
        const c = randInt(1, 3);
        const totalN = w * d + n, totalD = d;
        const sumN = totalN + c * d;
        const [sn, sd] = simplifyFrac(sumN, totalD);
        return mkFrac(`${w} ${n}/${d} + ${c} = ?`, sn, sd, `${w} ${n}/${d} is ${totalN}/${totalD}; add ${c} (=${c*d}/${totalD}) to get ${sumN}/${totalD}` + (sd !== totalD ? ` = ${fracStr(sn, sd)}.` : "."));
      }
    },
    {
      id: "decpct", label: "Decimals & Percents", icon: "💯",
      title: "Decimals & percentages",
      levelDesc: { warmup: "1 decimal place, friendly %", practice: "Multiply decimals, common %", challenge: "Harder %, 2 decimal places" },
      hint: "Type the number.",
      inputMode: "decimal",
      generate(level){
        if (level === "warmup") {
          if (Math.random() < 0.5) {
            const op = choice(["+", "−"]);
            let a = round2(randInt(10, 99) / 10), b = round2(randInt(10, 99) / 10);
            if (op === "−" && b > a) [a, b] = [b, a];
            const ans = round2(op === "+" ? a + b : a - b);
            return mk(`${a} ${op} ${b} = ?`, ans, `${a} ${op} ${b} = ${ans}.`, { decimals: 1 });
          }
          const pct = choice([10, 50, 25]);
          const base = choice([20, 40, 60, 80, 100]);
          const ans = (pct / 100) * base;
          return mk(`${pct}% of ${base} = ?`, ans, `${pct}% is ${pct}/100. ${pct}/100 × ${base} = ${ans}.`);
        }
        if (level === "practice") {
          if (Math.random() < 0.5) {
            const a = round2(randInt(10, 99) / 10);
            const b = randInt(2, 9);
            const ans = round2(a * b);
            return mk(`${a} × ${b} = ?`, ans, `${a} × ${b} = ${ans}.`, { decimals: 2 });
          }
          const pct = choice([10, 20, 25, 50, 75]);
          const base = randInt(4, 40) * (pct === 25 || pct === 75 ? 4 : 10);
          const ans = (pct / 100) * base;
          return mk(`${pct}% of ${base} = ?`, ans, `${pct}% of ${base} = (${pct}/100) × ${base} = ${ans}.`);
        }
        // challenge
        if (Math.random() < 0.5) {
          const a = round2(randInt(100, 999) / 100);
          const b = round2(randInt(10, 90) / 10);
          const ans = round2(a * b);
          return mk(`${a} × ${b} = ?`, ans, `${a} × ${b} = ${ans}.`, { decimals: 2, hint: "Round to 2 decimal places." });
        }
        const pct = choice([15, 20, 35, 5]);
        const base = randInt(2, 20) * 20;
        const ans = (pct / 100) * base;
        return mk(`${pct}% of ${base} = ?`, ans, `${pct}% of ${base} = (${pct}/100) × ${base} = ${ans}.`);
      }
    },
    {
      id: "orderops", label: "Order of Operations", icon: "🧮",
      title: "Order of operations",
      levelDesc: { warmup: "One × or ÷ mixed with +/−", practice: "One pair of brackets", challenge: "Brackets and mixed operations" },
      hint: "Brackets first, then × or ÷, then + or −.",
      inputMode: "numeric",
      generate(level){
        if (level === "warmup") {
          const a = randInt(1, 10), b = randInt(2, 9), c = randInt(2, 9);
          if (Math.random() < 0.5) {
            const ans = a + b * c;
            return mk(`${a} + ${b} × ${c} = ?`, ans, `Multiply first: ${b} × ${c} = ${b*c}. Then ${a} + ${b*c} = ${ans}.`);
          }
          const prod = b * c;
          const d = randInt(0, prod);
          const ans = prod - d;
          return mk(`${b} × ${c} − ${d} = ?`, ans, `Multiply first: ${b} × ${c} = ${prod}. Then ${prod} − ${d} = ${ans}.`);
        }
        if (level === "practice") {
          const kind = choice(["addMul", "subMul", "divAdd"]);
          if (kind === "addMul") {
            const a = randInt(2, 9), b = randInt(2, 9), c = randInt(2, 9);
            const ans = (a + b) * c;
            return mk(`(${a} + ${b}) × ${c} = ?`, ans, `Brackets first: ${a} + ${b} = ${a+b}. Then ${a+b} × ${c} = ${ans}.`);
          }
          if (kind === "subMul") {
            let a = randInt(3, 12), b = randInt(1, a - 1), c = randInt(2, 9);
            const ans = (a - b) * c;
            return mk(`(${a} − ${b}) × ${c} = ?`, ans, `Brackets first: ${a} − ${b} = ${a-b}. Then ${a-b} × ${c} = ${ans}.`);
          }
          const c = randInt(2, 9), q = randInt(2, 12), sum = c * q;
          const a = randInt(1, sum - 1), b = sum - a;
          const ans = q;
          return mk(`(${a} + ${b}) ÷ ${c} = ?`, ans, `Brackets first: ${a} + ${b} = ${sum}. Then ${sum} ÷ ${c} = ${ans}.`);
        }
        // challenge
        const kind = choice(["mulSubAdd", "subMulAdd", "bracketsBoth"]);
        if (kind === "mulSubAdd") {
          const a = randInt(2, 9), b = randInt(2, 9), c = randInt(1, a * b - 1), d = randInt(1, 15);
          const ans = a * b - c + d;
          return mk(`${a} × ${b} − ${c} + ${d} = ?`, ans, `Multiply first: ${a} × ${b} = ${a*b}. Then work left to right: ${a*b} − ${c} = ${a*b-c}, + ${d} = ${ans}.`);
        }
        if (kind === "subMulAdd") {
          const b = randInt(2, 9), c = randInt(2, 9), product = b * c;
          const a = randInt(1, product);
          const d = randInt(Math.max(1, product - a), product - a + 15);
          const ans = a + d - product;
          return mk(`${a} + ${d} − ${b} × ${c} = ?`, ans, `Multiply first: ${b} × ${c} = ${product}. Then ${a} + ${d} = ${a+d}, and ${a+d} − ${product} = ${ans}.`);
        }
        const a = randInt(2, 9), b = randInt(1, a - 1), c = randInt(2, 9), d = randInt(1, c - 1);
        const ans = (a - b) * (c - d);
        return mk(`(${a} − ${b}) × (${c} − ${d}) = ?`, ans, `Each bracket first: ${a} − ${b} = ${a-b}, and ${c} − ${d} = ${c-d}. Then ${a-b} × ${c-d} = ${ans}.`);
      }
    },
    {
      id: "shapes", label: "Shapes", icon: "📐", title: "Area & perimeter",
      levelDesc: { warmup: "Rectangle perimeter", practice: "Rectangle & square area", challenge: "Triangles & missing sides" },
      hint: "Give just the number — units are shown for you.",
      inputMode: "numeric",
      generate(level){
        if (level === "warmup") {
          const l = randInt(3, 15), w = randInt(2, 12);
          const ans = 2 * (l + w);
          return mk(`Perimeter of a ${l} cm × ${w} cm rectangle = ? cm`, ans, `Perimeter = 2 × (length + width) = 2 × (${l} + ${w}) = ${ans} cm.`);
        }
        if (level === "practice") {
          if (Math.random() < 0.5) {
            const l = randInt(4, 20), w = randInt(3, 15);
            const ans = l * w;
            return mk(`Area of a ${l} cm × ${w} cm rectangle = ? cm²`, ans, `Area = length × width = ${l} × ${w} = ${ans} cm².`);
          }
          const s = randInt(3, 14);
          const ans = s * s;
          return mk(`Area of a square with side ${s} cm = ? cm²`, ans, `Area = side × side = ${s} × ${s} = ${ans} cm².`);
        }
        // challenge
        const kind = choice(["triangle", "missing"]);
        if (kind === "triangle") {
          const b = randInt(2, 20) * 2, h = randInt(2, 12);
          const ans = (b * h) / 2;
          return mk(`Area of a triangle, base ${b} cm, height ${h} cm = ? cm²`, ans, `Area = ½ × base × height = ½ × ${b} × ${h} = ${ans} cm².`);
        }
        const w = randInt(3, 15), area = w * randInt(3, 15);
        const l = area / w;
        return mk(`A rectangle has area ${area} cm² and width ${w} cm. Its length = ? cm`, l, `Length = area ÷ width = ${area} ÷ ${w} = ${l} cm.`);
      }
    }
  ];

  // numeric-answer problem helper
  function mk(prompt, answer, explain, opts){
    opts = opts || {};
    const decimals = opts.decimals || 0;
    return {
      prompt, hint: opts.hint || "",
      check(input){
        const v = parseNumber(input);
        if (v === null) return false;
        const rounded = decimals ? Math.round(v * Math.pow(10, decimals)) / Math.pow(10, decimals) : Math.round(v);
        return Math.abs(rounded - answer) < 1e-9;
      },
      explain: () => explain,
      answerDisplay: decimals ? answer.toFixed(decimals) : String(answer)
    };
  }
  // fraction-answer problem helper
  function mkFrac(prompt, n, d, explain){
    return {
      prompt, hint: "",
      check(input){
        const f = parseFraction(input);
        if (!f) return false;
        return fractionsEqual(f, { n, d });
      },
      explain: () => explain,
      answerDisplay: fracStr(n, d)
    };
  }

  // Fast Math saves straight into Hub.store (not a sub-object) so progress from before the split carries over
  Notebook.register({
    id: "math", title: "Fast Math", icon: "🔢",
    blurb: "Six topics from the 5th-grade workbook, with a worked answer every time.",
    unit: "/// a maths practice notebook",
    tagline: "Six topics from the 5th-grade workbook, endless fresh questions, and a worked explanation every time",
    nameFallback: "your mathematician",
    subject: "maths",
    data: Hub.store,
    topics: TOPICS,
    // the Rocket Run above the questions: every right answer fires the boosters
    scene: el => MathRocket(el, Hub.store.rocket = Hub.store.rocket || {})
  });
})();
