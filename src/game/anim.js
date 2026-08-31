/* =============================================================
   game/anim.js -- rigid-limb skeletons and keyframe animation.

   N64 characters were not smoothly skinned; they were hierarchies of
   solid limb pieces posed by a display-list matrix stack. That is
   exactly what happens here: one small mesh per bone, one matrix per
   bone, linear interpolation between hand-authored key poses.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var M = LZ.M, M4 = LZ.M4, V3 = LZ.V3;
  var D = Math.PI / 180;

  /* ---------------- skeleton ---------------- */
  /* def = [{name, parent, offset:[x,y,z], build(mb, ctx), mat}] */
  function Skeleton(def) {
    this.bones = [];
    this.index = {};
    for (var i = 0; i < def.length; i++) {
      var b = def[i];
      var bone = {
        name: b.name,
        parent: b.parent === undefined || b.parent === null ? -1 : this.index[b.parent],
        offset: b.offset || [0, 0, 0],
        rest: b.rest || [0, 0, 0],
        build: b.build || null,
        matName: b.mat || 'white',
        hide: !!b.hide,
        mesh: null,
        world: M4.create(),
        local: M4.create()
      };
      if (b.parent !== undefined && b.parent !== null && this.index[b.parent] === undefined) {
        throw new Error('bone "' + b.name + '" references unknown parent "' + b.parent + '"');
      }
      this.index[b.name] = this.bones.length;
      this.bones.push(bone);
    }
  }
  Skeleton.prototype.boneId = function (n) { return this.index[n]; };

  /* ---------------- clips ---------------- */
  /* tracks: { boneName: { r: [[t, xDeg, yDeg, zDeg], ...], t: [[t, x, y, z], ...] } } */
  function Clip(name, duration, loop, tracks, opts) {
    this.name = name;
    this.duration = duration;
    this.loop = loop !== false;
    this.tracks = tracks || {};
    opts = opts || {};
    this.events = opts.events || [];
    this.root = opts.root || null;   /* root motion, same key format as t */
    this.ease = opts.ease || null;
  }

  function sampleTrack(keys, time, scale) {
    if (!keys || !keys.length) return null;
    var n = keys.length;
    if (time <= keys[0][0]) return [keys[0][1] * scale, keys[0][2] * scale, keys[0][3] * scale];
    if (time >= keys[n - 1][0]) return [keys[n - 1][1] * scale, keys[n - 1][2] * scale, keys[n - 1][3] * scale];
    for (var i = 0; i < n - 1; i++) {
      var a = keys[i], b = keys[i + 1];
      if (time >= a[0] && time <= b[0]) {
        var span = (b[0] - a[0]) || 1e-6;
        var u = (time - a[0]) / span;
        u = u * u * (3 - 2 * u); /* smoothstep between keys reads much better than linear */
        return [
          (a[1] + (b[1] - a[1]) * u) * scale,
          (a[2] + (b[2] - a[2]) * u) * scale,
          (a[3] + (b[3] - a[3]) * u) * scale
        ];
      }
    }
    return [keys[0][1] * scale, keys[0][2] * scale, keys[0][3] * scale];
  }
  function sampleTrackLinear(keys, time) {
    if (!keys || !keys.length) return null;
    var n = keys.length;
    if (time <= keys[0][0]) return [keys[0][1], keys[0][2], keys[0][3]];
    if (time >= keys[n - 1][0]) return [keys[n - 1][1], keys[n - 1][2], keys[n - 1][3]];
    for (var i = 0; i < n - 1; i++) {
      var a = keys[i], b = keys[i + 1];
      if (time >= a[0] && time <= b[0]) {
        var u = (time - a[0]) / ((b[0] - a[0]) || 1e-6);
        return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u];
      }
    }
    return [0, 0, 0];
  }

  /* ---------------- animator ---------------- */
  function Animator(skeleton, clips) {
    this.skel = skeleton;
    this.clips = clips || {};
    var n = skeleton.bones.length;
    this.pose = new Float32Array(n * 6);
    this.blendFrom = new Float32Array(n * 6);
    this.clip = null;
    this.time = 0;
    this.speed = 1;
    this.blend = 0;
    this.blendTime = 0;
    this.finished = false;
    this.onEvent = null;
    this.onEnd = null;
    this._lastT = 0;
    this.rootMotion = [0, 0, 0];
  }

  Animator.prototype.play = function (name, o) {
    o = o || {};
    var c = this.clips[name];
    if (!c) return false;
    if (this.clip === c && !o.restart) {
      if (o.speed !== undefined) this.speed = o.speed;
      return true;
    }
    this.blendFrom.set(this.pose);
    this.blendTime = (o.blend === undefined ? 0.12 : o.blend);
    this.blend = this.blendTime > 0 ? 0 : 1;
    this.clip = c;
    this.time = o.time || 0;
    this._lastT = this.time;
    this.speed = o.speed === undefined ? 1 : o.speed;
    this.finished = false;
    this.onEnd = o.onEnd || null;
    return true;
  };

  Animator.prototype.current = function () { return this.clip ? this.clip.name : null; };
  Animator.prototype.normalizedTime = function () {
    return this.clip ? M.saturate(this.time / this.clip.duration) : 0;
  };

  Animator.prototype.update = function (dt) {
    var c = this.clip;
    if (!c) return;
    var prev = this.time;
    this.time += dt * this.speed;
    if (this.time >= c.duration) {
      if (c.loop) {
        this.time = this.time % c.duration;
      } else {
        this.time = c.duration;
        if (!this.finished) {
          this.finished = true;
          if (this.onEnd) { var f = this.onEnd; this.onEnd = null; f(); }
        }
      }
    }
    /* events */
    if (c.events.length && this.onEvent) {
      var t0 = prev, t1 = this.time;
      for (var i = 0; i < c.events.length; i++) {
        var e = c.events[i];
        var crossed = (t1 >= t0) ? (e.t > t0 && e.t <= t1) : (e.t > t0 || e.t <= t1);
        if (crossed) this.onEvent(e.name, e);
      }
    }

    if (this.blendTime > 0 && this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt / this.blendTime);
    }

    var bones = this.skel.bones;
    var w = this.blendTime > 0 ? M.ease.outQuad(this.blend) : 1;
    for (var b = 0; b < bones.length; b++) {
      var tr = c.tracks[bones[b].name];
      var o = b * 6;
      var r = tr && tr.r ? sampleTrack(tr.r, this.time, D) : null;
      var tt = tr && tr.t ? sampleTrack(tr.t, this.time, 1) : null;
      var rx = r ? r[0] : 0, ry = r ? r[1] : 0, rz = r ? r[2] : 0;
      var tx = tt ? tt[0] : 0, ty = tt ? tt[1] : 0, tz = tt ? tt[2] : 0;
      if (w < 1) {
        rx = M.lerp(this.blendFrom[o], rx, w);
        ry = M.lerp(this.blendFrom[o + 1], ry, w);
        rz = M.lerp(this.blendFrom[o + 2], rz, w);
        tx = M.lerp(this.blendFrom[o + 3], tx, w);
        ty = M.lerp(this.blendFrom[o + 4], ty, w);
        tz = M.lerp(this.blendFrom[o + 5], tz, w);
      }
      this.pose[o] = rx; this.pose[o + 1] = ry; this.pose[o + 2] = rz;
      this.pose[o + 3] = tx; this.pose[o + 4] = ty; this.pose[o + 5] = tz;
    }
    if (c.root) {
      var rm = sampleTrackLinear(c.root, this.time);
      this.rootMotion[0] = rm[0]; this.rootMotion[1] = rm[1]; this.rootMotion[2] = rm[2];
    } else {
      this.rootMotion[0] = this.rootMotion[1] = this.rootMotion[2] = 0;
    }
  };

  /* additive override applied after update(), e.g. head look-at */
  Animator.prototype.addBone = function (name, rx, ry, rz) {
    var i = this.skel.index[name];
    if (i === undefined) return;
    this.pose[i * 6] += rx * D; this.pose[i * 6 + 1] += ry * D; this.pose[i * 6 + 2] += rz * D;
  };
  Animator.prototype.setBone = function (name, rx, ry, rz) {
    var i = this.skel.index[name];
    if (i === undefined) return;
    this.pose[i * 6] = rx * D; this.pose[i * 6 + 1] = ry * D; this.pose[i * 6 + 2] = rz * D;
  };

  /* compute world matrices for the whole rig */
  var _tmp = M4.create();
  Animator.prototype.computeMatrices = function (rootMatrix) {
    var bones = this.skel.bones;
    for (var i = 0; i < bones.length; i++) {
      var b = bones[i], o = i * 6;
      M4.compose(b.local,
        b.offset[0] + this.pose[o + 3],
        b.offset[1] + this.pose[o + 4],
        b.offset[2] + this.pose[o + 5],
        b.rest[0] * D + this.pose[o],
        b.rest[1] * D + this.pose[o + 1],
        b.rest[2] * D + this.pose[o + 2],
        1, 1, 1);
      if (b.parent < 0) M4.multiply(b.world, rootMatrix, b.local);
      else M4.multiply(b.world, bones[b.parent].world, b.local);
    }
  };

  /* ---------------- authoring helpers ---------------- */
  function clip(name, duration, loop, tracks, opts) { return new Clip(name, duration, loop, tracks, opts); }

  /* mirrors a track's Y and Z rotation, used to build left/right pairs */
  function mirror(keys) {
    var out = [];
    for (var i = 0; i < keys.length; i++) out.push([keys[i][0], keys[i][1], -keys[i][2], -keys[i][3]]);
    return out;
  }
  function offsetPhase(keys, phase) {
    /* shift a looping track in time by `phase` (0..1 of its own duration) */
    var last = keys[keys.length - 1][0];
    var out = [];
    for (var i = 0; i < keys.length; i++) {
      var t = keys[i][0] / last + phase;
      t = t - Math.floor(t);
      out.push([t * last, keys[i][1], keys[i][2], keys[i][3]]);
    }
    out.sort(function (a, b) { return a[0] - b[0]; });
    /* re-close the loop */
    if (out[0][0] > 0) out.unshift([0, out[out.length - 1][1], out[out.length - 1][2], out[out.length - 1][3]]);
    if (out[out.length - 1][0] < last) out.push([last, out[0][1], out[0][2], out[0][3]]);
    return out;
  }

  LZ.Anim = {
    Skeleton: Skeleton, Clip: Clip, Animator: Animator,
    clip: clip, mirror: mirror, offsetPhase: offsetPhase, DEG: D
  };
})(LZ);
