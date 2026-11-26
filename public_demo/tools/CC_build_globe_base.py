#!/usr/bin/env python3
"""Write public_demo/assets/globe_base.json: the present-day HadCM3 fields the globe is drawn from.

Real HadCM3 data (BRIDGE pre-industrial start dumps, via v3/data/hadcm3_state.js), fixed for every scenario:
  frac      9 surface-type fractions on the 96 x 73 atmosphere grid (broadleaf, needleleaf, C3, C4, shrub,
            urban, inland water, bare soil, land ice), each as uint8 = fraction x 255: land colours and 3D plants
  precip    large-scale + convective rain and snow, November mean, uint8 = sqrt(mm/day / 60) x 255: the 3D rain
  tstar     surface temperature, uint8 = (K - 205) / 125 x 255: rain or snow
  lsm       land-sea mask, 1 = land
  kmt       ocean levels per column on the 288 x 144 ocean grid (0 = land)
Atmosphere-grid rows start at 90 N; ocean-grid rows start at 89.375 S. Each grid is base64 of raw uint8 bytes.

Run: python3 public_demo/tools/CC_build_globe_base.py        (needs numpy and Pillow)
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

FWD = {'lin': lambda v: v, 'int': lambda v: v, 'sqrt': lambda v: np.sqrt(np.maximum(v, 0))}
INV = {'lin': lambda x: x, 'int': lambda x: x, 'sqrt': lambda x: x * x}


def load_state():
    with open(os.path.join(ROOT, 'v3', 'data', 'hadcm3_state.js'), encoding='utf-8') as f:
        src = f.read()
    return json.loads(src[src.index('{'):src.rindex('}') + 1])


def values(st, name, k=0):
    """decode one level of a field to physical values (NaN where missing)"""
    m = st['fields'][name]
    a = st['atlases'][m['grid']]
    img = np.array(Image.open(io.BytesIO(base64.b64decode(a['png'].split(',', 1)[1]))).convert('RGBA'))[:, :, 0]
    t = m['tiles'][k]
    c = img[(t // a['cols']) * a['th']:(t // a['cols'] + 1) * a['th'], (t % a['cols']) * a['tw']:(t % a['cols'] + 1) * a['tw']].astype(float)
    f, inv = FWD[m['tr']], INV[m['tr']]
    lo, hi = f(m['lo'][k]), f(m['hi'][k])
    return np.where(c == 0, np.nan, inv(lo + (c - 1) / 254.0 * (hi - lo)))


def b64(a):
    return base64.b64encode(np.ascontiguousarray(a, dtype=np.uint8).tobytes()).decode()


def main():
    st = load_state()
    kmt = np.clip(np.nan_to_num(values(st, 'kmt'), nan=0), 0, 20).astype(np.uint8)
    lsm = (np.nan_to_num(values(st, 'lsm')) > 0).astype(np.uint8)
    frac = np.stack([np.nan_to_num(values(st, 'frac', k)) for k in range(9)])
    precip = np.nan_to_num(values(st, 'lsPrecip')) + np.nan_to_num(values(st, 'cvPrecip'))
    tstar = np.nan_to_num(values(st, 'tstar'), nan=280.0)
    out = {
        'meta': {'placeholder': False, 'source': 'HadCM3 pre-industrial start dumps (BRIDGE tcylx), via v3/data/hadcm3_state.js',
                 'note': 'present-day model state; does not change with the scenario or the time slider'},
        'gridA': st['grids']['A'], 'gridO': st['grids']['O'],
        'lsm': b64(lsm), 'kmt': b64(kmt),
        'frac': [b64(np.round(np.clip(f, 0, 1) * 255)) for f in frac],
        'precip': b64(np.round(np.sqrt(np.clip(precip, 0, 60) / 60) * 255)),
        'tstar': b64(np.round(np.clip((tstar - 205) / 125, 0, 1) * 255)),
    }
    os.makedirs(os.path.join(DEMO, 'assets'), exist_ok=True)
    path = os.path.join(DEMO, 'assets', 'globe_base.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(out, f, separators=(',', ':'))
    print('wrote', path, '%.0f KB' % (os.path.getsize(path) / 1024))


if __name__ == '__main__':
    main()
