# Verification Report (`ink-tree-site`)

## 1. Environment & Tooling

- **Project**: `/Users/mac/workspace/projects/ink-tree-site`
- **Stack**: Vite `^6.4.6`, React `^19.3.1`, TypeScript `^5.8.3`, Three.js `^0.176.0`, Motion `^12.43.0`, `@mdx-js/rollup` `^3.1.0`, `@fontsource/libre-franklin` `^5.3.0`, `@fontsource/ibm-plex-mono` `^5.2.6`
- **Typecheck & Production Build**: `pnpm build` (`tsc -b && vite build`) — passed with exit code `0`.
- **Headless Browser Verification**: Playwright (`chromium`, Google Chrome channel) running against `vite preview` under software WebGL (`--use-gl=angle --use-angle=swiftshader --enable-webgl --ignore-gpu-blocklist`) — finished with **0 console errors** and **0 uncaught page errors**.

## 2. Round 2 Acceptance Fixes & Checks Performed

### Fixes Verified (Round 2)
1. **Home Canopy Width, Solidity, S-Curve & Short Twigs (`1440x900` & `390x844@2x`)**:
   - Widened the main canopy (`canopyRx = 126` desktop, `60` mobile), raised S-curve horizontal stagger (`dx` up to `±46` desktop / `±25` mobile), and spanned desktop vertical canopy bounds `y ≈ 18%..77%` and mobile `y ≈ 10.5%..65%`.
   - Raised interior infill solidity in [`CANOPY_FRAG`](file:///Users/mac/workspace/projects/ink-tree-site/src/tree/shaders.ts) (`thresh = mix(0.72, 0.88, uDensity)`, sparser pinholes) so each cloud reads ~70–87.5% filled while preserving open coves and trunk visibility through gaps.
   - Shortened branch twigs so they emerge cleanly from inside the canopy silhouette (`~40–60px` visible outside). On mobile, shifted `trunkX = 12` and shortened `work with me` `tipDx = -64` so `"work with me"` stays fully inside the viewport (hit-box `x = 21.5px >= 16px`, text start `~33px`, never clipped).
2. **Ground Flora Density & Wildflowers**:
   - Removed the continuous solid horizontal ground line in [`buildGroundFlora`](file:///Users/mac/workspace/projects/ink-tree-site/src/tree/geometry.ts); grass now sits in clustered low tufts (`~15–30px` height) with natural meadow gaps between clusters.
   - Replaced uniform dense flower rows with `~8–12` visible (16 across full pan width desktop, 9 mobile) unevenly scattered wildflowers/tall weeds (`38–70px` height), kept clear of the bottom-right music widget zone.
3. **`me` Expanded View (Framing, Compact Bio, Larger Cloud, Collage)**:
   - Adjusted desktop `me` camera to `{ x: 364, y: -70, zoom: 1.02 }` so the full tree stays unclipped (`trunk x ≈ 14%`, canopy top `≈ 5–7%`, ground `≈ 85–87%`).
   - Tightened bio typography (`fontSize = 11.4`, `lineHeightRatio = 1.38`, `gap = 7`, `maxWidth = 288`) so all 6 paragraphs stay strictly inside `y ≈ 27%..59%` with `0.00%` text ink in `y = 60%..75%` (zero overlap with grass or tree).
   - Enlarged the `me.` side branch cloud (`rx = 44, ry = 34` desktop -> `~88–100px` diameter).
   - Rebuilt [`ME_PHOTOS`](file:///Users/mac/workspace/projects/ink-tree-site/src/data/siteContent.ts) into a dispersed asymmetric 2x2 collage (`~220x230px` scaled `0.88` from `x ≈ 58%, y ≈ 27%`: top-left square, lowered overlapping top-right landscape, bottom-left portrait, bottom overlapping landscape) with diagonal semi-transparent corner masking tapes (`±32°..38°`, `38–42px`).
4. **`updates` & `work` Expanded Views & Sibling Twig Retraction**:
   - Updated [`InkTreeScene.animate`](file:///Users/mac/workspace/projects/ink-tree-site/src/tree/InkTreeScene.ts) so inactive sibling branch twigs retract (`uProgress -> 0`) and fade out (`uOpacity -> 0`) alongside sibling labels whenever any branch opens, leaving only the active branch extended.
   - `updates`: Camera `{ x: 245, y: 252, zoom: 1.16 }` places the upper half of the main canopy in the lower-left (trunk base off-viewport), starts the first cloud (`jun 13`) close to the main canopy (`t = 0.05`), and sweeps 7 tapering clouds (`scaleT = 1 - frac * 0.62`) along a strongly curved arch toward `apr 20`.
   - `work`: Camera `{ x: -490, y: 208, zoom: 1.12 }` places the tree in the lower-right with an arching up-left branch carrying 5 tapering cloud clusters (4 on mobile) and stacked child links above the tip.
5. **Home `<a href="/blog/...">` DOM Discovery**:
   - Restored `<nav className="sr-only">` in [`HomePage`](file:///Users/mac/workspace/projects/ink-tree-site/src/pages/HomePage.tsx) containing real `<a href>` links for all blog posts (`a[href^="/blog/"]` count = `1`), updates, and external work links, with zero duplicate `<button>` elements inside `.sr-only` so `main button:visible` matching `/^me$/` remains count `1`.
6. **Desktop Music Caption Alignment**:
   - Adjusted [`.music-caption`](file:///Users/mac/workspace/projects/ink-tree-site/src/index.css) on desktop to `margin-left: 20px; margin-bottom: 6px; font-size: 14.5px; line-height: 1.24;` — verified via Playwright bounding boxes at `gapAbovePill = 6px`, `leftOffsetFromPill = 20px`, matching label size (`14.5px`), and pointing cleanly toward the pill clear of the grass band.

### Quantitative Verification Summary (Round 2 Playwright Run)
- **Build**: `pnpm build` (`tsc -b && vite build`) — exit code `0`.
- **Console / Page Errors**: `0` desktop, `0` mobile, `0` reduced-motion.
- **Playwright Assertions**:
  - Home `a[href^="/blog/"]` count: `1` (pass).
  - Desktop `main button:visible, main a:visible` matching `/^me$/` count: `1`, 3s hover/click timeout passed cleanly.
  - Desktop music caption layout: `gapAbovePill: 6`, `leftOffsetFromPill: 20`, `fontSize: "14.5px"`.
  - Mobile `"work with me"` hit-box: `{ x: 21.5, y: 127, width: 119, height: 40 }` (`>= 16px` left margin).

### Screenshots Captured (Regenerated Round 2)
- **Desktop (`1440x900`)**: [`home-desktop.png`](./verification/home-desktop.png), [`hover-me.png`](./verification/hover-me.png), [`click-me.png`](./verification/click-me.png), [`click-updates.png`](./verification/click-updates.png), [`click-writing.png`](./verification/click-writing.png), [`click-work.png`](./verification/click-work.png), [`post-desktop.png`](./verification/post-desktop.png).
- **Mobile (`390x844@2x`, `780x1688` output, touch enabled)**: [`home-mobile.png`](./verification/home-mobile.png), [`click-me-mobile.png`](./verification/click-me-mobile.png), [`click-updates-mobile.png`](./verification/click-updates-mobile.png), [`click-writing-mobile.png`](./verification/click-writing-mobile.png), [`click-work-mobile.png`](./verification/click-work-mobile.png), [`post-mobile.png`](./verification/post-mobile.png).
- **Reduced Motion (`1440x900`, `prefers-reduced-motion: reduce`)**: Verified instant branch open transitions with `0` errors.

## 3. Round 1 Acceptance Fixes & History

### Round 1 Fixes Verified
1. **Canopy Ink, Dither & Cloud Layering (`#c4c3cc`)**: Fixed Three.js linear-vs-sRGB `THREE.Color` conversion (`THREE.LinearSRGBColorSpace` on `INK_COLOR`), increased screen-print contrast/pinhole dither and interior paper voids in `CANOPY_FRAG`, and split the canopy into 8–9 horizontally staggered front/back cloud layers (`z=1.65` and `z=2.35`) around the trunk (`z=2.0`) so coves, dark seams, and the central trunk peek through.
2. **Branches**: Extended all 4 primary branches with straighter organic paths, crisp thorn nodes, and `~8px` label clearance.
3. **Ground Flora, Shrubs & Roots**: Added full-width clustered grass bands, staggered tall weed/wildflower stems with stippled flower heads, branching sub-ground roots, and 4 low shrub clusters revealed when zooming/opening branches.
4. **Torn Bevel Border & Dust**: Added DPR-normalized torn frame widths (`~13.5px` CSS desktop margin, `~8px` mobile margin), down-right cast shadow, stronger `18px` inner bevel shading, and 150 brighter drifting dust specks.
5. **`me` Expanded View**: Positioned desktop camera so the trunk rests near `x≈14%` and ground near `y≈85%`, hid inactive sibling branch labels, added a small canopy cloud on the extended `me.` branch, aligned bio paragraphs at `x≈33%, y≈27%`, overlapped rotated dark halftone photo cards with semi-transparent masking tape, and staggered paragraph/photo reveals across `~1.5s`.
6. **`updates` Expanded View**: Ordered the 7 descending canopies from closest/largest (`jun 13`) near the trunk to farthest/smallest (`apr 20`) at the tip along an up-right branch with a single tip fork.
7. **`writing` & `work` Expanded Views**: Re-centered cameras cleanly on the active branch and hid the remaining 3 top-level branch labels.
8. **Music Widget (`desktop` & `390x844@2x`)**: Placed the 2-line caption above the pill on both desktop and mobile with the curved down-pointing arrow on the left, replaced Unicode/OS-emoji controls with crisp `#2a282c` monochrome inline SVGs, and offset `.music-widget.has-back` on mobile so `.back-pill` and `.music-pill` do not overlap.
9. **Playwright Clickability & Stability**: Rendered actual visible label text inside `.tree-hit-target` controls at `z-index: 15`, snapped settled camera interpolation to prevent subpixel drift, and removed duplicate `.sr-only` `<button>` elements inside `<main>`.
10. **Post Pages (`/blog/*`, `/updates/*`)**: Strengthened the `150px` subtle horizontal divider (`~135px` rendered under `zoom: 0.9`) above `.post-footer-links` and removed inline `<code>` box styling and backticks (`codeCount: 0`).

## 4. Residual Visual & Functional Differences

This implementation targets perceptual and interactive parity while generating 100% original geometry, shaders, copy, and artwork. Known residual differences relative to `.reference/` include:

1. **Procedural tree, foliage, and grass shapes**: Built deterministically from our own Mulberry32 + 2D FBM botanical generators (`src/tree/geometry.ts`), so individual canopy cloud contours, thorn positions, root forks, and grass blade angles differ in micro-silhouette from the reference.
2. **Paper grain, torn border, and ink stippling texture**: Implemented via custom procedural GLSL value/FBM noise shaders (`src/tree/shaders.ts`) rather than raster texture stamps, resulting in slightly more uniform micro-grain distribution across scales.
3. **Bio photography & update imagery**: Uses 4 procedurally drawn abstract grayscale compositions (`rings`, `horizon`, `monolith`, `lattice` in `src/tree/proceduralArt.ts`) screened through our halftone shader, plus SVG abstract studies (`src/components/AbstractStudy.tsx`) in update posts instead of real photographs.
4. **Ambient audio widget**: Synthesizes 3 calming WebAudio chord/arpeggio loops (`src/audio/synthPlayer.ts`) on demand instead of streaming external/copyrighted audio files; the external arrow (`↗`) links to placeholder URLs.
5. **Hand-drawn music caption lettering & arrow**: Rendered with styled Libre Franklin + SVG curved arrow (`src/components/MusicWidget.tsx`) rather than scanned handwriting glyphs.
6. **Software WebGL rendering**: Verified in headless Chrome via SwiftShader ANGLE; hardware GPUs may exhibit subtle subpixel antialiasing differences on crisp text planes and halftone dots.

## 5. Original Asset & Dependency Provenance

- **GLSL Shaders (`src/tree/shaders.ts`)**: Written from scratch for this project (paper background, viewport torn bevel frame, grainy strokes, stippled canopies, halftone photos, masking tape, ink text fade, drifting dust).
- **Procedural Botany & Art (`src/tree/rng.ts`, `src/tree/geometry.ts`, `src/tree/proceduralArt.ts`)**: Written from scratch; zero traced contours or reference image masks.
- **Fonts**: Bundled locally via `@fontsource/libre-franklin` and `@fontsource/ibm-plex-mono` (zero external font/CDN requests).
- **Audio**: Synthesized client-side using Web Audio API (`src/audio/synthPlayer.ts`); zero external audio files.
- **Content & Links (`src/data/siteContent.ts`, `src/content/**/*.mdx`)**: Neutral placeholder copy, `example.com` / `cal.com/example` URLs, and matching date/link structure.
- **Reference artifacts**: `.reference/` stays excluded from git via `.gitignore` and is never bundled or served.
