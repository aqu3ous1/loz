/* =============================================================
   game/assets.js -- builds every texture and material at boot.
   Nothing is loaded from disk; the whole "ROM" is code.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var Tex = LZ.Tex, GL = LZ.GL;

  function Assets(renderer) {
    this.r = renderer;
    this.tex = {};
    this.mat = {};
  }

  Assets.prototype._t = function (name, tile, opts) {
    this.tex[name] = this.r.createTexture(tile.data, {
      width: tile.w, height: tile.h,
      wrap: (opts && opts.wrap) || 'repeat', flipY: false
    });
    /* keep the source tile so the texture sheet tool can show what the
       generator actually drew, at 1:1 and with a colour count */
    if (!this.rawTiles) this.rawTiles = {};
    this.rawTiles[name] = tile;
    return this.tex[name];
  };
  Assets.prototype._m = function (name, texName, opts) {
    var o = opts || {};
    o.texture = this.tex[texName];
    this.mat[name] = GL.material(o);
    return this.mat[name];
  };

  /* Faces are generated on demand and cached by key, so a village of
     fifteen people costs fifteen 64x64 tiles and nothing else. */
  Assets.prototype.ensureFace = function (key, opts) {
    var name = 'face_' + key;
    if (this.mat[name]) return name;
    var tile = Tex.face(opts || {});
    this._t(name, tile, { wrap: 'clamp' });
    this._m(name, name, {});
    return name;
  };

  /* Per-frame material pool. submit() keeps a reference to the material and
     draws later, so anything that varies per actor (damage flash, fade-out)
     needs its own object -- but allocating one per bone per frame would
     churn the GC, so they are recycled. */
  Assets.prototype.beginFrame = function () { this._poolIdx = 0; };
  Assets.prototype.frameMat = function (base, over) {
    if (!this._pool) { this._pool = []; this._poolIdx = 0; }
    if (this._poolIdx >= this._pool.length) {
      this._pool.push(GL.material({}));
    }
    var m = this._pool[this._poolIdx++];
    var src = (typeof base === 'string') ? (this.mat[base] || this.mat.white) : base;
    for (var k in src) m[k] = src[k];
    m.prim = m.prim.slice ? m.prim.slice() : [1, 1, 1, 1];
    m.tint = m.tint.slice ? m.tint.slice() : [0, 0, 0, 0];
    m.uv = m.uv.slice ? m.uv.slice() : [1, 1, 0, 0];
    if (over) for (var j in over) m[j] = over[j];
    return m;
  };

  /* a per-call copy so callers can tint/scroll without stomping the shared one */
  Assets.prototype.clone = function (name, over) {
    var base = this.mat[name] || this.mat.white;
    var m = {};
    for (var k in base) m[k] = (base[k] && base[k].slice) ? base[k].slice() : base[k];
    if (over) for (var j in over) m[j] = over[j];
    return m;
  };

  Assets.prototype.build = function (progress) {
    var t = Tex, self = this;
    function step(label, fn) { if (progress) progress(label); fn(); }

    step('font', function () {
      var f = LZ.Font.build(Tex);
      self.font = f;
      self.texFont = self.r.createTexture(f.tile.data, { width: f.tile.w, height: f.tile.h, wrap: 'clamp', flipY: false });
      var ic = LZ.Icons.build(Tex);
      self.iconUV = ic.uv;
      self.iconNames = ic.names;
      self.texIcons = self.r.createTexture(ic.tile.data, { width: ic.tile.w, height: ic.tile.h, wrap: 'clamp', flipY: false });
      var wt = t.solid(0xffffff);
      self.texWhite = self.r.createTexture(wt.data, { width: wt.w, height: wt.h, wrap: 'clamp', flipY: false });
      self.tex.white = self.texWhite;
    });

    step('terrain', function () {
      self._t('grass', t.grass([70, 116, 52], [106, 154, 70], 1));
      self._t('grassLush', t.grass([54, 104, 46], [92, 150, 62], 23));
      self._t('grassDry', t.grass([124, 122, 62], [158, 150, 84], 5));
      self._t('grassDark', t.grass([38, 72, 44], [62, 100, 54], 9));
      self._t('grassAsh', t.grass([78, 80, 70], [104, 104, 92], 13));
      self._t('dirt', t.dirt(7));
      self._t('dirtRed', t.dirt(19));
      self._t('sand', t.sand(3));
      self._t('sandDark', t.sand(29));
      self._t('rock', t.rock(0x706c68, 13));
      self._t('rockRed', t.rock(0x8a5a44, 17));
      self._t('rockDark', t.rock(0x4a4854, 23));
      self._t('rockAsh', t.rock(0x7c746c, 31));
      self._t('snow', t.snow(21));
      self._t('ice', t.water(0x9fd8ee, 43));
      self._t('lava', t.lava(31));
      self._t('water', t.water(0x2f6d9a, 41));
      self._t('waterDeep', t.water(0x1c4a72, 47));
      self._t('waterMurk', t.water(0x3d5a3a, 53));
      self._t('cobble', t.cobble(0x9e9a90, 51));
      self._t('cobbleDark', t.cobble(0x6e6c70, 59));
    });

    step('architecture', function () {
      self._t('planks', t.planks(0x8a6438, 61));
      self._t('planksDark', t.planks(0x5c4126, 67));
      self._t('planksPale', t.planks(0xb69a68, 71));
      self._t('bark', t.bark(0x6b4d30, 71));
      self._t('barkPine', t.bark(0x4c3a28, 73));
      self._t('barkDead', t.bark(0x77685a, 79));
      self._t('thatch', t.thatch(81));
      self._t('shingleRed', t.shingle(0x8c3a34, 91));
      self._t('shingleBlue', t.shingle(0x36527e, 93));
      self._t('shingleGrey', t.shingle(0x555a63, 97));
      self._t('brick', t.brick(0x9a5a48, 0xa89c8c, 101));
      self._t('stoneblock', t.stoneblock(0x8e8a80, 111));
      self._t('stoneblockDark', t.stoneblock(0x51535e, 113));
      self._t('stoneblockWarm', t.stoneblock(0x9c8a6c, 127));
      self._t('plaster', t.plaster(0xd8cbae, 121));
      self._t('plasterBlue', t.plaster(0xa8b4c8, 123));
      self._t('sandstone', t.sandstone(0xcaa877, 131));
      self._t('tileFloor', t.tilefloor(0x6a6f86, 0x4a4e63, 141));
      self._t('tileWarm', t.tilefloor(0xa08a62, 0x7c6846, 143));
      self._t('carpet', t.carpet(0x8c2b34, 0xd0b356, 151));
      self._t('carpetBlue', t.carpet(0x27407a, 0xc9c2a0, 153));
      self._t('metal', t.metal(0x9aa2ad, false, 161));
      self._t('metalRust', t.metal(0x8a7a68, true, 163));
      self._t('gold', t.gold(301));
    });

    step('foliage', function () {
      self._t('leaves', t.leaves(0x3f7a3a, 171));
      self._t('leavesDark', t.leaves(0x27502e, 173));
      self._t('leavesAutumn', t.leaves(0x9a5a26, 177));
      self._t('leavesDead', t.leaves(0x6a5c44, 179));
      self._t('pine', t.leaves(0x2c4f34, 181));
      self._t('grassblade', t.grassblade(0x63a34b, 181));
      self._t('grassbladeDry', t.grassblade(0xa89a54, 183));
      self._t('flowers', t.flowers(0xf0e8b0, 191));
      self._t('flowersRed', t.flowers(0xd9484c, 193));
      self._t('petalRed', t.petal(0xd0505e, 211));
      self._t('petalPale', t.petal(0xe8c0a0, 217));
      self._t('vines', t.vines(201));
      self._t('cobweb', t.cobweb(), { wrap: 'clamp' });
    });

    step('creatures', function () {
      self._t('clothGreen', t.cloth(0x2f7a3c, 211));
      self._t('clothDGreen', t.cloth(0x1f5a2c, 212));
      self._t('clothBlue', t.cloth(0x2c4d86, 213));
      self._t('clothRed', t.cloth(0x8e2f30, 215));
      self._t('clothWhite', t.cloth(0xd8d4c6, 217));
      self._t('clothBrown', t.cloth(0x6f5238, 219));
      self._t('clothTan', t.cloth(0xbfa374, 220));
      self._t('clothPurple', t.cloth(0x54346e, 221));
      self._t('clothBlack', t.cloth(0x24222c, 222));
      self._t('leather', t.leather(0x6b4a2c, 221));
      self._t('leatherDark', t.leather(0x3e2c1c, 223));
      self._t('skin', t.skin(0xe0b48c, 231));
      self._t('skinTan', t.skin(0xc08a5c, 233));
      self._t('skinPale', t.skin(0xefd0b4, 235));
      self._t('skinOld', t.skin(0xcbae94, 237));
      self._t('hairBrown', t.fur(0x5a3c22, 261));
      self._t('hairBlond', t.fur(0xc9a05a, 262));
      self._t('hairWhite', t.fur(0xd8d4cc, 263));
      self._t('hairRed', t.fur(0x8c3a1e, 264));
      self._t('scaleGreen', t.scale(0x4f7a3a, 241));
      self._t('scaleBlue', t.scale(0x2f6a86, 243));
      self._t('scaleRed', t.scale(0x7a3230, 245));
      self._t('bone', t.bone(251));
      self._t('furPurple', t.fur(0x4a3a52, 261));
      self._t('furGrey', t.fur(0x5c5c62, 265));
      self._t('jellyBlue', t.jelly(0x4ab0c8, 271));
      self._t('jellyRed', t.jelly(0xc85050, 273));
      self._t('jellyGreen', t.jelly(0x64c060, 275));
      self._t('evil', t.evil(0x3a1550, 281));
      self._t('evilRed', t.evil(0x50101c, 283));
      self._t('evilGold', t.evil(0x4a3410, 285));
    });

    step('effects', function () {
      self._t('chestwood', t.chestwood(291));
      self._t('gemGreen', t.gem(0x2fd06a, 1));
      self._t('gemBlue', t.gem(0x3f8fe0, 2));
      self._t('gemRed', t.gem(0xe04a4a, 3));
      self._t('gemPurple', t.gem(0xa04ae0, 4));
      self._t('flame', t.flame(311), { wrap: 'clamp' });
      self._t('dot', t.radial(0xffffff, 1.6), { wrap: 'clamp' });
      self._t('dotHard', t.radial(0xffffff, 0.55), { wrap: 'clamp' });
      self._t('ring', t.ring(0xffffff, 0.14), { wrap: 'clamp' });
      self._t('spark', t.spark(0xffffff), { wrap: 'clamp' });
      self._t('slash', t.slash(0xffffff), { wrap: 'clamp' });
      self._t('moon', t.moon(), { wrap: 'clamp' });
      self._t('skyDay', t.sky(0x2f6ec4, 0xa8cfee, 331));
      self._t('skyDusk', t.sky(0x2a2f6a, 0xe0946a, 333));
      self._t('skyNight', t.sky(0x0a0c22, 0x2a2a4e, 335));
      self._t('skyDesert', t.sky(0x3d78c4, 0xe4cc9c, 337));
      self._t('skyAsh', t.sky(0x4a4450, 0x8a7a70, 339));
      self._t('skyStorm', t.sky(0x2a1c34, 0x6a4a5a, 341));
      self._t('skyVoid', t.sky(0x140a20, 0x40183c, 343));
    });

    step('materials', function () {
      /* ground and architecture: lit, fogged, opaque */
      var opaque = ['grass', 'grassLush', 'grassDry', 'grassDark', 'grassAsh', 'dirt', 'dirtRed',
        'sand', 'sandDark', 'rock', 'rockRed', 'rockDark', 'rockAsh', 'snow', 'cobble', 'cobbleDark',
        'planks', 'planksDark', 'planksPale', 'bark', 'barkPine', 'barkDead', 'thatch',
        'shingleRed', 'shingleBlue', 'shingleGrey', 'brick', 'stoneblock', 'stoneblockDark',
        'stoneblockWarm', 'plaster', 'plasterBlue', 'sandstone', 'tileFloor', 'tileWarm',
        'carpet', 'carpetBlue', 'metal', 'metalRust', 'gold', 'chestwood',
        'clothGreen', 'clothDGreen', 'clothBlue', 'clothRed', 'clothWhite', 'clothBrown', 'clothTan',
        'clothPurple', 'clothBlack', 'leather', 'leatherDark', 'skin', 'skinTan', 'skinPale', 'skinOld',
        'hairBrown', 'hairBlond', 'hairWhite', 'hairRed', 'scaleGreen', 'scaleBlue', 'scaleRed',
        'bone', 'furPurple', 'furGrey', 'evil', 'evilRed', 'evilGold',
        'gemGreen', 'gemBlue', 'gemRed', 'gemPurple', 'petalRed', 'petalPale'];
      for (var i = 0; i < opaque.length; i++) {
        if (self.tex[opaque[i]]) self._m(opaque[i], opaque[i], {});
      }
      /* cutout foliage: two-sided, alpha tested */
      var cut = ['leaves', 'leavesDark', 'leavesAutumn', 'leavesDead', 'pine', 'grassblade',
        'grassbladeDry', 'flowers', 'flowersRed', 'vines', 'cobweb'];
      for (var j = 0; j < cut.length; j++) {
        self._m(cut[j], cut[j], { blend: 'cutout', cull: 'none', alphaRef: 0.5 });
      }
      /* water: translucent, scrolls */
      self._m('water', 'water', { blend: 'alpha', cull: 'none', depthWrite: false, queue: 5 });
      self._m('waterDeep', 'waterDeep', { blend: 'alpha', cull: 'none', depthWrite: false, queue: 5 });
      self._m('waterMurk', 'waterMurk', { blend: 'alpha', cull: 'none', depthWrite: false, queue: 5 });
      self._m('ice', 'ice', { blend: 'alpha', cull: 'none', depthWrite: true });
      self._m('lava', 'lava', { lit: false, prim: [1.25, 1.1, 1.0, 1] });
      /* self-lit weak points and gems: a boss's vulnerable spot has to stay
         readable inside a dark cavity, which lit geometry never manages */
      self._m('glowGreen', 'gemGreen', { lit: false, prim: [1.30, 1.35, 1.05, 1] });
      self._m('glowBlue', 'gemBlue', { lit: false, prim: [1.05, 1.25, 1.40, 1] });
      self._m('glowRed', 'gemRed', { lit: false, prim: [1.40, 1.05, 1.00, 1] });
      self._m('glowPurple', 'gemPurple', { lit: false, prim: [1.25, 1.00, 1.40, 1] });
      self._m('jellyBlue', 'jellyBlue', { blend: 'alpha', cull: 'none' });
      self._m('jellyRed', 'jellyRed', { blend: 'alpha', cull: 'none' });
      self._m('jellyGreen', 'jellyGreen', { blend: 'alpha', cull: 'none' });
      /* effects: unlit additive */
      self._m('flame', 'flame', { blend: 'add', lit: false, fog: false, cull: 'none', depthWrite: false, queue: 10 });
      self._m('glow', 'dot', { blend: 'add', lit: false, fog: false, cull: 'none', depthWrite: false, queue: 10 });
      self._m('glowSoft', 'dot', { blend: 'alpha', lit: false, fog: false, cull: 'none', depthWrite: false, queue: 10 });
      self._m('particle', 'dotHard', { blend: 'alpha', lit: false, cull: 'none', depthWrite: false, queue: 10 });
      self._m('spark', 'spark', { blend: 'add', lit: false, fog: false, cull: 'none', depthWrite: false, queue: 10 });
      self._m('ring', 'ring', { blend: 'add', lit: false, fog: false, cull: 'none', depthWrite: false, queue: 10 });
      self._m('slash', 'slash', { blend: 'add', lit: false, fog: false, cull: 'none', depthWrite: false, queue: 10 });
      self._m('shadow', 'dot', { blend: 'alpha', lit: false, fog: true, cull: 'none', depthWrite: false, depthOffset: -2, queue: 2, prim: [0, 0, 0, 0.42] });
      self._m('white', 'white', {});
      self._m('flat', 'white', { lit: false, fog: false });
      /* skies: unlit, no fog, inside-out */
      var skies = ['skyDay', 'skyDusk', 'skyNight', 'skyDesert', 'skyAsh', 'skyStorm', 'skyVoid'];
      for (var s = 0; s < skies.length; s++) {
        self._m(skies[s], skies[s], { lit: false, fog: false, cull: 'front', depthWrite: false, queue: -10 });
      }
      self._m('moon', 'moon', { lit: false, fog: false, blend: 'alpha', cull: 'none', depthWrite: false, queue: -9 });
    });

    return this;
  };

  LZ.Assets = Assets;
})(LZ);
