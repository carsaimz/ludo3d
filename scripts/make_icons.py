#!/usr/bin/env python3
"""LUDO 3D - icon pipeline: one 1024px source -> all platform assets."""
from PIL import Image, ImageDraw, ImageOps
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'design', 'icon-source.png')
NAVY = (11, 21, 36)

img = Image.open(SRC).convert('RGBA')

def resize(im, s):
    return im.resize((s, s), Image.LANCZOS)

def rounded(im, radius_frac=0.22):
    s = im.size[0]
    mask = Image.new('L', (s * 2, s * 2), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, s * 2, s * 2], radius=int(s * 2 * radius_frac), fill=255)
    mask = mask.resize(im.size, Image.LANCZOS)
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out

def circle(im):
    s = im.size[0]
    mask = Image.new('L', (s * 4, s * 4), 0)
    d = ImageDraw.Draw(mask)
    d.ellipse([0, 0, s * 4, s * 4], fill=255)
    mask = mask.resize(im.size, Image.LANCZOS)
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out

# ---------- web / pwa ----------
pub = os.path.join(ROOT, 'public', 'icons')
os.makedirs(pub, exist_ok=True)
resize(img, 192).save(os.path.join(pub, 'icon-192.png'))
resize(img, 512).save(os.path.join(pub, 'icon-512.png'))
resize(img, 32).save(os.path.join(pub, 'favicon-32.png'))
rounded(resize(img, 180), 0.2).save(os.path.join(pub, 'apple-touch-180.png'))
# maskable: content inside 80% safe zone over navy
mk = Image.new('RGBA', (512, 512), NAVY + (255,))
inner = resize(img, 400)
mk.paste(inner, (56, 56))
mk.save(os.path.join(pub, 'maskable-512.png'))

# ---------- assets (electron / repo) ----------
assets = os.path.join(ROOT, 'assets')
os.makedirs(assets, exist_ok=True)
resize(img, 512).save(os.path.join(assets, 'icon.png'))
ico_sizes = [16, 24, 32, 48, 64, 128, 256]
resize(img, 256).save(os.path.join(assets, 'icon.ico'), sizes=[(s, s) for s in ico_sizes])

# ---------- android ----------
res = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
if os.path.isdir(res):
    launchers = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
    fg_sizes = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
    anydpi = os.path.join(res, 'mipmap-anydpi-v26')
    os.makedirs(anydpi, exist_ok=True)
    for dpi, s in launchers.items():
        d = os.path.join(res, f'mipmap-{dpi}')
        os.makedirs(d, exist_ok=True)
        resize(img, s).save(os.path.join(d, 'ic_launcher.png'))
        circle(resize(img, s)).save(os.path.join(d, 'ic_launcher_round.png'))
    for dpi, s in fg_sizes.items():
        d = os.path.join(res, f'mipmap-{dpi}')
        fg = Image.new('RGBA', (s, s), (0, 0, 0, 0))
        inner = resize(img, int(s * 0.62))
        off = (s - inner.size[0]) // 2
        fg.paste(inner, (off, off), inner)
        fg.save(os.path.join(d, 'ic_launcher_foreground.png'))
    # adaptive icon xml
    adaptive = '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
'''
    with open(os.path.join(anydpi, 'ic_launcher.xml'), 'w') as f:
        f.write(adaptive)
    with open(os.path.join(anydpi, 'ic_launcher_round.xml'), 'w') as f:
        f.write(adaptive)
    # background color resource
    vdir = os.path.join(res, 'values')
    os.makedirs(vdir, exist_ok=True)
    colors_path = os.path.join(vdir, 'ic_launcher_background.xml')
    with open(colors_path, 'w') as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0B1524</color>\n</resources>\n')
    print('android icons written')
else:
    print('android res not found - run npx cap add android first, then re-run this script')

print('done')
