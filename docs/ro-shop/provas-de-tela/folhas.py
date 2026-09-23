"""
As FOLHAS DE CONTATO das provas de tela do RO Shop (rodada 2, 22/09/2026).

    python docs/ro-shop/provas-de-tela/folhas.py

Os PNG completos ficam fora do git (.gitignore desta pasta); o que viaja e o
relatorio.json de cada prova e estas folhas em JPEG, uma miniatura por foto,
com o nome do arquivo embaixo. Rode DEPOIS dos tres arneses:

    node scripts/foto-ro-shop.mjs
    node scripts/foto-selecao-de-personagem.mjs
    node scripts/foto-temporada-modais.mjs
"""

from pathlib import Path

from PIL import Image, ImageDraw

AQUI = Path(__file__).resolve().parent


def folha(fotos, destino, largura_miniatura=300, colunas=4):
    fotos = [f for f in fotos if f.exists()]
    if not fotos:
        print(f"sem fotos para {destino.name}")
        return
    miniaturas = []
    for f in fotos:
        im = Image.open(f).convert("RGB")
        escala = largura_miniatura / im.width
        miniaturas.append((f.name, im.resize((largura_miniatura, max(1, int(im.height * escala))))))
    altura_linha = max(m.height for _, m in miniaturas) + 22
    linhas = (len(miniaturas) + colunas - 1) // colunas
    tela = Image.new("RGB", (colunas * (largura_miniatura + 8) + 8, linhas * altura_linha + 8), (24, 32, 44))
    desenho = ImageDraw.Draw(tela)
    for i, (nome, m) in enumerate(miniaturas):
        x = 8 + (i % colunas) * (largura_miniatura + 8)
        y = 8 + (i // colunas) * altura_linha
        tela.paste(m, (x, y))
        desenho.text((x, y + m.height + 4), nome, fill=(230, 230, 230))
    tela.save(destino, "JPEG", quality=72, optimize=True)
    print(f"{destino.relative_to(AQUI)}: {len(miniaturas)} fotos")


def principal():
    for largura in ("0390", "1440"):
        fotos = sorted(p for p in AQUI.glob(f"{largura}-*.png") if p.name[5:7] in {"18", "19", "20", "21", "22", "23", "24", "25"})
        folha(fotos, AQUI / f"folha-rodada2-{largura}.jpg", largura_miniatura=260 if largura == "0390" else 360, colunas=5 if largura == "0390" else 3)
    selecao = AQUI / "selecao"
    folha(sorted(selecao.glob("*.png")), selecao / "folha-selecao.jpg", largura_miniatura=260, colunas=5)
    temporada = AQUI / "temporada"
    folha(sorted(p for p in temporada.glob("*-antes.png") if "destaques" not in p.name), temporada / "folha-antes.jpg", largura_miniatura=240, colunas=3)
    folha(sorted(p for p in temporada.glob("*-depois.png") if "destaques" not in p.name), temporada / "folha-depois.jpg", largura_miniatura=240, colunas=3)
    # Rodada 3 (22/09/2026): os estados que a QA apontou, em todas as larguras
    # que os tem, e os Destaques da Temporada no master, antes e depois.
    rodada3 = ("01-", "01b", "02b", "14-", "16-", "18-", "18b", "26-", "27-")
    fotos3 = sorted(p for p in AQUI.glob("*.png") if p.name[5:8] in rodada3)
    folha([p for p in fotos3 if p.name[:4] in {"0360", "0390", "0430"}], AQUI / "folha-rodada3-celular.jpg", largura_miniatura=220, colunas=6)
    folha([p for p in fotos3 if p.name[:4] in {"0768", "1024", "1440", "1920"}], AQUI / "folha-rodada3-desktop.jpg", largura_miniatura=360, colunas=4)
    folha(sorted(temporada.glob("*-destaques-*.png")), temporada / "folha-destaques-master-antes-depois.jpg", largura_miniatura=220, colunas=4)


if __name__ == "__main__":
    principal()
