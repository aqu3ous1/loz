/* =============================================================
   game/dialogue.js -- message boxes, typewriter text, choices.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var M = LZ.M;

  function Dialogue(game) {
    this.g = game;
    this.active = false;
    this.pages = [];
    this.page = 0;
    this.lines = [];
    this.reveal = 0;
    this.speed = 42;          /* characters per second */
    this.speaker = '';
    this.portrait = null;
    this.choices = null;
    this.choiceIndex = 0;
    this.onDone = null;
    this.onChoice = null;
    this.style = 'msg';
    this.blipTimer = 0;
    this.holdTimer = 0;
    this.queue = [];
    this.shopMode = null;
  }

  /* text may contain \n for hard breaks; pages split on \f */
  Dialogue.prototype.say = function (text, opts) {
    opts = opts || {};
    if (this.active && !opts.replace) { this.queue.push([text, opts]); return; }
    this.active = true;
    this.speaker = opts.speaker || '';
    this.portrait = opts.portrait || null;
    this.style = opts.style || 'msg';
    this.pages = String(text).split('\f');
    this.page = 0;
    this.choices = null;
    this.choiceIndex = 0;
    this.onDone = opts.onDone || null;
    this.onChoice = opts.onChoice || null;
    this.pendingChoices = opts.choices || null;
    this.speed = opts.speed || 42;
    this._layout();
    this.g.input.swallow();
    if (opts.sfx !== false) this.g.audio.sfx('menu_ok');
  };

  Dialogue.prototype.ask = function (text, choices, onChoice, opts) {
    opts = opts || {};
    opts.choices = choices;
    opts.onChoice = onChoice;
    this.say(text, opts);
  };

  Dialogue.prototype._layout = function () {
    var ui = this.g.ui;
    var maxW = this.portrait ? 214 : 268;
    this.lines = ui.wrap(this.pages[this.page], maxW, 1);
    this.reveal = 0;
    this.total = this.pages[this.page].replace(/\n/g, '').length;
    this.holdTimer = 0;
  };

  Dialogue.prototype.close = function () {
    this.active = false;
    this.choices = null;
    var cb = this.onDone;
    this.onDone = null;
    if (this.queue.length) {
      var q = this.queue.shift();
      var self = this;
      /* chain queued messages, preserving the original completion callback */
      var innerOpts = q[1] || {};
      var prevDone = innerOpts.onDone;
      innerOpts.onDone = function () { if (prevDone) prevDone(); if (cb) cb(); };
      innerOpts.replace = true;
      this.say(q[0], innerOpts);
      return;
    }
    if (cb) cb();
  };

  Dialogue.prototype.update = function (dt) {
    if (!this.active) return;
    var input = this.g.input;
    var full = this.reveal >= this.total;

    if (!full) {
      this.reveal += this.speed * dt * (input.down('a') || input.down('b') ? 3.5 : 1);
      this.blipTimer += dt;
      if (this.blipTimer > 0.055) {
        this.blipTimer = 0;
        this.g.audio.sfx('blip', { minGap: 0.02 });
      }
      if (input.pressed('a') || input.pressed('b')) this.reveal = this.total;
      return;
    }

    /* choices appear once the last page is fully revealed */
    if (this.pendingChoices && this.page === this.pages.length - 1 && !this.choices) {
      this.choices = this.pendingChoices;
      this.choiceIndex = 0;
    }

    if (this.choices) {
      if (input.pressed('up') || (input.rawStick[1] > 0.6 && this.holdTimer <= 0)) {
        this.choiceIndex = (this.choiceIndex - 1 + this.choices.length) % this.choices.length;
        this.g.audio.sfx('menu_move'); this.holdTimer = 0.22;
      } else if (input.pressed('down') || (input.rawStick[1] < -0.6 && this.holdTimer <= 0)) {
        this.choiceIndex = (this.choiceIndex + 1) % this.choices.length;
        this.g.audio.sfx('menu_move'); this.holdTimer = 0.22;
      }
      this.holdTimer -= dt;
      if (Math.abs(input.rawStick[1]) < 0.4) this.holdTimer = 0;
      if (input.pressed('a') || input.pressed('b')) {
        var idx = this.choiceIndex;
        var fn = this.onChoice;
        this.g.audio.sfx('menu_ok');
        this.pendingChoices = null;
        this.choices = null;
        this.active = false;
        this.onDone = null;
        if (fn) fn(idx, this.pendingChoicesLabels ? this.pendingChoicesLabels[idx] : null);
        return;
      }
      return;
    }

    if (input.pressed('a') || input.pressed('b') || input.pressed('start')) {
      if (this.page < this.pages.length - 1) {
        this.page++;
        this._layout();
        this.g.audio.sfx('blip_low');
      } else {
        this.g.audio.sfx('menu_back');
        this.close();
      }
    }
  };

  Dialogue.prototype.draw = function (ui) {
    if (!this.active) return;
    var W = this.g.r.width, H = this.g.r.height;
    var boxH = 60 + (this.choices ? this.choices.length * 10 : 0);
    var x = 14, y = H - boxH - 12, w = W - 28;
    ui.panel(x, y, w, boxH, this.style);

    var tx = x + 9, ty = y + 8;
    if (this.portrait) {
      /* portrait plate: a flat colour card with the speaker's palette */
      ui.rect(x + 7, y + 7, 44, 44, [0.06, 0.07, 0.12, 1]);
      ui.frame(x + 7, y + 7, 44, 44, 1, [0.7, 0.72, 0.85, 1]);
      this.g.drawPortrait(ui, this.portrait, x + 9, y + 9, 40);
      tx = x + 58;
    }
    if (this.speaker) {
      ui.text(this.speaker, tx, ty, [1.0, 0.88, 0.45, 1]);
      ty += 11;
    }
    var shown = Math.floor(this.reveal);
    var used = 0;
    for (var i = 0; i < this.lines.length; i++) {
      var line = this.lines[i];
      var remain = shown - used;
      if (remain <= 0) break;
      var s = remain >= line.length ? line : line.substr(0, remain);
      ui.text(s, tx, ty + i * 9, [0.95, 0.96, 1, 1]);
      used += line.length;
    }
    if (this.choices) {
      var cy = y + boxH - this.choices.length * 10 - 7;
      for (var c = 0; c < this.choices.length; c++) {
        var sel = c === this.choiceIndex;
        ui.text(this.choices[c], tx + 12, cy + c * 10, sel ? [1, 0.95, 0.6, 1] : [0.72, 0.74, 0.82, 1]);
        if (sel) ui.text('▶', tx + 3, cy + c * 10, [1, 0.9, 0.35, 1]);
      }
    } else if (this.reveal >= this.total) {
      /* blinking advance arrow */
      if (Math.floor(this.g.time * 3) % 2 === 0) {
        var more = this.page < this.pages.length - 1;
        ui.text(more ? '▼' : '●', x + w - 14, y + boxH - 12, [1, 0.9, 0.4, 1]);
      }
    }
  };

  LZ.Dialogue = Dialogue;
})(LZ);
