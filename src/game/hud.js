/* =============================================================
   game/hud.js -- hearts, magic, rupees, C-buttons, targeting
   reticle, area titles, toasts. All drawn at 320x240.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var M = LZ.M, V3 = LZ.V3, Items = LZ.Items;

  function HUD(game) {
    this.g = game;
    this.toasts = [];
    this.areaTitle = null;
    this.areaTimer = 0;
    this.damageFlashT = 0;
    this.dodgeT = 0;
    this.lowBeep = 0;
    this.visible = true;
    this.magicPulse = 0;
  }

  HUD.prototype.toast = function (text, dur) {
    this.toasts.push({ text: text, t: 0, dur: dur || 2.4 });
    if (this.toasts.length > 4) this.toasts.shift();
  };
  HUD.prototype.showArea = function (name, sub) {
    this.areaTitle = name; this.areaSub = sub || null; this.areaTimer = 3.4;
  };
  HUD.prototype.damageFlash = function () { this.damageFlashT = 0.35; };
  HUD.prototype.flashDodge = function () { this.dodgeT = 0.35; };

  HUD.prototype.update = function (dt) {
    var i;
    for (i = this.toasts.length - 1; i >= 0; i--) {
      this.toasts[i].t += dt;
      if (this.toasts[i].t > this.toasts[i].dur) this.toasts.splice(i, 1);
    }
    if (this.areaTimer > 0) this.areaTimer -= dt;
    if (this.damageFlashT > 0) this.damageFlashT -= dt;
    if (this.dodgeT > 0) this.dodgeT -= dt;
    if (this.magicPulse > 0) this.magicPulse -= dt;

    var inv = this.g.inv;
    if (inv.hearts <= 1 && inv.hearts > 0 && !this.g.cutscene.active) {
      this.lowBeep -= dt;
      if (this.lowBeep <= 0) { this.lowBeep = 0.72; this.g.audio.sfx('low_health'); }
    }
  };

  HUD.prototype.draw = function (ui) {
    var g = this.g, inv = g.inv, W = g.r.width, H = g.r.height;

    if (this.damageFlashT > 0) {
      ui.wash([0.9, 0.1, 0.1, this.damageFlashT * 0.5]);
    }
    if (this.dodgeT > 0) {
      ui.wash([0.7, 0.9, 1.0, this.dodgeT * 0.22]);
    }
    if (!this.visible) return;

    /* ---- hearts ---- */
    var hx = 8, hy = 7;
    var per = 10;
    for (var i = 0; i < inv.maxHearts; i++) {
      var col = i % per, row = Math.floor(i / per);
      var v = inv.hearts - i;
      var icon = v >= 1 ? 'heart_full' : (v >= 0.5 ? 'heart_half' : 'heart_empty');
      var bob = (v > 0 && inv.hearts <= 3) ? Math.sin(g.time * 6 + i) * 0.7 : 0;
      ui.icon(icon, hx + col * 11, hy + row * 10 + bob, 12);
    }

    /* ---- magic ---- */
    if (inv.maxMagic > 0) {
      var my = hy + Math.ceil(inv.maxHearts / per) * 10 + 2;
      ui.rect(hx, my, 54, 5, [0.05, 0.05, 0.08, 0.9]);
      ui.frame(hx - 1, my - 1, 56, 7, 1, [0.75, 0.72, 0.5, 1]);
      var frac = inv.maxMagic ? inv.magic / inv.maxMagic : 0;
      var pulse = this.magicPulse > 0 ? 0.25 : 0;
      ui.rect(hx + 1, my + 1, Math.max(0, Math.floor(52 * frac)), 3, [0.25 + pulse, 0.95, 0.4, 1]);
    }

    /* ---- rupees ---- */
    ui.icon('rupee', 8, H - 20, 12);
    ui.text(pad(inv.rupees, 3), 21, H - 17, [1, 1, 1, 1]);

    /* ---- keys / dungeon info ---- */
    var dk = g.currentDungeon;
    if (dk) {
      var kx = 8, ky = H - 33;
      if (inv.keyCount(dk) > 0) {
        ui.icon('key', kx, ky, 12);
        ui.text('x' + inv.keyCount(dk), kx + 13, ky + 3, [1, 1, 1, 1]);
      }
    }

    /* ---- C buttons: round, gold, top right, as on the pad ---- */
    var cx = W - 58, cy = 16;
    var cLabels = ['\u25C0', '\u25BC', '\u25B6'];
    var cPos = [[cx, cy + 9], [cx + 17, cy + 17], [cx + 34, cy + 9]];
    for (var s = 0; s < 3; s++) {
      var bx = cPos[s][0], by = cPos[s][1];
      ui.disc(bx, by, 11, [0.10, 0.09, 0.06, 0.85]);
      ui.disc(bx, by, 10, [0.86, 0.72, 0.16, 1]);
      ui.disc(bx, by, 8.4, [0.20, 0.18, 0.12, 0.9]);
      var id = inv.slots[s];
      if (id) {
        var d = Items.ITEMS[id];
        ui.icon(d.icon, bx - 7, by - 7, 14);
        if (d.ammo) {
          ui.textRight(String(inv[d.ammo] || 0), bx + 11, by + 4, [1, 1, 1, 1]);
        }
        if (inv.wornMask === id) ui.discOutline(bx, by, 12, [0.4, 1, 0.6, 1]);
      } else {
        ui.textCentered(cLabels[s], bx, by - 4, [0.62, 0.54, 0.24, 1]);
      }
    }

    /* ---- A and B: labelled round buttons, bottom right ---- */
    var bbx = W - 30, bby = H - 62;
    var wd0 = inv.weaponDef();
    ui.disc(bbx, bby, 11, [0.05, 0.06, 0.12, 0.85]);
    ui.disc(bbx, bby, 10, [0.28, 0.46, 0.92, 1]);
    ui.disc(bbx, bby, 8.4, [0.10, 0.16, 0.34, 0.85]);
    if (wd0) ui.icon(wd0.icon, bbx - 7, bby - 7, 14);
    var bLabel = g.player && g.player.carry ? 'Throw' : (wd0 ? 'Attack' : '\u2014');
    ui.textRight(bLabel, bbx - 14, bby - 4, [0.75, 0.85, 1, 1]);

    var aax = W - 30, aay = H - 36;
    var aLabel = (g.player && g.player.interact) ? (g.player.interact.actionLabel || 'Check')
      : (g.player && g.player.lockTarget && g.input.stickMag() > 0.35 ? 'Dodge'
        : (g.player && g.input.stickMag() > 0.35 ? 'Roll' : 'Jump'));
    ui.disc(aax, aay, 11, [0.04, 0.10, 0.06, 0.85]);
    ui.disc(aax, aay, 10, [0.26, 0.80, 0.42, 1]);
    ui.disc(aax, aay, 8.4, [0.06, 0.24, 0.12, 0.85]);
    ui.textCentered('A', aax, aay - 4, [0.85, 1, 0.9, 1]);
    ui.textRight(aLabel, aax - 14, aay - 4, [0.78, 1, 0.86, 1]);

    /* ---- lock-on reticle ---- */
    if (g.player && g.player.lockTarget) {
      this._drawReticle(ui, g.player.lockTarget);
    }

    /* ---- song input display ---- */
    if (g.player && g.player.songMode) {
      var sw = 92, sx = Math.round(W / 2 - sw / 2), sy = H - 78;
      ui.panel(sx, sy, sw, 26, 'menu');
      ui.text('♪', sx + 5, sy + 9, [0.8, 0.9, 1, 1]);
      var syms = { cLeft: '◀', cDown: '▼', cRight: '▶', cUp: '▲' };
      for (var n = 0; n < g.player.songBuffer.length; n++) {
        ui.text(syms[g.player.songBuffer[n]] || '?', sx + 16 + n * 9, sy + 9, [1, 0.95, 0.6, 1]);
      }
    }

    /* ---- area title ---- */
    if (this.areaTimer > 0) {
      var at = M.saturate(this.areaTimer > 2.9 ? (3.4 - this.areaTimer) / 0.5 : Math.min(1, this.areaTimer / 0.7));
      ui.alpha = at;
      ui.textCentered(this.areaTitle, W / 2, 40, [1, 0.95, 0.72, 1]);
      if (this.areaSub) ui.textCentered(this.areaSub, W / 2, 51, [0.75, 0.78, 0.9, 1]);
      var tw = ui.measure(this.areaTitle);
      ui.rect(W / 2 - tw / 2 - 6, 50, tw + 12, 1, [1, 0.9, 0.6, 0.7]);
      ui.alpha = 1;
    }

    /* ---- toasts ---- */
    for (var t = 0; t < this.toasts.length; t++) {
      var to = this.toasts[t];
      var a = M.saturate(Math.min(to.t * 4, (to.dur - to.t) * 3));
      ui.alpha = a;
      ui.textCentered(to.text, W / 2, 62 + t * 10, [1, 0.98, 0.85, 1]);
      ui.alpha = 1;
    }

    /* ---- boss health bar ---- */
    if (g.bossBar && g.bossBar.actor && g.bossBar.actor.alive) {
      var b = g.bossBar.actor;
      var bw = 180, bx2 = Math.round(W / 2 - bw / 2), by2 = H - 30;
      ui.rect(bx2 - 1, by2 - 1, bw + 2, 8, [0.05, 0.04, 0.06, 0.92]);
      ui.frame(bx2 - 2, by2 - 2, bw + 4, 10, 1, [0.85, 0.75, 0.4, 1]);
      var hf = M.saturate(b.hp / b.maxHp);
      ui.rect(bx2, by2, Math.round(bw * hf), 6, [0.85, 0.15, 0.2, 1]);
      if (g.bossBar.shown < hf) g.bossBar.shown = hf;
      ui.textCentered(g.bossBar.name, W / 2, by2 - 12, [1, 0.9, 0.75, 1]);
    }
  };

  HUD.prototype._drawReticle = function (ui, target) {
    var g = this.g;
    var p = g.project(target.pos[0], target.pos[1] + (target.lockHeight || target.height * 0.6), target.pos[2]);
    if (!p) return;
    var t = g.time * 2.4;
    var r = 9 + Math.sin(t * 3) * 1.2;
    var col = [1, 0.92, 0.35, 0.95];
    for (var i = 0; i < 4; i++) {
      var a = t + i * Math.PI / 2;
      var x = p[0] + Math.cos(a) * r, y = p[1] + Math.sin(a) * r;
      ui.rect(Math.round(x) - 1, Math.round(y) - 1, 3, 3, col);
    }
  };

  function pad(n, w) {
    var s = String(Math.max(0, n | 0));
    while (s.length < w) s = '0' + s;
    return s;
  }

  LZ.HUD = HUD;
})(LZ);
