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
    var next = Math.ceil((before - amount) / this.maxHp * this.maxPhase);
    var wantPhase = this.maxPhase - Math.max(0, next - 1) + 0;
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
    return {
      height: 3.4, radius: 1.4,
      def: [
        { name: 'root' },
        { name: 'hips', parent: 'root', offset: [0, 1.5, 0], mat: 'rockAsh', build: function (mb) {
            mb.setColorHex(0x8a7c70);
            mb.taper(0, -0.5, 0, 1.5, 1.1, 1.7, 1.2, 1.0, 0, 0, 0.9);
          } },
        { name: 'chest', parent: 'hips', offset: [0, 0.55, 0], mat: 'rockAsh', build: function (mb) {
            mb.setColorHex(0x9a8a7a);
            mb.taper(0, 0, 0, 1.7, 1.2, 1.9, 1.3, 1.1, 0, 0, 0.9);
          } },
        { name: 'core', parent: 'chest', offset: [0, 0.5, 0.62], mat: 'lava', build: function (mb) {
            mb.setColorHex(0xffffff);
            mb.sphere(0, 0, 0, 0.42, 8, 5, 1);
          } },
        { name: 'plate', parent: 'chest', offset: [0, 0.5, 0.66], mat: 'rockAsh', build: function (mb) {
            mb.setColorHex(0x6a5c50);
            mb.taper(-0.02, -0.55, 0, 1.1, 0.3, 1.0, 0.28, 1.1, 0, 0, 1.2);
          } },
        { name: 'head', parent: 'chest', offset: [0, 1.15, 0], mat: 'rockAsh', build: function (mb) {
            mb.setColorHex(0xa89684);
            mb.taper(0, 0, 0, 1.0, 0.9, 0.8, 0.7, 0.72, 0, 0, 1.1);
            mb.setColorHex(0xffb040);
            mb.box(-0.26, 0.42, 0.44, 0.24, 0.16, 0.10, 2);
            mb.box(0.26, 0.42, 0.44, 0.24, 0.16, 0.10, 2);
          } },
        { name: 'armL', parent: 'chest', offset: [-1.0, 0.85, 0], mat: 'rockAsh', build: function (mb) {
            mb.setColorHex(0x8a7c70);
            mb.taper(0, -1.2, 0, 0.6, 0.6, 0.78, 0.78, 1.2, 0, 0, 1.0);
            mb.setColorHex(0x6a5c50);
            mb.sphere(0, -1.4, 0, 0.62, 6, 4, 0.9);
          } },
        { name: 'armR', parent: 'chest', offset: [1.0, 0.85, 0], mat: 'rockAsh', build: function (mb) {
            mb.setColorHex(0x8a7c70);
            mb.taper(0, -1.2, 0, 0.6, 0.6, 0.78, 0.78, 1.2, 0, 0, 1.0);
            mb.setColorHex(0x6a5c50);
            mb.sphere(0, -1.4, 0, 0.62, 6, 4, 0.9);
          } },
        { name: 'legL', parent: 'hips', offset: [-0.62, -0.6, 0], mat: 'rockAsh', build: function (mb) {
            mb.setColorHex(0x7a6c60);
            mb.taper(0, -0.9, 0, 0.6, 0.6, 0.72, 0.72, 0.9, 0, 0, 1.0);
          } },
        { name: 'legR', parent: 'hips', offset: [0.62, -0.6, 0], mat: 'rockAsh', build: function (mb) {
            mb.setColorHex(0x7a6c60);
            mb.taper(0, -0.9, 0, 0.6, 0.6, 0.72, 0.72, 0.9, 0, 0, 1.0);
          } }
      ]
    };
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
    return LZ.Models.humanoid({
      build: power >= 2 ? 'lanky' : 'teen',
      scale: power >= 2 ? 1.22 : 1.02,
      skin: power >= 2 ? 0x8a6a5a : 0xc09878,
      cloth: power >= 2 ? 0x2a1030 : 0x3a2a40,
      clothDark: 0x180a20,
      trim: power >= 2 ? 0xd8a030 : 0x8a7a50,
      pants: 0x201828, boots: 0x181018,
      hair: power >= 2 ? 0xd04020 : 0x8a2a1a,
      hairStyle: power >= 2 ? 'long' : 'ponytail',
      hat: 'none',
      clothTex: power >= 2 ? 'evil' : 'clothPurple',
      skinTex: 'skinTan',
      hairTex: 'hairRed',
      glove: 0x201828, gloveTex: 'leatherDark',
      cape: true, capeColor: power >= 2 ? 0x40103a : 0x2a1830,
      eyeColor: 0xffb020, sash: power >= 2, sashColor: 0xd8a030
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
            mb.setColorHex(0x6a5a3a);
            mb.cylinder(0, 0, 0, 1.5, 1.0, 0.9, 9, true, 0.9);
          } },
        { name: 'stalk', parent: 'base', offset: [0, 0.85, 0], mat: 'leavesDark', build: function (mb) {
            mb.setColorHex(0x4a6a34);
            mb.taper(0, 0, 0, 0.9, 0.9, 0.6, 0.6, 1.4, 0, 0, 1.0);
          } },
        { name: 'bulb', parent: 'stalk', offset: [0, 1.4, 0], mat: 'leaves', build: function (mb) {
            mb.setColorHex(0x88b048);
            mb.sphere(0, 0.3, 0, 0.85, 8, 5, 1.1);
          } },
        { name: 'jaw', parent: 'bulb', offset: [0, 0.25, 0.2], mat: 'jellyRed', build: function (mb) {
            mb.setColorHex(0xb03040);
            mb.cylinder(0, 0, 0, 0.7, 0.2, 0.5, 8, true, 1.2);
            mb.setColorHex(0xf0e8d0);
            for (var i = 0; i < 8; i++) {
              var a = i / 8 * M.TAU;
              mb.taper(Math.sin(a) * 0.55, 0.4, Math.cos(a) * 0.55, 0.12, 0.12, 0.02, 0.02, 0.26, 0, 0, 2);
            }
          } },
        { name: 'petal', parent: 'bulb', offset: [0, 0.1, 0], mat: 'flowersRed', build: function (mb) {
            mb.setColorHex(0xd05060);
            for (var i = 0; i < 6; i++) {
              var a = i / 6 * M.TAU;
              mb.quad(
                [Math.sin(a) * 0.7, 0.1, Math.cos(a) * 0.7],
                [Math.sin(a + 0.5) * 0.8, 0.0, Math.cos(a + 0.5) * 0.8],
                [Math.sin(a + 0.25) * 1.7, 0.5, Math.cos(a + 0.25) * 1.7],
                [Math.sin(a - 0.1) * 0.9, 0.2, Math.cos(a - 0.1) * 0.9], 1);
            }
          } },
        { name: 'vineL', parent: 'base', offset: [-1.2, 0.6, 0], mat: 'leavesDark', build: vineBuild },
        { name: 'vineR', parent: 'base', offset: [1.2, 0.6, 0], mat: 'leavesDark', build: vineBuild }
      ]
    };
    function vineBuild(mb) {
      mb.setColorHex(0x3e6030);
      mb.taper(0, 0, 0, 0.3, 0.3, 0.16, 0.16, 1.8, 0, 0, 1.0);
      mb.setColorHex(0x8a6a2a);
      mb.taper(0, 1.8, 0, 0.18, 0.18, 0.02, 0.02, 0.4, 0, 0.1, 2);
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
    var def = [{ name: 'root' }];
    var prev = 'root';
    for (var i = 0; i < 5; i++) {
      (function (i, prev) {
        def.push({
          name: 'seg' + i, parent: prev, offset: [0, i === 0 ? 0.6 : 0, i === 0 ? 0 : -0.85],
          mat: 'scaleBlue',
          build: function (mb) {
            mb.setColorHex(0xffffff);
            var r = 0.62 - i * 0.07;
            mb.cylinder(0, -r, -0.42, r, r * 0.92, r * 2, 8, true, 1.0);
            mb.setColorHex(0x8ad0e8);
            mb.taper(0, r * 0.7, -0.42, 0.18, 0.5, 0.03, 0.3, 0.44, 0, 0, 1.2);
          }
        });
      })(i, prev);
      prev = 'seg' + i;
    }
    def.push({
      name: 'head', parent: 'seg0', offset: [0, 0, 0.9], mat: 'scaleBlue',
      build: function (mb) {
        mb.setColorHex(0xffffff);
        mb.taper(0, -0.4, 0, 0.7, 0.9, 0.5, 0.7, 0.8, 0, 0.16, 1.1);
        mb.setColorHex(0xf0f4ff);
        mb.taper(0, -0.2, 0.4, 0.42, 0.5, 0.24, 0.3, 0.36, 0, 0.24, 1.4);
        mb.setColorHex(0xffe060);
        mb.box(-0.22, 0.16, 0.34, 0.16, 0.14, 0.08, 2);
        mb.box(0.22, 0.16, 0.34, 0.16, 0.14, 0.08, 2);
        mb.setColorHex(0x1a2030);
        mb.box(-0.22, 0.16, 0.40, 0.07, 0.10, 0.05, 2);
        mb.box(0.22, 0.16, 0.40, 0.07, 0.10, 0.05, 2);
      }
    });
    def.push({
      name: 'crest', parent: 'head', offset: [0, 0.32, -0.1], mat: 'gemBlue',
      build: function (mb) {
        mb.setColorHex(0x90e0ff);
        mb.taper(0, 0, 0, 0.14, 0.6, 0.02, 0.36, 0.7, 0, -0.2, 1.4);
      }
    });
    return { height: 2.4, radius: 1.0, def: def };
  }
  var SERP_CLIPS = (function () {
    var tracks = {};
    for (var i = 0; i < 5; i++) {
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
    return {
      height: 2.6, radius: 0.8,
      def: [
        { name: 'root' },
        { name: 'body', parent: 'root', offset: [0, 1.5, 0], mat: 'evil', build: function (mb) {
            mb.setColorHex(0xffffff);
            mb.taper(0, -1.2, 0, 0.2, 0.2, 1.3, 1.0, 1.6, 0, 0, 1.0);
            mb.sphere(0, 0.15, 0, 0.62, 8, 5, 1.1);
          } },
        { name: 'crown', parent: 'body', offset: [0, 0.55, 0], mat: 'gold', build: function (mb) {
            mb.setColorHex(0xd8b040);
            mb.cylinder(0, 0, 0, 0.58, 0.6, 0.16, 8, true, 1.4);
            for (var i = 0; i < 5; i++) {
              var a = i / 5 * M.TAU;
              mb.taper(Math.sin(a) * 0.5, 0.14, Math.cos(a) * 0.5, 0.12, 0.12, 0.03, 0.03, 0.3, 0, 0, 2);
            }
          } },
        { name: 'face', parent: 'body', offset: [0, 0.12, 0.5], mat: 'bone', build: function (mb) {
            mb.setColorHex(0xe8e0c8);
            mb.box(0, 0, 0, 0.5, 0.52, 0.14, 1.6);
            mb.setColorHex(0x201028);
            mb.box(-0.14, 0.08, 0.08, 0.14, 0.16, 0.06, 2);
            mb.box(0.14, 0.08, 0.08, 0.14, 0.16, 0.06, 2);
            mb.box(0, -0.18, 0.08, 0.26, 0.10, 0.06, 2);
          } },
        { name: 'lampL', parent: 'body', offset: [-0.85, -0.1, 0.2], mat: 'gemBlue', build: lampBuild },
        { name: 'lampR', parent: 'body', offset: [0.85, -0.1, 0.2], mat: 'gemRed', build: lampBuild }
      ]
    };
    function lampBuild(mb) {
      mb.setColorHex(0xffffff);
      mb.sphere(0, 0, 0, 0.26, 6, 4, 1);
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
      x: o.x, y: o.y, z: o.z, hp: 44, radius: 0.55, height: 2.0,
      speed: 4.6, sight: 40, damage: 2,
      bossName: 'GENMO, HEIR OF THE DARK', maxPhase: 3, dungeon: 'fortress'
    });
    this.setModel(LZ.charModel(g.r, 'genmo2', function () { return genmoRig(2); }, LZ.Models.getHumanoidClips()));
    this.height = 2.0;
    this.lockHeight = 1.2;
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
