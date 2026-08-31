/* =============================================================
   game/actor.js -- the base entity, plus the character model that
   binds a rig's bone meshes to an animator instance.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var M = LZ.M, V3 = LZ.V3, M4 = LZ.M4, GL = LZ.GL, A = LZ.Anim;

  /* ---------------------------------------------------------------- */
  /* CharModel: shared geometry for a character type                    */
  /* ---------------------------------------------------------------- */
  function CharModel(renderer, rig, clips) {
    this.rig = rig;
    this.skel = new A.Skeleton(rig.def);
    this.clips = clips;
    this.meshes = [];
    this.mats = [];
    this.tris = 0;
    for (var i = 0; i < this.skel.bones.length; i++) {
      var b = this.skel.bones[i];
      if (!b.build) { this.meshes.push(null); this.mats.push(null); continue; }
      var mb = new GL.MeshBuilder();
      b.build(mb);
      if (!mb.i.length) { this.meshes.push(null); this.mats.push(null); continue; }
      this.tris += mb.i.length / 3;
      this.meshes.push(mb.build(renderer));
      this.mats.push(b.matName);
    }
    this.height = rig.height || 1.5;
    this.radius = rig.radius || 0.3;
  }
  CharModel.prototype.animator = function () { return new A.Animator(this.skel, this.clips); };

  var _mCache = {};
  function charModel(renderer, key, rigFn, clips) {
    if (_mCache[key]) return _mCache[key];
    var rig = rigFn();
    _mCache[key] = new CharModel(renderer, rig, clips);
    return _mCache[key];
  }
  function clearModelCache() { _mCache = {}; }

  /* ---------------------------------------------------------------- */
  /* Actor                                                             */
  /* ---------------------------------------------------------------- */
  var nextId = 1;
  function Actor(o) {
    o = o || {};
    this.id = nextId++;
    this.kind = o.kind || 'actor';
    this.name = o.name || '';
    this.pos = V3.create(o.x || 0, o.y || 0, o.z || 0);
    this.vel = V3.create(0, 0, 0);
    this.yaw = o.yaw || 0;
    this.targetYaw = this.yaw;
    this.turnSpeed = o.turnSpeed || 9;
    this.radius = o.radius || 0.32;
    this.height = o.height || 1.5;
    this.scaleY = 1;
    this.modelScale = o.modelScale || 1;
    this.speed = 0;
    this.grounded = true;
    this.gravity = o.gravity === undefined ? 22 : o.gravity;
    this.groundY = this.pos[1];
    this.alive = true;
    this.team = o.team || 'neutral';
    this.hp = o.hp === undefined ? 1 : o.hp;
    this.maxHp = this.hp;
    this.invuln = 0;
    this.hitFlash = 0;
    this.stun = 0;
    this.knock = V3.create(0, 0, 0);
    this.model = o.model || null;
    this.anim = this.model ? this.model.animator() : null;
    this.shadowSize = o.shadowSize || (this.radius * 3.6);
    this.castShadow = o.castShadow !== false;
    this.lockable = !!o.lockable;
    this.lockHeight = o.lockHeight || this.height * 0.55;
    this.solid = o.solid !== false;
    this.pushable = !!o.pushable;
    this.mass = o.mass || 1;
    this.attackBox = null;
    this.hurtRadius = o.hurtRadius || this.radius * 1.15;
    this.hurtHeight = o.hurtHeight || this.height;
    this.dead = false;
    this.deathTimer = 0;
    this.removeMe = false;
    this.culled = false;
    this.matrix = M4.create();
    this.floatOffset = 0;
    this.waterY = null;
    this.inWater = false;
    this.faceDir = V3.create(0, 0, 1);
    this.data = o.data || {};
    this.homeX = this.pos[0]; this.homeZ = this.pos[2];
    this.tint = [0, 0, 0, 0];
    this.alpha = 1;
    this.frozen = 0;
    this.burning = 0;
  }

  Actor.prototype.setModel = function (model) {
    this.model = model;
    this.anim = model.animator();
    this.height = model.height * this.modelScale;
    return this;
  };

  Actor.prototype.play = function (name, opts) {
    if (this.anim) this.anim.play(name, opts);
  };
  Actor.prototype.animName = function () { return this.anim ? this.anim.current() : null; };

  Actor.prototype.faceTowards = function (x, z, instant) {
    var a = Math.atan2(x - this.pos[0], z - this.pos[2]);
    this.targetYaw = a;
    if (instant) this.yaw = a;
  };

  Actor.prototype.distanceTo = function (other) { return V3.dist(this.pos, other.pos); };
  Actor.prototype.distanceXZ = function (other) { return V3.distXZ(this.pos, other.pos); };

  /* horizontal move with wall sliding and step-up */
  Actor.prototype.moveXZ = function (dx, dz, world) {
    var p = this.pos;
    var startY = p[1];
    p[0] += dx; p[2] += dz;
    if (world && world.col) {
      world.col.resolve(p, this.radius, this.height * this.scaleY, this.collideOpts);
      /* clamp inside the area */
      var b = world.col.bounds;
      p[0] = M.clamp(p[0], b.x0 + this.radius, b.x1 - this.radius);
      p[2] = M.clamp(p[2], b.z0 + this.radius, b.z1 - this.radius);
    }
    p[1] = startY;
  };

  var _floor = {};
  Actor.prototype.applyGravity = function (dt, world) {
    var p = this.pos;
    world.col.floorAt(p[0], p[2], p[1] + 0.02, this.radius, _floor);
    this.groundY = _floor.y;
    this.groundSurface = _floor.surface;
    this.groundSolid = _floor.solid;

    if (this.flying) { this.grounded = false; return; }

    this.vel[1] -= this.gravity * dt;
    p[1] += this.vel[1] * dt;

    /* head bump */
    var ceil = world.col.ceilingAt(p[0], p[2], p[1] + this.height * 0.5, this.radius * 0.8);
    if (this.vel[1] > 0 && p[1] + this.height * this.scaleY > ceil) {
      p[1] = ceil - this.height * this.scaleY;
      this.vel[1] = Math.min(0, this.vel[1]);
    }

    if (p[1] <= this.groundY) {
      var fell = this.vel[1];
      p[1] = this.groundY;
      if (!this.grounded) { this.landedWith = fell; this.justLanded = true; }
      this.vel[1] = 0;
      this.grounded = true;
    } else {
      if (this.grounded) this.leftGround = true;
      this.grounded = false;
      this.justLanded = false;
    }
  };

  Actor.prototype.turnToward = function (dt, target) {
    var t = target === undefined ? this.targetYaw : target;
    this.yaw = M.angleDamp(this.yaw, t, this.turnSpeed, dt);
    this.faceDir[0] = Math.sin(this.yaw);
    this.faceDir[2] = Math.cos(this.yaw);
  };

  Actor.prototype.hurt = function (amount, source, opts) {
    opts = opts || {};
    if (!this.alive || this.invuln > 0 || this.dead) return false;
    if (this.onHurt && this.onHurt(amount, source, opts) === false) return false;
    this.hp -= amount;
    this.hitFlash = 0.34;
    this.invuln = opts.invuln === undefined ? 0.55 : opts.invuln;
    this.stun = Math.max(this.stun, opts.stun === undefined ? 0.32 : opts.stun);
    if (opts.knockback && source) {
      var dx = this.pos[0] - source.pos[0], dz = this.pos[2] - source.pos[2];
      var d = Math.sqrt(dx * dx + dz * dz) || 1;
      this.knock[0] = dx / d * opts.knockback;
      this.knock[2] = dz / d * opts.knockback;
      if (opts.knockUp) this.vel[1] = opts.knockUp;
    }
    if (this.hp <= 0) { this.hp = 0; this.die(source); }
    return true;
  };

  Actor.prototype.die = function (source) {
    if (this.dead) return;
    this.dead = true;
    this.alive = false;
    this.deathTimer = 0;
    if (this.onDie) this.onDie(source);
  };

  Actor.prototype.updateCommon = function (dt, world) {
    if (this.invuln > 0) this.invuln -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.stun > 0) this.stun -= dt;
    if (this.frozen > 0) this.frozen -= dt;
    if (this.burning > 0) this.burning -= dt;
    /* knockback decays fast; it is a nudge, not a launch */
    if (this.knock[0] || this.knock[2]) {
      this.moveXZ(this.knock[0] * dt, this.knock[2] * dt, world);
      var d = Math.exp(-9 * dt);
      this.knock[0] *= d; this.knock[2] *= d;
      if (Math.abs(this.knock[0]) < 0.03) this.knock[0] = 0;
      if (Math.abs(this.knock[2]) < 0.03) this.knock[2] = 0;
    }
    if (world && world.col) {
      var w = world.col.waterAt(this.pos[0], this.pos[2]);
      this.inWater = !!(w && this.pos[1] < w.level - 0.05);
      this.waterY = w ? w.level : null;
      this.waterType = w ? w.type : null;
    }
  };

  /* ---- rendering ---- */
  var _root = M4.create();
  Actor.prototype.rootMatrix = function () {
    var s = this.modelScale;
    M4.compose(_root, this.pos[0], this.pos[1] + this.floatOffset, this.pos[2],
      this.rollX || 0, this.yaw, this.rollZ || 0, s, s * this.scaleY, s);
    M4.copy(this.matrix, _root);
    return this.matrix;
  };

  Actor.prototype.draw = function (game) {
    if (!this.model || !this.anim || this.hidden) return;
    var r = game.r, a = game.assets;
    this.anim.computeMatrices(this.rootMatrix());
    var flash = this.hitFlash > 0 ? Math.min(1, this.hitFlash * 3.2) : 0;
    var tinted = flash > 0.02 || this.tint[3] > 0.001 || this.frozen > 0;
    var alpha = this.alpha;
    var tint = null;
    if (this.frozen > 0) tint = [0.55, 0.78, 1.0, 0.55];
    else if (flash > 0.02) tint = [1, 0.55, 0.5, flash * 0.85];
    else if (this.tint[3] > 0.001) tint = this.tint;

    for (var i = 0; i < this.model.meshes.length; i++) {
      var mesh = this.model.meshes[i];
      if (!mesh) continue;
      var matName = this.model.mats[i];
      var mat;
      if (tinted || alpha < 0.999 || this.matOverride) {
        mat = a.frameMat(this.matOverride || matName, null);
        if (tint) { mat.tint = tint; }
        if (alpha < 0.999) { mat.prim = [1, 1, 1, alpha]; mat.blend = 'alpha'; mat.depthWrite = false; mat.queue = 6; }
      } else {
        mat = a.mat[matName] || a.mat.white;
      }
      r.submit(mesh, this.anim.wView[i], mat);
    }
    if (this.drawExtra) this.drawExtra(game);
  };

  /* blob shadow: one flat quad, exactly what the era used */
  var _shadowM = M4.create();
  Actor.prototype.drawShadow = function (game) {
    if (!this.castShadow || this.hidden) return;
    var world = game.world;
    var gy = world.col.floorAt(this.pos[0], this.pos[2], this.pos[1] + 0.05, this.radius, _floor).y;
    var h = this.pos[1] - gy;
    if (h > 5.5) return;
    var fade = M.saturate(1 - h / 5.5);
    var size = this.shadowSize * this.modelScale * (0.62 + fade * 0.38);
    M4.compose(_shadowM, this.pos[0], gy + 0.035, this.pos[2], 0, this.yaw, 0, size, 1, size);
    var mat = game.assets.frameMat('shadow', null);
    mat.prim = [0, 0, 0, 0.40 * fade * this.alpha];
    game.r.submit(game.quadMesh, _shadowM, mat);
  };

  LZ.Actor = Actor;
  LZ.CharModel = CharModel;
  LZ.charModel = charModel;
  LZ.clearModelCache = clearModelCache;
})(LZ);
