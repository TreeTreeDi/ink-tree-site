/**
 * Custom GLSL shaders written from scratch for ink-tree-site.
 * Designed for WebGL1/WebGL2 compatibility (including headless SwiftShader).
 */

const GLSL_NOISE = /* glsl */ `
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = rot * p * 2.04 + vec2(17.1, 31.7);
    a *= 0.5;
  }
  return v;
}
`;

export const PAPER_BG_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const PAPER_BG_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec2 uResolution;
uniform vec2 uPanOffset;
${GLSL_NOISE}

void main() {
  vec2 px = vUv * uResolution + uPanOffset;
  float fine = vnoise(px * 0.65);
  float fiber = fbm(px * 0.08);
  vec3 base = vec3(0.1647, 0.1569, 0.1725); // #2a282c
  float delta = (fine - 0.5) * 0.016 + (fiber - 0.5) * 0.012;
  gl_FragColor = vec4(base + delta, 1.0);
}
`;

export const TORN_FRAME_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const TORN_FRAME_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec2 uResolution;
uniform float uPixelRatio;
${GLSL_NOISE}

float tornMarginDist(vec2 pCss, vec2 sizeCss, float marginCss) {
  float dLeft = pCss.x - marginCss;
  float dRight = (sizeCss.x - marginCss) - pCss.x;
  float dTop = pCss.y - marginCss;
  float dBottom = (sizeCss.y - marginCss) - pCss.y;

  // Multi-frequency irregular deckled tear edge in CSS px
  float tearX =
    (fbm(vec2(pCss.y * 0.045, 3.1)) - 0.5) * 4.4 +
    (vnoise(vec2(pCss.y * 0.28, 9.2)) - 0.5) * 1.9 +
    (vnoise(vec2(pCss.y * 0.9, 2.7)) - 0.5) * 0.9;
  float tearY =
    (fbm(vec2(pCss.x * 0.045, 7.7)) - 0.5) * 4.4 +
    (vnoise(vec2(pCss.x * 0.28, 1.4)) - 0.5) * 1.9 +
    (vnoise(vec2(pCss.x * 0.9, 6.3)) - 0.5) * 0.9;

  dLeft += tearX;
  dRight -= tearX;
  dTop += tearY;
  dBottom -= tearY;

  return min(min(dLeft, dRight), min(dTop, dBottom));
}

void main() {
  float dpr = max(1.0, uPixelRatio);
  vec2 sizeCss = uResolution / dpr;
  vec2 pTopCss = vec2(vUv.x * sizeCss.x, (1.0 - vUv.y) * sizeCss.y);

  float marginCss = clamp(min(sizeCss.x, sizeCss.y) * 0.0155, 8.0, 13.5);
  float d = tornMarginDist(pTopCss, sizeCss, marginCss);

  vec3 surroundCol = vec3(0.064, 0.060, 0.068); // ~#100f11 darker outer mount
  vec3 cutRimCol = vec3(0.046, 0.043, 0.050);
  vec3 bevelCol = vec3(0.058, 0.054, 0.064);

  float grain = (vnoise(pTopCss * 0.85) - 0.5) * 0.014;

  if (d < 0.0) {
    // Down-right sheet drop shadow cast onto outer surround
    float shadowDist = tornMarginDist(pTopCss - vec2(4.0, 5.0), sizeCss, marginCss);
    float castShadow = smoothstep(-9.0, 0.4, shadowDist) * 0.48;
    vec3 col = mix(surroundCol, vec3(0.025, 0.023, 0.028), castShadow);
    gl_FragColor = vec4(col + grain, 1.0);
    return;
  }

  // Crisp torn outer edge cut line (0..1.6px)
  float cutLine = 1.0 - smoothstep(0.35, 1.65, d);

  // Directional bevel: stronger down-right inner depth, subtle lighter top-left paper catch
  float brBias = clamp((pTopCss.x / sizeCss.x) * 0.5 + (pTopCss.y / sizeCss.y) * 0.5, 0.0, 1.0);
  float bevelWidth = clamp(marginCss * 1.38, 12.0, 18.5);
  float bevel = pow(1.0 - clamp(d / bevelWidth, 0.0, 1.0), 1.55) * mix(0.58, 0.80, brBias);

  // Subtle ~1px top-left paper highlight bevel inside the cut edge
  float tlHighlight =
    (1.0 - brBias) *
    smoothstep(0.8, 2.0, d) *
    (1.0 - smoothstep(2.0, 4.2, d)) *
    0.16;

  float alpha = max(cutLine * 0.96, bevel);
  vec3 col = mix(bevelCol, cutRimCol, cutLine);
  col = mix(col, vec3(0.24, 0.23, 0.26), tlHighlight);

  if (alpha < 0.005) {
    discard;
  }
  gl_FragColor = vec4(col + grain * 0.5, alpha);
}
`;

export const INK_STROKE_VERT = /* glsl */ `
varying vec2 vUv;
varying vec2 vWorld;
uniform float uTime;
uniform float uSwayAmp;
uniform float uSwayPhase;
uniform float uReducedMotion;

void main() {
  vUv = uv;
  vec3 pos = position;
  if (uSwayAmp > 0.0001 && uReducedMotion < 0.5) {
    float sway = sin(uTime * 1.35 + uSwayPhase + pos.x * 0.02) * uSwayAmp * pow(uv.x, 1.4);
    pos.x += sway;
    pos.y += sway * 0.25;
  }
  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vWorld = worldPos.xy;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const INK_STROKE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec2 vWorld;
uniform float uProgress;
uniform float uOpacity;
uniform vec3 uInkColor;
uniform float uGrainScale;
${GLSL_NOISE}

void main() {
  if (vUv.x > uProgress + 0.015) discard;

  float tipMask = 1.0;
  if (uProgress < 0.999) {
    float tipNoise = (vnoise(vWorld * 0.9) - 0.5) * 0.04;
    tipMask = 1.0 - smoothstep(uProgress - 0.035, uProgress + 0.005, vUv.x + tipNoise);
    if (tipMask < 0.04) discard;
  }

  float edgeDist = abs(vUv.y - 0.5) * 2.0; // 0 center .. 1 edge
  float nMacro = fbm(vWorld * 0.19 * uGrainScale);
  float nStipple = vnoise(vWorld * 0.95 * uGrainScale);
  float nFine = hash21(floor(vWorld * 1.35 * uGrainScale));

  // Rough ink-on-paper edge + crisp interior pinholes
  float edgeLimit = 0.78 + (nMacro - 0.5) * 0.32 + (nStipple - 0.5) * 0.22;
  if (edgeDist > edgeLimit) discard;
  // Sparse interior paper pinholes
  if (edgeDist > 0.42 && nFine < 0.14) discard;
  if (nFine < 0.045) discard;

  float grainShift = (nStipple - 0.5) * 0.08 + (nMacro - 0.5) * 0.05;
  vec3 col = clamp(uInkColor + vec3(grainShift * 0.85, grainShift * 0.9, grainShift), 0.0, 1.0);

  float alpha = tipMask * uOpacity;
  if (alpha < 0.06) discard;
  gl_FragColor = vec4(col, alpha);
}
`;

export const CANOPY_VERT = /* glsl */ `
attribute vec2 aBlobCenter;
attribute float aSeed;
varying vec2 vLocal;
varying vec2 vWorld;
varying float vSeed;
uniform float uTime;
uniform float uSwayAmp;
uniform float uReducedMotion;

void main() {
  vLocal = uv * 2.0 - 1.0; // -1 .. 1
  vSeed = aSeed;
  vec3 pos = position;
  if (uSwayAmp > 0.0001 && uReducedMotion < 0.5) {
    float sway = sin(uTime * 0.95 + aSeed * 6.2831 + aBlobCenter.y * 0.015) * uSwayAmp;
    pos.x += sway;
    pos.y += cos(uTime * 0.75 + aSeed * 5.0) * uSwayAmp * 0.35;
  }
  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vWorld = worldPos.xy;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const CANOPY_FRAG = /* glsl */ `
precision highp float;
varying vec2 vLocal;
varying vec2 vWorld;
varying float vSeed;
uniform float uProgress;
uniform float uOpacity;
uniform vec3 uInkColor;
uniform float uDensity;
uniform float uPixelRatio;
${GLSL_NOISE}

void main() {
  if (uProgress <= 0.001) discard;

  float r = length(vLocal);
  if (r > 1.0) discard;

  float dpr = max(1.0, uPixelRatio);
  vec2 grainCoord = vWorld * dpr;

  float ang = atan(vLocal.y, vLocal.x);
  // Asymmetrical lumpy outline + high-frequency edge protrusions & fragments
  float lump =
    (vnoise(vec2(cos(ang) * 2.6 + vSeed * 11.3, sin(ang) * 2.6 + vSeed * 7.1)) - 0.5) * 0.36 +
    (vnoise(vec2(cos(ang) * 6.4 + vSeed * 3.7, sin(ang) * 6.4 + vSeed * 9.9)) - 0.5) * 0.22 +
    (vnoise(vec2(cos(ang) * 12.0 + vSeed * 19.1, sin(ang) * 12.0 + vSeed * 23.3)) - 0.5) * 0.14;

  float macro = fbm(vWorld * 0.065 + vec2(vSeed * 13.7, vSeed * 5.3));
  float midGrain = vnoise(vWorld * 0.36 + vec2(vSeed * 4.1, vSeed * 8.9));
  float stipple = vnoise(grainCoord * 1.15);
  float speckle = hash21(floor(grainCoord * 0.94));

  float scale = mix(0.20, 1.0, smoothstep(0.0, 1.0, uProgress));
  float effectiveR = r / scale + lump * 0.56;

  // Larger interior dark holes inside thick clusters so paper & trunk peek through
  float bigVoidNoise = fbm(vWorld * 0.036 + vec2(vSeed * 11.7, vSeed * 17.3));
  float innerZone = 1.0 - smoothstep(0.28, 0.72, r);
  float bigVoid = smoothstep(0.57, 0.71, bigVoidNoise) * innerZone;
  float innerVoid = smoothstep(0.66, 0.83, macro * 0.65 + midGrain * 0.35);

  float edgeBreak = (macro - 0.5) * 0.36 + (midGrain - 0.5) * 0.28 + (stipple - 0.5) * 0.16;

  float field = effectiveR + edgeBreak + innerVoid * 0.42 + bigVoid * 0.78;
  float thresh = mix(0.72, 0.88, uDensity);

  // High-contrast screen-print threshold: solid ~82-85% core with fragmented dithered rim
  float rimZone = smoothstep(thresh - 0.20, thresh + 0.06, field);
  float ditherCut = mix(0.03, 0.84, rimZone);
  float dotHit = step(ditherCut, stipple * 0.55 + speckle * 0.45);

  if (field > thresh + 0.06 || dotHit < 0.5 || bigVoid > 0.58) {
    discard;
  }

  // DPR-balanced silkscreen pinholes so 2x mobile keeps crisp fine texture without oversized black blobs
  float fineHoleThresh = dpr > 1.3 ? 0.028 : 0.048;
  float clusterHoleThresh = dpr > 1.3 ? 0.11 : 0.19;
  if (speckle < fineHoleThresh || (midGrain > 0.76 && speckle < clusterHoleThresh)) {
    discard;
  }

  // Keep solid canopy ink bright #c4c3cc with subtle silkscreen shimmer
  float toneShift = (stipple - 0.45) * 0.03 + (macro - 0.5) * 0.02;
  vec3 col = clamp(uInkColor + vec3(toneShift * 0.86, toneShift * 0.90, toneShift), 0.0, 1.0);

  float alpha = uOpacity * smoothstep(0.0, 0.22, uProgress);
  if (alpha < 0.05) discard;
  gl_FragColor = vec4(col, alpha);
}
`;

export const HALFTONE_PHOTO_VERT = /* glsl */ `
varying vec2 vUv;
varying vec2 vWorld;
void main() {
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorld = worldPos.xy;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const HALFTONE_PHOTO_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec2 vWorld;
uniform sampler2D uTex;
uniform vec2 uPhotoSize;
uniform float uProgress;
uniform float uHovered;
uniform vec3 uInkColor;
${GLSL_NOISE}

void main() {
  if (uProgress <= 0.01) discard;

  vec2 px = vUv * uPhotoSize;
  float edgeNoise = (vnoise(px * 0.24) - 0.5) * 1.4;
  float bx = min(px.x, uPhotoSize.x - px.x) + edgeNoise;
  float by = min(px.y, uPhotoSize.y - px.y) + edgeNoise;
  float borderDist = min(bx, by);
  if (borderDist < 0.0) discard;

  // Thin crisp frame rim (~2.4px)
  float frameBand = step(borderDist, 2.4);
  vec2 innerUv = clamp((px - 2.4) / (uPhotoSize - 4.8), 0.0, 1.0);
  float rawLuma = texture2D(uTex, innerUv).r;
  // Higher contrast curve keeping overall halftone photo moody & dark
  float luma = pow(clamp(rawLuma, 0.0, 1.0), 1.25);

  // Coarse rotated halftone dot screen (pitch ~5.2px)
  float ang = 0.62;
  mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
  vec2 grid = (rot * px) / 5.2;
  vec2 cell = fract(grid) - 0.5;
  float cellNoise = (vnoise(floor(grid) * 0.85) - 0.5) * 0.18;
  float dotDist = length(cell);
  float dotRadius = sqrt(clamp(luma, 0.03, 0.92)) * 0.62 + cellNoise * 0.20;
  float halftone = 1.0 - smoothstep(dotRadius - 0.08, dotRadius + 0.05, dotDist);

  // Dark card stock (#17151a) vs crisp lavender halftone ink
  vec3 cardBg = vec3(0.090, 0.084, 0.102);
  float paperGrain = (vnoise(vWorld * 0.9) - 0.5) * 0.04;
  vec3 inkCol = uInkColor * 0.96 + paperGrain;

  vec3 col = mix(cardBg, inkCol, max(halftone * 0.90, frameBand * 0.68));
  if (uHovered > 0.5) {
    col = mix(col, inkCol, 0.10);
  }

  float alpha = smoothstep(0.0, 0.45, uProgress) * smoothstep(0.0, 1.1, borderDist);
  gl_FragColor = vec4(col, alpha);
}
`;

export const TAPE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec2 vWorld;
uniform float uProgress;
uniform vec3 uInkColor;
${GLSL_NOISE}

void main() {
  if (uProgress <= 0.01) discard;
  // Jagged tape ends on left/right (vUv.x near 0 or 1)
  float endTear = (vnoise(vec2(vUv.y * 16.0, vWorld.x * 0.1)) - 0.5) * 0.07;
  if (vUv.x < 0.03 + endTear || vUv.x > 0.97 + endTear) discard;

  float grain = (vnoise(vWorld * 0.9) - 0.5) * 0.06;
  vec3 col = mix(vec3(0.165, 0.157, 0.173), uInkColor, 0.72) + grain;
  float alpha = 0.48 * smoothstep(0.0, 0.4, uProgress);
  gl_FragColor = vec4(col, alpha);
}
`;

export const INK_TEXT_VERT = /* glsl */ `
varying vec2 vUv;
varying vec2 vWorld;
void main() {
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorld = worldPos.xy;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const INK_TEXT_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec2 vWorld;
uniform sampler2D uTex;
uniform float uProgress;
uniform float uOpacity;
uniform vec3 uInkColor;
${GLSL_NOISE}

void main() {
  vec4 texel = texture2D(uTex, vUv);
  if (texel.a < 0.03) discard;

  float grain = (vnoise(vWorld * 1.1) - 0.5) * 0.09;
  // Ink-in reveal combines opacity + subtle spatial wipe
  float reveal = smoothstep(0.0, 0.85, uProgress);
  float alpha = texel.a * reveal * uOpacity;
  if (alpha < 0.02) discard;

  vec3 col = texel.rgb * (1.0 + grain);
  gl_FragColor = vec4(col, alpha);
}
`;

export const DUST_VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
varying float vAlpha;
uniform float uPixelRatio;
uniform float uTime;
uniform vec2 uParallax;

void main() {
  vAlpha = aAlpha;
  vec3 pos = position;
  pos.x += uParallax.x + sin(uTime * 0.25 + position.y * 0.05) * 2.5;
  pos.y += uParallax.y + cos(uTime * 0.2 + position.x * 0.05) * 2.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = aSize * uPixelRatio;
}
`;

export const DUST_FRAG = /* glsl */ `
precision highp float;
varying float vAlpha;
uniform vec3 uInkColor;

void main() {
  float d = length(gl_PointCoord - vec2(0.5));
  if (d > 0.5) discard;
  float soft = smoothstep(0.5, 0.15, d);
  gl_FragColor = vec4(uInkColor, soft * vAlpha);
}
`;
