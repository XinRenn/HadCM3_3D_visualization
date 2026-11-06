#!/usr/bin/env python3
"""Assemble popsci/HadCM3_popsci.html, the simplified science-communication page.

Inputs
  popsci/src/popsci.html      page (CSS and JS) with an @@DATA@@ placeholder
  v3/data/hadcm3_state.js     fields made by v3/build_data.py; only the ones the page draws are kept

Unlike v3, the page carries its data inline, so it is one file apart from Google Fonts and three.js.

Run: python3 popsci/CC_build_popsci.py           -> popsci/HadCM3_popsci.html (full document, opens from disk)
     python3 popsci/CC_build_popsci.py --bare F  -> also F, the page without the doctype/charset/viewport lines,
                                                    for publishing as an Artifact (the host adds its own skeleton)
     python3 popsci/CC_build_popsci.py --facts   -> print the numbers quoted in the captions
Needs numpy and Pillow.
"""
import base64
import io
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# field -> levels to keep (None = all)
KEEP = {
    'lsm': None, 'orog': None, 'frac': None, 'snow': None, 'cloudTot': None, 'lsPrecip': None, 'cvPrecip': None,
    't15': None, 'u': [3], 'v': [3],                       # level 4 of 19 is about 870 hPa, 1.1 km up
    'kmt': None, 'T': [0], 'aice': None, 'U': [0], 'V': [0],
}


def load_state():
    with open(os.path.join(ROOT, 'v3', 'data', 'hadcm3_state.js'), encoding='utf-8') as f:
        src = f.read()
    return json.loads(src[src.index('{'):src.rindex('}') + 1])


def atlas_tiles(a):
    b64 = a['png'].split(',', 1)[1]
    img = np.array(Image.open(io.BytesIO(base64.b64decode(b64))).convert('RGBA'))[:, :, 0]
    return [img[(t // a['cols']) * a['th']:(t // a['cols'] + 1) * a['th'],
                (t % a['cols']) * a['tw']:(t % a['cols'] + 1) * a['tw']] for t in range(a['n'])]


def pack_atlas(tiles, tw, th):
    cols = min(len(tiles), {96: 12, 288: 4}[tw])
    rows = (len(tiles) + cols - 1) // cols
    out = np.zeros((rows * th, cols * tw), dtype=np.uint8)
    for t, u in enumerate(tiles):
        out[(t // cols) * th:(t // cols + 1) * th, (t % cols) * tw:(t % cols + 1) * tw] = u
    buf = io.BytesIO()
    Image.fromarray(out, 'L').save(buf, 'PNG', optimize=True)
    return {'tw': tw, 'th': th, 'cols': cols, 'n': len(tiles),
            'png': 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()}


def subset(st):
    tiles = {g: atlas_tiles(a) for g, a in st['atlases'].items()}
    new_tiles = {g: [] for g in tiles}
    fields = {}
    for name, levels in KEEP.items():
        m = st['fields'][name]
        ks = levels if levels is not None else list(range(len(m['tiles'])))
        idx = []
        for k in ks:
            new_tiles[m['grid']].append(tiles[m['grid']][m['tiles'][k]])
            idx.append(len(new_tiles[m['grid']]) - 1)
        fields[name] = {'grid': m['grid'], 'tiles': idx, 'tr': m['tr'],
                        'lo': [m['lo'][k] for k in ks], 'hi': [m['hi'][k] for k in ks]}
    atlases = {g: pack_atlas(ts, st['atlases'][g]['tw'], st['atlases'][g]['th']) for g, ts in new_tiles.items()}
    return {'grids': st['grids'], 'fields': fields, 'atlases': atlases}


def facts(st):
    tiles = {g: atlas_tiles(a) for g, a in st['atlases'].items()}
    kmt = tiles['O'][st['fields']['kmt']['tiles'][0]].astype(float) - 1     # code c is value c - 1 for 'int' fields
    kmt[kmt < 0] = 0
    print('ocean boxes in the 288 x 144 grid that are water:', int(kmt.sum()))
    print('atmosphere boxes 96 x 73 x 19 =', 96 * 73 * 19)
    print('box size at the equator: %.0f x %.0f km' % (3.75 * 111.2, 2.5 * 111.2))
    print('steps per model year (48 + 24) x 360 =', 72 * 360)
    lsm = tiles['A'][st['fields']['lsm']['tiles'][0]].astype(int) - 1
    print('A-grid land boxes around Britain and Ireland:')
    for j in range(int((90 - 60) / 2.5), int((90 - 49) / 2.5) + 1):
        row = ''
        for lon in np.arange(-11.25, 3.76, 3.75):
            row += '#' if lsm[j, int(round((lon % 360) / 3.75)) % 96] > 0 else '.'
        print('  %5.1fN %s' % (90 - 2.5 * j, row))


def main():
    st = load_state()
    if '--facts' in sys.argv:
        facts(st)
        return
    with open(os.path.join(HERE, 'src', 'popsci.html'), encoding='utf-8') as f:
        page = f.read()
    data = json.dumps(subset(st), separators=(',', ':'))
    page = page.replace('@@DATA@@', data)
    head = ('<!doctype html>\n<html lang="zh">\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n')
    out = os.path.join(HERE, 'HadCM3_popsci.html')
    with open(out, 'w', encoding='utf-8') as f:
        f.write(head + page)
    print('wrote', out, '%.0f KB (data %.0f KB)' % (len(page) / 1024, len(data) / 1024))
    if '--bare' in sys.argv:
        bare = sys.argv[sys.argv.index('--bare') + 1]
        with open(bare, 'w', encoding='utf-8') as f:
            f.write(page)
        print('wrote', bare)


if __name__ == '__main__':
    main()
