/* =============================================================
   render/sprite.js -- 2D batcher for HUD, text boxes and menus.
   Everything is drawn into the same 320x240 framebuffer as the world,
   so UI pixels are exactly as chunky as game pixels.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var M = LZ.M, M4 = LZ.M4, GL = LZ.GL;
  var FPV = GL.FLOATS_PER_VERT;

  function UI(renderer, assets) {
    this.r = renderer;
    this.a = assets;
    this.verts = new Float32Array(FPV * 4 * 2048);
    this.idx = new Uint16Array(6 * 2048);
    this.vc = 0; this.ic = 0;
    this.mesh = renderer.createMesh(new Float32Array(FPV * 4), [0, 1, 2], true);
    this.tex = null;
    this.ortho = M4.create();
    this.model = M4.create();
    this.mat = GL.material({
      lit: false, fog: false, blend: 'alpha', depthTest: false, depthWrite: false,
      cull: 'none', filter3Point: false, dither: false
    });
    this.alpha = 1;
    this.scale = 1;
  }

  UI.prototype.begin = function () {
    this.vc = 0; this.ic = 0; this.tex = null;
    M4.ortho(this.ortho, 0, this.r.width, this.r.height, 0, -1, 1);
  };

  UI.prototype._need = function (tex) {
    if (this.tex !== tex && this.vc > 0) this.flush();
    this.tex = tex;
    if (this.vc + 4 > 2048 * 4) this.flush();
  };

  UI.prototype.flush = function () {
    if (this.vc === 0) { return; }
    var gl = this.r.gl;
    var sub = this.verts.subarray(0, this.vc * FPV);
    var isub = this.idx.subarray(0, this.ic);
    /* upload */
    gl.bindBuffer(gl.ARRAY_BUFFER, this.mesh.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, sub, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.mesh.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, isub, gl.DYNAMIC_DRAW);
    this.mesh.count = this.ic;
    this.mesh.indexType = gl.UNSIGNED_SHORT;
    this.mat.texture = this.tex;
    this.r.drawOverlay(this.mesh, this.mat, this.ortho);
    this.vc = 0; this.ic = 0;
  };

  UI.prototype.end = function () { this.flush(); };

  var WHITE = [1, 1, 1, 1];
  UI.prototype.quad = function (tex, x, y, w, h, u0, v0, u1, v1, col) {
    this._need(tex);
    var c = col || WHITE;
    var a = c[3] === undefined ? 1 : c[3];
    a *= this.alpha;
    var v = this.verts, o = this.vc * FPV;
    function put(px, py, u, vv) {
      v[o] = px; v[o + 1] = py; v[o + 2] = 0;
      v[o + 3] = 0; v[o + 4] = 0; v[o + 5] = 1;
      v[o + 6] = u; v[o + 7] = vv;
      v[o + 8] = c[0]; v[o + 9] = c[1]; v[o + 10] = c[2]; v[o + 11] = a;
      o += FPV;
    }
    put(x, y, u0, v0);
    put(x + w, y, u1, v0);
    put(x + w, y + h, u1, v1);
    put(x, y + h, u0, v1);
    var b = this.vc;
    this.idx[this.ic++] = b; this.idx[this.ic++] = b + 1; this.idx[this.ic++] = b + 2;
    this.idx[this.ic++] = b; this.idx[this.ic++] = b + 2; this.idx[this.ic++] = b + 3;
    this.vc += 4;
  };

  UI.prototype.rect = function (x, y, w, h, col) {
    this.quad(this.a.texWhite, x, y, w, h, 0.25, 0.25, 0.75, 0.75, col);
  };
  UI.prototype.frame = function (x, y, w, h, t, col) {
    t = t || 1;
    this.rect(x, y, w, t, col); this.rect(x, y + h - t, w, t, col);
    this.rect(x, y + t, t, h - t * 2, col); this.rect(x + w - t, y + t, t, h - t * 2, col);
  };

  /* the classic Zelda message frame: dark blue plate, light bevel */
  UI.prototype.panel = function (x, y, w, h, style) {
    style = style || 'msg';
    var body, edge, hi;
    if (style === 'msg') { body = [0.055, 0.07, 0.22, 0.86]; edge = [0.85, 0.88, 1.0, 1]; hi = [0.28, 0.33, 0.6, 1]; }
    else if (style === 'menu') { body = [0.09, 0.09, 0.12, 0.94]; edge = [0.92, 0.86, 0.58, 1]; hi = [0.35, 0.3, 0.22, 1]; }
    else if (style === 'dark') { body = [0.02, 0.02, 0.04, 0.92]; edge = [0.5, 0.5, 0.58, 1]; hi = [0.16, 0.16, 0.2, 1]; }
    else { body = [0.1, 0.06, 0.02, 0.9]; edge = [0.95, 0.8, 0.4, 1]; hi = [0.4, 0.26, 0.1, 1]; }
    this.rect(x, y, w, h, body);
    this.frame(x, y, w, h, 1, edge);
    this.frame(x + 2, y + 2, w - 4, h - 4, 1, hi);
  };

  /* ---------------- text ---------------- */
  UI.prototype.charWidth = function (ch) {
    var f = this.a.font;
    var wv = f.widths[ch];
    return (wv === undefined ? f.widths['?'] : wv);
  };
  UI.prototype.measure = function (s) {
    var w = 0;
    for (var i = 0; i < s.length; i++) {
      if (s.charAt(i) === '\n') continue;
      w += this.charWidth(s.charAt(i));
    }
    return w;
  };
  /* draw a single line; returns advance width */
  UI.prototype.text = function (s, x, y, col, opts) {
    opts = opts || {};
    var f = this.a.font, sc = opts.scale || 1;
    var sx = x;
    if (opts.shadow !== false) {
      /* one-pixel drop shadow keeps text readable over any background */
      var sh = opts.shadowColor || [0, 0, 0, (col && col[3] !== undefined ? col[3] : 1) * 0.85];
      this._textRun(s, x + sc, y + sc, sh, sc);
    }
    this._textRun(s, x, y, col || WHITE, sc);
    for (var i = 0; i < s.length; i++) sx += this.charWidth(s.charAt(i)) * sc;
    return sx - x;
  };
  UI.prototype._textRun = function (s, x, y, col, sc) {
    var f = this.a.font;
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      var uv = f.uvs[ch];
      if (!uv) { uv = f.uvs['?']; }
      if (ch !== ' ') {
        this.quad(this.a.texFont, x, y, f.cell * sc, f.cell * sc,
          uv[0], uv[1], uv[0] + uv[2], uv[1] + uv[3], col);
      }
      x += this.charWidth(ch) * sc;
    }
  };

  UI.prototype.textCentered = function (s, cx, y, col, opts) {
    var sc = (opts && opts.scale) || 1;
    return this.text(s, Math.round(cx - this.measure(s) * sc / 2), y, col, opts);
  };
  UI.prototype.textRight = function (s, rx, y, col, opts) {
    var sc = (opts && opts.scale) || 1;
    return this.text(s, Math.round(rx - this.measure(s) * sc), y, col, opts);
  };

  /* greedy word wrap into an array of lines */
  UI.prototype.wrap = function (s, maxW, scale) {
    scale = scale || 1;
    var out = [], paras = s.split('\n');
    for (var p = 0; p < paras.length; p++) {
      var words = paras[p].split(' ');
      var line = '';
      for (var i = 0; i < words.length; i++) {
        var test = line ? line + ' ' + words[i] : words[i];
        if (this.measure(test) * scale > maxW && line) { out.push(line); line = words[i]; }
        else line = test;
      }
      out.push(line);
    }
    return out;
  };

  /* a filled circle -- the round A/B/C buttons of the era */
  UI.prototype.disc = function (cx, cy, r, col) {
    this.quad(this.a.tex.dotHard, cx - r, cy - r, r * 2, r * 2, 0.02, 0.02, 0.98, 0.98, col);
  };
  UI.prototype.discOutline = function (cx, cy, r, col) {
    this.quad(this.a.tex.ring, cx - r, cy - r, r * 2, r * 2, 0, 0, 1, 1, col);
  };

  /* ---------------- icons ---------------- */
  UI.prototype.icon = function (name, x, y, size, col) {
    var uv = this.a.iconUV[name];
    if (!uv) return;
    size = size || 16;
    this.quad(this.a.texIcons, x, y, size, size, uv[0], uv[1], uv[0] + uv[2], uv[1] + uv[3], col);
  };

  /* full-screen colour wash inside the low-res buffer (before CRT pass) */
  UI.prototype.wash = function (col) {
    this.rect(0, 0, this.r.width, this.r.height, col);
  };

  LZ.UI = UI;
})(LZ);
