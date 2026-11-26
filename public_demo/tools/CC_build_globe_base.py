#!/usr/bin/env python3
"""Write public_demo/assets/globe_base.json: the coastline and sea-floor depth the cartoon globe is drawn on.

This is real HadCM3 geography (pre-industrial), not placeholder data, and it does not change with the scenario:
  kmt  ocean grid 288 x 144, number of ocean levels in each column (0 = land); row 0 is the southern row (89.375 S)
  lsm  atmosphere grid 96 x 73, 1 = land; row 0 is 90 N
  ice  atmosphere grid 96 x 73, land-ice fraction of the box x 100 (MOSES surface type 9)
  level_bottom_m  depth of the bottom of each of the 20 HadCM3 ocean levels, so a column of kmt levels is
                  level_bottom_m[kmt - 1] deep. Note: HadCM3 gives every shelf sea its minimum depth of 8 levels
                  (about 165 m), so the globe can only treat those shallowest columns as one "shelf" class.
Each grid is stored as base64 of its raw bytes (uint8), row by row.

Input: v3/data/hadcm3_state.js (made by v3/build_data.py).
Run:   python3 public_demo/tools/CC_build_globe_base.py     (needs numpy and Pillow)
"""
import base64
import io
import json
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DEMO = os.path.dirname(HERE)
ROOT = os.path.dirname(DEMO)


def load_state():
    with open(os.path.join(ROOT, 'v3', 'data', 'hadcm3_state.js'), encoding='utf-8') as f:
        src = f.read()
    return json.loads(src[src.index('{'):src.rindex('}') + 1])


def codes(st, name, k=0):
    m = st['fields'][name]
    a = st['atlases'][m['grid']]
    img = np.array(Image.open(io.BytesIO(base64.b64decode(a['png'].split(',', 1)[1]))).convert('RGBA'))[:, :, 0]
    t = m['tiles'][k]
    return img[(t // a['cols']) * a['th']:(t // a['cols'] + 1) * a['th'], (t % a['cols']) * a['tw']:(t % a['cols'] + 1) * a['tw']].astype(int)


def field(st, name, k=0):
    return codes(st, name, k) - 1          # 'int' fields: code c means value c - 1, code 0 missing (-1)


def frac(st, k):
    m = st['fields']['frac']           # 'lin' field: code 1..255 -> lo..hi, code 0 missing
    c = codes(st, 'frac', k)
    return np.where(c == 0, 0.0, m['lo'][k] + (c - 1) / 254.0 * (m['hi'][k] - m['lo'][k]))


def main():
    st = load_state()
    kmt = np.clip(field(st, 'kmt'), 0, 20).astype(np.uint8)
    lsm = (field(st, 'lsm') > 0).astype(np.uint8)
    ice = np.round(np.clip(frac(st, 8), 0, 1) * 100).astype(np.uint8) * lsm
    out = {
        'meta': {'placeholder': False, 'source': 'HadCM3 pre-industrial start dumps (BRIDGE tcylx), via v3/data/hadcm3_state.js',
                 'note': 'coastline and sea-floor depth only; fixed for every scenario'},
        'kmt': {'grid': st['grids']['O'], 'b64': base64.b64encode(kmt.tobytes()).decode()},
        'lsm': {'grid': st['grids']['A'], 'b64': base64.b64encode(lsm.tobytes()).decode()},
        'ice': {'grid': st['grids']['A'], 'b64': base64.b64encode(ice.tobytes()).decode()},
        'level_bottom_m': [round(float(x), 1) for x in np.cumsum(st['levels']['ocn']['dz'])],   # the dump's own level thicknesses
    }
    os.makedirs(os.path.join(DEMO, 'assets'), exist_ok=True)
    path = os.path.join(DEMO, 'assets', 'globe_base.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(out, f, separators=(',', ':'))
    print('wrote', path, '%.0f KB' % (os.path.getsize(path) / 1024), '| ocean columns', int((kmt > 0).sum()),
          '| land boxes (A grid)', int(lsm.sum()), '| ice boxes', int((ice > 50).sum()))


if __name__ == '__main__':
    main()
