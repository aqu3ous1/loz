/* =============================================================
   game/areas/towns.js -- settlements and interiors.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var M = LZ.M, K = LZ.Kit, P = LZ.Props, C = LZ.Collision, A = LZ.Areas, S = LZ.Script;

  function line(name, key, i) {
    var set = S.LINES[key];
    var e = set[i % set.length];
    return { name: e[0], lines: e[1] };
  }

  /* ================================================================ */
  /* Link's house -- the prologue                                      */
  /* ================================================================ */
  A.register({
    id: 'linkHouse',
    name: "Great-Grandfather's House",
    quiet: true,
    cell: 1,
    size: { x0: -7, z0: -7, w: 14, d: 14 },
    groundMats: ['planks'],
    terrain: K.flat(0, 0),
    env: K.env.interior({ ambient: [0.40, 0.36, 0.34] }),
    build: function (ctx) {
      var g = ctx.game;
      K.interiorShell(ctx, { w: 10, d: 9, h: 3.0, exitTo: 'farrow', exitEntry: 'fromHouse',
        floor: 'planks', wall: 'plaster', wallColor: 0xd8c8a8 });

      /* the bed, against the far wall */
      P.bed(ctx.batch, -1.8, 0, -2.4, { yaw: Math.PI / 2, sheet: 'clothWhite' });
      /* a blanket drawn up over his legs, so the bed reads as occupied */
      var bl = ctx.batch.mb('clothBrown');
      bl.setColorHex(0xa8886a);
      /* the bed is yawed a quarter turn, so its length runs along world x
         from about -2.87 to -0.73; the blanket covers the foot half only */
      bl.tube([
        { x: -1.90, y: 0.52, z: -2.40, ry: 0.13, rz: 0.50 },
        { x: -1.55, y: 0.57, z: -2.40, ry: 0.18, rz: 0.52 },
        { x: -1.05, y: 0.57, z: -2.42, ry: 0.18, rz: 0.52 },
        { x: -0.80, y: 0.50, z: -2.42, ry: 0.12, rz: 0.48 }
      ], 8, { axis: 'x' });
      P.table(ctx.batch, 2.2, 0, -1.6, { w: 1.2, d: 0.8 });
      P.chair(ctx.batch, 2.2, 0, -0.5, { yaw: 0 });
      P.barrel(ctx.batch, 3.6, 0, 2.4, { scale: 0.9 });
      P.crate(ctx.batch, -3.6, 0, 2.6, { scale: 0.8 });
      /* a shuttered window on the west wall, with evening light coming in */
      var wm2 = ctx.batch.mb('planksDark');
      wm2.setColorHex(0x6a5236);
      wm2.box(-4.94, 1.85, 0.6, 0.10, 1.05, 1.35, 2);
      wm2.setColorHex(0xd8b878);
      wm2.box(-4.86, 1.85, 0.6, 0.04, 0.86, 1.14, 2);
      wm2.setColorHex(0x6a5236);
      wm2.box(-4.84, 1.85, 0.6, 0.06, 0.90, 0.07, 2);
      wm2.box(-4.84, 1.85, 0.6, 0.06, 0.07, 1.18, 2);
      K.torch(ctx, -4.4, -2.4, { y: 1.5, h: 0.4, lit: true });

      /* hearth */
      var mb = ctx.batch.mb('brick');
      mb.setColorHex(0xffffff);
      mb.box(4.2, 0.7, -1.0, 0.6, 1.4, 2.0, 1.4);
      ctx.col.add(C.box(4.2, 0.7, -1.0, 0.3, 0.7, 1.0, {}));
      K.torch(ctx, 4.0, -1.0, { y: 0.6, h: 0.5, lit: true });

      /* old Link in the bed */
      var link = K.npc(ctx, {
        /* on the mattress, not in it: the lie clip drops the body to about
           0.1 above its own origin, and the bed's sheet sits at 0.51 */
        x: -1.8, z: -2.4, y: 0.44, yaw: Math.PI / 2, name: 'Link',
        build: 'old', scale: 1.0, palette: 4,
        cloth: 0x4a7a52, clothDark: 0x2f5a3a, skin: 0xd8bfa4,
        hair: 0xe4e0d4, hairStyle: 'long', hat: 'none', beard: true, beardColor: 0xe4e0d4,
        idle: 'lie', collide: false, lookAt: false,
        talk: function (gg) {
          if (!gg.inv.flag('heardLink')) { S.prologue(gg); return; }
          if (!gg.inv.flag('gotRustySword')) {
            gg.dialogue.say('The chest, ' + gg.inv.playerName + '. At the foot of the bed.\fMy hands are done with it.',
              { speaker: 'Link' });
            return;
          }
          gg.dialogue.say('Go on, then.\fI would like the last thing I see to be you\nwalking out of a door.',
            { speaker: 'Link' });
        }
      });
      link.tagName = 'Link';
      link.name = 'Link';

      /* the chest with the old gear */
      K.chest(ctx, -1.8, 0.4, 'rustySword', {
        flag: 'gotRustySword', y: 0,
        onOpen: function (gg) {
          gg.inv.addShield('woodShield');
          gg.inv.equippedShield = 0;
          gg.hud.toast('Got: Wooden Shield');
          gg.inv.setFlag('gotRustySword');
        }
      });

      K.sign(ctx, 3.4, 3.0, 'A shelf of fishing lures, none of them used\nin twenty years.', Math.PI);

      ctx.entry('start', -0.6, 0, 1.2, Math.PI + 0.4);
      ctx.entry('default', 0, 0, 3.2, Math.PI);
    }
  });

  /* ================================================================ */
  /* Farrow Village                                                    */
  /* ================================================================ */
  A.register({
    id: 'farrow',
    name: 'Farrow Village',
    sub: 'where the Hero went to be nobody',
    warp: true,
    respawn: 'farrow',
    cell: 2,
    size: { x0: -46, z0: -46, w: 92, d: 92 },
    groundMats: ['grass', 'dirt', 'cobble', 'rock'],
    surfaces: ['grass', 'dirt', 'stone', 'stone'],
    terrain: K.basin({
      seed: 3, amp: 1.1, scale: 0.02, base: 0, inner: 33, outer: 46, wall: 12, wallMat: 3,
      paths: [
        { pts: [0, -22, 0, 6, 4, 20, 6, 44], w: 3.2, h: 0.1, mat: 2 },
        { pts: [-16, 2, 16, 2], w: 2.4, h: 0.2, mat: 1 }
      ]
    }),
    env: K.env.day({ music: 'village' }),
    build: function (ctx) {
      var g = ctx.game, w = ctx.world;

      /* Link's house at the head of the lane */
      var h1 = P.house(ctx.batch, 0, w.groundHeight(0, -18), -18, {
        w: 6, d: 5.4, h: 3.0, yaw: 0, wall: 'plaster', wallColor: 0xe0d0b0,
        roof: 'thatch', trim: 'planksDark', roofH: 1.7
      });
      K.groundShadow(ctx, 0, -18, 4.0, 3.6, { strength: 0.34 });
      K.door(ctx, { x: h1.doorX, z: h1.doorZ, yaw: h1.doorYaw, to: 'linkHouse', entry: 'default', label: 'Enter' });

      /* neighbours */
      var houses = [
        [-11, -6, 0.5], [12, -4, -0.6], [-13, 9, 0.2], [11, 11, -0.3], [-2, 16, 3.0]
      ];
      for (var i = 0; i < houses.length; i++) {
        var hx = houses[i][0], hz = houses[i][1];
        K.groundShadow(ctx, hx, hz, 3.6, 3.3, { strength: 0.34 });
        var nh = P.house(ctx.batch, hx, w.groundHeight(hx, hz), hz, {
          w: 5 + (i % 2), d: 4.6, h: 2.8, yaw: houses[i][2],
          wall: 'plaster', wallColor: [0xe0d0b0, 0xd8ccb8, 0xe8dcc0][i % 3],
          roof: i % 2 ? 'shingleRed' : 'thatch', trim: 'planksDark', roofH: 1.5
        });
        /* every door in this town leads somewhere */
        var nid = LZ.Homes.farrow[i];
        K.door(ctx, { x: nh.doorX, z: nh.doorZ, yaw: nh.doorYaw, to: nid, entry: 'default',
          label: LZ.Homes.name(nid) });
      }

      K.groundShadow(ctx, 4, 2, 1.4, 1.4, { strength: 0.36 });
      P.well(ctx.batch, 4, w.groundHeight(4, 2), 2);
      P.fence(ctx.batch, -22, -14, -22, 14, w.groundHeight(-22, 0), {});
      P.fence(ctx.batch, 22, -14, 22, 14, w.groundHeight(22, 0), {});
      P.stall(ctx.batch, -6, w.groundHeight(-6, 6), 6, { yaw: 0.6, awning: 'clothRed' });

      K.forest(ctx, { seed: 12, count: 74, x0: -44, x1: 44, z0: -44, z1: 44, minDist: 4.5,
        kind: 'mixed', filter: function (x, z) {
          return Math.abs(x) > 16 || Math.abs(z) > 22;
        } });
      K.grassField(ctx, { seed: 5, count: 130, x0: -40, x1: 40, z0: -40, z1: 40,
        cuttable: 0.30, filter: function (x, z) { return Math.abs(x) > 7 || Math.abs(z) > 8; } });
      K.rocks(ctx, { seed: 8, count: 14, x0: -40, x1: 40, z0: -40, z1: 40, minDist: 6 });

      /* villagers */
      for (var n = 0; n < 4; n++) {
        var L = line('', 'farrow', n);
        var px = [-8, 8, -4, 14][n], pz = [4, 8, 14, -2][n];
        K.npc(ctx, {
          x: px, z: pz, name: L.name, lines: L.lines, palette: n + 1,
          build: n === 3 ? 'child' : 'adult', wander: 3.2,
          hairStyle: n % 2 ? 'ponytail' : 'short'
        });
      }

      /* grandmother, standing where she always stands */
      K.npc(ctx, {
        x: 2.6, z: -14, yaw: 2.4, name: 'Grandmother', palette: 5,
        build: 'adult', hair: 0xd8d4cc, hairStyle: 'long',
        talk: function (gg) {
          if (!gg.inv.flag('gotRustySword')) {
            gg.dialogue.say('He has been waiting for you since sunrise.\fGo in. Do not make him wait for the part he has\nbeen rehearsing.',
              { speaker: 'Grandmother' });
          } else if (!gg.inv.visited['stonebell']) {
            gg.dialogue.say('South, then south again. Stonebell first, for the\nsmith.\f'
              + 'And ' + gg.inv.playerName + ' - the sword is not the\npoint. He gave you the sword so you would have a\nreason to come back and show him.',
              { speaker: 'Grandmother' });
          } else if (gg.inv.flag('heardOfDeath')) {
            gg.dialogue.say('I buried him in the Hollow, beside his wife.\fHe would not want you at the grave yet. He would\nwant you finishing it.',
              { speaker: 'Grandmother' });
          } else {
            gg.dialogue.say('Eat something before you go. You are all elbows.',
              { speaker: 'Grandmother' });
          }
        }
      });

      /* Village dressing. A screen of this game used to hold four objects
         and the games it is imitating hold thirty; most of the difference
         is stuff people put down and never picked up. */
      var dress = [
        ['woodpile', -8.6, -15.5, 0.3], ['woodpile', 13.6, -6.2, -1.1],
        ['sack', -6.2, -14.2, 0.5], ['sack', -5.6, -13.6, 2.1], ['sack', 9.2, 12.6, 0.8],
        ['sack', 5.6, -15.2, 1.4],
        ['crate', 6.8, 4.2, 0.4], ['crate', 7.4, 4.9, 1.9], ['crate', -14.6, 10.4, 0.2],
        ['barrel', -3.2, -16.0, 0], ['barrel', -2.4, -16.4, 0], ['barrel', 12.8, 12.4, 0],
        ['barrel', -12.2, -4.6, 0]
      ];
      for (var di = 0; di < dress.length; di++) {
        var dd = dress[di];
        var dy = w.groundHeight(dd[1], dd[2]);
        P[dd[0]](ctx.batch, dd[1], dy, dd[2], { yaw: dd[3], scale: 0.9 + (di % 3) * 0.08 });
        K.groundShadow(ctx, dd[1], dd[2], 0.62, 0.62, { strength: 0.34 });
      }
      P.cart(ctx.batch, 8.4, w.groundHeight(8.4, -1.2), -1.2, { yaw: 1.1 });
      K.groundShadow(ctx, 8.4, -1.2, 1.5, 1.2, { strength: 0.34 });
      P.laundry(ctx.batch, -10.4, w.groundHeight(-10.4, 12.2), 12.2, 4.4, { yaw: 0.4 });
      P.planter(ctx.batch, -1.7, w.groundHeight(-1.7, -15.3), -15.3, { yaw: 0 });
      P.planter(ctx.batch, 1.7, w.groundHeight(1.7, -15.3), -15.3, { yaw: 0, bloom: 0xc8d8f0 });
      /* a few lamp posts along the lane */
      var lamps = [[-3.4, 4], [3.4, 12], [-3.4, 20]];
      for (var li = 0; li < lamps.length; li++) {
        P.lampPost(ctx.batch, lamps[li][0], w.groundHeight(lamps[li][0], lamps[li][1]), lamps[li][1], {});
        K.groundShadow(ctx, lamps[li][0], lamps[li][1], 0.5, 0.5, { strength: 0.32 });
      }
      /* fences enclosing two of the yards */
      P.fence(ctx.batch, -16.5, 4.5, -16.5, 12.5, w.groundHeight(-16.5, 8), {});
      P.fence(ctx.batch, -16.5, 12.5, -9.5, 12.5, w.groundHeight(-13, 12.5), {});
      P.fence(ctx.batch, 16.5, 4.5, 16.5, 14.5, w.groundHeight(16.5, 9), {});

      K.sign(ctx, 2.2, 20, 'FARROW VILLAGE\n  south - Yeld Plains\n  Please close the gate.', Math.PI);
      K.hintStone(ctx, -6, -12, null);

      K.pots(ctx, [[5.4, -16], [6.4, -16], [-9.6, -4]]);

      /* heart piece: on the roof beam behind the well, reachable by hookshot */
      var hpFlag = 'hp_farrow';
      if (!g.inv.flag(hpFlag)) {
        K.chest(ctx, -13, 9 - 3.4, 'heartPiece', { flag: hpFlag, y: w.groundHeight(-13, 5.6) + 3.9 });
        var mb = ctx.batch.mb('planksDark');
        mb.setColorHex(0xffffff);
        mb.box(-13, w.groundHeight(-13, 5.6) + 3.6, 5.6, 2.4, 0.24, 1.6, 2);
        ctx.col.add(C.box(-13, w.groundHeight(-13, 5.6) + 3.6, 5.6, 1.2, 0.12, 0.8, { surface: 'wood' }));
      }

      ctx.entry('default', 0, undefined, -14, 0);
      ctx.entry('fromHouse', h1.doorX, undefined, h1.doorZ + 1.0, Math.PI);
      ctx.entry('fromSouth', 5, undefined, 40, Math.PI);
      K.edgeExit(ctx, 's', 'yeld', 'fromNorth', { at: 5, span: 10 });

      if (g.inv.flag('worldHostile')) {
        K.enemies(ctx, [
          { id: 'chuchu', x: -26, z: 20 }, { id: 'chuchu', x: 28, z: -18, variant: 'green' },
          { id: 'keese', x: 20, z: 26 }
        ]);
      }
    }
  });

  /* ================================================================ */
  /* Stonebell Town                                                    */
  /* ================================================================ */
  A.register({
    id: 'stonebell',
    name: 'Stonebell',
    sub: 'town of two smiths and one broken clock',
    warp: true,
    respawn: 'stonebell',
    cell: 2,
    size: { x0: -44, z0: -44, w: 88, d: 88 },
    groundMats: ['cobble', 'dirt', 'grass', 'rock'],
    surfaces: ['stone', 'dirt', 'grass', 'stone'],
    terrain: K.basin({
      seed: 21, amp: 0.7, scale: 0.02, base: 0, inner: 28, outer: 42, wall: 14, wallMat: 3, baseMat: 0,
      paths: [{ pts: [0, -40, 0, 40], w: 4.0, h: 0, mat: 0 },
              { pts: [-30, 0, 30, 0], w: 3.4, h: 0, mat: 0 }]
    }),
    env: K.env.day({ music: 'town' }),
    build: function (ctx) {
      var g = ctx.game, w = ctx.world;

      /* the clock tower */
      var tx = 0, tz = -20;
      var ty = w.groundHeight(tx, tz);
      /* The tower is the town's landmark and was a plain box with a
         four-sided pyramid on it. It now reads as masonry: a plinth, a
         shaft that batters inwards, string courses, arched openings on
         every face, a corbelled cornice and an eight-sided spire. */
      var mb = ctx.batch.mb('stoneblockWarm');
      mb.setColorHex(0xffffff);
      /* plinth */
      mb.tube([
        { y: ty - 0.1, rx: 3.8, rz: 3.8 },
        { y: ty + 0.5, rx: 3.7, rz: 3.7 },
        { y: ty + 0.7, rx: 3.4, rz: 3.4 }
      ], 4, { u: 3, v: 1.4, capStart: false, capEnd: false });
      /* shaft, battered slightly inwards as real towers are */
      mb.tube([
        { y: ty + 0.7, rx: 3.35, rz: 3.35 },
        { y: ty + 4.2, rx: 3.15, rz: 3.15 },
        { y: ty + 7.6, rx: 3.00, rz: 3.00 },
        { y: ty + 9.9, rx: 2.92, rz: 2.92 }
      ], 4, { u: 3, v: 3, capStart: false, capEnd: false });
      /* string courses */
      mb.setColorHex(0xe8dcc0);
      for (var sc = 0; sc < 2; sc++) {
        var scy = ty + 4.0 + sc * 3.6;
        mb.tube([
          { y: scy, rx: 3.26 - sc * 0.12, rz: 3.26 - sc * 0.12 },
          { y: scy + 0.34, rx: 3.30 - sc * 0.12, rz: 3.30 - sc * 0.12 },
          { y: scy + 0.44, rx: 3.18 - sc * 0.12, rz: 3.18 - sc * 0.12 }
        ], 4, { u: 3, v: 1, capStart: false, capEnd: false });
      }
      /* corbelled cornice under the spire */
      mb.tube([
        { y: ty + 9.9, rx: 2.92, rz: 2.92 },
        { y: ty + 10.2, rx: 3.30, rz: 3.30 },
        { y: ty + 10.7, rx: 3.55, rz: 3.55 },
        { y: ty + 11.0, rx: 3.40, rz: 3.40 }
      ], 4, { u: 3, v: 1.6, capStart: false });
      /* arched openings, two per face, sunk into the shaft */
      var dk = ctx.batch.mb('stoneblockDark');
      dk.setColorHex(0x50483c);
      for (var f = 0; f < 4; f++) {
        var a = f * Math.PI / 2;
        var nx = Math.sin(a), nz = Math.cos(a);
        for (var oi = -1; oi <= 1; oi += 2) {
          var ox = -nz * oi * 1.05, oz = nx * oi * 1.05;
          dk.tube([
            { x: tx + ox + nx * 2.7, y: ty + 6.4, z: tz + oz + nz * 2.7, rx: 0.42, ry: 0.95 },
            { x: tx + ox + nx * 3.15, y: ty + 6.4, z: tz + oz + nz * 3.15, rx: 0.40, ry: 0.90 }
          ], 7, { axis: f % 2 ? 'x' : 'z', u: 1, v: 1 });
        }
      }
      /* spire: eight sides, with a finial */
      var rf = ctx.batch.mb('shingleGrey');
      rf.setColorHex(0xffffff);
      rf.tube([
        { y: ty + 11.0, r: 3.30 },
        { y: ty + 12.0, r: 2.55 },
        { y: ty + 13.4, r: 1.55 },
        { y: ty + 14.6, r: 0.62 },
        { y: ty + 15.1, r: 0.06 }
      ], 8, { u: 4, v: 2.4, capStart: false });
      var gm2 = ctx.batch.mb('gold');
      gm2.setColorHex(0xffffff);
      gm2.ovoid(tx, ty + 15.3, tz, 0.20, 0.26, 0.20, 7, 5);
      gm2.tube([{ x: tx, y: ty + 15.5, z: tz, r: 0.05 },
                { x: tx, y: ty + 16.1, z: tz, r: 0.02 }], 5);
      ctx.col.add(C.box(tx - 3.2, ty + 5, tz, 0.3, 5, 3.2, {}));
      ctx.col.add(C.box(tx + 3.2, ty + 5, tz, 0.3, 5, 3.2, {}));
      ctx.col.add(C.box(tx, ty + 5, tz - 3.2, 3.2, 5, 0.3, {}));
      ctx.col.add(C.box(tx - 1.9, ty + 5, tz + 3.2, 1.3, 5, 0.3, {}));
      ctx.col.add(C.box(tx + 1.9, ty + 5, tz + 3.2, 1.3, 5, 0.3, {}));
      ctx.col.add(C.box(tx, ty + 3.4, tz + 3.2, 0.7, 1.4, 0.3, {}));
      /* clock face, stopped */
      var cm = ctx.batch.mb('planksPale');
      cm.setColorHex(0xf0e8d0);
      cm.cylinder(tx, ty + 7.4, tz + 3.3, 1.5, 1.5, 0.12, 12, true, 1.2);
      cm.setColorHex(0x2a2018);
      cm.box(tx, ty + 8.0, tz + 3.42, 0.10, 1.1, 0.06, 2);
      cm.box(tx + 0.45, ty + 7.4, tz + 3.42, 0.9, 0.10, 0.06, 2);

      K.door(ctx, {
        x: tx, z: tz + 3.9, to: 'clockTower', entry: 'default', label: 'Enter Tower',
        cond: function (gg) { return gg.inv.flag('sawGenmo'); },
        denyText: 'The tower door is barred from inside.\nWhatever stopped the clock does not want company\nyet.'
      });

      /* smiths */
      var sm = P.house(ctx.batch, -12, w.groundHeight(-12, -4), -4, {
        w: 6.5, d: 5.4, h: 3.0, yaw: 1.2, wall: 'stoneblock', roof: 'shingleGrey',
        trim: 'planksDark', roofH: 1.4
      });
      K.door(ctx, { x: sm.doorX, z: sm.doorZ, yaw: sm.doorYaw, to: 'smithy', entry: 'default', label: "Doram's Forge" });
      var cm2 = P.house(ctx.batch, 13, w.groundHeight(13, -2), -2, {
        w: 5.2, d: 4.4, h: 2.7, yaw: -1.2, wall: 'plaster', wallColor: 0xd8b878,
        roof: 'shingleRed', trim: 'planks', roofH: 1.3
      });
      K.door(ctx, { x: cm2.doorX, z: cm2.doorZ, yaw: cm2.doorYaw, to: 'bexilShop', entry: 'default', label: "Bexil's Workshop" });

      /* general store */
      var st = P.house(ctx.batch, -10, w.groundHeight(-10, 12), 12, {
        w: 6, d: 5, h: 2.9, yaw: 2.6, wall: 'plaster', wallColor: 0xc8d4e0,
        roof: 'shingleBlue', trim: 'planksDark', roofH: 1.4
      });
      K.door(ctx, { x: st.doorX, z: st.doorZ, yaw: st.doorYaw, to: 'stoneShop', entry: 'default', label: 'General Store' });

      /* town dressing */
      var houses2 = [[16, 12, -2.2], [-20, -14, 0.7], [20, -14, -0.7], [8, 18, 3.0], [-16, 20, 0.3]];
      for (var i = 0; i < houses2.length; i++) {
        var sh = P.house(ctx.batch, houses2[i][0], w.groundHeight(houses2[i][0], houses2[i][1]), houses2[i][1], {
          w: 5, d: 4.4, h: 2.9, yaw: houses2[i][2], wall: 'stoneblock',
          roof: i % 2 ? 'shingleRed' : 'shingleGrey', trim: 'planksDark', roofH: 1.4, windows: true
        });
        K.groundShadow(ctx, houses2[i][0], houses2[i][1], 3.4, 3.1, { strength: 0.34 });
        var sid = LZ.Homes.stonebell[i];
        K.door(ctx, { x: sh.doorX, z: sh.doorZ, yaw: sh.doorYaw, to: sid, entry: 'default',
          label: LZ.Homes.name(sid) });
      }
      for (var l = 0; l < 6; l++) {
        var a = l / 6 * Math.PI * 2;
        P.lampPost(ctx.batch, Math.cos(a) * 9, w.groundHeight(Math.cos(a) * 9, Math.sin(a) * 9 + 6), Math.sin(a) * 9 + 6, {});
      }
      P.stall(ctx.batch, 6, w.groundHeight(6, 8), 8, { yaw: -0.4, awning: 'clothBlue' });
      P.stall(ctx.batch, -4, w.groundHeight(-4, 10), 10, { yaw: 0.3, awning: 'clothRed' });

      K.grassField(ctx, { seed: 31, count: 60, x0: -40, x1: 40, z0: -40, z1: 40, cuttable: 0.4,
        filter: function (x, z) { return Math.sqrt(x * x + z * z) > 24; } });
      K.forest(ctx, { seed: 33, count: 30, x0: -40, x1: 40, z0: -40, z1: 40, minDist: 5.5,
        kind: 'mixed', filter: function (x, z) { return Math.sqrt(x * x + z * z) > 26; } });

      for (var n = 0; n < 4; n++) {
        var L = line('', 'stonebell', n);
        K.npc(ctx, {
          x: [4, -6, 12, -14][n], z: [4, 16, 16, 4][n],
          name: L.name, lines: L.lines, palette: n, build: 'adult', wander: 2.6
        });
      }
      K.hintStone(ctx, 8, -12, null);
      K.sign(ctx, 2.5, 6, 'STONEBELL\n  Forge - west   Workshop - east\n  Tower - north (CLOSED)', 0);
      K.pots(ctx, [[-3, -8], [-2, -8], [10, 4], [11, 4.8]]);

      ctx.entry('default', 0, undefined, 14, Math.PI);
      ctx.entry('fromNorth', 0, undefined, -38, Math.PI);
      ctx.entry('fromSouth', 0, undefined, 38, 0);
      ctx.entry('fromTower', tx, undefined, tz + 5.6, Math.PI);
      K.edgeExit(ctx, 'n', 'yeld', 'fromSouth', { at: 0, span: 9 });
      K.edgeExit(ctx, 's', 'dunes', 'fromNorth', { at: 0, span: 9 });

      if (g.inv.flag('worldHostile')) {
        K.enemies(ctx, [{ id: 'keese', x: -24, z: -24 }, { id: 'chuchu', x: 26, z: 24 }]);
      }
    }
  });

  /* ---------------- Smithy interior ---------------- */
  A.register({
    id: 'smithy', name: "Doram's Forge", quiet: true, cell: 1,
    size: { x0: -7, z0: -7, w: 14, d: 14 },
    groundMats: ['cobble'], surfaces: ['stone'],
    terrain: K.flat(0, 0),
    env: K.env.interior({ ambient: [0.42, 0.34, 0.30] }),
    build: function (ctx) {
      K.interiorShell(ctx, { w: 9, d: 8, h: 3.0, exitTo: 'stonebell', exitEntry: 'default',
        floor: 'cobble', wall: 'stoneblock' });
      P.table(ctx.batch, -2.4, 0, -1.6, { w: 2.0, d: 1.0 });
      P.barrel(ctx.batch, 3.2, 0, -2.4, {});
      P.crate(ctx.batch, 3.2, 0, 1.4, {});
      var mb = ctx.batch.mb('brick');
      mb.setColorHex(0xffffff);
      mb.box(0, 0.8, -3.0, 2.6, 1.6, 1.0, 1.4);
      ctx.col.add(C.box(0, 0.8, -3.0, 1.3, 0.8, 0.5, {}));
      K.torch(ctx, 0, -2.7, { y: 1.6, h: 0.5, lit: true });
      K.npc(ctx, {
        x: 0.4, z: -1.4, yaw: 0.2, name: 'Doram the Smith', palette: 0, build: 'heavy',
        beard: true, beardColor: 0x2a2418, hairStyle: 'bald',
        talk: function (gg, npc) { S.smithOffer(gg, npc); }
      });
      K.sign(ctx, -3.4, 2.6, 'A wall of tongs, every one of them different,\nevery one of them worn smooth.', Math.PI);
    }
  });

  /* ---------------- Bexil's workshop ---------------- */
  A.register({
    id: 'bexilShop', name: "Bexil's Workshop", quiet: true, cell: 1,
    size: { x0: -7, z0: -7, w: 14, d: 14 },
    groundMats: ['planks'], surfaces: ['wood'],
    terrain: K.flat(0, 0),
    env: K.env.interior({ ambient: [0.40, 0.38, 0.34] }),
    build: function (ctx) {
      K.interiorShell(ctx, { w: 8, d: 7, h: 2.9, exitTo: 'stonebell', exitEntry: 'default',
        floor: 'planks', wall: 'plaster', wallColor: 0xd8b878 });
      P.table(ctx.batch, 0, 0, -1.4, { w: 2.4, d: 1.0 });
      P.crate(ctx.batch, -2.8, 0, -2.0, {});
      P.crate(ctx.batch, 2.8, 0, -2.0, { scale: 0.7 });
      K.npc(ctx, {
        x: 0, z: -2.4, yaw: 0, name: 'Bexil', palette: 6, build: 'lanky',
        hairStyle: 'ponytail',
        talk: function (gg, npc) { S.conmanOffer(gg, npc); }
      });
      K.sign(ctx, -2.6, 1.8, 'A framed certificate. The name on it has been\nscratched out and rewritten.', Math.PI);
    }
  });

  /* ---------------- Shops ---------------- */
  function shopArea(id, name, areaBack, stock, o) {
    o = o || {};
    A.register({
      id: id, name: name, quiet: true, cell: 1,
      size: { x0: -7, z0: -7, w: 14, d: 14 },
      groundMats: [o.floor || 'planks'], surfaces: ['wood'],
      terrain: K.flat(0, 0),
      env: K.env.interior({ ambient: o.ambient || [0.44, 0.42, 0.38], music: 'shop' }),
      build: function (ctx) {
        K.interiorShell(ctx, { w: 8, d: 7.5, h: 2.9, exitTo: areaBack, exitEntry: o.backEntry || 'default',
          floor: o.floor || 'planks', wall: o.wall || 'plaster', wallColor: o.wallColor });
        P.table(ctx.batch, 0, 0, -1.2, { w: 4.2, d: 1.0, h: 0.9 });
        for (var i = 0; i < stock.length; i++) {
          P.crate(ctx.batch, -2.6 + i * 1.6, 0, -2.6, { scale: 0.6 });
        }
        K.npc(ctx, {
          x: 0, z: -2.2, yaw: 0, name: o.keeper || 'Shopkeeper', palette: o.pal === undefined ? 3 : o.pal,
          build: 'adult',
          talk: function (gg) {
            var labels = stock.map(function (s) {
              var d = LZ.Items.ITEMS[s.id];
              return (d ? d.name : s.label) + '  -  ' + s.price + ' ◆';
            });
            labels.push('Nothing today');
            gg.dialogue.ask(o.greet || 'Welcome in. Everything on the counter is for sale\nand everything behind it is not.',
              labels, function (i) {
                if (i >= stock.length) return;
                var s = stock[i];
                if (!gg.inv.spend(s.price)) {
                  gg.audio.sfx('error');
                  gg.dialogue.say('Not enough rupees. I would love to be the kind of\nshop that runs a tab.');
                  return;
                }
                gg.audio.sfx('rupee');
                gg.giveItem(s.id, s.count || 1, { describe: false });
              }, { speaker: o.keeper || 'Shopkeeper' });
          }
        });
      }
    });
  }

  shopArea('stoneShop', 'General Store', 'stonebell', [
    { id: 'redPotion', price: 40 },
    { id: 'woodShield', price: 45 },
    { id: 'travelersSword', price: 70 },
    { id: 'greenPotion', price: 55 },
    { id: 'bottle', price: 90 }
  ], { keeper: 'Rin', greet: 'Bottles, blades, and something red in a jar.\nWhat do you need?' });

  shopArea('hanmanShop', 'Caravan Goods', 'hanman', [
    { id: 'redPotion', price: 40 },
    { id: 'arrows', label: 'Arrows', price: 20, count: 20 },
    { id: 'bombs', label: 'Bombs', price: 25, count: 10 },
    { id: 'scimitar', price: 120 },
    { id: 'bottle', price: 100 }
  ], { keeper: 'Amjed', floor: 'sandstone', wall: 'sandstone',
       greet: 'Sand in everything, prices to match.\nWhat will it be?', pal: 6 });

  shopArea('ashShop', 'Ashvale Supply', 'ashvale', [
    { id: 'redPotion', price: 50 },
    { id: 'ironShield', price: 130 },
    { id: 'minersPick', price: 80 },
    { id: 'bombs', label: 'Bombs', price: 30, count: 10 },
    { id: 'greenPotion', price: 60 }
  ], { keeper: 'Sella', floor: 'planksDark', wall: 'stoneblockDark',
       greet: 'Everything up here costs more. Everything up here\nis also the only one for forty miles.', pal: 2 });

  /* ================================================================ */
  /* Hanman Town                                                       */
  /* ================================================================ */
  A.register({
    id: 'hanman',
    name: 'Hanman Town',
    sub: 'a small desert town in Gerudo',
    warp: true,
    respawn: 'hanman',
    cell: 2,
    size: { x0: -44, z0: -44, w: 88, d: 88 },
    groundMats: ['sand', 'sandDark', 'cobble', 'rockRed'],
    surfaces: ['sand', 'sand', 'stone', 'stone'],
    terrain: K.basin({
      seed: 41, amp: 0.9, scale: 0.024, base: 0, inner: 27, outer: 42, wall: 16, wallMat: 3, baseMat: 0,
      paths: [{ pts: [0, -40, 0, 40], w: 4.2, h: 0, mat: 2 }]
    }),
    env: K.env.desert({ music: 'desert' }),
    build: function (ctx) {
      var g = ctx.game, w = ctx.world;

      /* adobe blocks around a square */
      var blocks = [
        [-11, -9, 0.2], [11, -9, -0.2], [-13, 6, 0.6], [13, 6, -0.6],
        [-8, 16, 2.9], [9, 16, -2.9], [-18, -2, 1.4], [18, -2, -1.4]
      ];
      for (var i = 0; i < blocks.length; i++) {
        var bh = P.house(ctx.batch, blocks[i][0], w.groundHeight(blocks[i][0], blocks[i][1]), blocks[i][1], {
          w: 5.4, d: 5.0, h: 3.2, yaw: blocks[i][2],
          wall: 'sandstone', roof: 'sandstone', roofStyle: 'flat',
          trim: 'planksPale', eaves: 0.3, windows: i % 2 === 0
        });
        K.groundShadow(ctx, blocks[i][0], blocks[i][1], 3.6, 3.4, { strength: 0.36 });
        var bid = LZ.Homes.hanman[i];
        K.door(ctx, { x: bh.doorX, z: bh.doorZ, yaw: bh.doorYaw, to: bid, entry: 'default',
          label: LZ.Homes.name(bid) });
      }
      var shop = P.house(ctx.batch, -6, w.groundHeight(-6, -14), -14, {
        w: 6, d: 5, h: 3.0, yaw: 0.2, wall: 'sandstone', roof: 'sandstone', roofStyle: 'flat',
        trim: 'planksPale'
      });
      K.door(ctx, { x: shop.doorX, z: shop.doorZ, yaw: shop.doorYaw, to: 'hanmanShop', entry: 'default', label: 'Caravan Goods' });

      P.stall(ctx.batch, -5, w.groundHeight(-5, 3), 3, { yaw: 0.5, awning: 'clothRed' });
      P.stall(ctx.batch, 5, w.groundHeight(5, 3), 3, { yaw: -0.5, awning: 'clothBlue' });
      P.well(ctx.batch, 0, w.groundHeight(0, 0), 0);
      for (var p = 0; p < 5; p++) {
        var a = p / 5 * Math.PI * 2 + 0.3;
        P.palm(ctx.batch, Math.cos(a) * 15, w.groundHeight(Math.cos(a) * 15, Math.sin(a) * 15 + 4), Math.sin(a) * 15 + 4, {});
      }
      K.scatter({ seed: 61, count: 22, x0: -40, x1: 40, z0: -40, z1: 40, minDist: 5,
        filter: function (x, z) { return Math.sqrt(x * x + z * z) > 22; } },
        function (x, z, rng) { P.cactus(ctx.batch, x, w.groundHeight(x, z), z, { scale: rng.range(0.8, 1.4) }); });
      K.rocks(ctx, { seed: 62, count: 16, x0: -40, x1: 40, z0: -40, z1: 40, minDist: 6, mat: 'rockRed' });

      for (var n = 0; n < 4; n++) {
        var L = line('', 'hanman', n);
        K.npc(ctx, {
          x: [-9, 9, -3, 14][n], z: [8, 8, 18, 14][n], name: L.name, lines: L.lines,
          palette: (n + 2) % 7, build: n === 3 ? 'child' : 'adult', wander: 2.4,
          hat: n === 0 ? 'turban' : 'none', hatColor: 0xd8c8a0, skin: 0xc08a5c
        });
      }
      K.sign(ctx, 2.6, 12, 'HANMAN TOWN\n  Water is shared. Shade is not.\n  north - the long road home', 0);
      K.hintStone(ctx, -12, 12, null);
      K.pots(ctx, [[3.4, -6], [4.4, -6], [-4, -4], [-5, -4.8]]);

      /* the square: Genmo's introduction fires once */
      if (!g.inv.flag('sawGenmo')) {
        var gy = w.groundHeight(0, -6);
        var genmo = K.npc(ctx, {
          x: 0, z: -6, yaw: Math.PI, name: 'Genmo', build: 'teen', scale: 1.02,
          cloth: 0x3a2a40, clothDark: 0x180a20, skin: 0xc09878, hair: 0x8a2a1a,
          hairStyle: 'ponytail', clothTex: 'clothPurple', hairTex: 'hairRed',
          idle: 'laugh', collide: false, lookAt: false,
          interactable: false
        });
        genmo.tagName = 'Genmo';
        var cop1 = K.npc(ctx, {
          x: -2.4, z: -3.4, yaw: -1.0, name: 'Town Guard', build: 'adult', palette: 1,
          cloth: 0x36527e, clothDark: 0x22344e, collide: false, interactable: false,
          idle: 'idleAlert'
        });
        var cop2 = K.npc(ctx, {
          x: 2.6, z: -3.2, yaw: 1.0, name: 'Town Guard', build: 'adult', palette: 1,
          cloth: 0x36527e, clothDark: 0x22344e, collide: false, interactable: false,
          idle: 'idleAlert'
        });
        var child = K.npc(ctx, {
          x: -0.6, z: -4.0, yaw: 0.4, name: 'Child', build: 'child', palette: 2,
          collide: false, interactable: false, idle: 'kneel'
        });
        ctx.trigger({
          x: 0, z: 2.5, r: 4.5, once: true,
          onEnter: function (gg) { S.genmoIntro(gg, genmo, cop1, cop2, child); }
        });
      }

      ctx.entry('default', 0, undefined, 16, Math.PI);
      ctx.entry('fromNorth', 0, undefined, -38, Math.PI);
      K.edgeExit(ctx, 'n', 'dunes', 'fromSouth', { at: 0, span: 9 });

      if (g.inv.flag('worldHostile')) {
        K.enemies(ctx, [
          { id: 'octorok', x: -24, z: 20 }, { id: 'tektite', x: 24, z: -20, variant: 'red' },
          { id: 'keese', x: 18, z: 24 }
        ]);
      }
    }
  });

  /* ================================================================ */
  /* Ashvale                                                           */
  /* ================================================================ */
  A.register({
    id: 'ashvale',
    name: 'Ashvale',
    sub: 'the mountain town under the ash',
    warp: true,
    respawn: 'ashvale',
    cell: 2,
    size: { x0: -42, z0: -42, w: 84, d: 84 },
    groundMats: ['grassAsh', 'dirtRed', 'cobbleDark', 'rockAsh'],
    surfaces: ['dirt', 'dirt', 'stone', 'stone'],
    terrain: K.basin({
      seed: 71, amp: 2.4, scale: 0.03, base: 0, inner: 24, outer: 40, wall: 22, wallMat: 3, baseMat: 0,
      paths: [{ pts: [0, 40, 0, -6, -4, -18], w: 3.6, h: 0.4, mat: 2 }]
    }),
    env: K.env.ash({ music: 'mountain' }),
    build: function (ctx) {
      var g = ctx.game, w = ctx.world;

      /* mine mouth cut into the north wall */
      var mx = -6, mz = -22;
      var my = w.groundHeight(mx, mz);
      /* The mine mouth. A flat slab of rock here reads as a grey billboard
         hanging in the fog, so the face is an outcrop of swept stone with a
         dark adit cut into it and a timber frame holding the roof up. */
      P.cliff(ctx.batch, mx - 4.2, my, mz - 2.2, 7, 6.4, 6, {
        mat: 'rockAsh', color: 0xb4aca4, sides: 8, layers: 4, yaw: 0.4, debris: false });
      P.cliff(ctx.batch, mx + 4.4, my, mz - 2.0, 7.4, 7.0, 6, {
        mat: 'rockAsh', color: 0xa8a09a, sides: 8, layers: 4, yaw: -0.6, debris: false });
      P.cliff(ctx.batch, mx, my, mz - 3.4, 8, 7.6, 5.5, {
        mat: 'rockAsh', color: 0xbdb5ad, sides: 9, layers: 4, yaw: 0.15, debris: false });
      var mb = ctx.batch.mb('rockAsh');
      mb.setColorHex(0xa49c94);
      /* the lip of rock arching over the opening */
      mb.tube([
        { x: mx - 3.2, y: my + 1.2, z: mz + 0.2, ry: 1.5, rz: 1.5 },
        { x: mx - 1.8, y: my + 2.4, z: mz + 0.1, ry: 1.7, rz: 1.6 },
        { x: mx, y: my + 3.0, z: mz, ry: 1.8, rz: 1.7 },
        { x: mx + 1.8, y: my + 2.4, z: mz + 0.1, ry: 1.7, rz: 1.6 },
        { x: mx + 3.2, y: my + 1.2, z: mz + 0.2, ry: 1.5, rz: 1.5 }
      ], 8, { axis: 'x' });
      /* the dark of the shaft itself, so the doorway is a hole not a wall */
      var dk = ctx.batch.mb('rockDark');
      dk.setColorHex(0x2c2824);
      dk.tube([
        { z: mz + 1.0, x: mx, y: my + 1.0, rx: 1.55, ry: 1.65 },
        { z: mz - 0.4, x: mx, y: my + 1.0, rx: 1.50, ry: 1.60 },
        { z: mz - 2.4, x: mx, y: my + 0.9, rx: 1.10, ry: 1.20 },
        { z: mz - 3.6, x: mx, y: my + 0.8, rx: 0.35, ry: 0.40 }
      ], 8, { axis: 'z', capStart: false });
      ctx.col.add(C.box(mx - 3.0, my + 3, mz, 1.4, 3, 2, {}));
      ctx.col.add(C.box(mx + 3.0, my + 3, mz, 1.4, 3, 2, {}));
      ctx.col.add(C.box(mx, my + 4.4, mz, 3, 1.6, 2, {}));
      var wm = ctx.batch.mb('planksDark');
      wm.setColorHex(0xd8c8a8);
      /* pit props: rough round timber, braced at the head */
      wm.tube([{ x: mx - 1.7, y: my, z: mz + 1.3, r: 0.20 },
               { x: mx - 1.6, y: my + 2.5, z: mz + 1.3, r: 0.17 }], 6, { v: 2 });
      wm.tube([{ x: mx + 1.7, y: my, z: mz + 1.3, r: 0.20 },
               { x: mx + 1.6, y: my + 2.5, z: mz + 1.3, r: 0.17 }], 6, { v: 2 });
      wm.tube([{ x: mx - 2.0, y: my + 2.6, z: mz + 1.3, r: 0.21 },
               { x: mx + 2.0, y: my + 2.6, z: mz + 1.3, r: 0.21 }], 6, { axis: 'x', v: 2 });
      wm.tube([{ x: mx - 1.55, y: my + 1.9, z: mz + 1.3, r: 0.11 },
               { x: mx - 0.9, y: my + 2.5, z: mz + 1.3, r: 0.11 }], 5);
      wm.tube([{ x: mx + 1.55, y: my + 1.9, z: mz + 1.3, r: 0.11 },
               { x: mx + 0.9, y: my + 2.5, z: mz + 1.3, r: 0.11 }], 5);
      K.door(ctx, {
        x: mx, z: mz + 1.9, to: 'mine', entry: 'default', label: 'Enter the Mine',
        cond: function (gg) { return gg.inv.hasQuest('minerPass') || gg.inv.medallions['mine']; },
        denyText: 'A miner\'s token opens this gate. Foreman Gask\nkeeps them.'
      });

      var houses = [[-12, 2, 0.4], [12, 0, -0.4], [-10, 14, 0.8], [11, 13, -0.8], [0, 20, 3.1]];
      for (var i = 0; i < houses.length; i++) {
        var ah = P.house(ctx.batch, houses[i][0], w.groundHeight(houses[i][0], houses[i][1]), houses[i][1], {
          w: 5.4, d: 4.6, h: 2.9, yaw: houses[i][2], wall: 'planksDark',
          roof: 'shingleGrey', trim: 'planks', roofH: 1.6
        });
        K.groundShadow(ctx, houses[i][0], houses[i][1], 3.6, 3.2, { strength: 0.36 });
        var aid = LZ.Homes.ashvale[i];
        K.door(ctx, { x: ah.doorX, z: ah.doorZ, yaw: ah.doorYaw, to: aid, entry: 'default',
          label: LZ.Homes.name(aid) });
      }
      var sup = P.house(ctx.batch, 8, w.groundHeight(8, 8), 8, {
        w: 6, d: 5, h: 3.0, yaw: -1.0, wall: 'planksDark', roof: 'shingleGrey', trim: 'planks'
      });
      K.door(ctx, { x: sup.doorX, z: sup.doorZ, yaw: sup.doorYaw, to: 'ashShop', entry: 'default', label: 'Ashvale Supply' });

      for (var t = 0; t < 6; t++) {
        var a = t / 6 * Math.PI * 2;
        K.torch(ctx, Math.cos(a) * 11, Math.sin(a) * 11 + 6, { lit: true });
      }
      K.rocks(ctx, { seed: 81, count: 28, x0: -38, x1: 38, z0: -38, z1: 38, minDist: 4, mat: 'rockAsh' });
      K.scatter({ seed: 82, count: 18, x0: -36, x1: 36, z0: -36, z1: 36, minDist: 5,
        filter: function (x, z) { return Math.sqrt(x * x + z * z) > 18; } },
        function (x, z, rng) { P.deadTree(ctx.batch, x, w.groundHeight(x, z), z, { scale: rng.range(0.8, 1.3) }); });

      for (var n = 0; n < 3; n++) {
        var L = line('', 'ashvale', n);
        K.npc(ctx, {
          x: [-5, 6, -12][n], z: [6, 14, 18][n], name: L.name, lines: L.lines,
          palette: n + 2, build: 'adult', wander: 2.0
        });
      }

      /* the foreman hands over the mine token */
      K.npc(ctx, {
        x: -4, z: -14, yaw: Math.PI, name: 'Foreman Gask', palette: 0, build: 'heavy',
        beard: true, beardColor: 0x3a2a1a,
        talk: function (gg) {
          if (gg.inv.medallions['mine']) {
            gg.dialogue.say('You went down there and you came back up. That is\ntwo things most of my crew could not manage.\f'
              + 'Anything you dig out of the deep seam, I will buy.',
              { speaker: 'Foreman Gask' });
            return;
          }
          if (gg.inv.hasQuest('minerPass')) {
            gg.dialogue.say('Gate\'s yours. Lamps are lit as far as the second\nfall, and after that you are on your own.\f'
              + 'There is a thing down there made of slag and\ntemper. Bring something that goes BANG.',
              { speaker: 'Foreman Gask' });
            return;
          }
          gg.dialogue.ask('You are the one from Farrow? The old man\'s boy?\f'
            + 'Then you already know what is in my mine, because\nit is the same thing that killed him.\f'
            + 'Take the token. Bring my people back if there are\nany left to bring.',
            ['Take the token', 'Not yet'],
            function (i) {
              if (i !== 0) return;
              gg.giveItem('minerPass', 1, { describe: false });
              gg.inv.setFlag('haveMineToken');
              gg.hud.toast('Got: Miner\'s Token');
            }, { speaker: 'Foreman Gask' });
        }
      });

      K.sign(ctx, 2.4, 10, 'ASHVALE\n  Mine - north (DANGER)\n  Ash falls. Cover your water.', 0);
      K.hintStone(ctx, 10, -8, 'The mountain is not angry. Something inside it is\nusing the mountain\'s voice.');
      K.pots(ctx, [[-8, -8], [-9, -8.8], [7, -6]]);

      ctx.entry('default', 0, undefined, 22, Math.PI);
      ctx.entry('fromMine', mx, undefined, mz + 3.4, 0);
      K.edgeExit(ctx, 's', 'ashRoad', 'fromNorth', { at: 0, span: 9 });

      K.enemies(ctx, [
        { id: 'emberBeetle', x: -20, z: -8 }, { id: 'emberBeetle', x: -22, z: -6 },
        { id: 'keese', x: 20, z: -14, element: 'fire' }
      ]);
    }
  });

  LZ.TownsLoaded = true;
})(LZ);
