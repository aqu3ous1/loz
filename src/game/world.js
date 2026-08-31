/* =============================================================
   game/world.js -- area loading, terrain baking, actor management.

   An area is a plain data object with a terrain function and a build()
   callback. Loading bakes the terrain into per-material static meshes,
   runs build() to place props/colliders/actors, and hands back a world
   the game loop can drive.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var M = LZ.M, V3 = LZ.V3, M4 = LZ.M4, GL = LZ.GL, C = LZ.Collision, P = LZ.Props;

  function World(game) {
    this.game = game;
    this.r = game.r;
    this.assets = game.assets;
    this.area = null;
    this.field = null;
    this.col = null;
    this.terrainMeshes = [];
    this.staticMeshes = [];
    this.waterMeshes = [];
    this.actors = [];
    this.triggers = [];
    this.transitions = [];
    this.entries = {};
    this.ambientEmitters = [];
    this.time = 0;
    this.skyMesh = null;
    this.sky = 'skyDay';
    this.fog = { color: [0.55, 0.66, 0.82], near: 30, far: 110, density: 1 };
    this.light = null;
    this.tris = 0;
    this._identity = M4.create();
    this._skyM = M4.create();
    this.era = 'present';
    this.pendingTransition = null;
  }

  World.prototype.groundHeight = function (x, z) {
    return this.field ? this.field.height(x, z) : 0;
  };
  World.prototype.surfaceAt = function (x, z) {
    if (!this.area || !this.area.surfaces) return 'grass';
    var t = this.field.typeAt(x, z);
    return this.area.surfaces[t] || this.area.surfaces[0] || 'grass';
  };

  /* ---------------- loading ---------------- */
  World.prototype.unload = function () {
    var i;
    for (i = 0; i < this.terrainMeshes.length; i++) this.r.destroyMesh(this.terrainMeshes[i].mesh);
    for (i = 0; i < this.staticMeshes.length; i++) this.r.destroyMesh(this.staticMeshes[i].mesh);
    for (i = 0; i < this.waterMeshes.length; i++) this.r.destroyMesh(this.waterMeshes[i].mesh);
    /* skyMesh and bandMesh are shared across areas and deliberately kept */
    this.terrainMeshes.length = 0;
    this.staticMeshes.length = 0;
    this.waterMeshes.length = 0;
    this.actors.length = 0;
    this.triggers.length = 0;
    this.transitions.length = 0;
    this.entries = {};
    this.ambientEmitters.length = 0;
  };

  World.prototype.loadArea = function (area, entry, era) {
    this.unload();
    this.area = area;
    this.era = era || 'present';
    this.time = 0;

    var sz = area.size || { x0: -48, z0: -48, w: 96, d: 96 };
    var cell = area.cell || 2;
    var self = this;
    var terrainFn = area.terrain || function () { return { h: 0, t: 0 }; };
    this.field = new C.Heightfield(sz.x0, sz.z0, sz.w, sz.d, cell, function (x, z) {
      return terrainFn(x, z, self.era);
    });
    this.col = new C.CollisionWorld(this.field, 6);

    /* environment */
    var env = (typeof area.env === 'function') ? area.env(this.era) : (area.env || {});
    this.sky = env.sky || 'skyDay';
    this.fog = env.fog || { color: [0.55, 0.66, 0.82], near: 30, far: 110, density: 1 };
    this.light = env.light || null;
    this.music = env.music || area.music || null;
    this.indoor = !!env.indoor;

    this.bakeTerrain();

    /* build */
    var batch = new P.Batcher();
    batch.col = this.col;
    var ctx = {
      world: this, game: this.game, batch: batch, col: this.col, era: this.era,
      P: P, C: C, M: M,
      entry: function (name, x, y, z, yaw) {
        self.entries[name] = { x: x, y: y === undefined ? self.groundHeight(x, z) : y, z: z, yaw: yaw || 0 };
      },
      trigger: function (t) { self.triggers.push(t); return t; },
      transition: function (t) { self.transitions.push(t); return t; },
      spawn: function (a) { self.addActor(a); return a; },
      water: function (x0, z0, x1, z1, level, type) {
        var w = { x0: x0, z0: z0, x1: x1, z1: z1, level: level, type: type || 'water' };
        self.col.waters.push(w);
        self.addWaterPlane(w);
        return w;
      },
      emitter: function (e) { self.ambientEmitters.push(e); return e; }
    };
    this.ctx = ctx;
    if (area.build) area.build(ctx);

    this.staticMeshes = batch.build(this.r);
    this.tris = 0;
    var i;
    for (i = 0; i < this.staticMeshes.length; i++) this.tris += this.staticMeshes[i].tris;
    for (i = 0; i < this.terrainMeshes.length; i++) this.tris += this.terrainMeshes[i].tris;

    if (!this.skyMesh) this.skyMesh = P.skybox(this.r, 300);

    var e = this.entries[entry] || this.entries['default'] ||
      { x: 0, y: this.groundHeight(0, 0), z: 0, yaw: 0 };
    return e;
  };

  /* ---------------- terrain baking ---------------- */
  World.prototype.bakeTerrain = function () {
    var f = this.field, area = this.area;
    var mats = area.groundMats || ['grass'];
    var builders = {};
    var i, j;
    function mb(name) { return builders[name] || (builders[name] = new GL.MeshBuilder()); }

    var tintFn = area.groundTint || null;
    /* Per-material average tones, used to feather the seam where two
       ground textures meet. Without this the material boundary is a hard
       staircase along the quad grid. */
    var MAT_TONE = {
      grass: [0.52, 0.72, 0.42], grassLush: [0.44, 0.66, 0.38], grassDry: [0.74, 0.72, 0.44],
      grassDark: [0.34, 0.48, 0.34], grassAsh: [0.52, 0.52, 0.46],
      dirt: [0.62, 0.50, 0.36], dirtRed: [0.64, 0.44, 0.32],
      sand: [0.86, 0.76, 0.54], sandDark: [0.76, 0.66, 0.46],
      rock: [0.50, 0.48, 0.46], rockRed: [0.56, 0.40, 0.32], rockDark: [0.34, 0.33, 0.38],
      rockAsh: [0.42, 0.40, 0.38], snow: [0.88, 0.90, 0.96],
      cobble: [0.50, 0.48, 0.45], cobbleDark: [0.36, 0.35, 0.34],
      tileFloor: [0.42, 0.44, 0.52], stoneblockDark: [0.36, 0.36, 0.42],
      carpet: [0.52, 0.24, 0.26], lava: [0.85, 0.42, 0.18], planks: [0.58, 0.44, 0.28]
    };
    function tone(idx) {
      var t = MAT_TONE[mats[idx] || mats[0]];
      return t || [0.6, 0.6, 0.6];
    }
    var cellsX = f.nx - 1, cellsZ = f.nz - 1;
    var nrm = V3.create(0, 1, 0);

    /* per-vertex shade baked from the surface normal: the era's terrain was
       almost always vertex-lit and pre-shaded like this */
    function vcol(x, z, h, matIdx) {
      f.normal(x, z, nrm);
      var lit = 0.62 + M.saturate(nrm[1]) * 0.38;
      var ao = 1;
      if (area.groundShade) ao = area.groundShade(x, z, h, nrm);
      var c = [lit * ao, lit * ao, lit * ao, 1];
      if (tintFn) {
        var t = tintFn(x, z, h, matIdx);
        if (t) { c[0] *= t[0]; c[1] *= t[1]; c[2] *= t[2]; }
      }
      return c;
    }

    for (j = 0; j < cellsZ; j++) {
      for (i = 0; i < cellsX; i++) {
        var x0 = f.x0 + i * f.cell, z0 = f.z0 + j * f.cell;
        var x1 = x0 + f.cell, z1 = z0 + f.cell;
        var t00 = f.type[j * f.nx + i], t10 = f.type[j * f.nx + i + 1];
        var t01 = f.type[(j + 1) * f.nx + i], t11 = f.type[(j + 1) * f.nx + i + 1];
        /* dominant material for this quad */
        var counts = {};
        counts[t00] = (counts[t00] || 0) + 1; counts[t10] = (counts[t10] || 0) + 1;
        counts[t01] = (counts[t01] || 0) + 1; counts[t11] = (counts[t11] || 0) + 1;
        var best = t00, bestN = 0;
        for (var k in counts) if (counts[k] > bestN) { bestN = counts[k]; best = k | 0; }
        var name = mats[best] || mats[0];
        var b = mb(name);

        var h00 = f.h[j * f.nx + i], h10 = f.h[j * f.nx + i + 1];
        var h01 = f.h[(j + 1) * f.nx + i], h11 = f.h[(j + 1) * f.nx + i + 1];
        var us = f.cell / 2.2;

        var c00 = vcol(x0, z0, h00, t00), c10 = vcol(x1, z0, h10, t10);
        var c01 = vcol(x0, z1, h01, t01), c11 = vcol(x1, z1, h11, t11);
        /* corners whose own material differs from the quad's get pulled
           toward their material's tone, which feathers the boundary */
        var quadTone = tone(best);
        function blendCorner(c, ct) {
          if (ct === best) return;
          var ot = tone(ct);
          var k = 0.55;
          for (var q = 0; q < 3; q++) c[q] *= (1 - k) + k * (ot[q] / (quadTone[q] || 1));
        }
        blendCorner(c00, t00); blendCorner(c10, t10);
        blendCorner(c01, t01); blendCorner(c11, t11);

        var n = V3.create(0, 1, 0);
        f.normal((x0 + x1) / 2, (z0 + z1) / 2, n);
        var a, bb, cc, dd;
        if (Math.abs(n[1]) < 0.62) {
          /* Steep ground: project the texture on a vertical plane instead of
             from above, or cliffs smear into vertical streaks. */
          var alongX = Math.abs(n[0]) < Math.abs(n[2]);
          var s0 = alongX ? x0 : z0, s1 = alongX ? x1 : z1;
          var uA = s0 * us, uB = s1 * us;
          a = b.vert(x0, h00, z0, n[0], n[1], n[2], uA, -h00 * us, c00);
          bb = b.vert(x1, h10, z0, n[0], n[1], n[2], alongX ? uB : uA, -h10 * us, c10);
          cc = b.vert(x1, h11, z1, n[0], n[1], n[2], uB, -h11 * us, c11);
          dd = b.vert(x0, h01, z1, n[0], n[1], n[2], alongX ? uA : uB, -h01 * us, c01);
        } else {
          var uu0 = (i * us) % 8, vv0 = (j * us) % 8;
          a = b.vert(x0, h00, z0, n[0], n[1], n[2], uu0, vv0, c00);
          bb = b.vert(x1, h10, z0, n[0], n[1], n[2], uu0 + us, vv0, c10);
          cc = b.vert(x1, h11, z1, n[0], n[1], n[2], uu0 + us, vv0 + us, c11);
          dd = b.vert(x0, h01, z1, n[0], n[1], n[2], uu0, vv0 + us, c01);
        }
        /* triangulation must match Heightfield.height() */
        b.i.push(a, dd, cc);
        b.i.push(a, cc, bb);
      }
    }
    for (var nm in builders) {
      var built = builders[nm];
      if (!built.i.length) continue;
      this.terrainMeshes.push({ mesh: built.build(this.r), mat: nm, tris: built.i.length / 3 });
    }
  };

  World.prototype.addWaterPlane = function (w) {
    var mb = new GL.MeshBuilder();
    mb.setColor(1, 1, 1, 0.80);
    mb.quad([w.x0, w.level, w.z1], [w.x1, w.level, w.z1], [w.x1, w.level, w.z0], [w.x0, w.level, w.z0],
      [(w.x1 - w.x0) / 6, (w.z1 - w.z0) / 6]);
    this.waterMeshes.push({ mesh: mb.build(this.r), mat: w.type === 'murk' ? 'waterMurk' : (w.type === 'deep' ? 'waterDeep' : 'water'), w: w });
  };

  /* ---------------- actors ---------------- */
  World.prototype.addActor = function (a) {
    this.actors.push(a);
    if (a.onSpawn) a.onSpawn(this.game);
    return a;
  };
  World.prototype.removeActor = function (a) {
    var i = this.actors.indexOf(a);
    if (i >= 0) this.actors.splice(i, 1);
  };
  World.prototype.findActor = function (pred) {
    for (var i = 0; i < this.actors.length; i++) if (pred(this.actors[i])) return this.actors[i];
    return null;
  };
  World.prototype.eachActor = function (fn) {
    for (var i = this.actors.length - 1; i >= 0; i--) fn(this.actors[i], i);
  };
  World.prototype.countEnemies = function () {
    var n = 0;
    for (var i = 0; i < this.actors.length; i++) {
      var a = this.actors[i];
      if (a.team === 'enemy' && a.alive && !a.harmless) n++;
    }
    return n;
  };

  /* ---------------- update ---------------- */
  World.prototype.update = function (dt, game) {
    this.time += dt;
    var i, a;
    var px = game.player ? game.player.pos[0] : 0;
    var pz = game.player ? game.player.pos[2] : 0;

    for (i = this.actors.length - 1; i >= 0; i--) {
      a = this.actors[i];
      if (a.removeMe) { this.actors.splice(i, 1); continue; }
      var d2 = (a.pos[0] - px) * (a.pos[0] - px) + (a.pos[2] - pz) * (a.pos[2] - pz);
      a.culled = d2 > (a.cullDist === undefined ? 70 : a.cullDist) * (a.cullDist === undefined ? 70 : a.cullDist);
      if (a.culled && !a.alwaysUpdate) continue;
      if (a.update) a.update(dt, game);
    }

    /* triggers */
    if (game.player && !game.cutscene.active) {
      for (i = 0; i < this.triggers.length; i++) {
        var t = this.triggers[i];
        if (t.done) continue;
        var inside = this._inTrigger(t, game.player.pos);
        if (inside && !t._in) {
          t._in = true;
          if (t.onEnter) t.onEnter(game, t);
          if (t.once) t.done = true;
        } else if (!inside && t._in) {
          t._in = false;
          if (t.onExit) t.onExit(game, t);
        }
      }
      for (i = 0; i < this.transitions.length; i++) {
        var tr = this.transitions[i];
        if (this._inTrigger(tr, game.player.pos)) {
          if (tr.cond && !tr.cond(game)) continue;
          this.pendingTransition = tr;
          break;
        }
      }
    }

    /* ambient particle emitters */
    for (i = 0; i < this.ambientEmitters.length; i++) {
      var e = this.ambientEmitters[i];
      e._acc = (e._acc || 0) + dt;
      if (e._acc >= e.interval) {
        e._acc = 0;
        if (!e.range || !game.player || V3.distXZ(game.player.pos, [e.x, 0, e.z]) < e.range) e.fn(game, e);
      }
    }
  };

  World.prototype._inTrigger = function (t, p) {
    if (t.r !== undefined) {
      var dx = p[0] - t.x, dz = p[2] - t.z;
      if (t.yRange && (p[1] < t.yRange[0] || p[1] > t.yRange[1])) return false;
      return dx * dx + dz * dz < t.r * t.r;
    }
    return p[0] >= t.x0 && p[0] <= t.x1 && p[2] >= t.z0 && p[2] <= t.z1 &&
      (t.y0 === undefined || (p[1] >= t.y0 && p[1] <= t.y1));
  };

  /* ---------------- draw ---------------- */
  World.prototype.draw = function (game) {
    var r = this.r, a = this.assets, i;

    /* sky follows the camera so it never gets closer */
    if (this.skyMesh) {
      if (!this.indoor) {
        M4.compose(this._skyM, r.camPos[0], r.camPos[1] - 20, r.camPos[2], 0, this.time * 0.004, 0, 1, 1, 1);
        r.submit(this.skyMesh, this._skyM, a.mat[this.sky] || a.mat.skyDay);
      }
      /* fog-coloured band so the terrain edge never shows as a hard line */
      if (!this.bandMesh) this.bandMesh = LZ.Props.horizonBand(r, 250);
      M4.compose(this._skyM, r.camPos[0], r.camPos[1], r.camPos[2], 0, 0, 0, 1, 1, 1);
      var bandMat = a.frameMat('flat', null);
      bandMat.blend = 'alpha';
      bandMat.cull = 'front';
      bandMat.depthWrite = false;
      bandMat.depthTest = false;
      bandMat.queue = -8;
      bandMat.prim = [this.fog.color[0], this.fog.color[1], this.fog.color[2], 1];
      r.submit(this.bandMesh, this._skyM, bandMat);
    }

    for (i = 0; i < this.terrainMeshes.length; i++) {
      var tm = this.terrainMeshes[i];
      r.submit(tm.mesh, this._identity, a.mat[tm.mat] || a.mat.white);
    }
    for (i = 0; i < this.staticMeshes.length; i++) {
      var sm = this.staticMeshes[i];
      r.submit(sm.mesh, this._identity, a.mat[sm.mat] || a.mat.white);
    }
    for (i = 0; i < this.waterMeshes.length; i++) {
      var wm = this.waterMeshes[i];
      var mat = a.frameMat(wm.mat, null);
      /* scrolling UVs sell moving water far better than any vertex wave */
      mat.uv = [1, 1, this.time * 0.035, this.time * 0.021];
      r.submit(wm.mesh, this._identity, mat);
    }

    for (i = 0; i < this.actors.length; i++) {
      var act = this.actors[i];
      if (act.culled || act.hidden) continue;
      act.drawShadow(game);
    }
    for (i = 0; i < this.actors.length; i++) {
      var act2 = this.actors[i];
      if (act2.culled || act2.hidden) continue;
      act2.draw(game);
    }
  };

  World.prototype.applyEnvironment = function () {
    var r = this.r;
    r.setFog(this.fog.color, this.fog.near, this.fog.far,
      this.fog.density === undefined ? 1 : this.fog.density);
    if (this.light) {
      r.setLights(this.light.ambient, this.light.dir0, this.light.col0, this.light.dir1, this.light.col1);
    } else {
      r.setLights([0.42, 0.44, 0.52], [0.45, 0.78, 0.43], [0.68, 0.64, 0.55], [-0.4, 0.35, -0.6], [0.16, 0.18, 0.26]);
    }
  };

  LZ.World = World;
})(LZ);
