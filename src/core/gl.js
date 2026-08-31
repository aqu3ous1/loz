/* =============================================================
   core/gl.js -- WebGL1 renderer emulating an N64 RDP pipeline.

   Everything is drawn into a 320x240 (configurable) framebuffer with a
   16-bit depth buffer, then blitted to the canvas with nearest-neighbour
   scaling. HUD included -- the whole frame is one low-res image, the way
   a real cartridge would output it.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';

  var M = LZ.M, M4 = LZ.M4, V3 = LZ.V3;

  /* vertex layout: pos(3) normal(3) uv(2) color(4) = 12 floats */
  var FLOATS_PER_VERT = 12;
  var STRIDE = FLOATS_PER_VERT * 4;

  /* ------------------------------------------------------------------ */
  /* Material                                                            */
  /* ------------------------------------------------------------------ */
  var DEFAULT_MAT = {
    texture: null,
    lit: true,
    fog: true,
    cull: 'back',        /* 'back' | 'front' | 'none' */
    blend: 'opaque',     /* 'opaque' | 'cutout' | 'alpha' | 'add' | 'sub' */
    depthTest: true,
    depthWrite: true,
    depthOffset: 0,      /* polygon offset units, for decals */
    prim: [1, 1, 1, 1],
    uv: [1, 1, 0, 0],
    filter3Point: true,
    alphaRef: 0,
    dither: true,
    tint: [0, 0, 0, 0],
    queue: 0             /* manual sort bias */
  };
  function material(o) {
    var m = {};
    for (var k in DEFAULT_MAT) m[k] = DEFAULT_MAT[k];
    if (o) for (var j in o) m[j] = o[j];
    return m;
  }

  /* ------------------------------------------------------------------ */
  /* Renderer                                                            */
  /* ------------------------------------------------------------------ */
  function Renderer(canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    var attrs = {
      alpha: false, antialias: false, depth: true, stencil: false,
      preserveDrawingBuffer: false, powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false
    };
    var gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs);
    if (!gl) throw new Error('WebGL is not available in this browser.');
    this.gl = gl;

    this.extUint = gl.getExtension('OES_element_index_uint');

    this.width = opts.width || 320;
    this.height = opts.height || 240;

    /* display options (mutated by the options menu) */
    this.opt = {
      scanline: 0.35,
      curvature: 0.0,
      bleed: 0.25,
      vignette: 0.22,
      dither: true,
      filter3Point: true,
      snapSubpixels: 2,     /* 0 = off, 1 = whole pixel, 2 = half, 4 = quarter */
      fogEnabled: true,
      integerScale: false
    };

    this.fade = [0, 0, 0, 0];

    this._buildPrograms();
    this._buildTargets();
    this._buildQuad();

    this.view = M4.create();
    this.proj = M4.create();
    this.viewProj = M4.create();
    this._mvp = M4.create();
    this._mv = M4.create();
    this._nrm = new Float32Array(9);
    this.camPos = V3.create(0, 0, 0);

    this.ambient = new Float32Array([0.42, 0.44, 0.52]);
    this.light0dir = new Float32Array([0.45, 0.78, 0.43]);
    this.light1dir = new Float32Array([-0.4, 0.35, -0.6]);
    this.light0col = new Float32Array([0.68, 0.64, 0.55]);
    this.light1col = new Float32Array([0.16, 0.18, 0.26]);
    this.fogColor = new Float32Array([0.55, 0.66, 0.82]);
    this.fogParams = new Float32Array([40, 120, 1.0]);

    this.drawCalls = 0;
    this.tris = 0;
    this._state = {};
    this._opaque = [];
    this._blended = [];
  }

  Renderer.prototype._compile = function (type, src) {
    var gl = this.gl;
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(sh);
      throw new Error('Shader compile failed:\n' + log + '\n---\n' + src);
    }
    return sh;
  };

  Renderer.prototype._program = function (vsSrc, fsSrc, attribs) {
    var gl = this.gl;
    var p = gl.createProgram();
    gl.attachShader(p, this._compile(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(p, this._compile(gl.FRAGMENT_SHADER, fsSrc));
    for (var i = 0; i < attribs.length; i++) gl.bindAttribLocation(p, i, attribs[i]);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('Program link failed: ' + gl.getProgramInfoLog(p));
    }
    var uniforms = {};
    var n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var u = 0; u < n; u++) {
      var info = gl.getActiveUniform(p, u);
      var name = info.name.replace(/\[0\]$/, '');
      uniforms[name] = gl.getUniformLocation(p, name);
    }
    return { prog: p, u: uniforms };
  };

  Renderer.prototype._buildPrograms = function () {
    var S = LZ.Shaders;
    this.scene = this._program(S.SCENE_VS, S.SCENE_FS, ['aPos', 'aNormal', 'aUV', 'aColor']);
    this.post = this._program(S.POST_VS, S.POST_FS, ['aPos']);
  };

  Renderer.prototype._buildTargets = function () {
    var gl = this.gl;
    if (this.fbo) {
      gl.deleteFramebuffer(this.fbo);
      gl.deleteTexture(this.fboTex);
      gl.deleteRenderbuffer(this.fboDepth);
    }
    this.fbo = gl.createFramebuffer();
    this.fboTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.fboTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.fboDepth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.fboDepth);
    /* DEPTH_COMPONENT16: the N64 had a 16-bit z-buffer, and we want its
       z-fighting personality, not a modern 24-bit one. */
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.width, this.height);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.fboTex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.fboDepth);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  Renderer.prototype._buildQuad = function () {
    var gl = this.gl;
    this.quadVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  };

  Renderer.prototype.setInternalResolution = function (w, h) {
    this.width = w; this.height = h;
    this._buildTargets();
  };

  /* ---------------- textures ---------------- */
  Renderer.prototype.createTexture = function (source, o) {
    o = o || {};
    var gl = this.gl;
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, o.flipY === undefined ? true : o.flipY);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    var w, h;
    if (source instanceof Uint8Array) {
      w = o.width; h = o.height;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
    } else {
      w = source.width; h = source.height;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    /* Always NEAREST: the 3-point filter is done in the fragment shader,
       so hardware filtering must stay out of the way. */
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    var wrap = o.wrap === 'clamp' ? gl.CLAMP_TO_EDGE : (o.wrap === 'mirror' ? gl.MIRRORED_REPEAT : gl.REPEAT);
    var isPow2 = ((w & (w - 1)) === 0) && ((h & (h - 1)) === 0);
    if (!isPow2) wrap = gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, o.wrapS ? (o.wrapS === 'clamp' ? gl.CLAMP_TO_EDGE : gl.REPEAT) : wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, o.wrapT ? (o.wrapT === 'clamp' ? gl.CLAMP_TO_EDGE : gl.REPEAT) : wrap);
    return { id: tex, width: w, height: h };
  };

  /* ---------------- meshes ---------------- */
  Renderer.prototype.createMesh = function (verts, indices, dynamic) {
    var gl = this.gl;
    var m = {
      vbo: gl.createBuffer(),
      ibo: gl.createBuffer(),
      count: indices ? indices.length : 0,
      dynamic: !!dynamic,
      indexType: gl.UNSIGNED_SHORT,
      vertCapacity: 0,
      idxCapacity: 0
    };
    this.updateMesh(m, verts, indices);
    return m;
  };

  Renderer.prototype.updateMesh = function (m, verts, indices) {
    var gl = this.gl;
    var usage = m.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW;
    gl.bindBuffer(gl.ARRAY_BUFFER, m.vbo);
    if (m.dynamic && verts.length <= m.vertCapacity) {
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, verts);
    } else {
      gl.bufferData(gl.ARRAY_BUFFER, verts, usage);
      m.vertCapacity = verts.length;
    }
    if (indices) {
      var arr = indices;
      if (!(arr instanceof Uint16Array) && !(arr instanceof Uint32Array)) {
        var max = 0;
        for (var i = 0; i < arr.length; i++) if (arr[i] > max) max = arr[i];
        arr = (max > 65535 && this.extUint) ? new Uint32Array(arr) : new Uint16Array(arr);
      }
      m.indexType = (arr instanceof Uint32Array) ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ibo);
      if (m.dynamic && arr.length <= m.idxCapacity) {
        gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, arr);
      } else {
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, arr, usage);
        m.idxCapacity = arr.length;
      }
      m.count = arr.length;
    }
    return m;
  };

  Renderer.prototype.destroyMesh = function (m) {
    if (!m) return;
    this.gl.deleteBuffer(m.vbo);
    this.gl.deleteBuffer(m.ibo);
  };

  /* ---------------- camera / environment ---------------- */
  Renderer.prototype.setCamera = function (view, proj, eye) {
    M4.copy(this.view, view);
    M4.copy(this.proj, proj);
    M4.multiply(this.viewProj, proj, view);
    if (eye) V3.copy(this.camPos, eye);
  };

  Renderer.prototype.setFog = function (color, near, far, density) {
    this.fogColor[0] = color[0]; this.fogColor[1] = color[1]; this.fogColor[2] = color[2];
    this.fogParams[0] = near; this.fogParams[1] = far;
    this.fogParams[2] = density === undefined ? 1 : density;
  };

  Renderer.prototype.setLights = function (ambient, l0dir, l0col, l1dir, l1col) {
    this.ambient.set(ambient);
    V3.normalize(this.light0dir, l0dir); this.light0col.set(l0col);
    V3.normalize(this.light1dir, l1dir); this.light1col.set(l1col);
  };

  /* ---------------- frame ---------------- */
  Renderer.prototype.beginFrame = function (clearColor) {
    var gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.width, this.height);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    var c = clearColor || this.fogColor;
    gl.clearColor(c[0], c[1], c[2], 1);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this.drawCalls = 0;
    this.tris = 0;
    this._opaque.length = 0;
    this._blended.length = 0;
    this._state = {};
    this._boundProgram = null;
  };

  /* queue a draw; matrices are copied so callers may reuse scratch */
  var _tmpPos = V3.create(0, 0, 0);
  Renderer.prototype.submit = function (mesh, matrix, mat) {
    if (!mesh || !mesh.count) return;
    mat = mat || DEFAULT_MAT;
    var item = { mesh: mesh, m: matrix, mat: mat, depth: 0 };
    if (mat.blend === 'opaque' || mat.blend === 'cutout') {
      this._opaque.push(item);
    } else {
      M4.getTranslation(_tmpPos, matrix);
      item.depth = V3.dist2(_tmpPos, this.camPos);
      this._blended.push(item);
    }
  };

  Renderer.prototype._applyState = function (mat) {
    var gl = this.gl, st = this._state;
    if (st.cull !== mat.cull) {
      if (mat.cull === 'none') gl.disable(gl.CULL_FACE);
      else { gl.enable(gl.CULL_FACE); gl.cullFace(mat.cull === 'front' ? gl.FRONT : gl.BACK); }
      st.cull = mat.cull;
    }
    if (st.blend !== mat.blend) {
      if (mat.blend === 'opaque' || mat.blend === 'cutout') {
        gl.disable(gl.BLEND);
      } else {
        gl.enable(gl.BLEND);
        if (mat.blend === 'add') gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        else if (mat.blend === 'sub') { gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR); }
        else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }
      st.blend = mat.blend;
    }
    if (st.depthTest !== mat.depthTest) {
      if (mat.depthTest) gl.enable(gl.DEPTH_TEST); else gl.disable(gl.DEPTH_TEST);
      st.depthTest = mat.depthTest;
    }
    if (st.depthWrite !== mat.depthWrite) { gl.depthMask(!!mat.depthWrite); st.depthWrite = mat.depthWrite; }
    if (st.depthOffset !== mat.depthOffset) {
      if (mat.depthOffset) { gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(mat.depthOffset, mat.depthOffset); }
      else gl.disable(gl.POLYGON_OFFSET_FILL);
      st.depthOffset = mat.depthOffset;
    }
  };

  Renderer.prototype._drawItem = function (item) {
    var gl = this.gl, u = this.scene.u, mat = item.mat;
    this._applyState(mat);

    M4.multiply(this._mvp, this.viewProj, item.m);
    M4.multiply(this._mv, this.view, item.m);
    M4.normalMat3(this._nrm, item.m);

    gl.uniformMatrix4fv(u.uMVP, false, this._mvp);
    gl.uniformMatrix4fv(u.uMV, false, this._mv);
    gl.uniformMatrix3fv(u.uNormalMat, false, this._nrm);
    gl.uniform1f(u.uLit, mat.lit ? 1 : 0);
    gl.uniform4f(u.uPrimColor, mat.prim[0], mat.prim[1], mat.prim[2], mat.prim[3]);
    gl.uniform4f(u.uUVTransform, mat.uv[0], mat.uv[1], mat.uv[2], mat.uv[3]);
    gl.uniform4f(u.uTintColor, mat.tint[0], mat.tint[1], mat.tint[2], mat.tint[3]);
    gl.uniform1f(u.uAlphaRef, mat.blend === 'cutout' ? (mat.alphaRef || 0.5) : (mat.alphaRef || 0.004));
    gl.uniform1f(u.uDither, (this.opt.dither && mat.dither) ? 1 : 0);
    var fogOn = this.opt.fogEnabled && mat.fog;
    gl.uniform3f(u.uFogParams, this.fogParams[0], this.fogParams[1], fogOn ? this.fogParams[2] : 0);

    if (mat.texture) {
      gl.uniform1f(u.uUseTex, 1);
      gl.uniform2f(u.uTexSize, mat.texture.width, mat.texture.height);
      gl.uniform1f(u.uFilter3Point, (this.opt.filter3Point && mat.filter3Point) ? 1 : 0);
      if (this._boundTex !== mat.texture.id) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, mat.texture.id);
        this._boundTex = mat.texture.id;
      }
    } else {
      gl.uniform1f(u.uUseTex, 0);
    }

    var mesh = item.mesh;
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, STRIDE, 0);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, STRIDE, 12);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, STRIDE, 24);
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, STRIDE, 32);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
    gl.drawElements(gl.TRIANGLES, mesh.count, mesh.indexType, 0);
    this.drawCalls++;
    this.tris += mesh.count / 3;
  };

  Renderer.prototype.flush = function () {
    var gl = this.gl;
    gl.useProgram(this.scene.prog);
    this._boundProgram = this.scene.prog;
    this._boundTex = null;
    for (var i = 0; i < 4; i++) gl.enableVertexAttribArray(i);
    var u = this.scene.u;
    gl.uniform1i(u.uTex, 0);
    gl.uniform3fv(u.uAmbient, this.ambient);
    gl.uniform3fv(u.uLight0Dir, this.light0dir);
    gl.uniform3fv(u.uLight0Color, this.light0col);
    gl.uniform3fv(u.uLight1Dir, this.light1dir);
    gl.uniform3fv(u.uLight1Color, this.light1col);
    gl.uniform3fv(u.uFogColor, this.fogColor);
    var snap = this.opt.snapSubpixels;
    if (snap > 0) gl.uniform2f(u.uSnapGrid, this.width / snap, this.height / snap);
    else gl.uniform2f(u.uSnapGrid, 0, 0);

    /* opaque: group by texture to cut binds, roughly front-to-back */
    this._opaque.sort(function (a, b) {
      if (a.mat.queue !== b.mat.queue) return a.mat.queue - b.mat.queue;
      var ta = a.mat.texture ? a.mat.texture.id : null;
      var tb = b.mat.texture ? b.mat.texture.id : null;
      if (ta === tb) return 0;
      return ta < tb ? -1 : 1;
    });
    for (var i2 = 0; i2 < this._opaque.length; i2++) this._drawItem(this._opaque[i2]);

    /* transparent: strictly back-to-front */
    this._blended.sort(function (a, b) {
      if (a.mat.queue !== b.mat.queue) return a.mat.queue - b.mat.queue;
      return b.depth - a.depth;
    });
    for (var i3 = 0; i3 < this._blended.length; i3++) this._drawItem(this._blended[i3]);

    this._opaque.length = 0;
    this._blended.length = 0;
  };

  /* draws whatever is queued, then composites to the canvas */
  Renderer.prototype.present = function () {
    this.flush();
    var gl = this.gl;
    var cw = this.canvas.width, ch = this.canvas.height;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cw, ch);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.useProgram(this.post.prog);
    var u = this.post.u;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fboTex);
    gl.uniform1i(u.uTex, 0);
    gl.uniform2f(u.uTexSize, this.width, this.height);
    gl.uniform2f(u.uOutSize, cw, ch);
    gl.uniform1f(u.uScanline, this.opt.scanline);
    gl.uniform1f(u.uCurvature, this.opt.curvature);
    gl.uniform1f(u.uBleed, this.opt.bleed);
    gl.uniform1f(u.uVignette, this.opt.vignette);
    gl.uniform4f(u.uFade, this.fade[0], this.fade[1], this.fade[2], this.fade[3]);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
    gl.enableVertexAttribArray(0);
    for (var i = 1; i < 4; i++) gl.disableVertexAttribArray(i);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  /* ------------------------------------------------------------------ */
  /* Mesh builder                                                        */
  /* ------------------------------------------------------------------ */
  function MeshBuilder() {
    this.v = [];
    this.i = [];
    this.color = [1, 1, 1, 1];
    this._mat = null;
  }
  MeshBuilder.prototype.setColor = function (r, g, b, a) {
    this.color[0] = r; this.color[1] = g; this.color[2] = b; this.color[3] = a === undefined ? 1 : a;
    return this;
  };
  MeshBuilder.prototype.setColorHex = function (hex, a) {
    this.color[0] = ((hex >> 16) & 255) / 255;
    this.color[1] = ((hex >> 8) & 255) / 255;
    this.color[2] = (hex & 255) / 255;
    this.color[3] = a === undefined ? 1 : a;
    return this;
  };
  MeshBuilder.prototype.setMatrix = function (m) { this._mat = m; return this; };
  MeshBuilder.prototype.vertexCount = function () { return this.v.length / FLOATS_PER_VERT; };

  var _vp = V3.create(0, 0, 0), _vn = V3.create(0, 0, 0);
  MeshBuilder.prototype.vert = function (x, y, z, nx, ny, nz, u, vv, col) {
    if (this._mat) {
      V3.set(_vp, x, y, z); V3.transformMat4(_vp, _vp, this._mat);
      V3.set(_vn, nx, ny, nz); V3.transformDir(_vn, _vn, this._mat); V3.normalize(_vn, _vn);
      x = _vp[0]; y = _vp[1]; z = _vp[2];
      nx = _vn[0]; ny = _vn[1]; nz = _vn[2];
    }
    var c = col || this.color;
    this.v.push(x, y, z, nx, ny, nz, u, vv, c[0], c[1], c[2], c[3]);
    return this.v.length / FLOATS_PER_VERT - 1;
  };
  MeshBuilder.prototype.tri = function (a, b, c) { this.i.push(a, b, c); return this; };
  MeshBuilder.prototype.quadIdx = function (a, b, c, d) { this.i.push(a, b, c, a, c, d); return this; };

  /* a flat quad from 4 corners; normal computed from the winding */
  MeshBuilder.prototype.quad = function (p0, p1, p2, p3, uvScale, colors) {
    var ux = uvScale === undefined ? 1 : uvScale;
    var uy = ux;
    if (uvScale && uvScale.length === 2) { ux = uvScale[0]; uy = uvScale[1]; }
    var e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    var e2 = [p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]];
    var n = V3.create(0, 0, 0);
    V3.cross(n, e1, e2); V3.normalize(n, n);
    var a = this.vert(p0[0], p0[1], p0[2], n[0], n[1], n[2], 0, 0, colors && colors[0]);
    var b = this.vert(p1[0], p1[1], p1[2], n[0], n[1], n[2], ux, 0, colors && colors[1]);
    var c = this.vert(p2[0], p2[1], p2[2], n[0], n[1], n[2], ux, uy, colors && colors[2]);
    var d = this.vert(p3[0], p3[1], p3[2], n[0], n[1], n[2], 0, uy, colors && colors[3]);
    this.quadIdx(a, b, c, d);
    return this;
  };

  /* axis-aligned box centred at (cx,cy,cz) */
  MeshBuilder.prototype.box = function (cx, cy, cz, sx, sy, sz, uvScale) {
    var hx = sx / 2, hy = sy / 2, hz = sz / 2;
    var x0 = cx - hx, x1 = cx + hx, y0 = cy - hy, y1 = cy + hy, z0 = cz - hz, z1 = cz + hz;
    var us = uvScale === undefined ? 1 : uvScale;
    var uxz = (us === 'fit') ? 1 : us;
    function s(a, b) { return (us === 'fit') ? 1 : us * a; }
    /* +Z */ this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [s(sx), s(sy)]);
    /* -Z */ this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [s(sx), s(sy)]);
    /* +X */ this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [s(sz), s(sy)]);
    /* -X */ this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [s(sz), s(sy)]);
    /* +Y */ this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [s(sx), s(sz)]);
    /* -Y */ this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [s(sx), s(sz)]);
    return this;
  };

  /* tapered prism: a box whose top face can be a different size/offset.
     This is the workhorse for low-poly limbs, roofs, rocks. */
  MeshBuilder.prototype.taper = function (cx, cy, cz, sxb, szb, sxt, szt, h, ox, oz, uvScale) {
    ox = ox || 0; oz = oz || 0;
    var us = uvScale === undefined ? 1 : uvScale;
    var y0 = cy, y1 = cy + h;
    var bx = sxb / 2, bz = szb / 2, tx = sxt / 2, tz = szt / 2;
    var B = [
      [cx - bx, y0, cz + bz], [cx + bx, y0, cz + bz], [cx + bx, y0, cz - bz], [cx - bx, y0, cz - bz]
    ];
    var T = [
      [cx - tx + ox, y1, cz + tz + oz], [cx + tx + ox, y1, cz + tz + oz],
      [cx + tx + ox, y1, cz - tz + oz], [cx - tx + ox, y1, cz - tz + oz]
    ];
    this.quad(B[0], B[1], T[1], T[0], [us * sxb, us * h]);
    this.quad(B[1], B[2], T[2], T[1], [us * szb, us * h]);
    this.quad(B[2], B[3], T[3], T[2], [us * sxb, us * h]);
    this.quad(B[3], B[0], T[0], T[3], [us * szb, us * h]);
    this.quad(T[0], T[1], T[2], T[3], [us * sxt, us * szt]);
    this.quad(B[3], B[2], B[1], B[0], [us * sxb, us * szb]);
    return this;
  };

  /* N-sided cylinder / cone / drum */
  MeshBuilder.prototype.cylinder = function (cx, cy, cz, rBottom, rTop, h, sides, caps, uvScale) {
    sides = sides || 6;
    var us = uvScale === undefined ? 1 : uvScale;
    var ringB = [], ringT = [];
    var i, a;
    for (i = 0; i <= sides; i++) {
      a = i / sides * M.TAU;
      var sa = Math.sin(a), ca = Math.cos(a);
      var nx = sa, nz = ca;
      var u = i / sides * us * Math.max(rBottom, rTop) * 3;
      ringB.push(this.vert(cx + sa * rBottom, cy, cz + ca * rBottom, nx, 0.15, nz, u, 0));
      ringT.push(this.vert(cx + sa * rTop, cy + h, cz + ca * rTop, nx, 0.15, nz, u, us * h));
    }
    for (i = 0; i < sides; i++) {
      this.i.push(ringB[i], ringB[i + 1], ringT[i + 1]);
      this.i.push(ringB[i], ringT[i + 1], ringT[i]);
    }
    if (caps !== false) {
      var ct, cb, k;
      if (rTop > 0.001) {
        ct = this.vert(cx, cy + h, cz, 0, 1, 0, 0.5, 0.5);
        var tv = [];
        for (i = 0; i <= sides; i++) {
          a = i / sides * M.TAU;
          tv.push(this.vert(cx + Math.sin(a) * rTop, cy + h, cz + Math.cos(a) * rTop, 0, 1, 0,
            0.5 + Math.sin(a) * 0.5, 0.5 + Math.cos(a) * 0.5));
        }
        for (k = 0; k < sides; k++) this.i.push(ct, tv[k], tv[k + 1]);
      }
      if (rBottom > 0.001) {
        cb = this.vert(cx, cy, cz, 0, -1, 0, 0.5, 0.5);
        var bv = [];
        for (i = 0; i <= sides; i++) {
          a = i / sides * M.TAU;
          bv.push(this.vert(cx + Math.sin(a) * rBottom, cy, cz + Math.cos(a) * rBottom, 0, -1, 0,
            0.5 + Math.sin(a) * 0.5, 0.5 + Math.cos(a) * 0.5));
        }
        for (k = 0; k < sides; k++) this.i.push(cb, bv[k + 1], bv[k]);
      }
    }
    return this;
  };

  /* low-poly sphere (icosphere-ish via lat/long, kept coarse on purpose) */
  MeshBuilder.prototype.sphere = function (cx, cy, cz, r, segs, rings, squashY) {
    segs = segs || 8; rings = rings || 5; squashY = squashY || 1;
    var grid = [];
    for (var y = 0; y <= rings; y++) {
      var row = [];
      var phi = y / rings * Math.PI;
      var sy = Math.cos(phi), sr = Math.sin(phi);
      for (var x = 0; x <= segs; x++) {
        var theta = x / segs * M.TAU;
        var nx = Math.sin(theta) * sr, ny = sy, nz = Math.cos(theta) * sr;
        row.push(this.vert(cx + nx * r, cy + ny * r * squashY, cz + nz * r, nx, ny / squashY, nz,
          x / segs, y / rings));
      }
      grid.push(row);
    }
    for (var yy = 0; yy < rings; yy++) {
      for (var xx = 0; xx < segs; xx++) {
        var a = grid[yy][xx], b = grid[yy][xx + 1], c = grid[yy + 1][xx + 1], d = grid[yy + 1][xx];
        if (yy !== 0) this.i.push(a, c, b);
        if (yy !== rings - 1) this.i.push(a, d, c);
      }
    }
    return this;
  };

  /* two crossed vertical quads -- the classic N64 foliage/grass billboard */
  MeshBuilder.prototype.cross = function (cx, cy, cz, w, h, planes) {
    planes = planes || 2;
    for (var p = 0; p < planes; p++) {
      var a = p / planes * Math.PI;
      var dx = Math.sin(a) * w / 2, dz = Math.cos(a) * w / 2;
      var n = [Math.sin(a + Math.PI / 2), 0.4, Math.cos(a + Math.PI / 2)];
      V3.normalize(n, n);
      var i0 = this.vert(cx - dx, cy, cz - dz, n[0], n[1], n[2], 0, 1);
      var i1 = this.vert(cx + dx, cy, cz + dz, n[0], n[1], n[2], 1, 1);
      var i2 = this.vert(cx + dx, cy + h, cz + dz, n[0], n[1], n[2], 1, 0);
      var i3 = this.vert(cx - dx, cy + h, cz - dz, n[0], n[1], n[2], 0, 0);
      this.quadIdx(i0, i1, i2, i3);
      this.quadIdx(i1, i0, i3, i2);
    }
    return this;
  };

  MeshBuilder.prototype.append = function (other, matrix) {
    var base = this.v.length / FLOATS_PER_VERT;
    var i;
    if (!matrix) {
      for (i = 0; i < other.v.length; i++) this.v.push(other.v[i]);
    } else {
      for (i = 0; i < other.v.length; i += FLOATS_PER_VERT) {
        V3.set(_vp, other.v[i], other.v[i + 1], other.v[i + 2]);
        V3.transformMat4(_vp, _vp, matrix);
        V3.set(_vn, other.v[i + 3], other.v[i + 4], other.v[i + 5]);
        V3.transformDir(_vn, _vn, matrix); V3.normalize(_vn, _vn);
        this.v.push(_vp[0], _vp[1], _vp[2], _vn[0], _vn[1], _vn[2],
          other.v[i + 6], other.v[i + 7], other.v[i + 8], other.v[i + 9], other.v[i + 10], other.v[i + 11]);
      }
    }
    for (i = 0; i < other.i.length; i++) this.i.push(other.i[i] + base);
    return this;
  };

  /* bake per-vertex ambient occlusion from height: cheap but effective */
  MeshBuilder.prototype.shadeByHeight = function (y0, y1, dark, light) {
    for (var i = 0; i < this.v.length; i += FLOATS_PER_VERT) {
      var t = M.saturate((this.v[i + 1] - y0) / (y1 - y0 || 1));
      var f = M.lerp(dark, light, t);
      this.v[i + 8] *= f; this.v[i + 9] *= f; this.v[i + 10] *= f;
    }
    return this;
  };

  MeshBuilder.prototype.bounds = function () {
    var mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (var i = 0; i < this.v.length; i += FLOATS_PER_VERT) {
      for (var k = 0; k < 3; k++) {
        if (this.v[i + k] < mn[k]) mn[k] = this.v[i + k];
        if (this.v[i + k] > mx[k]) mx[k] = this.v[i + k];
      }
    }
    return { min: mn, max: mx };
  };

  MeshBuilder.prototype.build = function (renderer, dynamic) {
    return renderer.createMesh(new Float32Array(this.v), this.i, dynamic);
  };

  LZ.GL = {
    Renderer: Renderer,
    MeshBuilder: MeshBuilder,
    material: material,
    FLOATS_PER_VERT: FLOATS_PER_VERT,
    STRIDE: STRIDE
  };
})(LZ);

/* --- overlay draw path used by the 2D batcher (declared after GL is set up) --- */
(function (LZ) {
  'use strict';
  var M4 = LZ.M4;
  var _ident = M4.create();
  LZ.GL.Renderer.prototype.drawOverlay = function (mesh, mat, ortho) {
    var gl = this.gl;
    if (this._boundProgram !== this.scene.prog) {
      gl.useProgram(this.scene.prog);
      this._boundProgram = this.scene.prog;
      this._boundTex = null;
      this._state = {};
      for (var i = 0; i < 4; i++) gl.enableVertexAttribArray(i);
      gl.uniform1i(this.scene.u.uTex, 0);
    }
    var u = this.scene.u;
    gl.uniformMatrix4fv(u.uMVP, false, ortho);
    gl.uniformMatrix4fv(u.uMV, false, _ident);
    gl.uniform2f(u.uSnapGrid, 0, 0);
    gl.uniform3f(u.uFogParams, 0, 1, 0);
    this._drawItem({ mesh: mesh, m: _ident, mat: mat });
    /* restore for any subsequent 3D work */
    gl.uniformMatrix4fv(u.uMVP, false, this.viewProj);
  };
})(LZ);
