/* =============================================================
   core/audio.js -- WebAudio synth + step sequencer.

   The N64 had no music hardware: games shipped a sequenced score played
   back by a software synth on the CPU. This is the same idea -- every
   note and every sound effect is generated at runtime, so the whole
   soundtrack costs zero bytes of assets.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var M = LZ.M;

  var NOTE_OFFSET = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  function noteToFreq(name) {
    if (!name || name === '-' || name === '.') return 0;
    var m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(name);
    if (!m) return 0;
    var semi = NOTE_OFFSET[m[1].toUpperCase()];
    if (m[2] === '#') semi += 1; else if (m[2] === 'b') semi -= 1;
    var octave = parseInt(m[3], 10);
    var midi = (octave + 1) * 12 + semi;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function Audio() {
    this.ctx = null;
    this.ready = false;
    this.enabled = true;
    this.musicVol = 0.55;
    this.sfxVol = 0.75;
    this.masterVol = 0.9;
    this.song = null;
    this.nextSong = null;
    this.step = 0;
    this.nextNoteTime = 0;
    this.timer = null;
    this._fade = 1;
    this._fadeTarget = 1;
    this._pending = null;
    this._voices = 0;
    this._lastSfx = {};
  }

  Audio.prototype.init = function () {
    if (this.ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    var ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    this.master.gain.value = this.masterVol;
    this.master.connect(ctx.destination);

    /* gentle limiter so stacked voices never clip the way a soft synth would */
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.knee.value = 12;
    this.comp.ratio.value = 6;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.18;
    this.comp.connect(this.master);

    this.musicBus = ctx.createGain(); this.musicBus.gain.value = this.musicVol;
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = this.sfxVol;
    this.musicBus.connect(this.comp);
    this.sfxBus.connect(this.comp);

    /* a small generated plate reverb -- most N64 scores were drenched in it */
    this.verb = ctx.createConvolver();
    this.verb.buffer = this._impulse(1.6, 2.4);
    this.verbGain = ctx.createGain(); this.verbGain.gain.value = 0.30;
    this.verb.connect(this.verbGain); this.verbGain.connect(this.comp);

    this.noiseBuf = this._noise(2.0);
    this.ready = true;
    this._startClock();
  };

  Audio.prototype.resume = function () {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  };

  Audio.prototype._impulse = function (dur, decay) {
    var ctx = this.ctx, rate = ctx.sampleRate, len = Math.floor(rate * dur);
    var buf = ctx.createBuffer(2, len, rate);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c);
      for (var i = 0; i < len; i++) {
        var t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (1 - Math.exp(-i / 200));
      }
    }
    return buf;
  };
  Audio.prototype._noise = function (dur) {
    var ctx = this.ctx, rate = ctx.sampleRate, len = Math.floor(rate * dur);
    var buf = ctx.createBuffer(1, len, rate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  };

  /* cached PeriodicWaves give us pulse widths a plain 'square' can't */
  Audio.prototype._wave = function (kind) {
    if (!this._waves) this._waves = {};
    if (this._waves[kind]) return this._waves[kind];
    var n = 32, real = new Float32Array(n), imag = new Float32Array(n);
    var duty = kind === 'pulse12' ? 0.125 : (kind === 'pulse25' ? 0.25 : 0.5);
    for (var i = 1; i < n; i++) {
      if (kind === 'saw') { imag[i] = 1 / i; }
      else if (kind === 'organ') { imag[i] = (i === 1 || i === 2 || i === 4 || i === 8) ? 1 / i : 0; }
      else { imag[i] = (2 / (i * Math.PI)) * Math.sin(Math.PI * i * duty); }
    }
    var w = this.ctx.createPeriodicWave(real, imag, { disableNormalization: false });
    this._waves[kind] = w;
    return w;
  };

  /* ---------------- one-shot voice ---------------- */
  /* o = {freq, dur, type, gain, attack, decay, sustain, release, detune,
          filter, filterEnv, q, vib, vibRate, glide, bus, verb, pan} */
  Audio.prototype.voice = function (o) {
    if (!this.ready || !this.enabled) return null;
    var ctx = this.ctx, t = o.time || ctx.currentTime;
    var dur = o.dur === undefined ? 0.2 : o.dur;
    var bus = o.bus || this.sfxBus;

    var out = ctx.createGain();
    out.gain.value = 0;

    var src;
    if (o.type === 'noise') {
      src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      src.playbackRate.value = o.rate || 1;
    } else {
      src = ctx.createOscillator();
      if (o.type === 'sine' || o.type === 'triangle' || o.type === 'sawtooth' || o.type === 'square') {
        src.type = o.type;
      } else {
        src.setPeriodicWave(this._wave(o.type || 'pulse50'));
      }
      var f0 = o.freq || 440;
      src.frequency.setValueAtTime(o.glideFrom || f0, t);
      if (o.glideFrom) src.frequency.exponentialRampToValueAtTime(Math.max(1, f0), t + (o.glide || 0.08));
      if (o.slideTo) src.frequency.exponentialRampToValueAtTime(Math.max(1, o.slideTo), t + dur);
      if (o.detune) src.detune.value = o.detune;
    }

    var node = src;
    if (o.filter) {
      var flt = ctx.createBiquadFilter();
      flt.type = o.filterType || 'lowpass';
      flt.Q.value = o.q || 1;
      var fc = o.filter;
      flt.frequency.setValueAtTime(fc, t);
      if (o.filterEnv) {
        flt.frequency.exponentialRampToValueAtTime(Math.max(60, o.filterEnv), t + dur * 0.9);
      }
      node.connect(flt); node = flt;
    }
    node.connect(out);

    if (o.vib && src.frequency) {
      var lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = o.vibRate || 5.5;
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(o.vib, t + Math.min(dur * 0.5, 0.25));
      lfo.connect(lg); lg.connect(src.frequency);
      lfo.start(t); lfo.stop(t + dur + 0.4);
    }

    var g = (o.gain === undefined ? 0.3 : o.gain);
    var atk = o.attack === undefined ? 0.006 : o.attack;
    var dec = o.decay === undefined ? 0.05 : o.decay;
    var sus = o.sustain === undefined ? 0.7 : o.sustain;
    var rel = o.release === undefined ? 0.09 : o.release;
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(g, t + atk);
    out.gain.linearRampToValueAtTime(g * sus, t + atk + dec);
    out.gain.setValueAtTime(Math.max(0.0001, g * sus), t + Math.max(atk + dec, dur));
    out.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(atk + dec, dur) + rel);

    var dest = out;
    if (o.pan !== undefined && ctx.createStereoPanner) {
      var p = ctx.createStereoPanner();
      p.pan.value = M.clamp(o.pan, -1, 1);
      out.connect(p); dest = p;
    }
    dest.connect(bus);
    if (o.verb !== 0 && this.verb) {
      var vg = ctx.createGain();
      vg.gain.value = (o.verb === undefined ? 0.16 : o.verb);
      dest.connect(vg); vg.connect(this.verb);
    }

    src.start(t);
    var stopAt = t + Math.max(atk + dec, dur) + rel + 0.05;
    src.stop(stopAt);
    src.onended = function () { try { out.disconnect(); } catch (e) {} };
    return out;
  };

  /* ---------------- instruments ---------------- */
  var INST = {
    lead:    { type: 'pulse25', gain: 0.20, attack: 0.012, decay: 0.06, sustain: 0.72, release: 0.10, verb: 0.20 },
    lead2:   { type: 'pulse12', gain: 0.14, attack: 0.02, decay: 0.08, sustain: 0.6, release: 0.12, verb: 0.24 },
    flute:   { type: 'sine', gain: 0.24, attack: 0.05, decay: 0.06, sustain: 0.85, release: 0.16, vib: 5, vibRate: 5.2, verb: 0.30 },
    harp:    { type: 'triangle', gain: 0.24, attack: 0.004, decay: 0.34, sustain: 0.06, release: 0.30, verb: 0.34 },
    bell:    { type: 'sine', gain: 0.20, attack: 0.002, decay: 0.55, sustain: 0.03, release: 0.5, verb: 0.42 },
    strings: { type: 'saw', gain: 0.11, attack: 0.22, decay: 0.2, sustain: 0.75, release: 0.4, filter: 1500, q: 0.7, verb: 0.36 },
    organ:   { type: 'organ', gain: 0.13, attack: 0.02, decay: 0.05, sustain: 0.9, release: 0.14, verb: 0.3 },
    bass:    { type: 'triangle', gain: 0.32, attack: 0.006, decay: 0.09, sustain: 0.55, release: 0.09, verb: 0.05 },
    bassy:   { type: 'sawtooth', gain: 0.20, attack: 0.006, decay: 0.12, sustain: 0.4, release: 0.08, filter: 700, filterEnv: 240, q: 3, verb: 0.04 },
    pluck:   { type: 'pulse50', gain: 0.16, attack: 0.003, decay: 0.16, sustain: 0.12, release: 0.14, verb: 0.2 },
    pad:     { type: 'saw', gain: 0.07, attack: 0.5, decay: 0.4, sustain: 0.8, release: 0.8, filter: 900, q: 0.5, verb: 0.5 },
    choir:   { type: 'sine', gain: 0.10, attack: 0.35, decay: 0.3, sustain: 0.8, release: 0.7, vib: 3, vibRate: 4.4, verb: 0.55 },
    brass:   { type: 'sawtooth', gain: 0.15, attack: 0.03, decay: 0.1, sustain: 0.7, release: 0.14, filter: 2400, filterEnv: 1100, q: 1.4, verb: 0.2 }
  };

  var DRUM = {
    k: function (a, t, v) { a.voice({ time: t, type: 'sine', freq: 130, slideTo: 42, dur: 0.13, gain: 0.5 * v, attack: 0.002, decay: 0.1, sustain: 0.02, release: 0.05, bus: a.musicBus, verb: 0.05 }); },
    s: function (a, t, v) {
      a.voice({ time: t, type: 'noise', dur: 0.13, gain: 0.24 * v, attack: 0.001, decay: 0.10, sustain: 0.02, release: 0.06, filter: 2200, q: 1, bus: a.musicBus, verb: 0.20 });
      a.voice({ time: t, type: 'triangle', freq: 210, dur: 0.07, gain: 0.14 * v, attack: 0.001, decay: 0.05, sustain: 0.01, release: 0.04, bus: a.musicBus, verb: 0.1 });
    },
    h: function (a, t, v) { a.voice({ time: t, type: 'noise', dur: 0.035, gain: 0.11 * v, attack: 0.001, decay: 0.03, sustain: 0.01, release: 0.02, filter: 7000, filterType: 'highpass', bus: a.musicBus, verb: 0.06 }); },
    o: function (a, t, v) { a.voice({ time: t, type: 'noise', dur: 0.20, gain: 0.10 * v, attack: 0.001, decay: 0.18, sustain: 0.05, release: 0.1, filter: 6000, filterType: 'highpass', bus: a.musicBus, verb: 0.15 }); },
    c: function (a, t, v) { a.voice({ time: t, type: 'noise', dur: 0.7, gain: 0.14 * v, attack: 0.002, decay: 0.6, sustain: 0.05, release: 0.3, filter: 4200, filterType: 'highpass', bus: a.musicBus, verb: 0.4 }); },
    t: function (a, t, v) { a.voice({ time: t, type: 'sine', freq: 260, slideTo: 120, dur: 0.18, gain: 0.24 * v, attack: 0.002, decay: 0.14, sustain: 0.05, release: 0.08, bus: a.musicBus, verb: 0.2 }); }
  };

  /* ---------------- sequencer ---------------- */
  Audio.prototype._startClock = function () {
    var self = this;
    if (this.timer) return;
    this.timer = setInterval(function () { self._schedule(); }, 25);
  };

  Audio.prototype.playSong = function (song, opts) {
    opts = opts || {};
    if (!this.ready) { this._pending = { song: song, opts: opts }; return; }
    if (this.song === song && !opts.restart) return;
    if (this.song && opts.fade !== false) {
      this.nextSong = song;
      this._fadeTarget = 0;
      return;
    }
    this.song = song;
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.08;
    this._fade = 1; this._fadeTarget = 1;
  };

  Audio.prototype.stopSong = function (immediate) {
    if (immediate) { this.song = null; this.nextSong = null; this._fade = 1; this._fadeTarget = 1; }
    else { this.nextSong = null; this._fadeTarget = 0; }
  };

  Audio.prototype._schedule = function () {
    if (!this.ready || !this.enabled) return;
    var ctx = this.ctx;
    if (ctx.state === 'suspended') return;
    if (this._pending) { var p = this._pending; this._pending = null; this.playSong(p.song, p.opts); }

    /* music fade envelope */
    var f = this._fade;
    f = M.approach(f, this._fadeTarget, 0.045);
    this._fade = f;
    if (this.musicBus) this.musicBus.gain.value = this.musicVol * f;
    if (f <= 0.001 && this._fadeTarget === 0) {
      if (this.nextSong) {
        this.song = this.nextSong; this.nextSong = null;
        this.step = 0; this.nextNoteTime = ctx.currentTime + 0.05;
        this._fadeTarget = 1;
      } else if (this.song) {
        this.song = null;
      }
    }

    var song = this.song;
    if (!song) return;
    var spb = 60 / song.bpm;
    var stepDur = spb / (song.div || 4);
    var horizon = ctx.currentTime + 0.14;
    var guard = 0;
    while (this.nextNoteTime < horizon && guard++ < 64) {
      this._playStep(song, this.step, this.nextNoteTime, stepDur);
      this.nextNoteTime += stepDur;
      this.step++;
      if (this.step >= song.length) {
        if (song.loop === false) { this.song = null; return; }
        this.step = song.loopStart || 0;
      }
    }
  };

  Audio.prototype._playStep = function (song, step, time, stepDur) {
    for (var ti = 0; ti < song.tracks.length; ti++) {
      var tr = song.tracks[ti];
      if (!tr._parsed) tr._parsed = tr.seq.trim().split(/\s+/);
      var toks = tr._parsed;
      var tok = toks[step % toks.length];
      if (!tok || tok === '.' || tok === '-') continue;
      var vol = (tr.vol === undefined ? 1 : tr.vol);

      if (tr.inst === 'drum') {
        var fn = DRUM[tok.charAt(0)];
        if (fn) fn(this, time, vol * (tok.length > 1 ? parseFloat('0.' + tok.substr(1)) || 1 : 1));
        continue;
      }
      /* held notes: count following '.' tokens */
      var hold = 1;
      while (toks[(step + hold) % toks.length] === '.' && hold < 32) hold++;
      var freq = noteToFreq(tok);
      if (!freq) continue;
      var base = INST[tr.inst] || INST.lead;
      var o = {};
      for (var k in base) o[k] = base[k];
      o.freq = freq;
      o.time = time;
      o.dur = stepDur * hold * (tr.legato === false ? 0.72 : 0.95);
      o.gain = base.gain * vol;
      o.bus = this.musicBus;
      if (tr.octave) o.freq *= Math.pow(2, tr.octave);
      if (tr.detune) o.detune = tr.detune;
      if (tr.pan !== undefined) o.pan = tr.pan;
      this.voice(o);
      /* cheap unison for pads/strings */
      if (tr.inst === 'strings' || tr.inst === 'pad' || tr.inst === 'choir') {
        o.detune = (o.detune || 0) + 7; o.gain *= 0.6;
        this.voice(o);
      }
    }
  };

  /* ---------------- sound effects ---------------- */
  var SFX = {
    swing: function (a, t) {
      a.voice({ time: t, type: 'noise', dur: 0.16, gain: 0.20, attack: 0.005, decay: 0.14, sustain: 0.01,
        release: 0.05, filter: 900, filterEnv: 3400, q: 3, verb: 0.1 });
    },
    swing_heavy: function (a, t) {
      a.voice({ time: t, type: 'noise', dur: 0.28, gain: 0.26, attack: 0.01, decay: 0.24, sustain: 0.02,
        release: 0.1, filter: 500, filterEnv: 2200, q: 4, verb: 0.16 });
    },
    hit: function (a, t) {
      a.voice({ time: t, type: 'noise', dur: 0.09, gain: 0.28, attack: 0.001, decay: 0.07, sustain: 0.01, release: 0.04, filter: 2600, q: 1.2 });
      a.voice({ time: t, type: 'square', freq: 320, slideTo: 90, dur: 0.09, gain: 0.16, attack: 0.001, decay: 0.07, sustain: 0.02, release: 0.04 });
    },
    hit_metal: function (a, t) {
      a.voice({ time: t, type: 'square', freq: 1400, slideTo: 700, dur: 0.12, gain: 0.14, attack: 0.001, decay: 0.1, sustain: 0.02, release: 0.08, verb: 0.3 });
      a.voice({ time: t, type: 'noise', dur: 0.09, gain: 0.16, attack: 0.001, decay: 0.08, sustain: 0.01, release: 0.05, filter: 5200, filterType: 'highpass' });
    },
    hurt: function (a, t) {
      a.voice({ time: t, type: 'sawtooth', freq: 380, slideTo: 130, dur: 0.28, gain: 0.24, attack: 0.002, decay: 0.2, sustain: 0.2, release: 0.12, filter: 1800, filterEnv: 400 });
    },
    die: function (a, t) {
      a.voice({ time: t, type: 'sawtooth', freq: 320, slideTo: 50, dur: 0.7, gain: 0.22, attack: 0.01, decay: 0.5, sustain: 0.15, release: 0.3, filter: 1600, filterEnv: 200, verb: 0.4 });
      a.voice({ time: t + 0.02, type: 'noise', dur: 0.5, gain: 0.14, attack: 0.01, decay: 0.4, sustain: 0.05, release: 0.2, filter: 1400, filterEnv: 300 });
    },
    jump: function (a, t) {
      a.voice({ time: t, type: 'pulse25', freq: 300, slideTo: 620, dur: 0.13, gain: 0.15, attack: 0.004, decay: 0.1, sustain: 0.2, release: 0.05 });
    },
    land: function (a, t) {
      a.voice({ time: t, type: 'noise', dur: 0.09, gain: 0.16, attack: 0.001, decay: 0.08, sustain: 0.01, release: 0.03, filter: 700, q: 1 });
    },
    roll: function (a, t) {
      a.voice({ time: t, type: 'noise', dur: 0.24, gain: 0.14, attack: 0.02, decay: 0.2, sustain: 0.1, release: 0.06, filter: 480, filterEnv: 1200, q: 2 });
    },
    step_grass: function (a, t) { a.voice({ time: t, type: 'noise', dur: 0.05, gain: 0.055, attack: 0.001, decay: 0.04, sustain: 0.01, release: 0.02, filter: 3600, filterType: 'highpass', verb: 0.04 }); },
    step_stone: function (a, t) { a.voice({ time: t, type: 'noise', dur: 0.045, gain: 0.07, attack: 0.001, decay: 0.035, sustain: 0.01, release: 0.02, filter: 1400, q: 2, verb: 0.14 }); },
    step_sand: function (a, t) { a.voice({ time: t, type: 'noise', dur: 0.07, gain: 0.05, attack: 0.002, decay: 0.06, sustain: 0.01, release: 0.02, filter: 1900, q: 0.8 }); },
    step_water: function (a, t) { a.voice({ time: t, type: 'noise', dur: 0.13, gain: 0.10, attack: 0.002, decay: 0.11, sustain: 0.02, release: 0.05, filter: 900, filterEnv: 2600, q: 1.6 }); },
    step_wood: function (a, t) { a.voice({ time: t, type: 'noise', dur: 0.05, gain: 0.07, attack: 0.001, decay: 0.04, sustain: 0.01, release: 0.02, filter: 900, q: 3 }); },
    splash: function (a, t) {
      a.voice({ time: t, type: 'noise', dur: 0.34, gain: 0.20, attack: 0.003, decay: 0.3, sustain: 0.04, release: 0.12, filter: 600, filterEnv: 3200, q: 1.2, verb: 0.3 });
    },
    rupee: function (a, t) {
      a.voice({ time: t, type: 'sine', freq: 1046, dur: 0.06, gain: 0.16, decay: 0.05, sustain: 0.2, release: 0.06, verb: 0.3 });
      a.voice({ time: t + 0.055, type: 'sine', freq: 1568, dur: 0.10, gain: 0.16, decay: 0.09, sustain: 0.2, release: 0.10, verb: 0.3 });
    },
    heart: function (a, t) {
      a.voice({ time: t, type: 'sine', freq: 784, dur: 0.07, gain: 0.16, decay: 0.06, sustain: 0.2, release: 0.06, verb: 0.3 });
      a.voice({ time: t + 0.07, type: 'sine', freq: 1174, dur: 0.14, gain: 0.16, decay: 0.12, sustain: 0.2, release: 0.12, verb: 0.3 });
    },
    menu_move: function (a, t) { a.voice({ time: t, type: 'pulse25', freq: 880, dur: 0.035, gain: 0.11, decay: 0.03, sustain: 0.1, release: 0.03, verb: 0 }); },
    menu_ok: function (a, t) {
      a.voice({ time: t, type: 'pulse25', freq: 740, dur: 0.05, gain: 0.13, decay: 0.04, sustain: 0.2, release: 0.04, verb: 0.1 });
      a.voice({ time: t + 0.05, type: 'pulse25', freq: 1108, dur: 0.09, gain: 0.13, decay: 0.08, sustain: 0.2, release: 0.06, verb: 0.1 });
    },
    menu_back: function (a, t) {
      a.voice({ time: t, type: 'pulse25', freq: 620, dur: 0.05, gain: 0.12, decay: 0.04, sustain: 0.2, release: 0.04, verb: 0.05 });
      a.voice({ time: t + 0.05, type: 'pulse25', freq: 410, dur: 0.08, gain: 0.12, decay: 0.07, sustain: 0.2, release: 0.05, verb: 0.05 });
    },
    error: function (a, t) {
      a.voice({ time: t, type: 'square', freq: 180, dur: 0.16, gain: 0.15, decay: 0.14, sustain: 0.4, release: 0.05, verb: 0 });
    },
    blip: function (a, t) { a.voice({ time: t, type: 'pulse12', freq: 1300, dur: 0.018, gain: 0.055, decay: 0.015, sustain: 0.1, release: 0.015, verb: 0 }); },
    blip_low: function (a, t) { a.voice({ time: t, type: 'pulse12', freq: 700, dur: 0.022, gain: 0.06, decay: 0.02, sustain: 0.1, release: 0.02, verb: 0 }); },
    chest: function (a, t) {
      a.voice({ time: t, type: 'noise', dur: 0.3, gain: 0.13, attack: 0.02, decay: 0.26, sustain: 0.1, release: 0.1, filter: 700, q: 2 });
      a.voice({ time: t + 0.18, type: 'triangle', freq: 300, slideTo: 520, dur: 0.2, gain: 0.11, verb: 0.3 });
    },
    lock_open: function (a, t) {
      a.voice({ time: t, type: 'square', freq: 900, dur: 0.05, gain: 0.12, decay: 0.04, sustain: 0.1, release: 0.03 });
      a.voice({ time: t + 0.09, type: 'square', freq: 1300, dur: 0.05, gain: 0.12, decay: 0.04, sustain: 0.1, release: 0.03 });
      a.voice({ time: t + 0.2, type: 'noise', dur: 0.28, gain: 0.13, attack: 0.01, decay: 0.24, sustain: 0.05, release: 0.1, filter: 500, q: 2.5 });
    },
    secret: function (a, t) {
      var n = [659, 784, 988, 1319];
      for (var i = 0; i < n.length; i++) {
        a.voice({ time: t + i * 0.11, type: 'sine', freq: n[i], dur: 0.2, gain: 0.15, attack: 0.004, decay: 0.18, sustain: 0.2, release: 0.2, verb: 0.45 });
      }
    },
    fanfare_small: function (a, t) {
      var n = [523, 659, 784, 1046];
      for (var i = 0; i < n.length; i++) {
        a.voice({ time: t + i * 0.09, type: 'pulse25', freq: n[i], dur: 0.16, gain: 0.16, attack: 0.005, decay: 0.14, sustain: 0.3, release: 0.14, verb: 0.35 });
      }
    },
    fanfare_big: function (a, t) {
      var seq = [[523, 0], [659, 0.11], [784, 0.22], [1046, 0.33], [988, 0.5], [1046, 0.62]];
      for (var i = 0; i < seq.length; i++) {
        a.voice({ time: t + seq[i][1], type: 'brass', freq: seq[i][0], dur: 0.3, gain: 0.16, attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.25, filter: 2600, verb: 0.4 });
        a.voice({ time: t + seq[i][1], type: 'sine', freq: seq[i][0] * 2, dur: 0.3, gain: 0.07, verb: 0.4 });
      }
    },
    bomb_fuse: function (a, t) {
      a.voice({ time: t, type: 'noise', dur: 0.13, gain: 0.07, attack: 0.005, decay: 0.11, sustain: 0.05, release: 0.04, filter: 5000, filterType: 'highpass' });
    },
    explode: function (a, t) {
      a.voice({ time: t, type: 'noise', dur: 0.55, gain: 0.42, attack: 0.002, decay: 0.45, sustain: 0.05, release: 0.2, filter: 1800, filterEnv: 140, q: 1.1, verb: 0.4 });
      a.voice({ time: t, type: 'sine', freq: 120, slideTo: 34, dur: 0.4, gain: 0.34, attack: 0.002, decay: 0.32, sustain: 0.05, release: 0.15 });
    },
    bow: function (a, t) {
      a.voice({ time: t, type: 'noise', dur: 0.13, gain: 0.15, attack: 0.001, decay: 0.11, sustain: 0.02, release: 0.05, filter: 1500, filterEnv: 4200, q: 2 });
      a.voice({ time: t, type: 'triangle', freq: 220, slideTo: 660, dur: 0.09, gain: 0.09 });
    },
    arrow_hit: function (a, t) {
      a.voice({ time: t, type: 'noise', dur: 0.07, gain: 0.16, attack: 0.001, decay: 0.06, sustain: 0.01, release: 0.03, filter: 3200, q: 2 });
    },
    hookshot: function (a, t) {
      a.voice({ time: t, type: 'square', freq: 1200, slideTo: 300, dur: 0.3, gain: 0.10, attack: 0.002, decay: 0.26, sustain: 0.2, release: 0.06, filter: 2600 });
    },
    chain: function (a, t) {
      a.voice({ time: t, type: 'noise', dur: 0.04, gain: 0.07, attack: 0.001, decay: 0.03, sustain: 0.01, release: 0.02, filter: 4600, filterType: 'highpass' });
    },
    magic: function (a, t) {
      a.voice({ time: t, type: 'sine', freq: 440, slideTo: 1760, dur: 0.4, gain: 0.12, attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.2, verb: 0.5 });
      a.voice({ time: t, type: 'pulse12', freq: 880, slideTo: 2640, dur: 0.4, gain: 0.06, attack: 0.02, verb: 0.5 });
    },
    ice: function (a, t) {
      a.voice({ time: t, type: 'noise', dur: 0.4, gain: 0.13, attack: 0.005, decay: 0.35, sustain: 0.05, release: 0.15, filter: 6000, filterType: 'highpass', verb: 0.45 });
      a.voice({ time: t, type: 'sine', freq: 2400, slideTo: 900, dur: 0.3, gain: 0.07, verb: 0.5 });
    },
    fire: function (a, t) {
      a.voice({ time: t, type: 'noise', dur: 0.45, gain: 0.17, attack: 0.02, decay: 0.4, sustain: 0.1, release: 0.15, filter: 700, filterEnv: 2400, q: 1.2, verb: 0.3 });
    },
    warp: function (a, t) {
      a.voice({ time: t, type: 'sine', freq: 200, slideTo: 2400, dur: 1.0, gain: 0.14, attack: 0.1, decay: 0.6, sustain: 0.5, release: 0.3, verb: 0.6 });
      a.voice({ time: t + 0.1, type: 'pulse25', freq: 300, slideTo: 3000, dur: 0.9, gain: 0.07, attack: 0.2, verb: 0.6 });
    },
    rewind: function (a, t) {
      a.voice({ time: t, type: 'sawtooth', freq: 1400, slideTo: 220, dur: 0.7, gain: 0.12, attack: 0.02, decay: 0.5, sustain: 0.4, release: 0.2, filter: 2200, filterEnv: 500, verb: 0.5 });
    },
    timeshift: function (a, t) {
      var n = [261, 349, 523, 698, 1046];
      for (var i = 0; i < n.length; i++) {
        a.voice({ time: t + i * 0.13, type: 'bell', freq: n[i], dur: 0.9, gain: 0.13, attack: 0.004, decay: 0.7, sustain: 0.05, release: 0.6, verb: 0.6 });
      }
    },
    target: function (a, t) { a.voice({ time: t, type: 'pulse12', freq: 1500, dur: 0.05, gain: 0.09, decay: 0.04, sustain: 0.1, release: 0.03, verb: 0.15 }); },
    untarget: function (a, t) { a.voice({ time: t, type: 'pulse12', freq: 900, dur: 0.05, gain: 0.07, decay: 0.04, sustain: 0.1, release: 0.03, verb: 0.15 }); },
    guard: function (a, t) {
      a.voice({ time: t, type: 'noise', dur: 0.1, gain: 0.2, attack: 0.001, decay: 0.09, sustain: 0.02, release: 0.05, filter: 1200, q: 3 });
      a.voice({ time: t, type: 'triangle', freq: 180, dur: 0.1, gain: 0.14 });
    },
    break_weapon: function (a, t) {
      a.voice({ time: t, type: 'noise', dur: 0.4, gain: 0.24, attack: 0.001, decay: 0.36, sustain: 0.04, release: 0.15, filter: 3200, filterEnv: 700, q: 1.6, verb: 0.3 });
      a.voice({ time: t, type: 'square', freq: 900, slideTo: 180, dur: 0.3, gain: 0.12 });
    },
    low_health: function (a, t) {
      a.voice({ time: t, type: 'pulse25', freq: 1046, dur: 0.07, gain: 0.10, decay: 0.06, sustain: 0.1, release: 0.05, verb: 0 });
    },
    roar: function (a, t) {
      a.voice({ time: t, type: 'sawtooth', freq: 90, slideTo: 55, dur: 1.2, gain: 0.30, attack: 0.06, decay: 0.9, sustain: 0.5, release: 0.4, filter: 900, filterEnv: 260, q: 2.5, verb: 0.5 });
      a.voice({ time: t, type: 'noise', dur: 1.1, gain: 0.16, attack: 0.08, decay: 0.85, sustain: 0.3, release: 0.35, filter: 500, filterEnv: 1600, q: 1.5, verb: 0.5 });
    },
    door: function (a, t) {
      a.voice({ time: t, type: 'noise', dur: 0.6, gain: 0.15, attack: 0.05, decay: 0.5, sustain: 0.2, release: 0.15, filter: 400, filterEnv: 900, q: 3, verb: 0.35 });
    },
    click: function (a, t) {
      a.voice({ time: t, type: 'square', freq: 1600, dur: 0.03, gain: 0.10, decay: 0.025, sustain: 0.05, release: 0.02, verb: 0.1 });
    },
    rumble: function (a, t) {
      a.voice({ time: t, type: 'noise', dur: 1.4, gain: 0.20, attack: 0.3, decay: 0.9, sustain: 0.5, release: 0.4, filter: 160, q: 1.2, verb: 0.4 });
    },
    dark: function (a, t) {
      a.voice({ time: t, type: 'sawtooth', freq: 55, dur: 1.6, gain: 0.16, attack: 0.4, decay: 0.8, sustain: 0.6, release: 0.5, filter: 400, q: 4, verb: 0.6 });
      a.voice({ time: t, type: 'sine', freq: 82.5, dur: 1.6, gain: 0.10, attack: 0.5, verb: 0.6 });
    }
  };

  Audio.prototype.sfx = function (name, opts) {
    if (!this.ready || !this.enabled) { if (!this.ctx) return; }
    if (!this.ready) return;
    var fn = SFX[name];
    if (!fn) return;
    var now = this.ctx.currentTime;
    /* de-dupe: identical effects fired in the same couple of frames stack ugly */
    var minGap = (opts && opts.minGap !== undefined) ? opts.minGap : 0.035;
    if (this._lastSfx[name] && now - this._lastSfx[name] < minGap) return;
    this._lastSfx[name] = now;
    fn(this, now + 0.005, opts || {});
  };

  Audio.prototype.setMusicVolume = function (v) {
    this.musicVol = M.saturate(v);
    if (this.musicBus) this.musicBus.gain.value = this.musicVol * this._fade;
  };
  Audio.prototype.setSfxVolume = function (v) {
    this.sfxVol = M.saturate(v);
    if (this.sfxBus) this.sfxBus.gain.value = this.sfxVol;
  };

  Audio.noteToFreq = noteToFreq;
  Audio.INST = INST;
  Audio.SFX = SFX;
  LZ.Audio = Audio;
})(LZ);
