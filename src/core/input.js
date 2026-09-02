/* =============================================================
   core/input.js -- keyboard + gamepad mapped onto an N64 pad.

   The whole game is written against the virtual pad (a, b, z, l, r,
   start, cUp/cDown/cLeft/cRight, stick, cstick), so remapping and
   gamepad support cost nothing at the call site.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';
  var M = LZ.M;

  var DEFAULT_KEYS = {
    a:      ['Space'],
    b:      ['KeyJ', 'KeyX'],
    z:      ['ShiftLeft', 'ShiftRight'],
    l:      ['KeyQ'],
    r:      ['KeyE'],
    start:  ['Enter'],
    cLeft:  ['Digit1'],
    cDown:  ['Digit2'],
    cRight: ['Digit3'],
    cUp:    ['Digit4'],
    swap:   ['Tab'],
    up:     ['KeyW'],
    down:   ['KeyS'],
    left:   ['KeyA'],
    right:  ['KeyD'],
    camLeft:  ['ArrowLeft'],
    camRight: ['ArrowRight'],
    camUp:    ['ArrowUp'],
    camDown:  ['ArrowDown']
  };

  var BUTTONS = ['a', 'b', 'z', 'l', 'r', 'start', 'cLeft', 'cDown', 'cRight', 'cUp', 'swap',
                 'up', 'down', 'left', 'right', 'camLeft', 'camRight', 'camUp', 'camDown'];

  /* Standard Gamepad layout -> N64 pad */
  var PAD_MAP = {
    a: 0,        /* south (A / cross)          */
    b: 2,        /* west  (X / square)         */
    r: 5,        /* right shoulder = shield    */
    l: 4,        /* left shoulder              */
    z: 6,        /* left trigger = Z-target    */
    start: 9,
    swap: 8,
    cUp: 3, cRight: 1, cDown: 12, cLeft: 14
  };

  function Input(el) {
    this.el = el || window;
    this.keys = {};
    this.map = {};
    for (var k in DEFAULT_KEYS) this.map[k] = DEFAULT_KEYS[k].slice();
    this.state = {}; this.prev = {};
    for (var i = 0; i < BUTTONS.length; i++) { this.state[BUTTONS[i]] = false; this.prev[BUTTONS[i]] = false; }
    this.stick = [0, 0];
    this.cstick = [0, 0];
    this.rawStick = [0, 0];
    this.mouse = { x: 0, y: 0, dx: 0, dy: 0, down: false, locked: false };
    this.useMouseLook = false;
    this.anyPressed = false;
    this.padIndex = -1;
    this.lastDevice = 'key';
    this._bind();
  }

  Input.prototype._bind = function () {
    var self = this;
    window.addEventListener('keydown', function (e) {
      if (e.repeat) { return; }
      self.keys[e.code] = true;
      self.lastDevice = 'key';
      /* stop the browser hijacking gameplay keys */
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter',
           'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Slash'].indexOf(e.code) >= 0) e.preventDefault();
    });
    window.addEventListener('keyup', function (e) { self.keys[e.code] = false; });
    window.addEventListener('blur', function () { self.keys = {}; });
    var canvas = document.getElementById('screen');
    if (canvas) {
      canvas.addEventListener('mousedown', function (e) {
        self.mouse.down = true;
        if (e.button === 0) self.keys['MouseL'] = true;
        if (e.button === 2) self.keys['MouseR'] = true;
        self.lastDevice = 'key';
      });
      window.addEventListener('mouseup', function (e) {
        self.mouse.down = false;
        if (e.button === 0) self.keys['MouseL'] = false;
        if (e.button === 2) self.keys['MouseR'] = false;
      });
      canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      window.addEventListener('mousemove', function (e) {
        if (document.pointerLockElement === canvas) {
          self.mouse.dx += e.movementX || 0;
          self.mouse.dy += e.movementY || 0;
          self.mouse.locked = true;
        } else {
          self.mouse.locked = false;
        }
        self.mouse.x = e.clientX; self.mouse.y = e.clientY;
      });
      document.addEventListener('pointerlockchange', function () {
        self.mouse.locked = (document.pointerLockElement === canvas);
      });
    }
    window.addEventListener('gamepadconnected', function (e) { self.padIndex = e.gamepad.index; });
    window.addEventListener('gamepaddisconnected', function () { self.padIndex = -1; });
  };

  Input.prototype.requestPointerLock = function () {
    var canvas = document.getElementById('screen');
    if (canvas && canvas.requestPointerLock) canvas.requestPointerLock();
  };
  Input.prototype.exitPointerLock = function () {
    if (document.exitPointerLock) document.exitPointerLock();
  };

  Input.prototype._keyDown = function (name) {
    var list = this.map[name];
    for (var i = 0; i < list.length; i++) if (this.keys[list[i]]) return true;
    if (name === 'b' && this.keys['MouseL']) return true;
    if (name === 'z' && this.keys['MouseR']) return true;
    return false;
  };

  Input.prototype.poll = function (dt) {
    var i, name;
    for (i = 0; i < BUTTONS.length; i++) {
      name = BUTTONS[i];
      this.prev[name] = this.state[name];
      this.state[name] = this._keyDown(name);
    }

    /* keyboard digital stick */
    var kx = (this.state.right ? 1 : 0) - (this.state.left ? 1 : 0);
    var ky = (this.state.up ? 1 : 0) - (this.state.down ? 1 : 0);
    var cx = (this.state.camRight ? 1 : 0) - (this.state.camLeft ? 1 : 0);
    var cy = (this.state.camUp ? 1 : 0) - (this.state.camDown ? 1 : 0);

    /* gamepad overrides when a stick is actually deflected */
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    var pad = null;
    for (i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { pad = pads[i]; break; }
    if (pad) {
      var ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
      var rx = pad.axes[2] || 0, ry = pad.axes[3] || 0;
      var dead = 0.22;
      var mag = Math.sqrt(ax * ax + ay * ay);
      if (mag > dead) {
        var s = (mag - dead) / (1 - dead) / mag;
        kx = ax * s; ky = -ay * s;
        this.lastDevice = 'pad';
      }
      var rmag = Math.sqrt(rx * rx + ry * ry);
      if (rmag > dead) { cx = rx; cy = -ry; this.lastDevice = 'pad'; }
      for (name in PAD_MAP) {
        var bi = PAD_MAP[name];
        var btn = pad.buttons[bi];
        if (btn && btn.pressed) { this.state[name] = true; this.lastDevice = 'pad'; }
      }
      /* d-pad also drives the stick */
      if (pad.buttons[12] && pad.buttons[12].pressed) ky = 1;
      if (pad.buttons[13] && pad.buttons[13].pressed) ky = -1;
      if (pad.buttons[14] && pad.buttons[14].pressed) kx = -1;
      if (pad.buttons[15] && pad.buttons[15].pressed) kx = 1;
    }

    var len = Math.sqrt(kx * kx + ky * ky);
    if (len > 1) { kx /= len; ky /= len; }
    this.rawStick[0] = kx; this.rawStick[1] = ky;
    /* light smoothing so digital keys feel analog without going mushy */
    var lam = 26;
    this.stick[0] = M.damp(this.stick[0], kx, lam, dt);
    this.stick[1] = M.damp(this.stick[1], ky, lam, dt);
    if (Math.abs(this.stick[0]) < 0.004) this.stick[0] = 0;
    if (Math.abs(this.stick[1]) < 0.004) this.stick[1] = 0;
    this.cstick[0] = cx; this.cstick[1] = cy;

    this.anyPressed = false;
    for (i = 0; i < BUTTONS.length; i++) {
      if (this.state[BUTTONS[i]] && !this.prev[BUTTONS[i]]) { this.anyPressed = true; break; }
    }
  };

  Input.prototype.consumeMouse = function () {
    var d = [this.mouse.dx, this.mouse.dy];
    this.mouse.dx = 0; this.mouse.dy = 0;
    return d;
  };

  Input.prototype.down = function (n) { return !!this.state[n]; };
  Input.prototype.pressed = function (n) { return !!this.state[n] && !this.prev[n]; };
  Input.prototype.released = function (n) { return !this.state[n] && !!this.prev[n]; };
  Input.prototype.stickMag = function () {
    return Math.min(1, Math.sqrt(this.stick[0] * this.stick[0] + this.stick[1] * this.stick[1]));
  };
  /* clears edge state, used when a menu opens so the same press
     does not also trigger the thing behind it */
  Input.prototype.swallow = function () {
    for (var i = 0; i < BUTTONS.length; i++) this.prev[BUTTONS[i]] = this.state[BUTTONS[i]] = true;
  };
  /* Consume one button's press edge for the rest of the frame. UI runs
     before the world in the step order, so without this a single tap of A
     both closes a message box and is then seen again by the player, who
     talks to the same villager and reopens it -- forever. */
  Input.prototype.consume = function (n) { this.prev[n] = this.state[n]; };

  Input.KEYS = DEFAULT_KEYS;
  Input.BUTTONS = BUTTONS;
  LZ.Input = Input;
})(LZ);
