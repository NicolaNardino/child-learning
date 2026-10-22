/* The Race Off car model: one drawing for your car, the ghost, the rival and the garage preview.
   A side view facing right, in the car's own frame (its centre at 0, 0, y down), scaled by z:
     RaceOffCar.draw(ctx, X, Y, angle, z, car, opts)   car = { style, wr (wheel radius), trim }
       opts: body (paint colour), trim, rim ({ c, st }), wheels ([{ lx, ly, ang }] in the car's frame),
             flame (0, 1 for gas, 2 for nitro), bob (the driver's head), ghost (no decals or glow)
     RaceOffCar.preview(canvas, car, paint, rim)       the big picture in the garage and the style tab
     RaceOffCar.WHEELS                                 where the shock absorbers meet the body
   Styles: rod (hot rod with a blower), fin (tail fin), wedge (spoiler) and truck (roll bar and lights). */
(function(){
  "use strict";
  const WHEELS = [[-36, 10], [36, 10]];
  const CHROME = { c: "#c9ced8", st: "spokes" };
  // lighten (f > 0) or darken (f < 0) a #rrggbb colour
  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16), t = f < 0 ? 0 : 255, p = Math.abs(f), m = v => Math.round(v + (t - v) * p); return `rgb(${m(n >> 16)},${m((n >> 8) & 255)},${m(n & 255)})`; };
  const BODY = {
    rod(g){ g.moveTo(-54, 10); g.lineTo(-56, -3); g.quadraticCurveTo(-56, -13, -45, -13); g.lineTo(-27, -13); g.lineTo(-21, -30); g.quadraticCurveTo(-19, -35, -12, -35); g.lineTo(3, -35); g.quadraticCurveTo(9, -35, 11, -29); g.lineTo(16, -14); g.lineTo(45, -11); g.quadraticCurveTo(58, -9, 58, 2); g.lineTo(57, 10); g.closePath(); },
    fin(g){ g.moveTo(-54, 10); g.lineTo(-56, -5); g.quadraticCurveTo(-53, -12, -40, -12); g.lineTo(-17, -14); g.quadraticCurveTo(-6, -34, 13, -16); g.lineTo(44, -8); g.quadraticCurveTo(59, -4, 58, 10); g.closePath(); },
    wedge(g){ g.moveTo(-54, 10); g.lineTo(-55, -9); g.lineTo(-26, -15); g.quadraticCurveTo(-8, -31, 14, -15); g.lineTo(59, -1); g.lineTo(59, 10); g.closePath(); },
    truck(g){ g.moveTo(-57, 6); g.lineTo(-57, -13); g.lineTo(-22, -13); g.lineTo(-16, -38); g.lineTo(13, -38); g.lineTo(22, -15); g.lineTo(54, -11); g.quadraticCurveTo(60, -10, 60, -4); g.lineTo(59, 6); g.closePath(); }
  };
  // the window, and where the driver's helmet sits behind it
  const CABIN = {
    rod:   { glass: [[-19, -31], [7, -31], [11, -17], [-23, -17]], head: [-5, -22] },
    fin:   { glass: [[-14, -16], [-6, -28], [5, -26], [11, -17]], head: [-2, -21] },
    wedge: { glass: [[-21, -17], [-8, -27], [6, -24], [11, -16]], head: [-5, -20] },
    truck: { glass: [[-14, -35], [10, -35], [17, -17], [-19, -17]], head: [-2, -25] }
  };
  function draw(g, X, Y, ang, z, C, o){
    const st = BODY[C.style] ? C.style : "rod", col = o.body, trim = o.trim || C.trim, R0 = o.rim || CHROME, r = C.wr;
    const wheels = o.wheels || [{ lx: -36, ly: 30, ang: o.spin || 0 }, { lx: 36, ly: 30, ang: o.spin || 0 }];
    g.save(); g.translate(X, Y); g.rotate(ang); g.scale(z, z); g.lineJoin = "round"; g.lineCap = "round";
    // the shock absorbers: a dark body, a shiny rod and a coil spring in the trim colour
    wheels.forEach((w, i) => {
      const mx = WHEELS[i][0], my = WHEELS[i][1] - 2, dx = w.lx - mx, dy = w.ly - my, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      g.strokeStyle = "#3a3f4c"; g.lineWidth = 6; g.beginPath(); g.moveTo(mx, my); g.lineTo(mx + ux * L * 0.5, my + uy * L * 0.5); g.stroke();
      g.strokeStyle = "#d6dbe4"; g.lineWidth = 3; g.beginPath(); g.moveTo(mx + ux * L * 0.4, my + uy * L * 0.4); g.lineTo(w.lx, w.ly); g.stroke();
      g.strokeStyle = trim; g.lineWidth = 1.6; g.beginPath();
      for (let k = 0; k <= 8; k++) { const t = 0.15 + 0.7 * k / 8, s = k % 2 ? 4.5 : -4.5; g.lineTo(mx + ux * L * t - uy * s, my + uy * L * t + ux * s); }
      g.stroke();
    });
    // the exhaust flame: orange for gas, long and blue for nitro
    const pipeX = -56, pipeY = st === "truck" ? 0 : 5;
    if (o.flame) {
      const big = o.flame === 2, len = (big ? 2.1 : 1) * (20 + Math.random() * 14), fg = g.createLinearGradient(pipeX, 0, pipeX - len, 0);
      fg.addColorStop(0, big ? "#e8fbff" : "#fff6b0"); fg.addColorStop(0.35, big ? "#3aa8ff" : "#ff9a1a"); fg.addColorStop(1, "rgba(255,60,0,0)");
      g.fillStyle = fg; g.beginPath(); g.moveTo(pipeX, pipeY - 5); g.quadraticCurveTo(pipeX - len * 0.5, pipeY - 7, pipeX - len, pipeY); g.quadraticCurveTo(pipeX - len * 0.5, pipeY + 7, pipeX, pipeY + 5); g.fill();
    }
    g.fillStyle = "#aeb4c0"; g.strokeStyle = "#140a20"; g.lineWidth = 1.6; g.beginPath(); g.rect(pipeX - 3, pipeY - 2.5, 9, 5); g.fill(); g.stroke();
    // the fin and the spoiler sit behind the body
    if (st === "fin") { g.fillStyle = trim; g.strokeStyle = "#140a20"; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-52, -8); g.quadraticCurveTo(-50, -26, -45, -33); g.lineTo(-40, -32); g.quadraticCurveTo(-38, -18, -28, -11); g.closePath(); g.fill(); g.stroke(); }
    if (st === "wedge") { g.strokeStyle = "#140a20"; g.lineWidth = 3; g.beginPath(); g.moveTo(-46, -11); g.lineTo(-48, -22); g.stroke(); g.fillStyle = trim; g.lineWidth = 2; g.beginPath(); g.moveTo(-61, -27); g.lineTo(-37, -25); g.lineTo(-38, -20); g.lineTo(-60, -21); g.closePath(); g.fill(); g.stroke(); }
    if (st === "truck") { g.strokeStyle = "#2a2d36"; g.lineWidth = 3.5; g.beginPath(); g.moveTo(-40, -13); g.lineTo(-34, -32); g.lineTo(-18, -38); g.stroke(); g.fillStyle = "#ffd84d"; [-12, -4, 4].forEach(x => { g.beginPath(); g.arc(x, -41, 2.2, 0, 7); g.fill(); }); }
    // the body: shaded paint, decals, a shine line and a darker sill, clipped to the shape
    g.save(); g.beginPath(); BODY[st](g); g.clip();
    const bg = g.createLinearGradient(0, -40, 0, 12); bg.addColorStop(0, shade(col, 0.4)); bg.addColorStop(0.45, col); bg.addColorStop(1, shade(col, -0.45));
    g.fillStyle = bg; g.fillRect(-70, -45, 140, 60);
    if (!o.ghost) {
      g.fillStyle = trim;
      if (st === "rod" || st === "fin") { g.beginPath(); g.moveTo(50, 1); g.quadraticCurveTo(26, -9, 8, -1); g.quadraticCurveTo(16, -5, 1, -7); g.quadraticCurveTo(-10, -1, -24, -3); g.quadraticCurveTo(-6, 6, 20, 6); g.quadraticCurveTo(36, 4, 50, 1); g.fill(); }
      else if (st === "wedge") { g.globalAlpha *= 0.9; g.beginPath(); g.moveTo(-55, -5); g.lineTo(-24, -11); g.lineTo(58, 2); g.lineTo(58, 5); g.lineTo(-24, -7); g.lineTo(-55, -1); g.closePath(); g.fill(); g.globalAlpha /= 0.9; }
      else { g.beginPath(); g.arc(36, -2, 7, 0, 7); g.fill(); g.fillStyle = "#140a20"; g.font = "900 9px system-ui"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("8", 36, -1.5); }
    }
    g.fillStyle = "rgba(255,255,255,0.3)"; g.fillRect(-70, st === "truck" ? -11 : -12, 140, 2.2);
    g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(-70, st === "truck" ? 1 : 5, 140, 9);
    g.strokeStyle = "rgba(0,0,0,0.28)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-24, -12); g.lineTo(-24, 6); g.moveTo(16, -12); g.lineTo(16, 6); g.stroke();
    // the wheel arches
    g.fillStyle = "rgba(10,8,20,0.55)"; WHEELS.forEach(([lx]) => { g.beginPath(); g.arc(lx, st === "truck" ? 6 : 10, r + 4, Math.PI, 0); g.fill(); });
    g.restore();
    g.beginPath(); BODY[st](g); g.lineWidth = 2.4; g.strokeStyle = "#140a20"; g.stroke();
    // the window with the driver behind it
    const cab = CABIN[st];
    g.save(); g.beginPath(); cab.glass.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath();
    const gg = g.createLinearGradient(0, -36, 0, -16); gg.addColorStop(0, "#bfefff"); gg.addColorStop(1, "#3a7bb8"); g.fillStyle = gg; g.fill(); g.clip();
    const [hx, hy] = cab.head, by = hy + (o.bob || 0);
    g.fillStyle = o.ghost ? trim : "#f4f4f8"; g.beginPath(); g.arc(hx, by, 7, 0, 7); g.fill();
    g.fillStyle = o.ghost ? trim : trim; g.beginPath(); g.arc(hx, by, 7, Math.PI * 1.05, Math.PI * 1.6); g.lineTo(hx, by); g.fill();
    g.fillStyle = "#1a2236"; g.beginPath(); g.ellipse(hx + 3.5, by + 0.5, 3.6, 2.8, 0, 0, 7); g.fill();
    g.fillStyle = "rgba(255,255,255,0.35)"; g.beginPath(); g.moveTo(-30, -40); g.lineTo(-24, -40); g.lineTo(-40, -10); g.lineTo(-46, -10); g.closePath(); g.fill();
    g.restore();
    g.beginPath(); cab.glass.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.strokeStyle = "#140a20"; g.lineWidth = 2; g.stroke();
    // the engine blower on the hot rod
    if (st === "rod") { g.fillStyle = "#d6dbe4"; g.strokeStyle = "#140a20"; g.lineWidth = 1.8; g.beginPath(); g.rect(24, -21, 14, 9); g.fill(); g.stroke(); g.fillStyle = "#3a3f4c"; g.beginPath(); g.rect(26, -25, 10, 4); g.fill(); g.stroke(); }
    // lights: a glowing headlight at the front, a red light at the back
    const front = st === "wedge" ? [56, 2] : st === "truck" ? [57, -6] : [55, -2];
    if (!o.ghost) { const hg = g.createRadialGradient(front[0], front[1], 0, front[0], front[1], 10); hg.addColorStop(0, "rgba(255,250,210,0.9)"); hg.addColorStop(1, "rgba(255,250,210,0)"); g.fillStyle = hg; g.beginPath(); g.arc(front[0], front[1], 10, 0, 7); g.fill(); }
    g.fillStyle = "#fff8d0"; g.strokeStyle = "#140a20"; g.lineWidth = 1.4; g.beginPath(); g.ellipse(front[0], front[1], 2.6, 3.4, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#ff3030"; g.beginPath(); g.rect(-56.5, st === "truck" ? -11 : -6, 3.5, 6); g.fill(); g.stroke();
    // the wheels: tyres with tread, a sidewall ring, a shiny rim and a hub cap
    wheels.forEach(w => {
      g.save(); g.translate(w.lx, w.ly); g.rotate(w.ang);
      g.fillStyle = "#16161d"; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
      g.strokeStyle = "#3a3a46"; g.lineWidth = 2; g.beginPath(); for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; g.moveTo(Math.cos(a) * (r - 0.5), Math.sin(a) * (r - 0.5)); g.lineTo(Math.cos(a) * (r - 3.5), Math.sin(a) * (r - 3.5)); } g.stroke();
      g.strokeStyle = "#2c2c36"; g.lineWidth = 1.4; g.beginPath(); g.arc(0, 0, r * 0.74, 0, 7); g.stroke();
      const rr = r * 0.6, rg = g.createRadialGradient(-rr * 0.3, -rr * 0.3, 1, 0, 0, rr); rg.addColorStop(0, shade(R0.c, 0.55)); rg.addColorStop(1, shade(R0.c, -0.35));
      g.fillStyle = rg; g.beginPath(); g.arc(0, 0, rr, 0, 7); g.fill();
      g.strokeStyle = "rgba(20,20,40,0.6)"; g.lineWidth = R0.st === "star" ? 1.5 : 2.4; g.beginPath();
      if (R0.st === "disc") { g.arc(0, 0, rr * 0.62, 0, 7); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.moveTo(Math.cos(a) * rr * 0.75, Math.sin(a) * rr * 0.75); g.arc(Math.cos(a) * rr * 0.8, Math.sin(a) * rr * 0.8, 0.8, 0, 7); } }
      else { const sp = R0.st === "star" ? 8 : 5; for (let k = 0; k < sp; k++) { const a = k / sp * Math.PI * 2; g.moveTo(Math.cos(a) * rr * 0.25, Math.sin(a) * rr * 0.25); g.lineTo(Math.cos(a) * rr * 0.95, Math.sin(a) * rr * 0.95); } }
      g.stroke();
      g.fillStyle = trim; g.strokeStyle = "#140a20"; g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, rr * 0.3, 0, 7); g.fill(); g.stroke();
      g.restore();
      g.strokeStyle = "rgba(255,255,255,0.22)"; g.lineWidth = 1.6; g.beginPath(); g.arc(w.lx, w.ly, r - 2, Math.PI * 1.1, Math.PI * 1.45); g.stroke();
    });
    g.restore();
  }
  // the big picture of a car in the garage and the style tab, in its paint and wheels
  function preview(cv, C, paint, rim){
    const dpr = Math.min(2, window.devicePixelRatio || 1), Wp = 360, Hp = 160;
    cv.width = Wp * dpr; cv.height = Hp * dpr;
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sky = g.createLinearGradient(0, 0, 0, Hp); sky.addColorStop(0, "#6fc3ff"); sky.addColorStop(1, "#d8f0ff"); g.fillStyle = sky; g.fillRect(0, 0, Wp, Hp);
    g.fillStyle = "#7fb36a"; g.fillRect(0, Hp - 22, Wp, 22); g.fillStyle = "#4cc24a"; g.fillRect(0, Hp - 24, Wp, 5);
    g.fillStyle = "rgba(0,0,0,0.18)"; g.beginPath(); g.ellipse(Wp / 2, Hp - 22, 120, 6, 0, 0, 7); g.fill();
    const z = 1.55, wy = 26;
    draw(g, Wp / 2 + 4, Hp - 22 - (wy + C.wr) * z, 0, z, C, { body: paint || C.body, rim, wheels: [{ lx: -36, ly: wy, ang: 0.3 }, { lx: 36, ly: wy, ang: 1.1 }] });
  }
  window.RaceOffCar = { draw, preview, WHEELS };
})();
