"""Recorta o MEDALHAO de um botao (a arte com a pilula de texto embaixo) e reconstroi o fundo do disco.

O dono desenhou os botoes com o rotulo dentro da imagem ("Cacar", "Voltar", "Auto - ON/OFF"). O rotulo fica
como texto de verdade no jogo (estado, idioma, leitor de tela), entao so o medalhao e usado: a pilula sai, e o
pedaco do disco que ela cobria e reconstruido espelhando o disco pelo centro (o aro e circular), so dentro do
circulo. Depois a imagem e enquadrada num quadrado centrado no disco, com folga para as gemas do aro.
"""
import sys, math
from PIL import Image

def processar(origem, destino, tamanho=256):
    im = Image.open(origem).convert('RGBA')
    W, H = im.size
    px = im.load()
    def bordas(y):
        xs = [x for x in range(W) if px[x, y][3] > 128]
        return (xs[0], xs[-1]) if xs else None
    linhas = {y: bordas(y) for y in range(H)}
    # o disco: a linha mais larga na metade de cima ate 70% da altura
    melhor = max((y for y in range(int(H * 0.7)) if linhas[y]), key=lambda y: linhas[y][1] - linhas[y][0])
    x0, x1 = linhas[melhor]
    cx, cy, r = (x0 + x1) / 2, melhor, (x1 - x0) / 2
    # a pilula comeca onde a silhueta para de estreitar: abaixo do centro a largura do disco so diminui, e a
    # pilula (mais larga que a corda naquela altura) faz ela voltar a crescer. O corte e a linha mais estreita
    # entre um quarto do raio abaixo do centro e o fundo do disco - o brilho do aro nao muda esse minimo.
    larguras = {y: (linhas[y][1] - linhas[y][0]) for y in range(int(cy + 0.25 * r), min(int(cy + r), H - 1)) if linhas[y]}
    # 14 linhas acima do mais estreito: a borda dourada da pilula comeca antes do ponto mais estreito
    corte = min(larguras, key=lambda y: larguras[y]) - 14
    novo = im.copy()
    pn = novo.load()
    # a emenda: 16 linhas de transicao entre o original e o espelhado, para nao sobrar um risco no disco
    transicao = 16
    for y in range(corte - transicao, H):
        t = min(1.0, max(0.0, (y - (corte - transicao)) / transicao))
        ys = int(round(2 * cy - y))
        for x in range(W):
            dentro = (x - cx) ** 2 + (y - cy) ** 2 <= (r - 1) ** 2
            espelho = px[x, ys] if dentro and 0 <= ys < H else (0, 0, 0, 0)
            if y >= corte:
                pn[x, y] = espelho
            elif dentro:
                o = px[x, y]
                pn[x, y] = tuple(int(round(o[i] * (1 - t) + espelho[i] * t)) for i in range(4))
    # quadrado centrado no disco, com folga para a gema de cima (e as faiscas)
    topo = min(y for y in range(H) if linhas[y])
    meio_lado = max(r * 1.1, cy - topo + 4)
    caixa = (int(cx - meio_lado), int(cy - meio_lado), int(cx + meio_lado), int(cy + meio_lado))
    quadro = Image.new('RGBA', (caixa[2] - caixa[0], caixa[3] - caixa[1]), (0, 0, 0, 0))
    quadro.paste(novo.crop((max(caixa[0], 0), max(caixa[1], 0), min(caixa[2], W), min(caixa[3], H))),
                 (max(-caixa[0], 0), max(-caixa[1], 0)))
    proporcao_do_disco = (2 * r) / quadro.size[0]
    quadro.resize((tamanho, tamanho), Image.LANCZOS).save(destino, 'WEBP', quality=90, method=6)
    return {'centro': (cx, cy), 'raio': r, 'corte': corte, 'disco_no_quadro': round(proporcao_do_disco, 3)}

if __name__ == '__main__':
    print(processar(sys.argv[1], sys.argv[2]))
