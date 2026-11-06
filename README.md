# HadCM3 visualization

Interactive views of HadCM3 (UM vn4.5, HadCM3B-M2.1aD), the coupled atmosphere–ocean climate model, in your browser. Start with one of these two pages:

| Page | Who it is for |
|---|---|
| **[Earth in a Computer / 把地球装进电脑](https://xinrenn.github.io/HadCM3_3D_visualization/popsci/HadCM3_popsci.html)** | Science-communication version: eight short chapters on the globe (Earth, boxes, Sun, wind, rain, ocean, the air/ocean relay, what if). No prior knowledge needed. 中文 + EN. |
| **[HadCM3 3D](https://xinrenn.github.io/HadCM3_3D_visualization/v3/HadCM3_3D.html)** | The full 3D globe: about 45 surface fields, cutaway, 3D layers (cloud, wind, currents, sea ice, rain) and a step player through one coupled day, routine by routine. 中文 + EN. |

Everything below is detail: the earlier 2D walkthroughs (v1, v2), the full feature list of the 3D page, the VR version, the build steps and the basis of the model setup.

---

## Details

An interactive, step-by-step walkthrough of how HadCM3 (UM vn4.5, HadCM3B-M2.1aD) advances through one coupled day.

- **Overview flowchart**: one coupled day (48 atmosphere steps of 30 min, swap, 24 ocean steps of 1 h, swap back) and the call order inside one atmosphere step and one ocean step.
- **Step player**: play, pause or scrub through start-up, the first atmosphere step in detail, the rest of the atmosphere's day, SWAP_A2O, the first ocean step in detail, the rest of the ocean's day and SWAP_O2A; a component map highlights the data exchanged at each step.
- **Component tabs**: one flowchart per component (dynamics, radiation, cloud and rain, convection, boundary layer, land hydrology, vegetation, gravity-wave drag, energy correction, coupler, ocean, sea ice) in call order: the routine and source line of each stage, the data entering and leaving it, and every parameter it uses with its tdaah value. Clicking a parameter marks it in the chart and in the parameter table below, whose "Used in" column lists the stages. A last tab lists the options switched off in this job.

| File | Language | Published |
|---|---|---|
| [`HadCM3_timestep_walkthrough_en.html`](HadCM3_timestep_walkthrough_en.html) | English | https://claude.ai/artifact/NvLiK1jmDgtQTWMkfUsAWK |
| [`HadCM3_timestep_walkthrough_zh.html`](HadCM3_timestep_walkthrough_zh.html) | 中文 | https://claude.ai/artifact/JbUE1UPjD2kXQjNeMWsRhw |

Open either file in a browser. They are self-contained apart from Google Fonts. Opened locally, the language switch and the cGENIE companion link point to the sibling files; on the published pages they point to the published artifacts.

### Versions

The two files above are **version 1** (git tag `v1`): each component tab is a linear chart of its routines.

**Version 2** lives in [`v2/`](v2): each component is drawn as a network of its routines (numbered in call order), the variables they pass to each other, the variables entering from or leaving to other components (in that component's colour), and the parameters each routine uses. Point at a box to light up its connections, click to pin it and read what it reads and writes, drag to pan. The rest of the page (overview, step player) is the same as version 1.

| File | Language | Published |
|---|---|---|
| [`v2/HadCM3_walkthrough_v2_en.html`](v2/HadCM3_walkthrough_v2_en.html) | English | https://claude.ai/artifact/Lg1UbvqWPZuGRLGoEN2T49 |
| [`v2/HadCM3_walkthrough_v2_zh.html`](v2/HadCM3_walkthrough_v2_zh.html) | 中文 | https://claude.ai/artifact/MGA4sQtd2KCcZ9YcxvpK9a |

The v2 pages are generated, not edited by hand: `python3 v2/build_v2.py` takes the version 1 pages and replaces their component charts with the networks in `v2/src/hadcm3_net.js` (one bilingual source for both languages) styled by `v2/src/net.css`. To change a network, edit `hadcm3_net.js` and rebuild. The layout uses dagre 0.8.5 from cdnjs, so the networks need an internet connection.

**Version 3** lives in [`v3/`](v3): HadCM3 on a 3D globe, in the style of climatearchive.org, one page with a language switch (中文 / EN).

- **The model's own Earth**: surface colours on the 96 × 73 atmosphere grid or the 288 × 144 ocean grid (about 45 fields to choose from), relief, day and night for the model time, optional grid lines. Point at the globe to read the value and the grid-box indices.
- **Cutaway**: a wedge is cut out of the globe. Its faces show the 19 atmosphere levels (temperature, θl, u, v, qt, layer cloud, SW and LW heating), the 20 ocean levels (T, S, currents) and the 4 soil layers. The vertical axis is either model levels or height and depth.
- **3D layers**: layer cloud as 19 shells, convective cloud as boxes from base to top level, wind particles on any level, ocean-current particles at any depth, sea ice, rain and snow, runoff arcs to the coastal outflow points.
- **Step player**: the coupled day as a timeline (start-up, 48 atmosphere steps with the radiation steps marked, SWAP_A2O, 24 ocean steps, SWAP_O2A). Each step plays its routines in call order; steps 1, 2 and 48, the swaps and ocean step 1 are shown routine by routine, the others in short form unless "All routines on every step" is ticked. For each routine the globe shows where and how it acts: the three adjustment sub-steps, the polar-filter rows, the sun position and the 3-hourly radiation, the boundary-layer levels and surface fluxes, convection's level loop growing the towers, large-scale precipitation from the top down, the drag columns from START_LEVEL_GWDRAG, runoff routing, the A→O regridding (3 × 2 ocean boxes per atmosphere box), ROWCALC sweeping the 144 ocean rows, the barotropic streamfunction, ice drift. The side panel gives the routine and source line, what it reads and writes and its parameters with their tdaah values (from the v2 networks), and the matching v1 step card.

| File | Language | Published |
|---|---|---|
| [`v3/HadCM3_3D.html`](v3/HadCM3_3D.html) | EN + 中文 | https://claude.ai/artifact/HBcC92yrRZ5McnpmWw2b2a |
| [`v3/HadCM3_3D_zh.html`](v3/HadCM3_3D_zh.html) | 中文 (opens in Chinese, EN switch kept) | local only |
| [`v3/HadCM3_3D_VR.html`](v3/HadCM3_3D_VR.html) | EN + 中文, WebXR (Meta Quest) | needs HTTPS: see below |

The fields come from `v3/data/hadcm3_state.js`, which must sit next to the page. `v3/build_data.py` makes it from the BRIDGE standard HadCM3 MOSES 2.1 pre-industrial start dumps `/projects/public/b56i/swsvalde/dumps/hadcm3m2.1/tcylx{a,o}@dao09c1` (valid 1 December 00:00), which stand in for tdaah's own dumps: the HadCM3B-M2.1aD dumps are not on bc5. It keeps three kinds of field: the prognostic state at 1 Dec 00:00, the November means and the 30 November daily means (the coupling fields of the last day) that the dumps carry as STASH, 69 fields in all, 8-bit, packed as PNG atlases (2.3 MB). Nothing is integrated in the browser: the animation shows which routine runs, where and in what order, and the fields stay as stored. Run it with a Python that has numpy and Pillow: `~/envs/co2nb/bin/python v3/build_data.py`.

The page itself is generated: `python3 v3/build_v3.py` assembles `v3/HadCM3_3D.html` (language follows the browser) and `v3/HadCM3_3D_zh.html` (always opens in Chinese) from `v3/src/page.html`, `app.css` and `app.js`, the v1 step cards and parameter tables, and `v2/src/hadcm3_net.js`. three.js 0.160.0 comes from jsDelivr, so the page needs an internet connection. For republishing the artifact, `python3 v3/build_v3.py --bare <file>` also writes the page without its document skeleton (`--bare-zh <file>` for the Chinese page). Both pages load `data/hadcm3_state.js` by a relative path, so to view them from bc5 serve `v3/` over HTTP (`python3 -m http.server 8765 --bind 127.0.0.1` in `v3/`) and open `http://localhost:8765/HadCM3_3D_zh.html` through VS Code's port forwarding.

**VR version** (`v3/HadCM3_3D_VR.html`): the same page with WebXR, for the Meta Quest Browser (Quest 2, 3, Pro; hand tracking or controllers). **Enter VR** in the header puts the globe in front of you at about arm's length; **Passthrough** does the same over your room on a Quest 3.

- **Controls on your left hand**: turn your left palm (or the left controller) toward your face and the control panel appears above the hand; lower it and the panel goes. **Pin** leaves it where it is. Tabs: *Now* (the routine, its source line, what it does, the loop it is in, the routines of this step), *Details* (reads, writes, parameters, what the globe shows), *Layers* (all the layer switches of the 3D page, with steppers for the wind level, the current depth and the wedge), *Surface* (the ~45 surface fields by group, with the colour bar), *Help*. The day timeline and play, pause, routine and step buttons and the speed sit at the bottom.
- **Pressing**: point with the right controller and pull the trigger, pinch while pointing, or touch a button with your right index finger.
- **The globe**: trigger or pinch on it and drag to spin it; grip (or pinch off the globe) to move it and turn it with your wrist; both hands to resize it; right stick turns and resizes. A play / pause, B next routine, X previous routine, Y reset, left stick steps through routines. "Turn the globe to each step" swings the step's region toward you, as the camera moves on the 3D page.
- Pointing at the globe shows the position, the grid-box indices and the value of the surface field; a caption under the globe gives the model time, the routine and the colour bar.

WebXR needs a secure page: open it over HTTPS (e.g. GitHub Pages) or from `http://localhost`; a `file://` page or plain HTTP from another machine gets "VR unavailable". `build_v3.py` writes it with the other v3 pages from the same sources plus `v3/src/vr.js` (appended to the app module; it hooks in through `HOOKS` in `app.js`, which the 3D page leaves empty) and `v3/src/vr.css`. The controller and hand models come from the WebXR input-profiles package on jsDelivr. The VR page was checked in Chromium under Meta's Immersive Web Emulation Runtime (Quest 3, controllers and hands); try it on a headset before relying on it.

**Science-communication version** lives in [`popsci/`](popsci): [`popsci/HadCM3_popsci.html`](popsci/HadCM3_popsci.html), *把地球装进电脑 / Earth in a Computer*, for a general audience, 中文 + EN. It drops the routines, source lines, layer drawer and timeline of v3 and tells eight short chapters on the globe: Earth, boxes, Sun, wind, rain, ocean, the air/ocean relay, what if. Each chapter shows one thing, with an autoplay button for an exhibition screen.

- The fields are a subset of `v3/data/hadcm3_state.js`, inlined, so the page is one file apart from Google Fonts and three.js. Nothing is invented: the moving lines follow stored winds and currents at an exaggerated speed, and the column in the boxes chapter is enlarged. The page says both.
- VR is kept in its simplest form: the globe in front of you with a caption under it; right trigger or pinch for the next chapter, left for the previous one, right stick to turn the globe. **Enter VR** appears only where the browser supports WebXR, so it needs HTTPS or localhost, as for the v3 VR page. Checked in Chromium under Meta's Immersive Web Emulation Runtime only; try it on a headset before relying on it.
- The page is generated: `python3 popsci/CC_build_popsci.py` assembles it from `popsci/src/popsci.html` and the v3 data (needs numpy and Pillow). `--bare <file>` also writes the page without its document skeleton for publishing as an artifact; `--facts` prints the numbers quoted in the captions.

### Basis

- **Job**: `tdaah`, a standard pre-industrial HadCM3B-M2.1aD job in the shared BRIDGE UMUI jobs (`/projects/public/b56i/ggpjv/work/umui_jobs/tdaah`, dated 2026-06-01): 280 ppm CO₂, `preind2` ancillaries, MOSES 2.1 + TRIFFID, 360-day calendar from 1850-12-01. There is no HadCM3 job under the `xinren.b56u` account on bc5, so this shared job stands in as the PI reference. Parameter values come from its `CNTLALL`, `CNTLGEN`, `CNTLATM`, `CNTLOCN`, `SIZES`, `SECT_MODE` and `INITHIS`.
- **Code**: call order and line numbers from the UM vn4.5 decks in `$UM_HOME/um/vn4.5/source/umpl` (`U_MODEL1`, `SETGRCT1`, `INITTIM1`, `SETTSCT1`, `ATMSTEP1`, `ATMDYN1`, `ATMPHY1`, `RAD_CTL1`, `OCNSTEP1`, `OCNFRST1`, `OCN_CTL`, `OCN_FRST`, `ROWCALC`, `TRACER`, `TROP_CTL`, `ICE_CTL`, `ICEFLOE`, `SWAPA2O2`, `SWAPO2A2`, `TRANA2O1`, `INITA2O1`).
- **Mods**: the job's Bristol bundles (`merge_BUGFIXES_01`, `merge_BriSciModN048_01`, `merge_GENERIC_01`, `merge_MOSES2.1_01`) and `STANDARD_MODS` (clim, general) were checked: none changes the call order shown. The orbit description follows the `CALC_SOLAR` mod in `merge_BriSciModN048_01`.

Companion page: [`../cGENIE-visualization`](../cGENIE-visualization).
