/* =============================================================
   game/effects.js -- transient visual flourishes: sword trails,
   impact flashes, glows, target markers.

   These are drawn as unlit additive quads, which is what the RDP was
   good at and what every effect of the era actually was.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var M = LZ.M, V3 = LZ.V3, M4 = LZ.M4;

  function Effects(game) {
    this.g = game;
    this.list = [];
    this._m = M4.create();
  }

  Effects.prototype.clear = function () { this.list.length = 0; };

  Effects.prototype._add = function (o) {
    if (this.list.length > 120) this.list.shift();
    o.t = 0;
    this.list.push(o);
    return o;
  };

  /* ---- one-shot effects ---- */
  Effects.prototype.slash = function (x, y, z, yaw, size, color, big) {
    this._add({
      kind: 'slash', x: x, y: y, z: z, yaw: yaw, size: size,
      life: big ? 0.30 : 0.20, color: color || [1, 1, 1], big: !!big,
      roll: big ? 0 : (Math.random() < 0.5 ? -0.5 : 0.5)
    });
  };
  Effects.prototype.impact = function (x, y, z, metal) {
    this._add({ kind: 'flash', x: x, y: y, z: z, life: 0.18, size: metal ? 0.9 : 1.2,
      color: metal ? [1, 0.95, 0.7] : [1, 0.8, 0.55] });
    this.g.particles.emit('spark', x, y, z, metal ? 9 : 6, metal ? [1, 0.95, 0.6, 1] : [1, 0.7, 0.4, 1], metal ? 5 : 3.4);
  };
  Effects.prototype.burst = function (x, y, z, color) {
    this._add({ kind: 'flash', x: x, y: y, z: z, life: 0.32, size: 2.4, color: color || [1, 0.85, 0.5] });
    this.g.particles.emit('blast', x, y, z, 14, [(color || [1])[0], (color || [1, 0.8])[1], (color || [1, 0.8, 0.5])[2], 1]);
  };
  Effects.prototype.ring = function (x, y, z, color, size) {
    this._add({ kind: 'ring', x: x, y: y, z: z, life: 0.42, size: size || 3, color: color || [1, 1, 1, 0.8] });
  };
  Effects.prototype.spinRing = function (x, y, z) {
    this._add({ kind: 'ring', x: x, y: y, z: z, life: 0.5, size: 4.2, color: [0.7, 0.9, 1, 0.9] });
  };
  Effects.prototype.puff = function (x, y, z) {
    this.g.particles.emit('smoke', x, y, z, 6, [0.55, 0.5, 0.62, 0.7], 1.4);
    this._add({ kind: 'flash', x: x, y: y, z: z, life: 0.2, size: 1.4, color: [0.7, 0.6, 0.9] });
  };
  Effects.prototype.heal = function (x, y, z) {
    this.g.particles.emit('magic', x, y, z, 12, [1, 0.5, 0.6, 1], 0.5);
    this._add({ kind: 'ring', x: x, y: y - 0.6, z: z, life: 0.5, size: 2.0, color: [1, 0.5, 0.6, 0.8] });
  };
  Effects.prototype.fairyRevive = function (x, y, z) {
    this.g.particles.emit('magic', x, y, z, 26, [0.7, 1, 0.9, 1], 0.9);
    this._add({ kind: 'ring', x: x, y: y - 0.7, z: z, life: 0.9, size: 4.5, color: [0.7, 1, 0.95, 0.9] });
    this._add({ kind: 'flash', x: x, y: y, z: z, life: 0.6, size: 3.0, color: [0.8, 1, 0.95] });
  };
  Effects.prototype.shatter = function (x, y, z, style) {
    var col = style === 'skull' ? [0.9, 0.88, 0.78, 1] : (style === 'crate' ? [0.75, 0.6, 0.4, 1] : [0.82, 0.72, 0.6, 1]);
    this.g.particles.emit('dust', x, y, z, 10, 1.6, col);
    this.g.particles.emit('spark', x, y, z, 5, col, 3);
  };
  Effects.prototype.note = function (x, y, z) {
    this.g.particles.emit('magic', x, y, z, 4, [0.7, 0.85, 1, 1], 0.25);
  };
  Effects.prototype.explosion = function (x, y, z, radius) {
    this._add({ kind: 'flash', x: x, y: y, z: z, life: 0.42, size: radius * 2.2, color: [1, 0.9, 0.6] });
    this._add({ kind: 'ring', x: x, y: y - radius * 0.4, z: z, life: 0.5, size: radius * 3, color: [1, 0.7, 0.3, 0.9] });
    this.g.particles.emit('blast', x, y, z, 22, [1, 0.8, 0.4, 1]);
    this.g.particles.emit('smoke', x, y, z, 9, [0.3, 0.28, 0.3, 0.7], 2.2);
  };

  /* ---- persistent per-frame markers (re-issued each frame) ---- */
  Effects.prototype.pointLight = function (x, y, z, color, radius) {
    this._add({ kind: 'glow', x: x, y: y, z: z, life: 0.02, size: radius, color: color, frame: true, alpha: 0.22 });
  };
  Effects.prototype.flame = function (x, y, z, size) {
    this._add({ kind: 'flame', x: x, y: y, z: z, life: 0.02, size: size, frame: true });
  };
  Effects.prototype.chestGlow = function (x, y, z, big) {
    this._add({ kind: 'glow', x: x, y: y + 0.30, z: z, life: 0.02, size: big ? 0.62 : 0.40,
      color: big ? [1, 0.80, 0.30] : [1, 0.92, 0.55], frame: true, pulse: true });
  };
  Effects.prototype.lockIcon = function (x, y, z, boss) {
    this._add({ kind: 'glow', x: x, y: y, z: z, life: 0.02, size: 0.7,
      color: boss ? [0.8, 0.4, 1] : [1, 0.85, 0.4], frame: true, pulse: true });
  };
  Effects.prototype.hookTarget = function (x, y, z) {
    this._add({ kind: 'marker', x: x, y: y, z: z, life: 0.02, size: 0.6, color: [0.6, 0.9, 1], frame: true });
  };
  Effects.prototype.boomTarget = function (x, y, z) {
    this._add({ kind: 'marker', x: x, y: y, z: z, life: 0.02, size: 0.6, color: [0.7, 1, 0.6], frame: true });
  };
  Effects.prototype.iceTarget = function (x, y, z) {
    this._add({ kind: 'marker', x: x, y: y, z: z, life: 0.02, size: 0.6, color: [0.7, 0.9, 1], frame: true });
  };

  Effects.prototype.update = function (dt) {
    for (var i = this.list.length - 1; i >= 0; i--) {
      var e = this.list[i];
      e.t += dt;
      if (e.t >= e.life) this.list.splice(i, 1);
    }
  };

  /* Effects are batched per material into one dynamic mesh each. A torch-lit
     dungeon otherwise costs a draw call per flame, which is exactly the kind
     of thing the hardware this is imitating could not afford either. */
  var FPV = LZ.GL.FLOATS_PER_VERT;
  Effects.prototype._buf = function (name, quads) {
    if (!this.bufs) this.bufs = {};
    var b = this.bufs[name];
    var need = Math.max(32, quads);
    if (!b || b.cap < need) {
      b = this.bufs[name] = { cap: need * 2, v: new Float32Array(need * 2 * 4 * FPV), i: null, mesh: null, n: 0 };
      b.i = new Uint16Array(b.cap * 6);
      for (var q = 0; q < b.cap; q++) {
        b.i[q * 6] = q * 4; b.i[q * 6 + 1] = q * 4 + 1; b.i[q * 6 + 2] = q * 4 + 2;
        b.i[q * 6 + 3] = q * 4; b.i[q * 6 + 4] = q * 4 + 2; b.i[q * 6 + 5] = q * 4 + 3;
      }
    }
    return b;
  };

  Effects.prototype.draw = function (g) {
    var r = g.r, a = g.assets, i;
    if (!this.list.length) return;

    /* camera basis for billboards */
    var v = r.view;
    var rx = v[0], ry = v[4], rz = v[8];
    var ux = v[1], uy = v[5], uz = v[9];

    var counts = {};
    for (i = 0; i < this.list.length; i++) {
      var mn = MAT_FOR[this.list[i].kind] || 'glow';
      counts[mn] = (counts[mn] || 0) + 1;
    }
    for (var matName in counts) {
      var b = this._buf(matName, counts[matName]);
      b.n = 0;
      var vo = 0;
      for (i = 0; i < this.list.length; i++) {
        var e = this.list[i];
        if ((MAT_FOR[e.kind] || 'glow') !== matName) continue;
        var t = M.saturate(e.t / e.life);
        var size, alpha, cr, cg, cb;
        var ax, ay, az, bx, by, bz;   /* the quad's two half-axes */
        var col = e.color || [1, 1, 1];
        cr = col[0]; cg = col[1]; cb = col[2];

        if (e.kind === 'ring') {
          size = e.size * M.ease.outCubic(t);
          alpha = (1 - t) * (col[3] === undefined ? 0.8 : col[3]);
          ax = size; ay = 0; az = 0;
          bx = 0; by = 0; bz = size;
        } else {
          if (e.kind === 'slash') { size = e.size * (0.7 + t * 0.6); alpha = (1 - t) * 0.95; }
          else if (e.kind === 'flash') { size = e.size * (0.5 + t * 1.6); alpha = (1 - t) * 0.9; }
          else if (e.kind === 'glow') { size = e.size * (e.pulse ? (1 + Math.sin(g.time * 4) * 0.13) : 1); alpha = e.alpha === undefined ? 0.30 : e.alpha; }
          else if (e.kind === 'flame') { size = e.size * (1 + Math.sin(g.time * 15 + e.x) * 0.14); alpha = 0.95; }
          else { size = e.size * (1 + Math.sin(g.time * 5) * 0.16); alpha = 0.75; }
          var rot = (e.kind === 'slash') ? (e.yaw !== undefined ? 0 : 0) : 0;
          ax = rx * size; ay = ry * size; az = rz * size;
          bx = ux * size; by = uy * size; bz = uz * size;
        }
        var ex = e.x, ey = e.y, ez = e.z;
        if (e.kind === 'marker') ey += Math.sin(g.time * 2.4) * 0.1;

        var vv = b.v;
        function put(sx, sy, u, vt) {
          vv[vo] = ex + ax * sx + bx * sy;
          vv[vo + 1] = ey + ay * sx + by * sy;
          vv[vo + 2] = ez + az * sx + bz * sy;
          vv[vo + 3] = 0; vv[vo + 4] = 1; vv[vo + 5] = 0;
          vv[vo + 6] = u; vv[vo + 7] = vt;
          vv[vo + 8] = cr; vv[vo + 9] = cg; vv[vo + 10] = cb; vv[vo + 11] = alpha;
          vo += FPV;
        }
        put(-1, -1, 0, 1); put(1, -1, 1, 1); put(1, 1, 1, 0); put(-1, 1, 0, 0);
        b.n++;
      }
      if (!b.n) continue;
      if (!b.mesh) b.mesh = r.createMesh(b.v, b.i, true);
      var gl = r.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, b.mesh.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, b.v.subarray(0, vo), gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.mesh.ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, b.i.subarray(0, b.n * 6), gl.DYNAMIC_DRAW);
      b.mesh.count = b.n * 6;
      b.mesh.indexType = gl.UNSIGNED_SHORT;
      r.submit(b.mesh, IDENTITY, a.mat[matName] || a.mat.glow);
    }
  };

  var IDENTITY = M4.create();
  var MAT_FOR = {
    slash: 'slash', flash: 'glow', ring: 'ring', glow: 'glow', flame: 'flame', marker: 'ring'
  };

  LZ.Effects = Effects;
})(LZ);
