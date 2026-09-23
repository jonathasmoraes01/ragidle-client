import os, hashlib, json
from PIL import Image, ImageDraw
SRC = r"C:\Users\Administrator\Downloads\Rag-idle\Cash Shop"
OUT = os.path.dirname(os.path.abspath(__file__))
rows = []
files = sorted(f for f in os.listdir(SRC) if f.lower().endswith('.png'))
for i, f in enumerate(files):
    p = os.path.join(SRC, f)
    b = open(p, 'rb').read()
    im = Image.open(p)
    a = None
    if im.mode in ('RGBA', 'LA') :
        al = im.getchannel('A')
        ex = al.getextrema()
        # fraction transparent
        h = al.histogram()
        a = dict(min=ex[0], max=ex[1], transp=round(sum(h[:10]) / (im.width*im.height), 3))
    rows.append(dict(i=i, file=f, w=im.width, h=im.height, mode=im.mode, bytes=len(b), sha1=hashlib.sha1(b).hexdigest()[:12], alpha=a))
json.dump(rows, open(os.path.join(OUT, 'inventario.json'), 'w'), indent=1, ensure_ascii=False)
for r in rows: print(r)
# contact sheet
T = 300
cols = 5
sheet = Image.new('RGB', (cols*T, ((len(files)+cols-1)//cols)*(T+20)), (60, 60, 60))
d = ImageDraw.Draw(sheet)
for r in rows:
    im = Image.open(os.path.join(SRC, r['file'])).convert('RGBA')
    im.thumbnail((T-10, T-10))
    bg = Image.new('RGBA', im.size, (200, 0, 200, 255))  # magenta shows transparency
    bg.alpha_composite(im)
    x = (r['i'] % cols)*T; y = (r['i']//cols)*(T+20)
    sheet.paste(bg.convert('RGB'), (x+5, y+5))
    d.text((x+5, y+T), f"#{r['i']} {r['w']}x{r['h']}", fill=(255,255,0))
sheet.convert('RGB').save(os.path.join(OUT, 'folha-de-contato-dos-originais.jpg'), quality=85)
