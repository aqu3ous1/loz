/* =============================================================
   game/player.js -- the player character.

   Control model is deliberately Ocarina-shaped: context-sensitive A,
   sword on B, shield on R, Z-target on Z, three C-item slots, and
   analog movement relative to the camera. On top of that sit the newer
   ideas the brief asked for -- swappable weapons with durability, masks,
   and the two flute-driven time mechanics.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var M = LZ.M, V3 = LZ.V3, M4 = LZ.M4, GL = LZ.GL, Items = LZ.Items;

  var WALK_SPEED = 2.35;
  var RUN_SPEED = 5.30;
  var SWIM_SPEED = 2.30;
  var ROLL_SPEED = 7.40;
  var ACCEL = 26;
  var AIR_ACCEL = 7;
  var JUMP_VEL = 6.2;

  function Player(game, x, y, z, yaw) {
    LZ.Actor.call(this, {
      kind: 'player', x: x, y: y, z: z, yaw: yaw,
      radius: 0.30, height: 1.42, team: 'player', hp: 1
    });
    this.game = game;
    this.inv = game.inv;
    this.state = 'ground';
    this.stateTime = 0;
    this.comboStep = 0;
    this.comboWindow = 0;
    this.attackTimer = 0;
    this.hitActive = false;
    this.hitList = [];
    this.chargeTime = 0;
    this.spinReady = false;
    this.lockTarget = null;
    this.lockHold = 0;
    this.guarding = false;
    this.guardAngle = 0;
    this.aiming = false;
    this.aimTool = null;
    this.carry = null;
    this.climbing = null;
    this.invulnTime = 0;
    this.hurtCooldown = 0;
    this.stepTimer = 0;
    this.airTime = 0;
    this.turnSpeed = 12;
    this.lockable = false;
    this.castShadow = true;
    this.shadowSize = 1.05;
    this.frozenCtl = 0;
    this.hookshot = null;
    this.deathTimer = 0;
    this.magicDrain = 0;
    this.lastSafe = V3.create(x, y, z);
    this.safeTimer = 0;
    this.swimTimer = 0;
    this.noControl = 0;
    this.songMode = false;
    this.songBuffer = [];
    this.songTimer = 0;
    this.lastDamageSource = null;
    this.bonked = 0;
    this.interact = null;
    this.forceAnim = null;
    this.warpFade = 0;
    this.fpTime = 0;
    this.equipFlash = 0;
    this.breakFlash = 0;
    this.recoil = 0;
    this.trailTimer = 0;

    this.setModel(LZ.charModel(game.r, 'player', function () {
      /* The palette matters as much as the mesh. The tunic is a bright
         kelly green, the undershirt and leggings are cream, the gauntlets
         are tan leather, and the hair is dirty blond -- four clearly
         separated values, so the character stays readable as a silhouette
         of coloured blocks at 320x240. */
      return LZ.Models.humanoid({
        build: 'hero', scale: 1.0,
        skin: 0xf4c9a0, cloth: 0x46b04e, clothDark: 0x2c7c38, trim: 0xe8c65c,
        pants: 0xeae2cc, boots: 0x7a5230, beltColor: 0x74512c,
        hair: 0xd8b25a, hairStyle: 'short',
        hat: 'cap', hatColor: 0x46b04e,
        under: 0xeae2cc, glove: 0xb4864e, gloveTex: 'leatherPlain',
        sleeveTrim: 0x2c7c38,
        clothTex: 'clothPlain', eyeColor: 0x2f6aa8
      });
    }, LZ.Models.getHumanoidClips()));
    this.height = 1.42;
    this.play('idle');
    this.anim.onEvent = this._onAnimEvent.bind(this);
  }
  Player.prototype = Object.create(LZ.Actor.prototype);
  Player.prototype.constructor = Player;

  /* ---------------------------------------------------------------- */
  /* helpers                                                           */
  /* ---------------------------------------------------------------- */
  Player.prototype.weaponDef = function () { return this.inv.weaponDef(); };
  Player.prototype.canAct = function () {
    return this.noControl <= 0 && !this.game.dialogue.active && !this.game.cutscene.active &&
      this.state !== 'dead' && this.state !== 'hurt' && this.frozenCtl <= 0;
  };
  Player.prototype.setState = function (s) {
    this.state = s;
    this.stateTime = 0;
  };

  Player.prototype._onAnimEvent = function (name) {
    var g = this.game;
    switch (name) {
      case 'step': this._footstep(); break;
      case 'swing':
        g.audio.sfx(this.chargeRelease ? 'swing_heavy' : 'swing');
        this._spawnSlash();
        break;
      case 'hitOn': this.hitActive = true; this.hitList.length = 0; break;
      case 'hitOff': this.hitActive = false; break;
      case 'spinGo':
        g.audio.sfx('swing_heavy');
        this._spawnSlash(true);
        g.cam.addShake(0.18);
        break;
      case 'landThud': this._landDust(); break;
      case 'rollGo': g.audio.sfx('roll'); break;
      case 'release': this._releaseItem(); break;
      case 'castRelease': this._castRelease(); break;
    }
  };

  Player.prototype._footstep = function () {
    var g = this.game;
    var surf = this.groundSurface || g.world.surfaceAt(this.pos[0], this.pos[2]);
    var map = {
      grass: 'step_grass', dirt: 'step_grass', sand: 'step_sand', stone: 'step_stone',
      wood: 'step_wood', water: 'step_water', snow: 'step_sand', tile: 'step_stone'
    };
    if (this.inWater) g.audio.sfx('step_water');
    else g.audio.sfx(map[surf] || 'step_grass');
    if (surf === 'sand' || surf === 'dirt') {
      g.particles.emit('dust', this.pos[0], this.pos[1] + 0.03, this.pos[2], 2, 0.35,
        surf === 'sand' ? [0.86, 0.78, 0.56, 0.5] : [0.6, 0.5, 0.38, 0.45]);
    }
  };
  Player.prototype._landDust = function () {
    this.game.particles.emit('dust', this.pos[0], this.pos[1] + 0.02, this.pos[2], 7, 1.1);
    this.game.audio.sfx('land');
  };

  /* ---------------------------------------------------------------- */
  /* combat                                                            */
  /* ---------------------------------------------------------------- */
  Player.prototype._spawnSlash = function (big) {
    var d = this.weaponDef();
    var g = this.game;
    var reach = (d ? d.reach : 0.9) * (big ? 1.5 : 1);
    g.effects.slash(this.pos[0] + Math.sin(this.yaw) * reach * 0.55,
      this.pos[1] + 0.80,
      this.pos[2] + Math.cos(this.yaw) * reach * 0.55,
      this.yaw, big ? 2.4 : 1.5, d && d.glow ? d.glow : [1, 1, 1], big);
  };

  Player.prototype._applyAttack = function (dt) {
    if (!this.hitActive) return;
    var g = this.game;
    var d = this.weaponDef();
    var reach = (d ? d.reach : 0.9) + 0.42;
    var dmg = d ? d.atk : 1;
    if (this.chargeRelease) dmg = Math.ceil(dmg * 1.6);
    var arc = this.chargeRelease ? Math.PI : 1.25;
    var hitAny = false;
    for (var i = 0; i < g.world.actors.length; i++) {
      var a = g.world.actors[i];
      if (a === this || !a.alive || a.dead) continue;
      if (a.team !== 'enemy' && !a.breakable) continue;
      if (this.hitList.indexOf(a) >= 0) continue;
      var dx = a.pos[0] - this.pos[0], dz = a.pos[2] - this.pos[2];
      var dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > reach + (a.hurtRadius || a.radius)) continue;
      if (Math.abs(a.pos[1] + (a.hurtHeight || a.height) * 0.5 - (this.pos[1] + 0.7)) > 1.5) continue;
      var ang = Math.abs(M.angleDelta(this.yaw, Math.atan2(dx, dz)));
      if (ang > arc) continue;
      this.hitList.push(a);
      hitAny = true;
      var opts = {
        knockback: this.chargeRelease ? 7 : 4.5, stun: 0.34,
        element: d ? d.element : null, source: 'sword'
      };
      var res = a.hurt(dmg, this, opts);
      if (res !== false) {
        g.audio.sfx(a.metal ? 'hit_metal' : 'hit');
        g.effects.impact(a.pos[0], a.pos[1] + (a.hurtHeight || a.height) * 0.55, a.pos[2], a.metal);
        g.cam.addShake(0.10);
        g.hitStop(0.055);
        if (d && d.element === 'ice') a.frozen = Math.max(a.frozen, 2.2);
        if (d && d.element === 'fire') a.burning = Math.max(a.burning, 2.4);
      } else {
        g.audio.sfx('hit_metal');
        g.effects.impact(a.pos[0], a.pos[1] + a.height * 0.55, a.pos[2], true);
      }
    }
    /* breakable scenery */
    if (hitAny || true) {
      var solids = g.world.col.query(this.pos[0] + Math.sin(this.yaw) * reach * 0.6,
        this.pos[2] + Math.cos(this.yaw) * reach * 0.6, reach, []);
      for (var s = 0; s < solids.length; s++) {
        var so = solids[s];
        if (so.tag === 'grassTuft' && so.ref && !so.ref.cut) {
          so.ref.cut = true;
          if (so.ref.onCut) so.ref.onCut(g);
        }
      }
    }
    if (hitAny) {
      var broke = this.inv.wearWeapon(1);
      if (broke === 'broke') this._weaponBroke();
    }
  };

  Player.prototype._weaponBroke = function () {
    var g = this.game;
    g.audio.sfx('break_weapon');
    g.effects.burst(this.pos[0] + Math.sin(this.yaw) * 0.7, this.pos[1] + 0.9,
      this.pos[2] + Math.cos(this.yaw) * 0.7, [0.85, 0.85, 0.9]);
    g.cam.addShake(0.25);
    this.breakFlash = 1.2;
    g.hud.toast('Your weapon broke!');
    this.hitActive = false;
  };

  Player.prototype.tryAttack = function () {
    if (!this.inv.weapon()) {
      this.game.hud.toast('You have no weapon equipped.');
      this.game.audio.sfx('error');
      return;
    }
    if (this.state === 'attack' && this.comboWindow > 0) {
      this.comboStep = (this.comboStep + 1) % 3;
      this._startAttack();
      return;
    }
    if (this.state !== 'ground' && this.state !== 'lock') return;
    if (!this.grounded) { this.comboStep = 2; this._startAttack(); return; }
    var lockedForward = this.lockTarget && this.game.input.stickMag() > 0.4;
    this.comboStep = lockedForward ? 3 : 0;
    this._startAttack();
  };

  Player.prototype._startAttack = function () {
    var d = this.weaponDef();
    var speed = d ? d.speed : 1;
    var names = ['attack1', 'attack2', 'attack3', 'stab'];
    var name = names[this.comboStep] || 'attack1';
    this.setState('attack');
    this.chargeRelease = false;
    this.hitActive = false;
    this.hitList.length = 0;
    this.play(name, { restart: true, blend: 0.05, speed: speed });
    this.attackTimer = (this.anim.clip.duration / speed);
    this.comboWindow = 0;
    if (this.lockTarget) this.faceTowards(this.lockTarget.pos[0], this.lockTarget.pos[2], true);
    /* a small lunge makes the swing feel like it has weight behind it */
    this.lunge = (this.comboStep === 3) ? 3.6 : 1.7;
  };

  Player.prototype._startSpin = function () {
    var d = this.weaponDef();
    this.setState('attack');
    this.chargeRelease = true;
    this.hitActive = false;
    this.hitList.length = 0;
    this.play('spin', { restart: true, blend: 0.05, speed: d ? d.speed : 1 });
    this.attackTimer = this.anim.clip.duration;
    this.lunge = 0;
    this.chargeTime = 0;
    this.spinReady = false;
    this.game.effects.spinRing(this.pos[0], this.pos[1] + 0.15, this.pos[2]);
  };

  /* ---------------------------------------------------------------- */
  /* damage                                                            */
  /* ---------------------------------------------------------------- */
  Player.prototype.damage = function (amount, source, opts) {
    opts = opts || {};
    var g = this.game;
    if (this.invulnTime > 0 || this.state === 'dead' || g.cutscene.active) return false;
    if (this.state === 'roll' && opts.dodgeable !== false && this.stateTime < 0.34) {
      /* i-frames on the roll, the way the era's games rewarded timing */
      g.hud.flashDodge();
      return false;
    }
    /* shield: blocks anything inside a 100 degree cone in front */
    if (this.guarding && source && opts.blockable !== false) {
      var dx = source.pos[0] - this.pos[0], dz = source.pos[2] - this.pos[2];
      var ang = Math.abs(M.angleDelta(this.yaw, Math.atan2(dx, dz)));
      if (ang < 0.92) {
        var sd = this.inv.shieldDef();
        var reduce = sd ? sd.guard : 0;
        g.audio.sfx('guard');
        g.cam.addShake(0.12);
        g.effects.impact(this.pos[0] + Math.sin(this.yaw) * 0.5, this.pos[1] + 0.8,
          this.pos[2] + Math.cos(this.yaw) * 0.5, true);
        this.play('guardHit', { restart: true, blend: 0.04 });
        var through = Math.max(0, amount - reduce);
        var brokeS = this.inv.wearShield(1);
        if (brokeS === 'broke') {
          g.audio.sfx('break_weapon');
          g.hud.toast('Your shield broke!');
        }
        this.knock[0] = -Math.sin(this.yaw) * 3.2;
        this.knock[2] = -Math.cos(this.yaw) * 3.2;
        if (through <= 0) return false;
        amount = through;
      }
    }

    this.invulnTime = opts.invuln === undefined ? 1.1 : opts.invuln;
    this.lastDamageSource = source;
    var dead = this.inv.damage(amount);
    g.audio.sfx('hurt');
    g.cam.addShake(0.32);
    g.hitStop(0.09);
    g.hud.damageFlash();
    if (source) {
      var kx = this.pos[0] - source.pos[0], kz = this.pos[2] - source.pos[2];
      var kl = Math.sqrt(kx * kx + kz * kz) || 1;
      this.knock[0] = kx / kl * (opts.knockback || 6.5);
      this.knock[2] = kz / kl * (opts.knockback || 6.5);
      this.faceTowards(source.pos[0], source.pos[2], true);
    }
    this.vel[1] = Math.max(this.vel[1], 2.6);
    if (dead) { this.startDeath(); }
    else {
      this.setState('hurt');
      this.play('hurt', { restart: true, blend: 0.04 });
      this.noControl = 0.36;
    }
    return true;
  };

  Player.prototype.startDeath = function () {
    var g = this.game;
    /* a bottled fairy revives you, as tradition demands */
    var fi = this.inv.firstBottleWith('fairy');
    if (fi >= 0) {
      this.inv.bottles[fi] = null;
      this.inv.hearts = Math.min(this.inv.maxHearts, 8);
      g.audio.sfx('secret');
      g.effects.fairyRevive(this.pos[0], this.pos[1] + 0.8, this.pos[2]);
      this.invulnTime = 2.0;
      this.setState('ground');
      g.hud.toast('The fairy gave her life for yours.');
      return;
    }
    this.setState('dead');
    this.play('die', { restart: true, blend: 0.06 });
    this.deathTimer = 0;
    this.lockTarget = null;
    g.audio.sfx('die');
    g.audio.stopSong();
    this.inv.deaths++;
  };

  Player.prototype.heal = function (n) {
    this.inv.heal(n);
    this.game.audio.sfx('heart');
    this.game.effects.heal(this.pos[0], this.pos[1] + 0.7, this.pos[2]);
  };

  /* ---------------------------------------------------------------- */
  /* lock-on                                                           */
  /* ---------------------------------------------------------------- */
  Player.prototype.findLockTarget = function () {
    var g = this.game;
    var best = null, bestScore = 1e9;
    var camYaw = g.cam.yaw + Math.PI;
    for (var i = 0; i < g.world.actors.length; i++) {
      var a = g.world.actors[i];
      if (a === this || !a.lockable || !a.alive || a.dead || a.hidden) continue;
      var dx = a.pos[0] - this.pos[0], dz = a.pos[2] - this.pos[2];
      var dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > (a.lockRange || 15)) continue;
      var ang = Math.abs(M.angleDelta(camYaw, Math.atan2(dx, dz)));
      if (ang > 1.5) continue;
      var score = dist + ang * 7;
      if (score < bestScore) { bestScore = score; best = a; }
    }
    return best;
  };

  /* ---------------------------------------------------------------- */
  /* items                                                             */
  /* ---------------------------------------------------------------- */
  Player.prototype.useSlot = function (idx) {
    var g = this.game;
    var id = this.inv.slots[idx];
    if (!id) { g.audio.sfx('error'); return; }
    var d = Items.ITEMS[id];
    if (!d) return;
    if (d.type === 'mask') {
      if (this.inv.wornMask === id) { this.inv.wornMask = null; g.audio.sfx('menu_back'); }
      else { this.inv.wornMask = id; g.audio.sfx('menu_ok'); g.effects.puff(this.pos[0], this.pos[1] + 1.2, this.pos[2]); }
      g.hud.toast(this.inv.wornMask ? d.name + ' on' : 'Mask off');
      return;
    }
    if (d.ammo) {
      var have = this.inv[d.ammo] || 0;
      if (have <= 0) { g.audio.sfx('error'); g.hud.toast('Out of ' + d.ammo + '.'); return; }
    }
    if (d.magic && this.inv.magic < d.magic) { g.audio.sfx('error'); g.hud.toast('Not enough magic.'); return; }

    switch (id) {
      case 'bombs': this._placeBomb(); break;
      case 'bow': case 'hookshot': case 'iceRod': case 'boomerang':
        this.aiming = true; this.aimTool = id;
        g.cam.mode = 'firstPerson';
        g.cam.yaw = this.yaw; g.cam.pitch = 0;
        this.setState('aim');
        this.play('aim', { blend: 0.12 });
        break;
      case 'lantern': this._toggleLantern(); break;
      case 'lens': this._toggleLens(); break;
      case 'flute': this.startSong(); break;
      case 'hammer': this._hammerSmash(); break;
      default: g.audio.sfx('error');
    }
  };

  Player.prototype._placeBomb = function () {
    var g = this.game;
    if (this.inv.bombs <= 0) { g.audio.sfx('error'); return; }
    this.inv.bombs--;
    var fx = this.pos[0] + Math.sin(this.yaw) * 0.75;
    var fz = this.pos[2] + Math.cos(this.yaw) * 0.75;
    g.spawnBomb(fx, this.pos[1] + 0.25, fz, this);
    this.play('throw', { restart: true, blend: 0.06 });
    g.audio.sfx('click');
  };

  Player.prototype._toggleLantern = function () {
    this.lanternOn = !this.lanternOn;
    this.game.audio.sfx(this.lanternOn ? 'fire' : 'click');
    this.game.hud.toast(this.lanternOn ? 'Lantern lit' : 'Lantern out');
  };
  Player.prototype._toggleLens = function () {
    if (!this.lensOn && this.inv.magic < 1) { this.game.audio.sfx('error'); return; }
    this.lensOn = !this.lensOn;
    this.game.audio.sfx(this.lensOn ? 'magic' : 'click');
  };
  Player.prototype._hammerSmash = function () {
    var g = this.game;
    this.setState('attack');
    this.chargeRelease = false;
    this.play('attack3', { restart: true, blend: 0.05, speed: 0.8 });
    this.attackTimer = this.anim.clip.duration / 0.8;
    this.hammerSmash = true;
  };

  Player.prototype._releaseItem = function () {
    var g = this.game;
    var dir = V3.create(Math.sin(this.yaw) * Math.cos(g.cam.pitch),
      Math.sin(g.cam.pitch), Math.cos(this.yaw) * Math.cos(g.cam.pitch));
    if (g.cam.mode === 'firstPerson') {
      dir[0] = Math.sin(g.cam.yaw) * Math.cos(g.cam.pitch);
      dir[1] = Math.sin(g.cam.pitch);
      dir[2] = Math.cos(g.cam.yaw) * Math.cos(g.cam.pitch);
    }
    V3.normalize(dir, dir);
    var ox = this.pos[0], oy = this.pos[1] + 1.05, oz = this.pos[2];
    if (this.aimTool === 'bow') {
      this.inv.arrows--;
      g.spawnArrow(ox, oy, oz, dir, this);
      g.audio.sfx('bow');
    } else if (this.aimTool === 'hookshot') {
      g.fireHookshot(this, ox, oy, oz, dir);
      g.audio.sfx('hookshot');
    } else if (this.aimTool === 'iceRod') {
      if (this.inv.useMagic(4)) { g.fireIce(ox, oy, oz, dir, this); g.audio.sfx('ice'); }
    } else if (this.aimTool === 'boomerang') {
      g.fireBoomerang(this, ox, oy, oz, dir);
      g.audio.sfx('swing');
    }
  };
  Player.prototype._castRelease = function () { };

  /* ---------------------------------------------------------------- */
  /* flute / songs                                                     */
  /* ---------------------------------------------------------------- */
  Player.prototype.startSong = function () {
    this.songMode = true;
    this.songBuffer = [];
    this.songTimer = 0;
    this.setState('song');
    this.play('cast', { restart: true, blend: 0.12, speed: 0.5 });
    this.game.audio.sfx('menu_ok');
  };
  Player.prototype.songNote = function (note) {
    var g = this.game;
    this.songBuffer.push(note);
    if (this.songBuffer.length > 8) this.songBuffer.shift();
    this.songTimer = 0;
    var freqs = { cLeft: 392, cDown: 466, cRight: 523, cUp: 659 };
    g.audio.voice({ type: 'sine', freq: freqs[note] || 440, dur: 0.42, gain: 0.22,
      attack: 0.02, decay: 0.1, sustain: 0.7, release: 0.25, vib: 4, verb: 0.5, bus: g.audio.sfxBus });
    g.effects.note(this.pos[0], this.pos[1] + 1.3, this.pos[2]);
    /* match against known songs */
    for (var k in Items.SONGS) {
      var s = Items.SONGS[k];
      if (!this.inv.hasSong(k)) continue;
      if (this.songBuffer.length < s.notes.length) continue;
      var tail = this.songBuffer.slice(this.songBuffer.length - s.notes.length);
      var ok = true;
      for (var i = 0; i < s.notes.length; i++) if (tail[i] !== s.notes[i]) { ok = false; break; }
      if (ok) { this.endSong(); g.playSong(s); return; }
    }
  };
  Player.prototype.endSong = function () {
    this.songMode = false;
    this.songBuffer = [];
    if (this.state === 'song') this.setState('ground');
  };

  /* ---------------------------------------------------------------- */
  /* update                                                            */
  /* ---------------------------------------------------------------- */
  Player.prototype.update = function (dt, g) {
    var input = g.input;
    this.updateCommon(dt, g.world);
    this.stateTime += dt;
    if (this.invulnTime > 0) this.invulnTime -= dt;
    if (this.noControl > 0) this.noControl -= dt;
    if (this.comboWindow > 0) this.comboWindow -= dt;
    if (this.breakFlash > 0) this.breakFlash -= dt;
    if (this.equipFlash > 0) this.equipFlash -= dt;
    if (this.frozenCtl > 0) this.frozenCtl -= dt;

    /* magic drain for held tools */
    if (this.lensOn) {
      this.magicDrain += dt;
      if (this.magicDrain > 0.5) {
        this.magicDrain = 0;
        if (!this.inv.useMagic(1)) this.lensOn = false;
      }
    }

    if (this.state === 'dead') { this._updateDead(dt, g); return; }

    var mask = this.inv.wornMask;
    var speedMul = (mask === 'hareMask') ? 1.42 : 1;

    /* ---- lock-on ---- */
    if (this.canAct()) {
      if (input.pressed('z')) {
        var t = this.findLockTarget();
        if (t) {
          this.lockTarget = t;
          g.cam.mode = 'lock'; g.cam.lockTarget = t;
          g.audio.sfx('target');
        } else {
          /* no target: recentre the camera behind the player */
          g.cam.mode = 'follow';
          g.cam.yaw = this.yaw + Math.PI;
          g.audio.sfx('untarget');
        }
      }
      if (this.lockTarget) {
        var lost = !this.lockTarget.alive || this.lockTarget.dead ||
          V3.distXZ(this.pos, this.lockTarget.pos) > (this.lockTarget.lockRange || 15) + 4;
        if (lost || (!input.down('z') && !g.opt.holdTarget)) {
          if (lost || input.released('z')) {
            this.lockTarget = null;
            if (g.cam.mode === 'lock') g.cam.mode = 'follow';
            g.audio.sfx('untarget');
          }
        }
      }
    }

    /* ---- first-person aim ---- */
    if (this.state === 'aim') { this._updateAim(dt, g); return; }
    if (this.state === 'song') { this._updateSong(dt, g); return; }
    if (this.state === 'hookTravel') { this._updateHookTravel(dt, g); return; }
    if (this.state === 'climb') { this._updateClimb(dt, g); return; }

    /* ---- movement input ---- */
    var wantX = 0, wantZ = 0, mag = 0;
    if (this.canAct() && this.noControl <= 0) {
      mag = input.stickMag();
      if (mag > 0.08) {
        var dir = V3.create(0, 0, 0);
        g.cam.stickToWorld(input.stick[0], input.stick[1], dir);
        var l = Math.sqrt(dir[0] * dir[0] + dir[2] * dir[2]) || 1;
        wantX = dir[0] / l; wantZ = dir[2] / l;
      }
    }

    /* ---- swimming ---- */
    if (this.inWater && this.waterY !== null && this.pos[1] < this.waterY - 0.55) {
      this._updateSwim(dt, g, wantX, wantZ, mag);
      return;
    }

    /* ---- guard ---- */
    var wantGuard = this.canAct() && input.down('r') && this.inv.shield() && this.grounded &&
      this.state !== 'attack' && this.state !== 'roll';
    if (wantGuard !== this.guarding) {
      this.guarding = wantGuard;
      if (wantGuard) this.play('guard', { blend: 0.12 });
    }

    /* ---- actions ---- */
    if (this.canAct()) {
      if (input.pressed('b')) {
        if (this.carry) this._throwCarried();
        else this.tryAttack();
      }
      if (input.down('b') && (this.state === 'ground' || this.state === 'lock') && this.inv.weapon() && !this.carry) {
        this.chargeTime += dt;
        if (this.chargeTime > 0.55 && !this.spinReady) {
          this.spinReady = true;
          g.audio.sfx('magic');
        }
        if (this.chargeTime > 0.25) {
          if (this.animName() !== 'spinCharge') this.play('spinCharge', { blend: 0.14 });
        }
      } else if (this.chargeTime > 0) {
        if (this.spinReady && this.grounded) this._startSpin();
        this.chargeTime = 0;
        this.spinReady = false;
      }

      if (input.pressed('a')) this._pressA(g);
      if (input.pressed('cLeft')) this.songMode ? this.songNote('cLeft') : this.useSlot(0);
      if (input.pressed('cDown')) this.songMode ? this.songNote('cDown') : this.useSlot(1);
      if (input.pressed('cRight')) this.songMode ? this.songNote('cRight') : this.useSlot(2);
      if (input.pressed('cUp')) {
        g.cam.mode = (g.cam.mode === 'firstPerson') ? 'follow' : 'firstPerson';
        if (g.cam.mode === 'firstPerson') { g.cam.yaw = this.yaw; g.cam.pitch = 0; }
      }
      if (input.pressed('swap')) { this.inv.cycleWeapon(1); this.equipFlash = 1.0; g.audio.sfx('menu_move'); }
    }

    /* ---- state motion ---- */
    var targetSpeed = 0;
    var accel = this.grounded ? ACCEL : AIR_ACCEL;

    if (this.state === 'attack') {
      this.attackTimer -= dt;
      this._applyAttack(dt);
      if (this.lunge > 0) {
        this.moveXZ(Math.sin(this.yaw) * this.lunge * dt, Math.cos(this.yaw) * this.lunge * dt, g.world);
        this.lunge = Math.max(0, this.lunge - dt * 14);
      }
      if (this.hammerSmash && this.attackTimer < this.anim.clip.duration * 0.45) {
        this.hammerSmash = false;
        g.hammerShock(this.pos[0], this.pos[1], this.pos[2], this);
      }
      if (this.attackTimer <= this.anim.clip.duration * 0.45) this.comboWindow = 0.30;
      if (this.attackTimer <= 0) {
        this.hitActive = false;
        this.setState(this.lockTarget ? 'lock' : 'ground');
      }
    } else if (this.state === 'roll') {
      targetSpeed = ROLL_SPEED * speedMul;
      var rs = Math.max(0, 1 - this.stateTime / 0.45);
      this.moveXZ(Math.sin(this.yaw) * targetSpeed * rs * dt, Math.cos(this.yaw) * targetSpeed * rs * dt, g.world);
      if (this.stateTime > 0.55) this.setState(this.lockTarget ? 'lock' : 'ground');
    } else if (this.state === 'hurt') {
      if (this.stateTime > 0.4) this.setState('ground');
    } else if (this.state === 'sidehop') {
      var hs = Math.max(0, 1 - this.stateTime / 0.32);
      this.moveXZ(this.hopDir[0] * 6.2 * hs * dt, this.hopDir[1] * 6.2 * hs * dt, g.world);
      if (this.stateTime > 0.38) this.setState(this.lockTarget ? 'lock' : 'ground');
    } else {
      /* normal locomotion */
      var maxSpeed = (this.guarding ? WALK_SPEED * 0.72 : (mag > 0.62 ? RUN_SPEED : WALK_SPEED * (0.4 + mag))) * speedMul;
      if (this.carry) maxSpeed *= 0.78;
      var desiredX = wantX * maxSpeed, desiredZ = wantZ * maxSpeed;
      this.vel[0] = M.approach(this.vel[0], desiredX, accel * dt);
      this.vel[2] = M.approach(this.vel[2], desiredZ, accel * dt);
      this.moveXZ(this.vel[0] * dt, this.vel[2] * dt, g.world);
      this.speed = Math.sqrt(this.vel[0] * this.vel[0] + this.vel[2] * this.vel[2]);

      if (mag > 0.08) {
        if (this.lockTarget && this.grounded) {
          this.faceTowards(this.lockTarget.pos[0], this.lockTarget.pos[2]);
        } else {
          this.targetYaw = Math.atan2(wantX, wantZ);
        }
      } else if (this.lockTarget) {
        this.faceTowards(this.lockTarget.pos[0], this.lockTarget.pos[2]);
      }
    }

    this.turnToward(dt);
    this.applyGravity(dt, g.world);

    /* auto-hop off ledges while moving, the way OoT handled small drops */
    if (this.grounded && this.speed > 3.4 && this.state === 'ground') {
      var ahead = 0.55;
      var fx = this.pos[0] + this.vel[0] / (this.speed || 1) * ahead;
      var fz = this.pos[2] + this.vel[2] / (this.speed || 1) * ahead;
      var fh = g.world.col.floorAt(fx, fz, this.pos[1] + 0.1, this.radius, {}).y;
      if (this.pos[1] - fh > 0.55 && this.pos[1] - fh < 6) {
        this.vel[1] = 3.1;
        this.grounded = false;
        this.setState('ground');
        this.play('jump', { restart: true, blend: 0.06 });
        g.audio.sfx('jump');
      }
    }

    if (this.justLanded) {
      this.justLanded = false;
      if (this.landedWith < -9) {
        this.play('land', { restart: true, blend: 0.05 });
        if (this.landedWith < -19) {
          this.damage(1, null, { knockback: 0 });
          g.hud.toast('Ouch.');
        }
      }
      this.airTime = 0;
    }
    if (!this.grounded) this.airTime += dt;

    this._chooseAnim(dt, g);
    this._updateInteract(g);
    this._trackSafeGround(dt, g);
  };

  Player.prototype._pressA = function (g) {
    /* context first: talk, read, open, lift, climb */
    if (this.songMode) { this.endSong(); return; }
    if (this.interact) {
      var it = this.interact;
      if (it.act) { it.act(g, this); return; }
    }
    if (this.carry) { this._throwCarried(); return; }
    if (this.state !== 'ground' && this.state !== 'lock') return;
    if (!this.grounded) return;

    var mag = g.input.stickMag();
    if (this.lockTarget && mag > 0.35) {
      /* directional dodge while locked on */
      var dir = V3.create(0, 0, 0);
      g.cam.stickToWorld(g.input.stick[0], g.input.stick[1], dir);
      var l = Math.sqrt(dir[0] * dir[0] + dir[2] * dir[2]) || 1;
      var fwd = Math.sin(this.yaw) * dir[0] / l + Math.cos(this.yaw) * dir[2] / l;
      if (fwd > 0.5) { this._roll(); return; }
      this.hopDir = [dir[0] / l, dir[2] / l];
      this.setState('sidehop');
      this.play(fwd < -0.5 ? 'backstep' : 'strafe', { restart: true, blend: 0.05, speed: 2.2 });
      this.vel[1] = 3.0;
      g.audio.sfx('jump');
      return;
    }
    if (mag > 0.35) { this._roll(); return; }
    g.audio.sfx('error', { minGap: 0.3 });
  };

  Player.prototype._roll = function () {
    this.setState('roll');
    this.play('roll', { restart: true, blend: 0.05 });
    this.vel[0] = Math.sin(this.yaw) * ROLL_SPEED;
    this.vel[2] = Math.cos(this.yaw) * ROLL_SPEED;
  };

  Player.prototype._throwCarried = function () {
    var g = this.game;
    var c = this.carry;
    this.carry = null;
    if (!c) return;
    c.thrown = true;
    c.hidden = false;
    c.pos[0] = this.pos[0] + Math.sin(this.yaw) * 0.6;
    c.pos[1] = this.pos[1] + 1.0;
    c.pos[2] = this.pos[2] + Math.cos(this.yaw) * 0.6;
    c.vel[0] = Math.sin(this.yaw) * 9;
    c.vel[2] = Math.cos(this.yaw) * 9;
    c.vel[1] = 2.4;
    this.play('throw', { restart: true, blend: 0.05 });
    g.audio.sfx('swing');
  };

  Player.prototype._chooseAnim = function (dt, g) {
    if (this.state === 'attack' || this.state === 'roll' || this.state === 'hurt' ||
        this.state === 'sidehop' || this.state === 'song') return;
    if (this.chargeTime > 0.25) return;
    if (!this.grounded && this.airTime > 0.16) { this.play('fall', { blend: 0.14 }); return; }
    if (this.guarding) {
      if (this.animName() !== 'guard' && this.animName() !== 'guardHit') this.play('guard', { blend: 0.1 });
      return;
    }
    var sp = this.speed;
    if (sp < 0.35) {
      this.play(this.lockTarget ? 'idleAlert' : 'idle', { blend: 0.16 });
    } else if (this.lockTarget) {
      var fwd = Math.sin(this.yaw) * this.vel[0] + Math.cos(this.yaw) * this.vel[2];
      var side = Math.cos(this.yaw) * this.vel[0] - Math.sin(this.yaw) * this.vel[2];
      if (fwd < -0.8) this.play('backstep', { blend: 0.12, speed: M.clamp(sp / 2.4, 0.6, 1.8) });
      else if (Math.abs(side) > Math.abs(fwd)) this.play('strafe', { blend: 0.12, speed: M.clamp(sp / 2.4, 0.6, 1.8) });
      else this.play(sp > 3.4 ? 'run' : 'walk', { blend: 0.12, speed: M.clamp(sp / (sp > 3.4 ? 5.0 : 2.3), 0.62, 1.7) });
    } else if (sp > 3.4) {
      this.play('run', { blend: 0.12, speed: M.clamp(sp / 5.0, 0.7, 1.5) });
    } else {
      this.play('walk', { blend: 0.14, speed: M.clamp(sp / 2.3, 0.55, 1.6) });
    }
  };

  /* ---- interaction scan ---- */
  Player.prototype._updateInteract = function (g) {
    var best = null, bestD = 1e9;
    for (var i = 0; i < g.world.actors.length; i++) {
      var a = g.world.actors[i];
      if (!a.interactable || a.hidden || a.dead) continue;
      var d = V3.distXZ(this.pos, a.pos);
      var range = a.interactRange || 1.5;
      if (d > range) continue;
      if (Math.abs(a.pos[1] - this.pos[1]) > 2.2) continue;
      if (a.needsFacing !== false) {
        var ang = Math.abs(M.angleDelta(this.yaw, Math.atan2(a.pos[0] - this.pos[0], a.pos[2] - this.pos[2])));
        if (ang > 1.35) continue;
      }
      if (d < bestD) { bestD = d; best = a; }
    }
    this.interact = best;
  };

  Player.prototype._trackSafeGround = function (dt, g) {
    this.safeTimer += dt;
    if (this.safeTimer > 0.5 && this.grounded && !this.inWater && this.speed < 4.6) {
      this.safeTimer = 0;
      var slope = g.world.field ? g.world.field.slope(this.pos[0], this.pos[2]) : 0;
      if (slope < 0.6) V3.copy(this.lastSafe, this.pos);
    }
  };

  /* ---- sub-states ---- */
  Player.prototype._updateSwim = function (dt, g, wantX, wantZ, mag) {
    var surf = this.waterY - 0.42;
    this.pos[1] = M.damp(this.pos[1], surf, 8, dt);
    this.vel[1] = 0;
    this.grounded = false;
    var sp = SWIM_SPEED * (mag > 0.6 ? 1.25 : 1);
    this.vel[0] = M.approach(this.vel[0], wantX * sp, 12 * dt);
    this.vel[2] = M.approach(this.vel[2], wantZ * sp, 12 * dt);
    this.moveXZ(this.vel[0] * dt, this.vel[2] * dt, g.world);
    this.speed = Math.sqrt(this.vel[0] * this.vel[0] + this.vel[2] * this.vel[2]);
    if (mag > 0.08) this.targetYaw = Math.atan2(wantX, wantZ);
    this.turnToward(dt);
    this.play(this.speed > 0.5 ? 'swim' : 'tread', { blend: 0.2 });
    this.setState('swim');
    this.swimTimer += dt;
    if (this.swimTimer > 0.5) {
      this.swimTimer = 0;
      if (this.speed > 0.6) g.particles.emit('splash', this.pos[0], this.waterY, this.pos[2], 3);
    }
    /* climbing out */
    var fh = g.world.col.floorAt(this.pos[0] + Math.sin(this.yaw) * 0.7, this.pos[2] + Math.cos(this.yaw) * 0.7,
      this.waterY + 1.5, this.radius, {}).y;
    if (fh > this.waterY - 0.6 && fh < this.waterY + 1.2 && mag > 0.5) {
      this.pos[1] = fh + 0.05;
      this.pos[0] += Math.sin(this.yaw) * 0.55;
      this.pos[2] += Math.cos(this.yaw) * 0.55;
      this.setState('ground');
      g.audio.sfx('splash');
    }
    this._updateInteract(g);
  };

  Player.prototype._updateAim = function (dt, g) {
    var input = g.input;
    this.aiming = true;
    this.yaw = g.cam.yaw;
    this.turnToward(dt, g.cam.yaw);
    this.applyGravity(dt, g.world);
    var slow = 1.4;
    var dir = V3.create(0, 0, 0);
    g.cam.stickToWorld(input.stick[0], input.stick[1], dir);
    var l = Math.sqrt(dir[0] * dir[0] + dir[2] * dir[2]);
    if (l > 0.01) this.moveXZ(dir[0] / l * slow * dt, dir[2] / l * slow * dt, g.world);
    if (this.animName() !== 'aim' && this.animName() !== 'shoot') this.play('aim', { blend: 0.14 });

    if (input.pressed('b') || input.pressed('a')) {
      this.play('shoot', { restart: true, blend: 0.04 });
      this._releaseItem();
      this.aimReleaseTimer = 0.22;
    }
    if (this.aimReleaseTimer > 0) {
      this.aimReleaseTimer -= dt;
      if (this.aimReleaseTimer <= 0 && this.aimTool !== 'bow') this._exitAim(g);
    }
    var slotStill = this.inv.slots.indexOf(this.aimTool) >= 0;
    if (input.pressed('cUp') || input.pressed('z') || !slotStill ||
        (this.aimTool === 'bow' && this.inv.arrows <= 0 && this.aimReleaseTimer <= 0)) {
      this._exitAim(g);
    }
  };
  Player.prototype._exitAim = function (g) {
    this.aiming = false; this.aimTool = null;
    g.cam.mode = this.lockTarget ? 'lock' : 'follow';
    g.cam.yaw = this.yaw + Math.PI;
    this.setState('ground');
  };

  Player.prototype._updateSong = function (dt, g) {
    this.songTimer += dt;
    this.applyGravity(dt, g.world);
    if (g.input.pressed('cLeft')) this.songNote('cLeft');
    if (g.input.pressed('cDown')) this.songNote('cDown');
    if (g.input.pressed('cRight')) this.songNote('cRight');
    if (g.input.pressed('cUp')) this.songNote('cUp');
    if (g.input.pressed('b') || g.input.pressed('a') || this.songTimer > 6) this.endSong();
    if (this.animName() !== 'cast') this.play('cast', { blend: 0.14, speed: 0.4 });
  };

  Player.prototype._updateHookTravel = function (dt, g) {
    var h = this.hookshot;
    if (!h || !h.anchor) { this.setState('ground'); return; }
    var dx = h.anchor[0] - this.pos[0], dy = h.anchor[1] - 0.9 - this.pos[1], dz = h.anchor[2] - this.pos[2];
    var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    var sp = 17;
    if (d < 0.55 || this.stateTime > 2.5) {
      this.hookshot = null;
      this.setState('ground');
      this.vel[1] = 1.2;
      this.play('land', { restart: true, blend: 0.06 });
      return;
    }
    this.pos[0] += dx / d * sp * dt;
    this.pos[1] += dy / d * sp * dt;
    this.pos[2] += dz / d * sp * dt;
    this.vel[1] = 0;
    this.grounded = false;
    if (this.animName() !== 'fall') this.play('fall', { blend: 0.1 });
    g.audio.sfx('chain', { minGap: 0.09 });
  };

  Player.prototype._updateClimb = function (dt, g) {
    var c = this.climbing;
    if (!c) { this.setState('ground'); return; }
    var input = g.input;
    var up = input.stick[1];
    this.yaw = c.yaw;
    this.pos[0] = c.x; this.pos[2] = c.z;
    this.vel[1] = 0;
    this.grounded = false;
    if (Math.abs(up) > 0.15) {
      this.pos[1] += up * 2.0 * dt;
      if (this.animName() !== 'climb') this.play('climb', { blend: 0.12 });
      this.anim.speed = Math.abs(up) * 1.4;
    } else {
      this.anim.speed = 0;
    }
    if (this.pos[1] >= c.top - 0.10) {
      this.pos[1] = c.top + 0.05;
      this.pos[0] += Math.sin(c.yaw) * 0.55;
      this.pos[2] += Math.cos(c.yaw) * 0.55;
      this.climbing = null;
      this.setState('ground');
      this.anim.speed = 1;
      g.audio.sfx('land');
      return;
    }
    if (this.pos[1] <= c.bottom + 0.02 || input.pressed('a')) {
      this.climbing = null;
      this.setState('ground');
      this.anim.speed = 1;
      this.pos[1] = Math.max(this.pos[1], c.bottom);
    }
  };

  Player.prototype._updateDead = function (dt, g) {
    this.deathTimer += dt;
    this.applyGravity(dt, g.world);
    if (this.deathTimer > 1.6 && !g.gameOverShown) {
      g.showGameOver();
    }
  };

  Player.prototype.startClimb = function (c) {
    this.climbing = c;
    this.setState('climb');
    this.play('climb', { restart: true, blend: 0.12 });
    this.pos[1] = Math.max(this.pos[1], c.bottom);
  };

  /* ---------------------------------------------------------------- */
  /* drawing: body, then held gear                                     */
  /* ---------------------------------------------------------------- */
  var _wm = M4.create();
  Player.prototype.drawExtra = function (g) {
    var a = g.assets, r = g.r;
    var flicker = this.invulnTime > 0 && Math.floor(this.invulnTime * 18) % 2 === 0;
    if (flicker) return;

    /* The blade is only in the hand when it is being used; the rest of the
       time it rides on the back, which is both how the games do it and the
       only way the silhouette stays clean. */
    var wd = this.inv.weaponDef();
    if (wd && !this.carry && this.state !== 'aim') {
      var drawn = (this.state === 'attack' || this.lockTarget || this.chargeTime > 0.25 ||
                   this.state === 'roll' || this.guarding);
      var bm = this.anim.boneMatrix(drawn ? 'itemR' : 'backAttach');
      if (bm) {
        var mesh = g.weaponMesh(wd.id);
        var mat = a.frameMat(wd.mat || 'metal', null);
        mat.prim = [1, 1, 1, 1];
        if (wd.glow) mat.tint = [wd.glow[0], wd.glow[1], wd.glow[2], 0.30];
        if (drawn) {
          r.submit(mesh, bm, mat);
        } else {
          var sheath = M4.create();
          M4.compose(sheath, -0.10, 0.30, -0.04, 0.10, 0, -0.42, 1, 1, 1);
          M4.multiply(_wm, bm, sheath);
          r.submit(mesh, _wm, mat);
        }
      }
    }
    /* shield in the left */
    var sd = this.inv.shieldDef();
    if (sd && this.state !== 'aim') {
      var bl = this.anim.boneMatrix(this.guarding ? 'itemL' : 'backAttach');
      if (bl) {
        if (this.guarding) {
          M4.copy(_wm, bl);
        } else {
          /* slung flat across the back, face outward */
          var back = M4.create();
          M4.compose(back, 0.05, 0.22, -0.04, 0, Math.PI, 0.22, 1, 1, 1);
          M4.multiply(_wm, bl, back);
        }
        r.submit(g.shieldMesh(sd.id), _wm, a.mat[sd.mat] || a.mat.metal);
      }
    }
    /* bow / hookshot while aiming */
    if (this.state === 'aim' && this.aimTool) {
      var bh = this.anim.boneMatrix('itemL');
      if (bh) r.submit(g.toolMesh(this.aimTool), bh, a.mat[this.aimTool === 'iceRod' ? 'gemBlue' : 'planksDark']);
    }
    /* carried object rides above the head */
    if (this.carry) {
      var bc = this.anim.boneMatrix('head');
      if (bc && this.carry.drawCarried) this.carry.drawCarried(g, this);
    }
    /* lantern glow */
    if (this.lanternOn) {
      g.effects.pointLight(this.pos[0], this.pos[1] + 1.0, this.pos[2], [1, 0.82, 0.45], 1.6);
    }
  };

  /* flicker the whole body during invulnerability */
  var _baseDraw = LZ.Actor.prototype.draw;
  Player.prototype.draw = function (g) {
    if (this.invulnTime > 0 && Math.floor(this.invulnTime * 18) % 2 === 0) {
      /* skip the body but keep the shadow, like the era's blink */
      return;
    }
    /* Fade out when the camera is pressed right up against him. It gets
       shoved in by walls in tight spots, and a solid green wall of tunic
       filling the screen is worse than briefly not seeing yourself. */
    var cam = g.cam;
    if (cam && cam.mode !== 'firstPerson') {
      var dx = cam.pos[0] - this.pos[0], dz = cam.pos[2] - this.pos[2];
      var dy = cam.pos[1] - (this.pos[1] + this.height * 0.6);
      var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      var a = M.saturate((d - 1.05) / 1.15);
      if (a <= 0.02) return;
      var prev = this.alpha;
      this.alpha = prev * a;
      _baseDraw.call(this, g);
      this.alpha = prev;
      return;
    }
    _baseDraw.call(this, g);
  };

  LZ.Player = Player;
})(LZ);
