# HadCM3 visualization

An interactive, step-by-step walkthrough of how HadCM3 (UM vn4.5, HadCM3B-M2.1aD) advances through one coupled day.

- **Overview flowchart**: one coupled day (48 atmosphere steps of 30 min, swap, 24 ocean steps of 1 h, swap back) and the call order inside one atmosphere step and one ocean step.
- **Step player**: play, pause or scrub through start-up, the first atmosphere step in detail, the rest of the atmosphere's day, SWAP_A2O, the first ocean step in detail, the rest of the ocean's day and SWAP_O2A; a component map highlights the data exchanged at each step.
- **Component tabs**: one flowchart per component (dynamics, radiation, cloud and rain, convection, boundary layer, land hydrology, vegetation, gravity-wave drag, energy correction, coupler, ocean, sea ice) in call order: the routine and source line of each stage, the data entering and leaving it, and every parameter it uses with its tdaah value. Clicking a parameter marks it in the chart and in the parameter table below, whose "Used in" column lists the stages. A last tab lists the options switched off in this job.

| File | Language | Published |
|---|---|---|
| [`HadCM3_timestep_walkthrough_en.html`](HadCM3_timestep_walkthrough_en.html) | English | https://claude.ai/artifact/NvLiK1jmDgtQTWMkfUsAWK |
| [`HadCM3_timestep_walkthrough_zh.html`](HadCM3_timestep_walkthrough_zh.html) | 中文 | https://claude.ai/artifact/JbUE1UPjD2kXQjNeMWsRhw |

Open either file in a browser. They are self-contained apart from Google Fonts. Opened locally, the language switch and the cGENIE companion link point to the sibling files; on the published pages they point to the published artifacts.

## Basis

- **Job**: `tdaah`, a standard pre-industrial HadCM3B-M2.1aD job in the shared BRIDGE UMUI jobs (`/projects/public/b56i/ggpjv/work/umui_jobs/tdaah`, dated 2026-06-01): 280 ppm CO₂, `preind2` ancillaries, MOSES 2.1 + TRIFFID, 360-day calendar from 1850-12-01. There is no HadCM3 job under the `xinren.b56u` account on bc5, so this shared job stands in as the PI reference. Parameter values come from its `CNTLALL`, `CNTLGEN`, `CNTLATM`, `CNTLOCN`, `SIZES`, `SECT_MODE` and `INITHIS`.
- **Code**: call order and line numbers from the UM vn4.5 decks in `$UM_HOME/um/vn4.5/source/umpl` (`U_MODEL1`, `SETGRCT1`, `INITTIM1`, `SETTSCT1`, `ATMSTEP1`, `ATMDYN1`, `ATMPHY1`, `RAD_CTL1`, `OCNSTEP1`, `OCNFRST1`, `OCN_CTL`, `OCN_FRST`, `ROWCALC`, `TRACER`, `TROP_CTL`, `ICE_CTL`, `ICEFLOE`, `SWAPA2O2`, `SWAPO2A2`, `TRANA2O1`, `INITA2O1`).
- **Mods**: the job's Bristol bundles (`merge_BUGFIXES_01`, `merge_BriSciModN048_01`, `merge_GENERIC_01`, `merge_MOSES2.1_01`) and `STANDARD_MODS` (clim, general) were checked: none changes the call order shown. The orbit description follows the `CALC_SOLAR` mod in `merge_BriSciModN048_01`.

Companion page: [`../cGENIE-visualization`](../cGENIE-visualization).
