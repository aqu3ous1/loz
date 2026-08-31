/* =============================================================
   game/meshes.js -- small one-off meshes: weapons, shields, pots,
   pickups, blocks. Built once and cached by key.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var M = LZ.M, GL = LZ.GL;
  function ITEM(id) { return (LZ.Items && LZ.Items.ITEMS[id]) || {}; }

  function Meshes(renderer) {
    this.r = renderer;
    this.cache = {};
  }
  Meshes.prototype._get = function (key, fn) {
    if (this.cache[key]) return this.cache[key];
    var mb = new GL.MeshBuilder();
    fn(mb);
    return (this.cache[key] = mb.build(this.r));
  };

  /* ---- Held gear. Everything hangs from the grip at the origin and
     extends down local -Y, which is where the hand bone points. Sizes are
     tuned against a 1.4-unit character: a sword is about a third of the
     body, the way it reads on screen in the games this imitates. ---- */
  Meshes.prototype.weapon = function (id) {
    return this._get('w_' + id, function (mb) {
      var d = ITEM(id);
      var col = d.color || 0xc8ccd4;
      var blade = 0.42 + (d.reach || 1.05) * 0.16;

      if (id === 'minersPick' || id === 'hammer') {
        mb.setColorHex(0x6b4a2c);
        mb.limb(0, -0.62, 0, 0.62, 0.026, 0.030, 6, { steps: 2, u: 1, v: 4 });
        mb.setColorHex(col);
        mb.tube([
          { x: -0.16, y: -0.66, z: 0, rx: 0.052, rz: 0.052 },
          { x: 0.16, y: -0.66, z: 0, rx: 0.052, rz: 0.052 }
        ], 6, { u: 1, v: 2 });
        mb.ovoid(0.20, -0.66, 0, 0.05, 0.05, 0.05, 6, 4);
        return;
      }
      if (id === 'boneClub') {
        mb.setColorHex(0xded6be);
        mb.limb(0, -0.52, 0, 0.52, 0.024, 0.034, 6, { steps: 2, u: 1, v: 4 });
        mb.ovoid(0, -0.58, 0, 0.070, 0.075, 0.070, 7, 5);
        return;
      }

      /* pommel + grip */
      mb.setColorHex(0xd8b850);
      mb.ovoid(0, 0.030, 0, 0.028, 0.026, 0.028, 6, 4);
      mb.setColorHex(0x5a3f26);
      mb.limb(0, -0.115, 0, 0.115, 0.021, 0.023, 6, { steps: 1, u: 1, v: 5 });
      /* crossguard: a flattened bar, not a box */
      mb.setColorHex(d.heirloom ? 0xe8d890 : 0xb0a070);
      mb.tube([
        { x: -0.105, y: -0.132, z: 0, rx: 0.016, rz: 0.022 },
        { x: -0.030, y: -0.146, z: 0, rx: 0.024, rz: 0.030 },
        { x: 0.030, y: -0.146, z: 0, rx: 0.024, rz: 0.030 },
        { x: 0.105, y: -0.132, z: 0, rx: 0.016, rz: 0.022 }
      ], 6, { u: 1, v: 3 });
      /* blade: a flattened diamond section, tapering to a point */
      mb.setColorHex(col);
      var w0 = 0.046, w1 = 0.034, th = 0.011;
      mb.tube([
        { x: 0, y: -0.150, z: 0, rx: w0, rz: th },
        { x: 0, y: -0.150 - blade * 0.55, z: 0, rx: w0 * 0.96, rz: th },
        { x: 0, y: -0.150 - blade * 0.88, z: 0, rx: w1, rz: th * 0.9 },
        { x: 0, y: -0.150 - blade, z: 0, rx: 0.004, rz: 0.004 }
      ], 6, { u: 1, v: 3 });
      /* the fuller catches the light and makes the blade read as metal */
      mb.setColorHex(0xffffff);
      mb.tube([
        { x: 0, y: -0.170, z: th * 0.85, rx: 0.008, rz: 0.003 },
        { x: 0, y: -0.150 - blade * 0.86, z: th * 0.85, rx: 0.006, rz: 0.003 }
      ], 4, { u: 1, v: 2 });
    });
  };

  Meshes.prototype.shield = function (id) {
    return this._get('s_' + id, function (mb) {
      var d = ITEM(id);
      var face = d.color || 0x8a6438;
      /* A rounded heater shield about a third of the body tall. It hangs
         from the forearm, so the body extends down local -Y. */
      var W = 0.155, Ht = 0.20;
      mb.setColorHex(face);
      var rings = [];
      for (var i = 0; i <= 6; i++) {
        var t = i / 6;
        var y = -0.06 - t * (Ht * 2.0);
        /* width tapers to a rounded point at the bottom */
        var w = W * Math.sqrt(Math.max(0.02, 1 - Math.pow(Math.max(0, t - 0.35) / 0.68, 2.1)));
        rings.push({ x: 0, y: y, z: 0, rx: w, rz: 0.020 + 0.010 * Math.sin(t * Math.PI) });
      }
      mb.tube(rings, 10, { u: 1, v: 2 });
      /* rim */
      mb.setColorHex(0xd8c078);
      mb.tube([
        { x: 0, y: -0.055, z: 0, rx: W * 1.04, rz: 0.024 },
        { x: 0, y: -0.085, z: 0, rx: W * 1.04, rz: 0.024 }
      ], 10, { u: 1, v: 2, capStart: false, capEnd: false });
      /* boss / emblem */
      mb.setColorHex(id === 'mirrorShield' ? 0xe8f4ff : 0xd8c078);
      mb.ovoid(0, -0.20, 0.026, W * 0.42, W * 0.46, 0.016, 8, 5);
      /* arm strap on the inside */
      mb.setColorHex(0x4a3520);
      mb.tube([
        { x: 0, y: -0.14, z: -0.032, rx: 0.030, rz: 0.012 },
        { x: 0, y: -0.24, z: -0.032, rx: 0.030, rz: 0.012 }
      ], 6, { u: 1, v: 2 });
    });
  };

  Meshes.prototype.tool = function (id) {
    return this._get('t_' + id, function (mb) {
      if (id === 'bow') {
        mb.setColorHex(0x8a6438);
        for (var i = 0; i <= 10; i++) {
          var t = i / 10, a = (t - 0.5) * 2.2;
          var y = -0.5 + t, x = Math.cos(a) * 0.20 - 0.18;
          if (i === 10) break;
          var t2 = (i + 1) / 10, a2 = (t2 - 0.5) * 2.2;
          var y2 = -0.5 + t2, x2 = Math.cos(a2) * 0.20 - 0.18;
          mb.box((x + x2) / 2, (y + y2) / 2, 0, 0.045, Math.abs(y2 - y) + 0.02, 0.045, 3);
        }
        mb.setColorHex(0xe0dcd0);
        mb.box(-0.18 + Math.cos(-1.1) * 0.20, 0, 0, 0.012, 1.0, 0.012, 2);
        return;
      }
      if (id === 'hookshot') {
        mb.setColorHex(0x8a8f98);
        mb.box(0, -0.22, 0, 0.11, 0.34, 0.11, 3);
        mb.cylinder(0, -0.38, 0, 0.05, 0.05, -0.24, 6, true, 3);
        mb.setColorHex(0xd0d4dc);
        mb.taper(0, -0.62, 0, 0.07, 0.07, 0.02, 0.02, -0.14, 0, 0, 3);
        return;
      }
      if (id === 'iceRod') {
        mb.setColorHex(0x6a7a92);
        mb.cylinder(0, -0.08, 0, 0.035, 0.03, -0.62, 6, true, 3);
        mb.setColorHex(0x9fe4ff);
        mb.sphere(0, -0.76, 0, 0.11, 6, 4, 1.3);
        return;
      }
      if (id === 'boomerang') {
        mb.setColorHex(0xb08c50);
        mb.box(-0.02, -0.20, 0, 0.07, 0.34, 0.035, 3);
        mb.box(0.14, -0.36, 0, 0.30, 0.07, 0.035, 3);
        return;
      }
      if (id === 'lantern') {
        mb.setColorHex(0x8a8f98);
        mb.box(0, -0.28, 0, 0.16, 0.24, 0.16, 3);
        mb.setColorHex(0xffe8a0);
        mb.box(0, -0.28, 0, 0.11, 0.18, 0.11, 3);
        return;
      }
      if (id === 'flute') {
        mb.setColorHex(0xe8e2ce);
        mb.cylinder(0, -0.06, 0, 0.032, 0.030, -0.42, 7, true, 3);
        mb.setColorHex(0x30282a);
        for (var h = 0; h < 4; h++) mb.box(0, -0.16 - h * 0.06, 0.031, 0.016, 0.016, 0.008, 2);
        return;
      }
      /* generic held object */
      mb.setColorHex(0x9aa2ad);
      mb.box(0, -0.2, 0, 0.14, 0.3, 0.14, 3);
    });
  };

  Meshes.prototype.enemyWeapon = function (id) {
    return this._get('ew_' + id, function (mb) {
      if (id === 'club') {
        mb.setColorHex(0x6b4a2c);
        mb.cylinder(0, -0.06, 0, 0.045, 0.07, -0.72, 6, true, 3);
        mb.setColorHex(0x8a6a4a);
        mb.taper(0, -0.78, 0, 0.20, 0.20, 0.14, 0.14, -0.22, 0, 0, 2);
        mb.setColorHex(0x9aa2ad);
        for (var i = 0; i < 4; i++) {
          var a = i / 4 * M.TAU;
          mb.taper(Math.sin(a) * 0.13, -0.86, Math.cos(a) * 0.13, 0.05, 0.05, 0.01, 0.01, 0.10,
            Math.sin(a) * 0.06, Math.cos(a) * 0.06, 2);
        }
        return;
      }
      if (id === 'greatclub') {
        mb.setColorHex(0x5a3f26);
        mb.cylinder(0, -0.06, 0, 0.06, 0.09, -0.95, 6, true, 3);
        mb.setColorHex(0x7a5a3a);
        mb.taper(0, -1.05, 0, 0.30, 0.30, 0.22, 0.22, -0.34, 0, 0, 1.6);
        return;
      }
      if (id === 'boneblade') {
        mb.setColorHex(0xded6be);
        mb.cylinder(0, 0, 0, 0.035, 0.04, -0.16, 5, true, 3);
        mb.box(0, -0.18, 0, 0.24, 0.04, 0.06, 3);
        mb.taper(0, -0.22, 0, 0.07, 0.026, 0.03, 0.016, -0.86, 0, 0, 2.2);
        return;
      }
      if (id === 'boneshield') {
        mb.setColorHex(0xd8cfb2);
        mb.taper(0, -0.42, -0.03, 0.40, 0.06, 0.24, 0.05, 0.66, 0, 0, 1.8);
        return;
      }
      if (id === 'darkblade') {
        mb.setColorHex(0x2a1030);
        mb.cylinder(0, 0.02, 0, 0.04, 0.045, -0.22, 6, true, 3);
        mb.setColorHex(0xd8a030);
        mb.box(0, -0.22, 0, 0.42, 0.05, 0.09, 3);
        mb.setColorHex(0x8a30c0);
        mb.taper(0, -0.26, 0, 0.10, 0.035, 0.07, 0.026, -1.25, 0, 0, 2.0);
        mb.taper(0, -1.51, 0, 0.07, 0.026, 0.006, 0.006, -0.16, 0, 0, 2.0);
        return;
      }
      mb.setColorHex(0x888888);
      mb.box(0, -0.3, 0, 0.1, 0.6, 0.1, 2);
    });
  };

  Meshes.prototype.chest = function (big, lid) {
    var s = big ? 1.5 : 1;
    return this._get('chest_' + (big ? 'b' : 's') + (lid ? '_lid' : ''), function (mb) {
      mb.setColorHex(0xffffff);
      if (lid) {
        mb.taper(0, 0, 0, 0.86 * s, 0.62 * s, 0.86 * s, 0.62 * s, 0.02, 0, 0, 1.6);
        mb.box(0, 0.10 * s, 0, 0.88 * s, 0.20 * s, 0.64 * s, 1.6);
        mb.setColorHex(0xd8b850);
        mb.box(0, 0.10 * s, 0.32 * s, 0.22 * s, 0.14 * s, 0.05 * s, 2);
      } else {
        mb.box(0, 0.22 * s, 0, 0.88 * s, 0.44 * s, 0.64 * s, 1.6);
        mb.setColorHex(0xd8b850);
        mb.box(0, 0.30 * s, 0.33 * s, 0.20 * s, 0.16 * s, 0.05 * s, 2);
      }
    });
  };

  Meshes.prototype.pot = function (style) {
    return this._get('pot_' + style, function (mb) {
      if (style === 'crate') {
        mb.setColorHex(0xd8c8a8);
        mb.box(0, 0.28, 0, 0.56, 0.56, 0.56, 1.8);
        return;
      }
      if (style === 'skull') {
        mb.setColorHex(0xe8e0c8);
        mb.sphere(0, 0.28, 0, 0.28, 7, 4, 1);
        mb.setColorHex(0x201820);
        mb.box(-0.10, 0.30, 0.24, 0.09, 0.11, 0.05, 2);
        mb.box(0.10, 0.30, 0.24, 0.09, 0.11, 0.05, 2);
        return;
      }
      mb.setColorHex(0xd8c0a0);
      mb.cylinder(0, 0, 0, 0.16, 0.26, 0.28, 8, true, 1.8);
      mb.cylinder(0, 0.28, 0, 0.26, 0.20, 0.24, 8, false, 1.8);
      mb.setColorHex(0xa8664a);
      mb.cylinder(0, 0.50, 0, 0.21, 0.23, 0.08, 8, true, 1.8);
    });
  };

  Meshes.prototype.grass = function () {
    return this._get('grassclump', function (mb) {
      mb.setColorHex(0xffffff);
      mb.cross(0, 0, 0, 0.62, 0.48, 3);
    });
  };

  Meshes.prototype.pickup = function (what) {
    return this._get('pk_' + what, function (mb) {
      if (what.indexOf('rupee') === 0) {
        mb.setColorHex(0xffffff);
        /* hexagonal gem, two pyramids joined */
        var r = 0.14, h = 0.24;
        for (var i = 0; i < 6; i++) {
          var a0 = i / 6 * M.TAU, a1 = (i + 1) / 6 * M.TAU;
          var p0 = [Math.sin(a0) * r, 0, Math.cos(a0) * r];
          var p1 = [Math.sin(a1) * r, 0, Math.cos(a1) * r];
          var top = [0, h, 0], bot = [0, -h, 0];
          var t0 = mb.vert(p0[0], p0[1], p0[2], p0[0], 0.3, p0[2], 0, 1);
          var t1 = mb.vert(p1[0], p1[1], p1[2], p1[0], 0.3, p1[2], 1, 1);
          var tt = mb.vert(top[0], top[1], top[2], 0, 1, 0, 0.5, 0);
          mb.tri(t0, t1, tt);
          var b0 = mb.vert(p1[0], p1[1], p1[2], p1[0], -0.3, p1[2], 0, 1);
          var b1 = mb.vert(p0[0], p0[1], p0[2], p0[0], -0.3, p0[2], 1, 1);
          var bb = mb.vert(bot[0], bot[1], bot[2], 0, -1, 0, 0.5, 0);
          mb.tri(b0, b1, bb);
        }
        return;
      }
      if (what === 'heart' || what === 'heartBig') {
        var s = what === 'heartBig' ? 1.7 : 1;
        mb.setColorHex(0xff5060);
        mb.sphere(-0.09 * s, 0.10 * s, 0, 0.11 * s, 6, 4, 1);
        mb.sphere(0.09 * s, 0.10 * s, 0, 0.11 * s, 6, 4, 1);
        mb.taper(0, -0.16 * s, 0, 0.30 * s, 0.20 * s, 0.02 * s, 0.02 * s, 0.26 * s, 0, 0, 2);
        return;
      }
      if (what === 'magic' || what === 'magicBig') {
        var ms = what === 'magicBig' ? 1.6 : 1;
        mb.setColorHex(0x50e070);
        mb.sphere(0, 0.10 * ms, 0, 0.13 * ms, 6, 4, 1.3);
        mb.taper(0, -0.10 * ms, 0, 0.12 * ms, 0.12 * ms, 0.02, 0.02, 0.14 * ms, 0, 0, 2);
        return;
      }
      if (what === 'arrow') {
        mb.setColorHex(0xc8a878);
        mb.cylinder(0, -0.2, 0, 0.02, 0.02, 0.4, 5, true, 3);
        mb.setColorHex(0xa8b0bc);
        mb.taper(0, 0.20, 0, 0.05, 0.05, 0.01, 0.01, 0.10, 0, 0, 3);
        return;
      }
      if (what === 'bomb') {
        mb.setColorHex(0x30323c);
        mb.sphere(0, 0.14, 0, 0.16, 7, 4, 1);
        mb.setColorHex(0x8a6a3a);
        mb.cylinder(0, 0.28, 0, 0.02, 0.02, 0.10, 4, true, 3);
        return;
      }
      if (what === 'key') {
        mb.setColorHex(0xe8c060);
        mb.cylinder(0, 0.16, 0, 0.09, 0.09, 0.03, 8, true, 3);
        mb.box(0, 0, 0, 0.03, 0.30, 0.03, 3);
        mb.box(0.05, -0.10, 0, 0.10, 0.03, 0.03, 3);
        return;
      }
      mb.setColorHex(0xffffff);
      mb.sphere(0, 0.14, 0, 0.13, 6, 4, 1);
    });
  };

  Meshes.prototype.pickupMat = function (what) {
    if (what === 'rupeeG') return 'gemGreen';
    if (what === 'rupeeB') return 'gemBlue';
    if (what === 'rupeeR') return 'gemRed';
    if (what === 'rupeeP') return 'gemPurple';
    if (what === 'heart' || what === 'heartBig') return 'gemRed';
    if (what === 'magic' || what === 'magicBig') return 'gemGreen';
    if (what === 'key') return 'gold';
    if (what === 'bomb') return 'metal';
    return 'metal';
  };

  Meshes.prototype.block = function (size, style) {
    return this._get('block_' + size + '_' + style, function (mb) {
      var h = size;
      mb.setColorHex(0xffffff);
      mb.box(0, h / 2, 0, h, h, h, 1.4);
      mb.setColorHex(0xd8d8d8);
      /* raised border so the pushable block reads as different from a wall */
      mb.box(0, h * 0.5, h * 0.5, h * 0.7, h * 0.7, 0.03, 1.4);
      mb.box(0, h * 0.5, -h * 0.5, h * 0.7, h * 0.7, 0.03, 1.4);
      mb.box(h * 0.5, h * 0.5, 0, 0.03, h * 0.7, h * 0.7, 1.4);
      mb.box(-h * 0.5, h * 0.5, 0, 0.03, h * 0.7, h * 0.7, 1.4);
    });
  };

  Meshes.prototype.switchMesh = function (style) {
    return this._get('sw_' + style, function (mb) {
      if (style === 'crystal') {
        mb.setColorHex(0xffffff);
        mb.cylinder(0, 0, 0, 0.20, 0.16, 0.24, 6, true, 2);
        mb.taper(0, 0.24, 0, 0.24, 0.24, 0.02, 0.02, 0.46, 0, 0, 2);
        mb.taper(0, 0.24, 0, 0.24, 0.24, 0.02, 0.02, -0.22, 0, 0, 2);
        return;
      }
      if (style === 'chain') {
        mb.setColorHex(0xffffff);
        mb.cylinder(0, 0, 0, 0.06, 0.06, 1.3, 5, true, 3);
        mb.sphere(0, 0, 0, 0.13, 6, 4, 1);
        return;
      }
      mb.setColorHex(0xffffff);
      mb.cylinder(0, 0, 0, 0.62, 0.62, 0.07, 8, true, 1.6);
      mb.cylinder(0, 0.07, 0, 0.50, 0.50, 0.06, 8, true, 1.6);
    });
  };

  Meshes.prototype.hintStone = function () {
    return this._get('hintstone', function (mb) {
      mb.setColorHex(0xb8b4ac);
      mb.sphere(0, 0.55, 0, 0.52, 7, 4, 1.15);
      mb.setColorHex(0x8a8880);
      mb.box(0, 0.72, 0.44, 0.30, 0.10, 0.06, 2);
      mb.box(-0.14, 0.55, 0.46, 0.10, 0.14, 0.05, 2);
      mb.box(0.14, 0.55, 0.46, 0.10, 0.14, 0.05, 2);
    });
  };

  Meshes.prototype.projectile = function (kind) {
    return this._get('proj_' + kind, function (mb) {
      if (kind === 'arrow') {
        mb.setColorHex(0xc8a878);
        mb.cylinder(0, 0, 0, 0.018, 0.018, 0.62, 4, true, 3);
        mb.setColorHex(0xb8bec8);
        mb.taper(0, 0.62, 0, 0.045, 0.045, 0.004, 0.004, 0.12, 0, 0, 3);
        mb.setColorHex(0xf0f0f0);
        mb.box(0, 0.06, 0, 0.006, 0.14, 0.09, 2);
        mb.box(0, 0.06, 0, 0.09, 0.14, 0.006, 2);
        return;
      }
      if (kind === 'rock' || kind === 'seed') {
        mb.setColorHex(kind === 'seed' ? 0x6a8a3a : 0x8a8078);
        mb.sphere(0, 0, 0, 0.14, 5, 3, 0.9);
        return;
      }
      if (kind === 'bomb') {
        mb.setColorHex(0x30323c);
        mb.sphere(0, 0, 0, 0.20, 7, 4, 1);
        mb.setColorHex(0x8a6a3a);
        mb.cylinder(0, 0.18, 0, 0.022, 0.022, 0.12, 4, true, 3);
        return;
      }
      if (kind === 'boomerang') {
        mb.setColorHex(0xb08c50);
        mb.box(-0.02, 0, 0, 0.08, 0.03, 0.34, 3);
        mb.box(0.15, 0, -0.16, 0.34, 0.03, 0.08, 3);
        return;
      }
      if (kind === 'hook') {
        mb.setColorHex(0xd0d4dc);
        mb.taper(0, 0, 0, 0.09, 0.09, 0.02, 0.02, 0.22, 0, 0, 3);
        mb.box(0.07, -0.05, 0, 0.14, 0.04, 0.04, 3);
        mb.box(-0.07, -0.05, 0, 0.14, 0.04, 0.04, 3);
        return;
      }
      if (kind === 'ice') {
        mb.setColorHex(0x9fe4ff);
        mb.sphere(0, 0, 0, 0.20, 6, 4, 1.4);
        return;
      }
      /* generic energy ball */
      mb.setColorHex(0xffffff);
      mb.sphere(0, 0, 0, 0.24, 7, 4, 1);
    });
  };

  Meshes.prototype.iceBlock = function () {
    return this._get('iceblock', function (mb) {
      mb.setColorHex(0xd8f0ff);
      mb.box(0, 0.6, 0, 1.2, 1.2, 1.2, 1.4);
      mb.setColorHex(0xffffff);
      mb.box(0, 1.22, 0, 0.7, 0.1, 0.7, 1.4);
    });
  };

  LZ.Meshes = Meshes;
})(LZ);
