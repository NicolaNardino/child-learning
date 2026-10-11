/* Block World's backup picture, for a device without WebGL: a ray is shot through every pixel and steps from
   block to block until it hits one. It draws small and blocky, and speeds up or slows down by itself.
   (It skips water and flowers, and ignores the see-through bits, so it looks plainer than the WebGL one.) */
(function(){
  "use strict";
  const BW = window.BlockWorld;
  const { WW, WH, WD, world, TEX, FACE, IS_SOLID } = BW;
  const FOV = 70 * Math.PI / 180, MAXD = 44, EYE_FOG = [196, 224, 250];
  const SUN = (() => { const l = [0.5, 0.75, 0.4], n = Math.hypot(...l); return l.map(v => v / n); })();

  function createSoft(canvas){
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    canvas.classList.add("soft");
    let RW = 0, RH = 0, img = null, buf = null, frameMs = 8, frame = 0;
    function setRes(w){
      RW = w; RH = Math.round(w * 9 / 16);
      canvas.width = RW; canvas.height = RH;
      img = ctx.createImageData(RW, RH);
      buf = new Uint32Array(img.data.buffer);
    }
    setRes(256);

    function draw(v){
      const t0 = performance.now();
      const w = RW, h = RH, yaw = v.yaw, pitch = v.pitch;
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const fx = cp * sy, fy = sp, fz = cp * cy;      // forward
      const rx = cy, rz = -sy;                        // right
      const ux = -sp * sy, uy = cp, uz = -sp * cy;    // up
      const tY = Math.tan(FOV / 2), tX = tY * w / h;
      const [ox, oy, oz] = v.eye;
      const sx0 = Math.floor(ox), sy0 = Math.floor(oy), sz0 = Math.floor(oz);
      const maxd2 = MAXD * MAXD;
      const tgt = v.target ? (v.target[1] * WD + v.target[2]) * WW + v.target[0] : -1;
      for (let j = 0; j < h; j++) {
        const ny = (1 - (j + 0.5) / h * 2) * tY;
        for (let i = 0; i < w; i++) {
          const nx = ((i + 0.5) / w * 2 - 1) * tX;
          let dx = fx + rx * nx + ux * ny, dy = fy + uy * ny, dz = fz + rz * nx + uz * ny;
          const inv = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);
          dx *= inv; dy *= inv; dz *= inv;

          // step from block to block along the ray until one is solid
          let x = sx0, y = sy0, z = sz0;
          const stx = dx > 0 ? 1 : -1, sty = dy > 0 ? 1 : -1, stz = dz > 0 ? 1 : -1;
          const tdx = dx !== 0 ? Math.abs(1 / dx) : 1e30, tdy = dy !== 0 ? Math.abs(1 / dy) : 1e30, tdz = dz !== 0 ? Math.abs(1 / dz) : 1e30;
          let tmx = dx > 0 ? (x + 1 - ox) * tdx : dx < 0 ? (ox - x) * tdx : 1e30;
          let tmy = dy > 0 ? (y + 1 - oy) * tdy : dy < 0 ? (oy - y) * tdy : 1e30;
          let tmz = dz > 0 ? (z + 1 - oz) * tdz : dz < 0 ? (oz - z) * tdz : 1e30;
          let t = 0, face = 0, hit = 0;
          for (let n = 0; n < 160; n++) {
            if (tmx < tmy) {
              if (tmx < tmz) { t = tmx; tmx += tdx; x += stx; face = 0; } else { t = tmz; tmz += tdz; z += stz; face = 2; }
            } else if (tmy < tmz) { t = tmy; tmy += tdy; y += sty; face = 1; } else { t = tmz; tmz += tdz; z += stz; face = 2; }
            if (t > MAXD) break;
            if (x < 0 || x >= WW || z < 0 || z >= WD || y < 0) break;
            if (y >= WH) { if (sty > 0) break; continue; }
            const b = world[(y * WD + z) * WW + x];
            if (b && IS_SOLID[b]) { hit = b; break; }
          }

          let r, g, bl;
          if (hit) {
            const px = ox + dx * t, py = oy + dy * t, pz = oz + dz * t;
            let fu, fv, kind, shade;
            if (face === 1) { fu = px - x; fv = pz - z; kind = sty > 0 ? 2 : 1; shade = sty > 0 ? 0.55 : 1; }
            else if (face === 0) { fu = pz - z; fv = 1 - (py - y); kind = 0; shade = 0.7; }
            else { fu = px - x; fv = 1 - (py - y); kind = 0; shade = 0.86; }
            let tx = (fu * 16) | 0, ty = (fv * 16) | 0;
            tx = tx < 0 ? 0 : tx > 15 ? 15 : tx; ty = ty < 0 ? 0 : ty > 15 ? 15 : ty;
            const c = TEX[FACE[hit * 3 + kind]][ty * 16 + tx];
            r = c & 255; g = (c >> 8) & 255; bl = (c >> 16) & 255;
            // the block you're pointing at gets a bright face and dark edges
            if ((y * WD + z) * WW + x === tgt) shade *= (fu < 0.04 || fu > 0.96 || fv < 0.04 || fv > 0.96) ? 0.45 : 1.22;
            const ff = Math.min(1, t * t / maxd2);
            r = r * shade; g = g * shade; bl = bl * shade;
            r += (EYE_FOG[0] - r) * ff; g += (EYE_FOG[1] - g) * ff; bl += (EYE_FOG[2] - bl) * ff;
            if (r > 255) r = 255; if (g > 255) g = 255; if (bl > 255) bl = 255;
          } else {
            const k = dy * 1.4 + 0.3, kk = k < 0 ? 0 : k > 1 ? 1 : k;
            r = EYE_FOG[0] + (84 - EYE_FOG[0]) * kk; g = EYE_FOG[1] + (140 - EYE_FOG[1]) * kk; bl = EYE_FOG[2] + (232 - EYE_FOG[2]) * kk;
            const sd = dx * SUN[0] + dy * SUN[1] + dz * SUN[2];
            if (sd > 0.9992) { r = 255; g = 250; bl = 215; }
            else if (sd > 0.985) { const a = (sd - 0.985) / 0.0142 * 0.55; r += (255 - r) * a; g += (250 - g) * a; bl += (210 - bl) * a; }
          }
          buf[j * w + i] = 0xff000000 | ((bl | 0) << 16) | ((g | 0) << 8) | (r | 0);
        }
      }
      ctx.putImageData(img, 0, 0);
      frameMs = frameMs * 0.9 + (performance.now() - t0) * 0.1;
      if (++frame % 45 === 0) { // too slow: use fewer pixels. Plenty of time to spare: use more.
        if (frameMs > 22 && RW > 192) setRes(Math.round(RW * 0.85 / 16) * 16);
        else if (frameMs < 8 && RW < 384) setRes(Math.round(RW * 1.15 / 16) * 16);
      }
    }
    return { draw, updateBlock(){}, rebuildAll(){}, setSelected(){} };
  }

  BW.createSoft = createSoft;
})();
