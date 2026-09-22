# Mapa dos assets da Temporada

Os arquivos originais chegaram com nome de gerador (`ChatGPT Image 22 de set. de
2026, 12_43_50 (7).png`), repetido e sem relação com o conteúdo. **Cada linha
desta tabela foi decidida ABRINDO a imagem**, nunca pelo nome, pelo índice nem
pela ordem na pasta.

Os originais continuam intactos em `Rag-idle/Passe de batalha/`. Nada foi
apagado.

## O que cada arquivo virou

| destino (`/ragidle/temporada/…`) | o que a imagem mostra | origem |
|---|---|---|
| `banner-luz-trevas.webp` | anjo à esquerda, castelo claro, eclipse e figura sombria à direita, moldura dourada, "SEASON 1 · LUZ & TREVAS · HERDEIROS DE MIDGARD" | `passe de batalha.png` |
| `banner-caixas.webp` | castelo de Midgard, bandeiras azuis, baú, cristais, moedas, Poring, "Caixas da Temporada" | `12_43_50 (5)` |
| `mascote-passe.webp` | Poring rosa com mochila e baú, pergaminho, ursinho alado em cima | `12_43_50 (2)` |
| `vip-emblema.webp` | brasão azul grande, **coroa** dourada, louros, asas laterais | `12_43_50 (3)` |
| `emblema-temporada.webp` | brasão redondo, **estrela** de quatro pontas, louros, fita azul | `12_43_50 (10)` |
| `icone-astra-blessing.webp` | emblema circular celestial, estrela grande, cristais, brilho astral | `12_43_50 (4)` |
| `icone-caixa-topo.webp` | chapéu de mago (headgear) | `12_43_50 (6)` |
| `icone-caixa-meio.webp` | óculos com asas (eyewear) | `12_43_50 (7)` |
| `icone-caixa-baixo.webp` | máscara estilizada (acessório inferior) | `12_43_50 (8)` |
| `icone-caixa-manto.webp` | capa/manto branco e dourado (garment) | `12_43_50 (9)` |
| `icone-destaques.webp` | estrela de quatro pontas / bússola celeste | `12_57_16 (1)` |
| `icone-passe-de-batalha.webp` | escudo com cristal e louros | `12_57_16 (3)` |
| `icone-vip.webp` | coroa dourada sobre azul | `12_57_16 (7)` |
| `icone-missoes-semanais.webp` | calendário com **sete** marcações | `12_57_16 (5)` |
| `icone-ro-cash.webp` | moeda dourada com cristal azul no centro | `12_57_16 (4)` |
| `icone-recarregar.webp` | setas circulares de recarga | `12_57_16 (6)` |
| `botao-fechar.webp` | disco com borda dourada e X central | `12_57_16 (8)` |
| `ornamento-divisor.webp` | ornamento horizontal, cristal azul ao centro, arabescos | `12_57_16 (9)` |
| `ornamento-canto.webp` | canto decorativo (flourish) com cristal | `12_57_16 (10)` |

## As três armadilhas que a conversão já tirou do caminho

1. **A margem morta foi APARADA, medida pixel a pixel.** Os dois banners não têm
   canal alfa e vinham com faixa branca em volta da moldura dourada; o resto
   vinha com transparência sobrando. A caixa do conteúdo é medida varrendo os
   pixels (alfa > 10, ou não-quase-branco nos banners) — o `sharp.trim()`
   embutido **não serve** porque ele elege a cor de fundo pelo pixel do canto, e
   o canto de vários destes PNG tem halo colorido do gerador.
   Exemplo: o banner Luz & Trevas foi de 724 para 692 linhas úteis.
2. **Peso.** Os 19 originais somam ~36 MB. Em WebP, no tamanho de uso ×2 (retina),
   somam **671 KB**. PNG de 2 MB não entra num cliente web.
3. **Dois candidatos para o Astra Blessing.** `12_43_50 (4)` e `12_57_16 (2)` são
   ambos emblemas circulares celestiais e os dois batem com a descrição do
   documento. Ficou o **(4)**, que é o mais legível em tamanho pequeno; o (2) é
   mais carregado e **não foi convertido** — se um dia quiserem trocar, ele está
   no original, não foi perdido.

## Duas decisões que NÃO estavam escritas no documento

- **`emblema-temporada` não é o ícone da aba.** O documento previa um brasão VIP
  (§6) e ícones de aba (§5). Sobrou um brasão grande com **estrela e fita**, sem
  coroa — não é o VIP (esse tem coroa, e é o `vip-emblema`) e é detalhado demais
  para caber num ícone de aba de 32 px. Ele virou o emblema de destaque do
  cabeçalho/página do Passe de Batalha. A decisão é de uso, não de identificação.
- **O calendário virou `icone-missoes-semanais`.** Ele foi gerado para a aba
  "Passe Semanal", que o dono mandou desativar. Como a V2 do Passe de Batalha
  tem **missões semanais** (4 blocos), o ícone atende exatamente o mesmo
  significado — sete dias marcados — e foi renomeado para o que ele passa a ser.
