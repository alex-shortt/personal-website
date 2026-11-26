"""Score an actual orthographic front-view silhouette render against the reference.
Usage: python3 scripts/score-cloud-silhouette.py /tmp/cloud-matte.png
The capture's .png.json sidecar supplies the camera view height. No fitting,
rescaling to the observed cloud, or hole-filling is applied to the rendered mask.
"""
import argparse
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import binary_erosion, binary_fill_holes, map_coordinates

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('render', type=Path)
parser.add_argument('--min-iou', type=float, help='Fail if 50%%-opacity overlap falls below this threshold.')
parser.add_argument('--output', type=Path, default=Path('/tmp/cloud-silhouette-comparison.png'))
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
meta = json.loads((root / 'public/cloud/shape-reference.json').read_text())
capture = json.loads(Path(str(args.render) + '.json').read_text())
image = np.asarray(Image.open(args.render).convert('RGB'))
h, w = image.shape[:2]
view_height = capture['viewHeight']
world_y = (0.5 - (np.arange(h) + .5) / h) * view_height
world_x = ((np.arange(w) + .5) / w - .5) * view_height * w / h
xx, yy = np.meshgrid(world_x, world_y)
mask = np.asarray(Image.open(root / 'public/cloud/reference-mask.png')) / 255
source_x = xx / meta['unitsPerPixel'] + meta['sourceCenter'][0]
source_y = meta['sourceCenter'][1] - yy / meta['unitsPerPixel']
target = map_coordinates(mask, [source_y, source_x], order=0, mode='constant') > .5
# Diagnostic mode renders black with the volume's actual alpha over #fcfcfc.
alpha = np.clip(1 - image.mean(axis=2) / 252, 0, 1)
rendered = alpha >= .5
intersection = target & rendered
union = target | rendered
core = binary_erosion(target, iterations=4)
holes = binary_fill_holes(rendered) & ~rendered
metrics = {
    'iouAtAlpha50': float(intersection.sum() / union.sum()),
    'iouAtAlpha10': float((target & (alpha >= .1)).sum() / (target | (alpha >= .1)).sum()),
    'referenceCoverage': float(intersection.sum() / target.sum()),
    'extraAreaFraction': float((rendered & ~target).sum() / target.sum()),
    'interiorCoverage': float((core & rendered).sum() / core.sum()),
    'enclosedHolePixels': int((holes & target).sum()),
}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.with_suffix('.json').write_text(json.dumps(metrics, indent=2) + '\n')
# Fixed world-space crop covers every piece, including detached islands.
x0, x1 = int(w/2 - 2.0*h/view_height), int(w/2 + 2.0*h/view_height)
y0, y1 = int(h/2 - 1.15*h/view_height), int(h/2 + 1.15*h/view_height)
sl = np.s_[y0:y1, x0:x1]
overlay = np.full((h, w, 3), 252, dtype=np.uint8)
overlay[intersection] = (71, 79, 83)
overlay[target & ~rendered] = (239, 126, 64)  # Missing cloud.
overlay[rendered & ~target] = (65, 167, 205)  # Extra cloud.
panels = [Image.fromarray(np.uint8(np.where(target[sl], 30, 252))).convert('RGB'),
          Image.fromarray(image[sl]), Image.fromarray(overlay[sl])]
width, height = panels[0].size
result = Image.new('RGB', (width*3 + 48, height+76), (252,252,252))
draw = ImageDraw.Draw(result)
for i, (panel, title) in enumerate(zip(panels, ['Reference (cleaned alpha)', 'Actual rendered alpha', 'Overlap: orange missing / blue extra'])):
    px = 12 + i*(width+12)
    result.paste(panel, (px, 35)); draw.text((px,12), title, fill=(40,40,40))
draw.text((12,height+48), f"IoU {metrics['iouAtAlpha50']:.1%} | Interior coverage {metrics['interiorCoverage']:.1%} | Enclosed hole pixels {metrics['enclosedHolePixels']}", fill=(40,40,40))
result.save(args.output)
print(json.dumps(metrics, indent=2))

if args.min_iou is not None and metrics['iouAtAlpha50'] < args.min_iou:
    raise SystemExit(f"Silhouette overlap below required {args.min_iou:.1%}")
