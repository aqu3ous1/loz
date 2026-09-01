/* =============================================================
   game/areas/kit.js -- shared builders so an area definition can stay
   readable: terrain shapers, scatterers, town and dungeon helpers.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var M = LZ.M, V3 = LZ.V3, C = LZ.Collision, P = LZ.Props;

  var K = {};

  /* ---------------- terrain shapers ---------------- */
  /* every shaper returns fn(x,z) -> {h, t} where t indexes groundMats */
  K.flat = function (h, t) {
    return function () { return { h: h || 0, t: t || 0 }; };
  };

  K.rolling = function (o) {
    o = o || {};
    var seed = o.seed || 1, amp = o.amp === undefined ? 1.6 : o.amp;
    var scale = o.scale || 0.028, base = o.base || 0;
    var paths = o.paths || [];
    var extra = o.extra || null;
    return function (x, z) {
      var h = base + (M.fbm2(x * scale, z * scale, 4, seed) - 0.5) * 2 * amp;
      var t = o.baseMat === undefined ? 0 : o.baseMat;
      /* carve paths flat and switch material */
      for (var i = 0; i < paths.length; i++) {
        var p = paths[i];
        var d = K.distToPath(x, z, p.pts);
        if (d < p.w) {
          var k = M.smoothstep(p.w, p.w * 0.45, d);
          h = M.lerp(h, p.h === undefined ? base : p.h, k * 0.92);
          if (d < p.w * 0.78) t = p.mat === undefined ? 1 : p.mat;
        }
      }
      if (extra) {
        var r = extra(x, z, h, t);
        if (r) { if (r.h !== undefined) h = r.h; if (r.t !== undefined) t = r.t; }
      }
      return { h: h, t: t };
    };
  };

  K.distToPath = function (x, z, pts) {
    var best = 1e9;
    var out = [0, 0, 0];
    for (var i = 0; i + 3 < pts.length; i += 2) {
      M.segClosestPoint(out, pts[i], pts[i + 1], pts[i + 2], pts[i + 3], x, z);
      var dx = x - out[0], dz = z - out[1];
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d < best) best = d;
    }
    return best;
  };

  /* A bowl-shaped valley with mountain walls at the edges.
     Two details decide whether this reads as mountains or as a grey wall
     pasted behind the town: the ground material has to keep climbing well up
     the slope before it turns to rock, and the ridge line has to break up
     rather than hold one height all the way round. */
  K.basin = function (o) {
    o = o || {};
    var inner = o.inner || 30, outer = o.outer || 46, wall = o.wall === undefined ? 16 : o.wall;
    var seed = o.seed || 1;
    var rockAt = o.rockAt === undefined ? 0.52 : o.rockAt;
    var base = K.rolling(o);
    return function (x, z) {
      var r = base(x, z);
      var d = Math.sqrt(x * x + z * z);
      if (d > inner) {
        var k = M.smoothstep(inner, outer, d);
        /* a slow-then-steep profile, so the valley floor runs out to a skirt
           of grassy foothills before the cliffs start */
        var rise = k * k * k * (3 - 2 * k);
        /* peaks and saddles around the rim: one low-frequency band decides
           how tall this stretch of the ridge gets, a second roughens it */
        var crown = 0.62 + 0.58 * M.valueNoise2(Math.atan2(z, x) * 1.9 + 11, 4.5, seed + 23);
        var rough = M.ridge2(x * 0.055, z * 0.055, 3, seed + 7);
        r.h += rise * wall * crown + rough * k * k * 7.5;
        if (k > rockAt) r.t = o.wallMat === undefined ? 2 : o.wallMat;
      }
      return r;
    };
  };

  /* rectangular room floor with a rim, used for dungeon areas */
  K.room = function (o) {
    o = o || {};
    var floor = o.floor === undefined ? 0 : o.floor;
    return function (x, z) {
      return { h: floor, t: o.mat === undefined ? 0 : o.mat };
    };
  };

  /* ---------------- scattering ---------------- */
  /* deterministic Poisson-ish scatter over a region */
  K.scatter = function (o, fn) {
    var rng = new M.Rng(o.seed || 7);
    var n = o.count || 40;
    var x0 = o.x0, x1 = o.x1, z0 = o.z0, z1 = o.z1;
    var minDist = o.minDist || 0;
    var placed = [];
    var tries = 0;
    while (placed.length < n && tries < n * 24) {
      tries++;
      var x = rng.range(x0, x1), z = rng.range(z0, z1);
      if (o.filter && !o.filter(x, z)) continue;
      var ok = true;
      if (minDist > 0) {
        for (var i = 0; i < placed.length; i++) {
          var dx = placed[i][0] - x, dz = placed[i][1] - z;
          if (dx * dx + dz * dz < minDist * minDist) { ok = false; break; }
        }
      }
      if (!ok) continue;
      placed.push([x, z]);
      fn(x, z, rng, placed.length - 1);
    }
    return placed;
  };

  /* ---------------- decoration ---------------- */
  K.grassField = function (ctx, o) {
    var w = ctx.world;
    K.scatter({
      seed: o.seed || 11, count: o.count || 90, x0: o.x0, x1: o.x1, z0: o.z0, z1: o.z1,
      minDist: o.minDist || 1.6, filter: o.filter
    }, function (x, z, rng) {
      var y = w.groundHeight(x, z);
      if (o.cuttable && rng.chance(o.cuttable)) {
        ctx.spawn(new LZ.GrassClump(ctx.game, { x: x, y: y, z: z, mat: o.mat || 'grassblade' }));
      } else {
        LZ.Props.grassTuft(ctx.batch, x, y, z, { scale: rng.range(0.8, 1.35), mat: o.mat || 'grassblade' });
      }
    });
  };

  K.forest = function (ctx, o) {
    var w = ctx.world;
    K.scatter({
      seed: o.seed || 21, count: o.count || 40, x0: o.x0, x1: o.x1, z0: o.z0, z1: o.z1,
      minDist: o.minDist || 3.4, filter: o.filter
    }, function (x, z, rng) {
      var y = w.groundHeight(x, z);
      var kind = o.kind || 'tree';
      if (kind === 'mixed') kind = rng.chance(0.55) ? 'tree' : 'pine';
      var fn = LZ.Props[kind] || LZ.Props.tree;
      fn(ctx.batch, x, y, z, {
        scale: rng.range(o.minScale || 0.85, o.maxScale || 1.35),
        seed: rng.int(0, 9999),
        leafMat: o.leafMat, leafColor: o.leafColor, barkMat: o.barkMat
      });
    });
  };

  K.rocks = function (ctx, o) {
    var w = ctx.world;
    K.scatter({
      seed: o.seed || 31, count: o.count || 20, x0: o.x0, x1: o.x1, z0: o.z0, z1: o.z1,
      minDist: o.minDist || 2.4, filter: o.filter
    }, function (x, z, rng) {
      var y = w.groundHeight(x, z);
      LZ.Props.rock(ctx.batch, x, y, z, {
        scale: rng.range(0.5, 1.3), seed: rng.int(0, 9999), mat: o.mat || 'rock', color: o.color
      });
    });
  };

  /* ---------------- population ---------------- */
  K.enemies = function (ctx, list) {
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      var y = e.y === undefined ? ctx.world.groundHeight(e.x, e.z) : e.y;
      var a = LZ.Enemies.make(ctx.game, e.id, {
        x: e.x, y: y, z: e.z, variant: e.variant, element: e.element,
        big: e.big, hang: e.hang, hp: e.hp
      });
      if (a) { if (e.yaw !== undefined) a.yaw = e.yaw; ctx.spawn(a); }
    }
  };

  K.pots = function (ctx, list, style) {
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      ctx.spawn(new LZ.Pot(ctx.game, {
        x: p[0], y: ctx.world.groundHeight(p[0], p[1]), z: p[1], style: p[2] || style || 'pot'
      }));
    }
  };

  K.chest = function (ctx, x, z, item, o) {
    o = o || {};
    return ctx.spawn(new LZ.Chest(ctx.game, {
      x: x, y: o.y === undefined ? ctx.world.groundHeight(x, z) : o.y, z: z,
      item: item, count: o.count, big: o.big, flag: o.flag, locked: o.locked,
      yaw: o.yaw || 0, onOpen: o.onOpen
    }));
  };

  K.sign = function (ctx, x, z, text, yaw) {
    LZ.Props.sign(ctx.batch, x, ctx.world.groundHeight(x, z), z, { yaw: yaw || 0 });
    return ctx.spawn(new LZ.Sign(ctx.game, {
      x: x, y: ctx.world.groundHeight(x, z), z: z, text: text, yaw: yaw || 0
    }));
  };

  K.hintStone = function (ctx, x, z, hint) {
    return ctx.spawn(new LZ.HintStone(ctx.game, {
      x: x, y: ctx.world.groundHeight(x, z), z: z, hint: hint
    }));
  };

  K.torch = function (ctx, x, z, o) {
    o = o || {};
    var y = o.y === undefined ? ctx.world.groundHeight(x, z) : o.y;
    LZ.Props.torchPost(ctx.batch, x, y, z, { h: o.h || 1.7 });
    return ctx.spawn(new LZ.Torch(ctx.game, { x: x, y: y, z: z, h: o.h || 1.7, lit: o.lit, onLight: o.onLight }));
  };

  K.npc = function (ctx, o) {
    o.y = o.y === undefined ? ctx.world.groundHeight(o.x, o.z) : o.y;
    return ctx.spawn(new LZ.NPC(ctx.game, o));
  };

  K.door = function (ctx, o) {
    o.y = o.y === undefined ? ctx.world.groundHeight(o.x, o.z) : o.y;
    return ctx.spawn(new LZ.Door(ctx.game, o));
  };

  /* an exit strip at the edge of an area */
  K.edgeExit = function (ctx, side, to, entry, o) {
    o = o || {};
    var b = ctx.world.col.bounds;
    var pad = o.pad === undefined ? 2.2 : o.pad;
    var t = { to: to, entry: entry };
    var span = o.span || 12;
    var at = o.at || 0;
    if (side === 'n') { t.x0 = at - span; t.x1 = at + span; t.z0 = b.z0; t.z1 = b.z0 + pad; }
    if (side === 's') { t.x0 = at - span; t.x1 = at + span; t.z0 = b.z1 - pad; t.z1 = b.z1; }
    if (side === 'w') { t.z0 = at - span; t.z1 = at + span; t.x0 = b.x0; t.x1 = b.x0 + pad; }
    if (side === 'e') { t.z0 = at - span; t.z1 = at + span; t.x0 = b.x1 - pad; t.x1 = b.x1; }
    if (o.cond) t.cond = o.cond;
    return ctx.transition(t);
  };

  /* ---------------- dungeon helpers ---------------- */
  /* rooms is a map id -> {x,z,w,d,h, doors:{n,s,e,w}, floor, wall} */
  K.dungeon = function (ctx, rooms, o) {
    o = o || {};
    for (var id in rooms) {
      var r = rooms[id];
      var gaps = {};
      var dw = o.doorWidth || 2.6;
      if (r.doors) {
        if (r.doors.n) gaps.n = [r.doors.n === true ? 0 : r.doors.n, dw];
        if (r.doors.s) gaps.s = [r.doors.s === true ? 0 : r.doors.s, dw];
        if (r.doors.e) gaps.e = [r.doors.e === true ? 0 : r.doors.e, dw];
        if (r.doors.w) gaps.w = [r.doors.w === true ? 0 : r.doors.w, dw];
      }
      LZ.Props.room(ctx.batch, r.x, r.y || 0, r.z, r.w, r.d, r.h || 4.2, {
        floor: r.floor || o.floor || 'tileFloor',
        wall: r.wall || o.wall || 'stoneblockDark',
        ceiling: r.ceiling !== false,
        gaps: gaps,
        doorH: o.doorH || 2.4,
        floorColor: r.floorColor, wallColor: r.wallColor
      });
    }
  };

  K.corridor = function (ctx, x, z, len, o) {
    o = o || {};
    LZ.Props.corridor(ctx.batch, x, o.y || 0, z, len, o.w || 3.0, o.h || 3.4, {
      yaw: o.yaw || 0, floor: o.floor || 'tileFloor', wall: o.wall || 'stoneblockDark',
      ceiling: o.ceiling !== false
    });
  };

  /* a locked or plain doorway you walk through (no area change) */
  K.innerDoor = function (ctx, x, z, o) {
    o = o || {};
    var y = o.y || 0;
    var solid = ctx.col.add(C.box(x, y + 1.2, z, o.w || 1.4, 1.2, 0.3, { yaw: o.yaw || 0 }));
    var door = {
      solid: solid, open: false,
      openIt: function (g) {
        if (this.open) return;
        this.open = true;
        g.world.col.remove(this.solid);
        g.audio.sfx('door');
        g.cam.addShake(0.1);
      }
    };
    if (o.locked) {
      var act = ctx.spawn(new LZ.Actor({ kind: 'lockdoor', x: x, y: y, z: z, radius: 0.8, height: 2.4 }));
      act.interactable = true;
      act.interactRange = 1.9;
      act.actionLabel = 'Unlock';
      act.castShadow = false;
      act.dungeon = o.dungeon;
      act.lockKind = o.locked;
      act.doorRef = door;
      act.update = function () {};
      act.draw = function (g) {
        if (door.open) return;
        g.effects.lockIcon(x, y + 1.5, z, o.locked === 'boss');
      };
      act.drawShadow = function () {};
      act.act = function (g) {
        if (door.open) return;
        if (o.locked === 'boss') {
          if (!g.inv.bossKeys[o.dungeon]) {
            g.audio.sfx('error');
            g.dialogue.say('A great lock in the shape of a jaw.\nThe Great Key would open it.');
            return;
          }
        } else if (!g.inv.useKey(o.dungeon)) {
          g.audio.sfx('error');
          g.dialogue.say('Locked. You need a small key.');
          return;
        }
        g.audio.sfx('lock_open');
        g.hud.toast('The lock falls away.');
        door.openIt(g);
        act.interactable = false;
      };
    }
    return door;
  };

  /* rising platform / gate opened by a switch */
  K.gate = function (ctx, x, z, o) {
    o = o || {};
    var y = o.y || 0;
    var w = o.w || 2.6, h = o.h || 2.6;
    var mb = ctx.batch.mb(o.mat || 'metalRust');
    var solid = ctx.col.add(C.box(x, y + h / 2, z, w / 2, h / 2, 0.2, { yaw: o.yaw || 0 }));
    var gate = ctx.spawn(new LZ.Actor({ kind: 'gate', x: x, y: y, z: z, radius: w / 2, height: h }));
    gate.open = false;
    gate.offset = 0;
    gate.castShadow = false;
    gate.solidRef = solid;
    gate.mesh = (function () {
      var b = new LZ.GL.MeshBuilder();
      b.setColorHex(0xffffff);
      for (var i = -2; i <= 2; i++) b.box(i * w / 5, h / 2, 0, 0.12, h, 0.12, 2);
      b.box(0, h - 0.1, 0, w, 0.2, 0.16, 2);
      b.box(0, 0.1, 0, w, 0.2, 0.16, 2);
      return b.build(ctx.game.r);
    })();
    gate.matName = o.mat || 'metalRust';
    gate.yaw = o.yaw || 0;
    gate.update = function (dt, g) {
      var target = this.open ? h + 0.2 : 0;
      if (Math.abs(this.offset - target) > 0.001) {
        this.offset = M.approach(this.offset, target, dt * 2.2);
        if (this.solidRef) {
          this.solidRef.y = y + h / 2 + this.offset;
          this.solidRef.top = this.solidRef.y + h / 2;
          this.solidRef.bottom = this.solidRef.y - h / 2;
        }
      }
    };
    var _gm = LZ.M4.create();
    gate.draw = function (g) {
      LZ.M4.compose(_gm, x, y + this.offset, z, 0, this.yaw, 0, 1, 1, 1);
      g.r.submit(this.mesh, _gm, g.assets.mat[this.matName]);
    };
    gate.drawShadow = function () {};
    gate.setOpen = function (v, g) {
      if (this.open === v) return;
      this.open = v;
      if (g) { g.audio.sfx('rumble'); g.cam.addShake(0.12); }
    };
    return gate;
  };

  /* bombable wall segment */
  K.bombWall = function (ctx, x, z, o) {
    o = o || {};
    var y = o.y || 0;
    var w = o.w || 2.4, h = o.h || 3.0;
    var yaw = o.yaw || 0;
    var holder = { broken: false };
    var solid = ctx.col.add(C.box(x, y + h / 2, z, w / 2, h / 2, 0.32, { yaw: yaw, tag: 'bombable', ref: holder }));
    /* drawn as an actor rather than baked into the batch, so it can vanish */
    var cover = ctx.spawn(new LZ.Actor({ kind: 'bombwall', x: x, y: y, z: z, radius: w / 2, height: h }));
    cover.castShadow = false;
    cover.yaw = yaw;
    cover.cullDist = 90;
    cover.mesh = (function () {
      var b = new LZ.GL.MeshBuilder();
      b.setColorHex(0xc4bcb4);
      b.box(0, h / 2, 0, w, h, 0.62, 1.2);
      /* the crack is the tell: players must be able to read it from across a room */
      b.setColorHex(0x5e564e);
      b.box(0, h * 0.50, 0.33, 0.16, h * 0.70, 0.05, 1.2);
      b.box(0.26, h * 0.66, 0.33, 0.48, 0.13, 0.05, 1.2);
      b.box(-0.20, h * 0.34, 0.33, 0.40, 0.11, 0.05, 1.2);
      b.box(0, h * 0.50, -0.33, 0.16, h * 0.70, 0.05, 1.2);
      return b.build(ctx.game.r);
    })();
    cover.matName = o.mat || 'rock';
    cover.update = function () {};
    var _bw = LZ.M4.create();
    cover.draw = function (g) {
      LZ.M4.compose(_bw, x, y, z, 0, yaw, 0, 1, 1, 1);
      g.r.submit(this.mesh, _bw, g.assets.mat[this.matName]);
    };
    cover.drawShadow = function () {};
    holder.cover = cover;
    holder.onBomb = function (g) {
      if (holder.broken) return;
      holder.broken = true;
      g.world.col.remove(solid);
      cover.hidden = true;
      g.audio.sfx('secret');
      g.particles.emit('dust', x, y + 1, z, 20, 2.6, [0.6, 0.56, 0.5, 0.9]);
      g.hud.toast('The wall gives way!');
      if (o.onBreak) o.onBreak(g);
    };
    return holder;
  };

  /* ---------------- environment presets ---------------- */
  K.env = {
    day: function (o) {
      o = o || {};
      return {
        sky: o.sky || 'skyDay',
        fog: o.fog || { color: [0.70, 0.82, 0.94], near: 22, far: 74, density: 1 },
        light: o.light || {
          ambient: [0.46, 0.48, 0.54], dir0: [0.42, 0.80, 0.42], col0: [0.66, 0.62, 0.52],
          dir1: [-0.4, 0.35, -0.6], col1: [0.16, 0.20, 0.28]
        },
        music: o.music, indoor: o.indoor
      };
    },
    dusk: function (o) {
      o = o || {};
      return {
        sky: 'skyDusk',
        fog: { color: [0.78, 0.56, 0.44], near: 16, far: 62, density: 1 },
        light: {
          ambient: [0.36, 0.32, 0.40], dir0: [0.6, 0.42, -0.5], col0: [0.78, 0.50, 0.34],
          dir1: [-0.3, 0.5, 0.4], col1: [0.16, 0.18, 0.34]
        },
        music: o.music
      };
    },
    night: function (o) {
      o = o || {};
      return {
        sky: 'skyNight',
        fog: { color: [0.17, 0.17, 0.31], near: 10, far: 46, density: 1 },
        light: {
          ambient: [0.22, 0.24, 0.36], dir0: [0.2, 0.7, -0.3], col0: [0.26, 0.30, 0.48],
          dir1: [-0.4, 0.3, 0.5], col1: [0.10, 0.12, 0.22]
        },
        music: o.music
      };
    },
    desert: function (o) {
      o = o || {};
      return {
        sky: 'skyDesert',
        fog: { color: [0.91, 0.82, 0.63], near: 20, far: 78, density: 1 },
        light: {
          ambient: [0.56, 0.52, 0.44], dir0: [0.3, 0.88, 0.2], col0: [0.82, 0.74, 0.56],
          dir1: [-0.4, 0.3, -0.5], col1: [0.20, 0.18, 0.16]
        },
        music: o.music
      };
    },
    ash: function (o) {
      o = o || {};
      return {
        sky: 'skyAsh',
        fog: { color: [0.58, 0.53, 0.49], near: 14, far: 68, density: 1 },
        light: {
          ambient: [0.34, 0.33, 0.36], dir0: [0.3, 0.7, 0.3], col0: [0.48, 0.44, 0.42],
          dir1: [-0.3, 0.4, -0.5], col1: [0.18, 0.16, 0.20]
        },
        music: o.music
      };
    },
    cave: function (o) {
      o = o || {};
      return {
        sky: 'skyVoid', indoor: true,
        fog: { color: o.fogColor || [0.05, 0.05, 0.07], near: 6, far: 34, density: 1 },
        light: {
          ambient: o.ambient || [0.26, 0.25, 0.30], dir0: [0.3, 0.8, 0.2], col0: o.col0 || [0.34, 0.32, 0.34],
          dir1: [-0.3, 0.4, -0.5], col1: [0.10, 0.10, 0.16]
        },
        music: o.music
      };
    },
    interior: function (o) {
      o = o || {};
      return {
        sky: 'skyVoid', indoor: true,
        fog: { color: [0.10, 0.08, 0.08], near: 12, far: 40, density: 1 },
        light: {
          ambient: o.ambient || [0.44, 0.40, 0.38], dir0: [0.4, 0.8, 0.3], col0: [0.52, 0.46, 0.38],
          dir1: [-0.4, 0.4, -0.4], col1: [0.16, 0.16, 0.22]
        },
        music: o.music
      };
    },
    storm: function (o) {
      o = o || {};
      return {
        sky: 'skyStorm',
        fog: { color: [0.26, 0.20, 0.28], near: 10, far: 52, density: 1 },
        light: {
          ambient: [0.26, 0.22, 0.32], dir0: [0.3, 0.7, -0.4], col0: [0.38, 0.30, 0.44],
          dir1: [-0.4, 0.4, 0.5], col1: [0.16, 0.10, 0.22]
        },
        music: o.music
      };
    }
  };

  /* interior shell: four walls, floor, ceiling, and a door back out */
  K.interiorShell = function (ctx, o) {
    o = o || {};
    var w = o.w || 9, d = o.d || 8, h = o.h || 3.2;
    LZ.Props.room(ctx.batch, 0, 0, 0, w, d, h, {
      floor: o.floor || 'planks', wall: o.wall || 'plaster',
      ceil: o.ceil || 'planksDark',
      gaps: { s: [o.doorAt === undefined ? 0 : o.doorAt, 1.6] },
      doorH: 2.2,
      floorColor: o.floorColor, wallColor: o.wallColor
    });
    ctx.entry('default', o.doorAt === undefined ? 0 : o.doorAt, 0, d / 2 - 1.4, Math.PI);
    ctx.transition({
      x0: (o.doorAt === undefined ? 0 : o.doorAt) - 0.9, x1: (o.doorAt === undefined ? 0 : o.doorAt) + 0.9,
      z0: d / 2 - 0.4, z1: d / 2 + 1.2, to: o.exitTo, entry: o.exitEntry || 'default'
    });
    return { w: w, d: d, h: h };
  };

  /* how many dungeon seals the player has broken */
  K.medallionCount = function (g) {
    var n = 0;
    for (var id in g.inv.medallions) if (g.inv.medallions[id]) n++;
    return n;
  };

  /* A grotto: the small one-room cave the series hides behind every
     bombable rock. Cheap to author, and the main reason exploring pays. */
  K.grotto = function (o) {
    LZ.Areas.register({
      id: o.id, name: o.name || 'Cave', sub: o.sub, quiet: !!o.quiet, cell: 2,
      size: { x0: -16, z0: -16, w: 32, d: 32 },
      groundMats: [o.floor || 'cobbleDark', 'rockDark'],
      surfaces: ['stone', 'stone'],
      terrain: K.flat(0, 0),
      env: K.env.cave({ music: o.music || 'cave', ambient: o.ambient || [0.30, 0.28, 0.32] }),
      build: function (ctx) {
        var g = ctx.game;
        LZ.Props.room(ctx.batch, 0, 0, 0, o.w || 14, o.d || 13, o.h || 4.6, {
          floor: false, wall: o.wall || 'rockDark',
          wallColor: o.wallColor, gaps: { s: [0, 3.0] }
        });
        var half = (o.d || 13) / 2;
        for (var i = 0; i < 4; i++) {
          LZ.Props.stalagmite(ctx.batch, [-4.5, 4.5, -3.0, 3.4][i], 0, [-4.5, -4.0, 3.4, 4.2][i],
            { scale: 0.8 + (i % 2) * 0.4 });
        }
        K.torch(ctx, -3.4, -half + 2.0, { lit: true });
        K.torch(ctx, 3.4, -half + 2.0, { lit: true });
        if (o.build) o.build(ctx);
        ctx.entry('default', 0, 0, half - 1.6, Math.PI);
        ctx.transition({ x0: -1.4, x1: 1.4, z0: half - 0.6, z1: half + 1.2,
          to: o.back, entry: o.backEntry || 'default' });
      }
    });
  };

  LZ.Kit = K;
})(LZ);
