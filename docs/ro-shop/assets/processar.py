"""Recorta (bbox pelo alfa), reduz ao tamanho de uso x2 e comprime os assets do RO Shop.
Os originais em Cash Shop/ sao SO LIDOS.

Uso: python docs/ro-shop/assets/inventario.py (gera inventario.json e contact.png)
     python docs/ro-shop/assets/processar.py  (publica em public/ragidle/shop/)
Os dois leem/escrevem ao lado de si mesmos; DST e o caminho da worktree do Agente 2."""
import json, os, hashlib, io
from PIL import Image
rows = json.load(open('inventario.json'))
SRC = r"C:/Users/Administrator/Downloads/Rag-idle/Cash Shop"
DST = r"C:/Users/Administrator/Downloads/Rag-idle/ragidle-client/.claude/worktrees/ro-shop/public/ragidle/shop"
P = lambda i: os.path.join(SRC, rows[i]['file'])
# (indice, destino relativo, lado maior final em px)
MAPA = [
    (1,  'icons/shop-icon-featured.png', 96),
    (4,  'icons/shop-icon-farm-up.png', 96),
    (8,  'icons/shop-icon-potions.png', 96),
    (2,  'icons/shop-icon-boosts.png', 96),
    (7,  'icons/shop-icon-utilities.png', 96),
    (6,  'icons/shop-icon-account.png', 96),
    (14, 'icons/shop-icon-ro-cash.png', 96),
    (13, 'icons/shop-icon-recharge.png', 64),
    (9,  'icons/shop-icon-cart.png', 96),
    (10, 'buttons/shop-btn-close.png', 64),
    (5,  'states/shop-empty-cart.png', 280),
    (16, 'states/shop-item-placeholder.png', 128),
    (18, 'badges/shop-badge-new.png', 48),
    (3,  'badges/shop-badge-sale.png', 48),
    (17, 'badges/shop-badge-popular.png', 48),
    (11, 'ornaments/shop-divider-horizontal.png', 640),
    (15, 'ornaments/shop-header-ornament.png', 560),
]
def bbox_alfa(im, lim=10):
    a = im.getchannel('A').point(lambda v: 255 if v > lim else 0)
    return a.getbbox()
def salvar_png(im, caminho):
    # quantiza preservando alfa (FASTOCTREE aceita RGBA); fica com a menor das duas
    buf1 = io.BytesIO(); im.save(buf1, 'PNG', optimize=True)
    q = im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
    buf2 = io.BytesIO(); q.save(buf2, 'PNG', optimize=True)
    data = buf2.getvalue() if len(buf2.getvalue()) < len(buf1.getvalue()) else buf1.getvalue()
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    open(caminho, 'wb').write(data)
    return len(buf1.getvalue()), len(buf2.getvalue()), len(data)
rel = []
for i, dest, lado in MAPA:
    im = Image.open(P(i)).convert('RGBA')
    bb = bbox_alfa(im)
    M = 2
    bb = (max(0, bb[0]-M), max(0, bb[1]-M), min(im.width, bb[2]+M), min(im.height, bb[3]+M))
    c = im.crop(bb)
    if max(c.size) > lado:
        c.thumbnail((lado, lado), Image.LANCZOS)
    full, quant, final = salvar_png(c, os.path.join(DST, dest))
    rel.append(dict(origem=rows[i]['file'], idx=i, sha1=rows[i]['sha1'], bbox=bb, destino=dest, tamanho=c.size, bytes=final))
    print(f"#{i:2d} -> {dest:45s} bbox={bb} final={c.size} png={full} quant={quant} usado={final}")
# banner: sem alfa; apara faixa quase-branca se houver, reduz a 1400 de largura
im = Image.open(P(0)).convert('RGB')
px = im.load()
import numpy as np
arr = np.asarray(im).astype(int)
nb = (arr.min(axis=2) < 245)
ys = np.where(nb.any(axis=1))[0]; xs = np.where(nb.any(axis=0))[0]
bb = (int(xs[0]), int(ys[0]), int(xs[-1])+1, int(ys[-1])+1)
b = im.crop(bb); b.thumbnail((1400, 1400), Image.LANCZOS)
full, quant, final = salvar_png(b.convert('RGBA'), os.path.join(DST, 'banner/shop-banner-hero.png'))
print('banner png', bb, b.size, full, quant, final)
rel.append(dict(origem=rows[0]['file'], idx=0, sha1=rows[0]['sha1'], bbox=bb, destino='banner/shop-banner-hero.png', tamanho=b.size, bytes=final))
json.dump(rel, open('recortes.json', 'w'), indent=1, ensure_ascii=False)
