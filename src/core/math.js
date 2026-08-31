/* =============================================================
   Legend of Zelda: Descendants
   core/math.js -- vectors, matrices, quaternions, easing, noise
   No dependencies. Column-major mat4 (WebGL convention).
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';

  var M = {};

  M.DEG = Math.PI / 180;
  M.RAD = 180 / Math.PI;
  M.TAU = Math.PI * 2;
  M.EPS = 1e-6;

  M.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  M.saturate = function (v) { return v < 0 ? 0 : (v > 1 ? 1 : v); };
  M.lerp = function (a, b, t) { return a + (b - a) * t; };
  M.mix = M.lerp;
  M.sign = function (v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); };
  M.fract = function (v) { return v - Math.floor(v); };
  M.step = function (e, v) { return v < e ? 0 : 1; };
  M.smoothstep = function (a, b, x) {
    var t = M.saturate((x - a) / (b - a || M.EPS));
    return t * t * (3 - 2 * t);
  };
  M.remap = function (v, a, b, c, d) { return c + (d - c) * ((v - a) / (b - a || M.EPS)); };
  M.approach = function (cur, target, delta) {
    if (cur < target) return Math.min(cur + delta, target);
    return Math.max(cur - delta, target);
  };
  /* frame-rate independent exponential smoothing */
  M.damp = function (cur, target, lambda, dt) {
    return M.lerp(target, cur, Math.exp(-lambda * dt));
  };
  M.wrapAngle = function (a) {
    a = (a + Math.PI) % M.TAU;
    if (a < 0) a += M.TAU;
    return a - Math.PI;
  };
  M.angleDelta = function (from, to) { return M.wrapAngle(to - from); };
  M.angleApproach = function (cur, target, delta) {
    var d = M.angleDelta(cur, target);
    if (Math.abs(d) <= delta) return M.wrapAngle(target);
    return M.wrapAngle(cur + M.sign(d) * delta);
  };
  M.angleDamp = function (cur, target, lambda, dt) {
    var d = M.angleDelta(cur, target);
    return M.wrapAngle(cur + d * (1 - Math.exp(-lambda * dt)));
  };

  /* ---------------- easing ---------------- */
  M.ease = {
    linear: function (t) { return t; },
    inQuad: function (t) { return t * t; },
    outQuad: function (t) { return t * (2 - t); },
    inOutQuad: function (t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; },
    inCubic: function (t) { return t * t * t; },
    outCubic: function (t) { var f = t - 1; return f * f * f + 1; },
    inOutCubic: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    outBack: function (t) { var c1 = 1.70158, c3 = c1 + 1, f = t - 1; return 1 + c3 * f * f * f + c1 * f * f; },
    outElastic: function (t) {
      if (t === 0 || t === 1) return t;
      var c4 = M.TAU / 3;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    },
    outBounce: function (t) {
      var n1 = 7.5625, d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) { t -= 1.5 / d1; return n1 * t * t + 0.75; }
      if (t < 2.5 / d1) { t -= 2.25 / d1; return n1 * t * t + 0.9375; }
      t -= 2.625 / d1; return n1 * t * t + 0.984375;
    }
  };

  /* ---------------- vec3 ---------------- */
  var V3 = {};
  V3.create = function (x, y, z) { return new Float32Array([x || 0, y || 0, z || 0]); };
  V3.set = function (o, x, y, z) { o[0] = x; o[1] = y; o[2] = z; return o; };
  V3.copy = function (o, a) { o[0] = a[0]; o[1] = a[1]; o[2] = a[2]; return o; };
  V3.clone = function (a) { return new Float32Array([a[0], a[1], a[2]]); };
  V3.add = function (o, a, b) { o[0] = a[0] + b[0]; o[1] = a[1] + b[1]; o[2] = a[2] + b[2]; return o; };
  V3.sub = function (o, a, b) { o[0] = a[0] - b[0]; o[1] = a[1] - b[1]; o[2] = a[2] - b[2]; return o; };
  V3.mul = function (o, a, b) { o[0] = a[0] * b[0]; o[1] = a[1] * b[1]; o[2] = a[2] * b[2]; return o; };
  V3.scale = function (o, a, s) { o[0] = a[0] * s; o[1] = a[1] * s; o[2] = a[2] * s; return o; };
  V3.addScaled = function (o, a, b, s) { o[0] = a[0] + b[0] * s; o[1] = a[1] + b[1] * s; o[2] = a[2] + b[2] * s; return o; };
  V3.dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; };
  V3.cross = function (o, a, b) {
    var ax = a[0], ay = a[1], az = a[2], bx = b[0], by = b[1], bz = b[2];
    o[0] = ay * bz - az * by; o[1] = az * bx - ax * bz; o[2] = ax * by - ay * bx; return o;
  };
  V3.len = function (a) { return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]); };
  V3.len2 = function (a) { return a[0] * a[0] + a[1] * a[1] + a[2] * a[2]; };
  V3.dist = function (a, b) { var x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return Math.sqrt(x * x + y * y + z * z); };
  V3.dist2 = function (a, b) { var x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return x * x + y * y + z * z; };
  V3.distXZ = function (a, b) { var x = a[0] - b[0], z = a[2] - b[2]; return Math.sqrt(x * x + z * z); };
  V3.normalize = function (o, a) {
    var l = V3.len(a);
    if (l < M.EPS) { o[0] = 0; o[1] = 0; o[2] = 0; return o; }
    l = 1 / l; o[0] = a[0] * l; o[1] = a[1] * l; o[2] = a[2] * l; return o;
  };
  V3.lerp = function (o, a, b, t) {
    o[0] = a[0] + (b[0] - a[0]) * t; o[1] = a[1] + (b[1] - a[1]) * t; o[2] = a[2] + (b[2] - a[2]) * t; return o;
  };
  V3.transformMat4 = function (o, a, m) {
    var x = a[0], y = a[1], z = a[2];
    var w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
    o[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
    o[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    o[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
    return o;
  };
  V3.transformDir = function (o, a, m) {
    var x = a[0], y = a[1], z = a[2];
    o[0] = m[0] * x + m[4] * y + m[8] * z;
    o[1] = m[1] * x + m[5] * y + m[9] * z;
    o[2] = m[2] * x + m[6] * y + m[10] * z;
    return o;
  };
  V3.ZERO = V3.create(0, 0, 0);
  V3.UP = V3.create(0, 1, 0);
  M.V3 = V3;

  /* ---------------- mat4 (column major) ---------------- */
  var M4 = {};
  M4.create = function () {
    var o = new Float32Array(16);
    o[0] = 1; o[5] = 1; o[10] = 1; o[15] = 1;
    return o;
  };
  M4.identity = function (o) {
    o[0] = 1; o[1] = 0; o[2] = 0; o[3] = 0;
    o[4] = 0; o[5] = 1; o[6] = 0; o[7] = 0;
    o[8] = 0; o[9] = 0; o[10] = 1; o[11] = 0;
    o[12] = 0; o[13] = 0; o[14] = 0; o[15] = 1;
    return o;
  };
  M4.copy = function (o, a) { o.set(a); return o; };
  M4.clone = function (a) { var o = new Float32Array(16); o.set(a); return o; };
  M4.multiply = function (o, a, b) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    var b0, b1, b2, b3;
    b0 = b[0]; b1 = b[1]; b2 = b[2]; b3 = b[3];
    o[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    o[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    o[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    o[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
    o[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    o[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    o[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    o[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
    o[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    o[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    o[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    o[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    o[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    o[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    o[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    o[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    return o;
  };
  M4.fromTranslation = function (o, x, y, z) {
    M4.identity(o); o[12] = x; o[13] = y; o[14] = z; return o;
  };
  M4.fromScale = function (o, x, y, z) {
    M4.identity(o); o[0] = x; o[5] = y; o[10] = z; return o;
  };
  M4.fromRotationY = function (o, r) {
    var s = Math.sin(r), c = Math.cos(r);
    M4.identity(o); o[0] = c; o[2] = -s; o[8] = s; o[10] = c; return o;
  };
  M4.fromRotationX = function (o, r) {
    var s = Math.sin(r), c = Math.cos(r);
    M4.identity(o); o[5] = c; o[6] = s; o[9] = -s; o[10] = c; return o;
  };
  M4.fromRotationZ = function (o, r) {
    var s = Math.sin(r), c = Math.cos(r);
    M4.identity(o); o[0] = c; o[1] = s; o[4] = -s; o[5] = c; return o;
  };
  /* T * Rz * Ry * Rx * S  -- matches the ZYX euler order used by the animator */
  M4.compose = function (o, px, py, pz, rx, ry, rz, sx, sy, sz) {
    var cx = Math.cos(rx), sxv = Math.sin(rx);
    var cy = Math.cos(ry), syv = Math.sin(ry);
    var cz = Math.cos(rz), szv = Math.sin(rz);
    /* rotation = Rz*Ry*Rx */
    var m00 = cz * cy, m01 = cz * syv * sxv - szv * cx, m02 = cz * syv * cx + szv * sxv;
    var m10 = szv * cy, m11 = szv * syv * sxv + cz * cx, m12 = szv * syv * cx - cz * sxv;
    var m20 = -syv, m21 = cy * sxv, m22 = cy * cx;
    o[0] = m00 * sx; o[1] = m10 * sx; o[2] = m20 * sx; o[3] = 0;
    o[4] = m01 * sy; o[5] = m11 * sy; o[6] = m21 * sy; o[7] = 0;
    o[8] = m02 * sz; o[9] = m12 * sz; o[10] = m22 * sz; o[11] = 0;
    o[12] = px; o[13] = py; o[14] = pz; o[15] = 1;
    return o;
  };
  M4.perspective = function (o, fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    o[0] = f / aspect; o[1] = 0; o[2] = 0; o[3] = 0;
    o[4] = 0; o[5] = f; o[6] = 0; o[7] = 0;
    o[8] = 0; o[9] = 0; o[10] = (far + near) * nf; o[11] = -1;
    o[12] = 0; o[13] = 0; o[14] = 2 * far * near * nf; o[15] = 0;
    return o;
  };
  M4.ortho = function (o, l, r, b, t, n, f) {
    var lr = 1 / (l - r), bt = 1 / (b - t), nf = 1 / (n - f);
    o[0] = -2 * lr; o[1] = 0; o[2] = 0; o[3] = 0;
    o[4] = 0; o[5] = -2 * bt; o[6] = 0; o[7] = 0;
    o[8] = 0; o[9] = 0; o[10] = 2 * nf; o[11] = 0;
    o[12] = (l + r) * lr; o[13] = (t + b) * bt; o[14] = (f + n) * nf; o[15] = 1;
    return o;
  };
  M4.lookAt = function (o, eye, center, up) {
    var z0 = eye[0] - center[0], z1 = eye[1] - center[1], z2 = eye[2] - center[2];
    var len = z0 * z0 + z1 * z1 + z2 * z2;
    if (len < M.EPS) { return M4.identity(o); }
    len = 1 / Math.sqrt(len); z0 *= len; z1 *= len; z2 *= len;
    var x0 = up[1] * z2 - up[2] * z1, x1 = up[2] * z0 - up[0] * z2, x2 = up[0] * z1 - up[1] * z0;
    len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);
    if (len < M.EPS) { x0 = 1; x1 = 0; x2 = 0; } else { len = 1 / len; x0 *= len; x1 *= len; x2 *= len; }
    var y0 = z1 * x2 - z2 * x1, y1 = z2 * x0 - z0 * x2, y2 = z0 * x1 - z1 * x0;
    o[0] = x0; o[1] = y0; o[2] = z0; o[3] = 0;
    o[4] = x1; o[5] = y1; o[6] = z1; o[7] = 0;
    o[8] = x2; o[9] = y2; o[10] = z2; o[11] = 0;
    o[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
    o[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
    o[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
    o[15] = 1;
    return o;
  };
  M4.invert = function (o, a) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    var b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10,
        b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11,
        b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12,
        b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30,
        b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31,
        b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return M4.identity(o);
    det = 1.0 / det;
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return o;
  };
  /* upper-left 3x3 inverse-transpose, as a mat3 in a Float32Array(9) */
  M4.normalMat3 = function (o, a) {
    var a00 = a[0], a01 = a[1], a02 = a[2],
        a10 = a[4], a11 = a[5], a12 = a[6],
        a20 = a[8], a21 = a[9], a22 = a[10];
    var b01 = a22 * a11 - a12 * a21,
        b11 = -a22 * a10 + a12 * a20,
        b21 = a21 * a10 - a11 * a20;
    var det = a00 * b01 + a01 * b11 + a02 * b21;
    if (!det) { o[0] = 1; o[1] = 0; o[2] = 0; o[3] = 0; o[4] = 1; o[5] = 0; o[6] = 0; o[7] = 0; o[8] = 1; return o; }
    det = 1.0 / det;
    o[0] = b01 * det;
    o[1] = (-a22 * a01 + a02 * a21) * det;
    o[2] = (a12 * a01 - a02 * a11) * det;
    o[3] = b11 * det;
    o[4] = (a22 * a00 - a02 * a20) * det;
    o[5] = (-a12 * a00 + a02 * a10) * det;
    o[6] = b21 * det;
    o[7] = (-a21 * a00 + a01 * a20) * det;
    o[8] = (a11 * a00 - a01 * a10) * det;
    return o;
  };
  M4.getTranslation = function (o, a) { o[0] = a[12]; o[1] = a[13]; o[2] = a[14]; return o; };
  M.M4 = M4;

  /* ---------------- deterministic RNG (mulberry32) ---------------- */
  M.Rng = function (seed) {
    this.s = (seed >>> 0) || 0x9e3779b9;
  };
  M.Rng.prototype.next = function () {
    this.s = (this.s + 0x6D2B79F5) >>> 0;
    var t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  M.Rng.prototype.range = function (a, b) { return a + this.next() * (b - a); };
  M.Rng.prototype.int = function (a, b) { return Math.floor(a + this.next() * (b - a + 1)); };
  M.Rng.prototype.pick = function (arr) { return arr[Math.floor(this.next() * arr.length) % arr.length]; };
  M.Rng.prototype.chance = function (p) { return this.next() < p; };
  M.Rng.prototype.sign = function () { return this.next() < 0.5 ? -1 : 1; };
  M.Rng.prototype.shuffle = function (arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(this.next() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };

  /* ---------------- value noise ---------------- */
  function hash2(x, y, seed) {
    var h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  M.hash2 = hash2;
  M.hash1 = function (x, seed) { return hash2(x, 0, seed || 0); };

  M.valueNoise2 = function (x, y, seed) {
    seed = seed || 0;
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
    var c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
    return M.lerp(M.lerp(a, b, u), M.lerp(c, d, u), v);
  };

  M.fbm2 = function (x, y, octaves, seed, lacunarity, gain) {
    lacunarity = lacunarity || 2.0; gain = gain === undefined ? 0.5 : gain;
    var amp = 1, freq = 1, sum = 0, norm = 0;
    for (var i = 0; i < (octaves || 4); i++) {
      sum += amp * M.valueNoise2(x * freq, y * freq, (seed || 0) + i * 1013);
      norm += amp; amp *= gain; freq *= lacunarity;
    }
    return sum / (norm || 1);
  };

  /* ridged noise, good for mountains */
  M.ridge2 = function (x, y, octaves, seed) {
    var amp = 1, freq = 1, sum = 0, norm = 0;
    for (var i = 0; i < (octaves || 4); i++) {
      var n = 1 - Math.abs(M.valueNoise2(x * freq, y * freq, (seed || 0) + i * 7717) * 2 - 1);
      sum += amp * n * n; norm += amp; amp *= 0.5; freq *= 2;
    }
    return sum / (norm || 1);
  };

  /* worley / cellular F1, returns distance to nearest feature point */
  M.worley2 = function (x, y, seed) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var best = 8;
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        var cx = xi + dx, cy = yi + dy;
        var px = cx + hash2(cx, cy, (seed || 0) + 1);
        var py = cy + hash2(cx, cy, (seed || 0) + 2);
        var d = (px - x) * (px - x) + (py - y) * (py - y);
        if (d < best) best = d;
      }
    }
    return Math.sqrt(best);
  };

  /* ---------------- geometry helpers ---------------- */
  M.pointInPolyXZ = function (px, pz, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
      var xi = poly[i], zi = poly[i + 1], xj = poly[j], zj = poly[j + 1];
      if (((zi > pz) !== (zj > pz)) && (px < (xj - xi) * (pz - zi) / (zj - zi) + xi)) inside = !inside;
    }
    return inside;
  };
  M.segClosestPoint = function (out, ax, az, bx, bz, px, pz) {
    var dx = bx - ax, dz = bz - az;
    var l2 = dx * dx + dz * dz;
    var t = l2 < M.EPS ? 0 : M.saturate(((px - ax) * dx + (pz - az) * dz) / l2);
    out[0] = ax + dx * t; out[1] = az + dz * t; out[2] = t;
    return out;
  };

  LZ.M = M;
  LZ.V3 = V3;
  LZ.M4 = M4;
})(LZ);
