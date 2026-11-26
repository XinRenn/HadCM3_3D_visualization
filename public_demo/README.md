# Standing in Bristol's Future (WebXR demo)

Work in progress. This file grows with each milestone.

## Milestone 1: existing stack and file layout

What the existing pages use (read from `v3/src/app.js`, `v3/src/vr.js`, `popsci/src/popsci.html`):

- **Library**: three.js 0.160.0 only, loaded from jsDelivr through an import map (`three`, plus `three/addons/` for the v3 controller and hand models). No framework, no bundler.
- **Globe**: a `SphereGeometry(1, …)` with a custom `ShaderMaterial`. The surface picture is a 720 × 360 `DataTexture` painted on the CPU from HadCM3 fields; the shader turns the unit normal into lat/lon and samples it. Rotation is `earth.rotation.set(lat, -90 - lon, 0)`.
- **Data**: `v3/data/hadcm3_state.js` sets a global object with `grids` (A = 96 × 73 atmosphere, O = 288 × 144 ocean) and `fields`. Each field is a tile in an 8-bit PNG atlas: code 0 = missing, codes 1–255 map linearly (after a transform) to `lo`…`hi`. The popsci page inlines a subset of it.
- **XR**: `renderer.xr.enabled = true`, `navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'hand-tracking'] })`, reference space `local-floor`, controllers from `renderer.xr.getController(i)` with `selectstart`. Panels are canvas textures on planes; v3 ray-casts its panels by hand.
- **Language**: every string is `L(zh, en)` and `tx()` picks the current one.

Decision: no library change. The demo reuses three.js 0.160.0 from the same CDN, the globe approach (sphere + shader + painted textures), the HadCM3 land mask and bathymetry from `v3/data/hadcm3_state.js` for the coastline, the `L()/tx()` language pattern and the XR set-up. The specialist pages are not touched.

Proposed layout (all new, inside `public_demo/`):

```
public_demo/
  public_demo.html          the page (desktop overlay + WebXR)
  src/                      ES modules, no build step
    main.js                 boot, state, mode switching, frame loop
    i18n.js                 every label in English and Chinese
    data.js                 loader + validation for data/, value lookup, bands
    globe.js                cartoon globe, data layers, Bristol pin
    bristol/terrain.js      loadTerrain(city): the ground, behind one function
    bristol/assets.js       swappable art: trees, people, buildings, vegetation sets
    bristol/scene.js        the harbourside: water, pontoon, tide pole, M Shed, labels
    bristol/weather.js      rain, snow, wind, haze
    ui/panel.js             world-space canvas panels with buttons (XR and desktop)
    ui/xr.js                XR session, controller rays, fade, head-following labels
    ui/overlay.js           desktop HTML overlay
  config/bristol_scene.json ground heights and layout (placeholder values)
  data/                     the swappable data (placeholder for now)
    timeline.json
    scenarios.json
    globe_layers/index.json + <variable>_<pathway>_<stop>.png
  assets/globe_base.json    HadCM3 land mask and bathymetry for the coastline (not placeholder)
  tools/CC_build_globe_base.py        writes assets/globe_base.json from v3/data
  tools/CC_make_placeholder_data.py   writes the fake data in data/
```
