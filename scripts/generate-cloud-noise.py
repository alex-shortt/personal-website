"""Offline, deterministic tileable volume + blue-noise rank texture.
Run with Python, numpy, scipy. No runtime noise-generation startup cost.
Outputs are original procedural assets; no third-party texture downloads.
"""
from pathlib import Path
import numpy as np
from scipy.ndimage import map_coordinates
from PIL import Image

out = Path(__file__).resolve().parent.parent / 'public/cloud'
out.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(83171)
n = 64
coords = np.indices((n, n, n), dtype=np.float32)

def value_noise(cells):
    lattice = rng.random((cells, cells, cells)).astype(np.float32)
    return map_coordinates(lattice, coords * cells / n, order=3, mode='grid-wrap', prefilter=True)

# Low-frequency rounded billows with finer erosion. Tileable on all axes.
perlin = sum(value_noise(c) * w for c, w in [(4, .55), (8, .28), (16, .12), (32, .05)])
cells = 8
p = coords * cells / n
base = np.floor(p).astype(int)
feature = rng.random((cells, cells, cells, 3)).astype(np.float32)
distance = np.full((n, n, n), 100, dtype=np.float32)
for z in [-1, 0, 1]:
    for y in [-1, 0, 1]:
        for x in [-1, 0, 1]:
            cell = base + np.array([z, y, x])[:, None, None, None]
            f = feature[cell[0] % cells, cell[1] % cells, cell[2] % cells]
            delta = cell + np.moveaxis(f, -1, 0) - p
            distance = np.minimum(distance, np.sum(delta * delta, axis=0))
worley = 1 - np.clip(np.sqrt(distance) / 1.1, 0, 1)
volume = np.clip(perlin * .65 + worley * .35, 0, 1)
# Store z/y/x order for a WebGL 3D texture.
Image.fromarray(np.round(volume * 255).astype(np.uint8).reshape(512, 512)).save(out / 'density-64.png', optimize=True)

# Progressive void filling produces a spatially distributed rank map.
# This is fixed spatial jitter, not animated white noise (no temporal sparkle).
b = 32
y, x = np.indices((b, b)); dx = np.minimum(x, b-x); dy = np.minimum(y, b-y)
kernel = np.exp(-(dx*dx + dy*dy) / (2 * 1.9**2))
energy = rng.random((b, b)) * 1e-5
used = np.zeros((b, b), dtype=bool)
ranks = np.zeros((b, b), dtype=np.uint8)
for rank in range(b*b):
    candidate = np.where(used, np.inf, energy)
    cy, cx = np.unravel_index(np.argmin(candidate), candidate.shape)
    used[cy, cx] = True
    ranks[cy, cx] = rank * 255 // (b*b-1)
    energy += np.roll(np.roll(kernel, cy, axis=0), cx, axis=1)
(out / 'jitter-32.bin').write_bytes(ranks.tobytes())
print('Wrote losslessly compressed density PNG and 1,024-byte sampling texture')
