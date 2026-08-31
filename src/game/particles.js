/* =============================================================
   game/particles.js -- CPU particle system, camera-facing quads
   batched into one dynamic mesh per material.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var M = LZ.M, V3 = LZ.V3, M4 = LZ.M4, GL = LZ.GL;
  var FPV = GL.FLOATS_PER_VERT;

  var MAX = 900;

  function Particles(renderer, assets) {
    this.r = renderer;
    this.a = assets;
    this.pool = [];
    this.free = [];
    for (var i = 0; i < MAX; i++) {
      var p = {
        alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
        gx: 0, gy: 0, gz: 0, drag: 0,
        age: 0, life: 1, size0: 1, size1: 1,
        c0: [1, 1, 1, 1], c1: [1, 1, 1, 0], mat: 'particle',
        rot: 0, spin: 0, stretch: 0, ground: 0, flat: false
      };
      this.pool.push(p); this.free.push(p);
    }
    this.batches = {};
    this._buf = {};
  }

  Particles.prototype.clear = function () {
    for (var i = 0; i < this.pool.length; i++) this.pool[i].alive = false;
    this.free.length = 0;
    for (var j = 0; j < this.pool.length; j++) this.free.push(this.pool[j]);
  };

  Particles.prototype.spawn = function (o) {
    var p = this.free.pop();
    if (!p) return null;
    p.alive = true;
    p.x = o.x || 0; p.y = o.y || 0; p.z = o.z || 0;
    p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
    p.gx = o.gx || 0; p.gy = o.gy === undefined ? 0 : o.gy; p.gz = o.gz || 0;
    p.drag = o.drag || 0;
    p.age = 0; p.life = o.life || 0.6;
    p.size0 = o.size0 === undefined ? 0.2 : o.size0;
    p.size1 = o.size1 === undefined ? p.size0 : o.size1;
    p.c0 = o.c0 || [1, 1, 1, 1];
    p.c1 = o.c1 || [p.c0[0], p.c0[1], p.c0[2], 0];
    p.mat = o.mat || 'particle';
    p.rot = o.rot === undefined ? Math.random() * M.TAU : o.rot;
    p.spin = o.spin || 0;
    p.stretch = o.stretch || 0;
    p.ground = o.ground || 0;
    p.flat = !!o.flat;
    return p;
  };

  Particles.prototype.update = function (dt, world) {
    for (var i = 0; i < this.pool.length; i++) {
      var p = this.pool[i];
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= p.life) { p.alive = false; this.free.push(p); continue; }
      if (p.drag) {
        var d = Math.exp(-p.drag * dt);
        p.vx *= d; p.vy *= d; p.vz *= d;
      }
      p.vx += p.gx * dt; p.vy += p.gy * dt; p.vz += p.gz * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rot += p.spin * dt;
      if (p.ground && world) {
        var h = world.groundHeight(p.x, p.z);
        if (p.y < h + 0.02) {
          p.y = h + 0.02;
          if (p.ground === 1) { p.vy = 0; p.vx *= 0.6; p.vz *= 0.6; }
          else { p.vy = Math.abs(p.vy) * 0.35; p.vx *= 0.7; p.vz *= 0.7; }
        }
      }
    }
  };

  /* ---- emitters ---- */
  var Emit = {};
  Emit.dust = function (ps, x, y, z, n, spread, col) {
    n = n || 5;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * M.TAU, s = (spread || 0.7) * (0.4 + Math.random() * 0.8);
      ps.spawn({
        x: x + (Math.random() - 0.5) * 0.2, y: y + Math.random() * 0.1, z: z + (Math.random() - 0.5) * 0.2,
        vx: Math.cos(a) * s, vy: 0.5 + Math.random() * 0.7, vz: Math.sin(a) * s,
        gy: -1.6, drag: 2.2, life: 0.4 + Math.random() * 0.35,
        size0: 0.11, size1: 0.30,
        c0: col || [0.72, 0.66, 0.54, 0.75], c1: (col ? [col[0], col[1], col[2], 0] : [0.72, 0.66, 0.54, 0]),
        mat: 'particle'
      });
    }
  };
  Emit.spark = function (ps, x, y, z, n, col, speed) {
    n = n || 8;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * M.TAU, e = Math.random() * 1.2 - 0.1;
      var s = (speed || 4) * (0.5 + Math.random());
      ps.spawn({
        x: x, y: y, z: z,
        vx: Math.cos(a) * Math.cos(e) * s, vy: Math.sin(e) * s + 1.2, vz: Math.sin(a) * Math.cos(e) * s,
        gy: -7, drag: 1.1, life: 0.28 + Math.random() * 0.3,
        size0: 0.13, size1: 0.02,
        c0: col || [1, 0.94, 0.6, 1], c1: col ? [col[0], col[1] * 0.5, 0, 0] : [1, 0.4, 0.1, 0],
        mat: 'spark', stretch: 0.5
      });
    }
  };
  Emit.smoke = function (ps, x, y, z, n, col, rise) {
    n = n || 4;
    for (var i = 0; i < n; i++) {
      ps.spawn({
        x: x + (Math.random() - 0.5) * 0.3, y: y, z: z + (Math.random() - 0.5) * 0.3,
        vx: (Math.random() - 0.5) * 0.5, vy: (rise || 1.1) * (0.7 + Math.random() * 0.6), vz: (Math.random() - 0.5) * 0.5,
        gy: 0.25, drag: 1.0, life: 0.9 + Math.random() * 0.8,
        size0: 0.24, size1: 0.95,
        c0: col || [0.3, 0.3, 0.34, 0.55], c1: col ? [col[0], col[1], col[2], 0] : [0.5, 0.5, 0.55, 0],
        mat: 'glowSoft', spin: (Math.random() - 0.5) * 2
      });
    }
  };
  Emit.fire = function (ps, x, y, z, n) {
    n = n || 3;
    for (var i = 0; i < n; i++) {
      ps.spawn({
        x: x + (Math.random() - 0.5) * 0.22, y: y, z: z + (Math.random() - 0.5) * 0.22,
        vx: (Math.random() - 0.5) * 0.5, vy: 1.6 + Math.random() * 1.4, vz: (Math.random() - 0.5) * 0.5,
        gy: 0.9, drag: 1.6, life: 0.35 + Math.random() * 0.3,
        size0: 0.32, size1: 0.06,
        c0: [1, 0.78, 0.30, 0.95], c1: [0.9, 0.18, 0.05, 0],
        mat: 'glow'
      });
    }
  };
  Emit.splash = function (ps, x, y, z, n, col) {
    n = n || 10;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * M.TAU, s = 1.2 + Math.random() * 2.2;
      ps.spawn({
        x: x, y: y, z: z,
        vx: Math.cos(a) * s, vy: 2.2 + Math.random() * 2.4, vz: Math.sin(a) * s,
        gy: -9.5, drag: 0.3, life: 0.45 + Math.random() * 0.3,
        size0: 0.10, size1: 0.05,
        c0: col || [0.72, 0.86, 0.98, 0.9], c1: col ? [col[0], col[1], col[2], 0] : [0.6, 0.8, 0.95, 0],
        mat: 'particle'
      });
    }
  };
  Emit.magic = function (ps, x, y, z, n, col, radius) {
    n = n || 8; radius = radius || 0.4;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * M.TAU;
      ps.spawn({
        x: x + Math.cos(a) * radius, y: y + (Math.random() - 0.3) * 0.5, z: z + Math.sin(a) * radius,
        vx: -Math.cos(a) * 0.6, vy: 1.0 + Math.random() * 0.9, vz: -Math.sin(a) * 0.6,
        drag: 1.2, life: 0.6 + Math.random() * 0.5,
        size0: 0.16, size1: 0.02,
        c0: col || [0.6, 1, 0.8, 1], c1: col ? [col[0], col[1], col[2], 0] : [0.2, 0.7, 0.5, 0],
        mat: 'spark'
      });
    }
  };
  Emit.dark = function (ps, x, y, z, n, radius) {
    n = n || 6; radius = radius || 0.5;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * M.TAU;
      ps.spawn({
        x: x + Math.cos(a) * radius, y: y + Math.random() * 0.9, z: z + Math.sin(a) * radius,
        vx: Math.cos(a) * 0.35, vy: 0.5 + Math.random() * 0.8, vz: Math.sin(a) * 0.35,
        drag: 1.0, life: 0.7 + Math.random() * 0.6,
        size0: 0.42, size1: 0.06,
        c0: [0.42, 0.10, 0.55, 0.85], c1: [0.10, 0.02, 0.18, 0],
        mat: 'glowSoft', spin: (Math.random() - 0.5) * 4
      });
    }
  };
  Emit.leaf = function (ps, x, y, z, n, col) {
    n = n || 4;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * M.TAU;
      ps.spawn({
        x: x + (Math.random() - 0.5) * 0.8, y: y + Math.random() * 0.6, z: z + (Math.random() - 0.5) * 0.8,
        vx: Math.cos(a) * 0.7, vy: 0.5 + Math.random() * 0.6, vz: Math.sin(a) * 0.7,
        gy: -1.1, drag: 1.4, life: 1.1 + Math.random() * 0.8,
        size0: 0.13, size1: 0.10,
        c0: col || [0.42, 0.68, 0.32, 1], c1: col ? [col[0] * 0.6, col[1] * 0.6, col[2] * 0.6, 0] : [0.3, 0.5, 0.2, 0],
        mat: 'particle', spin: (Math.random() - 0.5) * 8
      });
    }
  };
  Emit.ring = function (ps, x, y, z, col, size, life, mat) {
    ps.spawn({
      x: x, y: y, z: z, life: life || 0.35,
      size0: 0.2, size1: size || 3.2,
      c0: col || [1, 1, 1, 0.8], c1: [(col || [1])[0], (col || [1, 1])[1], (col || [1, 1, 1])[2], 0],
      mat: mat || 'ring', flat: true
    });
  };
  Emit.blast = function (ps, x, y, z, n, col) {
    n = n || 16;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * M.TAU, e = Math.random() * 0.9;
      var s = 3.5 + Math.random() * 5;
      ps.spawn({
        x: x, y: y, z: z,
        vx: Math.cos(a) * Math.cos(e) * s, vy: Math.sin(e) * s, vz: Math.sin(a) * Math.cos(e) * s,
        gy: -5, drag: 2.4, life: 0.4 + Math.random() * 0.4,
        size0: 0.5, size1: 0.06,
        c0: col || [1, 0.85, 0.45, 1], c1: [0.4, 0.1, 0.05, 0],
        mat: 'glow'
      });
    }
  };
  Emit.essence = function (ps, x, y, z, n) {
    /* enemies dissolve into motes rather than gore */
    n = n || 12;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * M.TAU;
      ps.spawn({
        x: x + (Math.random() - 0.5) * 0.5, y: y + Math.random() * 0.7, z: z + (Math.random() - 0.5) * 0.5,
        vx: Math.cos(a) * 1.2, vy: 1.4 + Math.random() * 1.6, vz: Math.sin(a) * 1.2,
        gy: -2.0, drag: 1.6, life: 0.5 + Math.random() * 0.5,
        size0: 0.20, size1: 0.02,
        c0: [0.28, 0.14, 0.34, 0.95], c1: [0.1, 0.05, 0.16, 0],
        mat: 'glowSoft'
      });
    }
  };

  Particles.prototype.emit = function (kind) {
    var f = Emit[kind];
    if (!f) return;
    var args = Array.prototype.slice.call(arguments, 1);
    args.unshift(this);
    f.apply(null, args);
  };

  /* ---- rendering ---- */
  var _right = V3.create(1, 0, 0), _up = V3.create(0, 1, 0), _fwd = V3.create(0, 0, 1);
  Particles.prototype.render = function (renderer) {
    var view = renderer.view;
    /* camera basis from the view matrix rows */
    _right[0] = view[0]; _right[1] = view[4]; _right[2] = view[8];
    _up[0] = view[1]; _up[1] = view[5]; _up[2] = view[9];

    var counts = {};
    var i, p;
    for (i = 0; i < this.pool.length; i++) {
      p = this.pool[i];
      if (p.alive) counts[p.mat] = (counts[p.mat] || 0) + 1;
    }
    for (var matName in counts) {
      var n = counts[matName];
      var b = this._buf[matName];
      if (!b || b.v.length < n * 4 * FPV) {
        b = this._buf[matName] = {
          v: new Float32Array(Math.max(64, n * 2) * 4 * FPV),
          i: new Uint16Array(Math.max(64, n * 2) * 6),
          mesh: null
        };
        for (var q = 0; q < b.i.length / 6; q++) {
          b.i[q * 6] = q * 4; b.i[q * 6 + 1] = q * 4 + 1; b.i[q * 6 + 2] = q * 4 + 2;
          b.i[q * 6 + 3] = q * 4; b.i[q * 6 + 4] = q * 4 + 2; b.i[q * 6 + 5] = q * 4 + 3;
        }
      }
      var vo = 0, quads = 0;
      for (i = 0; i < this.pool.length; i++) {
        p = this.pool[i];
        if (!p.alive || p.mat !== matName) continue;
        var t = p.age / p.life;
        var sz = M.lerp(p.size0, p.size1, t) * 0.5;
        var cr = M.lerp(p.c0[0], p.c1[0], t);
        var cg = M.lerp(p.c0[1], p.c1[1], t);
        var cb = M.lerp(p.c0[2], p.c1[2], t);
        var ca = M.lerp(p.c0[3], p.c1[3], t);
        var rx, ry, rz, ux, uy, uz;
        if (p.flat) {
          rx = sz; ry = 0; rz = 0; ux = 0; uy = 0; uz = sz;
        } else {
          var c = Math.cos(p.rot), s = Math.sin(p.rot);
          var sy = sz * (1 + p.stretch);
          rx = (_right[0] * c + _up[0] * s) * sz;
          ry = (_right[1] * c + _up[1] * s) * sz;
          rz = (_right[2] * c + _up[2] * s) * sz;
          ux = (_up[0] * c - _right[0] * s) * sy;
          uy = (_up[1] * c - _right[1] * s) * sy;
          uz = (_up[2] * c - _right[2] * s) * sy;
        }
        var v = b.v;
        function put(sx2, sy2, u, vv) {
          v[vo] = p.x + rx * sx2 + ux * sy2;
          v[vo + 1] = p.y + ry * sx2 + uy * sy2;
          v[vo + 2] = p.z + rz * sx2 + uz * sy2;
          v[vo + 3] = 0; v[vo + 4] = 1; v[vo + 5] = 0;
          v[vo + 6] = u; v[vo + 7] = vv;
          v[vo + 8] = cr; v[vo + 9] = cg; v[vo + 10] = cb; v[vo + 11] = ca;
          vo += FPV;
        }
        put(-1, -1, 0, 1); put(1, -1, 1, 1); put(1, 1, 1, 0); put(-1, 1, 0, 0);
        quads++;
      }
      if (!quads) continue;
      if (!b.mesh) b.mesh = renderer.createMesh(b.v, b.i, true);
      var gl = renderer.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, b.mesh.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, b.v.subarray(0, vo), gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.mesh.ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, b.i.subarray(0, quads * 6), gl.DYNAMIC_DRAW);
      b.mesh.count = quads * 6;
      b.mesh.indexType = gl.UNSIGNED_SHORT;
      renderer.submit(b.mesh, IDENT, this.a.mat[matName] || this.a.mat.particle);
    }
  };

  var IDENT = M4.create();

  Particles.Emit = Emit;
  LZ.Particles = Particles;
})(LZ);
