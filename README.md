# ink-tree-site

An interactive dark-paper & grainy lavender-ink botanical website built with Vite, React, TypeScript, Three.js (custom procedural geometry + GLSL shaders), Motion, Fontsource (`Libre Franklin` & `IBM Plex Mono`), and MDX.

## Development & Build

```bash
pnpm install
pnpm dev       # starts dev server on 0.0.0.0:4173
pnpm build     # typechecks (tsc -b) and builds production bundle into dist/
pnpm preview   # previews production bundle locally
```

## Architecture

- **`src/tree/shaders.ts`** — Custom GLSL vertex & fragment shaders written from scratch:
  - `#2a282c` textured paper sheet & viewport-space torn/beveled edge frame (`#111012` surround + drop shadow)
  - Noise-thresholded stippled canopy blobs with organic holes and puff-in growth
  - Tapered grainy ink strokes with progressive draw-in and gentle wind/hover sway
  - Angled halftone dot-screen shader for taped abstract photo cards
  - Drifting paper dust particles with camera parallax
- **`src/tree/geometry.ts` & `src/tree/rng.ts`** — Deterministic seeded (Mulberry32 + 2D FBM) botanical generator for the trunk, cloud-like canopy clusters, thorned twigs, grass blades, wildflowers, roots, and wobbly underlines.
- **`src/tree/proceduralArt.ts`** — Procedural abstract grayscale artwork generator (no external photos or portraits) and high-DPI Canvas2D ink typography layout.
- **`src/tree/InkTreeScene.ts`** — Orthographic Three.js scene controller handling smooth camera pan/zoom easing, pointer drag with inertia, wheel scroll, touch drag, device-orientation tilt parallax, keyboard navigation, and full GPU resource disposal.
- **`src/audio/synthPlayer.ts` & `src/components/MusicWidget.tsx`** — Self-contained WebAudio ambient synthesizer with three procedural loop presets (no copyrighted audio files).
- **`src/pages/PostPage.tsx`** — Monospace `#1e1e1e` reading layout for `/blog/:slug/` and `/updates/:date/` MDX posts.

## Replacing Placeholder Content

All neutral placeholder text, links, and media specs live in cleanly isolated files:

1. **Bio, branch labels, photo captions, music tracks, and external URLs**: edit [`src/data/siteContent.ts`](src/data/siteContent.ts) (`SITE_CONFIG`, `BIO_PARAGRAPHS`, `ME_PHOTOS`, `UPDATE_ENTRIES`, `WRITING_POSTS`, `WORK_LINKS`, `MUSIC_TRACKS`).
2. **Photo artwork**: [`src/tree/proceduralArt.ts`](src/tree/proceduralArt.ts) (`createAbstractPhotoTexture`) currently paints procedural geometric/landscape studies before running them through the halftone shader. You can swap those textures with local static image assets if desired.
3. **Blog & update posts**: add or edit MDX files in [`src/content/blog/`](src/content/blog/) and [`src/content/updates/`](src/content/updates/), and register new routes in [`src/content/registry.ts`](src/content/registry.ts).
4. **Ambient audio**: [`src/audio/synthPlayer.ts`](src/audio/synthPlayer.ts) synthesizes placeholder tones via WebAudio; replace with your own audio tracks or presets as needed.
5. **Favicon & page title**: [`public/favicon.svg`](public/favicon.svg) and [`index.html`](index.html).
