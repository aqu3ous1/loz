/* =============================================================
   game/areas/homes.js -- the interiors behind every ordinary door.

   Every building in this game used to be a shell with a hole punched in
   its collider, so walking at a door put you inside an empty box looking
   at the back of its own walls. Each one now leads somewhere.

   Hand-authoring twenty rooms would be twenty rooms of the same three
   pieces of furniture, so the layout is drawn deterministically from the
   dwelling's own id: the same house is the same house every time you go
   back, but no two are laid out alike. Only the residents are written by
   hand, because that is the part a player actually reads.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var A = LZ.Areas, K = LZ.Kit, P = LZ.Props, M = LZ.M;

  /* a tiny deterministic sequence, seeded from the dwelling id */
  function seedOf(id) {
    var h = 0;
    for (var i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
    return h >>> 0;
  }
  function rngFrom(seed) {
    var s = seed || 1;
    return function () {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /* Regional dressing. A Gerudo house is not a Farrow house: the walls,
     the floor and what people keep indoors all change with the town. */
  var STYLES = {
    farrow: {
      floor: 'planks', wall: 'plaster', wallColor: 0xdcc9a4, floorColor: 0xffffff,
      ambient: [0.46, 0.42, 0.38], roofBeams: true
    },
    stonebell: {
      floor: 'tileFloor', wall: 'plaster', wallColor: 0xc8cbd4, floorColor: 0xffffff,
      ambient: [0.44, 0.44, 0.48], roofBeams: true
    },
    hanman: {
      floor: 'sandstone', wall: 'sandstone', wallColor: 0xe8d6ac, floorColor: 0xffffff,
      ambient: [0.52, 0.47, 0.38], roofBeams: false, rug: 'carpet'
    },
    ashvale: {
      floor: 'planksDark', wall: 'planksDark', wallColor: 0xb49878, floorColor: 0xffffff,
      ambient: [0.38, 0.35, 0.33], roofBeams: true
    }
  };

  /* Furnish a room. Everything is placed against a wall or in a corner,
     because a room with furniture floating in the middle of it reads as a
     showroom rather than as somewhere someone lives. */
  function furnish(ctx, id, style, w, d, o) {
    var rng = rngFrom(seedOf(id));
    var hw = w / 2 - 0.7, hd = d / 2 - 0.7;
    var batch = ctx.batch;

    /* the bed, always against the back wall, on one side or the other */
    var bedSide = rng() < 0.5 ? -1 : 1;
    P.bed(batch, bedSide * (hw - 0.5), 0, -hd + 0.4, {
      yaw: bedSide < 0 ? Math.PI / 2 : -Math.PI / 2,
      sheet: rng() < 0.5 ? 'clothWhite' : 'clothBlue'
    });

    /* a hearth on the opposite back corner, lit */
    var hx = -bedSide * (hw - 0.35), hz = -hd + 0.25;
    var mb = batch.mb('brick');
    mb.setColorHex(0xffffff);
    mb.box(hx, 0.62, hz, 1.15, 1.24, 0.55, 1.5);
    mb.setColorHex(0x2a2420);
    mb.box(hx, 0.40, hz + 0.30, 0.68, 0.68, 0.06, 1.5);
    if (ctx.col) ctx.col.add(LZ.Collision.box(hx, 0.62, hz, 0.58, 0.62, 0.28, {}));
    K.torch(ctx, hx, hz + 0.36, { y: 0.36, h: 0.34, lit: true });

    /* a table with a chair or two, off-centre */
    var tx = (rng() - 0.5) * (w - 3.6);
    var tz = (rng() * 0.5) * d * 0.3;
    P.table(batch, tx, 0, tz, { w: 1.3 + rng() * 0.5, d: 0.85 });
    P.chair(batch, tx - 0.95, 0, tz, { yaw: -Math.PI / 2 });
    if (rng() < 0.6) P.chair(batch, tx + 0.95, 0, tz, { yaw: Math.PI / 2 });

    /* storage along the side walls */
    var n = 2 + Math.floor(rng() * 3);
    for (var i = 0; i < n; i++) {
      var side = rng() < 0.5 ? -1 : 1;
      var px = side * (hw - 0.1);
      var pz = -hd + 1.2 + rng() * (d - 2.8);
      var pick = rng();
      if (pick < 0.36) P.barrel(batch, px, 0, pz, { scale: 0.85 + rng() * 0.2 });
      else if (pick < 0.68) P.crate(batch, px, 0, pz, { scale: 0.75 + rng() * 0.25 });
      else P.sack(batch, px, 0, pz, { yaw: rng() * 3, scale: 0.9 });
    }

    /* a rug, where the region has them */
    if (style.rug && rng() < 0.8) {
      var rm = batch.mb(style.rug);
      rm.setColorHex(0xffffff);
      rm.quad([-1.5, 0.02, 1.1], [1.5, 0.02, 1.1], [1.5, 0.02, -1.1], [-1.5, 0.02, -1.1], [1, 1]);
    }

    /* ceiling beams */
    if (style.roofBeams) {
      var bm = batch.mb('planksDark');
      bm.setColorHex(0xa08258);
      var beams = 3;
      for (var b2 = 0; b2 < beams; b2++) {
        var bz = -d / 2 + (b2 + 1) * (d / (beams + 1));
        bm.tube([{ x: -w / 2, y: (o.h || 2.9) - 0.22, z: bz, r: 0.10 },
                 { x: w / 2, y: (o.h || 2.9) - 0.22, z: bz, r: 0.10 }], 5, { axis: 'x', u: 3, v: 1 });
      }
    }

    /* pots, because everything in this genre keeps its money in pots */
    if (rng() < 0.75) {
      K.pots(ctx, [[-hw + 0.4, hd - 0.9], [-hw + 1.0, hd - 0.9]]);
    }
  }

  /* Register one dwelling. `o.lines` is the resident's conversation; the
     rest of the room comes from the id. */
  function dwelling(o) {
    var style = STYLES[o.town] || STYLES.farrow;
    var w = o.w || 8.4, d = o.d || 7.2, h = o.h || 2.9;
    A.register({
      id: o.id,
      name: o.name,
      quiet: true,
      cell: 1,
      respawn: o.back,
      size: { x0: -w / 2 - 3, z0: -d / 2 - 3, w: w + 6, d: d + 6 },
      groundMats: [style.floor],
      surfaces: [style.floor === 'planks' || style.floor === 'planksDark' ? 'wood' : 'stone'],
      terrain: K.flat(0, 0),
      env: K.env.interior({ ambient: style.ambient }),
      build: function (ctx) {
        K.interiorShell(ctx, {
          w: w, d: d, h: h, exitTo: o.back, exitEntry: o.backEntry || 'default',
          floor: style.floor, wall: style.wall,
          wallColor: style.wallColor, floorColor: style.floorColor
        });
        furnish(ctx, o.id, style, w, d, { h: h });

        /* the resident */
        if (o.resident) {
          var r = o.resident;
          K.npc(ctx, {
            x: r.x === undefined ? 1.4 : r.x,
            z: r.z === undefined ? -0.8 : r.z,
            yaw: r.yaw === undefined ? Math.PI : r.yaw,
            name: r.name, palette: r.palette === undefined ? 2 : r.palette,
            build: r.build || 'adult',
            hairStyle: r.hairStyle || 'short',
            wander: r.wander === undefined ? 1.1 : r.wander,
            lines: r.lines
          });
        }
        if (o.extra) o.extra(ctx);
      }
    });
  }

  /* ---------------------------------------------------------------- */
  /* The residents                                                     */
  /* ---------------------------------------------------------------- */
  var HOMES = [
    /* ---- Farrow ---- */
    { id: 'farrowHomeA', name: 'Ferrier Cottage', town: 'farrow', back: 'farrow',
      resident: { name: 'Ferrier', palette: 1, hairStyle: 'short', lines: [
        'Your great-grandfather taught half this village to\nswim in the Yeld ponds.',
        'He never once told us how he got the scar on his\nhand. We stopped asking about forty years ago.'
      ] } },
    { id: 'farrowHomeB', name: 'The Weaver\'s', town: 'farrow', back: 'farrow',
      resident: { name: 'Mella', palette: 3, build: 'adult', hairStyle: 'ponytail', lines: [
        'Mind the loom. It is older than either of us and\ntwice as stubborn.',
        'If you are going south, take a cloak. The plains\nare colder than they look from here.'
      ] } },
    { id: 'farrowHomeC', name: 'Old Pell\'s', town: 'farrow', back: 'farrow',
      resident: { name: 'Pell', palette: 4, build: 'old', wander: 0, lines: [
        'Sit if you like. Nobody comes in here to stand.',
        'Sixty years I have watched that man get slower.\nAnd every year he still walked out to the gate to\nsee the sun come up.'
      ] } },
    { id: 'farrowHomeD', name: 'The Cooper\'s', town: 'farrow', back: 'farrow',
      resident: { name: 'Dunn', palette: 5, lines: [
        'Barrels. You want one? Everyone wants one until\nthey have to carry it.',
        'Something has the birds spooked. Been three days\nnow. They know before we do.'
      ] } },
    { id: 'farrowHomeE', name: 'The Long House', town: 'farrow', back: 'farrow', w: 9.4, d: 7.6,
      resident: { name: 'Tarn', palette: 2, build: 'heavy', lines: [
        'Four of us in here and not one washes a dish.',
        'My brother went to Stonebell for the market and\ncame back saying the clock had stopped. A clock\nthat has never stopped in two hundred years.'
      ] } },

    /* ---- Stonebell ---- */
    { id: 'stoneHomeA', name: 'Bell Street House', town: 'stonebell', back: 'stonebell',
      resident: { name: 'Hessa', palette: 3, hairStyle: 'ponytail', lines: [
        'You hear it? No. That is the point. The bell has\nnot rung since the night the tower went quiet.',
        'We used to set the bread by it. Now we guess.'
      ] } },
    { id: 'stoneHomeB', name: 'The Tanner\'s', town: 'stonebell', back: 'stonebell',
      resident: { name: 'Orin', palette: 6, build: 'heavy', lines: [
        'Smells in here, I know. Leather does that.',
        'Doram is the honest one. The other fellow with the\nfine coat will polish your sword and hand it back\nlighter than it went in.'
      ] } },
    { id: 'stoneHomeC', name: 'Widow Cael\'s', town: 'stonebell', back: 'stonebell',
      resident: { name: 'Cael', palette: 4, build: 'old', wander: 0, lines: [
        'My husband climbed that tower every week for\nthirty years to wind it.',
        'Whatever is up there now did not walk in through\nthe door. I would have seen it.'
      ] } },
    { id: 'stoneHomeD', name: 'The Carter\'s', town: 'stonebell', back: 'stonebell',
      resident: { name: 'Bree', palette: 1, build: 'teen', hairStyle: 'ponytail', lines: [
        'I drive the cart to Hanman and back. Or I did.',
        'There is a boy down there who took a sweet off a\nchild and laughed. I would not have thought about\nit twice, except the guards went for him and he\nwas not afraid.'
      ] } },
    { id: 'stoneHomeE', name: 'The Chandler\'s', town: 'stonebell', back: 'stonebell',
      resident: { name: 'Ives', palette: 5, lines: [
        'Candles. Tallow, mostly. Beeswax if you are rich\nor lying.',
        'Buy the lantern oil before you go into anything\nunderground. Everyone says they will and nobody\ndoes.'
      ] } },

    /* ---- Hanman ---- */
    { id: 'hanmanHomeA', name: 'Shaded House', town: 'hanman', back: 'hanman',
      resident: { name: 'Nawal', palette: 2, hairStyle: 'long', lines: [
        'Come in out of it. Nobody stands in that sun by\nchoice.',
        'Water is shared here. Shade is not. Remember which\nis which and you will get on fine.'
      ] } },
    { id: 'hanmanHomeB', name: 'The Dyer\'s', town: 'hanman', back: 'hanman',
      resident: { name: 'Sef', palette: 6, lines: [
        'Every colour in this room came out of a plant that\ngrows in a place with no water. Think about that.',
        'The boy? Genmo. Nobody\'s son in particular. His\ngrandmother raised him and she is gone now.'
      ] } },
    { id: 'hanmanHomeC', name: 'The Well House', town: 'hanman', back: 'hanman',
      resident: { name: 'Tamir', palette: 4, build: 'old', wander: 0, lines: [
        'I keep the well. That is the whole of it.',
        'Something came up out of the sand two months back\nand went north. I did not see it. I felt it in the\nrope.'
      ] } },
    { id: 'hanmanHomeD', name: 'Caravan Rest', town: 'hanman', back: 'hanman', w: 9.0, d: 7.6,
      resident: { name: 'Ilsa', palette: 3, build: 'adult', hairStyle: 'ponytail', lines: [
        'Beds for anyone who pays. Floor for anyone who\ndoes not.',
        'Traders stopped coming down the north road. That\nhas never happened in my lifetime.'
      ] } },
    { id: 'hanmanHomeE', name: 'The Potter\'s', town: 'hanman', back: 'hanman',
      resident: { name: 'Ruhi', palette: 5, build: 'teen', lines: [
        'Do not touch those. They are drying.',
        'I went to school with him. He broke things. Not\nbecause he wanted them broken -- because he wanted\nto see whether anyone would stop him.'
      ] } },
    { id: 'hanmanHomeF', name: 'The Herbalist\'s', town: 'hanman', back: 'hanman',
      resident: { name: 'Aqel', palette: 1, build: 'old', wander: 0, lines: [
        'Bitter root, sun-thistle, dune sage. All of it\nkeeps you alive and none of it tastes of anything\ngood.',
        'Red for blood, green for magic. If you cannot\nremember that, write it on your hand.'
      ] } },
    { id: 'hanmanHomeG', name: 'Guard Billet', town: 'hanman', back: 'hanman',
      resident: { name: 'Off-Duty Guard', palette: 2, build: 'heavy', lines: [
        'Two of ours went down in the square and got back\nup wrong. They do not talk about it.',
        'Whatever he did to them, it was not a weapon. I\nwould know a weapon.'
      ] } },
    { id: 'hanmanHomeH', name: 'The Empty House', town: 'hanman', back: 'hanman',
      extra: function (ctx) {
        K.sign(ctx, 0, -2.4, 'The bed is made. The lamp is full.\nNobody has been here in weeks.', 0);
      } },

    /* ---- Ashvale ---- */
    { id: 'ashHomeA', name: 'Pit Foreman\'s', town: 'ashvale', back: 'ashvale',
      resident: { name: 'Gask', palette: 6, build: 'heavy', lines: [
        'You want a token for the mine gate, you talk to me\nout there, not in my kitchen.',
        'Four seams. Three of them still pay. The fourth\nwoke up.'
      ] } },
    { id: 'ashHomeB', name: 'The Ash House', town: 'ashvale', back: 'ashvale',
      resident: { name: 'Verrin', palette: 3, hairStyle: 'ponytail', lines: [
        'It gets in everything. Your food, your bed, your\nlungs. You stop noticing by the second winter.',
        'The mountain used to be quiet. Now it breathes.'
      ] } },
    { id: 'ashHomeC', name: 'The Widow Rell\'s', town: 'ashvale', back: 'ashvale',
      resident: { name: 'Rell', palette: 4, build: 'old', wander: 0, lines: [
        'Same name as you, near enough. Half the children\nborn the year he came through here got it.',
        'He stayed a night in this house. Sat where you are\nstanding. Would not take the bed.'
      ] } },
    { id: 'ashHomeD', name: 'Miner\'s Row', town: 'ashvale', back: 'ashvale', w: 9.2, d: 7.4,
      resident: { name: 'Corrin', palette: 5, lines: [
        'Six of us on this row and four still go down.',
        'There is something at the bottom of the deep seam\nwith a light inside it. I saw it once and I have\nnot gone past the third gate since.'
      ] } },
    { id: 'ashHomeE', name: 'The Smokehouse', town: 'ashvale', back: 'ashvale',
      resident: { name: 'Bel', palette: 1, build: 'teen', lines: [
        'Fish from the lake, smoked over ash pine. Best\nthing in this town and that is not a compliment to\nthe town.',
        'Take some with you. You look like someone about to\nwalk a long way.'
      ] } }
  ];

  for (var i = 0; i < HOMES.length; i++) dwelling(HOMES[i]);

  /* the ids, in town order, so the town files can wire their doors */
  LZ.Homes = {
    farrow: ['farrowHomeA', 'farrowHomeB', 'farrowHomeC', 'farrowHomeD', 'farrowHomeE'],
    stonebell: ['stoneHomeA', 'stoneHomeB', 'stoneHomeC', 'stoneHomeD', 'stoneHomeE'],
    hanman: ['hanmanHomeA', 'hanmanHomeB', 'hanmanHomeC', 'hanmanHomeD',
             'hanmanHomeE', 'hanmanHomeF', 'hanmanHomeG', 'hanmanHomeH'],
    ashvale: ['ashHomeA', 'ashHomeB', 'ashHomeC', 'ashHomeD', 'ashHomeE'],
    name: function (id) {
      for (var i = 0; i < HOMES.length; i++) if (HOMES[i].id === id) return HOMES[i].name;
      return 'Enter';
    }
  };
})(LZ);
