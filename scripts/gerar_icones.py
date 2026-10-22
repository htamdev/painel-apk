from PIL import Image, ImageDraw
src = Image.open('icon.png').convert('RGBA')
res = 'android/app/src/main/res'
dens = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
for d, s in dens.items():
    p = f'{res}/mipmap-{d}'
    f = s * 108 // 48
    k = int(f * 0.6)
    c = Image.new('RGBA', (f, f), (0, 0, 0, 0))
    ic = src.resize((k, k), Image.LANCZOS)
    c.paste(ic, ((f - k) // 2, (f - k) // 2), ic)
    c.save(f'{p}/ic_launcher_foreground.png')
    k = int(s * 0.8)
    b = Image.new('RGBA', (s, s), (255, 255, 255, 255))
    ic = src.resize((k, k), Image.LANCZOS)
    b.paste(ic, ((s - k) // 2, (s - k) // 2), ic)
    b.save(f'{p}/ic_launcher.png')
    m = Image.new('L', (s * 4, s * 4), 0)
    ImageDraw.Draw(m).ellipse((0, 0, s * 4 - 1, s * 4 - 1), fill=255)
    r = b.copy()
    r.putalpha(m.resize((s, s), Image.LANCZOS))
    r.save(f'{p}/ic_launcher_round.png')
open(f'{res}/values/ic_launcher_background.xml', 'w').write(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#FFFFFF</color>\n</resources>\n')
print('icones gerados')
