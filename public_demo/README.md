# Standing in Bristol's Future (WebXR demo)

An experience for primary-school age and up. You turn a realistic globe, choose an emissions pathway and a time up to a million years ahead, and see the sea level, temperature, rain and plants on it. Then you pick Bristol and stand on a floating pontoon in Bristol's Floating Harbour, facing a museum standing in for M Shed, to see that future's average conditions. One message: **our choices today decide what the future looks like.**

- Page: [`public_demo.html`](public_demo.html). **One page is both the web version and the VR version.** In a desktop or phone browser it runs with mouse or touch. In the Meta Quest Browser an **Enter VR** button appears and the same page becomes an immersive WebXR scene.
- Data: the NWS climate-emulation workflow (HadCM3 emulator), **ensemble member 67**, all seven scenarios, every 1,000 years from today to 1 million years (details below).
- Built on the same stack as the specialist viewer (`v3/`): three.js 0.160.0 from jsDelivr, no build step. `v3/` and `popsci/` are not changed.

## Run it

The page loads its data with `fetch`, so it needs a web server; opening the file from disk does not work.

```bash
cd HadCM3_visualization            # the repository root
python3 -m http.server 8765
# open http://localhost:8765/public_demo/public_demo.html
```

Needs an internet connection for three.js and Google Fonts. The page loads about 6 MB (the relief image is 3.6 MB).

## What you see

### The globe

Drawn close to real life, in the style of the v3 viewer:

- **Land** coloured by HadCM3's present-day surface types (forest, grass, shrubs, bare ground, land ice…), with **relief and hill shading** from SRTM15+ heights at 10 arc-minutes (Tozer et al. 2019), exaggerated as in v3.
- **Coastline that moves.** The coast is wherever the land height equals the scenario's global sea level. Raise the sea and low land floods; lower it and the shelves fall dry (the North Sea and the Bering land bridge in a glacial phase).
- **Oceans** shaded by depth, with a glint of sun. There is a **sun** beside the globe, day and night, a thin atmosphere and a **starry sky**.
- **Zoom**: mouse wheel or pinch on desktop and phone; drag to turn. In VR: the grip button grabs, moves and turns the globe; both grips pull it bigger or smaller; trigger-drag spins it; the right stick turns it (left/right) and resizes it (up/down). **Reset globe** puts it back.

Map layers (buttons):

| Layer | What it shows | Changes with time and pathway? |
|---|---|---|
| Earth | The globe as above | Coastline only |
| Temperature | Warmer or colder than today, °C (annual mean air temperature from the HadCM3 emulator, member 67) | **Yes** |
| Rain | 3D raindrops and tumbling snowflakes falling where HadCM3 rains or snows today (November mean) | No: future global rain maps were not saved |
| Plants | 3D trees, grass, shrubs, towns, dunes and ice peaks on every model land box, by HadCM3's present-day surface type (as in v3) | Only through flooding: plants on land under the sea disappear |
| Sea level | Flooded land (turquoise), sea floor that is now dry (sand) and today's coastline (yellow line). **"Try it: move the sea"**: a demo slider from −130 m to +70 m that moves the sea freely, labelled as a demo, not a scenario | **Yes** |

Layers that do not change are labelled so on the legend.

### Time and pathways

- **Seven pathways**, all the scenarios in `emul_inputs_updatedCO2`: no human emissions (natural), SSP1-1.9, SSP1-2.6, SSP2-4.5, SSP3-7.0, SSP5-8.5 and 10,000 PgC ("burn it all").
- **Time slider** from today to 1 million years, at the data's 1,000-year resolution. The scale is stretched, so the first 10,000 years get as much room as the last 900,000. Earlier / Later step by 1,000 years near today and by bigger steps further on. **Play** glides through the whole million years in about 45 seconds; on the sea-level layer you watch the coast move.
- In Bristol, dragging the slider only previews the time. The scene changes when you let go, with a short fade, because the water and the pontoon move.

### Bristol

A cartoon harbourside (art placeholder). The water is one flat plane at the scenario's sea level, so the flooding is approximate. The pontoon floats on it. Below today's level, the pontoon rests on its guide piles and the harbour floor shows dry, with a small stream.

| Variable | In the scene |
|---|---|
| Sea level | Water height, pontoon, tide-mark pole (today's level and this scenario's) |
| Temperature | Big thermometer, sky colour and sun size, clothes (coats below 5 °C, jackets, light clothes, shorts and sun hats above 25 °C), heat haze above 28 °C |
| Wind | Trees, flag, bunting, white caps and boats: still (< 3 m/s), breezy, stormy (> 8 m/s) |
| Rain | 3D falling streaks, wet ground, puddles and umbrellas: light / steady / heavy |
| Snow | White on every up-facing surface above the water, falling flakes, a depth stick; snowmen above 10 cm |
| Plants | Tree sets by type (tundra, conifer forest, leafy forest, Mediterranean, subtropical…); the real LAI thins or fills the trees |
| CO₂ | On the weather board |

A weather board on the pontoon lists every number. Missing values show in red as "no data". Thresholds are in `BANDS` in `src/data.js`.

After you have seen two pathways in Bristol, a **closing card** compares SSP1-2.6 and SSP5-8.5 (sea level, temperature) at the chosen time, or at 1,000 years if you chose today, and ends with the choices that lead to the better outcome.

Always on screen (desktop and VR): the data source, "Scenario, not a prediction", the chosen time and pathway, and "Average conditions for this time, not a single day".

## The data, and how it was made

`tools/CC_build_real_data.py` writes `data/` from the workflow folder (default `~/Library/CloudStorage/OneDrive-UniversityofBristol/NWS-PDRA/climate_emulation_workflow`, or `--workflow <path>`). Run it with the `emu` conda environment (it needs `paleo_emu`):

```bash
python3 public_demo/tools/CC_build_real_data.py
```

| Quantity | Source | How it is used |
|---|---|---|
| Global sea level | `2_GSL_model/results/emul_inputs_updatedCO2/emul_inputs_<SCEN>.67.updated.res`, column `ice` | Metres relative to today, as given. **Note: the column is capped at +24 m** (the emulator's training range), so the high scenarios sit at +24 m for long periods |
| CO₂ | same files, column `co2` | ppm, as given |
| Bristol temperature, rain, wind, snow, LAI | `5_plots/site_data/<var>_<SCEN>_site_LB_lowres.txt`, row 67 | Site **LB** is the HadCM3 box at 52.5° N, 3.75° W, the emulator land box nearest Bristol (51.45° N, 2.6° W). tas, precip, windspeed and snowdepth are **anomalies relative to pre-industrial**; LAI is absolute |
| Bristol "today" | Met Office 1991–2020 averages, **Filton** (Bristol): mean max 14.53 °C, mean min 7.33 °C, rain 819.01 mm, wind 8.34 kn ([source](https://www.metoffice.gov.uk/research/climate/maps-and-data/location-specific-long-term-averages/gcnhtp581)) | Absolute value = Filton average + (model value − model value today). "Today" in the model is the mean of the emission scenarios at t = 0. Rain anomaly × 12 (mm per month to mm per year); snow: 1 kg/m² of snow water = 0.33 cm of snow |
| Bristol vegetation type | derived | From the absolute temperature: < 3 °C tundra, < 7 °C conifer forest, < 13.5 °C leafy forest, < 17 °C Mediterranean, otherwise subtropical (an illustrative rule) |
| SSP1-1.9 in Bristol | no site files exist | Temperature from the emulator at box LB (same method); rain, wind, snow and LAI show as "no data" |
| Global temperature map | `3_emulator/trained_model/tas_{modhighice,modlowice}_fitted_pipeline.joblib` | Re-run for member 67's forcing with log(CO₂), high-ice model where `ice` < 0, as in the workflow. Checked against the LB site file: largest difference 0.0003 °C. Stored as change from today, in a low-rank form exact to 0.002 °C |
| Rain and plants on the globe, land colours | `v3/data/hadcm3_state.js` (HadCM3 pre-industrial dumps) via `tools/CC_build_globe_base.py` | Present-day only |
| Heights for the coastline and relief | GMT `earth_relief_10m_p.grd` (SRTM15+ v2.7, 10′) via `tools/CC_build_relief.py <file>` | `assets/relief_10m.png` |

**Not available**, so not shown: future global maps of rain, snow, wind and vegetation (only temperature has a trained emulator in the workflow folder), the other 89 ensemble members, and the past (the old placeholder "ice age" and "warm period" stops were removed; the natural scenario's glacial phases, e.g. around 100,000 years from now, show ice-age conditions with real data).

### File format (for swapping data)

- `data/timeline.json`: `axis` (`start`, `end`, `step` in kyr after present, `now_year`) and slider `marks` (`t`, `label`, `label_zh`).
- `data/scenarios.json`: `pathways` (`id`, `label`, `label_zh`, `ssp`, `icon`, `color`), `vegetation_types`, `baseline`, `closing_compare` (two pathway ids), and `bristol[pathway][variable]` = an array with one value per time step (null = no data). Variables: `sea_level_m`, `co2_ppm`, `temp_c`, `rain_mm_yr`, `wind_ms`, `snow_depth_cm`, `lai`, `vegetation`.
- `data/globe_tas.json`: field(t) = `mean` + Σₖ coeffs[t,k]·cscale[k]/32767 × basis[k]·bscale[k]/32767 on the 96 × 73 HadCM3 grid (row 0 = 90° N). `mean` is float32, `basis` and `coeffs` are int16, all base64.
- `meta.placeholder: true` in any file brings back the red DEMO DATA badge.
- `?data=<folder>` loads another folder in the same format (for example another member) without touching `data/`.

## Test it

| How | What it covers |
|---|---|
| Desktop: open the page | Everything except the headset. Keys: ← → step in time, Space plays, 1–7 pick a pathway, Enter visits Bristol, Backspace goes back |
| `?xrsim=1` | The VR panels on a desktop; the mouse is the controller ray (click = trigger, drag the sliders, drag on empty space to look around, wheel resizes the globe) |
| `?debug=1` | Override any Bristol value; frame rate, triangles and draw calls |
| Immersive Web Emulator, or a headset | The real WebXR session. WebXR needs HTTPS (GitHub Pages is fine) or `http://localhost` |

Other URL options: `?lang=zh|en`, `?t=<kyr>`, `?pathway=<id>`, `?layer=surface|temp|rain|plants|sea`, `?mode=city`.

**Big screen**: use the Quest's built-in casting (headset menu → Camera → Cast, to a TV, Chromecast or the Meta Horizon phone app). No code is involved.

### Checked (2026-11-26, desktop Chrome, Apple M4 GPU, headless)

- All 7 pathways × 12 times on the globe (the coastline's sea level matched the data every time), and 7 × 5 in Bristol: no errors.
- Real data reaches 5 vegetation types and 3 clothing bands in Bristol, dry harbours (glacial phases) and floods above the museum roof (+24 m).
- VR panels in `?xrsim=1`: pathway, layer and time buttons, dragging the time slider, the pin.
- English and Chinese for every label.
- Frame rate 60 fps (the display limit), worst frame 17 ms. The globe draws 92k triangles, 117k with 3D rain and 157k with 3D plants; Bristol 104k. All are under the 200k target.

**Not tested**: a real Quest headset (frame rate, grabbing and resizing with real controllers or hands, text size), the Immersive Web Emulator, casting. On a Quest the globe's 288 × 144-segment sphere and 2160 × 1080 height texture are the heaviest parts; if it drops below 72 fps, lower the sphere segments in `globe.js` first.

## Science integrity

- Scenario, not a prediction: one ensemble member of an emulator, labelled on screen.
- Bristol's flood is one flat water level over a cartoon harbour: approximate, labelled.
- The globe's coastline uses today's land heights; it ignores ice sheets growing or melting, land rising or sinking, and sea defences.
- Present-day layers (rain, plants) are labelled "Does not change with time or pathway".

## Files

```
public_demo/
  public_demo.html          the page
  src/main.js               boot, state, fades, desktop camera and zoom, Play, frame loop
  src/globe.js              the realistic globe, layers, sun, pin, 3D plants and rain
  src/timeaxis.js           the stretched time scale of the slider
  src/data.js               loader for data/, value lookup, global temperature decoder, BANDS
  src/i18n.js, format.js    labels in English and Chinese, numbers with units
  src/ui/overlay.js         desktop controls (slider, pathways, layers, legend, closing card)
  src/ui/xr.js, panel.js    WebXR session, rays, grabbing, VR panels with sliders
  src/ui/icons.js           icons for the buttons
  src/bristol/*.js          the harbourside: scene, terrain loader, art kit, materials, weather, people and plants
  config/bristol_scene.json harbour layout and heights (placeholder art)
  data/                     timeline.json, scenarios.json, globe_tas.json (member 67)
  assets/                   globe_base.json (HadCM3 present day), relief_10m.png (SRTM15+)
  tools/                    CC_build_real_data.py, CC_build_globe_base.py, CC_build_relief.py
```
