/* Turbo Track's course, seen from above: an orange toy track on a bedroom floor.
   The track is a smooth curve through the corner points below, with two special pieces:
   a ramp and jump over a gap, and a loop-the-loop. It's chopped into samples every few pixels,
   and everything else (walls, boosters, laps, the robots' racing line) works from those. */
(function(){
  "use strict";

  const DS = 6;          // pixels between samples
  const HALF = 72;       // half the track's width
  const LOOP_R = 140;    // the loop's radius
  const LOOP_SHIFT = 150; // how far the loop's exit lane sits beside its entry lane

  // the corner points, driving anti-clockwise; "jump" or "loop" means the piece to the next point is special.
  // The points either side of a special piece are in a straight line with it, so the track runs straight into it.
  const POINTS = [
    [600, 2000], [1000, 2000], [1500, 2000, "jump"], [2000, 2000], [2400, 2000],
    [2800, 1920], [3050, 1650], [2880, 1350], [3100, 1080], [2880, 820], [3020, 560], [2750, 320],
    [2300, 300], [1950, 300, "loop"], [1350, 300], [950, 300],
    [600, 360], [360, 600], [320, 900], [720, 1060], [1120, 1000], [1230, 1280], [860, 1420],
    [380, 1560], [330, 1850]
  ];
  const START = [1150, 2000];
  const BOOSTS = [[1290, 2000], [2380, 300], [330, 760], [2960, 1780]];
  const WORLD = { w: 3400, h: 2300 };

  // the smallest speed that makes it over the jump and round the loop
  const MIN_SPEED = { jump: 300, loop: 280 };

  function catmull(p0, p1, p2, p3, t){
    const t2 = t * t, t3 = t2 * t;
    const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
    return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
  }
  const smooth = u => u * u * (3 - 2 * u);

  function build(){
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

    return { samples, N, L, DS, HALF, LOOP_R, zones, wrap, at, heightAt, world: WORLD, start: START };
  }

  window.TurboTrackCourse = { build };
})();
