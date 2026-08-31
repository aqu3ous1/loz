/* =============================================================
   game/enemies.js -- the bestiary.

   Every enemy telegraphs before it commits, and every attack has a
   counter: block it, roll through it, hit it while it recovers, or use
   the right tool. That contract is what made the era's combat readable
   at 20 frames per second, and it is the contract here.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var M = LZ.M, V3 = LZ.V3, M4 = LZ.M4, GL = LZ.GL, A = LZ.Anim, C = LZ.Collision;

  /* ---------------------------------------------------------------- */
  /* base                                                              */
  /* ---------------------------------------------------------------- */
  function Enemy(game, o) {
    o = o || {};
    LZ.Actor.call(this, {
      kind: 'enemy', x: o.x, y: o.y, z: o.z, yaw: o.yaw || 0,
      radius: o.radius || 0.34, height: o.height || 1.3,
      team: 'enemy', hp: o.hp || 3, lockable: true
    });
    this.game = game;
    this.lockRange = o.lockRange || 14;
    this.sight = o.sight || 9;
    this.leash = o.leash || 16;
    this.moveSpeed = o.speed || 2.2;
    this.attackRange = o.attackRange || 1.25;
    this.attackDamage = o.damage || 0.5;
    this.attackCooldown = 0;
    this.attackDelay = o.delay || 1.1;
    this.windupTime = o.windup || 0.42;
    this.strikeTime = o.strike || 0.22;
    this.recoverTime = o.recover || 0.5;
    this.state = 'idle';
    this.stateTime = 0;
    this.aggro = false;
    this.drops = o.drops || ['heart', 'rupeeG', 'rupeeG', null, null];
    this.metal = !!o.metal;
    this.guardArc = o.guardArc || 0;   /* radians; incoming hits inside are parried */
    this.stunned = 0;
    this.essenceColor = o.essence || [0.28, 0.14, 0.34];
    this.deathTime = 0;
    this.contactDamage = o.contact === undefined ? 0 : o.contact;
    this.contactCool = 0;
    this.floatBase = o.floatBase || 0;
    this.spawnY = this.pos[1];
    this.homeYaw = this.yaw;
    this.alerted = 0;
    this.hitboxOn = false;
    this.wanderTimer = Math.random() * 2;
    this.wanderDir = Math.random() * M.TAU;
    this.contactRadius = o.contactRadius || (this.radius + 0.35);
  }
  Enemy.prototype = Object.create(LZ.Actor.prototype);
  Enemy.prototype.constructor = Enemy;

  Enemy.prototype.onHurt = function (amount, source, opts) {
    if (this.dead) return false;
    /* stone-masked players are ignored; hitting still works */
    if (this.guardArc > 0 && source && opts && opts.source === 'sword') {
      var dx = source.pos[0] - this.pos[0], dz = source.pos[2] - this.pos[2];
      var ang = Math.abs(M.angleDelta(this.yaw, Math.atan2(dx, dz)));
      if (ang < this.guardArc && this.state !== 'recover' && this.state !== 'stagger') {
        this.state = 'parry';
        this.stateTime = 0;
        this.game.audio.sfx('hit_metal');
        this.game.effects.impact(this.pos[0], this.pos[1] + this.height * 0.6, this.pos[2], true);
        return false;
      }
    }
    this.aggro = true;
    this.alerted = 2.5;
    if (this.state === 'windup' || this.state === 'attack') { this.hitboxOn = false; }
    this.state = 'stagger';
    this.stateTime = 0;
    return true;
  };

  Enemy.prototype.onDie = function () {
    var g = this.game;
    this.deathTime = 0;
    this.hitboxOn = false;
    g.audio.sfx('die');
    g.particles.emit('essence', this.pos[0], this.pos[1] + this.height * 0.4, this.pos[2], 14);
    g.effects.ring(this.pos[0], this.pos[1] + 0.1, this.pos[2], [0.6, 0.3, 0.8, 0.8], 2.4);
    var d = this.drops[Math.floor(Math.random() * this.drops.length)];
    if (d) g.spawnDrop(this.pos[0], this.pos[1] + 0.5, this.pos[2], d);
    if (this.onDefeat) this.onDefeat(g);
    g.notifyEnemyDefeated(this);
  };

  Enemy.prototype.playerVisible = function (g) {
    var p = g.player;
    if (!p || p.state === 'dead') return false;
    if (g.inv.wornMask === 'stoneMask' && !this.seesThroughStone) return false;
    var d = V3.distXZ(this.pos, p.pos);
    if (d > this.sight && !this.aggro) return false;
    if (d > this.leash + 6) return false;
    return true;
  };

  Enemy.prototype.stepToward = function (dt, g, tx, tz, speed) {
    var dx = tx - this.pos[0], dz = tz - this.pos[2];
    var d = Math.sqrt(dx * dx + dz * dz) || 1;
    this.targetYaw = Math.atan2(dx, dz);
    this.moveXZ(dx / d * speed * dt, dz / d * speed * dt, g.world);
    this.speed = speed;
  };

  Enemy.prototype.doContact = function (dt, g) {
    if (!this.contactDamage) return;
    this.contactCool -= dt;
    if (this.contactCool > 0) return;
    var p = g.player;
    if (V3.distXZ(this.pos, p.pos) < this.contactRadius &&
        Math.abs(p.pos[1] - this.pos[1]) < this.height + 0.4) {
      if (p.damage(this.contactDamage, this, { knockback: 6 })) this.contactCool = 0.7;
    }
  };

  Enemy.prototype.strikePlayer = function (g, range, dmg, arc) {
    var p = g.player;
    var d = V3.distXZ(this.pos, p.pos);
    if (d > (range || this.attackRange) + 0.35) return false;
    if (Math.abs(p.pos[1] - this.pos[1]) > this.height + 0.6) return false;
    var ang = Math.abs(M.angleDelta(this.yaw, Math.atan2(p.pos[0] - this.pos[0], p.pos[2] - this.pos[2])));
    if (ang > (arc || 1.1)) return false;
    return p.damage(dmg === undefined ? this.attackDamage : dmg, this, { knockback: 7 });
  };

  /* generic melee brain used by most ground enemies */
  Enemy.prototype.meleeBrain = function (dt, g, anims) {
    anims = anims || {};
    var p = g.player;
    this.stateTime += dt;
    if (this.alerted > 0) this.alerted -= dt;
    var dist = V3.distXZ(this.pos, p.pos);
    var see = this.playerVisible(g);

    switch (this.state) {
      case 'idle':
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
          this.wanderTimer = 1.6 + Math.random() * 2.6;
          this.wanderDir = Math.random() * M.TAU;
          this.wanderMove = Math.random() < 0.55;
        }
        if (this.wanderMove) {
          var hx = this.homeX + Math.cos(this.wanderDir) * 2.2;
          var hz = this.homeZ + Math.sin(this.wanderDir) * 2.2;
          this.stepToward(dt, g, hx, hz, this.moveSpeed * 0.35);
          this.play(anims.walk || 'walk', { blend: 0.2, speed: 0.6 });
        } else {
          this.speed = 0;
          this.play(anims.idle || 'idle', { blend: 0.2 });
        }
        if (see && dist < this.sight) {
          this.state = 'notice'; this.stateTime = 0;
          this.aggro = true;
          g.audio.sfx(this.noticeSfx || 'blip_low', { minGap: 0.4 });
          if (this.onNotice) this.onNotice(g);
        }
        break;

      case 'notice':
        this.speed = 0;
        this.faceTowards(p.pos[0], p.pos[2]);
        this.play(anims.alert || anims.idle || 'idleAlert', { blend: 0.14 });
        if (this.stateTime > (this.noticeTime === undefined ? 0.38 : this.noticeTime)) {
          this.state = 'chase'; this.stateTime = 0;
        }
        break;

      case 'chase':
        if (!see || dist > this.leash) {
          this.state = 'return'; this.stateTime = 0; this.aggro = false; break;
        }
        if (dist < this.attackRange && this.attackCooldown <= 0) {
          this.state = 'windup'; this.stateTime = 0;
          this.play(anims.windup || 'attack3', { restart: true, blend: 0.1, speed: 0.55 });
          if (this.windupSfx) g.audio.sfx(this.windupSfx);
          break;
        }
        /* strafe a little instead of beelining, so fights breathe */
        var side = Math.sin(g.time * 1.3 + this.id) * 0.55;
        var ang = Math.atan2(p.pos[0] - this.pos[0], p.pos[2] - this.pos[2]) + side * 0.5;
        this.stepToward(dt, g, this.pos[0] + Math.sin(ang) * 4, this.pos[2] + Math.cos(ang) * 4,
          this.moveSpeed * (dist < this.attackRange * 1.4 ? 0.4 : 1));
        this.play(anims.run || 'run', { blend: 0.14, speed: 1 });
        break;

      case 'windup':
        this.speed = 0;
        this.faceTowards(p.pos[0], p.pos[2]);
        this.tint = [1, 0.6, 0.3, 0.20 + Math.sin(this.stateTime * 30) * 0.10];
        if (this.stateTime > this.windupTime) {
          this.state = 'attack'; this.stateTime = 0;
          this.tint = [0, 0, 0, 0];
          this.hitboxOn = true;
          this.play(anims.attack || 'attack1', { restart: true, blend: 0.05, speed: 1.2 });
          g.audio.sfx(this.attackSfx || 'swing');
          if (this.onStrike) this.onStrike(g);
        }
        break;

      case 'attack':
        this.speed = 0;
        if (this.lungeSpeed) {
          this.moveXZ(Math.sin(this.yaw) * this.lungeSpeed * dt, Math.cos(this.yaw) * this.lungeSpeed * dt, g.world);
        }
        if (this.hitboxOn && this.strikePlayer(g)) this.hitboxOn = false;
        if (this.stateTime > this.strikeTime) {
          this.state = 'recover'; this.stateTime = 0;
          this.hitboxOn = false;
        }
        break;

      case 'recover':
        this.speed = 0;
        this.play(anims.idle || 'idleAlert', { blend: 0.16 });
        if (this.stateTime > this.recoverTime) {
          this.state = 'chase'; this.stateTime = 0;
          this.attackCooldown = this.attackDelay;
        }
        break;

      case 'parry':
        this.speed = 0;
        this.play(anims.guard || 'guardHit', { restart: this.stateTime < 0.02, blend: 0.05 });
        if (this.stateTime > 0.4) { this.state = 'chase'; this.stateTime = 0; }
        break;

      case 'stagger':
        this.speed = 0;
        this.play(anims.hurt || 'hurt', { restart: this.stateTime < 0.02, blend: 0.05 });
        if (this.stateTime > (this.staggerTime || 0.42)) { this.state = 'chase'; this.stateTime = 0; }
        break;

      case 'return':
        var hd = Math.sqrt((this.homeX - this.pos[0]) * (this.homeX - this.pos[0]) +
          (this.homeZ - this.pos[2]) * (this.homeZ - this.pos[2]));
        if (hd < 0.6 || see) {
          this.state = see ? 'chase' : 'idle'; this.stateTime = 0;
        } else {
          this.stepToward(dt, g, this.homeX, this.homeZ, this.moveSpeed * 0.7);
          this.play(anims.walk || 'walk', { blend: 0.2, speed: 0.8 });
        }
        break;
    }
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
  };

  Enemy.prototype.update = function (dt, g) {
    this.updateCommon(dt, g.world);
    if (this.frozen > 0) {
      this.applyGravity(dt, g.world);
      this.turnToward(dt);
      return;
    }
    if (this.burning > 0) {
      this.burnTick = (this.burnTick || 0) + dt;
      if (this.burnTick > 0.45) {
        this.burnTick = 0;
        this.hurt(0.5, null, { invuln: 0.1, stun: 0 });
        g.particles.emit('fire', this.pos[0], this.pos[1] + this.height * 0.5, this.pos[2], 2);
      }
    }
    if (this.dead) {
      this.deathTime += dt;
      this.alpha = Math.max(0, 1 - this.deathTime * 2.2);
      this.pos[1] += dt * 0.4;
      if (this.deathTime > 0.6) this.removeMe = true;
      return;
    }
    this.brain(dt, g);
    this.turnToward(dt);
    if (!this.flying) this.applyGravity(dt, g.world);
    this.doContact(dt, g);
  };
  Enemy.prototype.brain = function (dt, g) { this.meleeBrain(dt, g); };

  /* ---------------------------------------------------------------- */
  /* rigs                                                              */
  /* ---------------------------------------------------------------- */
  function blobRig(color, tex, scale) {
    var s = scale || 1;
    return {
      height: 0.9 * s, radius: 0.36 * s,
      def: [
        { name: 'root' },
        { name: 'body', parent: 'root', offset: [0, 0, 0], mat: tex || 'jellyBlue', build: function (mb) {
            mb.setColorHex(color === undefined ? 0xffffff : color);
            mb.sphere(0, 0.38 * s, 0, 0.42 * s, 8, 5, 0.92);
            mb.setColorHex(0x1a1a24);
            mb.box(-0.15 * s, 0.46 * s, 0.36 * s, 0.09 * s, 0.11 * s, 0.05 * s, 2);
            mb.box(0.15 * s, 0.46 * s, 0.36 * s, 0.09 * s, 0.11 * s, 0.05 * s, 2);
          } }
      ]
    };
  }

  function batRig(color) {
    return {
      height: 0.5, radius: 0.28,
      def: [
        { name: 'root' },
        { name: 'body', parent: 'root', offset: [0, 0.4, 0], mat: 'furPurple', build: function (mb) {
            mb.setColorHex(color === undefined ? 0xffffff : color);
            mb.sphere(0, 0, 0, 0.22, 7, 4, 1.0);
            mb.setColorHex(0xf0d060);
            mb.box(-0.08, 0.05, 0.18, 0.06, 0.07, 0.04, 2);
            mb.box(0.08, 0.05, 0.18, 0.06, 0.07, 0.04, 2);
            mb.setColorHex(0xd8d4cc);
            mb.taper(-0.10, 0.16, -0.02, 0.06, 0.06, 0.02, 0.02, 0.16, -0.04, -0.04, 2);
            mb.taper(0.10, 0.16, -0.02, 0.06, 0.06, 0.02, 0.02, 0.16, 0.04, -0.04, 2);
          } },
        { name: 'wingL', parent: 'body', offset: [-0.18, 0.02, 0], mat: 'furPurple', build: function (mb) {
            mb.setColorHex(0x8a7aa0);
            mb.quad([0, 0, 0.14], [-0.52, 0.06, 0.06], [-0.5, -0.04, -0.16], [0, 0, -0.14], 1);
            mb.quad([0, 0, -0.14], [-0.5, -0.04, -0.16], [-0.52, 0.06, 0.06], [0, 0, 0.14], 1);
          } },
        { name: 'wingR', parent: 'body', offset: [0.18, 0.02, 0], mat: 'furPurple', build: function (mb) {
            mb.setColorHex(0x8a7aa0);
            mb.quad([0, 0, -0.14], [0.5, -0.04, -0.16], [0.52, 0.06, 0.06], [0, 0, 0.14], 1);
            mb.quad([0, 0, 0.14], [0.52, 0.06, 0.06], [0.5, -0.04, -0.16], [0, 0, -0.14], 1);
          } }
      ]
    };
  }

  function spiderRig(color) {
    return {
      height: 0.8, radius: 0.4,
      def: [
        { name: 'root' },
        { name: 'body', parent: 'root', offset: [0, 0.45, 0], mat: 'scaleGreen', build: function (mb) {
            mb.setColorHex(color === undefined ? 0x3a4a2a : color);
            mb.sphere(0, 0, 0, 0.36, 7, 4, 0.72);
            mb.setColorHex(0xd8c060);
            mb.box(0, 0.24, 0, 0.30, 0.04, 0.30, 2);
            mb.box(0, 0.20, 0, 0.06, 0.10, 0.34, 2);
            mb.setColorHex(0xe04040);
            for (var e = -1; e <= 1; e += 2) mb.box(e * 0.12, 0.06, 0.31, 0.08, 0.08, 0.04, 2);
          } },
        { name: 'legs', parent: 'body', offset: [0, 0, 0], mat: 'scaleGreen', build: function (mb) {
            mb.setColorHex(0x24301c);
            for (var i = 0; i < 8; i++) {
              var a = (i / 8) * M.TAU + 0.4;
              var dx = Math.sin(a), dz = Math.cos(a);
              mb.taper(dx * 0.3, -0.02, dz * 0.3, 0.07, 0.07, 0.04, 0.04, 0.34, dx * 0.28, dz * 0.28, 2);
              mb.taper(dx * 0.56, 0.30, dz * 0.56, 0.05, 0.05, 0.03, 0.03, -0.44, dx * 0.14, dz * 0.14, 2);
            }
          } }
      ]
    };
  }

  function octoRig() {
    return {
      height: 0.9, radius: 0.36,
      def: [
        { name: 'root' },
        { name: 'body', parent: 'root', offset: [0, 0.30, 0], mat: 'scaleRed', build: function (mb) {
            mb.setColorHex(0xffffff);
            mb.sphere(0, 0, 0, 0.34, 7, 4, 1.05);
            mb.taper(0, 0.16, 0, 0.34, 0.34, 0.14, 0.14, 0.28, 0, 0.06, 2);
            mb.setColorHex(0xf6f2e6);
            for (var e = -1; e <= 1; e += 2) mb.box(e * 0.13, 0.12, 0.26, 0.11, 0.13, 0.05, 2);
            mb.setColorHex(0x1a1620);
            for (var e2 = -1; e2 <= 1; e2 += 2) mb.box(e2 * 0.13, 0.10, 0.30, 0.05, 0.07, 0.03, 2);
          } },
        { name: 'legs', parent: 'root', offset: [0, 0.06, 0], mat: 'scaleRed', build: function (mb) {
            mb.setColorHex(0xc08878);
            for (var i = 0; i < 5; i++) {
              var a = (i / 5) * M.TAU;
              mb.taper(Math.sin(a) * 0.16, 0, Math.cos(a) * 0.16, 0.11, 0.11, 0.06, 0.06, 0.18,
                Math.sin(a) * 0.14, Math.cos(a) * 0.14, 2);
            }
          } }
      ]
    };
  }

  function tektiteRig(color) {
    return {
      height: 0.8, radius: 0.36,
      def: [
        { name: 'root' },
        { name: 'body', parent: 'root', offset: [0, 0.42, 0], mat: 'scaleBlue', build: function (mb) {
            mb.setColorHex(color === undefined ? 0xffffff : color);
            mb.sphere(0, 0, 0, 0.30, 7, 4, 0.85);
            mb.setColorHex(0xf0e0a0);
            mb.box(0, 0.14, 0.22, 0.20, 0.14, 0.10, 2);
            mb.setColorHex(0x201820);
            mb.box(0, 0.15, 0.28, 0.10, 0.09, 0.04, 2);
          } },
        { name: 'legs', parent: 'body', offset: [0, -0.1, 0], mat: 'scaleBlue', build: function (mb) {
            mb.setColorHex(0x2a4a62);
            for (var i = 0; i < 4; i++) {
              var a = (i / 4) * M.TAU + 0.7;
              var dx = Math.sin(a), dz = Math.cos(a);
              mb.taper(dx * 0.22, 0, dz * 0.22, 0.07, 0.07, 0.05, 0.05, 0.26, dx * 0.26, dz * 0.26, 2);
              mb.taper(dx * 0.48, 0.26, dz * 0.48, 0.06, 0.06, 0.04, 0.04, -0.34, dx * 0.1, dz * 0.1, 2);
            }
          } }
      ]
    };
  }

  function wolfRig(color) {
    return {
      height: 1.0, radius: 0.4,
      def: [
        { name: 'root' },
        { name: 'body', parent: 'root', offset: [0, 0.62, 0], mat: 'furGrey', build: function (mb) {
            mb.setColorHex(color === undefined ? 0xffffff : color);
            mb.taper(0, -0.16, 0, 0.36, 0.86, 0.32, 0.70, 0.34, 0, 0, 1.6);
          } },
        { name: 'head', parent: 'body', offset: [0, 0.06, 0.44], mat: 'furGrey', build: function (mb) {
            mb.setColorHex(color === undefined ? 0xffffff : color);
            mb.box(0, 0, 0, 0.28, 0.26, 0.30, 2);
            mb.taper(0, -0.06, 0.16, 0.20, 0.18, 0.13, 0.16, 0.24, 0, 0.10, 2);
            mb.taper(-0.11, 0.12, -0.02, 0.09, 0.06, 0.03, 0.03, 0.18, -0.02, -0.03, 2);
            mb.taper(0.11, 0.12, -0.02, 0.09, 0.06, 0.03, 0.03, 0.18, 0.02, -0.03, 2);
            mb.setColorHex(0xf0c040);
            mb.box(-0.09, 0.05, 0.16, 0.07, 0.05, 0.04, 2);
            mb.box(0.09, 0.05, 0.16, 0.07, 0.05, 0.04, 2);
          } },
        { name: 'legFL', parent: 'body', offset: [-0.15, -0.16, 0.26], mat: 'furGrey', build: legBuild },
        { name: 'legFR', parent: 'body', offset: [0.15, -0.16, 0.26], mat: 'furGrey', build: legBuild },
        { name: 'legBL', parent: 'body', offset: [-0.15, -0.16, -0.28], mat: 'furGrey', build: legBuild },
        { name: 'legBR', parent: 'body', offset: [0.15, -0.16, -0.28], mat: 'furGrey', build: legBuild },
        { name: 'tail', parent: 'body', offset: [0, 0.06, -0.42], mat: 'furGrey', build: function (mb) {
            mb.setColorHex(0xffffff);
            mb.taper(0, 0, 0, 0.12, 0.12, 0.05, 0.05, -0.46, 0, -0.16, 2);
          } }
      ]
    };
    function legBuild(mb) {
      mb.setColorHex(0xd8d8d8);
      mb.taper(0, -0.42, 0, 0.11, 0.11, 0.09, 0.09, 0.42, 0, 0, 2);
      mb.box(0, -0.44, 0.04, 0.13, 0.08, 0.18, 2);
    }
  }

  function wispRig(color) {
    return {
      height: 1.1, radius: 0.3,
      def: [
        { name: 'root' },
        { name: 'body', parent: 'root', offset: [0, 0.9, 0], mat: 'evil', build: function (mb) {
            mb.setColorHex(color === undefined ? 0xffffff : color);
            mb.sphere(0, 0, 0, 0.34, 7, 4, 1.1);
            mb.taper(0, -0.22, 0, 0.44, 0.44, 0.06, 0.06, -0.5, 0, 0, 1.4);
            mb.setColorHex(0xffd070);
            mb.box(-0.12, 0.08, 0.26, 0.08, 0.10, 0.05, 2);
            mb.box(0.12, 0.08, 0.26, 0.08, 0.10, 0.05, 2);
          } },
        { name: 'lamp', parent: 'body', offset: [0.3, -0.18, 0.1], mat: 'gemGreen', build: function (mb) {
            mb.setColorHex(0x80ffc0);
            mb.sphere(0, 0, 0, 0.10, 6, 3, 1);
          } }
      ]
    };
  }

  function beetleRig(color) {
    return {
      height: 0.5, radius: 0.3,
      def: [
        { name: 'root' },
        { name: 'body', parent: 'root', offset: [0, 0.2, 0], mat: 'scaleRed', build: function (mb) {
            mb.setColorHex(color === undefined ? 0xffffff : color);
            mb.sphere(0, 0, 0, 0.28, 7, 4, 0.6);
            mb.setColorHex(0x2a1a14);
            mb.box(0, 0.02, 0.24, 0.14, 0.10, 0.14, 2);
            mb.taper(0, 0.06, 0.30, 0.06, 0.06, 0.02, 0.02, 0.14, 0, 0.06, 2);
          } },
        { name: 'legs', parent: 'body', offset: [0, -0.1, 0], mat: 'scaleRed', build: function (mb) {
            mb.setColorHex(0x1a1410);
            for (var i = 0; i < 6; i++) {
              var a = (i / 6) * M.TAU;
              mb.taper(Math.sin(a) * 0.2, 0, Math.cos(a) * 0.2, 0.05, 0.05, 0.03, 0.03, -0.2,
                Math.sin(a) * 0.12, Math.cos(a) * 0.12, 2);
            }
          } }
      ]
    };
  }

  function armosRig() {
    return {
      height: 1.9, radius: 0.5,
      def: [
        { name: 'root' },
        { name: 'body', parent: 'root', offset: [0, 0.5, 0], mat: 'stoneblock', build: function (mb) {
            mb.setColorHex(0xffffff);
            mb.taper(0, 0, 0, 0.72, 0.5, 0.86, 0.56, 0.9, 0, 0, 1.4);
            mb.box(0, 1.06, 0, 0.5, 0.3, 0.46, 1.6);
            mb.setColorHex(0xe05030);
            mb.box(-0.13, 1.10, 0.24, 0.10, 0.12, 0.04, 2);
            mb.box(0.13, 1.10, 0.24, 0.10, 0.12, 0.04, 2);
          } },
        { name: 'armL', parent: 'body', offset: [-0.48, 0.72, 0], mat: 'stoneblock', build: function (mb) {
            mb.setColorHex(0xf0f0f0);
            mb.taper(0, -0.6, 0, 0.24, 0.24, 0.3, 0.3, 0.62, 0, 0, 1.6);
          } },
        { name: 'armR', parent: 'body', offset: [0.48, 0.72, 0], mat: 'stoneblock', build: function (mb) {
            mb.setColorHex(0xf0f0f0);
            mb.taper(0, -0.6, 0, 0.24, 0.24, 0.3, 0.3, 0.62, 0, 0, 1.6);
          } },
        { name: 'base', parent: 'root', offset: [0, 0, 0], mat: 'stoneblock', build: function (mb) {
            mb.setColorHex(0xd0d0d0);
            mb.taper(0, 0, 0, 0.92, 0.7, 0.72, 0.5, 0.5, 0, 0, 1.2);
          } }
      ]
    };
  }

  function beamosRig() {
    return {
      height: 2.1, radius: 0.55,
      def: [
        { name: 'root' },
        { name: 'column', parent: 'root', offset: [0, 0, 0], mat: 'stoneblockDark', build: function (mb) {
            mb.setColorHex(0xffffff);
            mb.cylinder(0, 0, 0, 0.62, 0.5, 0.4, 8, true, 1.2);
            mb.cylinder(0, 0.4, 0, 0.42, 0.40, 1.1, 8, false, 1.2);
          } },
        { name: 'eye', parent: 'root', offset: [0, 1.62, 0], mat: 'gemRed', build: function (mb) {
            mb.setColorHex(0xffffff);
            mb.sphere(0, 0, 0, 0.36, 8, 5, 0.9);
            mb.setColorHex(0x201020);
            mb.box(0, 0, 0.30, 0.16, 0.22, 0.10, 2);
          } }
      ]
    };
  }

  function wormRig() {
    return {
      height: 1.4, radius: 0.5,
      def: [
        { name: 'root' },
        { name: 'seg1', parent: 'root', offset: [0, 0.4, 0], mat: 'scaleRed', build: function (mb) {
            mb.setColorHex(0xc0a070);
            mb.cylinder(0, -0.4, 0, 0.42, 0.36, 0.9, 8, false, 1.2);
          } },
        { name: 'head', parent: 'seg1', offset: [0, 0.5, 0], mat: 'scaleRed', build: function (mb) {
            mb.setColorHex(0xd8b080);
            mb.sphere(0, 0, 0, 0.38, 8, 4, 1.0);
            mb.setColorHex(0x501818);
            mb.cylinder(0, 0.1, 0, 0.28, 0.30, 0.26, 8, true, 1.4);
            mb.setColorHex(0xf0e0c0);
            for (var i = 0; i < 6; i++) {
              var a = i / 6 * M.TAU;
              mb.taper(Math.sin(a) * 0.26, 0.30, Math.cos(a) * 0.26, 0.07, 0.07, 0.02, 0.02, 0.16, 0, 0, 2);
            }
          } }
      ]
    };
  }

  /* ---------------------------------------------------------------- */
  /* clip sets                                                         */
  /* ---------------------------------------------------------------- */
  var clip = A.clip;
  var CLIPS = {};

  CLIPS.blob = {
    idle: clip('idle', 1.6, true, { body: { t: [[0, 0, 0, 0], [0.8, 0, 0.04, 0], [1.6, 0, 0, 0]] } }),
    hop: clip('hop', 0.8, true, {
      root: { t: [[0, 0, 0, 0], [0.3, 0, 0.62, 0], [0.62, 0, 0, 0], [0.8, 0, 0, 0]] },
      body: { t: [[0, 0, -0.10, 0], [0.14, 0, 0.06, 0], [0.5, 0, 0.02, 0], [0.66, 0, -0.12, 0], [0.8, 0, -0.10, 0]] }
    }, { events: [{ t: 0.14, name: 'hop' }] }),
    hurt: clip('hurt', 0.4, false, { body: { t: [[0, 0, 0, 0], [0.1, 0, -0.14, 0], [0.4, 0, 0, 0]] } }),
    attack: clip('attack', 0.4, false, { root: { t: [[0, 0, 0, 0], [0.16, 0, 0.4, 0], [0.4, 0, 0, 0]] } })
  };
  CLIPS.blob.walk = CLIPS.blob.hop;
  CLIPS.blob.run = CLIPS.blob.hop;
  CLIPS.blob.alert = CLIPS.blob.idle;

  CLIPS.bat = {
    idle: clip('idle', 0.30, true, {
      wingL: { r: [[0, 0, 0, -55], [0.15, 0, 0, 30], [0.30, 0, 0, -55]] },
      wingR: { r: [[0, 0, 0, 55], [0.15, 0, 0, -30], [0.30, 0, 0, 55]] },
      body: { r: [[0, 0, 0, 0], [0.15, 6, 0, 0], [0.30, 0, 0, 0]] }
    }),
    hurt: clip('hurt', 0.35, false, { body: { r: [[0, 0, 0, 0], [0.1, -40, 0, 20], [0.35, 0, 0, 0]] } })
  };
  CLIPS.bat.walk = CLIPS.bat.run = CLIPS.bat.attack = CLIPS.bat.alert = CLIPS.bat.idle;

  CLIPS.spider = {
    idle: clip('idle', 2.0, true, { body: { t: [[0, 0, 0, 0], [1.0, 0, 0.05, 0], [2.0, 0, 0, 0]] } }),
    walk: clip('walk', 0.5, true, {
      body: { t: [[0, 0, 0, 0], [0.25, 0, 0.07, 0], [0.5, 0, 0, 0]], r: [[0, 0, 0, 5], [0.25, 0, 0, -5], [0.5, 0, 0, 5]] },
      legs: { r: [[0, 0, 8, 0], [0.25, 0, -8, 0], [0.5, 0, 8, 0]] }
    }, { events: [{ t: 0.05, name: 'step' }] }),
    attack: clip('attack', 0.4, false, { body: { t: [[0, 0, 0, 0], [0.14, 0, 0, 0.5], [0.4, 0, 0, 0]] } }),
    hurt: clip('hurt', 0.4, false, { body: { r: [[0, 0, 0, 0], [0.1, 30, 0, 0], [0.4, 0, 0, 0]] } })
  };
  CLIPS.spider.run = CLIPS.spider.walk;
  CLIPS.spider.alert = CLIPS.spider.idle;

  CLIPS.octo = {
    idle: clip('idle', 1.8, true, { body: { t: [[0, 0, 0, 0], [0.9, 0, 0.05, 0], [1.8, 0, 0, 0]] } }),
    walk: clip('walk', 0.7, true, {
      root: { t: [[0, 0, 0, 0], [0.35, 0, 0.10, 0], [0.7, 0, 0, 0]] },
      legs: { r: [[0, 0, 12, 0], [0.35, 0, -12, 0], [0.7, 0, 12, 0]] }
    }, { events: [{ t: 0.05, name: 'step' }] }),
    attack: clip('attack', 0.5, false, {
      body: { t: [[0, 0, 0, 0], [0.14, 0, 0, -0.12], [0.26, 0, 0, 0.16], [0.5, 0, 0, 0]],
              r: [[0, 0, 0, 0], [0.14, 16, 0, 0], [0.26, -20, 0, 0], [0.5, 0, 0, 0]] }
    }),
    hurt: clip('hurt', 0.4, false, { body: { r: [[0, 0, 0, 0], [0.1, 26, 0, 0], [0.4, 0, 0, 0]] } })
  };
  CLIPS.octo.run = CLIPS.octo.walk; CLIPS.octo.alert = CLIPS.octo.idle;

  CLIPS.tektite = {
    idle: clip('idle', 1.4, true, { body: { t: [[0, 0, 0, 0], [0.7, 0, 0.03, 0], [1.4, 0, 0, 0]] } }),
    hop: clip('hop', 1.0, true, {
      root: { t: [[0, 0, 0, 0], [0.36, 0, 1.0, 0], [0.72, 0, 0, 0], [1.0, 0, 0, 0]] },
      legs: { r: [[0, 0, 0, 0], [0.2, -30, 0, 0], [0.5, 20, 0, 0], [1.0, 0, 0, 0]] }
    }, { events: [{ t: 0.06, name: 'hop' }] }),
    hurt: clip('hurt', 0.4, false, { body: { r: [[0, 0, 0, 0], [0.1, 30, 0, 0], [0.4, 0, 0, 0]] } })
  };
  CLIPS.tektite.walk = CLIPS.tektite.run = CLIPS.tektite.attack = CLIPS.tektite.hop;
  CLIPS.tektite.alert = CLIPS.tektite.idle;

  var wolfLegF = [[0, -28, 0, 0], [0.25, 20, 0, 0], [0.5, -28, 0, 0]];
  var wolfLegB = [[0, 24, 0, 0], [0.25, -22, 0, 0], [0.5, 24, 0, 0]];
  CLIPS.wolf = {
    idle: clip('idle', 2.2, true, {
      body: { t: [[0, 0, 0, 0], [1.1, 0, 0.03, 0], [2.2, 0, 0, 0]] },
      head: { r: [[0, 0, 6, 0], [1.1, 0, -6, 0], [2.2, 0, 6, 0]] },
      tail: { r: [[0, 0, 12, 0], [0.55, 0, -12, 0], [1.1, 0, 12, 0], [2.2, 0, 12, 0]] }
    }),
    walk: clip('walk', 0.62, true, {
      legFL: { r: wolfLegF }, legBR: { r: wolfLegF },
      legFR: { r: wolfLegB }, legBL: { r: wolfLegB },
      body: { t: [[0, 0, 0, 0], [0.31, 0, 0.04, 0], [0.62, 0, 0, 0]] }
    }, { events: [{ t: 0.05, name: 'step' }, { t: 0.35, name: 'step' }] }),
    run: clip('run', 0.36, true, {
      legFL: { r: [[0, -52, 0, 0], [0.18, 40, 0, 0], [0.36, -52, 0, 0]] },
      legFR: { r: [[0, -40, 0, 0], [0.18, 48, 0, 0], [0.36, -40, 0, 0]] },
      legBL: { r: [[0, 46, 0, 0], [0.18, -44, 0, 0], [0.36, 46, 0, 0]] },
      legBR: { r: [[0, 38, 0, 0], [0.18, -50, 0, 0], [0.36, 38, 0, 0]] },
      body: { t: [[0, 0, 0, 0], [0.18, 0, 0.10, 0], [0.36, 0, 0, 0]], r: [[0, -6, 0, 0], [0.36, -6, 0, 0]] }
    }, { events: [{ t: 0.03, name: 'step' }, { t: 0.2, name: 'step' }] }),
    attack: clip('attack', 0.42, false, {
      body: { r: [[0, 0, 0, 0], [0.12, -30, 0, 0], [0.28, 14, 0, 0], [0.42, 0, 0, 0]] },
      head: { r: [[0, 0, 0, 0], [0.12, -22, 0, 0], [0.28, 26, 0, 0], [0.42, 0, 0, 0]] }
    }),
    hurt: clip('hurt', 0.4, false, { body: { r: [[0, 0, 0, 0], [0.1, 24, 0, 0], [0.4, 0, 0, 0]] } })
  };
  CLIPS.wolf.alert = CLIPS.wolf.idle;

  CLIPS.wisp = {
    idle: clip('idle', 3.0, true, {
      root: { t: [[0, 0, 0, 0], [1.5, 0, 0.28, 0], [3.0, 0, 0, 0]] },
      body: { r: [[0, 0, 0, 4], [1.5, 0, 0, -4], [3.0, 0, 0, 4]] },
      lamp: { t: [[0, 0, 0, 0], [1.5, 0.06, 0.10, 0], [3.0, 0, 0, 0]] }
    }),
    attack: clip('attack', 0.5, false, { body: { t: [[0, 0, 0, 0], [0.18, 0, 0, 0.4], [0.5, 0, 0, 0]] } }),
    hurt: clip('hurt', 0.4, false, { body: { r: [[0, 0, 0, 0], [0.1, 0, 0, 30], [0.4, 0, 0, 0]] } })
  };
  CLIPS.wisp.walk = CLIPS.wisp.run = CLIPS.wisp.alert = CLIPS.wisp.idle;

  CLIPS.beetle = {
    idle: clip('idle', 1.2, true, { body: { r: [[0, 0, 3, 0], [0.6, 0, -3, 0], [1.2, 0, 3, 0]] } }),
    walk: clip('walk', 0.34, true, {
      body: { t: [[0, 0, 0, 0], [0.17, 0, 0.03, 0], [0.34, 0, 0, 0]] },
      legs: { r: [[0, 0, 14, 0], [0.17, 0, -14, 0], [0.34, 0, 14, 0]] }
    }),
    attack: clip('attack', 0.3, false, { body: { t: [[0, 0, 0, 0], [0.12, 0, 0, 0.3], [0.3, 0, 0, 0]] } }),
    hurt: clip('hurt', 0.3, false, { body: { r: [[0, 0, 0, 0], [0.08, 30, 0, 0], [0.3, 0, 0, 0]] } })
  };
  CLIPS.beetle.run = CLIPS.beetle.walk; CLIPS.beetle.alert = CLIPS.beetle.idle;

  CLIPS.armos = {
    idle: clip('idle', 2.4, true, {}),
    hop: clip('hop', 0.9, true, {
      root: { t: [[0, 0, 0, 0], [0.3, 0, 0.55, 0], [0.6, 0, 0, 0], [0.9, 0, 0, 0]] },
      body: { r: [[0, 0, 0, 0], [0.3, -8, 0, 0], [0.6, 6, 0, 0], [0.9, 0, 0, 0]] },
      armL: { r: [[0, 0, 0, -10], [0.3, -30, 0, -20], [0.9, 0, 0, -10]] },
      armR: { r: [[0, 0, 0, 10], [0.3, -30, 0, 20], [0.9, 0, 0, 10]] }
    }, { events: [{ t: 0.05, name: 'hop' }, { t: 0.58, name: 'slam' }] }),
    hurt: clip('hurt', 0.4, false, { body: { r: [[0, 0, 0, 0], [0.1, 16, 0, 0], [0.4, 0, 0, 0]] } })
  };
  CLIPS.armos.walk = CLIPS.armos.run = CLIPS.armos.attack = CLIPS.armos.hop;
  CLIPS.armos.alert = CLIPS.armos.idle;

  CLIPS.beamos = {
    idle: clip('idle', 4.0, true, { eye: { r: [[0, 0, 0, 0], [4.0, 0, 360, 0]] } }),
    attack: clip('attack', 1.0, true, {})
  };
  CLIPS.beamos.walk = CLIPS.beamos.run = CLIPS.beamos.alert = CLIPS.beamos.hurt = CLIPS.beamos.idle;

  CLIPS.worm = {
    idle: clip('idle', 2.0, true, {
      seg1: { r: [[0, 0, 0, 4], [1.0, 0, 0, -4], [2.0, 0, 0, 4]] },
      head: { r: [[0, 6, 0, 0], [1.0, -6, 0, 0], [2.0, 6, 0, 0]] }
    }),
    attack: clip('attack', 0.6, false, {
      seg1: { r: [[0, 0, 0, 0], [0.2, -24, 0, 0], [0.4, 16, 0, 0], [0.6, 0, 0, 0]] },
      head: { r: [[0, 0, 0, 0], [0.2, -20, 0, 0], [0.4, 30, 0, 0], [0.6, 0, 0, 0]] }
    }),
    hurt: clip('hurt', 0.4, false, { seg1: { r: [[0, 0, 0, 0], [0.1, 20, 0, 0], [0.4, 0, 0, 0]] } })
  };
  CLIPS.worm.walk = CLIPS.worm.run = CLIPS.worm.alert = CLIPS.worm.idle;

  /* ---------------------------------------------------------------- */
  /* concrete enemies                                                  */
  /* ---------------------------------------------------------------- */
  var REG = {};
  function register(id, fn) { REG[id] = fn; }

  /* --- Chuchu: hops, splits nothing, easy tutorial fodder --- */
  function Chuchu(g, o) {
    o = o || {};
    var variant = o.variant || 'blue';
    var col = { blue: 0x6fd0e8, red: 0xe86f6f, green: 0x8ce06f }[variant] || 0x6fd0e8;
    var tex = { blue: 'jellyBlue', red: 'jellyRed', green: 'jellyGreen' }[variant] || 'jellyBlue';
    Enemy.call(this, g, {
      x: o.x, y: o.y, z: o.z, hp: o.hp || 2, radius: 0.34, height: 0.85,
      speed: 1.7, attackRange: 1.0, damage: 0.5, contact: 0.5, sight: 8, delay: 0.9,
      windup: 0.34, strike: 0.3, recover: 0.5, drops: ['heart', 'rupeeG', null, 'magic']
    });
    this.variant = variant;
    this.setModel(LZ.charModel(g.r, 'chuchu_' + variant, function () { return blobRig(col, tex, 1); }, CLIPS.blob));
    this.height = 0.85;
    this.hopTimer = 0;
    this.lockHeight = 0.5;
    this.play('idle');
    this.anim.onEvent = (function (self) {
      return function (n) { if (n === 'hop') self.vel[1] = 4.2; };
    })(this);
    if (variant === 'red') this.contactBurn = true;
  }
  Chuchu.prototype = Object.create(Enemy.prototype);
  Chuchu.prototype.constructor = Chuchu;
  Chuchu.prototype.brain = function (dt, g) {
    this.meleeBrain(dt, g, { idle: 'idle', walk: 'hop', run: 'hop', attack: 'attack', hurt: 'hurt', alert: 'idle' });
    if (this.state === 'chase' && this.grounded) this.vel[1] = 3.4;
  };
  register('chuchu', function (g, o) { return new Chuchu(g, o); });

  /* --- Keese: flighty, dives, dies in one hit --- */
  function Keese(g, o) {
    o = o || {};
    Enemy.call(this, g, {
      x: o.x, y: o.y, z: o.z, hp: 1, radius: 0.26, height: 0.5,
      speed: 3.6, attackRange: 0.8, damage: 0.5, contact: 0.5, sight: 10, delay: 1.6,
      drops: ['heart', null, null]
    });
    this.flying = true;
    this.gravity = 0;
    this.element = o.element || null;   /* 'fire' | 'ice' */
    var col = this.element === 'fire' ? 0xe07040 : (this.element === 'ice' ? 0x80c8f0 : 0xffffff);
    this.setModel(LZ.charModel(g.r, 'keese_' + (this.element || 'n'), function () { return batRig(col); }, CLIPS.bat));
    this.hoverY = o.y + 1.7;
    this.phase = Math.random() * 10;
    this.diveTimer = 1 + Math.random() * 2;
    this.lockHeight = 0.2;
    this.play('idle');
  }
  Keese.prototype = Object.create(Enemy.prototype);
  Keese.prototype.constructor = Keese;
  Keese.prototype.brain = function (dt, g) {
    var p = g.player;
    this.phase += dt;
    var see = this.playerVisible(g);
    this.play('idle', { speed: this.state === 'dive' ? 2.2 : 1.2 });
    if (this.state === 'stagger') {
      this.stateTime += dt;
      if (this.stateTime > 0.3) this.state = 'idle';
      return;
    }
    if (!see) {
      var hx = this.homeX + Math.cos(this.phase * 0.7) * 2.2;
      var hz = this.homeZ + Math.sin(this.phase * 0.9) * 2.2;
      this.stepToward(dt, g, hx, hz, 1.6);
      this.pos[1] = M.damp(this.pos[1], this.hoverY + Math.sin(this.phase * 1.6) * 0.35, 3, dt);
      return;
    }
    this.diveTimer -= dt;
    if (this.state !== 'dive' && this.diveTimer <= 0) {
      this.state = 'dive';
      this.stateTime = 0;
      g.audio.sfx('swing', { minGap: 0.2 });
    }
    if (this.state === 'dive') {
      this.stateTime += dt;
      this.stepToward(dt, g, p.pos[0], p.pos[2], 6.2);
      this.pos[1] = M.damp(this.pos[1], p.pos[1] + 0.75, 6, dt);
      if (this.stateTime > 1.1) { this.state = 'idle'; this.diveTimer = 1.6 + Math.random() * 1.6; }
    } else {
      var ax = p.pos[0] + Math.cos(this.phase * 1.3) * 3.0;
      var az = p.pos[2] + Math.sin(this.phase * 1.1) * 3.0;
      this.stepToward(dt, g, ax, az, 3.2);
      this.pos[1] = M.damp(this.pos[1], p.pos[1] + 2.0 + Math.sin(this.phase * 2) * 0.4, 3, dt);
    }
    if (this.element === 'fire') g.particles.emit('fire', this.pos[0], this.pos[1], this.pos[2], 1);
  };
  register('keese', function (g, o) { return new Keese(g, o); });

  /* --- Skulltula: hangs, drops, armoured front --- */
  function Skulltula(g, o) {
    o = o || {};
    Enemy.call(this, g, {
      x: o.x, y: o.y, z: o.z, hp: 3, radius: 0.4, height: 0.8,
      speed: 2.0, attackRange: 1.15, damage: 1, contact: 0.5, sight: 7, delay: 1.0,
      windup: 0.36, strike: 0.24, recover: 0.6, drops: ['heart', 'rupeeB', null]
    });
    this.setModel(LZ.charModel(g.r, 'skulltula', function () { return spiderRig(0x3a4a2a); }, CLIPS.spider));
    this.hanging = !!o.hang;
    this.dropHeight = o.y;
    this.guardArc = 0.0;
    this.armouredBack = true;
    this.lockHeight = 0.5;
    if (this.hanging) { this.pos[1] = o.ceil || (o.y + 3.2); this.flying = true; this.gravity = 0; }
    this.play('idle');
  }
  Skulltula.prototype = Object.create(Enemy.prototype);
  Skulltula.prototype.constructor = Skulltula;
  Skulltula.prototype.onHurt = function (amount, source, opts) {
    /* its shell faces you; you have to get behind it, or use an arrow */
    if (this.armouredBack && source && opts && opts.source === 'sword') {
      var dx = source.pos[0] - this.pos[0], dz = source.pos[2] - this.pos[2];
      var ang = Math.abs(M.angleDelta(this.yaw, Math.atan2(dx, dz)));
      if (ang < 1.1) {
        this.game.audio.sfx('hit_metal');
        this.game.effects.impact(this.pos[0], this.pos[1] + 0.5, this.pos[2], true);
        this.game.hud.toast('Its shell turns the blade.');
        return false;
      }
    }
    return Enemy.prototype.onHurt.call(this, amount, source, opts);
  };
  Skulltula.prototype.brain = function (dt, g) {
    if (this.hanging) {
      var d = V3.distXZ(this.pos, g.player.pos);
      if (d < 2.6) {
        this.pos[1] = M.damp(this.pos[1], this.dropHeight, 6, dt);
        if (Math.abs(this.pos[1] - this.dropHeight) < 0.2) { this.hanging = false; this.flying = false; this.gravity = 22; }
      } else {
        this.pos[1] = M.damp(this.pos[1], (this.ceilY || this.dropHeight + 3.2), 3, dt);
      }
      this.play('idle');
      return;
    }
    this.meleeBrain(dt, g, CLIPS.spider ? { idle: 'idle', walk: 'walk', run: 'walk', attack: 'attack', hurt: 'hurt', alert: 'idle' } : null);
  };
  register('skulltula', function (g, o) { return new Skulltula(g, o); });

  /* --- Octorok: ranged, projectiles are deflectable --- */
  function Octorok(g, o) {
    o = o || {};
    Enemy.call(this, g, {
      x: o.x, y: o.y, z: o.z, hp: 2, radius: 0.34, height: 0.9,
      speed: 1.5, attackRange: 9, damage: 0.5, sight: 11, delay: 1.9,
      drops: ['heart', 'rupeeG', 'rupeeB', null]
    });
    this.setModel(LZ.charModel(g.r, 'octorok', function () { return octoRig(); }, CLIPS.octo));
    this.lockHeight = 0.5;
    this.play('idle');
  }
  Octorok.prototype = Object.create(Enemy.prototype);
  Octorok.prototype.constructor = Octorok;
  Octorok.prototype.brain = function (dt, g) {
    var p = g.player;
    this.stateTime += dt;
    var see = this.playerVisible(g);
    var dist = V3.distXZ(this.pos, p.pos);
    if (this.state === 'stagger') {
      this.play('hurt', { restart: this.stateTime < 0.02, blend: 0.04 });
      if (this.stateTime > 0.4) { this.state = 'idle'; this.stateTime = 0; }
      return;
    }
    if (this.state === 'spit') {
      this.faceTowards(p.pos[0], p.pos[2]);
      if (this.stateTime > 0.16 && !this.spat) {
        this.spat = true;
        var dir = V3.create(p.pos[0] - this.pos[0], (p.pos[1] + 0.7) - (this.pos[1] + 0.55), p.pos[2] - this.pos[2]);
        V3.normalize(dir, dir);
        g.spawnProjectile(this.pos[0], this.pos[1] + 0.55, this.pos[2], dir, {
          speed: 9, damage: 0.5, owner: this, kind: 'rock', deflect: true, life: 2.4
        });
        g.audio.sfx('swing');
      }
      if (this.stateTime > 0.5) { this.state = 'idle'; this.stateTime = 0; this.attackCooldown = this.attackDelay; }
      return;
    }
    if (see && dist < this.attackRange && this.attackCooldown <= 0) {
      this.state = 'spit'; this.stateTime = 0; this.spat = false;
      this.play('attack', { restart: true, blend: 0.06 });
      return;
    }
    this.attackCooldown -= dt;
    if (see && dist < 3.2) {
      /* back away so it stays a ranged threat */
      this.faceTowards(p.pos[0], p.pos[2]);
      this.moveXZ(-Math.sin(this.yaw) * 1.6 * dt, -Math.cos(this.yaw) * 1.6 * dt, g.world);
      this.play('walk', { blend: 0.16, speed: 1.1 });
    } else if (see) {
      this.faceTowards(p.pos[0], p.pos[2]);
      this.play('idle', { blend: 0.2 });
    } else {
      this.play('idle', { blend: 0.2 });
    }
  };
  register('octorok', function (g, o) { return new Octorok(g, o); });

  /* --- Tektite: leaps, skitters on water --- */
  function Tektite(g, o) {
    o = o || {};
    Enemy.call(this, g, {
      x: o.x, y: o.y, z: o.z, hp: 2, radius: 0.32, height: 0.8,
      speed: 2.6, attackRange: 1.0, damage: 0.5, contact: 0.5, sight: 9, delay: 0.7,
      drops: ['heart', 'rupeeG', null]
    });
    var col = o.variant === 'red' ? 0xe07060 : 0x88c8f0;
    this.setModel(LZ.charModel(g.r, 'tektite_' + (o.variant || 'b'), function () { return tektiteRig(col); }, CLIPS.tektite));
    this.lockHeight = 0.45;
    this.play('idle');
    this.anim.onEvent = (function (self) {
      return function (n) {
        if (n === 'hop' && self.grounded) {
          self.vel[1] = 6.2;
          var s = 4.2;
          self.vel[0] = Math.sin(self.yaw) * s;
          self.vel[2] = Math.cos(self.yaw) * s;
        }
      };
    })(this);
  }
  Tektite.prototype = Object.create(Enemy.prototype);
  Tektite.prototype.constructor = Tektite;
  Tektite.prototype.brain = function (dt, g) {
    var p = g.player;
    this.stateTime += dt;
    var see = this.playerVisible(g);
    if (this.state === 'stagger') {
      this.play('hurt', { restart: this.stateTime < 0.02 });
      if (this.stateTime > 0.4) this.state = 'idle';
      return;
    }
    if (!this.grounded) {
      this.moveXZ(this.vel[0] * dt, this.vel[2] * dt, g.world);
      this.play('hop');
      return;
    }
    this.vel[0] = 0; this.vel[2] = 0;
    if (see) {
      this.faceTowards(p.pos[0], p.pos[2]);
      this.play('hop');
    } else {
      this.play('idle', { blend: 0.2 });
    }
  };
  register('tektite', function (g, o) { return new Tektite(g, o); });

  /* --- Wolfos: circles, lunges, weak from behind --- */
  function Wolfos(g, o) {
    o = o || {};
    Enemy.call(this, g, {
      x: o.x, y: o.y, z: o.z, hp: 6, radius: 0.42, height: 1.0,
      speed: 3.6, attackRange: 1.6, damage: 1, sight: 12, delay: 1.5,
      windup: 0.42, strike: 0.26, recover: 0.75, leash: 20,
      drops: ['heart', 'heart', 'rupeeB', 'magic']
    });
    var col = o.variant === 'white' ? 0xe8eef4 : 0x9a9098;
    this.setModel(LZ.charModel(g.r, 'wolfos_' + (o.variant || 'g'), function () { return wolfRig(col); }, CLIPS.wolf));
    this.lungeSpeed = 7.5;
    this.lockHeight = 0.7;
    this.noticeSfx = 'roar';
    this.circleDir = Math.random() < 0.5 ? -1 : 1;
    this.play('idle');
  }
  Wolfos.prototype = Object.create(Enemy.prototype);
  Wolfos.prototype.constructor = Wolfos;
  Wolfos.prototype.brain = function (dt, g) {
    var p = g.player;
    if (this.state === 'chase') {
      /* prowl in an arc before committing */
      var dist = V3.distXZ(this.pos, p.pos);
      this.stateTime += dt;
      if (dist < this.attackRange && this.attackCooldown <= 0) {
        this.state = 'windup'; this.stateTime = 0;
        this.play('idle', { blend: 0.1 });
        g.audio.sfx('blip_low');
        return;
      }
      var ang = Math.atan2(this.pos[0] - p.pos[0], this.pos[2] - p.pos[2]) + this.circleDir * dt * 0.9;
      var want = Math.max(2.4, Math.min(dist - 0.4, 4.5));
      var tx = p.pos[0] + Math.sin(ang) * want;
      var tz = p.pos[2] + Math.cos(ang) * want;
      this.stepToward(dt, g, tx, tz, this.moveSpeed);
      this.faceTowards(p.pos[0], p.pos[2]);
      this.play(dist > 3 ? 'run' : 'walk', { blend: 0.14, speed: 1 });
      if (this.attackCooldown > 0) this.attackCooldown -= dt;
      if (this.stateTime > 5) this.circleDir *= -1, this.stateTime = 0;
      if (!this.playerVisible(g)) { this.state = 'return'; this.stateTime = 0; }
      return;
    }
    this.meleeBrain(dt, g, { idle: 'idle', walk: 'walk', run: 'run', attack: 'attack', hurt: 'hurt', alert: 'idle' });
  };
  register('wolfos', function (g, o) { return new Wolfos(g, o); });

  /* --- Moblin: humanoid brute with a club --- */
  function Moblin(g, o) {
    o = o || {};
    var big = !!o.big;
    Enemy.call(this, g, {
      x: o.x, y: o.y, z: o.z, hp: big ? 12 : 6, radius: big ? 0.55 : 0.42, height: big ? 2.1 : 1.6,
      speed: big ? 2.2 : 2.9, attackRange: big ? 2.2 : 1.7, damage: big ? 1.5 : 1,
      sight: 12, delay: big ? 1.9 : 1.3, windup: big ? 0.62 : 0.44, strike: 0.28,
      recover: big ? 0.95 : 0.65, leash: 22,
      drops: big ? ['heart', 'heart', 'rupeeR', 'magicBig'] : ['heart', 'rupeeB', 'rupeeG', null]
    });
    var scale = big ? 1.34 : 1.05;
    this.setModel(LZ.charModel(g.r, 'moblin_' + (big ? 'b' : 's'), function () {
      return LZ.Models.humanoid({
        build: big ? 'heavy' : 'adult', scale: scale,
        skin: big ? 0x7a8a52 : 0x8f9a5e, cloth: 0x6a4a30, clothDark: 0x44301e,
        trim: 0x8a7a50, pants: 0x4a3a24, boots: 0x3a2c1c,
        hair: 0x2a2418, hairStyle: 'bald', hat: 'none',
        clothTex: 'leather', skinTex: 'scaleGreen', bootTex: 'leatherDark',
        glove: 0x5a4630, gloveTex: 'leatherDark', eyeColor: 0xd04030, mouth: true
      });
    }, LZ.Models.getHumanoidClips()));
    this.big = big;
    this.lungeSpeed = big ? 2.4 : 3.4;
    this.lockHeight = this.height * 0.6;
    this.weaponMesh = g.enemyWeaponMesh(big ? 'greatclub' : 'club');
    this.noticeSfx = big ? 'roar' : 'blip_low';
    this.play('idle');
  }
  Moblin.prototype = Object.create(Enemy.prototype);
  Moblin.prototype.constructor = Moblin;
  Moblin.prototype.brain = function (dt, g) {
    this.meleeBrain(dt, g, {
      idle: 'idleAlert', walk: 'walk', run: 'run',
      windup: 'attack3', attack: 'attack1', hurt: 'hurt', alert: 'idleAlert', guard: 'guardHit'
    });
  };
  Moblin.prototype.drawExtra = function (g) {
    var bm = this.anim.boneMatrix('itemR');
    if (bm) g.r.submit(this.weaponMesh, bm, g.assets.mat.planksDark);
  };
  register('moblin', function (g, o) { return new Moblin(g, o); });

  /* --- Stalfos: parries the front, must be baited --- */
  function Stalfos(g, o) {
    o = o || {};
    Enemy.call(this, g, {
      x: o.x, y: o.y, z: o.z, hp: 8, radius: 0.4, height: 1.65,
      speed: 3.1, attackRange: 1.7, damage: 1, sight: 13, delay: 1.15,
      windup: 0.38, strike: 0.24, recover: 0.72, leash: 24, metal: true,
      drops: ['heart', 'rupeeB', 'magic', null]
    });
    this.setModel(LZ.charModel(g.r, 'stalfos', function () {
      return LZ.Models.humanoid({
        build: 'adult', scale: 1.06,
        skin: 0xe4dcc0, cloth: 0xd8d0b4, clothDark: 0xa89c80,
        trim: 0x8a7f60, pants: 0xbcb298, boots: 0x6a6050,
        hair: 0x8a8068, hairStyle: 'bald', hat: 'none',
        clothTex: 'bone', skinTex: 'bone', bootTex: 'leatherDark',
        glove: 0xd8d0b4, gloveTex: 'bone', eyeColor: 0xff6020, mouth: false, skirt: false
      });
    }, LZ.Models.getHumanoidClips()));
    this.guardArc = 0.95;
    this.lockHeight = 1.0;
    this.weaponMesh = g.enemyWeaponMesh('boneblade');
    this.shieldMesh = g.enemyWeaponMesh('boneshield');
    this.noticeSfx = 'hit_metal';
    this.play('guard');
  }
  Stalfos.prototype = Object.create(Enemy.prototype);
  Stalfos.prototype.constructor = Stalfos;
  Stalfos.prototype.brain = function (dt, g) {
    this.meleeBrain(dt, g, {
      idle: 'guard', walk: 'strafe', run: 'run',
      windup: 'attack3', attack: 'attack2', hurt: 'hurt', alert: 'guard', guard: 'guardHit'
    });
    /* the guard drops during its own recovery, which is the opening */
    this.guardArc = (this.state === 'recover' || this.state === 'stagger') ? 0 : 0.95;
  };
  Stalfos.prototype.drawExtra = function (g) {
    var r = this.anim.boneMatrix('itemR');
    if (r) g.r.submit(this.weaponMesh, r, g.assets.mat.bone);
    var l = this.anim.boneMatrix('itemL');
    if (l) g.r.submit(this.shieldMesh, l, g.assets.mat.bone);
  };
  register('stalfos', function (g, o) { return new Stalfos(g, o); });

  /* --- Gibdo: slow, terrifying, freezes you if it grabs --- */
  function Gibdo(g, o) {
    o = o || {};
    Enemy.call(this, g, {
      x: o.x, y: o.y, z: o.z, hp: 7, radius: 0.4, height: 1.7,
      speed: 1.3, attackRange: 1.4, damage: 1, sight: 10, delay: 1.8,
      windup: 0.7, strike: 0.3, recover: 1.1, leash: 18,
      drops: ['heart', 'rupeeB', null]
    });
    this.setModel(LZ.charModel(g.r, 'gibdo', function () {
      return LZ.Models.humanoid({
        build: 'lanky', scale: 1.0,
        skin: 0xcfc4a4, cloth: 0xd8cdb0, clothDark: 0xa89c80,
        trim: 0x8a7f60, pants: 0xbcb298, boots: 0x9a9078,
        hair: 0x9a9078, hairStyle: 'bald', hat: 'none',
        clothTex: 'clothWhite', skinTex: 'clothWhite', bootTex: 'clothWhite',
        glove: 0xd8cdb0, gloveTex: 'clothWhite', eyeColor: 0x101014, mouth: false
      });
    }, LZ.Models.getHumanoidClips()));
    this.lockHeight = 1.0;
    this.noticeSfx = 'roar';
    this.play('idle');
  }
  Gibdo.prototype = Object.create(Enemy.prototype);
  Gibdo.prototype.constructor = Gibdo;
  Gibdo.prototype.onNotice = function (g) {
    /* the scream roots you for a moment unless you are wearing the wrappings */
    if (g.inv.wornMask === 'gibdoMask') return;
    if (V3.distXZ(this.pos, g.player.pos) < 6) {
      g.player.frozenCtl = Math.max(g.player.frozenCtl, 0.7);
      g.hud.toast('You freeze in place!');
      g.cam.addShake(0.2);
    }
  };
  Gibdo.prototype.playerVisible = function (g) {
    if (g.inv.wornMask === 'gibdoMask') return false;
    return Enemy.prototype.playerVisible.call(this, g);
  };
  Gibdo.prototype.brain = function (dt, g) {
    this.meleeBrain(dt, g, {
      idle: 'stagger', walk: 'stagger', run: 'stagger',
      windup: 'attack3', attack: 'attack1', hurt: 'hurt', alert: 'stagger'
    });
  };
  register('gibdo', function (g, o) { return new Gibdo(g, o); });

  /* --- Poe: invisible without the Lens --- */
  function Poe(g, o) {
    o = o || {};
    Enemy.call(this, g, {
      x: o.x, y: o.y, z: o.z, hp: 4, radius: 0.32, height: 1.1,
      speed: 3.0, attackRange: 1.4, damage: 1, sight: 11, delay: 1.5,
      windup: 0.4, strike: 0.24, recover: 0.6,
      drops: ['heart', 'magic', 'rupeeR', null]
    });
    this.flying = true; this.gravity = 0;
    this.setModel(LZ.charModel(g.r, 'poe', function () { return wispRig(0xffffff); }, CLIPS.wisp));
    this.hoverY = o.y + 0.4;
    this.phase = Math.random() * 8;
    this.visibleT = 0;
    this.lockHeight = 0.9;
    this.play('idle');
  }
  Poe.prototype = Object.create(Enemy.prototype);
  Poe.prototype.constructor = Poe;
  Poe.prototype.brain = function (dt, g) {
    this.phase += dt;
    var p = g.player;
    var lens = g.player.lensOn;
    /* it flickers into view just before it strikes, so it is always fair */
    this.visibleT = lens ? 1 : (this.state === 'windup' || this.state === 'attack' ? 1 : Math.max(0, this.visibleT - dt * 2));
    this.alpha = lens ? 0.85 : (0.12 + this.visibleT * 0.75);
    this.lockable = lens || this.visibleT > 0.4;
    this.pos[1] = M.damp(this.pos[1], this.hoverY + Math.sin(this.phase * 1.4) * 0.3, 3, dt);
    if (this.state === 'chase' && Math.random() < dt * 0.5) {
      /* blink */
      var a = Math.random() * M.TAU;
      this.pos[0] = p.pos[0] + Math.cos(a) * 3.2;
      this.pos[2] = p.pos[2] + Math.sin(a) * 3.2;
      g.effects.puff(this.pos[0], this.pos[1], this.pos[2]);
      g.audio.sfx('warp', { minGap: 0.6 });
    }
    if (this.state === 'windup') this.visibleT = 1;
    this.meleeBrain(dt, g, { idle: 'idle', walk: 'idle', run: 'idle', attack: 'attack', hurt: 'hurt', alert: 'idle' });
    if (Math.random() < dt * 3) {
      g.particles.emit('dark', this.pos[0], this.pos[1] - 0.3, this.pos[2], 1, 0.25);
    }
  };
  register('poe', function (g, o) { return new Poe(g, o); });

  /* --- Ember Beetle: swarms, explodes on death --- */
  function EmberBeetle(g, o) {
    o = o || {};
    Enemy.call(this, g, {
      x: o.x, y: o.y, z: o.z, hp: 1, radius: 0.26, height: 0.45,
      speed: 4.2, attackRange: 0.8, damage: 0.5, contact: 0.5, sight: 12, delay: 0.6,
      drops: [null, 'heart', null]
    });
    this.setModel(LZ.charModel(g.r, 'emberBeetle', function () { return beetleRig(0xd04828); }, CLIPS.beetle));
    this.lockHeight = 0.3;
    this.play('idle');
  }
  EmberBeetle.prototype = Object.create(Enemy.prototype);
  EmberBeetle.prototype.constructor = EmberBeetle;
  EmberBeetle.prototype.onDefeat = function (g) {
    g.explode(this.pos[0], this.pos[1] + 0.2, this.pos[2], { radius: 1.7, damage: 0.5, owner: this, small: true });
  };
  EmberBeetle.prototype.brain = function (dt, g) {
    this.meleeBrain(dt, g, { idle: 'idle', walk: 'walk', run: 'walk', attack: 'attack', hurt: 'hurt', alert: 'idle' });
    if (Math.random() < dt * 6) g.particles.emit('fire', this.pos[0], this.pos[1] + 0.2, this.pos[2], 1);
  };
  register('emberBeetle', function (g, o) { return new EmberBeetle(g, o); });

  /* --- Armos: dormant statue, wakes and slams --- */
  function Armos(g, o) {
    o = o || {};
    Enemy.call(this, g, {
      x: o.x, y: o.y, z: o.z, hp: 8, radius: 0.5, height: 1.9,
      speed: 2.6, attackRange: 1.7, damage: 1.5, sight: 4.5, delay: 0.9,
      metal: true, drops: ['heart', 'rupeeR', 'magic']
    });
    this.setModel(LZ.charModel(g.r, 'armos', function () { return armosRig(); }, CLIPS.armos));
    this.awake = false;
    this.lockable = false;
    this.lockHeight = 1.0;
    this.play('idle');
    this.anim.onEvent = (function (self) {
      return function (n) {
        if (n === 'hop' && self.awake && self.grounded) self.vel[1] = 4.6;
        if (n === 'slam' && self.awake) {
          var g2 = self.game;
          g2.cam.addShake(0.22);
          g2.audio.sfx('land');
          g2.particles.emit('dust', self.pos[0], self.pos[1], self.pos[2], 8, 1.5);
          if (V3.distXZ(self.pos, g2.player.pos) < 1.9 && g2.player.grounded) {
            g2.player.damage(1.5, self, { knockback: 8 });
          }
        }
      };
    })(this);
    this.collider = g.world.col.add(C.cyl(o.x, o.y, o.z, 0.55, 1.9, { ref: this }));
  }
  Armos.prototype = Object.create(Enemy.prototype);
  Armos.prototype.constructor = Armos;
  Armos.prototype.onHurt = function (a, s, opts) {
    if (!this.awake) { this.wake(this.game); return false; }
    return Enemy.prototype.onHurt.call(this, a, s, opts);
  };
  Armos.prototype.wake = function (g) {
    if (this.awake) return;
    this.awake = true;
    this.lockable = true;
    this.aggro = true;
    g.audio.sfx('rumble');
    g.cam.addShake(0.25);
    g.particles.emit('dust', this.pos[0], this.pos[1], this.pos[2], 12, 1.8);
    if (this.collider) { g.world.col.remove(this.collider); this.collider = null; }
  };
  Armos.prototype.brain = function (dt, g) {
    if (!this.awake) {
      if (V3.distXZ(this.pos, g.player.pos) < this.sight) this.wake(g);
      this.play('idle');
      return;
    }
    var p = g.player;
    this.faceTowards(p.pos[0], p.pos[2]);
    this.play('hop');
    if (this.grounded) {
      this.stepToward(dt, g, p.pos[0], p.pos[2], this.moveSpeed * 0.5);
    } else {
      this.moveXZ(Math.sin(this.yaw) * this.moveSpeed * dt, Math.cos(this.yaw) * this.moveSpeed * dt, g.world);
    }
  };
  register('armos', function (g, o) { return new Armos(g, o); });

  /* --- Beamos: turret; the mirror shield sends the beam home --- */
  function Beamos(g, o) {
    o = o || {};
    Enemy.call(this, g, {
      x: o.x, y: o.y, z: o.z, hp: 3, radius: 0.55, height: 2.1,
      speed: 0, sight: 11, damage: 1, metal: true, drops: [null]
    });
    this.setModel(LZ.charModel(g.r, 'beamos', function () { return beamosRig(); }, CLIPS.beamos));
    this.spin = 0;
    this.charge = 0;
    this.firing = 0;
    this.lockable = false;
    this.invulnToSword = true;
    this.lockHeight = 1.6;
    g.world.col.add(C.cyl(o.x, o.y, o.z, 0.55, 2.0, {}));
    this.play('idle');
  }
  Beamos.prototype = Object.create(Enemy.prototype);
  Beamos.prototype.constructor = Beamos;
  Beamos.prototype.onHurt = function (a, s, opts) {
    if (opts && opts.source === 'explosion') return Enemy.prototype.onHurt.call(this, a, s, opts);
    this.game.audio.sfx('hit_metal');
    return false;
  };
  Beamos.prototype.brain = function (dt, g) {
    var p = g.player;
    var d = V3.distXZ(this.pos, p.pos);
    var see = d < this.sight && !g.player.hidden;
    this.spin += dt * (see ? 0 : 1.4);
    if (see) {
      this.faceTowards(p.pos[0], p.pos[2]);
      this.charge += dt;
      if (this.charge > 0.85 && this.firing <= 0) {
        this.firing = 0.5;
        this.charge = 0;
        g.audio.sfx('magic');
        var dir = V3.create(p.pos[0] - this.pos[0], (p.pos[1] + 0.8) - (this.pos[1] + 1.6), p.pos[2] - this.pos[2]);
        V3.normalize(dir, dir);
        g.spawnProjectile(this.pos[0], this.pos[1] + 1.6, this.pos[2], dir, {
          speed: 16, damage: 1, owner: this, kind: 'beam', reflect: true, life: 1.4
        });
      }
    } else {
      this.charge = 0;
      this.targetYaw = this.spin;
    }
    if (this.firing > 0) this.firing -= dt;
    this.tint = this.charge > 0.3 ? [1, 0.3, 0.2, this.charge * 0.4] : [0, 0, 0, 0];
    this.play('idle');
  };
  register('beamos', function (g, o) { return new Beamos(g, o); });

  /* --- Sand Eel: burrows, surfaces to bite --- */
  function SandEel(g, o) {
    o = o || {};
    Enemy.call(this, g, {
      x: o.x, y: o.y, z: o.z, hp: 5, radius: 0.5, height: 1.4,
      speed: 3.4, attackRange: 1.8, damage: 1, sight: 12, delay: 1.4,
      drops: ['heart', 'rupeeB', 'magic']
    });
    this.setModel(LZ.charModel(g.r, 'sandeel', function () { return wormRig(); }, CLIPS.worm));
    this.buried = true;
    this.gravity = 0;
    this.flying = true;
    this.surfaceT = 0;
    this.lockHeight = 0.9;
    this.baseY = o.y;
    this.play('idle');
  }
  SandEel.prototype = Object.create(Enemy.prototype);
  SandEel.prototype.constructor = SandEel;
  SandEel.prototype.brain = function (dt, g) {
    var p = g.player;
    var d = V3.distXZ(this.pos, p.pos);
    this.stateTime += dt;
    this.baseY = g.world.groundHeight(this.pos[0], this.pos[2]);
    if (this.buried) {
      this.pos[1] = M.damp(this.pos[1], this.baseY - 1.6, 6, dt);
      this.lockable = false;
      this.alpha = 1;
      if (d < 9) {
        this.stepToward(dt, g, p.pos[0], p.pos[2], 3.0);
        if (Math.random() < dt * 4) {
          g.particles.emit('dust', this.pos[0], this.baseY + 0.05, this.pos[2], 2, 0.5, [0.85, 0.76, 0.55, 0.7]);
        }
      }
      if (d < 2.2 && this.stateTime > 1.4) {
        this.buried = false;
        this.stateTime = 0;
        g.audio.sfx('roar');
        g.particles.emit('dust', this.pos[0], this.baseY, this.pos[2], 14, 2.2, [0.9, 0.8, 0.6, 0.85]);
      }
      return;
    }
    this.lockable = true;
    this.pos[1] = M.damp(this.pos[1], this.baseY + 0.1, 8, dt);
    this.faceTowards(p.pos[0], p.pos[2]);
    if (this.stateTime > 3.4) {
      this.buried = true; this.stateTime = 0;
      g.particles.emit('dust', this.pos[0], this.baseY, this.pos[2], 10, 1.6, [0.9, 0.8, 0.6, 0.8]);
      return;
    }
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (d < this.attackRange && this.attackCooldown <= 0) {
      this.attackCooldown = this.attackDelay;
      this.play('attack', { restart: true, blend: 0.06 });
      g.audio.sfx('swing_heavy');
      var self = this;
      setTimeout(function () { if (self.alive) self.strikePlayer(g, 2.0, 1, 1.4); }, 220);
    } else {
      this.play('idle');
    }
  };
  register('sandeel', function (g, o) { return new SandEel(g, o); });

  LZ.Enemy = Enemy;
  LZ.Enemies = {
    make: function (g, id, o) {
      var f = REG[id];
      if (!f) { console.warn('unknown enemy: ' + id); return null; }
      return f(g, o);
    },
    ids: function () { return Object.keys(REG); },
    CLIPS: CLIPS,
    rigs: {
      blob: blobRig, bat: batRig, spider: spiderRig, octo: octoRig, tektite: tektiteRig,
      wolf: wolfRig, wisp: wispRig, beetle: beetleRig, armos: armosRig, beamos: beamosRig, worm: wormRig
    }
  };
})(LZ);
