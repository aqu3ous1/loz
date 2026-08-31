/* =============================================================
   game/projectiles.js -- arrows, bombs, hookshot, boomerang, and the
   generic enemy shot (which the shield can deflect and the mirror
   shield can send back).
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var M = LZ.M, V3 = LZ.V3, M4 = LZ.M4;

  /* ---------------------------------------------------------------- */
  function Projectile(game, o) {
    LZ.Actor.call(this, { kind: 'projectile', x: o.x, y: o.y, z: o.z, radius: 0.16, height: 0.3 });
    this.game = game;
    this.dir = V3.clone(o.dir);
    V3.normalize(this.dir, this.dir);
    this.speed = o.speed || 10;
    this.damage = o.damage === undefined ? 1 : o.damage;
    this.owner = o.owner || null;
    this.projKind = o.kind || 'rock';
    this.life = o.life || 3;
    this.age = 0;
    this.gravityAmt = o.gravity || 0;
    this.deflectable = !!o.deflect;
    this.reflectable = !!o.reflect;
    this.homing = o.homing || 0;
    this.castShadow = false;
    this.hitPlayer = o.hitPlayer !== false;
    this.hitEnemy = !!o.hitEnemy;
    this.element = o.element || null;
    this.mesh = game.meshes.projectile(this.projKind);
    this.matName = ({
      rock: 'rock', seed: 'leavesDark', arrow: 'planksPale', fireball: 'lava',
      water: 'water', darkorb: 'evil', darkbeam: 'evil', soulflame: 'evil',
      beam: 'gemRed', ice: 'gemBlue'
    })[this.projKind] || 'metal';
    this.glow = ['fireball', 'darkorb', 'darkbeam', 'soulflame', 'beam', 'ice'].indexOf(this.projKind) >= 0;
    this.spin = Math.random() * 6;
    this.reflected = false;
    this.cullDist = 999;
    this.alwaysUpdate = true;
  }
  Projectile.prototype = Object.create(LZ.Actor.prototype);
  Projectile.prototype.constructor = Projectile;

  Projectile.prototype.update = function (dt, g) {
    this.age += dt;
    if (this.age > this.life) { this.pop(g, false); return; }
    if (this.gravityAmt) this.dir[1] -= this.gravityAmt * dt / this.speed;
    if (this.homing && !this.reflected) {
      var tp = g.player.pos;
      var hx = tp[0] - this.pos[0], hy = (tp[1] + 0.8) - this.pos[1], hz = tp[2] - this.pos[2];
      var hl = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1;
      this.dir[0] = M.lerp(this.dir[0], hx / hl, this.homing * dt);
      this.dir[1] = M.lerp(this.dir[1], hy / hl, this.homing * dt);
      this.dir[2] = M.lerp(this.dir[2], hz / hl, this.homing * dt);
      V3.normalize(this.dir, this.dir);
    }
    var step = this.speed * dt;
    this.pos[0] += this.dir[0] * step;
    this.pos[1] += this.dir[1] * step;
    this.pos[2] += this.dir[2] * step;
    this.spin += dt * 12;

    if (this.glow) g.particles.emit('magic', this.pos[0], this.pos[1], this.pos[2], 1,
      this.projKind === 'fireball' ? [1, 0.6, 0.2, 1] : [0.7, 0.4, 1, 1], 0.1);

    /* terrain and solids */
    var gh = g.world.groundHeight(this.pos[0], this.pos[2]);
    if (this.pos[1] < gh) { this.pop(g, true); return; }
    var b = g.world.col.bounds;
    if (this.pos[0] < b.x0 || this.pos[0] > b.x1 || this.pos[2] < b.z0 || this.pos[2] > b.z1) { this.pop(g, false); return; }
    var solids = g.world.col.query(this.pos[0], this.pos[2], 0.3, []);
    for (var s = 0; s < solids.length; s++) {
      var so = solids[s];
      if (!so.solid) continue;
      if (this.pos[1] > so.top || this.pos[1] < so.bottom) continue;
      var cp = g.world.col.closestXZ(so, this.pos[0], this.pos[2], [0, 0, 0]);
      if (cp[2] < 0.18) { this.pop(g, true, so); return; }
    }

    /* targets */
    var p = g.player;
    var targetsPlayer = this.hitPlayer && !this.reflected;
    if (targetsPlayer && p.state !== 'dead' &&
        V3.distXZ(this.pos, p.pos) < 0.55 && Math.abs(this.pos[1] - (p.pos[1] + 0.7)) < 0.9) {
      /* shield interaction happens before damage */
      var blocked = false;
      if (p.guarding) {
        var ang = Math.abs(M.angleDelta(p.yaw, Math.atan2(this.pos[0] - p.pos[0], this.pos[2] - p.pos[2])));
        if (ang < 1.0) {
          var sd = g.inv.shieldDef();
          if (this.reflectable && sd && sd.reflects) {
            this.reflected = true;
            this.owner = p;
            this.hitPlayer = false;
            this.hitEnemy = true;
            this.dir[0] = -this.dir[0]; this.dir[1] = -this.dir[1]; this.dir[2] = -this.dir[2];
            this.speed *= 1.35;
            this.age = 0;
            g.audio.sfx('guard');
            g.effects.impact(this.pos[0], this.pos[1], this.pos[2], true);
            g.hud.toast('Reflected!');
            return;
          }
          if (this.deflectable) {
            g.audio.sfx('guard');
            g.effects.impact(this.pos[0], this.pos[1], this.pos[2], true);
            g.inv.wearShield(1);
            this.pop(g, false);
            return;
          }
          blocked = true;
        }
      }
      if (!blocked) {
        if (p.damage(this.damage, this, { knockback: 6 })) { this.pop(g, true); return; }
      } else {
        p.damage(this.damage, this, { knockback: 6 });
        this.pop(g, false);
        return;
      }
    }
    if (this.hitEnemy) {
      for (var i = 0; i < g.world.actors.length; i++) {
        var a = g.world.actors[i];
        if (a === this || a === this.owner) continue;
        if (a.team !== 'enemy' && !a.breakable) continue;
        if (!a.alive || a.dead) continue;
        if (V3.distXZ(this.pos, a.pos) > (a.hurtRadius || a.radius) + 0.3) continue;
        if (Math.abs(this.pos[1] - (a.pos[1] + (a.hurtHeight || a.height) * 0.5)) > (a.hurtHeight || a.height) * 0.7 + 0.3) continue;
        a.hurt(this.damage, this, { knockback: 4, source: this.projKind === 'arrow' ? 'arrow' : 'projectile', element: this.element });
        if (a.onReflected && this.reflected) a.onReflected(g);
        g.audio.sfx(a.metal ? 'hit_metal' : 'arrow_hit');
        g.effects.impact(this.pos[0], this.pos[1], this.pos[2], a.metal);
        this.pop(g, false);
        return;
      }
    }
  };

  Projectile.prototype.pop = function (g, impact, solid) {
    this.removeMe = true;
    if (impact) {
      g.effects.impact(this.pos[0], this.pos[1], this.pos[2], false);
      g.audio.sfx('arrow_hit', { minGap: 0.05 });
      /* fire lights torches, ice freezes water */
      if (this.projKind === 'ice') g.freezeAt(this.pos[0], this.pos[1], this.pos[2]);
    }
    if (this.projKind === 'arrow' && solid && solid.tag === 'eyeSwitch' && solid.ref) {
      solid.ref.toggle(g);
    }
  };

  var _pm = M4.create();
  Projectile.prototype.draw = function (g) {
    var yaw = Math.atan2(this.dir[0], this.dir[2]);
    var pitch = Math.asin(M.clamp(-this.dir[1], -1, 1));
    if (this.projKind === 'arrow') {
      M4.compose(_pm, this.pos[0], this.pos[1], this.pos[2], -pitch + Math.PI / 2, yaw, 0, 1, 1, 1);
    } else {
      M4.compose(_pm, this.pos[0], this.pos[1], this.pos[2], this.spin * 0.6, yaw, this.spin, 1, 1, 1);
    }
    var mat = g.assets.frameMat(this.matName, null);
    if (this.glow) { mat.lit = false; mat.prim = [1.3, 1.2, 1.3, 1]; }
    g.r.submit(this.mesh, _pm, mat);
    if (this.glow) {
      g.effects.pointLight(this.pos[0], this.pos[1], this.pos[2],
        this.projKind === 'fireball' ? [1, 0.6, 0.25] : [0.7, 0.35, 1], 1.1);
    }
  };
  Projectile.prototype.drawShadow = function () { };

  /* ---------------------------------------------------------------- */
  function Bomb(game, o) {
    LZ.Actor.call(this, { kind: 'bomb', x: o.x, y: o.y, z: o.z, radius: 0.22, height: 0.4 });
    this.game = game;
    this.fuse = o.fuse || 2.4;
    this.owner = o.owner || null;
    this.mesh = game.meshes.projectile('bomb');
    this.shadowSize = 0.5;
    this.thrown = false;
    this.interactable = true;
    this.interactRange = 1.0;
    this.actionLabel = 'Lift';
    this.alwaysUpdate = true;
    this.cullDist = 999;
    this.tickT = 0;
  }
  Bomb.prototype = Object.create(LZ.Actor.prototype);
  Bomb.prototype.constructor = Bomb;
  Bomb.prototype.act = function (g, player) {
    if (player.carry) return;
    player.carry = this;
    this.hidden = true;
    this.carried = true;
  };
  Bomb.prototype.drawCarried = function (g, player) {
    var bm = player.anim.boneMatrix('head');
    if (!bm) return;
    var m = M4.create(), out = M4.create();
    M4.compose(m, 0, 0.40, 0, 0, 0, 0, 1, 1, 1);
    M4.multiply(out, bm, m);
    g.r.submit(this.mesh, out, g.assets.mat.metal);
  };
  Bomb.prototype.update = function (dt, g) {
    this.fuse -= dt;
    this.tickT += dt;
    if (this.tickT > (this.fuse < 0.8 ? 0.12 : 0.32)) {
      this.tickT = 0;
      g.audio.sfx('bomb_fuse', { minGap: 0.05 });
      var p = this.carried ? g.player.pos : this.pos;
      g.particles.emit('spark', p[0], p[1] + (this.carried ? 1.7 : 0.35), p[2], 2, [1, 0.9, 0.4, 1], 1.2);
    }
    if (this.fuse <= 0) {
      var px = this.carried ? g.player.pos[0] : this.pos[0];
      var py = this.carried ? g.player.pos[1] + 1.4 : this.pos[1];
      var pz = this.carried ? g.player.pos[2] : this.pos[2];
      if (this.carried) g.player.carry = null;
      this.removeMe = true;
      g.explode(px, py, pz, { radius: 3.0, damage: 2, owner: this.owner });
      return;
    }
    if (this.carried) return;
    if (this.thrown) {
      this.vel[1] -= 22 * dt;
      this.pos[0] += this.vel[0] * dt;
      this.pos[1] += this.vel[1] * dt;
      this.pos[2] += this.vel[2] * dt;
      this.vel[0] *= Math.exp(-1.5 * dt); this.vel[2] *= Math.exp(-1.5 * dt);
      var gy = g.world.col.floorAt(this.pos[0], this.pos[2], this.pos[1] + 0.2, 0.2, {}).y;
      if (this.pos[1] <= gy + 0.2) {
        this.pos[1] = gy + 0.2;
        if (Math.abs(this.vel[1]) > 1.5) { this.vel[1] = -this.vel[1] * 0.3; g.audio.sfx('land', { minGap: 0.1 }); }
        else { this.vel[1] = 0; this.thrown = false; }
      }
    } else {
      this.applyGravity(dt, g.world);
    }
  };
  var _bm2 = M4.create();
  Bomb.prototype.draw = function (g) {
    if (this.hidden) return;
    var pulse = this.fuse < 0.8 ? 1 + Math.sin(g.time * 30) * 0.12 : 1;
    M4.compose(_bm2, this.pos[0], this.pos[1], this.pos[2], 0, 0, 0, pulse, pulse, pulse);
    var mat = g.assets.frameMat('metal', null);
    if (this.fuse < 0.8) mat.tint = [1, 0.3, 0.2, 0.3 + Math.sin(g.time * 30) * 0.2];
    g.r.submit(this.mesh, _bm2, mat);
  };

  /* ---------------------------------------------------------------- */
  function Boomerang(game, o) {
    LZ.Actor.call(this, { kind: 'boomerang', x: o.x, y: o.y, z: o.z, radius: 0.2, height: 0.2 });
    this.game = game;
    this.owner = o.owner;
    this.dir = V3.clone(o.dir);
    this.speed = 15;
    this.out = true;
    this.range = 11;
    this.travelled = 0;
    this.spin = 0;
    this.mesh = game.meshes.projectile('boomerang');
    this.castShadow = false;
    this.hitList = [];
    this.carrying = null;
    this.alwaysUpdate = true;
    this.cullDist = 999;
  }
  Boomerang.prototype = Object.create(LZ.Actor.prototype);
  Boomerang.prototype.constructor = Boomerang;
  Boomerang.prototype.update = function (dt, g) {
    this.spin += dt * 22;
    var step = this.speed * dt;
    if (this.out) {
      this.pos[0] += this.dir[0] * step;
      this.pos[1] += this.dir[1] * step * 0.4;
      this.pos[2] += this.dir[2] * step;
      this.travelled += step;
      var solids = g.world.col.query(this.pos[0], this.pos[2], 0.3, []);
      for (var s = 0; s < solids.length; s++) {
        var so = solids[s];
        if (!so.solid) continue;
        if (this.pos[1] > so.top || this.pos[1] < so.bottom) continue;
        if (g.world.col.closestXZ(so, this.pos[0], this.pos[2], [0, 0, 0])[2] < 0.2) { this.out = false; break; }
      }
      if (this.travelled > this.range) this.out = false;
    } else {
      var t = this.owner.pos;
      var dx = t[0] - this.pos[0], dy = (t[1] + 0.9) - this.pos[1], dz = t[2] - this.pos[2];
      var d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      if (d < 0.7) {
        this.removeMe = true;
        g.audio.sfx('click');
        if (this.carrying) {
          this.carrying.pos[0] = t[0]; this.carrying.pos[2] = t[2]; this.carrying.pos[1] = t[1] + 0.5;
          this.carrying.magnet = 1;
          this.carrying.hidden = false;
        }
        return;
      }
      this.pos[0] += dx / d * step; this.pos[1] += dy / d * step; this.pos[2] += dz / d * step;
    }
    g.audio.sfx('swing', { minGap: 0.25 });
    /* stun enemies, cut grass, collect pickups */
    for (var i = 0; i < g.world.actors.length; i++) {
      var a = g.world.actors[i];
      if (a === this || a === this.owner) continue;
      if (V3.dist(this.pos, a.pos) > 0.9) continue;
      if (a.team === 'enemy' && a.alive && this.hitList.indexOf(a) < 0) {
        this.hitList.push(a);
        a.hurt(0.5, this, { knockback: 2, stun: 1.4, source: 'boomerang' });
        a.stun = Math.max(a.stun, 1.6);
        if (a.boomerangHit) a.boomerangHit(g);
        g.audio.sfx('hit');
        g.effects.impact(a.pos[0], a.pos[1] + a.height * 0.5, a.pos[2], false);
        this.out = false;
      } else if (a.breakable && a.kind === 'grass' && this.hitList.indexOf(a) < 0) {
        this.hitList.push(a); a.hurt(1, this, {});
      } else if (a.kind === 'pickup' && !this.carrying) {
        this.carrying = a; a.hidden = true;
      } else if (a.kind === 'switch' && a.style === 'crystal' && this.hitList.indexOf(a) < 0) {
        this.hitList.push(a); a.toggle(g);
      }
    }
    if (this.travelled > this.range * 2.4) this.removeMe = true;
  };
  var _rm = M4.create();
  Boomerang.prototype.draw = function (g) {
    M4.compose(_rm, this.pos[0], this.pos[1], this.pos[2], 0, this.spin, 0, 1, 1, 1);
    g.r.submit(this.mesh, _rm, g.assets.mat.planksPale);
    g.particles.emit('magic', this.pos[0], this.pos[1], this.pos[2], 1, [0.7, 1, 0.8, 0.7], 0.1);
  };
  Boomerang.prototype.drawShadow = function () { };

  /* ---------------------------------------------------------------- */
  function Hookshot(game, o) {
    LZ.Actor.call(this, { kind: 'hookshot', x: o.x, y: o.y, z: o.z, radius: 0.15, height: 0.2 });
    this.game = game;
    this.owner = o.owner;
    this.dir = V3.clone(o.dir);
    this.origin = V3.create(o.x, o.y, o.z);
    this.speed = 26;
    this.maxRange = 13;
    this.travelled = 0;
    this.returning = false;
    this.mesh = game.meshes.projectile('hook');
    this.castShadow = false;
    this.alwaysUpdate = true;
    this.cullDist = 999;
    this.linkMesh = game.linkMesh();
  }
  Hookshot.prototype = Object.create(LZ.Actor.prototype);
  Hookshot.prototype.constructor = Hookshot;
  Hookshot.prototype.update = function (dt, g) {
    var step = this.speed * dt;
    if (!this.returning) {
      this.pos[0] += this.dir[0] * step;
      this.pos[1] += this.dir[1] * step;
      this.pos[2] += this.dir[2] * step;
      this.travelled += step;
      /* hookable actors first */
      for (var i = 0; i < g.world.actors.length; i++) {
        var a = g.world.actors[i];
        if (a === this || a === this.owner) continue;
        if (V3.dist(this.pos, a.pos) > (a.radius + 0.6)) continue;
        if (a.hookPull) { a.hookPull(g); this.returning = true; return; }
        if (a.team === 'enemy' && a.alive) {
          a.hurt(0.5, this, { knockback: 3, stun: 0.7, source: 'hookshot' });
          g.audio.sfx('hit');
          this.returning = true;
          return;
        }
      }
      var solids = g.world.col.query(this.pos[0], this.pos[2], 0.3, []);
      for (var s = 0; s < solids.length; s++) {
        var so = solids[s];
        if (!so.solid) continue;
        if (this.pos[1] > so.top || this.pos[1] < so.bottom) continue;
        if (g.world.col.closestXZ(so, this.pos[0], this.pos[2], [0, 0, 0])[2] < 0.22) {
          if (so.surface === 'wood' || so.hookable || so.tag === 'hook') {
            /* anchor: reel the player in */
            this.owner.hookshot = { anchor: [this.pos[0], Math.min(this.pos[1], so.top - 0.1), this.pos[2]] };
            this.owner.setState('hookTravel');
            g.audio.sfx('hookshot');
            this.removeMe = true;
            return;
          }
          g.audio.sfx('hit_metal');
          this.returning = true;
          return;
        }
      }
      if (this.pos[1] < g.world.groundHeight(this.pos[0], this.pos[2])) this.returning = true;
      if (this.travelled > this.maxRange) this.returning = true;
      g.audio.sfx('chain', { minGap: 0.08 });
    } else {
      var t = this.owner.pos;
      var dx = t[0] - this.pos[0], dy = (t[1] + 1.0) - this.pos[1], dz = t[2] - this.pos[2];
      var d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      if (d < 0.6) { this.removeMe = true; return; }
      this.pos[0] += dx / d * step * 1.6;
      this.pos[1] += dy / d * step * 1.6;
      this.pos[2] += dz / d * step * 1.6;
    }
  };
  var _hm2 = M4.create();
  Hookshot.prototype.draw = function (g) {
    var o = this.owner.pos;
    var dx = this.pos[0] - o[0], dy = this.pos[1] - (o[1] + 1.0), dz = this.pos[2] - o[2];
    var len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001;
    var yaw = Math.atan2(dx, dz);
    var pitch = Math.asin(M.clamp(dy / len, -1, 1));
    M4.compose(_hm2, o[0], o[1] + 1.0, o[2], -pitch, yaw, 0, 1, len, 1);
    g.r.submit(this.linkMesh, _hm2, g.assets.mat.metal);
    M4.compose(_hm2, this.pos[0], this.pos[1], this.pos[2], -pitch + Math.PI / 2, yaw, 0, 1, 1, 1);
    g.r.submit(this.mesh, _hm2, g.assets.mat.metal);
  };
  Hookshot.prototype.drawShadow = function () { };

  LZ.Projectile = Projectile;
  LZ.Bomb = Bomb;
  LZ.Boomerang = Boomerang;
  LZ.HookshotProj = Hookshot;
})(LZ);
