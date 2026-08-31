/* =============================================================
   game/areas/overworld.js -- the connecting world: the title
   backdrop, plains, dunes, mountain road, forest, lake and hollow.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var M = LZ.M, K = LZ.Kit, P = LZ.Props, C = LZ.Collision, A = LZ.Areas, S = LZ.Script;

  /* ================================================================ */
  /* Title backdrop                                                    */
  /* ================================================================ */
  A.register({
    id: 'title', name: '', quiet: true, cell: 2,
    size: { x0: -40, z0: -40, w: 80, d: 80 },
    groundMats: ['grass', 'dirt', 'rock'],
    surfaces: ['grass', 'dirt', 'stone'],
    terrain: K.rolling({ seed: 5, amp: 2.2, scale: 0.025, base: 0 }),
    env: K.env.dusk({ music: 'title' }),
    build: function (ctx) {
      var w = ctx.world;
      K.forest(ctx, { seed: 2, count: 52, x0: -38, x1: 38, z0: -38, z1: 38, minDist: 5, kind: 'mixed',
        filter: function (x, z) { return Math.sqrt(x * x + z * z) > 17; } });
      K.grassField(ctx, { seed: 3, count: 120, x0: -36, x1: 36, z0: -36, z1: 36 });
      K.rocks(ctx, { seed: 4, count: 16, x0: -34, x1: 34, z0: -34, z1: 34, minDist: 6 });
      /* a lone gravestone with the heirloom blade planted in front of it */
      P.gravestone(ctx.batch, 0, w.groundHeight(0, 0), 0, { yaw: 0.15 });
      var gy = w.groundHeight(0.55, 1.0);
      var mb = ctx.batch.mb('metal');
      mb.setColorHex(0xdfe6ef);
      mb.taper(0.55, gy + 0.10, 1.0, 0.26, 0.085, 0.20, 0.070, 1.20, 0, 0, 2);
      mb.setColorHex(0xf4f8ff);
      mb.box(0.55, gy + 0.70, 1.03, 0.05, 1.10, 0.012, 2);
      mb.setColorHex(0xd8c078);
      mb.box(0.55, gy + 1.34, 1.0, 0.62, 0.09, 0.13, 2);
      var hm = ctx.batch.mb('leatherDark');
      hm.setColorHex(0x6a4a2c);
      hm.cylinder(0.55, gy + 1.40, 1.0, 0.055, 0.06, 0.28, 6, true, 4);
      hm.setColorHex(0xd8b850);
      hm.sphere(0.55, gy + 1.72, 1.0, 0.07, 6, 3, 0.9);
      /* fireflies over the grave at dusk */
      ctx.emitter({
        x: 0, z: 0, interval: 0.22, range: 40,
        fn: function (gg) {
          var a2 = Math.random() * Math.PI * 2, rr = 1.2 + Math.random() * 4.0;
          gg.particles.spawn({
            x: Math.cos(a2) * rr, y: gg.world.groundHeight(0, 0) + 0.35 + Math.random() * 1.5,
            z: Math.sin(a2) * rr,
            vx: (Math.random() - 0.5) * 0.35, vy: 0.14 + Math.random() * 0.22, vz: (Math.random() - 0.5) * 0.35,
            drag: 0.7, life: 2.4 + Math.random() * 1.6, size0: 0.07, size1: 0.02,
            c0: [1.0, 0.95, 0.55, 0.95], c1: [0.9, 0.6, 0.2, 0], mat: 'glow'
          });
        }
      });
      P.deadTree(ctx.batch, -4.6, w.groundHeight(-4.6, -3.4), -3.4, { scale: 1.3 });
      /* a low ring of flowers around the grave so the centre has something to look at */
      for (var f = 0; f < 5; f++) {
        var fa = f / 5 * Math.PI * 2 + 0.4;
        P.flowerPatch(ctx.batch, Math.cos(fa) * 3.1, w.groundHeight(Math.cos(fa) * 3.1, Math.sin(fa) * 3.1),
          Math.sin(fa) * 3.1, { mat: 'flowers', scale: 0.8 });
      }
      ctx.entry('default', 0, undefined, 6, Math.PI);
    }
  });

  /* ================================================================ */
  /* Yeld Plains -- the long road between Farrow and Stonebell         */
  /* ================================================================ */
  A.register({
    id: 'yeld',
    name: 'Yeld Plains',
    sub: 'the long way south',
    warp: true, respawn: 'yeld',
    cell: 2,
    size: { x0: -56, z0: -60, w: 112, d: 120 },
    groundMats: ['grass', 'dirt', 'rock', 'grassDry'],
    surfaces: ['grass', 'dirt', 'stone', 'grass'],
    terrain: K.rolling({
      seed: 17, amp: 3.2, scale: 0.017, base: 0, baseMat: 0,
      paths: [{ pts: [5, -58, 2, -20, -6, 10, 0, 58], w: 3.4, h: undefined, mat: 1 }],
      extra: function (x, z, h) {
        /* ridges along the east and west edges pen the player onto the road */
        var edge = Math.max(0, (Math.abs(x) - 34) / 20);
        if (edge > 0) return { h: h + edge * edge * 22, t: 2 };
        return null;
      }
    }),
    env: K.env.day({ music: 'field' }),
    build: function (ctx) {
      var g = ctx.game, w = ctx.world;
      var onRoad = function (x, z) { return K.distToPath(x, z, [5, -58, 2, -20, -6, 10, 0, 58]) > 5; };

      K.forest(ctx, { seed: 22, count: 78, x0: -50, x1: 50, z0: -54, z1: 54, minDist: 4.6,
        kind: 'mixed', filter: function (x, z) { return onRoad(x, z) && Math.abs(x) < 40; } });
      K.grassField(ctx, { seed: 23, count: 190, x0: -48, x1: 48, z0: -54, z1: 54, cuttable: 0.26,
        filter: onRoad });
      K.rocks(ctx, { seed: 24, count: 34, x0: -48, x1: 48, z0: -54, z1: 54, minDist: 5, filter: onRoad });

      /* a ruined watchpost with a chest on top */
      var rx = -18, rz = -22, ry = w.groundHeight(rx, rz);
      P.cliff(ctx.batch, rx, ry, rz, 6, 3.4, 6, { mat: 'stoneblock', layers: 2, taper: 0.3 });
      K.chest(ctx, rx, rz, 'travelersSword', { flag: 'chest_yeld_sword', y: ry + 3.4 });
      P.stairs(ctx.batch, rx + 4.2, ry, rz, 2.4, 0.42, 0.7, 8, { yaw: Math.PI / 2, mat: 'stoneblock' });

      /* stream and bridge */
      ctx.water(-52, 4, 52, 11, w.groundHeight(0, 7.5) - 0.7, 'water');
      P.bridge(ctx.batch, -3, w.groundHeight(-3, 7.5) + 0.1, 7.5, 9, { yaw: 0, w: 3.4 });

      K.sign(ctx, 4, -40, 'north - Farrow Village\nsouth - Stonebell', 0);
      K.sign(ctx, -2, 34, 'south - Stonebell\nnorth - Farrow Village', Math.PI);
      K.hintStone(ctx, 9, -6, 'Roll into a tree and it will drop what it is\nhiding. This has always been true.');

      /* the heart piece across the water */
      if (!g.inv.flag('hp_yeld')) {
        K.chest(ctx, 22, 8, 'heartPiece', { flag: 'hp_yeld', y: w.groundHeight(22, 8) });
        P.rock(ctx.batch, 20, w.groundHeight(20, 6), 6, { scale: 1.4 });
      }

      ctx.entry('default', 2, undefined, -40, Math.PI);
      ctx.entry('fromNorth', 5, undefined, -54, Math.PI);
      ctx.entry('fromSouth', 0, undefined, 54, 0);
      ctx.entry('fromWest', -46, undefined, 0, -Math.PI / 2);
      ctx.entry('fromEast', 46, undefined, -10, Math.PI / 2);
      K.edgeExit(ctx, 'n', 'farrow', 'fromSouth', { at: 5, span: 10 });
      K.edgeExit(ctx, 's', 'stonebell', 'fromNorth', { at: 0, span: 10 });
      K.edgeExit(ctx, 'w', 'elderwood', 'fromEast', { at: 0, span: 10 });
      K.edgeExit(ctx, 'e', 'lakeshore', 'fromWest', { at: -10, span: 10 });

      var hostile = g.inv.flag('worldHostile');
      K.enemies(ctx, hostile ? [
        { id: 'chuchu', x: -14, z: -34 }, { id: 'chuchu', x: -11, z: -31, variant: 'green' },
        { id: 'octorok', x: 16, z: -8 }, { id: 'keese', x: -8, z: 20 },
        { id: 'moblin', x: 12, z: 30 }, { id: 'wolfos', x: -22, z: 40 },
        { id: 'tektite', x: 26, z: -30 }, { id: 'chuchu', x: 30, z: 18, variant: 'red' }
      ] : [
        { id: 'chuchu', x: -20, z: -36 }, { id: 'keese', x: 22, z: 30 }
      ]);
    }
  });

  /* ================================================================ */
  /* The Dunes -- road to Hanman                                       */
  /* ================================================================ */
  A.register({
    id: 'dunes',
    name: 'The Sighing Dunes',
    sub: 'south of everything',
    warp: true, respawn: 'dunes',
    cell: 2,
    size: { x0: -50, z0: -56, w: 100, d: 112 },
    groundMats: ['sand', 'sandDark', 'rockRed', 'dirtRed'],
    surfaces: ['sand', 'sand', 'stone', 'dirt'],
    terrain: K.rolling({
      seed: 37, amp: 4.6, scale: 0.014, base: 0, baseMat: 0,
      paths: [{ pts: [0, -54, -4, -10, 4, 20, 0, 54], w: 3.6, mat: 1 }],
      extra: function (x, z, h) {
        var edge = Math.max(0, (Math.abs(x) - 30) / 18);
        if (edge > 0) return { h: h + edge * edge * 20, t: 2 };
        return null;
      }
    }),
    env: K.env.desert({ music: 'desert' }),
    build: function (ctx) {
      var g = ctx.game, w = ctx.world;
      var offRoad = function (x, z) { return K.distToPath(x, z, [0, -54, -4, -10, 4, 20, 0, 54]) > 5; };

      K.scatter({ seed: 44, count: 40, x0: -44, x1: 44, z0: -50, z1: 50, minDist: 5, filter: offRoad },
        function (x, z, rng) { P.cactus(ctx.batch, x, w.groundHeight(x, z), z, { scale: rng.range(0.7, 1.5) }); });
      K.rocks(ctx, { seed: 45, count: 40, x0: -44, x1: 44, z0: -50, z1: 50, minDist: 4,
        mat: 'rockRed', filter: offRoad });
      K.scatter({ seed: 46, count: 10, x0: -40, x1: 40, z0: -46, z1: 46, minDist: 9, filter: offRoad },
        function (x, z, rng) {
          P.cliff(ctx.batch, x, w.groundHeight(x, z), z, rng.range(4, 9), rng.range(4, 9), rng.range(4, 9),
            { mat: 'rockRed', layers: 3, yaw: rng.range(0, 3) });
        });

      /* an old caravan camp: a shop-free rest stop with a bottle */
      var cx = 12, cz = -14, cy = w.groundHeight(cx, cz);
      P.stall(ctx.batch, cx, cy, cz, { yaw: 1.2, awning: 'clothTan' });
      P.barrel(ctx.batch, cx + 2, cy, cz + 1.4, {});
      P.crate(ctx.batch, cx - 2, cy, cz + 1.2, {});
      K.torch(ctx, cx, cz + 2.4, { lit: true });
      K.npc(ctx, {
        x: cx + 0.4, z: cz + 1.6, yaw: 0.6, name: 'Caravan Master', palette: 6, build: 'adult',
        hat: 'turban', hatColor: 0xd8c8a0, skin: 0xc08a5c, portrait: S.PORTRAITS.merchant,
        talk: function (gg) {
          if (!gg.inv.flag('gotDuneBottle')) {
            gg.inv.setFlag('gotDuneBottle');
            gg.dialogue.say('You look like a man walking to a funeral he has not\nbeen told about yet.\f'
              + 'Take this. Empty, but an empty bottle out here is\nworth more than a full one anywhere else.',
              { speaker: 'Caravan Master', portrait: S.PORTRAITS.merchant,
                onDone: function () { gg.giveItem('bottle', 1, { describe: false }); } });
            return;
          }
          gg.dialogue.say('South to Hanman, north to the green country.\fPick one and stop standing in my shade.',
            { speaker: 'Caravan Master', portrait: S.PORTRAITS.merchant });
        }
      });

      K.sign(ctx, -3, -40, 'north - Stonebell\nsouth - Hanman Town\n  Carry water. Carry more water.', 0);
      K.hintStone(ctx, 6, 16, 'The sand keeps things. Sometimes it gives them\nback when something heavy walks over it.');

      if (!g.inv.flag('hp_dunes')) {
        K.chest(ctx, -22, 26, 'heartPiece', { flag: 'hp_dunes', y: w.groundHeight(-22, 26) });
      }

      ctx.entry('default', 0, undefined, -44, Math.PI);
      ctx.entry('fromNorth', 0, undefined, -50, Math.PI);
      ctx.entry('fromSouth', 0, undefined, 50, 0);
      K.edgeExit(ctx, 'n', 'stonebell', 'fromSouth', { at: 0, span: 10 });
      K.edgeExit(ctx, 's', 'hanman', 'fromNorth', { at: 0, span: 10 });

      var hostile = g.inv.flag('worldHostile');
      K.enemies(ctx, hostile ? [
        { id: 'sandeel', x: -14, z: 6 }, { id: 'sandeel', x: 18, z: 22 },
        { id: 'octorok', x: -20, z: -20 }, { id: 'tektite', x: 22, z: -30, variant: 'red' },
        { id: 'moblin', x: -8, z: 34 }, { id: 'keese', x: 10, z: 40 },
        { id: 'gibdo', x: -26, z: 40 }
      ] : [
        { id: 'octorok', x: -22, z: 10 }, { id: 'tektite', x: 24, z: -24, variant: 'red' }
      ]);

      /* on the way home, the news from Ashvale finds you */
      if (g.inv.flag('heardOfDeath') && !g.inv.flag('heardAshvale')) {
        ctx.trigger({
          x: 0, z: -30, r: 6, once: true,
          onEnter: function (gg) { S.ashvaleNews(gg); }
        });
      }
    }
  });

  /* ================================================================ */
  /* Ash Road -- up to Ashvale                                         */
  /* ================================================================ */
  A.register({
    id: 'ashRoad',
    name: 'The Ash Road',
    sub: 'up, and colder',
    warp: true, respawn: 'ashRoad',
    cell: 2,
    size: { x0: -40, z0: -50, w: 80, d: 100 },
    groundMats: ['grassAsh', 'dirtRed', 'rockAsh', 'snow'],
    surfaces: ['dirt', 'dirt', 'stone', 'snow'],
    terrain: K.rolling({
      seed: 53, amp: 3.0, scale: 0.02, base: 0, baseMat: 0,
      paths: [{ pts: [0, 46, 4, 10, -4, -20, 0, -46], w: 3.4, mat: 1 }],
      extra: function (x, z, h) {
        /* the road climbs steadily northwards */
        var climb = M.saturate((-z + 46) / 92) * 16;
        var edge = Math.max(0, (Math.abs(x) - 22) / 14);
        var hh = h + climb + edge * edge * 24;
        var t = null;
        if (edge > 0.2) t = 2;
        else if (climb > 11) t = 3;
        return { h: hh, t: t === null ? undefined : t };
      }
    }),
    env: K.env.ash({ music: 'mountain' }),
    build: function (ctx) {
      var g = ctx.game, w = ctx.world;
      var off = function (x, z) { return K.distToPath(x, z, [0, 46, 4, 10, -4, -20, 0, -46]) > 4.6; };
      K.scatter({ seed: 55, count: 46, x0: -34, x1: 34, z0: -44, z1: 44, minDist: 4.2, filter: off },
        function (x, z, rng) {
          if (z < -10) P.deadTree(ctx.batch, x, w.groundHeight(x, z), z, { scale: rng.range(0.8, 1.4) });
          else P.pine(ctx.batch, x, w.groundHeight(x, z), z, { scale: rng.range(0.8, 1.3), leafColor: 0x8a9a88 });
        });
      K.rocks(ctx, { seed: 56, count: 40, x0: -34, x1: 34, z0: -44, z1: 44, minDist: 3.6,
        mat: 'rockAsh', filter: off });
      K.grassField(ctx, { seed: 57, count: 60, x0: -34, x1: 34, z0: 0, z1: 44, cuttable: 0.3,
        mat: 'grassbladeDry', filter: off });

      K.sign(ctx, 3, 38, 'north - Ashvale (steep)\nsouth - the green country', 0);
      K.hintStone(ctx, -6, 0, 'Fire does not mind the cold. Bring some with you.');

      if (!g.inv.flag('hp_ashroad')) {
        var hx = -16, hz = -30;
        P.cliff(ctx.batch, hx, w.groundHeight(hx, hz), hz, 5, 4.2, 5, { mat: 'rockAsh', layers: 2 });
        K.chest(ctx, hx, hz, 'heartPiece', { flag: 'hp_ashroad', y: w.groundHeight(hx, hz) + 4.2 });
        ctx.spawn(new LZ.Climb(ctx.game, {
          x: hx, y: w.groundHeight(hx, hz), z: hz + 2.6, yaw: 0,
          top: w.groundHeight(hx, hz) + 4.2, bottom: w.groundHeight(hx, hz)
        }));
        var lm = ctx.batch.mb('planksDark');
        lm.setColorHex(0xffffff);
        for (var r = 0; r < 8; r++) lm.box(hx, w.groundHeight(hx, hz) + 0.3 + r * 0.5, hz + 2.6, 0.9, 0.09, 0.09, 2);
        lm.box(hx - 0.42, w.groundHeight(hx, hz) + 2.1, hz + 2.6, 0.09, 4.2, 0.09, 2);
        lm.box(hx + 0.42, w.groundHeight(hx, hz) + 2.1, hz + 2.6, 0.09, 4.2, 0.09, 2);
      }

      ctx.entry('default', 0, undefined, 40, Math.PI);
      ctx.entry('fromNorth', 0, undefined, -44, Math.PI);
      ctx.entry('fromSouth', 0, undefined, 44, 0);
      K.edgeExit(ctx, 'n', 'ashvale', 'default', { at: 0, span: 10 });
      K.edgeExit(ctx, 's', 'yeld', 'fromEast', { at: 0, span: 10 });

      K.enemies(ctx, [
        { id: 'emberBeetle', x: -10, z: -20 }, { id: 'emberBeetle', x: -12, z: -22 },
        { id: 'wolfos', x: 12, z: -10, variant: 'white' },
        { id: 'keese', x: -8, z: 12, element: 'fire' },
        { id: 'moblin', x: 8, z: 26 }
      ]);
    }
  });

  /* ================================================================ */
  /* Elderwood -- the forest                                           */
  /* ================================================================ */
  A.register({
    id: 'elderwood',
    name: 'The Elderwood',
    sub: 'older than the kingdom',
    warp: true, respawn: 'elderwood',
    cell: 2,
    size: { x0: -46, z0: -46, w: 92, d: 92 },
    groundMats: ['grassDark', 'dirt', 'rock', 'grassLush'],
    surfaces: ['grass', 'dirt', 'stone', 'grass'],
    eras: true,
    terrain: function (x, z, era) {
      var base = M.fbm2(x * 0.022, z * 0.022, 4, era === 'past' ? 91 : 61);
      var h = (base - 0.5) * 5;
      var t = 0;
      var d = K.distToPath(x, z, [40, 6, 10, 2, -6, -8, -30, -20]);
      if (d < 3.4) { h = M.lerp(h, 0, 0.85); t = 1; }
      var edge = Math.max(0, (Math.max(Math.abs(x), Math.abs(z)) - 32) / 12);
      if (edge > 0) { h += edge * edge * 20; t = 2; }
      if (era === 'past' && x < -6 && z > 4) t = 3;
      return { h: h, t: t };
    },
    env: function (era) {
      return era === 'past'
        ? K.env.day({ music: 'forest', sky: 'skyDay' })
        : {
            sky: 'skyStorm',
            fog: { color: [0.22, 0.28, 0.24], near: 12, far: 62, density: 1 },
            light: { ambient: [0.30, 0.34, 0.30], dir0: [0.3, 0.8, 0.2], col0: [0.40, 0.44, 0.36],
                     dir1: [-0.3, 0.4, -0.5], col1: [0.14, 0.18, 0.16] },
            music: 'forest'
          };
    },
    build: function (ctx) {
      var g = ctx.game, w = ctx.world, past = ctx.era === 'past';
      var off = function (x, z) { return K.distToPath(x, z, [40, 6, 10, 2, -6, -8, -30, -20]) > 4; };

      K.forest(ctx, {
        seed: past ? 71 : 72, count: past ? 120 : 100, x0: -40, x1: 40, z0: -40, z1: 40,
        minDist: 3.4, kind: 'mixed', filter: off,
        leafMat: past ? 'leaves' : 'leavesDead',
        leafColor: past ? 0xffffff : 0xa8a090
      });
      K.grassField(ctx, {
        seed: 73, count: 120, x0: -40, x1: 40, z0: -40, z1: 40, cuttable: 0.3,
        mat: past ? 'grassblade' : 'grassbladeDry', filter: off
      });
      K.rocks(ctx, { seed: 74, count: 22, x0: -40, x1: 40, z0: -40, z1: 40, minDist: 5, filter: off });
      K.scatter({ seed: 75, count: 26, x0: -38, x1: 38, z0: -38, z1: 38, minDist: 4, filter: off },
        function (x, z, rng) {
          P.mushroom(ctx.batch, x, w.groundHeight(x, z), z,
            { scale: rng.range(0.7, 1.5), color: past ? 0xc45048 : 0x8a7a6a });
        });

      /* the grove entrance: a great hollow tree */
      var gx = -12, gz = -14, gy = w.groundHeight(gx, gz);
      var mb = ctx.batch.mb('bark');
      mb.setColorHex(past ? 0x8a6a44 : 0x6a5a4a);
      mb.cylinder(gx, gy, gz, 3.4, 2.8, 8.5, 10, false, 0.8);
      ctx.col.add(C.box(gx - 2.4, gy + 3, gz + 1.6, 1.2, 3, 1.6, {}));
      ctx.col.add(C.box(gx + 2.4, gy + 3, gz + 1.6, 1.2, 3, 1.6, {}));
      ctx.col.add(C.box(gx, gy + 3, gz - 2.6, 3, 3, 1.0, {}));
      ctx.col.add(C.box(gx - 3.0, gy + 3, gz, 0.8, 3, 2.6, {}));
      ctx.col.add(C.box(gx + 3.0, gy + 3, gz, 0.8, 3, 2.6, {}));
      var lm = ctx.batch.mb(past ? 'leaves' : 'leavesDead');
      lm.setColorHex(past ? 0xffffff : 0xa09888);
      lm.sphere(gx, gy + 9.5, gz, 5.2, 9, 5, 0.8);
      K.door(ctx, {
        x: gx, z: gz + 2.9, to: 'grove', entry: 'default', label: 'Enter the Grove',
        cond: function (gg) { return gg.inv.flag('worldHostile'); },
        denyText: 'The bark has grown over the opening.\nIt will not open until the wood has a reason to be\nafraid.'
      });

      K.sign(ctx, 20, 4, past ? 'A young sign, freshly cut.\n  east - the plains'
                              : 'The lettering has rotted away.\n  east - the plains', -1.4);
      K.hintStone(ctx, 4, -4, past
        ? 'Plant something here and it will be waiting for you\nin sixty years.'
        : 'Something was planted here a long time ago.\nIt has been waiting.');

      /* the time-travel seed puzzle: plant in the past, harvest in the present */
      if (past && !g.inv.flag('grovePlanted')) {
        var sd = ctx.spawn(new LZ.Actor({ kind: 'soil', x: 8, y: w.groundHeight(8, -22), z: -22, radius: 1.0, height: 0.4 }));
        sd.interactable = true;
        sd.interactRange = 1.6;
        sd.actionLabel = 'Plant';
        sd.castShadow = false;
        sd.update = function () { };
        sd.draw = function (gg) { gg.effects.pointLight(this.pos[0], this.pos[1] + 0.3, this.pos[2], [0.5, 0.9, 0.4], 1.0); };
        sd.drawShadow = function () { };
        sd.act = function (gg) {
          gg.inv.setFlag('grovePlanted');
          gg.audio.sfx('secret');
          gg.hud.toast('You press a seed into the soft ground.');
          gg.dialogue.say('You bury one of the grove seeds and pat the earth\nflat over it.\f'
            + 'Nothing happens. Nothing is going to happen for\nabout sixty years.');
          this.interactable = false;
          this.hidden = true;
        };
      }
      if (!past && g.inv.flag('grovePlanted') && !g.inv.flag('hp_grove')) {
        var tx = 8, tz = -22, tyy = w.groundHeight(tx, tz);
        P.tree(ctx.batch, tx, tyy, tz, { scale: 1.9, leafColor: 0xd8e090 });
        K.chest(ctx, tx + 2.4, tz, 'heartPiece', { flag: 'hp_grove', y: tyy });
      }

      ctx.entry('default', 34, undefined, 6, -Math.PI / 2);
      ctx.entry('fromEast', 40, undefined, 6, -Math.PI / 2);
      ctx.entry('fromGrove', gx, undefined, gz + 4.6, 0);
      K.edgeExit(ctx, 'e', 'yeld', 'fromWest', { at: 6, span: 10 });

      K.enemies(ctx, past ? [
        { id: 'keese', x: -20, z: 10 }, { id: 'chuchu', x: 16, z: -16, variant: 'green' }
      ] : [
        { id: 'skulltula', x: -20, z: 8 }, { id: 'skulltula', x: 14, z: -24 },
        { id: 'wolfos', x: -26, z: -6 }, { id: 'keese', x: 10, z: 14 },
        { id: 'moblin', x: 22, z: -12 }, { id: 'chuchu', x: -6, z: 24, variant: 'green' },
        { id: 'poe', x: 26, z: 24 }
      ]);
    }
  });

  /* ================================================================ */
  /* Lakeshore                                                         */
  /* ================================================================ */
  A.register({
    id: 'lakeshore',
    name: 'Lake Nial',
    sub: 'still, and very deep',
    warp: true, respawn: 'lakeshore',
    cell: 2,
    size: { x0: -46, z0: -46, w: 92, d: 92 },
    groundMats: ['grassLush', 'sand', 'rock', 'dirt'],
    surfaces: ['grass', 'sand', 'stone', 'dirt'],
    terrain: function (x, z) {
      var d = Math.sqrt(x * x + (z + 4) * (z + 4));
      var h;
      var t = 0;
      if (d < 24) { h = -3.4 + (d / 24) * 3.4; t = 1; }
      else { h = (d - 24) * 0.30 + (M.fbm2(x * 0.03, z * 0.03, 3, 83) - 0.5) * 2.2; t = 0; }
      var edge = Math.max(0, (Math.max(Math.abs(x), Math.abs(z)) - 32) / 12);
      if (edge > 0) { h += edge * edge * 20; t = 2; }
      return { h: h, t: t };
    },
    env: K.env.day({ music: 'lake' }),
    build: function (ctx) {
      var g = ctx.game, w = ctx.world;
      ctx.water(-25, -29, 25, 21, -0.4, 'deep');

      K.forest(ctx, { seed: 91, count: 40, x0: -42, x1: 42, z0: -42, z1: 42, minDist: 5,
        kind: 'mixed', filter: function (x, z) { return Math.sqrt(x * x + (z + 4) * (z + 4)) > 27; } });
      K.grassField(ctx, { seed: 92, count: 90, x0: -42, x1: 42, z0: -42, z1: 42, cuttable: 0.3,
        filter: function (x, z) { return Math.sqrt(x * x + (z + 4) * (z + 4)) > 26; } });
      K.scatter({ seed: 93, count: 30, x0: -30, x1: 30, z0: -34, z1: 26, minDist: 3,
        filter: function (x, z) {
          var d = Math.sqrt(x * x + (z + 4) * (z + 4));
          return d > 20 && d < 26;
        } }, function (x, z) { P.reeds(ctx.batch, x, w.groundHeight(x, z), z, {}); });

      /* the island temple entrance */
      var ix = 0, iz = -4;
      P.cliff(ctx.batch, ix, -3.4, iz, 9, 5.0, 9, { mat: 'stoneblock', layers: 2, taper: 0.18 });
      var mb = ctx.batch.mb('stoneblock');
      mb.setColorHex(0xd8d4c8);
      mb.box(ix, 2.4, iz - 3.2, 5.2, 3.2, 1.2, 1.0);
      ctx.col.add(C.box(ix - 2.1, 2.4, iz - 3.2, 1.0, 1.6, 0.6, {}));
      ctx.col.add(C.box(ix + 2.1, 2.4, iz - 3.2, 1.0, 1.6, 0.6, {}));
      ctx.col.add(C.box(ix, 3.6, iz - 3.2, 2.6, 0.6, 0.6, {}));
      P.pillar(ctx.batch, ix - 3.4, 1.6, iz + 1.4, 3.2, { mat: 'stoneblock' });
      P.pillar(ctx.batch, ix + 3.4, 1.6, iz + 1.4, 3.2, { mat: 'stoneblock' });
      K.door(ctx, {
        x: ix, y: 1.6, z: iz - 2.4, to: 'lakeTemple', entry: 'default', label: 'Enter the Temple',
        cond: function (gg) { return LZ.Kit.medallionCount(gg) >= 1; },
        denyText: 'The doors are sealed with water pressure alone.\nThe lake is still too frightened to let go.\n(Clear one other dungeon first.)'
      });

      K.npc(ctx, {
        x: -14, z: 20, yaw: -0.6, name: 'Nel of the Shallows', palette: 1, build: 'lanky',
        skin: 0x8ec8dc, cloth: 0x2f6a86, clothDark: 0x1e4a62, hair: 0x2f6a86, hairStyle: 'bald',
        skinTex: 'scaleBlue', clothTex: 'scaleBlue', portrait: S.PORTRAITS.zora,
        talk: function (gg) {
          if (gg.inv.medallions['lake']) {
            gg.dialogue.say('The lake sleeps properly again. Thank you.\fCome swim any time. The cold is good for you.',
              { speaker: 'Nel of the Shallows', portrait: S.PORTRAITS.zora });
            return;
          }
          gg.dialogue.say('Something under the water is singing and it will not\nstop.\f'
            + 'Every fish in the lake has swum to the shallows to\nget away from it.\f'
            + 'The temple door will not open while the lake is\nafraid.',
            { speaker: 'Nel of the Shallows', portrait: S.PORTRAITS.zora });
        }
      });

      K.sign(ctx, 30, 30, 'west - Yeld Plains\nsouth-east - the Hollow', -0.8);
      K.hintStone(ctx, 18, 24, 'Cold enough, and water will hold you up like a\nfloor.');

      if (!g.inv.flag('hp_lake')) {
        K.chest(ctx, -26, -26, 'heartPiece', { flag: 'hp_lake', y: w.groundHeight(-26, -26) });
      }

      ctx.entry('default', -34, undefined, 24, 1.0);
      ctx.entry('fromWest', -40, undefined, -10, Math.PI / 2);
      ctx.entry('fromTemple', ix, 1.6, iz + 0.5, 0);
      K.edgeExit(ctx, 'w', 'yeld', 'fromEast', { at: -10, span: 10 });
      K.edgeExit(ctx, 's', 'hollow', 'fromNorth', { at: 20, span: 9 });

      K.enemies(ctx, [
        { id: 'octorok', x: -18, z: 14 }, { id: 'octorok', x: 20, z: 12 },
        { id: 'tektite', x: -24, z: -18 }, { id: 'keese', x: 14, z: -28 },
        { id: 'chuchu', x: 28, z: 8, variant: 'blue' }
      ]);
    }
  });

  /* ================================================================ */
  /* The Hollow -- graveyard                                           */
  /* ================================================================ */
  A.register({
    id: 'hollow',
    name: 'The Hollow',
    sub: 'where Farrow buries its own',
    warp: true, respawn: 'hollow',
    cell: 2,
    size: { x0: -38, z0: -40, w: 76, d: 80 },
    groundMats: ['grassDark', 'dirt', 'rockDark', 'grassAsh'],
    surfaces: ['grass', 'dirt', 'stone', 'dirt'],
    terrain: K.basin({
      seed: 101, amp: 1.4, scale: 0.03, base: 0, inner: 24, outer: 36, wall: 16, wallMat: 2, baseMat: 0,
      paths: [{ pts: [0, 36, 0, -20], w: 2.8, mat: 1 }]
    }),
    env: K.env.night({ music: 'shadow' }),
    build: function (ctx) {
      var g = ctx.game, w = ctx.world;

      /* rows of graves */
      for (var row = 0; row < 5; row++) {
        for (var col = 0; col < 6; col++) {
          var gx = -13 + col * 5.2 + (row % 2) * 1.2;
          var gz = -12 + row * 5.4;
          if (Math.abs(gx) < 2.4) continue;
          P.gravestone(ctx.batch, gx, w.groundHeight(gx, gz), gz, {
            yaw: (M.hash2(row, col, 7) - 0.5) * 0.5,
            style: (row + col) % 4 === 0 ? 'cross' : 'stone'
          });
        }
      }
      /* the Hero's grave, at the head of the rows */
      var hx = 0, hz = -17, hy = w.groundHeight(hx, hz);
      P.gravestone(ctx.batch, hx, hy, hz, { yaw: 0, style: 'stone', color: 0xd8d4c8 });
      P.pillar(ctx.batch, hx - 2.2, hy, hz, 2.6, { mat: 'stoneblock' });
      P.pillar(ctx.batch, hx + 2.2, hy, hz, 2.6, { mat: 'stoneblock' });
      var hero = ctx.spawn(new LZ.Sign(ctx.game, {
        x: hx, y: hy, z: hz + 1.0,
        text: 'HERE LIES THE ONE WHO WOULD NOT SAY WHAT HE HAD\nBEEN.\f'
            + 'His wife is beside him. She would not say either.\f'
            + '(There is fresh earth. The stone is not weathered\nat all.)'
      }));
      hero.actionLabel = 'Pay respects';

      P.deadTree(ctx.batch, -10, w.groundHeight(-10, -8), -8, { scale: 1.5 });
      P.deadTree(ctx.batch, 12, w.groundHeight(12, -4), -4, { scale: 1.3 });
      K.scatter({ seed: 103, count: 24, x0: -30, x1: 30, z0: -32, z1: 32, minDist: 4,
        filter: function (x, z) { return Math.abs(x) > 16 || Math.abs(z) > 18; } },
        function (x, z, rng) { P.deadTree(ctx.batch, x, w.groundHeight(x, z), z, { scale: rng.range(0.7, 1.3) }); });
      for (var t = 0; t < 4; t++) {
        K.torch(ctx, [-4, 4, -4, 4][t], [-8, -8, 8, 8][t], { lit: true });
      }

      /* the crypt door: opens once the seal-song is known */
      var cx = 0, cz = -26, cy = w.groundHeight(cx, cz);
      var mb = ctx.batch.mb('stoneblockDark');
      mb.setColorHex(0xffffff);
      mb.box(cx, cy + 2.4, cz - 1.0, 7, 4.8, 3, 1.0);
      ctx.col.add(C.box(cx - 2.6, cy + 2.4, cz, 1.9, 2.4, 2, {}));
      ctx.col.add(C.box(cx + 2.6, cy + 2.4, cz, 1.9, 2.4, 2, {}));
      ctx.col.add(C.box(cx, cy + 3.8, cz, 3, 1.0, 2, {}));
      P.arch(ctx.batch, cx, cy, cz + 1.2, 2.2, 2.6, { mat: 'stoneblockDark' });
      K.door(ctx, {
        x: cx, z: cz + 1.6, to: 'crypt', entry: 'default', label: 'Enter the Crypt',
        cond: function (gg) { return LZ.Kit.medallionCount(gg) >= 2; },
        denyText: 'The crypt is sealed. Whatever is inside was put\nthere on purpose.\n(Two seals elsewhere must fall first.)'
      });

      K.npc(ctx, {
        x: -8, z: 8, yaw: 1.0, name: 'The Gravekeeper', palette: 5, build: 'lanky',
        hairStyle: 'long', hair: 0x8a8478, portrait: S.PORTRAITS.keeper,
        talk: function (gg) {
          if (!gg.inv.hasSong('dirgeOfTheSeal')) {
            gg.dialogue.say('You are his. I can see it from here.\f'
              + 'He came up every spring to tend her stone and he\nhummed the same six notes the whole time.\f'
              + 'I listened for forty years. I can give them back\nto you.',
              { speaker: 'The Gravekeeper', portrait: S.PORTRAITS.keeper,
                onDone: function () { gg.giveSong('dirgeOfTheSeal'); gg.inv.setFlag('done_sq_gravekeeper'); } });
            return;
          }
          gg.dialogue.say('Stones have been moving on their own down the east\nrow.\f'
            + 'I do not go down the east row any more.',
            { speaker: 'The Gravekeeper', portrait: S.PORTRAITS.keeper });
        }
      });

      K.sign(ctx, 3, 30, 'THE HOLLOW\n  Quiet, please. They can hear you.', 0);
      K.hintStone(ctx, 10, 16, 'The dead do not mind the living. They mind being\nlooked at without a lens.');

      if (!g.inv.flag('hp_hollow')) {
        K.chest(ctx, -22, -22, 'heartPiece', { flag: 'hp_hollow', y: w.groundHeight(-22, -22) });
      }

      ctx.entry('default', 0, undefined, 30, Math.PI);
      ctx.entry('fromNorth', 0, undefined, 34, Math.PI);
      ctx.entry('fromCrypt', cx, undefined, cz + 3.4, 0);
      K.edgeExit(ctx, 'n', 'lakeshore', 'default', { at: 0, span: 9 });
      K.edgeExit(ctx, 's', 'fortressApproach', 'fromNorth', { at: 0, span: 9,
        cond: function (gg) { return LZ.Kit.medallionCount(gg) >= 5; } });

      K.enemies(ctx, [
        { id: 'poe', x: -14, z: -2 }, { id: 'poe', x: 16, z: 6 },
        { id: 'gibdo', x: 10, z: -12 }, { id: 'gibdo', x: -12, z: -14 },
        { id: 'keese', x: 6, z: 18 }, { id: 'stalfos', x: -18, z: 16 }
      ]);
    }
  });

  /* ================================================================ */
  /* Fortress approach                                                 */
  /* ================================================================ */
  A.register({
    id: 'fortressApproach',
    name: 'The Broken Reach',
    sub: 'what he has made of the south',
    warp: true, respawn: 'fortressApproach',
    cell: 2,
    size: { x0: -34, z0: -46, w: 68, d: 92 },
    groundMats: ['rockDark', 'dirtRed', 'rockAsh', 'lava'],
    surfaces: ['stone', 'dirt', 'stone', 'stone'],
    terrain: K.rolling({
      seed: 111, amp: 2.6, scale: 0.03, base: 0, baseMat: 0,
      paths: [{ pts: [0, 42, 0, -40], w: 4.2, mat: 1 }],
      extra: function (x, z, h) {
        var edge = Math.max(0, (Math.abs(x) - 18) / 12);
        if (edge > 0) return { h: h + edge * edge * 26, t: 2 };
        return null;
      }
    }),
    env: K.env.storm({ music: 'genmo' }),
    build: function (ctx) {
      var g = ctx.game, w = ctx.world;
      K.rocks(ctx, { seed: 112, count: 44, x0: -28, x1: 28, z0: -40, z1: 40, minDist: 3.4,
        mat: 'rockDark', filter: function (x, z) { return Math.abs(x) > 5; } });
      K.scatter({ seed: 113, count: 16, x0: -26, x1: 26, z0: -40, z1: 40, minDist: 7,
        filter: function (x, z) { return Math.abs(x) > 7; } },
        function (x, z, rng) {
          P.cliff(ctx.batch, x, w.groundHeight(x, z), z, rng.range(3, 7), rng.range(5, 11), rng.range(3, 7),
            { mat: 'rockDark', layers: 3, yaw: rng.range(0, 3) });
        });
      for (var t = 0; t < 8; t++) {
        K.torch(ctx, t % 2 ? -4 : 4, -32 + t * 8, { lit: true });
      }

      /* the gate */
      var fx = 0, fz = -38, fy = w.groundHeight(fx, fz);
      var mb = ctx.batch.mb('stoneblockDark');
      mb.setColorHex(0x6a6472);
      mb.box(fx, fy + 6, fz - 3, 22, 12, 6, 0.8);
      ctx.col.add(C.box(fx - 6.6, fy + 6, fz, 4.4, 6, 3, {}));
      ctx.col.add(C.box(fx + 6.6, fy + 6, fz, 4.4, 6, 3, {}));
      ctx.col.add(C.box(fx, fy + 8.4, fz, 2.2, 3.6, 3, {}));
      P.statue(ctx.batch, fx - 4.4, fy, fz + 2.6, { yaw: 0.3, mat: 'stoneblockDark' });
      P.statue(ctx.batch, fx + 4.4, fy, fz + 2.6, { yaw: -0.3, mat: 'stoneblockDark' });
      K.door(ctx, { x: fx, z: fz + 2.2, to: 'fortress', entry: 'default', label: 'Enter the Fortress' });

      K.sign(ctx, 5, 20, 'Someone has scratched over the old milestone:\n"COME ON THEN"', 0);
      K.hintStone(ctx, -6, 8, 'He is not hiding. He is waiting. Those are\ndifferent and he wants you to know it.');

      ctx.entry('default', 0, undefined, 36, Math.PI);
      ctx.entry('fromNorth', 0, undefined, 40, Math.PI);
      ctx.entry('fromFortress', fx, undefined, fz + 5, 0);
      K.edgeExit(ctx, 'n', 'hollow', 'default', { at: 0, span: 9 });

      K.enemies(ctx, [
        { id: 'moblin', x: -8, z: 20, big: true }, { id: 'moblin', x: 8, z: 12 },
        { id: 'stalfos', x: -6, z: -6 }, { id: 'stalfos', x: 7, z: -14 },
        { id: 'wolfos', x: -12, z: -22 }, { id: 'poe', x: 12, z: -26 },
        { id: 'keese', x: 0, z: 0 }
      ]);
    }
  });

  LZ.OverworldLoaded = true;
})(LZ);
