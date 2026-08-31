/* =============================================================
   game/collision.js -- heightfield terrain + a broadphase grid of
   simple solids. Actors are vertical cylinders, which is what nearly
   every 3D action game of the era actually used.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var M = LZ.M, V3 = LZ.V3;

  /* ---------------- heightfield ---------------- */
  function Heightfield(x0, z0, w, d, cell, fn) {
    this.x0 = x0; this.z0 = z0;
    this.w = w; this.d = d; this.cell = cell;
    this.nx = Math.floor(w / cell) + 1;
    this.nz = Math.floor(d / cell) + 1;
    this.h = new Float32Array(this.nx * this.nz);
    this.type = new Uint8Array(this.nx * this.nz);
    if (fn) this.generate(fn);
  }
  Heightfield.prototype.generate = function (fn) {
    for (var j = 0; j < this.nz; j++) {
      for (var i = 0; i < this.nx; i++) {
        var x = this.x0 + i * this.cell, z = this.z0 + j * this.cell;
        var r = fn(x, z);
        if (typeof r === 'number') { this.h[j * this.nx + i] = r; }
        else { this.h[j * this.nx + i] = r.h; this.type[j * this.nx + i] = r.t || 0; }
      }
    }
  };
  Heightfield.prototype.at = function (i, j) {
    i = M.clamp(i, 0, this.nx - 1); j = M.clamp(j, 0, this.nz - 1);
    return this.h[j * this.nx + i];
  };
  Heightfield.prototype.typeAt = function (x, z) {
    var i = Math.round((x - this.x0) / this.cell), j = Math.round((z - this.z0) / this.cell);
    i = M.clamp(i, 0, this.nx - 1); j = M.clamp(j, 0, this.nz - 1);
    return this.type[j * this.nx + i];
  };
  Heightfield.prototype.height = function (x, z) {
    var fx = (x - this.x0) / this.cell, fz = (z - this.z0) / this.cell;
    var i = Math.floor(fx), j = Math.floor(fz);
    var u = fx - i, v = fz - j;
    var h00 = this.at(i, j), h10 = this.at(i + 1, j), h01 = this.at(i, j + 1), h11 = this.at(i + 1, j + 1);
    /* match the triangulation used by the mesh builder so the visual and
       the collision surface agree exactly */
    if (u + v < 1) return h00 + (h10 - h00) * u + (h01 - h00) * v;
    return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
  };
  Heightfield.prototype.normal = function (x, z, out) {
    var e = this.cell * 0.5;
    var hl = this.height(x - e, z), hr = this.height(x + e, z);
    var hd = this.height(x, z - e), hu = this.height(x, z + e);
    out = out || V3.create(0, 1, 0);
    V3.set(out, hl - hr, 2 * e, hd - hu);
    return V3.normalize(out, out);
  };
  Heightfield.prototype.slope = function (x, z) {
    var n = this.normal(x, z, V3.create(0, 1, 0));
    return Math.acos(M.clamp(n[1], -1, 1));
  };

  /* ---------------- solids ---------------- */
  function box(x, y, z, hx, hy, hz, opts) {
    var o = opts || {};
    return {
      type: 'box', x: x, y: y, z: z, hx: hx, hy: hy, hz: hz,
      yaw: o.yaw || 0, cos: Math.cos(o.yaw || 0), sin: Math.sin(o.yaw || 0),
      top: y + hy, bottom: y - hy,
      solid: o.solid !== false, climbable: !!o.climbable, tag: o.tag || null,
      ref: o.ref || null, noStand: !!o.noStand, oneWay: !!o.oneWay,
      surface: o.surface || 'stone'
    };
  }
  function cyl(x, y, z, r, h, opts) {
    var o = opts || {};
    return {
      type: 'cyl', x: x, y: y, z: z, r: r, h: h,
      top: y + h, bottom: y,
      solid: o.solid !== false, climbable: !!o.climbable, tag: o.tag || null,
      ref: o.ref || null, noStand: !!o.noStand, surface: o.surface || 'stone'
    };
  }

  /* ---------------- collision world ---------------- */
  function CollisionWorld(field, cellSize) {
    this.field = field;
    this.solids = [];
    this.cell = cellSize || 6;
    this.grid = {};
    this.bounds = field ? { x0: field.x0, z0: field.z0, x1: field.x0 + field.w, z1: field.z0 + field.d } :
      { x0: -1e4, z0: -1e4, x1: 1e4, z1: 1e4 };
    this.waters = [];   /* {x0,z0,x1,z1,level,type} */
    this.voids = [];    /* pits: {x0,z0,x1,z1} -> falling */
  }

  CollisionWorld.prototype._key = function (i, j) { return i + ',' + j; };
  CollisionWorld.prototype.add = function (s) {
    this.solids.push(s);
    var ex, ez;
    if (s.type === 'box') {
      ex = Math.abs(s.hx * s.cos) + Math.abs(s.hz * s.sin);
      ez = Math.abs(s.hx * s.sin) + Math.abs(s.hz * s.cos);
    } else { ex = s.r; ez = s.r; }
    s._ex = ex; s._ez = ez;
    var i0 = Math.floor((s.x - ex) / this.cell), i1 = Math.floor((s.x + ex) / this.cell);
    var j0 = Math.floor((s.z - ez) / this.cell), j1 = Math.floor((s.z + ez) / this.cell);
    for (var j = j0; j <= j1; j++) {
      for (var i = i0; i <= i1; i++) {
        var k = this._key(i, j);
        (this.grid[k] || (this.grid[k] = [])).push(s);
      }
    }
    return s;
  };
  CollisionWorld.prototype.remove = function (s) {
    var idx = this.solids.indexOf(s);
    if (idx >= 0) this.solids.splice(idx, 1);
    for (var k in this.grid) {
      var arr = this.grid[k];
      var a = arr.indexOf(s);
      if (a >= 0) arr.splice(a, 1);
    }
  };
  CollisionWorld.prototype.clear = function () { this.solids.length = 0; this.grid = {}; };

  CollisionWorld.prototype.query = function (x, z, radius, out) {
    out = out || [];
    out.length = 0;
    var i0 = Math.floor((x - radius) / this.cell), i1 = Math.floor((x + radius) / this.cell);
    var j0 = Math.floor((z - radius) / this.cell), j1 = Math.floor((z + radius) / this.cell);
    var seen = this._seen || (this._seen = []);
    seen.length = 0;
    for (var j = j0; j <= j1; j++) {
      for (var i = i0; i <= i1; i++) {
        var arr = this.grid[this._key(i, j)];
        if (!arr) continue;
        for (var n = 0; n < arr.length; n++) {
          if (seen.indexOf(arr[n]) < 0) { seen.push(arr[n]); out.push(arr[n]); }
        }
      }
    }
    return out;
  };

  /* closest point on a solid to (x,z), in world space */
  function closestXZ(s, x, z, out) {
    if (s.type === 'cyl') {
      var dx = x - s.x, dz = z - s.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d < 1e-6) { out[0] = s.x + s.r; out[1] = s.z; out[2] = s.r; return out; }
      out[0] = s.x + dx / d * s.r; out[1] = s.z + dz / d * s.r; out[2] = d - s.r;
      return out;
    }
    /* oriented box: transform into local space */
    var lx = (x - s.x) * s.cos + (z - s.z) * -s.sin;
    var lz = (x - s.x) * s.sin + (z - s.z) * s.cos;
    var cx = M.clamp(lx, -s.hx, s.hx);
    var cz = M.clamp(lz, -s.hz, s.hz);
    var inside = (Math.abs(lx) <= s.hx && Math.abs(lz) <= s.hz);
    if (inside) {
      /* push out along the nearest face */
      var dxp = s.hx - lx, dxm = lx + s.hx, dzp = s.hz - lz, dzm = lz + s.hz;
      var m = Math.min(dxp, dxm, dzp, dzm);
      if (m === dxp) cx = s.hx; else if (m === dxm) cx = -s.hx;
      else if (m === dzp) cz = s.hz; else cz = -s.hz;
    }
    out[0] = s.x + cx * s.cos + cz * s.sin;
    out[1] = s.z + cx * -s.sin + cz * s.cos;
    var ddx = x - out[0], ddz = z - out[1];
    out[2] = (inside ? -1 : 1) * Math.sqrt(ddx * ddx + ddz * ddz);
    return out;
  }
  CollisionWorld.prototype.closestXZ = closestXZ;

  var _cp = [0, 0, 0], _list = [];
  /* push an actor cylinder out of every solid it overlaps.
     Returns true if anything was hit. */
  CollisionWorld.prototype.resolve = function (pos, radius, height, opts) {
    opts = opts || {};
    var hit = false;
    var yMin = pos[1] + 0.06;              /* ignore things we are standing on */
    var yMax = pos[1] + height * 0.92;
    for (var pass = 0; pass < 3; pass++) {
      var moved = false;
      var list = this.query(pos[0], pos[2], radius + 1.2, _list);
      for (var i = 0; i < list.length; i++) {
        var s = list[i];
        if (!s.solid) continue;
        if (opts.ignore && opts.ignore(s)) continue;
        if (s.top <= yMin || s.bottom >= yMax) continue;
        closestXZ(s, pos[0], pos[2], _cp);
        var d = _cp[2];
        if (d >= radius) continue;
        if (d < 0) {
          /* actor centre is inside: shove out along the exit vector */
          var ex = pos[0] - _cp[0], ez = pos[2] - _cp[1];
          var el = Math.sqrt(ex * ex + ez * ez);
          if (el < 1e-5) { ex = 1; ez = 0; el = 1; }
          pos[0] = _cp[0] + ex / el * radius;
          pos[2] = _cp[1] + ez / el * radius;
        } else {
          var nx = pos[0] - _cp[0], nz = pos[2] - _cp[1];
          var nl = Math.sqrt(nx * nx + nz * nz) || 1;
          var push = radius - d;
          pos[0] += nx / nl * push;
          pos[2] += nz / nl * push;
        }
        hit = true; moved = true;
      }
      if (!moved) break;
    }
    return hit;
  };

  /* the highest standable surface at or below `fromY` */
  CollisionWorld.prototype.floorAt = function (x, z, fromY, radius, out) {
    out = out || {};
    var best = this.field ? this.field.height(x, z) : 0;
    var bestSolid = null;
    var surface = this.field ? this.field.typeAt(x, z) : 0;
    var list = this.query(x, z, (radius || 0) + 0.1, _list);
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (!s.solid || s.noStand) continue;
      closestXZ(s, x, z, _cp);
      if (_cp[2] > (radius || 0) * 0.55) continue;
      if (s.top <= fromY + 0.36 && s.top > best) { best = s.top; bestSolid = s; }
    }
    out.y = best;
    out.solid = bestSolid;
    out.surface = bestSolid ? bestSolid.surface : surface;
    return out;
  };

  /* the lowest blocking surface above `fromY` */
  CollisionWorld.prototype.ceilingAt = function (x, z, fromY, radius) {
    var best = 1e9;
    var list = this.query(x, z, (radius || 0) + 0.1, _list);
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (!s.solid) continue;
      closestXZ(s, x, z, _cp);
      if (_cp[2] > (radius || 0)) continue;
      if (s.bottom >= fromY - 0.02 && s.bottom < best) best = s.bottom;
    }
    return best;
  };

  CollisionWorld.prototype.waterAt = function (x, z) {
    for (var i = this.waters.length - 1; i >= 0; i--) {
      var w = this.waters[i];
      if (x >= w.x0 && x <= w.x1 && z >= w.z0 && z <= w.z1) return w;
    }
    return null;
  };

  /* ---------------- raycast ---------------- */
  function rayBox(s, ox, oy, oz, dx, dy, dz, maxT) {
    /* to local space */
    var lx = (ox - s.x) * s.cos + (oz - s.z) * -s.sin;
    var lz = (ox - s.x) * s.sin + (oz - s.z) * s.cos;
    var ly = oy - s.y;
    var ldx = dx * s.cos + dz * -s.sin;
    var ldz = dx * s.sin + dz * s.cos;
    var ldy = dy;
    var t0 = 0, t1 = maxT;
    var comp = [[lx, ldx, s.hx], [ly, ldy, s.hy], [lz, ldz, s.hz]];
    for (var i = 0; i < 3; i++) {
      var o = comp[i][0], d = comp[i][1], h = comp[i][2];
      if (Math.abs(d) < 1e-8) { if (o < -h || o > h) return -1; continue; }
      var ta = (-h - o) / d, tb = (h - o) / d;
      if (ta > tb) { var tmp = ta; ta = tb; tb = tmp; }
      if (ta > t0) t0 = ta;
      if (tb < t1) t1 = tb;
      if (t0 > t1) return -1;
    }
    return t0;
  }
  function rayCyl(s, ox, oy, oz, dx, dy, dz, maxT) {
    var px = ox - s.x, pz = oz - s.z;
    var a = dx * dx + dz * dz;
    if (a < 1e-9) return -1;
    var b = 2 * (px * dx + pz * dz);
    var c = px * px + pz * pz - s.r * s.r;
    var disc = b * b - 4 * a * c;
    if (disc < 0) return -1;
    var sq = Math.sqrt(disc);
    var t = (-b - sq) / (2 * a);
    if (t < 0) t = (-b + sq) / (2 * a);
    if (t < 0 || t > maxT) return -1;
    var y = oy + dy * t;
    if (y < s.bottom || y > s.top) return -1;
    return t;
  }

  /* returns {t, point, solid, terrain} or null */
  CollisionWorld.prototype.raycast = function (origin, dir, maxDist, filter) {
    var bestT = maxDist, bestSolid = null;
    /* solids along the ray, sampled through the broadphase grid */
    var steps = Math.ceil(maxDist / this.cell) + 1;
    var seen = [];
    for (var st = 0; st <= steps; st++) {
      var t = st / steps * maxDist;
      var sx = origin[0] + dir[0] * t, sz = origin[2] + dir[2] * t;
      var list = this.query(sx, sz, this.cell, []);
      for (var i = 0; i < list.length; i++) {
        var s = list[i];
        if (seen.indexOf(s) >= 0) continue;
        seen.push(s);
        if (!s.solid) continue;
        if (filter && !filter(s)) continue;
        var ht = (s.type === 'box')
          ? rayBox(s, origin[0], origin[1], origin[2], dir[0], dir[1], dir[2], bestT)
          : rayCyl(s, origin[0], origin[1], origin[2], dir[0], dir[1], dir[2], bestT);
        if (ht >= 0 && ht < bestT) { bestT = ht; bestSolid = s; }
      }
    }
    /* terrain march */
    var terrainT = -1;
    if (this.field) {
      var step = 0.28, prevAbove = true;
      for (var d = 0; d <= bestT; d += step) {
        var x = origin[0] + dir[0] * d, y = origin[1] + dir[1] * d, z = origin[2] + dir[2] * d;
        var gh = this.field.height(x, z);
        if (d === 0) { prevAbove = y >= gh; continue; }
        if (prevAbove && y < gh) {
          /* bisect once for a decent contact point */
          var lo = d - step, hi = d;
          for (var it = 0; it < 6; it++) {
            var mid = (lo + hi) / 2;
            var my = origin[1] + dir[1] * mid;
            var mh = this.field.height(origin[0] + dir[0] * mid, origin[2] + dir[2] * mid);
            if (my < mh) hi = mid; else lo = mid;
          }
          terrainT = hi; break;
        }
        prevAbove = y >= gh;
      }
    }
    if (terrainT >= 0 && terrainT < bestT) {
      return {
        t: terrainT, terrain: true, solid: null,
        point: [origin[0] + dir[0] * terrainT, origin[1] + dir[1] * terrainT, origin[2] + dir[2] * terrainT]
      };
    }
    if (bestSolid) {
      return {
        t: bestT, terrain: false, solid: bestSolid,
        point: [origin[0] + dir[0] * bestT, origin[1] + dir[1] * bestT, origin[2] + dir[2] * bestT]
      };
    }
    return null;
  };

  LZ.Collision = {
    Heightfield: Heightfield,
    CollisionWorld: CollisionWorld,
    box: box, cyl: cyl
  };
})(LZ);
