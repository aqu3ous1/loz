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
  Models.humanoid = function (opts) {
    var o = opts || {};
    var s = o.scale || 1;
    var build = o.build || 'teen';
    var P = {
      child:  { hip: 0.56, torso: 0.34, headR: 0.145, arm: 0.20, thigh: 0.26, shin: 0.28, w: 0.90, shoulder: 0.145 },
      teen:   { hip: 0.68, torso: 0.42, headR: 0.140, arm: 0.24, thigh: 0.32, shin: 0.34, w: 1.00, shoulder: 0.170 },
      adult:  { hip: 0.80, torso: 0.50, headR: 0.145, arm: 0.29, thigh: 0.38, shin: 0.40, w: 1.08, shoulder: 0.195 },
      heavy:  { hip: 0.80, torso: 0.50, headR: 0.155, arm: 0.30, thigh: 0.38, shin: 0.40, w: 1.34, shoulder: 0.235 },
      lanky:  { hip: 0.88, torso: 0.54, headR: 0.135, arm: 0.34, thigh: 0.44, shin: 0.44, w: 0.92, shoulder: 0.190 },
      old:    { hip: 0.70, torso: 0.44, headR: 0.145, arm: 0.26, thigh: 0.33, shin: 0.35, w: 1.00, shoulder: 0.165 }
    }[build] || null;
    if (!P) throw new Error('unknown humanoid build: ' + build);

    var W = P.w;
    var skinC = o.skin === undefined ? 0xe8c49c : o.skin;
    var clothC = o.cloth === undefined ? 0x3f9a4c : o.cloth;
    var darkC = o.clothDark === undefined ? 0x2a6b36 : o.clothDark;
    var trimC = o.trim === undefined ? 0xd8c078 : o.trim;
    var bootC = o.boots === undefined ? 0x6b4a2c : o.boots;
    var hairC = o.hair === undefined ? 0x6b4a26 : o.hair;
    var hatC = o.hatColor === undefined ? clothC : o.hatColor;
    var skinTex = o.skinTex || 'skin';
    var clothTex = o.clothTex || 'clothGreen';
    var hairTex = o.hairTex || 'hairBrown';
    var bootTex = o.bootTex || 'leather';

    function hexcol(mb, hex) { mb.setColorHex(hex); return mb; }

    var def = [];
    def.push({ name: 'root' });

    /* ---- hips: pelvis + tunic skirt ---- */
    def.push({
      name: 'hips', parent: 'root', offset: [0, P.hip * s, 0], mat: clothTex,
      build: function (mb) {
        hexcol(mb, clothC);
        mb.taper(0, -0.10 * s, 0, 0.28 * W * s, 0.19 * W * s, 0.30 * W * s, 0.20 * W * s, 0.12 * s, 0, 0, 3.2);
        if (o.skirt !== false) {
          hexcol(mb, darkC);
          /* flared tunic hem: the silhouette that reads as "Hylian" */
          mb.taper(0, -0.26 * s, 0, 0.38 * W * s, 0.28 * W * s, 0.30 * W * s, 0.21 * W * s, 0.18 * s, 0, 0, 3.0);
        }
        hexcol(mb, trimC);
        mb.box(0, 0.015 * s, 0, 0.315 * W * s, 0.045 * s, 0.215 * W * s, 3.0);
      }
    });

    /* ---- torso ---- */
    def.push({
      name: 'torso', parent: 'hips', offset: [0, 0.02 * s, 0], mat: clothTex,
      rest: build === 'old' ? [16, 0, 0] : [0, 0, 0],
      build: function (mb) {
        hexcol(mb, clothC);
        mb.taper(0, 0, 0, 0.30 * W * s, 0.19 * W * s, 0.345 * W * s, 0.205 * W * s, P.torso * s, 0, 0, 2.6);
        /* collar */
        hexcol(mb, darkC);
        mb.box(0, (P.torso - 0.02) * s, 0, 0.30 * W * s, 0.05 * s, 0.20 * W * s, 3.0);
        if (o.sash) {
          hexcol(mb, o.sashColor || trimC);
          mb.taper(0, 0.10 * s, 0.005, 0.10 * W * s, 0.215 * W * s, 0.10 * W * s, 0.215 * W * s, 0.24 * s, 0.05 * s, 0, 3.0);
        }
      }
    });

    /* ---- head ---- */
    var hr = P.headR * s;
    def.push({
      name: 'head', parent: 'torso', offset: [0, (P.torso + 0.055) * s, 0], mat: skinTex,
      build: function (mb) {
        hexcol(mb, skinC);
        /* neck */
        mb.cylinder(0, -0.07 * s, 0, 0.055 * s, 0.06 * s, 0.08 * s, 6, false, 4);
        /* skull: slightly tapered box reads better than a sphere at this size */
        mb.taper(0, -0.01 * s, 0, hr * 1.72, hr * 1.62, hr * 1.80, hr * 1.66, hr * 1.05, 0, 0, 3.2);
        mb.taper(0, (hr * 1.04) * s / s, 0, hr * 1.80, hr * 1.66, hr * 1.30, hr * 1.20, hr * 0.42, 0, -0.006 * s, 3.2);
        /* pointed Hylian ears */
        hexcol(mb, skinC);
        for (var side = -1; side <= 1; side += 2) {
          mb.taper(side * hr * 0.92, hr * 0.30, -0.01 * s,
            0.035 * s, 0.075 * s, 0.02 * s, 0.03 * s, 0.16 * s, side * 0.045 * s, -0.03 * s, 4.0);
        }
        /* nose */
        mb.taper(0, hr * 0.24, hr * 0.86, 0.05 * s, 0.05 * s, 0.03 * s, 0.05 * s, 0.06 * s, 0, 0.02 * s, 4.0);
        /* eyes: dark inset quads on the face plane */
        var ez = hr * 0.90;
        for (var e = -1; e <= 1; e += 2) {
          hexcol(mb, 0xf4f2ee);
          mb.box(e * hr * 0.44, hr * 0.50, ez, 0.075 * s, 0.075 * s, 0.012 * s, 4.0);
          hexcol(mb, o.eyeColor === undefined ? 0x243a52 : o.eyeColor);
          mb.box(e * hr * 0.44, hr * 0.48, ez + 0.008 * s, 0.036 * s, 0.052 * s, 0.012 * s, 4.0);
          /* brow */
          hexcol(mb, hairC);
          mb.box(e * hr * 0.46, hr * 0.76, ez, 0.09 * s, 0.022 * s, 0.012 * s, 4.0);
        }
        if (o.mouth !== false) {
          hexcol(mb, 0x8a4a44);
          mb.box(0, -hr * 0.14, ez, 0.075 * s, 0.018 * s, 0.010 * s, 4.0);
        }
        if (o.beard) {
          hexcol(mb, o.beardColor === undefined ? hairC : o.beardColor);
          mb.taper(0, -hr * 0.62, hr * 0.30, 0.20 * s, 0.16 * s, 0.10 * s, 0.09 * s, 0.22 * s, 0, 0.02 * s, 3.0);
        }
      }
    });

    /* ---- hair / headgear ---- */
    var style = o.hairStyle || 'short';
    def.push({
      name: 'hair', parent: 'head', offset: [0, 0, 0], mat: (o.hat === 'cap' || o.hat === 'hood') ? clothTex : hairTex,
      build: function (mb) {
        if (o.hat === 'cap') {
          hexcol(mb, hatC);
          /* skullcap */
          mb.taper(0, hr * 0.72, 0, hr * 1.86, hr * 1.72, hr * 1.5, hr * 1.4, hr * 0.46, 0, 0, 3.0);
          /* long trailing point, the single most recognisable silhouette cue */
          var seg = 5, px = 0, py = hr * 1.15, pz = 0, w = hr * 1.35;
          for (var i = 0; i < seg; i++) {
            var nw = w * (1 - (i + 1) / (seg + 0.6));
            mb.taper(px, py, pz, w, w * 0.85, nw, nw * 0.85, hr * 0.62,
              0, -hr * 0.66, 3.0);
            py += hr * 0.30; pz -= hr * 0.66; w = nw;
          }
        } else if (o.hat === 'hood') {
          hexcol(mb, hatC);
          mb.taper(0, hr * 0.30, -hr * 0.10, hr * 2.05, hr * 2.0, hr * 1.2, hr * 1.2, hr * 1.4, 0, -hr * 0.2, 3.0);
        } else if (o.hat === 'turban') {
          hexcol(mb, hatC);
          mb.cylinder(0, hr * 0.75, 0, hr * 1.5, hr * 1.35, hr * 0.55, 8, true, 3.0);
          mb.cylinder(0, hr * 1.20, 0, hr * 1.2, hr * 0.7, hr * 0.35, 8, true, 3.0);
        } else if (o.hat === 'crown') {
          hexcol(mb, 0xd8b850);
          mb.cylinder(0, hr * 0.95, 0, hr * 1.55, hr * 1.6, hr * 0.30, 8, true, 3.0);
        }
        if (o.hat !== 'hood') {
          hexcol(mb, hairC);
          if (style === 'short' || style === 'long') {
            mb.taper(0, hr * 0.55, -hr * 0.05, hr * 1.90, hr * 1.86, hr * 1.55, hr * 1.5, hr * 0.62, 0, 0, 3.2);
            /* fringe */
            mb.box(0, hr * 0.62, hr * 0.80, hr * 1.7, hr * 0.5, hr * 0.28, 3.2);
            /* sides */
            for (var sd = -1; sd <= 1; sd += 2) {
              mb.taper(sd * hr * 0.86, -hr * 0.10, -hr * 0.15, 0.05 * s, hr * 1.5, 0.045 * s, hr * 1.0, hr * 0.75, 0, 0, 3.2);
            }
          }
          if (style === 'long') {
            mb.taper(0, -hr * 0.10, -hr * 0.80, hr * 1.5, 0.07 * s, hr * 1.1, 0.06 * s, -hr * 2.2, 0, 0, 3.0);
            mb.taper(0, -hr * 2.3, -hr * 0.80, hr * 1.5, 0.07 * s, hr * 1.1, 0.06 * s, hr * 2.2, 0, 0, 3.0);
          }
          if (style === 'bald') { /* nothing */ }
          if (style === 'ponytail') {
            mb.taper(0, hr * 0.55, -hr * 0.05, hr * 1.90, hr * 1.86, hr * 1.55, hr * 1.5, hr * 0.62, 0, 0, 3.2);
            mb.taper(0, hr * 0.30, -hr * 1.0, 0.10 * s, 0.10 * s, 0.06 * s, 0.06 * s, -hr * 2.0, 0, -hr * 0.4, 3.0);
          }
        }
      }
    });

    /* ---- arms ---- */
    function armBones(side, sname, hname) {
      def.push({
        name: sname, parent: 'torso',
        offset: [side * P.shoulder * W * s, (P.torso - 0.045) * s, 0],
        rest: [0, 0, side * -7], mat: clothTex,
        build: function (mb) {
          hexcol(mb, clothC);
          mb.taper(0, -P.arm * s, 0, 0.085 * W * s, 0.085 * W * s, 0.105 * W * s, 0.105 * W * s, P.arm * s, 0, 0, 4.0);
          hexcol(mb, darkC);
          mb.box(0, -P.arm * s * 0.98, 0, 0.10 * W * s, 0.035 * s, 0.10 * W * s, 4.0);
        }
      });
      def.push({
        name: hname, parent: sname, offset: [0, -P.arm * s, 0], mat: o.gloveTex || skinTex,
        build: function (mb) {
          hexcol(mb, o.glove === undefined ? skinC : o.glove);
          mb.taper(0, -P.arm * s * 0.92, 0, 0.075 * W * s, 0.075 * W * s, 0.085 * W * s, 0.085 * W * s, P.arm * s * 0.92, 0, 0, 4.0);
          hexcol(mb, o.glove === undefined ? skinC : o.glove);
          mb.box(0, -P.arm * s * 1.02, 0, 0.10 * W * s, 0.10 * s, 0.09 * W * s, 4.0);
        }
      });
    }
    armBones(-1, 'shoulderL', 'handL');
    armBones(1, 'shoulderR', 'handR');

    /* ---- legs ---- */
    function legBones(side, tname, sname) {
      def.push({
        name: tname, parent: 'hips', offset: [side * 0.085 * W * s, -0.10 * s, 0], mat: clothTex,
        build: function (mb) {
          hexcol(mb, o.pants === undefined ? darkC : o.pants);
          mb.taper(0, -P.thigh * s, 0, 0.105 * W * s, 0.11 * W * s, 0.125 * W * s, 0.13 * W * s, P.thigh * s, 0, 0, 4.0);
        }
      });
      def.push({
        name: sname, parent: tname, offset: [0, -P.thigh * s, 0], mat: bootTex,
        build: function (mb) {
          hexcol(mb, o.pants === undefined ? darkC : o.pants);
          mb.taper(0, -P.shin * s * 0.45, 0, 0.09 * W * s, 0.095 * W * s, 0.105 * W * s, 0.11 * W * s, P.shin * s * 0.45, 0, 0, 4.0);
          hexcol(mb, bootC);
          mb.taper(0, -P.shin * s, 0, 0.115 * W * s, 0.135 * W * s, 0.095 * W * s, 0.10 * W * s, P.shin * s * 0.56, 0, 0, 4.0);
          /* foot */
          mb.box(0, -P.shin * s + 0.035 * s, 0.045 * s, 0.125 * W * s, 0.07 * s, 0.22 * s, 4.0);
        }
      });
    }
    legBones(-1, 'thighL', 'shinL');
    legBones(1, 'thighR', 'shinR');

    /* ---- attachment points ---- */
    def.push({ name: 'itemR', parent: 'handR', offset: [0, -P.arm * s * 1.02, 0.02 * s], hide: true });
    def.push({ name: 'itemL', parent: 'handL', offset: [0, -P.arm * s * 1.02, 0.02 * s], hide: true });
    def.push({ name: 'backAttach', parent: 'torso', offset: [0, P.torso * s * 0.72, -0.13 * W * s], hide: true });

    if (o.cape) {
      def.push({
        name: 'cape', parent: 'torso', offset: [0, (P.torso - 0.03) * s, -0.10 * W * s], mat: clothTex,
        build: function (mb) {
          hexcol(mb, o.capeColor === undefined ? darkC : o.capeColor);
          mb.taper(0, -(P.torso + 0.28) * s, 0, 0.34 * W * s, 0.06 * s, 0.46 * W * s, 0.08 * s, (P.torso + 0.28) * s, 0, -0.06 * s, 2.4);
        }
      });
    }

    return { def: def, height: (P.hip + P.torso + 0.30) * s, radius: 0.20 * W * s, proportions: P, scale: s };
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
