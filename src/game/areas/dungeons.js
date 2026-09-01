/* =============================================================
   game/areas/dungeons.js -- the six dungeons.

   Each one follows the same contract the series established: find the
   map, find the item, the item unlocks the rest of the dungeon, the
   boss is an exam on the item.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var M = LZ.M, K = LZ.Kit, P = LZ.Props, C = LZ.Collision, A = LZ.Areas, S = LZ.Script;

  /* shared dungeon environment + terrain */
  function dungeonArea(o) {
    return {
      id: o.id, name: o.name, sub: o.sub, dungeon: o.dungeon,
      quiet: false, cell: 2,
      size: o.size,
      groundMats: o.groundMats || ['tileFloor', 'stoneblockDark', 'carpet'],
      surfaces: o.surfaces || ['stone', 'stone', 'stone'],
      respawn: o.respawn, respawnEntry: o.respawnEntry,
      terrain: o.terrain || K.flat(0, 0),
      env: o.env,
      build: o.build,
      onBossDefeated: o.onBossDefeated,
      onEnter: o.onEnter
    };
  }

  /* a doorway between two rooms, optionally locked */
  function doorway(ctx, x, z, o) {
    o = o || {};
    var frame = ctx.batch.mb(o.mat || 'stoneblockWarm');
    frame.setColorHex(0xffffff);
    var m = LZ.M4.create();
    LZ.M4.compose(m, x, o.y || 0, z, 0, o.yaw || 0, 0, 1, 1, 1);
    frame.setMatrix(m);
    frame.box(-1.6, 1.3, 0, 0.5, 2.6, 0.7, 1.4);
    frame.box(1.6, 1.3, 0, 0.5, 2.6, 0.7, 1.4);
    frame.box(0, 2.7, 0, 3.7, 0.6, 0.7, 1.4);
    frame.setMatrix(null);
    if (o.locked) return K.innerDoor(ctx, x, z, o);
    return null;
  }

  /* ================================================================ */
  /* 1. Ashvale Mine -- Bombs, Emberhusk                               */
  /* ================================================================ */
  A.register(dungeonArea({
    id: 'mine', name: 'Ashvale Mine', sub: 'the deep seam', dungeon: 'mine',
    respawn: 'ashvale', respawnEntry: 'fromMine',
    size: { x0: -40, z0: -76, w: 80, d: 116 },
    groundMats: ['cobbleDark', 'rockAsh', 'lava'],
    surfaces: ['stone', 'stone', 'stone'],
    env: K.env.cave({ music: 'dungeon', ambient: [0.30, 0.26, 0.24], col0: [0.42, 0.34, 0.28],
      fogColor: [0.08, 0.06, 0.06] }),
    build: function (ctx) {
      var g = ctx.game, w = ctx.world;
      var D = 'mine';

      /* --- rooms --- */
      K.dungeon(ctx, {
        entry: { x: 0, z: 0, w: 14, d: 14, h: 5, doors: { n: true }, floor: false },
        hall:  { x: 0, z: -20, w: 18, d: 16, h: 5.5, doors: { s: true, e: true, w: true, n: true }, floor: false },
        east:  { x: 22, z: -20, w: 14, d: 14, h: 5, doors: { w: true, n: true }, floor: false },
        vault: { x: 22, z: -40, w: 16, d: 14, h: 5, doors: { s: true, w: true }, floor: false },
        west:  { x: -22, z: -20, w: 14, d: 14, h: 5, doors: { e: true }, floor: false },
        deep:  { x: 0, z: -40, w: 18, d: 16, h: 6, doors: { s: true, e: true, n: true }, floor: false },
        boss:  { x: 0, z: -62, w: 24, d: 22, h: 8, doors: { s: true }, floor: false,
                 wall: 'rockAsh', wallColor: 0xa89484 }
      }, { floor: 'cobbleDark', wall: 'stoneblockDark', doorWidth: 3.0 });

      K.corridor(ctx, 0, -10, 6, { w: 3.0, h: 4.0, floor: 'cobbleDark' });
      K.corridor(ctx, 15.5, -20, 7, { w: 3.0, h: 4.0, yaw: Math.PI / 2 });
      K.corridor(ctx, -15.5, -20, 7, { w: 3.0, h: 4.0, yaw: Math.PI / 2 });
      K.corridor(ctx, 22, -30, 6, { w: 3.0, h: 4.0 });
      K.corridor(ctx, 0, -30, 6, { w: 3.0, h: 4.0 });
      K.corridor(ctx, 15.5, -40, 7, { w: 3.0, h: 4.0, yaw: Math.PI / 2 });
      K.corridor(ctx, 0, -51, 6, { w: 3.4, h: 4.4 });

      /* --- doors --- */
      doorway(ctx, 0, -7.2, {});
      doorway(ctx, 0, -12.4, {});
      var eastDoor = doorway(ctx, 12.0, -20, { yaw: Math.PI / 2, locked: 'small', dungeon: D });
      doorway(ctx, 22, -27.2, {});
      doorway(ctx, 0, -27.2, {});
      var vaultDoor = doorway(ctx, 15.0, -40, { yaw: Math.PI / 2, locked: 'small', dungeon: D });
      doorway(ctx, -12.0, -20, { yaw: Math.PI / 2 });
      var bossDoor = doorway(ctx, 0, -48.5, { locked: 'boss', dungeon: D });

      /* --- lighting --- */
      var torchAt = [[-5, -2], [5, -2], [-7, -24], [7, -24], [17, -24], [27, -24],
                     [-17, -24], [-27, -24], [17, -44], [27, -44], [-6, -44], [6, -44],
                     [-9, -58], [9, -58]];
      for (var i = 0; i < torchAt.length; i++) K.torch(ctx, torchAt[i][0], torchAt[i][1], { lit: true, h: 1.9 });

      /* --- dressing --- */
      P.crate(ctx.batch, -4, 0, 4, {}); P.crate(ctx.batch, 4.6, 0, 4.2, { scale: 0.8 });
      P.barrel(ctx.batch, -5, 0, -18, {}); P.barrel(ctx.batch, -5.9, 0, -19, {});
      K.pots(ctx, [[6, -16], [7, -16], [-6, -22], [20, -18], [24, -18], [-20, -22], [3, -38], [-3, -38]]);
      K.sign(ctx, 3.4, -3, 'MIND THE SECOND FALL\nNo lamps past the marker.', Math.PI);

      /* --- progression: map, key, bombs, boss key --- */
      K.chest(ctx, -22, -22, 'map', { flag: 'mine_map' });
      K.chest(ctx, -22, -18, 'smallKey', { flag: 'mine_key1' });

      /* a floor switch in the hall opens the gate to the east key */
      var gate1 = K.gate(ctx, 22, -14.5, { w: 3.0, h: 2.8 });
      ctx.spawn(new LZ.Switch(g, {
        x: 22, y: 0, z: -24, style: 'floor', hold: false,
        onToggle: function (gg, on) { gate1.setOpen(true, gg); gg.hud.toast('Something opened nearby.'); }
      }));
      K.chest(ctx, 22, -12, 'smallKey', { flag: 'mine_key2' });

      /* the dungeon item */
      K.chest(ctx, 22, -42, 'bombs', { flag: 'mine_bombs', big: true,
        onOpen: function (gg) {
          gg.inv.giveTool('bombs');
          gg.dialogue.say('BOMBS\n\nA miner\'s charge in a cloth bag. Set one down,\nthen get considerably further away than feels\nnecessary.',
            { style: 'menu' });
        } });
      K.chest(ctx, 18, -42, 'compass', { flag: 'mine_compass' });

      /* bombable wall to the boss key */
      var secret = K.bombWall(ctx, -8, -40, { yaw: Math.PI / 2, w: 3.0, h: 3.4, mat: 'rockAsh' });
      var mb = ctx.batch.mb('cobbleDark');
      mb.setColorHex(0x9a9084);
      mb.quad([-16, 0.01, -36], [-8, 0.01, -36], [-8, 0.01, -44], [-16, 0.01, -44], [3, 3]);
      LZ.Props.room(ctx.batch, -14, 0, -40, 10, 10, 4.6, {
        floor: false, wall: 'rockAsh', wallColor: 0xa08c7c, gaps: { e: [0, 3.0] }
      });
      K.torch(ctx, -14, -36, { lit: true });
      K.chest(ctx, -14, -41, 'bossKey', { flag: 'mine_bosskey', big: true });

      /* --- enemies --- */
      K.enemies(ctx, [
        { id: 'emberBeetle', x: -3, z: -18 }, { id: 'emberBeetle', x: 3, z: -22 },
        { id: 'emberBeetle', x: 0, z: -20 },
        { id: 'chuchu', x: 20, z: -22, variant: 'red' }, { id: 'chuchu', x: 24, z: -18, variant: 'red' },
        { id: 'keese', x: -22, z: -20, element: 'fire' },
        { id: 'armos', x: 18, z: -38 }, { id: 'armos', x: 26, z: -38 },
        { id: 'moblin', x: -4, z: -42 }, { id: 'moblin', x: 5, z: -38 },
        { id: 'skulltula', x: 0, z: -33 }
      ]);

      /* --- boss --- */
      var boss = LZ.Bosses.make(g, 'emberhusk', { x: 0, y: 0, z: -66 });
      boss.triggerRange = 13;
      ctx.spawn(boss);
      ctx.trigger({ x: 0, z: -54, r: 4, once: true, onEnter: function (gg) { S.bossBark(gg, 'emberhusk'); } });

      ctx.entry('default', 0, 0, 5, Math.PI);
      ctx.transition({ x0: -2, x1: 2, z0: 5.6, z1: 7.4, to: 'ashvale', entry: 'fromMine' });
    },
    onBossDefeated: function (g, boss) {
      g.world.addActor(new LZ.Pickup(g, { x: boss.pos[0], y: boss.pos[1] + 1, z: boss.pos[2], what: 'heartBig' }));
      var hc = new LZ.Actor({ kind: 'prize', x: boss.pos[0], y: 0.6, z: boss.pos[2] - 3, radius: 0.6, height: 1 });
      hc.interactable = true; hc.interactRange = 1.6; hc.actionLabel = 'Take';
      hc.mesh = g.meshes.pickup('heartBig');
      hc.castShadow = false;
      hc.update = function (dt, gg) { this.yaw += dt * 1.4; };
      var m = LZ.M4.create();
      hc.draw = function (gg) {
        LZ.M4.compose(m, this.pos[0], this.pos[1] + Math.sin(gg.time * 2) * 0.1, this.pos[2], 0, this.yaw, 0, 1.6, 1.6, 1.6);
        gg.r.submit(this.mesh, m, gg.assets.mat.gemRed);
        gg.effects.pointLight(this.pos[0], this.pos[1] + 0.3, this.pos[2], [1, 0.5, 0.5], 2.0);
      };
      hc.drawShadow = function () {};
      hc.act = function (gg) {
        this.removeMe = true;
        gg.giveItem('heartContainer', 1, { fanfare: true });
        S.dungeonCleared(gg, 'mine', {
          text: 'The slag cools and cracks and falls in on itself.\f'
              + 'Somewhere far above, the mountain lets out a\nbreath it has been holding for nine days.',
          then: function (g2) {
            g2.inv.setFlag('clockOpen');
            g2.hud.toast('Word will reach Stonebell by morning.');
            g2.goToArea('ashvale', 'fromMine');
          }
        });
      };
      g.world.addActor(hc);
    }
  }));

  /* ================================================================ */
  /* 2. Stonebell Clock Tower -- Hookshot, Genmo                       */
  /* ================================================================ */
  A.register(dungeonArea({
    id: 'clockTower', name: 'The Stopped Clock', sub: 'Stonebell tower', dungeon: 'clock',
    respawn: 'stonebell', respawnEntry: 'fromTower',
    size: { x0: -34, z0: -60, w: 68, d: 100 },
    groundMats: ['planks', 'stoneblockWarm', 'carpetBlue'],
    surfaces: ['wood', 'stone', 'wood'],
    env: K.env.cave({ music: 'dungeon', ambient: [0.34, 0.32, 0.30], col0: [0.46, 0.42, 0.34],
      fogColor: [0.07, 0.07, 0.09] }),
    build: function (ctx) {
      var g = ctx.game, w = ctx.world;
      var D = 'clock';

      K.dungeon(ctx, {
        entry:  { x: 0, z: 0, w: 14, d: 12, h: 5, doors: { n: true }, floor: false, floorColor: 0xffffff },
        works:  { x: 0, z: -18, w: 20, d: 18, h: 7, doors: { s: true, e: true, w: true, n: true }, floor: false },
        east:   { x: 24, z: -18, w: 14, d: 14, h: 5, doors: { w: true }, floor: false },
        west:   { x: -24, z: -18, w: 14, d: 14, h: 5, doors: { e: true, n: true }, floor: false },
        gears:  { x: -24, z: -38, w: 16, d: 14, h: 6, doors: { s: true, e: true }, floor: false },
        upper:  { x: 0, z: -38, w: 18, d: 16, h: 6.5, doors: { w: true, s: true, n: true }, floor: false },
        belfry: { x: 0, z: -58, w: 24, d: 20, h: 10, doors: { s: true }, floor: false,
                  wall: 'stoneblockWarm' }
      }, { floor: 'planks', wall: 'stoneblockWarm', doorWidth: 3.0 });

      K.corridor(ctx, 0, -9, 6, { w: 3.0, h: 4.0, floor: 'planks', wall: 'stoneblockWarm' });
      K.corridor(ctx, 17, -18, 8, { w: 3.0, h: 4.0, yaw: Math.PI / 2, wall: 'stoneblockWarm' });
      K.corridor(ctx, -17, -18, 8, { w: 3.0, h: 4.0, yaw: Math.PI / 2, wall: 'stoneblockWarm' });
      K.corridor(ctx, -24, -29, 6, { w: 3.0, h: 4.0, wall: 'stoneblockWarm' });
      K.corridor(ctx, -16, -38, 7, { w: 3.0, h: 4.0, yaw: Math.PI / 2, wall: 'stoneblockWarm' });
      K.corridor(ctx, 0, -28, 4, { w: 3.0, h: 4.0, wall: 'stoneblockWarm' });
      K.corridor(ctx, 0, -49, 6, { w: 3.4, h: 4.6, wall: 'stoneblockWarm' });

      doorway(ctx, 0, -6.2, { mat: 'planksDark' });
      doorway(ctx, 0, -27.2, { mat: 'planksDark' });
      var eDoor = doorway(ctx, 13, -18, { yaw: Math.PI / 2, locked: 'small', dungeon: D, mat: 'planksDark' });
      doorway(ctx, -13, -18, { yaw: Math.PI / 2, mat: 'planksDark' });
      var gDoor = doorway(ctx, -24, -32, { locked: 'small', dungeon: D, mat: 'planksDark' });
      doorway(ctx, -12.5, -38, { yaw: Math.PI / 2, mat: 'planksDark' });
      var bossDoor = doorway(ctx, 0, -46.5, { locked: 'boss', dungeon: D, mat: 'planksDark' });

      /* giant gears as scenery and as hookshot anchors */
      function gear(x, y, z, r, teeth, matName) {
        var mb = ctx.batch.mb(matName || 'metalRust');
        mb.setColorHex(0xffffff);
        mb.cylinder(x, y, z, r, r, 0.4, 12, true, 1.0);
        for (var t = 0; t < teeth; t++) {
          var a = t / teeth * M.TAU;
          mb.box(x + Math.sin(a) * (r + 0.3), y + 0.2, z + Math.cos(a) * (r + 0.3), 0.5, 0.4, 0.5, 1.2);
        }
        ctx.col.add(C.cyl(x, y, z, r + 0.4, 0.6, { surface: 'wood', hookable: true }));
      }
      gear(-6, 0.9, -20, 3.2, 12);
      gear(3, 2.4, -16, 2.4, 10);
      gear(7, 4.0, -22, 2.0, 8);
      gear(-24, 1.2, -40, 3.0, 12);
      gear(0, 3.2, -40, 3.6, 14);

      /* wooden platforms only reachable with the hookshot */
      function plank(x, y, z, w2, d2) {
        var mb = ctx.batch.mb('planksDark');
        mb.setColorHex(0xffffff);
        mb.box(x, y, z, w2, 0.3, d2, 1.6);
        ctx.col.add(C.box(x, y, z, w2 / 2, 0.15, d2 / 2, { surface: 'wood', hookable: true }));
      }
      plank(0, 3.6, -24, 5, 2.4);
      plank(-6, 5.0, -22, 4, 2.4);
      plank(24, 3.0, -20, 4, 3);
      plank(0, 4.4, -42, 6, 3);

      var torchAt = [[-5, -3], [5, -3], [-8, -12], [8, -12], [-8, -24], [8, -24],
                     [20, -14], [28, -14], [-20, -14], [-28, -14], [-20, -42], [-28, -42],
                     [-6, -34], [6, -34], [-9, -54], [9, -54]];
      for (var i = 0; i < torchAt.length; i++) K.torch(ctx, torchAt[i][0], torchAt[i][1], { lit: true });

      K.pots(ctx, [[-4, -2], [-5, -2], [4, -2], [20, -20], [-20, -16], [3, -36]]);
      K.sign(ctx, 3.6, -3, 'CLOCKWORKS - AUTHORISED HANDS ONLY\n(Somebody has drawn a face over the notice.)', Math.PI);

      K.chest(ctx, -24, -16, 'map', { flag: 'clock_map' });
      K.chest(ctx, -24, -20, 'smallKey', { flag: 'clock_key1' });
      K.chest(ctx, 24, 3.0 ? -20 : -20, 'compass', { flag: 'clock_compass', y: 3.15 });

      /* the dungeon item, on a platform behind a crystal-switch gate */
      var gate2 = K.gate(ctx, 0, -30.5, { w: 3.2, h: 3.0 });
      ctx.spawn(new LZ.Switch(g, {
        x: -6, y: 5.15, z: -22, style: 'crystal',
        onToggle: function (gg, on) { gate2.setOpen(on, gg); }
      }));
      K.chest(ctx, 0, -42, 'hookshot', { flag: 'clock_hookshot', big: true, y: 4.55,
        onOpen: function (gg) {
          gg.inv.giveTool('hookshot');
          gg.dialogue.say('HOOKSHOT\n\nAim it at wood or metal and it will bring you to\nwherever you pointed. Or bring whatever you\npointed at to you.',
            { style: 'menu' });
        } });

      K.chest(ctx, -24, -40, 'smallKey', { flag: 'clock_key2' });
      var secret = K.bombWall(ctx, 12, -38, { yaw: Math.PI / 2, w: 3.0, h: 3.4, mat: 'stoneblockWarm' });
      LZ.Props.room(ctx.batch, 18, 0, -38, 10, 10, 4.6, {
        floor: false, wall: 'stoneblockWarm', gaps: { w: [0, 3.0] }
      });
      K.torch(ctx, 18, -34, { lit: true });
      K.chest(ctx, 18, -39, 'bossKey', { flag: 'clock_bosskey', big: true });

      K.enemies(ctx, [
        { id: 'keese', x: -4, z: -16 }, { id: 'keese', x: 5, z: -22 },
        { id: 'stalfos', x: -6, z: -18 }, { id: 'stalfos', x: 6, z: -20 },
        { id: 'moblin', x: 24, z: -18 }, { id: 'skulltula', x: -24, z: -18 },
        { id: 'beamos', x: -24, z: -40 },
        { id: 'chuchu', x: 0, z: -40, variant: 'blue' }, { id: 'chuchu', x: 4, z: -36, variant: 'blue' },
        { id: 'poe', x: -20, z: -36 }
      ]);

      var boss = LZ.Bosses.make(g, 'genmoYoung', { x: 0, y: 0, z: -60 });
      boss.triggerRange = 14;
      ctx.spawn(boss);
      ctx.trigger({ x: 0, z: -52, r: 4, once: true, onEnter: function (gg) { S.bossBark(gg, 'genmoYoung'); } });

      ctx.entry('default', 0, 0, 4, Math.PI);
      ctx.transition({ x0: -2, x1: 2, z0: 4.6, z1: 6.4, to: 'stonebell', entry: 'fromTower' });
    },
    onBossDefeated: function (g, boss) {
      S.genmoRetreat(g, boss);
      var hc = makePrize(g, boss.pos[0], boss.pos[2] - 2, 'clock', {
        text: 'The clock starts again behind you, all at once,\nlike an argument resuming.',
        then: function (g2) {
          g2.hud.toast('The Elderwood has gone quiet. Someone should look.');
          g2.goToArea('stonebell', 'fromTower');
        }
      });
      g.world.addActor(hc);
    }
  }));

  /* shared "heart container on a plinth" prize */
  function makePrize(g, x, z, dungeonId, clearOpts) {
    var hc = new LZ.Actor({ kind: 'prize', x: x, y: 0.6, z: z, radius: 0.6, height: 1 });
    hc.interactable = true; hc.interactRange = 1.7; hc.actionLabel = 'Take';
    hc.mesh = g.meshes.pickup('heartBig');
    hc.castShadow = false;
    hc.update = function (dt) { this.yaw += dt * 1.4; };
    var m = LZ.M4.create();
    hc.draw = function (gg) {
      LZ.M4.compose(m, this.pos[0], this.pos[1] + Math.sin(gg.time * 2) * 0.1, this.pos[2], 0, this.yaw, 0, 1.6, 1.6, 1.6);
      gg.r.submit(this.mesh, m, gg.assets.mat.gemRed);
      gg.effects.pointLight(this.pos[0], this.pos[1] + 0.3, this.pos[2], [1, 0.5, 0.5], 2.0);
    };
    hc.drawShadow = function () {};
    hc.act = function (gg) {
      this.removeMe = true;
      gg.giveItem('heartContainer', 1, { fanfare: true });
      S.dungeonCleared(gg, dungeonId, clearOpts);
    };
    return hc;
  }

  /* ================================================================ */
  /* 3. The Rooted Grove -- Gale Boomerang, Thornheart                 */
  /* ================================================================ */
  A.register(dungeonArea({
    id: 'grove', name: 'The Rooted Grove', sub: 'inside the elder tree', dungeon: 'grove',
    respawn: 'elderwood', respawnEntry: 'fromGrove',
    size: { x0: -34, z0: -60, w: 68, d: 96 },
    groundMats: ['grassDark', 'bark', 'dirt'],
    surfaces: ['grass', 'wood', 'dirt'],
    env: K.env.cave({ music: 'forest', ambient: [0.30, 0.36, 0.30], col0: [0.40, 0.48, 0.36],
      fogColor: [0.06, 0.09, 0.07] }),
    build: function (ctx) {
      var g = ctx.game, w = ctx.world;
      var D = 'grove';

      K.dungeon(ctx, {
        entry: { x: 0, z: 0, w: 14, d: 12, h: 6, doors: { n: true }, floor: false },
        heart: { x: 0, z: -20, w: 20, d: 18, h: 8, doors: { s: true, e: true, w: true, n: true }, floor: false },
        east:  { x: 24, z: -20, w: 14, d: 14, h: 6, doors: { w: true }, floor: false },
        west:  { x: -24, z: -20, w: 14, d: 14, h: 6, doors: { e: true, n: true }, floor: false },
        nw:    { x: -24, z: -40, w: 14, d: 14, h: 6, doors: { s: true, e: true }, floor: false },
        upper: { x: 0, z: -40, w: 18, d: 16, h: 7, doors: { w: true, s: true, n: true }, floor: false },
        boss:  { x: 0, z: -58, w: 24, d: 20, h: 9, doors: { s: true }, floor: false }
      }, { floor: 'grassDark', wall: 'bark', doorWidth: 3.0 });

      K.corridor(ctx, 0, -9, 6, { w: 3.0, h: 4.4, floor: 'dirt', wall: 'bark' });
      K.corridor(ctx, 17, -20, 8, { w: 3.0, h: 4.4, yaw: Math.PI / 2, wall: 'bark', floor: 'dirt' });
      K.corridor(ctx, -17, -20, 8, { w: 3.0, h: 4.4, yaw: Math.PI / 2, wall: 'bark', floor: 'dirt' });
      K.corridor(ctx, -24, -31, 6, { w: 3.0, h: 4.4, wall: 'bark', floor: 'dirt' });
      K.corridor(ctx, -16, -40, 7, { w: 3.0, h: 4.4, yaw: Math.PI / 2, wall: 'bark', floor: 'dirt' });
      K.corridor(ctx, 0, -30, 4, { w: 3.0, h: 4.4, wall: 'bark', floor: 'dirt' });
      K.corridor(ctx, 0, -49, 5, { w: 3.4, h: 5.0, wall: 'bark', floor: 'dirt' });

      doorway(ctx, 0, -6.2, { mat: 'barkDead' });
      doorway(ctx, 0, -28.2, { mat: 'barkDead' });
      doorway(ctx, 13, -20, { yaw: Math.PI / 2, mat: 'barkDead' });
      var wDoor = doorway(ctx, -13, -20, { yaw: Math.PI / 2, locked: 'small', dungeon: D, mat: 'barkDead' });
      doorway(ctx, -24, -34, { mat: 'barkDead' });
      doorway(ctx, -12.5, -40, { yaw: Math.PI / 2, mat: 'barkDead' });
      var bossDoor = doorway(ctx, 0, -47, { locked: 'boss', dungeon: D, mat: 'barkDead' });

      /* root pillars and hanging vines */
      for (var r = 0; r < 8; r++) {
        var a = r / 8 * M.TAU;
        P.pillar(ctx.batch, Math.cos(a) * 7.5, 0, -20 + Math.sin(a) * 7, 6.0,
          { mat: 'bark', r: 0.5, color: 0xd8c8a8 });
      }
      K.scatter({ seed: 121, count: 26, x0: -30, x1: 30, z0: -52, z1: -4, minDist: 3 },
        function (x, z, rng) {
          if (Math.abs(x) < 3 && z > -6) return;
          P.mushroom(ctx.batch, x, 0, z, { scale: rng.range(0.6, 1.4), color: 0x9a6a4a });
        });
      K.grassField(ctx, { seed: 122, count: 60, x0: -30, x1: 30, z0: -50, z1: -2, cuttable: 0.5,
        mat: 'grassblade' });

      var torchAt = [[-5, -3], [5, -3], [-8, -14], [8, -14], [20, -16], [28, -16],
                     [-20, -16], [-28, -16], [-20, -44], [-28, -44], [-6, -36], [6, -36], [-9, -54], [9, -54]];
      for (var i = 0; i < torchAt.length; i++) K.torch(ctx, torchAt[i][0], torchAt[i][1], { lit: true });

      K.chest(ctx, 24, -18, 'map', { flag: 'grove_map' });
      K.chest(ctx, 24, -22, 'smallKey', { flag: 'grove_key1' });
      K.chest(ctx, -24, -18, 'compass', { flag: 'grove_compass' });

      /* the item */
      K.chest(ctx, -24, -42, 'boomerang', { flag: 'grove_boomerang', big: true,
        onOpen: function (gg) {
          gg.inv.giveTool('boomerang');
          gg.dialogue.say('GALE BOOMERANG\n\nAim and throw. It stuns what it hits, cuts what\nit can, and brings back what it can carry.',
            { style: 'menu' });
        } });

      /* three crystal switches, only reachable by boomerang, open the boss door path */
      var lit = { n: 0 };
      var gate3 = K.gate(ctx, 0, -32.5, { w: 3.2, h: 3.2 });
      var crystals = [[-7, -44, 3.2], [7, -44, 3.2], [0, -47, 4.4]];
      for (var c = 0; c < crystals.length; c++) {
        (function (cc) {
          ctx.spawn(new LZ.Switch(g, {
            x: cc[0], y: cc[2], z: cc[1], style: 'crystal',
            onToggle: function (gg, on) {
              lit.n += on ? 1 : -1;
              if (lit.n >= 3) { gate3.setOpen(true, gg); gg.hud.toast('Three lights. The way opens.'); }
              else gg.hud.toast('Lights: ' + lit.n + ' of 3');
            }
          }));
        })(crystals[c]);
      }
      K.chest(ctx, 0, -36, 'bossKey', { flag: 'grove_bosskey', big: true });

      K.enemies(ctx, [
        { id: 'skulltula', x: -5, z: -16 }, { id: 'skulltula', x: 6, z: -24 },
        { id: 'chuchu', x: 24, z: -20, variant: 'green' }, { id: 'chuchu', x: 21, z: -18, variant: 'green' },
        { id: 'octorok', x: -24, z: -22 }, { id: 'keese', x: -24, z: -40 },
        { id: 'wolfos', x: 0, z: -40 }, { id: 'moblin', x: -6, z: -42 },
        { id: 'tektite', x: 6, z: -38 }
      ]);

      var boss = LZ.Bosses.make(g, 'thornheart', { x: 0, y: 0, z: -60 });
      boss.triggerRange = 13;
      ctx.spawn(boss);
      ctx.trigger({ x: 0, z: -52, r: 4, once: true, onEnter: function (gg) { S.bossBark(gg, 'thornheart'); } });

      ctx.entry('default', 0, 0, 4, Math.PI);
      ctx.transition({ x0: -2, x1: 2, z0: 4.6, z1: 6.4, to: 'elderwood', entry: 'fromGrove' });
    },
    onBossDefeated: function (g, boss) {
      g.world.addActor(makePrize(g, boss.pos[0], boss.pos[2] - 3, 'grove', {
        text: 'The grove exhales. Green light comes back into the\nleaves from the top down, like a lamp being turned\nup.',
        then: function (g2) {
          g2.hud.toast('Lake Nial has stopped singing. Go and see.');
          g2.goToArea('elderwood', 'fromGrove');
        }
      }));
    }
  }));

  /* ================================================================ */
  /* 4. The Drowned Quarter -- Rime Rod, Tidewrought                   */
  /* ================================================================ */
  A.register(dungeonArea({
    id: 'lakeTemple', name: 'The Drowned Quarter', sub: 'beneath Lake Nial', dungeon: 'lake',
    respawn: 'lakeshore', respawnEntry: 'fromTemple',
    size: { x0: -36, z0: -62, w: 72, d: 100 },
    groundMats: ['tileFloor', 'stoneblock', 'cobble'],
    surfaces: ['stone', 'stone', 'stone'],
    env: K.env.cave({ music: 'lake', ambient: [0.28, 0.34, 0.40], col0: [0.34, 0.44, 0.52],
      fogColor: [0.05, 0.08, 0.11] }),
    build: function (ctx) {
      var g = ctx.game, w = ctx.world;
      var D = 'lake';

      K.dungeon(ctx, {
        entry: { x: 0, z: 0, w: 14, d: 12, h: 5.5, doors: { n: true }, floor: false },
        atrium: { x: 0, z: -20, w: 22, d: 20, h: 8, doors: { s: true, e: true, w: true, n: true }, floor: false },
        east: { x: 26, z: -20, w: 14, d: 14, h: 5.5, doors: { w: true, n: true }, floor: false },
        ne: { x: 26, z: -40, w: 14, d: 14, h: 5.5, doors: { s: true, w: true }, floor: false },
        west: { x: -26, z: -20, w: 14, d: 14, h: 5.5, doors: { e: true }, floor: false },
        upper: { x: 0, z: -40, w: 20, d: 16, h: 6.5, doors: { s: true, e: true, n: true }, floor: false },
        boss: { x: 0, z: -58, w: 26, d: 20, h: 9, doors: { s: true }, floor: false }
      }, { floor: 'tileFloor', wall: 'stoneblock', doorWidth: 3.0 });

      K.corridor(ctx, 0, -9, 6, { w: 3.0, h: 4.2, wall: 'stoneblock' });
      K.corridor(ctx, 18, -20, 8, { w: 3.0, h: 4.2, yaw: Math.PI / 2, wall: 'stoneblock' });
      K.corridor(ctx, -18, -20, 8, { w: 3.0, h: 4.2, yaw: Math.PI / 2, wall: 'stoneblock' });
      K.corridor(ctx, 26, -30, 6, { w: 3.0, h: 4.2, wall: 'stoneblock' });
      K.corridor(ctx, 17, -40, 8, { w: 3.0, h: 4.2, yaw: Math.PI / 2, wall: 'stoneblock' });
      K.corridor(ctx, 0, -31, 6, { w: 3.0, h: 4.2, wall: 'stoneblock' });
      K.corridor(ctx, 0, -49, 5, { w: 3.4, h: 5.0, wall: 'stoneblock' });

      doorway(ctx, 0, -6.2, {});
      doorway(ctx, 0, -29.4, {});
      var eDoor = doorway(ctx, 14, -20, { yaw: Math.PI / 2, locked: 'small', dungeon: D });
      doorway(ctx, -14, -20, { yaw: Math.PI / 2 });
      doorway(ctx, 26, -32.4, {});
      doorway(ctx, 13.5, -40, { yaw: Math.PI / 2 });
      var bossDoor = doorway(ctx, 0, -47, { locked: 'boss', dungeon: D });

      /* flooded atrium: an ice-rod puzzle */
      ctx.water(-9, -28, 9, -12, -0.9, 'deep');
      for (var pl = 0; pl < 4; pl++) {
        var px = -6 + pl * 4;
        P.pillar(ctx.batch, px, 0, -12.5, 5.0, { mat: 'stoneblock' });
        P.pillar(ctx.batch, px, 0, -27.5, 5.0, { mat: 'stoneblock' });
      }

      var torchAt = [[-5, -3], [5, -3], [-10, -12], [10, -12], [-10, -28], [10, -28],
                     [22, -16], [30, -16], [22, -44], [30, -44], [-22, -16], [-30, -16],
                     [-7, -36], [7, -36], [-10, -54], [10, -54]];
      for (var i = 0; i < torchAt.length; i++) K.torch(ctx, torchAt[i][0], torchAt[i][1], { lit: true });

      K.chest(ctx, -26, -18, 'map', { flag: 'lake_map' });
      K.chest(ctx, -26, -22, 'smallKey', { flag: 'lake_key1' });
      K.chest(ctx, 26, -18, 'compass', { flag: 'lake_compass' });

      K.chest(ctx, 26, -42, 'iceRod', { flag: 'lake_icerod', big: true,
        onOpen: function (gg) {
          gg.inv.giveTool('iceRod');
          if (gg.inv.maxMagic === 0) { gg.inv.maxMagic = 48; gg.inv.magic = 48; }
          gg.dialogue.say('RIME ROD\n\nFreezes water into a block you can stand on, and\nfreezes anything alive into something you can\nbreak.',
            { style: 'menu' });
        } });

      var gate4 = K.gate(ctx, 0, -33, { w: 3.2, h: 3.2 });
      ctx.spawn(new LZ.Switch(g, {
        x: 0, y: 0, z: -44, style: 'floor', hold: false, weight: 1,
        onToggle: function (gg, on) { if (on) { gate4.setOpen(true, gg); gg.hud.toast('Water drains somewhere below.'); } }
      }));
      K.chest(ctx, -6, -42, 'bossKey', { flag: 'lake_bosskey', big: true });
      K.chest(ctx, 6, -42, 'smallKey', { flag: 'lake_key2' });

      K.enemies(ctx, [
        { id: 'octorok', x: -6, z: -16 }, { id: 'octorok', x: 6, z: -24 },
        { id: 'chuchu', x: -26, z: -20, variant: 'blue' }, { id: 'keese', x: 26, z: -20, element: 'ice' },
        { id: 'tektite', x: 26, z: -40 }, { id: 'stalfos', x: 0, z: -40 },
        { id: 'beamos', x: -8, z: -44 }, { id: 'skulltula', x: 8, z: -38 }
      ]);

      var boss = LZ.Bosses.make(g, 'tidewrought', { x: 0, y: -0.6, z: -60, water: -0.4 });
      boss.triggerRange = 14;
      ctx.spawn(boss);
      ctx.water(-11, -66, 11, -50, -0.4, 'deep');
      ctx.trigger({ x: 0, z: -52, r: 4, once: true, onEnter: function (gg) { S.bossBark(gg, 'tidewrought'); } });

      ctx.entry('default', 0, 0, 4, Math.PI);
      ctx.transition({ x0: -2, x1: 2, z0: 4.6, z1: 6.4, to: 'lakeshore', entry: 'fromTemple' });
    },
    onBossDefeated: function (g, boss) {
      g.world.addActor(makePrize(g, 0, -56, 'lake', {
        text: 'The singing stops. The lake settles like a sheet\nbeing smoothed onto a bed.',
        then: function (g2) {
          g2.hud.toast('The crypt in the Hollow will open now.');
          g2.goToArea('lakeshore', 'fromTemple');
        }
      }));
    }
  }));

  /* ================================================================ */
  /* 5. The Sunken Crypt -- Lens of Truth, Hollow King                 */
  /* ================================================================ */
  A.register(dungeonArea({
    id: 'crypt', name: 'The Sunken Crypt', sub: 'under the Hollow', dungeon: 'hollow',
    respawn: 'hollow', respawnEntry: 'fromCrypt',
    size: { x0: -34, z0: -60, w: 68, d: 96 },
    groundMats: ['stoneblockDark', 'cobbleDark', 'dirt'],
    surfaces: ['stone', 'stone', 'dirt'],
    env: K.env.cave({ music: 'shadow', ambient: [0.20, 0.20, 0.26], col0: [0.26, 0.24, 0.32],
      fogColor: [0.03, 0.03, 0.05] }),
    build: function (ctx) {
      var g = ctx.game, w = ctx.world;
      var D = 'hollow';

      K.dungeon(ctx, {
        entry: { x: 0, z: 0, w: 14, d: 12, h: 5, doors: { n: true }, floor: false },
        nave: { x: 0, z: -20, w: 22, d: 20, h: 7, doors: { s: true, e: true, w: true, n: true }, floor: false },
        east: { x: 26, z: -20, w: 14, d: 14, h: 5, doors: { w: true, n: true }, floor: false },
        ne: { x: 26, z: -40, w: 14, d: 14, h: 5, doors: { s: true, w: true }, floor: false },
        west: { x: -26, z: -20, w: 14, d: 14, h: 5, doors: { e: true, n: true }, floor: false },
        nw: { x: -26, z: -40, w: 14, d: 14, h: 5, doors: { s: true, e: true }, floor: false },
        upper: { x: 0, z: -40, w: 20, d: 16, h: 6, doors: { s: true, e: true, w: true, n: true }, floor: false },
        boss: { x: 0, z: -58, w: 24, d: 20, h: 9, doors: { s: true }, floor: false }
      }, { floor: 'stoneblockDark', wall: 'stoneblockDark', doorWidth: 3.0 });

      K.corridor(ctx, 0, -9, 6, { w: 3.0, h: 4.0 });
      K.corridor(ctx, 18, -20, 8, { w: 3.0, h: 4.0, yaw: Math.PI / 2 });
      K.corridor(ctx, -18, -20, 8, { w: 3.0, h: 4.0, yaw: Math.PI / 2 });
      K.corridor(ctx, 26, -30, 6, { w: 3.0, h: 4.0 });
      K.corridor(ctx, -26, -30, 6, { w: 3.0, h: 4.0 });
      K.corridor(ctx, 17, -40, 8, { w: 3.0, h: 4.0, yaw: Math.PI / 2 });
      K.corridor(ctx, -17, -40, 8, { w: 3.0, h: 4.0, yaw: Math.PI / 2 });
      K.corridor(ctx, 0, -31, 6, { w: 3.0, h: 4.0 });
      K.corridor(ctx, 0, -49, 5, { w: 3.4, h: 5.0 });

      doorway(ctx, 0, -6.2, { mat: 'stoneblockDark' });
      doorway(ctx, 0, -29.4, { mat: 'stoneblockDark' });
      var eDoor = doorway(ctx, 14, -20, { yaw: Math.PI / 2, locked: 'small', dungeon: D, mat: 'stoneblockDark' });
      doorway(ctx, -14, -20, { yaw: Math.PI / 2, mat: 'stoneblockDark' });
      doorway(ctx, 26, -32.4, { mat: 'stoneblockDark' });
      var nwDoor = doorway(ctx, -26, -32.4, { locked: 'small', dungeon: D, mat: 'stoneblockDark' });
      doorway(ctx, 13.5, -40, { yaw: Math.PI / 2, mat: 'stoneblockDark' });
      doorway(ctx, -13.5, -40, { yaw: Math.PI / 2, mat: 'stoneblockDark' });
      var bossDoor = doorway(ctx, 0, -47, { locked: 'boss', dungeon: D, mat: 'stoneblockDark' });

      /* coffins and cobwebs */
      for (var row = 0; row < 4; row++) {
        for (var s = -1; s <= 1; s += 2) {
          var cx = s * 7, cz = -14 - row * 4;
          var mb = ctx.batch.mb('stoneblock');
          mb.setColorHex(0xbcb4a8);
          mb.box(cx, 0.45, cz, 1.1, 0.9, 2.4, 1.2);
          ctx.col.add(C.box(cx, 0.45, cz, 0.55, 0.45, 1.2, {}));
        }
      }
      for (var t = 0; t < 8; t++) {
        var a = t / 8 * M.TAU;
        P.pillar(ctx.batch, Math.cos(a) * 8.5, 0, -20 + Math.sin(a) * 7.5, 5.6, { mat: 'stoneblockDark' });
      }

      var torchAt = [[-5, -3], [5, -3], [-10, -12], [10, -12], [-10, -28], [10, -28],
                     [22, -16], [30, -16], [-22, -16], [-30, -16], [22, -44], [-22, -44],
                     [-7, -36], [7, -36], [-9, -54], [9, -54]];
      for (var i = 0; i < torchAt.length; i++) K.torch(ctx, torchAt[i][0], torchAt[i][1], { lit: i % 3 !== 0 });

      K.chest(ctx, -26, -18, 'map', { flag: 'crypt_map' });
      K.chest(ctx, 26, -18, 'compass', { flag: 'crypt_compass' });
      K.chest(ctx, 26, -22, 'smallKey', { flag: 'crypt_key1' });
      K.chest(ctx, 26, -42, 'smallKey', { flag: 'crypt_key2' });

      K.chest(ctx, -26, -42, 'lens', { flag: 'crypt_lens', big: true,
        onOpen: function (gg) {
          gg.inv.giveTool('lens');
          if (gg.inv.maxMagic === 0) { gg.inv.maxMagic = 48; gg.inv.magic = 48; }
          gg.dialogue.say('LENS OF TRUTH\n\nHold it up and the crypt stops lying to you. It\ndrinks magic the whole time it is open.',
            { style: 'menu' });
        } });

      /* invisible bridge over a pit, only visible through the Lens */
      var pitLow = -3.6;
      var pm = ctx.batch.mb('cobbleDark');
      pm.setColorHex(0x40404a);
      pm.quad([-4, pitLow, -36], [4, pitLow, -36], [4, pitLow, -44], [-4, pitLow, -44], [3, 3]);
      for (var seg = 0; seg < 5; seg++) {
        var bz = -36 - seg * 1.8;
        ctx.col.add(C.box(0, -0.1, bz, 1.4, 0.1, 0.9, { surface: 'stone' }));
        (function (bz2) {
          var plank = ctx.spawn(new LZ.Actor({ kind: 'ghostplank', x: 0, y: 0, z: bz2, radius: 1.4, height: 0.2 }));
          plank.castShadow = false;
          plank.mesh = (function () {
            var b = new LZ.GL.MeshBuilder();
            b.setColorHex(0xc8c0d8);
            b.box(0, -0.06, 0, 2.8, 0.12, 1.8, 1.4);
            return b.build(g.r);
          })();
          plank.update = function () {};
          var mm = LZ.M4.create();
          plank.draw = function (gg) {
            if (!gg.player.lensOn) return;
            LZ.M4.compose(mm, this.pos[0], this.pos[1], this.pos[2], 0, 0, 0, 1, 1, 1);
            var mat = gg.assets.frameMat('stoneblock', null);
            mat.prim = [0.7, 0.75, 1, 0.75];
            mat.blend = 'alpha';
            mat.depthWrite = false;
            gg.r.submit(this.mesh, mm, mat);
          };
          plank.drawShadow = function () {};
        })(bz);
      }

      /* a floor pit either side so the bridge matters */
      ctx.col.add(C.box(-6.5, pitLow + 0.05, -40, 2.5, 0.05, 4, { noStand: false, surface: 'stone' }));
      ctx.col.add(C.box(6.5, pitLow + 0.05, -40, 2.5, 0.05, 4, { noStand: false, surface: 'stone' }));

      K.chest(ctx, 0, -44, 'bossKey', { flag: 'crypt_bosskey', big: true });

      K.enemies(ctx, [
        { id: 'poe', x: -6, z: -16 }, { id: 'poe', x: 6, z: -24 }, { id: 'poe', x: 0, z: -22 },
        { id: 'gibdo', x: -26, z: -20 }, { id: 'gibdo', x: 26, z: -20 },
        { id: 'stalfos', x: 26, z: -40 }, { id: 'stalfos', x: -26, z: -40 },
        { id: 'keese', x: 0, z: -34 }, { id: 'skulltula', x: 8, z: -42 }
      ]);

      var boss = LZ.Bosses.make(g, 'hollowking', { x: 0, y: 0, z: -60 });
      boss.triggerRange = 14;
      ctx.spawn(boss);
      ctx.trigger({ x: 0, z: -52, r: 4, once: true, onEnter: function (gg) { S.bossBark(gg, 'hollowking'); } });

      ctx.entry('default', 0, 0, 4, Math.PI);
      ctx.transition({ x0: -2, x1: 2, z0: 4.6, z1: 6.4, to: 'hollow', entry: 'fromCrypt' });
    },
    onBossDefeated: function (g, boss) {
      g.world.addActor(makePrize(g, 0, -56, 'hollow', {
        text: 'The crown falls and does not land. There is nothing\nunder it to fall from.\f'
            + 'On the far wall, a seal your great-grandfather cut\ninto the stone finally goes dark. It held for sixty\nyears. It held long enough.',
        then: function (g2) {
          g2.giveItem('sealShard', 1, { describe: false });
          g2.hud.toast('The road south of the Hollow is open.');
          g2.goToArea('hollow', 'fromCrypt');
        }
      }));
    }
  }));

  /* ================================================================ */
  /* 6. Genmo's Fortress -- Mirror Shield, Genmo Ascended              */
  /* ================================================================ */
  A.register(dungeonArea({
    id: 'fortress', name: "Genmo's Fortress", sub: 'the last of it', dungeon: 'fortress',
    respawn: 'fortressApproach', respawnEntry: 'fromFortress',
    size: { x0: -36, z0: -64, w: 72, d: 104 },
    groundMats: ['tileFloor', 'stoneblockDark', 'carpet'],
    surfaces: ['stone', 'stone', 'stone'],
    env: K.env.cave({ music: 'genmo', ambient: [0.24, 0.20, 0.28], col0: [0.34, 0.26, 0.40],
      fogColor: [0.05, 0.03, 0.07] }),
    build: function (ctx) {
      var g = ctx.game, w = ctx.world;
      var D = 'fortress';

      K.dungeon(ctx, {
        entry: { x: 0, z: 0, w: 16, d: 14, h: 6, doors: { n: true }, floor: false },
        hall: { x: 0, z: -22, w: 24, d: 22, h: 9, doors: { s: true, e: true, w: true, n: true }, floor: false,
                floorColor: 0xd8c0c0 },
        east: { x: 28, z: -22, w: 14, d: 14, h: 6, doors: { w: true, n: true }, floor: false },
        ne: { x: 28, z: -42, w: 14, d: 14, h: 6, doors: { s: true, w: true }, floor: false },
        west: { x: -28, z: -22, w: 14, d: 14, h: 6, doors: { e: true, n: true }, floor: false },
        nw: { x: -28, z: -42, w: 14, d: 14, h: 6, doors: { s: true, e: true }, floor: false },
        gallery: { x: 0, z: -42, w: 22, d: 16, h: 7, doors: { s: true, e: true, w: true, n: true }, floor: false },
        throne: { x: 0, z: -60, w: 28, d: 22, h: 11, doors: { s: true }, floor: false,
                  wall: 'stoneblockDark', wallColor: 0x9a8ea8 }
      }, { floor: 'tileFloor', wall: 'stoneblockDark', doorWidth: 3.2 });

      K.corridor(ctx, 0, -10, 6, { w: 3.2, h: 4.4 });
      K.corridor(ctx, 19, -22, 8, { w: 3.2, h: 4.4, yaw: Math.PI / 2 });
      K.corridor(ctx, -19, -22, 8, { w: 3.2, h: 4.4, yaw: Math.PI / 2 });
      K.corridor(ctx, 28, -32, 6, { w: 3.2, h: 4.4 });
      K.corridor(ctx, -28, -32, 6, { w: 3.2, h: 4.4 });
      K.corridor(ctx, 18.5, -42, 8, { w: 3.2, h: 4.4, yaw: Math.PI / 2 });
      K.corridor(ctx, -18.5, -42, 8, { w: 3.2, h: 4.4, yaw: Math.PI / 2 });
      K.corridor(ctx, 0, -34, 6, { w: 3.2, h: 4.4 });
      K.corridor(ctx, 0, -51, 5, { w: 3.6, h: 5.4 });

      doorway(ctx, 0, -7.2, {});
      doorway(ctx, 0, -33.4, {});
      var eDoor = doorway(ctx, 15, -22, { yaw: Math.PI / 2, locked: 'small', dungeon: D });
      var wDoor = doorway(ctx, -15, -22, { yaw: Math.PI / 2, locked: 'small', dungeon: D });
      doorway(ctx, 28, -35.4, {});
      doorway(ctx, -28, -35.4, {});
      doorway(ctx, 15, -42, { yaw: Math.PI / 2 });
      doorway(ctx, -15, -42, { yaw: Math.PI / 2 });
      var bossDoor = doorway(ctx, 0, -48.5, { locked: 'boss', dungeon: D });

      P.banner(ctx.batch, -8, 4.4, -33, { h: 4.2, w: 1.6, mat: 'evil', color: 0xffffff });
      P.banner(ctx.batch, 8, 4.4, -33, { h: 4.2, w: 1.6, mat: 'evil', color: 0xffffff });
      for (var t = 0; t < 6; t++) {
        var a = t / 6 * M.TAU;
        P.pillar(ctx.batch, Math.cos(a) * 9, 0, -22 + Math.sin(a) * 8, 7.4, { mat: 'stoneblockDark' });
      }
      P.statue(ctx.batch, -6, 0, -58, { yaw: 0.3, mat: 'stoneblockDark' });
      P.statue(ctx.batch, 6, 0, -58, { yaw: -0.3, mat: 'stoneblockDark' });

      var torchAt = [[-6, -4], [6, -4], [-11, -14], [11, -14], [-11, -30], [11, -30],
                     [24, -18], [32, -18], [-24, -18], [-32, -18], [24, -46], [-24, -46],
                     [-8, -38], [8, -38], [-11, -56], [11, -56]];
      for (var i = 0; i < torchAt.length; i++) K.torch(ctx, torchAt[i][0], torchAt[i][1], { lit: true });

      K.chest(ctx, -28, -20, 'map', { flag: 'fort_map' });
      K.chest(ctx, 28, -20, 'compass', { flag: 'fort_compass' });
      K.chest(ctx, 28, -24, 'smallKey', { flag: 'fort_key1' });
      K.chest(ctx, -28, -24, 'smallKey', { flag: 'fort_key2' });

      /* the mirror shield: the exam item for the final fight */
      K.chest(ctx, 28, -44, 'mirrorShield', { flag: 'fort_mirror', big: true,
        onOpen: function (gg) {
          gg.dialogue.say('MIRROR SHIELD\n\nRaise it and light comes back off it exactly as\nhard as it arrived.',
            { style: 'menu' });
        } });
      K.chest(ctx, -28, -44, 'royalBlade', { flag: 'fort_blade' });

      /* beamos gauntlet: the mirror shield turns their own beams on them */
      K.enemies(ctx, [
        { id: 'beamos', x: -7, z: -40 }, { id: 'beamos', x: 7, z: -44 },
        { id: 'stalfos', x: -5, z: -18 }, { id: 'stalfos', x: 5, z: -26 },
        { id: 'moblin', x: 0, z: -22, big: true },
        { id: 'poe', x: -28, z: -22 }, { id: 'poe', x: 28, z: -42 },
        { id: 'gibdo', x: -28, z: -42 }, { id: 'wolfos', x: 28, z: -22, variant: 'white' },
        { id: 'keese', x: 0, z: -42 }, { id: 'skulltula', x: -8, z: -44 }
      ]);

      var gateF = K.gate(ctx, 0, -36, { w: 3.4, h: 3.4 });
      ctx.spawn(new LZ.Switch(g, {
        x: -28, y: 0, z: -46, style: 'crystal',
        onToggle: function (gg, on) { gateF.setOpen(on, gg); }
      }));
      K.chest(ctx, 0, -46, 'bossKey', { flag: 'fort_bosskey', big: true });

      var boss = LZ.Bosses.make(g, 'genmoFinal', { x: 0, y: 0, z: -62 });
      boss.triggerRange = 15;
      ctx.spawn(boss);
      ctx.trigger({ x: 0, z: -54, r: 4.5, once: true, onEnter: function (gg) { S.bossBark(gg, 'genmoFinal'); } });

      ctx.entry('default', 0, 0, 5, Math.PI);
      ctx.transition({ x0: -2, x1: 2, z0: 5.6, z1: 7.4, to: 'fortressApproach', entry: 'fromFortress' });
    },
    onBossDefeated: function (g, boss) {
      S.ending(g);
    }
  }));

  LZ.DungeonsLoaded = true;
})(LZ);
