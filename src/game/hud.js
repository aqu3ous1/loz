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

    /* ---- item slots and action prompts, labelled with PC keys ----
       These used to be N64 face buttons: gold C discs, a blue B and a green
       A. Nobody playing this has that pad in their hands, so the prompts
       name the key you actually press. The item slots stay square plates in
       the top right, each with its key cap under it. */
    var slotW = 26, slotPitch = 30;
    var sx0 = W - 10 - slotPitch * 2 - slotW;
    var sy0 = 12;
    var slotKeys = ['1', '2', '3'];
    for (var s = 0; s < 3; s++) {
      var bx = sx0 + s * slotPitch, by = sy0;
      keycapPlate(ui, bx, by, slotW, slotW);
      var id = inv.slots[s];
      if (id) {
        var d = Items.ITEMS[id];
        ui.icon(d.icon, bx + (slotW - 16) / 2, by + 4, 16);
        if (d.ammo) {
          var cnt = String(inv[d.ammo] || 0);
          var cw = ui.measure(cnt) + 4;
          ui.rect(bx + slotW - cw - 1, by + slotW - 10, cw, 9, [0.06, 0.05, 0.04, 0.9]);
          ui.text(cnt, bx + slotW - cw + 1, by + slotW - 8, [1, 0.96, 0.72, 1]);
        }
        if (inv.wornMask === id) ui.frame(bx - 1, by - 1, slotW + 2, slotW + 2, 1, [0.4, 1, 0.6, 1]);
      }
      keycap(ui, Math.round(bx + (slotW - 12) / 2), by + slotW + 2, slotKeys[s]);
    }

    /* ---- action prompts, bottom right: "Attack [J]", "Jump [Space]" ---- */
    var wd0 = inv.weaponDef();
    var bLabel = g.player && g.player.carry ? 'Throw' : (wd0 ? 'Attack' : '—');
    var aLabel = (g.player && g.player.interact) ? (g.player.interact.actionLabel || 'Check')
      : (g.player && g.player.lockTarget && g.input.stickMag() > 0.35 ? 'Dodge'
        : (g.player && g.input.stickMag() > 0.35 ? 'Roll' : 'Jump'));
    prompt(ui, W - 8, H - 58, bLabel, 'J', [0.80, 0.88, 1, 1]);
    prompt(ui, W - 8, H - 42, aLabel, 'Space', [0.82, 1, 0.88, 1]);
    if (g.player && g.player.guarding) prompt(ui, W - 8, H - 26, 'Guard', 'E', [1, 0.92, 0.72, 1]);
    else if (g.player && g.player.lockTarget) prompt(ui, W - 8, H - 26, 'Release', 'Shift', [1, 0.92, 0.72, 1]);

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
    /* Low and stacking upward, each on its own plate. Centred in the middle
       of the screen they sat right over the player and washed out against
       bright ground; down here they read like the game's own captions. */
    for (var t = 0; t < this.toasts.length; t++) {
      var to = this.toasts[t];
      var a = M.saturate(Math.min(to.t * 4, (to.dur - to.t) * 3));
      var tw2 = ui.measure(to.text);
      var ty = H - 30 - (this.toasts.length - 1 - t) * 12;
      ui.alpha = a * 0.82;
      ui.rect(Math.round(W / 2 - tw2 / 2) - 5, ty - 2, tw2 + 10, 11, [0.05, 0.05, 0.08, 1]);
      ui.alpha = a;
      ui.textCentered(to.text, W / 2, ty, [1, 0.98, 0.85, 1]);
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

  /* A key cap: a light face with a dark bevel down two sides, sized to its
     legend. Drawn rather than iconified so any key name fits. */
  function keycap(ui, x, y, label, col) {
    /* Dark plate, pale rim, pale legend. A light cap with dark text is what
       a real keyboard looks like, but at 320x240 through a composite blur
       small dark glyphs on a light field smear into illegibility; every
       other reading on this HUD is light-on-dark for the same reason. */
    var w = Math.max(12, ui.measure(label) + 8);
    ui.rect(x, y, w, 12, [0.07, 0.07, 0.10, 0.94]);
    ui.frame(x, y, w, 12, 1, [0.66, 0.68, 0.78, 1]);
    ui.rect(x + 1, y + 1, w - 2, 1, [0.34, 0.35, 0.42, 1]);
    ui.text(label, x + 4, y + 3, col || [0.90, 0.92, 1, 1]);
    return w;
  }
  /* the recessed plate an item icon sits in */
  function keycapPlate(ui, x, y, w, h) {
    ui.rect(x, y, w, h, [0.08, 0.08, 0.11, 0.88]);
    ui.frame(x, y, w, h, 1, [0.62, 0.64, 0.72, 1]);
    ui.rect(x + 1, y + 1, w - 2, 1, [0.30, 0.31, 0.36, 1]);
  }
  /* "<verb> [key]", right-aligned to rx */
  function prompt(ui, rx, y, label, key, col) {
    var kw = Math.max(12, ui.measure(key) + 8);
    keycap(ui, rx - kw, y, key);
    ui.textRight(label, rx - kw - 5, y + 3, col);
  }

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
