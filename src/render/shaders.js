/* =============================================================
   render/shaders.js -- GLSL for the N64-alike pipeline.

   Authenticity notes (what the real hardware did, and what we do):
     * RDP output was RGBA5551 with an ordered dither -> we quantise to
       31 levels per channel using a 4x4 Bayer matrix.
     * The RDP's bilinear unit was a 3-point (triangular) filter, not a
       true bilinear box. It has a characteristic diagonal seam. We
       reproduce it exactly.
     * Lighting was computed per-vertex on the RSP (max 7 directional
       lights + ambient), never per-pixel. No specular.
     * Fog was a per-vertex factor fed into the colour combiner.
     * The RSP transformed in fixed point and screen coords landed on a
       1/4 pixel grid -> optional vertex snapping.
     * Textures lived in 4KB of TMEM, so 32x32 and 64x64 were the norm.
   ============================================================= */
var LZ = LZ || {};
(function (LZ) {
  'use strict';

  var S = {};

  S.SCENE_VS = [
    'precision highp float;',
    'attribute vec3 aPos;',
    'attribute vec3 aNormal;',
    'attribute vec2 aUV;',
    'attribute vec4 aColor;',
    '',
    'uniform mat4 uMVP;',
    'uniform mat4 uMV;',
    'uniform mat3 uNormalMat;',
    'uniform vec2 uSnapGrid;',      /* 0 = disabled */
    'uniform vec3 uAmbient;',
    'uniform vec3 uLight0Dir;',
    'uniform vec3 uLight0Color;',
    'uniform vec3 uLight1Dir;',
    'uniform vec3 uLight1Color;',
    'uniform float uLit;',          /* 1 = vertex lighting on */
    'uniform vec3 uFogParams;',     /* near, far, maxDensity */
    'uniform vec4 uUVTransform;',   /* scale.xy, offset.xy */
    '',
    'varying vec2 vUV;',
    'varying vec4 vColor;',
    'varying float vFog;',
    '',
    'void main() {',
    '  vec4 clip = uMVP * vec4(aPos, 1.0);',
    '  if (uSnapGrid.x > 0.0 && clip.w > 0.0) {',
    '    vec2 ndc = clip.xy / clip.w;',
    '    vec2 half_ = uSnapGrid * 0.5;',
    '    ndc = floor(ndc * half_ + 0.5) / half_;',
    '    clip.xy = ndc * clip.w;',
    '  }',
    '  gl_Position = clip;',
    '',
    '  vec3 shade = vec3(1.0);',
    '  if (uLit > 0.5) {',
    '    vec3 n = normalize(uNormalMat * aNormal);',
    '    shade = uAmbient;',
    '    shade += uLight0Color * max(dot(n, uLight0Dir), 0.0);',
    '    shade += uLight1Color * max(dot(n, uLight1Dir), 0.0);',
    '    shade = min(shade, vec3(1.6));',
    '  }',
    '  vColor = vec4(aColor.rgb * shade, aColor.a);',
    '',
    '  float viewZ = -(uMV * vec4(aPos, 1.0)).z;',
    '  vFog = clamp((viewZ - uFogParams.x) / max(uFogParams.y - uFogParams.x, 0.001), 0.0, 1.0) * uFogParams.z;',
    '',
    '  vUV = aUV * uUVTransform.xy + uUVTransform.zw;',
    '}'
  ].join('\n');

  S.SCENE_FS = [
    'precision highp float;',
    'varying vec2 vUV;',
    'varying vec4 vColor;',
    'varying float vFog;',
    '',
    'uniform sampler2D uTex;',
    'uniform vec2 uTexSize;',
    'uniform float uUseTex;',
    'uniform float uFilter3Point;',
    'uniform vec4 uPrimColor;',
    'uniform vec3 uFogColor;',
    'uniform float uAlphaRef;',
    'uniform float uDither;',
    'uniform vec4 uTintColor;',   /* rgb + amount, for damage flash / freeze */
    '',
    /* ---- N64 RDP 3-point (triangular) texture filter ---- */
    'vec4 tex3Point(vec2 uv) {',
    '  vec2 st = uv * uTexSize - 0.5;',
    '  vec2 fl = floor(st);',
    '  vec2 f  = st - fl;',
    '  vec2 base = (fl + 0.5) / uTexSize;',
    '  vec2 dx = vec2(1.0 / uTexSize.x, 0.0);',
    '  vec2 dy = vec2(0.0, 1.0 / uTexSize.y);',
    '  vec4 c00 = texture2D(uTex, base);',
    '  vec4 c10 = texture2D(uTex, base + dx);',
    '  vec4 c01 = texture2D(uTex, base + dy);',
    '  vec4 c11 = texture2D(uTex, base + dx + dy);',
    '  if (f.x + f.y < 1.0) {',
    '    return c00 + (c10 - c00) * f.x + (c01 - c00) * f.y;',
    '  }',
    '  return c11 + (c01 - c11) * (1.0 - f.x) + (c10 - c11) * (1.0 - f.y);',
    '}',
    '',
    /* ---- 4x4 ordered Bayer, computed without array lookups ---- */
    'float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }',
    'float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }',
    '',
    'void main() {',
    '  vec4 texel = vec4(1.0);',
    '  if (uUseTex > 0.5) {',
    '    texel = (uFilter3Point > 0.5) ? tex3Point(vUV) : texture2D(uTex, vUV);',
    '  }',
    '  vec4 c = texel * vColor * uPrimColor;',
    '  if (c.a < uAlphaRef) discard;',
    '  c.rgb = mix(c.rgb, uFogColor, vFog);',
    '  c.rgb = mix(c.rgb, uTintColor.rgb, uTintColor.a);',
    '  if (uDither > 0.5) {',
    '    float d = (bayer4(gl_FragCoord.xy) - 0.5) / 31.0;',
    '    c.rgb = floor(clamp(c.rgb + d, 0.0, 1.0) * 31.0 + 0.5) / 31.0;',
    '  } else {',
    '    c.rgb = clamp(c.rgb, 0.0, 1.0);',
    '  }',
    '  gl_FragColor = c;',
    '}'
  ].join('\n');

  /* ---- fullscreen composite: nearest upscale + CRT-ish options ---- */
  S.POST_VS = [
    'precision highp float;',
    'attribute vec2 aPos;',
    'varying vec2 vUV;',
    'void main() {',
    '  vUV = aPos * 0.5 + 0.5;',
    '  gl_Position = vec4(aPos, 0.0, 1.0);',
    '}'
  ].join('\n');

  S.POST_FS = [
    'precision highp float;',
    'varying vec2 vUV;',
    'uniform sampler2D uTex;',
    'uniform vec2 uTexSize;',
    'uniform vec2 uOutSize;',
    'uniform float uScanline;',
    'uniform float uCurvature;',
    'uniform float uBleed;',
    'uniform vec4 uFade;',        /* rgb + amount */
    'uniform float uVignette;',
    '',
    'vec2 curve(vec2 uv) {',
    '  if (uCurvature <= 0.0) return uv;',
    '  uv = uv * 2.0 - 1.0;',
    '  vec2 off = abs(uv.yx) / vec2(6.0, 4.0);',
    '  uv += uv * off * off * uCurvature;',
    '  return uv * 0.5 + 0.5;',
    '}',
    '',
    'void main() {',
    '  vec2 uv = curve(vUV);',
    '  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {',
    '    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return;',
    '  }',
    '  vec3 c = texture2D(uTex, uv).rgb;',
    '  if (uBleed > 0.0) {',
    /* composite-video style horizontal smear, tuned to be subtle */
    '    vec2 px = vec2(1.0 / uTexSize.x, 0.0);',
    '    vec3 l1 = texture2D(uTex, uv - px).rgb;',
    '    vec3 l2 = texture2D(uTex, uv - px * 2.0).rgb;',
    '    vec3 r1 = texture2D(uTex, uv + px).rgb;',
    '    vec3 smear = (l1 * 0.35 + l2 * 0.15 + r1 * 0.2 + c * 0.3);',
    '    c = mix(c, smear, uBleed);',
    '  }',
    '  if (uScanline > 0.0) {',
    '    float s = sin(uv.y * uTexSize.y * 3.14159265);',
    '    c *= mix(1.0, 0.55 + 0.45 * s * s, uScanline);',
    '  }',
    '  if (uVignette > 0.0) {',
    '    vec2 d = vUV - 0.5;',
    '    c *= 1.0 - uVignette * dot(d, d) * 1.6;',
    '  }',
    '  c = mix(c, uFade.rgb, uFade.a);',
    '  gl_FragColor = vec4(c, 1.0);',
    '}'
  ].join('\n');

  LZ.Shaders = S;
})(LZ);
