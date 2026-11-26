#!/usr/bin/env python3
"""Write public_demo/assets/globe_base.json: the coastline and sea-floor depth the cartoon globe is drawn on.

This is real HadCM3 geography (pre-industrial), not placeholder data, and it does not change with the scenario:
  kmt  ocean grid 288 x 144, number of ocean levels in each column (0 = land); row 0 is the southern row (89.375 S)
  lsm  atmosphere grid 96 x 73, 1 = land; row 0 is 90 N
  level_bottom_m  depth of the bottom of each of the 20 HadCM3 ocean levels, so a column of kmt levels is
                  level_bottom_m[kmt - 1] deep. The globe uses it to show sea floor that falls dry when the
                  sea level drops (for example by 120 m in the ice age).
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


def field(st, name, k=0):
    m = st['fields'][name]
    a = st['atlases'][m['grid']]
    img = np.array(Image.open(io.BytesIO(base64.b64decode(a['png'].split(',', 1)[1]))).convert('RGBA'))[:, :, 0]
    t = m['tiles'][k]
    tile = img[(t // a['cols']) * a['th']:(t // a['cols'] + 1) * a['th'], (t % a['cols']) * a['tw']:(t % a['cols'] + 1) * a['tw']]
    return tile.astype(int) - 1          # 'int' fields: code c means value c - 1, code 0 missing (-1)


def main():
    st = load_state()
    kmt = np.clip(field(st, 'kmt'), 0, 20).astype(np.uint8)
    lsm = (field(st, 'lsm') > 0).astype(np.uint8)
    out = {
        'meta': {'placeholder': False, 'source': 'HadCM3 pre-industrial start dumps (BRIDGE tcylx), via v3/data/hadcm3_state.js',
                 'note': 'coastline and sea-floor depth only; fixed for every scenario'},
        'kmt': {'grid': st['grids']['O'], 'b64': base64.b64encode(kmt.tobytes()).decode()},
        'lsm': {'grid': st['grids']['A'], 'b64': base64.b64encode(lsm.tobytes()).decode()},
        'level_bottom_m': [round(float(x), 1) for x in np.cumsum(st['levels']['ocn']['dz'])],   # the dump's own level thicknesses
    }
    os.makedirs(os.path.join(DEMO, 'assets'), exist_ok=True)
    path = os.path.join(DEMO, 'assets', 'globe_base.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(out, f, separators=(',', ':'))
    print('wrote', path, '%.0f KB' % (os.path.getsize(path) / 1024), '| ocean columns', int((kmt > 0).sum()),
          '| land boxes (A grid)', int(lsm.sum()))


if __name__ == '__main__':
    main()
