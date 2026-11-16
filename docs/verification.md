# Verification Report (`ink-tree-site`)

## 1. Environment & Tooling

- **Project**: `/Users/mac/workspace/projects/ink-tree-site`
- **Stack**: Vite `^6.3.5`, React `^19.1.0`, TypeScript `^5.8.3`, Three.js `^0.176.0`, Motion `^12.12.0`, `@mdx-js/rollup` `^3.1.0`, `@fontsource/libre-franklin` `^5.2.6`, `@fontsource/ibm-plex-mono` `^5.2.6`
- **Typecheck & Production Build**: `pnpm build` (`tsc -b && vite build`) — passed with exit code `0`.
- **Headless Browser Verification**: Playwright (`chromium`, Google Chrome channel) running against `vite preview` under software WebGL (`--use-gl=angle --use-angle=swiftshader --enable-webgl --ignore-gpu-blocklist`) — finished with **0 console errors** and **0 uncaught page errors**.

## 2. Checks Performed

### Desktop (`1440x900`)
- Verified full-viewport WebGL `<canvas>` (`1440x900`), `#2a282c` paper background, `#111012` surround with viewport-space torn/beveled frame, drifting dust specks, tree silhouette, 4 interactive branches (`work with me`, `updates`, `writing`, `me`), ground grass/wildflowers, and bottom-right music widget + 2-line caption arrow ([`home-desktop.png`](./verification/home-desktop.png)).
- Verified hover underline animation on `"me"` ([`hover-me.png`](./verification/hover-me.png)).
- Verified opening `"me"` (`"me."`, camera pan/zoom to right, branch + canopy growth, 6 staggered bio paragraphs with wavy marks & links, 4 overlapping rotated/taped halftone photos, zoomed root & dense grass reveal, bottom-left `↩` back pill) and returning via `Escape` ([`click-me.png`](./verification/click-me.png)).
- Verified opening `"updates"` (diagonal chain of 7 date canopies `apr 20` – `jun 13`), `"writing"` (`placeholder post` / `jan 1`), and `"work with me"` (`book a call` / `hello@example.com`), plus returning via `.back-pill` ([`click-updates.png`](./verification/click-updates.png), [`click-writing.png`](./verification/click-writing.png), [`click-work.png`](./verification/click-work.png)).
- Verified pointer drag pan with inertia, mouse wheel scroll, keyboard arrow panning, and music widget Play/Next track switching (`placeholder · track title` -> `placeholder · dusk loop`).
- Verified routing to `/updates/2026-06-13/`, `/blog/placeholder-post/` ([`post-desktop.png`](./verification/post-desktop.png)), and returning to `/` via `← Index`.
- Verified `prefers-reduced-motion: reduce` context completes branch open transitions immediately without errors.

### Mobile (`390x844`, touch enabled)
- Verified centered tree layout, top-level branch label placement, bottom grass band, centered music pill & 2-line caption below the grass ([`home-mobile.png`](./verification/home-mobile.png)).
- Verified opening `"me"` on mobile (`me.` branch at left, bio column, 2x2 overlapping taped halftone photo collage clearing the ground band and bottom player, `↩` back pill) ([`click-me-mobile.png`](./verification/click-me-mobile.png)).
- Verified mobile MDX update post route `/updates/2026-06-13/` (single-column padding, hidden desktop top-right CTA below `768px`, inline procedural abstract study figure) ([`post-mobile.png`](./verification/post-mobile.png)).

## 3. Residual Visual & Functional Differences

This implementation targets perceptual and interactive parity while generating 100% original geometry, shaders, copy, and artwork. Known residual differences relative to `.reference/` include:

1. **Procedural tree, foliage, and grass shapes**: Built deterministically from our own Mulberry32 + 2D FBM botanical generators (`src/tree/geometry.ts`), so individual canopy cloud contours, thorn positions, root forks, and grass blade angles differ in micro-silhouette from the reference.
2. **Paper grain, torn border, and ink stippling texture**: Implemented via custom procedural GLSL value/FBM noise shaders (`src/tree/shaders.ts`) rather than raster texture stamps, resulting in slightly more uniform micro-grain distribution across scales.
3. **Bio photography & update imagery**: Uses 4 procedurally drawn abstract grayscale compositions (`rings`, `horizon`, `monolith`, `lattice` in `src/tree/proceduralArt.ts`) screened through our halftone shader, plus SVG abstract studies (`src/components/AbstractStudy.tsx`) in update posts instead of real photographs.
4. **Ambient audio widget**: Synthesizes 3 calming WebAudio chord/arpeggio loops (`src/audio/synthPlayer.ts`) on demand instead of streaming external/copyrighted audio files; the external arrow (`↗`) links to placeholder URLs.
5. **Hand-drawn music caption lettering & arrow**: Rendered cleanly with styled Libre Franklin + italic contrast and SVG curved arrow (`src/components/MusicWidget.tsx`) rather than custom scanned handwriting glyphs.
6. **Mobile `"me"` card layout**: Bio column and 2x2 photo pile are scaled to fit cleanly above the ground band and fixed music bar in `390x844` without clipping.
7. **Software WebGL rendering**: Verified in headless Chrome via SwiftShader ANGLE; hardware GPUs may exhibit subtle subpixel antialiasing differences on crisp text planes and halftone dots.

## 4. Original Asset & Dependency Provenance

- **GLSL Shaders (`src/tree/shaders.ts`)**: Written from scratch for this project (paper background, viewport torn bevel frame, grainy strokes, stippled canopies, halftone photos, masking tape, ink text fade, drifting dust).
- **Procedural Botany & Art (`src/tree/rng.ts`, `src/tree/geometry.ts`, `src/tree/proceduralArt.ts`)**: Written from scratch; zero traced contours or reference image masks.
- **Fonts**: Bundled locally via `@fontsource/libre-franklin` and `@fontsource/ibm-plex-mono` (zero external font/CDN requests).
- **Audio**: Synthesized client-side using Web Audio API (`src/audio/synthPlayer.ts`); zero external audio files.
- **Content & Links (`src/data/siteContent.ts`, `src/content/**/*.mdx`)**: Neutral placeholder copy, `example.com` / `cal.com/example` URLs, and matching date/link structure.
- **Reference artifacts**: `.reference/` stays excluded from git via `.gitignore` and is never bundled or served.
