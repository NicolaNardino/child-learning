/* The chess rules and BloxBot's brain, with no drawing in here.
   A position is { b, turn, castle, ep, half, full }: b is 64 squares, a8 first and h1 last (index = row * 8 + file,
   row 0 is rank 8), each empty or a piece { t: "P" | "N" | "B" | "R" | "Q" | "K", c: "w" | "b", id }.
   Every rule is in: castling, en passant, promotion, check, checkmate, stalemate, and draws by the 50-move rule,
   threefold repetition and not enough pieces to mate. BloxBot searches a few moves ahead (alpha-beta, then only
   captures until things are quiet) and scores positions by material and where the pieces stand.
     ChessEngine.start()                 the starting position
     ChessEngine.legal(pos)              every legal move: { from, to, p, cap, promo, castle, ep, double }
     ChessEngine.make(pos, move)         the position after a move (the old one is left as it was)
     ChessEngine.inCheck(pos, colour)    is that side's king attacked
     ChessEngine.san(pos, move)          the move written the usual way, like "Nf3", "exd5", "O-O" or "e8=Q#"
     ChessEngine.best(pos, level)        BloxBot's move: level "easy", "normal" or "hard"
     ChessEngine.key(pos)                a string that is the same for the same position (for repetitions)
     ChessEngine.notEnough(pos)          true when neither side can ever checkmate */
(function(){
  "use strict";
  const other = c => c === "w" ? "b" : "w";
  const on = (r, f) => r >= 0 && r < 8 && f >= 0 && f < 8;
  const DIRS = {
    N: [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]],
    B: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
    R: [[-1, 0], [1, 0], [0, -1], [0, 1]]
  };
  DIRS.Q = DIRS.B.concat(DIRS.R); DIRS.K = DIRS.Q;

  function start(){
    const b = new Array(64).fill(null), back = "RNBQKBNR";
    let id = 0;
    for (let f = 0; f < 8; f++) {
      b[f] = { t: back[f], c: "b", id: id++ }; b[8 + f] = { t: "P", c: "b", id: id++ };
      b[48 + f] = { t: "P", c: "w", id: id++ }; b[56 + f] = { t: back[f], c: "w", id: id++ };
    }
    return { b, turn: "w", castle: { wK: true, wQ: true, bK: true, bQ: true }, ep: -1, half: 0, full: 1 };
  }

  // is square sq attacked by side `by`?
  function attacked(b, sq, by){
    const r = sq >> 3, f = sq & 7, pr = by === "w" ? r + 1 : r - 1;   // a white pawn attacks up the board, so it sits one row below
    for (const df of [-1, 1]) if (on(pr, f + df)) { const p = b[pr * 8 + f + df]; if (p && p.c === by && p.t === "P") return true; }
    for (const [dr, df] of DIRS.N) if (on(r + dr, f + df)) { const p = b[(r + dr) * 8 + f + df]; if (p && p.c === by && p.t === "N") return true; }
    for (const [dr, df] of DIRS.K) if (on(r + dr, f + df)) { const p = b[(r + dr) * 8 + f + df]; if (p && p.c === by && p.t === "K") return true; }
    for (const [dr, df] of DIRS.Q) {
      const diag = dr && df;
      let rr = r + dr, ff = f + df;
      while (on(rr, ff)) {
        const p = b[rr * 8 + ff];
        if (p) { if (p.c === by && (p.t === "Q" || p.t === (diag ? "B" : "R"))) return true; break; }
        rr += dr; ff += df;
      }
    }
    return false;
  }
  const kingAt = (b, c) => b.findIndex(p => p && p.t === "K" && p.c === c);
  const inCheck = (pos, c) => attacked(pos.b, kingAt(pos.b, c), other(c));

  // every move the rules of movement allow, before checking whether it leaves your own king in check
  function pseudo(pos){
    const out = [], b = pos.b, c = pos.turn, o = other(c);
    const pawnTo = (from, to, p, cap, ep) => {
      if ((to >> 3) === 0 || (to >> 3) === 7) for (const promo of "QRBN") out.push({ from, to, p, cap, promo });
      else out.push({ from, to, p, cap, ep });
    };
    for (let sq = 0; sq < 64; sq++) {
      const p = b[sq];
      if (!p || p.c !== c) continue;
      const r = sq >> 3, f = sq & 7;
      if (p.t === "P") {
        const dir = c === "w" ? -1 : 1, home = c === "w" ? 6 : 1, r1 = r + dir;
        if (!on(r1, f)) continue;
        if (!b[r1 * 8 + f]) {
          pawnTo(sq, r1 * 8 + f, p, null);
          if (r === home && !b[(r + 2 * dir) * 8 + f]) out.push({ from: sq, to: (r + 2 * dir) * 8 + f, p, cap: null, double: true });
        }
        for (const df of [-1, 1]) {
          if (!on(r1, f + df)) continue;
          const t = r1 * 8 + f + df, q = b[t];
          if (q && q.c === o) pawnTo(sq, t, p, q);
          else if (t === pos.ep) pawnTo(sq, t, p, b[r * 8 + f + df], r * 8 + f + df);
        }
        continue;
      }
      const step = p.t === "N" || p.t === "K";
      for (const [dr, df] of DIRS[p.t]) {
        let rr = r + dr, ff = f + df;
        while (on(rr, ff)) {
          const t = rr * 8 + ff, q = b[t];
          if (q) { if (q.c === o) out.push({ from: sq, to: t, p, cap: q }); break; }
          out.push({ from: sq, to: t, p, cap: null });
          if (step) break;
          rr += dr; ff += df;
        }
      }
      if (p.t === "K") {
        const home = c === "w" ? 60 : 4, rook = s => b[s] && b[s].t === "R" && b[s].c === c;
        if (sq === home && !attacked(b, home, o)) {
          if (pos.castle[c + "K"] && !b[home + 1] && !b[home + 2] && rook(home + 3) && !attacked(b, home + 1, o) && !attacked(b, home + 2, o))
            out.push({ from: sq, to: home + 2, p, cap: null, castle: "K" });
          if (pos.castle[c + "Q"] && !b[home - 1] && !b[home - 2] && !b[home - 3] && rook(home - 4) && !attacked(b, home - 1, o) && !attacked(b, home - 2, o))
            out.push({ from: sq, to: home - 2, p, cap: null, castle: "Q" });
        }
      }
    }
    return out;
  }

  function make(pos, m){
    const b = pos.b.slice(), c = pos.turn;
    b[m.to] = m.promo ? { t: m.promo, c, id: m.p.id } : m.p;
    b[m.from] = null;
    if (m.ep !== undefined) b[m.ep] = null;
    if (m.castle) {
      const home = c === "w" ? 60 : 4;
      if (m.castle === "K") { b[home + 1] = b[home + 3]; b[home + 3] = null; }
      else { b[home - 1] = b[home - 4]; b[home - 4] = null; }
    }
    const castle = Object.assign({}, pos.castle);
    if (m.p.t === "K") { castle[c + "K"] = false; castle[c + "Q"] = false; }
    [m.from, m.to].forEach(sq => { if (sq === 63) castle.wK = false; if (sq === 56) castle.wQ = false; if (sq === 7) castle.bK = false; if (sq === 0) castle.bQ = false; });
    return { b, turn: other(c), castle, ep: m.double ? (m.from + m.to) / 2 : -1, half: m.p.t === "P" || m.cap ? 0 : pos.half + 1, full: pos.full + (c === "b" ? 1 : 0) };
  }
  const legal = pos => pseudo(pos).filter(m => !inCheck(make(pos, m), pos.turn));

  const FILES = "abcdefgh", sqName = i => FILES[i & 7] + (8 - (i >> 3));
  function san(pos, m){
    let t;
    if (m.castle) t = m.castle === "K" ? "O-O" : "O-O-O";
    else {
      t = m.p.t === "P" ? (m.cap ? FILES[m.from & 7] : "") : m.p.t;
      if (m.p.t !== "P") {
        const twins = legal(pos).filter(x => x.p.t === m.p.t && x.to === m.to && x.from !== m.from);
        if (twins.length) {
          const sameFile = twins.some(x => (x.from & 7) === (m.from & 7)), sameRank = twins.some(x => (x.from >> 3) === (m.from >> 3));
          t += !sameFile ? FILES[m.from & 7] : !sameRank ? String(8 - (m.from >> 3)) : sqName(m.from);
        }
      }
      t += (m.cap ? "x" : "") + sqName(m.to) + (m.promo ? "=" + m.promo : "");
    }
    const n = make(pos, m);
    if (inCheck(n, n.turn)) t += legal(n).length ? "+" : "#";
    return t;
  }
  const key = pos => pos.b.map(p => p ? (p.c === "w" ? p.t : p.t.toLowerCase()) : ".").join("") + pos.turn + (pos.castle.wK ? "K" : "") + (pos.castle.wQ ? "Q" : "") + (pos.castle.bK ? "k" : "") + (pos.castle.bQ ? "q" : "") + pos.ep;
  function notEnough(pos){
    const rest = pos.b.filter(p => p && p.t !== "K");
    return rest.length === 0 || (rest.length === 1 && (rest[0].t === "N" || rest[0].t === "B"));
  }

  /* ---------------- BloxBot ---------------- */
  const VALUE = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
  // bonuses for where a piece stands, from White's side (a8 first); Black reads them upside down
  const SPOT = {
    P: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
    N: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
    B: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
    R: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
    Q: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
    K: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
    KEnd: [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50]
  };
  // the score for the side to move: positive is good for them
  function score(pos){
    let s = 0, queens = 0, minors = 0;
    pos.b.forEach(p => { if (p && p.t === "Q") queens++; if (p && (p.t === "N" || p.t === "B" || p.t === "R")) minors++; });
    const endgame = queens === 0 || minors <= 2;
    for (let sq = 0; sq < 64; sq++) {
      const p = pos.b[sq];
      if (!p) continue;
      const i = p.c === "w" ? sq : (7 - (sq >> 3)) * 8 + (sq & 7);
      const v = VALUE[p.t] + (p.t === "K" && endgame ? SPOT.KEnd : SPOT[p.t])[i];
      s += p.c === "w" ? v : -v;
    }
    return pos.turn === "w" ? s : -s;
  }
  const MATE = 100000;
  const order = moves => moves.sort((a, b) => ((b.cap ? 10 * VALUE[b.cap.t] - VALUE[b.p.t] : 0) + (b.promo === "Q" ? 800 : 0)) - ((a.cap ? 10 * VALUE[a.cap.t] - VALUE[a.p.t] : 0) + (a.promo === "Q" ? 800 : 0)));
  function quiet(pos, alpha, beta, depth){
    const stand = score(pos);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (depth >= 4) return alpha;
    for (const m of order(pseudo(pos).filter(m => m.cap || m.promo === "Q"))) {
      const n = make(pos, m);
      if (inCheck(n, pos.turn)) continue;
      const v = -quiet(n, -beta, -alpha, depth + 1);
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }
  function search(pos, depth, alpha, beta, ply){
    if (depth <= 0) return quiet(pos, alpha, beta, 0);
    let any = false;
    for (const m of order(pseudo(pos))) {
      const n = make(pos, m);
      if (inCheck(n, pos.turn)) continue;
      any = true;
      const v = -search(n, depth - 1, -beta, -alpha, ply + 1);
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    }
    if (!any) return inCheck(pos, pos.turn) ? -MATE + ply : 0;
    return alpha;
  }
  const LEVELS = { easy: { depth: 1, noise: 120 }, normal: { depth: 2, noise: 25 }, hard: { depth: 3, noise: 0 } };
  function best(pos, level){
    const L = LEVELS[level] || LEVELS.normal, moves = order(legal(pos));
    let top = null, topV = -Infinity;
    for (const m of moves) {
      const v = -search(make(pos, m), L.depth - 1, -MATE - 1, MATE + 1, 1) + (Math.random() - 0.5) * 2 * L.noise;
      if (v > topV) { topV = v; top = m; }
    }
    return top;
  }

  window.ChessEngine = { start, legal, make, inCheck, san, best, key, notEnough, sqName, VALUE };
})();
