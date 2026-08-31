/* =============================================================
   game/models.js -- character rigs, creature rigs and the shared
   humanoid animation library.

   Every limb is a solid low-poly piece (60-260 tris per character),
   posed by its own matrix, exactly the way N64 character display lists
   worked. Colour variation comes from vertex colours modulating a small
   shared texture, so a whole village costs four textures.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var M = LZ.M, GL = LZ.GL, A = LZ.Anim;

  var Models = {};

  /* ---------------------------------------------------------------- */
  /* humanoid rig                                                      */
  /* ---------------------------------------------------------------- */
  /* opts: {
       scale, skin, cloth, clothDark, trim, boots, hair, hairStyle,
       hat: 'cap'|'hood'|'none'|'turban'|'crown', hatColor,
       build: 'child'|'teen'|'adult'|'heavy'|'old'|'lanky',
       cape, capeColor, beard, skinTex, clothTex, hairTex, bootTex
     } */
  /* ---------------------------------------------------------------- *
   * Humanoid rig.
   *
   * Everything here is a swept round tube or an ovoid, because that is
   * what N64 Zelda characters actually were: soft tapered limbs with
   * smooth vertex normals, a rounded head, a flared tunic, mitten hands,
   * chunky boots, and a face painted flat onto the front of the skull.
   * No part of a character is a box.
   * ---------------------------------------------------------------- */
  Models.humanoid = function (opts) {
    var o = opts || {};
    var s = o.scale || 1;
    var build = o.build || 'teen';

    /* Body plan in metres before `scale`. Head is roughly a quarter of
       total height, which is the era's readable-at-320x240 silhouette. */
    var B = {
      child: { hip: 0.60, torso: 0.29, waist: 0.105, chest: 0.128, shoulderX: 0.118,
               headX: 0.146, headY: 0.162, headZ: 0.140, arm: 0.175, fore: 0.155, armR: 0.046,
               thigh: 0.215, shin: 0.215, legR: 0.062, hipX: 0.062, skirt: 0.185, foot: 0.16 },
      teen:  { hip: 0.72, torso: 0.34, waist: 0.115, chest: 0.145, shoulderX: 0.137,
               headX: 0.156, headY: 0.174, headZ: 0.150, arm: 0.215, fore: 0.190, armR: 0.052,
               thigh: 0.262, shin: 0.258, legR: 0.072, hipX: 0.072, skirt: 0.215, foot: 0.185 },
      adult: { hip: 0.86, torso: 0.41, waist: 0.132, chest: 0.170, shoulderX: 0.162,
               headX: 0.158, headY: 0.178, headZ: 0.152, arm: 0.258, fore: 0.228, armR: 0.060,
               thigh: 0.315, shin: 0.310, legR: 0.082, hipX: 0.082, skirt: 0.245, foot: 0.205 },
      heavy: { hip: 0.86, torso: 0.42, waist: 0.176, chest: 0.212, shoulderX: 0.200,
               headX: 0.170, headY: 0.188, headZ: 0.164, arm: 0.268, fore: 0.236, armR: 0.076,
               thigh: 0.318, shin: 0.310, legR: 0.098, hipX: 0.098, skirt: 0.300, foot: 0.225 },
      lanky: { hip: 0.96, torso: 0.45, waist: 0.112, chest: 0.140, shoulderX: 0.150,
               headX: 0.144, headY: 0.168, headZ: 0.138, arm: 0.300, fore: 0.268, armR: 0.048,
               thigh: 0.370, shin: 0.360, legR: 0.066, hipX: 0.074, skirt: 0.215, foot: 0.200 },
      old:   { hip: 0.70, torso: 0.34, waist: 0.128, chest: 0.150, shoulderX: 0.140,
               headX: 0.158, headY: 0.174, headZ: 0.150, arm: 0.230, fore: 0.205, armR: 0.054,
               thigh: 0.258, shin: 0.252, legR: 0.074, hipX: 0.074, skirt: 0.235, foot: 0.190 }
    }[build];
    if (!B) throw new Error('unknown humanoid build: ' + build);

    var skinC  = o.skin === undefined ? 0xe8c49c : o.skin;
    var clothC = o.cloth === undefined ? 0x3f9a4c : o.cloth;
    var darkC  = o.clothDark === undefined ? 0x2a6b36 : o.clothDark;
    var trimC  = o.trim === undefined ? 0xd8c078 : o.trim;
    var bootC  = o.boots === undefined ? 0x6b4a2c : o.boots;
    var hairC  = o.hair === undefined ? 0x6b4a26 : o.hair;
    var hatC   = o.hatColor === undefined ? clothC : o.hatColor;
    var pantsC = o.pants === undefined ? 0xd8cfae : o.pants;
    var gloveC = o.glove === undefined ? skinC : o.glove;
    var clothTex = o.clothTex || 'clothGreen';
    var hairTex  = o.hairTex || 'hairBrown';
    var bootTex  = o.bootTex || 'leather';
    var skinTex  = o.skinTex || 'skin';

    var SIDES = o.lowPoly ? 6 : 8;

    /* one face texture per look, cached by key */
    var faceKey = o.faceKey || ('f' + skinC.toString(16) + '_' + (o.faceStyle || 'normal') +
      '_' + ((o.eyeColor === undefined ? 0x2f5a8a : o.eyeColor).toString(16)) + '_' + hairC.toString(16));
    var faceMat = (LZ.assets && LZ.assets.ensureFace) ? LZ.assets.ensureFace(faceKey, {
      skin: skinC,
      eye: o.eyeColor === undefined ? 0x2f5a8a : o.eyeColor,
      brow: hairC,
      mouth: o.mouthColor === undefined ? 0x8a4a44 : o.mouthColor,
      style: o.faceStyle || 'normal',
      blush: o.blush, marks: o.faceMarks, seed: (skinC & 255) + 3
    }) : skinTex;

    /* the plain-skin swatch in the face texture's top-left corner */
    var PL = 0.012;
    function plainUV() { return [PL * Math.random() * 0.2, PL * 0.5]; }

    var def = [];
    def.push({ name: 'root' });

    /* ---------------- hips + tunic skirt ---------------- */
    def.push({
      name: 'hips', parent: 'root', offset: [0, B.hip * s, 0], mat: clothTex,
      build: function (mb) {
        mb.setColorHex(clothC);
        mb.tube([
          { x: 0, y: -0.10 * s, z: 0, rx: B.waist * 1.02 * s, rz: B.waist * 0.80 * s },
          { x: 0, y: -0.02 * s, z: 0, rx: B.waist * 1.06 * s, rz: B.waist * 0.82 * s },
          { x: 0, y: 0.04 * s, z: 0, rx: B.waist * 0.98 * s, rz: B.waist * 0.78 * s }
        ], SIDES, { u: 1, v: 3 });
        if (o.skirt !== false) {
          /* the flared hem is the whole silhouette; it must be a cone */
          mb.setColorHex(darkC);
          mb.tube([
            { x: 0, y: -0.30 * s, z: 0, rx: B.skirt * s, rz: B.skirt * 0.80 * s },
            { x: 0, y: -0.20 * s, z: 0, rx: B.skirt * 0.86 * s, rz: B.skirt * 0.70 * s },
            { x: 0, y: -0.08 * s, z: 0, rx: B.waist * 1.04 * s, rz: B.waist * 0.84 * s }
          ], SIDES, { u: 1, v: 2, capEnd: false });
        }
        mb.setColorHex(trimC);
        mb.tube([
          { x: 0, y: 0.005 * s, z: 0, rx: B.waist * 1.10 * s, rz: B.waist * 0.88 * s },
          { x: 0, y: 0.05 * s, z: 0, rx: B.waist * 1.10 * s, rz: B.waist * 0.88 * s }
        ], SIDES, { u: 1, v: 2, capStart: false, capEnd: false });
      }
    });

    /* ---------------- torso ---------------- */
    def.push({
      name: 'torso', parent: 'hips', offset: [0, 0.045 * s, 0], mat: clothTex,
      rest: build === 'old' ? [15, 0, 0] : [0, 0, 0],
      build: function (mb) {
        mb.setColorHex(clothC);
        mb.tube([
          { x: 0, y: 0, z: 0, rx: B.waist * s, rz: B.waist * 0.80 * s },
          { x: 0, y: B.torso * 0.35 * s, z: 0, rx: B.chest * 0.94 * s, rz: B.chest * 0.72 * s },
          { x: 0, y: B.torso * 0.72 * s, z: 0, rx: B.chest * s, rz: B.chest * 0.76 * s },
          { x: 0, y: B.torso * s, z: 0, rx: B.chest * 0.82 * s, rz: B.chest * 0.64 * s }
        ], SIDES, { u: 1, v: 2 });
        /* shoulder caps so the arms grow out of something */
        mb.setColorHex(darkC);
        for (var sd = -1; sd <= 1; sd += 2) {
          mb.ovoid(sd * B.shoulderX * s, B.torso * 0.88 * s, 0,
            B.armR * 1.5 * s, B.armR * 1.4 * s, B.armR * 1.5 * s, 7, 5);
        }
        /* belt across the waist */
        mb.setColorHex(o.beltColor === undefined ? 0x6b4a2c : o.beltColor);
        mb.tube([
          { x: 0, y: B.torso * 0.06 * s, z: 0, rx: B.waist * 1.05 * s, rz: B.waist * 0.85 * s },
          { x: 0, y: B.torso * 0.17 * s, z: 0, rx: B.waist * 1.07 * s, rz: B.waist * 0.87 * s }
        ], SIDES, { u: 1, v: 2, capStart: false, capEnd: false });
        mb.setColorHex(trimC);
        mb.tube([
          { x: 0, y: B.torso * 0.055 * s, z: B.waist * 0.80 * s, rx: 0.036 * s, rz: 0.020 * s },
          { x: 0, y: B.torso * 0.185 * s, z: B.waist * 0.82 * s, rx: 0.036 * s, rz: 0.020 * s }
        ], 6, { u: 1, v: 2 });
        /* collar */
        mb.setColorHex(darkC);
        mb.tube([
          { x: 0, y: B.torso * 0.96 * s, z: 0, rx: B.chest * 0.86 * s, rz: B.chest * 0.68 * s },
          { x: 0, y: B.torso * 1.05 * s, z: 0, rx: B.chest * 0.66 * s, rz: B.chest * 0.54 * s }
        ], SIDES, { u: 1, v: 2, capStart: false });
        if (o.pauldron) {
          /* a villain needs shoulders: two swept plates that widen the
             silhouette without touching the arm bones, so every clip still
             animates unchanged */
          mb.setColorHex(o.pauldron);
          for (var pd = -1; pd <= 1; pd += 2) {
            mb.tube([
              { x: pd * B.shoulderX * 0.55 * s, y: B.torso * 1.02 * s, z: 0,
                rx: B.armR * 1.0 * s, rz: B.chest * 0.62 * s },
              { x: pd * B.shoulderX * 1.05 * s, y: B.torso * 0.98 * s, z: 0,
                rx: B.armR * 1.5 * s, rz: B.chest * 0.84 * s },
              { x: pd * B.shoulderX * 1.45 * s, y: B.torso * 0.80 * s, z: 0,
                rx: B.armR * 1.4 * s, rz: B.chest * 0.72 * s },
              { x: pd * B.shoulderX * 1.62 * s, y: B.torso * 0.60 * s, z: 0,
                rx: B.armR * 0.7 * s, rz: B.chest * 0.42 * s }
            ], 8, { axis: 'x', u: 1, v: 2 });
            /* a spike off the crest of each plate */
            mb.setColorHex(trimC);
            mb.tube([
              { x: pd * B.shoulderX * 1.15 * s, y: B.torso * 1.02 * s, z: 0, r: 0.045 * s },
              { x: pd * B.shoulderX * 1.35 * s, y: B.torso * 1.30 * s, z: 0, r: 0.026 * s },
              { x: pd * B.shoulderX * 1.48 * s, y: B.torso * 1.48 * s, z: 0, r: 0.004 * s }
            ], 5);
          }
        }
        if (o.sash) {
          mb.setColorHex(o.sashColor || trimC);
          mb.tube([
            { x: -B.chest * 0.5 * s, y: 0.02 * s, z: 0, rx: 0.030 * s, rz: B.chest * 0.80 * s },
            { x: B.chest * 0.42 * s, y: B.torso * 0.86 * s, z: 0, rx: 0.030 * s, rz: B.chest * 0.74 * s }
          ], 6, { u: 1, v: 2 });
        }
      }
    });

    /* ---------------- head: ovoid skull + painted face plate ------- */
    var HX = B.headX * s, HY = B.headY * s, HZ = B.headZ * s;
    var HCY = HY * 0.96;
    def.push({
      name: 'head', parent: 'torso', offset: [0, (B.torso + 0.03) * s, 0], mat: faceMat,
      build: function (mb) {
        mb.setColorHex(0xffffff);
        /* neck */
        mb.tube([
          { x: 0, y: -0.05 * s, z: 0, r: B.waist * 0.42 * s },
          { x: 0, y: HCY - HY * 0.72, z: 0, r: B.waist * 0.40 * s }
        ], 6, { u: PL, v: PL, capStart: false, capEnd: false });
        /* skull: every vertex samples the plain corner of the face tile */
        mb.ovoid(0, HCY, 0, HX, HY, HZ, 10, 8, {
          uv: function () { return [PL * 0.5, PL * 0.5]; }
        });
        /* The face is a shallow polar disc pressed onto the front of the
           skull. A disc (not a square patch) means its outline follows
           the head and there is no visible plate edge. */
        var RINGS = 4, SEG = 12;
        var fr = Math.min(HX, HY) * 0.92;
        var centreIdx = mb.vert(0, HCY, HZ * 1.02, 0, 0, 1, 0.5, 0.5);
        var prev = null;
        for (var ri = 1; ri <= RINGS; ri++) {
          var rad = fr * (ri / RINGS);
          var row = [];
          for (var si = 0; si <= SEG; si++) {
            var ang = si / SEG * Math.PI * 2;
            var lx = Math.cos(ang) * rad;
            var ly = Math.sin(ang) * rad;
            var kk = 1 - (lx / HX) * (lx / HX) - (ly / HY) * (ly / HY);
            var lz = Math.sqrt(Math.max(0.05, kk)) * HZ * 1.018;
            var nx = lx / (HX * HX), ny = ly / (HY * HY), nz = lz / (HZ * HZ);
            var nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
            /* map the face tile across the disc, features upright */
            var u = 0.5 + lx / (fr * 2.02);
            var v = 0.5 - ly / (fr * 2.02);
            row.push(mb.vert(lx, HCY + ly, lz, nx / nl, ny / nl, nz / nl, u, v));
          }
          if (ri === 1) {
            for (var q = 0; q < SEG; q++) mb.tri(centreIdx, row[q], row[q + 1]);
          } else {
            for (var q2 = 0; q2 < SEG; q2++) {
              mb.quadIdx(prev[q2], row[q2], row[q2 + 1], prev[q2 + 1]);
            }
          }
          prev = row;
        }
        if (o.muzzle) {
          /* a boar snout with tusks: turns the same rig into a brute */
          mb.setColorHex(o.muzzleColor === undefined ? skinC : o.muzzleColor);
          mb.tube([
            { x: 0, y: HCY - HY * 0.20, z: HZ * 0.72, rx: HX * 0.44, ry: HY * 0.36 },
            { x: 0, y: HCY - HY * 0.28, z: HZ * 1.06, rx: HX * 0.36, ry: HY * 0.28 },
            { x: 0, y: HCY - HY * 0.30, z: HZ * 1.22, rx: HX * 0.34, ry: HY * 0.26 }
          ], 8, { axis: 'z', u: PL, v: PL, capStart: false });
          mb.setColorHex(0x2a2018);
          mb.ovoid(-HX * 0.11, HCY - HY * 0.26, HZ * 1.24, HX * 0.07, HY * 0.06, HZ * 0.04, 5, 4);
          mb.ovoid(HX * 0.11, HCY - HY * 0.26, HZ * 1.24, HX * 0.07, HY * 0.06, HZ * 0.04, 5, 4);
          mb.setColorHex(0xe8e0c8);
          for (var tk = -1; tk <= 1; tk += 2) {
            mb.tube([
              { x: tk * HX * 0.30, y: HCY - HY * 0.44, z: HZ * 0.96, r: 0.024 * s },
              { x: tk * HX * 0.36, y: HCY - HY * 0.08, z: HZ * 1.02, r: 0.006 * s }
            ], 4, { u: PL, v: PL, capStart: false });
          }
        }
        /* pointed Hylian ears: small, swept back, barely wider than the head */
        for (var sd2 = -1; sd2 <= 1; sd2 += 2) {
          if (o.muzzle) {
            mb.setColorHex(o.muzzleColor === undefined ? skinC : o.muzzleColor);
            mb.tube([
              { x: sd2 * HX * 0.82, y: HCY + HY * 0.10, z: -HZ * 0.06, rx: 0.030 * s, rz: 0.055 * s },
              { x: sd2 * HX * 1.30, y: HCY + HY * 0.34, z: -HZ * 0.16, rx: 0.022 * s, rz: 0.045 * s },
              { x: sd2 * HX * 1.60, y: HCY + HY * 0.30, z: -HZ * 0.22, rx: 0.006 * s, rz: 0.016 * s }
            ], 5, { u: PL, v: PL, capStart: false });
          } else {
            mb.tube([
              { x: sd2 * HX * 0.80, y: HCY - HY * 0.10, z: -HZ * 0.02, r: 0.026 * s },
              { x: sd2 * HX * 1.00, y: HCY + HY * 0.16, z: -HZ * 0.26, r: 0.019 * s },
              { x: sd2 * HX * 1.14, y: HCY + HY * 0.42, z: -HZ * 0.46, r: 0.005 * s }
            ], 5, { u: PL, v: PL, capStart: false });
          }
        }
      }
    });

    /* ---------------- hair and headgear ---------------- */
    var style = o.hairStyle || 'short';
    def.push({
      name: 'hair', parent: 'head', offset: [0, 0, 0],
      mat: (o.hat === 'cap' || o.hat === 'hood') ? clothTex : hairTex,
      build: function (mb) {
        if (o.beard) {
          mb.setColorHex(o.beardColor === undefined ? hairC : o.beardColor);
          mb.tube([
            { x: 0, y: HCY - HY * 1.30, z: HZ * 0.16, rx: HX * 0.38, rz: HZ * 0.42 },
            { x: 0, y: HCY - HY * 0.86, z: HZ * 0.30, rx: HX * 0.72, rz: HZ * 0.66 },
            { x: 0, y: HCY - HY * 0.42, z: HZ * 0.42, rx: HX * 0.92, rz: HZ * 0.80 }
          ], SIDES, { u: 1, v: 3, capEnd: false });
        }

        if (o.hat === 'cap') {
          mb.setColorHex(hatC);
          /* the cap hugs the skull, then falls away behind in a long tail */
          mb.ovoid(0, HCY + HY * 0.18, -HZ * 0.04, HX * 1.08, HY * 0.94, HZ * 1.08, 10, 6, {
            uv: function (x, y) { return [0.5 + x, 0.5 + y]; }
          });
          var rings = [];
          var px = 0, py = HCY + HY * 0.62, pz = -HZ * 0.55, rr = HX * 0.86;
          for (var i = 0; i < 7; i++) {
            rings.push({ x: px, y: py, z: pz, r: rr });
            py += HY * (0.16 - i * 0.035);
            pz -= HZ * (0.52 + i * 0.10);
            rr *= 0.80;
          }
          mb.tube(rings, SIDES, { u: 1, v: 2 });
        } else if (o.hat === 'hood') {
          mb.setColorHex(hatC);
          mb.ovoid(0, HCY + HY * 0.10, -HZ * 0.16, HX * 1.24, HY * 1.16, HZ * 1.28, 10, 7, {
            uv: function (x, y) { return [0.5 + x, 0.5 + y]; }
          });
        } else if (o.hat === 'turban') {
          mb.setColorHex(hatC);
          mb.tube([
            { x: 0, y: HCY + HY * 0.30, z: 0, rx: HX * 1.10, rz: HZ * 1.14 },
            { x: 0, y: HCY + HY * 0.70, z: 0, rx: HX * 1.22, rz: HZ * 1.26 },
            { x: 0, y: HCY + HY * 1.05, z: 0, rx: HX * 0.80, rz: HZ * 0.84 }
          ], SIDES, { u: 1, v: 3 });
        } else if (o.hat === 'crown') {
          mb.setColorHex(0xd8b850);
          mb.tube([
            { x: 0, y: HCY + HY * 0.62, z: 0, rx: HX * 1.06, rz: HZ * 1.10 },
            { x: 0, y: HCY + HY * 0.94, z: 0, rx: HX * 1.02, rz: HZ * 1.06 }
          ], 8, { u: 1, v: 2, capStart: false, capEnd: false });
        }

        if (style !== 'bald' && o.hat !== 'hood' && o.hat !== 'cap') {
          mb.setColorHex(hairC);
          /* a slightly larger ovoid pushed up and back reads as hair */
          mb.ovoid(0, HCY + HY * 0.20, -HZ * 0.10, HX * 1.06, HY * 0.94, HZ * 1.08, 10, 6, {
            uv: function (x, y) { return [0.5 + x * 3, 0.5 + y * 3]; }
          });
          /* fringe across the brow */
          mb.tube([
            { x: 0, y: HCY + HY * 0.60, z: HZ * 0.55, rx: HX * 0.94, rz: HZ * 0.46 },
            { x: 0, y: HCY + HY * 0.30, z: HZ * 0.66, rx: HX * 0.86, rz: HZ * 0.40 }
          ], 8, { u: 1, v: 2 });
          /* sideburns */
          for (var sd3 = -1; sd3 <= 1; sd3 += 2) {
            mb.tube([
              { x: sd3 * HX * 0.88, y: HCY + HY * 0.35, z: -HZ * 0.05, r: 0.040 * s },
              { x: sd3 * HX * 0.94, y: HCY - HY * 0.55, z: -HZ * 0.05, r: 0.030 * s }
            ], 5, { u: 1, v: 2 });
          }
          if (style === 'long') {
            mb.tube([
              { x: 0, y: HCY + HY * 0.40, z: -HZ * 0.95, rx: HX * 0.90, rz: 0.045 * s },
              { x: 0, y: HCY - HY * 1.40, z: -HZ * 1.05, rx: HX * 0.78, rz: 0.040 * s },
              { x: 0, y: HCY - HY * 2.40, z: -HZ * 0.95, rx: HX * 0.52, rz: 0.032 * s }
            ], 6, { u: 1, v: 2 });
          }
          if (style === 'ponytail') {
            mb.tube([
              { x: 0, y: HCY + HY * 0.30, z: -HZ * 1.00, r: 0.055 * s },
              { x: 0, y: HCY - HY * 0.60, z: -HZ * 1.45, r: 0.042 * s },
              { x: 0, y: HCY - HY * 1.50, z: -HZ * 1.30, r: 0.018 * s }
            ], 6, { u: 1, v: 2 });
          }
        }
      }
    });

    /* ---------------- arms ---------------- */
    function armBones(side, sname, hname) {
      def.push({
        name: sname, parent: 'torso',
        offset: [side * B.shoulderX * s, B.torso * 0.88 * s, 0],
        rest: [0, 0, side * -9], mat: clothTex,
        build: function (mb) {
          mb.setColorHex(clothC);
          /* sleeve */
          mb.limb(0, -B.arm * 0.62 * s, 0, B.arm * 0.62 * s, B.armR * 0.92 * s, B.armR * 1.12 * s,
            SIDES, { steps: 2, u: 1, v: 3 });
          mb.setColorHex(o.sleeveTrim === undefined ? darkC : o.sleeveTrim);
          mb.tube([
            { x: 0, y: -B.arm * 0.66 * s, z: 0, r: B.armR * 1.16 * s },
            { x: 0, y: -B.arm * 0.58 * s, z: 0, r: B.armR * 1.16 * s }
          ], SIDES, { u: 1, v: 2, capStart: false, capEnd: false });
          /* undershirt sleeve below the tunic sleeve */
          mb.setColorHex(o.under === undefined ? gloveC : o.under);
          mb.limb(0, -B.arm * s, 0, B.arm * 0.42 * s, B.armR * 0.88 * s, B.armR * 1.00 * s,
            SIDES, { steps: 2, u: 1, v: 3, capEnd: false });
        }
      });
      def.push({
        name: hname, parent: sname, offset: [0, -B.arm * s, 0], mat: o.gloveTex || skinTex,
        build: function (mb) {
          mb.setColorHex(o.under === undefined ? gloveC : o.under);
          mb.limb(0, -B.fore * 0.62 * s, 0, B.fore * 0.62 * s, B.armR * 0.86 * s, B.armR * 0.94 * s,
            SIDES, { steps: 2, u: 1, v: 3, capEnd: false });
          mb.setColorHex(gloveC);
          mb.limb(0, -B.fore * s, 0, B.fore * 0.44 * s, B.armR * 0.82 * s, B.armR * 0.92 * s,
            SIDES, { steps: 1, u: 1, v: 3, capEnd: false });
          /* mitten hand */
          mb.ovoid(0, -B.fore * 1.06 * s, 0.005 * s,
            B.armR * 1.16 * s, B.armR * 1.30 * s, B.armR * 1.10 * s, 8, 6);
        }
      });
    }
    armBones(-1, 'shoulderL', 'handL');
    armBones(1, 'shoulderR', 'handR');

    /* ---------------- legs ---------------- */
    function legBones(side, tname, sname) {
      def.push({
        name: tname, parent: 'hips', offset: [side * B.hipX * s, -0.085 * s, 0], mat: clothTex,
        build: function (mb) {
          mb.setColorHex(pantsC);
          mb.limb(0, -B.thigh * s, 0, B.thigh * s, B.legR * 0.80 * s, B.legR * s,
            SIDES, { steps: 3, u: 1, v: 3, bulge: 0.06 });
        }
      });
      def.push({
        name: sname, parent: tname, offset: [0, -B.thigh * s, 0], mat: bootTex,
        build: function (mb) {
          mb.setColorHex(pantsC);
          mb.limb(0, -B.shin * 0.52 * s, 0, B.shin * 0.52 * s, B.legR * 0.74 * s, B.legR * 0.92 * s,
            SIDES, { steps: 2, u: 1, v: 3, capStart: false });
          /* boot: a cuff, an ankle and a foot */
          mb.setColorHex(bootC);
          mb.tube([
            { x: 0, y: -B.shin * s, z: 0, rx: B.legR * 0.94 * s, rz: B.legR * 0.98 * s },
            { x: 0, y: -B.shin * 0.72 * s, z: 0, rx: B.legR * 0.90 * s, rz: B.legR * 0.94 * s },
            { x: 0, y: -B.shin * 0.46 * s, z: 0, rx: B.legR * 1.10 * s, rz: B.legR * 1.14 * s },
            { x: 0, y: -B.shin * 0.40 * s, z: 0, rx: B.legR * 1.02 * s, rz: B.legR * 1.06 * s }
          ], SIDES, { u: 1, v: 3 });
          /* the foot, swept forward */
          mb.tube([
            { x: 0, y: -B.shin * s, z: -B.foot * 0.22 * s, rx: B.legR * 0.92 * s, rz: B.legR * 0.60 * s },
            { x: 0, y: -B.shin * 1.02 * s, z: B.foot * 0.34 * s, rx: B.legR * 1.02 * s, rz: B.legR * 0.70 * s },
            { x: 0, y: -B.shin * 1.04 * s, z: B.foot * 0.72 * s, rx: B.legR * 0.80 * s, rz: B.legR * 0.50 * s }
          ], SIDES, { u: 1, v: 3 });
        }
      });
    }
    legBones(-1, 'thighL', 'shinL');
    legBones(1, 'thighR', 'shinR');

    /* ---------------- attachment points ---------------- */
    def.push({ name: 'itemR', parent: 'handR', offset: [0, -B.fore * 1.06 * s, 0.02 * s], hide: true });
    def.push({ name: 'itemL', parent: 'handL', offset: [0, -B.fore * 1.06 * s, 0.02 * s], hide: true });
    def.push({ name: 'backAttach', parent: 'torso', offset: [0, B.torso * 0.70 * s, -B.chest * 0.86 * s], hide: true });

    if (o.cape) {
      def.push({
        name: 'cape', parent: 'torso', offset: [0, B.torso * 0.92 * s, -B.chest * 0.66 * s], mat: clothTex,
        build: function (mb) {
          mb.setColorHex(o.capeColor === undefined ? darkC : o.capeColor);
          mb.tube([
            { x: 0, y: 0, z: 0, rx: B.chest * 0.86 * s, rz: 0.030 * s },
            { x: 0, y: -(B.torso + 0.18) * s, z: -0.03 * s, rx: B.chest * 1.10 * s, rz: 0.040 * s },
            { x: 0, y: -(B.torso + 0.40) * s, z: -0.07 * s, rx: B.chest * 1.26 * s, rz: 0.050 * s }
          ], 8, { u: 1, v: 2 });
        }
      });
    }

    return {
      def: def,
      height: (B.hip + B.torso + 0.03 + HCY + HY) * s,
      radius: (B.chest * 1.15) * s,
      proportions: B, scale: s,
      head: { cy: HCY, hx: HX, hy: HY, hz: HZ }
    };
  };

  /* ---------------------------------------------------------------- */
  /* humanoid animation library                                        */
  /* ---------------------------------------------------------------- */
  var clip = A.clip, mirror = A.mirror;

  function buildHumanoidClips() {
    var C = {};

    C.idle = clip('idle', 3.0, true, {
      torso:     { r: [[0, 0, 0, 0], [1.5, 2.5, 0, 0], [3.0, 0, 0, 0]], t: [[0, 0, 0, 0], [1.5, 0, -0.012, 0], [3.0, 0, 0, 0]] },
      head:      { r: [[0, 0, 0, 0], [0.9, 0, 7, 0], [1.8, 0, -5, 0], [3.0, 0, 0, 0]] },
      shoulderL: { r: [[0, 4, 0, 0], [1.5, -3, 0, 0], [3.0, 4, 0, 0]] },
      shoulderR: { r: [[0, -3, 0, 0], [1.5, 4, 0, 0], [3.0, -3, 0, 0]] },
      handL:     { r: [[0, 6, 0, 0], [1.5, 10, 0, 0], [3.0, 6, 0, 0]] },
      handR:     { r: [[0, 8, 0, 0], [1.5, 4, 0, 0], [3.0, 8, 0, 0]] }
    });

    C.idleAlert = clip('idleAlert', 1.6, true, {
      hips:      { t: [[0, 0, -0.03, 0], [0.8, 0, -0.045, 0], [1.6, 0, -0.03, 0]] },
      torso:     { r: [[0, 6, 0, 0], [0.8, 9, 0, 0], [1.6, 6, 0, 0]] },
      shoulderL: { r: [[0, -22, 0, -10], [0.8, -26, 0, -12], [1.6, -22, 0, -10]] },
      shoulderR: { r: [[0, -18, 0, 10], [0.8, -22, 0, 12], [1.6, -18, 0, 10]] },
      handL:     { r: [[0, -40, 0, 0], [1.6, -40, 0, 0]] },
      handR:     { r: [[0, -30, 0, 0], [1.6, -30, 0, 0]] },
      thighL:    { r: [[0, -6, 0, -4], [1.6, -6, 0, -4]] },
      thighR:    { r: [[0, 6, 0, 4], [1.6, 6, 0, 4]] },
      shinL:     { r: [[0, 12, 0, 0], [1.6, 12, 0, 0]] },
      shinR:     { r: [[0, 10, 0, 0], [1.6, 10, 0, 0]] }
    });

    var walkThigh = [[0, -24, 0, 0], [0.25, 4, 0, 0], [0.5, 22, 0, 0], [0.75, 2, 0, 0], [1.0, -24, 0, 0]];
    var walkShin  = [[0, 12, 0, 0], [0.25, 6, 0, 0], [0.5, 6, 0, 0], [0.75, 44, 0, 0], [1.0, 12, 0, 0]];
    var walkArm   = [[0, 22, 0, 0], [0.5, -22, 0, 0], [1.0, 22, 0, 0]];
    function scaleKeys(keys, dur) {
      var out = []; for (var i = 0; i < keys.length; i++) out.push([keys[i][0] * dur, keys[i][1], keys[i][2], keys[i][3]]);
      return out;
    }
    function phase(keys, ph, dur) {
      var out = [];
      for (var i = 0; i < keys.length; i++) {
        var t = keys[i][0] + ph; if (t > 1.0001) t -= 1;
        out.push([t * dur, keys[i][1], keys[i][2], keys[i][3]]);
      }
      out.sort(function (a, b) { return a[0] - b[0]; });
      if (out[0][0] > 0.0001) out.unshift([0, out[out.length - 1][1], out[out.length - 1][2], out[out.length - 1][3]]);
      if (out[out.length - 1][0] < dur - 0.0001) out.push([dur, out[0][1], out[0][2], out[0][3]]);
      return out;
    }

    var wd = 0.80;
    C.walk = clip('walk', wd, true, {
      hips:      { t: [[0, 0, 0, 0], [wd * 0.25, 0, 0.022, 0], [wd * 0.5, 0, 0, 0], [wd * 0.75, 0, 0.022, 0], [wd, 0, 0, 0]],
                   r: [[0, 0, 5, 0], [wd * 0.5, 0, -5, 0], [wd, 0, 5, 0]] },
      torso:     { r: [[0, 3, -4, 0], [wd * 0.5, 3, 4, 0], [wd, 3, -4, 0]] },
      head:      { r: [[0, 0, 3, 0], [wd * 0.5, 0, -3, 0], [wd, 0, 3, 0]] },
      thighL:    { r: scaleKeys(walkThigh, wd) },
      thighR:    { r: phase(walkThigh, 0.5, wd) },
      shinL:     { r: scaleKeys(walkShin, wd) },
      shinR:     { r: phase(walkShin, 0.5, wd) },
      shoulderL: { r: scaleKeys(walkArm, wd) },
      shoulderR: { r: phase(walkArm, 0.5, wd) },
      handL:     { r: [[0, 10, 0, 0], [wd, 10, 0, 0]] },
      handR:     { r: [[0, 10, 0, 0], [wd, 10, 0, 0]] }
    }, { events: [{ t: wd * 0.05, name: 'step' }, { t: wd * 0.55, name: 'step' }] });

    var runThigh = [[0, -46, 0, 0], [0.25, 6, 0, 0], [0.5, 40, 0, 0], [0.75, 0, 0, 0], [1.0, -46, 0, 0]];
    var runShin  = [[0, 26, 0, 0], [0.25, 4, 0, 0], [0.5, 10, 0, 0], [0.75, 82, 0, 0], [1.0, 26, 0, 0]];
    var runArm   = [[0, 52, 0, 0], [0.5, -46, 0, 0], [1.0, 52, 0, 0]];
    var rd = 0.50;
    C.run = clip('run', rd, true, {
      hips:      { t: [[0, 0, -0.01, 0], [rd * 0.25, 0, 0.05, 0], [rd * 0.5, 0, -0.01, 0], [rd * 0.75, 0, 0.05, 0], [rd, 0, -0.01, 0]],
                   r: [[0, 0, 9, 0], [rd * 0.5, 0, -9, 0], [rd, 0, 9, 0]] },
      torso:     { r: [[0, -13, -7, 0], [rd * 0.5, -13, 7, 0], [rd, -13, -7, 0]] },
      head:      { r: [[0, 9, 5, 0], [rd * 0.5, 9, -5, 0], [rd, 9, 5, 0]] },
      thighL:    { r: scaleKeys(runThigh, rd) },
      thighR:    { r: phase(runThigh, 0.5, rd) },
      shinL:     { r: scaleKeys(runShin, rd) },
      shinR:     { r: phase(runShin, 0.5, rd) },
      shoulderL: { r: scaleKeys(runArm, rd) },
      shoulderR: { r: phase(runArm, 0.5, rd) },
      handL:     { r: [[0, 42, 0, 0], [rd, 42, 0, 0]] },
      handR:     { r: [[0, 42, 0, 0], [rd, 42, 0, 0]] }
    }, { events: [{ t: rd * 0.05, name: 'step' }, { t: rd * 0.55, name: 'step' }] });

    /* sidestep while locked on */
    C.strafe = clip('strafe', 0.62, true, {
      hips:      { t: [[0, 0, 0, 0], [0.31, 0, 0.03, 0], [0.62, 0, 0, 0]], r: [[0, 0, 0, 0], [0.62, 0, 0, 0]] },
      torso:     { r: [[0, 6, 0, 0], [0.62, 6, 0, 0]] },
      thighL:    { r: [[0, -16, 0, -12], [0.31, 10, 0, -4], [0.62, -16, 0, -12]] },
      thighR:    { r: [[0, 12, 0, 12], [0.31, -14, 0, 4], [0.62, 12, 0, 12]] },
      shinL:     { r: [[0, 16, 0, 0], [0.31, 30, 0, 0], [0.62, 16, 0, 0]] },
      shinR:     { r: [[0, 26, 0, 0], [0.31, 12, 0, 0], [0.62, 26, 0, 0]] },
      shoulderL: { r: [[0, -20, 0, -12], [0.62, -20, 0, -12]] },
      shoulderR: { r: [[0, -16, 0, 12], [0.62, -16, 0, 12]] },
      handL:     { r: [[0, -36, 0, 0], [0.62, -36, 0, 0]] },
      handR:     { r: [[0, -26, 0, 0], [0.62, -26, 0, 0]] }
    }, { events: [{ t: 0.03, name: 'step' }, { t: 0.34, name: 'step' }] });

    C.backstep = clip('backstep', 0.62, true, {
      torso:     { r: [[0, -6, 0, 0], [0.62, -6, 0, 0]] },
      thighL:    { r: [[0, 18, 0, 0], [0.31, -12, 0, 0], [0.62, 18, 0, 0]] },
      thighR:    { r: [[0, -12, 0, 0], [0.31, 18, 0, 0], [0.62, -12, 0, 0]] },
      shinL:     { r: [[0, 8, 0, 0], [0.31, 40, 0, 0], [0.62, 8, 0, 0]] },
      shinR:     { r: [[0, 40, 0, 0], [0.31, 8, 0, 0], [0.62, 40, 0, 0]] },
      shoulderL: { r: [[0, -18, 0, -10], [0.62, -18, 0, -10]] },
      shoulderR: { r: [[0, -14, 0, 10], [0.62, -14, 0, 10]] }
    }, { events: [{ t: 0.03, name: 'step' }, { t: 0.34, name: 'step' }] });

    /* ---- sword attacks ---- */
    C.attack1 = clip('attack1', 0.46, false, {
      hips:      { r: [[0, 0, 28, 0], [0.12, 0, 40, 0], [0.26, 0, -30, 0], [0.46, 0, 0, 0]] },
      torso:     { r: [[0, 0, 20, 0], [0.12, -6, 30, 0], [0.26, 8, -22, 0], [0.46, 0, 0, 0]] },
      head:      { r: [[0, 0, -14, 0], [0.26, 0, 16, 0], [0.46, 0, 0, 0]] },
      shoulderR: { r: [[0, -60, -20, 40], [0.12, -140, -30, 30], [0.26, -20, 20, -50], [0.34, 10, 10, -30], [0.46, 0, 0, 0]] },
      handR:     { r: [[0, -30, 0, 0], [0.12, -20, 0, 0], [0.26, -10, 0, 0], [0.46, 10, 0, 0]] },
      shoulderL: { r: [[0, -20, 0, -20], [0.26, -30, 0, -34], [0.46, 0, 0, -7]] },
      thighL:    { r: [[0, -10, 0, 0], [0.26, 8, 0, 0], [0.46, 0, 0, 0]] },
      thighR:    { r: [[0, 10, 0, 0], [0.26, -8, 0, 0], [0.46, 0, 0, 0]] }
    }, { events: [{ t: 0.13, name: 'swing' }, { t: 0.15, name: 'hitOn' }, { t: 0.30, name: 'hitOff' }] });

    C.attack2 = clip('attack2', 0.46, false, {
      hips:      { r: [[0, 0, -26, 0], [0.12, 0, -38, 0], [0.26, 0, 32, 0], [0.46, 0, 0, 0]] },
      torso:     { r: [[0, 0, -18, 0], [0.12, -6, -28, 0], [0.26, 8, 24, 0], [0.46, 0, 0, 0]] },
      head:      { r: [[0, 0, 14, 0], [0.26, 0, -16, 0], [0.46, 0, 0, 0]] },
      shoulderR: { r: [[0, -40, 40, -60], [0.12, -60, 60, -80], [0.26, -30, -20, 50], [0.34, 0, -10, 26], [0.46, 0, 0, 0]] },
      handR:     { r: [[0, -20, 0, 0], [0.26, -14, 0, 0], [0.46, 10, 0, 0]] },
      shoulderL: { r: [[0, -18, 0, -18], [0.26, -26, 0, -30], [0.46, 0, 0, -7]] },
      thighL:    { r: [[0, 8, 0, 0], [0.26, -8, 0, 0], [0.46, 0, 0, 0]] },
      thighR:    { r: [[0, -8, 0, 0], [0.26, 8, 0, 0], [0.46, 0, 0, 0]] }
    }, { events: [{ t: 0.13, name: 'swing' }, { t: 0.15, name: 'hitOn' }, { t: 0.30, name: 'hitOff' }] });

    C.attack3 = clip('attack3', 0.58, false, {
      hips:      { t: [[0, 0, 0, 0], [0.14, 0, 0.05, 0], [0.30, 0, -0.06, 0], [0.58, 0, 0, 0]] },
      torso:     { r: [[0, -16, 0, 0], [0.14, -26, 0, 0], [0.30, 26, 0, 0], [0.58, 0, 0, 0]] },
      head:      { r: [[0, -10, 0, 0], [0.30, 14, 0, 0], [0.58, 0, 0, 0]] },
      shoulderR: { r: [[0, -120, 0, 0], [0.14, -175, 0, 0], [0.30, -6, 0, 0], [0.40, 14, 0, 0], [0.58, 0, 0, 0]] },
      handR:     { r: [[0, -20, 0, 0], [0.30, 0, 0, 0], [0.58, 10, 0, 0]] },
      shoulderL: { r: [[0, -110, 0, -14], [0.14, -160, 0, -14], [0.30, -10, 0, -20], [0.58, 0, 0, -7]] },
      thighL:    { r: [[0, -6, 0, 0], [0.30, 14, 0, 0], [0.58, 0, 0, 0]] },
      thighR:    { r: [[0, -6, 0, 0], [0.30, 14, 0, 0], [0.58, 0, 0, 0]] }
    }, { events: [{ t: 0.16, name: 'swing' }, { t: 0.20, name: 'hitOn' }, { t: 0.36, name: 'hitOff' }] });

    C.stab = clip('stab', 0.42, false, {
      hips:      { t: [[0, 0, 0, 0], [0.10, 0, 0, -0.05], [0.22, 0, 0, 0.10], [0.42, 0, 0, 0]] },
      torso:     { r: [[0, 0, 18, 0], [0.10, 0, 26, 0], [0.22, 4, -12, 0], [0.42, 0, 0, 0]] },
      shoulderR: { r: [[0, -50, 30, 0], [0.10, -30, 44, 0], [0.22, -84, -10, 0], [0.42, 0, 0, 0]] },
      handR:     { r: [[0, -40, 0, 0], [0.22, -6, 0, 0], [0.42, 10, 0, 0]] },
      shoulderL: { r: [[0, -20, 0, -20], [0.42, 0, 0, -7]] }
    }, { events: [{ t: 0.11, name: 'swing' }, { t: 0.14, name: 'hitOn' }, { t: 0.26, name: 'hitOff' }] });

    C.spinCharge = clip('spinCharge', 0.6, true, {
      hips:      { r: [[0, 0, 34, 0], [0.3, 0, 44, 0], [0.6, 0, 34, 0]], t: [[0, 0, -0.03, 0], [0.6, 0, -0.03, 0]] },
      torso:     { r: [[0, 6, 22, 0], [0.6, 6, 22, 0]] },
      shoulderR: { r: [[0, -30, -40, 55], [0.3, -36, -46, 60], [0.6, -30, -40, 55]] },
      handR:     { r: [[0, -26, 0, 0], [0.6, -26, 0, 0]] },
      shoulderL: { r: [[0, -26, 0, -26], [0.6, -26, 0, -26]] },
      thighL:    { r: [[0, -12, 0, -6], [0.6, -12, 0, -6]] },
      thighR:    { r: [[0, 8, 0, 6], [0.6, 8, 0, 6]] },
      shinL:     { r: [[0, 18, 0, 0], [0.6, 18, 0, 0]] },
      shinR:     { r: [[0, 14, 0, 0], [0.6, 14, 0, 0]] }
    });

    C.spin = clip('spin', 0.86, false, {
      hips:      { r: [[0, 0, 40, 0], [0.10, 0, -60, 0], [0.34, 0, -300, 0], [0.58, 0, -520, 0], [0.72, 0, -700, 0], [0.86, 0, -720, 0]] },
      torso:     { r: [[0, 8, 0, 0], [0.20, 14, 0, 0], [0.72, 6, 0, 0], [0.86, 0, 0, 0]] },
      shoulderR: { r: [[0, -30, -40, 55], [0.14, -86, 0, 88], [0.62, -86, 0, 88], [0.86, 0, 0, 0]] },
      handR:     { r: [[0, -20, 0, 0], [0.86, 0, 0, 0]] },
      shoulderL: { r: [[0, -30, 0, -60], [0.14, -80, 0, -84], [0.62, -80, 0, -84], [0.86, 0, 0, -7]] },
      thighL:    { r: [[0, -14, 0, -8], [0.86, 0, 0, 0]] },
      thighR:    { r: [[0, 10, 0, 8], [0.86, 0, 0, 0]] }
    }, { events: [{ t: 0.10, name: 'spinGo' }, { t: 0.12, name: 'hitOn' }, { t: 0.66, name: 'hitOff' }] });

    C.guard = clip('guard', 1.4, true, {
      hips:      { t: [[0, 0, -0.045, 0], [0.7, 0, -0.055, 0], [1.4, 0, -0.045, 0]] },
      torso:     { r: [[0, 8, -18, 0], [1.4, 8, -18, 0]] },
      head:      { r: [[0, -4, 12, 0], [1.4, -4, 12, 0]] },
      shoulderL: { r: [[0, -78, 18, -22], [0.7, -82, 18, -22], [1.4, -78, 18, -22]] },
      handL:     { r: [[0, -54, 0, 0], [1.4, -54, 0, 0]] },
      shoulderR: { r: [[0, -18, -16, 30], [1.4, -18, -16, 30]] },
      handR:     { r: [[0, -30, 0, 0], [1.4, -30, 0, 0]] },
      thighL:    { r: [[0, -14, 0, -8], [1.4, -14, 0, -8]] },
      thighR:    { r: [[0, 10, 0, 8], [1.4, 10, 0, 8]] },
      shinL:     { r: [[0, 22, 0, 0], [1.4, 22, 0, 0]] },
      shinR:     { r: [[0, 18, 0, 0], [1.4, 18, 0, 0]] }
    });

    C.guardHit = clip('guardHit', 0.28, false, {
      hips:      { t: [[0, 0, -0.045, 0], [0.08, 0, -0.07, -0.10], [0.28, 0, -0.045, 0]] },
      shoulderL: { r: [[0, -78, 18, -22], [0.08, -62, 30, -14], [0.28, -78, 18, -22]] },
      torso:     { r: [[0, 8, -18, 0], [0.08, 14, -26, 0], [0.28, 8, -18, 0]] }
    });

    C.roll = clip('roll', 0.62, false, {
      root:      { r: [[0, 0, 0, 0], [0.10, -30, 0, 0], [0.34, -230, 0, 0], [0.52, -360, 0, 0], [0.62, -360, 0, 0]],
                   t: [[0, 0, 0, 0], [0.10, 0, 0.16, 0], [0.30, 0, 0.34, 0], [0.50, 0, 0.08, 0], [0.62, 0, 0, 0]] },
      hips:      { r: [[0, 20, 0, 0], [0.30, 46, 0, 0], [0.62, 0, 0, 0]] },
      torso:     { r: [[0, 26, 0, 0], [0.30, 44, 0, 0], [0.62, 0, 0, 0]] },
      head:      { r: [[0, 22, 0, 0], [0.30, 34, 0, 0], [0.62, 0, 0, 0]] },
      thighL:    { r: [[0, -70, 0, 0], [0.30, -110, 0, 0], [0.50, -30, 0, 0], [0.62, 0, 0, 0]] },
      thighR:    { r: [[0, -70, 0, 0], [0.30, -110, 0, 0], [0.50, -30, 0, 0], [0.62, 0, 0, 0]] },
      shinL:     { r: [[0, 90, 0, 0], [0.30, 120, 0, 0], [0.62, 10, 0, 0]] },
      shinR:     { r: [[0, 90, 0, 0], [0.30, 120, 0, 0], [0.62, 10, 0, 0]] },
      shoulderL: { r: [[0, -80, 0, -20], [0.30, -120, 0, -30], [0.62, 0, 0, -7]] },
      shoulderR: { r: [[0, -80, 0, 20], [0.30, -120, 0, 30], [0.62, 0, 0, 7]] }
    }, { events: [{ t: 0.04, name: 'rollGo' }, { t: 0.52, name: 'rollEnd' }] });

    C.jump = clip('jump', 0.42, false, {
      hips:      { t: [[0, 0, 0, 0], [0.10, 0, -0.10, 0], [0.24, 0, 0.04, 0], [0.42, 0, 0.02, 0]] },
      torso:     { r: [[0, 14, 0, 0], [0.10, 22, 0, 0], [0.24, -8, 0, 0], [0.42, -4, 0, 0]] },
      thighL:    { r: [[0, 20, 0, 0], [0.10, 46, 0, 0], [0.24, -26, 0, 0], [0.42, -14, 0, 0]] },
      thighR:    { r: [[0, 20, 0, 0], [0.10, 46, 0, 0], [0.24, -14, 0, 0], [0.42, 8, 0, 0]] },
      shinL:     { r: [[0, 30, 0, 0], [0.10, 70, 0, 0], [0.24, 20, 0, 0], [0.42, 34, 0, 0]] },
      shinR:     { r: [[0, 30, 0, 0], [0.10, 70, 0, 0], [0.24, 10, 0, 0], [0.42, 14, 0, 0]] },
      shoulderL: { r: [[0, 30, 0, -10], [0.10, 60, 0, -10], [0.24, -80, 0, -22], [0.42, -60, 0, -18]] },
      shoulderR: { r: [[0, 30, 0, 10], [0.10, 60, 0, 10], [0.24, -80, 0, 22], [0.42, -60, 0, 18]] }
    });

    C.fall = clip('fall', 0.9, true, {
      torso:     { r: [[0, -6, 0, 0], [0.45, -2, 0, 0], [0.9, -6, 0, 0]] },
      thighL:    { r: [[0, -18, 0, -6], [0.45, -6, 0, -6], [0.9, -18, 0, -6]] },
      thighR:    { r: [[0, 8, 0, 6], [0.45, 18, 0, 6], [0.9, 8, 0, 6]] },
      shinL:     { r: [[0, 34, 0, 0], [0.9, 34, 0, 0]] },
      shinR:     { r: [[0, 16, 0, 0], [0.9, 16, 0, 0]] },
      shoulderL: { r: [[0, -100, 0, -30], [0.45, -116, 0, -34], [0.9, -100, 0, -30]] },
      shoulderR: { r: [[0, -100, 0, 30], [0.45, -116, 0, 34], [0.9, -100, 0, 30]] }
    });

    C.land = clip('land', 0.30, false, {
      hips:      { t: [[0, 0, -0.02, 0], [0.09, 0, -0.16, 0], [0.30, 0, 0, 0]] },
      torso:     { r: [[0, 6, 0, 0], [0.09, 26, 0, 0], [0.30, 0, 0, 0]] },
      thighL:    { r: [[0, -10, 0, -6], [0.09, -48, 0, -10], [0.30, 0, 0, 0]] },
      thighR:    { r: [[0, -10, 0, 6], [0.09, -48, 0, 10], [0.30, 0, 0, 0]] },
      shinL:     { r: [[0, 20, 0, 0], [0.09, 84, 0, 0], [0.30, 0, 0, 0]] },
      shinR:     { r: [[0, 20, 0, 0], [0.09, 84, 0, 0], [0.30, 0, 0, 0]] },
      shoulderL: { r: [[0, -70, 0, -20], [0.09, -40, 0, -30], [0.30, 0, 0, -7]] },
      shoulderR: { r: [[0, -70, 0, 20], [0.09, -40, 0, 30], [0.30, 0, 0, 7]] }
    }, { events: [{ t: 0.02, name: 'landThud' }] });

    C.hurt = clip('hurt', 0.44, false, {
      hips:      { t: [[0, 0, 0, 0], [0.10, 0, 0.05, -0.10], [0.44, 0, 0, 0]] },
      torso:     { r: [[0, 0, 0, 0], [0.10, -26, 6, 0], [0.44, 0, 0, 0]] },
      head:      { r: [[0, 0, 0, 0], [0.10, -24, 0, 0], [0.44, 0, 0, 0]] },
      shoulderL: { r: [[0, 0, 0, -7], [0.10, 40, 0, -46], [0.44, 0, 0, -7]] },
      shoulderR: { r: [[0, 0, 0, 7], [0.10, 40, 0, 46], [0.44, 0, 0, 7]] },
      thighL:    { r: [[0, 0, 0, 0], [0.10, -16, 0, -10], [0.44, 0, 0, 0]] },
      thighR:    { r: [[0, 0, 0, 0], [0.10, 14, 0, 10], [0.44, 0, 0, 0]] }
    });

    C.die = clip('die', 1.30, false, {
      root:      { r: [[0, 0, 0, 0], [0.4, -14, 0, 0], [0.9, -84, 0, 0], [1.3, -90, 0, 0]],
                   t: [[0, 0, 0, 0], [0.9, 0, 0.12, 0], [1.3, 0, 0.10, 0]] },
      torso:     { r: [[0, 0, 0, 0], [0.35, -20, 10, 0], [1.3, 16, 4, 0]] },
      head:      { r: [[0, 0, 0, 0], [0.35, -20, 0, 0], [1.3, 20, 0, 0]] },
      shoulderL: { r: [[0, 0, 0, -7], [0.35, 60, 0, -60], [1.3, 30, 0, -70]] },
      shoulderR: { r: [[0, 0, 0, 7], [0.35, 60, 0, 60], [1.3, 30, 0, 70]] },
      thighL:    { r: [[0, 0, 0, 0], [0.5, -30, 0, -12], [1.3, -70, 0, -16]] },
      thighR:    { r: [[0, 0, 0, 0], [0.5, -20, 0, 12], [1.3, -60, 0, 16]] },
      shinL:     { r: [[0, 0, 0, 0], [1.3, 60, 0, 0]] },
      shinR:     { r: [[0, 0, 0, 0], [1.3, 50, 0, 0]] }
    });

    C.talk = clip('talk', 2.2, true, {
      torso:     { r: [[0, 0, -3, 0], [0.6, 2, 4, 0], [1.4, 0, -2, 0], [2.2, 0, -3, 0]] },
      head:      { r: [[0, 0, 4, 0], [0.35, -6, -5, 0], [0.9, 2, 6, 0], [1.6, -4, -3, 0], [2.2, 0, 4, 0]] },
      shoulderR: { r: [[0, -10, 0, 12], [0.5, -54, 0, 26], [1.0, -20, 0, 14], [1.6, -46, 0, 24], [2.2, -10, 0, 12]] },
      handR:     { r: [[0, -20, 0, 0], [0.5, -50, 0, 0], [1.0, -26, 0, 0], [2.2, -20, 0, 0]] },
      shoulderL: { r: [[0, -6, 0, -12], [1.1, -24, 0, -20], [2.2, -6, 0, -12]] }
    });

    C.itemGet = clip('itemGet', 2.6, false, {
      hips:      { t: [[0, 0, 0, 0], [0.2, 0, -0.06, 0], [0.5, 0, 0.03, 0], [2.6, 0, 0.01, 0]] },
      torso:     { r: [[0, 0, 0, 0], [0.2, 16, 0, 0], [0.5, -14, 0, 0], [2.6, -10, 0, 0]] },
      head:      { r: [[0, 0, 0, 0], [0.5, -26, 0, 0], [2.6, -22, 0, 0]] },
      shoulderL: { r: [[0, 0, 0, -7], [0.2, 20, 0, -20], [0.5, -168, 0, -18], [2.6, -168, 0, -14]] },
      shoulderR: { r: [[0, 0, 0, 7], [0.2, 20, 0, 20], [0.5, -168, 0, 18], [2.6, -168, 0, 14]] },
      handL:     { r: [[0, 0, 0, 0], [0.5, -20, 0, 0], [2.6, -20, 0, 0]] },
      handR:     { r: [[0, 0, 0, 0], [0.5, -20, 0, 0], [2.6, -20, 0, 0]] },
      thighL:    { r: [[0, 0, 0, 0], [0.2, -24, 0, 0], [0.5, 0, 0, 0], [2.6, 0, 0, 0]] },
      thighR:    { r: [[0, 0, 0, 0], [0.2, -24, 0, 0], [0.5, 0, 0, 0], [2.6, 0, 0, 0]] }
    }, { events: [{ t: 0.5, name: 'raise' }] });

    C.climb = clip('climb', 1.1, true, {
      torso:     { r: [[0, 6, 0, 0], [1.1, 6, 0, 0]] },
      shoulderL: { r: [[0, -160, 0, -18], [0.55, -110, 0, -22], [1.1, -160, 0, -18]] },
      shoulderR: { r: [[0, -110, 0, 22], [0.55, -160, 0, 18], [1.1, -110, 0, 22]] },
      handL:     { r: [[0, -30, 0, 0], [1.1, -30, 0, 0]] },
      handR:     { r: [[0, -30, 0, 0], [1.1, -30, 0, 0]] },
      thighL:    { r: [[0, -40, 0, -8], [0.55, -8, 0, -8], [1.1, -40, 0, -8]] },
      thighR:    { r: [[0, -8, 0, 8], [0.55, -40, 0, 8], [1.1, -8, 0, 8]] },
      shinL:     { r: [[0, 46, 0, 0], [0.55, 12, 0, 0], [1.1, 46, 0, 0]] },
      shinR:     { r: [[0, 12, 0, 0], [0.55, 46, 0, 0], [1.1, 12, 0, 0]] }
    }, { events: [{ t: 0.05, name: 'step' }, { t: 0.6, name: 'step' }] });

    C.push = clip('push', 1.0, true, {
      hips:      { t: [[0, 0, -0.02, 0], [0.5, 0, -0.035, 0], [1.0, 0, -0.02, 0]] },
      torso:     { r: [[0, -22, 0, 0], [1.0, -22, 0, 0]] },
      shoulderL: { r: [[0, -86, 0, -14], [1.0, -86, 0, -14]] },
      shoulderR: { r: [[0, -86, 0, 14], [1.0, -86, 0, 14]] },
      thighL:    { r: [[0, -22, 0, -6], [0.5, 6, 0, -6], [1.0, -22, 0, -6]] },
      thighR:    { r: [[0, 6, 0, 6], [0.5, -22, 0, 6], [1.0, 6, 0, 6]] },
      shinL:     { r: [[0, 30, 0, 0], [0.5, 12, 0, 0], [1.0, 30, 0, 0]] },
      shinR:     { r: [[0, 12, 0, 0], [0.5, 30, 0, 0], [1.0, 12, 0, 0]] }
    }, { events: [{ t: 0.05, name: 'step' }, { t: 0.55, name: 'step' }] });

    C.cast = clip('cast', 0.90, false, {
      hips:      { t: [[0, 0, 0, 0], [0.3, 0, -0.04, 0], [0.55, 0, 0.02, 0], [0.9, 0, 0, 0]] },
      torso:     { r: [[0, 0, 0, 0], [0.3, 14, 0, 0], [0.55, -18, 0, 0], [0.9, 0, 0, 0]] },
      head:      { r: [[0, 0, 0, 0], [0.55, -18, 0, 0], [0.9, 0, 0, 0]] },
      shoulderR: { r: [[0, -20, 0, 10], [0.3, -40, 0, 30], [0.55, -170, 0, 12], [0.9, -30, 0, 10]] },
      shoulderL: { r: [[0, -20, 0, -10], [0.3, -40, 0, -30], [0.55, -150, 0, -14], [0.9, -30, 0, -10]] }
    }, { events: [{ t: 0.55, name: 'castRelease' }] });

    C.aim = clip('aim', 1.0, true, {
      torso:     { r: [[0, 4, -30, 0], [1.0, 4, -30, 0]] },
      head:      { r: [[0, 0, 26, 0], [1.0, 0, 26, 0]] },
      shoulderL: { r: [[0, -92, 24, -8], [1.0, -92, 24, -8]] },
      handL:     { r: [[0, -8, 0, 0], [1.0, -8, 0, 0]] },
      shoulderR: { r: [[0, -80, -30, 20], [0.5, -82, -30, 20], [1.0, -80, -30, 20]] },
      handR:     { r: [[0, -46, 0, 0], [1.0, -46, 0, 0]] },
      thighL:    { r: [[0, -8, 0, -8], [1.0, -8, 0, -8]] },
      thighR:    { r: [[0, 6, 0, 8], [1.0, 6, 0, 8]] }
    });

    C.shoot = clip('shoot', 0.34, false, {
      torso:     { r: [[0, 4, -30, 0], [0.06, 6, -34, 0], [0.34, 4, -30, 0]] },
      shoulderL: { r: [[0, -92, 24, -8], [0.06, -88, 28, -8], [0.34, -92, 24, -8]] },
      shoulderR: { r: [[0, -80, -30, 20], [0.06, -70, -10, 20], [0.34, -80, -30, 20]] },
      handR:     { r: [[0, -46, 0, 0], [0.06, -20, 0, 0], [0.34, -46, 0, 0]] }
    }, { events: [{ t: 0.02, name: 'release' }] });

    C.throw = clip('throw', 0.50, false, {
      torso:     { r: [[0, 0, 18, 0], [0.16, -8, 30, 0], [0.30, 10, -24, 0], [0.5, 0, 0, 0]] },
      shoulderR: { r: [[0, -40, 0, 20], [0.16, -150, 0, 24], [0.30, -30, 0, 10], [0.5, 0, 0, 7]] },
      handR:     { r: [[0, -30, 0, 0], [0.30, -6, 0, 0], [0.5, 0, 0, 0]] },
      shoulderL: { r: [[0, -20, 0, -14], [0.5, 0, 0, -7]] }
    }, { events: [{ t: 0.24, name: 'release' }] });

    C.swim = clip('swim', 1.2, true, {
      root:      { r: [[0, 60, 0, 0], [1.2, 60, 0, 0]], t: [[0, 0, -0.12, 0], [1.2, 0, -0.12, 0]] },
      torso:     { r: [[0, -10, 0, 0], [0.6, -6, 0, 0], [1.2, -10, 0, 0]] },
      head:      { r: [[0, -34, 0, 0], [1.2, -34, 0, 0]] },
      shoulderL: { r: [[0, -60, 20, -40], [0.6, -140, 20, -30], [1.2, -60, 20, -40]] },
      shoulderR: { r: [[0, -140, -20, 30], [0.6, -60, -20, 40], [1.2, -140, -20, 30]] },
      thighL:    { r: [[0, 18, 0, -10], [0.6, -14, 0, -10], [1.2, 18, 0, -10]] },
      thighR:    { r: [[0, -14, 0, 10], [0.6, 18, 0, 10], [1.2, -14, 0, 10]] }
    });

    C.tread = clip('tread', 1.6, true, {
      root:      { t: [[0, 0, -0.34, 0], [0.8, 0, -0.29, 0], [1.6, 0, -0.34, 0]] },
      torso:     { r: [[0, 4, 0, 0], [1.6, 4, 0, 0]] },
      shoulderL: { r: [[0, -70, 30, -40], [0.8, -60, 20, -50], [1.6, -70, 30, -40]] },
      shoulderR: { r: [[0, -60, -20, 50], [0.8, -70, -30, 40], [1.6, -60, -20, 50]] },
      thighL:    { r: [[0, -40, 0, -10], [0.8, -20, 0, -10], [1.6, -40, 0, -10]] },
      thighR:    { r: [[0, -20, 0, 10], [0.8, -40, 0, 10], [1.6, -20, 0, 10]] }
    });

    C.sit = clip('sit', 3.0, true, {
      root:      { t: [[0, 0, -0.30, 0], [3.0, 0, -0.30, 0]] },
      torso:     { r: [[0, 8, 0, 0], [1.5, 11, 0, 0], [3.0, 8, 0, 0]] },
      head:      { r: [[0, 0, 6, 0], [1.5, 0, -6, 0], [3.0, 0, 6, 0]] },
      thighL:    { r: [[0, -84, 0, -12], [3.0, -84, 0, -12]] },
      thighR:    { r: [[0, -84, 0, 12], [3.0, -84, 0, 12]] },
      shinL:     { r: [[0, 84, 0, 0], [3.0, 84, 0, 0]] },
      shinR:     { r: [[0, 84, 0, 0], [3.0, 84, 0, 0]] },
      shoulderL: { r: [[0, -30, 0, -12], [3.0, -30, 0, -12]] },
      shoulderR: { r: [[0, -30, 0, 12], [3.0, -30, 0, 12]] }
    });

    /* lying in bed -- used for the prologue */
    C.lie = clip('lie', 4.0, true, {
      root:      { r: [[0, -84, 0, 0], [4.0, -84, 0, 0]], t: [[0, 0, 0.10, 0], [4.0, 0, 0.10, 0]] },
      torso:     { r: [[0, 20, 0, 0], [2.0, 24, 0, 0], [4.0, 20, 0, 0]] },
      head:      { r: [[0, 26, 4, 0], [2.0, 24, -4, 0], [4.0, 26, 4, 0]] },
      shoulderL: { r: [[0, 8, 0, -32], [2.0, 4, 0, -30], [4.0, 8, 0, -32]] },
      shoulderR: { r: [[0, 8, 0, 32], [2.0, 4, 0, 30], [4.0, 8, 0, 32]] },
      handL:     { r: [[0, -50, 0, 0], [4.0, -50, 0, 0]] },
      handR:     { r: [[0, -50, 0, 0], [4.0, -50, 0, 0]] },
      thighL:    { r: [[0, -6, 0, -6], [4.0, -6, 0, -6]] },
      thighR:    { r: [[0, -6, 0, 6], [4.0, -6, 0, 6]] }
    });

    /* raise a trembling hand -- old Link's key beat */
    C.lieReach = clip('lieReach', 3.0, true, {
      root:      { r: [[0, -84, 0, 0], [3.0, -84, 0, 0]], t: [[0, 0, 0.10, 0], [3.0, 0, 0.10, 0]] },
      torso:     { r: [[0, 24, 0, 0], [3.0, 24, 0, 0]] },
      head:      { r: [[0, 20, 0, 0], [3.0, 20, 0, 0]] },
      shoulderL: { r: [[0, 8, 0, -32], [3.0, 8, 0, -32]] },
      shoulderR: { r: [[0, -60, 0, 40], [0.9, -66, 6, 44], [1.8, -58, -4, 38], [3.0, -60, 0, 40]] },
      handR:     { r: [[0, -30, 0, 0], [1.0, -24, 0, 0], [2.0, -34, 0, 0], [3.0, -30, 0, 0]] },
      thighL:    { r: [[0, -6, 0, -6], [3.0, -6, 0, -6]] },
      thighR:    { r: [[0, -6, 0, 6], [3.0, -6, 0, 6]] }
    });

    /* floating, arms wide -- Genmo and other flyers */
    C.float = clip('float', 2.6, true, {
      root:      { t: [[0, 0, 0.28, 0], [1.3, 0, 0.44, 0], [2.6, 0, 0.28, 0]] },
      torso:     { r: [[0, -8, 0, 0], [1.3, -4, 0, 0], [2.6, -8, 0, 0]] },
      head:      { r: [[0, -10, 0, 0], [1.3, -6, 0, 0], [2.6, -10, 0, 0]] },
      shoulderL: { r: [[0, -20, 0, -60], [1.3, -14, 0, -72], [2.6, -20, 0, -60]] },
      shoulderR: { r: [[0, -20, 0, 60], [1.3, -14, 0, 72], [2.6, -20, 0, 60]] },
      handL:     { r: [[0, -24, 0, 0], [2.6, -24, 0, 0]] },
      handR:     { r: [[0, -24, 0, 0], [2.6, -24, 0, 0]] },
      thighL:    { r: [[0, 16, 0, -10], [1.3, 22, 0, -12], [2.6, 16, 0, -10]] },
      thighR:    { r: [[0, 16, 0, 10], [1.3, 22, 0, 12], [2.6, 16, 0, 10]] },
      shinL:     { r: [[0, 30, 0, 0], [2.6, 30, 0, 0]] },
      shinR:     { r: [[0, 24, 0, 0], [2.6, 24, 0, 0]] }
    });

    C.laugh = clip('laugh', 1.3, true, {
      torso:     { r: [[0, -6, 0, 0], [0.32, -22, 0, 0], [0.65, -6, 0, 0], [0.97, -22, 0, 0], [1.3, -6, 0, 0]] },
      head:      { r: [[0, -14, 0, 0], [0.32, -34, 0, 0], [0.65, -14, 0, 0], [0.97, -34, 0, 0], [1.3, -14, 0, 0]] },
      shoulderL: { r: [[0, -30, 0, -30], [0.32, -46, 0, -40], [1.3, -30, 0, -30]] },
      shoulderR: { r: [[0, -30, 0, 30], [0.32, -46, 0, 40], [1.3, -30, 0, 30]] }
    });

    C.point = clip('point', 1.8, true, {
      torso:     { r: [[0, 0, -14, 0], [1.8, 0, -14, 0]] },
      shoulderR: { r: [[0, -96, -20, 20], [0.9, -100, -20, 22], [1.8, -96, -20, 20]] },
      handR:     { r: [[0, -6, 0, 0], [1.8, -6, 0, 0]] },
      head:      { r: [[0, 0, -18, 0], [1.8, 0, -18, 0]] }
    });

    C.kneel = clip('kneel', 3.0, true, {
      root:      { t: [[0, 0, -0.26, 0], [3.0, 0, -0.26, 0]] },
      torso:     { r: [[0, 20, 0, 0], [1.5, 24, 0, 0], [3.0, 20, 0, 0]] },
      head:      { r: [[0, 22, 0, 0], [3.0, 22, 0, 0]] },
      thighL:    { r: [[0, -90, 0, -14], [3.0, -90, 0, -14]] },
      thighR:    { r: [[0, -20, 0, 12], [3.0, -20, 0, 12]] },
      shinL:     { r: [[0, 130, 0, 0], [3.0, 130, 0, 0]] },
      shinR:     { r: [[0, 60, 0, 0], [3.0, 60, 0, 0]] },
      shoulderL: { r: [[0, -40, 0, -16], [3.0, -40, 0, -16]] },
      shoulderR: { r: [[0, -40, 0, 16], [3.0, -40, 0, 16]] }
    });

    C.stagger = clip('stagger', 0.9, false, {
      root:      { r: [[0, 0, 0, 0], [0.3, -14, 0, 0], [0.9, 0, 0, 0]] },
      torso:     { r: [[0, -20, 0, 0], [0.45, -8, 14, 0], [0.9, -20, 0, 0]] },
      head:      { r: [[0, -14, 0, 0], [0.9, -14, 0, 0]] },
      thighL:    { r: [[0, 20, 0, -10], [0.45, -16, 0, -10], [0.9, 20, 0, -10]] },
      thighR:    { r: [[0, -16, 0, 10], [0.45, 20, 0, 10], [0.9, -16, 0, 10]] },
      shoulderL: { r: [[0, -40, 0, -40], [0.9, -40, 0, -40]] },
      shoulderR: { r: [[0, -40, 0, 40], [0.9, -40, 0, 40]] }
    });

    return C;
  }

  Models.humanoidClips = null;
  Models.getHumanoidClips = function () {
    if (!Models.humanoidClips) Models.humanoidClips = buildHumanoidClips();
    return Models.humanoidClips;
  };

  LZ.Models = Models;
})(LZ);
