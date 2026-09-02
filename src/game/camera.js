/* =============================================================
   game/camera.js -- follow camera, Z-target camera, first person,
   and a cutscene rail. Modelled on the OoT camera: it sits behind and
   above, it is lazy about yaw, and locking on snaps it to the line
   between the player and the target.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var M = LZ.M, V3 = LZ.V3, M4 = LZ.M4;

  function Camera(renderer) {
    this.r = renderer;
    this.pos = V3.create(0, 4, -6);
    this.target = V3.create(0, 1, 0);
    this.up = V3.create(0, 1, 0);
    this.view = M4.create();
    this.proj = M4.create();
    this.fov = 62 * M.DEG;
    /* Depth precision, not clipping, sets these. A 16-bit z-buffer spreads
       its resolution as near*2^16/d^2, so a 0.16 near plane left roughly a
       sixth of a unit of slack forty units out -- enough that window frames,
       door panels and roof trim all fought with the walls behind them and
       the buildings flickered. Pushing the near plane out multiplies the
       precision by the same factor, and nothing the camera can reach sits
       inside half a unit of it. */
    this.near = 0.55;
    this.far = 210;

    this.yaw = 0;
    this.pitch = 0.17;
    this.dist = 5.1;
    this.wantDist = 5.1;
    this.height = 1.05;

    this.mode = 'follow';     /* follow | lock | firstPerson | fixed | cutscene */
    this.lockTarget = null;
    this.shake = 0;
    this.shakeDecay = 3.4;
    this._shakeOff = V3.create(0, 0, 0);
    this.cutT = 0;
    this.cutDur = 1;
    this.cutFrom = { pos: V3.create(0, 0, 0), target: V3.create(0, 0, 0) };
    this.cutTo = { pos: V3.create(0, 0, 0), target: V3.create(0, 0, 0) };
    this.cutEase = M.ease.inOutCubic;
    this.fixed = null;
    this.sensitivity = 2.4;
    this.invertY = false;
    this._smoothPos = V3.create(0, 4, -6);
    this._smoothTarget = V3.create(0, 1, 0);
    this._blocked = 0;
  }

  Camera.prototype.snapBehind = function (actor) {
    this.yaw = actor.yaw + Math.PI;
    this.pitch = 0.17;
    this.dist = this.wantDist;
    this._instant = true;
  };

  Camera.prototype.startCutscene = function (fromPos, fromTarget, toPos, toTarget, dur, ease) {
    V3.copy(this.cutFrom.pos, fromPos || this.pos);
    V3.copy(this.cutFrom.target, fromTarget || this.target);
    V3.copy(this.cutTo.pos, toPos);
    V3.copy(this.cutTo.target, toTarget);
    this.cutDur = dur || 1;
    this.cutT = 0;
    this.cutEase = ease || M.ease.inOutCubic;
    this.mode = 'cutscene';
  };
  Camera.prototype.cutsceneDone = function () { return this.cutT >= this.cutDur; };

  Camera.prototype.addShake = function (amount) {
    this.shake = Math.min(1.6, this.shake + amount);
  };

  var _desired = V3.create(0, 0, 0);
  var _focus = V3.create(0, 0, 0);
  var _dir = V3.create(0, 0, 0);

  Camera.prototype.update = function (dt, player, input, world) {
    var i;
    if (this.mode === 'cutscene') {
      this.cutT = Math.min(this.cutDur, this.cutT + dt);
      var t = this.cutEase(this.cutT / this.cutDur);
      V3.lerp(this.pos, this.cutFrom.pos, this.cutTo.pos, t);
      V3.lerp(this.target, this.cutFrom.target, this.cutTo.target, t);
      V3.copy(this._smoothPos, this.pos);
      V3.copy(this._smoothTarget, this.target);
      this._applyShake(dt);
      this._build();
      return;
    }

    if (!player) { this._build(); return; }

    /* focus point: chest height, drifting up when looking down */
    V3.set(_focus, player.pos[0], player.pos[1] + this.height * (player.scaleY || 1), player.pos[2]);

    if (this.mode === 'firstPerson') {
      if (input) {
        var mv = input.consumeMouse();
        this.yaw -= (input.cstick[0] * this.sensitivity + mv[0] * 0.0035) * (dt * 60 / 60 + 0.985);
        this.pitch += (input.cstick[1] * this.sensitivity * 0.7 + (this.invertY ? mv[1] : -mv[1]) * 0.0030);
        this.pitch = M.clamp(this.pitch, -1.15, 1.15);
      }
      V3.set(this.pos, _focus[0], player.pos[1] + 1.30 * (player.scaleY || 1), _focus[2]);
      var cp = Math.cos(this.pitch);
      V3.set(this.target,
        this.pos[0] + Math.sin(this.yaw) * cp,
        this.pos[1] + Math.sin(this.pitch),
        this.pos[2] + Math.cos(this.yaw) * cp);
      V3.copy(this._smoothPos, this.pos);
      V3.copy(this._smoothTarget, this.target);
      this._applyShake(dt);
      this._build();
      return;
    }

    if (this.mode === 'lock' && this.lockTarget && this.lockTarget.alive !== false) {
      var tp = this.lockTarget.pos;
      var ty = tp[1] + (this.lockTarget.lockHeight || 0.8);
      /* look at a point between player and enemy, camera behind the player
         along that same line */
      var mx = (_focus[0] + tp[0]) * 0.5, mz = (_focus[2] + tp[2]) * 0.5;
      var my = (_focus[1] + ty) * 0.5;
      var ax = _focus[0] - tp[0], az = _focus[2] - tp[2];
      var al = Math.sqrt(ax * ax + az * az) || 1;
      ax /= al; az /= al;
      var sep = M.clamp(al, 2.0, 10);
      var back = 3.0 + sep * 0.42;
      V3.set(_desired, _focus[0] + ax * back, _focus[1] + 1.25 + sep * 0.10, _focus[2] + az * back);
      V3.set(this.target, mx, my + 0.10, mz);
      this.yaw = Math.atan2(-ax, -az);
    } else {
      if (this.mode === 'lock') { this.mode = 'follow'; this.lockTarget = null; }
      /* manual look */
      if (input) {
        var mv2 = input.consumeMouse();
        var turn = input.cstick[0] * this.sensitivity * dt + mv2[0] * 0.0032;
        var tilt = input.cstick[1] * this.sensitivity * 0.55 * dt + (this.invertY ? mv2[1] : -mv2[1]) * 0.0026;
        this.yaw -= turn;
        this.pitch = M.clamp(this.pitch + tilt, -0.42, 1.02);
        /* gentle auto-centre behind the player while running forward */
        if (player.speed > 2.4 && Math.abs(input.cstick[0]) < 0.05 && Math.abs(mv2[0]) < 0.5) {
          this.yaw = M.angleDamp(this.yaw, player.yaw + Math.PI, 0.9, dt);
        }
      }
      var cpitch = Math.cos(this.pitch);
      V3.set(_desired,
        _focus[0] + Math.sin(this.yaw) * this.dist * cpitch,
        _focus[1] + this.height * 0.28 + Math.sin(this.pitch) * this.dist + 0.62,
        _focus[2] + Math.cos(this.yaw) * this.dist * cpitch);
      V3.copy(this.target, _focus);
      this.target[1] += 0.10;
    }

    /* keep the camera out of geometry */
    if (world && world.col) {
      V3.sub(_dir, _desired, _focus);
      var len = V3.len(_dir);
      if (len > 0.01) {
        V3.scale(_dir, _dir, 1 / len);
        var hit = world.col.raycast(_focus, _dir, len + 0.3, function (s) {
          return s.solid && !s.noCameraBlock && s.surface !== 'water';
        });
        if (hit) {
          /* Never closer than this: at one unit the camera sits inside a
             character who is one and a half tall, and you are looking at the
             back of his skull from the inside. */
          var d = Math.max(2.1, hit.t - 0.35);
          V3.addScaled(_desired, _focus, _dir, d);
          this._blocked = 1;
        } else {
          this._blocked = M.approach(this._blocked, 0, dt * 2);
        }
      }
      /* never sink below the ground */
      var gh = world.groundHeight(_desired[0], _desired[2]) + 0.45;
      if (_desired[1] < gh) _desired[1] = gh;
    }

    var lam = this._instant ? 1e6 : (this.mode === 'lock' ? 12 : 7.5);
    this._smoothPos[0] = M.damp(this._smoothPos[0], _desired[0], lam, dt);
    this._smoothPos[1] = M.damp(this._smoothPos[1], _desired[1], lam * 1.25, dt);
    this._smoothPos[2] = M.damp(this._smoothPos[2], _desired[2], lam, dt);
    this._smoothTarget[0] = M.damp(this._smoothTarget[0], this.target[0], lam * 1.5, dt);
    this._smoothTarget[1] = M.damp(this._smoothTarget[1], this.target[1], lam * 1.2, dt);
    this._smoothTarget[2] = M.damp(this._smoothTarget[2], this.target[2], lam * 1.5, dt);
    this._instant = false;

    V3.copy(this.pos, this._smoothPos);
    V3.copy(this.target, this._smoothTarget);
    this._applyShake(dt);
    this._build();
  };

  Camera.prototype._applyShake = function (dt) {
    if (this.shake > 0.0005) {
      var s = this.shake * this.shake * 0.55;
      this._shakeOff[0] = (Math.random() - 0.5) * s;
      this._shakeOff[1] = (Math.random() - 0.5) * s;
      this._shakeOff[2] = (Math.random() - 0.5) * s;
      this.pos[0] += this._shakeOff[0]; this.pos[1] += this._shakeOff[1]; this.pos[2] += this._shakeOff[2];
      this.target[0] += this._shakeOff[0] * 0.4; this.target[1] += this._shakeOff[1] * 0.4;
      this.shake = Math.max(0, this.shake - this.shakeDecay * dt * (0.4 + this.shake));
    }
  };

  Camera.prototype._build = function () {
    var aspect = this.r.width / this.r.height;
    M4.perspective(this.proj, this.fov, aspect, this.near, this.far);
    M4.lookAt(this.view, this.pos, this.target, this.up);
    this.r.setCamera(this.view, this.proj, this.pos);
  };

  /* direction the player should move for a given stick input */
  Camera.prototype.stickToWorld = function (sx, sy, out) {
    var c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    /* Camera forward on the ground plane is (-sin yaw, -cos yaw); its right
       is that turned a quarter turn clockwise, (cos yaw, -sin yaw). Both
       sx terms used to carry the wrong sign, which swapped left and right
       for every camera angle. */
    out[0] = -s * sy + c * sx;
    out[1] = 0;
    out[2] = -c * sy - s * sx;
    return out;
  };

  Camera.prototype.flatYaw = function () { return this.yaw + Math.PI; };

  LZ.Camera = Camera;
})(LZ);
