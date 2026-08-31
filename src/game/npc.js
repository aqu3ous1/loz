/* =============================================================
   game/npc.js -- everything the player can walk up to and press A on:
   villagers, chests, signs, pots, switches, doors, pickups, ladders.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var M = LZ.M, V3 = LZ.V3, M4 = LZ.M4, GL = LZ.GL, C = LZ.Collision, Items = LZ.Items;

  /* ---------------------------------------------------------------- */
  /* NPC                                                               */
  /* ---------------------------------------------------------------- */
  var PALETTES = [
    { cloth: 0x8c5a3c, dark: 0x5e3a26, skin: 0xe8c49c, hair: 0x4a3320, tex: 'clothBrown' },
    { cloth: 0x3f6e9a, dark: 0x274a68, skin: 0xd9ab84, hair: 0x2e2a26, tex: 'clothBlue' },
    { cloth: 0xa8483c, dark: 0x74302a, skin: 0xf0cfae, hair: 0x7a4a1e, tex: 'clothRed' },
    { cloth: 0xd8cdb0, dark: 0xa89c80, skin: 0xc99a70, hair: 0x1e1a18, tex: 'clothWhite' },
    { cloth: 0x5f7a44, dark: 0x3e5230, skin: 0xe0b48c, hair: 0x62462a, tex: 'clothGreen' },
    { cloth: 0x6b5a8c, dark: 0x473a5e, skin: 0xefd0b4, hair: 0xb0a898, tex: 'clothPurple' },
    { cloth: 0xbfa374, dark: 0x8a7550, skin: 0xc08a5c, hair: 0x2a2018, tex: 'clothTan' }
  ];

  function villagerRig(o) {
    o = o || {};
    var p = PALETTES[(o.palette === undefined ? 0 : o.palette) % PALETTES.length];
    return LZ.Models.humanoid({
      build: o.build || 'adult',
      scale: o.scale || 1,
      skin: o.skin === undefined ? p.skin : o.skin,
      cloth: o.cloth === undefined ? p.cloth : o.cloth,
      clothDark: o.clothDark === undefined ? p.dark : o.clothDark,
      trim: o.trim === undefined ? 0xc0b088 : o.trim,
      pants: o.pants === undefined ? p.dark : o.pants,
      boots: o.boots === undefined ? 0x5a4028 : o.boots,
      hair: o.hair === undefined ? p.hair : o.hair,
      hairStyle: o.hairStyle || 'short',
      hat: o.hat || 'none',
      hatColor: o.hatColor,
      clothTex: o.clothTex || p.tex,
      skinTex: o.skinTex || 'skin',
      hairTex: o.hairTex || 'hairBrown',
      beard: o.beard, beardColor: o.beardColor,
      cape: o.cape, capeColor: o.capeColor,
      sash: o.sash, sashColor: o.sashColor,
      eyeColor: o.eyeColor
    });
  }

  function NPC(game, o) {
    o = o || {};
    LZ.Actor.call(this, {
      kind: 'npc', x: o.x, y: o.y, z: o.z, yaw: o.yaw || 0,
      radius: 0.34, team: 'neutral', hp: 1
    });
    this.game = game;
    this.name = o.name || 'Villager';
    this.lines = o.lines || ['...'];
    this.talkFn = o.talk || null;
    this.interactable = o.interactable !== false;
    this.interactRange = o.range || 1.9;
    this.actionLabel = o.label || 'Speak';
    this.wander = o.wander || 0;
    this.wanderTimer = Math.random() * 3;
    this.lookAt = o.lookAt !== false;
    this.idleClip = o.idle || 'idle';
    this.portrait = o.portrait || { skin: (o.pal && PALETTES[o.pal].skin) || 0xe8c49c, cloth: o.cloth || 0x8c5a3c, hair: o.hair || 0x4a3320, hat: o.hat };
    this.solid = true;
    this.talking = false;
    var key = 'npc_' + (o.model || JSON.stringify({
      b: o.build, s: o.scale, p: o.palette, h: o.hairStyle, ht: o.hat, be: o.beard,
      c: o.cloth, sk: o.skin, hr: o.hair, cp: o.cape, sa: o.sash
    }));
    this.setModel(LZ.charModel(game.r, key, function () { return villagerRig(o); },
      LZ.Models.getHumanoidClips()));
    this.modelScale = 1;
    this.play(this.idleClip);
    if (o.collide !== false) {
      this.collider = game.world.col.add(C.cyl(this.pos[0], this.pos[1], this.pos[2], 0.32, 1.3, { ref: this }));
    }
  }
  NPC.prototype = Object.create(LZ.Actor.prototype);
  NPC.prototype.constructor = NPC;

  NPC.prototype.act = function (g) {
    var self = this;
    this.talking = true;
    this.play('talk', { blend: 0.16 });
    if (this.talkFn) { this.talkFn(g, this); return; }
    var text = this.lines[Math.min(this.lineIndex || 0, this.lines.length - 1)];
    if (this.lines.length > 1) this.lineIndex = Math.min((this.lineIndex || 0) + 1, this.lines.length - 1);
    g.dialogue.say(text, {
      speaker: this.name, portrait: this.portrait,
      onDone: function () { self.talking = false; self.play(self.idleClip, { blend: 0.2 }); }
    });
  };

  NPC.prototype.update = function (dt, g) {
    this.updateCommon(dt, g.world);
    if (this.talking) {
      this.faceTowards(g.player.pos[0], g.player.pos[2]);
      this.turnToward(dt);
      this.applyGravity(dt, g.world);
      return;
    }
    if (this.wander > 0) {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 2.5 + Math.random() * 3.5;
        var a = Math.random() * M.TAU;
        this.walkTo = [this.homeX + Math.cos(a) * this.wander, this.homeZ + Math.sin(a) * this.wander];
        this.walkTime = 1.4 + Math.random() * 1.6;
      }
      if (this.walkTime > 0) {
        this.walkTime -= dt;
        var dx = this.walkTo[0] - this.pos[0], dz = this.walkTo[1] - this.pos[2];
        var d = Math.sqrt(dx * dx + dz * dz);
        if (d > 0.25) {
          this.targetYaw = Math.atan2(dx, dz);
          this.moveXZ(dx / d * 1.1 * dt, dz / d * 1.1 * dt, g.world);
          this.play('walk', { blend: 0.2, speed: 0.68 });
        } else { this.walkTime = 0; }
      } else {
        this.play(this.idleClip, { blend: 0.2 });
      }
    } else {
      if (this.lookAt && g.player && V3.distXZ(this.pos, g.player.pos) < 4.5) {
        this.faceTowards(g.player.pos[0], g.player.pos[2]);
      } else {
        this.targetYaw = this.yaw;
      }
      this.play(this.idleClip, { blend: 0.25 });
    }
    this.turnToward(dt);
    this.applyGravity(dt, g.world);
    if (this.collider) { this.collider.x = this.pos[0]; this.collider.z = this.pos[2]; }
  };

  /* ---------------------------------------------------------------- */
  /* Chest                                                             */
  /* ---------------------------------------------------------------- */
  function Chest(game, o) {
    LZ.Actor.call(this, { kind: 'chest', x: o.x, y: o.y, z: o.z, yaw: o.yaw || 0, radius: 0.5, height: 0.8 });
    this.game = game;
    this.item = o.item;
    this.count = o.count || 1;
    this.big = !!o.big;
    this.flagId = o.flag || null;
    this.interactable = true;
    this.interactRange = 1.5;
    this.actionLabel = 'Open';
    this.opened = this.flagId ? game.inv.flag(this.flagId) : false;
    this.lidAngle = this.opened ? 1 : 0;
    this.castShadow = false;
    this.onOpen = o.onOpen || null;
    this.locked = !!o.locked;
    var s = this.big ? 1.5 : 1;
    this.scale = s;
    game.world.col.add(C.box(o.x, o.y + 0.35 * s, o.z, 0.42 * s, 0.35 * s, 0.32 * s, { yaw: this.yaw, surface: 'wood' }));
    this.baseMesh = game.chestMesh(this.big, false);
    this.lidMesh = game.chestMesh(this.big, true);
  }
  Chest.prototype = Object.create(LZ.Actor.prototype);
  Chest.prototype.constructor = Chest;

  Chest.prototype.act = function (g, player) {
    if (this.opened) { g.dialogue.say('Empty. You already took what was inside.'); return; }
    if (this.locked && !g.inv.useKey(g.currentDungeon)) {
      g.audio.sfx('error');
      g.dialogue.say('It is locked. A small key would open it.');
      return;
    }
    this.opened = true;
    if (this.flagId) g.inv.setFlag(this.flagId);
    g.audio.sfx('chest');
    var self = this;
    player.setState('ground');
    player.play('itemGet', { restart: true, blend: 0.1 });
    player.noControl = 2.4;
    g.giveItem(this.item, this.count, { fanfare: this.big, fromChest: true });
    if (this.onOpen) this.onOpen(g);
  };

  Chest.prototype.update = function (dt) {
    this.lidAngle = M.approach(this.lidAngle, this.opened ? 1 : 0, dt * 2.4);
  };

  var _cm = M4.create(), _lm = M4.create(), _lo = M4.create();
  Chest.prototype.draw = function (g) {
    var s = this.scale;
    M4.compose(_cm, this.pos[0], this.pos[1], this.pos[2], 0, this.yaw, 0, s, s, s);
    g.r.submit(this.baseMesh, _cm, g.assets.mat.chestwood);
    /* lid hinges at the back edge */
    M4.compose(_lo, 0, 0.44, -0.30, -this.lidAngle * 1.9, 0, 0, 1, 1, 1);
    M4.multiply(_lm, _cm, _lo);
    g.r.submit(this.lidMesh, _lm, g.assets.mat.chestwood);
    if (!this.opened) {
      g.effects.chestGlow(this.pos[0], this.pos[1] + 0.4 * s, this.pos[2], this.big);
    }
  };
  Chest.prototype.drawShadow = function (g) {
    LZ.Actor.prototype.drawShadow.call(this, g);
  };

  /* ---------------------------------------------------------------- */
  /* Sign                                                              */
  /* ---------------------------------------------------------------- */
  function Sign(game, o) {
    LZ.Actor.call(this, { kind: 'sign', x: o.x, y: o.y, z: o.z, yaw: o.yaw || 0, radius: 0.3, height: 1.3 });
    this.text = o.text;
    this.interactable = true;
    this.interactRange = 1.6;
    this.actionLabel = 'Read';
    this.castShadow = false;
    this.hidden = true;   /* the post itself is baked into static geometry */
  }
  Sign.prototype = Object.create(LZ.Actor.prototype);
  Sign.prototype.constructor = Sign;
  Sign.prototype.act = function (g) {
    g.dialogue.say(this.text, { style: 'wood' });
  };
  Sign.prototype.update = function () { };
  Sign.prototype.draw = function () { };
  Sign.prototype.drawShadow = function () { };

  /* ---------------------------------------------------------------- */
  /* Pot / liftable                                                    */
  /* ---------------------------------------------------------------- */
  function Pot(game, o) {
    LZ.Actor.call(this, { kind: 'pot', x: o.x, y: o.y, z: o.z, radius: 0.28, height: 0.6, hp: 1 });
    this.game = game;
    this.breakable = true;
    this.interactable = true;
    this.interactRange = 1.1;
    this.actionLabel = 'Lift';
    this.drop = o.drop === undefined ? 'random' : o.drop;
    this.thrown = false;
    this.style = o.style || 'pot';
    this.team = 'prop';
    this.mesh = game.potMesh(this.style);
    this.matName = this.style === 'crate' ? 'planks' : (this.style === 'skull' ? 'bone' : 'plaster');
    this.collider = game.world.col.add(C.cyl(o.x, o.y, o.z, 0.28, 0.6, { ref: this }));
  }
  Pot.prototype = Object.create(LZ.Actor.prototype);
  Pot.prototype.constructor = Pot;

  Pot.prototype.act = function (g, player) {
    if (player.carry) return;
    player.carry = this;
    this.hidden = true;
    this.carried = true;
    if (this.collider) { g.world.col.remove(this.collider); this.collider = null; }
    g.audio.sfx('click');
  };
  Pot.prototype.drawCarried = function (g, player) {
    var bm = player.anim.boneMatrix('head');
    if (!bm) return;
    var m = M4.create();
    M4.compose(m, 0, 0.42, 0, 0, g.time * 0.4, 0, 1, 1, 1);
    var out = M4.create();
    M4.multiply(out, bm, m);
    g.r.submit(this.mesh, out, g.assets.mat[this.matName]);
  };
  Pot.prototype.smash = function (g) {
    if (this.dead) return;
    this.dead = true;
    this.removeMe = true;
    if (this.collider) g.world.col.remove(this.collider);
    g.audio.sfx('hit');
    g.effects.shatter(this.pos[0], this.pos[1] + 0.3, this.pos[2], this.style);
    if (this.drop) g.spawnDrop(this.pos[0], this.pos[1] + 0.4, this.pos[2], this.drop);
  };
  Pot.prototype.onHurt = function () { this.smash(this.game); return false; };
  Pot.prototype.update = function (dt, g) {
    if (this.carried) return;
    if (this.thrown) {
      this.pos[0] += this.vel[0] * dt;
      this.pos[2] += this.vel[2] * dt;
      this.vel[1] -= 24 * dt;
      this.pos[1] += this.vel[1] * dt;
      var gy = g.world.col.floorAt(this.pos[0], this.pos[2], this.pos[1] + 0.1, 0.25, {}).y;
      /* smashes on any hard contact, like every pot in the series */
      var blocked = g.world.col.query(this.pos[0], this.pos[2], 0.35, []).some(function (s) {
        return s.solid && s.top > this.pos[1] && s.bottom < this.pos[1] + 0.5 &&
          g.world.col.closestXZ(s, this.pos[0], this.pos[2], [0, 0, 0])[2] < 0.32;
      }, this);
      if (this.pos[1] <= gy || blocked) { this.pos[1] = gy; this.smash(g); return; }
      for (var i = 0; i < g.world.actors.length; i++) {
        var a = g.world.actors[i];
        if (a.team !== 'enemy' || !a.alive) continue;
        if (V3.dist(a.pos, this.pos) < 0.8) {
          a.hurt(2, this, { knockback: 5 });
          this.smash(g);
          return;
        }
      }
    }
  };
  var _pm = M4.create();
  Pot.prototype.draw = function (g) {
    if (this.hidden) return;
    M4.compose(_pm, this.pos[0], this.pos[1], this.pos[2], 0, this.yaw, 0, 1, 1, 1);
    g.r.submit(this.mesh, _pm, g.assets.mat[this.matName]);
  };

  /* ---------------------------------------------------------------- */
  /* Cuttable grass                                                    */
  /* ---------------------------------------------------------------- */
  function GrassClump(game, o) {
    LZ.Actor.call(this, { kind: 'grass', x: o.x, y: o.y, z: o.z, radius: 0.3, height: 0.5 });
    this.game = game;
    this.breakable = true;
    this.team = 'prop';
    this.cut = false;
    this.castShadow = false;
    this.drop = o.drop === undefined ? 'random' : o.drop;
    this.mesh = game.grassMesh();
    this.matName = o.mat || 'grassblade';
    this.cullDist = 34;
  }
  GrassClump.prototype = Object.create(LZ.Actor.prototype);
  GrassClump.prototype.constructor = GrassClump;
  GrassClump.prototype.onHurt = function () {
    if (this.cut) return false;
    this.cut = true;
    this.removeMe = true;
    var g = this.game;
    g.audio.sfx('swing');
    g.particles.emit('leaf', this.pos[0], this.pos[1] + 0.2, this.pos[2], 6, [0.45, 0.72, 0.32, 1]);
    if (this.drop && Math.random() < 0.42) g.spawnDrop(this.pos[0], this.pos[1] + 0.3, this.pos[2], this.drop);
    return false;
  };
  GrassClump.prototype.update = function () { };
  var _gm = M4.create();
  GrassClump.prototype.draw = function (g) {
    var sway = Math.sin(g.time * 1.6 + this.pos[0] * 0.7) * 0.05;
    M4.compose(_gm, this.pos[0], this.pos[1], this.pos[2], sway, this.yaw, 0, 1, 1, 1);
    g.r.submit(this.mesh, _gm, g.assets.mat[this.matName]);
  };

  /* ---------------------------------------------------------------- */
  /* Pickups                                                           */
  /* ---------------------------------------------------------------- */
  function Pickup(game, o) {
    LZ.Actor.call(this, { kind: 'pickup', x: o.x, y: o.y, z: o.z, radius: 0.3, height: 0.4 });
    this.game = game;
    this.what = o.what;
    this.value = o.value || 1;
    this.life = o.life || 0;
    this.age = 0;
    this.castShadow = true;
    this.shadowSize = 0.5;
    this.vel[1] = o.pop ? 4 : 0;
    this.magnet = 0;
    this.cullDist = 40;
    this.mesh = game.pickupMesh(this.what);
    this.matName = game.pickupMat(this.what);
  }
  Pickup.prototype = Object.create(LZ.Actor.prototype);
  Pickup.prototype.constructor = Pickup;
  Pickup.prototype.update = function (dt, g) {
    this.age += dt;
    if (this.life && this.age > this.life) { this.removeMe = true; return; }
    if (!this.grounded || this.vel[1] !== 0) {
      this.vel[1] -= 22 * dt;
      this.pos[1] += this.vel[1] * dt;
      this.pos[0] += this.vel[0] * dt;
      this.pos[2] += this.vel[2] * dt;
      this.vel[0] *= Math.exp(-4 * dt); this.vel[2] *= Math.exp(-4 * dt);
      var gy = g.world.col.floorAt(this.pos[0], this.pos[2], this.pos[1] + 0.2, 0.2, {}).y;
      if (this.pos[1] <= gy + 0.22) { this.pos[1] = gy + 0.22; this.vel[1] = 0; this.grounded = true; }
    }
    var d = V3.distXZ(this.pos, g.player.pos);
    if (d < 2.2) this.magnet = 1;
    if (this.magnet) {
      var dx = g.player.pos[0] - this.pos[0], dy = g.player.pos[1] + 0.6 - this.pos[1], dz = g.player.pos[2] - this.pos[2];
      var l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      var sp = 7;
      this.pos[0] += dx / l * sp * dt; this.pos[1] += dy / l * sp * dt; this.pos[2] += dz / l * sp * dt;
      if (l < 0.55) this.collect(g);
    }
  };
  Pickup.prototype.collect = function (g) {
    this.removeMe = true;
    var inv = g.inv;
    switch (this.what) {
      case 'rupeeG': inv.addRupees(1); g.audio.sfx('rupee'); break;
      case 'rupeeB': inv.addRupees(5); g.audio.sfx('rupee'); break;
      case 'rupeeR': inv.addRupees(20); g.audio.sfx('rupee'); break;
      case 'rupeeP': inv.addRupees(50); g.audio.sfx('rupee'); break;
      case 'heart': g.player.heal(1); break;
      case 'heartBig': g.player.heal(4); break;
      case 'magic': inv.addMagic(12); g.audio.sfx('magic'); g.hud.magicPulse = 0.4; break;
      case 'magicBig': inv.addMagic(48); g.audio.sfx('magic'); g.hud.magicPulse = 0.6; break;
      case 'arrow': inv.addArrows(5); g.audio.sfx('rupee'); break;
      case 'bomb': inv.addBombs(3); g.audio.sfx('rupee'); break;
      case 'key': inv.addKey(g.currentDungeon, 1); g.audio.sfx('secret'); g.hud.toast('Small Key'); break;
    }
  };
  var _um = M4.create();
  Pickup.prototype.draw = function (g) {
    var bob = Math.sin(g.time * 3 + this.pos[0]) * 0.06;
    var fade = (this.life && this.age > this.life - 2) ? (Math.floor(this.age * 8) % 2) : 1;
    if (!fade) return;
    M4.compose(_um, this.pos[0], this.pos[1] + bob, this.pos[2], 0, g.time * 1.8, 0, 1, 1, 1);
    g.r.submit(this.mesh, _um, g.assets.mat[this.matName]);
  };

  /* ---------------------------------------------------------------- */
  /* Door / area transition prop                                       */
  /* ---------------------------------------------------------------- */
  function Door(game, o) {
    LZ.Actor.call(this, { kind: 'door', x: o.x, y: o.y, z: o.z, yaw: o.yaw || 0, radius: 0.6, height: 2.2 });
    this.game = game;
    this.to = o.to;
    this.entry = o.entry || 'default';
    this.interactable = true;
    this.interactRange = 1.5;
    this.actionLabel = o.label || 'Enter';
    this.castShadow = false;
    this.locked = o.locked || null;      /* 'small' | 'boss' | function */
    this.dungeon = o.dungeon || null;
    this.mesh = o.mesh || null;
    this.matName = o.mat || 'planksDark';
    this.opened = false;
    this.cond = o.cond || null;
    this.denyText = o.denyText || 'It will not open.';
  }
  Door.prototype = Object.create(LZ.Actor.prototype);
  Door.prototype.constructor = Door;
  Door.prototype.act = function (g) {
    if (this.cond && !this.cond(g)) { g.audio.sfx('error'); g.dialogue.say(this.denyText); return; }
    if (this.locked === 'small' && !this.opened) {
      if (!g.inv.useKey(this.dungeon || g.currentDungeon)) {
        g.audio.sfx('error');
        g.dialogue.say('The door is locked. You need a small key.');
        return;
      }
      this.opened = true;
      g.audio.sfx('lock_open');
      g.hud.toast('The lock falls away.');
    }
    if (this.locked === 'boss' && !this.opened) {
      if (!g.inv.bossKeys[this.dungeon || g.currentDungeon]) {
        g.audio.sfx('error');
        g.dialogue.say('A great lock, shaped like a beast\'s jaw.\nThe Great Key would open it.');
        return;
      }
      this.opened = true;
      g.audio.sfx('lock_open');
    }
    g.audio.sfx('door');
    g.goToArea(this.to, this.entry);
  };
  Door.prototype.update = function () { };
  var _dm = M4.create();
  Door.prototype.draw = function (g) {
    if (!this.mesh) return;
    M4.compose(_dm, this.pos[0], this.pos[1], this.pos[2], 0, this.yaw, 0, 1, 1, 1);
    g.r.submit(this.mesh, _dm, g.assets.mat[this.matName]);
    if (this.locked && !this.opened) {
      g.effects.lockIcon(this.pos[0], this.pos[1] + 1.4, this.pos[2], this.locked === 'boss');
    }
  };
  Door.prototype.drawShadow = function () { };

  /* ---------------------------------------------------------------- */
  /* Switches                                                          */
  /* ---------------------------------------------------------------- */
  function Switch(game, o) {
    LZ.Actor.call(this, { kind: 'switch', x: o.x, y: o.y, z: o.z, radius: 0.5, height: 0.3 });
    this.game = game;
    this.style = o.style || 'floor';   /* floor | crystal | chain */
    this.on = false;
    this.onToggle = o.onToggle;
    this.hold = o.hold !== false;      /* floor switches can be hold-type */
    this.needsWeight = o.weight || 1;
    this.castShadow = false;
    this.lockable = this.style === 'crystal';
    this.lockRange = 12;
    this.interactable = this.style === 'chain';
    this.actionLabel = 'Pull';
    this.mesh = game.switchMesh(this.style);
    this.team = this.style === 'crystal' ? 'prop' : 'neutral';
    this.breakable = this.style === 'crystal';
    if (this.style === 'floor') {
      game.world.col.add(C.box(o.x, o.y + 0.06, o.z, 0.55, 0.06, 0.55, { surface: 'stone' }));
    }
  }
  Switch.prototype = Object.create(LZ.Actor.prototype);
  Switch.prototype.constructor = Switch;
  Switch.prototype.onHurt = function () {
    if (this.style !== 'crystal') return false;
    this.toggle(this.game);
    return false;
  };
  Switch.prototype.act = function (g) { this.toggle(g); };
  Switch.prototype.toggle = function (g) {
    this.on = !this.on;
    g.audio.sfx(this.on ? 'switch_on' : 'click');
    g.audio.sfx('click');
    if (this.onToggle) this.onToggle(g, this.on, this);
  };
  Switch.prototype.update = function (dt, g) {
    if (this.style !== 'floor') return;
    var weight = 0;
    if (V3.distXZ(this.pos, g.player.pos) < 0.75 && Math.abs(g.player.pos[1] - this.pos[1]) < 1.0) weight++;
    for (var i = 0; i < g.world.actors.length; i++) {
      var a = g.world.actors[i];
      if (a === this || a.kind !== 'block') continue;
      if (V3.distXZ(this.pos, a.pos) < 0.85) weight++;
    }
    var should = weight >= this.needsWeight;
    if (should !== this.on) {
      if (should || this.hold) {
        this.on = should;
        g.audio.sfx('click');
        if (this.onToggle) this.onToggle(g, this.on, this);
      }
    }
  };
  var _sm = M4.create();
  Switch.prototype.draw = function (g) {
    var press = this.on && this.style === 'floor' ? 0.05 : 0;
    M4.compose(_sm, this.pos[0], this.pos[1] - press, this.pos[2], 0, this.yaw, 0, 1, 1, 1);
    var mat = g.assets.frameMat(this.style === 'crystal' ? (this.on ? 'gemRed' : 'gemBlue') : 'metal', null);
    if (this.style === 'crystal') mat.tint = this.on ? [1, 0.5, 0.3, 0.25] : [0.3, 0.6, 1, 0.25];
    g.r.submit(this.mesh, _sm, mat);
  };

  /* ---------------------------------------------------------------- */
  /* Pushable block                                                    */
  /* ---------------------------------------------------------------- */
  function Block(game, o) {
    LZ.Actor.call(this, { kind: 'block', x: o.x, y: o.y, z: o.z, radius: 0.7, height: 1.4 });
    this.game = game;
    this.size = o.size || 1.4;
    this.interactable = true;
    this.interactRange = 1.35;
    this.actionLabel = 'Push';
    this.castShadow = false;
    this.pushing = false;
    this.pushDir = [0, 0];
    this.pushT = 0;
    this.mesh = game.blockMesh(this.size, o.style || 'stone');
    this.matName = o.mat || 'stoneblock';
    var h = this.size;
    this.collider = game.world.col.add(C.box(o.x, o.y + h / 2, o.z, h / 2, h / 2, h / 2, { ref: this, surface: 'stone' }));
  }
  Block.prototype = Object.create(LZ.Actor.prototype);
  Block.prototype.constructor = Block;
  Block.prototype.act = function (g, player) {
    if (this.pushing) return;
    var dx = this.pos[0] - player.pos[0], dz = this.pos[2] - player.pos[2];
    /* snap to the dominant axis, exactly like block puzzles of the era */
    if (Math.abs(dx) > Math.abs(dz)) { this.pushDir = [Math.sign(dx), 0]; }
    else { this.pushDir = [0, Math.sign(dz)]; }
    var nx = this.pos[0] + this.pushDir[0] * this.size;
    var nz = this.pos[2] + this.pushDir[1] * this.size;
    /* refuse if something is in the way */
    var list = g.world.col.query(nx, nz, this.size * 0.5, []);
    for (var i = 0; i < list.length; i++) {
      if (list[i] === this.collider) continue;
      if (!list[i].solid) continue;
      var cp = g.world.col.closestXZ(list[i], nx, nz, [0, 0, 0]);
      if (cp[2] < this.size * 0.45) { g.audio.sfx('error'); return; }
    }
    this.pushing = true;
    this.pushT = 0;
    this.startPos = [this.pos[0], this.pos[2]];
    player.play('push', { blend: 0.12 });
    player.noControl = 0.85;
    g.audio.sfx('rumble');
  };
  Block.prototype.update = function (dt, g) {
    if (!this.pushing) return;
    this.pushT += dt / 0.8;
    var t = M.saturate(this.pushT);
    this.pos[0] = this.startPos[0] + this.pushDir[0] * this.size * t;
    this.pos[2] = this.startPos[1] + this.pushDir[1] * this.size * t;
    this.collider.x = this.pos[0];
    this.collider.z = this.pos[2];
    if (t >= 1) {
      this.pushing = false;
      g.audio.sfx('land');
      g.cam.addShake(0.1);
      g.particles.emit('dust', this.pos[0], this.pos[1], this.pos[2], 6, 1.0);
    }
  };
  var _bm = M4.create();
  Block.prototype.draw = function (g) {
    M4.compose(_bm, this.pos[0], this.pos[1], this.pos[2], 0, 0, 0, 1, 1, 1);
    g.r.submit(this.mesh, _bm, g.assets.mat[this.matName]);
  };

  /* ---------------------------------------------------------------- */
  /* Torch                                                             */
  /* ---------------------------------------------------------------- */
  function Torch(game, o) {
    LZ.Actor.call(this, { kind: 'torch', x: o.x, y: o.y, z: o.z, radius: 0.2, height: 1.8 });
    this.game = game;
    this.lit = o.lit !== false;
    this.h = o.h || 1.7;
    this.onLight = o.onLight || null;
    this.castShadow = false;
    this.emberT = 0;
    this.breakable = true;
    this.team = 'prop';
    this.cullDist = 46;
  }
  Torch.prototype = Object.create(LZ.Actor.prototype);
  Torch.prototype.constructor = Torch;
  Torch.prototype.onHurt = function (amount, source, opts) {
    if (!this.lit && opts && opts.element === 'fire') this.light(this.game);
    return false;
  };
  Torch.prototype.light = function (g) {
    if (this.lit) return;
    this.lit = true;
    g.audio.sfx('fire');
    if (this.onLight) this.onLight(g, this);
  };
  Torch.prototype.update = function (dt, g) {
    if (!this.lit) return;
    this.emberT += dt;
    if (this.emberT > 0.08) {
      this.emberT = 0;
      g.particles.emit('fire', this.pos[0], this.pos[1] + this.h, this.pos[2], 1);
    }
  };
  Torch.prototype.draw = function (g) {
    if (!this.lit) return;
    g.effects.flame(this.pos[0], this.pos[1] + this.h + 0.18, this.pos[2], 0.55);
    g.effects.pointLight(this.pos[0], this.pos[1] + this.h, this.pos[2], [1, 0.72, 0.35], 1.9);
  };
  Torch.prototype.drawShadow = function () { };

  /* ---------------------------------------------------------------- */
  /* Climbable surface (ladder / vines)                                */
  /* ---------------------------------------------------------------- */
  function Climb(game, o) {
    LZ.Actor.call(this, { kind: 'climb', x: o.x, y: o.y, z: o.z, yaw: o.yaw || 0, radius: 0.8, height: 1 });
    this.interactable = true;
    this.interactRange = o.range || 1.3;
    this.actionLabel = 'Climb';
    this.castShadow = false;
    this.top = o.top;
    this.bottom = o.bottom === undefined ? o.y : o.bottom;
    this.hidden = true;
  }
  Climb.prototype = Object.create(LZ.Actor.prototype);
  Climb.prototype.constructor = Climb;
  Climb.prototype.act = function (g, player) {
    player.startClimb({ x: this.pos[0], z: this.pos[2], yaw: this.yaw + Math.PI, top: this.top, bottom: this.bottom });
    g.audio.sfx('step_wood');
  };
  Climb.prototype.update = function () { };
  Climb.prototype.draw = function () { };
  Climb.prototype.drawShadow = function () { };

  /* ---------------------------------------------------------------- */
  /* Gossip stone: the hint system                                     */
  /* ---------------------------------------------------------------- */
  function HintStone(game, o) {
    LZ.Actor.call(this, { kind: 'hint', x: o.x, y: o.y, z: o.z, radius: 0.5, height: 1.2 });
    this.game = game;
    this.interactable = true;
    this.interactRange = 1.7;
    this.actionLabel = 'Listen';
    this.hint = o.hint || null;
    this.mesh = game.hintStoneMesh();
    this.castShadow = true;
    this.shadowSize = 1.2;
    game.world.col.add(C.cyl(o.x, o.y, o.z, 0.5, 1.1, {}));
  }
  HintStone.prototype = Object.create(LZ.Actor.prototype);
  HintStone.prototype.constructor = HintStone;
  HintStone.prototype.act = function (g) {
    var text = this.hint;
    if (!text) {
      var cur = g.quest.current();
      text = cur ? ('...' + cur.goal) : '...Hyrule is quiet. Rest a while.';
    }
    var extra = g.inv.hasMask('truthMask') && g.inv.wornMask === 'truthMask';
    g.audio.sfx('secret');
    g.dialogue.say((extra ? '' : 'The stone hums, but you cannot make out\nthe words.\f') + text,
      { speaker: 'Gossip Stone', style: 'dark' });
  };
  HintStone.prototype.update = function () { };
  var _hm = M4.create();
  HintStone.prototype.draw = function (g) {
    M4.compose(_hm, this.pos[0], this.pos[1], this.pos[2], 0, this.yaw, 0, 1, 1, 1);
    g.r.submit(this.mesh, _hm, g.assets.mat.stoneblock);
  };

  LZ.NPC = NPC;
  LZ.Chest = Chest;
  LZ.Sign = Sign;
  LZ.Pot = Pot;
  LZ.GrassClump = GrassClump;
  LZ.Pickup = Pickup;
  LZ.Door = Door;
  LZ.Switch = Switch;
  LZ.Block = Block;
  LZ.Torch = Torch;
  LZ.Climb = Climb;
  LZ.HintStone = HintStone;
  LZ.villagerRig = villagerRig;
  LZ.NPC_PALETTES = PALETTES;
})(LZ);
