/* =============================================================
   game/menu.js -- the pause menu (equipment, items, quest log,
   map, options, save) plus the title/file-select screens.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var M = LZ.M, Items = LZ.Items;

  var PAGES = ['EQUIP', 'ITEMS', 'QUEST', 'MAP', 'OPTIONS', 'SAVE'];

  function Menu(game) {
    this.g = game;
    this.open = false;
    this.page = 0;
    this.cursor = 0;
    this.col = 0;
    this.repeat = 0;
    this.subMode = null;
    this.optIndex = 0;
    this.saveIndex = 0;
    this.message = null;
    this.messageT = 0;
    this.detail = null;
  }

  Menu.prototype.toggle = function () {
    this.open = !this.open;
    this.g.audio.sfx(this.open ? 'menu_ok' : 'menu_back');
    this.g.input.swallow();
    this.cursor = 0; this.col = 0; this.subMode = null;
    if (this.open && this.g.audio.musicBus) this.g.audio.musicBus.gain.value *= 0.45;
    if (!this.open) this.g.audio.setMusicVolume(this.g.audio.musicVol);
  };

  Menu.prototype._nav = function (dt) {
    var input = this.g.input;
    var dx = 0, dy = 0;
    this.repeat -= dt;
    var sx = input.rawStick[0], sy = input.rawStick[1];
    if (input.pressed('left')) dx = -1; else if (input.pressed('right')) dx = 1;
    if (input.pressed('up')) dy = -1; else if (input.pressed('down')) dy = 1;
    if (this.repeat <= 0) {
      if (sx < -0.6) { dx = -1; this.repeat = 0.18; }
      else if (sx > 0.6) { dx = 1; this.repeat = 0.18; }
      else if (sy > 0.6) { dy = -1; this.repeat = 0.18; }
      else if (sy < -0.6) { dy = 1; this.repeat = 0.18; }
    }
    if (Math.abs(sx) < 0.4 && Math.abs(sy) < 0.4 && !input.pressed('left') && !input.pressed('right')) this.repeat = 0;
    return { dx: dx, dy: dy };
  };

  Menu.prototype.update = function (dt) {
    if (!this.open) return;
    var input = this.g.input;
    if (this.messageT > 0) this.messageT -= dt;

    /* Consume it, or main's own Start check runs later in the same frame,
       sees the press still standing and reopens what we just closed. */
    if (input.pressed('start')) { input.consume('start'); this.toggle(); return; }
    if (input.pressed('l')) { this.page = (this.page - 1 + PAGES.length) % PAGES.length; this.cursor = 0; this.col = 0; this.g.audio.sfx('menu_move'); }
    if (input.pressed('r')) { this.page = (this.page + 1) % PAGES.length; this.cursor = 0; this.col = 0; this.g.audio.sfx('menu_move'); }

    var nav = this._nav(dt);
    var name = PAGES[this.page];
    if (name === 'EQUIP') this._updateEquip(nav);
    else if (name === 'ITEMS') this._updateItems(nav);
    else if (name === 'QUEST') this._updateQuest(nav);
    else if (name === 'MAP') this._updateMap(nav);
    else if (name === 'OPTIONS') this._updateOptions(nav);
    else if (name === 'SAVE') this._updateSave(nav);
  };

  /* ---------------- equipment ---------------- */
  Menu.prototype._updateEquip = function (nav) {
    var inv = this.g.inv, input = this.g.input;
    var lists = [inv.weapons, inv.shields];
    if (nav.dx) { this.col = M.clamp(this.col + nav.dx, 0, 1); this.cursor = 0; this.g.audio.sfx('menu_move'); }
    var list = lists[this.col];
    if (nav.dy && list.length) {
      this.cursor = (this.cursor + nav.dy + list.length) % list.length;
      this.g.audio.sfx('menu_move');
    }
    if (input.pressed('a') && list.length) {
      if (this.col === 0) inv.equippedWeapon = this.cursor;
      else inv.equippedShield = this.cursor;
      this.g.audio.sfx('menu_ok');
    }
    if (input.pressed('b') && list.length) {
      /* drop, so a full inventory is never a dead end */
      var d = Items.ITEMS[list[this.cursor].id];
      var self = this;
      this.g.dialogue.ask('Drop the ' + d.name + '?', ['Keep it', 'Drop it'], function (i) {
        if (i === 1) {
          list.splice(self.cursor, 1);
          if (self.col === 0 && inv.equippedWeapon >= list.length) inv.equippedWeapon = list.length - 1;
          if (self.col === 1 && inv.equippedShield >= list.length) inv.equippedShield = list.length - 1;
          self.cursor = Math.max(0, self.cursor - 1);
          self.g.audio.sfx('menu_back');
        }
      }, { style: 'menu' });
    }
  };

  /* ---------------- items ---------------- */
  Menu.prototype._itemGrid = function () {
    var inv = this.g.inv;
    var out = [];
    for (var id in inv.tools) if (inv.tools[id]) out.push(id);
    for (var mid in inv.masks) if (inv.masks[mid]) out.push(mid);
    for (var b = 0; b < inv.bottles.length; b++) out.push(inv.bottles[b] || 'bottle');
    return out;
  };
  Menu.prototype._updateItems = function (nav) {
    var input = this.g.input;
    var grid = this._itemGrid();
    var cols = 6;
    if (nav.dx) this.cursor = M.clamp(this.cursor + nav.dx, 0, Math.max(0, grid.length - 1));
    if (nav.dy) this.cursor = M.clamp(this.cursor + nav.dy * cols, 0, Math.max(0, grid.length - 1));
    if (nav.dx || nav.dy) this.g.audio.sfx('menu_move');
    if (!grid.length) return;
    var id = grid[this.cursor];
    var d = Items.ITEMS[id];
    /* assign to a C slot */
    if (d && d.slot) {
      var inv = this.g.inv;
      var assign = null;
      if (input.pressed('cLeft')) assign = 0;
      if (input.pressed('cDown')) assign = 1;
      if (input.pressed('cRight')) assign = 2;
      if (assign !== null) {
        var existing = inv.slots.indexOf(id);
        if (existing >= 0) inv.slots[existing] = null;
        inv.slots[assign] = id;
        this.g.audio.sfx('menu_ok');
      }
    }
    if (input.pressed('a') && d) {
      if (d.type === 'consumable') {
        var invp = this.g.inv;
        var bi = invp.bottles.indexOf(id);
        if (bi >= 0) {
          if (d.heal) this.g.player.heal(d.heal);
          if (d.magic) { invp.addMagic(d.magic); this.g.audio.sfx('magic'); }
          invp.bottles[bi] = null;
          this._msg('You drink the ' + d.name + '.');
        }
      } else {
        this._msg(d.name);
      }
    }
  };

  /* ---------------- quest ---------------- */
  Menu.prototype._updateQuest = function (nav) {
    var list = LZ.Quest.SIDE;
    if (nav.dy) { this.cursor = M.clamp(this.cursor + nav.dy, 0, list.length - 1); this.g.audio.sfx('menu_move'); }
  };
  Menu.prototype._updateMap = function () { };

  /* ---------------- options ---------------- */
  Menu.prototype.optionList = function () {
    var g = this.g, r = g.r;
    return [
      { label: 'Music Volume', get: function () { return Math.round(g.audio.musicVol * 10); },
        set: function (v) { g.audio.setMusicVolume(M.clamp(v / 10, 0, 1)); }, min: 0, max: 10 },
      { label: 'Sound Volume', get: function () { return Math.round(g.audio.sfxVol * 10); },
        set: function (v) { g.audio.setSfxVolume(M.clamp(v / 10, 0, 1)); }, min: 0, max: 10 },
      { label: 'Scanlines', get: function () { return Math.round(r.opt.scanline * 10); },
        set: function (v) { r.opt.scanline = M.clamp(v / 10, 0, 1); }, min: 0, max: 10 },
      { label: 'Composite Blur', get: function () { return Math.round(r.opt.bleed * 10); },
        set: function (v) { r.opt.bleed = M.clamp(v / 10, 0, 1); }, min: 0, max: 10 },
      { label: 'CRT Curve', get: function () { return Math.round(r.opt.curvature * 10); },
        set: function (v) { r.opt.curvature = M.clamp(v / 10, 0, 1); }, min: 0, max: 10 },
      { label: 'Vertex Jitter', get: function () { return r.opt.snapSubpixels; },
        set: function (v) { r.opt.snapSubpixels = M.clamp(v, 0, 8); }, min: 0, max: 8,
        fmt: function (v) { return v === 0 ? 'Off' : (v === 1 ? 'Full pixel' : '1/' + v + ' pixel'); } },
      { label: 'Colour Dither', get: function () { return r.opt.dither ? 1 : 0; },
        set: function (v) { r.opt.dither = v > 0; }, min: 0, max: 1, fmt: onoff },
      { label: '3-Point Filter', get: function () { return r.opt.filter3Point ? 1 : 0; },
        set: function (v) { r.opt.filter3Point = v > 0; }, min: 0, max: 1, fmt: onoff },
      { label: 'Distance Fog', get: function () { return r.opt.fogEnabled ? 1 : 0; },
        set: function (v) { r.opt.fogEnabled = v > 0; }, min: 0, max: 1, fmt: onoff },
      { label: 'Resolution', get: function () { return g.resIndex; },
        set: function (v) { g.setResolution(M.clamp(v, 0, 3)); }, min: 0, max: 3,
        fmt: function (v) { return ['320x240', '384x288', '512x384', '640x480'][v]; } },
      { label: 'Hold to Target', get: function () { return g.opt.holdTarget ? 0 : 1; },
        set: function (v) { g.opt.holdTarget = v === 0; }, min: 0, max: 1,
        fmt: function (v) { return v === 0 ? 'Hold' : 'Toggle'; } },
      { label: 'Invert Look Y', get: function () { return g.cam.invertY ? 1 : 0; },
        set: function (v) { g.cam.invertY = v > 0; }, min: 0, max: 1, fmt: onoff },
      { label: 'Camera Speed', get: function () { return Math.round(g.cam.sensitivity * 10) / 10 * 10 / 10; },
        set: function (v) { g.cam.sensitivity = M.clamp(v, 1, 6); }, min: 1, max: 6,
        fmt: function (v) { return String(v); } }
    ];
  };
  function onoff(v) { return v ? 'On' : 'Off'; }

  Menu.prototype._updateOptions = function (nav) {
    var opts = this.optionList();
    if (nav.dy) { this.cursor = M.clamp(this.cursor + nav.dy, 0, opts.length - 1); this.g.audio.sfx('menu_move'); }
    if (nav.dx) {
      var o = opts[this.cursor];
      o.set(M.clamp(o.get() + nav.dx, o.min, o.max));
      this.g.audio.sfx('menu_move');
    }
  };

  /* ---------------- save ---------------- */
  Menu.prototype._updateSave = function (nav) {
    var input = this.g.input;
    if (nav.dy) { this.cursor = M.clamp(this.cursor + nav.dy, 0, 2); this.g.audio.sfx('menu_move'); }
    if (input.pressed('a')) {
      if (this.g.saveTo(this.cursor)) this._msg('Saved to File ' + (this.cursor + 1) + '.');
      else this._msg('Could not save. Storage is blocked.');
      this.g.audio.sfx('secret');
    }
  };

  Menu.prototype._msg = function (t) { this.message = t; this.messageT = 2.2; };

  /* ---------------- draw ---------------- */
  Menu.prototype.draw = function (ui) {
    if (!this.open) return;
    var g = this.g, W = g.r.width, H = g.r.height, inv = g.inv;
    ui.wash([0.02, 0.02, 0.05, 0.72]);
    ui.panel(8, 6, W - 16, H - 12, 'menu');

    /* tabs */
    var tabW = Math.floor((W - 24) / PAGES.length);
    for (var i = 0; i < PAGES.length; i++) {
      var tx = 12 + i * tabW;
      var on = i === this.page;
      if (on) ui.rect(tx, 10, tabW - 2, 12, [0.30, 0.26, 0.14, 1]);
      ui.textCentered(PAGES[i], tx + tabW / 2 - 1, 13, on ? [1, 0.95, 0.6, 1] : [0.6, 0.6, 0.66, 1], { scale: 1 });
    }
    ui.rect(12, 23, W - 24, 1, [0.85, 0.75, 0.4, 0.8]);
    ui.text('L', 12, 13, [0.7, 0.72, 0.8, 1]);
    ui.textRight('R', W - 12, 13, [0.7, 0.72, 0.8, 1]);

    var name = PAGES[this.page];
    if (name === 'EQUIP') this._drawEquip(ui);
    else if (name === 'ITEMS') this._drawItems(ui);
    else if (name === 'QUEST') this._drawQuest(ui);
    else if (name === 'MAP') this._drawMap(ui);
    else if (name === 'OPTIONS') this._drawOptions(ui);
    else if (name === 'SAVE') this._drawSave(ui);

    if (this.messageT > 0) {
      ui.rect(20, H - 32, W - 40, 13, [0.06, 0.07, 0.12, 0.94]);
      ui.frame(20, H - 32, W - 40, 13, 1, [0.8, 0.8, 0.9, 1]);
      ui.textCentered(this.message, W / 2, H - 28, [1, 1, 0.85, 1]);
    }
  };

  Menu.prototype._drawEquip = function (ui) {
    var g = this.g, inv = g.inv, W = g.r.width;
    var titles = ['WEAPONS', 'SHIELDS'];
    var lists = [inv.weapons, inv.shields];
    var eq = [inv.equippedWeapon, inv.equippedShield];
    for (var c = 0; c < 2; c++) {
      var x = 16 + c * ((W - 32) / 2);
      var w = (W - 40) / 2;
      ui.text(titles[c], x, 30, [0.95, 0.85, 0.5, 1]);
      var list = lists[c];
      if (!list.length) ui.text('(empty)', x + 4, 44, [0.5, 0.5, 0.56, 1]);
      for (var i = 0; i < list.length; i++) {
        var d = Items.ITEMS[list[i].id];
        var y = 42 + i * 20;
        var sel = (this.col === c && this.cursor === i);
        if (sel) ui.rect(x - 2, y - 2, w + 2, 19, [0.30, 0.26, 0.14, 1]);
        ui.icon(d.icon, x, y, 16);
        ui.text(d.name, x + 19, y + 1, sel ? [1, 1, 0.8, 1] : [0.82, 0.84, 0.9, 1]);
        var dur = list[i].dur;
        if (d.unbreakable || dur === Infinity) {
          ui.text('unbreakable', x + 19, y + 10, [0.5, 0.75, 1, 1]);
        } else {
          var frac = M.saturate(dur / d.dur);
          ui.rect(x + 19, y + 11, 60, 3, [0.1, 0.1, 0.12, 1]);
          ui.rect(x + 19, y + 11, Math.round(60 * frac), 3,
            frac > 0.5 ? [0.4, 0.9, 0.4, 1] : (frac > 0.22 ? [1, 0.8, 0.2, 1] : [1, 0.3, 0.25, 1]));
          ui.text(Math.ceil(dur) + '', x + 84, y + 9, [0.7, 0.72, 0.8, 1]);
        }
        if (eq[c] === i) ui.text('E', x + w - 8, y + 5, [0.4, 1, 0.5, 1]);
      }
    }
    var cur = lists[this.col][this.cursor];
    if (cur) {
      var dd = Items.ITEMS[cur.id];
      var lines = ui.wrap(dd.desc, W - 44, 1);
      for (var l = 0; l < lines.length && l < 3; l++) {
        ui.text(lines[l], 18, this.g.r.height - 52 + l * 9, [0.74, 0.78, 0.88, 1]);
      }
      if (dd.atk) ui.text('Attack ' + dd.atk, 18, this.g.r.height - 24, [1, 0.8, 0.6, 1]);
      if (dd.guard) ui.text('Guard ' + dd.guard, 18, this.g.r.height - 24, [0.7, 0.85, 1, 1]);
    }
    ui.textRight('A equip   B drop', W - 16, this.g.r.height - 22, [0.6, 0.62, 0.7, 1]);
  };

  Menu.prototype._drawItems = function (ui) {
    var g = this.g, inv = g.inv, W = g.r.width, H = g.r.height;
    var grid = this._itemGrid();
    var cols = 6, cell = 26;
    var ox = 20, oy = 32;
    for (var i = 0; i < grid.length; i++) {
      var cx = ox + (i % cols) * cell, cy = oy + Math.floor(i / cols) * cell;
      var d = Items.ITEMS[grid[i]];
      var sel = i === this.cursor;
      ui.rect(cx, cy, 22, 22, sel ? [0.32, 0.28, 0.15, 1] : [0.10, 0.10, 0.13, 0.8]);
      ui.frame(cx, cy, 22, 22, 1, sel ? [1, 0.9, 0.5, 1] : [0.4, 0.4, 0.46, 1]);
      if (d) ui.icon(d.icon, cx + 3, cy + 3, 16);
      var slotIdx = inv.slots.indexOf(grid[i]);
      if (slotIdx >= 0) ui.text(['◀', '▼', '▶'][slotIdx], cx + 15, cy + 14, [1, 0.9, 0.35, 1]);
    }
    if (grid.length) {
      var dd = Items.ITEMS[grid[this.cursor]];
      if (dd) {
        ui.text(dd.name, 20, H - 62, [1, 0.95, 0.7, 1]);
        var lines = ui.wrap(dd.desc, W - 44, 1);
        for (var l = 0; l < lines.length && l < 3; l++) ui.text(lines[l], 20, H - 50 + l * 9, [0.74, 0.78, 0.88, 1]);
      }
    } else {
      ui.text('You are carrying nothing unusual yet.', 20, 40, [0.6, 0.62, 0.7, 1]);
    }
    ui.textRight('C-buttons assign', W - 16, H - 22, [0.6, 0.62, 0.7, 1]);
  };

  Menu.prototype._drawQuest = function (ui) {
    var g = this.g, W = g.r.width, H = g.r.height, inv = g.inv;
    var cur = g.quest.current();
    ui.text('CURRENT', 18, 30, [0.95, 0.85, 0.5, 1]);
    if (cur) {
      ui.text(cur.title, 18, 41, [1, 0.98, 0.8, 1]);
      var lines = ui.wrap(cur.goal, W - 40, 1);
      for (var i = 0; i < lines.length; i++) ui.text(lines[i], 18, 52 + i * 9, [0.8, 0.84, 0.94, 1]);
    } else {
      ui.text('Hyrule is quiet again.', 18, 41, [0.8, 0.9, 0.8, 1]);
    }
    var pct = Math.round(g.quest.progress() * 100);
    ui.rect(18, 74, W - 36, 4, [0.1, 0.1, 0.14, 1]);
    ui.rect(18, 74, Math.round((W - 36) * pct / 100), 4, [0.9, 0.75, 0.35, 1]);
    ui.textRight('Story ' + pct + '%', W - 18, 80, [0.7, 0.72, 0.8, 1]);

    ui.text('SIDE QUESTS', 18, 94, [0.95, 0.85, 0.5, 1]);
    var side = LZ.Quest.SIDE;
    var start = Math.max(0, Math.min(this.cursor - 2, side.length - 5));
    for (var s = start; s < Math.min(side.length, start + 5); s++) {
      var y = 106 + (s - start) * 17;
      var sel = s === this.cursor;
      if (sel) ui.rect(16, y - 2, W - 32, 16, [0.28, 0.24, 0.13, 1]);
      var done = g.quest.sideDone(side[s].id);
      ui.text((done ? '★ ' : '  ') + side[s].title, 20, y, done ? [0.6, 1, 0.7, 1] : [0.88, 0.9, 0.96, 1]);
      if (sel) ui.text(side[s].hint, 20, y + 8, [0.62, 0.66, 0.78, 1]);
    }
    ui.textRight('Hearts ' + inv.maxHearts + '  Pieces ' + inv.heartPieces + '/4',
      W - 18, H - 22, [0.7, 0.72, 0.8, 1]);
  };

  Menu.prototype._drawMap = function (ui) {
    var g = this.g, W = g.r.width, H = g.r.height;
    ui.text(g.world.area ? g.world.area.name : '', 18, 30, [1, 0.95, 0.7, 1]);
    var mx = 24, my = 42, mw = W - 48, mh = H - 86;
    ui.rect(mx, my, mw, mh, [0.06, 0.07, 0.11, 0.92]);
    ui.frame(mx, my, mw, mh, 1, [0.7, 0.7, 0.8, 1]);
    var f = g.world.field;
    if (!f) return;
    /* sample the heightfield into a coarse top-down plate */
    var step = 3;
    for (var py = 0; py < mh; py += step) {
      for (var px = 0; px < mw; px += step) {
        var wx = f.x0 + (px / mw) * f.w;
        var wz = f.z0 + (py / mh) * f.d;
        var h = f.height(wx, wz);
        var t = f.typeAt(wx, wz);
        var pal = [[0.25, 0.42, 0.20], [0.42, 0.34, 0.22], [0.46, 0.46, 0.50], [0.55, 0.48, 0.32], [0.2, 0.34, 0.5]];
        var c = pal[t % pal.length];
        var shade = 0.55 + M.saturate(h / 12) * 0.65;
        ui.rect(mx + px, my + py, step, step, [c[0] * shade, c[1] * shade, c[2] * shade, 1]);
      }
    }
    /* player blip */
    if (g.player) {
      var bx = mx + ((g.player.pos[0] - f.x0) / f.w) * mw;
      var by = my + ((g.player.pos[2] - f.z0) / f.d) * mh;
      var blink = Math.floor(g.time * 4) % 2 === 0;
      ui.rect(Math.round(bx) - 2, Math.round(by) - 2, 4, 4, blink ? [1, 0.9, 0.3, 1] : [1, 0.5, 0.2, 1]);
      /* facing tick */
      ui.rect(Math.round(bx + Math.sin(g.player.yaw) * 5) - 1, Math.round(by + Math.cos(g.player.yaw) * 5) - 1,
        2, 2, [1, 1, 1, 1]);
    }
    for (var t2 = 0; t2 < g.world.transitions.length; t2++) {
      var tr = g.world.transitions[t2];
      var tx = (tr.x !== undefined) ? tr.x : (tr.x0 + tr.x1) / 2;
      var tz = (tr.z !== undefined) ? tr.z : (tr.z0 + tr.z1) / 2;
      var ex = mx + ((tx - f.x0) / f.w) * mw, ez = my + ((tz - f.z0) / f.d) * mh;
      ui.rect(Math.round(ex) - 1, Math.round(ez) - 1, 3, 3, [0.4, 0.9, 1, 0.9]);
    }
    ui.textRight('blue = exits', W - 24, H - 34, [0.6, 0.8, 0.95, 1]);
  };

  Menu.prototype._drawOptions = function (ui) {
    var g = this.g, W = g.r.width, H = g.r.height;
    var opts = this.optionList();
    var start = Math.max(0, Math.min(this.cursor - 4, opts.length - 9));
    for (var i = start; i < Math.min(opts.length, start + 9); i++) {
      var y = 32 + (i - start) * 17;
      var sel = i === this.cursor;
      if (sel) ui.rect(16, y - 2, W - 32, 15, [0.28, 0.24, 0.13, 1]);
      var o = opts[i];
      ui.text(o.label, 22, y + 2, sel ? [1, 0.98, 0.75, 1] : [0.84, 0.86, 0.92, 1]);
      var v = o.get();
      var text = o.fmt ? o.fmt(v) : null;
      if (text) {
        ui.textRight(text, W - 24, y + 2, [0.85, 0.9, 1, 1]);
      } else {
        var bw = 60;
        ui.rect(W - 24 - bw, y + 3, bw, 5, [0.1, 0.1, 0.14, 1]);
        ui.rect(W - 24 - bw, y + 3, Math.round(bw * (v - o.min) / (o.max - o.min || 1)), 5, [0.9, 0.8, 0.4, 1]);
      }
      if (sel) { ui.text('◀', 14, y + 2, [1, 0.9, 0.4, 1]); ui.text('▶', W - 18, y + 2, [1, 0.9, 0.4, 1]); }
    }
    ui.textCentered('These change how the picture is drawn, not how it plays.',
      W / 2, H - 24, [0.55, 0.58, 0.68, 1]);
  };

  Menu.prototype._drawSave = function (ui) {
    var g = this.g, W = g.r.width, H = g.r.height;
    var slots = LZ.Save.slots();
    for (var i = 0; i < 3; i++) {
      var y = 38 + i * 40;
      var sel = i === this.cursor;
      if (sel) ui.rect(20, y - 4, W - 40, 34, [0.28, 0.24, 0.13, 1]);
      ui.frame(20, y - 4, W - 40, 34, 1, sel ? [1, 0.9, 0.5, 1] : [0.42, 0.42, 0.5, 1]);
      var s = LZ.Save.summary(slots[i]);
      ui.text('FILE ' + (i + 1), 27, y + 1, [0.95, 0.88, 0.55, 1]);
      if (s) {
        ui.text(s.name, 70, y + 1, [1, 1, 0.9, 1]);
        ui.text(s.area || '', 27, y + 12, [0.78, 0.82, 0.9, 1]);
        ui.textRight('♥ ' + s.hearts + '   ◆ ' + s.rupees + '   ' + s.time, W - 27, y + 12, [0.8, 0.84, 0.92, 1]);
        ui.rect(27, y + 24, W - 54, 3, [0.1, 0.1, 0.14, 1]);
        ui.rect(27, y + 24, Math.round((W - 54) * (s.progress || 0)), 3, [0.9, 0.75, 0.35, 1]);
      } else {
        ui.text('- empty -', 70, y + 1, [0.55, 0.56, 0.62, 1]);
      }
    }
    ui.textCentered('A to save over the highlighted file', W / 2, H - 24, [0.7, 0.74, 0.84, 1]);
  };

  Menu.PAGES = PAGES;
  LZ.Menu = Menu;
})(LZ);
