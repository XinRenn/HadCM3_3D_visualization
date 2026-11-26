# Standing in Bristol's Future (WebXR demo)

A cartoon climate experience for primary-school age and up. Turn a globe, choose a time and an emissions pathway, pick Bristol, and you are teleported onto a floating pontoon in Bristol's Floating Harbour, facing a museum standing in for M Shed. The scene shows sea level, temperature, wind, rain, snow depth and plants for that choice. One message: **our choices today decide what the future looks like.**

**All numbers are placeholder data.** While the data files say `"placeholder": true`, every value is made up for testing and a **DEMO DATA** badge is always on screen (desktop and VR).

- Page: [`public_demo.html`](public_demo.html). Meta Quest Browser (WebXR) and any desktop browser.
- Built on the same stack as the specialist viewer (`v3/`): three.js 0.160.0 from jsDelivr, no build step. `v3/` and `popsci/` are not changed.

## Run it

The page loads its data with `fetch`, so it needs a web server; opening the file from disk does not work.

```bash
cd HadCM3_visualization            # the repository root
python3 -m http.server 8765
# open http://localhost:8765/public_demo/public_demo.html
```

Needs an internet connection for three.js and Google Fonts.

## Test it

| How | What it covers |
|---|---|
| **Desktop fallback**: open the page normally | Everything except the headset. Mouse: drag to turn the globe or to look around, click the Bristol pin, wheel to zoom. Keys: ← → step through time, 1–4 pick a pathway, Enter visits Bristol, Backspace goes back. |
| **`?xrsim=1`** | The VR panels on a desktop: the mouse stands in for the controller ray (click = trigger, drag on empty space = look around). Same panels, buttons, pin and globe drag as in the headset. |
| **`?debug=1`** | A panel to override any Bristol value (to see hot, stormy, snowy, missing…), plus frame rate, triangles and draw calls. |
| **Immersive Web Emulator** (browser extension) | The real WebXR session on a desktop. |
| **Headset** | Open the hosted page in the Meta Quest Browser. WebXR needs HTTPS (GitHub Pages is fine) or `http://localhost`; **Enter VR** appears only where WebXR is available. |

Other URL options: `?lang=zh` or `?lang=en`, `?stop=<id>`, `?pathway=<id>`, `?mode=city` (start in Bristol), `?data=<folder>` (another data folder next to the page, same format).

**Big screen for an audience**: use the Quest's built-in casting. In the headset, open the menu, choose **Camera → Cast** (or **Share → Cast**), and pick a TV or Chromecast, or a phone running the Meta Horizon app. No code is involved; the cast shows what the wearer sees.

### In VR

- The globe floats in front of you with a panel below it: map layers, the four pathways, the time stops with Earlier / Later, and Visit Bristol. Point with the controller (or your hand) and pull the trigger (or pinch) to press. Pointing at the Bristol pin and pulling the trigger also enters Bristol. Trigger-drag on the globe, or the right stick, turns it.
- In Bristol a lectern on the pontoon has the pathways, the time stops, Back to globe, **Seated mode**, Compare (the closing card) and the language switch. The right stick turns you in 30° snaps. Changing time or pathway fades out and back like a teleport.
- A strip of labels follows your view: DEMO DATA, "Scenario, not a prediction", the chosen time and pathway, "Average conditions for this time, not a single day".
- **Seated mode** lowers the whole scene by 45 cm, so someone sitting down sees it from standing eye height.

## What the scene shows

| Variable | In the scene | Where the thresholds live |
|---|---|---|
| Sea level | One flat water plane at `sea_level_m` relative to today. The pontoon floats on it, so your eye stays about 1.95 m above the water. Below today's level the pontoon rests on its guide piles at today's level and the harbour floor shows dry, with a small stream. A tide-mark pole beside you marks today's level, this scenario and a faint band for the likely range. | `src/bristol/scene.js` |
| Temperature | Big thermometer on the pontoon, sky colour and sun size, heat haze above 28 °C, outfits: below 5 °C coats, scarves and woolly hats; 5–15 °C jackets; 15–25 °C light clothes; above 25 °C shorts and sun hats. | `BANDS` in `src/data.js` |
| Wind | Trees sway, the flag and bunting flap, water gets white caps, boats rock: still (< 3 m/s), breezy (3–8), stormy (> 8). | `BANDS` in `src/data.js` |
| Rain | Falling streaks, wet ground, puddles, umbrellas: dry (< 300 mm/yr), light (< 700), steady (700–1000), heavy (> 1000). With 10 cm of snow or more and 4 °C or less it snows instead. | `BANDS` in `src/data.js` |
| Snow depth | White on every up-facing surface above the water (roofs, quays, trees), falling flakes, a depth stick on the pontoon, snowmen above 10 cm. | `src/bristol/weather.js` |
| Vegetation | Tree and plant sets and the ground colour change by type. | `VEG_SETS` in `src/bristol/life.js` |

A **weather board** on the pontoon lists every number, so the cartoon is never the only source. Missing values show as "no data" (in red) and nothing breaks.

The **closing card** ("Lower emissions, smaller changes") appears about 4 seconds after you have seen a second pathway in Bristol. It puts the lowest and highest pathways side by side (sea level, temperature) for the current time (or 2100 if the current time is the past or today), and ends with the choices that lead to the better outcome. The Compare button brings it back later.

## Data: format and how to swap it

Everything the page shows comes from `data/`. Replace these files with real data in the same format; the page reads the stops, pathways and values from them and hard-codes none of them.

### `data/timeline.json`

```json
{ "meta": { "placeholder": true, "version": 1 },
  "stops": [ { "id": "past_cold", "label": "Ice age", "label_zh": "冰期", "kind": "past", "year": -21000 }, … ] }
```

- Stops are shown as discrete buttons **in order of `year`**, whatever their order in the file. Negative years are "years ago".
- `kind`: `past`, `now`, `ssp` or `long`. `past` stops are drawn with a pale button and the note "Past climate shown around today's buildings".
- `label_zh` is optional; without it the page uses its own Chinese name for the known ids, then the English label.
- A stop without an `id` or a numeric `year` is skipped with a warning.

### `data/scenarios.json`

```json
{ "meta": { "placeholder": true, "version": 1, "source_label": "DEMO DATA" },
  "pathways": [ { "id": "ssp126", "label": "Low emissions", "label_zh": "低排放", "ssp": "SSP1-2.6", "icon": "leaf" }, … ],
  "vegetation_types": ["tundra", "steppe", "temperate_forest", "mediterranean", "subtropical", "desert_scrub"],
  "bristol": {
    "past_cold": { "all": { "sea_level_m": -120, "temp_c": 3, "wind_ms": 7, "rain_mm_yr": 450, "snow_depth_cm": 40, "vegetation": "tundra", "sea_level_m_range": [-144, -96] } },
    "y2100": { "ssp126": { … }, "ssp245": { … }, "ssp370": { … }, "ssp585": { … } } } }
```

- `sea_level_m` is metres relative to today; `temp_c` °C; `wind_ms` m/s; `rain_mm_yr` mm per year; `snow_depth_cm` cm; `vegetation` one of `vegetation_types`.
- Use the key `all` instead of a pathway where every pathway is the same (past stops, today).
- `sea_level_m_range` (optional) is the faint band on the tide pole. Without it the page draws ±20 %.
- `source_label` is shown in the badge. Pathway order matters for the closing card: the first is "low", the last is "high". `icon` is one of `leaf`, `road`, `factory`, `smoke`.
- **Turning off the DEMO DATA badge**: set `"placeholder": false` in the `meta` of all three files (timeline, scenarios, globe layers). A file without `meta` counts as placeholder.

### `data/globe_layers/`

`index.json` gives the grid, the encoding, the variables and the file for each variable, stop and pathway (`files[variable][stop][pathway or "all"]`). Each file is a 96 × 73 8-bit greyscale PNG on the HadCM3 atmosphere grid (row 0 = 90° N, then south in 2.5° steps; column 0 = 0° E, then east in 3.75° steps), the grid the existing viewer uses.

- Numbers: code 0 = no data; codes 1–255 map linearly to `lo`…`hi` of the variable in `index.json`.
- Vegetation: code = 1 + the index in `categories`.
- `where`: `land`, `sea` or `all`, the part of the globe the layer colours.

The globe draws these in flat colour bands (`PALETTES` in `src/globe.js`). A missing file shows plain land and sea and "no data" in the legend.

### Swapping in real data

1. Write the three parts in the format above, for example from the published SSP projections (to 2100) and the member67 runs (every 1,000 years to 1 million years). Add or remove stops freely; the slider follows.
2. For the globe layers, regrid each field to the 96 × 73 grid and encode it as above (`tools/CC_make_placeholder_data.py` has the encoder: `encode()`).
3. Set `"placeholder": false` and a real `source_label` (for example "HadCM3 member67").
4. Open the page and check the warning list (top right, "⚠ n data warnings") for anything skipped or missing.

Keep the old files: `?data=<folder>` lets two data sets sit side by side.

### Regenerating the placeholder data

```bash
python3 public_demo/tools/CC_build_globe_base.py        # assets/globe_base.json: HadCM3 coastline, ice, ocean depth (real, fixed)
python3 public_demo/tools/CC_make_placeholder_data.py   # data/: clearly fake smooth values
```

Both need numpy and Pillow. The generator fills every pathway and stop, makes ssp585 reach 25 m by year 5000 while ssp126 stays under 5 m, and covers every visual state (all three wind bands, all rain bands, deep snow, all six vegetation types, a dry ice-age harbour).

## Terrain and art: how to swap them

- **Ground**: `loadTerrain(city, cfg)` in `src/bristol/terrain.js` is the only place the ground is made. It returns `{ mesh, heightAt(x, z), surfaceAt(x, z), harbour, quaySouth, quayNorth }`. Today it builds a cartoon harbour from `config/bristol_scene.json`. For real terrain (public LiDAR or OS Terrain 50), add a branch that loads a height grid and returns the same shape; buildings, trees and people are placed with `heightAt`, so they follow.
- **Layout and heights**: `config/bristol_scene.json`, all flagged placeholder: quay heights, harbour floor, hill, M Shed size and position, cranes, pontoon, tide pole. Heights are metres above today's harbour water.
- **Art**: `src/bristol/assets.js` builds every piece in code (houses, M Shed, cranes, pontoon, gangway, tide pole, boats, benches, lamps). Each builder returns one geometry with vertex colours; replace a builder, or load a glTF in `scene.js` in its place. Trees: `kinds()` and `VEG_SETS` in `src/bristol/life.js`. People's clothes: `OUTFIT` in `life.js`.
- **Adding a vegetation type**: add it to `vegetation_types` in the data, a set in `VEG_SETS` and a colour in `PALETTES.vegetation` (`src/globe.js`); labels go in `src/i18n.js`. An unknown type falls back to the temperate set in the scene and a spare colour on the globe.

## Science integrity

- Placeholder numbers stay labelled (badge, weather board, closing card) until the data files say otherwise. The generator writes only smooth made-up curves.
- **The flood is a simple height-based water plane** over a cartoon harbour. It ignores defences, tides, locks and the real shape of the ground, and is labelled "Water drawn as one flat level: approximate" on the desktop. The real Floating Harbour is held at a fixed level by locks; the demo treats its water as a stand-in for sea level.
- The globe coastline is HadCM3's own land mask (pre-industrial). HadCM3 gives every shelf sea its minimum depth of 8 levels (about 165 m), so the model cannot say which sea floor a given drop exposes. When the sea is 100 m or more below today, the globe draws those shelf-sea boxes as sandy land, labelled as a rough estimate.
- Past stops show the past climate around today's buildings, and say so.
- Every view says "Scenario, not a prediction" and "Average conditions for this time, not a single day".

## Decisions taken without asking

- **No library change**: three.js 0.160.0 from the same CDN as `v3/`; no controller-model add-ons (simple pointer and ray instead).
- **Separate page, own globe code**: the globe follows the `v3/` and `popsci/` method (unit sphere, shader, painted textures, the same HadCM3 grids and land mask) but is re-styled as a cartoon in its own module, so the specialist viewer stays untouched.
- **Pontoon in mid-harbour, 20 m from the M Shed quay**, with a gangway behind you to the far quay. Closer than that, M Shed filled the whole view.
- **Thermometer, weather board and depth stick sit on the pontoon**, not on the quay, so they stay visible when the quay floods.
- **Below today's sea level** the pontoon stays at today's level on its guide piles, so the view over the dry harbour stays comfortable.
- **When a person's quay floods** they move onto a boat (one each) or leave; boats float, or sit on the mud when the harbour is dry.
- **Snow falls instead of rain** with at least 10 cm of snow on the ground and 4 °C or less.
- **Closing card** compares the first and last pathway in the data file.
- **Snap turn (30°)** on the right stick in Bristol: rotation without smooth movement.
- **The Chinese labels for stops and pathways** come from optional `label_zh` fields in the data, with built-in names as a fallback.

## Performance

Targets: 72 fps on Quest 2/3, about 200k triangles or fewer, instancing, at most 5,000 particles, no real-time shadows, textures 1024 px or less.

Measured (desktop Chrome, Apple M4 GPU, 1400 × 880, `?debug=1`): **60 fps (the display limit), worst frame 17 ms**. The Bristol scene draws **82k–140k triangles** depending on the plant set (subtropical is the densest) in about **50 draw calls**.

- Instanced: houses (bodies and roofs), every tree kind (trunks, crowns, blob shadows), all people parts, bunting, puddles.
- Particles: at most 3,800 rain streaks + 1,000 snowflakes, animated on the GPU (no per-frame CPU work).
- No shadow maps; blob shadows under people and trees. Lighting is a flat three-band toon shader with screen-space facet normals.
- Textures: panels and labels are canvas textures of 1024 px or less; globe textures 720 × 360 and 360 × 180.
- No allocations in the per-frame code (reused temporaries), to avoid garbage-collection hitches on the Quest.
- WebXR foveation is set to its maximum (`renderer.xr.setFoveation(1)`).

**Not measured yet: the frame rate on a Quest headset.** If it drops below 72 fps, fill rate is the likely cause (the full-screen see-through water, sky and fog). Try, in this order: turn off `antialias` in `main.js`, shorten the fog distance (`uFogFar` in `materials.js` and `_skyFor` in `scene.js`), and lower the plant `density` in `VEG_SETS`.

## Acceptance checklist

Checked on 2026-11-26 in headless Chrome by a script (every stop × pathway, on the globe and in the scene) and by screenshots:

| Check | Result |
|---|---|
| Each of the 4 pathways and every stop can be selected on the globe and in the scene | Passed: 40 of 40 combinations in each, desktop; VR panels checked with `?xrsim=1` (pathway, stop, Back to globe, the pin) |
| 25 m floods the quay and the museum; the viewer stays on the pontoon above the water | Passed: water 25 m, quay 2 m, museum roof 11.5 m, deck 25.35 m, eye 1.95 m above the water |
| Ice-age scene shows dry harbour floor, tundra and snow | Passed: no water plane, stream on the dry floor, tundra set, 40 cm snow cover, snowmen, boats aground |
| Thermometer, outfits, wind, rain, snow depth and vegetation all change with the data | Passed: 3 outfit bands from the data (the 4th, hot, via `?debug=1`), 3 wind bands, 4 rain levels, 6 vegetation sets, the thermometer level, the snow stick |
| "DEMO DATA" and "Scenario, not a prediction" always visible | Passed on the globe and in Bristol (HTML); in VR they are on the label strip that follows your view |
| Missing data does not crash anything | Passed with a test folder missing a combination, a text in place of a number, a missing value, an unknown vegetation type, a stop without a year and a missing PNG: "no data" shown, warnings listed |
| Desktop fallback works with no headset | Passed |
| English and Chinese toggle covers every new label | Passed for every label on the page, the VR panels, the board, the pole, the thermometer and the card. The `?debug=1` panel is English only (a developer tool). |

**Not tested**: a real Quest headset (frame rate, comfort, the controller and hand-tracking rays, text size at arm's length), the Immersive Web Emulator, and casting. The VR code paths were exercised only through `?xrsim=1`.

## Files

```
public_demo/
  public_demo.html          the page
  src/main.js               boot, state, teleport fades, desktop camera, frame loop
  src/i18n.js               every label in English and Chinese
  src/data.js               loader and checks for data/, value lookup, BANDS (thresholds)
  src/format.js             numbers with units
  src/globe.js              cartoon globe, layers, palettes, Bristol pin
  src/style.css             desktop overlay
  src/ui/overlay.js         desktop controls, legend, closing card, ?debug=1 panel
  src/ui/xr.js              WebXR session, rays, VR panels, label strip, VR closing card
  src/ui/panel.js           world-space canvas panels with buttons
  src/ui/icons.js           cartoon icons (HTML and VR)
  src/bristol/scene.js      the harbourside: water, pontoon, tide pole, weather board, boats, sky
  src/bristol/terrain.js    loadTerrain(city): the ground
  src/bristol/assets.js     the art kit
  src/bristol/materials.js  toon, sky and water shaders
  src/bristol/weather.js    thermometer, wind, rain, snow, haze
  src/bristol/life.js       people and plants
  config/bristol_scene.json layout and ground heights (placeholder)
  data/                     timeline.json, scenarios.json, globe_layers/ (placeholder)
  assets/globe_base.json    HadCM3 coastline, land ice and ocean depth (real, fixed)
  tools/                    CC_build_globe_base.py, CC_make_placeholder_data.py
```
