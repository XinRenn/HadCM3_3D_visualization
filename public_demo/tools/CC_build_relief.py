#!/usr/bin/env python3
"""Write public_demo/assets/relief_10m.png: land height and sea depth for the globe's moving coastline.

Input: GMT's earth_relief_10m_p.grd (SRTM15+ v2.7 at 10 arc-minutes; Tozer et al. 2019,
https://doi.org/10.1029/2019EA000658), downloadable from
https://oceania.generic-mapping-tools.org/server/earth/earth_relief/earth_relief_10m_p.grd

Output: a 2160 x 1080 RGB PNG. Row 0 is the northern edge, column 0 is 180 W (cell centres, 1/6 degree).
Height in metres = (R * 256 + G) / 65535 * 17500 - 11000   (0.27 m steps; B is unused).

Run: python3 public_demo/tools/CC_build_relief.py path/to/earth_relief_10m_p.grd     (needs xarray, h5netcdf, Pillow)
"""
import os
import sys

import numpy as np
import xarray as xr
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DEMO = os.path.dirname(HERE)
LO, SPAN = -11000.0, 17500.0


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    ds = xr.open_dataset(sys.argv[1], engine='h5netcdf')
    z = ds['z'].values.astype(float)            # (lat south->north, lon -180->180)
    z = z[::-1]                                 # row 0 = north
    v = np.round((np.clip(z, LO, LO + SPAN) - LO) / SPAN * 65535).astype(np.uint32)
    rgb = np.zeros(z.shape + (3,), dtype=np.uint8)
    rgb[..., 0] = v >> 8
    rgb[..., 1] = v & 255
    path = os.path.join(DEMO, 'assets', 'relief_10m.png')
    Image.fromarray(rgb, 'RGB').save(path, optimize=True)
    print('wrote', path, z.shape, '%.0f KB' % (os.path.getsize(path) / 1024), 'range %.0f..%.0f m' % (z.min(), z.max()))


if __name__ == '__main__':
    main()
