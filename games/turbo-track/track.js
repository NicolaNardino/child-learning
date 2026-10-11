/* Turbo Track's courses, seen from above: orange toy tracks floating in the sky.
   The track is a smooth curve through the corner points below, with two special pieces:
   a ramp and jump over a gap, and a loop-the-loop. It's chopped into samples every few pixels,
   and everything else (walls, boosters, laps, the robots' racing line) works from those. */
(function(){
  "use strict";

  const DS = 6;          // pixels between samples
  const HALF = 72;       // half the track's width
  const LOOP_R = 140;    // the loop's radius
  const LOOP_SHIFT = 150; // how far the loop's exit lane sits beside its entry lane

  // The tracks. Each is a list of corner points, driven anti-clockwise, so the inside of the track is
  // always on the driver's left (where the loop curls). "jump" or "loop" means the piece to the next
  // point is special; the points either side of it are in a straight line, so the track runs straight in.
  // start: the start line · boosts: booster spots (put them before the jump and the loop) ·
  // islands: floating islands far below, as [x, y, size, seed, { trees, house, pond, flowers }]
  const LAYOUTS = [
    {
      id: "sky", name: "Sky Loop", emoji: "☁️", world: { w: 3400, h: 2300 },
      points: [
        [600, 2000], [1000, 2000], [1500, 2000, "jump"], [2000, 2000], [2400, 2000],
        [2800, 1920], [3050, 1650], [2880, 1350], [3100, 1080], [2880, 820], [3020, 560], [2750, 320],
        [2300, 300], [1950, 300, "loop"], [1350, 300], [950, 300],
        [600, 360], [360, 600], [320, 900], [720, 1060], [1120, 1000], [1230, 1280], [860, 1420],
        [380, 1560], [330, 1850]
      ],
      start: [1150, 2000], boosts: [[1290, 2000], [2380, 300], [330, 760], [2960, 1780]],
      islands: [
        [1700, 1150, 330, 11, { trees: 9, house: true, pond: true, flowers: 26 }], [2380, 960, 120, 12, { trees: 3, flowers: 8 }],
        [620, 1330, 150, 13, { trees: 4, flowers: 12 }], [3300, 2250, 210, 14, { trees: 6, pond: true, flowers: 14 }],
        [-150, 200, 200, 15, { trees: 5, flowers: 10 }], [3350, 250, 160, 16, { trees: 4, house: true, flowers: 8 }],
        [1500, 2450, 180, 17, { trees: 5, flowers: 12 }], [2150, 650, 90, 18, { trees: 2 }]
      ]
    },
    {
      id: "canyon", name: "Cloud Canyon", emoji: "🏜️", world: { w: 3600, h: 2400 },
      points: [
        [500, 2050], [900, 2050], [1400, 2050, "jump"], [1900, 2050], [2300, 2050],
        [2800, 2000], [3200, 1800], [3350, 1450], [2950, 1250], [3300, 1000], [3250, 650], [2950, 400],
        [2500, 320], [2100, 320, "loop"], [1500, 320], [1100, 320],
        [700, 380], [420, 650], [450, 1000], [850, 1220], [450, 1450], [380, 1800]
      ],
      start: [1000, 2050], boosts: [[1150, 2050], [2550, 320], [3330, 1600], [430, 820]],
      islands: [
        [1800, 1250, 380, 21, { trees: 10, house: true, pond: true, flowers: 30 }], [2650, 1500, 140, 22, { trees: 4, flowers: 8 }],
        [1100, 900, 150, 23, { trees: 3, house: true, flowers: 10 }], [3600, 2300, 220, 24, { trees: 6, flowers: 12 }],
        [100, 2300, 200, 25, { trees: 5, pond: true }], [3650, 100, 180, 26, { trees: 4, flowers: 10 }]
      ]
    },
    {
      id: "hairpins", name: "Rainbow Hairpins", emoji: "🌈", world: { w: 3400, h: 2600 },
      points: [
        [500, 2300], [900, 2300], [1400, 2300, "jump"], [1900, 2300], [2300, 2300],
        [2800, 2250], [3050, 2000], [3000, 1720], [2500, 1650], [2050, 1620], [1880, 1420], [2300, 1250], [2900, 1200],
        [3100, 950], [3000, 650], [2700, 420],
        [2300, 350], [1900, 350, "loop"], [1300, 350], [900, 350],
        [500, 450], [350, 800], [480, 1200], [330, 1600], [380, 2000]
      ],
      start: [1000, 2300], boosts: [[1160, 2300], [2350, 350], [3040, 820], [400, 1000]],
      islands: [
        [1250, 1300, 300, 31, { trees: 8, house: true, pond: true, flowers: 24 }], [2550, 1430, 120, 32, { trees: 3, flowers: 6 }],
        [2400, 850, 200, 33, { trees: 6, flowers: 14 }], [3300, 2550, 220, 34, { trees: 6, pond: true }],
        [-100, 300, 200, 35, { trees: 5, house: true }], [1700, 2650, 170, 36, { trees: 4, flowers: 10 }]
      ]
    },
    {
      id: "zigzag", name: "Zigzag Mountain", emoji: "⛰️", world: { w: 2700, h: 3300 },
      points: [
        [400, 3000], [800, 3000], [1150, 3000, "jump"], [1650, 3000], [2050, 3000],
        [2350, 2820], [2420, 2460], [2050, 2200], [2420, 1900], [2050, 1600], [2420, 1300], [2380, 900], [2200, 550],
        [1900, 380], [1600, 380, "loop"], [1000, 380], [700, 380],
        [400, 480], [250, 850], [300, 1300], [750, 1600], [300, 1900], [250, 2400], [250, 2800]
      ],
      start: [900, 3000], boosts: [[920, 3000], [1950, 395], [255, 2600], [2320, 1050]],
      islands: [
        [1300, 1700, 360, 41, { trees: 10, house: true, pond: true, flowers: 28 }], [1350, 900, 200, 42, { trees: 5, flowers: 12 }],
        [1300, 2550, 220, 43, { trees: 6, house: true, flowers: 14 }], [2750, 3250, 200, 44, { trees: 5, pond: true }],
        [-150, 100, 200, 45, { trees: 5 }], [2800, 200, 180, 46, { trees: 4, flowers: 8 }]
      ]
    },
    {
      id: "islands", name: "Island Hopper", emoji: "🏝️", world: { w: 4000, h: 2100 },
      points: [
        [500, 1750], [900, 1750], [1300, 1750, "loop"], [1900, 1750], [2300, 1750],
        [2800, 1720], [3400, 1650], [3700, 1300], [3550, 900], [3700, 500], [3400, 250],
        [3000, 250], [2600, 250], [2100, 250, "jump"], [1600, 250], [1200, 250],
        [800, 300], [500, 500], [950, 700], [1400, 780], [1520, 1000], [1050, 1160], [500, 1250], [350, 1550]
      ],
      start: [700, 1750], boosts: [[820, 1750], [2420, 250], [3640, 1100], [370, 1400]],
      islands: [
        [2300, 1000, 380, 51, { trees: 10, house: true, pond: true, flowers: 30 }], [1350, 1450, 150, 52, { trees: 4, flowers: 10 }],
        [3100, 900, 200, 53, { trees: 5, house: true, flowers: 12 }], [4100, 2000, 220, 54, { trees: 6, pond: true }],
        [-100, 1900, 220, 55, { trees: 5, flowers: 12 }], [1000, -100, 200, 56, { trees: 5 }], [4100, 0, 180, 57, { trees: 4 }]
      ]
    }
  ];

  // the smallest speed that makes it over the jump and round the loop
  const MIN_SPEED = { jump: 300, loop: 280 };

  function catmull(p0, p1, p2, p3, t){
    const t2 = t * t, t3 = t2 * t;
    const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
    return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
  }
  const smooth = u => u * u * (3 - 2 * u);

  function build(layout){
    const POINTS = layout.points, START = layout.start, BOOSTS = layout.boosts;
    // 1. a fine line of raw points, each with what kind of track it is
    const raw = [];
    const n = POINTS.length;
    for (let i = 0; i < n; i++) {
      const p0 = POINTS[(i - 1 + n) % n], p1 = POINTS[i], p2 = POINTS[(i + 1) % n], p3 = POINTS[(i + 2) % n];
      const dx = p2[0] - p1[0], dy = p2[1] - p1[1], len = Math.hypot(dx, dy);
      const h = [dx / len, dy / len], left = [h[1], -h[0]];
      const at = (d, side, extra) => Object.assign({ x: p1[0] + h[0] * d + left[0] * side, y: p1[1] + h[1] * d + left[1] * side, kind: "road", z: 0 }, extra);
      if (p1[2] === "jump") {
        // run-up, ramp, gap, landing
        for (let d = 0; d < len; d += 2) {
          const kind = d < 80 ? "road" : d < 190 ? "ramp" : d < 420 ? "gap" : "land";
          raw.push(at(d, 0, { kind }));
        }
      } else if (p1[2] === "loop") {
        // a short run-up, then once round the loop (curling left), drifting sideways so the exit lane sits beside the entry
        const lead = 40, a = [p1[0] + h[0] * lead, p1[1] + h[1] * lead];
        for (let d = 0; d < lead; d += 2) raw.push(at(d, 0));
        const steps = Math.ceil(2 * Math.PI * LOOP_R / 2);
        for (let k = 0; k < steps; k++) {
          const th = 2 * Math.PI * k / steps, u = k / steps;
          const side = LOOP_R * (1 - Math.cos(th)) - LOOP_SHIFT * smooth(u);
          raw.push({
            x: a[0] + h[0] * LOOP_R * Math.sin(th) + left[0] * side,
            y: a[1] + h[1] * LOOP_R * Math.sin(th) + left[1] * side,
            kind: "loop", z: (1 - Math.cos(th)) / 2,
            deck: th > Math.PI * 1.2 // the part that crosses over the entry lane
          });
        }
        // then ease back into line by the next point
        const rest = len - lead;
        for (let d = 0; d < rest; d += 2) raw.push(at(lead + d, -LOOP_SHIFT * (1 - smooth(d / rest))));
      } else {
        for (let k = 0; k < 40; k++) {
          const [x, y] = catmull(p0, p1, p2, p3, k / 40);
          raw.push({ x, y, kind: "road", z: 0 });
        }
      }
    }

    // 2. even samples every DS pixels along the raw line
    let samples = [];
    let carry = 0;
    for (let i = 0; i < raw.length; i++) {
      const a = raw[i], b = raw[(i + 1) % raw.length];
      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
      let d = carry;
      while (d < segLen) {
        const u = d / segLen;
        samples.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, kind: a.kind, z: a.z + (b.z - a.z) * u, deck: !!a.deck });
        d += DS;
      }
      carry = d - segLen;
    }

    // 3. start counting at the start line
    let startI = 0, bestD = Infinity;
    samples.forEach((s, i) => {
      const d = Math.hypot(s.x - START[0], s.y - START[1]);
      if (s.kind === "road" && d < bestD) { bestD = d; startI = i; }
    });
    samples = samples.slice(startI).concat(samples.slice(0, startI));
    const N = samples.length, L = N * DS;
    const wrap = i => ((i % N) + N) % N;

    // direction and sideways normal (pointing left of the driver) at every sample
    samples.forEach((s, i) => {
      const a = samples[wrap(i - 1)], b = samples[wrap(i + 1)];
      s.angle = Math.atan2(b.y - a.y, b.x - a.x);
      s.nx = Math.sin(s.angle);
      s.ny = -Math.cos(s.angle);
    });

    // 4. boosters: the samples nearest each booster spot, for 66 pixels
    BOOSTS.forEach(([bx, by]) => {
      let bi = 0, bd = Infinity;
      samples.forEach((s, i) => { const d = Math.hypot(s.x - bx, s.y - by); if (s.kind === "road" && d < bd) { bd = d; bi = i; } });
      for (let k = 0; k < 11; k++) samples[wrap(bi + k)].boost = true;
    });

    // 5. special zones where a car rides along the track by itself: the loop, and ramp + gap + landing
    const zones = [];
    const zoneKind = s => s.kind === "loop" ? "loop" : (s.kind === "ramp" || s.kind === "gap" || s.kind === "land") ? "jump" : null;
    for (let i = 0; i < N; i++) {
      const k = zoneKind(samples[i]);
      if (!k || zoneKind(samples[wrap(i - 1)]) === k) continue;
      let j = i;
      while (zoneKind(samples[wrap(j + 1)]) === k) j++;
      const zone = { kind: k, start: i, end: j, min: MIN_SPEED[k] };
      if (k === "jump") {
        zone.gapStart = samples.findIndex((s, m) => m >= i && s.kind === "gap");
        zone.gapEnd = samples.findIndex((s, m) => m > zone.gapStart && s.kind !== "gap") - 1;
      }
      zones.push(zone);
      for (let m = i; m <= j; m++) samples[wrap(m)].zone = zone;
    }

    // 6. how fast the robots can take each bit of track: slower in tight bends, braking early before them
    const LAT = 950, BRAKE = 900, VMAX = 800;
    const safe = samples.map((s, i) => {
      if (s.zone) return VMAX;
      let da = samples[wrap(i + 4)].angle - samples[wrap(i - 4)].angle;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      const k = Math.abs(da) / (8 * DS);
      return k < 1e-4 ? VMAX : Math.min(VMAX, Math.sqrt(LAT / k));
    });
    for (let pass = 0; pass < 2; pass++) {
      for (let i = N - 1; i >= 0; i--) {
        const next = safe[wrap(i + 1)];
        safe[i] = Math.min(safe[i], Math.sqrt(next * next + 2 * BRAKE * DS));
      }
    }
    samples.forEach((s, i) => { s.safe = safe[i]; });

    // a car's height above the floor: up the loop, or flying over the gap
    function heightAt(i){
      const s = samples[wrap(i)];
      if (s.kind === "loop") return s.z;
      if (!s.zone || s.zone.kind !== "jump") return 0;
      const z = s.zone;
      if (s.kind === "ramp") return 0.25 * (wrap(i - z.start) / Math.max(1, z.gapStart - z.start));
      if (s.kind === "gap") {
        const u = wrap(i - z.gapStart) / Math.max(1, z.gapEnd - z.gapStart);
        return 0.25 * (1 - u) + 0.8 * Math.sin(Math.PI * u);
      }
      return 0;
    }

    // the spot a distance s along the track (any lap), and lat pixels to the driver's left
    function at(s, lat){
      const f = (((s / DS) % N) + N) % N, i = Math.floor(f), u = f - i;
      const a = samples[i], b = samples[wrap(i + 1)];
      let da = b.angle - a.angle;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      const angle = a.angle + da * u;
      const x = a.x + (b.x - a.x) * u + Math.sin(angle) * (lat || 0);
      const y = a.y + (b.y - a.y) * u - Math.cos(angle) * (lat || 0);
      return { x, y, angle, i, z: heightAt(i) + (heightAt(i + 1) - heightAt(i)) * u };
    }

    // how long a lap takes a Hard robot: about the time to beat for a super-fast lap
    let parLap = 0;
    for (let v = 0, sd = 0, boost = 0; sd < L; parLap += 1 / 60) {
      const smp = samples[Math.floor(sd / DS) % N];
      if (smp.boost) boost = 1.4;
      boost -= 1 / 60;
      const target = Math.min(smp.safe, boost > 0 ? 540 * 1.35 : 540);
      v = v < target ? Math.min(target, v + 400 / 60) : Math.max(target, v - 900 / 60);
      sd += v / 60;
    }

    return { layout, samples, N, L, DS, HALF, LOOP_R, zones, wrap, at, heightAt, world: layout.world, start: START, parLap };
  }

  window.TurboTrackCourse = { layouts: LAYOUTS, build };
})();
