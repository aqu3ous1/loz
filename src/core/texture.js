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

  var T = {};
  T.Tile = Tile;
  T.mixc = mixc; T.shade = shade; T.hex = hex; T.wfbm = wfbm; T.wnoise = wnoise;

  /* ================= ground / terrain ================= */
  T.grass = function (base, alt, seed) {
    base = base || [72, 118, 54]; alt = alt || [104, 152, 70];
    var t = new Tile(64, 64);
    t.each(function (x, y) {
      var n = wfbm(x, y, 64, 64, 8, 3, seed || 1);
      var n2 = wnoise(x, y, 64, 64, 32, (seed || 1) + 41);
      var c = mixc(base, alt, M.saturate(n * 1.3 - 0.1));
      c = shade(c, 0.86 + n2 * 0.28);
      /* sparse blade flecks */
      if (n2 > 0.93) c = mixc(c, [150, 186, 96, 255], 0.6);
      if (n2 < 0.05) c = shade(c, 0.78);
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.posterize();
  };
  T.dirt = function (seed) {
    var t = new Tile(64, 64);
    var a = [104, 80, 54], b = [140, 112, 76];
    t.each(function (x, y) {
      var n = wfbm(x, y, 64, 64, 6, 4, seed || 7);
      var g = wnoise(x, y, 64, 64, 32, (seed || 7) + 3);
      var c = mixc(a, b, n);
      c = shade(c, 0.88 + g * 0.26);
      if (g > 0.95) c = mixc(c, [86, 76, 70, 255], 0.7);  /* pebbles */
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.posterize();
  };
  T.sand = function (seed) {
    var t = new Tile(64, 64);
    var a = [196, 168, 112], b = [224, 200, 148];
    t.each(function (x, y) {
      var ripple = Math.sin((x * 0.55 + wfbm(x, y, 64, 64, 4, 2, seed || 3) * 9) * 1.0) * 0.5 + 0.5;
      var n = wfbm(x, y, 64, 64, 8, 3, (seed || 3) + 11);
      var c = mixc(a, b, M.saturate(ripple * 0.55 + n * 0.5));
      c = shade(c, 0.94 + wnoise(x, y, 64, 64, 32, 5) * 0.14);
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.posterize();
  };
  T.rock = function (tintHex, seed) {
    var base = tintHex ? hex(tintHex) : [112, 108, 104];
    var t = new Tile(64, 64);
    t.each(function (x, y) {
      var cell = 1 - M.saturate(M.worley2(x / 64 * 5 + 0.3, y / 64 * 5 + 0.7, seed || 13) * 1.4);
      var n = wfbm(x, y, 64, 64, 8, 3, (seed || 13) + 17);
      var f = 0.66 + n * 0.5 + cell * 0.28;
      var c = shade(base, f);
      /* crack lines */
      var cr = M.worley2(x / 64 * 5 + 0.3, y / 64 * 5 + 0.7, seed || 13);
      if (cr > 0.62) c = shade(c, 0.6);
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.posterize();
  };
  T.snow = function (seed) {
    var t = new Tile(64, 64);
    t.each(function (x, y) {
      var n = wfbm(x, y, 64, 64, 6, 3, seed || 21);
      var c = mixc([206, 214, 232], [248, 250, 255], n);
      var sp = wnoise(x, y, 64, 64, 32, 9);
      if (sp > 0.94) c = [255, 255, 255, 255];
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.posterize();
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
  T.water = function (colHex, seed) {
    var base = hex(colHex || 0x2f6d9a);
    var t = new Tile(64, 64);
    t.each(function (x, y) {
      var n = wfbm(x, y, 64, 64, 4, 3, seed || 41);
      var w1 = Math.sin((x * 0.32 + n * 6)) * 0.5 + 0.5;
      var w2 = Math.sin((y * 0.21 - n * 5)) * 0.5 + 0.5;
      var f = 0.72 + (w1 * w2) * 0.6;
      var c = shade(base, f);
      if (w1 * w2 > 0.82) c = mixc(c, [220, 240, 255, 255], 0.45);
      t.set(x, y, c[0], c[1], c[2], 200);
    });
    return t.posterize();
  };
  T.cobble = function (seed) {
    var t = new Tile(64, 64);
    t.each(function (x, y) {
      var d = M.worley2(x / 64 * 6, y / 64 * 6, seed || 51);
      var n = wfbm(x, y, 64, 64, 16, 2, (seed || 51) + 5);
      var base = mixc([128, 124, 116], [162, 158, 148], n);
      var c = d > 0.44 ? shade(base, 0.5) : shade(base, 0.86 + (0.44 - d) * 0.9);
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.posterize();
  };

  /* ================= architecture ================= */
  T.planks = function (colHex, seed) {
    var base = hex(colHex || 0x8a6438);
    var t = new Tile(64, 64);
    t.each(function (x, y) {
      var plank = Math.floor(y / 8);
      var jitter = M.hash2(plank, 0, seed || 61);
      var grain = M.valueNoise2(x * 0.42 + jitter * 30, plank * 8.3, (seed || 61) + 2);
      var f = 0.78 + grain * 0.42 + jitter * 0.14;
      var c = shade(base, f);
      if (y % 8 === 0) c = shade(c, 0.48);
      var seam = (Math.floor((x + plank * 23) / 21) * 21 - plank * 23);
      if (((x - seam) % 64 + 64) % 64 === 0) c = shade(c, 0.55);
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.posterize();
  };
  T.bark = function (colHex, seed) {
    var base = hex(colHex || 0x6b4d30);
    var t = new Tile(32, 64);
    t.each(function (x, y) {
      var n = M.valueNoise2(x * 0.9, y * 0.14, seed || 71);
      var ridge = Math.abs(Math.sin(x * 0.75 + n * 4)) ;
      var c = shade(base, 0.62 + ridge * 0.62 + n * 0.2);
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.posterize();
  };
  T.thatch = function (seed) {
    var t = new Tile(64, 64);
    var base = [160, 130, 66];
    t.each(function (x, y) {
      var row = Math.floor(y / 10);
      var h = M.hash2(Math.floor(x / 2) + row * 17, row, seed || 81);
      var yy = y % 10;
      var f = 0.62 + h * 0.5 + (yy / 10) * 0.35;
      var c = shade(base, f);
      if (yy === 0) c = shade(c, 0.5);
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.posterize();
  };
  T.shingle = function (colHex, seed) {
    var base = hex(colHex || 0x8c3a34);
    var t = new Tile(64, 64);
    t.each(function (x, y) {
      var row = Math.floor(y / 8);
      var off = (row % 2) * 8;
      var cx = Math.floor((x + off) / 16);
      var h = M.hash2(cx, row, seed || 91);
      var yy = y % 8, xx = (x + off) % 16;
      var f = 0.72 + h * 0.28 + (1 - yy / 8) * 0.3;
      var c = shade(base, f);
      if (yy === 0 || xx === 0) c = shade(c, 0.55);
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.posterize();
  };
  T.brick = function (colHex, mortarHex, seed) {
    var base = hex(colHex || 0x9a5a48), mort = hex(mortarHex || 0xa89c8c);
    var t = new Tile(64, 64);
    t.each(function (x, y) {
      var row = Math.floor(y / 8);
      var off = (row % 2) * 8;
      var xx = (x + off) % 16, yy = y % 8;
      var c;
      if (yy < 1 || xx < 1) c = mort.slice();
      else {
        var h = M.hash2(Math.floor((x + off) / 16), row, seed || 101);
        var n = M.valueNoise2(x * 0.6, y * 0.6, (seed || 101) + 3);
        c = shade(base, 0.76 + h * 0.34 + n * 0.16);
      }
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.posterize();
  };
  T.stoneblock = function (colHex, seed) {
    var base = hex(colHex || 0x8e8a80);
    var t = new Tile(64, 64);
    t.each(function (x, y) {
      var row = Math.floor(y / 16);
      var off = (row % 2) * 10;
      var xx = ((x + off) % 22), yy = y % 16;
      var c;
      if (yy < 1 || xx < 1) c = shade(base, 0.5);
      else {
        var h = M.hash2(Math.floor((x + off) / 22), row, seed || 111);
        var n = wfbm(x, y, 64, 64, 16, 2, (seed || 111) + 7);
        c = shade(base, 0.8 + h * 0.24 + n * 0.22);
        /* bevel highlight */
        if (yy < 3 || xx < 3) c = shade(c, 1.12);
        if (yy > 13 || xx > 19) c = shade(c, 0.88);
      }
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.posterize();
  };
  T.plaster = function (colHex, seed) {
    var base = hex(colHex || 0xd8cbae);
    var t = new Tile(64, 64);
    t.each(function (x, y) {
      var n = wfbm(x, y, 64, 64, 10, 3, seed || 121);
      var c = shade(base, 0.9 + n * 0.22);
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.posterize();
  };
  T.sandstone = function (seed) {
    var t = new Tile(64, 64);
    var base = [206, 172, 118];
    t.each(function (x, y) {
      var band = Math.sin(y * 0.28 + wfbm(x, y, 64, 64, 4, 2, seed || 131) * 5) * 0.5 + 0.5;
      var n = wfbm(x, y, 64, 64, 12, 2, (seed || 131) + 9);
      var c = shade(base, 0.82 + band * 0.2 + n * 0.2);
      if (y % 16 === 0) c = shade(c, 0.72);
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.posterize();
  };
  T.tilefloor = function (aHex, bHex, seed) {
    var A = hex(aHex || 0x6a6f86), B = hex(bHex || 0x4a4e63);
    var t = new Tile(64, 64);
    t.each(function (x, y) {
      var cx = Math.floor(x / 16), cy = Math.floor(y / 16);
      var base = ((cx + cy) % 2 === 0) ? A : B;
      var n = wfbm(x, y, 64, 64, 16, 2, seed || 141);
      var c = shade(base, 0.86 + n * 0.26);
      if (x % 16 === 0 || y % 16 === 0) c = shade(c, 0.62);
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.posterize();
  };
  T.carpet = function (colHex, trimHex, seed) {
    var base = hex(colHex || 0x8c2b34), trim = hex(trimHex || 0xd0b356);
    var t = new Tile(64, 64);
    t.each(function (x, y) {
      var n = wnoise(x, y, 64, 64, 32, seed || 151);
      var c = shade(base, 0.88 + n * 0.24);
      var bx = Math.min(x, 63 - x), by = Math.min(y, 63 - y);
      var edge = Math.min(bx, by);
      if (edge < 3) c = shade(trim, 0.9 + n * 0.2);
      else if (edge < 5) c = shade(base, 0.7);
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.posterize();
  };
  T.metal = function (colHex, rust, seed) {
    var base = hex(colHex || 0x9aa2ad);
    var t = new Tile(64, 64);
    t.each(function (x, y) {
      var n = wfbm(x, y, 64, 64, 8, 3, seed || 161);
      var scratch = M.valueNoise2(x * 0.1, y * 2.4, (seed || 161) + 4);
      var c = shade(base, 0.82 + n * 0.2 + scratch * 0.22);
      if (rust) {
        var r = wfbm(x, y, 64, 64, 5, 3, (seed || 161) + 55);
        if (r > 0.52) c = mixc(c, [128, 66, 32, 255], M.smoothstep(0.52, 0.8, r) * 0.9);
      }
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.posterize();
  };

  /* ================= foliage (cutout) ================= */
  T.leaves = function (colHex, seed) {
    var base = hex(colHex || 0x3f7a3a);
    var t = new Tile(64, 64);
    t.each(function (x, y) {
      var d = M.worley2(x / 64 * 7, y / 64 * 7, seed || 171);
      var n = wfbm(x, y, 64, 64, 8, 3, (seed || 171) + 6);
      var a = (d < 0.42 || n > 0.56) ? 255 : 0;
      var c = shade(base, 0.66 + n * 0.72 + (0.42 - d) * 0.5);
      t.set(x, y, c[0], c[1], c[2], a);
    });
    return t.posterize();
  };
  T.grassblade = function (colHex, seed) {
    var base = hex(colHex || 0x63a34b);
    var t = new Tile(32, 32);
    t.each(function (x, y) {
      var col = Math.floor(x / 4);
      var h = M.hash2(col, 0, seed || 181);
      var top = 6 + h * 14;
      var a = (y > top) ? 255 : 0;
      if (x % 4 === 3) a = 0;
      var c = shade(base, 0.6 + (y / 32) * 0.7 + h * 0.2);
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
      var cx = col * 8 + 4, cy = row * 8 + 4;
      var d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
      if (h > 0.45 && d < 2.6) { a = 255; c = shade(petal, 0.85 + h * 0.3); }
      else if (d < 3.6 && h > 0.45 && (x + y) % 2 === 0) { a = 255; c = shade(leaf, 0.9); }
      t.set(x, y, c[0], c[1], c[2], a);
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
    var base = hex(colHex || 0x2f7a3c);
    var t = new Tile(32, 32);
    t.each(function (x, y) {
      var weave = ((x % 2) ^ (y % 2)) * 0.06;
      var n = wfbm(x, y, 32, 32, 6, 2, seed || 211);
      var c = shade(base, 0.9 + n * 0.2 + weave);
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.posterize();
  };
  T.leather = function (colHex, seed) {
    var base = hex(colHex || 0x6b4a2c);
    var t = new Tile(32, 32);
    t.each(function (x, y) {
      var d = M.worley2(x / 32 * 6, y / 32 * 6, seed || 221);
      var c = shade(base, 0.8 + d * 0.5);
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.posterize();
  };
  T.skin = function (colHex, seed) {
    var base = hex(colHex || 0xe0b48c);
    var t = new Tile(32, 32);
    t.each(function (x, y) {
      var n = wfbm(x, y, 32, 32, 8, 2, seed || 231);
      var c = shade(base, 0.95 + n * 0.12);
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.posterize();
  };
  T.scale = function (colHex, seed) {
    var base = hex(colHex || 0x4f7a3a);
    var t = new Tile(32, 32);
    t.each(function (x, y) {
      var row = Math.floor(y / 5), off = (row % 2) * 3;
      var xx = (x + off) % 6, yy = y % 5;
      var h = M.hash2(Math.floor((x + off) / 6), row, seed || 241);
      var c = shade(base, 0.72 + h * 0.2 + (1 - yy / 5) * 0.4);
      if (yy === 0 || xx === 0) c = shade(c, 0.68);
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.posterize();
  };
  T.bone = function (seed) {
    var t = new Tile(32, 32);
    var base = [222, 214, 190];
    t.each(function (x, y) {
      var n = wfbm(x, y, 32, 32, 6, 3, seed || 251);
      var c = shade(base, 0.82 + n * 0.28);
      if (n < 0.28) c = mixc(c, [120, 112, 96, 255], 0.6);
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.posterize();
  };
  T.fur = function (colHex, seed) {
    var base = hex(colHex || 0x4a3a52);
    var t = new Tile(32, 32);
    t.each(function (x, y) {
      var n = M.valueNoise2(x * 0.4, y * 2.2, seed || 261);
      var c = shade(base, 0.72 + n * 0.6);
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.posterize();
  };
  T.jelly = function (colHex, seed) {
    var base = hex(colHex || 0x4ab0c8);
    var t = new Tile(32, 32);
    t.each(function (x, y) {
      var n = wfbm(x, y, 32, 32, 4, 3, seed || 271);
      var c = shade(base, 0.7 + n * 0.8);
      var a = 200 + n * 55;
      t.set(x, y, c[0], c[1], c[2], a);
    });
    return t.posterize();
  };
  T.evil = function (colHex, seed) {
    /* churning dark energy: used for Genmo's aura and shadow creatures */
    var base = hex(colHex || 0x3a1550);
    var t = new Tile(64, 64);
    t.each(function (x, y) {
      var n = wfbm(x, y, 64, 64, 5, 4, seed || 281);
      var v = wfbm(x + 17, y + 5, 64, 64, 9, 3, (seed || 281) + 3);
      var c = mixc(base, [176, 60, 210, 255], M.smoothstep(0.45, 0.85, n * 0.6 + v * 0.5));
      if (n * v > 0.42) c = mixc(c, [255, 200, 120, 255], 0.35);
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.posterize();
  };

  /* ================= props / effects ================= */
  T.chestwood = function (seed) {
    var t = T.planks(0x7a5228, seed || 291);
    /* iron banding */
    t.each(function (x, y) {
      if (x % 32 < 4) {
        var n = M.valueNoise2(x * 0.7, y * 0.7, 5);
        t.set(x, y, 96 + n * 50, 100 + n * 50, 110 + n * 50, 255);
      }
    });
    return t.posterize();
  };
  T.gold = function (seed) {
    var t = new Tile(32, 32);
    var base = [214, 172, 62];
    t.each(function (x, y) {
      var n = wfbm(x, y, 32, 32, 5, 3, seed || 301);
      var c = shade(base, 0.68 + n * 0.8);
      if (n > 0.78) c = [255, 246, 200, 255];
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.posterize();
  };
  T.gem = function (colHex, seed) {
    var base = hex(colHex || 0x2fd06a);
    var t = new Tile(32, 32);
    t.each(function (x, y) {
      var f = Math.abs(Math.sin(x * 0.4) + Math.cos(y * 0.36));
      var c = shade(base, 0.55 + f * 0.7);
      if (f > 1.6) c = mixc(c, [255, 255, 255, 255], 0.5);
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.posterize();
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
    var A = hex(topHex), B = hex(botHex);
    var t = new Tile(64, 64);
    t.each(function (x, y) {
      var v = y / 63;
      var c = mixc(A, B, Math.pow(v, 0.85));
      /* soft banded cloud shelves, very N64 skybox */
      var n = wfbm(x, y * 2, 64, 128, 5, 3, seed || 331);
      var cloud = M.smoothstep(0.52, 0.74, n) * M.smoothstep(0.02, 0.35, v) * M.smoothstep(1.0, 0.6, v);
      c = mixc(c, [246, 246, 250, 255], cloud * 0.7);
      t.set(x, y, c[0], c[1], c[2], 255);
    });
    return t.posterize();
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
