/* Block World's graphics: draws the world with WebGL, so it can be full sharp resolution.
   The world is cut into 16 × 16 chunks and each chunk is turned into one mesh (only the faces you could
   ever see). Every corner of every face gets a soft shadow when blocks are close to it (ambient occlusion),
   which is what makes it look like the real game. Also here: see-through leaves and glass, water, clouds,
   flowers, the outline round the block you point at, the block in your hand, and the bits that fly off a
   block when you dig it. createGL(canvas) gives back null if WebGL isn't there, and then the old
   ray-casting picture in soft.js is used instead. */
(function(){
  "use strict";
  const BW = window.BlockWorld;
  const { WW, WH, WD, SEA, world, at, ID, K, T, TILE_COLS, TILE_ROWS, BLOCKS, FACE, KIND, IS_OPAQUE, EMIT, TORCH_DIR, atlasData } = BW;
  const CH = 16, NCX = WW / CH, NCZ = WD / CH;
  const FOV = 70 * Math.PI / 180;
  const AO = [0.5, 0.68, 0.84, 1];          // how bright a corner is with 3, 2, 1 or 0 blocks crowding it
  const WATER_TOP = 0.88;                   // the surface of water sits a little below the top of its block
  const CLOUD_Y = 40, CLOUD_CELL = 8, CLOUD_N = 20, CLOUD_SPAN = CLOUD_CELL * CLOUD_N;
  const LIGHT = new Uint8Array(WW * WH * WD);  // how much light from glowing blocks reaches each spot, 0 to 15
  const lightAt = (x, y, z) => (x < 0 || x >= WW || z < 0 || z >= WD || y < 0 || y >= WH) ? 0 : LIGHT[at(x, y, z)];

  /* ---------------- shaders ---------------- */
  const PREC = "#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n";
  const MAIN_VS = `
    attribute vec3 aPos; attribute vec2 aUV; attribute float aLight; attribute float aBlock;
    uniform mat4 uVP; uniform vec3 uOffset; uniform vec3 uEye;
    varying vec2 vUV; varying float vLight; varying float vBlock; varying float vDist; varying vec3 vPos;
    void main(){
      vec3 p = aPos + uOffset;
      gl_Position = uVP * vec4(p, 1.0);
      vUV = aUV; vLight = aLight; vBlock = aBlock; vDist = length(p - uEye); vPos = p;
    }`;
  const MAIN_FS = PREC + `
    uniform sampler2D uTex; uniform vec3 uFog; uniform float uFogStart; uniform float uFogEnd;
    uniform float uAlpha; uniform float uWave; uniform float uTime; uniform vec3 uLight;
    varying vec2 vUV; varying float vLight; varying float vBlock; varying float vDist; varying vec3 vPos;
    void main(){
      vec4 c = texture2D(uTex, vUV);
      if (uAlpha >= 1.0 && c.a < 0.5) discard;          // the holes in leaves and glass
      float light = vLight;
      if (uWave > 0.5) light *= 0.93 + 0.07 * sin(vPos.x * 2.3 + vPos.z * 1.9 + uTime * 1.6); // water shimmers
      // the sun or moon lights everything the same, and a glowing block adds a warm light to what's near it (by day there's nothing to add)
      vec3 glow = vec3(1.0, 0.82, 0.58) * pow(vBlock, 1.25);
      vec3 rgb = c.rgb * light * (1.0 - (1.0 - uLight) * (1.0 - glow));
      float f = clamp((vDist - uFogStart) / (uFogEnd - uFogStart), 0.0, 1.0);
      rgb = mix(rgb, uFog, f);
      gl_FragColor = vec4(rgb, uAlpha >= 1.0 ? 1.0 : c.a * uAlpha * (1.0 - f * 0.5));
    }`;
  const SKY_VS = `attribute vec2 aP; varying vec2 vP; void main(){ vP = aP; gl_Position = vec4(aP, 0.0, 1.0); }`;
  const SKY_FS = PREC + `
    varying vec2 vP;
    uniform vec3 uR; uniform vec3 uU; uniform vec3 uF; uniform vec2 uTan; uniform vec3 uSun;
    uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uBot;
    uniform float uDay; uniform float uDusk; uniform float uAngle; uniform float uTime;
    float hash3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    void main(){
      vec3 d = normalize(uF + uR * (vP.x * uTan.x) + uU * (vP.y * uTan.y));
      float h = d.y;
      vec3 col = h >= 0.0 ? mix(uHor, uTop, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(uHor, uBot, clamp(-h * 3.0, 0.0, 1.0));

      // sunrise and sunset: an orange glow low in the sky, strongest on the side the sun is on
      vec2 flatD = normalize(d.xz + 0.0001), flatS = normalize(uSun.xz + 0.0001);
      col += vec3(1.0, 0.5, 0.2) * uDusk * pow(max(dot(flatD, flatS), 0.0), 3.0) * exp(-abs(h) * 4.5) * 0.7;

      // stars: tiny squares that turn slowly across the sky, only once it's dark
      float night = 1.0 - uDay;
      if (night > 0.02 && h > 0.0) {
        float ca = cos(uAngle), sa = sin(uAngle);
        vec3 r = vec3(d.x * ca + d.y * sa, -d.x * sa + d.y * ca, d.z);
        vec3 cell = floor(r * 230.0);
        float s = hash3(cell);
        if (s > 0.9985) col += vec3(0.75 + 0.25 * hash3(cell + 7.0)) * (0.55 + 0.45 * sin(uTime * 2.0 + s * 900.0)) * night * smoothstep(0.0, 0.12, h);
      }

      // the sun is a square, and the moon is a square on the other side of the sky
      if (h > -0.03) {
        vec3 A = normalize(cross(uSun, vec3(0.0, 1.0, 0.0)));
        vec3 B = cross(uSun, A);
        float c = dot(d, uSun);
        if (c > 0.0) {
          vec2 q = vec2(dot(d, A), dot(d, B)) / c;
          col += mix(vec3(1.0, 0.9, 0.6), vec3(1.0, 0.55, 0.25), uDusk) * exp(-length(q) * 5.0) * 0.35 * (0.3 + 0.7 * uDay);
          if (abs(q.x) < 0.075 && abs(q.y) < 0.075) col = mix(vec3(1.0, 0.97, 0.78), vec3(1.0, 0.64, 0.3), uDusk);
        }
        float m = -c;
        if (m > 0.0) {
          vec2 q = vec2(dot(d, A), dot(d, B)) / -m;
          if (abs(q.x) < 0.06 && abs(q.y) < 0.06) {
            vec2 cell = floor((q + 0.06) / 0.03);
            float crater = hash3(vec3(cell, 3.0)) < 0.28 ? 0.72 : 1.0;
            col = mix(col, vec3(0.9, 0.92, 0.98) * crater, night);
          } else col += vec3(0.5, 0.6, 0.9) * exp(-length(q) * 9.0) * 0.12 * night;
        }
      }
      gl_FragColor = vec4(col, 1.0);
    }`;
  const LINE_VS = `attribute vec3 aPos; uniform mat4 uVP; uniform vec3 uOffset; void main(){ gl_Position = uVP * vec4(aPos * 1.004 - 0.002 + uOffset, 1.0); }`;
  const LINE_FS = PREC + `uniform vec4 uColor; void main(){ gl_FragColor = uColor; }`;
  const PART_VS = `
    attribute vec3 aPos; attribute vec3 aColor; attribute float aSize;
    uniform mat4 uVP; uniform float uScale; varying vec3 vColor; varying float vGlow;
    void main(){ gl_Position = uVP * vec4(aPos, 1.0); vColor = aColor; vGlow = aSize < 0.0 ? 1.0 : 0.0; gl_PointSize = max(2.0, abs(aSize) * uScale / gl_Position.w); }`;
  const PART_FS = PREC + `varying vec3 vColor; varying float vGlow; uniform vec3 uLight; void main(){ gl_FragColor = vec4(vColor * mix(max(uLight, vec3(0.3)), vec3(1.0), vGlow), 1.0); }`;

  /* ---------------- little matrix helpers (16 numbers, column by column) ---------------- */
  function perspective(fovY, aspect, near, far){
    const f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  }
  function mul(a, b){
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
    return o;
  }
  const translate = (x, y, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
  const scaling = s => new Float32Array([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1]);
  const rotX = a => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); };
  const rotY = a => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); };

  /* ---------------- the six faces of a block ---------------- */
  // n: which way it faces. u and v: the two directions along it. l: how bright it is (top lit, bottom dark, sides in between)
  const FACES = [
    { n: [1, 0, 0],  u: [0, 0, 1], v: [0, 1, 0], l: 0.6, kind: 0 },
    { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], l: 0.6, kind: 0 },
    { n: [0, 1, 0],  u: [1, 0, 0], v: [0, 0, 1], l: 1.0, kind: 1 },
    { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], l: 0.5, kind: 2 },
    { n: [0, 0, 1],  u: [1, 0, 0], v: [0, 1, 0], l: 0.8, kind: 0 },
    { n: [0, 0, -1], u: [1, 0, 0], v: [0, 1, 0], l: 0.8, kind: 0 }
  ];
  const AW = TILE_COLS * 16, AH = TILE_ROWS * 16;
  // a point inside a texture tile (a hair in from the edge, so a neighbouring tile never bleeds in)
  const tu = (tile, s) => ((tile % TILE_COLS) * 16 + 0.03 + s * 15.94) / AW;
  const tv = (tile, s) => (Math.floor(tile / TILE_COLS) * 16 + 0.03 + s * 15.94) / AH;

  const idAt = (x, y, z) => (x < 0 || x >= WW || z < 0 || z >= WD) ? 0 : y < 0 ? ID.STONE : y >= WH ? 0 : world[at(x, y, z)];
  const opaqueAt = (x, y, z) => (x < 0 || x >= WW || z < 0 || z >= WD || y < 0 || y >= WH) ? 0 : IS_OPAQUE[world[at(x, y, z)]];

  function pushQuad(out, v, flip){
    const order = flip ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3];
    for (const i of order) out.push(v[i][0], v[i][1], v[i][2], v[i][3], v[i][4], v[i][5], v[i][6] || 0);
  }

  // one face of a solid block, with a soft shadow at each corner
  function addFace(out, x, y, z, F, tile, emits){
    const v = [];
    const ao = [];
    const corners = [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (let c = 0; c < 4; c++) {
      const su = corners[c][0], sv = corners[c][1];
      const du = su ? 1 : -1, dv = sv ? 1 : -1;
      const bx = x + F.n[0], by = y + F.n[1], bz = z + F.n[2];
      const s1 = opaqueAt(bx + du * F.u[0], by + du * F.u[1], bz + du * F.u[2]);
      const s2 = opaqueAt(bx + dv * F.v[0], by + dv * F.v[1], bz + dv * F.v[2]);
      const cr = opaqueAt(bx + du * F.u[0] + dv * F.v[0], by + du * F.u[1] + dv * F.v[1], bz + du * F.u[2] + dv * F.v[2]);
      const a = (s1 && s2) ? 0 : 3 - (s1 + s2 + cr);
      ao.push(a);
      // light from glowing blocks: the average of the four spots touching this corner (a solid one counts as the one in front)
      const l0 = lightAt(bx, by, bz);
      const g = (px, py, pz) => opaqueAt(px, py, pz) ? l0 : lightAt(px, py, pz);
      const light = (l0 + g(bx + du * F.u[0], by + du * F.u[1], bz + du * F.u[2]) + g(bx + dv * F.v[0], by + dv * F.v[1], bz + dv * F.v[2])
        + ((s1 && s2) ? l0 : g(bx + du * F.u[0] + dv * F.v[0], by + du * F.u[1] + dv * F.v[1], bz + du * F.u[2] + dv * F.v[2]))) / 60;
      const px = x + (F.n[0] > 0 ? 1 : 0) + su * F.u[0] + sv * F.v[0];
      const py = y + (F.n[1] > 0 ? 1 : 0) + su * F.u[1] + sv * F.v[1];
      const pz = z + (F.n[2] > 0 ? 1 : 0) + su * F.u[2] + sv * F.v[2];
      const top = F.kind !== 0; // on top and bottom faces the texture runs along v; on the sides it stands upright
      v.push([px, py, pz, tu(tile, su), tv(tile, top ? sv : 1 - sv), emits ? 1 : F.l * AO[a], emits ? 1 : light]);
    }
    pushQuad(out, v, !emits && ao[0] + ao[2] <= ao[1] + ao[3]);
  }

  // a flower or tall grass: two crossing flat pictures
  function addCross(out, x, y, z, tile){
    const l = 0.92, bl = lightAt(x, y, z) / 15;
    const q = (a, b) => [
      [a[0], y, a[1], tu(tile, 0), tv(tile, 1), l, bl], [b[0], y, b[1], tu(tile, 1), tv(tile, 1), l, bl],
      [b[0], y + 1, b[1], tu(tile, 1), tv(tile, 0), l, bl], [a[0], y + 1, a[1], tu(tile, 0), tv(tile, 0), l, bl]];
    pushQuad(out, q([x + 0.1, z + 0.1], [x + 0.9, z + 0.9]), false);
    pushQuad(out, q([x + 0.9, z + 0.1], [x + 0.1, z + 0.9]), false);
  }

  // water: a surface a bit below the top of the block, and walls where it meets the air
  function addWater(out, x, y, z){
    const above = idAt(x, y + 1, z), tile = T.WATER, bl = lightAt(x, y, z) / 15;
    const topY = above === ID.WATER ? y + 1 : y + WATER_TOP;
    if (above !== ID.WATER && !IS_OPAQUE[above]) {
      pushQuad(out, [[x, topY, z, tu(tile, 0), tv(tile, 0), 1, bl], [x + 1, topY, z, tu(tile, 1), tv(tile, 0), 1, bl], [x + 1, topY, z + 1, tu(tile, 1), tv(tile, 1), 1, bl], [x, topY, z + 1, tu(tile, 0), tv(tile, 1), 1, bl]], false);
    }
    for (const F of FACES) {
      if (F.kind !== 0) continue;
      const nx = x + F.n[0], nz = z + F.n[2];
      if (nx < 0 || nx >= WW || nz < 0 || nz >= WD) continue;
      const nid = idAt(nx, y, nz);
      if (nid === ID.WATER || IS_OPAQUE[nid]) continue;
      const v = [];
      for (const [su, sv] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        const px = x + (F.n[0] > 0 ? 1 : 0) + su * F.u[0], pz = z + (F.n[2] > 0 ? 1 : 0) + su * F.u[2];
        v.push([px, y + sv * (topY - y), pz, tu(tile, su), tv(tile, 1 - sv), F.l, bl]);
      }
      pushQuad(out, v, false);
    }
  }

  // a torch: a post 2 pixels wide and 10 tall with a flame on top. One hanging on a wall leans out from it.
  function addTorch(out, x, y, z, id){
    const wall = TORCH_DIR[id], w = 1 / 16, H = 10 / 16, tile = T.TORCH;
    const col = (tile % TILE_COLS) * 16, row = Math.floor(tile / TILE_COLS) * 16;
    const U = px => (col + px) / AW, V = py => (row + py) / AH;
    // a point on the torch, h up from its foot, offset from its middle line
    const pt = (h, ox, oz) => {
      let cx = 0.5, cz = 0.5, cy = h;
      if (wall) { const k = 0.38 - 0.414 * h; cx += wall[0] * k; cz += wall[1] * k; cy = h + 0.22; }
      return [x + cx + ox, y + cy, z + cz + oz];
    };
    const c = [[-w, -w], [w, -w], [w, w], [-w, w]];
    for (let i = 0; i < 4; i++) {
      const a = c[i], b = c[(i + 1) % 4];
      const v0 = pt(0, a[0], a[1]), v1 = pt(0, b[0], b[1]), v2 = pt(H, b[0], b[1]), v3 = pt(H, a[0], a[1]);
      pushQuad(out, [[...v0, U(7.05), V(15.95), 1, 1], [...v1, U(8.95), V(15.95), 1, 1], [...v2, U(8.95), V(6.05), 1, 1], [...v3, U(7.05), V(6.05), 1, 1]], false);
    }
    const t = [pt(H, c[0][0], c[0][1]), pt(H, c[1][0], c[1][1]), pt(H, c[2][0], c[2][1]), pt(H, c[3][0], c[3][1])];
    pushQuad(out, [[...t[0], U(7.05), V(6.05), 1, 1], [...t[1], U(8.95), V(6.05), 1, 1], [...t[2], U(8.95), V(7.95), 1, 1], [...t[3], U(7.05), V(7.95), 1, 1]], false);
  }

  function createGL(canvas){
    let gl = null;
    try { gl = canvas.getContext("webgl", { antialias: true, alpha: false, powerPreference: "high-performance" }); } catch (e) {}
    if (!gl) return null;

    function program(vs, fs, attribs){
      const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const p = gl.createProgram();
      gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
      attribs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
      return { p, u };
    }
    let main, sky, line, part;
    try {
      main = program(MAIN_VS, MAIN_FS, ["aPos", "aUV", "aLight", "aBlock"]);
      sky = program(SKY_VS, SKY_FS, ["aP"]);
      line = program(LINE_VS, LINE_FS, ["aPos"]);
      part = program(PART_VS, PART_FS, ["aPos", "aColor", "aSize"]);
    } catch (e) { return null; }

    // the textures
    const atlas = atlasData();
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, atlas.w, atlas.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, atlas.data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);   // crisp square pixels, like the real game
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    function upload(buf, arr){
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
    }
    function attribs(n){ for (let i = 0; i < 4; i++) { if (i < n) gl.enableVertexAttribArray(i); else gl.disableVertexAttribArray(i); } }
    function bindMesh(buf){
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 28, 12);
      gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 28, 20);
      gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 28, 24);
    }

    /* ----- the world, one mesh per chunk ----- */
    const chunks = [];
    function buildChunk(cx, cz){
      const solid = [], water = [];
      const x0 = cx * CH, z0 = cz * CH;
      for (let y = 0; y < WH; y++) for (let z = z0; z < z0 + CH; z++) for (let x = x0; x < x0 + CH; x++) {
        const id = world[at(x, y, z)];
        if (!id) continue;
        const kind = KIND[id];
        if (kind === K.PLANT) { addCross(solid, x, y, z, FACE[id * 3]); continue; }
        if (kind === K.TORCH) { addTorch(solid, x, y, z, id); continue; }
        if (kind === K.WATER) { addWater(water, x, y, z); continue; }
        for (const F of FACES) {
          const nid = idAt(x + F.n[0], y + F.n[1], z + F.n[2]);
          if (IS_OPAQUE[nid] || (nid === id && id === ID.GLASS)) continue;
          addFace(solid, x, y, z, F, FACE[id * 3 + F.kind], EMIT[id] > 0);
        }
      }
      const c = chunks[cz * NCX + cx] || (chunks[cz * NCX + cx] = { sBuf: gl.createBuffer(), wBuf: gl.createBuffer(), sN: 0, wN: 0 });
      upload(c.sBuf, solid); c.sN = solid.length / 7;
      upload(c.wBuf, water); c.wN = water.length / 7;
    }
    const emitters = new Set();   // where the glowing blocks are
    const NEXT = new Uint8Array(LIGHT.length);
    function spreadLight(into){
      into.fill(0);
      const q = [];
      emitters.forEach(i => { into[i] = EMIT[world[i]]; q.push(i); });
      for (let h = 0; h < q.length; h++) {
        const i = q[h], l = into[i] - 1;
        if (l < 1) continue;
        const x = i % WW, z = Math.floor(i / WW) % WD, y = Math.floor(i / (WW * WD));
        for (let d = 0; d < 6; d++) {
          const nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0), ny = y + (d === 2 ? 1 : d === 3 ? -1 : 0), nz = z + (d === 4 ? 1 : d === 5 ? -1 : 0);
          if (nx < 0 || nx >= WW || ny < 0 || ny >= WH || nz < 0 || nz >= WD) continue;
          const j = at(nx, ny, nz);
          if (IS_OPAQUE[world[j]] || into[j] >= l) continue;
          into[j] = l; q.push(j);
        }
      }
    }
    function rebuildAll(){
      emitters.clear();
      for (let i = 0; i < world.length; i++) if (EMIT[world[i]]) emitters.add(i);
      spreadLight(LIGHT);
      for (let cz = 0; cz < NCZ; cz++) for (let cx = 0; cx < NCX; cx++) buildChunk(cx, cz);
    }
    // a block changed: rebuild its chunk and the ones next to it whose corner shadows could change, and if the
    // light from a glowing block was changed by it, every chunk where the light changed
    function updateBlock(x, y, z){
      const dirty = new Set();
      const mark = (bx, bz) => {
        for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1]) {
          const cx = Math.floor((bx + dx) / CH), cz = Math.floor((bz + dz) / CH);
          if (cx >= 0 && cx < NCX && cz >= 0 && cz < NCZ) dirty.add(cz * NCX + cx);
        }
      };
      mark(x, z);
      const i = at(x, y, z), wasEmitter = emitters.has(i), isEmitter = EMIT[world[i]] > 0;
      if (isEmitter) emitters.add(i); else emitters.delete(i);
      let relight = wasEmitter || isEmitter;
      if (!relight) for (const e of emitters) {
        const ex = e % WW, ez = Math.floor(e / WW) % WD, ey = Math.floor(e / (WW * WD));
        if (Math.abs(ex - x) <= 16 && Math.abs(ey - y) <= 16 && Math.abs(ez - z) <= 16) { relight = true; break; }
      }
      if (relight) {
        spreadLight(NEXT);
        for (let k = 0; k < LIGHT.length; k++) if (LIGHT[k] !== NEXT[k]) mark(k % WW, Math.floor(k / WW) % WD);
        LIGHT.set(NEXT);
      }
      dirty.forEach(id => buildChunk(id % NCX, Math.floor(id / NCX)));
    }

    /* ----- the clouds (flat-bottomed boxes that drift) and the ocean beyond the edge of the world ----- */
    const cloudBuf = gl.createBuffer(), oceanBuf = gl.createBuffer();
    let cloudN = 0, oceanN = 0;
    (function(){
      const out = [], t = T.WHITE, uu = tu(t, 0.5), vv = tv(t, 0.5);
      for (let iz = 0; iz < CLOUD_N; iz++) for (let ix = 0; ix < CLOUD_N; ix++) {
        if (BW.hash2((ix >> 1) % 10, (iz >> 1) % 10, 5) >= 0.42 || BW.hash2(ix, iz, 9) >= 0.85) continue;
        const o = [ix * CLOUD_CELL, CLOUD_Y, iz * CLOUD_CELL], S = [CLOUD_CELL, 3, CLOUD_CELL];
        for (const F of FACES) {
          const light = F.kind === 1 ? 1 : F.kind === 2 ? 0.72 : F.l + 0.1;
          const v = [];
          for (const [su, sv] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
            const p = [0, 1, 2].map(a => o[a] + (F.n[a] > 0 ? S[a] : 0) + su * F.u[a] * S[a] + sv * F.v[a] * S[a]);
            v.push([p[0], p[1], p[2], uu, vv, light]);
          }
          pushQuad(out, v, false);
        }
      }
      upload(cloudBuf, out); cloudN = out.length / 7;
      // four flat slabs round the world, so the sea carries on to the horizon
      const o = [], e = 400, y = SEA + WATER_TOP - 0.02, ot = T.OCEAN, ou = tu(ot, 0.5), ov = tv(ot, 0.5);
      const slab = (x0, z0, x1, z1) => pushQuad(o, [[x0, y, z0, ou, ov, 0.96], [x1, y, z0, ou, ov, 0.96], [x1, y, z1, ou, ov, 0.96], [x0, y, z1, ou, ov, 0.96]], false);
      slab(-e, -e, WW + e, 0); slab(-e, WD, WW + e, WD + e); slab(-e, 0, 0, WD); slab(WW, 0, WW + e, WD);
      upload(oceanBuf, o); oceanN = o.length / 7;
    })();

    /* ----- the block in your hand ----- */
    const heldBuf = gl.createBuffer();
    let heldN = 0, heldId = 0, heldScale = 0.3;
    function setSelected(id){
      if (id === heldId) return;
      heldId = id;
      const out = [];
      if (KIND[id] === K.TORCH) {
        addTorch(out, 0, 0, 0, BW.ID.TORCH);
        for (let i = 0; i < out.length; i += 7) { out[i] -= 0.5; out[i + 1] -= 0.3; out[i + 2] -= 0.5; }
        heldScale = 0.62;
        upload(heldBuf, out); heldN = out.length / 7;
        return;
      }
      heldScale = 0.3;
      FACES.forEach(F => {
        const tile = FACE[id * 3 + F.kind];
        const light = F.kind === 1 ? 1 : F.kind === 2 ? 0.5 : (F.n[0] !== 0 ? 0.62 : 0.82);
        const v = [];
        for (const [su, sv] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
          const p = [0, 1, 2].map(a => -0.5 + (F.n[a] > 0 ? 1 : 0) + su * F.u[a] + sv * F.v[a]);
          v.push([p[0], p[1], p[2], tu(tile, su), tv(tile, F.kind !== 0 ? sv : 1 - sv), light]);
        }
        pushQuad(out, v, false);
      });
      upload(heldBuf, out); heldN = out.length / 7;
    }

    /* ----- the outline round the block you're pointing at, and the flying bits ----- */
    const lineBuf = gl.createBuffer();
    (function(){
      const c = [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1], [0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]];
      const e = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
      const out = [];
      e.forEach(([a, b]) => out.push(...c[a], ...c[b]));
      gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(out), gl.STATIC_DRAW);
    })();
    const partBuf = gl.createBuffer();
    const skyBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);

    rebuildAll();
    setSelected(1);

    /* ----- one picture ----- */
    function draw(v){
      const w = canvas.width, h = canvas.height;
      gl.viewport(0, 0, w, h);
      const [ex, ey, ez] = v.eye;
      const cy = Math.cos(v.yaw), sy = Math.sin(v.yaw), cp = Math.cos(v.pitch), sp = Math.sin(v.pitch);
      const f = [cp * sy, sp, cp * cy], r = [cy, 0, -sy], u = [-sp * sy, cp, -sp * cy];
      const aspect = w / h, tY = Math.tan(FOV / 2);
      const proj = perspective(FOV, aspect, 0.05, 600);
      // world to camera: a row each for right, up and backwards (the world is mirrored the way the game thinks of it)
      const view = new Float32Array([
        r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0,
        -(r[0] * ex + r[1] * ey + r[2] * ez), -(u[0] * ex + u[1] * ey + u[2] * ez), f[0] * ex + f[1] * ey + f[2] * ez, 1]);
      const vp = mul(proj, view);
      const sk = v.sky, dayK = 0.12 + 0.88 * sk.day;
      const fog = v.underwater ? [0.1 * dayK, 0.26 * dayK, 0.62 * dayK] : sk.hor, fogStart = v.underwater ? 0 : 38, fogEnd = v.underwater ? 16 : 100;

      gl.clearColor(fog[0], fog[1], fog[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // the sky
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
      gl.useProgram(sky.p);
      attribs(1);
      gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.uniform3fv(sky.u.uR, r); gl.uniform3fv(sky.u.uU, u); gl.uniform3fv(sky.u.uF, f);
      gl.uniform2f(sky.u.uTan, tY * aspect, tY); gl.uniform3fv(sky.u.uSun, sk.sun);
      gl.uniform3fv(sky.u.uTop, v.underwater ? fog : sk.top);
      gl.uniform3fv(sky.u.uHor, v.underwater ? fog : sk.hor);
      gl.uniform3fv(sky.u.uBot, v.underwater ? fog : sk.bot);
      gl.uniform1f(sky.u.uDay, sk.day); gl.uniform1f(sky.u.uDusk, sk.dusk); gl.uniform1f(sky.u.uAngle, sk.a); gl.uniform1f(sky.u.uTime, v.time);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.enable(gl.DEPTH_TEST);

      // the world
      gl.useProgram(main.p);
      attribs(4);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(main.u.uTex, 0);
      gl.uniformMatrix4fv(main.u.uVP, false, vp);
      gl.uniform3f(main.u.uEye, ex, ey, ez);
      gl.uniform3fv(main.u.uFog, fog); gl.uniform1f(main.u.uFogStart, fogStart); gl.uniform1f(main.u.uFogEnd, fogEnd);
      gl.uniform3f(main.u.uOffset, 0, 0, 0);
      gl.uniform3fv(main.u.uLight, sk.light);
      gl.uniform1f(main.u.uAlpha, 1); gl.uniform1f(main.u.uWave, 0); gl.uniform1f(main.u.uTime, v.time);
      chunks.forEach(c => { if (c.sN) { bindMesh(c.sBuf); gl.drawArrays(gl.TRIANGLES, 0, c.sN); } });

      // the outline round the block you point at
      if (v.target) {
        gl.useProgram(line.p);
        attribs(1);
        gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.uniformMatrix4fv(line.u.uVP, false, vp);
        gl.uniform3f(line.u.uOffset, v.target[0], v.target[1], v.target[2]);
        gl.uniform4f(line.u.uColor, 0, 0, 0, 1);
        gl.drawArrays(gl.LINES, 0, 24);
      }

      // bits flying off a block you dug
      if (v.particles.length) {
        const d = new Float32Array(v.particles.length * 7);
        v.particles.forEach((p, i) => d.set([p.x, p.y, p.z, p.r, p.g, p.b, p.size], i * 7));
        gl.useProgram(part.p);
        attribs(3);
        gl.bindBuffer(gl.ARRAY_BUFFER, partBuf);
        gl.bufferData(gl.ARRAY_BUFFER, d, gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 28, 12);
        gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 28, 24);
        gl.uniformMatrix4fv(part.u.uVP, false, vp);
        gl.uniform3fv(part.u.uLight, sk.light);
        gl.uniform1f(part.u.uScale, h / (2 * tY));
        gl.drawArrays(gl.POINTS, 0, v.particles.length);
      }

      // water, ocean and clouds (see-through, so after everything solid)
      gl.useProgram(main.p);
      attribs(4);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      gl.uniform1f(main.u.uAlpha, 0.64); gl.uniform1f(main.u.uWave, 1);
      bindMesh(oceanBuf); gl.drawArrays(gl.TRIANGLES, 0, oceanN);
      chunks.forEach(c => { if (c.wN) { bindMesh(c.wBuf); gl.drawArrays(gl.TRIANGLES, 0, c.wN); } });
      gl.uniform1f(main.u.uAlpha, 0.92); gl.uniform1f(main.u.uWave, 0);
      bindMesh(cloudBuf);
      const drift = (v.time * 1.1) % CLOUD_SPAN;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        gl.uniform3f(main.u.uOffset, WW / 2 - CLOUD_SPAN / 2 + drift + i * CLOUD_SPAN, 0, WD / 2 - CLOUD_SPAN / 2 + j * CLOUD_SPAN);
        gl.drawArrays(gl.TRIANGLES, 0, cloudN);
      }
      gl.depthMask(true); gl.disable(gl.BLEND);
      gl.uniform3f(main.u.uOffset, 0, 0, 0);

      // the block in your hand, drawn last and on top of everything
      if (v.held && heldN) {
        gl.clear(gl.DEPTH_BUFFER_BIT);
        const s = v.swing > 0 ? Math.sin(v.swing * Math.PI) : 0;
        const bob = Math.sin(v.time * 1.7) * 0.006;
        let m = translate(0.56, -0.58 + bob - 0.2 * s, -1.0 - 0.26 * s);
        m = mul(m, rotY(0.55)); m = mul(m, rotX(-0.1 - 0.95 * s)); m = mul(m, scaling(heldScale));
        gl.uniformMatrix4fv(main.u.uVP, false, mul(proj, m));
        gl.uniform1f(main.u.uAlpha, 1); gl.uniform1f(main.u.uWave, 0);   // solid again, with holes where there should be holes
        gl.uniform3f(main.u.uLight, Math.max(sk.light[0], 0.45), Math.max(sk.light[1], 0.45), Math.max(sk.light[2], 0.5));
        gl.uniform1f(main.u.uFogStart, 1e6); gl.uniform1f(main.u.uFogEnd, 2e6);
        bindMesh(heldBuf);
        gl.drawArrays(gl.TRIANGLES, 0, heldN);
      }
    }

    return { draw, updateBlock, rebuildAll, setSelected, gl };
  }

  BW.createGL = createGL;
})();
