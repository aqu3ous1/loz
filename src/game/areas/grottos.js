/* =============================================================
   game/areas/grottos.js -- the optional half of the world.

   The main path is a spine: village, smith, desert, then five seals in
   roughly any order and a fortress at the end. Everything in this file
   hangs off that spine and is skippable, which is what makes the world
   feel worth walking through rather than walking along.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var M = LZ.M, K = LZ.Kit, P = LZ.Props, C = LZ.Collision, A = LZ.Areas, S = LZ.Script;

  /* append extra build steps to an already-registered area */
  function extend(id, fn) {
    var a = A.get(id);
    if (!a) { console.warn('cannot extend missing area ' + id); return; }
    var orig = a.build;
    a.build = function (ctx) { orig(ctx); fn(ctx); };
  }

  /* a bombable boulder that opens a grotto entrance */
  function grottoMouth(ctx, x, z, to, o) {
    o = o || {};
    var g = ctx.game, w = ctx.world;
    var y = w.groundHeight(x, z);
    var opened = g.inv.flag('grotto_' + to);
    /* the rock face around the hole */
    var mb = ctx.batch.mb(o.mat || 'rock');
    mb.setColorHex(o.color === undefined ? 0xffffff : o.color);
    mb.taper(x, y, z, 5.2, 4.4, 3.6, 3.0, 3.6, 0, 0, 0.9);
    ctx.col.add(C.box(x - 2.0, y + 1.6, z, 0.8, 1.6, 1.6, {}));
    ctx.col.add(C.box(x + 2.0, y + 1.6, z, 0.8, 1.6, 1.6, {}));
    ctx.col.add(C.box(x, y + 2.9, z, 2.6, 0.8, 1.6, {}));
    ctx.col.add(C.box(x, y + 1.6, z - 1.4, 2.6, 1.6, 0.5, {}));

    if (!opened) {
      K.bombWall(ctx, x, z + 1.1, {
        y: y, w: 2.6, h: 2.6, mat: o.mat || 'rock',
        onBreak: function (gg) { gg.inv.setFlag('grotto_' + to); }
      });
    }
    K.door(ctx, {
      x: x, y: y, z: z + 1.5, to: to, entry: 'default', label: 'Enter',
      cond: function (gg) { return gg.inv.flag('grotto_' + to); },
      denyText: 'Solid rock, but the crack in it looks deliberate.'
    });
  }

  /* a grotto whose entrance is simply open (no bomb needed) */
  function openMouth(ctx, x, z, to, o) {
    o = o || {};
    var w = ctx.world;
    var y = w.groundHeight(x, z);
    var mb = ctx.batch.mb(o.mat || 'rockDark');
    mb.setColorHex(o.color === undefined ? 0xffffff : o.color);
    mb.taper(x, y, z, 5.6, 4.6, 3.8, 3.2, 3.8, 0, 0, 0.9);
    ctx.col.add(C.box(x - 2.2, y + 1.7, z, 0.9, 1.7, 1.7, {}));
    ctx.col.add(C.box(x + 2.2, y + 1.7, z, 0.9, 1.7, 1.7, {}));
    ctx.col.add(C.box(x, y + 3.1, z, 2.8, 0.8, 1.7, {}));
    ctx.col.add(C.box(x, y + 1.7, z - 1.5, 2.8, 1.7, 0.5, {}));
    K.door(ctx, { x: x, y: y, z: z + 1.6, to: to, entry: 'default', label: 'Enter' });
  }

  /* ================================================================ */
  /* Grotto interiors                                                  */
  /* ================================================================ */
  K.grotto({
    id: 'grottoFarrow', name: 'Hollow Under the Hill', back: 'farrow', backEntry: 'fromGrotto',
    build: function (ctx) {
      K.chest(ctx, 0, -3.5, 'heartPiece', { flag: 'hp_grottoFarrow' });
      K.pots(ctx, [[-4, 0], [4, 0]]);
      K.enemies(ctx, [{ id: 'chuchu', x: -3, z: -1 }, { id: 'keese', x: 3, z: -2 }]);
      K.sign(ctx, 0, 3.6, 'Someone slept here once. There is a ring of old\nashes and a very small carved boat.', Math.PI);
    }
  });

  K.grotto({
    id: 'grottoYeld', name: 'Roadside Hollow', back: 'yeld', backEntry: 'fromGrotto',
    w: 16, d: 15,
    build: function (ctx) {
      K.chest(ctx, 0, -4, 'bombBag', { flag: 'up_bombbag', big: true });
      K.enemies(ctx, [
        { id: 'moblin', x: -3.5, z: -2 }, { id: 'chuchu', x: 3.5, z: -2, variant: 'red' },
        { id: 'keese', x: 0, z: 0 }
      ]);
      K.hintStone(ctx, -5, 3, 'Every hill in Hyrule is hollow. Most of them are\nempty. Most.');
    }
  });

  K.grotto({
    id: 'grottoDunes', name: 'Buried Room', back: 'dunes', backEntry: 'fromGrotto',
    floor: 'sandDark', wall: 'sandstone', wallColor: 0xc8b088,
    build: function (ctx) {
      K.chest(ctx, 0, -4, 'gibdoMask', { flag: 'mask_gibdo', big: true,
        onOpen: function (gg) { gg.inv.setFlag('gotMask_gibdo'); } });
      K.enemies(ctx, [{ id: 'gibdo', x: -3, z: -1 }, { id: 'gibdo', x: 3, z: -1 }]);
      K.sign(ctx, 0, 3.6, 'The wrappings on the shelf are folded, not torn.\nSomebody put them here on purpose.', Math.PI);
    }
  });

  K.grotto({
    id: 'grottoAsh', name: 'Vent Chamber', back: 'ashRoad', backEntry: 'fromGrotto',
    floor: 'rockAsh', wall: 'rockAsh', wallColor: 0x9a8c80, ambient: [0.34, 0.28, 0.26],
    build: function (ctx) {
      K.chest(ctx, 0, -4, 'magicJar', { flag: 'up_magic', big: true });
      K.enemies(ctx, [
        { id: 'emberBeetle', x: -3, z: -1 }, { id: 'emberBeetle', x: 3, z: -1 },
        { id: 'emberBeetle', x: 0, z: -3 }
      ]);
      K.torch(ctx, 0, -5.4, { lit: true });
    }
  });

  K.grotto({
    id: 'grottoWood', name: 'Root Cellar', back: 'elderwood', backEntry: 'fromGrotto',
    floor: 'dirt', wall: 'bark', wallColor: 0xb09878, ambient: [0.30, 0.32, 0.28],
    build: function (ctx) {
      K.chest(ctx, -3, -4, 'heartPiece', { flag: 'hp_grottoWood' });
      K.chest(ctx, 3, -4, 'bottle', { flag: 'bottle_wood' });
      K.enemies(ctx, [{ id: 'skulltula', x: 0, z: -1 }, { id: 'chuchu', x: -3, z: 1, variant: 'green' }]);
    }
  });

  K.grotto({
    id: 'grottoLake', name: 'Behind the Falls', back: 'lakeshore', backEntry: 'fromGrotto',
    floor: 'cobble', wall: 'rock', ambient: [0.28, 0.32, 0.38],
    build: function (ctx) {
      K.chest(ctx, -3, -4, 'quiver', { flag: 'up_quiver', big: true });
      K.chest(ctx, 3, -4, 'heartPiece', { flag: 'hp_grottoLake' });
      K.enemies(ctx, [{ id: 'octorok', x: 0, z: -1 }, { id: 'tektite', x: -3, z: 1 }]);
    }
  });

  K.grotto({
    id: 'grottoHollow', name: 'Forgotten Vault', back: 'hollow', backEntry: 'fromGrotto',
    floor: 'stoneblockDark', wall: 'stoneblockDark', ambient: [0.22, 0.22, 0.28],
    build: function (ctx) {
      K.chest(ctx, 0, -4, 'heartPiece', { flag: 'hp_grottoHollow' });
      K.chest(ctx, -4, -2, 'wallet', { flag: 'up_wallet', big: true });
      K.enemies(ctx, [{ id: 'poe', x: 0, z: -1 }, { id: 'stalfos', x: 3, z: 0 }]);
      K.sign(ctx, 0, 3.6, 'A strongbox, long since emptied, and a note:\n"IF YOU FOUND THIS YOU WERE LOOKING PROPERLY."', Math.PI);
    }
  });

  /* ================================================================ */
  /* Hook the grottos and side quests into the overworld               */
  /* ================================================================ */
  extend('farrow', function (ctx) {
    var g = ctx.game, w = ctx.world;
    grottoMouth(ctx, -26, -12, 'grottoFarrow', {});
    ctx.entry('fromGrotto', -26, undefined, -8.6, 0);

    /* the missing flock: three hens hiding around the village */
    if (!g.inv.flag('done_sq_cucco')) {
      var spots = [[-17, 18], [19, -12], [8, 26]];
      for (var i = 0; i < 3; i++) {
        if (g.inv.flag('hen' + i)) continue;
        (function (idx, sx, sz) {
          var hen = ctx.spawn(new LZ.Actor({
            kind: 'hen', x: sx, y: w.groundHeight(sx, sz), z: sz, radius: 0.24, height: 0.4
          }));
          hen.interactable = true;
          hen.interactRange = 1.1;
          hen.actionLabel = 'Grab';
          hen.shadowSize = 0.5;
          hen.phase = Math.random() * 6;
          hen.mesh = (function () {
            var b = new LZ.GL.MeshBuilder();
            b.setColorHex(0xf0ece0);
            b.sphere(0, 0.30, 0, 0.24, 6, 4, 0.9);
            b.sphere(0, 0.52, 0.10, 0.13, 5, 3, 1);
            b.setColorHex(0xd8b040);
            b.taper(0, 0.50, 0.22, 0.06, 0.06, 0.01, 0.01, 0.10, 0, 0.06, 2);
            b.setColorHex(0xc03030);
            b.box(0, 0.64, 0.06, 0.05, 0.10, 0.10, 2);
            return b.build(g.r);
          })();
          hen.update = function (dt, gg) {
            this.phase += dt;
            var d = LZ.V3.distXZ(this.pos, gg.player.pos);
            if (d < 3.2) {
              /* flee, but never far -- this is a chore, not a challenge */
              var a = Math.atan2(this.pos[0] - gg.player.pos[0], this.pos[2] - gg.player.pos[2]);
              this.targetYaw = a;
              this.moveXZ(Math.sin(a) * 2.4 * dt, Math.cos(a) * 2.4 * dt, gg.world);
              if (Math.random() < dt * 2) gg.audio.sfx('blip', { minGap: 0.4 });
            }
            this.turnToward(dt);
            this.applyGravity(dt, gg.world);
          };
          var m = LZ.M4.create();
          hen.draw = function (gg) {
            var bob = Math.sin(this.phase * 8) * 0.03;
            LZ.M4.compose(m, this.pos[0], this.pos[1] + bob, this.pos[2], 0, this.yaw, 0, 1, 1, 1);
            gg.r.submit(this.mesh, m, gg.assets.mat.clothWhite);
          };
          hen.act = function (gg) {
            gg.inv.setFlag('hen' + idx);
            gg.inv.bump('hens');
            gg.audio.sfx('rupee');
            gg.hud.toast('Caught a hen (' + gg.inv.counter('hens') + '/3)');
            this.removeMe = true;
          };
        })(i, spots[i][0], spots[i][1]);
      }
      K.npc(ctx, {
        x: -6, z: 18, yaw: 0.4, name: 'Hemm', palette: 4, build: 'adult',
        talk: function (gg) {
          var n = gg.inv.counter('hens');
          if (gg.inv.flag('done_sq_cucco')) {
            gg.dialogue.say('They have not wandered since. I think they are\nfrightened of you now.',
              { speaker: 'Hemm' });
            return;
          }
          if (n >= 3) {
            gg.inv.setFlag('done_sq_cucco');
            gg.dialogue.say('All three! You are a better hand than half the\nvillage.\fTake this. My mother said it was lucky and my\nmother was never wrong about anything except men.',
              { speaker: 'Hemm', onDone: function () { gg.giveItem('heartPiece', 1, { fanfare: true }); } });
            return;
          }
          gg.dialogue.say('Three hens out of the coop again. They will be\nsomewhere stupid.\f(' + n + ' of 3 found.)',
            { speaker: 'Hemm' });
        }
      });
    }
  });

  extend('yeld', function (ctx) {
    var g = ctx.game, w = ctx.world;
    grottoMouth(ctx, 30, -34, 'grottoYeld', {});
    ctx.entry('fromGrotto', 30, undefined, -30.4, 0);

    /* the Hare Hood: a footrace along the road */
    if (!g.inv.hasMask('hareMask')) {
      var race = { running: false, t: 0, best: g.inv.counter('raceBest') };
      var runner = K.npc(ctx, {
        x: 6, z: -36, yaw: Math.PI, name: 'Sprinting Fen', palette: 3, build: 'teen',
        hairStyle: 'ponytail',
        talk: function (gg) {
          if (race.running) {
            gg.dialogue.say('You are supposed to be RUNNING.', { speaker: 'Sprinting Fen' });
            return;
          }
          gg.dialogue.ask('I run this road every morning. Nobody has ever\nbeaten me to the far marker.\f'
            + 'Twenty-two seconds. That is the number. Go on.',
            ['Race him', 'Some other time'],
            function (i) {
              if (i !== 0) return;
              race.running = true;
              race.t = 0;
              gg.audio.sfx('menu_ok');
              gg.hud.toast('GO! Reach the south marker!');
            }, { speaker: 'Sprinting Fen' });
        }
      });
      ctx.trigger({
        x: 0, z: 44, r: 5,
        onEnter: function (gg) {
          if (!race.running) return;
          race.running = false;
          if (race.t <= 22) {
            gg.audio.sfx('fanfare_big');
            gg.giveItem('hareMask', 1, { fanfare: true });
            gg.inv.setFlag('done_sq_masks_hare');
            gg.hud.toast('Beat Fen by ' + (22 - race.t).toFixed(1) + 's!');
          } else {
            gg.audio.sfx('error');
            gg.hud.toast('Too slow: ' + race.t.toFixed(1) + 's. Try again.');
          }
        }
      });
      ctx.emitter({
        x: 0, z: 0, interval: 0.1, fn: function (gg) {
          if (!race.running) return;
          race.t += 0.1;
          if (race.t > 45) { race.running = false; gg.hud.toast('Fen is already home. Try again.'); }
        }
      });
      K.sign(ctx, -3, 44, 'THE SOUTH MARKER\n(Somebody has scratched "22" into it.)', Math.PI);
    }
  });

  extend('dunes', function (ctx) {
    var g = ctx.game, w = ctx.world;
    grottoMouth(ctx, -28, -30, 'grottoDunes', { mat: 'rockRed' });
    ctx.entry('fromGrotto', -28, undefined, -26.4, 0);

    /* the mask collector: trades for the Stone Mask */
    K.npc(ctx, {
      x: 14, z: 30, yaw: 2.6, name: 'Odd Trader', palette: 5, build: 'lanky',
      hat: 'hood', hatColor: 0x4a3a58,
      talk: function (gg) {
        if (gg.inv.hasMask('stoneMask')) {
          gg.dialogue.say('Faces, faces. Everyone has one and nobody looks\nat their own.',
            { speaker: 'Odd Trader' });
          return;
        }
        if (!gg.inv.hasMask('gibdoMask') && !gg.inv.hasMask('hareMask')) {
          gg.dialogue.say('I buy faces. Not YOUR face. Faces that are not\nattached to anyone.\f'
            + 'Bring me one and I will show you something better.',
            { speaker: 'Odd Trader' });
          return;
        }
        gg.dialogue.say('There. You have found one. Good.\f'
          + 'Then you should have this, and you should never\ntell me where you wear it.',
          { speaker: 'Odd Trader',
            onDone: function () {
              gg.giveItem('stoneMask', 1, { fanfare: true });
              gg.inv.setFlag('done_sq_masks');
            } });
      }
    });
  });

  extend('ashRoad', function (ctx) {
    var g = ctx.game;
    grottoMouth(ctx, 22, 10, 'grottoAsh', { mat: 'rockAsh' });
    ctx.entry('fromGrotto', 22, undefined, 13.6, 0);
  });

  extend('elderwood', function (ctx) {
    var g = ctx.game;
    openMouth(ctx, 26, -26, 'grottoWood', { mat: 'bark', color: 0xa89078 });
    ctx.entry('fromGrotto', 26, undefined, -22.4, 0);
  });

  extend('lakeshore', function (ctx) {
    var g = ctx.game, w = ctx.world;
    /* behind a waterfall on the north wall */
    P.waterfall(ctx.batch, 30, w.groundHeight(30, -30) + 6.5, -27.4, 5, 7, {});
    openMouth(ctx, 30, -30, 'grottoLake', { mat: 'rock' });
    ctx.entry('fromGrotto', 30, undefined, -26.4, 0);
  });

  extend('hollow', function (ctx) {
    var g = ctx.game;
    grottoMouth(ctx, -26, 14, 'grottoHollow', { mat: 'rockDark' });
    ctx.entry('fromGrotto', -26, undefined, 17.6, 0);
  });

  /* ---- Stonebell: the wind singer teaches the warp song ---- */
  extend('stonebell', function (ctx) {
    var g = ctx.game;
    K.npc(ctx, {
      x: 14, z: 22, yaw: -2.2, name: 'Wind Singer', palette: 5, build: 'adult',
      hairStyle: 'long', hair: 0xd8d4cc,
      talk: function (gg) {
        var seen = 0;
        for (var k in gg.inv.visited) if (gg.inv.visited[k]) seen++;
        if (gg.inv.hasSong('windsCall')) {
          gg.dialogue.say('The wind knows where you have been. It is the only\nthing that keeps track.',
            { speaker: 'Wind Singer' });
          return;
        }
        if (!gg.inv.hasTool('flute')) {
          gg.dialogue.say('You have no instrument. There is nothing I can\nteach a boy with no instrument.',
            { speaker: 'Wind Singer' });
          return;
        }
        if (seen < 4) {
          gg.dialogue.say('Walk further first. A song about going home is\nwasted on someone who has not gone anywhere.\f(' + seen + ' places seen. Four will do.)',
            { speaker: 'Wind Singer' });
          return;
        }
        gg.dialogue.say('You have been up and down this kingdom twice now.\fHere. It will save your legs.',
          { speaker: 'Wind Singer',
            onDone: function () { gg.giveSong('windsCall'); gg.inv.setFlag('done_sq_songs'); } });
      }
    });
  });

  /* ---- Hanman: the flute and the two time songs ---- */
  extend('hanman', function (ctx) {
    var g = ctx.game;
    K.npc(ctx, {
      x: -16, z: 22, yaw: 1.4, name: 'Amjed the Elder', palette: 6, build: 'adult',
      hat: 'turban', hatColor: 0xd8c8a0, skin: 0xc08a5c, beard: true, beardColor: 0xd8d4cc,
      talk: function (gg) {
        if (!gg.inv.hasTool('flute')) {
          gg.dialogue.say('Your great-grandfather left this here forty years\nago and never came back for it.\f'
            + 'I have been dusting it every week since, feeling\nlike a fool. Take it. Let me stop.',
            { speaker: 'Amjed the Elder',
              onDone: function () { gg.giveItem('flute', 1, { fanfare: true }); } });
          return;
        }
        if (!gg.inv.hasSong('verseOfReturn')) {
          gg.dialogue.say('He played four songs on it and only ever explained\ntwo.\f'
            + 'This one pulls the last little while back into\nplace. He used it constantly. He was very clumsy.',
            { speaker: 'Amjed the Elder',
              onDone: function () { gg.giveSong('verseOfReturn'); } });
          return;
        }
        if (!gg.inv.hasSong('hymnOfAges')) {
          gg.dialogue.say('And this one. He would only play it in the\nElderwood, and he always came back looking\ntwenty years younger and very sad.',
            { speaker: 'Amjed the Elder',
              onDone: function () { gg.giveSong('hymnOfAges'); } });
          return;
        }
        gg.dialogue.say('Songs are just instructions somebody wrote down\nwhen they were too tired to explain properly.',
          { speaker: 'Amjed the Elder' });
      }
    });
  });

  /* ---- the Gravekeeper hands over the Mask of Truth for hint stones ---- */
  extend('hollow', function (ctx) {
    var g = ctx.game;
    K.npc(ctx, {
      x: 12, z: 12, yaw: -1.2, name: 'Stone Listener', palette: 3, build: 'child',
      talk: function (gg) {
        if (gg.inv.hasMask('truthMask')) {
          gg.dialogue.say('The stones like you now. They told me.',
            { speaker: 'Stone Listener' });
          return;
        }
        var seen = 0;
        for (var k in gg.inv.visited) if (gg.inv.visited[k]) seen++;
        if (seen < 6) {
          gg.dialogue.say('The grey stones talk but you cannot hear them yet.\f'
            + 'Go and stand in more places. Then come back.\n(' + seen + ' of 6 places.)',
            { speaker: 'Stone Listener' });
          return;
        }
        gg.dialogue.say('You have been everywhere. Here.\fNow you can hear them too, and you will wish you\ncould stop.',
          { speaker: 'Stone Listener',
            onDone: function () {
              gg.giveItem('truthMask', 1, { fanfare: true });
              gg.inv.setFlag('done_sq_masks');
            } });
      }
    });
  });

  LZ.GrottosLoaded = true;
})(LZ);
