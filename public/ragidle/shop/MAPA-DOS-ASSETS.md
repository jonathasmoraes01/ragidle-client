# Mapa dos assets do RO Shop

Os 20 originais chegaram com nome de gerador (`ChatGPT Image 22 de set. de
2026, 17_07_44.png` e 19 irmaos) em `Rag-idle/Cash Shop/`. **Cada linha abaixo
foi decidida ABRINDO a imagem** (folha de contato + zoom), nunca pelo nome.
Os originais continuam intactos la; nada foi apagado nem movido.

Nenhum dos 20 e sprite sheet e nenhum e mockup de tela: sao 17 icones e
ornamentos individuais com alfa, 2 faixas largas com alfa e 1 banner sem alfa.
Por isso nao houve recorte de sheet: cada arquivo foi APARADO pela caixa do
alfa (alfa > 10, margem de 2px), reduzido ao tamanho de uso x2 (retina) e
quantizado a 256 cores com alfa. Total publicado: ~379 KB em 18 arquivos (os
20 originais somam ~27 MB; o banner caiu de 2,4 MB para 252 KB). O processo inteiro e reprodutivel: `docs/ro-shop/assets/inventario.py`
(caminho, dimensoes, peso, sha1 e a folha de contato `folha-de-contato-dos-originais.jpg`, que mostra
a transparencia em magenta) e `docs/ro-shop/assets/processar.py` (a caixa de
cada recorte fica em `recortes.json`).

| destino | o que a imagem mostra | origem (sha1) | px |
|---|---|---|---|
| `banner/shop-banner-hero.png` | Poring rosa alado, moedas "Z", portao RAGNAROK, castelo, bandeiras azuis, placa "Boas compras"; texto pintado "Mais aventuras para a sua historia! / Itens especiais te esperam no RO Shop!" | `17_07_44` (2c1109d4) | 1400x467, 252 KB |
| `icons/shop-icon-featured.png` | estrela dourada de quatro pontas sobre disco azul | `17_08_01 (2)` (2259ecfd) | 94x96 |
| `icons/shop-icon-farm-up.png` | relogio alado com seta dourada subindo | `17_08_01 (5)` (f21f1854) | 96x93 |
| `icons/shop-icon-potions.png` | frasco de pocao azul com alcas douradas | `17_08_02 (8)` (9da74b98) | 90x96 |
| `icons/shop-icon-boosts.png` | chama azul em moldura alada | `17_08_01 (3)` (1f49b35e) | 96x86 |
| `icons/shop-icon-utilities.png` | pergaminho com rosa-dos-ventos e pena | `17_08_02 (7)` (d2fd0886) | 96x88 |
| `icons/shop-icon-account.png` | escudo azul com flor-de-lis e espada | `17_08_02 (6)` (6db60670) | 91x96 |
| `icons/shop-icon-ro-cash.png` | moeda dourada com estrela/cristal azul | `17_14_33 (5)` (4e0eeb24) | 95x96 |
| `icons/shop-icon-recharge.png` | seta circular dourada sobre disco azul | `17_14_33 (4)` (af909f74) | 64x63 |
| `icons/shop-icon-cart.png` | carrinho branco e dourado com asas | `17_08_02 (9)` (66740b44) | 96x79 |
| `buttons/shop-btn-close.png` | disco marfim com aro dourado e X | `17_14_32 (1)` (7138a00c) | 63x64 |
| `states/shop-empty-cart.png` | Poring branco alado dentro de um carrinho | `17_08_02 (10)` (6f01a577) | 267x280 |
| `states/shop-item-placeholder.png` | moldura dourada vazia com "?" | `17_14_33 (7)` (7dbbd400) | 118x128 |
| `badges/shop-badge-new.png` | estrela azul em brasao com laco | `17_14_34 (10)` (90b9bc37) | 47x48 |
| `badges/shop-badge-sale.png` | etiqueta azul com "%" e asas | `17_08_01 (4)` (ddf29880) | 48x44 |
| `badges/shop-badge-popular.png` | coroa sobre estrela, asas e chamas azuis | `17_14_33 (8)` (b014026f) | 48x47 |
| `ornaments/shop-divider-horizontal.png` | divisor dourado fino com cristal azul central | `17_14_32 (2)` (0281603e) | 640x133 |
| `ornaments/shop-header-ornament.png` | placa azul com moldura e brasao dourados | `17_14_33 (6)` (5a0c5817) | 560x149 |

## Recortado e NAO usado (nao publicado)

- `17_14_32 (3)` (64d7f467): ornamento de canto (flourish). Foi aparado e
  validado, mas a janela ja tem ouro suficiente (placa do titulo, divisor, fio
  dos cards de destaque); o prompt manda copiar so o que e usado, entao o
  arquivo saiu de `ornaments/`. Esta no original.
- `17_14_34 (9)` (bf0dfac7): medalhao com "%", asas e fita. E o segundo
  candidato de "Oferta"; ficou a ETIQUETA (`17_08_01 (4)`), que le melhor em
  16px.

## Decisoes que o documento nao cravava

- **Farm & Up usa o relogio alado com seta subindo.** Nao ha asa de mosca,
  mochila nem bau no pacote; o relogio com a seta de progressao e o unico que
  diz "tempo de farm e subir de nivel". Fallback documentado.
- **Utilidades usa o pergaminho.** Nao ha engrenagem nem ferramenta; o
  pergaminho com pena e o simbolo de "servico" (os resets e a troca de nome
  sao documentos, no vocabulario do jogo).
- **Selos: a arte e SO o icone.** Nenhum dos tres traz texto; a palavra
  (Novidade/Oferta/Popular) e HTML ao lado, e o selo so aparece quando o
  servidor manda `produto.selo`.
- **A placa do titulo e fundo, nao texto.** "RO Shop" continua HTML em
  serifa; a faixa azul da placa fica em ~59% da altura, e o texto desce 4px
  para morar nela.
- **Faltam no pacote** (fallback em uso): icone de info (sem uso na tela),
  cadeado (glifo `cadeado` do design system), ticket, bau e presente (sem
  funcao no RO Shop), molduras de card e assets de botao (card e botao sao
  CSS, como o prompt permite).
