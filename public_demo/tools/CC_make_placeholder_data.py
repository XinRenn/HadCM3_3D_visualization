#!/usr/bin/env python3
"""Write CLEARLY FAKE placeholder data for the Bristol demo, in the format the page reads.

Every number written here is made up: smooth curves chosen so that each visual state of the demo can be
tested (still / breezy / stormy wind, light / steady / heavy rain, deep snow, all six vegetation types,
a 25 m flood, a dry ice-age harbour). None of it is a model result or an observation. Every file carries
meta.placeholder = true, and the page shows a "DEMO DATA" badge while it does.

Outputs (in public_demo/data/):
  timeline.json                      the slider stops
  scenarios.json                     Bristol values per pathway per stop
  globe_layers/index.json            grid, encoding and file list of the globe layers
  globe_layers/<var>_<pathway>_<stop>.png
                                     one 96 x 73 8-bit greyscale PNG per variable, pathway and stop, on the
                                     HadCM3 atmosphere grid (row 0 = 90 N, column 0 = 0 E, 2.5 x 3.75 degrees).
                                     Code 0 = no data. Numbers: code 1..255 maps linearly to lo..hi of the
                                     variable. Vegetation: code = 1 + index in the category list.
                                     Past stops use "all" in place of the pathway.

Land and sea come from assets/globe_base.json (real HadCM3 mask), so land-only layers stop at the coast.
Run: python3 public_demo/tools/CC_make_placeholder_data.py      (needs numpy and Pillow)
"""
import base64
import json
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DEMO = os.path.dirname(HERE)
DATA = os.path.join(DEMO, 'data')
LAYERS = os.path.join(DATA, 'globe_layers')
BRISTOL = (51.45, -2.6)

META = {'placeholder': True, 'version': 1, 'source_label': 'DEMO DATA',
        'note': 'Made-up smooth values for testing the demo. Not a model result, not an observation.'}

STOPS = [
    {'id': 'past_cold', 'label': 'Ice age', 'label_zh': '冰期', 'kind': 'past', 'year': -21000},
    {'id': 'past_warm', 'label': 'Warm period', 'label_zh': '温暖期', 'kind': 'past', 'year': -125000},
    {'id': 'now', 'label': 'Today', 'label_zh': '今天', 'kind': 'now', 'year': 2025},
    {'id': 'y2050', 'label': '2050', 'label_zh': '2050 年', 'kind': 'ssp', 'year': 2050},
    {'id': 'y2100', 'label': '2100', 'label_zh': '2100 年', 'kind': 'ssp', 'year': 2100},
    {'id': 'y3000', 'label': 'Year 3000', 'label_zh': '3000 年', 'kind': 'long', 'year': 3000},
    {'id': 'y5000', 'label': 'Year 5000', 'label_zh': '5000 年', 'kind': 'long', 'year': 5000},
    {'id': 'y10000', 'label': '10,000 years', 'label_zh': '1 万年后', 'kind': 'long', 'year': 12025},
    {'id': 'y100000', 'label': '100,000 years', 'label_zh': '10 万年后', 'kind': 'long', 'year': 102025},
    {'id': 'y1000000', 'label': '1 million years', 'label_zh': '100 万年后', 'kind': 'long', 'year': 1002025},
]

PATHWAYS = [
    {'id': 'ssp126', 'label': 'Low emissions', 'label_zh': '低排放', 'ssp': 'SSP1-2.6', 'icon': 'leaf'},
    {'id': 'ssp245', 'label': 'Middle road', 'label_zh': '中间道路', 'ssp': 'SSP2-4.5', 'icon': 'road'},
    {'id': 'ssp370', 'label': 'High emissions', 'label_zh': '高排放', 'ssp': 'SSP3-7.0', 'icon': 'factory'},
    {'id': 'ssp585', 'label': 'Very high emissions', 'label_zh': '极高排放', 'ssp': 'SSP5-8.5', 'icon': 'smoke'},
]

VEGETATION = ['tundra', 'steppe', 'temperate_forest', 'mediterranean', 'subtropical', 'desert_scrub']

# ---------------------------------------------------------------- Bristol (fake)
TODAY = {'sea_level_m': 0.0, 'temp_c': 10.3, 'wind_ms': 5.0, 'rain_mm_yr': 830, 'snow_depth_cm': 0}
FUTURE = ['y2050', 'y2100', 'y3000', 'y5000', 'y10000', 'y100000', 'y1000000']
# change from today at each future stop, per pathway. Chosen so the spec's examples hold
# (2100: ssp126 0.4 m / 11.0 C, ssp585 0.9 m / 14.5 C; 5000: ssp585 25 m / 17 C) and ssp126 stays under 5 m.
D_TEMP = {'ssp126': [0.5, 0.7, 0.6, 0.5, 0.4, 0.2, 0.0],
          'ssp245': [0.8, 1.8, 2.6, 2.4, 2.0, 1.0, 0.1],
          'ssp370': [1.0, 2.9, 4.8, 5.4, 6.0, 2.4, 0.3],
          'ssp585': [1.2, 4.2, 6.2, 6.7, 6.0, 3.0, 0.5]}
SEA = {'ssp126': [0.18, 0.4, 1.2, 2.0, 2.8, 3.5, 4.0],
       'ssp245': [0.2, 0.55, 3.0, 6.0, 9.0, 8.0, 3.0],
       'ssp370': [0.22, 0.7, 6.0, 14.0, 20.0, 15.0, 5.0],
       'ssp585': [0.25, 0.9, 10.0, 25.0, 34.0, 28.0, 8.0]}
WIND = {'ssp126': [5.0, 5.0, 4.8, 4.5, 4.0, 3.6, 3.4],
        'ssp245': [5.1, 5.2, 5.6, 5.8, 5.5, 5.2, 5.0],
        'ssp370': [5.2, 5.4, 7.6, 8.6, 8.2, 6.0, 5.1],
        'ssp585': [5.3, 5.5, 6.0, 5.0, 4.8, 4.9, 5.0]}
RAIN = {'ssp126': [850, 900, 880, 860, 850, 840, 830],
        'ssp245': [840, 870, 900, 920, 900, 860, 830],
        'ssp370': [830, 820, 700, 560, 480, 520, 800],
        'ssp585': [840, 850, 950, 1000, 1150, 1050, 880]}
PAST = {
    'past_cold': {'sea_level_m': -120, 'temp_c': 3, 'wind_ms': 7, 'rain_mm_yr': 450, 'snow_depth_cm': 40, 'vegetation': 'tundra'},
    'past_warm': {'sea_level_m': 6, 'temp_c': 12.0, 'wind_ms': 2.6, 'rain_mm_yr': 900, 'snow_depth_cm': 0},
}


def vegetation_for(t, rain, snow):
    """A made-up rule from temperature (C), rain (mm/yr) and snow (cm) to a vegetation type."""
    if snow >= 20 or t < 5:
        return 'tundra'
    if t < 8 and rain < 600:
        return 'steppe'
    if t < 13.5:
        return 'steppe' if rain < 550 else 'temperate_forest'
    if t < 16:
        return 'mediterranean'
    return 'subtropical' if rain >= 700 else 'desert_scrub'


def bristol_table():
    out = {'now': {'all': dict(TODAY)}}
    for sid, v in PAST.items():
        out[sid] = {'all': dict(v)}
    for i, sid in enumerate(FUTURE):
        out[sid] = {}
        for p in D_TEMP:
            out[sid][p] = {'sea_level_m': SEA[p][i], 'temp_c': round(TODAY['temp_c'] + D_TEMP[p][i], 1),
                           'wind_ms': WIND[p][i], 'rain_mm_yr': RAIN[p][i], 'snow_depth_cm': 0}
    for sid, cell in out.items():
        for v in cell.values():
            v.setdefault('vegetation', vegetation_for(v['temp_c'], v['rain_mm_yr'], v['snow_depth_cm']))
            s = v['sea_level_m']
            v['sea_level_m_range'] = sorted([round(s * 0.8, 2), round(s * 1.2, 2)])   # placeholder +-20 %
    return out


# ---------------------------------------------------------------- globe layers (fake)
VARS = {
    'temp_c': {'units': '°C', 'lo': -50.0, 'hi': 45.0, 'where': 'all'},
    'rain_mm_yr': {'units': 'mm/yr', 'lo': 0.0, 'hi': 4000.0, 'where': 'all'},
    'snow_depth_cm': {'units': 'cm', 'lo': 0.0, 'hi': 300.0, 'where': 'land'},
    'vegetation': {'units': '', 'categories': VEGETATION, 'where': 'land'},
    'sea_level_m': {'units': 'm', 'lo': -150.0, 'hi': 60.0, 'where': 'sea'},
}


def grid():
    base = json.load(open(os.path.join(DEMO, 'assets', 'globe_base.json'), encoding='utf-8'))
    g = base['lsm']['grid']
    land = np.frombuffer(base64.b64decode(base['lsm']['b64']), dtype=np.uint8).reshape(g['ny'], g['nx']) > 0
    lat = g['lat0'] + g['dlat'] * np.arange(g['ny'])
    lon = g['lon0'] + g['dlon'] * np.arange(g['nx'])
    return g, np.meshgrid(lat, lon, indexing='ij'), land


def at_bristol(g, a):
    """bilinear value of grid a at Bristol, for tying the fake map to the fake Bristol number"""
    y = (BRISTOL[0] - g['lat0']) / g['dlat']
    x = (BRISTOL[1] % 360 - g['lon0']) / g['dlon']
    j, i = int(y), int(x)
    fy, fx = y - j, x - i
    i1 = (i + 1) % g['nx']
    return ((1 - fy) * ((1 - fx) * a[j, i] + fx * a[j, i1]) + fy * ((1 - fx) * a[j + 1, i] + fx * a[j + 1, i1]))


def fake_maps(g, LAT, LON, land, v):
    """smooth made-up global maps whose value at Bristol equals the Bristol numbers v"""
    p, l = np.radians(LAT), np.radians(LON)
    dT = v['temp_c'] - TODAY['temp_c']
    t = -18 + 46 * np.cos(p) ** 0.9 + 2.5 * np.cos(2 * l) * np.cos(p) - 3 * land + dT * (0.7 + 0.8 * np.sin(p) ** 2)
    t += v['temp_c'] - at_bristol(g, t)
    r = 250 + 1800 * np.exp(-(LAT / 10) ** 2) + 700 * np.exp(-((np.abs(LAT) - 48) / 14) ** 2) + 200 * np.sin(3 * l) * np.cos(p)
    r = np.maximum(r * (1 + 0.1 * ~land), 20)
    r *= v['rain_mm_yr'] / at_bristol(g, r)
    snow = np.clip((6 - t) * 13, 0, 300)
    veg = np.vectorize(lambda a, b, c: VEGETATION.index(vegetation_for(a, b, c)))(t, r, snow)
    sea = v['sea_level_m'] * (1 + 0.2 * np.sin(l) * np.cos(p) - 0.1 * np.sin(p))
    return {'temp_c': t, 'rain_mm_yr': r, 'snow_depth_cm': snow, 'vegetation': veg, 'sea_level_m': sea}


def encode(name, a, land):
    m = VARS[name]
    if 'categories' in m:
        code = a.astype(int) + 1
    else:
        code = 1 + np.round((np.clip(a, m['lo'], m['hi']) - m['lo']) / (m['hi'] - m['lo']) * 254)
    code = code.astype(np.uint8)
    if m['where'] == 'land':
        code[~land] = 0
    elif m['where'] == 'sea':
        code[land] = 0
    return code


def main():
    os.makedirs(LAYERS, exist_ok=True)
    for f in os.listdir(LAYERS):                          # only this script writes here
        if f.endswith('.png'):
            os.remove(os.path.join(LAYERS, f))
    json.dump({'meta': META, 'stops': STOPS}, open(os.path.join(DATA, 'timeline.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=2)
    table = bristol_table()
    json.dump({'meta': META, 'pathways': PATHWAYS, 'vegetation_types': VEGETATION, 'bristol': table},
              open(os.path.join(DATA, 'scenarios.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    g, (LAT, LON), land = grid()
    files = {k: {} for k in VARS}
    for sid, cell in table.items():
        for pid, v in cell.items():
            maps = fake_maps(g, LAT, LON, land, v)
            for name in VARS:
                fn = '%s_%s_%s.png' % (name, pid, sid)
                Image.fromarray(encode(name, maps[name], land), 'L').save(os.path.join(LAYERS, fn), optimize=True)
                files[name].setdefault(sid, {})[pid] = fn
    index = {'meta': META, 'grid': dict(g, rows='row 0 is lat0 (90 N), then southward by |dlat|'),
             'encoding': 'png8: code 0 = no data; numbers: code 1..255 -> lo..hi linearly; categories: code = 1 + index',
             'variables': VARS, 'files': files}
    json.dump(index, open(os.path.join(LAYERS, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    n = sum(len(x) for v in files.values() for x in v.values())
    size = sum(os.path.getsize(os.path.join(LAYERS, f)) for f in os.listdir(LAYERS))
    print('wrote timeline.json, scenarios.json and %d layer PNGs (%.0f KB) in %s' % (n, size / 1024, DATA))
    seen = sorted({v['vegetation'] for c in table.values() for v in c.values()})
    print('vegetation types used at Bristol:', ', '.join(seen))
    print('ssp585 y5000 sea level:', table['y5000']['ssp585']['sea_level_m'],
          '| ssp126 max sea level:', max(table[s]['ssp126']['sea_level_m'] for s in FUTURE))


if __name__ == '__main__':
    main()
