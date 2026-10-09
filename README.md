# Pever Pulse — A World of Possibility

A continuous, scroll-driven crystal city for the existing Pever Pulse site. Arrival at a stone ring gate leads through a crystal treasury, a violet observatory, a midnight data archive, and an open horizon.

**Pure HTML, CSS and browser JavaScript. No build step, server, credentials, or framework is needed to host it on GitHub Pages.**

## Run and publish

Upload or commit `index.html`, `analysis.html`, `PEVERPICHART.html`, and the complete `assets/` directory together at the root of the existing repository. Keep the four existing team photos. The existing GitHub Pages publishing configuration can continue to serve these files.

For a local preview, serve this directory over HTTP:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/`. ES modules, import maps, and iframe messaging need HTTP/HTTPS; opening HTML directly through `file://` is not supported. All local paths are relative, including imports and photos, so deployment under a GitHub Pages project subdirectory works.

The three original URLs remain available:

- `index.html`: the full journey, including the original holdings, about text, four members and their photos/quotes, contact links, and both embedded chart tools.
- `analysis.html`: standalone candlestick/volume terminal, with symbol search and the original five resolution buttons.
- `PEVERPICHART.html`: standalone historical OHLC/volume chart, with the original symbol/date/time inputs and all seven resolutions.

`?embedded=1` renders a chart tool without a second 3D scene, page chrome, or smooth-scroll engine. The parent validates both message origin and iframe identity before accepting sizing or data updates.

## Customize

| What to change                                     | Where                                                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Dawn, dusk, night, stone, crystal and light colors | `assets/js/config.js` → `CONFIG.colors`                                                                            |
| Text, panel, border and accent colors              | `assets/css/world.css` → the initial `:root` variables                                                             |
| Scroll settling speed                              | `config.js` → `motion.scrollDuration` (Lenis duration; larger means slower)                                        |
| Camera response to scroll                          | `config.js` → `motion.cameraScrub` (GSAP scrub delay, seconds)                                                     |
| Mouse influence and object drift                   | `config.js` → `motion.mouseTilt`, `motion.driftSpeed`                                                              |
| Particle counts, pixel-ratio ceiling, bloom        | `config.js` → `quality`                                                                                            |
| Arrival, discovery, revelation and closing text    | `config.js` → `story`; also update the corresponding fallback paragraphs in `index.html` for no-JavaScript reading |
| Main titles and all original content               | The three HTML files                                                                                               |
| Physical camera route / viewing direction          | `assets/js/world.js` → `path` and `lookPath` (Catmull–Rom control points)                                          |
| Which camera position belongs to a section         | `assets/js/app.js` → `travelStops` in `measure()`                                                                  |
| Holding values and their 3D heights                | `config.js` → `HOLDINGS`, and the matching original static figures in `index.html`                                 |
| Candlestick/line-chart appearance                  | `assets/js/charts.js`                                                                                              |
| Market endpoint, URL construction and validation   | `assets/js/market.js`                                                                                              |
| Ambient sound frequencies/volume                   | `assets/js/audio.js`                                                                                               |

## Data integrity and availability

The home page retains the original portfolio snapshot and original displayed totals. These figures are labeled as a snapshot. The donut keeps the original seven values: 100000, 150000, 60000, 40000, 30000, 15000, 5000 INR.

The chart tools retain the original Moneycontrol history endpoint, symbol/resolution/date queries, price series, and separate volume axis. A new query reuses its chart instance. Older requests are cancelled; a slower response cannot overwrite a newer selection. A failed request identifies the last successful result if one is still visible. Exact values are available in accessible tables, including when a chart CDN fails.

**Verification limitation:** on 2026-10-09 the original Moneycontrol endpoint returned HTTP 403 from the development environment. The external provider controls browser access/CORS, available history and freshness. Live requests therefore cannot be guaranteed on GitHub Pages from this verification. No proxy or API keys are required or embedded here.

Both tools also accept an exported JSON file from your device. It is processed locally, labeled **Imported JSON**, and never uploaded. Use the provider's array format below. `t` is Unix time in **seconds**; arrays must have equal lengths and valid OHLC/volume values. `symbol` and `resolution` are optional metadata. The following numbers illustrate the format only; they are not market observations and are never loaded into the site automatically.

```json
{
  "symbol": "FORMAT_EXAMPLE",
  "resolution": "1D",
  "s": "ok",
  "t": [1700000000],
  "o": [100],
  "h": [105],
  "l": [95],
  "c": [102],
  "v": [1000]
}
```

Date and time inputs use the visitor's device timezone, displayed beside the form. At intraday resolutions, the original day-stat labels are annotated to explain that high/low/volume refer to the latest returned candle and change refers to its previous candle.

## What the world does

- A fixed Three.js canvas behind semantic HTML; foreground rocks, floating islands, distant mountains and an evolving sky give genuine 3D parallax.
- Procedurally baked noise color, normal, roughness and emissive-vein maps; physical crystal materials, reflective environment lighting, stone, a rim light, a moving key light, soft shadows and fog.
- Bloom on desktop, drifting instanced crystals and point particles, and inexpensive additive cone light shafts. These shafts approximate volumetric light; they are not expensive volumetric ray tracing.
- A scroll-linked camera spline, mapped to the actual section positions even when chart frames resize. Text uses masked line reveals and floating panel entrances.
- Raycast hover and click on the gate, monolith, and data sculpture. The visible inspect buttons provide keyboard and touch equivalents. Dialogs use native focus handling and Escape dismissal.
- The data sculpture initially represents the **actual original holdings**. After either chart receives data, it shows the latest 48 returned OHLC candles, with their vertical heights normalized to the selected range. The complete unnormalized data remains in the chart and exact-value table. Click a candle to inspect its true values.
- The latest successful chart query or JSON import drives the sculpture. Imported data retains its source label.
- An optional synthesized ambient chord, off on every visit. Audio begins only after a click and suspends in a hidden tab. No audio files are necessary.
- A custom light cursor and trail on fine-pointer devices. Mobile keeps its native touch behavior.

## Accessibility, fallbacks and performance

- Honors `prefers-reduced-motion`, including changes made while the page is open: fixed 3D vista, native scrolling, visible text, no cursor trail or chart animation. The motion button can pause movement independently.
- Mobile uses a 1× pixel-ratio ceiling, fewer particles and islands' crystals, no postprocessing bloom, no shadow maps, no glass transmission pass, and native scrolling.
- Desktop caps pixel ratio at 1.5×. Mountains, debris, crystals and candles use instancing. Repeated materials/geometries are shared. Rendering pauses in hidden tabs, and geometries, textures, composer passes, charts and audio are disposed when the page actually unloads.
- Sustained slow desktop rendering reduces pixel ratio to 1× and disables bloom and light shafts. 60 fps is a target; device/GPU performance has not been measured here.
- A dependency-free boot screen reports loading stages and offers **Enter now**. It releases the page after 8.5 seconds even if a CDN hangs. HTML is never permanently hidden behind loading.
- If Three.js, WebGL or context creation fails, the CSS landscape and readable page remain available. Chart-library failure keeps the form and exact-value table. A no-JavaScript visitor can still read the story, holdings, team and contacts.
- Optional sounds, text zoom, visible keyboard focus, descriptive iframe titles, chart descriptions, input labels, exact-value tables, and native dialog behavior are included.

## Assets and pinned dependencies

**Assets you must supply: none.** Four existing local portraits are included unchanged:

- `assets/Whats-App-Image-2024-07-05-at-13-25-56-6be8d8bf.jpg`
- `assets/b5ecb78b-db2e-4537-ab12-41609f771ef5.jpeg`
- `assets/kandy.jpg`
- `assets/settan-patty.jpg`

Stone, crystals, rings, sky, fog, particles, textures, reflections and audio are generated in code. Optional future artwork could replace these procedural assets; nothing is missing from this package.

| Dependency              | Pinned version | Where                         |
| ----------------------- | -------------- | ----------------------------- |
| Three.js and its addons | 0.170.0        | Import map in every HTML page |
| GSAP and ScrollTrigger  | 3.12.5         | `CONFIG.cdn`                  |
| Lenis                   | 1.1.20         | `CONFIG.cdn`                  |
| Chart.js                | 4.4.8          | `CONFIG.cdn`                  |
| ApexCharts              | 3.54.1         | `CONFIG.cdn`                  |
| Font Awesome            | 6.4.0          | HTML stylesheet link          |

Google Fonts supplies Cormorant Garamond, Manrope and JetBrains Mono, with local serif/sans/monospace fallbacks. Third-party scripts and fonts require internet access. Keep Three.js core and all addons on exactly the same version when updating.

References: [Three.js installation](https://threejs.org/manual/en/installation.html), [ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/), [Lenis integration](https://github.com/darkroomengineering/lenis).

## Verification

Optional tests use Node 20.11+ and a development-only DOM simulator:

```sh
npm ci
npm test
```

`package.json`, `package-lock.json`, and `tests/` are only for maintenance. They are not needed to serve the site, and `node_modules/` must not be uploaded to GitHub Pages.

Automated checks cover URL/resolution/date validation, aligned OHLCV normalization, provider errors, exact-value tables, repeat-query chart reuse, stale-response protection, original-content preservation, local assets, unique IDs and navigation anchors. Every pinned JavaScript CDN URL was reachable during the check.

A supported browser preview was unavailable in the development environment. GPU rendering, shader compilation, visual composition, phone interaction, browser CORS behavior, and actual frame rate still need a browser pass. Before publishing, inspect the journey at desktop and phone widths, test reduced motion, open both standalone routes, import a real JSON export, and try a live symbol request in your browser.
