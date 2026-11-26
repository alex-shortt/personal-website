# Personal website

Built with Next.js 16 (Pages Router), React 19, TypeScript, and Tailwind CSS 4.

## Getting started

Use Node.js 24 LTS (or another version matching `engines.node` in `package.json`) and the pnpm version pinned in `packageManager`.

```bash
nvm install
nvm use
corepack disable pnpm # If Corepack is installed
npm install --global pnpm@12.21.0
pnpm install
pnpm dev
```

Install pnpm directly: Corepack can try to launch the removed `bin/pnpm.cjs` entry point with pnpm 12.

Open http://localhost:3000. Edit `src/pages/index.tsx` to start building.
Global styles and Tailwind configuration live in `src/styles/globals.css`.
Fonts use the built-in `next/font` integration.

## Checks and production

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm start
```

Run lint separately: Next.js 16 no longer runs it as part of the production build.
Commit `pnpm-lock.yaml` when changing dependencies; CI can install with `pnpm install --frozen-lockfile`.

TypeScript 7 runs the `typecheck` script. The `typescript` dependency aliases the official TypeScript 6 compatibility package so Next.js and ESLint can still use the compiler API; `typescript-native` supplies TypeScript 7’s `tsc` executable.

Some ESLint plugins still declare peer ranges ending at ESLint 9. Next.js 16.4 supports ESLint 10, and lint is verified with this setup; pnpm may still report those upstream peer warnings.

## Cloud study

- `/` is the React Three Fiber / WebGL2 cloud study, with an FPS counter at top right.
- `/timeline` preserves the previous homepage.
- `src/components/cloud/settings.ts` controls spotlight positions, aim targets, inner/outer cone half-angles (degrees), colors, on-axis intensities, fixture sizes, ambient fill, exposure, and quality levels. `cloudLighting.extinction` controls light penetration independently of view opacity; `cloudLighting.bounce` controls the approximate internal colored fill. `cloudLighting.separation` blends from additive illumination (0) to winner-takes-most illumination (1), using the stronger light’s intensity instead of their sum; `transitionWidth` controls the narrow smooth crossover around equal contributions, and `cloudColor.saturation` scales a staged saturation response (1 is neutral control strength): weak color rises quickly, midtones retain a graded range, and peak saturation is reserved for stronger color. The old blanket 1.8× boost is removed. Illumination comes from two spotlights with inverse-square falloff and a smooth cosine-space penumbra between the inner and outer cones. Cone attenuation is computed in the cached lighting atlas, with no additional raymarch samples.
- `scripts/generate-cloud-shape.py` extracts the reference alpha mask (threshold 128), removes specks smaller than 64 pixels, and fills enclosed holes. It bakes a 512×320 profile texture (~81 KiB) containing the signed outline, half-depth, and depth offset. This makes the front silhouette a constraint while leaving depth sculptable. Regenerate with NumPy, SciPy, and Pillow installed. `shaders.ts` supplies surface density variation around a filled core; noise cannot punch tunnels through the body. Keep generator/shader bounds in sync with `studio.cloudBounds`.

The renderer caches light transmission in a small half-float atlas, refreshing a sixth per frame. The cloud is rendered separately at adaptive resolution; the fixtures remain crisp. Spatial sampling jitter is fixed to avoid temporal sparkle. GPU timer queries (where available) and frame cadence guide quality without a React update every frame. The FPS display updates twice per second. Reduced-motion mode renders a still; hidden tabs stop continuous rendering.

The original procedural density asset is stored as a lossless PNG (~156 KiB) and decoded once into a 64³ scalar texture. To regenerate it and the sampling-jitter texture, run `python3 scripts/generate-cloud-noise.py` with NumPy, SciPy, and Pillow installed. The local fixture GLBs total ~504 KiB before HTTP compression, with embedded textures and no runtime compression decoder or HDR environment. The existing analytics SDK is deferred until after initial scene startup.

This is a real-time approximation, not a volumetric path tracer. Ambient occlusion and internal bounce are approximate; small lighting changes can lag by one atlas refresh cycle. Actual phone performance still needs physical-device validation. For profiling, the canvas exposes `data-cloud-quality`, `data-frame-p90-ms`, and `data-gpu-p90-ms` (or `unavailable` if GPU timers are unsupported).

The homepage now frames the study on the left with provisional introduction text on the right. `src/pages/Home.module.css` controls the page framing; smaller screens stack the scene above the text and scroll within the page when needed. `StudioSpace.tsx` uses the same optimized glTF head and tripod for both lights. The tripod base and head keep fixed dimensions; stand height comes from overlapping clones of a 0.435 m pole section and a separately positioned top mount. Both fixtures share cached geometry and textures. The floor draws only cached fixture shadows plus soft analytic shadows under the cloud and stand feet, so its unshadowed area exactly matches the page background. The fixture shadows refresh on mount and model arrival rather than every frame. Fixtures can overlap the cloud in projection; a future orbit/drag implementation should add scene-depth clipping to the volume compositor.

### Fixture assets

`public/models/credits.txt` contains the original CC-BY-4.0 credits for Glowbox 3D’s Studio Softbox Light and R3indeer’s Spotlight, linked from the homepage footer. The softbox, separate cable, and fake light beam are removed. Authored normals and UVs are retained; textures are resized to 256px (stand) and 512px (spotlight). Both heads share one cached model and its textures. The cloud uses two spotlight emitters; their positions and aim targets also orient the visible housings.

To rebuild the optimized GLBs from the original `tmp/studio_softbox_light.zip` and `tmp/spotlight.zip`, run `python3 scripts/prepare-studio-models.py` with NumPy and Pillow installed, then run `python3 scripts/prepare-stand-segments.py` to create the shared modular stand. Its original 3 m calibration is baked once; runtime height changes never scale the legs or pole diameter. The originals are development inputs and are never served to visitors.

The cloud composite uses a luminance-based filmic curve with a smooth staged saturation response and chroma compression into the display gamut. Saturation is remapped at constant luminance without clamping the low channel to zero, preserving variations within each light’s color. A continuous pink-chroma shoulder avoids a threshold contour at the pink/gray boundary. The pink-only highlight calibration targets the reference’s lower-luminance magenta alongside its brighter cyan (#F16CE1 / #6BF6FD). This is an artistic display treatment; fixture materials keep the renderer’s ACES tone mapping. Light dominance is an artistic winner-takes-most adjustment, not additional physical scattering. Chromatic highlights reserve luminance headroom (especially cyan) so gamut compression does not turn the color boundary white; neutral ambient shading retains its previous curve. Neither changes volume opacity, shape, or motion.

Temporary inspection controls: **Front view** isolates the cloud with an orthographic camera; **Top view** provides a true overhead reset. Drag to orbit, scroll/pinch to zoom, or press Front view again to reset. **Studio view** restores the perspective composition and fixtures. **Silhouette** resets to front and displays the actual integrated opacity as a black matte. Its comparison link opens the latest scored snapshot. Inspection omits studio geometry because the volume compositor has no scene-depth clipping yet. Controls work with reduced-motion demand rendering.

### Repeatable silhouette check

The reference determines the front outline, not the true 3D shape. The profile's half-depth and depth-offset channels are inferred and can be sculpted independently. Surface detail is provisional. The rendered silhouette is deliberately feathered, so a literal pixel-perfect binary match is not the objective.

With the dev server running and Playwright available to Node:

```sh
node scripts/capture-cloud-silhouette.mjs /tmp/cloud-silhouette.png
python3 scripts/score-cloud-silhouette.py /tmp/cloud-silhouette.png --output public/cloud/silhouette-comparison.png
```

The capture helper also accepts `BASE_URL`, `CHROME_PATH`, and `PLAYWRIGHT_MODULE` (an external module path), so QA tooling need not be installed in the website. Capture freezes animation and records the camera scale. The scorer compares actual rendered alpha to the reference in fixed world coordinates, without fitting the result or filling rendered holes. It reports intersection-over-union at 50% and 10% opacity, reference coverage, extra area, and interior coverage. The PNG shows reference/render/overlap; orange marks missing cloud and blue marks extra cloud. The adjacent JSON stores the metrics. Refresh these artifacts after shape changes; they are snapshots, not a live score.

### Procedural volume inside the reference mask

The silhouette is a coverage constraint, not an extruded cloud surface. `generate-cloud-shape.py` stores only broad thickness and depth-offset fields: a slightly deeper/forward upper bank, a smaller lower bank, and thin wisp regions. The individual front/back mounds have been removed. The original 3D density noise and finer erosion generate the visible billows throughout the volume.

A softly varying interior merges with that procedural shell, preserving occupied connections without exposing a hard core surface. The reference footprint bounds the result so local generation cannot reopen front-view holes. The profile stores outline / half-depth / depth-center in RGB; the signed-distance range is [-0.125, 0.5] and the center range is [-0.65, 0.65]. Alpha must remain 255 for lossless canvas decoding of numeric RGB data.

Regenerate the profile, rerun the silhouette check at both opacity thresholds, and inspect front, three-quarter, side, and rear views after changing section constraints. The color and light settings are independent of these shape controls.

### Rounded mask boundary

`studio.cloudShape.edgeWidth` controls the inward shoulder (0.24 world units for the deeper main body); `wispEdgeWidth` narrows it to 0.018 for shallow fragments. The shader tapers depth along a rounded profile, feathers density, and tapers the protected interior too. Density feathering is capped independently so widening the geometric shoulder does not erase the front outline. This uses the existing distance field without new assets or texture samples.

Because the border is now deliberately translucent, the old 97% IoU threshold at 50% opacity is no longer the default acceptance criterion. Review the 10% outer-silhouette metric, the 50% metric, enclosed holes, and angled views together. The scorer still supports `--min-iou` for explicit strict-opacity regression checks.

### Front and top shape evaluations

The depth profile combines a broad ellipsoidal thickness envelope with independent seeded, low-frequency fields for Z position and thickness. Z-position variation persists at the outer contour. The volume bounds extend to ±1.55 on Z to give the cloud room to become rounder from above. A depth-dependent inward boundary variation and a nonuniform protected core break up the long aligned faces visible in a top view; the existing 3D density noise still supplies the billows. The cached light-transmission integration uses 12 samples to better resolve the deeper volume.

Use **Front view** for silhouette evaluation (approximately 90–95% overlap is acceptable during depth shaping) and **Top view** for rounded, connected, uneven masses. Evaluate the top view visually rather than fitting a perfect ellipse. **Side view** looks from +X toward the cloud to expose the front overhang (front is on the left). The upper front shoulder is recessed by up to 0.42 world units with a broad vertical transition; this changes the baked profile only, retaining the procedural billows. All three presets retain orbit/zoom controls. The independent depth fields are authored offline, so they add no per-frame noise lookups. Lighting and color settings remain independently adjustable.

The upper shoulder varies in turning height and depth across X, and its top narrows gradually to avoid a continuous flat face. The lower bank contracts symmetrically in depth near its outline, retaining a full interior and thin detached wisps. These corrections are baked into the profile; they add no runtime shader work. Inspect both sides by orbiting from the Side view preset.

### Cloud decomposition lab

`/cloud-lab` is a separate diagnostic view; `/` retains the current studio treatment. The lab freezes time at zero, uses fixed high quality, and keeps camera framing unchanged when switching presets. Each preset refreshes the full lighting cache immediately to avoid comparing stale illumination.

- **Current:** existing density, lighting, and grading.
- **Simple display:** same density and lights, replacing only the custom composite grading with Reinhard tone mapping.
- **Simple · brighter lights:** the same simple-display setup with both spotlight intensities doubled; ambient, bounce coefficient, geometry, and grading remain identical. Retained as a brightness-only control.
- **Brighter · low ambient:** approved working direction: doubled external spotlights with ambient 0.05; simple display and existing scattering/bounce.
- **Low ambient · blue inside:** the approved low-ambient settings, moving only blue to (0.45, 0.18, 0.1) with omnidirectional emission. Pink remains external; intensity, bounce, phase, winner-takes-most, and display stay unchanged. This deliberately exposes how much stronger the same-intensity light becomes near the visible volume.
- **Blue inside · aimed:** internal blue at 40% of the omnidirectional test intensity, aimed along normalized (0.25, 1, 0.2), with 45°/80° inner/outer cone half-angles. Pink and the accepted low-ambient setup remain unchanged.
- **Aimed · midtone lift:** that same aimed setup plus a bounded, RGB-ratio-preserving midtone gain of 0.22; its gain vanishes toward bright highlights. No bloom.
- **Aimed · bloom:** the aimed setup with thresholded HDR highlight spreading (13-tap kernel, strength 0.16, threshold 0.7). Original cloud alpha and the sharp base render are preserved; this is confined highlight bloom, not a full-screen halo. No midtone lift. Extra texture taps run only in this preset, with no extra volume samples.
- **Low ambient · 0.01:** changes only ambient from 0.05 to 0.01 relative to the approved brighter/low-ambient baseline.
- **Low ambient · less bounce:** changes only the approximate bounce coefficient from 0.48 to 0.16; ambient remains 0.05.
- **Low ambient · grazing:** moves blue to (-2.8, 2.7, 0.6) and pink to (2.2, -0.35, 3.0), preserving their original aim targets and cones. Intensities compensate for squared-distance changes at those targets. All other baseline settings remain unchanged.
- **Brighter · more ambient:** the brighter-light preset with ambient doubled to 0.8.
- **Internal lights:** two cyan/pink omnidirectional emitters embedded in the existing filled density. Additive isotropic single scattering, extinction 7 for light and view, ambient 0.06, no fake bounce, and Reinhard display. Intensities are 160/140. This diagnostic is not a hollow papier-mâché/cotton shell or a full multiple-scattering solution; increasing ambient is a separate experiment.
- **Neutral light:** current density, one white isotropic-scattering light, matching view/light extinction (7), ambient 0.06, no bounce or artistic dominance, and Reinhard display mapping.
- **No filled core:** the neutral setup with only the protected interior core removed.
- **Procedural baseline:** the same neutral setup with the existing noise inside an ellipsoid; no image mask, regional shaping, filled core, or density plateau. This is a clean diagnostic alternative, not an exact restoration of the earliest prototype.

Rebuild checkpoints: (1) approve neutral billow readability; (2) isolate scattering, fill, and light direction one at a time; (3) introduce the colored spotlights with ordinary additive lighting; (4) compare winner-takes-most as a single optional adjustment; (5) restore only necessary shape/color treatments and check front/top/side plus performance. Get visual feedback before progressing past the neutral baseline. A pre-lab source/profile snapshot is saved locally under `tmp/cloud-checkpoints/pre-decomposition/`.

The lab now defaults to **Low ambient · 0.01**. Its main controls retain that and **Brighter · low ambient**, plus two isolated brightness comparisons: **More light** doubles spotlight power again (4× studio defaults), while **Filmic display** keeps the 2× powers and replaces Reinhard with the Narkowicz CC0 filmic fit. Both use ambient 0.01 and unchanged geometry, light positions, bounce, and dominance. The filmic fit is not full ACES and can change highlight saturation. No extra render pass, bloom, or saturation remapping is added. Previous presets remain under **Earlier experiments**. Homepage rendering is unchanged pending comparison feedback.

Further lab intensity comparisons **More light · 4× / 8× / 32×** multiply the accepted More light preset by 4, 8, and 32 (two, three, and five additional doublings). These are 16× / 32× / 128× the studio-default spotlight powers, with ambient fixed at 0.01 and Reinhard display unchanged. Filmic display is preserved and affects only the cloud composite, not the floor or fixtures. The 0.05 baseline remains available under Earlier experiments.

The lab now opens on **More light + Filmic**: the original More light powers (4× studio defaults, or twice the Filmic display preset) with the cloud-only filmic curve and ambient 0.01. This does not use the further 4×/8×/32× stress-test multipliers. All prior comparison presets remain available.

More light + Filmic uses a narrower winner-takes-most crossover: transition half-width 0.035, compared with 0.08 in the other presets. Light powers, ambient, and display curve are unchanged. The width resets on preset changes.

The latest lab default, **Filmic · balanced**, interpolates the two preferred Filmic presets: powers 3× studio defaults (576 blue / 396 pink), transition width 0.0575, and ambient 0.01. Filmic, geometry, and scattering are unchanged. The three Filmic candidates are the main controls; previous experiments remain in the archive.

The approved **Filmic · balanced** remains the default and unchanged. Three optional lab trials explore the next pass: **Interlocking color** adds a broad world-space noise field that selectively attenuates competing illumination before winner-takes-most (an artistic visibility approximation, not physical multiple scattering); **Rounder depth** shortens the profile in thin main-body regions to 60–95% and reduces their depth offsets to 75%, preserving wisps, mask, and procedural noise; **Color + depth** combines them. The density changes are shared by camera and shadow raymarches. Color variation costs one extra 3D texture sample per occupied view-ray step only in the trial presets. An **Other side** camera complements Side view. Earlier Filmic variants remain archived.

**Color + depth** is now the approved studio/homepage version and the initial lab selection (`approvedCloudPreset = 25`). The studio uses its existing perspective camera, animated density, adaptive quality, floor, fixtures, and FPS counter with the exact approved cloud preset. Other candidates remain accessible in the lab.

Studio tuning: expand **Cloud controls** at the top right of `/`. The dependency-free panel provides 44 controls for the approved cloud: Filmic toggle/blend and exposure, ambient, each spotlight’s enable/color/intensity/cone/penumbra/range/decay/XYZ position/XYZ target, extinction, bounce, phase anisotropy, light dominance/crossover/variation, density/noise/detail, edge rounding, and animation speed. Filmic strength blends Reinhard (0) to the filmic fit (1); the enabled toggle bypasses that blend. Range 0 is unlimited; decay 2 is inverse square. Penumbra sets inner angle = outer angle × (1 − penumbra). These are the custom volume spotlight parameters, not a Three.js shadow-camera UI.

Changes update the lighting cache and fixture transforms immediately, including demand-rendered/reduced-motion views. Settings persist per checkpoint in localStorage; the lab remains independent. **Copy settings**, **Download JSON**, and **Show JSON** export `{schema:"cloud-studio-tuning", version:1, basePreset:"Color + depth", checkpoint:"v2", values:{...}}`. Paste that snapshot into the conversation to reproduce a look. The same current snapshot is readable from the DOM script `#cloud-tuning-state`; no per-frame React state updates are used. **Reset checkpoint** restores the selected JSON snapshot. Saved values are type-checked, bounded, and merged with defaults on load. No new package dependency was added.

Approved checkpoint **2026-11-23** is saved verbatim in `public/cloud/checkpoints/v2.json` and supplies the latest studio defaults. The existing lab comparisons remain historical references.

The studio checkpoint selector now provides **v1** (previous Color + depth defaults) and **v2** (the exact user-approved November 23 snapshot). New sessions start on v2. Saved edits use `cloud-studio-checkpoint-v1` / `cloud-studio-checkpoint-v2`, and the selection persists under `cloud-studio-active-checkpoint-v2`. Switching preserves each draft; **Reset checkpoint** restores the selected immutable JSON snapshot. Exports include `checkpoint` separately from the JSON schema `version: 1`. The older localStorage keys are retained but no longer read.

**v3** is the latest approved checkpoint (`public/cloud/checkpoints/v3.json`), with the second November 23 tuning snapshot. It is the default for fresh selections; v1/v2 and their saved drafts remain available. Active selection now persists under `cloud-studio-active-checkpoint-v3`; per-checkpoint draft keys are unchanged. All submitted values are preserved; exported checkpoint identity is v3.

**v4** is now the default (`public/cloud/checkpoints/v4.json`): Filmic strength 0.86 and ambient 0.371; all other values match v3. Checkpoints v1–v3 remain available, with independent saved drafts. Active selection uses `cloud-studio-active-checkpoint-v4`.

Final selection: **v3** is the approved default again; v4 remains selectable. Selection uses `cloud-studio-active-checkpoint-approved-v3`, with a fresh v3 draft key (`cloud-studio-checkpoint-v3-approved`) so earlier v3 edits cannot override the chosen snapshot. Older drafts are retained untouched.

Motion pass (on the approved v3 lighting): studio defaults now add ±4 cm floating over a 10-second primary period, a smaller secondary vertical oscillation, and 8 mm sideways sway. `motion.ts` supplies the floor shadow's translation/height response; the matching `movingPoint()` shader formula translates the density in both camera and light raymarches. Higher clouds produce wider, softer, lighter analytic shadows. Fixture shadow maps remain cached.

Internal billowing uses two overlapping, bounded local vortex rotations with different axes/frequencies and a small evolving deformation. It warps the coarse and fine noise coordinates, tapering near the silhouette and detached wisps; the mask itself stays fixed. Color visibility follows the same deformation. This is procedural motion, not a fluid/vorticity simulation. The old linear noise drift defaults to zero and remains available as a comparison. No new noise textures, simulation buffers, or render passes are introduced. The lighting atlas retains its existing staggered refresh (up to one six-frame cycle of lag).

The **Motion** controls include pause, time seek, master speed, float amplitude/period, sideways sway, billow strength, circulation speed, vortex radius, secondary vortex strength, evolution speed, legacy drift, and shadow response. Seeking automatically pauses; pausing captures the current simulation time in the exported JSON. Resuming advances from there. Reduced-motion preferences still freeze automatic playback while allowing explicit time seeks. Motion defaults are merged into old checkpoint/draft formats without changing any saved lighting or shape values. At time zero, vortex deformation and floating offsets are zero. Lab comparisons retain their previous frozen behavior.

**v5 · Color + motion** is the current default (`public/cloud/checkpoints/v5.json`), preserving the submitted lighting, tighter transition, stronger color variation, and all motion values. New selection key: `cloud-studio-active-checkpoint-v5`; checkpoints v1–v4 and their drafts remain available.

Developer UI is hidden by default. Press **backtick (`)** with page focus to toggle the tuning panel, inspection controls, lab preset controls, and FPS counter. Typing in inputs/textareas/selects/contenteditable regions, modifier chords, IME composition, and held-key repeats do not toggle it. Visibility persists in localStorage under `cloud-dev-open` (default false). Closing it restores the studio camera if an inspection view was active, without changing tuning values. The Next.js development indicator is disabled.

Homepage presentation: the name, introduction, and links share the right-hand column and the timeline's shared Inter font (`src/styles/fonts.ts`); mobile stacks this block below the scene in normal flow. A server-rendered inline white cover and initially transparent/inert content prevent partially loaded content from showing. Reveal waits for the volume's first render, both GLTF fixture resources, `document.fonts.ready`, and two animation frames, then fades over 220 ms (instant under reduced motion). Graphics failures reveal the reference-image fallback after it loads rather than leaving the cover up indefinitely.

Studio lighting pass: the white key is higher and its stand shadows are lighter/softer; the floating cloud retains a lighter broad analytic ground shadow. Fixture lenses have a bright center and colored edge, with short-range unshadowed lights illuminating the inner barn doors. These cues follow each spotlight's enabled state/color and are independent of the approved cloud shading.

A cached 128×128 floor irradiance texture evaluates the actual spotlight cones, range, decay and ground incidence, then attenuates each ray with 12 cloud-density samples. It refreshes at most 8 Hz during motion and immediately after tuning changes. The display uses a subtle pastel floor wash; this is approximate direct transmission, not full multiple scattering or global illumination. There are no full-screen bloom or god-ray passes. The **Studio** group exposes floor spill, lens/barn-door glow and stand-shadow opacity; these merge into existing checkpoints/drafts without changing the saved cloud values, and persist/export with all other controls.

The homepage canvas spans the entire page layout, behind the HTML introduction. An invisible DOM studio slot reserves the previous composition (left column on desktop, above the copy on mobile). `CloudStudy` accepts its `framingElement` ref; a ResizeObserver measures that slot and the canvas and updates a perspective view offset, extending the frustum without relocating lights or the cloud. Floor spill can cross the old column boundary. Inspection views use the full canvas independently; text and links stay regular accessible DOM above the canvas.

Responsive framing now fits the loaded fixture meshes (including tripod feet and barn doors) plus conservative cloud/motion bounds into the DOM slot, with 24 px padding. It preserves the studio camera angle and pulls back only as needed. The floor is excluded from fitting and can still spill across the full canvas. Refit runs on asset readiness, tuning changes and layout resize, not every frame. Verified 13 viewports from 320×568 through 2560×1440, including landscape phones and the 760/768 px breakpoint.

Resize safeguards: both studio and inspection cameras are explicitly manual, so R3F cannot overwrite their custom projection/aspect during resize. Framing updates in a layout effect and ignores zero-size layouts. The cloud render target derives its dimensions and texel uniforms from the actual WebGL drawing buffer, avoiding stale React size or browser-DPR snapshots; the illumination and floor caches intentionally retain fixed world-space resolutions.

Mouse camera sway: fine mouse pointers add a small orbit about the cloud origin to the saved neutral camera position and orientation, preserving its off-center aim and DOM view offset. Defaults are ±1.5° horizontal, ±0.6° vertical and 0.4-second settling, with frame-rate-independent damping. Pointer exit/window blur returns to neutral; touch and reduced motion disable sway, and inspection controls remain independent. Camera controls (enable, horizontal/vertical angle, settle time) persist/export with tuning snapshots. No React updates or additional render passes are required per frame.

Approved billow strength is now 0.45 in v5. A one-time migration upgrades saved v5 drafts still at the previous 0.3 value without changing other controls. Motion phases are staggered across float/sway axes and both local vortices; internal evolution uses separate per-axis rates. These deterministic offsets also apply at time zero (superseding the original all-zero phase baseline). CPU shadow translation and shader cloud translation use identical offset formulas.

Interactive fixtures: generous invisible hitboxes around each spotlight head toggle its existing `lightN.enabled` setting. Hover subtly brightens the textured housing and sets the pointer cursor. Hitboxes do not write color/depth or participate in camera fitting. Changes update cloud illumination, floor spill and lens/barn-door emission through the same tuning state and persist with the checkpoint draft. Keyboard-focusable Blue/Pink studio light buttons expose pressed state and become visible on focus.

The studio directional key now illuminates the volume as well as fixture meshes. Its direction (toward the shared light position, target at world origin), linear color and intensity are shared. A second small illumination atlas caches 12-step cloud transmittance toward the directional source, refreshed with the existing staggered schedule. View scattering adds that neutral light after the blue/pink competition; it is not ambient fill or a color-winner candidate. **Studio → Directional light** (0–5, default 1.6) adjusts both renderers and persists/exports. Historical lab presets keep this addition disabled.

Directional key strength increased by 1.75×, from 1.6 to **2.8**. Existing drafts still at the previous default migrate once; deliberate custom strengths are preserved.

Fluid cloud interaction: a 20×12×16 CPU Eulerian grid runs a 30 Hz semi-Lagrangian velocity/pressure solve while active. Swept mouse rays inject outward and tangential momentum. A trilinearly sampled half-float displacement texture transports the high-resolution procedural density, including its silhouette and lighting, then relaxes back to the reference shape. This is an artistic approximate fluid, not a mass-conserving atmospheric simulation. The former slicing renderer, trail buffer, depth sampling, occupancy holes and response controls have been removed.

Approved v6 interaction settings: push strength **0.55**, brush radius **0.25 m**, velocity damping **0.8**, shape return **0.5 seconds**, activation speed **0.05 m/s**. Existing v6 drafts receive the four newly approved fluid settings once, preserving unrelated edits. The controls persist/export normally. Below the activation speed there is no push. Touch, reduced motion, lab and inspection views skip interaction. Consecutive cursor samples use the same camera to exclude camera sway from velocity; coalesced pointer samples preserve their own timestamps.

Low-latency display: the expensive pressure solve remains at 30 Hz, but every active render frame publishes the displacement plus a bounded fractional-step velocity prediction. Input is therefore visible on the next rendered frame instead of waiting up to another 33 ms for a solver tick. The prediction does not accumulate into the persistent simulation. Simulation and texture updates sleep after settling. Lighting atlases remain coherent during interaction, and floor transmission updates at its existing 8 Hz rate.

Diagnostic recording: open the dev panel with backtick, choose **Record mouse trace**, reproduce the interaction, then stop and **Download mouse trace**. It automatically stops after 20 seconds (or 60,000 entries), stays in memory, and uploads nothing. JSON includes starting settings/checkpoint/viewport, dispatched/coalesced sample timestamps, filter outcomes and velocity, per-frame camera/projection/motion state, and configuration changes. An optional screen video provides the visual symptom alongside the trace.

Validation: deterministic impulse tests check finite values, nonzero visible displacement on the first 120 Hz frame (before a full solver step), and eventual rest. Local solver p95 is approximately 2 ms per active update; this is not a mobile or end-to-end FPS guarantee. Browser checks cover fluid rendering, recording/export and recovery. Algorithm reference: NVIDIA GPU Gems chapter 38, https://developer.nvidia.com/gpugems/gpugems/part-vi-beyond-triangles/chapter-38-fast-fluid-dynamics-simulation-gpu .

Typography previews: **Typography → Typeface** switches homepage name, introduction and footer together. Inter, Instrument Sans, Manrope, DM Sans, Onest, Space Grotesk and Work Sans use Next's self-hosted Google Fonts integration; previews have preload disabled. Their original OFL notices are in `public/fonts/licenses`. Satoshi is requested from the official Fontshare API only when selected; its FFL notice is retained, and no restricted font binaries are redistributed in this repository. Neue Montreal is listed as unavailable until licensed webfont files are supplied. Font selection saves per checkpoint and exports as `siteFont`; it waits for the chosen font before swapping, and the initial reveal waits for the restored font. Browser checks exercised every enabled option, persistence and export, with just one initial font request on the Inter baseline.

Production release: Work Sans is the approved default. Production ignores local tuning drafts, never registers the backtick/tilde developer shortcut, and keeps developer controls/FPS hidden even when `cloud-dev-open` was previously saved. `/cloud-lab` returns 404 in production; `/timeline` remains available. Mobile framing uses a left-shifted camera target and tighter fit margins to enlarge the studio and place it farther right while keeping both fixtures inside the viewport. Verified 13 viewport sizes from 320×568 to 2560×1440, including landscape phones. At 390 px width, the studio bounds expand from ~264 px to ~346 px without horizontal overflow.
