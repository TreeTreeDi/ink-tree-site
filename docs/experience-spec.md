# ink-tree-site — experience spec (from recon of the reference site, 2026-11-17)

Reference screenshots in `.reference/` are EXPERIENCE REFERENCE ONLY (gitignored, never commit, never ship).
Hard rules: write all code, shaders and art yourself. Do NOT fetch, copy or adapt the reference site's
JS bundle, shaders, text, photos, or fonts other than free ones listed here. Tree silhouette, grass,
flowers, frame and ink texture must be produced by OUR OWN procedural generator (seeded), matching the
reference's overall proportions, density, placement and feel — not traced from its screenshots.

## Global (home `/`)
- Single full-viewport `<canvas>` (WebGL via three.js, orthographic camera), `html,body{margin:0;height:100%;overflow:hidden;background:#2a282c}`, `touch-action:none`.
- Paper surface: page colour ≈ #2a282c (deep warm grey-purple). Outer surround darker (≈ #161518) visible as a ~12px margin at desktop 1440x900.
  Page frame = bevelled sheet with slightly torn/irregular edge + soft drop shadow down-right. Sparse light dust specks (1–2px, low alpha) scattered on the sheet, slowly drifting/parallax with camera.
- Ink: pale lavender-grey ≈ #c4c3cc, with grainy/stippled edges (noise-thresholded coverage, slight bleed, small holes in foliage) — like screen-printed ink on dark paper. Write our own fragment shader (noise + threshold) for this.
- Font: Libre Franklin 500–700 (@fontsource/libre-franklin), labels lowercase, colour ≈ ink colour, desktop label size ≈ 15px at 1440w (≈ 11px in 1024-wide screenshots), mobile ≈ 15–16px.
- Tree (home view, desktop 1440x900): one tall tree, trunk thin and straight, x ≈ 40% of width, base at ground ≈ 97% height; canopy cloud-like lumpy stacked masses from ≈ 18% to ≈ 77% height, canopy width ≈ 14% of viewport. Four labelled side branches, each a thin twig with small thorn-like nubs, label at the twig tip:
  - "work with me" — left, ≈ 30% height
  - "updates" — right, ≈ 37% height
  - "writing" — left, ≈ 50% height
  - "me" — right, ≈ 57% height
- Ground: band of grass blades + small wildflowers/weeds silhouettes along the bottom ≈ 6% of height across full width, denser near the trunk.
- Music widget (bottom right, desktop ≈ right 4%, bottom 4%): pill ≈ 380x28 px (1440w), ink-coloured fill with dark text: ▶ play, scrolling/truncated track title "placeholder · track title…", a small ▲/volume?, ↗ external link, ⏭ next. Above it, a handwritten-feel caption with a curved arrow pointing down at the pill: two lines of placeholder text of similar length (e.g. "maybe this tells you more / if you press play here!"). No copyrighted audio: generate a tiny placeholder tone/loop in WebAudio or ship a CC0 synthesized file we generate ourselves. Mobile: caption + pill centred at bottom, pill ≈ 80% width.
- Back button: bottom-left pill with "↩"-style arrow (≈ 52x28 at 1440w), appears only when a branch is open. Esc also goes back.

## Interaction model
- Hover a label: label underlines (hand-drawn wobble underline) + cursor pointer; the twig may sway slightly.
- Click a top-level label: camera pans & zooms so the opened branch sits in a comfortable spot; selected label gets a trailing "." and wobbly underline (e.g. "me."). Branch grows (stroke-draw animation from base to tip, then canopy blobs puff in) revealing children. Timings measured on reference: camera move ≈ 300–450ms ease-out; content reveal staggered over ≈ 1.2–1.6s (paragraphs fade/ink-in one by one ~150ms apart; photos drop in one by one).
  - "me": camera shifts so tree is at left (~15% x), grown side branch with a small canopy; to its right a column of bio paragraphs (6 paragraphs, ≈ 300px wide at 1440w, ≈ 15px Libre Franklin, line-height ≈ 1.6). Some words are "marked" (wavy hand-drawn underline) and some are links (underline). Further right a pile of 4 taped photos (sizes 760x760, 760x558, 639x760, 760x439 source px, displayed ≈ 150–170px), rotated ±3–8°, overlapping, rendered halftone/stippled in ink colour, each with 1–2 tape strips; hovering a photo shows its note caption. Ground also gains roots under the trunk and more grass when zoomed in.
  - "writing": branch grows with 1 child canopy labelled "placeholder post" + small date note "jan 1"; click → navigates to `/blog/placeholder-post/`.
  - "updates": a long diagonal chain of 7 small canopies going up-right, each labelled with a date ("jun 13", "may 10", "apr 28", "apr 23", "apr 22", "apr 21", "apr 20"); click → `/updates/2026-06-13/` etc. (placeholder MDX).
  - "work with me": branch with 2 children: "book a call" (placeholder https://cal.com/example) and "hello@example.com" (mailto, drawn as a small sprig).
- Input: pointer drag pans the sheet (with inertia), wheel scrolls/pans vertically, touch drag on mobile, keyboard (arrows pan, Enter/Space opens focused label, Tab cycles labels, Esc back), deviceorientation tilt gives a subtle parallax on mobile. Respect prefers-reduced-motion.
- Accessibility: keep an offscreen DOM nav mirroring the tree labels/links so it's crawlable and keyboard accessible.

## Mobile (390x844)
- Tree centred, taller/narrower canopy filling ≈ 10%–65% height, trunk to ground ≈ 88%; labels: "work with me" left ≈ 18%, "updates" right ≈ 27%, "writing" left ≈ 38%, "me" right ≈ 48%; ground band with grass + flowers; music caption + pill bottom centre.

## Post pages (`/blog/:slug/`, `/updates/:date/`) — MDX, plain DOM
- `html{background:#1e1e1e}` body: IBM Plex Mono (@fontsource/ibm-plex-mono 400/700), font-size .82rem, line-height 1.85, colour #d4d4d4, `zoom:.9`, scrollable.
- container padding `3rem 2rem 5rem 5.5rem`, content max-width 640px.
- "← Index" link top (0.8rem, rgba(229,229,229,.4); hover: colour #e5e5e5 on #FF8800 background), margin-bottom 2.5rem.
- h1 .93rem bold #e5e5e5 line-height 1.4 margin-bottom .25rem; date `YYYY-MM-DD` .8rem rgba(229,229,229,.4).
- content margin-top 1.6rem; p margin 1.2rem 0; ul padding-left 1.5rem, li margin .5rem 0 with square-ish bullets as in reference.
- Fixed top-right CTA (top 2rem right 2rem, .75rem mono, rgba(229,229,229,.4), right-aligned, 2 lines): "got a <span>question</span>?" / "book 30min"; span #FF8800 underlined; hover span: #e5e5e5 on #FF8800. Hidden <768px.
- Footer: short 1px rule (~150px, rgba(229,229,229,.2)) then `[↗]: Email, LinkedIn, Twitter` with links in #FF8800 underlined (placeholder hrefs).
- Images in update posts: placeholder abstract images we generate.

## Placeholder content
- Replace all text with neutral placeholder of matching length/structure (e.g. "i'm alex. placeholder, based in somewhere."). Same headings, links count, date formats. No real names of the reference author, no photos of real people — generate abstract/procedural images (gradients, shapes) and run them through our halftone shader.
- Title `ink tree (╯°□°)╯` style kaomoji fine; own favicon (simple tree glyph SVG).
