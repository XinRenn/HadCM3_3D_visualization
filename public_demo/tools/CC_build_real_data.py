#!/usr/bin/env python3
"""Build the demo's data/ from the NWS climate-emulation workflow, ensemble member 67.

Inputs (climate_emulation_workflow, path in --workflow):
  2_GSL_model/results/emul_inputs_updatedCO2/emul_inputs_<SCEN>.67.updated.res
        1001 rows (0 to 1000 kyr after present, 1 kyr apart): co2, obliquity, esinw, ecosw, ice.
        'ice' is used as global sea level in metres relative to today (the emulator input; it is capped at +24 m).
  5_plots/site_data/<var>_<SCEN>_site_LB_lowres.txt
        90 members x 1001 time steps; row 67 is member 67. Site LB is the HadCM3 box at 52.5 N, 3.75 W, the
        nearest emulator land box to Bristol (51.45 N, 2.6 W). tas, precip, windspeed, snowdepth are anomalies
        relative to pre-industrial; LAI_PFT is absolute.
  3_emulator/trained_model/tas_{modhighice,modlowice}_fitted_pipeline.joblib
        the trained temperature emulator (paleo_emu). Used for the global temperature maps and for Bristol
        temperature under SSP1-1.9, which has no site file. Same rule as the site files: ice < 0 -> modhighice.

Absolute Bristol values = Met Office 1991-2020 average at Filton (Bristol) + the model change since today (t = 0,
the mean of the emission scenarios at t = 0):
  temperature 10.93 C (mean of 14.53 max and 7.33 min), rainfall 819.01 mm/yr, wind 8.34 kn = 4.29 m/s,
  snow 0 cm (1 kg/m2 of snow water taken as 0.33 cm of snow).
  https://www.metoffice.gov.uk/research/climate/maps-and-data/location-specific-long-term-averages/gcnhtp581
Vegetation type at Bristol is derived from the absolute temperature (rule in vegetation_for); LAI is passed through.

Outputs: data/timeline.json, data/scenarios.json, data/globe_tas.json (global temperature change from today, as an
low-rank basis + per-year coefficients, 16-bit so the page can rebuild any of the 1001 years).

Run with the 'emu' conda env (needs paleo_emu, joblib, numpy):
  python3 public_demo/tools/CC_build_real_data.py --workflow /path/to/climate_emulation_workflow
"""
import argparse
import base64
import json
import os

import joblib
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
DEMO = os.path.dirname(HERE)
DATA = os.path.join(DEMO, 'data')
DEFAULT_WF = os.path.expanduser('~/Library/CloudStorage/OneDrive-UniversityofBristol/NWS-PDRA/climate_emulation_workflow')
MEMBER = 67
LB = (15, 95)                     # (row, column) of site LB on the 96 x 73 grid: 52.5 N, 356.25 E

BASE = {'temp_c': 10.93, 'rain_mm_yr': 819.01, 'wind_ms': round(8.34 * 0.514444, 2), 'snow_depth_cm': 0.0,
        'source': 'Met Office 1991-2020 averages, Filton (Bristol)',
        'url': 'https://www.metoffice.gov.uk/research/climate/maps-and-data/location-specific-long-term-averages/gcnhtp581'}
SNOW_CM_PER_KGM2 = 0.33

PATHWAYS = [
    {'id': 'natural', 'file': 'natural', 'label': 'No human emissions', 'label_zh': '没有人类排放', 'ssp': 'natural', 'ssp_zh': '自然情况', 'icon': 'vegetation', 'color': '#2BA7A0'},
    {'id': 'ssp119', 'file': 'SSP119', 'label': 'Very low emissions', 'label_zh': '极低排放', 'ssp': 'SSP1-1.9', 'icon': 'leaf', 'color': '#2FB65A'},
    {'id': 'ssp126', 'file': 'SSP126', 'label': 'Low emissions', 'label_zh': '低排放', 'ssp': 'SSP1-2.6', 'icon': 'leaf', 'color': '#8CC63F'},
    {'id': 'ssp245', 'file': 'SSP245', 'label': 'Middle road', 'label_zh': '中间道路', 'ssp': 'SSP2-4.5', 'icon': 'road', 'color': '#E9A92C'},
    {'id': 'ssp370', 'file': 'SSP370', 'label': 'High emissions', 'label_zh': '高排放', 'ssp': 'SSP3-7.0', 'icon': 'factory', 'color': '#F07A3A'},
    {'id': 'ssp585', 'file': 'SSP585', 'label': 'Very high emissions', 'label_zh': '极高排放', 'ssp': 'SSP5-8.5', 'icon': 'smoke', 'color': '#D93B4B'},
    {'id': 'pgc10000', 'file': '10000PGC', 'label': 'Burn it all', 'label_zh': '烧光化石燃料', 'ssp': '10,000 PgC', 'icon': 'smoke', 'color': '#7A2E8E'},
]
VEGETATION = ['tundra', 'boreal_forest', 'steppe', 'temperate_forest', 'mediterranean', 'subtropical', 'desert_scrub']
EMISSION = ['SSP119', 'SSP126', 'SSP245', 'SSP370', 'SSP585', '10000PGC']


def vegetation_for(t):
    """vegetation type from Bristol's annual mean temperature (C); a simple illustrative rule"""
    if t < 3:
        return 'tundra'
    if t < 7:
        return 'boreal_forest'
    if t < 13.5:
        return 'temperate_forest'
    if t < 17:
        return 'mediterranean'
    return 'subtropical'


def f32(a):
    return base64.b64encode(np.ascontiguousarray(a, dtype='<f4').tobytes()).decode()


def i16(a):
    return base64.b64encode(np.ascontiguousarray(a, dtype='<i2').tobytes()).decode()


def r(a, d):
    return [None if not np.isfinite(x) else round(float(x), d) for x in a]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--workflow', default=DEFAULT_WF)
    wf = ap.parse_args().workflow
    gsl_dir = os.path.join(wf, '2_GSL_model/results/emul_inputs_updatedCO2')
    site_dir = os.path.join(wf, '5_plots/site_data')
    models = {k: joblib.load(os.path.join(wf, f'3_emulator/trained_model/tas_{k}_fitted_pipeline.joblib'))['model'] for k in ['modhighice', 'modlowice']}

    X, F = {}, {}
    for p in PATHWAYS:
        x = np.loadtxt(os.path.join(gsl_dir, f'emul_inputs_{p["file"]}.{MEMBER}.updated.res'), skiprows=1)
        X[p['file']] = x
        xx = x.copy(); xx[:, 0] = np.log(xx[:, 0])          # the emulator takes log(CO2), as paleo_emu.load_forcing_data
        y = np.zeros((len(x), 73 * 96))
        for k, mk in [('modhighice', x[:, 4] < 0), ('modlowice', x[:, 4] >= 0)]:
            if mk.any():
                y[mk] = np.asarray(models[k].predict(xx[mk])).reshape(mk.sum(), -1)
        F[p['file']] = y
    today = np.mean([F[s][0] for s in EMISSION], axis=0)              # the model's 'today' field

    def site(var, scen):
        f = os.path.join(site_dir, f'{var}_{scen}_site_LB_lowres.txt')
        return np.loadtxt(f)[MEMBER - 1] if os.path.exists(f) else None

    ref = {}
    for var in ['precip', 'windspeed', 'snowdepth']:
        ref[var] = np.mean([site(var, s)[0] for s in EMISSION if site(var, s) is not None])
    ref['tas'] = today[LB[0] * 96 + LB[1]]

    bristol, missing = {}, []
    n = 1001
    for p in PATHWAYS:
        s, x = p['file'], X[p['file']]
        tas = site('tas', s)
        if tas is None:
            tas = F[s][:, LB[0] * 96 + LB[1]]                        # SSP1-1.9: the emulator at the same box
        pr, ws, sn, lai = site('precip', s), site('windspeed', s), site('snowdepth', s), site('LAI_PFT', s)
        nan = np.full(n, np.nan)
        temp = BASE['temp_c'] + tas - ref['tas']
        cell = {
            'sea_level_m': r(x[:, 4], 2), 'co2_ppm': r(x[:, 0], 0), 'temp_c': r(temp, 2),
            'rain_mm_yr': r(np.maximum(BASE['rain_mm_yr'] + 12 * (pr - ref['precip']), 0) if pr is not None else nan, 0),
            'wind_ms': r(np.maximum(BASE['wind_ms'] + ws - ref['windspeed'], 0) if ws is not None else nan, 2),
            'snow_depth_cm': r(np.maximum(sn - ref['snowdepth'], 0) * SNOW_CM_PER_KGM2 if sn is not None else nan, 2),
            'lai': r(lai if lai is not None else nan, 2),
            'vegetation': [vegetation_for(t) for t in temp],
        }
        bristol[p['id']] = cell
        missing += [f'{p["ssp"]}: {v}' for v, a in [('rain', pr), ('wind', ws), ('snow', sn), ('LAI', lai)] if a is None]

    meta = {'placeholder': False, 'version': 2, 'source_label': 'HadCM3 emulator · member 67',
            'source_label_zh': 'HadCM3 模拟器 · 第 67 号成员',
            'note': 'NWS climate-emulation workflow, ensemble member 67. Sea level = the GSL input of the emulator (capped at +24 m). '
                    'Bristol = site LB (52.5 N, 3.75 W) changes since today added to Met Office 1991-2020 Filton averages.'}
    timeline = {'meta': meta, 'axis': {'unit': 'kyr after present', 'start': 0, 'end': 1000, 'step': 1, 'now_year': 2025},
                'marks': [{'t': 0, 'label': 'Today', 'label_zh': '今天'}, {'t': 1, 'label': '1,000 yr', 'label_zh': '1000 年'},
                          {'t': 10, 'label': '10,000 yr', 'label_zh': '1 万年'}, {'t': 100, 'label': '100,000 yr', 'label_zh': '10 万年'},
                          {'t': 1000, 'label': '1 million yr', 'label_zh': '100 万年'}]}
    scen = {'meta': meta, 'pathways': [{k: v for k, v in p.items() if k != 'file'} for p in PATHWAYS],
            'vegetation_types': VEGETATION, 'baseline': BASE, 'closing_compare': ['ssp126', 'ssp585'],
            'missing': missing, 'bristol': bristol}

    # global temperature change from today: exact low-rank form  field(t) = mean + coeff(t) . basis
    stack = np.concatenate([F[p['file']] - today for p in PATHWAYS])
    mean = stack.mean(0)
    U, S, Vt = np.linalg.svd(stack - mean, full_matrices=False)
    k = int((S > S[0] * 1e-7).sum())                    # the two emulators keep 24 + 13 PCA components, so k is about 40
    basis = Vt[:k]
    coef = (stack - mean) @ basis.T
    bs, cs = np.abs(basis).max(1), np.abs(coef).max(0)        # stored as int16 with a scale per component
    qb = np.round(basis / bs[:, None] * 32767).astype('<i2'); qc = np.round(coef / cs * 32767).astype('<i2')
    err = np.abs((qc * (cs / 32767)) @ (qb * (bs / 32767)[:, None]) + mean - stack).max()
    gt = {'meta': dict(meta, what='annual-mean surface air temperature change from today (C), HadCM3 emulator, member 67'),
          'grid': {'nx': 96, 'ny': 73, 'lat0': 90, 'dlat': -2.5, 'lon0': 0, 'dlon': 3.75},
          'encoding': 'field(t) = mean + sum_k (coeffs[t,k] * cscale[k] / 32767) * (basis[k] * bscale[k] / 32767); mean float32, basis/coeffs int16',
          'k': k, 'mean': f32(mean), 'bscale': [float(x) for x in bs], 'cscale': [float(x) for x in cs],
          'basis': i16(qb), 'coeffs': {p['id']: i16(qc[i * n:(i + 1) * n]) for i, p in enumerate(PATHWAYS)}}

    os.makedirs(DATA, exist_ok=True)
    for name, obj in [('timeline.json', timeline), ('scenarios.json', scen), ('globe_tas.json', gt)]:
        with open(os.path.join(DATA, name), 'w', encoding='utf-8') as f:
            json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))
        print('wrote', name, '%.0f KB' % (os.path.getsize(os.path.join(DATA, name)) / 1024))
    print('global temperature basis: k = %d, max reconstruction error %.2e C' % (k, err))
    print('missing site series:', ', '.join(missing) or 'none')
    for p in PATHWAYS:
        c = bristol[p['id']]
        print('%-9s sea level %6.1f..%5.1f m | Bristol %5.1f..%5.1f C | t=1kyr: %s' % (
            p['id'], min(c['sea_level_m']), max(c['sea_level_m']), min(c['temp_c']), max(c['temp_c']),
            {k2: c[k2][1] for k2 in ['sea_level_m', 'temp_c', 'rain_mm_yr', 'wind_ms', 'snow_depth_cm', 'vegetation']}))


if __name__ == '__main__':
    main()
