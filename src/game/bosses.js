/* =============================================================
   game/bosses.js -- the six major fights.

   Each one teaches, then tests, the dungeon's item. Each has a
   readable tell, a punish window, and a phase change that raises the
   stakes without changing the language of the fight.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var M = LZ.M, V3 = LZ.V3, M4 = LZ.M4, GL = LZ.GL, A = LZ.Anim, C = LZ.Collision;
  var clip = A.clip;

  /* ---------------------------------------------------------------- */
  /* Boss base                                                         */
  /* ---------------------------------------------------------------- */
  function Boss(game, o) {
    LZ.Enemy.call(this, game, o);
    this.isBoss = true;
    this.bossName = o.bossName || 'Something Terrible';
    this.phase = 1;
    this.maxPhase = o.maxPhase || 2;
    this.introDone = false;
    this.introTime = 0;
    this.vulnerable = true;
    this.stunTimer = 0;
    this.arena = o.arena || null;
    this.dungeon = o.dungeon || null;
    this.cullDist = 999;
    this.alwaysUpdate = true;
    this.lockRange = 40;
    this.leash = 999;
    this.drops = [null];
    this.deathSeq = 0;
  }
  Boss.prototype = Object.create(LZ.Enemy.prototype);
  Boss.prototype.constructor = Boss;

  Boss.prototype.startFight = function (g) {
    if (this.introDone) return;
    this.introDone = true;
    g.startBossBar(this, this.bossName);
    g.audio.playSong(LZ.Music[this.music || 'boss'], { restart: true });
    g.audio.sfx('roar');
    g.cam.addShake(0.5);
  };

  Boss.prototype.onDie = function () {
    var g = this.game;
    this.deathSeq = 0;
    this.hitboxOn = false;
    g.audio.stopSong(true);
    g.audio.sfx('roar');
    g.cam.addShake(0.7);
    g.beginBossDeath(this);
  };

  Boss.prototype.updateDeath = function (dt, g) {
    this.deathSeq += dt;
    this.alpha = 1;
    if (Math.random() < dt * 14) {
      g.effects.burst(
        this.pos[0] + (Math.random() - 0.5) * this.radius * 3,
        this.pos[1] + Math.random() * this.height,
        this.pos[2] + (Math.random() - 0.5) * this.radius * 3, [1, 0.8, 0.5]);
      g.audio.sfx('explode', { minGap: 0.12 });
      g.cam.addShake(0.18);
    }
    if (this.deathSeq > 2.6) {
      this.removeMe = true;
      g.finishBossDeath(this);
    }
  };

  Boss.prototype.update = function (dt, g) {
    this.updateCommon(dt, g.world);
    if (this.dead) { this.updateDeath(dt, g); return; }
    if (!this.introDone) {
      if (V3.distXZ(this.pos, g.player.pos) < (this.triggerRange || 12)) this.startFight(g);
      else { this.play(this.idleClip || 'idle'); return; }
    }
    if (this.frozen > 0) { this.applyGravity(dt, g.world); return; }
    this.brain(dt, g);
    this.turnToward(dt);
    if (!this.flying) this.applyGravity(dt, g.world);
    this.doContact(dt, g);
  };

  Boss.prototype.onHurt = function (amount, source, opts) {
    if (this.dead) return false;
    if (!this.vulnerable) {
      this.game.audio.sfx('hit_metal');
      this.game.effects.impact(this.pos[0], this.pos[1] + this.height * 0.6, this.pos[2], true);
      return false;
    }
    this.aggro = true;
    var before = this.hp;
    this.hitFlash = 0.34;
    this.game.cam.addShake(0.14);
    /* phase transitions at even fractions of max health */
    var frac = (before - amount) / this.maxHp;
    var newPhase = Math.min(this.maxPhase, Math.floor((1 - frac) * this.maxPhase) + 1);
    if (newPhase > this.phase && (before - amount) > 0) {
      this.phase = newPhase;
      if (this.onPhase) this.onPhase(this.game, newPhase);
    }
    return true;
  };

  /* ---------------------------------------------------------------- */
  /* 1. The Emberhusk -- Ashvale Mine                                  */
  /* ---------------------------------------------------------------- */
  function emberhuskRig() {
    /* A slag golem. Nothing on it is a box: every mass is a swept ring set,
       roughened by per-ring radius jitter so the silhouette reads as piled
       stone. The waist is deliberately pinched and the arms hung wide of it,
       so the limbs stay readable as limbs from any angle instead of melting
       into one lump -- the failure mode of every low-poly golem. */
    var CHEST = [
      { y: -0.10, r: 0.62 }, { y: 0.22, r: 0.86 }, { y: 0.58, r: 1.02 },
      { y: 0.94, r: 1.04 }, { y: 1.20, r: 0.78 }
    ];
    /* radius of the chest barrel at a given height, so surface details can be
       placed ON the crust rather than sunk inside it */
    function chestR(y) {
      if (y <= CHEST[0].y) return CHEST[0].r;
      for (var i = 1; i < CHEST.length; i++) {
        if (y <= CHEST[i].y) {
          var t = (y - CHEST[i - 1].y) / (CHEST[i].y - CHEST[i - 1].y);
          return M.lerp(CHEST[i - 1].r, CHEST[i].r, t);
        }
      }
      return CHEST[CHEST.length - 1].r;
    }
    function rough(rings, amp, seed) {
      for (var i = 0; i < rings.length; i++) {
        var w = M.hash2(i * 3.7 + seed, seed) * 2 - 1;
        rings[i].r *= 1 + w * amp;
      }
      return rings;
    }
    function fist(mb, x, y, r) {
      mb.ovoid(x, y, 0, r, r * 0.92, r * 1.02, 8, 6);
      for (var i = 0; i < 4; i++) {
        var a = -0.55 + i * 0.37;
        mb.ovoid(x + Math.sin(a) * r * 0.58, y + r * 0.34, Math.cos(a) * r * 0.64,
          r * 0.30, r * 0.26, r * 0.30, 6, 4);
      }
    }
    /* a molten fissure crawling down the crust from (angle, y) */
    function seam(mb, a0, y0, y1, drift, steps, rad) {
      var pts = [];
      for (var i = 0; i <= steps; i++) {
        var t = i / steps;
        var y = M.lerp(y0, y1, t);
        var a = a0 + drift * Math.sin(t * 3.1);
        var rr = chestR(y) * 0.97;
        pts.push([Math.sin(a) * rr, y, Math.cos(a) * rr]);
      }
      for (var k = 0; k < pts.length - 1; k++) {
        var w = rad * (k === 0 || k === pts.length - 2 ? 0.55 : 1);
        mb.tube([
          { x: pts[k][0], y: pts[k][1], z: pts[k][2], r: w },
          { x: pts[k + 1][0], y: pts[k + 1][1], z: pts[k + 1][2], r: rad }
        ], 5);
      }
    }
    return {
      height: 3.4, radius: 1.4,
      def: [
        { name: 'root' },
        { name: 'hips', parent: 'root', offset: [0, 1.45, 0], mat: 'rockAsh', build: function (mb) {
            mb.setColorHex(0xe4d8cc);
            mb.tube(rough([
              { y: -0.80, r: 0.62 }, { y: -0.52, r: 0.80 }, { y: -0.24, r: 0.88 },
              { y: 0.04, r: 0.80 }, { y: 0.26, r: 0.66 }
            ], 0.07, 11), 9, { v: 0.7 });
          } },
        { name: 'chest', parent: 'hips', offset: [0, 0.30, 0], mat: 'rockAsh', build: function (mb) {
            mb.setColorHex(0xf4e8d8);
            mb.tube(rough(CHEST.map(function (g) { return { y: g.y, r: g.r }; }), 0.06, 27),
              9, { v: 0.7 });
            /* boulder shoulders -- the golem's whole read is these two lumps */
            mb.setColorHex(0xd0c4b4);
            mb.ovoid(-1.18, 0.98, 0, 0.66, 0.58, 0.62, 8, 6);
            mb.ovoid(1.18, 0.98, 0, 0.66, 0.58, 0.62, 8, 6);
            mb.ovoid(-1.32, 1.32, -0.12, 0.36, 0.32, 0.34, 6, 4);
            mb.ovoid(1.26, 1.36, 0.08, 0.32, 0.30, 0.32, 6, 4);
          } },
        { name: 'cracks', parent: 'chest', offset: [0, 0, 0], mat: 'lava', build: function (mb) {
            mb.setColorHex(0xffffff);
            seam(mb, -0.30, 0.86, 0.00, 0.42, 4, 0.055);
            seam(mb, 0.34, 0.80, 0.14, -0.36, 4, 0.048);
            seam(mb, Math.PI + 0.2, 0.94, 0.18, 0.40, 4, 0.050);
            seam(mb, 1.55, 0.70, 0.20, 0.30, 3, 0.042);
          } },
        { name: 'core', parent: 'chest', offset: [0, 0.72, 0.92], mat: 'lava', build: function (mb) {
            mb.setColorHex(0xffffff);
            mb.ovoid(0, 0, 0, 0.38, 0.38, 0.30, 10, 7);
          } },
        { name: 'plate', parent: 'chest', offset: [0, 0.72, 0.62], mat: 'rockAsh', build: function (mb) {
            /* a curved slab of crust half-shuttering the core, swept along z so
               it wraps the chest instead of sitting flat against it */
            mb.setColorHex(0xb4a898);
            mb.tube([
              { z: -0.28, y: -0.34, rx: 0.74, ry: 0.56 },
              { z: 0.02, y: -0.34, rx: 0.82, ry: 0.62 },
              { z: 0.28, y: -0.32, rx: 0.70, ry: 0.54 },
              { z: 0.44, y: -0.30, rx: 0.44, ry: 0.34 }
            ], 8, { axis: 'z', capStart: false });
          } },
        { name: 'head', parent: 'chest', offset: [0, 1.34, 0.06], mat: 'rockAsh', build: function (mb) {
            mb.setColorHex(0xffeedd);
            mb.tube(rough([
              { y: -0.24, r: 0.44 }, { y: 0.02, r: 0.60 }, { y: 0.32, r: 0.62 },
              { y: 0.58, r: 0.50 }, { y: 0.74, r: 0.28 }
            ], 0.05, 5), 8, { v: 0.8 });
            /* heavy brow ridge thrown forward, so the sockets sit in shadow */
            mb.setColorHex(0xc0ae9a);
            mb.tube([
              { x: -0.52, y: 0.30, z: 0.30, ry: 0.11, rz: 0.10 },
              { x: -0.20, y: 0.36, z: 0.52, ry: 0.17, rz: 0.15 },
              { x: 0.20, y: 0.36, z: 0.52, ry: 0.17, rz: 0.15 },
              { x: 0.52, y: 0.30, z: 0.30, ry: 0.11, rz: 0.10 }
            ], 6, { axis: 'x' });
            /* jaw shelf */
            mb.setColorHex(0xb0a08e);
            mb.tube([
              { x: -0.40, y: -0.10, z: 0.24, ry: 0.11, rz: 0.13 },
              { x: 0, y: -0.16, z: 0.42, ry: 0.16, rz: 0.18 },
              { x: 0.40, y: -0.10, z: 0.24, ry: 0.11, rz: 0.13 }
            ], 6, { axis: 'x' });
          } },
        { name: 'eyes', parent: 'head', offset: [0, 0.19, 0], mat: 'lava', build: function (mb) {
            mb.setColorHex(0xffffff);
            mb.ovoid(-0.24, 0, 0.50, 0.13, 0.09, 0.10, 6, 4);
            mb.ovoid(0.24, 0, 0.50, 0.13, 0.09, 0.10, 6, 4);
          } },
        { name: 'armL', parent: 'chest', offset: [-1.34, 0.92, 0], mat: 'rockAsh', build: armBuild(41, -1) },
        { name: 'armR', parent: 'chest', offset: [1.34, 0.92, 0], mat: 'rockAsh', build: armBuild(63, 1) },
        { name: 'legL', parent: 'hips', offset: [-0.52, -0.56, 0], mat: 'rockAsh', build: legBuild(97) },
        { name: 'legR', parent: 'hips', offset: [0.52, -0.56, 0], mat: 'rockAsh', build: legBuild(131) }
      ]
    };
    function armBuild(seed, side) {
      return function (mb) {
        mb.setColorHex(0xe4d8cc);
        mb.tube(rough([
          { y: 0.10, x: 0, r: 0.42 }, { y: -0.30, x: side * 0.12, r: 0.35 },
          { y: -0.72, x: side * 0.20, r: 0.31 }, { y: -1.08, x: side * 0.26, r: 0.36 }
        ], 0.06, seed), 8, { v: 0.7 });
        mb.setColorHex(0xbfb2a2);
        fist(mb, side * 0.28, -1.52, 0.52);
      };
    }
    function legBuild(seed) {
      return function (mb) {
        mb.setColorHex(0xd8ccc0);
        mb.tube(rough([
          { y: 0.10, r: 0.42 }, { y: -0.16, r: 0.38 }, { y: -0.44, r: 0.34 },
          { y: -0.70, r: 0.38 }
        ], 0.06, seed), 8, { v: 0.7 });
        /* splayed slab foot */
        mb.setColorHex(0xbfb2a2);
        mb.tube([
          { z: -0.30, y: -0.78, rx: 0.32, ry: 0.15 },
          { z: 0.06, y: -0.80, rx: 0.42, ry: 0.18 },
          { z: 0.38, y: -0.80, rx: 0.36, ry: 0.15 }
        ], 8, { axis: 'z' });
      };
    }
  }
  var EMBER_CLIPS = {
    idle: clip('idle', 3.0, true, {
      chest: { t: [[0, 0, 0, 0], [1.5, 0, 0.08, 0], [3.0, 0, 0, 0]] },
      armL: { r: [[0, 0, 0, -8], [1.5, 0, 0, -14], [3.0, 0, 0, -8]] },
      armR: { r: [[0, 0, 0, 8], [1.5, 0, 0, 14], [3.0, 0, 0, 8]] },
      head: { r: [[0, 0, 5, 0], [1.5, 0, -5, 0], [3.0, 0, 5, 0]] }
    }),
    walk: clip('walk', 1.5, true, {
      hips: { t: [[0, 0, 0, 0], [0.37, 0, 0.14, 0], [0.75, 0, 0, 0], [1.12, 0, 0.14, 0], [1.5, 0, 0, 0]],
              r: [[0, 0, 6, 0], [0.75, 0, -6, 0], [1.5, 0, 6, 0]] },
      legL: { r: [[0, -26, 0, 0], [0.75, 26, 0, 0], [1.5, -26, 0, 0]] },
      legR: { r: [[0, 26, 0, 0], [0.75, -26, 0, 0], [1.5, 26, 0, 0]] },
      armL: { r: [[0, 20, 0, -10], [0.75, -20, 0, -10], [1.5, 20, 0, -10]] },
      armR: { r: [[0, -20, 0, 10], [0.75, 20, 0, 10], [1.5, -20, 0, 10]] }
    }, { events: [{ t: 0.05, name: 'step' }, { t: 0.8, name: 'step' }] }),
    slam: clip('slam', 1.5, false, {
      chest: { r: [[0, 0, 0, 0], [0.5, -30, 0, 0], [0.8, 24, 0, 0], [1.5, 0, 0, 0]] },
      armL: { r: [[0, 0, 0, -8], [0.5, -160, 0, -20], [0.8, 12, 0, -8], [1.5, 0, 0, -8]] },
      armR: { r: [[0, 0, 0, 8], [0.5, -160, 0, 20], [0.8, 12, 0, 8], [1.5, 0, 0, 8]] },
      hips: { t: [[0, 0, 0, 0], [0.5, 0, 0.3, 0], [0.8, 0, -0.25, 0], [1.5, 0, 0, 0]] }
    }, { events: [{ t: 0.5, name: 'raise' }, { t: 0.8, name: 'slam' }] }),
    open: clip('open', 3.4, false, {
      chest: { r: [[0, 0, 0, 0], [0.3, -26, 0, 0], [3.0, -26, 0, 0], [3.4, 0, 0, 0]] },
      plate: { r: [[0, 0, 0, 0], [0.4, -110, 0, 0], [3.0, -110, 0, 0], [3.4, 0, 0, 0]] },
      armL: { r: [[0, 0, 0, -8], [0.4, 30, 0, -60], [3.0, 30, 0, -60], [3.4, 0, 0, -8]] },
      armR: { r: [[0, 0, 0, 8], [0.4, 30, 0, 60], [3.0, 30, 0, 60], [3.4, 0, 0, 8]] }
    }, { events: [{ t: 0.4, name: 'expose' }, { t: 3.0, name: 'close' }] }),
    spray: clip('spray', 2.0, false, {
      head: { r: [[0, 0, 0, 0], [0.4, -20, 0, 0], [1.6, -20, 0, 0], [2.0, 0, 0, 0]] },
      chest: { r: [[0, 0, 0, 0], [0.4, -14, 0, 0], [1.6, -14, 0, 0], [2.0, 0, 0, 0]] }
    }, { events: [{ t: 0.5, name: 'sprayGo' }, { t: 1.6, name: 'sprayEnd' }] }),
    hurt: clip('hurt', 0.5, false, {
      chest: { r: [[0, 0, 0, 0], [0.12, 22, 0, 0], [0.5, 0, 0, 0]] },
      head: { r: [[0, 0, 0, 0], [0.12, 26, 0, 0], [0.5, 0, 0, 0]] }
    }),
    stagger: clip('stagger', 2.6, false, {
      chest: { r: [[0, 0, 0, 0], [0.4, 34, 0, 0], [2.2, 30, 0, 0], [2.6, 0, 0, 0]] },
      head: { r: [[0, 0, 0, 0], [0.4, 40, 0, 0], [2.2, 36, 0, 0], [2.6, 0, 0, 0]] },
      plate: { r: [[0, 0, 0, 0], [0.4, -110, 0, 0], [2.2, -110, 0, 0], [2.6, 0, 0, 0]] },
      armL: { r: [[0, 0, 0, -8], [0.4, 40, 0, -50], [2.6, 0, 0, -8]] },
      armR: { r: [[0, 0, 0, 8], [0.4, 40, 0, 50], [2.6, 0, 0, 8]] },
      hips: { t: [[0, 0, 0, 0], [0.4, 0, -0.4, 0], [2.2, 0, -0.4, 0], [2.6, 0, 0, 0]] }
    })
  };
  EMBER_CLIPS.run = EMBER_CLIPS.walk;

  function Emberhusk(g, o) {
    Boss.call(this, g, {
      x: o.x, y: o.y, z: o.z, hp: 24, radius: 1.4, height: 3.4,
      speed: 2.0, sight: 20, damage: 1.5, contact: 1,
      bossName: 'EMBERHUSK, SLAG OF THE DEEP SEAM', maxPhase: 2, dungeon: 'mine'
    });
    this.setModel(LZ.charModel(g.r, 'emberhusk', emberhuskRig, EMBER_CLIPS));
    this.height = 3.4;
    this.lockHeight = 2.0;
    this.vulnerable = false;
    this.attackTimer = 2.0;
    this.mode = 'idle';
    this.modeTime = 0;
    this.exposed = false;
    this.contactRadius = 1.8;
    this.music = 'boss';
    this.play('idle');
    this.anim.onEvent = (function (self) {
      return function (n) {
        var gg = self.game;
        if (n === 'step') { gg.cam.addShake(0.09); gg.audio.sfx('land'); }
        if (n === 'raise') gg.audio.sfx('swing_heavy');
        if (n === 'slam') {
          gg.cam.addShake(0.4);
          gg.audio.sfx('explode');
          gg.particles.emit('dust', self.pos[0], self.pos[1], self.pos[2], 18, 3.0);
          gg.effects.ring(self.pos[0], self.pos[1] + 0.1, self.pos[2], [1, 0.7, 0.3, 0.9], 7);
          /* the shockwave only catches you on the ground: jump or roll it */
          if (V3.distXZ(self.pos, gg.player.pos) < 4.6 && gg.player.grounded) {
            gg.player.damage(1.5, self, { knockback: 11 });
          }
          gg.spawnRockfall(self.pos[0], self.pos[2], 3);
        }
        if (n === 'expose') { self.vulnerable = true; self.exposed = true; }
        if (n === 'close') { self.vulnerable = false; self.exposed = false; }
        if (n === 'sprayGo') self.spraying = true;
        if (n === 'sprayEnd') self.spraying = false;
      };
    })(this);
  }
  Emberhusk.prototype = Object.create(Boss.prototype);
  Emberhusk.prototype.constructor = Emberhusk;

  Emberhusk.prototype.onHurt = function (amount, source, opts) {
    /* a bomb blast cracks the shell open; nothing else does */
    if (!this.vulnerable && opts && opts.source === 'explosion') {
      this.game.audio.sfx('roar');
      this.mode = 'stagger';
      this.modeTime = 0;
      this.play('stagger', { restart: true, blend: 0.1 });
      this.vulnerable = true;
      this.exposed = true;
      this.game.hud.toast('The shell splits! Strike the core!');
      this.game.cam.addShake(0.4);
      return false;
    }
    return Boss.prototype.onHurt.call(this, amount, source, opts);
  };
  Emberhusk.prototype.onPhase = function (g, p) {
    g.hud.toast('The Emberhusk burns hotter.');
    this.moveSpeed = 2.9;
    g.cam.addShake(0.4);
    g.audio.sfx('roar');
  };

  Emberhusk.prototype.brain = function (dt, g) {
    var p = g.player;
    this.modeTime += dt;
    var d = V3.distXZ(this.pos, p.pos);

    if (this.mode === 'stagger') {
      this.speed = 0;
      if (this.modeTime > 2.6) { this.mode = 'idle'; this.modeTime = 0; this.vulnerable = false; this.exposed = false; }
      return;
    }
    if (this.mode === 'slam') {
      this.speed = 0;
      this.faceTowards(p.pos[0], p.pos[2]);
      if (this.modeTime > 1.5) { this.mode = 'idle'; this.modeTime = 0; }
      return;
    }
    if (this.mode === 'spray') {
      this.faceTowards(p.pos[0], p.pos[2]);
      if (this.spraying && Math.random() < dt * (this.phase > 1 ? 14 : 9)) {
        var a = this.yaw + (Math.random() - 0.5) * 1.1;
        var dir = V3.create(Math.sin(a), 0.42, Math.cos(a));
        V3.normalize(dir, dir);
        g.spawnProjectile(this.pos[0], this.pos[1] + 2.6, this.pos[2], dir, {
          speed: 11, damage: 1, owner: this, kind: 'fireball', gravity: 12, life: 3
        });
        g.audio.sfx('fire', { minGap: 0.14 });
      }
      if (this.modeTime > 2.0) { this.mode = 'idle'; this.modeTime = 0; }
      return;
    }
    if (this.mode === 'open') {
      this.speed = 0;
      if (this.modeTime > 3.4) { this.mode = 'idle'; this.modeTime = 0; }
      return;
    }

    /* idle: approach and pick an attack */
    this.faceTowards(p.pos[0], p.pos[2]);
    if (d > 3.2) {
      this.stepToward(dt, g, p.pos[0], p.pos[2], this.moveSpeed);
      this.play('walk', { blend: 0.2, speed: this.phase > 1 ? 1.4 : 1 });
    } else {
      this.speed = 0;
      this.play('idle', { blend: 0.2 });
    }
    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      this.attackTimer = (this.phase > 1 ? 2.0 : 2.9);
      if (d < 4.6) {
        this.mode = 'slam'; this.modeTime = 0;
        this.play('slam', { restart: true, blend: 0.1 });
      } else {
        this.mode = 'spray'; this.modeTime = 0;
        this.play('spray', { restart: true, blend: 0.1 });
      }
      /* it vents heat periodically, and that is the free window */
      if (Math.random() < 0.34) {
        this.mode = 'open'; this.modeTime = 0;
        this.play('open', { restart: true, blend: 0.15 });
        g.hud.toast('The core is exposed!');
      }
    }
    if (this.exposed && Math.random() < dt * 12) {
      g.particles.emit('fire', this.pos[0] + Math.sin(this.yaw) * 0.7, this.pos[1] + 2.6,
        this.pos[2] + Math.cos(this.yaw) * 0.7, 1);
    }
  };
  Emberhusk.prototype.drawExtra = function (g) {
    if (this.exposed) {
      g.effects.pointLight(this.pos[0] + Math.sin(this.yaw) * 0.7, this.pos[1] + 2.6,
        this.pos[2] + Math.cos(this.yaw) * 0.7, [1, 0.55, 0.2], 2.6);
    }
  };

  /* ---------------------------------------------------------------- */
  /* Genmo -- shared rig                                               */
  /* ---------------------------------------------------------------- */
  function genmoRig(power) {
    /* Boss 2 is a teenager who has just found the power and has no idea what
       it is: ordinary build, ordinary clothes, one bad haircut. Boss 6 is the
       same person grown into it -- taller, armoured at the shoulder, and lit
       from inside. Keeping one rig for both makes the resemblance land. */
    var final = power >= 2;
    return LZ.Models.humanoid({
      build: final ? 'lanky' : 'teen',
      scale: final ? 1.42 : 1.02,
      skin: final ? 0xa4826a : 0xc09878,
      cloth: final ? 0x5c2c74 : 0x3a2a40,
      clothDark: final ? 0x2c1038 : 0x180a20,
      trim: final ? 0xf0c250 : 0x8a7a50,
      pants: final ? 0x2c2038 : 0x201828, boots: 0x181018,
      hair: final ? 0xf05a28 : 0x8a2a1a,
      hairStyle: final ? 'long' : 'ponytail',
      hat: 'none',
      clothTex: final ? 'evil' : 'clothPurple',
      skinTex: 'skinTan',
      hairTex: 'hairRed',
      glove: 0x2c2038, gloveTex: 'leatherDark',
      cape: true, capeColor: final ? 0x6a1c58 : 0x2a1830,
      pauldron: final ? 0x3c1450 : 0,
      eyeColor: 0xffb020, sash: final, sashColor: 0xf0c250
    });
  }

  /* ---------------------------------------------------------------- */
  /* 2. Genmo, Unmastered -- Stonebell Clock Tower                     */
  /* ---------------------------------------------------------------- */
  function GenmoYoung(g, o) {
    Boss.call(this, g, {
      x: o.x, y: o.y, z: o.z, hp: 20, radius: 0.42, height: 1.6,
      speed: 3.4, sight: 30, damage: 1,
      bossName: 'GENMO', maxPhase: 2, dungeon: 'clock'
    });
    this.setModel(LZ.charModel(g.r, 'genmo1', function () { return genmoRig(1); }, LZ.Models.getHumanoidClips()));
    this.height = 1.6;
    this.lockHeight = 1.0;
    this.flying = true;
    this.gravity = 0;
    this.hoverY = o.y + 3.2;
    this.mode = 'hover';
    this.modeTime = 0;
    this.vulnerable = false;   /* airborne: must be pulled down */
    this.grounded_ = false;
    this.music = 'genmo';
    this.phase = 1;
    this.play('float');
  }
  GenmoYoung.prototype = Object.create(Boss.prototype);
  GenmoYoung.prototype.constructor = GenmoYoung;
  GenmoYoung.prototype.hookPull = function (g) {
    if (this.mode === 'downed') return;
    this.mode = 'downed';
    this.modeTime = 0;
    this.vulnerable = true;
    this.flying = false;
    this.gravity = 22;
    this.play('hurt', { restart: true, blend: 0.08 });
    g.audio.sfx('roar');
    g.cam.addShake(0.3);
    g.hud.toast('He is down! Hit him!');
  };
  GenmoYoung.prototype.onPhase = function (g) {
    g.hud.toast('"You are STARTING to annoy me."');
    this.moveSpeed = 4.4;
  };
  GenmoYoung.prototype.brain = function (dt, g) {
    var p = g.player;
    this.modeTime += dt;
    var d = V3.distXZ(this.pos, p.pos);

    if (this.mode === 'downed') {
      this.speed = 0;
      this.floatOffset = 0;
      if (this.modeTime > (this.phase > 1 ? 2.6 : 3.4)) {
        this.mode = 'hover'; this.modeTime = 0;
        this.vulnerable = false;
        this.flying = true;
        this.gravity = 0;
        g.audio.sfx('warp');
        g.effects.puff(this.pos[0], this.pos[1] + 0.8, this.pos[2]);
        this.play('float', { blend: 0.2 });
      } else if (this.modeTime > 0.5) {
        this.play('kneel', { blend: 0.2 });
      }
      return;
    }

    /* hovering: circles and throws orbs; hookshot is the answer */
    this.pos[1] = M.damp(this.pos[1], this.hoverY + Math.sin(g.time * 1.6) * 0.35, 3, dt);
    this.faceTowards(p.pos[0], p.pos[2]);
    this.play('float', { blend: 0.25 });
    var ang = Math.atan2(this.pos[0] - p.pos[0], this.pos[2] - p.pos[2]) + dt * 0.5;
    var want = 6.0;
    var tx = p.pos[0] + Math.sin(ang) * want, tz = p.pos[2] + Math.cos(ang) * want;
    var dx = tx - this.pos[0], dz = tz - this.pos[2];
    var dl = Math.sqrt(dx * dx + dz * dz) || 1;
    this.moveXZ(dx / dl * this.moveSpeed * dt, dz / dl * this.moveSpeed * dt, g.world);

    this.attackCooldown -= dt;
    if (this.attackCooldown <= 0) {
      this.attackCooldown = this.phase > 1 ? 1.1 : 1.8;
      var n = this.phase > 1 ? 3 : 1;
      for (var i = 0; i < n; i++) {
        var spread = (i - (n - 1) / 2) * 0.24;
        var dir = V3.create(
          p.pos[0] - this.pos[0] + Math.sin(spread) * 3,
          (p.pos[1] + 0.8) - this.pos[1],
          p.pos[2] - this.pos[2] + Math.cos(spread) * 0.2);
        V3.normalize(dir, dir);
        g.spawnProjectile(this.pos[0], this.pos[1] + 0.6, this.pos[2], dir, {
          speed: 10, damage: 1, owner: this, kind: 'darkorb', life: 3, deflect: true
        });
      }
      g.audio.sfx('dark');
      this.play('throw', { restart: true, blend: 0.1 });
    }
    if (Math.random() < dt * 8) {
      g.particles.emit('dark', this.pos[0], this.pos[1] + 0.5, this.pos[2], 1, 0.5);
    }
  };
  GenmoYoung.prototype.drawExtra = function (g) {
    g.effects.pointLight(this.pos[0], this.pos[1] + 0.8, this.pos[2], [0.7, 0.3, 1.0], 2.2);
    if (this.mode !== 'downed') {
      g.effects.hookTarget(this.pos[0], this.pos[1] + 1.1, this.pos[2]);
    }
  };

  /* ---------------------------------------------------------------- */
  /* 3. Thornheart -- Elderwood Grove                                  */
  /* ---------------------------------------------------------------- */
  function thornRig() {
    return {
      height: 3.0, radius: 1.6,
      def: [
        { name: 'root' },
        { name: 'base', parent: 'root', offset: [0, 0, 0], mat: 'barkDead', build: function (mb) {
            /* a knuckled root ball, not a drum: it flares at the ground and
               pinches where the stalk leaves it */
            mb.setColorHex(0xd8c8ac);
            mb.tube([
              { y: 0.02, r: 1.55 }, { y: 0.28, r: 1.40 }, { y: 0.56, r: 1.08 },
              { y: 0.78, r: 0.80 }, { y: 0.94, r: 0.70 }
            ], 10, { v: 0.6, capStart: false });
            /* roots crawling out over the floor, each with a knuckle */
            for (var i = 0; i < 7; i++) {
              var a = i / 7 * M.TAU + 0.4;
              var sa = Math.sin(a), ca = Math.cos(a);
              var w = 0.86 + M.hash1(i, 7) * 0.5;
              mb.setColorHex(i & 1 ? 0xd0bfa2 : 0xc2b096);
              mb.tube([
                { x: sa * 0.85, y: 0.42, z: ca * 0.85, r: 0.26 },
                { x: sa * 1.30, y: 0.30, z: ca * 1.30, r: 0.21 },
                { x: sa * 1.70 * w, y: 0.16, z: ca * 1.70 * w, r: 0.24 },
                { x: sa * 2.15 * w, y: 0.07, z: ca * 2.15 * w, r: 0.13 },
                { x: sa * 2.50 * w, y: 0.02, z: ca * 2.50 * w, r: 0.03 }
              ], 6);
            }
          } },
        { name: 'stalk', parent: 'base', offset: [0, 0.90, 0], mat: 'leavesDark', build: function (mb) {
            /* the neck rears back then throws forward, so the head hangs out
               over the arena instead of sitting on a pole */
            mb.setColorHex(0xb4e08e);
            mb.tube([
              { y: 0.00, z: 0.00, r: 0.52 }, { y: 0.42, z: -0.18, r: 0.45 },
              { y: 0.86, z: -0.26, r: 0.41 }, { y: 1.28, z: -0.14, r: 0.38 },
              { y: 1.62, z: 0.16, r: 0.36 }, { y: 1.86, z: 0.52, r: 0.34 }
            ], 8, { v: 0.8 });
            /* a collar of drooping leaves where the neck leaves the root ball */
            mb.setColorHex(0xa4d080);
            for (var i = 0; i < 5; i++) {
              var a = i / 5 * M.TAU + 0.3;
              var sa = Math.sin(a), ca = Math.cos(a);
              mb.ribbon([
                { x: sa * 0.34, y: 0.14, z: ca * 0.34, w: 0.14 },
                { x: sa * 0.82, y: 0.10, z: ca * 0.82, w: 0.30 },
                { x: sa * 1.32, y: -0.10, z: ca * 1.32, w: 0.28 },
                { x: sa * 1.72, y: -0.44, z: ca * 1.72, w: 0.16 },
                { x: sa * 1.90, y: -0.72, z: ca * 1.90, w: 0.02 }
              ], [ca, 0, -sa], { curl: -0.4, v: 0.6 });
            }
          } },
        { name: 'petal', parent: 'stalk', offset: [0, 1.86, 0.42], mat: 'petalRed', build: function (mb) {
            /* the corolla radiates in the plane of the face, not around the
               neck, so the head reads as a flower staring straight at you */
            mb.setColorHex(0xffffff);
            for (var i = 0; i < 9; i++) {
              var a = i / 9 * M.TAU + 0.18;
              var sa = Math.sin(a), ca = Math.cos(a);
              mb.ribbon([
                { x: sa * 0.50, y: ca * 0.50, z: -0.10, w: 0.16 },
                { x: sa * 1.00, y: ca * 1.00, z: 0.10, w: 0.32 },
                { x: sa * 1.52, y: ca * 1.52, z: 0.22, w: 0.36 },
                { x: sa * 2.00, y: ca * 2.00, z: 0.18, w: 0.27 },
                { x: sa * 2.36, y: ca * 2.36, z: 0.02, w: 0.14 },
                { x: sa * 2.54, y: ca * 2.54, z: -0.14, w: 0.02 }
              ], [ca, -sa, 0], { curl: -0.5, v: 0.55 });
            }
          } },
        { name: 'bulb', parent: 'stalk', offset: [0, 1.86, 0.42], mat: 'leaves', build: function (mb) {
            /* the calyx: a cup opening forward along +z, so the throat inside
               it faces the player and the eye at the back of it is an honest,
               readable weak point */
            mb.setColorHex(0xd6f0a4);
            mb.tube([
              { z: -0.62, r: 0.20 }, { z: -0.42, r: 0.56 }, { z: -0.16, r: 0.82 },
              { z: 0.12, r: 0.96 }, { z: 0.34, r: 1.00 }
            ], 11, { axis: 'z', v: 0.8, capEnd: false });
          } },
        { name: 'throat', parent: 'bulb', offset: [0, 0, 0], mat: 'jellyRed', build: function (mb) {
            mb.setColorHex(0xf88c96);
            mb.tube([
              { z: -0.56, r: 0.08 }, { z: -0.34, r: 0.40 },
              { z: -0.06, r: 0.64 }, { z: 0.22, r: 0.78 }
            ], 11, { axis: 'z', v: 0.8, capEnd: false });
          } },
        { name: 'eye', parent: 'bulb', offset: [0, 0, -0.10], mat: 'glowGreen', build: function (mb) {
            mb.setColorHex(0xffffff);
            mb.ovoid(0, 0, 0, 0.42, 0.42, 0.34, 10, 7);
            mb.setColorHex(0x203808);
            mb.ovoid(0, 0, 0.26, 0.19, 0.19, 0.12, 8, 5);
          } },
        { name: 'jaw', parent: 'bulb', offset: [0, 0.96, -0.16], mat: 'leavesDark', build: function (mb) {
            /* the upper lid, hinged above the mouth: a negative x rotation
               throws it back and opens the maw */
            mb.setColorHex(0xb8dc8c);
            mb.tube([
              { y: 0.06, z: -0.10, rx: 0.30, rz: 0.12 },
              { y: -0.10, z: 0.14, rx: 0.72, rz: 0.26 },
              { y: -0.34, z: 0.30, rx: 0.94, rz: 0.30 },
              { y: -0.62, z: 0.30, rx: 0.92, rz: 0.26 },
              { y: -0.84, z: 0.20, rx: 0.66, rz: 0.16 }
            ], 9, { v: 0.8, capStart: false, capEnd: false });
            /* fangs along the lid's rim */
            mb.setColorHex(0xf4ecd4);
            for (var i = 0; i < 7; i++) {
              var a = -1.05 + i * 0.35;
              var fx = Math.sin(a) * 0.90, fy = -0.36 - Math.cos(a) * 0.52;
              mb.tube([
                { x: fx, y: fy, z: 0.26, r: 0.10 },
                { x: fx * 0.94, y: fy - 0.06, z: 0.48, r: 0.06 },
                { x: fx * 0.88, y: fy - 0.10, z: 0.64, r: 0.01 }
              ], 5, { axis: 'z' });
            }
          } },
        { name: 'vineL', parent: 'base', offset: [-1.15, 0.55, 0], mat: 'leavesDark', build: vineBuild(-1) },
        { name: 'vineR', parent: 'base', offset: [1.15, 0.55, 0], mat: 'leavesDark', build: vineBuild(1) }
      ]
    };
    function vineBuild(side) {
      return function (mb) {
        mb.setColorHex(0xa8d488);
        mb.tube([
          { y: 0.00, x: 0, r: 0.24 }, { y: 0.46, x: side * 0.12, r: 0.20 },
          { y: 0.92, x: side * 0.18, r: 0.17 }, { y: 1.36, x: side * 0.10, r: 0.14 },
          { y: 1.80, x: side * -0.06, r: 0.11 },
          { y: 2.10, x: side * -0.16, r: 0.07 }, { y: 2.30, x: side * -0.24, r: 0.01 }
        ], 7, { v: 0.9 });
        /* thorns spiralling up the whip */
        mb.setColorHex(0xd8c48a);
        for (var i = 0; i < 6; i++) {
          var t = 0.24 + i * 0.32;
          var a = i * 2.1;
          var sa = Math.sin(a), ca = Math.cos(a);
          var r = 0.20 - i * 0.02;
          mb.tube([
            { x: side * 0.14 * (t / 1.8) + sa * r * 0.5, y: t, z: ca * r * 0.5, r: 0.075 },
            { x: side * 0.14 * (t / 1.8) + sa * r * 1.7, y: t + 0.10, z: ca * r * 1.7, r: 0.01 }
          ], 5);
        }
      };
    }
  }
  var THORN_CLIPS = {
    idle: clip('idle', 3.4, true, {
      stalk: { r: [[0, 4, 0, 3], [1.7, -4, 0, -3], [3.4, 4, 0, 3]] },
      bulb: { r: [[0, 0, 6, 0], [1.7, 0, -6, 0], [3.4, 0, 6, 0]] },
      vineL: { r: [[0, -14, 0, -10], [1.7, -6, 0, -18], [3.4, -14, 0, -10]] },
      vineR: { r: [[0, -14, 0, 10], [1.7, -6, 0, 18], [3.4, -14, 0, 10]] }
    }),
    bite: clip('bite', 1.4, false, {
      stalk: { r: [[0, 0, 0, 0], [0.4, -34, 0, 0], [0.7, 40, 0, 0], [1.4, 0, 0, 0]] },
      jaw: { r: [[0, 0, 0, 0], [0.4, -30, 0, 0], [0.7, 20, 0, 0], [1.4, 0, 0, 0]] }
    }, { events: [{ t: 0.42, name: 'rear' }, { t: 0.7, name: 'bite' }] }),
    whip: clip('whip', 1.2, false, {
      vineL: { r: [[0, -14, 0, -10], [0.35, -60, 0, -40], [0.6, 40, 0, 40], [1.2, -14, 0, -10]] },
      vineR: { r: [[0, -14, 0, 10], [0.35, -60, 0, 40], [0.6, 40, 0, -40], [1.2, -14, 0, 10]] },
      stalk: { r: [[0, 0, 0, 0], [0.35, -14, 0, 0], [0.6, 14, 0, 0], [1.2, 0, 0, 0]] }
    }, { events: [{ t: 0.58, name: 'whip' }] }),
    open: clip('open', 3.0, false, {
      petal: { r: [[0, 0, 0, 0], [0.5, -50, 0, 0], [2.6, -50, 0, 0], [3.0, 0, 0, 0]] },
      jaw: { r: [[0, 0, 0, 0], [0.5, -60, 0, 0], [2.6, -60, 0, 0], [3.0, 0, 0, 0]] },
      stalk: { r: [[0, 0, 0, 0], [0.5, 20, 0, 0], [2.6, 20, 0, 0], [3.0, 0, 0, 0]] }
    }, { events: [{ t: 0.5, name: 'expose' }, { t: 2.6, name: 'close' }] }),
    hurt: clip('hurt', 0.5, false, { stalk: { r: [[0, 0, 0, 0], [0.12, 26, 0, 0], [0.5, 0, 0, 0]] } }),
    cut: clip('cut', 2.4, false, {
      stalk: { r: [[0, 0, 0, 0], [0.3, 46, 0, 0], [2.0, 44, 0, 0], [2.4, 0, 0, 0]] },
      petal: { r: [[0, 0, 0, 0], [0.3, -60, 0, 0], [2.0, -60, 0, 0], [2.4, 0, 0, 0]] },
      jaw: { r: [[0, 0, 0, 0], [0.3, -70, 0, 0], [2.0, -70, 0, 0], [2.4, 0, 0, 0]] },
      vineL: { r: [[0, -14, 0, -10], [0.3, 40, 0, -70], [2.4, -14, 0, -10]] },
      vineR: { r: [[0, -14, 0, 10], [0.3, 40, 0, 70], [2.4, -14, 0, 10]] }
    })
  };
  THORN_CLIPS.walk = THORN_CLIPS.run = THORN_CLIPS.idle;

  function Thornheart(g, o) {
    Boss.call(this, g, {
      x: o.x, y: o.y, z: o.z, hp: 26, radius: 1.5, height: 3.0,
      speed: 0, sight: 22, damage: 1, contact: 0,
      bossName: 'THORNHEART, THE ROOTED HUNGER', maxPhase: 2, dungeon: 'grove'
    });
    this.setModel(LZ.charModel(g.r, 'thornheart', thornRig, THORN_CLIPS));
    this.height = 3.0;
    this.lockHeight = 2.4;
    this.vulnerable = false;
    this.mode = 'idle';
    this.modeTime = 0;
    this.attackTimer = 1.6;
    this.vinesCut = 0;
    this.music = 'boss';
    this.play('idle');
    this.anim.onEvent = (function (self) {
      return function (n) {
        var gg = self.game;
        if (n === 'rear') gg.audio.sfx('roar');
        if (n === 'bite') {
          gg.audio.sfx('hit');
          gg.cam.addShake(0.2);
          if (V3.distXZ(self.pos, gg.player.pos) < 3.4) gg.player.damage(1, self, { knockback: 8 });
        }
        if (n === 'whip') {
          gg.audio.sfx('swing_heavy');
          gg.effects.ring(self.pos[0], self.pos[1] + 0.4, self.pos[2], [0.5, 0.9, 0.4, 0.8], 8);
          var d = V3.distXZ(self.pos, gg.player.pos);
          if (d > 2.0 && d < 5.4 && gg.player.grounded) gg.player.damage(1, self, { knockback: 9 });
        }
        if (n === 'expose') { self.vulnerable = true; }
        if (n === 'close') { self.vulnerable = false; }
      };
    })(this);
  }
  Thornheart.prototype = Object.create(Boss.prototype);
  Thornheart.prototype.constructor = Thornheart;
  Thornheart.prototype.boomerangHit = function (g) {
    /* the Gale Boomerang shears the vines and forces it open */
    if (this.mode === 'cut') return;
    this.vinesCut++;
    this.mode = 'cut';
    this.modeTime = 0;
    this.vulnerable = true;
    this.play('cut', { restart: true, blend: 0.1 });
    g.audio.sfx('swing_heavy');
    g.particles.emit('leaf', this.pos[0], this.pos[1] + 2.0, this.pos[2], 14, [0.4, 0.7, 0.3, 1]);
    g.hud.toast('The vines fall away!');
  };
  Thornheart.prototype.onPhase = function (g) {
    g.hud.toast('Thornheart shrieks and splits its petals.');
    this.attackTimer = 0.6;
  };
  Thornheart.prototype.brain = function (dt, g) {
    var p = g.player;
    this.modeTime += dt;
    var d = V3.distXZ(this.pos, p.pos);
    this.faceTowards(p.pos[0], p.pos[2]);
    this.turnSpeed = 2.4;

    if (this.mode === 'cut') {
      if (this.modeTime > 2.4) { this.mode = 'idle'; this.modeTime = 0; this.vulnerable = false; }
      return;
    }
    if (this.mode !== 'idle') {
      if (this.modeTime > (this.mode === 'open' ? 3.0 : (this.mode === 'bite' ? 1.4 : 1.2))) {
        this.mode = 'idle'; this.modeTime = 0;
      }
      return;
    }
    this.play('idle', { blend: 0.3 });
    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      this.attackTimer = this.phase > 1 ? 1.7 : 2.6;
      if (d < 3.6) { this.mode = 'bite'; this.play('bite', { restart: true, blend: 0.1 }); }
      else if (d < 6.0) { this.mode = 'whip'; this.play('whip', { restart: true, blend: 0.1 }); }
      else {
        this.mode = 'spit';
        this.modeTime = 0;
        var dir = V3.create(p.pos[0] - this.pos[0], 0.35, p.pos[2] - this.pos[2]);
        V3.normalize(dir, dir);
        for (var i = 0; i < (this.phase > 1 ? 3 : 2); i++) {
          var a = Math.atan2(dir[0], dir[2]) + (i - 0.5) * 0.32;
          g.spawnProjectile(this.pos[0], this.pos[1] + 2.6, this.pos[2],
            V3.create(Math.sin(a), 0.3, Math.cos(a)), {
              speed: 9, damage: 0.5, owner: this, kind: 'seed', gravity: 10, life: 3
            });
        }
        g.audio.sfx('swing');
        this.play('bite', { restart: true, blend: 0.1 });
      }
    }
    if (Math.random() < dt * 1.5) {
      g.particles.emit('leaf', this.pos[0] + (Math.random() - 0.5) * 3, this.pos[1] + 2.4,
        this.pos[2] + (Math.random() - 0.5) * 3, 1, [0.4, 0.7, 0.3, 1]);
    }
  };
  Thornheart.prototype.drawExtra = function (g) {
    if (!this.vulnerable) g.effects.boomTarget(this.pos[0], this.pos[1] + 1.3, this.pos[2]);
  };

  /* ---------------------------------------------------------------- */
  /* 4. Tidewrought -- Lake Nial                                       */
  /* ---------------------------------------------------------------- */
  function serpentRig() {
    /* The body is a chain of overlapping barrels rather than one aligned tube.
       Segment bones swing on y for the swim wave, so their geometry cannot
       assume a fixed heading -- overlapping ovoids read as a rope of muscle
       from every angle, which is exactly how N64 serpents were built. The
       chain offsets trace an S: head reared high, body arcing down and back. */
    var CHAIN = [
      [0, 1.55, 0.90], [0, -0.05, -0.95], [0, -0.25, -0.95],
      [0, -0.40, -0.90], [0, -0.30, -0.90], [0, -0.05, -0.95], [0, 0.25, -0.95]
    ];
    var def = [{ name: 'root' }];
    var prev = 'root';
    for (var i = 0; i < CHAIN.length; i++) {
      (function (i, prev) {
        def.push({
          name: 'seg' + i, parent: prev, offset: CHAIN[i], mat: 'scaleBlue',
          build: function (mb) {
            var r = 0.70 - i * 0.072;
            mb.setColorHex(0xffffff);
            mb.ovoid(0, 0, 0, r * 1.05, r, r * 1.18, 9, 7);
            /* a second, smaller bead bridging toward the next segment, so the
               chain never shows a gap when the wave bends it */
            if (i < CHAIN.length - 1) mb.ovoid(0, -0.14, -0.44, r * 0.88, r * 0.82, r * 0.94, 8, 6);
            /* dorsal ridge */
            mb.setColorHex(0x8ad0e8);
            mb.ribbon([
              { x: 0, y: r * 0.82, z: r * 0.90, w: 0.02 },
              { x: 0, y: r * 1.18, z: r * 0.25, w: 0.02 },
              { x: 0, y: r * 1.34, z: -r * 0.35, w: 0.02 },
              { x: 0, y: r * 1.00, z: -r * 1.00, w: 0.02 }
            ], [0, 0, 1], { v: 0.7 });
            /* paddle fins on the first two coils */
            if (i < 3) {
              mb.setColorHex(0x8ad0e8);
              for (var sd = -1; sd <= 1; sd += 2) {
                mb.ribbon([
                  { x: sd * r * 0.80, y: -0.10, z: 0.05, w: 0.20 },
                  { x: sd * (r + 0.34), y: -0.30, z: -0.10, w: 0.26 },
                  { x: sd * (r + 0.62), y: -0.52, z: -0.28, w: 0.18 },
                  { x: sd * (r + 0.78), y: -0.68, z: -0.42, w: 0.02 }
                ], [0, 0, 1], { curl: 0.3, v: 0.7 });
              }
            }
          }
        });
      })(i, prev);
      prev = 'seg' + i;
    }
    def.push({
      name: 'head', parent: 'seg0', offset: [0, 0.34, 0.92], mat: 'scaleBlue',
      build: function (mb) {
        /* skull swept along +z: wide at the cheeks, pinching to a blunt snout,
           and dipping as it goes so the face angles down at the player */
        mb.setColorHex(0xffffff);
        mb.tube([
          { z: -0.52, y: 0.06, rx: 0.66, ry: 0.60 },
          { z: -0.06, y: 0.06, rx: 0.80, ry: 0.70 },
          { z: 0.40, y: -0.06, rx: 0.64, ry: 0.55 },
          { z: 0.82, y: -0.22, rx: 0.42, ry: 0.35 },
          { z: 1.06, y: -0.36, rx: 0.20, ry: 0.17 }
        ], 9, { axis: 'z', v: 0.8 });
        /* lower jaw slung under the snout */
        mb.setColorHex(0xf0f4ff);
        mb.tube([
          { z: -0.18, y: -0.42, rx: 0.46, ry: 0.19 },
          { z: 0.36, y: -0.48, rx: 0.38, ry: 0.16 },
          { z: 0.88, y: -0.56, rx: 0.19, ry: 0.09 }
        ], 7, { axis: 'z' });
        mb.setColorHex(0xf4f8ff);
        for (var i = 0; i < 6; i++) {
          var t = i / 5;
          var sd = i < 3 ? -1 : 1;
          var zz = -0.02 + (i % 3) * 0.28;
          mb.tube([
            { x: sd * 0.40, y: -0.28, z: zz * 1.3, r: 0.07 },
            { x: sd * 0.36, y: -0.06, z: zz * 1.3, r: 0.02 }
          ], 4);
        }
        /* brow horns sweeping back over the eyes */
        mb.setColorHex(0x74a4c0);
        for (var sd2 = -1; sd2 <= 1; sd2 += 2) {
          mb.tube([
            { x: sd2 * 0.42, y: 0.50, z: -0.14, r: 0.14 },
            { x: sd2 * 0.62, y: 0.74, z: -0.46, r: 0.09 },
            { x: sd2 * 0.76, y: 0.84, z: -0.82, r: 0.01 }
          ], 5);
        }
      }
    });
    def.push({
      name: 'eyes', parent: 'head', offset: [0, 0.20, 0.16], mat: 'glowBlue',
      build: function (mb) {
        mb.setColorHex(0xffffff);
        mb.ovoid(-0.52, 0, 0.10, 0.20, 0.19, 0.17, 8, 6);
        mb.ovoid(0.52, 0, 0.10, 0.20, 0.19, 0.17, 8, 6);
        mb.setColorHex(0x101c2c);
        mb.ovoid(-0.60, 0, 0.20, 0.08, 0.13, 0.07, 6, 4);
        mb.ovoid(0.60, 0, 0.20, 0.08, 0.13, 0.07, 6, 4);
      }
    });
    def.push({
      name: 'crest', parent: 'head', offset: [0, 0.48, -0.24], mat: 'gemBlue',
      build: function (mb) {
        /* a swept-back membrane crest */
        mb.setColorHex(0x90e0ff);
        mb.ribbon([
          { x: 0, y: 0.00, z: 0.10, w: 0.16 },
          { x: 0, y: 0.32, z: -0.14, w: 0.30 },
          { x: 0, y: 0.58, z: -0.44, w: 0.26 },
          { x: 0, y: 0.70, z: -0.74, w: 0.12 },
          { x: 0, y: 0.72, z: -0.92, w: 0.01 }
        ], [1, 0, 0], { v: 0.7 });
      }
    });
    return { height: 2.6, radius: 1.0, def: def };
  }
  var SERP_CLIPS = (function () {
    var tracks = {};
    for (var i = 0; i < 7; i++) {
      var ph = i * 0.22;
      tracks['seg' + i] = { r: [[0, 0, Math.sin(ph) * 16, 0], [0.9, 0, Math.sin(ph + 1.6) * 16, 0], [1.8, 0, Math.sin(ph) * 16, 0]] };
    }
    var swim = clip('swim', 1.8, true, tracks);
    var rear = clip('rear', 2.0, false, {
      seg0: { r: [[0, 0, 0, 0], [0.6, -34, 0, 0], [1.6, -34, 0, 0], [2.0, 0, 0, 0]] },
      seg1: { r: [[0, 0, 0, 0], [0.6, -26, 0, 0], [1.6, -26, 0, 0], [2.0, 0, 0, 0]] },
      head: { r: [[0, 0, 0, 0], [0.6, 30, 0, 0], [1.6, 26, 0, 0], [2.0, 0, 0, 0]] }
    }, { events: [{ t: 0.62, name: 'rear' }, { t: 1.6, name: 'drop' }] });
    var bite = clip('bite', 1.1, false, {
      seg0: { r: [[0, 0, 0, 0], [0.3, -40, 0, 0], [0.55, 30, 0, 0], [1.1, 0, 0, 0]] },
      head: { r: [[0, 0, 0, 0], [0.3, -30, 0, 0], [0.55, 40, 0, 0], [1.1, 0, 0, 0]] }
    }, { events: [{ t: 0.55, name: 'bite' }] });
    var hurt = clip('hurt', 0.5, false, { head: { r: [[0, 0, 0, 0], [0.12, 34, 0, 0], [0.5, 0, 0, 0]] } });
    return { idle: swim, swim: swim, walk: swim, run: swim, rear: rear, bite: bite, hurt: hurt };
  })();

  function Tidewrought(g, o) {
    Boss.call(this, g, {
      x: o.x, y: o.y, z: o.z, hp: 28, radius: 1.1, height: 2.4,
      speed: 4.2, sight: 30, damage: 1.5, contact: 0,
      bossName: 'TIDEWROUGHT, THE DROWNED CHOIR', maxPhase: 3, dungeon: 'lake'
    });
    this.setModel(LZ.charModel(g.r, 'tidewrought', serpentRig, SERP_CLIPS));
    this.flying = true;
    this.gravity = 0;
    this.height = 2.4;
    this.lockHeight = 1.6;
    this.waterLevel = o.water === undefined ? o.y : o.water;
    this.submerged = true;
    this.vulnerable = false;
    this.mode = 'circle';
    this.modeTime = 0;
    this.music = 'boss';
    this.play('swim');
    this.anim.onEvent = (function (self) {
      return function (n) {
        var gg = self.game;
        if (n === 'rear') { self.vulnerable = true; gg.hud.toast('Its crest is exposed!'); }
        if (n === 'drop') { self.vulnerable = false; }
        if (n === 'bite') {
          gg.audio.sfx('hit');
          if (V3.distXZ(self.pos, gg.player.pos) < 3.2) gg.player.damage(1.5, self, { knockback: 10 });
        }
      };
    })(this);
  }
  Tidewrought.prototype = Object.create(Boss.prototype);
  Tidewrought.prototype.constructor = Tidewrought;
  Tidewrought.prototype.iceHit = function (g) {
    /* the Rime Rod locks it in place and forces the crest up */
    if (this.mode === 'frozen') return;
    this.mode = 'frozen';
    this.modeTime = 0;
    this.vulnerable = true;
    this.frozenVisual = 2.6;
    this.play('rear', { restart: true, blend: 0.1 });
    g.audio.sfx('ice');
    g.hud.toast('Frozen! Strike the crest!');
  };
  Tidewrought.prototype.onPhase = function (g, p) {
    g.hud.toast('The water turns black.');
    this.moveSpeed += 1.2;
    g.cam.addShake(0.35);
  };
  Tidewrought.prototype.brain = function (dt, g) {
    var p = g.player;
    this.modeTime += dt;
    var d = V3.distXZ(this.pos, p.pos);

    if (this.mode === 'frozen') {
      this.tint = [0.6, 0.85, 1, 0.5];
      if (this.modeTime > 2.6) { this.mode = 'circle'; this.modeTime = 0; this.vulnerable = false; this.tint = [0, 0, 0, 0]; }
      return;
    }
    this.tint = [0, 0, 0, 0];

    if (this.mode === 'rear') {
      this.pos[1] = M.damp(this.pos[1], this.waterLevel + 1.6, 5, dt);
      this.faceTowards(p.pos[0], p.pos[2]);
      if (this.modeTime > 2.0) { this.mode = 'circle'; this.modeTime = 0; }
      return;
    }
    if (this.mode === 'bite') {
      this.pos[1] = M.damp(this.pos[1], this.waterLevel + 0.7, 6, dt);
      this.stepToward(dt, g, p.pos[0], p.pos[2], this.moveSpeed * 1.4);
      if (this.modeTime > 1.1) { this.mode = 'circle'; this.modeTime = 0; }
      return;
    }

    /* circling just under the surface, throwing spouts */
    this.pos[1] = M.damp(this.pos[1], this.waterLevel - 0.55, 4, dt);
    this.play('swim', { blend: 0.3, speed: 1.2 });
    var ang = Math.atan2(this.pos[0] - p.pos[0], this.pos[2] - p.pos[2]) + dt * 0.85;
    var want = 7.5;
    this.stepToward(dt, g, p.pos[0] + Math.sin(ang) * want, p.pos[2] + Math.cos(ang) * want, this.moveSpeed);
    if (Math.random() < dt * 5) {
      g.particles.emit('splash', this.pos[0], this.waterLevel, this.pos[2], 2, [0.7, 0.85, 1, 0.8]);
    }
    this.attackCooldown -= dt;
    if (this.attackCooldown <= 0) {
      this.attackCooldown = this.phase > 1 ? 1.9 : 2.8;
      var roll = Math.random();
      if (d < 5) { this.mode = 'bite'; this.modeTime = 0; this.play('bite', { restart: true, blend: 0.1 }); }
      else if (roll < 0.4) { this.mode = 'rear'; this.modeTime = 0; this.play('rear', { restart: true, blend: 0.1 }); }
      else {
        var n = this.phase > 1 ? 5 : 3;
        for (var i = 0; i < n; i++) {
          var a = Math.atan2(p.pos[0] - this.pos[0], p.pos[2] - this.pos[2]) + (i - (n - 1) / 2) * 0.26;
          g.spawnProjectile(this.pos[0], this.waterLevel + 0.4, this.pos[2],
            V3.create(Math.sin(a), 0.32, Math.cos(a)), {
              speed: 11, damage: 1, owner: this, kind: 'water', gravity: 9, life: 3
            });
        }
        g.audio.sfx('splash');
      }
    }
  };
  Tidewrought.prototype.drawExtra = function (g) {
    if (!this.vulnerable) g.effects.iceTarget(this.pos[0], this.pos[1] + 1.0, this.pos[2]);
  };

  /* ---------------------------------------------------------------- */
  /* 5. The Hollow King -- Sunken Hollow                               */
  /* ---------------------------------------------------------------- */
  function hollowRig() {
    /* A king with no legs. The silhouette has to do all the work, so the robe
       is a tall bell that pinches into a hood, and every surface detail sits
       at the radius the bell actually has at that height -- the classic way to
       lose a face on a rounded body is to place it at a flat z offset and let
       the body swallow it. */
    var ROBE = [
      { y: -1.95, r: 0.03 }, { y: -1.55, r: 0.26 }, { y: -1.15, r: 0.56 },
      { y: -0.75, r: 0.84 }, { y: -0.38, r: 0.98 }, { y: 0.00, r: 0.88 },
      { y: 0.30, r: 0.74 }, { y: 0.58, r: 0.42 }, { y: 0.88, r: 0.60 },
      { y: 1.14, r: 0.56 }, { y: 1.38, r: 0.32 }, { y: 1.52, r: 0.08 }
    ];
    return {
      height: 2.6, radius: 0.8,
      def: [
        { name: 'root' },
        { name: 'body', parent: 'root', offset: [0, 1.5, 0], mat: 'evil', build: function (mb) {
            mb.setColorHex(0xffffff);
            mb.tube(ROBE, 11, { v: 0.45 });
            /* sleeves hanging where arms would be, tapering to nothing */
            for (var sd = -1; sd <= 1; sd += 2) {
              mb.tube([
                { x: sd * 0.58, y: 0.30, z: 0.02, r: 0.26 },
                { x: sd * 0.84, y: -0.06, z: 0.08, r: 0.22 },
                { x: sd * 0.92, y: -0.46, z: 0.14, r: 0.16 },
                { x: sd * 0.88, y: -0.76, z: 0.18, r: 0.03 }
              ], 7);
            }
            /* a mantle over the shoulders, so the hood reads as separate */
            mb.setColorHex(0xb8a0d8);
            mb.tube([
              { y: 0.46, r: 0.56 }, { y: 0.34, r: 0.80 }, { y: 0.18, r: 0.88 }
            ], 11, { capStart: false, capEnd: false });
          } },
        { name: 'crown', parent: 'body', offset: [0, 1.16, 0], mat: 'gold', build: function (mb) {
            mb.setColorHex(0xf0cc60);
            mb.tube([
              { y: -0.12, r: 0.50 }, { y: 0.04, r: 0.56 }, { y: 0.20, r: 0.52 }
            ], 11, { capStart: false, capEnd: false });
            for (var i = 0; i < 6; i++) {
              var a = i / 6 * M.TAU;
              var sa = Math.sin(a), ca = Math.cos(a);
              var h = i % 2 ? 0.30 : 0.52;
              mb.tube([
                { x: sa * 0.50, y: 0.16, z: ca * 0.50, r: 0.11 },
                { x: sa * 0.47, y: 0.16 + h * 0.6, z: ca * 0.47, r: 0.06 },
                { x: sa * 0.44, y: 0.16 + h, z: ca * 0.44, r: 0.01 }
              ], 5);
            }
          } },
        { name: 'face', parent: 'body', offset: [0, 0.94, 0.44], mat: 'bone', build: function (mb) {
            /* a bone mask floating in the mouth of the hood: a curved shell
               pushed clear of the robe, not a plate sunk into it */
            mb.setColorHex(0xf4ecd8);
            mb.tube([
              { z: -0.06, rx: 0.28, ry: 0.34 },
              { z: 0.12, rx: 0.34, ry: 0.40 },
              { z: 0.28, rx: 0.30, ry: 0.35 },
              { z: 0.38, rx: 0.18, ry: 0.20 }
            ], 9, { axis: 'z', capStart: false });
            mb.setColorHex(0x1a0e22);
            mb.ovoid(0, -0.22, 0.30, 0.14, 0.06, 0.05, 7, 4);
          } },
        { name: 'gaze', parent: 'face', offset: [0, 0.10, 0.26], mat: 'glowPurple', build: function (mb) {
            mb.setColorHex(0xffffff);
            mb.ovoid(-0.15, 0, 0, 0.08, 0.07, 0.06, 6, 4);
            mb.ovoid(0.15, 0, 0, 0.08, 0.07, 0.06, 6, 4);
          } },
        { name: 'lampL', parent: 'body', offset: [-1.05, 0.05, 0.30], mat: 'glowBlue', build: lampBuild },
        { name: 'lampR', parent: 'body', offset: [1.05, 0.05, 0.30], mat: 'glowRed', build: lampBuild }
      ]
    };
    function lampBuild(mb) {
      mb.setColorHex(0xffffff);
      mb.ovoid(0, 0, 0, 0.24, 0.30, 0.24, 8, 6);
      mb.ovoid(0, 0.30, 0, 0.07, 0.11, 0.07, 5, 4);
    }
  }
  var HOLLOW_CLIPS = {
    idle: clip('idle', 3.6, true, {
      root: { t: [[0, 0, 0, 0], [1.8, 0, 0.35, 0], [3.6, 0, 0, 0]] },
      body: { r: [[0, 0, 0, 3], [1.8, 0, 0, -3], [3.6, 0, 0, 3]] },
      lampL: { t: [[0, 0, 0, 0], [1.8, -0.16, 0.2, 0], [3.6, 0, 0, 0]] },
      lampR: { t: [[0, 0, 0, 0], [1.8, 0.16, -0.2, 0], [3.6, 0, 0, 0]] }
    }),
    cast: clip('cast', 1.4, false, {
      body: { r: [[0, 0, 0, 0], [0.4, -20, 0, 0], [0.8, 16, 0, 0], [1.4, 0, 0, 0]] },
      lampL: { t: [[0, 0, 0, 0], [0.4, 0.3, 0.5, 0], [0.8, -0.2, -0.2, 0.6], [1.4, 0, 0, 0]] },
      lampR: { t: [[0, 0, 0, 0], [0.4, -0.3, 0.5, 0], [0.8, 0.2, -0.2, 0.6], [1.4, 0, 0, 0]] }
    }, { events: [{ t: 0.8, name: 'cast' }] }),
    hurt: clip('hurt', 0.5, false, { body: { r: [[0, 0, 0, 0], [0.12, 24, 0, 0], [0.5, 0, 0, 0]] } })
  };
  HOLLOW_CLIPS.walk = HOLLOW_CLIPS.run = HOLLOW_CLIPS.idle;

  function HollowKing(g, o) {
    Boss.call(this, g, {
      x: o.x, y: o.y, z: o.z, hp: 30, radius: 0.8, height: 2.6,
      speed: 3.6, sight: 30, damage: 1.5,
      bossName: 'THE HOLLOW KING', maxPhase: 3, dungeon: 'hollow'
    });
    this.setModel(LZ.charModel(g.r, 'hollowking', hollowRig, HOLLOW_CLIPS));
    this.flying = true; this.gravity = 0;
    this.hoverY = o.y + 1.0;
    this.lockHeight = 1.6;
    this.clones = [];
    this.isClone = false;
    this.music = 'boss';
    this.phaseSetup = false;
    this.play('idle');
    this.anim.onEvent = (function (self) {
      return function (n) { if (n === 'cast') self.fireVolley(self.game); };
    })(this);
  }
  HollowKing.prototype = Object.create(Boss.prototype);
  HollowKing.prototype.constructor = HollowKing;
  HollowKing.prototype.fireVolley = function (g) {
    var p = g.player;
    var n = this.phase >= 2 ? 5 : 3;
    for (var i = 0; i < n; i++) {
      var a = Math.atan2(p.pos[0] - this.pos[0], p.pos[2] - this.pos[2]) + (i - (n - 1) / 2) * 0.3;
      g.spawnProjectile(this.pos[0], this.pos[1] + 1.2, this.pos[2],
        V3.create(Math.sin(a), 0.06, Math.cos(a)), {
          speed: 9, damage: 1, owner: this, kind: 'soulflame', life: 3.4, homing: this.phase >= 3 ? 0.9 : 0
        });
    }
    g.audio.sfx('dark');
  };
  HollowKing.prototype.onPhase = function (g, ph) {
    g.hud.toast('The King splits his lanterns.');
    g.audio.sfx('warp');
    g.cam.addShake(0.3);
  };
  HollowKing.prototype.brain = function (dt, g) {
    var p = g.player;
    this.stateTime += dt;
    /* invisible without the Lens; it flickers when it casts */
    var lens = p.lensOn;
    var casting = this.animName() === 'cast';
    this.alpha = lens ? 0.9 : (casting ? 0.55 : 0.10);
    this.lockable = lens || casting;
    this.vulnerable = lens || casting;

    this.pos[1] = M.damp(this.pos[1], this.hoverY + Math.sin(g.time * 1.2) * 0.4, 3, dt);
    this.faceTowards(p.pos[0], p.pos[2]);

    if (this.animName() === 'cast' && !this.anim.finished) return;
    this.play('idle', { blend: 0.3 });

    var ang = Math.atan2(this.pos[0] - p.pos[0], this.pos[2] - p.pos[2]) + dt * 0.7;
    var want = 6.5;
    this.stepToward(dt, g, p.pos[0] + Math.sin(ang) * want, p.pos[2] + Math.cos(ang) * want, this.moveSpeed);

    this.attackCooldown -= dt;
    if (this.attackCooldown <= 0) {
      this.attackCooldown = this.phase >= 2 ? 1.6 : 2.4;
      if (Math.random() < 0.3) {
        var a2 = Math.random() * M.TAU;
        this.pos[0] = p.pos[0] + Math.cos(a2) * 7;
        this.pos[2] = p.pos[2] + Math.sin(a2) * 7;
        g.effects.puff(this.pos[0], this.pos[1], this.pos[2]);
        g.audio.sfx('warp');
      } else {
        this.play('cast', { restart: true, blend: 0.1 });
      }
    }
    if (Math.random() < dt * 6) g.particles.emit('dark', this.pos[0], this.pos[1], this.pos[2], 1, 0.7);
  };
  HollowKing.prototype.drawExtra = function (g) {
    g.effects.pointLight(this.pos[0], this.pos[1] + 1.2, this.pos[2], [0.5, 0.35, 0.9], 2.4);
  };

  /* ---------------------------------------------------------------- */
  /* 6. Genmo Ascended -- the Fortress                                 */
  /* ---------------------------------------------------------------- */
  function GenmoFinal(g, o) {
    Boss.call(this, g, {
      x: o.x, y: o.y, z: o.z, hp: 44, radius: 0.62, height: 2.3,
      speed: 4.6, sight: 40, damage: 2,
      bossName: 'GENMO, HEIR OF THE DARK', maxPhase: 3, dungeon: 'fortress'
    });
    this.setModel(LZ.charModel(g.r, 'genmo2', function () { return genmoRig(2); }, LZ.Models.getHumanoidClips()));
    this.height = 2.3;
    this.lockHeight = 1.4;
    this.music = 'genmo';
    this.mode = 'ground';
    this.modeTime = 0;
    this.attackCooldown = 1.6;
    this.weaponMesh = g.enemyWeaponMesh('darkblade');
    this.guardArc = 0;
    this.play('idleAlert');
    this.hitboxOn = false;
  }
  GenmoFinal.prototype = Object.create(Boss.prototype);
  GenmoFinal.prototype.constructor = GenmoFinal;

  GenmoFinal.prototype.onPhase = function (g, ph) {
    var lines = {
      2: '"You have his eyes. I hate his eyes."',
      3: '"ENOUGH. I will finish what my blood started."'
    };
    if (lines[ph]) g.hud.toast(lines[ph]);
    g.audio.sfx('roar');
    g.cam.addShake(0.5);
    this.moveSpeed = 4.6 + ph * 0.7;
    this.mode = 'reel';
    this.modeTime = 0;
    this.vulnerable = false;
    this.play('stagger', { restart: true, blend: 0.1 });
  };

  GenmoFinal.prototype.brain = function (dt, g) {
    var p = g.player;
    this.modeTime += dt;
    var d = V3.distXZ(this.pos, p.pos);
    this.faceTowards(p.pos[0], p.pos[2]);

    if (this.mode === 'reel') {
      this.speed = 0;
      this.flying = false;
      if (this.modeTime > 1.6) {
        this.mode = this.phase >= 2 ? 'air' : 'ground';
        this.modeTime = 0;
        this.vulnerable = true;
        if (this.mode === 'air') { this.flying = true; this.gravity = 0; }
      }
      return;
    }

    if (this.mode === 'air') {
      /* airborne: beams that the Mirror Shield can send back */
      this.flying = true; this.gravity = 0;
      this.pos[1] = M.damp(this.pos[1], this.spawnY + 3.4 + Math.sin(g.time * 1.4) * 0.4, 3, dt);
      var ang = Math.atan2(this.pos[0] - p.pos[0], this.pos[2] - p.pos[2]) + dt * 0.75;
      this.stepToward(dt, g, p.pos[0] + Math.sin(ang) * 7.5, p.pos[2] + Math.cos(ang) * 7.5, this.moveSpeed);
      this.play('float', { blend: 0.25 });
      this.attackCooldown -= dt;
      if (this.attackCooldown <= 0) {
        this.attackCooldown = this.phase >= 3 ? 1.0 : 1.5;
        var dir = V3.create(p.pos[0] - this.pos[0], (p.pos[1] + 0.9) - this.pos[1], p.pos[2] - this.pos[2]);
        V3.normalize(dir, dir);
        g.spawnProjectile(this.pos[0], this.pos[1] + 0.8, this.pos[2], dir, {
          speed: 13, damage: 2, owner: this, kind: 'darkbeam', reflect: true, life: 3
        });
        g.audio.sfx('magic');
        this.play('cast', { restart: true, blend: 0.1 });
      }
      if (this.modeTime > 9 || this.reflected) {
        this.reflected = false;
        this.mode = 'ground'; this.modeTime = 0;
        this.flying = false; this.gravity = 22;
        g.audio.sfx('roar');
      }
      if (Math.random() < dt * 10) g.particles.emit('dark', this.pos[0], this.pos[1] + 0.6, this.pos[2], 1, 0.7);
      return;
    }

    /* ground: aggressive melee with a readable windup */
    if (this.mode === 'windup') {
      this.speed = 0;
      this.tint = [1, 0.3, 0.3, 0.24 + Math.sin(this.modeTime * 30) * 0.12];
      if (this.modeTime > 0.42) {
        this.mode = 'strike'; this.modeTime = 0;
        this.tint = [0, 0, 0, 0];
        this.hitboxOn = true;
        this.play('attack1', { restart: true, blend: 0.05, speed: 1.5 });
        g.audio.sfx('swing_heavy');
      }
      return;
    }
    if (this.mode === 'strike') {
      this.moveXZ(Math.sin(this.yaw) * 8 * dt, Math.cos(this.yaw) * 8 * dt, g.world);
      if (this.hitboxOn && d < 2.2) {
        if (p.damage(2, this, { knockback: 11 })) this.hitboxOn = false;
      }
      if (this.modeTime > 0.34) { this.mode = 'ground'; this.modeTime = 0; this.hitboxOn = false; this.attackCooldown = 0.9; }
      return;
    }
    if (this.mode === 'dash') {
      var dl = this.modeTime / 0.45;
      this.alpha = dl < 0.8 ? 0.3 : 1;
      if (this.modeTime > 0.45) {
        this.alpha = 1;
        var a2 = Math.random() * M.TAU;
        this.pos[0] = p.pos[0] + Math.cos(a2) * 2.4;
        this.pos[2] = p.pos[2] + Math.sin(a2) * 2.4;
        g.effects.puff(this.pos[0], this.pos[1] + 1, this.pos[2]);
        g.audio.sfx('warp');
        this.mode = 'windup'; this.modeTime = 0;
      }
      return;
    }

    this.flying = false;
    if (d > 2.4) {
      this.stepToward(dt, g, p.pos[0], p.pos[2], this.moveSpeed);
      this.play('run', { blend: 0.14 });
    } else {
      this.speed = 0;
      this.play('idleAlert', { blend: 0.2 });
    }
    this.attackCooldown -= dt;
    if (this.attackCooldown <= 0) {
      this.attackCooldown = 1.5;
      var roll = Math.random();
      if (this.phase >= 2 && roll < 0.28) { this.mode = 'air'; this.modeTime = 0; g.audio.sfx('warp'); }
      else if (roll < 0.55 && d > 3.5) { this.mode = 'dash'; this.modeTime = 0; }
      else if (d < 3.0) { this.mode = 'windup'; this.modeTime = 0; this.play('attack3', { restart: true, blend: 0.1, speed: 0.7 }); }
      else {
        var dir2 = V3.create(p.pos[0] - this.pos[0], 0.05, p.pos[2] - this.pos[2]);
        V3.normalize(dir2, dir2);
        for (var i = 0; i < 3; i++) {
          var aa = Math.atan2(dir2[0], dir2[2]) + (i - 1) * 0.28;
          g.spawnProjectile(this.pos[0], this.pos[1] + 1.1, this.pos[2],
            V3.create(Math.sin(aa), 0.03, Math.cos(aa)), {
              speed: 12, damage: 1.5, owner: this, kind: 'darkorb', life: 2.6, deflect: true
            });
        }
        g.audio.sfx('dark');
        this.play('throw', { restart: true, blend: 0.1 });
      }
    }
    if (Math.random() < dt * 4) g.particles.emit('dark', this.pos[0], this.pos[1] + 0.9, this.pos[2], 1, 0.5);
  };
  GenmoFinal.prototype.onReflected = function (g) {
    this.reflected = true;
    this.hurt(3, g.player, { invuln: 0.2 });
    g.hud.toast('His own light turns on him!');
  };
  GenmoFinal.prototype.drawExtra = function (g) {
    var bm = this.anim.boneMatrix('itemR');
    if (bm) {
      var mat = g.assets.frameMat('evil', null);
      mat.tint = [0.7, 0.2, 1.0, 0.35];
      g.r.submit(this.weaponMesh, bm, mat);
    }
    g.effects.pointLight(this.pos[0], this.pos[1] + 1.1, this.pos[2], [0.75, 0.25, 1.0], 3.0);
  };

  LZ.Bosses = {
    Boss: Boss,
    make: function (g, id, o) {
      switch (id) {
        case 'emberhusk': return new Emberhusk(g, o);
        case 'genmoYoung': return new GenmoYoung(g, o);
        case 'thornheart': return new Thornheart(g, o);
        case 'tidewrought': return new Tidewrought(g, o);
        case 'hollowking': return new HollowKing(g, o);
        case 'genmoFinal': return new GenmoFinal(g, o);
      }
      console.warn('unknown boss ' + id);
      return null;
    },
    ids: ['emberhusk', 'genmoYoung', 'thornheart', 'tidewrought', 'hollowking', 'genmoFinal'],
    rigs: { emberhusk: emberhuskRig, thorn: thornRig, serpent: serpentRig, hollow: hollowRig, genmo: genmoRig },
    clips: { ember: EMBER_CLIPS, thorn: THORN_CLIPS, serpent: SERP_CLIPS, hollow: HOLLOW_CLIPS }
  };
})(LZ);
