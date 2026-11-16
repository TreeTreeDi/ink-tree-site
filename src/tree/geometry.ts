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
 * Generates an organic multi-lobe cloud mass of blobs around (cx, cy).
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
  // Core anchor blob
  blobs.push({ cx, cy, rx: rx * 0.78, ry: ry * 0.78, seed: rng() });
  for (let i = 0; i < lobeCount; i++) {
    const angle = (i / lobeCount) * Math.PI * 2 + (rng() - 0.5) * 0.55;
    const dist = 0.25 + rng() * 0.45;
    const lx = cx + Math.cos(angle) * rx * dist;
    const ly = cy + Math.sin(angle) * ry * dist;
    const lrx = rx * (0.42 + rng() * 0.35);
    const lry = ry * (0.38 + rng() * 0.35);
    blobs.push({ cx: lx, cy: ly, rx: lrx, ry: lry, seed: rng() });
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
  const sampled = sampleOrganicPath(pts, 10, 2.2, seed);
  const strokes: THREE.BufferGeometry[] = [
    buildStrokeGeometry(sampled, wStart, wEnd, seed),
  ];

  for (let i = 0; i < thornCount; i++) {
    const t = 0.22 + (i / Math.max(1, thornCount)) * 0.55 + (rng() - 0.5) * 0.08;
    const idx = Math.min(sampled.length - 2, Math.max(1, Math.floor(t * (sampled.length - 1))));
    const p = sampled[idx];
    const next = sampled[idx + 1];
    const ang = Math.atan2(next.y - p.y, next.x - p.x);
    const side = i % 2 === 0 ? 1 : -1;
    const thornAng = ang + side * (0.75 + rng() * 0.45);
    const len = 6 + rng() * 7;
    const thornPts: Point2D[] = [
      p,
      {
        x: p.x + Math.cos(thornAng) * len * 0.5,
        y: p.y + Math.sin(thornAng) * len * 0.5,
      },
      {
        x: p.x + Math.cos(thornAng) * len,
        y: p.y + Math.sin(thornAng) * len,
      },
    ];
    strokes.push(buildStrokeGeometry(thornPts, 2.6, 0.7, seed + i * 31));
  }

  return mergeStrokeGeometries(strokes);
}

/**
 * Builds procedural grass blades, wildflowers/weeds, and deep trunk roots.
 */
export function buildGroundFlora(options: {
  xMin: number;
  xMax: number;
  groundY: number;
  trunkX: number;
  bandHeight: number;
  seed: number;
  densityScale?: number;
}): {
  grassGeometry: THREE.BufferGeometry;
  flowerHeadsGeometry: THREE.BufferGeometry;
  rootsGeometry: THREE.BufferGeometry;
} {
  const { xMin, xMax, groundY, trunkX, bandHeight, seed, densityScale = 1 } = options;
  const rng = createRng(seed);
  const grassStrokes: THREE.BufferGeometry[] = [];
  const flowerBlobs: CanopyBlob[] = [];
  const rootStrokes: THREE.BufferGeometry[] = [];

  const span = xMax - xMin;
  const bladeCount = Math.round((span / 5.2) * densityScale);

  // Base horizontal turf ribbon (subtle uneven ink ground line)
  const turfPts: Point2D[] = [];
  const turfSteps = 44;
  for (let i = 0; i <= turfSteps; i++) {
    const t = i / turfSteps;
    const x = xMin + t * span;
    const y = groundY + (fbm2D(t * 10, seed * 0.2, 2, seed) - 0.5) * 4.5;
    turfPts.push({ x, y });
  }
  grassStrokes.push(buildStrokeGeometry(turfPts, 3.6, 3.2, seed + 5));

  for (let i = 0; i < bladeCount; i++) {
    const baseT = rng();
    // Bias extra blades near trunkX
    const nearTrunk = rng() < 0.36;
    const x = nearTrunk
      ? trunkX + (rng() - 0.5) * 230
      : xMin + baseT * span;
    const distFromTrunk = Math.abs(x - trunkX);
    const trunkBoost = Math.max(0, 1 - distFromTrunk / 190);
    const h = bandHeight * (0.42 + rng() * 0.72 + trunkBoost * 0.45);
    const lean = (rng() - 0.5) * 16 + (x < trunkX ? -3 : 3);
    const y0 = groundY - 2 + (rng() - 0.5) * 4;
    const pts = sampleOrganicPath(
      [
        { x, y: y0 },
        { x: x + lean * 0.45, y: y0 + h * 0.55 },
        { x: x + lean, y: y0 + h },
      ],
      4,
      1.2,
      seed + i * 7,
    );
    grassStrokes.push(buildStrokeGeometry(pts, 2.2 + rng() * 1.4, 0.55, seed + i * 11));

    // Wildflower / weed silhouette on ~9% of stems (more frequent near trunk and edges)
    if (rng() < 0.085 + trunkBoost * 0.05) {
      const stalkH = h * (1.25 + rng() * 0.65);
      const topX = x + lean * 1.25;
      const topY = y0 + stalkH;
      const stalkPts = sampleOrganicPath(
        [
          { x, y: y0 },
          { x: x + lean * 0.55, y: y0 + stalkH * 0.52 },
          { x: topX, y: topY },
        ],
        5,
        1.5,
        seed + i * 29,
      );
      grassStrokes.push(buildStrokeGeometry(stalkPts, 1.8, 0.7, seed + i * 31));
      // Small flower petals / seed head
      const petals = 4 + Math.floor(rng() * 3);
      const pr = 2.6 + rng() * 2.4;
      for (let p = 0; p < petals; p++) {
        const a = (p / petals) * Math.PI * 2 + rng() * 0.4;
        flowerBlobs.push({
          cx: topX + Math.cos(a) * pr * 0.85,
          cy: topY + Math.sin(a) * pr * 0.85,
          rx: pr * 0.85,
          ry: pr * 0.75,
          seed: rng(),
        });
      }
      flowerBlobs.push({ cx: topX, cy: topY, rx: pr * 0.7, ry: pr * 0.7, seed: rng() });
    }
  }

  // Roots curving downward below trunk (revealed when zoomed / branch opened)
  const rootAngles = [-2.45, -2.05, -1.7, -1.45, -1.05, -0.68];
  rootAngles.forEach((ang, idx) => {
    const len = 34 + rng() * 44;
    const midAng = ang + (rng() - 0.5) * 0.32;
    const pts = sampleOrganicPath(
      [
        { x: trunkX + (idx - 2.5) * 2.5, y: groundY + 1 },
        {
          x: trunkX + Math.cos(midAng) * len * 0.52,
          y: groundY + Math.sin(midAng) * len * 0.52,
        },
        {
          x: trunkX + Math.cos(ang) * len,
          y: groundY + Math.sin(ang) * len,
        },
      ],
      7,
      2.5,
      seed + 900 + idx * 17,
    );
    rootStrokes.push(buildStrokeGeometry(pts, 4.4, 0.9, seed + 950 + idx));
  });

  return {
    grassGeometry: mergeStrokeGeometries(grassStrokes),
    flowerHeadsGeometry: buildCanopyGeometry(
      flowerBlobs.length ? flowerBlobs : [{ cx: trunkX, cy: groundY, rx: 1, ry: 1, seed: 0.1 }],
    ),
    rootsGeometry: mergeStrokeGeometries(rootStrokes),
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
