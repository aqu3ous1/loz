/* =============================================================
   core/texture.js -- every texture in the game is generated at boot.

   Real N64 carts had 4KB of texture memory, so 32x32 and 64x64 RGBA
   tiles were the norm and artists leaned on strong value contrast plus
   dithered noise instead of detail. All generators here follow that
   budget: nothing larger than 64x64, palettes kept short, results
   posterised to 5 bits per channel to match RGBA5551 output.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var M = LZ.M;

  function Tile(w, h) {
    this.w = w; this.h = h;
    this.data = new Uint8Array(w * h * 4);
    this.width = w; this.height = h; /* alias for the texture uploader */
  }
  Tile.prototype.set = function (x, y, r, g, b, a) {
    x = ((x % this.w) + this.w) % this.w;
    y = ((y % this.h) + this.h) % this.h;
    var i = (y * this.w + x) * 4;
    this.data[i] = r < 0 ? 0 : (r > 255 ? 255 : r | 0);
    this.data[i + 1] = g < 0 ? 0 : (g > 255 ? 255 : g | 0);
    this.data[i + 2] = b < 0 ? 0 : (b > 255 ? 255 : b | 0);
    this.data[i + 3] = a === undefined ? 255 : (a < 0 ? 0 : (a > 255 ? 255 : a | 0));
  };
  Tile.prototype.get = function (x, y, out) {
    x = ((x % this.w) + this.w) % this.w;
    y = ((y % this.h) + this.h) % this.h;
    var i = (y * this.w + x) * 4;
    out = out || [];
    out[0] = this.data[i]; out[1] = this.data[i + 1]; out[2] = this.data[i + 2]; out[3] = this.data[i + 3];
    return out;
  };
  Tile.prototype.fill = function (c) {
    for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) this.set(x, y, c[0], c[1], c[2], c[3]);
    return this;
  };
  /* posterise to 5 bits, matching the RDP's 16-bit framebuffer */
  Tile.prototype.posterize = function (levels) {
    levels = levels || 32;
    var s = 255 / (levels - 1);
    for (var i = 0; i < this.data.length; i += 4) {
      this.data[i] = Math.round(Math.round(this.data[i] / s) * s);
      this.data[i + 1] = Math.round(Math.round(this.data[i + 1] / s) * s);
      this.data[i + 2] = Math.round(Math.round(this.data[i + 2] / s) * s);
    }
    return this;
  };
  Tile.prototype.each = function (fn) {
    for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) fn(x, y, this);
    return this;
  };

  /* ---------- small colour helpers ---------- */
  function mixc(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t,
            (a[3] === undefined ? 255 : a[3]) + ((b[3] === undefined ? 255 : b[3]) - (a[3] === undefined ? 255 : a[3])) * t];
  }
  function shade(c, f) { return [c[0] * f, c[1] * f, c[2] * f, c[3] === undefined ? 255 : c[3]]; }
  function hex(h) { return [(h >> 16) & 255, (h >> 8) & 255, h & 255, 255]; }

  /* seamless value noise on a torus so tiles repeat cleanly */
  function tnoise(x, y, w, h, freq, seed) {
    var fx = x / w * freq, fy = y / h * freq;
    var ang1 = fx * M.TAU, ang2 = fy * M.TAU;
    return M.valueNoise2(
      Math.cos(ang1) * freq * 0.32 + freq * 3,
      Math.cos(ang2) * freq * 0.32 + Math.sin(ang1) * freq * 0.32 + freq * 5, seed) * 0.5 +
      M.valueNoise2(
        Math.sin(ang1) * freq * 0.32 + freq * 7,
        Math.sin(ang2) * freq * 0.32 + Math.cos(ang2) * freq * 0.32 + freq * 11, seed + 99) * 0.5;
  }
  /* cheaper: wrapped fbm using modular sampling */
  function wnoise(x, y, w, h, cells, seed) {
    var gx = x / w * cells, gy = y / h * cells;
    var xi = Math.floor(gx), yi = Math.floor(gy);
    var xf = gx - xi, yf = gy - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    function hh(a, b) {
      a = ((a % cells) + cells) % cells; b = ((b % cells) + cells) % cells;
      return M.hash2(a, b, seed);
    }
    var a = hh(xi, yi), b = hh(xi + 1, yi), c = hh(xi, yi + 1), d = hh(xi + 1, yi + 1);
    return M.lerp(M.lerp(a, b, u), M.lerp(c, d, u), v);
  }
  function wfbm(x, y, w, h, cells, oct, seed) {
    var sum = 0, amp = 1, norm = 0, c = cells;
    for (var i = 0; i < oct; i++) {
      sum += wnoise(x, y, w, h, c, seed + i * 313) * amp;
      norm += amp; amp *= 0.5; c *= 2;
    }
    return sum / norm;
  }

  /* ------------------------------------------------------------------ */
  /* Palette ramps                                                       */
  /*                                                                     */
  /* The single biggest difference between a procedural texture and a
     cartridge texture is that the cartridge one has about six colours in
     it. Artists painted a short ramp by hand and filled shapes with flat
     bands of it; nothing was a continuous gradient, because 4bpp indexed
     tiles could not hold one. A noise field mapped smoothly onto a base
     colour reads as mush at 320x240 no matter how good the noise is.
     Every texture below therefore builds a ramp and picks a band.        */
  /* ------------------------------------------------------------------ */

  /* n evenly spaced steps around a base colour. Shadows drift cool and
     gain saturation, highlights drift warm and lose it -- the same trick a
     pixel artist uses to stop a ramp looking like a greyscale multiply. */
  function ramp(baseHex, n, o) {
    o = o || {};
    var base = typeof baseHex === 'number' ? hex(baseHex) : baseHex.slice();
    var dark = o.dark === undefined ? 0.46 : o.dark;
    var lite = o.lite === undefined ? 1.30 : o.lite;
    var cool = o.cool === undefined ? 0.16 : o.cool;
    var warm = o.warm === undefined ? 0.14 : o.warm;
    n = n || 5;
    var out = [];
    var mid = (n - 1) / 2;
    for (var i = 0; i < n; i++) {
      var t = mid === 0 ? 0 : (i - mid) / mid;         /* -1 .. +1 */
      var f = t < 0 ? dark + (1 - dark) * (1 + t) : 1 + (lite - 1) * t;
      var c = [base[0] * f, base[1] * f, base[2] * f, 255];
      if (t < 0) {
        var k = -t * cool;
        c[2] += (235 - c[2]) * k * 0.9;
        c[0] -= c[0] * k * 0.55;
      } else {
        var k2 = t * warm;
        c[0] += (255 - c[0]) * k2;
        c[1] += (250 - c[1]) * k2 * 0.72;
      }
      out.push([
        c[0] < 0 ? 0 : (c[0] > 255 ? 255 : c[0]),
        c[1] < 0 ? 0 : (c[1] > 255 ? 255 : c[1]),
        c[2] < 0 ? 0 : (c[2] > 255 ? 255 : c[2]), 255]);
    }
    return out;
  }

  /* snap a 0..1 value to one band of a ramp: the hard edge is the point */
  function pick(r, v) {
    var i = Math.floor((v < 0 ? 0 : (v > 1 ? 1 : v)) * r.length);
    if (i >= r.length) i = r.length - 1;
    if (i < 0) i = 0;
    return r[i];
  }

  /* Median-cut the tile down to n total colours. Authored textures are
     already short; this is the safety net for the ones that still lean on
     noise, and it guarantees no tile in the game exceeds a 4bpp palette. */
  Tile.prototype.indexed = function (n) {
    n = n || 16;
    var px = [], i;
    for (i = 0; i < this.data.length; i += 4) {
      if (this.data[i + 3] < 8) continue;
      px.push([this.data[i], this.data[i + 1], this.data[i + 2]]);
    }
    if (!px.length) return this;
    var boxes = [px];
    while (boxes.length < n) {
      /* split the box with the widest channel spread */
      var bi = -1, bspread = -1, bch = 0;
      for (i = 0; i < boxes.length; i++) {
        if (boxes[i].length < 2) continue;
        for (var ch = 0; ch < 3; ch++) {
          var lo = 255, hi = 0;
          for (var k = 0; k < boxes[i].length; k++) {
            var v = boxes[i][k][ch];
            if (v < lo) lo = v;
            if (v > hi) hi = v;
          }
          if (hi - lo > bspread) { bspread = hi - lo; bi = i; bch = ch; }
        }
      }
      if (bi < 0 || bspread <= 0) break;
      var box = boxes[bi];
      box.sort(function (a, b) { return a[bch] - b[bch]; });
      var mid = box.length >> 1;
      boxes.splice(bi, 1, box.slice(0, mid), box.slice(mid));
    }
    var pal = [];
    for (i = 0; i < boxes.length; i++) {
      var r0 = 0, g0 = 0, b0 = 0, m = boxes[i].length;
      if (!m) continue;
      for (var j = 0; j < m; j++) { r0 += boxes[i][j][0]; g0 += boxes[i][j][1]; b0 += boxes[i][j][2]; }
      pal.push([r0 / m, g0 / m, b0 / m]);
    }
    for (i = 0; i < this.data.length; i += 4) {
      if (this.data[i + 3] < 8) continue;
      var best = 0, bd = 1e9;
      for (var q = 0; q < pal.length; q++) {
        var dr = this.data[i] - pal[q][0], dg = this.data[i + 1] - pal[q][1], db = this.data[i + 2] - pal[q][2];
        var d = dr * dr + dg * dg + db * db;
        if (d < bd) { bd = d; best = q; }
      }
      this.data[i] = pal[best][0] | 0;
      this.data[i + 1] = pal[best][1] | 0;
      this.data[i + 2] = pal[best][2] | 0;
    }
    return this;
  };

  var T = {};
  T.Tile = Tile;
  T.mixc = mixc; T.shade = shade; T.hex = hex; T.wfbm = wfbm; T.wnoise = wnoise;
  T.ramp = ramp; T.pick = pick;

  /* ================= ground / terrain ================= */
  T.grass = function (base, alt, seed) {
    /* Four bands of green in big soft patches, plus sparse two-pixel blade
       marks. The temptation is to add detail; at 320x240 detail is noise,
       and what actually reads across a whole field is the patch shape. */
    var g = ramp(base || [86, 132, 58], 4, { dark: 0.66, lite: 1.18, cool: 0.20, warm: 0.10 });
    var t = new Tile(32, 32);
    var sd = seed || 1;
    t.each(function (x, y) {
      var patch = wfbm(x, y, 32, 32, 2, 2, sd);
      var fine = wnoise(x, y, 32, 32, 8, sd + 41);
      var v = patch * 0.72 + fine * 0.28;
      var c = pick(g, v * 1.06 - 0.03);
      /* Blade clusters: two-pixel vertical dashes of the light band. An
         earlier version also scattered single dark pixels, which at this
         tiling read as mould spots on the field rather than as grass. */
      var bh = M.hash2(x >> 1, (y + 1) >> 1, sd + 7);
      if (bh > 0.90 && v > 0.30) c = g[3];
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.indexed(8);
  };
  T.dirt = function (seed) {
    var d = ramp(0x8a6a44, 4, { dark: 0.68, lite: 1.16, cool: 0.14, warm: 0.12 });
    var t = new Tile(32, 32);
    var sd = seed || 7;
    t.each(function (x, y) {
      var v = wfbm(x, y, 32, 32, 3, 2, sd);
      var c = pick(d, v);
      /* pebbles: a two-pixel light blob with a dark pixel under it */
      var h = M.hash2(x >> 1, y >> 1, sd + 13);
      if (h > 0.955) c = d[3];
      else if (h > 0.93) c = d[0];
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.indexed(8);
  };
  T.sand = function (seed) {
    /* Desert sand is almost a flat colour with wind ripples drawn on it.
       Banding the ripple is what makes it read as sand rather than fog. */
    var sr = ramp(0xd8bc80, 4, { dark: 0.80, lite: 1.12, cool: 0.10, warm: 0.14 });
    var t = new Tile(32, 32);
    var sd = seed || 3;
    t.each(function (x, y) {
      var warp = wfbm(x, y, 32, 32, 2, 2, sd) * 6;
      var rip = Math.sin((x * 0.42 + y * 0.18 + warp) * 1.15) * 0.5 + 0.5;
      var v = 0.30 + rip * 0.52 + wnoise(x, y, 32, 32, 8, sd + 5) * 0.18;
      var c = pick(sr, v);
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.indexed(6);
  };
  T.rock = function (tintHex, seed) {
    /* Big flat facets with hard dark cracks between them. Each cell gets one
       band of the ramp, so the surface reads as broken stone rather than as
       a grey cloud. */
    var r = ramp(tintHex || 0x8c8880, 5, { dark: 0.58, lite: 1.20, cool: 0.20, warm: 0.08 });
    var t = new Tile(32, 32);
    var f = [0, 0];
    var sd = seed || 13;
    t.each(function (x, y) {
      var gx = x / 32 * 2.6 + 0.3, gy = y / 32 * 2.6 + 0.7;
      M.worley2b(gx, gy, sd, f);
      var joint = f[1] - f[0];
      var id = M.worleyCell(gx, gy, sd);
      var band = Math.floor(id * 4) + 1;                 /* 1..4 */
      var c = r[band > 4 ? 4 : band];
      /* one lighter pixel row along the top of each facet reads as a lit edge */
      if (f[0] < 0.16) c = r[Math.min(4, band + 1)];
      if (joint < 0.055) c = r[0];
      else if (joint < 0.11) c = r[1];
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.indexed(8);
  };
  T.snow = function (seed) {
    /* Almost flat white with faint blue drift shadows and a few sparkles. */
    var r = ramp(0xe4eaf6, 4, { dark: 0.86, lite: 1.05, cool: 0.30, warm: 0.04 });
    var t = new Tile(32, 32);
    var sd = seed || 21;
    t.each(function (x, y) {
      var v = wfbm(x, y, 32, 32, 2, 2, sd);
      var c = pick(r, 0.28 + v * 0.6);
      if (M.hash2(x, y, sd + 3) > 0.985) c = r[3];
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.indexed(5);
  };
  T.lava = function (seed) {
    var t = new Tile(64, 64);
    t.each(function (x, y) {
      var n = wfbm(x, y, 64, 64, 5, 3, seed || 31);
      var crust = M.smoothstep(0.42, 0.62, n);
      var c = mixc([255, 214, 96], [92, 30, 18], crust);
      if (n > 0.72) c = mixc(c, [40, 22, 20, 255], 0.6);
      if (n < 0.30) c = [255, 246, 200, 255];
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.posterize();
  };
  T.water = function (colHex, seed, deep) {
    /* Two flat blues plus a scatter of hard white glints. The era did not
       have a water shader; it had a scrolling tile with sparkles drawn on. */
    var r = ramp(colHex || 0x2f7ab4, 5, { dark: 0.62, lite: 1.24, cool: 0.18, warm: 0.10 });
    var t = new Tile(32, 32);
    var sd = seed || 141;
    var alpha = deep ? 236 : 200;
    t.each(function (x, y) {
      var v = wfbm(x, y, 32, 32, 3, 2, sd);
      var band = v < 0.40 ? 1 : (v < 0.62 ? 2 : 3);
      var c = r[band];
      /* glints: single pixels and two-pixel dashes on the crests */
      var h = M.hash2(x, y, sd + 5);
      if (v > 0.66 && h > 0.955) c = r[4];
      else if (v > 0.72 && h > 0.90) c = r[4];
      t.set(x, y, c[0], c[1], c[2], alpha);
    });
    return t.indexed(6);
  };
  T.cobble = function (tintHex, seed) {
    /* Rounded setts with dark mortar and a lit top edge on each stone. */
    var r = ramp(tintHex || 0x9a978e, 5, { dark: 0.52, lite: 1.16, cool: 0.22, warm: 0.08 });
    var t = new Tile(32, 32);
    var f = [0, 0];
    var sd = seed || 17;
    t.each(function (x, y) {
      var gx = x / 32 * 3.4, gy = y / 32 * 3.4;
      M.worley2b(gx, gy, sd, f);
      var joint = f[1] - f[0];
      var id = M.worleyCell(gx, gy, sd);
      var band = 1 + Math.floor(id * 3);                 /* 1..3 */
      var c = r[band];
      if (f[0] < 0.13) c = r[Math.min(4, band + 1)];     /* crown of the stone */
      if (joint < 0.075) c = r[0];                       /* mortar */
      else if (joint < 0.13) c = r[1];
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.indexed(8);
  };
  T.planks = function (colHex, seed) {
    /* Four boards, each a flat band, with a dark seam and a couple of grain
       strokes. Not a wood-grain gradient: a drawn board. */
    var r = ramp(colHex || 0x9a7040, 5, { dark: 0.56, lite: 1.16, cool: 0.14, warm: 0.14 });
    var t = new Tile(32, 32);
    var sd = seed || 61;
    t.each(function (x, y) {
      var plank = Math.floor(y / 8);
      var h = M.hash2(plank, 0, sd);
      var band = 1 + Math.floor(h * 3);
      var c = r[band];
      var yy = y % 8;
      if (yy === 0) c = r[0];                            /* seam between boards */
      else if (yy === 1) c = r[Math.min(4, band + 1)];   /* lit lip below it */
      else if (yy === 7) c = r[Math.max(0, band - 1)];
      /* two grain strokes per board, drawn as one-pixel dashes */
      var gh = M.hash2(x >> 1, plank * 7 + 3, sd + 5);
      if (yy > 1 && yy < 7 && gh > 0.90) c = r[Math.max(0, band - 1)];
      /* a butt joint somewhere along the run */
      if (((x + plank * 11) % 32) === 0) c = r[0];
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.indexed(8);
  };
  T.bark = function (colHex, seed) {
    /* Vertical ridges as flat bars, not a sine gradient. */
    var r = ramp(colHex || 0x7a5636, 5, { dark: 0.54, lite: 1.14, cool: 0.16, warm: 0.12 });
    var t = new Tile(32, 32);
    var sd = seed || 71;
    t.each(function (x, y) {
      var wob = Math.floor(M.valueNoise2(y * 0.13, 0, sd) * 3);
      var col = ((x + wob) % 32 + 32) % 32;
      var h = M.hash2(col >> 1, 0, sd + 3);
      var band = 1 + Math.floor(h * 3);
      var c = r[band];
      if ((col >> 1) % 3 === 0) c = r[0];
      var n = M.valueNoise2(x * 0.5, y * 0.22, sd + 9);
      if (n > 0.78) c = r[Math.min(4, band + 1)];
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.indexed(8);
  };
  T.thatch = function (seed) {
    /* Overlapping courses of straw: a light row, a mid row, a dark shadow
       line where the next course laps over it. */
    var r = ramp(0xc0a052, 5, { dark: 0.52, lite: 1.14, cool: 0.14, warm: 0.16 });
    var t = new Tile(32, 32);
    var sd = seed || 81;
    t.each(function (x, y) {
      var row = Math.floor(y / 8), yy = y % 8;
      var h = M.hash2((x >> 1) + row * 17, row, sd);
      var band = yy < 2 ? 0 : (yy < 4 ? 2 : (yy < 6 ? 3 : 2));
      if (h > 0.72) band = Math.min(4, band + 1);
      else if (h < 0.20) band = Math.max(0, band - 1);
      var c = r[band];
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.indexed(6);
  };
  T.shingle = function (colHex, seed) {
    /* Scalloped tiles in offset courses: a flat face, a lit top edge and a
       hard shadow under the lap. */
    var r = ramp(colHex || 0xa8483c, 5, { dark: 0.50, lite: 1.18, cool: 0.20, warm: 0.12 });
    var t = new Tile(32, 32);
    var sd = seed || 91;
    t.each(function (x, y) {
      var row = Math.floor(y / 8);
      var off = (row % 2) * 5;
      var yy = y % 8, xx = ((x + off) % 10 + 10) % 10;
      var h = M.hash2(Math.floor((x + off) / 10), row, sd);
      var band = 2 + (h > 0.6 ? 1 : (h < 0.25 ? -1 : 0));
      var c = r[band];
      /* the scallop: round the bottom two rows off at the tile's corners */
      var round = (yy >= 6 && (xx === 0 || xx === 9)) || (yy === 7 && (xx <= 1 || xx >= 8));
      if (yy === 0) c = r[Math.min(4, band + 2)];
      else if (yy >= 6 || round) c = r[0];
      if (xx === 0) c = r[Math.max(0, band - 1)];
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.indexed(8);
  };
  T.brick = function (colHex, mortarHex, seed) {
    var r = ramp(colHex || 0xa85c48, 5, { dark: 0.56, lite: 1.16, cool: 0.16, warm: 0.14 });
    var mort = ramp(mortarHex || 0xb0a894, 3, { dark: 0.72, lite: 1.10 });
    var t = new Tile(32, 32);
    var sd = seed || 101;
    t.each(function (x, y) {
      var row = Math.floor(y / 8);
      var off = (row % 2) * 8;
      var xx = ((x + off) % 16 + 16) % 16, yy = y % 8;
      var c;
      if (yy === 0 || xx === 0) c = mort[0];
      else if (yy === 1 || xx === 1) c = mort[2];
      else {
        var h = M.hash2(Math.floor((x + off) / 16), row, sd);
        var band = 2 + (h > 0.6 ? 1 : (h < 0.3 ? -1 : 0));
        c = r[band];
        if (M.hash2(x, y, sd + 7) > 0.94) c = r[Math.max(0, band - 1)];
      }
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.indexed(8);
  };
  T.stoneblock = function (colHex, seed) {
    /* Dressed masonry: courses of blocks, each a flat band, deep joints. */
    var r = ramp(colHex || 0x8e8c94, 5, { dark: 0.50, lite: 1.16, cool: 0.22, warm: 0.06 });
    var t = new Tile(32, 32);
    var sd = seed || 121;
    t.each(function (x, y) {
      var row = Math.floor(y / 8);
      var off = (row % 2) * 8;
      var xx = ((x + off) % 16 + 16) % 16, yy = y % 8;
      var h = M.hash2(Math.floor((x + off) / 16), row, sd);
      var band = 2 + (h > 0.66 ? 1 : (h < 0.30 ? -1 : 0));
      var c = r[band];
      if (yy === 0 || xx === 0) c = r[0];                /* joint */
      else if (yy === 1 || xx === 1) c = r[Math.min(4, band + 1)];
      else if (yy === 7 || xx === 15) c = r[Math.max(0, band - 1)];
      var n = M.hash2(x, y, sd + 9);
      if (n > 0.965 && yy > 1 && xx > 1) c = r[Math.max(0, band - 1)];
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.indexed(8);
  };
  T.plaster = function (colHex, seed) {
    /* Village walls in this era are nearly flat colour with a faint trowel
       mottle -- two bands, no more. Anything busier fights the roof. */
    var r = ramp(colHex || 0xd8c8a4, 4, { dark: 0.80, lite: 1.08, cool: 0.12, warm: 0.10 });
    var t = new Tile(32, 32);
    var sd = seed || 111;
    t.each(function (x, y) {
      var v = wfbm(x, y, 32, 32, 2, 2, sd);
      var c = pick(r, 0.30 + v * 0.55);
      var h = M.hash2(x >> 1, y >> 1, sd + 4);
      if (h > 0.975) c = r[0];                          /* a chip in the render */
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.indexed(5);
  };
  T.sandstone = function (colHex, seed) {
    /* Wind-cut courses: flat bands with a hard line where each bed ends. */
    var r = ramp(colHex || 0xcaa877, 5, { dark: 0.62, lite: 1.14, cool: 0.14, warm: 0.14 });
    var t = new Tile(32, 32);
    var sd = seed || 171;
    t.each(function (x, y) {
      var wob = Math.floor(M.valueNoise2(x * 0.10, 0, sd) * 3);
      var row = Math.floor((y + wob) / 6);
      var h = M.hash2(row, 0, sd);
      var band = 2 + (h > 0.62 ? 1 : (h < 0.30 ? -1 : 0));
      var c = r[band];
      if (((y + wob) % 6) === 0) c = r[Math.max(0, band - 2)];
      if (M.hash2(x >> 1, y >> 1, sd + 5) > 0.94) c = r[Math.min(4, band + 1)];
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.indexed(6);
  };
  T.tilefloor = function (colHex, jointHex, seed) {
    /* Flagstones: a flat face per tile, a lit top-left edge, a dark joint. */
    var r = ramp(colHex || 0x8e8fa0, 5, { dark: 0.52, lite: 1.16, cool: 0.20, warm: 0.06 });
    var joint = jointHex === undefined ? r[0] : hex(jointHex);
    var t = new Tile(32, 32);
    var sd = seed || 151;
    t.each(function (x, y) {
      var cx = Math.floor(x / 16), cy = Math.floor(y / 16);
      var xx = x % 16, yy = y % 16;
      var h = M.hash2(cx, cy, sd);
      var band = 2 + (h > 0.66 ? 1 : (h < 0.33 ? -1 : 0));
      var c = r[band];
      if (xx === 0 || yy === 0) c = joint;
      else if (xx === 1 || yy === 1) c = r[Math.min(4, band + 1)];
      else if (xx === 15 || yy === 15) c = r[Math.max(0, band - 1)];
      if (M.hash2(x, y, sd + 3) > 0.972 && xx > 1 && yy > 1) c = r[Math.max(0, band - 1)];
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.indexed(8);
  };
  T.carpet = function (colHex, borderHex, seed) {
    /* Woven cloth: a flat field, a lighter warp every other column, and a
       border band. Two tones plus the border is all it needs. */
    var r = ramp(colHex || 0x9a3038, 5, { dark: 0.58, lite: 1.18, cool: 0.16, warm: 0.12 });
    var bord = borderHex === undefined ? r[4] : hex(borderHex);
    var t = new Tile(32, 32);
    var sd = seed || 161;
    t.each(function (x, y) {
      var edge = Math.min(Math.min(x, 31 - x), Math.min(y, 31 - y));
      var c;
      if (edge === 0) c = r[0];
      else if (edge < 3) c = bord;
      else {
        /* a woven check, not a diagonal stripe: warp and weft alternate */
        var band = (((x >> 1) + (y >> 1)) & 1) ? 2 : 3;
        if (M.hash2(x >> 1, y >> 1, sd) > 0.90) band = Math.max(1, band - 1);
        c = r[band];
      }
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.indexed(6);
  };
  T.metal = function (colHex, rust, seed) {
    /* Hammered plate: flat bands with a hard highlight streak, plus rivets. */
    var r = ramp(colHex || 0x9aa2ae, 5,
      rust ? { dark: 0.54, lite: 1.14, cool: 0.08, warm: 0.22 }
           : { dark: 0.46, lite: 1.30, cool: 0.24, warm: 0.06 });
    var t = new Tile(32, 32);
    var sd = seed || 131;
    t.each(function (x, y) {
      var v = wfbm(x, y, 32, 32, rust ? 4 : 2, 2, sd);
      var band = v < 0.42 ? 1 : (v < 0.66 ? 2 : 3);
      var c = r[band];
      /* plate seams, horizontal and vertical, not a diagonal streak */
      if (y % 16 === 0) c = r[0];
      else if (y % 16 === 1) c = r[4];
      /* rivets along the seam */
      var rx = ((x + 4) % 8), ry = ((y + 15) % 16);
      if (ry < 3 && rx === 0) c = r[4];
      else if (ry < 4 && rx === 1) c = r[0];
      if (rust && M.hash2(x >> 1, y >> 1, sd + 7) > 0.80) c = r[Math.max(0, band - 1)];
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.indexed(8);
  };
  T.leaves = function (colHex, seed) {
    /* A foliage cutout, not a noise field. Alpha is a handful of solid
       clumps with hard edges; inside them the colour is three flat bands
       with a lit crown, the way a canopy sheet was drawn in 1998. */
    var r = ramp(colHex || 0x4c8a40, 5, { dark: 0.50, lite: 1.22, cool: 0.22, warm: 0.14 });
    var t = new Tile(32, 32);
    var sd = seed || 171;
    t.each(function (x, y) {
      /* clump field: low-frequency, hard-thresholded */
      var m = wfbm(x, y, 32, 32, 3, 2, sd);
      var edge = wnoise(x, y, 32, 32, 8, sd + 3) * 0.14;
      var v = m + edge;
      if (v < 0.44) { t.set(x, y, 0, 0, 0, 0); return; }
      var band;
      if (v < 0.50) band = 0;            /* the rim of a clump sits in shade */
      else if (v < 0.60) band = 1;
      else if (v < 0.70) band = 2;
      else if (v < 0.80) band = 3;
      else band = 4;
      /* a few flecked leaves catching light inside the mass */
      if (M.hash2(x >> 1, y >> 1, sd + 11) > 0.90 && band >= 2) band = 4;
      var c = r[band];
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.indexed(6);
  };
  T.grassblade = function (colHex, seed) {
    var base = hex(colHex || 0x63a34b);
    var t = new Tile(32, 32);
    t.each(function (x, y) {
      var col = Math.floor(x / 5), within = x % 5;
      var h = M.hash2(col, 0, seed || 181);
      var top = 5 + h * 12;
      var a = 0;
      var c = base;
      if (within >= 1 && within <= 3 && y > top) {
        /* the tip narrows to a single column so blades read as blades */
        a = (y < top + 3 && within !== 2) ? 0 : 255;
      }
      if (a) {
        var up = (y - top) / (32 - top);
        c = shade(base, 0.55 + up * 0.62 + h * 0.22);
        if (within === 1) c = shade(c, 0.86);
        if (within === 3) c = shade(c, 1.10);
      }
      t.set(x, y, c[0], c[1], c[2], a);
    });
    return t.posterize();
  };
  T.flowers = function (petalHex, seed) {
    var petal = hex(petalHex || 0xe8d45a), leaf = hex(0x4e8c46);
    var t = new Tile(32, 32);
    t.each(function (x, y) {
      var a = 0, c = leaf;
      var col = Math.floor(x / 8), row = Math.floor(y / 8);
      var h = M.hash2(col, row, seed || 191);
      var cx = col * 8 + 2 + h * 4, cy = row * 8 + 2 + M.hash2(col, row, (seed || 191) + 5) * 4;
      var d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
      /* stem first, then a four-petal head on top of it */
      if (h > 0.30) {
        if (Math.abs(x - cx) < 0.9 && y > cy) { a = 255; c = shade(leaf, 0.8 + (y - cy) * 0.03); }
        if (d < 1.3) { a = 255; c = shade(petal, 0.95 + h * 0.2); }
        else if (d < 2.4 && (Math.abs(x - cx) < 0.9 || Math.abs(y - cy) < 0.9)) {
          a = 255; c = shade(petal, 0.78 + h * 0.2);
        }
      }
      t.set(x, y, c[0], c[1], c[2], a);
    });
    return t.posterize();
  };
  /* An opaque petal / fleshy-leaf sheet: a soft gradient with a midrib and
     side veins. Used for boss flora, where a cutout flower sprite would just
     alpha away to nothing. */
  T.petal = function (tintHex, seed) {
    var base = hex(tintHex || 0xd0505e);
    var t = new Tile(32, 32);
    t.each(function (x, y) {
      var u = x / 31, v = y / 31;
      /* darker toward the base of the petal, paler toward the tip */
      var k = 0.72 + v * 0.42;
      var n = M.valueNoise2(u * 5.5, v * 5.5, seed || 211);
      k *= 0.92 + n * 0.16;
      /* midrib and a fan of side veins */
      var rib = Math.abs(u - 0.5);
      if (rib < 0.045) k *= 0.74;
      var fan = Math.abs(Math.sin((u - 0.5) * 9.0 + v * 4.5));
      if (fan < 0.13) k *= 0.88;
      /* the edges roll under and catch less light */
      if (u < 0.09 || u > 0.91) k *= 0.80;
      var c = shade(base, k);
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.posterize();
  };
  T.vines = function (seed) {
    var t = new Tile(32, 64);
    var base = hex(0x3d6b34);
    t.each(function (x, y) {
      var wobble = Math.sin(y * 0.28 + M.hash2(Math.floor(x / 8), 0, seed || 201) * 6) * 3;
      var lane = Math.floor(x / 8) * 8 + 4 + wobble;
      var d = Math.abs(x - lane);
      var a = d < 1.6 ? 255 : (d < 3.2 && (x + y) % 3 === 0 ? 255 : 0);
      var c = shade(base, 0.7 + M.valueNoise2(x * 0.5, y * 0.5, 3) * 0.5);
      t.set(x, y, c[0], c[1], c[2], a);
    });
    return t.posterize();
  };

  /* ================= character / creature skins ================= */
  T.cloth = function (colHex, seed) {
    /* Character cloth is nearly flat on purpose. All the shape on an N64
       character comes from vertex lighting and from the silhouette; a busy
       fabric texture only muddies the one clean shape you get. Two bands
       and a few fold creases. */
    var r = ramp(colHex || 0x3f9a4c, 4, { dark: 0.74, lite: 1.14, cool: 0.18, warm: 0.10 });
    var t = new Tile(32, 32);
    var sd = seed || 211;
    t.each(function (x, y) {
      var v = wfbm(x, y, 32, 32, 2, 2, sd);
      var c = v < 0.44 ? r[1] : (v < 0.74 ? r[2] : r[3]);
      /* a couple of soft fold lines running down the cloth */
      var fold = Math.abs(Math.sin((x * 0.30 + M.valueNoise2(0, y * 0.12, sd) * 3)));
      if (fold < 0.10) c = r[0];
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.indexed(5);
  };
  T.leather = function (colHex, seed) {
    var r = ramp(colHex || 0x8a6038, 4, { dark: 0.66, lite: 1.14, cool: 0.14, warm: 0.14 });
    var t = new Tile(32, 32);
    var sd = seed || 221;
    t.each(function (x, y) {
      var d = M.worley2(x / 32 * 4, y / 32 * 4, sd);
      var c = d < 0.24 ? r[1] : (d < 0.55 ? r[2] : r[3]);
      if (d < 0.10) c = r[0];
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.indexed(5);
  };
  T.skin = function (colHex, seed) {
    /* Two tones, and only just. Skin wants to be a clean flat field so the
       painted face tile is the only detail on the head. */
    var r = ramp(colHex || 0xf0c49c, 3, { dark: 0.90, lite: 1.05, cool: 0.10, warm: 0.10 });
    var t = new Tile(32, 32);
    var sd = seed || 231;
    t.each(function (x, y) {
      var v = wfbm(x, y, 32, 32, 2, 2, sd);
      var c = v < 0.46 ? r[1] : r[2];
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.indexed(3);
  };
  T.scale = function (colHex, seed) {
    /* Overlapping scales: flat face, lit crown, hard shadow at the lap. */
    var r = ramp(colHex || 0x4f9a44, 5, { dark: 0.52, lite: 1.22, cool: 0.20, warm: 0.10 });
    var t = new Tile(32, 32);
    var sd = seed || 241;
    t.each(function (x, y) {
      var row = Math.floor(y / 5), off = (row % 2) * 3;
      var xx = ((x + off) % 6 + 6) % 6, yy = y % 5;
      var h = M.hash2(Math.floor((x + off) / 6), row, sd);
      var band = 2 + (h > 0.66 ? 1 : (h < 0.30 ? -1 : 0));
      var c = r[band];
      if (yy === 0) c = r[Math.min(4, band + 2)];
      else if (yy === 4 || xx === 0) c = r[0];
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.indexed(6);
  };
  T.bone = function (seed) {
    var r = ramp(0xe6dcc0, 4, { dark: 0.66, lite: 1.08, cool: 0.16, warm: 0.10 });
    var t = new Tile(32, 32);
    var sd = seed || 251;
    t.each(function (x, y) {
      var v = wfbm(x, y, 32, 32, 3, 2, sd);
      var c = v < 0.34 ? r[1] : (v < 0.70 ? r[2] : r[3]);
      /* hairline cracks */
      if (M.hash2(x >> 1, y, sd + 3) > 0.965) c = r[0];
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.indexed(5);
  };
  T.fur = function (colHex, seed) {
    /* Short vertical strokes in three bands: reads as fur at any distance
       where a smooth gradient reads as plastic. */
    var r = ramp(colHex || 0x6a5a76, 4, { dark: 0.62, lite: 1.16, cool: 0.20, warm: 0.08 });
    var t = new Tile(32, 32);
    var sd = seed || 261;
    t.each(function (x, y) {
      var h = M.hash2(x, y >> 2, sd);
      var band = h < 0.28 ? 1 : (h < 0.72 ? 2 : 3);
      var c = r[band];
      if ((y & 3) === 3) c = r[Math.max(0, band - 1)];
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.indexed(5);
  };
  T.jelly = function (colHex, seed) {
    /* Translucent blob: a flat body, a bright rim band and one hard glare. */
    var r = ramp(colHex || 0x4ab0c8, 5, { dark: 0.60, lite: 1.30, cool: 0.16, warm: 0.10 });
    var t = new Tile(32, 32);
    var sd = seed || 271;
    t.each(function (x, y) {
      var v = wfbm(x, y, 32, 32, 2, 2, sd);
      var band = v < 0.42 ? 1 : (v < 0.72 ? 2 : 3);
      var c = r[band];
      var a = 200 + band * 14;
      /* one glare blob, drawn not computed */
      var dx = x - 10, dy = y - 9;
      if (dx * dx + dy * dy < 10) { c = r[4]; a = 250; }
      t.set(x, y, c[0], c[1], c[2], a);
    });
    return t.indexed(6);
  };
  T.evil = function (colHex, seed) {
    /* Churning dark energy for Genmo's aura and the shadow creatures.
       Banded so the churn reads as moving shapes, not as a purple fog. */
    var r = ramp(colHex || 0x4a1c68, 5, { dark: 0.52, lite: 1.44, cool: 0.10, warm: 0.20 });
    var t = new Tile(32, 32);
    var sd = seed || 281;
    t.each(function (x, y) {
      var n = wfbm(x, y, 32, 32, 3, 3, sd);
      var v = wfbm(x + 7, y + 3, 32, 32, 6, 2, sd + 3);
      var m = n * 0.62 + v * 0.44;
      var band = m < 0.36 ? 0 : (m < 0.52 ? 1 : (m < 0.66 ? 2 : (m < 0.80 ? 3 : 4)));
      var c = r[band];
      /* embers riding the brightest crests */
      if (band === 4 && M.hash2(x, y, sd + 11) > 0.72) c = [255, 206, 128, 255];
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.indexed(7);
  };
  T.face = function (o) {
    o = o || {};
    var skin = hex(o.skin === undefined ? 0xe8c49c : o.skin);
    var eyeCol = hex(o.eye === undefined ? 0x2f5a8a : o.eye);
    var browCol = hex(o.brow === undefined ? 0x5a3c20 : o.brow);
    var mouthCol = hex(o.mouth === undefined ? 0x8a4a44 : o.mouth);
    var style = o.style || 'normal';
    var seed = o.seed || 5;
    var t = new Tile(64, 64);

    /* base skin with a little grain */
    t.each(function (x, y) {
      var n = wfbm(x, y, 64, 64, 8, 2, seed);
      var c = shade(skin, 1.02 + n * 0.10);
      /* cheek warmth */
      var dl = Math.sqrt((x - 17) * (x - 17) + (y - 40) * (y - 40));
      var dr = Math.sqrt((x - 47) * (x - 47) + (y - 40) * (y - 40));
      var blush = Math.max(0, 1 - Math.min(dl, dr) / 11) * (o.blush === undefined ? 0.20 : o.blush);
      c = mixc(c, [232, 150, 132, 255], blush);
      /* soft shading down the sides of the face */
      var side = Math.max(0, (Math.abs(x - 32) - 16) / 16);
      c = shade(c, 1 - side * 0.22);
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    /* keep a clean skin swatch for the sides/back of the head */
    for (var py = 0; py < 12; py++) {
      for (var px = 52; px < 64; px++) {
        var n2 = wfbm(px, py, 64, 64, 8, 2, seed);
        var cc = shade(skin, 0.96 + n2 * 0.10);
        t.set(px, py, cc[0], cc[1], cc[2], 255);
      }
    }

    function ellipse(cx, cy, rx, ry, col, fn) {
      for (var y = Math.floor(cy - ry); y <= cy + ry; y++) {
        for (var x = Math.floor(cx - rx); x <= cx + rx; x++) {
          if (x >= 52 && y < 12) continue;         /* protect the swatch */
          var dx = (x - cx) / rx, dy = (y - cy) / ry;
          if (dx * dx + dy * dy <= 1) {
            var c = fn ? fn(x, y, dx, dy) : col;
            t.set(x, y, c[0], c[1], c[2], 255);
          }
        }
      }
    }
    function rect(x0, y0, x1, y1, col) {
      for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
        if (x >= 52 && y < 12) continue;
        t.set(x, y, col[0], col[1], col[2], 255);
      }
    }

    /* ---- special faces ---- */
    if (style === 'skull') {
      /* bone base with deep sockets and a tooth row: reads instantly */
      t.each(function (x, y) {
        if (x >= 52 && y < 12) return;
        var n = wfbm(x, y, 64, 64, 7, 2, seed + 11);
        var c = shade([228, 220, 198], 0.86 + n * 0.26);
        t.set(x, y, c[0], c[1], c[2], 255);
      });
      var sock = [14, 14, 30];
      for (var sy = 0; sy < 64; sy++) {
        for (var sx = 0; sx < 64; sx++) {
          if (sx >= 52 && sy < 12) continue;
          var c2 = null;
          for (var sd = -1; sd <= 1; sd += 2) {
            var ex = 32 + sd * 13, ey = 25;
            var dx = (sx - ex) / 9.5, dy = (sy - ey) / 8.5;
            if (dx * dx + dy * dy < 1) c2 = sock;
          }
          /* nasal cavity */
          var nx = (sx - 32) / 4.0, ny = (sy - 40) / 6.0;
          if (nx * nx + ny * ny < 1) c2 = sock;
          /* jaw line and teeth */
          if (sy >= 48 && sy <= 56 && sx > 16 && sx < 48) {
            c2 = ((sx - 17) % 5 < 1 || sy === 48) ? sock : [238, 232, 214];
          }
          if (c2) t.set(sx, sy, c2[0], c2[1], c2[2], 255);
        }
      }
      if (o.emberEyes !== false) {
        var glow = hex(o.eye === undefined ? 0xff6020 : o.eye);
        for (var g2 = -1; g2 <= 1; g2 += 2) {
          ellipse(32 + g2 * 13, 26, 4.2, 4.2, glow);
          ellipse(32 + g2 * 13, 26, 2.0, 2.0, [255, 240, 200, 255]);
        }
      }
      return t.posterize();
    }
    if (style === 'wrapped') {
      /* mummy bandages with a single dark gap for the eyes */
      t.each(function (x, y) {
        if (x >= 52 && y < 12) return;
        var band = Math.floor((y + Math.sin(x * 0.18) * 2.4) / 5);
        var h2 = M.hash2(band, 0, seed + 21);
        var c = shade([214, 205, 178], 0.78 + h2 * 0.30 + ((y % 5) === 0 ? -0.16 : 0));
        t.set(x, y, c[0], c[1], c[2], 255);
      });
      for (var wy = 22; wy < 32; wy++) {
        for (var wx = 12; wx < 52; wx++) {
          if (wx >= 52 && wy < 12) continue;
          t.set(wx, wy, 16, 14, 18, 255);
        }
      }
      for (var g3 = -1; g3 <= 1; g3 += 2) {
        ellipse(32 + g3 * 11, 27, 3.0, 2.6, [200, 60, 40, 255]);
      }
      return t.posterize();
    }

    var eyeY = o.eyeY === undefined ? 26 : o.eyeY;
    var eyeX = o.eyeX === undefined ? 14 : o.eyeX;
    var open = o.eyeOpen === undefined ? 1 : o.eyeOpen;
    var white = [246, 244, 238, 255];
    var dark = [26, 22, 28, 255];

    for (var side = -1; side <= 1; side += 2) {
      var cx = 32 + side * eyeX;
      if (style === 'closed' || open <= 0) {
        rect(cx - 6, eyeY, cx + 6, eyeY + 1, dark);
      } else {
        /* sclera */
        ellipse(cx, eyeY, 8.5, 7.0 * open, white);
        /* iris + pupil, offset slightly inward so they look at the camera */
        ellipse(cx - side * 1.4, eyeY + 0.8, 4.4, 5.4 * open, eyeCol);
        ellipse(cx - side * 1.4, eyeY + 0.8, 2.2, 2.8 * open, dark);
        /* catchlight -- one white pixel is what sells a painted eye */
        t.set(Math.round(cx - side * 2.6), Math.round(eyeY - 1.6), 255, 255, 255, 255);
        /* upper lash line */
        rect(Math.round(cx - 8), Math.round(eyeY - 7.0 * open), Math.round(cx + 8),
             Math.round(eyeY - 7.0 * open + 1), dark);
      }
      /* brow */
      var browY = eyeY - 12 + (o.browY || 0);
      var tilt = ({ angry: 3, stern: 2, sad: -3, normal: 0, old: 1 })[style] || 0;
      for (var bx = -8; bx <= 8; bx++) {
        var by = browY + Math.round(side * 0 + (bx * side) * (tilt / 8));
        rect(cx + bx, by, cx + bx, by + (style === 'old' ? 2 : 1), browCol);
      }
    }

    /* nose shadow */
    rect(31, eyeY + 12, 33, eyeY + 16, shade(skin, 0.86));

    /* mouth */
    var my = o.mouthY === undefined ? 46 : o.mouthY;
    if (style === 'angry') {
      rect(24, my, 40, my + 2, dark);
      rect(26, my + 2, 38, my + 4, [140, 40, 44, 255]);
      for (var tx = 26; tx < 39; tx += 4) rect(tx, my + 1, tx + 1, my + 3, [240, 236, 220, 255]);
    } else if (style === 'sad' || style === 'old') {
      for (var mx = -7; mx <= 7; mx++) {
        rect(32 + mx, my + Math.round(Math.abs(mx) * 0.28), 32 + mx, my + 1 + Math.round(Math.abs(mx) * 0.28), mouthCol);
      }
    } else {
      for (var mx2 = -6; mx2 <= 6; mx2++) {
        rect(32 + mx2, my - Math.round(Math.abs(mx2) * 0.22), 32 + mx2,
             my + 1 - Math.round(Math.abs(mx2) * 0.22), mouthCol);
      }
    }

    if (style === 'old') {
      /* wrinkles: a few short darker strokes */
      rect(14, 24, 22, 24, shade(skin, 0.80));
      rect(42, 24, 50, 24, shade(skin, 0.80));
      rect(16, 44, 22, 45, shade(skin, 0.84));
      rect(42, 44, 48, 45, shade(skin, 0.84));
      rect(26, 20, 38, 20, shade(skin, 0.84));
    }
    if (o.marks) {
      /* war paint / tattoo bands */
      rect(10, 36, 22, 38, hex(o.marks));
      rect(42, 36, 54, 38, hex(o.marks));
    }
    return t.posterize();
  };

  /* ================= props / effects ================= */
  T.chestwood = function (seed) {
    /* Boards with an iron band down one edge, both drawn in flat bands. */
    var t = T.planks(0x8a5c2c, seed || 291);
    var ir = ramp(0x7c828e, 4, { dark: 0.50, lite: 1.26, cool: 0.22, warm: 0.06 });
    t.each(function (x, y) {
      var xx = x % 32;
      if (xx < 5) {
        var c = ir[2];
        if (xx === 0 || xx === 4) c = ir[0];
        else if (xx === 1) c = ir[3];
        if (y % 8 === 0) c = ir[0];
        if ((y % 8 === 4) && xx === 2) c = ir[3];   /* stud */
        t.set(x, y, c[0], c[1], c[2], 255);
      }
    });
    return t.indexed(10);
  };
  T.gold = function (seed) {
    /* Polished metal: three flat bands with a hard specular streak. */
    var r = ramp(0xd8ac48, 5, { dark: 0.48, lite: 1.34, cool: 0.12, warm: 0.22 });
    var t = new Tile(32, 32);
    var sd = seed || 301;
    t.each(function (x, y) {
      var n = wfbm(x, y, 32, 32, 2, 2, sd);
      var band = n < 0.36 ? 1 : (n < 0.62 ? 2 : 3);
      var c = r[band];
      /* a horizontal specular band, the way a burnished N64 tile was drawn */
      if (y % 12 === 3) c = r[4];
      else if (y % 12 === 4) c = r[3];
      else if (y % 12 === 9) c = r[0];
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.indexed(6);
  };
  T.gem = function (colHex, seed) {
    /* Cut facets: hard triangular bands, one white glint. */
    var r = ramp(colHex || 0x2fd06a, 5, { dark: 0.44, lite: 1.38, cool: 0.18, warm: 0.10 });
    var t = new Tile(32, 32);
    t.each(function (x, y) {
      var fx = (x % 16) - 8, fy = (y % 16) - 8;
      var f = Math.sqrt(fx * fx + fy * fy) / 11;
      var band = f < 0.30 ? 4 : (f < 0.52 ? 3 : (f < 0.74 ? 2 : 1));
      var c = r[band];
      if (fx === -3 && fy > -6 && fy < -2) c = [255, 255, 255, 255];
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.indexed(6);
  };
  T.flame = function (seed) {
    var t = new Tile(32, 32);
    t.each(function (x, y) {
      var cx = 16, dy = (32 - y) / 32;
      var w = 3 + dy * 7;
      var wob = Math.sin(y * 0.5 + M.hash2(y, 0, seed || 311) * 3) * 2 * dy;
      var d = Math.abs(x - cx - wob);
      var a = d < w ? 255 : 0;
      var f = 1 - d / (w || 1);
      var c = mixc([255, 108, 30], [255, 246, 176], M.saturate(f * 1.2 - dy * 0.5));
      t.set(x, y, c[0], c[1], c[2], a);
    });
    return t.posterize();
  };
  T.radial = function (colHex, softness) {
    /* generic soft dot: particles, blob shadows, glows */
    var base = hex(colHex || 0xffffff);
    var t = new Tile(32, 32);
    var s = softness === undefined ? 1 : softness;
    t.each(function (x, y) {
      var dx = (x - 15.5) / 15.5, dy = (y - 15.5) / 15.5;
      var d = Math.sqrt(dx * dx + dy * dy);
      var a = M.saturate(1 - d);
      a = Math.pow(a, s) * 255;
      t.set(x, y, base[0], base[1], base[2], a);
    });
    return t;
  };
  T.ring = function (colHex, thickness) {
    var base = hex(colHex || 0xffffff);
    var t = new Tile(32, 32);
    var th = thickness || 0.16;
    t.each(function (x, y) {
      var dx = (x - 15.5) / 15.5, dy = (y - 15.5) / 15.5;
      var d = Math.sqrt(dx * dx + dy * dy);
      var a = M.saturate(1 - Math.abs(d - 0.8) / th) * 255;
      t.set(x, y, base[0], base[1], base[2], a);
    });
    return t;
  };
  T.spark = function (colHex) {
    var base = hex(colHex || 0xffffff);
    var t = new Tile(16, 16);
    t.each(function (x, y) {
      var dx = Math.abs(x - 7.5), dy = Math.abs(y - 7.5);
      var d = Math.min(dx, dy) + Math.max(dx, dy) * 0.35;
      var a = M.saturate(1 - d / 6) * 255;
      t.set(x, y, base[0], base[1], base[2], a);
    });
    return t;
  };
  T.slash = function (colHex) {
    /* crescent sword trail */
    var base = hex(colHex || 0xffffff);
    var t = new Tile(64, 64);
    t.each(function (x, y) {
      var dx = (x - 32) / 32, dy = (y - 32) / 32;
      var d = Math.sqrt(dx * dx + dy * dy);
      var band = M.saturate(1 - Math.abs(d - 0.78) / 0.20);
      var ang = Math.atan2(dy, dx);
      var arc = M.saturate(1 - Math.abs(M.wrapAngle(ang)) / 1.25);
      var a = band * arc * 255;
      t.set(x, y, base[0], base[1], base[2], a);
    });
    return t;
  };
  T.sign = function (seed) {
    var t = T.planks(0x9c7040, seed || 321);
    return t;
  };
  T.cobweb = function () {
    var t = new Tile(32, 32);
    t.each(function (x, y) {
      var dx = x - 0, dy = y - 0;
      var d = Math.sqrt(dx * dx + dy * dy);
      var ang = Math.atan2(dy, dx);
      var spoke = Math.abs(Math.sin(ang * 5)) > 0.985 ? 1 : 0;
      var ringv = Math.abs(Math.sin(d * 0.9)) > 0.97 ? 1 : 0;
      var a = (spoke || ringv) && d < 30 ? 190 : 0;
      t.set(x, y, 220, 224, 230, a);
    });
    return t;
  };
  T.solid = function (colHex, a) {
    var c = hex(colHex || 0xffffff);
    var t = new Tile(4, 4);
    t.fill([c[0], c[1], c[2], a === undefined ? 255 : a]);
    return t;
  };
  T.gradientV = function (topHex, botHex) {
    var A = hex(topHex), B = hex(botHex);
    var t = new Tile(4, 64);
    t.each(function (x, y) {
      var c = mixc(A, B, y / 63);
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.posterize();
  };
  T.sky = function (topHex, botHex, seed) {
    /* A banded sky. Cartridges could not hold a smooth vertical ramp in a
       64x64 tile, so skyboxes were painted as a stack of flat bands with
       cloud shelves drawn on top; the banding is the look, not an artefact. */
    var A = typeof topHex === 'number' ? hex(topHex) : topHex;
    var B = typeof botHex === 'number' ? hex(botHex) : botHex;
    var t = new Tile(64, 64);
    var sd = seed || 331;
    var BANDS = 9;
    var cols = [];
    for (var i = 0; i < BANDS; i++) {
      var u = i / (BANDS - 1);
      cols.push(mixc(A, B, Math.pow(u, 1.7)));
    }
    var cloud = [250, 250, 252, 255];
    t.each(function (x, y) {
      var v = y / 63;                       /* 0 = zenith, 1 = horizon */
      var bi = Math.min(BANDS - 1, Math.floor(v * BANDS));
      var c = cols[bi];
      /* flat-bottomed shelves, stacking denser toward the horizon */
      var n = wfbm(x, y * 2.4, 64, 154, 4, 3, sd);
      var thresh = 0.70 - 0.24 * M.smoothstep(0.10, 0.78, v);
      if (v > 0.10 && v < 0.90 && n > thresh) {
        var lift = n > thresh + 0.10 ? 1 : 0.55;
        c = mixc(c, cloud, lift * 0.85);
      }
      /* a warm haze band right at the horizon line */
      if (v > 0.86) c = mixc(c, mixc(B, [255, 246, 226, 255], 0.4), (v - 0.86) / 0.14 * 0.6);
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.indexed(16);
  };
  T.moon = function () {
    var t = new Tile(64, 64);
    t.each(function (x, y) {
      var dx = (x - 32) / 30, dy = (y - 32) / 30;
      var d = Math.sqrt(dx * dx + dy * dy);
      var a = d < 1 ? 255 : 0;
      var n = wfbm(x, y, 64, 64, 6, 3, 401);
      var c = mixc([236, 232, 214], [186, 178, 158], n);
      var crater = M.worley2(x / 64 * 5, y / 64 * 5, 77);
      if (crater < 0.22) c = shade(c, 0.82);
      t.set(x, y, c[0], c[1], c[2], a);
    });
    return t.posterize();
  };

  LZ.Tex = T;
})(LZ);
