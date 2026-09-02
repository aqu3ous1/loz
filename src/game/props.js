/* =============================================================
   game/props.js -- static world geometry.

   Props write into a Batcher, which accumulates one MeshBuilder per
   material and bakes them into a handful of static VBOs. A whole town is
   then ~12 draw calls instead of 400, which is the only way the era's
   hardware ever managed a town at all.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var M = LZ.M, GL = LZ.GL, C = LZ.Collision;

  function Batcher() { this.groups = {}; this.order = []; }
  Batcher.prototype.mb = function (matName) {
    var g = this.groups[matName];
    if (!g) { g = this.groups[matName] = new GL.MeshBuilder(); this.order.push(matName); }
    return g;
  };
  Batcher.prototype.build = function (renderer) {
    var out = [];
    for (var i = 0; i < this.order.length; i++) {
      var name = this.order[i];
      var mb = this.groups[name];
      if (!mb.i.length) continue;
      out.push({ mesh: mb.build(renderer), mat: name, tris: mb.i.length / 3 });
    }
    return out;
  };
  Batcher.prototype.triCount = function () {
    var n = 0;
    for (var k in this.groups) n += this.groups[k].i.length / 3;
    return n;
  };

  var P = {};
  P.Batcher = Batcher;

  function rnd(seed) { return M.hash2(seed | 0, (seed * 7919) | 0, 1337); }

  /* ---------------- vegetation ---------------- */
  P.tree = function (b, x, y, z, o) {
    o = o || {};
    var s = o.scale || 1;
    var seed = o.seed === undefined ? (x * 13 + z * 7) : o.seed;
    var trunkH = (2.1 + rnd(seed) * 1.3) * s;
    var trunkR = 0.20 * s;
    var bark = b.mb(o.barkMat || 'bark');
    bark.setColorHex(o.barkColor === undefined ? 0xffffff : o.barkColor);
    /* a flared root base and a slight lean: a straight cylinder on a lawn is
       the tell that a tree was placed by a loop rather than grown */
    var lean = (rnd(seed + 41) - 0.5) * 0.30 * s;
    var lz2 = (rnd(seed + 43) - 0.5) * 0.30 * s;
    /* Budget matters here more than anywhere else: a field holds seventy of
       these, and an N64 tree was well under a hundred triangles. Five sides
       on the trunk and three rings on a crown blob is the whole allowance. */
    bark.tube([
      { x: x, y: y - 0.05, z: z, r: trunkR * 1.85 },
      { x: x, y: y + trunkH * 0.14, z: z, r: trunkR * 1.22 },
      { x: x + lean * 0.55, y: y + trunkH * 0.60, z: z + lz2 * 0.55, r: trunkR * 0.96 },
      { x: x + lean, y: y + trunkH, z: z + lz2, r: trunkR * 0.74 }
    ], 5, { v: 0.7, capStart: false });
    /* limbs curving up and out of the trunk */
    var limbs = 2 + Math.floor(rnd(seed + 1) * 2);
    for (var i = 0; i < limbs; i++) {
      var a = (i / limbs) * M.TAU + rnd(seed + i * 3) * 0.9;
      var lh = trunkH * (0.52 + rnd(seed + i * 5) * 0.26);
      var len = (0.55 + rnd(seed + i * 11) * 0.40) * s;
      var sa = Math.sin(a), ca = Math.cos(a);
      bark.tube([
        { x: x + lean * 0.5 + sa * trunkR * 0.7, y: y + lh, z: z + lz2 * 0.5 + ca * trunkR * 0.7,
          r: trunkR * 0.52 },
        { x: x + lean * 0.7 + sa * len * 1.5, y: y + lh + len * 0.95,
          z: z + lz2 * 0.7 + ca * len * 1.5, r: trunkR * 0.18 }
      ], 4);
    }
    /* Crown: a wide, slightly flattened cluster rather than one ball. The
       era's trees read as a mass of foliage sitting low over the branches. */
    var leaf = b.mb(o.leafMat || 'leaves');
    leaf.setColorHex(o.leafColor === undefined ? 0xffffff : o.leafColor);
    var cy = y + trunkH * 0.94;
    var R = (1.20 + rnd(seed + 9) * 0.45) * s;
    var tipX = x + lean, tipZ = z + lz2;
    leaf.ovoid(tipX, cy + R * 0.44, tipZ, R * 1.06, R * 0.80, R * 1.02, 7, 4);
    var blobs = o.blobs === undefined ? 3 : o.blobs;
    for (var k = 0; k < blobs; k++) {
      var ba = (k / blobs) * M.TAU + rnd(seed + 20 + k) * 0.8;
      var br = R * (0.56 + rnd(seed + 26 + k) * 0.22);
      var bs = R * (0.52 + rnd(seed + 34 + k) * 0.24);
      leaf.ovoid(tipX + Math.sin(ba) * br,
        cy + R * (0.16 + rnd(seed + 30 + k) * 0.46),
        tipZ + Math.cos(ba) * br,
        bs, bs * 0.82, bs, 6, 3);
    }
    if (o.collide !== false && b.col) {
      b.col.add(C.cyl(x, y, z, trunkR * 1.5, trunkH, { surface: 'wood' }));
    }
  };

  P.pine = function (b, x, y, z, o) {
    o = o || {};
    var s = o.scale || 1;
    var seed = o.seed === undefined ? (x * 31 + z * 17) : o.seed;
    var h = (3.2 + rnd(seed) * 1.8) * s;
    var bark = b.mb('barkPine');
    bark.setColorHex(0xffffff);
    bark.cylinder(x, y, z, 0.20 * s, 0.10 * s, h, 4, false, 1.6);
    var leaf = b.mb(o.leafMat || 'pine');
    leaf.setColorHex(o.leafColor === undefined ? 0xffffff : o.leafColor);
    var tiers = 4;
    for (var i = 0; i < tiers; i++) {
      var t = i / tiers;
      var yy = y + h * (0.22 + t * 0.66);
      var r = (1.15 - t * 0.78) * s;
      leaf.cylinder(x, yy, z, r, r * 0.16, h * 0.30, 6, true, 1.1);
    }
    if (b.col) b.col.add(C.cyl(x, y, z, 0.30 * s, h * 0.8, { surface: 'wood' }));
  };

  P.deadTree = function (b, x, y, z, o) {
    o = o || {};
    var s = o.scale || 1;
    var seed = o.seed === undefined ? (x * 53 + z * 29) : o.seed;
    var h = (2.4 + rnd(seed) * 1.2) * s;
    var bark = b.mb('barkDead');
    bark.setColorHex(o.color === undefined ? 0xffffff : o.color);
    bark.tube([
      { x: x, y: y - 0.05, z: z, r: 0.30 * s },
      { x: x, y: y + h * 0.18, z: z, r: 0.19 * s },
      { x: x, y: y + h * 0.62, z: z, r: 0.13 * s },
      { x: x, y: y + h, z: z, r: 0.06 * s }
    ], 6, { v: 0.7, capStart: false });
    for (var i = 0; i < 5; i++) {
      var a = (i / 5) * M.TAU + rnd(seed + i) * 1.4;
      var yy = y + h * (0.42 + rnd(seed + i * 3) * 0.46);
      var len = (0.7 + rnd(seed + i * 7) * 0.7) * s;
      var sa = Math.sin(a), ca = Math.cos(a);
      /* the crook where a dead branch bends up before it forks */
      bark.tube([
        { x: x, y: yy, z: z, r: 0.11 * s },
        { x: x + sa * len * 0.5, y: yy + len * 0.30, z: z + ca * len * 0.5, r: 0.07 * s },
        { x: x + sa * len * 0.9, y: yy + len * 0.74, z: z + ca * len * 0.9, r: 0.04 * s },
        { x: x + sa * len * 1.15, y: yy + len * 1.10, z: z + ca * len * 1.15, r: 0.012 * s }
      ], 5);
    }
    if (b.col) b.col.add(C.cyl(x, y, z, 0.28 * s, h * 0.8, { surface: 'wood' }));
  };

  P.palm = function (b, x, y, z, o) {
    o = o || {};
    var s = o.scale || 1;
    var seed = o.seed === undefined ? (x * 71 + z * 41) : o.seed;
    var h = (3.4 + rnd(seed) * 1.4) * s;
    var lean = (rnd(seed + 2) - 0.5) * 0.9;
    var bark = b.mb('bark');
    bark.setColorHex(0xc8b088);
    var segs = 6;
    for (var i = 0; i < segs; i++) {
      var t = i / segs;
      var yy = y + h * t;
      var off = lean * t * t * s;
      bark.taper(x + off, yy, z + off * 0.4, 0.22 * s * (1 - t * 0.5), 0.22 * s * (1 - t * 0.5),
        0.20 * s * (1 - (t + 1 / segs) * 0.5), 0.20 * s * (1 - (t + 1 / segs) * 0.5), h / segs,
        lean * s / segs, lean * 0.4 * s / segs, 2.2);
    }
    var leaf = b.mb('leaves');
    leaf.setColorHex(0xb8d878);
    var tx = x + lean * s, tz = z + lean * 0.4 * s, ty = y + h;
    for (var f = 0; f < 7; f++) {
      var a = f / 7 * M.TAU;
      var dx = Math.sin(a), dz = Math.cos(a);
      leaf.quad([tx, ty, tz], [tx + dx * 1.9 * s - dz * 0.35 * s, ty - 0.85 * s, tz + dz * 1.9 * s + dx * 0.35 * s],
        [tx + dx * 2.1 * s, ty - 1.15 * s, tz + dz * 2.1 * s],
        [tx + dx * 1.9 * s + dz * 0.35 * s, ty - 0.85 * s, tz + dz * 1.9 * s - dx * 0.35 * s], 1);
    }
    if (b.col) b.col.add(C.cyl(x, y, z, 0.28 * s, h * 0.7, { surface: 'wood' }));
  };

  P.bush = function (b, x, y, z, o) {
    o = o || {};
    var s = o.scale || 1;
    var leaf = b.mb(o.mat || 'leaves');
    leaf.setColorHex(o.color === undefined ? 0xffffff : o.color);
    var seed = o.seed === undefined ? (x * 19 + z * 23) : o.seed;
    for (var i = 0; i < 3; i++) {
      var a = rnd(seed + i) * M.TAU;
      leaf.sphere(x + Math.sin(a) * 0.22 * s, y + 0.26 * s + rnd(seed + i * 5) * 0.16 * s,
        z + Math.cos(a) * 0.22 * s, (0.36 + rnd(seed + i * 3) * 0.14) * s, 6, 4, 0.8);
    }
  };

  P.grassTuft = function (b, x, y, z, o) {
    o = o || {};
    var s = o.scale || 1;
    var mb = b.mb(o.mat || 'grassblade');
    mb.setColorHex(o.color === undefined ? 0xffffff : o.color);
    mb.cross(x, y, z, 0.78 * s, 0.62 * s, o.planes || 2);
  };

  P.flowerPatch = function (b, x, y, z, o) {
    o = o || {};
    var mb = b.mb(o.mat || 'flowers');
    mb.setColorHex(0xffffff);
    mb.cross(x, y, z, 0.7 * (o.scale || 1), 0.32 * (o.scale || 1), 2);
  };

  P.cactus = function (b, x, y, z, o) {
    o = o || {};
    var s = o.scale || 1;
    var mb = b.mb('leavesDark');
    mb.setColorHex(0x8fbf6a);
    var h = (1.5 + rnd(x * 3 + z) * 0.9) * s;
    /* a saguaro: rounded top, slight swell at the middle, two raised arms */
    function trunk(ox, oz, base, len, r) {
      mb.tube([
        { x: ox, y: base, z: oz, r: r * 0.92 },
        { x: ox, y: base + len * 0.18, z: oz, r: r },
        { x: ox, y: base + len * 0.62, z: oz, r: r * 0.96 },
        { x: ox, y: base + len * 0.90, z: oz, r: r * 0.82 },
        { x: ox, y: base + len * 0.99, z: oz, r: r * 0.46 },
        { x: ox, y: base + len * 1.03, z: oz, r: r * 0.12 }
      ], 8, { v: 0.8, capStart: false });
    }
    function arm(side) {
      var ax = x + side * 0.40 * s, ay = y + h * 0.44, top = y + h * 0.86;
      mb.tube([
        { x: x + side * 0.13 * s, y: ay, z: z, r: 0.13 * s },
        { x: x + side * 0.34 * s, y: ay + 0.06 * s, z: z, r: 0.12 * s },
        { x: ax, y: ay + 0.26 * s, z: z, r: 0.12 * s },
        { x: ax, y: top - 0.16 * s, z: z, r: 0.11 * s },
        { x: ax, y: top, z: z, r: 0.06 * s },
        { x: ax, y: top + 0.05 * s, z: z, r: 0.015 * s }
      ], 7, { v: 0.8 });
    }
    trunk(x, z, y, h, 0.24 * s);
    arm(-1);
    if (rnd(x + z * 7) > 0.35) arm(1);
    if (b.col) b.col.add(C.cyl(x, y, z, 0.30 * s, h, { surface: 'wood', tag: 'cactus' }));
  };

  P.reeds = function (b, x, y, z, o) {
    o = o || {};
    var mb = b.mb('grassblade');
    mb.setColorHex(0x9ab868);
    mb.cross(x, y, z, 0.5, 1.05 * (o.scale || 1), 3);
  };

  P.mushroom = function (b, x, y, z, o) {
    o = o || {};
    var s = o.scale || 1;
    var stem = b.mb('planksPale');
    stem.setColorHex(0xe4dcc4);
    stem.cylinder(x, y, z, 0.10 * s, 0.09 * s, 0.34 * s, 6, false, 2);
    var cap = b.mb(o.mat || 'leaves');
    cap.setColorHex(o.color === undefined ? 0xc45048 : o.color);
    cap.cylinder(x, y + 0.30 * s, z, 0.34 * s, 0.04 * s, 0.22 * s, 7, true, 2);
  };

  /* ---------------- rock ---------------- */
  P.rock = function (b, x, y, z, o) {
    o = o || {};
    var s = o.scale || 1;
    var seed = o.seed === undefined ? (x * 37 + z * 11) : o.seed;
    var mb = b.mb(o.mat || 'rock');
    mb.setColorHex(o.color === undefined ? 0xffffff : o.color);
    var lumps = o.lumps || 2;
    for (var i = 0; i < lumps; i++) {
      var a = rnd(seed + i) * M.TAU;
      var d = i === 0 ? 0 : 0.3 * s;
      var r = (0.5 - i * 0.12 + rnd(seed + i * 3) * 0.2) * s;
      mb.sphere(x + Math.sin(a) * d, y + r * 0.55, z + Math.cos(a) * d, r, 6, 3, 0.72);
    }
    if (o.collide !== false && b.col) {
      b.col.add(C.cyl(x, y, z, 0.55 * s, 0.75 * s, { surface: 'stone' }));
    }
  };

  P.boulder = function (b, x, y, z, o) {
    o = o || {};
    var s = o.scale || 1;
    var mb = b.mb(o.mat || 'rock');
    mb.setColorHex(o.color === undefined ? 0xffffff : o.color);
    mb.sphere(x, y + 0.85 * s, z, 1.2 * s, 7, 4, 0.8);
    mb.sphere(x + 0.6 * s, y + 0.45 * s, z - 0.35 * s, 0.65 * s, 6, 3, 0.8);
    if (b.col) b.col.add(C.cyl(x, y, z, 1.25 * s, 1.7 * s, { surface: 'stone' }));
  };

  P.stalagmite = function (b, x, y, z, o) {
    o = o || {};
    var s = o.scale || 1;
    var mb = b.mb(o.mat || 'rockDark');
    mb.setColorHex(0xffffff);
    mb.cylinder(x, y, z, 0.4 * s, 0.02 * s, (1.3 + rnd(x + z) * 1.0) * s, 5, true, 1.2);
    if (b.col) b.col.add(C.cyl(x, y, z, 0.42 * s, 1.2 * s, {}));
  };

  /* A rock outcrop or desert butte. Built as a stack of swept rings with
     per-ring jitter and a flared skirt, not stacked boxes: a box mesa is the
     single most obvious "unfinished" shape a low-poly world can show. */
  P.cliff = function (b, x, y, z, w, h, d, o) {
    o = o || {};
    var mb = b.mb(o.mat || 'rock');
    mb.setColorHex(o.color === undefined ? 0xffffff : o.color);
    var yaw = o.yaw || 0;
    var m = LZ.M4.create();
    LZ.M4.compose(m, x, y, z, 0, yaw, 0, 1, 1, 1);
    mb.setMatrix(m);
    var sides = o.sides || 7;
    var layers = Math.max(3, o.layers || 4);
    var taper = o.taper === undefined ? 0.30 : o.taper;
    var rings = [];
    /* a skirt of scree where the rock meets the ground */
    rings.push({ x: 0, y: -0.15, z: 0, rx: w * 0.60, rz: d * 0.60 });
    for (var i = 0; i <= layers; i++) {
      var t = i / layers;
      /* ledges: each band steps in, and alternate bands step in harder, so
         the profile reads as bedding planes rather than a smooth cone */
      var step = t * taper + (i % 2 ? 0.05 : 0) * taper;
      var jx = (rnd(i * 3.1 + x) - 0.5) * w * 0.13;
      var jz = (rnd(i * 5.7 + z) - 0.5) * d * 0.13;
      var jr = 0.92 + rnd(i * 7.3 + x + z) * 0.18;
      rings.push({
        x: jx, y: h * t, z: jz,
        rx: w * 0.5 * (1 - step) * jr, rz: d * 0.5 * (1 - step) * jr
      });
    }
    /* the cap: a slightly domed top, so it never reads as a cut-off box */
    var top = rings[rings.length - 1];
    rings.push({ x: top.x, y: h * 1.03, z: top.z, rx: top.rx * 0.82, rz: top.rz * 0.82 });
    rings.push({ x: top.x, y: h * 1.08, z: top.z, rx: top.rx * 0.48, rz: top.rz * 0.48 });
    mb.tube(rings, sides, { v: 0.5, capStart: false });
    /* a boulder or two shed at the base */
    if (o.debris !== false) {
      for (var k = 0; k < 2; k++) {
        var a = rnd(k * 11 + x) * Math.PI * 2;
        var rr = (0.30 + rnd(k * 13 + z) * 0.22) * Math.min(w, d);
        mb.ovoid(Math.sin(a) * (w * 0.5 + rr * 0.5), rr * 0.5, Math.cos(a) * (d * 0.5 + rr * 0.5),
          rr * 0.7, rr * 0.55, rr * 0.7, 6, 4);
      }
    }
    mb.setMatrix(null);
    if (o.collide !== false && b.col) {
      b.col.add(C.box(x, y + h / 2, z, w / 2, h / 2, d / 2, { yaw: yaw, surface: 'stone' }));
    }
  };

  /* ---------------- structures ---------------- */
  /* a house: walls, roof, door recess, windows. Doors become triggers. */
  P.house = function (b, x, y, z, o) {
    o = o || {};
    var w = o.w || 5, d = o.d || 4.5, h = o.h || 2.9;
    var yaw = o.yaw || 0;
    var cs = Math.cos(yaw), sn = Math.sin(yaw);
    var wallMat = o.wall || 'plaster';
    var roofMat = o.roof || 'thatch';
    var trimMat = o.trim || 'planks';
    var m = LZ.M4.create();
    LZ.M4.compose(m, x, y, z, 0, yaw, 0, 1, 1, 1);

    var wall = b.mb(wallMat);
    wall.setColorHex(o.wallColor === undefined ? 0xffffff : o.wallColor);
    wall.setMatrix(m);
    /* four walls, leaving a doorway gap in the +Z face */
    var doorW = o.doorW || 1.1, doorH = o.doorH || 1.9;
    var hw = w / 2, hd = d / 2;
    var t = 0.16;
    /* back and sides */
    wall.box(0, h / 2, -hd + t / 2, w, h, t, 2.0);
    wall.box(-hw + t / 2, h / 2, 0, t, h, d, 2.0);
    wall.box(hw - t / 2, h / 2, 0, t, h, d, 2.0);
    /* front with door hole */
    var sideW = (w - doorW) / 2;
    wall.box(-(doorW / 2 + sideW / 2), h / 2, hd - t / 2, sideW, h, t, 2.0);
    wall.box((doorW / 2 + sideW / 2), h / 2, hd - t / 2, sideW, h, t, 2.0);
    wall.box(0, doorH + (h - doorH) / 2, hd - t / 2, doorW, h - doorH, t, 2.0);
    wall.setMatrix(null);

    var trim = b.mb(trimMat);
    trim.setColorHex(o.trimColor === undefined ? 0xffffff : o.trimColor);
    trim.setMatrix(m);
    /* corner posts and door frame */
    trim.box(-hw, h / 2, -hd, 0.22, h, 0.22, 2.4);
    trim.box(hw, h / 2, -hd, 0.22, h, 0.22, 2.4);
    trim.box(-hw, h / 2, hd, 0.22, h, 0.22, 2.4);
    trim.box(hw, h / 2, hd, 0.22, h, 0.22, 2.4);
    trim.box(-doorW / 2 - 0.07, doorH / 2, hd - 0.02, 0.14, doorH, 0.22, 2.4);
    trim.box(doorW / 2 + 0.07, doorH / 2, hd - 0.02, 0.14, doorH, 0.22, 2.4);
    trim.box(0, doorH + 0.07, hd - 0.02, doorW + 0.28, 0.14, 0.22, 2.4);
    /* a recessed door panel so the opening is not a black hole */
    trim.setColorHex(o.doorColor === undefined ? 0x6a4526 : o.doorColor);
    trim.box(0, doorH / 2, hd - 0.18, doorW - 0.06, doorH - 0.06, 0.10, 2.8);
    trim.setColorHex(0x3a2a18);
    trim.box(0, doorH / 2, hd - 0.09, doorW - 0.28, doorH - 0.30, 0.04, 2.8);
    trim.setColorHex(0xc8a850);
    trim.box(doorW * 0.30, doorH * 0.48, hd - 0.04, 0.09, 0.09, 0.06, 2.8);
    trim.setColorHex(o.trimColor === undefined ? 0xffffff : o.trimColor);
    /* Windows. A dark rectangle punched in a wall reads as a hole in the
       model, not a window: what sells it is the frame, a mullion cross, and
       an interior that is dim but warm rather than black. */
    if (o.windows !== false) {
      var wy = h * 0.62;
      var lit = o.windowLit === undefined ? 0xc8a468 : o.windowLit;
      for (var s2 = -1; s2 <= 1; s2 += 2) {
        var wxc = s2 * (hw * 0.55);
        /* Everything here stands proud of the wall plane at hd. Detail laid
           flush with a wall z-fights against it at any distance, which is
           what made the buildings flicker. */
        trim.box(wxc, wy, hd + 0.05, 0.78, 0.68, 0.12, 2.4);
        /* the room behind, set in front of the frame's face */
        trim.setColorHex(lit);
        trim.box(wxc, wy, hd + 0.12, 0.58, 0.48, 0.03, 2.4);
        /* mullions, proud of the pane */
        trim.setColorHex(o.trimColor === undefined ? 0x6a5236 : o.trimColor);
        trim.box(wxc, wy, hd + 0.15, 0.05, 0.50, 0.05, 2.4);
        trim.box(wxc, wy, hd + 0.15, 0.60, 0.05, 0.05, 2.4);
        /* sill, and a shutter hinged back against the wall */
        trim.box(wxc, wy - 0.38, hd + 0.10, 0.92, 0.08, 0.22, 2.4);
        trim.setColorHex(o.shutterColor === undefined ? 0x7a5a34 : o.shutterColor);
        trim.box(wxc + s2 * 0.54, wy, hd + 0.07, 0.18, 0.64, 0.09, 2.4);
        trim.setColorHex(o.trimColor === undefined ? 0xffffff : o.trimColor);
      }
    }
    trim.setMatrix(null);

    /* A doorstep and two porch posts. Buildings that meet the ground with
       nothing at the join read as boxes dropped on a field; a step and a
       lintel are what make a wall a house. */
    if (o.step !== false) {
      trim.setColorHex(o.stepColor === undefined ? 0xbdb3a0 : o.stepColor);
      trim.setMatrix(m);
      trim.box(0, 0.09, hd + 0.34, doorW + 0.9, 0.18, 0.78, 1.6);
      trim.box(0, 0.24, hd + 0.20, doorW + 0.6, 0.14, 0.50, 1.6);
      trim.setColorHex(o.trimColor === undefined ? 0xffffff : o.trimColor);
      /* porch posts either side of the door, carrying a small lintel */
      if (o.porch !== false) {
        var pyH = doorH + 0.55;
        for (var pp = -1; pp <= 1; pp += 2) {
          trim.tube([
            { x: pp * (doorW * 0.5 + 0.62), y: 0.14, z: hd + 0.56, r: 0.10 },
            { x: pp * (doorW * 0.5 + 0.62), y: pyH, z: hd + 0.56, r: 0.085 }
          ], 6, { u: 1, v: 3 });
        }
        trim.box(0, pyH + 0.08, hd + 0.42, doorW + 1.5, 0.16, 0.44, 2.2);
        trim.box(0, pyH + 0.22, hd + 0.28, doorW + 1.3, 0.12, 0.30, 2.2);
      }
      trim.setMatrix(null);
    }

    /* a chimney on one gable end, with a wisp of soot at the lip */
    if (o.chimney !== false && o.roofStyle !== 'flat') {
      var ch = b.mb('brick');
      ch.setColorHex(0xffffff);
      ch.setMatrix(m);
      var cxo = w * 0.28, czo = -d * 0.16;
      ch.tube([
        { x: cxo, y: h - 0.3, z: czo, rx: 0.30, rz: 0.26 },
        { x: cxo, y: h + (o.roofH || 1.5) + 0.5, z: czo, rx: 0.27, rz: 0.23 },
        { x: cxo, y: h + (o.roofH || 1.5) + 0.66, z: czo, rx: 0.32, rz: 0.28 }
      ], 4, { u: 2, v: 3, capStart: false });
      ch.setColorHex(0x2c2622);
      ch.box(cxo, h + (o.roofH || 1.5) + 0.70, czo, 0.34, 0.04, 0.30, 1.4);
      ch.setMatrix(null);
    }

    /* roof */
    var roof = b.mb(roofMat);
    roof.setColorHex(o.roofColor === undefined ? 0xffffff : o.roofColor);
    roof.setMatrix(m);
    var eaves = o.eaves === undefined ? 0.42 : o.eaves;
    var rh = o.roofH || 1.5;
    var rw = w / 2 + eaves, rd = d / 2 + eaves;
    if (o.roofStyle === 'flat') {
      /* A flat roof is not a slab on a box. What makes adobe read is the
         parapet standing proud of the deck, the sunk deck inside it, and a
         shadow course where the wall meets the roof. */
      var pw = w / 2 + eaves, pd = d / 2 + eaves;
      roof.tube([
        { y: h - 0.06, rx: pw, rz: pd },
        { y: h + 0.10, rx: pw, rz: pd },
        { y: h + 0.46, rx: pw * 0.985, rz: pd * 0.985 },
        { y: h + 0.52, rx: pw * 0.90, rz: pd * 0.90 }
      ], 4, { u: w * 0.5, v: 1.2, capStart: false, capEnd: false });
      /* the sunk deck, a shade darker so the parapet reads against it */
      roof.setColorHex(o.deckColor === undefined ? 0xb4ab98 : o.deckColor);
      roof.box(0, h + 0.20, 0, (w + eaves) * 0.90, 0.10, (d + eaves) * 0.90, 1.4);
      roof.setColorHex(o.roofColor === undefined ? 0xffffff : o.roofColor);
      /* projecting roof beams along the two long sides, as adobe has */
      roof.setColorHex(o.beamColor === undefined ? 0x8a7250 : o.beamColor);
      var nb = Math.max(3, Math.round(w / 1.3));
      for (var bi = 0; bi < nb; bi++) {
        var bx = -w / 2 + (bi + 0.5) * (w / nb);
        roof.tube([
          { x: bx, y: h - 0.02, z: pd - 0.02, r: 0.075 },
          { x: bx, y: h - 0.02, z: pd + 0.30, r: 0.065 }
        ], 5, { axis: 'z', u: 1, v: 2 });
      }
      roof.setColorHex(o.roofColor === undefined ? 0xffffff : o.roofColor);
    } else if (o.roofStyle === 'hip') {
      roof.taper(0, h, 0, rw * 2, rd * 2, rw * 0.5, rd * 0.5, rh, 0, 0, 1.4);
    } else {
      /* gabled: two sloped quads plus triangular gable ends */
      var apex = h + rh;
      roof.quad([-rw, h, rd], [rw, h, rd], [rw, apex, 0], [-rw, apex, 0], [w * 0.6, rh * 1.2]);
      roof.quad([rw, h, -rd], [-rw, h, -rd], [-rw, apex, 0], [rw, apex, 0], [w * 0.6, rh * 1.2]);
      roof.setMatrix(m);
      var gm = b.mb(wallMat);
      gm.setColorHex(o.wallColor === undefined ? 0xffffff : o.wallColor);
      gm.setMatrix(m);
      for (var g = -1; g <= 1; g += 2) {
        var gz = g * (d / 2 - 0.02);
        var a = gm.vert(-w / 2, h, gz, 0, 0, g, 0, 1);
        var bb = gm.vert(w / 2, h, gz, 0, 0, g, 2, 1);
        var cc = gm.vert(0, apex, gz, 0, 0, g, 1, 0);
        if (g > 0) gm.tri(a, bb, cc); else gm.tri(bb, a, cc);
      }
      gm.setMatrix(null);
    }
    roof.setMatrix(null);

    if (b.col) {
      /* solid shell with a walk-through doorway */
      var pushX = function (lx, lz) { return [x + lx * cs + lz * sn, z + lx * -sn + lz * cs]; };
      var back = pushX(0, -hd + t / 2);
      b.col.add(C.box(back[0], y + h / 2, back[1], w / 2, h / 2, t / 2, { yaw: yaw }));
      var left = pushX(-hw + t / 2, 0);
      b.col.add(C.box(left[0], y + h / 2, left[1], t / 2, h / 2, d / 2, { yaw: yaw }));
      var right = pushX(hw - t / 2, 0);
      b.col.add(C.box(right[0], y + h / 2, right[1], t / 2, h / 2, d / 2, { yaw: yaw }));
      var fl = pushX(-(doorW / 2 + sideW / 2), hd - t / 2);
      b.col.add(C.box(fl[0], y + h / 2, fl[1], sideW / 2, h / 2, t / 2, { yaw: yaw }));
      var fr = pushX((doorW / 2 + sideW / 2), hd - t / 2);
      b.col.add(C.box(fr[0], y + h / 2, fr[1], sideW / 2, h / 2, t / 2, { yaw: yaw }));
    }
    /* world-space door position, for placing the transition trigger */
    return {
      doorX: x + (0) * cs + (hd + 0.35) * sn,
      doorZ: z + (0) * -sn + (hd + 0.35) * cs,
      doorYaw: yaw
    };
  };

  P.fencePost = function (b, x, y, z, o) {
    o = o || {};
    var mb = b.mb(o.mat || 'planksDark');
    mb.setColorHex(o.color === undefined ? 0xffffff : o.color);
    mb.box(x, y + 0.55, z, 0.14, 1.1, 0.14, 2.4);
    if (b.col) b.col.add(C.cyl(x, y, z, 0.14, 1.0, { surface: 'wood' }));
  };

  P.fence = function (b, x0, z0, x1, z1, y, o) {
    o = o || {};
    var mb = b.mb(o.mat || 'planksDark');
    mb.setColorHex(o.color === undefined ? 0xffffff : o.color);
    var dx = x1 - x0, dz = z1 - z0;
    var len = Math.sqrt(dx * dx + dz * dz);
    var n = Math.max(1, Math.round(len / (o.spacing || 2.0)));
    var yaw = Math.atan2(dx, dz);
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      P.fencePost(b, x0 + dx * t, y, z0 + dz * t, o);
    }
    /* rails */
    var m = LZ.M4.create();
    LZ.M4.compose(m, (x0 + x1) / 2, y, (z0 + z1) / 2, 0, yaw, 0, 1, 1, 1);
    mb.setMatrix(m);
    mb.box(0, 0.82, 0, 0.07, 0.1, len, 2.0);
    mb.box(0, 0.44, 0, 0.07, 0.1, len, 2.0);
    mb.setMatrix(null);
    if (b.col && o.solid !== false) {
      b.col.add(C.box((x0 + x1) / 2, y + 0.5, (z0 + z1) / 2, 0.12, 0.5, len / 2, { yaw: yaw, surface: 'wood' }));
    }
  };

  P.sign = function (b, x, y, z, o) {
    o = o || {};
    var yaw = o.yaw || 0;
    var mb = b.mb('planks');
    mb.setColorHex(o.color === undefined ? 0xffffff : o.color);
    var m = LZ.M4.create();
    LZ.M4.compose(m, x, y, z, 0, yaw, 0, 1, 1, 1);
    mb.setMatrix(m);
    mb.box(0, 0.45, 0, 0.12, 0.9, 0.12, 2.4);
    mb.box(0, 1.02, 0.02, 0.95, 0.62, 0.09, 2.0);
    mb.setColorHex(0x6a4a28);
    mb.box(0, 1.02, 0.075, 0.80, 0.46, 0.02, 2.0);
    mb.setMatrix(null);
    if (b.col) b.col.add(C.cyl(x, y, z, 0.24, 1.3, { surface: 'wood', tag: 'sign', ref: o.ref || null }));
  };

  P.well = function (b, x, y, z, o) {
    o = o || {};
    var mb = b.mb('stoneblock');
    mb.setColorHex(0xffffff);
    mb.cylinder(x, y, z, 1.0, 1.0, 0.85, 9, false, 1.2);
    mb.cylinder(x, y + 0.85, z, 1.02, 0.92, 0.12, 9, true, 1.2);
    var wood = b.mb('planksDark');
    wood.setColorHex(0xffffff);
    wood.box(x - 0.85, y + 1.5, z, 0.14, 1.9, 0.14, 2.0);
    wood.box(x + 0.85, y + 1.5, z, 0.14, 1.9, 0.14, 2.0);
    var roof = b.mb('shingleGrey');
    roof.setColorHex(0xffffff);
    roof.taper(x, y + 2.35, z, 2.5, 1.9, 0.2, 0.2, 0.7, 0, 0, 1.2);
    if (b.col) b.col.add(C.cyl(x, y, z, 1.05, 0.95, { surface: 'stone' }));
  };

  P.crate = function (b, x, y, z, o) {
    o = o || {};
    var s = o.scale || 1;
    var mb = b.mb('planks');
    mb.setColorHex(o.color === undefined ? 0xd8c8a8 : o.color);
    mb.box(x, y + 0.35 * s, z, 0.7 * s, 0.7 * s, 0.7 * s, 1.6);
    if (b.col) b.col.add(C.box(x, y + 0.35 * s, z, 0.35 * s, 0.35 * s, 0.35 * s, { surface: 'wood' }));
  };

  P.barrel = function (b, x, y, z, o) {
    o = o || {};
    var s = o.scale || 1;
    var mb = b.mb('planksDark');
    mb.setColorHex(0xffffff);
    mb.cylinder(x, y, z, 0.30 * s, 0.30 * s, 0.82 * s, 8, true, 1.6);
    mb.setColorHex(0x8a8a92);
    mb.cylinder(x, y + 0.16 * s, z, 0.32 * s, 0.32 * s, 0.07 * s, 8, false, 1.6);
    mb.cylinder(x, y + 0.60 * s, z, 0.32 * s, 0.32 * s, 0.07 * s, 8, false, 1.6);
    if (b.col) b.col.add(C.cyl(x, y, z, 0.33 * s, 0.82 * s, { surface: 'wood' }));
  };

  P.table = function (b, x, y, z, o) {
    o = o || {};
    var mb = b.mb('planks');
    mb.setColorHex(0xffffff);
    var w = o.w || 1.5, d = o.d || 0.9, h = o.h || 0.78;
    mb.box(x, y + h, z, w, 0.10, d, 1.6);
    for (var i = 0; i < 4; i++) {
      var sx = (i % 2 ? 1 : -1) * (w / 2 - 0.12);
      var sz = (i < 2 ? 1 : -1) * (d / 2 - 0.12);
      mb.box(x + sx, y + h / 2, z + sz, 0.10, h, 0.10, 2.0);
    }
    if (b.col) b.col.add(C.box(x, y + h / 2, z, w / 2, h / 2, d / 2, { surface: 'wood' }));
  };

  P.chair = function (b, x, y, z, o) {
    o = o || {};
    var mb = b.mb('planksDark');
    mb.setColorHex(0xffffff);
    var yaw = o.yaw || 0;
    var m = LZ.M4.create();
    LZ.M4.compose(m, x, y, z, 0, yaw, 0, 1, 1, 1);
    mb.setMatrix(m);
    mb.box(0, 0.45, 0, 0.46, 0.07, 0.46, 2.0);
    mb.box(0, 0.72, -0.20, 0.46, 0.48, 0.07, 2.0);
    for (var i = 0; i < 4; i++) {
      mb.box((i % 2 ? 1 : -1) * 0.18, 0.22, (i < 2 ? 1 : -1) * 0.18, 0.07, 0.45, 0.07, 2.0);
    }
    mb.setMatrix(null);
    if (b.col) b.col.add(C.cyl(x, y, z, 0.30, 0.5, { surface: 'wood' }));
  };

  P.bed = function (b, x, y, z, o) {
    o = o || {};
    var yaw = o.yaw || 0;
    var m = LZ.M4.create();
    LZ.M4.compose(m, x, y, z, 0, yaw, 0, 1, 1, 1);
    var frame = b.mb('planksDark');
    frame.setColorHex(0xffffff);
    frame.setMatrix(m);
    frame.box(0, 0.26, 0, 1.15, 0.16, 2.15, 1.4);
    frame.box(0, 0.62, -1.02, 1.15, 0.75, 0.12, 1.4);
    frame.box(0, 0.42, 1.02, 1.15, 0.35, 0.12, 1.4);
    frame.setMatrix(null);
    var cloth = b.mb(o.sheet || 'clothWhite');
    cloth.setColorHex(o.sheetColor === undefined ? 0xffffff : o.sheetColor);
    cloth.setMatrix(m);
    cloth.box(0, 0.42, 0.10, 1.10, 0.18, 1.85, 1.4);
    cloth.setColorHex(0xf0ece0);
    cloth.box(0, 0.56, -0.78, 0.80, 0.16, 0.42, 1.4);
    cloth.setMatrix(null);
    if (b.col) b.col.add(C.box(x, y + 0.26, z, 0.6, 0.26, 1.1, { yaw: yaw, surface: 'wood' }));
  };

  P.stall = function (b, x, y, z, o) {
    o = o || {};
    var yaw = o.yaw || 0;
    var m = LZ.M4.create();
    LZ.M4.compose(m, x, y, z, 0, yaw, 0, 1, 1, 1);
    var wood = b.mb('planks');
    wood.setColorHex(0xffffff);
    wood.setMatrix(m);
    wood.box(0, 0.9, 0, 2.4, 0.12, 0.9, 1.6);
    wood.box(-1.1, 0.45, 0, 0.12, 0.9, 0.8, 2.0);
    wood.box(1.1, 0.45, 0, 0.12, 0.9, 0.8, 2.0);
    wood.box(-1.15, 1.4, -0.4, 0.10, 1.9, 0.10, 2.0);
    wood.box(1.15, 1.4, -0.4, 0.10, 1.9, 0.10, 2.0);
    wood.setMatrix(null);
    var awn = b.mb(o.awning || 'clothRed');
    awn.setColorHex(o.awningColor === undefined ? 0xffffff : o.awningColor);
    awn.setMatrix(m);
    awn.quad([-1.35, 2.35, -0.45], [1.35, 2.35, -0.45], [1.35, 1.75, 0.85], [-1.35, 1.75, 0.85], [3, 1.6]);
    awn.setMatrix(null);
    if (b.col) b.col.add(C.box(x, y + 0.5, z, 1.25, 0.5, 0.45, { yaw: yaw, surface: 'wood' }));
  };

  /* ------------------------------------------------------------------ */
  /* Town dressing                                                       */
  /*                                                                     */
  /* The gap between this and the games it is imitating was never one big
     thing -- it was that a Clock Town screen holds thirty objects and ours
     held four. These are the cheap ones that fill a street: things people
     put down and did not pick up.                                         */
  /* ------------------------------------------------------------------ */

  /* a slumped grain sack */
  P.sack = function (b, x, y, z, o) {
    o = o || {};
    var s = o.scale || 1;
    var mb = b.mb(o.mat || 'clothTan');
    mb.setColorHex(o.color === undefined ? 0xd8c49c : o.color);
    var yaw = o.yaw || 0;
    var m = LZ.M4.create();
    LZ.M4.compose(m, x, y, z, 0, yaw, 0, 1, 1, 1);
    mb.setMatrix(m);
    mb.tube([
      { y: 0.00, rx: 0.30 * s, rz: 0.26 * s },
      { y: 0.16 * s, rx: 0.33 * s, rz: 0.29 * s },
      { y: 0.42 * s, rx: 0.30 * s, rz: 0.26 * s },
      { y: 0.58 * s, rx: 0.18 * s, rz: 0.16 * s },
      { y: 0.64 * s, rx: 0.10 * s, rz: 0.09 * s }
    ], 8, { u: 1, v: 1.6, capStart: false });
    /* the tie at the neck */
    mb.setColorHex(0x8a6a40);
    mb.tube([
      { y: 0.56 * s, rx: 0.13 * s, rz: 0.12 * s },
      { y: 0.61 * s, rx: 0.13 * s, rz: 0.12 * s }
    ], 8, { u: 1, v: 1, capStart: false, capEnd: false });
    mb.setMatrix(null);
    if (b.col) b.col.add(C.cyl(x, y, z, 0.32 * s, 0.6 * s, { surface: 'wood' }));
  };

  /* a stack of split logs against a wall */
  P.woodpile = function (b, x, y, z, o) {
    o = o || {};
    var s = o.scale || 1;
    var yaw = o.yaw || 0;
    var mb = b.mb('planksDark');
    var m = LZ.M4.create();
    LZ.M4.compose(m, x, y, z, 0, yaw, 0, 1, 1, 1);
    mb.setMatrix(m);
    var rows = 3, per = 4;
    for (var r = 0; r < rows; r++) {
      var n = per - r;
      for (var i = 0; i < n; i++) {
        mb.setColorHex(i % 2 ? 0xc2a074 : 0xa8865c);
        var lx = (i - (n - 1) / 2) * 0.24 * s;
        mb.tube([
          { x: lx, y: (0.12 + r * 0.22) * s, z: -0.55 * s, r: 0.115 * s },
          { x: lx, y: (0.12 + r * 0.22) * s, z: 0.55 * s, r: 0.115 * s }
        ], 6, { axis: 'z', u: 1, v: 2 });
      }
    }
    mb.setMatrix(null);
    if (b.col) b.col.add(C.box(x, y + 0.32 * s, z, 0.5 * s, 0.34 * s, 0.58 * s, { yaw: yaw, surface: 'wood' }));
  };

  /* a planter box of flowers under a window */
  P.planter = function (b, x, y, z, o) {
    o = o || {};
    var s = o.scale || 1;
    var yaw = o.yaw || 0;
    var mb = b.mb('planksDark');
    mb.setColorHex(0xb08a58);
    var m = LZ.M4.create();
    LZ.M4.compose(m, x, y, z, 0, yaw, 0, 1, 1, 1);
    mb.setMatrix(m);
    mb.tube([
      { y: 0, rx: 0.55 * s, rz: 0.22 * s },
      { y: 0.26 * s, rx: 0.58 * s, rz: 0.24 * s }
    ], 4, { u: 2, v: 1 });
    mb.setColorHex(0x6a4e2c);
    mb.box(0, 0.27 * s, 0, 0.98 * s, 0.04 * s, 0.36 * s, 1.4);
    mb.setMatrix(null);
    var lm = b.mb('leaves');
    lm.setColorHex(0xffffff);
    lm.setMatrix(m);
    for (var i = 0; i < 5; i++) {
      var px = (-0.4 + i * 0.2) * s;
      lm.ovoid(px, 0.36 * s, (rnd(i + x) - 0.5) * 0.12 * s, 0.15 * s, 0.13 * s, 0.13 * s, 6, 4);
    }
    lm.setMatrix(null);
    var fm = b.mb('petalRed');
    fm.setColorHex(o.bloom === undefined ? 0xffffff : o.bloom);
    fm.setMatrix(m);
    for (var f = 0; f < 4; f++) {
      fm.ovoid((-0.32 + f * 0.22) * s, 0.46 * s, 0, 0.07 * s, 0.05 * s, 0.07 * s, 5, 4);
    }
    fm.setMatrix(null);
  };

  /* a shop sign hanging from a bracket over a door */
  P.hangingSign = function (b, x, y, z, o) {
    o = o || {};
    var s = o.scale || 1;
    var yaw = o.yaw || 0;
    var m = LZ.M4.create();
    LZ.M4.compose(m, x, y, z, 0, yaw, 0, 1, 1, 1);
    var mb = b.mb('metal');
    mb.setColorHex(0x8a8f98);
    mb.setMatrix(m);
    /* bracket: out from the wall, then a short drop */
    mb.tube([{ z: 0, y: 0, r: 0.035 * s }, { z: 0.62 * s, y: 0, r: 0.030 * s }], 5, { axis: 'z' });
    mb.tube([{ z: 0.18 * s, y: 0, r: 0.022 * s }, { z: 0.56 * s, y: -0.24 * s, r: 0.020 * s }], 4);
    mb.tube([{ z: 0.56 * s, y: 0, r: 0.016 * s }, { z: 0.56 * s, y: -0.16 * s, r: 0.016 * s }], 4);
    mb.setMatrix(null);
    var pm = b.mb(o.mat || 'planks');
    pm.setColorHex(o.color === undefined ? 0xd8b878 : o.color);
    pm.setMatrix(m);
    pm.box(0, -0.44 * s, 0.56 * s, 0.72 * s, 0.44 * s, 0.06 * s, 1.6);
    pm.setColorHex(0x5a4028);
    pm.box(0, -0.44 * s, 0.60 * s, 0.50 * s, 0.22 * s, 0.02 * s, 1.6);
    pm.setMatrix(null);
  };

  /* a line of washing strung between two poles */
  P.laundry = function (b, x, y, z, len, o) {
    o = o || {};
    var yaw = o.yaw || 0;
    var m = LZ.M4.create();
    LZ.M4.compose(m, x, y, z, 0, yaw, 0, 1, 1, 1);
    var wm = b.mb('planksDark');
    wm.setColorHex(0xa88a5c);
    wm.setMatrix(m);
    var h = o.h || 2.0;
    for (var e = -1; e <= 1; e += 2) {
      wm.tube([{ x: e * len / 2, y: 0, z: 0, r: 0.07 },
               { x: e * len / 2, y: h, z: 0, r: 0.05 }], 5, { u: 1, v: 2 });
    }
    /* the rope, sagging */
    wm.setColorHex(0xd8cbb0);
    var segs = 6;
    for (var i = 0; i < segs; i++) {
      var t0 = i / segs, t1 = (i + 1) / segs;
      function sag(t) { return h - 0.16 * Math.sin(t * Math.PI); }
      wm.tube([
        { x: (-0.5 + t0) * len, y: sag(t0), z: 0, r: 0.018 },
        { x: (-0.5 + t1) * len, y: sag(t1), z: 0, r: 0.018 }
      ], 4, { axis: 'x' });
    }
    wm.setMatrix(null);
    var cols = o.colors || ['clothWhite', 'clothBlue', 'clothRed'];
    for (var g = 0; g < 4; g++) {
      var cm = b.mb(cols[g % cols.length]);
      cm.setColorHex(0xffffff);
      cm.setMatrix(m);
      var gx = (-0.34 + g * 0.22) * len;
      var gh = 0.5 + rnd(g + x) * 0.32;
      cm.ribbon([
        { x: gx, y: h - 0.14, z: 0, w: 0.20 },
        { x: gx, y: h - 0.14 - gh * 0.5, z: 0.03, w: 0.26 },
        { x: gx, y: h - 0.14 - gh, z: 0.01, w: 0.22 }
      ], [1, 0, 0], { v: 1.4 });
      cm.setMatrix(null);
    }
    if (b.col) {
      b.col.add(C.cyl(x - Math.cos(yaw) * len / 2, y, z + Math.sin(yaw) * len / 2, 0.12, h, { surface: 'wood' }));
      b.col.add(C.cyl(x + Math.cos(yaw) * len / 2, y, z - Math.sin(yaw) * len / 2, 0.12, h, { surface: 'wood' }));
    }
  };

  /* a hand cart, tipped on its shafts */
  P.cart = function (b, x, y, z, o) {
    o = o || {};
    var s = o.scale || 1;
    var yaw = o.yaw || 0;
    var m = LZ.M4.create();
    LZ.M4.compose(m, x, y, z, 0, yaw, 0, 1, 1, 1);
    var mb = b.mb('planks');
    mb.setColorHex(0xc4a274);
    mb.setMatrix(m);
    mb.box(0, 0.62 * s, 0, 1.5 * s, 0.10 * s, 0.9 * s, 1.6);
    mb.box(0, 0.82 * s, -0.45 * s, 1.5 * s, 0.40 * s, 0.08 * s, 1.6);
    mb.box(0, 0.82 * s, 0.45 * s, 1.5 * s, 0.40 * s, 0.08 * s, 1.6);
    mb.box(-0.75 * s, 0.82 * s, 0, 0.08 * s, 0.40 * s, 0.9 * s, 1.6);
    /* shafts down to the ground */
    mb.setColorHex(0xa8865c);
    for (var e = -1; e <= 1; e += 2) {
      mb.tube([
        { x: e * 0.32 * s, y: 0.60 * s, z: 0.45 * s, r: 0.055 * s },
        { x: e * 0.32 * s, y: 0.10 * s, z: 1.35 * s, r: 0.045 * s }
      ], 5);
    }
    mb.setMatrix(null);
    var wm = b.mb('planksDark');
    wm.setColorHex(0x8a6a44);
    wm.setMatrix(m);
    for (var w2 = -1; w2 <= 1; w2 += 2) {
      wm.tube([
        { x: w2 * 0.80 * s, y: 0.42 * s, z: 0, ry: 0.42 * s, rz: 0.42 * s },
        { x: w2 * 0.90 * s, y: 0.42 * s, z: 0, ry: 0.42 * s, rz: 0.42 * s }
      ], 9, { axis: 'x', u: 2, v: 1 });
      wm.setColorHex(0x6a4e2c);
      for (var sp = 0; sp < 4; sp++) {
        var a2 = sp / 4 * Math.PI;
        wm.tube([
          { x: w2 * 0.86 * s, y: 0.42 * s + Math.sin(a2) * 0.38 * s, z: Math.cos(a2) * 0.38 * s, r: 0.035 * s },
          { x: w2 * 0.86 * s, y: 0.42 * s - Math.sin(a2) * 0.38 * s, z: -Math.cos(a2) * 0.38 * s, r: 0.035 * s }
        ], 4, { axis: 'x' });
      }
      wm.setColorHex(0x8a6a44);
    }
    wm.setMatrix(null);
    if (b.col) b.col.add(C.box(x, y + 0.6 * s, z, 0.9 * s, 0.5 * s, 0.55 * s, { yaw: yaw, surface: 'wood' }));
  };

  P.bridge = function (b, x, y, z, len, o) {
    o = o || {};
    var yaw = o.yaw || 0;
    var m = LZ.M4.create();
    LZ.M4.compose(m, x, y, z, 0, yaw, 0, 1, 1, 1);
    var mb = b.mb('planks');
    mb.setColorHex(0xffffff);
    mb.setMatrix(m);
    var w = o.w || 2.6;
    mb.box(0, 0, 0, w, 0.18, len, 2.2);
    for (var i = -1; i <= 1; i += 2) {
      mb.box(i * (w / 2 - 0.08), 0.55, 0, 0.10, 0.95, len, 2.0);
    }
    mb.setMatrix(null);
    if (b.col) {
      b.col.add(C.box(x, y - 0.09, z, w / 2, 0.09, len / 2, { yaw: yaw, surface: 'wood' }));
      for (var s = -1; s <= 1; s += 2) {
        var ox = s * (w / 2 - 0.08);
        var wx = x + ox * Math.cos(yaw), wz = z + ox * -Math.sin(yaw);
        b.col.add(C.box(wx, y + 0.55, wz, 0.08, 0.5, len / 2, { yaw: yaw, surface: 'wood' }));
      }
    }
  };

  P.stairs = function (b, x, y, z, w, rise, run, steps, o) {
    o = o || {};
    var yaw = o.yaw || 0;
    var mb = b.mb(o.mat || 'stoneblock');
    mb.setColorHex(o.color === undefined ? 0xffffff : o.color);
    var m = LZ.M4.create();
    LZ.M4.compose(m, x, y, z, 0, yaw, 0, 1, 1, 1);
    mb.setMatrix(m);
    for (var i = 0; i < steps; i++) {
      mb.box(0, rise * (i + 0.5), -run * (i + 0.5), w, rise, run, 1.6);
    }
    mb.setMatrix(null);
    if (b.col) {
      for (var j = 0; j < steps; j++) {
        var lz = -run * (j + 0.5);
        var wx = x + lz * Math.sin(yaw), wz = z + lz * Math.cos(yaw);
        b.col.add(C.box(wx, y + rise * (j + 0.5), wz, w / 2, rise * (j + 1) / 2 + rise / 2, run / 2,
          { yaw: yaw, surface: o.surface || 'stone' }));
      }
    }
  };

  P.pillar = function (b, x, y, z, h, o) {
    o = o || {};
    var r = o.r || 0.42;
    var mb = b.mb(o.mat || 'stoneblock');
    mb.setColorHex(o.color === undefined ? 0xffffff : o.color);
    mb.cylinder(x, y, z, r * 1.25, r * 1.25, 0.22, 8, true, 1.4);
    mb.cylinder(x, y + 0.22, z, r, r * 0.92, h - 0.5, 8, false, 1.4);
    mb.cylinder(x, y + h - 0.28, z, r * 1.3, r * 1.3, 0.28, 8, true, 1.4);
    if (b.col) b.col.add(C.cyl(x, y, z, r * 1.2, h, { surface: 'stone' }));
  };

  P.arch = function (b, x, y, z, w, h, o) {
    o = o || {};
    var yaw = o.yaw || 0;
    var mb = b.mb(o.mat || 'stoneblock');
    mb.setColorHex(0xffffff);
    var m = LZ.M4.create();
    LZ.M4.compose(m, x, y, z, 0, yaw, 0, 1, 1, 1);
    mb.setMatrix(m);
    mb.box(-w / 2 - 0.25, h / 2, 0, 0.5, h, 0.6, 1.4);
    mb.box(w / 2 + 0.25, h / 2, 0, 0.5, h, 0.6, 1.4);
    mb.box(0, h + 0.25, 0, w + 1.0, 0.5, 0.6, 1.4);
    mb.setMatrix(null);
    if (b.col) {
      var lx = -w / 2 - 0.25, rx = w / 2 + 0.25;
      b.col.add(C.box(x + lx * Math.cos(yaw), y + h / 2, z + lx * -Math.sin(yaw), 0.25, h / 2, 0.3, { yaw: yaw }));
      b.col.add(C.box(x + rx * Math.cos(yaw), y + h / 2, z + rx * -Math.sin(yaw), 0.25, h / 2, 0.3, { yaw: yaw }));
    }
  };

  P.gravestone = function (b, x, y, z, o) {
    o = o || {};
    var yaw = o.yaw || 0;
    var mb = b.mb('stoneblockDark');
    mb.setColorHex(o.color === undefined ? 0xffffff : o.color);
    var m = LZ.M4.create();
    LZ.M4.compose(m, x, y, z, 0, yaw, 0, 1, 1, 1);
    mb.setMatrix(m);
    if (o.style === 'cross') {
      mb.tube([
        { y: 0, rx: 0.16, rz: 0.15 }, { y: 0.9, rx: 0.11, rz: 0.10 },
        { y: 1.52, rx: 0.10, rz: 0.09 }
      ], 6, { v: 0.8 });
      mb.tube([
        { x: -0.38, y: 1.12, ry: 0.10, rz: 0.09 },
        { x: 0.38, y: 1.12, ry: 0.10, rz: 0.09 }
      ], 6, { axis: 'x' });
    } else {
      /* a rounded headstone: the slab is a swept slot with a domed top and a
         plinth, so it leans and weathers instead of reading as a grey box */
      mb.tube([
        { y: 0.02, rx: 0.40, rz: 0.15 },
        { y: 0.30, rx: 0.36, rz: 0.13 },
        { y: 0.72, rx: 0.35, rz: 0.12 },
        { y: 1.00, rx: 0.33, rz: 0.12 },
        { y: 1.18, rx: 0.26, rz: 0.10 },
        { y: 1.30, rx: 0.12, rz: 0.05 }
      ], 9, { v: 0.7, capStart: false });
      /* an incised panel, and the plinth it stands on */
      mb.setColorHex(0x6a6a76);
      mb.tube([
        { z: 0.06, y: 0.72, rx: 0.22, ry: 0.30 },
        { z: 0.13, y: 0.72, rx: 0.20, ry: 0.28 }
      ], 8, { axis: 'z', capStart: false });
      mb.setColorHex(o.color === undefined ? 0xffffff : o.color);
      mb.tube([
        { y: -0.04, rx: 0.56, rz: 0.30 },
        { y: 0.13, rx: 0.50, rz: 0.26 },
        { y: 0.20, rx: 0.44, rz: 0.22 }
      ], 9, { v: 0.8, capStart: false });
    }
    mb.setMatrix(null);
    if (b.col) b.col.add(C.box(x, y + 0.55, z, 0.36, 0.6, 0.16, { yaw: yaw, tag: o.tag || null, ref: o.ref || null }));
  };


  P.statue = function (b, x, y, z, o) {
    o = o || {};
    var yaw = o.yaw || 0;
    var mb = b.mb(o.mat || 'stoneblock');
    mb.setColorHex(o.color === undefined ? 0xffffff : o.color);
    var m = LZ.M4.create();
    LZ.M4.compose(m, x, y, z, 0, yaw, 0, o.scale || 1, o.scale || 1, o.scale || 1);
    mb.setMatrix(m);
    mb.box(0, 0.22, 0, 1.4, 0.44, 1.4, 1.2);
    mb.box(0, 0.55, 0, 1.05, 0.24, 1.05, 1.2);
    /* a stylised armoured figure */
    mb.taper(0, 0.66, 0, 0.62, 0.42, 0.74, 0.46, 0.85, 0, 0, 1.4);
    mb.box(0, 1.72, 0, 0.42, 0.42, 0.40, 1.6);
    mb.taper(-0.44, 0.86, 0, 0.24, 0.24, 0.18, 0.18, 0.62, 0.06, 0, 1.6);
    mb.taper(0.44, 0.86, 0, 0.24, 0.24, 0.18, 0.18, 0.62, -0.06, 0, 1.6);
    mb.box(0, 2.02, 0, 0.5, 0.24, 0.46, 1.6);
    mb.setMatrix(null);
    if (b.col) b.col.add(C.box(x, y + 1.1, z, 0.7 * (o.scale || 1), 1.1 * (o.scale || 1), 0.7 * (o.scale || 1),
      { yaw: yaw, tag: o.tag || null, ref: o.ref || null, pushable: o.pushable }));
  };

  P.brazier = function (b, x, y, z, o) {
    o = o || {};
    var mb = b.mb('metalRust');
    mb.setColorHex(0xffffff);
    mb.cylinder(x, y, z, 0.16, 0.10, 0.72, 6, false, 1.6);
    mb.cylinder(x, y + 0.72, z, 0.34, 0.42, 0.30, 8, true, 1.6);
    if (b.col) b.col.add(C.cyl(x, y, z, 0.36, 1.0, {}));
  };

  P.torchPost = function (b, x, y, z, o) {
    o = o || {};
    var mb = b.mb('planksDark');
    mb.setColorHex(0xffffff);
    mb.cylinder(x, y, z, 0.09, 0.07, (o.h || 1.9), 5, false, 2.0);
    if (b.col) b.col.add(C.cyl(x, y, z, 0.13, o.h || 1.9, {}));
  };

  P.lampPost = function (b, x, y, z, o) {
    o = o || {};
    var h = o.h || 2.7;
    var mb = b.mb('metal');
    mb.setColorHex(0x8e9099);
    /* a footed post with a swell at the base, not a grey stick */
    mb.tube([
      { x: x, y: y, z: z, r: 0.20 },
      { x: x, y: y + 0.14, z: z, r: 0.17 },
      { x: x, y: y + 0.30, z: z, r: 0.105 },
      { x: x, y: y + h * 0.6, z: z, r: 0.075 },
      { x: x, y: y + h, z: z, r: 0.065 }
    ], 6, { u: 1, v: 3, capStart: false });
    /* the lantern cage: four corner bars and a cap */
    mb.setColorHex(0x6e7078);
    for (var c = 0; c < 4; c++) {
      var a2 = c / 4 * M.TAU + Math.PI / 4;
      mb.tube([
        { x: x + Math.sin(a2) * 0.19, y: y + h + 0.04, z: z + Math.cos(a2) * 0.19, r: 0.028 },
        { x: x + Math.sin(a2) * 0.19, y: y + h + 0.46, z: z + Math.cos(a2) * 0.19, r: 0.028 }
      ], 4);
    }
    mb.tube([
      { x: x, y: y + h + 0.02, z: z, r: 0.26 },
      { x: x, y: y + h + 0.08, z: z, r: 0.22 }
    ], 8, { u: 1, v: 1 });
    mb.tube([
      { x: x, y: y + h + 0.46, z: z, r: 0.30 },
      { x: x, y: y + h + 0.62, z: z, r: 0.16 },
      { x: x, y: y + h + 0.72, z: z, r: 0.02 }
    ], 8, { u: 1, v: 1, capStart: false });
    /* the flame inside, self-lit so it reads at dusk */
    var glass = b.mb('glow');
    glass.setColorHex(o.lightColor === undefined ? 0xffd88a : o.lightColor);
    glass.ovoid(x, y + h + 0.25, z, 0.14, 0.19, 0.14, 7, 5);
    if (b.col) b.col.add(C.cyl(x, y, z, 0.16, h, {}));
  };

  P.banner = function (b, x, y, z, o) {
    o = o || {};
    var yaw = o.yaw || 0;
    var mb = b.mb(o.mat || 'clothRed');
    mb.setColorHex(o.color === undefined ? 0xffffff : o.color);
    var m = LZ.M4.create();
    LZ.M4.compose(m, x, y, z, 0, yaw, 0, 1, 1, 1);
    mb.setMatrix(m);
    var h = o.h || 2.2, w = o.w || 0.9;
    mb.quad([-w / 2, 0, 0], [w / 2, 0, 0], [w / 2, h, 0], [-w / 2, h, 0], [1, 2]);
    mb.quad([w / 2, 0, 0], [-w / 2, 0, 0], [-w / 2, h, 0], [w / 2, h, 0], [1, 2]);
    mb.setMatrix(null);
  };

  /* ---------------- dungeon kit ---------------- */
  P.room = function (b, x, y, z, w, d, h, o) {
    o = o || {};
    var floorMat = o.floor || 'tileFloor';
    var wallMat = o.wall || 'stoneblockDark';
    if (o.floor !== false) {
      var f = b.mb(floorMat);
      f.setColorHex(o.floorColor === undefined ? 0xffffff : o.floorColor);
      f.quad([x - w / 2, y, z + d / 2], [x + w / 2, y, z + d / 2], [x + w / 2, y, z - d / 2], [x - w / 2, y, z - d / 2],
        [w / 3, d / 3]);
    }
    if (o.ceiling !== false) {
      var c = b.mb(o.ceil || wallMat);
      c.setColorHex(o.ceilColor === undefined ? 0xbbbbbb : o.ceilColor);
      c.quad([x - w / 2, y + h, z - d / 2], [x + w / 2, y + h, z - d / 2], [x + w / 2, y + h, z + d / 2], [x - w / 2, y + h, z + d / 2],
        [w / 3, d / 3]);
    }
    var wm = b.mb(wallMat);
    wm.setColorHex(o.wallColor === undefined ? 0xffffff : o.wallColor);
    var t = 0.5;
    var gaps = o.gaps || {};   /* {n:[offset,width], s:..., e:..., w:...} */
    function wallRun(ax, az, bx, bz, gap) {
      var dx = bx - ax, dz = bz - az;
      var len = Math.sqrt(dx * dx + dz * dz);
      var yaw = Math.atan2(dx, dz);
      var segs = [];
      if (!gap) segs.push([0, len]);
      else {
        var g0 = len / 2 + gap[0] - gap[1] / 2, g1 = len / 2 + gap[0] + gap[1] / 2;
        if (g0 > 0.02) segs.push([0, g0]);
        if (g1 < len - 0.02) segs.push([g1, len]);
        /* lintel above the gap */
        segs.push([g0, g1, o.doorH || 2.2]);
      }
      for (var i = 0; i < segs.length; i++) {
        var s0 = segs[i][0], s1 = segs[i][1], y0 = segs[i][2] || 0;
        var mid = (s0 + s1) / 2;
        var cx = ax + dx * (mid / len), cz = az + dz * (mid / len);
        var slen = s1 - s0;
        if (slen <= 0.02) continue;
        var mm = LZ.M4.create();
        LZ.M4.compose(mm, cx, y + y0, cz, 0, yaw, 0, 1, 1, 1);
        wm.setMatrix(mm);
        /* yaw is atan2(dx,dz), so the wall runs along local +Z, not local +X */
        wm.box(0, (h - y0) / 2, 0, t, h - y0, slen, 1.2);
        wm.setMatrix(null);
        if (b.col) b.col.add(C.box(cx, y + y0 + (h - y0) / 2, cz, t / 2, (h - y0) / 2, slen / 2, { yaw: yaw }));
      }
    }
    wallRun(x - w / 2, z - d / 2, x + w / 2, z - d / 2, gaps.n);
    wallRun(x + w / 2, z + d / 2, x - w / 2, z + d / 2, gaps.s);
    wallRun(x + w / 2, z - d / 2, x + w / 2, z + d / 2, gaps.e);
    wallRun(x - w / 2, z + d / 2, x - w / 2, z - d / 2, gaps.w);
  };

  P.corridor = function (b, x, y, z, len, w, h, o) {
    o = o || {};
    var yaw = o.yaw || 0;
    var m = LZ.M4.create();
    LZ.M4.compose(m, x, y, z, 0, yaw, 0, 1, 1, 1);
    var f = b.mb(o.floor || 'tileFloor');
    f.setColorHex(0xffffff); f.setMatrix(m);
    f.quad([-w / 2, 0, len / 2], [w / 2, 0, len / 2], [w / 2, 0, -len / 2], [-w / 2, 0, -len / 2], [w / 3, len / 3]);
    if (o.ceiling !== false) {
      f.setMatrix(null);
      var c = b.mb(o.wall || 'stoneblockDark');
      c.setColorHex(0xaaaaaa); c.setMatrix(m);
      c.quad([-w / 2, h, -len / 2], [w / 2, h, -len / 2], [w / 2, h, len / 2], [-w / 2, h, len / 2], [w / 3, len / 3]);
      c.setMatrix(null);
    } else f.setMatrix(null);
    var wm = b.mb(o.wall || 'stoneblockDark');
    wm.setColorHex(0xffffff); wm.setMatrix(m);
    wm.box(-w / 2 - 0.25, h / 2, 0, 0.5, h, len, 1.2);
    wm.box(w / 2 + 0.25, h / 2, 0, 0.5, h, len, 1.2);
    wm.setMatrix(null);
    if (b.col) {
      var lx = -w / 2 - 0.25, rx = w / 2 + 0.25;
      b.col.add(C.box(x + lx * Math.cos(yaw), y + h / 2, z + lx * -Math.sin(yaw), 0.25, h / 2, len / 2, { yaw: yaw }));
      b.col.add(C.box(x + rx * Math.cos(yaw), y + h / 2, z + rx * -Math.sin(yaw), 0.25, h / 2, len / 2, { yaw: yaw }));
    }
  };

  P.spikes = function (b, x, y, z, o) {
    o = o || {};
    var mb = b.mb('metal');
    mb.setColorHex(0xb0b4bc);
    var n = o.n || 4, sp = o.spacing || 0.4;
    for (var i = 0; i < n; i++) {
      for (var j = 0; j < n; j++) {
        mb.cylinder(x + (i - (n - 1) / 2) * sp, y, z + (j - (n - 1) / 2) * sp, 0.09, 0.005, 0.42, 4, false, 2);
      }
    }
  };

  P.grate = function (b, x, y, z, w, d, o) {
    o = o || {};
    var mb = b.mb('metalRust');
    mb.setColorHex(0xffffff);
    for (var i = -2; i <= 2; i++) {
      mb.box(x + i * w / 5, y, z, 0.07, 0.07, d, 2);
      mb.box(x, y, z + i * d / 5, w, 0.07, 0.07, 2);
    }
  };

  P.waterfall = function (b, x, y, z, w, h, o) {
    o = o || {};
    var mb = b.mb(o.mat || 'water');
    mb.setColorHex(0xffffff);
    var yaw = o.yaw || 0;
    var m = LZ.M4.create();
    LZ.M4.compose(m, x, y, z, 0, yaw, 0, 1, 1, 1);
    mb.setMatrix(m);
    mb.quad([-w / 2, 0, 0], [w / 2, 0, 0], [w / 2, h, 0], [-w / 2, h, 0], [w / 2, h / 2]);
    mb.setMatrix(null);
  };

  /* ---------------- terrain skirts ---------------- */
  P.skybox = function (renderer, size) {
    var mb = new GL.MeshBuilder();
    var s = size || 400;
    mb.setColor(1, 1, 1, 1);
    /* a dome reads better than a cube: no corner seams in the fog band */
    var segs = 14, rings = 8;
    var grid = [];
    for (var y = 0; y <= rings; y++) {
      var row = [];
      var phi = (y / rings) * Math.PI * 0.62;
      var sy = Math.cos(phi), sr = Math.sin(phi);
      for (var xq = 0; xq <= segs; xq++) {
        var th = xq / segs * M.TAU;
        /* textures upload with UNPACK_FLIP_Y, so v must be inverted here or
           the gradient hangs upside down: pale at the zenith, deep blue at
           the horizon, which is exactly backwards */
        row.push(mb.vert(Math.sin(th) * sr * s, sy * s * 0.75 - s * 0.06, Math.cos(th) * sr * s,
          0, -1, 0, xq / segs * 2, 1 - y / rings));
      }
      grid.push(row);
    }
    for (var yy = 0; yy < rings; yy++) {
      for (var xx = 0; xx < segs; xx++) {
        mb.i.push(grid[yy][xx], grid[yy][xx + 1], grid[yy + 1][xx + 1]);
        mb.i.push(grid[yy][xx], grid[yy + 1][xx + 1], grid[yy + 1][xx]);
      }
    }
    return mb.build(renderer);
  };

  /* A band of fog colour wrapped around the horizon. Without it the terrain
     stops at a hard line against the sky, which is the single most obvious
     tell that a low-draw-distance world is faking its distance. */
  P.horizonBand = function (renderer, radius) {
    var mb = new GL.MeshBuilder();
    var r = radius || 260;
    var segs = 20;
    var top = 12, bottom = -46;
    for (var i = 0; i < segs; i++) {
      var a0 = i / segs * M.TAU, a1 = (i + 1) / segs * M.TAU;
      var x0 = Math.sin(a0) * r, z0 = Math.cos(a0) * r;
      var x1 = Math.sin(a1) * r, z1 = Math.cos(a1) * r;
      /* alpha fades out upward so the fog colour dissolves into the sky */
      var t0 = mb.vert(x0, top, z0, -Math.sin(a0), 0, -Math.cos(a0), 0, 0, [1, 1, 1, 0]);
      var t1 = mb.vert(x1, top, z1, -Math.sin(a1), 0, -Math.cos(a1), 1, 0, [1, 1, 1, 0]);
      var b1 = mb.vert(x1, bottom, z1, -Math.sin(a1), 0, -Math.cos(a1), 1, 1, [1, 1, 1, 1]);
      var b0 = mb.vert(x0, bottom, z0, -Math.sin(a0), 0, -Math.cos(a0), 0, 1, [1, 1, 1, 1]);
      mb.quadIdx(t0, t1, b1, b0);
    }
    return mb.build(renderer);
  };

  P.quad = function (renderer) {
    var mb = new GL.MeshBuilder();
    mb.setColor(1, 1, 1, 1);
    mb.quad([-0.5, 0, 0.5], [0.5, 0, 0.5], [0.5, 0, -0.5], [-0.5, 0, -0.5], 1);
    return mb.build(renderer);
  };

  P.billboardQuad = function (renderer) {
    var mb = new GL.MeshBuilder();
    mb.setColor(1, 1, 1, 1);
    mb.quad([-0.5, -0.5, 0], [0.5, -0.5, 0], [0.5, 0.5, 0], [-0.5, 0.5, 0], 1);
    return mb.build(renderer);
  };

  LZ.Props = P;
})(LZ);
