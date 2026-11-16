import * as THREE from 'three';
import { createRng, fbm2D } from './rng';

export interface Point2D {
  x: number;
  y: number;
}

export interface CanopyBlob {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  seed: number;
}

/**
 * Samples a quadratic/cubic-like smooth path with deterministic organic hand-drawn jitter.
 */
export function sampleOrganicPath(
  pts: Point2D[],
  stepsPerSeg: number,
  jitterAmp: number,
  seed: number,
): Point2D[] {
  if (pts.length < 2) return pts;
  const rng = createRng(seed);
  const phase = rng() * 100;
  const out: Point2D[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const steps = i === pts.length - 2 ? stepsPerSeg + 1 : stepsPerSeg;
    for (let s = 0; s < steps; s++) {
      const t = s / stepsPerSeg;
      // Catmull-Rom spline interpolation
      const t2 = t * t;
      const t3 = t2 * t;
      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const y =
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
      const globalT = (i + t) / (pts.length - 1);
      const j = (fbm2D(globalT * 6.5 + phase, phase * 0.3, 2, seed) - 0.5) * 2 * jitterAmp;
      const j2 = (fbm2D(phase * 0.7, globalT * 6.5 + phase, 2, seed + 19) - 0.5) * 2 * jitterAmp;
      // Keep endpoints anchored
      const env = Math.sin(Math.PI * globalT);
      out.push({ x: x + j * env, y: y + j2 * env });
    }
  }
  return out;
}

/**
 * Builds an indexed ribbon geometry from a polyline with tapered width and stroke UVs.
 */
export function buildStrokeGeometry(
  points: Point2D[],
  widthStart: number,
  widthEnd: number,
  seed = 1,
): THREE.BufferGeometry {
  const n = points.length;
  const positions = new Float32Array(n * 2 * 3);
  const uvs = new Float32Array(n * 2 * 2);
  const indices: number[] = [];

  // Compute cumulative arc length for clean u parameterization
  const dists = new Float32Array(n);
  for (let i = 1; i < n; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    dists[i] = dists[i - 1] + Math.hypot(dx, dy);
  }
  const totalLen = Math.max(1e-4, dists[n - 1]);

  for (let i = 0; i < n; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(n - 1, i + 1)];
    let tx = next.x - prev.x;
    let ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    // Perpendicular normal
    const nx = -ty;
    const ny = tx;

    const u = dists[i] / totalLen;
    const wVar = 1 + (fbm2D(u * 9.0, seed * 0.37, 2, seed) - 0.5) * 0.24;
    const halfW = 0.5 * (widthStart + (widthEnd - widthStart) * u) * wVar;

    const idx = i * 2;
    positions[idx * 3] = points[i].x + nx * halfW;
    positions[idx * 3 + 1] = points[i].y + ny * halfW;
    positions[idx * 3 + 2] = 0;

    positions[(idx + 1) * 3] = points[i].x - nx * halfW;
    positions[(idx + 1) * 3 + 1] = points[i].y - ny * halfW;
    positions[(idx + 1) * 3 + 2] = 0;

    uvs[idx * 2] = u;
    uvs[idx * 2 + 1] = 0;
    uvs[(idx + 1) * 2] = u;
    uvs[(idx + 1) * 2 + 1] = 1;

    if (i < n - 1) {
      const a = idx;
      const b = idx + 1;
      const c = idx + 2;
      const d = idx + 3;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  return geom;
}

/**
 * Merges multiple stroke geometries into a single BufferGeometry for fast rendering.
 */
export function mergeStrokeGeometries(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVerts = 0;
  let totalIdx = 0;
  for (const g of geoms) {
    totalVerts += g.getAttribute('position').count;
    totalIdx += g.getIndex() ? g.getIndex()!.count : 0;
  }
  const positions = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const indices = new Uint32Array(totalIdx);

  let vOffset = 0;
  let iOffset = 0;
  for (const g of geoms) {
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    const idx = g.getIndex()!;
    positions.set(pos.array as Float32Array, vOffset * 3);
    uvs.set(uv.array as Float32Array, vOffset * 2);
    for (let i = 0; i < idx.count; i++) {
      indices[iOffset + i] = idx.getX(i) + vOffset;
    }
    vOffset += pos.count;
    iOffset += idx.count;
    g.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  return merged;
}

/**
 * Builds a single BufferGeometry for a cluster of organic canopy cloud blobs.
 */
export function buildCanopyGeometry(blobs: CanopyBlob[]): THREE.BufferGeometry {
  const count = blobs.length;
  const positions = new Float32Array(count * 4 * 3);
  const uvs = new Float32Array(count * 4 * 2);
  const centers = new Float32Array(count * 4 * 2);
  const seeds = new Float32Array(count * 4);
  const indices: number[] = [];

  for (let i = 0; i < count; i++) {
    const b = blobs[i];
    const v = i * 4;
    const corners = [
      [b.cx - b.rx, b.cy - b.ry, 0, 0],
      [b.cx + b.rx, b.cy - b.ry, 1, 0],
      [b.cx + b.rx, b.cy + b.ry, 1, 1],
      [b.cx - b.rx, b.cy + b.ry, 0, 1],
    ];
    for (let k = 0; k < 4; k++) {
      const vi = v + k;
      positions[vi * 3] = corners[k][0];
      positions[vi * 3 + 1] = corners[k][1];
      positions[vi * 3 + 2] = 0;
      uvs[vi * 2] = corners[k][2];
      uvs[vi * 2 + 1] = corners[k][3];
      centers[vi * 2] = b.cx;
      centers[vi * 2 + 1] = b.cy;
      seeds[vi] = b.seed;
    }
    indices.push(v, v + 1, v + 2, v, v + 2, v + 3);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.setAttribute('aBlobCenter', new THREE.BufferAttribute(centers, 2));
  geom.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geom.setIndex(indices);
  return geom;
}

/**
 * Generates an asymmetrical multi-lobe cloud mass with varied radii and outer fragments.
 */
export function generateCanopyCluster(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  lobeCount: number,
  seed: number,
): CanopyBlob[] {
  const rng = createRng(seed);
  const blobs: CanopyBlob[] = [];
  // Offset core anchor blob asymmetrically
  blobs.push({
    cx: cx + (rng() - 0.5) * rx * 0.28,
    cy: cy + (rng() - 0.5) * ry * 0.26,
    rx: rx * (0.62 + rng() * 0.26),
    ry: ry * (0.62 + rng() * 0.26),
    seed: rng(),
  });
  for (let i = 0; i < lobeCount; i++) {
    const angle = (i / lobeCount) * Math.PI * 2 + (rng() - 0.5) * 0.88;
    const dist = 0.18 + rng() * 0.36;
    const lx = cx + Math.cos(angle) * rx * dist;
    const ly = cy + Math.sin(angle) * ry * dist;
    const sizeScale = 0.46 + rng() * 0.44;
    const lrx = rx * sizeScale * (0.86 + rng() * 0.32);
    const lry = ry * sizeScale * (0.84 + rng() * 0.32);
    blobs.push({ cx: lx, cy: ly, rx: lrx, ry: lry, seed: rng() });
  }
  // Connected edge bumps breaking up smooth silhouettes without detaching
  const fragCount = 2 + Math.floor(rng() * 3);
  for (let f = 0; f < fragCount; f++) {
    const angle = rng() * Math.PI * 2;
    const dist = 0.36 + rng() * 0.24;
    const fx = cx + Math.cos(angle) * rx * dist;
    const fy = cy + Math.sin(angle) * ry * dist;
    blobs.push({
      cx: fx,
      cy: fy,
      rx: rx * (0.28 + rng() * 0.16),
      ry: ry * (0.28 + rng() * 0.16),
      seed: rng(),
    });
  }
  return blobs;
}

/**
 * Generates a branch with small thorn-like nubs along its length.
 */
export function buildTwigWithThorns(
  pts: Point2D[],
  wStart: number,
  wEnd: number,
  thornCount: number,
  seed: number,
): THREE.BufferGeometry {
  const rng = createRng(seed);
  const sampled = sampleOrganicPath(pts, 10, 2.0, seed);
  const strokes: THREE.BufferGeometry[] = [
    buildStrokeGeometry(sampled, wStart, wEnd, seed),
  ];

  for (let i = 0; i < thornCount; i++) {
    const t = 0.24 + (i / Math.max(1, thornCount)) * 0.54 + (rng() - 0.5) * 0.08;
    const idx = Math.min(sampled.length - 2, Math.max(1, Math.floor(t * (sampled.length - 1))));
    const p = sampled[idx];
    const next = sampled[idx + 1];
    const ang = Math.atan2(next.y - p.y, next.x - p.x);
    const side = i % 2 === 0 ? 1 : -1;
    const thornAng = ang + side * (0.68 + rng() * 0.42);
    const len = 7 + rng() * 8;
    const thornPts: Point2D[] = [
      p,
      {
        x: p.x + Math.cos(thornAng) * len * 0.52,
        y: p.y + Math.sin(thornAng) * len * 0.52,
      },
      {
        x: p.x + Math.cos(thornAng) * len,
        y: p.y + Math.sin(thornAng) * len,
      },
    ];
    strokes.push(buildStrokeGeometry(thornPts, 2.7, 0.65, seed + i * 31));
  }

  return mergeStrokeGeometries(strokes);
}

/**
 * Builds procedural continuous undulating grass band, irregular granular ground bed,
 * ~8-12 sparse tall wildflowers, deep roots, and small shrubs.
 */
export function buildGroundFlora(options: {
  xMin: number;
  xMax: number;
  groundY: number;
  trunkX: number;
  bandHeight: number;
  seed: number;
  densityScale?: number;
  flowerCount?: number;
  flowerRange?: [number, number];
}): {
  grassGeometry: THREE.BufferGeometry;
  groundBedGeometry: THREE.BufferGeometry;
  flowerHeadsGeometry: THREE.BufferGeometry;
  rootsGeometry: THREE.BufferGeometry;
  shrubsGeometry: THREE.BufferGeometry;
} {
  const {
    xMin,
    xMax,
    groundY,
    trunkX,
    bandHeight,
    seed,
    densityScale = 1,
    flowerCount = 10,
    flowerRange,
  } = options;
  const rng = createRng(seed);
  const grassStrokes: THREE.BufferGeometry[] = [];
  const groundBedStrokes: THREE.BufferGeometry[] = [];
  const flowerBlobs: CanopyBlob[] = [];
  const rootStrokes: THREE.BufferGeometry[] = [];
  const shrubBlobs: CanopyBlob[] = [];

  const span = xMax - xMin;

  // Irregular granular ground bed along the base (broken organic strokes, never a ruler-straight solid line)
  const bedSegs = Math.max(16, Math.round(span / 46));
  for (let s = 0; s < bedSegs; s++) {
    const sx0 = xMin + (s / bedSegs) * span + (rng() - 0.5) * 8;
    const sx1 = sx0 + (span / bedSegs) * (0.72 + rng() * 0.48);
    const yOff = (fbm2D(sx0 * 0.014, seed * 0.2, 2, seed) - 0.5) * 4.5;
    const pts = sampleOrganicPath(
      [
        { x: sx0, y: groundY - 2.5 + yOff },
        { x: (sx0 + sx1) * 0.5, y: groundY - 1.5 + yOff + (rng() - 0.5) * 3.0 },
        { x: sx1, y: groundY - 2.5 + yOff + (rng() - 0.5) * 2.5 },
      ],
      5,
      1.3,
      seed + 11 + s * 13,
    );
    groundBedStrokes.push(buildStrokeGeometry(pts, 4.8 + rng() * 2.6, 3.2 + rng() * 2.0, seed + 29 + s));
  }

  // Full-width continuous low grass band with undulating density/height (lush near trunk & crests)
  const clusterCount = Math.round((span / 16) * densityScale);
  for (let cIdx = 0; cIdx < clusterCount; cIdx++) {
    const baseT = (cIdx + 0.15 + rng() * 0.7) / clusterCount;
    const clusterX = xMin + baseT * span;
    const distFromTrunk = Math.abs(clusterX - trunkX);
    const nearTrunk = Math.exp(-(distFromTrunk * distFromTrunk) / (145 * 145));
    const wave =
      0.5 +
      0.5 *
        Math.sin(
          clusterX * 0.015 +
            fbm2D(clusterX * 0.004, seed * 0.17, 2, seed) * 4.2,
        );
    const lush = Math.min(1, wave * 0.72 + nearTrunk * 0.65);

    const bladesInTuft = 2 + Math.floor(lush * 4.2 + rng() * 1.9);
    for (let b = 0; b < bladesInTuft; b++) {
      const bx = clusterX + (rng() - 0.5) * 14;
      const by = groundY - 3.5 + (rng() - 0.5) * 4;
      const h = bandHeight * (0.46 + lush * 0.52 + rng() * 0.28);
      const fan = (b - (bladesInTuft - 1) * 0.5) * 2.6 + (rng() - 0.5) * 8.5;
      const pts = sampleOrganicPath(
        [
          { x: bx, y: by },
          { x: bx + fan * 0.45, y: by + h * 0.56 },
          { x: bx + fan, y: by + h },
        ],
        4,
        1.1,
        seed + cIdx * 53 + b * 7,
      );
      grassStrokes.push(buildStrokeGeometry(pts, 2.3 + rng() * 1.1, 0.48, seed + cIdx * 61 + b));
    }
  }

  // Sparse tall wildflowers / weed stems (~8-12 across visible viewport, up to ~70px, skipping music player)
  const [fxMin, fxMax] = flowerRange ?? [xMin + span * 0.05, xMax - span * 0.05];
  const fSpan = Math.max(100, fxMax - fxMin);
  for (let fIdx = 0; fIdx < flowerCount; fIdx++) {
    const slotFrac = (fIdx + 0.16 + rng() * 0.68) / Math.max(1, flowerCount);
    let wx = fxMin + slotFrac * fSpan;
    // Keep clear of desktop bottom-right music player / caption box
    if (wx > trunkX + 340 && wx < trunkX + 860) {
      wx -= 460;
    }
    const wy = groundY - 2;
    const stalkH = 38 + rng() * 32; // ~38-70px varied heights
    const lean = (rng() - 0.5) * 24 + (wx < trunkX ? -3 : 3);
    const topX = wx + lean;
    const topY = wy + stalkH;
    const stalkPts = sampleOrganicPath(
      [
        { x: wx, y: wy },
        { x: wx + lean * 0.42, y: wy + stalkH * 0.54 },
        { x: topX, y: topY },
      ],
      5,
      1.7,
      seed + 500 + fIdx * 71,
    );
    grassStrokes.push(buildStrokeGeometry(stalkPts, 2.2, 0.8, seed + 500 + fIdx * 79));

    if (rng() > 0.25) {
      const lx = wx + lean * 0.38;
      const ly = wy + stalkH * 0.44;
      const side = rng() > 0.5 ? 1 : -1;
      grassStrokes.push(
        buildStrokeGeometry(
          [
            { x: lx, y: ly },
            { x: lx + side * 7.5, y: ly + 8.5 },
            { x: lx + side * 13, y: ly + 11.5 },
          ],
          1.7,
          0.5,
          seed + 500 + fIdx * 83,
        ),
      );
    }

    // Stippled flower / weed seed head
    const petals = 4 + Math.floor(rng() * 4);
    const pr = 3.5 + rng() * 3.2;
    for (let p = 0; p < petals; p++) {
      const a = (p / petals) * Math.PI * 2 + rng() * 0.4;
      flowerBlobs.push({
        cx: topX + Math.cos(a) * pr * 0.88,
        cy: topY + Math.sin(a) * pr * 0.88,
        rx: pr * 0.92,
        ry: pr * 0.82,
        seed: rng(),
      });
    }
    flowerBlobs.push({ cx: topX, cy: topY, rx: pr * 0.78, ry: pr * 0.78, seed: rng() });
  }

  // Deep curving roots below ground line under the trunk (revealed on branch open/zoom)
  const rootAngles = [-2.55, -2.25, -1.92, -1.68, -1.42, -1.12, -0.82, -0.52];
  rootAngles.forEach((ang, idx) => {
    const len = 42 + rng() * 58;
    const midAng = ang + (rng() - 0.5) * 0.36;
    const endX = trunkX + Math.cos(ang) * len;
    const endY = groundY + Math.sin(ang) * len;
    const pts = sampleOrganicPath(
      [
        { x: trunkX + (idx - 3.5) * 3.0, y: groundY + 2 },
        {
          x: trunkX + Math.cos(midAng) * len * 0.5,
          y: groundY + Math.sin(midAng) * len * 0.5,
        },
        { x: endX, y: endY },
      ],
      7,
      2.8,
      seed + 900 + idx * 17,
    );
    rootStrokes.push(buildStrokeGeometry(pts, 5.2, 0.95, seed + 950 + idx));

    // Forked rootlet
    if (idx % 2 === 0) {
      const forkBase = pts[Math.floor(pts.length * 0.58)];
      const fAng = ang + (idx < 4 ? -0.38 : 0.38);
      rootStrokes.push(
        buildStrokeGeometry(
          [
            forkBase,
            {
              x: forkBase.x + Math.cos(fAng) * 24,
              y: forkBase.y + Math.sin(fAng) * 24,
            },
          ],
          2.6,
          0.6,
          seed + 980 + idx,
        ),
      );
    }
  });

  // Low shrub mounds around trunk base and across ground horizon (revealed in me / zoomed states)
  const shrubCenters = [
    { x: trunkX - 240, y: groundY + 11, rx: 28, ry: 18 },
    { x: trunkX - 112, y: groundY + 15, rx: 38, ry: 25 },
    { x: trunkX + 96, y: groundY + 14, rx: 34, ry: 22 },
    { x: trunkX + 275, y: groundY + 15, rx: 40, ry: 26 },
    { x: trunkX + 510, y: groundY + 12, rx: 32, ry: 20 },
    { x: trunkX + 760, y: groundY + 14, rx: 36, ry: 23 },
    { x: trunkX + 980, y: groundY + 12, rx: 30, ry: 19 },
  ];
  shrubCenters.forEach((sc, idx) => {
    shrubBlobs.push(...generateCanopyCluster(sc.x, sc.y, sc.rx, sc.ry, 5, seed + 1200 + idx * 29));
  });

  return {
    grassGeometry: mergeStrokeGeometries(grassStrokes),
    groundBedGeometry: mergeStrokeGeometries(groundBedStrokes),
    flowerHeadsGeometry: buildCanopyGeometry(
      flowerBlobs.length ? flowerBlobs : [{ cx: trunkX, cy: groundY, rx: 1, ry: 1, seed: 0.1 }],
    ),
    rootsGeometry: mergeStrokeGeometries(rootStrokes),
    shrubsGeometry: buildCanopyGeometry(shrubBlobs),
  };
}

/**
 * Builds a hand-drawn wobbly underline stroke geometry between x0 and x1 at y.
 */
export function buildWobblyUnderline(
  x0: number,
  x1: number,
  y: number,
  seed: number,
  amp = 1.6,
): THREE.BufferGeometry {
  const pts: Point2D[] = [];
  const segs = 14;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const x = x0 + (x1 - x0) * t;
    const wave =
      Math.sin(t * Math.PI * 3.5 + seed) * amp * 0.65 +
      (fbm2D(t * 7.0, seed * 0.4, 2, seed) - 0.5) * amp * 1.4;
    pts.push({ x, y: y + wave });
  }
  return buildStrokeGeometry(pts, 1.85, 1.5, seed);
}
