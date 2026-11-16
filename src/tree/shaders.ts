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
${GLSL_NOISE}

float tornMarginDist(vec2 p, vec2 size, float margin) {
  // Distance inward from viewport border; negative = outside sheet
  float dLeft = p.x - margin;
  float dRight = (size.x - margin) - p.x;
  float dTop = p.y - margin;
  float dBottom = (size.y - margin) - p.y;

  // Deterministic deckled tear perturbation along each edge
  float tearX = (fbm(vec2(p.y * 0.07, 3.1)) - 0.5) * 3.2 + (vnoise(vec2(p.y * 0.35, 9.2)) - 0.5) * 1.4;
  float tearY = (fbm(vec2(p.x * 0.07, 7.7)) - 0.5) * 3.2 + (vnoise(vec2(p.x * 0.35, 1.4)) - 0.5) * 1.4;

  dLeft += tearX;
  dRight -= tearX;
  dTop += tearY;
  dBottom -= tearY;

  return min(min(dLeft, dRight), min(dTop, dBottom));
}

void main() {
  vec2 px = vUv * uResolution;
  // Flip Y so top-left lighting feels natural
  vec2 pTop = vec2(px.x, uResolution.y - px.y);
  float margin = clamp(min(uResolution.x, uResolution.y) * 0.0145, 7.0, 13.5);
  float d = tornMarginDist(pTop, uResolution, margin);

  vec3 surroundCol = vec3(0.0667, 0.0627, 0.0706); // #111012
  vec3 tearRimCol = vec3(0.086, 0.082, 0.094);
  vec3 bevelCol = vec3(0.075, 0.070, 0.082);

  // Subtle paper grain in the outer margin & bevel
  float grain = (vnoise(px * 0.7) - 0.5) * 0.012;

  if (d < 0.0) {
    // Outside sheet: outer surround + soft drop shadow near bottom-right of sheet
    float shadowDist = tornMarginDist(pTop - vec2(3.0, 4.0), uResolution, margin);
    float dropShadow = smoothstep(-7.0, 0.5, shadowDist) * 0.25;
    vec3 col = mix(surroundCol, vec3(0.04, 0.038, 0.045), dropShadow);
    gl_FragColor = vec4(col + grain, 1.0);
    return;
  }

  // Dark tear cut line right at edge (0..2px)
  float cutLine = 1.0 - smoothstep(0.6, 2.2, d);
  // Inner bevel shadow fading from edge into sheet over ~16px
  float bevelWidth = clamp(margin * 1.25, 11.0, 17.0);
  float bevel = pow(1.0 - clamp(d / bevelWidth, 0.0, 1.0), 1.65) * 0.48;

  // Directional bevel nuance: slightly brighter top-left rim, slightly deeper bottom-right
  float tlBias = clamp((1.0 - pTop.x / uResolution.x) * 0.5 + (1.0 - pTop.y / uResolution.y) * 0.5, 0.0, 1.0);
  vec3 edgeTint = mix(bevelCol, vec3(0.11, 0.105, 0.12), tlBias * 0.45);

  float alpha = max(cutLine * 0.92, bevel);
  vec3 col = mix(edgeTint, tearRimCol, cutLine);

  if (alpha < 0.004) {
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
  float nMacro = fbm(vWorld * 0.18 * uGrainScale);
  float nMicro = vnoise(vWorld * 1.15 * uGrainScale);

  // Stippled / rough ink edge threshold
  float edgeLimit = 0.72 + (nMacro - 0.5) * 0.34 + (nMicro - 0.5) * 0.22;
  float edgeAlpha = 1.0 - smoothstep(edgeLimit - 0.14, edgeLimit + 0.05, edgeDist);

  // Subtle ink texture inside stroke
  float inkVar = (nMicro - 0.5) * 0.09 + (nMacro - 0.5) * 0.06;
  vec3 col = uInkColor + vec3(inkVar * 0.9, inkVar * 0.92, inkVar);

  float alpha = edgeAlpha * tipMask * uOpacity;
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
${GLSL_NOISE}

void main() {
  if (uProgress <= 0.001) discard;

  float r = length(vLocal);
  if (r > 1.02) discard;

  // Angular lumpy organic silhouette perturbation
  float ang = atan(vLocal.y, vLocal.x);
  float lump = (vnoise(vec2(cos(ang) * 2.2 + vSeed * 11.3, sin(ang) * 2.2 + vSeed * 7.1)) - 0.5) * 0.28;
  float macro = fbm(vWorld * 0.065 + vec2(vSeed * 13.7, vSeed * 5.3));
  float stipple = vnoise(vWorld * 0.68);
  float fine = vnoise(vWorld * 1.45);

  // Puff-in progress shrinks effective radius smoothly
  float scale = mix(0.22, 1.0, smoothstep(0.0, 1.0, uProgress));
  float effectiveR = r / scale + lump * 0.55;

  // Interior small paper holes & stippled foliage grain
  float holes = smoothstep(0.66, 0.86, macro * 0.55 + stipple * 0.45);
  float edgeBreak = (macro - 0.5) * 0.36 + (stipple - 0.5) * 0.30 + (fine - 0.5) * 0.22;

  float field = effectiveR + edgeBreak + holes * 0.26;
  float thresh = mix(0.62, 0.86, uDensity);
  float cov = 1.0 - smoothstep(thresh - 0.09, thresh + 0.04, field);

  // Crisp stippled screen-print ink dots near boundary
  float dotMask = step(0.32, fine * 0.65 + (1.0 - effectiveR) * 0.55);
  cov *= mix(dotMask, 1.0, smoothstep(0.75, 0.35, effectiveR));

  float inkGrain = (fine - 0.5) * 0.08 + (macro - 0.5) * 0.05;
  vec3 col = uInkColor + vec3(inkGrain * 0.88, inkGrain * 0.92, inkGrain);

  float alpha = cov * uOpacity * smoothstep(0.0, 0.25, uProgress);
  if (alpha < 0.08) discard;
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
  // Slightly irregular paper edge
  float edgeNoise = (vnoise(px * 0.25) - 0.5) * 1.4;
  float bx = min(px.x, uPhotoSize.x - px.x) + edgeNoise;
  float by = min(px.y, uPhotoSize.y - px.y) + edgeNoise;
  float borderDist = min(bx, by);
  if (borderDist < 0.0) discard;

  // Thin pale ink-paper border (~3px)
  float frameBand = step(borderDist, 3.2);
  vec2 innerUv = clamp((px - 3.2) / (uPhotoSize - 6.4), 0.0, 1.0);
  float luma = texture2D(uTex, innerUv).r;

  // Rotated halftone dot screen (pitch ~4.5px)
  float ang = 0.58;
  mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
  vec2 grid = (rot * px) / 4.2;
  vec2 cell = fract(grid) - 0.5;
  float cellNoise = (vnoise(floor(grid) * 0.7) - 0.5) * 0.14;
  float dotDist = length(cell);
  float dotRadius = sqrt(clamp(luma, 0.05, 0.96)) * 0.62 + cellNoise * 0.3;
  float halftone = 1.0 - smoothstep(dotRadius - 0.12, dotRadius + 0.08, dotDist);

  // Subtle dark photo paper base (#211f24) vs lavender ink halftone (#c4c3cc)
  vec3 cardBg = vec3(0.125, 0.118, 0.138);
  float paperGrain = (vnoise(vWorld * 0.8) - 0.5) * 0.05;
  vec3 inkCol = uInkColor + paperGrain;

  vec3 col = mix(cardBg, inkCol, max(halftone * 0.92, frameBand * 0.72));
  if (uHovered > 0.5) {
    col = mix(col, inkCol, 0.08);
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
  vec3 col = mix(vec3(0.165, 0.157, 0.173), uInkColor, 0.55) + grain;
  float alpha = 0.42 * smoothstep(0.0, 0.4, uProgress);
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
