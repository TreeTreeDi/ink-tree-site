import * as THREE from 'three';
import type { BioParagraph, PhotoCardSpec } from '../data/siteContent';
import { createRng, fbm2D } from './rng';

export interface TextTextureResult {
  texture: THREE.CanvasTexture;
  width: number;
  height: number;
}

export interface BioLinkHitbox {
  href: string;
  label: string;
  // Relative to paragraph quad center, in world units (top-down y inverted to world y)
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BioParagraphTextureResult extends TextTextureResult {
  links: BioLinkHitbox[];
}

/**
 * Generates an abstract procedural grayscale CanvasTexture (no faces/portraits)
 * ready for our custom halftone fragment shader.
 */
export function createAbstractPhotoTexture(spec: PhotoCardSpec): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = spec.width;
  canvas.height = spec.height;
  const ctx = canvas.getContext('2d')!;
  const w = spec.width;
  const h = spec.height;
  const rng = createRng(spec.seed);

  // Soft tonal background gradient
  const bg = ctx.createLinearGradient(0, 0, w * 0.25, h);
  bg.addColorStop(0, '#2a2a2a');
  bg.addColorStop(0.55, '#5b5b5b');
  bg.addColorStop(1, '#1d1d1d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  if (spec.motif === 'rings') {
    // Stacked concentric paper rings & soft orb
    const cx = w * 0.52;
    const cy = h * 0.46;
    const rad = ctx.createRadialGradient(cx - 40, cy - 50, 20, cx, cy, w * 0.46);
    rad.addColorStop(0, '#efefef');
    rad.addColorStop(0.45, '#9d9d9d');
    rad.addColorStop(1, '#1f1f1f');
    ctx.fillStyle = rad;
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.36, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(245,245,245,0.45)';
    for (let i = 0; i < 8; i++) {
      ctx.lineWidth = 4 + (i % 3) * 3;
      ctx.beginPath();
      ctx.arc(cx + (i - 3) * 14, cy + (i - 3) * 8, 70 + i * 32, 0.2, Math.PI * 1.65);
      ctx.stroke();
    }
  } else if (spec.motif === 'horizon') {
    // Abstract coastal mist horizon & layered hills
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.62);
    sky.addColorStop(0, '#d9d9d9');
    sky.addColorStop(1, '#6f6f6f');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h * 0.62);

    // Sun/moon disc
    ctx.fillStyle = '#f5f5f5';
    ctx.beginPath();
    ctx.arc(w * 0.68, h * 0.28, Math.min(w, h) * 0.14, 0, Math.PI * 2);
    ctx.fill();

    // Layered undulating ridges
    const layers = [0.48, 0.60, 0.74, 0.86];
    const shades = ['#545454', '#3c3c3c', '#888888', '#222222'];
    layers.forEach((ly, li) => {
      ctx.fillStyle = shades[li];
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 16) {
        const y =
          h * ly +
          Math.sin(x * 0.011 + li * 1.7) * 26 +
          (fbm2D(x * 0.008, li * 2.3, 2, spec.seed) - 0.5) * 44;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    });
  } else if (spec.motif === 'monolith') {
    // Architectural paper fold & diagonal sunlight beam
    ctx.fillStyle = '#333333';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#c8c8c8';
    ctx.beginPath();
    ctx.moveTo(w * 0.12, 0);
    ctx.lineTo(w * 0.72, 0);
    ctx.lineTo(w * 0.92, h);
    ctx.lineTo(w * 0.32, h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#505050';
    ctx.beginPath();
    ctx.moveTo(w * 0.24, h * 0.18);
    ctx.lineTo(w * 0.66, h * 0.14);
    ctx.lineTo(w * 0.62, h * 0.82);
    ctx.lineTo(w * 0.22, h * 0.86);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ebebeb';
    ctx.beginPath();
    ctx.arc(w * 0.56, h * 0.42, w * 0.15, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Lattice & warm lamp glow gradient
    const glow = ctx.createRadialGradient(w * 0.35, h * 0.38, 12, w * 0.45, h * 0.48, w * 0.65);
    glow.addColorStop(0, '#f4f4f4');
    glow.addColorStop(0.45, '#868686');
    glow.addColorStop(1, '#1e1e1e');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 10;
    for (let i = -3; i < 10; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 95, 0);
      ctx.lineTo(i * 95 + 180, h);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(24,24,24,0.45)';
    ctx.fillRect(w * 0.55, h * 0.25, w * 0.32, h * 0.58);
  }

  // Subtle organic speckles for halftone variation
  for (let i = 0; i < 160; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const r = 1 + rng() * 3.2;
    ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Renders crisp Libre Franklin ink text into a CanvasTexture.
 */
export function createTextTexture(
  text: string,
  options: {
    fontSize: number;
    fontWeight?: number;
    color?: string;
    paddingX?: number;
    paddingY?: number;
    italic?: boolean;
  },
): TextTextureResult {
  const {
    fontSize,
    fontWeight = 500,
    color = '#c4c3cc',
    paddingX = 6,
    paddingY = 5,
    italic = false,
  } = options;
  const scale = 2;
  const font = `${italic ? 'italic ' : ''}${fontWeight} ${fontSize}px "Libre Franklin", system-ui, sans-serif`;

  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d')!;
  mctx.font = font;
  const metrics = mctx.measureText(text);
  const w = Math.ceil(metrics.width + paddingX * 2);
  const h = Math.ceil(fontSize * 1.45 + paddingY * 2);

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(4, w * scale);
  canvas.height = Math.max(4, h * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, paddingX, h * 0.5);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return { texture, width: w, height: h };
}

/**
 * Renders a multi-segment bio paragraph with word-wrap, hand-drawn wavy marks,
 * underlined links, and returns hitboxes for interactive DOM link overlays.
 */
export function createBioParagraphTexture(
  paragraph: BioParagraph,
  options: {
    maxWidth: number;
    fontSize: number;
    lineHeightRatio?: number;
    color?: string;
  },
): BioParagraphTextureResult {
  const { maxWidth, fontSize, lineHeightRatio = 1.6, color = '#c4c3cc' } = options;
  const scale = 2;
  const lineH = fontSize * lineHeightRatio;
  const padX = 4;
  const padY = 4;
  const font = `500 ${fontSize}px "Libre Franklin", system-ui, sans-serif`;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = font;

  // Tokenize segments into words & spaces while preserving segment attributes
  interface Token {
    text: string;
    mark?: boolean;
    href?: string;
  }
  const tokens: Token[] = [];
  for (const seg of paragraph.segments) {
    const parts = seg.text.split(/(\s+)/);
    for (const part of parts) {
      if (part.length > 0) {
        tokens.push({ text: part, mark: seg.mark, href: seg.href });
      }
    }
  }

  interface PlacedToken extends Token {
    x: number;
    line: number;
    w: number;
  }

  const placed: PlacedToken[] = [];
  let cursorX = padX;
  let lineIdx = 0;

  for (const tok of tokens) {
    const isSpace = /^\s+$/.test(tok.text);
    const w = ctx.measureText(tok.text).width;
    if (!isSpace && cursorX > padX && cursorX + w > maxWidth - padX) {
      lineIdx++;
      cursorX = padX;
    }
    if (isSpace && cursorX === padX) {
      continue;
    }
    placed.push({ ...tok, x: cursorX, line: lineIdx, w });
    cursorX += w;
  }

  const totalLines = lineIdx + 1;
  const width = Math.ceil(maxWidth);
  const height = Math.ceil(totalLines * lineH + padY * 2);

  canvas.width = width * scale;
  canvas.height = height * scale;
  ctx.scale(scale, scale);
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';

  const links: BioLinkHitbox[] = [];
  const baselineOffset = fontSize * 0.96;

  // Group contiguous href tokens on same line into single link hitboxes
  let activeLink: {
    href: string;
    label: string;
    x0: number;
    x1: number;
    line: number;
  } | null = null;

  const flushLink = () => {
    if (!activeLink) return;
    const ly = padY + activeLink.line * lineH;
    const lw = activeLink.x1 - activeLink.x0;
    // Convert top-left canvas coords to centered quad local coords (y-up)
    links.push({
      href: activeLink.href,
      label: activeLink.label.trim(),
      x: activeLink.x0 + lw * 0.5 - width * 0.5,
      y: height * 0.5 - (ly + lineH * 0.5),
      w: lw,
      h: lineH,
    });
    activeLink = null;
  };

  for (const tok of placed) {
    const baselineY = padY + tok.line * lineH + baselineOffset;
    ctx.fillStyle = color;
    ctx.fillText(tok.text, tok.x, baselineY);

    const isSpace = /^\s+$/.test(tok.text);

    if (tok.mark && !isSpace) {
      // Hand-drawn wavy underline
      ctx.strokeStyle = 'rgba(196, 195, 204, 0.85)';
      ctx.lineWidth = 1.35;
      ctx.beginPath();
      const uy = baselineY + 3.5;
      const steps = Math.max(6, Math.round(tok.w / 4));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = tok.x + t * tok.w;
        const py = uy + Math.sin(t * Math.PI * 3.5 + tok.x * 0.1) * 1.1;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    if (tok.href) {
      if (!isSpace) {
        ctx.strokeStyle = 'rgba(196, 195, 204, 0.72)';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        const uy = baselineY + 2.8;
        ctx.moveTo(tok.x, uy);
        ctx.lineTo(tok.x + tok.w, uy);
        ctx.stroke();
      }
      if (activeLink && activeLink.href === tok.href && activeLink.line === tok.line) {
        activeLink.x1 = tok.x + tok.w;
        activeLink.label += tok.text;
      } else {
        flushLink();
        if (!isSpace) {
          activeLink = {
            href: tok.href,
            label: tok.text,
            x0: tok.x,
            x1: tok.x + tok.w,
            line: tok.line,
          };
        }
      }
    } else {
      flushLink();
    }
  }
  flushLink();

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return { texture, width, height, links };
}
