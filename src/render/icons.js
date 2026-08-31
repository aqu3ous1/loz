/* =============================================================
   render/icons.js -- a 128x128 icon atlas (8x8 cells of 16x16),
   drawn procedurally with a tiny 2D raster API and then given a hard
   1px outline, which is what makes small pixel icons read at 320x240.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var M = LZ.M;

  var CELL = 16, COLS = 8, ROWS = 8;

  /* ---------------- tiny raster surface ---------------- */
  function Cell() {
    this.d = new Uint8Array(CELL * CELL * 4);
  }
  Cell.prototype.px = function (x, y, c, a) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= CELL || y >= CELL) return;
    var i = (y * CELL + x) * 4;
    this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2];
    this.d[i + 3] = a === undefined ? 255 : a;
  };
  Cell.prototype.alphaAt = function (x, y) {
    if (x < 0 || y < 0 || x >= CELL || y >= CELL) return 0;
    return this.d[(y * CELL + x) * 4 + 3];
  };
  Cell.prototype.rect = function (x, y, w, h, c) {
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) this.px(x + i, y + j, c);
    return this;
  };
  Cell.prototype.disc = function (cx, cy, r, c) {
    for (var y = Math.floor(cy - r); y <= cy + r; y++) {
      for (var x = Math.floor(cx - r); x <= cx + r; x++) {
        var dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= r * r) this.px(x, y, c);
      }
    }
    return this;
  };
  Cell.prototype.ellipse = function (cx, cy, rx, ry, c) {
    for (var y = Math.floor(cy - ry); y <= cy + ry; y++) {
      for (var x = Math.floor(cx - rx); x <= cx + rx; x++) {
        var dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.px(x, y, c);
      }
    }
    return this;
  };
  Cell.prototype.line = function (x0, y0, x1, y1, c) {
    var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) + 1;
    for (var i = 0; i < n; i++) {
      var t = n === 1 ? 0 : i / (n - 1);
      this.px(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), c);
    }
    return this;
  };
  Cell.prototype.thickLine = function (x0, y0, x1, y1, c, w) {
    var dx = x1 - x0, dy = y1 - y0, l = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / l, ny = dx / l;
    for (var o = -(w - 1) / 2; o <= (w - 1) / 2; o += 0.5) {
      this.line(x0 + nx * o, y0 + ny * o, x1 + nx * o, y1 + ny * o, c);
    }
    return this;
  };
  /* even-odd scanline polygon fill; pts = [x0,y0, x1,y1, ...] */
  Cell.prototype.poly = function (pts, c) {
    var n = pts.length / 2;
    var minY = 1e9, maxY = -1e9, i;
    for (i = 0; i < n; i++) { minY = Math.min(minY, pts[i * 2 + 1]); maxY = Math.max(maxY, pts[i * 2 + 1]); }
    for (var y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      var sy = y + 0.5, xs = [];
      for (i = 0; i < n; i++) {
        var j = (i + 1) % n;
        var ay = pts[i * 2 + 1], by = pts[j * 2 + 1];
        if ((ay > sy) === (by > sy)) continue;
        var ax = pts[i * 2], bx = pts[j * 2];
        xs.push(ax + (sy - ay) / (by - ay) * (bx - ax));
      }
      xs.sort(function (a, b) { return a - b; });
      for (var k = 0; k + 1 < xs.length; k += 2) {
        for (var x = Math.floor(xs[k] + 0.5); x < xs[k + 1] - 0.001; x++) this.px(x, y, c);
      }
    }
    return this;
  };
  /* add a 1px dark border around every opaque pixel */
  Cell.prototype.outline = function (c) {
    c = c || [20, 16, 24];
    var copy = new Uint8Array(this.d);
    function a(x, y) {
      if (x < 0 || y < 0 || x >= CELL || y >= CELL) return 0;
      return copy[(y * CELL + x) * 4 + 3];
    }
    for (var y = 0; y < CELL; y++) {
      for (var x = 0; x < CELL; x++) {
        if (a(x, y) > 0) continue;
        if (a(x - 1, y) > 128 || a(x + 1, y) > 128 || a(x, y - 1) > 128 || a(x, y + 1) > 128) {
          this.px(x, y, c);
        }
      }
    }
    return this;
  };
  /* lighten the top-left of every opaque run: a cheap bevel */
  Cell.prototype.shine = function (amt) {
    amt = amt || 40;
    var copy = new Uint8Array(this.d);
    for (var y = 0; y < CELL; y++) {
      for (var x = 0; x < CELL; x++) {
        var i = (y * CELL + x) * 4;
        if (copy[i + 3] < 128) continue;
        var above = (y > 0) ? copy[((y - 1) * CELL + x) * 4 + 3] : 0;
        if (above < 128) {
          this.d[i] = Math.min(255, this.d[i] + amt);
          this.d[i + 1] = Math.min(255, this.d[i + 1] + amt);
          this.d[i + 2] = Math.min(255, this.d[i + 2] + amt);
        }
      }
    }
    return this;
  };

  /* ---------------- palette ---------------- */
  var P = {
    k: [22, 18, 26], w: [248, 248, 244], gy: [150, 152, 158], dgy: [86, 88, 96],
    r: [214, 52, 56], dr: [140, 26, 34], pk: [255, 140, 140],
    g: [72, 184, 84], dg: [34, 112, 56], lg: [160, 226, 140],
    b: [70, 132, 220], db: [34, 68, 150], lb: [150, 208, 246],
    y: [240, 208, 72], dy: [176, 134, 30], au: [232, 190, 96],
    br: [150, 104, 58], dbr: [96, 64, 36], lbr: [196, 156, 100],
    pu: [156, 84, 200], dpu: [86, 40, 128],
    cy: [96, 220, 224], or: [244, 142, 48], sk: [226, 182, 140],
    st: [206, 200, 186], mo: [110, 118, 132]
  };

  /* ---------------- icon painters ---------------- */
  function heartShape(c, col, dark) {
    /* 16x16 chunky heart */
    c.poly([8, 15, 1.6, 8.4, 1.6, 5.4, 4, 3.2, 6.4, 3.6, 8, 5.6,
            9.6, 3.6, 12, 3.2, 14.4, 5.4, 14.4, 8.4], col);
    c.poly([8, 15, 1.6, 8.4, 1.6, 5.4, 4, 3.2, 6.4, 3.6, 8, 5.6], dark || col);
    return c;
  }

  var ICONS = {
    heart_full: function (c) { heartShape(c, P.r, P.dr); c.rect(4, 5, 2, 2, P.pk); c.outline(); },
    heart_half: function (c) {
      heartShape(c, P.r, P.dr);
      /* right half hollowed out */
      for (var y = 0; y < CELL; y++) for (var x = 8; x < CELL; x++) {
        if (c.alphaAt(x, y)) c.px(x, y, P.dgy);
      }
      c.rect(4, 5, 2, 2, P.pk); c.outline();
    },
    heart_empty: function (c) { heartShape(c, P.dgy, P.dgy); c.outline(); },
    rupee: function (c) {
      c.poly([8, 1, 13, 5.5, 13, 10.5, 8, 15, 3, 10.5, 3, 5.5], P.g);
      c.poly([8, 1, 13, 5.5, 8, 8, 3, 5.5], P.lg);
      c.poly([8, 8, 13, 10.5, 8, 15, 3, 10.5], P.dg);
      c.outline();
    },
    key: function (c) {
      c.disc(5, 5, 3.2, P.au); c.disc(5, 5, 1.4, [0, 0, 0, 0]);
      for (var y = 3; y <= 7; y++) for (var x = 3; x <= 7; x++) {
        var dx = x - 5, dy = y - 5; if (dx * dx + dy * dy < 2.2) c.px(x, y, P.k, 0);
      }
      c.thickLine(7, 7, 12, 13, P.au, 2);
      c.rect(10, 12, 3, 2, P.au); c.rect(8, 9, 3, 2, P.au);
      c.outline();
    },
    bosskey: function (c) {
      c.disc(5, 5, 3.6, P.pu);
      for (var y = 2; y <= 8; y++) for (var x = 2; x <= 8; x++) {
        var dx = x - 5, dy = y - 5; if (dx * dx + dy * dy < 2.6) c.px(x, y, P.k, 0);
      }
      c.thickLine(7, 7, 13, 14, P.pu, 3);
      c.rect(10, 12, 4, 2, P.pu);
      c.px(5, 3, P.w); c.px(4, 3, P.w);
      c.outline();
    },
    map: function (c) {
      c.poly([1, 3, 6, 2, 11, 4, 15, 2, 15, 13, 11, 15, 6, 13, 1, 14], P.st);
      c.line(6, 2, 6, 13, P.mo); c.line(11, 4, 11, 15, P.mo);
      c.px(9, 8, P.r); c.px(8, 7, P.r); c.px(10, 9, P.r); c.px(10, 7, P.r); c.px(8, 9, P.r);
      c.outline();
    },
    compass: function (c) {
      c.disc(8, 8, 6.5, P.au); c.disc(8, 8, 5, P.w);
      c.poly([8, 3, 10, 8, 8, 13, 6, 8], P.r);
      c.poly([8, 8, 10, 8, 8, 13, 6, 8], P.b);
      c.outline();
    },
    bomb: function (c) {
      c.disc(7, 10, 5, [46, 48, 58]); c.disc(5.5, 8.5, 1.6, [110, 116, 130]);
      c.rect(6, 3, 3, 3, [70, 72, 84]);
      c.line(9, 3, 12, 1, P.br); c.px(12, 1, P.or); c.px(13, 0, P.y);
      c.outline();
    },
    bow: function (c) {
      var i;
      for (i = 0; i <= 14; i++) {
        var t = i / 14, a = (t - 0.5) * 2.3;
        c.px(4 + Math.cos(a) * 5, 1 + i, P.br);
        c.px(4 + Math.cos(a) * 5 + 1, 1 + i, P.dbr);
      }
      c.line(3, 1, 3, 15, P.st);
      c.thickLine(3, 8, 14, 8, P.lbr, 1); c.poly([14, 8, 10, 6, 10, 10], P.gy);
      c.outline();
    },
    arrow: function (c) {
      c.thickLine(2, 13, 12, 3, P.lbr, 1);
      c.poly([14, 1, 9, 3, 12, 6], P.gy);
      c.poly([2, 13, 5, 13, 2, 10], P.w);
      c.outline();
    },
    hookshot: function (c) {
      for (var i = 0; i < 4; i++) c.rect(2 + i * 3, 11 - i * 0, 2, 2, P.gy);
      c.thickLine(2, 12, 9, 5, P.dgy, 1);
      c.poly([9, 5, 13, 1, 12, 5], P.st); c.poly([9, 5, 13, 8, 10, 8], P.st);
      c.rect(1, 11, 4, 4, P.br);
      c.outline();
    },
    boomerang: function (c) {
      c.thickLine(2, 13, 8, 2, P.lbr, 3);
      c.thickLine(8, 2, 14, 11, P.lbr, 3);
      c.thickLine(3, 12, 8, 3, P.br, 1);
      c.outline();
    },
    lantern: function (c) {
      c.rect(4, 5, 8, 8, P.gy); c.rect(5, 6, 6, 6, [255, 230, 150]);
      c.poly([8, 7, 10, 11, 6, 11], P.or);
      c.rect(3, 3, 10, 2, P.dgy); c.line(8, 1, 8, 3, P.dgy);
      c.rect(4, 13, 8, 2, P.dgy);
      c.outline();
    },
    icerod: function (c) {
      c.thickLine(3, 14, 9, 6, P.mo, 2);
      c.poly([11, 1, 14, 6, 11, 11, 8, 6], P.cy);
      c.poly([11, 1, 14, 6, 11, 6], P.lb);
      c.rect(2, 12, 3, 3, P.b);
      c.outline();
    },
    lens: function (c) {
      c.disc(8, 7, 6, P.pu); c.disc(8, 7, 4.4, [190, 230, 255]);
      c.ellipse(8, 7, 3, 1.8, P.w); c.disc(8, 7, 1.4, P.k);
      c.thickLine(6, 12, 4, 15, P.au, 2);
      c.outline();
    },
    flute: function (c) {
      c.thickLine(2, 12, 14, 4, [232, 226, 206], 4);
      c.px(6, 9, P.k); c.px(8, 8, P.k); c.px(10, 7, P.k); c.px(12, 6, P.k);
      c.outline();
    },
    sword: function (c) {
      c.poly([12, 1, 14, 3, 6, 12, 4, 10], P.st);
      c.poly([12, 1, 13, 2, 5, 11, 4, 10], P.w);
      c.thickLine(3, 9, 6, 12, P.au, 3);
      c.thickLine(1, 13, 4, 10, P.br, 3);
      c.outline();
    },
    shield: function (c) {
      c.poly([8, 15, 2, 10, 2, 2, 14, 2, 14, 10], P.b);
      c.poly([8, 12, 4, 8.5, 4, 4, 12, 4, 12, 8.5], P.db);
      c.poly([8, 10, 6, 7, 8, 5, 10, 7], P.au);
      c.outline();
    },
    bottle: function (c) {
      c.rect(6, 1, 4, 3, P.br);
      c.poly([5, 5, 11, 5, 12, 8, 12, 15, 4, 15, 4, 8], [190, 220, 235, 140]);
      c.outline();
    },
    potion_red: function (c) {
      c.rect(6, 1, 4, 3, P.br);
      c.poly([5, 5, 11, 5, 12, 8, 12, 15, 4, 15, 4, 8], [190, 220, 235, 140]);
      c.poly([5, 9, 11, 9, 12, 15, 4, 15], P.r);
      c.outline();
    },
    potion_green: function (c) {
      c.rect(6, 1, 4, 3, P.br);
      c.poly([5, 5, 11, 5, 12, 8, 12, 15, 4, 15, 4, 8], [190, 220, 235, 140]);
      c.poly([5, 9, 11, 9, 12, 15, 4, 15], P.g);
      c.outline();
    },
    magic: function (c) {
      c.poly([8, 1, 11, 6, 14, 8, 11, 10, 8, 15, 5, 10, 2, 8, 5, 6], P.g);
      c.poly([8, 4, 10, 7.5, 8, 11, 6, 7.5], P.lg);
      c.outline();
    },
    mask_stone: function (c) {
      c.poly([3, 3, 13, 3, 14, 9, 8, 15, 2, 9], P.mo);
      c.rect(4, 6, 3, 2, P.k); c.rect(9, 6, 3, 2, P.k);
      c.line(5, 11, 11, 11, P.dgy);
      c.outline();
    },
    mask_hare: function (c) {
      c.ellipse(5, 4, 1.6, 3.4, P.w); c.ellipse(11, 4, 1.6, 3.4, P.w);
      c.ellipse(8, 10, 4.6, 4.4, P.w);
      c.rect(6, 9, 2, 2, P.r); c.rect(9, 9, 2, 2, P.r);
      c.px(8, 12, P.pk);
      c.outline();
    },
    mask_truth: function (c) {
      c.ellipse(8, 8, 6, 7, P.pu);
      c.ellipse(8, 7, 4, 3, P.w); c.disc(8, 7, 1.8, P.k);
      c.line(3, 13, 13, 13, P.dpu);
      c.outline();
    },
    star: function (c) {
      var pts = [], i;
      for (i = 0; i < 10; i++) {
        var a = -Math.PI / 2 + i * Math.PI / 5, r = (i % 2 === 0) ? 7 : 3;
        pts.push(8 + Math.cos(a) * r, 8 + Math.sin(a) * r);
      }
      c.poly(pts, P.y); c.outline();
    },
    heartpiece: function (c) {
      heartShape(c, P.dgy, P.dgy);
      /* only the lower-right quadrant is filled in */
      for (var y = 0; y < CELL; y++) for (var x = 0; x < CELL; x++) {
        if (c.alphaAt(x, y) && x >= 8 && y >= 8) c.px(x, y, P.r);
      }
      c.outline();
    },
    ore: function (c) {
      c.poly([3, 12, 2, 7, 6, 3, 11, 4, 14, 9, 11, 13], P.mo);
      c.px(6, 7, P.cy); c.px(7, 7, P.cy); c.px(9, 9, P.cy); c.px(6, 10, P.cy);
      c.outline();
    },
    letter: function (c) {
      c.rect(1, 4, 14, 9, P.st);
      c.line(1, 4, 8, 9, P.mo); c.line(15, 4, 8, 9, P.mo);
      c.disc(12, 11, 2, P.r);
      c.outline();
    },
    hammer: function (c) {
      c.rect(3, 2, 10, 5, P.mo); c.rect(4, 3, 3, 3, [160, 168, 180]);
      c.thickLine(8, 7, 8, 15, P.br, 3);
      c.outline();
    },
    mirror: function (c) {
      c.ellipse(8, 6, 5.5, 5, P.lb); c.ellipse(8, 6, 4, 3.6, P.w);
      c.thickLine(8, 11, 8, 15, P.au, 3);
      c.outline();
    },
    clockface: function (c) {
      c.disc(8, 8, 7, P.st); c.disc(8, 8, 5.6, P.w);
      c.line(8, 8, 8, 4, P.k); c.line(8, 8, 11, 9, P.k);
      c.outline();
    },
    skull: function (c) {
      c.ellipse(8, 7, 5, 5, P.st);
      c.rect(5, 6, 2, 3, P.k); c.rect(9, 6, 2, 3, P.k);
      c.rect(5, 12, 6, 3, P.st); c.line(7, 12, 7, 14, P.k); c.line(9, 12, 9, 14, P.k);
      c.outline();
    },
    cursor: function (c) {
      c.poly([2, 1, 2, 12, 5, 9, 7, 14, 9, 13, 7, 8, 11, 8], P.w);
      c.outline();
    },
    quiver: function (c) {
      c.poly([5, 5, 11, 5, 10, 15, 6, 15], P.br);
      c.line(6, 1, 6, 5, P.st); c.line(8, 1, 8, 5, P.st); c.line(10, 1, 10, 5, P.st);
      c.px(6, 1, P.w); c.px(8, 1, P.w); c.px(10, 1, P.w);
      c.outline();
    },
    bombbag: function (c) {
      c.ellipse(8, 10, 6, 5.4, P.br); c.rect(6, 3, 4, 3, P.dbr);
      c.px(6, 9, P.lbr); c.px(7, 8, P.lbr);
      c.outline();
    },
    wallet: function (c) {
      c.rect(2, 5, 12, 9, P.br); c.rect(2, 5, 12, 2, P.dbr);
      c.disc(11, 10, 1.6, P.au);
      c.outline();
    },
    fairy: function (c) {
      c.ellipse(8, 8, 2, 3, [255, 236, 180]);
      c.poly([8, 6, 2, 2, 3, 8], [180, 240, 255, 190]);
      c.poly([8, 6, 14, 2, 13, 8], [180, 240, 255, 190]);
      c.outline();
    },
    fish: function (c) {
      c.ellipse(7, 8, 5, 3.2, P.lb);
      c.poly([12, 8, 15, 5, 15, 11], P.b);
      c.px(4, 7, P.k);
      c.outline();
    },
    seed: function (c) {
      c.ellipse(8, 9, 4, 5, P.dg); c.line(8, 4, 8, 1, P.g);
      c.outline();
    },
    note: function (c) {
      c.disc(5, 12, 2.6, P.b); c.rect(7, 3, 2, 10, P.b); c.poly([9, 3, 14, 5, 14, 8, 9, 6], P.b);
      c.outline();
    },
    lock: function (c) {
      c.rect(3, 7, 10, 8, P.au);
      for (var i = 0; i < 5; i++) c.px(5 + i, 5, P.gy);
      c.line(5, 3, 5, 7, P.gy); c.line(10, 3, 10, 7, P.gy); c.line(5, 3, 10, 3, P.gy);
      c.rect(7, 10, 2, 3, P.k);
      c.outline();
    },
    eye: function (c) {
      c.ellipse(8, 8, 7, 4.4, P.w); c.disc(8, 8, 3, P.b); c.disc(8, 8, 1.4, P.k);
      c.outline();
    },
    hourglass: function (c) {
      c.poly([3, 1, 13, 1, 9, 8, 13, 15, 3, 15, 7, 8], P.au);
      c.poly([5, 3, 11, 3, 8, 7], P.cy);
      c.poly([8, 9, 11, 13, 5, 13], P.cy);
      c.outline();
    }
  };

  function build(Tex) {
    var atlas = new Tex.Tile(COLS * CELL, ROWS * CELL);
    var names = Object.keys(ICONS);
    var uv = {};
    for (var i = 0; i < names.length && i < COLS * ROWS; i++) {
      var cell = new Cell();
      ICONS[names[i]](cell);
      var ox = (i % COLS) * CELL, oy = Math.floor(i / COLS) * CELL;
      for (var y = 0; y < CELL; y++) {
        for (var x = 0; x < CELL; x++) {
          var k = (y * CELL + x) * 4;
          atlas.set(ox + x, oy + y, cell.d[k], cell.d[k + 1], cell.d[k + 2], cell.d[k + 3]);
        }
      }
      uv[names[i]] = [ox / atlas.w, oy / atlas.h, CELL / atlas.w, CELL / atlas.h];
    }
    return { tile: atlas, uv: uv, cell: CELL, names: names };
  }

  LZ.Icons = { build: build, Cell: Cell, palette: P, list: ICONS };
})(LZ);
