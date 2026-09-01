/* =============================================================
   main.js -- the game object: boot, loop, state machine, and the
   service APIs every other module calls into.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var M = LZ.M, V3 = LZ.V3, M4 = LZ.M4, GL = LZ.GL, Items = LZ.Items;

  var RESOLUTIONS = [[320, 240], [384, 288], [512, 384], [640, 480]];

  /* ---------------------------------------------------------------- */
  /* Cutscene runner                                                   */
  /* ---------------------------------------------------------------- */
  function Cutscene(game) {
    this.g = game;
    this.active = false;
    this.steps = null;
    this.index = 0;
    this.t = 0;
    this.waiting = false;
    this.onEnd = null;
    this.vars = {};
  }
  Cutscene.prototype.play = function (steps, onEnd) {
    this.steps = steps.slice();
    this.index = 0;
    this.t = 0;
    this.active = true;
    this.waiting = false;
    this.onEnd = onEnd || null;
    this.vars = {};
    this.g.hud.visible = false;
    this.g.player.vel[0] = 0; this.g.player.vel[2] = 0;
    this.g.player.speed = 0;
    this.g.input.swallow();
  };
  Cutscene.prototype.skip = function () {
    /* Nothing to skip is not an error. end() clears the step list, so a
       second skip -- a player still mashing the button as the scene ends --
       would otherwise dereference null and take the game down. */
    if (!this.active || !this.steps) return;
    /* run every remaining side effect instantly, then end */
    while (this.index < this.steps.length) {
      var s = this.steps[this.index++];
      if (s.fn) s.fn(this.g, this);
      if (s.give) this.g.giveItem(s.give, s.count || 1, { silent: true });
      if (s.flag) this.g.inv.setFlag(s.flag);
      if (s.goTo) { this.g.goToArea(s.goTo, s.entry); break; }
    }
    this.end();
  };
  Cutscene.prototype.end = function () {
    if (!this.active) return;
    this.active = false;
    this.steps = null;
    this.g.hud.visible = true;
    this.g.cam.mode = 'follow';
    this.g.player.noControl = 0.1;
    this.g.r.fade[3] = 0;
    if (this.onEnd) { var f = this.onEnd; this.onEnd = null; f(this.g); }
  };
  Cutscene.prototype.update = function (dt) {
    if (!this.active) return;
    var g = this.g;
    if (g.dialogue.active) return;
    if (g.input.pressed('start') && this.skippable !== false) { this.skip(); return; }

    var guard = 0;
    while (this.active && guard++ < 24) {
      if (this.index >= this.steps.length) { this.end(); return; }
      var s = this.steps[this.index];
      if (!this.waiting) {
        this.t = 0;
        this.waiting = true;
        this._begin(s);
        if (!this._blocking(s)) { this.waiting = false; this.index++; continue; }
      }
      this.t += dt;
      if (this._done(s)) { this.waiting = false; this.index++; dt = 0; continue; }
      return;
    }
  };
  Cutscene.prototype._begin = function (s) {
    var g = this.g;
    if (s.fn) s.fn(g, this);
    if (s.flag) g.inv.setFlag(s.flag);
    if (s.give) g.giveItem(s.give, s.count || 1, s.giveOpts || {});
    if (s.music !== undefined) {
      if (s.music === null) g.audio.stopSong();
      else g.audio.playSong(LZ.Music[s.music], { restart: true });
    }
    if (s.sfx) g.audio.sfx(s.sfx);
    if (s.shake) g.cam.addShake(s.shake);
    if (s.title) g.hud.showArea(s.title, s.sub);
    if (s.say) {
      g.dialogue.say(s.say, { speaker: s.speaker, style: s.style });
    }
    if (s.cam) {
      var c = s.cam;
      g.cam.startCutscene(c.from || g.cam.pos, c.fromTarget || g.cam.target,
        c.pos, c.target, c.dur === undefined ? 1.2 : c.dur, c.ease);
    }
    if (s.camFollow) { g.cam.mode = 'follow'; g.cam.snapBehind(g.player); }
    if (s.anim) {
      var a = this._actor(s.anim);
      if (a) a.play(s.clip, { restart: true, blend: s.blend === undefined ? 0.2 : s.blend, speed: s.speed || 1 });
    }
    if (s.face) {
      var fa = this._actor(s.face);
      if (fa) {
        var tgt = s.at === 'player' ? [g.player.pos[0], g.player.pos[2]] : s.at;
        fa.faceTowards(tgt[0], tgt[1], true);
      }
    }
    if (s.warp) {
      var wa = this._actor(s.warp);
      if (wa) { wa.pos[0] = s.to[0]; wa.pos[2] = s.to[1]; if (s.to[2] !== undefined) wa.pos[1] = s.to[2]; }
    }
    if (s.fade) {
      g.fadeTarget = (s.fade === 'out') ? 1 : 0;
      g.fadeSpeed = 1 / (s.dur || 0.6);
      if (s.color) { g.r.fade[0] = s.color[0]; g.r.fade[1] = s.color[1]; g.r.fade[2] = s.color[2]; }
      else { g.r.fade[0] = 0; g.r.fade[1] = 0; g.r.fade[2] = 0; }
    }
    if (s.goTo) g.goToArea(s.goTo, s.entry);
  };
  Cutscene.prototype._blocking = function (s) {
    return !!(s.wait || s.say || s.cam || s.move || s.fade);
  };
  Cutscene.prototype._done = function (s) {
    var g = this.g;
    if (s.say) return !g.dialogue.active;
    if (s.move) {
      var a = this._actor(s.move);
      if (!a) return true;
      var dx = s.to[0] - a.pos[0], dz = s.to[1] - a.pos[2];
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d < 0.25 || this.t > (s.timeout || 8)) { a.speed = 0; a.play(s.endClip || 'idle', { blend: 0.2 }); return true; }
      var sp = s.speed || 2.2;
      a.targetYaw = Math.atan2(dx, dz);
      a.turnToward(0.016);
      a.moveXZ(dx / d * sp * 0.016, dz / d * sp * 0.016, g.world);
      a.play(sp > 3.2 ? 'run' : 'walk', { blend: 0.2 });
      return false;
    }
    if (s.cam) return g.cam.cutsceneDone();
    if (s.fade) return Math.abs(g.r.fade[3] - g.fadeTarget) < 0.02;
    if (s.wait) return this.t >= s.wait;
    return true;
  };
  Cutscene.prototype._actor = function (ref) {
    var g = this.g;
    if (ref === 'player') return g.player;
    if (typeof ref === 'string') {
      return g.world.findActor(function (a) { return a.name === ref || a.tagName === ref; });
    }
    return ref;
  };

  /* ---------------------------------------------------------------- */
  /* Game                                                              */
  /* ---------------------------------------------------------------- */
  function Game(canvas) {
    this.canvas = canvas;
    this.r = new GL.Renderer(canvas, { width: 320, height: 240 });
    this.resIndex = 0;
    this.assets = new LZ.Assets(this.r);
    LZ.assets = this.assets;   /* rigs build their face textures through this */
    this.audio = new LZ.Audio();
    this.input = new LZ.Input();
    this.meshes = new LZ.Meshes(this.r);
    this.time = 0;
    this.state = 'boot';
    this.opt = { holdTarget: true };
    this.fadeTarget = 0;
    this.fadeSpeed = 2;
    this.hitStopT = 0;
    this.currentDungeon = null;
    this.bossBar = null;
    this.gameOverShown = false;
    this.frame = 0;
    this.fps = 60;
    this._fpsAcc = 0; this._fpsCount = 0;
    this.showDebug = false;
    this.pendingArea = null;
    this.titleIndex = 0;
    this.fileIndex = 0;
    this.areaOfDeath = null;
  }

  Game.prototype.boot = function (progress) {
    this.assets.build(progress);
    this.ui = new LZ.UI(this.r, this.assets);
    this.particles = new LZ.Particles(this.r, this.assets);
    this.effects = new LZ.Effects(this);
    this.cam = new LZ.Camera(this.r);
    this.hud = new LZ.HUD(this);
    this.menu = new LZ.Menu(this);
    this.dialogue = new LZ.Dialogue(this);
    this.quest = new LZ.Quest(this);
    this.cutscene = new Cutscene(this);
    this.inv = new LZ.Inventory();
    this.world = new LZ.World(this);
    this.quadMesh = LZ.Props.quad(this.r);
    this.billboardMesh = LZ.Props.billboardQuad(this.r);
    this._linkMesh = null;
    this.resize();
    var self = this;
    window.addEventListener('resize', function () { self.resize(); });
    this.state = 'title';
    this.loadTitleScene();
  };

  Game.prototype.resize = function () {
    var vw = window.innerWidth, vh = window.innerHeight;
    var aspect = 4 / 3;
    var w = vw, h = Math.round(vw / aspect);
    if (h > vh) { h = vh; w = Math.round(vh * aspect); }
    var scale = Math.max(1, Math.min(6, Math.floor(Math.min(w / this.r.width, h / this.r.height))));
    this.canvas.width = this.r.width * scale;
    this.canvas.height = this.r.height * scale;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
  };
  Game.prototype.setResolution = function (i) {
    if (i === this.resIndex) return;
    this.resIndex = i;
    this.r.setInternalResolution(RESOLUTIONS[i][0], RESOLUTIONS[i][1]);
    this.resize();
  };

  /* ---------------- mesh accessors ---------------- */
  Game.prototype.weaponMesh = function (id) { return this.meshes.weapon(id); };
  Game.prototype.shieldMesh = function (id) { return this.meshes.shield(id); };
  Game.prototype.toolMesh = function (id) { return this.meshes.tool(id); };
  Game.prototype.enemyWeaponMesh = function (id) { return this.meshes.enemyWeapon(id); };
  Game.prototype.chestMesh = function (big, lid) { return this.meshes.chest(big, lid); };
  Game.prototype.potMesh = function (style) { return this.meshes.pot(style); };
  Game.prototype.grassMesh = function () { return this.meshes.grass(); };
  Game.prototype.pickupMesh = function (w) { return this.meshes.pickup(w); };
  Game.prototype.pickupMat = function (w) { return this.meshes.pickupMat(w); };
  Game.prototype.blockMesh = function (s, st) { return this.meshes.block(s, st); };
  Game.prototype.switchMesh = function (s) { return this.meshes.switchMesh(s); };
  Game.prototype.hintStoneMesh = function () { return this.meshes.hintStone(); };
  Game.prototype.linkMesh = function () {
    if (!this._linkMesh) {
      var mb = new GL.MeshBuilder();
      mb.setColorHex(0xb8bec8);
      mb.box(0, 0.5, 0, 0.05, 1, 0.05, 6);
      this._linkMesh = mb.build(this.r);
    }
    return this._linkMesh;
  };

  /* ---------------- spawning ---------------- */
  Game.prototype.spawnArrow = function (x, y, z, dir, owner) {
    return this.world.addActor(new LZ.Projectile(this, {
      x: x, y: y, z: z, dir: dir, speed: 30, damage: 1.5, owner: owner,
      kind: 'arrow', life: 2.4, hitPlayer: false, hitEnemy: true, gravity: 3
    }));
  };
  Game.prototype.spawnBomb = function (x, y, z, owner) {
    return this.world.addActor(new LZ.Bomb(this, { x: x, y: y, z: z, owner: owner }));
  };
  Game.prototype.spawnProjectile = function (x, y, z, dir, o) {
    o = o || {};
    o.x = x; o.y = y; o.z = z; o.dir = dir;
    return this.world.addActor(new LZ.Projectile(this, o));
  };
  Game.prototype.fireBoomerang = function (owner, x, y, z, dir) {
    if (this._boomerangOut && !this._boomerangOut.removeMe) return;
    this._boomerangOut = new LZ.Boomerang(this, { x: x, y: y, z: z, dir: dir, owner: owner });
    return this.world.addActor(this._boomerangOut);
  };
  Game.prototype.fireHookshot = function (owner, x, y, z, dir) {
    return this.world.addActor(new LZ.HookshotProj(this, { x: x, y: y, z: z, dir: dir, owner: owner }));
  };
  Game.prototype.fireIce = function (x, y, z, dir, owner) {
    return this.spawnProjectile(x, y, z, dir, {
      speed: 16, damage: 1, owner: owner, kind: 'ice', life: 2.0,
      hitPlayer: false, hitEnemy: true, element: 'ice'
    });
  };
  Game.prototype.spawnDrop = function (x, y, z, what) {
    if (what === 'random') {
      var table = ['heart', 'rupeeG', 'rupeeG', 'rupeeB', 'magic', null, null];
      what = table[Math.floor(Math.random() * table.length)];
      if (!what) return null;
    }
    return this.world.addActor(new LZ.Pickup(this, { x: x, y: y, z: z, what: what, pop: true, life: 22 }));
  };

  Game.prototype.explode = function (x, y, z, o) {
    o = o || {};
    var radius = o.radius || 3;
    this.effects.explosion(x, y, z, radius);
    this.audio.sfx('explode');
    this.cam.addShake(o.small ? 0.25 : 0.55);
    this.hitStop(0.06);
    var i, a;
    for (i = 0; i < this.world.actors.length; i++) {
      a = this.world.actors[i];
      if (a === o.owner || !a.alive || a.dead) continue;
      var d = V3.dist(a.pos, [x, y, z]);
      if (d > radius) continue;
      if (a.team === 'enemy' || a.breakable) {
        a.hurt(o.damage || 2, { pos: [x, y, z] }, { knockback: 9, source: 'explosion' });
      }
      if (a.smash && a.kind === 'pot') a.smash(this);
    }
    if (V3.dist(this.player.pos, [x, y, z]) < radius && this.player.state !== 'dead') {
      this.player.damage(o.selfDamage === undefined ? 1 : o.selfDamage, { pos: [x, y, z] }, { knockback: 9, blockable: false });
    }
    /* bombable walls */
    var solids = this.world.col.query(x, z, radius, []);
    for (i = 0; i < solids.length; i++) {
      var s = solids[i];
      if (s.tag === 'bombable' && s.ref && s.ref.onBomb) s.ref.onBomb(this);
    }
    if (this.world.area && this.world.area.onExplosion) this.world.area.onExplosion(this, x, y, z, radius);
  };

  Game.prototype.hammerShock = function (x, y, z, owner) {
    this.effects.ring(x, y + 0.1, z, [0.9, 0.8, 0.6, 0.9], 4.5);
    this.audio.sfx('explode');
    this.cam.addShake(0.35);
    this.particles.emit('dust', x, y, z, 14, 2.2);
    for (var i = 0; i < this.world.actors.length; i++) {
      var a = this.world.actors[i];
      if (a === owner || !a.alive || a.dead) continue;
      if (V3.distXZ(a.pos, [x, y, z]) > 3.2) continue;
      if (a.team === 'enemy') a.hurt(2, owner, { knockback: 7, stun: 1.2, source: 'hammer' });
      if (a.awake === false && a.wake) a.wake(this);
    }
  };

  Game.prototype.spawnRockfall = function (x, z, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * M.TAU, d = 2 + Math.random() * 6;
      var px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      this.particles.emit('dust', px, this.world.groundHeight(px, pz) + 4, pz, 4, 0.5, [0.5, 0.45, 0.4, 0.8]);
    }
  };

  Game.prototype.freezeAt = function (x, y, z) {
    var w = this.world.col.waterAt(x, z);
    if (!w) return;
    if (Math.abs(y - w.level) > 1.2) return;
    var mesh = this.meshes.iceBlock();
    var self = this;
    var block = new LZ.Actor({ kind: 'iceblock', x: x, y: w.level - 0.6, z: z, radius: 0.7, height: 1.2 });
    block.mesh = mesh;
    block.castShadow = false;
    block.life = 22;
    block.age = 0;
    block.update = function (dt) {
      this.age += dt;
      if (this.age > this.life) { this.removeMe = true; if (this.solidRef) self.world.col.remove(this.solidRef); }
    };
    var _im = M4.create();
    block.draw = function (g) {
      M4.compose(_im, this.pos[0], this.pos[1], this.pos[2], 0, 0, 0, 1, 1, 1);
      var mat = g.assets.frameMat('ice', null);
      mat.prim = [1, 1, 1, this.age > this.life - 3 ? (Math.floor(this.age * 6) % 2 ? 0.4 : 0.9) : 0.9];
      g.r.submit(this.mesh, _im, mat);
    };
    block.solidRef = this.world.col.add(LZ.Collision.box(x, w.level - 0.05, z, 0.6, 0.55, 0.6, { surface: 'ice' }));
    this.world.addActor(block);
    this.audio.sfx('ice');
    this.particles.emit('splash', x, w.level, z, 8, [0.8, 0.95, 1, 0.9]);
  };

  /* ---------------- items & progression ---------------- */
  Game.prototype.giveItem = function (id, count, o) {
    o = o || {};
    var inv = this.inv, d = Items.ITEMS[id];
    var msg = null;
    count = count || 1;
    if (!d) {
      /* pseudo-items */
      if (id === 'rupees') { inv.addRupees(count); msg = count + ' rupees'; }
      else if (id === 'arrows') { inv.addArrows(count); msg = count + ' arrows'; }
      else if (id === 'bombs') { inv.addBombs(count); msg = count + ' bombs'; }
      else { console.warn('unknown item', id); return; }
    } else {
      switch (d.type) {
        case 'weapon':
          var res = inv.addWeapon(id);
          if (res === 'full') {
            var self = this;
            this.dialogue.ask('You are carrying too much.\nDrop something to take the ' + d.name + '?',
              inv.weapons.map(function (w) { return Items.ITEMS[w.id].name; }).concat(['Leave it']),
              function (i) {
                if (i < inv.weapons.length) { inv.replaceWeapon(i, id); self.hud.toast('Got the ' + d.name + '!'); }
              }, { style: 'menu' });
            return;
          }
          msg = d.name;
          break;
        case 'shield':
          if (inv.addShield(id) === 'full') { this.hud.toast('No room for another shield.'); return; }
          msg = d.name; break;
        case 'tool': inv.giveTool(id); msg = d.name; break;
        case 'mask': inv.giveMask(id); msg = d.name; break;
        case 'quest': inv.quest[id] = true; msg = d.name; break;
        case 'material': inv.materials[id] = (inv.materials[id] || 0) + count; msg = d.name + (count > 1 ? ' x' + count : ''); break;
        case 'bottle': inv.addBottle(null); msg = 'Empty Bottle'; break;
        case 'consumable':
          var bi = inv.firstEmptyBottle();
          if (bi < 0) { this.hud.toast('No empty bottle.'); return; }
          inv.bottles[bi] = id; msg = d.name; break;
        case 'bottled':
          var bi2 = inv.firstEmptyBottle();
          if (bi2 < 0) { this.hud.toast('No empty bottle.'); return; }
          inv.bottles[bi2] = id; msg = d.name; break;
        case 'key':
          if (id === 'smallKey') { inv.addKey(this.currentDungeon, count); msg = 'Small Key'; }
          else if (id === 'bossKey') { inv.bossKeys[this.currentDungeon] = true; msg = 'Great Key'; }
          else if (id === 'map') { inv.maps[this.currentDungeon] = true; msg = 'Dungeon Map'; }
          else if (id === 'compass') { inv.compasses[this.currentDungeon] = true; msg = 'Compass'; }
          break;
        case 'collectible':
          if (id === 'heartPiece') {
            var whole = inv.addHeartPiece();
            msg = whole ? 'You gained a heart!' : 'Piece of Heart (' + inv.heartPieces + '/4)';
          } else if (id === 'heartContainer') {
            inv.maxHearts++; inv.hearts = inv.maxHearts; msg = 'Heart Container';
          }
          break;
        case 'upgrade':
          if (id === 'quiver') { inv.maxArrows += 20; inv.arrows = inv.maxArrows; msg = 'Bigger Quiver'; }
          if (id === 'bombBag') { inv.maxBombs += 15; inv.bombs = inv.maxBombs; msg = 'Bigger Bomb Bag'; }
          if (id === 'wallet') { inv.maxRupees = 999; msg = 'Giant Wallet'; }
          if (id === 'magicJar') {
            if (inv.maxMagic === 0) inv.maxMagic = 48; else inv.maxMagic = 96;
            inv.magic = inv.maxMagic; msg = 'Magic Vessel';
          }
          break;
        default: msg = d.name;
      }
    }
    if (o.silent) return;
    this.audio.sfx(o.fanfare ? 'fanfare_big' : 'fanfare_small');
    if (msg) this.hud.toast('Got: ' + msg, 3.0);
    if (d && d.desc && o.describe !== false && o.fromChest) {
      this.dialogue.say(msg + '\n' + d.desc, { style: 'menu' });
    }
  };

  Game.prototype.giveSong = function (id) {
    var s = Items.SONGS[id];
    if (!s) return;
    this.inv.songs[id] = true;
    if (!this.inv.hasTool('flute')) this.inv.giveTool('flute');
    this.audio.sfx('fanfare_big');
    var seq = s.notes.map(function (n) {
      return ({ cLeft: '◀', cDown: '▼', cRight: '▶', cUp: '▲' })[n];
    }).join(' ');
    this.dialogue.say('You learned the ' + s.name + '!\n\n' + seq + '\n\n' + s.desc, { style: 'menu' });
  };

  Game.prototype.playSong = function (s) {
    var g = this;
    this.audio.sfx('timeshift');
    if (s.id === 'hymnOfAges') {
      if (!this.world.area.eras) { this.hud.toast('Nothing answers here.'); return; }
      var to = this.world.era === 'present' ? 'past' : 'present';
      this.effects.ring(this.player.pos[0], this.player.pos[1], this.player.pos[2], [0.7, 0.6, 1, 0.9], 8);
      this.timeShiftTo(to);
    } else if (s.id === 'verseOfReturn') {
      this.rewind();
    } else if (s.id === 'windsCall') {
      this.openWarpMenu();
    } else if (s.id === 'dirgeOfTheSeal') {
      if (this.world.area.onDirge) this.world.area.onDirge(this);
      else this.hud.toast('The song fades unanswered.');
    }
  };

  Game.prototype.timeShiftTo = function (era) {
    var g = this;
    var pos = [this.player.pos[0], this.player.pos[1], this.player.pos[2]];
    var yaw = this.player.yaw;
    this.cutscene.play([
      { fade: 'out', dur: 0.7, color: [0.6, 0.55, 1] },
      { wait: 0.3 },
      { fn: function () {
          g.world.loadArea(g.world.area, 'default', era);
          g.player.pos[0] = pos[0]; g.player.pos[2] = pos[2];
          g.player.pos[1] = g.world.groundHeight(pos[0], pos[2]);
          g.player.yaw = yaw;
          g.world.addActor(g.player);
          g.cam.snapBehind(g.player);
          g.world.applyEnvironment();
          if (g.world.music) g.audio.playSong(LZ.Music[g.world.music], { restart: true });
          g.hud.showArea(g.world.area.name, era === 'past' ? 'Sixty Years Ago' : 'The Present Day');
        } },
      { fade: 'in', dur: 0.8 }
    ]);
  };

  /* short-term rewind: the Verse of Return */
  Game.prototype.recordRewind = function (dt) {
    this._rewindT = (this._rewindT || 0) + dt;
    if (this._rewindT < 0.1) return;
    this._rewindT = 0;
    if (!this._rewindBuf) this._rewindBuf = [];
    this._rewindBuf.push({
      x: this.player.pos[0], y: this.player.pos[1], z: this.player.pos[2],
      yaw: this.player.yaw, hearts: this.inv.hearts
    });
    if (this._rewindBuf.length > 100) this._rewindBuf.shift();
  };
  Game.prototype.rewind = function () {
    var buf = this._rewindBuf;
    if (!buf || buf.length < 20) { this.hud.toast('Not enough has happened yet.'); return; }
    var s = buf[Math.max(0, buf.length - 60)];
    var g = this;
    this.audio.sfx('rewind');
    this.cutscene.play([
      { fade: 'out', dur: 0.45, color: [0.5, 0.8, 1] },
      { fn: function () {
          g.player.pos[0] = s.x; g.player.pos[1] = s.y; g.player.pos[2] = s.z;
          g.player.yaw = s.yaw;
          g.inv.hearts = Math.max(g.inv.hearts, Math.min(s.hearts, g.inv.maxHearts));
          g.player.vel[0] = g.player.vel[1] = g.player.vel[2] = 0;
          g.cam.snapBehind(g.player);
          g._rewindBuf = buf.slice(0, Math.max(0, buf.length - 60));
        } },
      { fade: 'in', dur: 0.45 },
      { fn: function () { g.hud.toast('The last few moments unhappen.'); } }
    ]);
  };

  Game.prototype.openWarpMenu = function () {
    var g = this;
    var known = [];
    for (var id in this.inv.visited) {
      var area = LZ.Areas.get(id);
      if (area && area.warp) known.push(id);
    }
    if (!known.length) { this.hud.toast('Nowhere to go yet.'); return; }
    var names = known.map(function (id) { return LZ.Areas.get(id).name; });
    names.push('Stay here');
    this.dialogue.ask('Where does the wind carry you?', names, function (i) {
      if (i >= known.length) return;
      g.audio.sfx('warp');
      g.cutscene.play([
        { fade: 'out', dur: 0.8, color: [0.8, 0.95, 0.85] },
        { goTo: known[i], entry: 'default' },
        { fade: 'in', dur: 0.8 }
      ]);
    }, { style: 'menu' });
  };

  /* ---------------- enemies / bosses ---------------- */
  Game.prototype.notifyEnemyDefeated = function (e) {
    this.inv.bump('kills');
    if (this.world.area && this.world.area.onEnemyDefeated) this.world.area.onEnemyDefeated(this, e);
  };
  Game.prototype.startBossBar = function (actor, name) {
    this.bossBar = { actor: actor, name: name, shown: 1 };
  };
  Game.prototype.beginBossDeath = function (boss) {
    this.bossBar = null;
    this.cam.mode = 'follow';
    this.player.noControl = 3.0;
    this.player.lockTarget = null;
  };
  Game.prototype.finishBossDeath = function (boss) {
    var g = this;
    this.effects.burst(boss.pos[0], boss.pos[1] + 1, boss.pos[2], [1, 0.95, 0.8]);
    this.audio.sfx('secret');
    if (boss.dungeon) this.inv.medallions[boss.dungeon] = true;
    if (this.world.area && this.world.area.onBossDefeated) {
      this.world.area.onBossDefeated(this, boss);
    } else {
      this.world.addActor(new LZ.Pickup(this, {
        x: boss.pos[0], y: boss.pos[1] + 1, z: boss.pos[2], what: 'heartBig'
      }));
    }
  };

  /* ---------------- flow ---------------- */
  Game.prototype.goToArea = function (id, entry) {
    this.pendingArea = { id: id, entry: entry || 'default' };
  };

  Game.prototype._doAreaChange = function () {
    var pa = this.pendingArea;
    this.pendingArea = null;
    var area = LZ.Areas.get(pa.id);
    if (!area) { console.error('missing area ' + pa.id); return; }
    this.effects.clear();
    this.particles.clear();
    this.bossBar = null;
    this.currentDungeon = area.dungeon || null;
    var era = area.eras ? (this.world.era || 'present') : 'present';
    var spawn = this.world.loadArea(area, pa.entry, era);
    if (!this.player) {
      this.player = new LZ.Player(this, spawn.x, spawn.y, spawn.z, spawn.yaw);
    } else {
      this.player.pos[0] = spawn.x; this.player.pos[1] = spawn.y; this.player.pos[2] = spawn.z;
      this.player.yaw = spawn.yaw;
      this.player.targetYaw = spawn.yaw;
      this.player.vel[0] = this.player.vel[1] = this.player.vel[2] = 0;
      this.player.setState('ground');
      this.player.lockTarget = null;
      this.player.carry = null;
      this.player.climbing = null;
      V3.copy(this.player.lastSafe, this.player.pos);
    }
    this.world.addActor(this.player);
    this.cam.mode = 'follow';
    this.cam.snapBehind(this.player);
    this.world.applyEnvironment();
    this.inv.visited[area.id] = true;
    this._rewindBuf = [];
    if (this.world.music) this.audio.playSong(LZ.Music[this.world.music]);
    else this.audio.stopSong();
    if (!area.quiet) this.hud.showArea(area.name, area.sub);
    if (area.onEnter) area.onEnter(this, pa.entry);
  };

  Game.prototype.newGame = function (name) {
    this.inv = new LZ.Inventory();
    if (name) this.inv.playerName = name;
    this.player = null;
    this.world = new LZ.World(this);
    this.state = 'play';
    this.gameOverShown = false;
    this.goToArea('linkHouse', 'start');
    this._doAreaChange();
    LZ.Script.prologue(this);
  };

  Game.prototype.saveTo = function (slot) {
    var payload = {
      inv: this.inv.serialize(),
      area: this.world.area ? this.world.area.id : 'farrow',
      areaName: this.world.area ? this.world.area.name : '',
      era: this.world.era,
      x: this.player.pos[0], y: this.player.pos[1], z: this.player.pos[2], yaw: this.player.yaw,
      playTime: this.inv.playTime,
      progress: this.quest.progress(),
      stamp: Date.now()
    };
    return LZ.Save.write(slot, payload);
  };

  Game.prototype.loadFrom = function (slot) {
    var slots = LZ.Save.slots();
    var s = slots[slot];
    if (!s) return false;
    this.inv = LZ.Inventory.deserialize(s.inv);
    this.player = null;
    this.world = new LZ.World(this);
    this.world.era = s.era || 'present';
    this.state = 'play';
    this.gameOverShown = false;
    this.goToArea(s.area, 'default');
    this._doAreaChange();
    this.player.pos[0] = s.x; this.player.pos[1] = s.y; this.player.pos[2] = s.z;
    this.player.yaw = s.yaw;
    this.cam.snapBehind(this.player);
    return true;
  };

  Game.prototype.showGameOver = function () {
    this.gameOverShown = true;
    this.state = 'gameover';
    this.goIndex = 0;
    this.audio.playSong(LZ.Music.gameover, { restart: true, fade: false });
    this.areaOfDeath = this.world.area ? this.world.area.id : 'farrow';
  };

  Game.prototype.continueGame = function () {
    this.inv.hearts = Math.max(3, Math.ceil(this.inv.maxHearts / 2));
    this.state = 'play';
    this.gameOverShown = false;
    this.player.setState('ground');
    this.player.alive = true;
    this.player.deathTimer = 0;
    this.player.invulnTime = 2;
    var area = LZ.Areas.get(this.areaOfDeath) || LZ.Areas.get('farrow');
    this.goToArea(area.respawn || area.id, area.respawnEntry || 'default');
  };

  Game.prototype.hitStop = function (t) { this.hitStopT = Math.max(this.hitStopT, t); };

  /* project a world point to framebuffer pixels */
  var _proj = V3.create(0, 0, 0);
  Game.prototype.project = function (x, y, z) {
    var m = this.r.viewProj;
    var w = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (w <= 0.001) return null;
    var cx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
    var cy = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    if (cx < -1.4 || cx > 1.4 || cy < -1.4 || cy > 1.4) return null;
    return [(cx * 0.5 + 0.5) * this.r.width, (1 - (cy * 0.5 + 0.5)) * this.r.height];
  };


  /* ---------------- title / file select ---------------- */
  Game.prototype.loadTitleScene = function () {
    var area = LZ.Areas.get('title');
    this.world.loadArea(area, 'default', 'present');
    this.world.applyEnvironment();
    this.titleT = 0;
  };

  Game.prototype.updateTitle = function (dt) {
    this.titleT += dt;
    var r = 5.4, a = this.titleT * 0.10;
    V3.set(this.cam.pos, Math.cos(a) * r, 1.9 + Math.sin(a * 0.7) * 0.4, Math.sin(a) * r);
    V3.set(this.cam.target, 0, 1.15, 0);
    this.cam.mode = 'fixed';
    this.cam._build();
    this.world.update(dt, this);

    if (this.input.pressed('start') || this.input.pressed('a') || this.input.pressed('b')) {
      this.audio.resume();
      this.audio.sfx('menu_ok');
      this.state = 'file';
      this.fileIndex = 0;
      this.input.swallow();
    }
  };

  Game.prototype.drawTitle = function (ui) {
    var W = this.r.width, H = this.r.height;
    var t = this.titleT;
    /* soft plate behind the logo, built from stacked bands so it fades */
    for (var b = 0; b < 10; b++) {
      var aTop = 0.06 + Math.sin(b / 9 * Math.PI) * 0.46;
      ui.rect(0, 24 + b * 5, W, 5, [0.02, 0.02, 0.06, aTop]);
    }
    ui.textCentered('THE LEGEND OF', W / 2, 32, [0.86, 0.88, 0.96, 1]);
    var pulse = 0.86 + Math.sin(t * 1.6) * 0.14;
    ui.textCentered('Z E L D A', W / 2, 44, [1 * pulse, 0.86 * pulse, 0.36 * pulse, 1], { scale: 2 });
    ui.rect(W / 2 - 70, 64, 140, 1, [0.9, 0.78, 0.35, 0.8]);
    ui.textCentered('DESCENDANTS', W / 2, 70, [0.94, 0.94, 1, 1]);

    if (Math.floor(t * 1.6) % 2 === 0) {
      ui.textCentered('PRESS  START', W / 2, H - 52, [1, 1, 0.85, 1]);
    }
    ui.textCentered('Enter / A  -  begin', W / 2, H - 32, [0.55, 0.58, 0.7, 1]);
    ui.textCentered('A tribute built in code. No assets were loaded.', W / 2, H - 18, [0.4, 0.42, 0.52, 1]);
  };

  Game.prototype.updateFileSelect = function (dt) {
    var input = this.input;
    var slots = LZ.Save.slots();
    if (input.pressed('down')) { this.fileIndex = (this.fileIndex + 1) % 4; this.audio.sfx('menu_move'); }
    if (input.pressed('up')) { this.fileIndex = (this.fileIndex + 3) % 4; this.audio.sfx('menu_move'); }
    if (input.rawStick[1] < -0.7 && !this._fsHold) { this.fileIndex = (this.fileIndex + 1) % 4; this.audio.sfx('menu_move'); this._fsHold = 1; }
    if (input.rawStick[1] > 0.7 && !this._fsHold) { this.fileIndex = (this.fileIndex + 3) % 4; this.audio.sfx('menu_move'); this._fsHold = 1; }
    if (Math.abs(input.rawStick[1]) < 0.4) this._fsHold = 0;

    if (input.pressed('b')) { this.state = 'title'; this.audio.sfx('menu_back'); return; }
    if (input.pressed('a') || input.pressed('start')) {
      this.audio.resume();
      if (this.fileIndex === 3) {
        this.state = 'title';
        this.audio.sfx('menu_back');
        return;
      }
      this.audio.sfx('menu_ok');
      if (slots[this.fileIndex]) this.loadFrom(this.fileIndex);
      else this.newGame();
    }
    this.titleT += dt;
    this.world.update(dt, this);
    var r = 5.4, a = this.titleT * 0.10;
    V3.set(this.cam.pos, Math.cos(a) * r, 1.9, Math.sin(a) * r);
    V3.set(this.cam.target, 0, 1.15, 0);
    this.cam._build();
  };

  Game.prototype.drawFileSelect = function (ui) {
    var W = this.r.width, H = this.r.height;
    ui.wash([0.02, 0.02, 0.06, 0.62]);
    ui.textCentered('SELECT A FILE', W / 2, 18, [1, 0.92, 0.55, 1]);
    var slots = LZ.Save.slots();
    for (var i = 0; i < 3; i++) {
      var y = 38 + i * 44;
      var sel = i === this.fileIndex;
      ui.panel(24, y, W - 48, 38, sel ? 'menu' : 'dark');
      var s = LZ.Save.summary(slots[i]);
      ui.text('FILE ' + (i + 1), 32, y + 6, [0.95, 0.88, 0.55, 1]);
      if (s) {
        ui.text(s.name, 82, y + 6, [1, 1, 0.9, 1]);
        ui.text(s.area || '', 32, y + 17, [0.8, 0.84, 0.92, 1]);
        ui.textRight('♥' + s.hearts + '  ◆' + s.rupees + '  ' + s.time, W - 32, y + 17, [0.8, 0.84, 0.92, 1]);
        ui.rect(32, y + 29, W - 64, 3, [0.1, 0.1, 0.14, 1]);
        ui.rect(32, y + 29, Math.round((W - 64) * (s.progress || 0)), 3, [0.9, 0.75, 0.35, 1]);
      } else {
        ui.text('NEW GAME', 82, y + 6, [0.7, 0.9, 0.75, 1]);
        ui.text('Begin at your great-grandfather\'s bedside.', 32, y + 19, [0.6, 0.62, 0.72, 1]);
      }
      if (sel) ui.text('▶', 14, y + 14, [1, 0.9, 0.35, 1]);
    }
    var by = 38 + 3 * 44;
    ui.text(this.fileIndex === 3 ? '▶ BACK' : '  BACK', 30, by + 4,
      this.fileIndex === 3 ? [1, 0.95, 0.6, 1] : [0.7, 0.72, 0.8, 1]);
    ui.textCentered('A / Enter to choose', W / 2, H - 14, [0.55, 0.58, 0.7, 1]);
  };

  Game.prototype.drawGameOver = function (ui) {
    var W = this.r.width, H = this.r.height;
    ui.wash([0.06, 0.0, 0.02, 0.78]);
    ui.textCentered('YOU HAVE FALLEN', W / 2, 70, [0.95, 0.35, 0.35, 1]);
    var opts = ['Continue', 'Return to Title'];
    for (var i = 0; i < opts.length; i++) {
      var sel = i === this.goIndex;
      ui.textCentered((sel ? '▶ ' : '  ') + opts[i], W / 2, 116 + i * 16,
        sel ? [1, 0.95, 0.6, 1] : [0.7, 0.72, 0.8, 1]);
    }
    var cur = this.quest.current();
    if (cur) ui.textCentered(cur.goal, W / 2, H - 34, [0.6, 0.62, 0.74, 1]);
  };

  Game.prototype.updateGameOver = function (dt) {
    var input = this.input;
    if (input.pressed('down') || input.pressed('up')) { this.goIndex = 1 - this.goIndex; this.audio.sfx('menu_move'); }
    if (input.pressed('a') || input.pressed('start')) {
      this.audio.sfx('menu_ok');
      if (this.goIndex === 0) this.continueGame();
      else { this.state = 'title'; this.loadTitleScene(); this.audio.playSong(LZ.Music.title); }
    }
  };

  /* ---------------- main loop ---------------- */
  Game.prototype.step = function (dt) {
    this.time += dt;
    this.input.poll(dt);

    /* global fade */
    if (Math.abs(this.r.fade[3] - this.fadeTarget) > 0.001) {
      this.r.fade[3] = M.approach(this.r.fade[3], this.fadeTarget, this.fadeSpeed * dt);
    }

    if (this.state === 'title') { this.updateTitle(dt); return; }
    if (this.state === 'file') { this.updateFileSelect(dt); return; }
    if (this.state === 'gameover') { this.updateGameOver(dt); this.world.update(dt * 0.2, this); return; }

    if (this.pendingArea) this._doAreaChange();

    /* hit stop: freeze everything but the camera for a couple of frames */
    if (this.hitStopT > 0) {
      this.hitStopT -= dt;
      this.cam.update(dt, this.player, null, this.world);
      this.effects.update(dt);
      return;
    }

    this.inv.playTime += dt;
    this.dialogue.update(dt);
    this.menu.update(dt);
    this.hud.update(dt);
    this.cutscene.update(dt);

    if (!this.menu.open && !this.cutscene.active) {
      if (this.input.pressed('start') && !this.dialogue.active) this.menu.toggle();
    }

    var frozen = this.menu.open;
    if (!frozen) {
      this.world.update(dt, this);
      this.particles.update(dt, this.world);
      this.effects.update(dt);
      if (this.player && this.player.state !== 'dead') this.recordRewind(dt);
      /* world transitions */
      if (this.world.pendingTransition) {
        var t = this.world.pendingTransition;
        this.world.pendingTransition = null;
        var g = this;
        this.cutscene.play([
          { fade: 'out', dur: 0.45 },
          { goTo: t.to, entry: t.entry || 'default' },
          { fade: 'in', dur: 0.45 }
        ]);
        this.audio.sfx('door');
      }
    }

    var camInput = (this.dialogue.active || this.cutscene.active || this.menu.open) ? null : this.input;
    this.cam.update(dt, this.player, camInput, this.world);

    /* fall out of the world */
    if (this.player && this.player.pos[1] < -18 && this.player.state !== 'dead') {
      this.player.pos[0] = this.player.lastSafe[0];
      this.player.pos[1] = this.player.lastSafe[1] + 0.6;
      this.player.pos[2] = this.player.lastSafe[2];
      this.player.vel[1] = 0;
      this.player.damage(1, null, { knockback: 0 });
      this.hud.toast('You climb back up, bruised.');
    }
  };

  Game.prototype.render = function () {
    var r = this.r, ui = this.ui;
    this.assets.beginFrame();
    var clear = this.world.fog ? this.world.fog.color : [0, 0, 0];
    r.beginFrame(clear);

    if (this.world.area) {
      this.world.draw(this);
      this.particles.render(r);
      this.effects.draw(this);
    }
    r.flush();

    ui.begin();
    if (this.state === 'title') this.drawTitle(ui);
    else if (this.state === 'file') this.drawFileSelect(ui);
    else {
      this.hud.draw(ui);
      this.dialogue.draw(ui);
      this.menu.draw(ui);
      if (this.state === 'gameover') this.drawGameOver(ui);
      if (this.showDebug) this.drawDebug(ui);
    }
    ui.end();

    r.present();
    this.frame++;
  };

  Game.prototype.drawDebug = function (ui) {
    var r = this.r;
    var lines = [
      'fps ' + this.fps.toFixed(0) + '  draws ' + r.drawCalls + '  tris ' + (r.tris | 0),
      'actors ' + this.world.actors.length + '  world tris ' + this.world.tris,
      'pos ' + this.player.pos[0].toFixed(1) + ',' + this.player.pos[1].toFixed(1) + ',' + this.player.pos[2].toFixed(1),
      'state ' + this.player.state + '  area ' + (this.world.area ? this.world.area.id : '-') + ' (' + this.world.era + ')'
    ];
    for (var i = 0; i < lines.length; i++) {
      ui.text(lines[i], 4, 4 + i * 9, [0.4, 1, 0.5, 1]);
    }
  };

  /* ---------------------------------------------------------------- */
  /* boot                                                              */
  /* ---------------------------------------------------------------- */
  function start() {
    var canvas = document.getElementById('screen');
    var boot = document.getElementById('boot');
    var msg = document.getElementById('bootmsg');
    var btn = document.getElementById('bootbtn');
    var errBox = document.getElementById('err');

    function fail(e) {
      console.error(e);
      errBox.style.display = 'block';
      errBox.textContent = 'The cartridge did not boot.\n\n' + (e && e.stack ? e.stack : e);
    }

    var game;
    try {
      game = new Game(canvas);
      window.GAME = game;
    } catch (e) { fail(e); return; }

    /* build assets across a few frames so the page can paint progress */
    var steps = ['font', 'terrain', 'architecture', 'foliage', 'creatures', 'effects', 'materials'];
    var built = 0;
    function progress(label) {
      built++;
      if (msg) msg.textContent = 'Generating ' + label + '…';
    }

    setTimeout(function () {
      try {
        game.boot(progress);
      } catch (e) { fail(e); return; }
      msg.textContent = 'Ready.';
      btn.style.display = 'inline-block';
      btn.focus();

      function go() {
        boot.style.display = 'none';
        game.audio.init();
        game.audio.resume();
        game.audio.playSong(LZ.Music.title);
        canvas.focus();
        loop();
      }
      btn.addEventListener('click', go);
      window.addEventListener('keydown', function once(e) {
        if (boot.style.display === 'none') return;
        if (e.code === 'Enter' || e.code === 'Space') { window.removeEventListener('keydown', once); go(); }
      });

      var last = performance.now();
      var acc = 0;
      var STEP = 1 / 60;
      function loop() {
        requestAnimationFrame(loop);
        var now = performance.now();
        var dt = Math.min(0.25, (now - last) / 1000);
        last = now;
        game._fpsAcc += dt; game._fpsCount++;
        if (game._fpsAcc > 0.5) { game.fps = game._fpsCount / game._fpsAcc; game._fpsAcc = 0; game._fpsCount = 0; }
        acc += dt;
        var steps2 = 0;
        while (acc >= STEP && steps2 < 5) {
          try { game.step(STEP); } catch (e) { fail(e); return; }
          acc -= STEP; steps2++;
        }
        if (acc > STEP * 5) acc = 0;
        try { game.render(); } catch (e) { fail(e); return; }
      }
    }, 30);
  }

  LZ.Game = Game;
  LZ.Cutscene = Cutscene;
  LZ.start = start;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(LZ);
