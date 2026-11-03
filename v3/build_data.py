#!/usr/bin/env python3
"""Build v3/data/hadcm3_state.js: real HadCM3 fields for the 3D walkthrough.

Reads the BRIDGE standard HadCM3 (MOSES 2.1) pre-industrial start dumps, which stand in
for tdaah's own start dump (HadCM3B-M2.1aD is not on bc5). Both dumps are valid at
1 December 00:00, the same calendar point at which tdaah starts.

  atmosphere  hadcm3m2.1/tcylxa@dao09c1   96 x 73 x 19 (+ 4 soil levels)
  ocean       hadcm3m2.1/tcylxo@dao09c1   288 x 144 x 20

Three kinds of field are taken from the dumps:
  inst   prognostic state at 1 Dec 00:00
  nov    STASH time means over November held in the dump
  day30  STASH daily means over 30 November (the coupling fields of the last day)

Each field is quantised to 8 bits (0 = missing) and packed into greyscale PNG atlases,
one per grid, embedded as data URIs so the page also works when opened from disk.

Run with a Python that has numpy and Pillow, e.g.
  ~/envs/co2nb/bin/python v3/build_data.py
"""
import base64
import io
import json
import os
import sys

import numpy as np
from PIL import Image

DUMPS = '/projects/public/b56i/swsvalde/dumps/hadcm3m2.1/'
ATM_DUMP = DUMPS + 'tcylxa@dao09c1'
OCN_DUMP = DUMPS + 'tcylxo@dao09c1'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'hadcm3_state.js')

RMDI = -1.0e8          # anything below this is missing data (UM RMDI = -2**30)
A_EARTH = 6.371e6
KAPPA = 287.05 / 1005.0


class UMFile:
    """Minimal reader for UM vn4.x dumps (64-bit big-endian words)."""

    def __init__(self, fn):
        self.fn = fn
        f = self.fixhd = np.fromfile(fn, '>i8', 256)
        lk = np.fromfile(fn, '>i8', 64 * f[151], offset=8 * (f[149] - 1)).reshape(f[151], 64)
        self.lk = lk[lk[:, 0] != -99]
        self.lkr = self.lk.view('>f8')
        self.levc = np.fromfile(fn, '>f8', f[110] * f[111], offset=8 * (f[109] - 1)).reshape(f[111], f[110])

    def entries(self, stash, kind):
        """Lookup indices of one STASH item: inst, nov (November mean), day30 (30 Nov mean), diurnal."""
        out = []
        for i in np.where(self.lk[:, 41] == stash)[0]:
            r = self.lk[i]
            mean = r[24] == 128
            if kind == 'inst' and not mean:
                out.append(i)
            elif kind == 'nov' and mean and r[12] in (122, 322) and tuple(r[1:3]) == (11, 1):
                out.append(i)
            elif kind == 'day30' and mean and tuple(r[1:3]) == (11, 30):
                out.append(i)
            elif kind == 'diurnal' and mean and r[12] == 2422:
                out.append(i)
        return out

    def read(self, i, lsm=None):
        r = self.lk[i]
        pack = int(r[20])
        n1, n3 = pack % 10, (pack // 100) % 10
        rows, npts, lbegin, lblrec = int(r[17]), int(r[18]), int(r[28]), int(r[14])
        if n1 != 0:
            raise ValueError('packing %d not supported' % pack)
        a = np.fromfile(self.fn, '>f8' if r[38] == 1 else '>i8', lblrec, offset=8 * lbegin).astype(np.float64)
        if n3 == 1:                       # compressed to land points
            full = np.full(lsm.shape, np.nan)
            full[lsm] = a[:lsm.sum()]
            return full
        a = a[:rows * npts].reshape(rows, npts)
        return np.where(a < RMDI, np.nan, a)

    def get(self, stash, kind='inst', lsm=None, nlev=None, first=None):
        idx = self.entries(stash, kind)
        if first is not None:
            idx = idx[:first]
        if not idx:
            raise KeyError('%d %s' % (stash, kind))
        x = np.array([self.read(i, lsm) for i in idx])
        return x[:nlev] if nlev else x


# --------------------------------------------------------------------------- quantisation
FWD = {
    'lin': lambda x: x,
    'int': lambda x: x,
    'sqrt': lambda x: np.sqrt(np.maximum(x, 0)),
    'ssqrt': lambda x: np.sign(x) * np.sqrt(np.abs(x)),
    'log1p': lambda x: np.log10(1 + np.maximum(x, 0)),
}


class Pack:
    def __init__(self):
        self.tiles = {}      # grid -> list of uint8 arrays
        self.fields = {}

    def add(self, name, grid, data, tr='lin', lo=None, hi=None, per_level=False, sym=False,
            units='', src='', time='inst', label=None):
        data = np.asarray(data, np.float64)
        if data.ndim == 2:
            data = data[None]
        f = FWD[tr]
        los, his, idx = [], [], []
        for k in range(data.shape[0]):
            x = data[k]
            if tr == 'int':
                l, h = 0.0, 254.0
            elif per_level or lo is None:
                l, h = np.nanmin(x), np.nanmax(x)
                if sym:
                    m = max(abs(l), abs(h)); l, h = -m, m
                if h <= l:
                    h = l + 1e-12
            else:
                l, h = lo, hi
            fl, fh = f(np.float64(l)), f(np.float64(h))
            c = 1 + np.round((f(np.clip(x, l, h)) - fl) / (fh - fl) * 254)
            c = np.where(np.isnan(x), 0, np.clip(c, 1, 255)).astype(np.uint8)
            t = self.tiles.setdefault(grid, [])
            idx.append(len(t))
            t.append(c)
            los.append(float('%.6g' % l)); his.append(float('%.6g' % h))
        self.fields[name] = dict(grid=grid, tiles=idx, tr=tr, lo=los, hi=his, units=units, src=src, time=time)
        if label:
            self.fields[name]['label'] = label

    def atlases(self):
        out = {}
        for grid, tiles in self.tiles.items():
            th, tw = tiles[0].shape
            cols = max(1, min(len(tiles), 2304 // tw))
            nrow = -(-len(tiles) // cols)
            img = np.zeros((nrow * th, cols * tw), np.uint8)
            for i, t in enumerate(tiles):
                r, c = divmod(i, cols)
                img[r * th:(r + 1) * th, c * tw:(c + 1) * tw] = t
            buf = io.BytesIO()
            Image.fromarray(img, 'L').save(buf, 'PNG', optimize=True)
            out[grid] = dict(tw=tw, th=th, cols=cols, n=len(tiles),
                             png='data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode())
            print('  atlas %-3s %3d tiles  %5d x %-5d  %7.0f kB' % (grid, len(tiles), img.shape[1], img.shape[0], len(buf.getvalue()) / 1024))
        return out


def main():
    a = UMFile(ATM_DUMP)
    o = UMFile(OCN_DUMP)
    pk = Pack()

    # ------------------------------------------------------------------ atmosphere, 96 x 73
    lsm = a.get(30)[0] != 0
    AK, BK = a.levc[0], a.levc[1]
    soil_dz = [float(x) for x in a.levc[5][:4]]
    pstar = a.get(1)[0]
    p = AK[:, None, None] + BK[:, None, None] * pstar[None]          # Pa at the 19 full levels
    thl = a.get(5)
    qt = a.get(11)
    temp = thl * (p / 1.0e5) ** KAPPA                                  # liquid-water temperature

    pk.add('lsm', 'A', lsm.astype(float), 'int', src='0/30')
    pk.add('orog', 'A', a.get(33)[0], 'lin', -50, 6000, units='m', src='0/33')
    pk.add('sdorog', 'A', a.get(34, lsm=lsm)[0], 'sqrt', 0, 1600, units='m', src='0/34')
    pk.add('pstar', 'A', pstar / 100, 'lin', 500, 1050, units='hPa', src='0/1')
    pk.add('thetal', 'A', thl, 'lin', per_level=True, units='K', src='0/5')
    pk.add('temp', 'A', temp, 'lin', per_level=True, units='K', src='0/5 · θl × (p/p₀)^κ')
    pk.add('qt', 'A', qt * 1000, 'sqrt', per_level=True, units='g/kg', src='0/11')
    pk.add('u', 'AU', a.get(2), 'lin', -85, 85, units='m/s', src='0/2')
    pk.add('v', 'AU', a.get(3), 'lin', -85, 85, units='m/s', src='0/3')
    pk.add('tstar', 'A', a.get(24)[0], 'lin', 205, 330, units='K', src='0/24')
    pk.add('ice', 'A', a.get(31)[0], 'lin', 0, 1, src='0/31')
    pk.add('icedepth', 'A', a.get(32)[0], 'sqrt', 0, 17, units='m', src='0/32')
    pk.add('snow', 'A', a.get(23)[0], 'log1p', 0, 60000, units='kg/m²', src='0/23')
    pk.add('cca', 'A', a.get(13)[0], 'lin', 0, 1, src='0/13')
    pk.add('ccb', 'A', a.get(14)[0], 'int', src='0/14')
    pk.add('cct', 'A', a.get(15)[0], 'int', src='0/15')
    pk.add('zbl', 'A', a.get(25)[0], 'lin', 0, 3000, units='m', src='0/25')
    pk.add('smc', 'A', a.get(9, lsm=lsm), 'lin', 0, 950, units='kg/m²', src='0/9')
    pk.add('tsoil', 'A', a.get(20, lsm=lsm), 'lin', 200, 320, units='K', src='0/20')
    pk.add('frac', 'A', a.get(216, lsm=lsm), 'lin', 0, 1, src='0/216')
    pk.add('lai', 'A', a.get(217, lsm=lsm), 'lin', 0, 10, src='0/217')

    nov = 'nov'
    pk.add('cloud', 'A', a.get(9201, nov), 'lin', 0, 1, src='9/201', time=nov)
    pk.add('cloudTot', 'A', a.get(9216, nov)[0], 'lin', 0, 1, src='9/216', time=nov)
    pk.add('swHeat', 'A', a.get(1232, nov) * 86400, 'lin', per_level=True, units='K/day', src='1/232', time=nov)
    pk.add('lwHeat', 'A', a.get(2232, nov) * 86400, 'lin', per_level=True, sym=True, units='K/day', src='2/232', time=nov)
    pk.add('toaSWin', 'A', a.get(1207, nov)[0], 'lin', 0, 550, units='W/m²', src='1/207', time=nov)
    pk.add('toaSWout', 'A', a.get(1208, nov)[0], 'lin', 0, 350, units='W/m²', src='1/208', time=nov)
    pk.add('olr', 'A', a.get(2205, nov)[0], 'lin', 100, 330, units='W/m²', src='2/205', time=nov)
    sw_dn = a.get(1235, nov)[0]
    sw_net = a.get(1201, nov)[0]
    pk.add('sfcSWnet', 'A', sw_net, 'lin', 0, 350, units='W/m²', src='1/201', time=nov)
    pk.add('albedo', 'A', np.where(sw_dn > 5, 1 - sw_net / np.maximum(sw_dn, 1e-6), np.nan), 'lin', 0, 1, src='1 − 1/201 ÷ 1/235', time=nov)
    pk.add('sfcLWdn', 'A', a.get(2207, nov)[0], 'lin', 80, 450, units='W/m²', src='2/207', time=nov)
    pk.add('sh', 'A', a.get(3217, nov)[0], 'lin', -100, 200, units='W/m²', src='3/217', time=nov)
    pk.add('lh', 'A', a.get(3234, nov)[0], 'lin', -50, 450, units='W/m²', src='3/234', time=nov)
    mmday = 86400.0
    lsr, lss = a.get(4203, nov)[0] * mmday, a.get(4204, nov)[0] * mmday
    cvr, cvs = a.get(5205, nov)[0] * mmday, a.get(5206, nov)[0] * mmday
    pk.add('lsPrecip', 'A', lsr + lss, 'sqrt', 0, 40, units='mm/day', src='4/203 + 4/204', time=nov)
    pk.add('cvPrecip', 'A', cvr + cvs, 'sqrt', 0, 60, units='mm/day', src='5/205 + 5/206', time=nov)
    pk.add('snowfall', 'A', lss + cvs, 'sqrt', 0, 15, units='mm/day', src='4/204 + 5/206', time=nov)
    diur = a.entries(3236, 'diurnal')
    hours = [int(a.lk[i, 3]) for i in diur]
    pk.add('t15', 'A', np.array([a.read(i) for i in diur]), 'lin', 210, 320, units='K', src='3/236', time='diurnal')
    pk.add('gpp', 'A', a.get(3261, nov)[0] * 1000 * 86400, 'sqrt', 0, 15, units='g C/m²/day', src='3/261', time=nov)
    pk.add('runoff', 'A', (a.get(8234, nov)[0] + a.get(8235, nov)[0]) * mmday, 'sqrt', 0, 20, units='mm/day', src='8/234 + 8/235', time=nov)

    # coupling fields of 30 November on the atmosphere grid
    d = 'day30'
    pk.add('dTaux', 'AU', a.get(3219, d)[0], 'ssqrt', -1.0, 1.0, units='N/m²', src='3/219', time=d)
    pk.add('dTauy', 'AU', a.get(3220, d)[0], 'ssqrt', -1.0, 1.0, units='N/m²', src='3/220', time=d)
    pk.add('dWme', 'A', a.get(3224, d)[0], 'sqrt', 0, 0.02, units='W/m²', src='3/224', time=d)
    prec = sum(a.get(s, d)[0] for s in (4203, 4204, 5205, 5206))
    pme = (prec - a.get(3232, d)[0]) * mmday
    pk.add('dPmE', 'A', np.where(lsm, np.nan, pme), 'ssqrt', -15, 60, units='mm/day', src='4/203 + 4/204 + 5/205 + 5/206 − 3/232', time=d)
    ro = (a.get(8204, d)[0] + a.get(8205, d)[0]) * 48      # kg/m2 per step -> per day
    pk.add('dRunoff', 'A', np.where(lsm, ro, np.nan), 'sqrt', 0, 20, units='mm/day', src='8/204 + 8/205', time=d)

    # tropopause level, lapse-rate test on the start-dump temperatures (as TROPIN does, simplified)
    g, R = 9.80665, 287.05
    z = np.zeros_like(temp)
    for k in range(1, 19):
        z[k] = z[k - 1] + R * 0.5 * (temp[k] + temp[k - 1]) / g * np.log(p[k - 1] / p[k])
    lapse = -(temp[1:] - temp[:-1]) / np.maximum(z[1:] - z[:-1], 1) * 1000
    trop = np.full(pstar.shape, 0.0)
    for j in range(73):
        for i in range(96):
            for k in range(2, 17):
                if p[k, j, i] < 5.0e4 and lapse[k, j, i] < 2.0:
                    trop[j, i] = k + 1
                    break
    pk.add('trop', 'A', trop, 'int', src='lapse rate < 2 K/km above 500 hPa')

    # river outflow points: value = column * 1e5 + row (1-based) for every land point
    rof = a.get(93, lsm=lsm)[0]
    outflow = []
    for j, i in zip(*np.where(lsm)):
        v = rof[j, i]
        oi, oj = int(round(v / 1e5)), int(round(v - round(v / 1e5) * 1e5))
        if 1 <= oi <= 96 and 1 <= oj <= 73 and not lsm[oj - 1, oi - 1]:
            outflow.append([int(j * 96 + i), int((oj - 1) * 96 + oi - 1)])

    # global-mean level heights and pressures for the axis labels
    w = np.cos(np.deg2rad(90 - 2.5 * np.arange(73)))[:, None]
    zmean = [float('%.0f' % (np.sum(z[k] * w) / np.sum(w * np.ones((73, 96))))) for k in range(19)]
    p_ref = [float('%.4g' % ((AK[k] + BK[k] * 1.0e5) / 100)) for k in range(19)]

    # ------------------------------------------------------------------ ocean, 288 x 144
    T = o.get(101, nlev=20)[:, :, :288]
    S = o.get(102, nlev=20)[:, :, :288] * 1000 + 35
    kmt = np.sum(~np.isnan(T), 0).astype(float)
    dz = o.levc[0]
    zc = [float('%.1f' % o.lkr[i, 51]) for i in o.entries(101, 'inst')[:20]]
    pk.add('kmt', 'O', kmt, 'int', src='wet levels of 0/101')
    pk.add('T', 'O', T, 'lin', per_level=True, units='°C', src='0/101')
    pk.add('S', 'O', S, 'lin', per_level=True, units='psu', src='0/102')
    U = o.get(30320, nov, nlev=20)[:, :, :288]
    V = o.get(30321, nov, nlev=20)[:, :, :288]
    pk.add('U', 'OU', U, 'ssqrt', per_level=True, sym=True, units='cm/s', src='30/320', time=nov)
    pk.add('V', 'OU', V, 'ssqrt', per_level=True, sym=True, units='cm/s', src='30/321', time=nov)
    ub = o.get(121, nlev=1)[:, :, :288]
    vb = o.get(122, nlev=1)[:, :, :288]
    pk.add('ub1', 'OU', ub, 'ssqrt', per_level=True, sym=True, units='cm/s', src='0/121 level 1')
    pk.add('vb1', 'OU', vb, 'ssqrt', per_level=True, sym=True, units='cm/s', src='0/122 level 1')

    # barotropic streamfunction from the November-mean velocity: psi_y = -sum_k u dz
    trans = np.nansum(np.nan_to_num(U) / 100.0 * dz[:, None, None], 0)        # m2/s on u points
    dy = A_EARTH * np.deg2rad(1.25)
    psi = -np.cumsum(trans, 0) * dy / 1e6                                    # Sv, rows -88.75 .. 88.75
    ref = psi[int(round((-30 + 88.75) / 1.25)), int(round((300 - 0.625) / 1.25))]   # South America = 0
    psi = psi - ref
    psi_land = np.isnan(U[0])
    psi = np.where(psi_land, np.nan, psi)
    drake = np.sum(trans[int(round((-70 + 88.75) / 1.25)):int(round((-52 + 88.75) / 1.25)),
                         int(round((292.5 - 0.625) / 1.25))]) * dy / 1e6      # transport through Drake Passage
    pk.add('psi', 'OU', psi, 'lin', -100, 350, units='Sv', src='Σ 30/320 dz, integrated northward', time=nov)

    pk.add('mld', 'O', o.get(137)[0][:, :288], 'sqrt', 0, 800, units='m', src='0/137')
    pk.add('aice', 'O', o.get(146)[0][:, :288], 'lin', 0, 1, src='0/146')
    pk.add('hice', 'O', o.get(147)[0][:, :288], 'sqrt', 0, 6, units='m', src='0/147')
    pk.add('hsnow', 'O', o.get(141)[0][:, :288], 'sqrt', 0, 2, units='m', src='0/141')
    pk.add('qice', 'O', o.get(143)[0][:, :288], 'sqrt', 0, 240, units='W/m²', src='0/143')
    pk.add('oTaux', 'OU', o.get(150)[0][:, :288], 'ssqrt', -1.0, 1.0, units='N/m²', src='0/150', time=d)
    pk.add('oTauy', 'OU', o.get(151)[0][:, :288], 'ssqrt', -1.0, 1.0, units='N/m²', src='0/151', time=d)
    pk.add('oWme', 'O', o.get(152)[0][:, :288], 'sqrt', 0, 0.02, units='W/m²', src='0/152', time=d)
    pk.add('oSol', 'O', o.get(161)[0][:, :288], 'lin', 0, 200, units='W/m²', src='0/161', time=d)
    pk.add('oHtn', 'O', o.get(162)[0][:, :288], 'ssqrt', -1050, 200, units='W/m²', src='0/162', time=d)
    pk.add('oPmE', 'O', o.get(165)[0][:, :288] * mmday, 'ssqrt', -15, 60, units='mm/day', src='0/165', time=d)
    pk.add('oRiver', 'O', o.get(166)[0][:, :288] * mmday, 'sqrt', 0, 200, units='mm/day', src='0/166', time=d)
    pk.add('oSnow', 'O', o.get(171)[0][:, :288] * mmday, 'sqrt', 0, 15, units='mm/day', src='0/171', time=d)
    pk.add('wfix', 'O', o.get(186)[0][:, :288] * mmday, 'sqrt', 0, 0.2, units='mm/day', src='0/186')
    pk.add('iceU', 'OU', o.get(32209, nov)[0][:, :288], 'ssqrt', -1.4, 1.4, units='m/s', src='32/209', time=nov)
    pk.add('iceV', 'OU', o.get(32210, nov)[0][:, :288], 'ssqrt', -1.4, 1.4, units='m/s', src='32/210', time=nov)

    print('psi range %.0f .. %.0f Sv; Drake Passage transport %.0f Sv' % (np.nanmin(psi), np.nanmax(psi), drake))
    print('outflow pairs to sea points: %d' % len(outflow))
    print('diurnal T1.5m hours:', hours)

    state = dict(
        meta=dict(
            atmDump=ATM_DUMP, ocnDump=OCN_DUMP, valid='1 Dec 00:00 (model year 2409), 360-day calendar',
            note='BRIDGE standard HadCM3 MOSES 2.1 PI start dumps (tcylx), standing in for tdaah (HadCM3B-M2.1aD)'),
        grids=dict(
            A=dict(nx=96, ny=73, lon0=0.0, dlon=3.75, lat0=90.0, dlat=-2.5),
            AU=dict(nx=96, ny=72, lon0=1.875, dlon=3.75, lat0=88.75, dlat=-2.5),
            O=dict(nx=288, ny=144, lon0=0.0, dlon=1.25, lat0=-89.375, dlat=1.25),
            OU=dict(nx=288, ny=143, lon0=0.625, dlon=1.25, lat0=-88.75, dlat=1.25)),
        levels=dict(
            atm=dict(A=[float('%.6g' % x) for x in AK], B=[float('%.6g' % x) for x in BK], p=p_ref, z=zmean),
            ocn=dict(z=zc, dz=[float(x) for x in dz]),
            soil=dict(dz=soil_dz)),
        diurnalHours=hours,
        outflow=outflow,
        fields=pk.fields,
        atlases=pk.atlases())
    js = '/* generated by v3/build_data.py — do not edit */\nwindow.HADCM3_STATE = ' + json.dumps(state, separators=(',', ':'), ensure_ascii=False) + ';\n'
    with open(OUT, 'w') as fh:
        fh.write(js)
    print('wrote %s (%.0f kB, %d fields)' % (OUT, len(js) / 1024, len(pk.fields)))


if __name__ == '__main__':
    sys.exit(main())
