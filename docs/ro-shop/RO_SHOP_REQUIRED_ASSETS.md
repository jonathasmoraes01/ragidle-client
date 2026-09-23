# RO Shop - assets necessarios (cliente, 22/09/2026)

Agente 2 (cliente/UX/assets). Fonte: `Rag-idle/Cash Shop/` (20 PNG "ChatGPT
Image ...", intactos). Identificacao, recortes e hashes em
`public/ragidle/shop/MAPA-DOS-ASSETS.md`; o processo em `docs/ro-shop/assets/`.

Status: **real** = arte final publicada; **reserva** = funciona com arte de
reserva ate a final chegar; **faltante** = nao existe arte, e a tela usa CSS
ou glifo do design system.

## 1. Por elemento de UI

| elemento | asset | formato | tamanho (arquivo / na tela) | path | status |
|---|---|---|---|---|---|
| banner hero | `shop-banner-hero.png` | PNG 256 cores | 1400x467, 252 KB / largura da area, 96-150px de altura, `object-fit: cover` | `/ragidle/shop/banner/` | real |
| placa do titulo "RO Shop" | `shop-header-ornament.png` | PNG alfa | 560x149 / 184x49 | `/ragidle/shop/ornaments/` | real (texto e HTML) |
| botao fechar | `shop-btn-close.png` | PNG alfa | 63x64 / 26px | `/ragidle/shop/buttons/` | real |
| categoria Destaques | `shop-icon-featured.png` | PNG alfa | 94x96 / 22px | `/ragidle/shop/icons/` | real |
| categoria Farm & Up | `shop-icon-farm-up.png` | PNG alfa | 96x93 / 22px | `/ragidle/shop/icons/` | real (fallback: relogio alado com seta; nao ha asa/mochila/bau no pacote) |
| categoria Pocoes | `shop-icon-potions.png` | PNG alfa | 90x96 / 22px | `/ragidle/shop/icons/` | real |
| categoria Boosts | `shop-icon-boosts.png` | PNG alfa | 96x86 / 22px | `/ragidle/shop/icons/` | real |
| categoria Utilidades | `shop-icon-utilities.png` | PNG alfa | 96x88 / 22px | `/ragidle/shop/icons/` | real (fallback: pergaminho; nao ha engrenagem) |
| categoria Conta | `shop-icon-account.png` | PNG alfa | 91x96 / 22px | `/ragidle/shop/icons/` | real |
| RO Cash (saldo, preco, total) | `shop-icon-ro-cash.png` | PNG alfa | 95x96 / 16-30px | `/ragidle/shop/icons/` | real |
| botao Recarregar | `shop-icon-recharge.png` | PNG alfa | 64x63 / 14px | `/ragidle/shop/icons/` | real |
| carrinho (painel, Adicionar, Comprar, barra do celular) | `shop-icon-cart.png` | PNG alfa | 96x79 / 18-34px | `/ragidle/shop/icons/` | real |
| carrinho vazio | `shop-empty-cart.png` | PNG alfa | 267x280 / 128px | `/ragidle/shop/states/` | real |
| retrato sem arte / grade vazia | `shop-item-placeholder.png` | PNG alfa | 118x128 / 24-64px | `/ragidle/shop/states/` | real |
| selo Novidade | `shop-badge-new.png` | PNG alfa | 47x48 / 16px | `/ragidle/shop/badges/` | real (texto e HTML) |
| selo Oferta | `shop-badge-sale.png` | PNG alfa | 48x44 / 16px | `/ragidle/shop/badges/` | real (texto e HTML) |
| selo Popular | `shop-badge-popular.png` | PNG alfa | 48x47 / 16px | `/ragidle/shop/badges/` | real (texto e HTML) |
| divisor dos totais | `shop-divider-horizontal.png` | PNG alfa | 640x133 / ate 200px | `/ragidle/shop/ornaments/` | real |
| cadeado (produto travado) | glifo `cadeado` de `UI/ri-icones.js` | SVG inline | 14px | - | faltante no pacote; glifo do design system |
| icone de info | - | - | - | `/ragidle/shop/icons/shop-icon-info.png` | faltante; a tela nao usa (os detalhes abrem pelo proprio card) |
| ticket / bau / presente | - | - | - | `/ragidle/shop/icons/shop-icon-{ticket,chest,gift}.png` | faltante; sem funcao no RO Shop hoje |
| molduras de card (normal/featured/sale/premium/disabled) | - | - | - | `/ragidle/shop/cards/` | faltante; card e CSS (fio dourado no destaque, cinza no travado) |
| botoes Adicionar/Comprar/Cancelar | - | - | - | `/ragidle/shop/buttons/` | faltante; botao e CSS com texto HTML |
| ornamento de canto | `17_14_32 (3)` recortado | PNG alfa | 96x91 | nao publicado | recortado e validado, NAO usado (ouro suficiente na tela) |

## 2. Por SKU (retrato do card)

Arte que INFORMA e o PNG do ITEM do cliente (`/ragidle/item/<id>.png`,
24x24, ampliado 2x/3x inteiro com `image-rendering: pixelated`). A janela
tenta, na ordem: `imagem.itemId` do servidor, depois cada `conteudo[].itemId`;
para cada id, o PNG publicado primeiro e o `.bmp` do GRF depois
(`iconeDoRoShop.js`), e a MACA de `unknownItem` nunca e aceita. Se nenhum
carregar, fica a reserva. Ids dos custom: os da secao 7 do CONTRATO.md do
servidor (branch feat/ro-shop do rag-idle-master).

**Rodada 3 (22/09/2026), achado A-01 da QA independente.** No cliente real os
11 SKUs de item mostravam a maca no card, nos detalhes, no carrinho, na
mochila e no aviso "obtido(s)": a guarda do RO Shop comparava a ficha com
`unknownItem` por IDENTIDADE, e `completarFicha` devolve uma COPIA batizada
(com o recurso da maca) para os ids de `NOMES_LOCAIS`. Agora: (a) a guarda e
pelo campo (`temIconeProprio`, `DB/Items/FichaDoItem.js`); (b) os 11 ids tem
uma RESERVA DECLARADA em `ICONES_LOCAIS` (`DB/Items/nomesLocais.js`, Rodada
9b): o `.bmp` do conteudo ou do item oficial de mesmo efeito, cada um LIDO em
`data\idnum2itemresnametable.txt` do `data.grf` com o arquivo conferido. A
mochila, o aviso de obtido (que passou a pedir o PNG publicado primeiro, como
a mochila) e o RO Shop mostram essa reserva ate o PNG oficial existir; quando
ele for publicado, vence sozinho nos quatro lugares.

| SKU | asset esperado | formato | tamanho | path esperado | status hoje |
|---|---|---|---|---|---|
| POTION_BLUE_1000 | icone do Pack Pocao Azul (9000103) | PNG alfa | 24x24 | `/ragidle/item/9000103.png` | faltante; reserva Pocao Azul (505, `.bmp` do GRF) |
| POTION_WHITE_500 | icone do Pack Pocao Branca (9000104) | PNG alfa | 24x24 | `/ragidle/item/9000104.png` | faltante; reserva Pocao Branca (504) |
| POTION_SURVIVAL_PACK | icone do Pack Sobrevivencia (9000105) | PNG alfa | 24x24 | `/ragidle/item/9000105.png` | faltante; reserva Pocao Azul (505) |
| BOOST_EXP_1H | icone do Manual de EXP (9000100) | PNG alfa | 24x24 | `/ragidle/item/9000100.png` | faltante; reserva Manual de Combate (12208) |
| BOOST_JOB_1H | icone do Manual de Job (9000101) | PNG alfa | 24x24 | `/ragidle/item/9000101.png` | faltante; reserva Manual de Combate de Classe (14592, o mesmo `.bmp`) |
| BOOST_DROP_1H | icone da Bencao da Fortuna (9000102) | PNG alfa | 24x24 | `/ragidle/item/9000102.png` | faltante; reserva Goma de Mascar (12210, o item de drop do kRO) |
| BOOST_TRAINING_PACK | icone do Pack de Treino (9000110) | PNG alfa | 24x24 | `/ragidle/item/9000110.png` | faltante; reserva Manual de Combate (12208) |
| TRAVEL_PACK | icone do Pack Viagem (9000106) | PNG alfa | 24x24 | `/ragidle/item/9000106.png` | faltante; reserva Asa de Mosca (601) |
| FARM_PACK | icone do Pack Farm (9000107) | PNG alfa | 24x24 | `/ragidle/item/9000107.png` | faltante; reserva Pocao Branca (504) |
| LEVELING_PACK | icone do Pack Up (9000108) | PNG alfa | 24x24 | `/ragidle/item/9000108.png` | faltante; reserva Pocao Branca (504) |
| COMPLETE_FARM_PACK | icone do Pack Completo de Farm (9000109) | PNG alfa | 24x24 | `/ragidle/item/9000109.png` | faltante; reserva Pocao Branca (504) |

No arnes de foto (sem GRF) a reserva do GRF nao existe: o card cai no PNG
publicado do conteudo (505/504/601/602) ou, nos boosts, no
`shop-item-placeholder`.

### Servicos e conta (rodada 3, achado A-09)

O servidor manda `imagem: null` e `conteudo: []` para os 7 (CONTRATO.md secao
4). A reserva era o icone da CATEGORIA, e os 5 de Conta saiam todos com o
mesmo escudo e espada (os 2 de Utilidades, com o mesmo pergaminho). O pacote
do dono nao tem mais icone de servico (os 20 originais estao no
`MAPA-DOS-ASSETS.md`: nao ha livro, espelho, bau nem sacola), entao cada um
usa um icone de item do `data.grf` JA PUBLICADO em `public/ragidle/item/`,
escolhido olhando a arte numa folha de contato (nenhuma arte nova). E so arte:
o id fica no cliente (`ICONE_DO_SERVICO`, `formatoDoRoShop.js`), nunca vai ao
servidor, e o texto do card continua o do produto. Se o PNG falhar, volta a
reserva da categoria.

| SKU | icone (id do item) | path | por que |
|---|---|---|---|
| SERVICE_SKILL_RESET | Livro (1550) | `/ragidle/item/1550.png` | o livro de habilidades |
| SERVICE_STAT_RESET | Pedra do Sabio (12040) | `/ragidle/item/12040.png` | a joia dos atributos, distinta do livro |
| SERVICE_RENAME | Marca-Pagina (7015) | `/ragidle/item/7015.png` | a pena de escrever o nome |
| SERVICE_APPEARANCE_CHANGE | Espelho de Mao (12368) | `/ragidle/item/12368.png` | a aparencia no espelho |
| ACCOUNT_CHARACTER_SLOT | Boneca de Marionete (5141) | `/ragidle/item/5141.png` | mais um personagem |
| ACCOUNT_INVENTORY_10 | Sacola de Biscoitos (12130) | `/ragidle/item/12130.png` | a sacola de carga (a Mochila de Poring ficou de fora: e um visual vendido na loja de cosmeticos) |
| ACCOUNT_STORAGE_100 | Velha Caixa Azul (603) | `/ragidle/item/603.png` | o bau do armazem |

Se o dono quiser arte propria para os 7, o caminho e o mesmo dos outros
icones do pacote: PNG alfa em `public/ragidle/shop/icons/`, e a tabela
`ICONE_DO_SERVICO` troca de item id para caminho.

O icone dos custom e publicado pelo pipeline do SERVIDOR
(`scripts/publicar-icones-de-item.ts` em rag-idle-master, passo pos-merge
B-RS-08), por id, em `public/ragidle/item/<id>.png` deste repositorio. Quando
ele rodar, o card troca sozinho: nenhuma linha da janela muda. Enquanto nao, a
prova de tela conta os pedidos 404 `/ragidle/item/9000xxx.png` por largura,
esperados e listados no `relatorio.json`.

## 3. O que NAO e asset (de proposito)

Texto, preco, saldo, quantidade e selo sao sempre HTML com o dado do servidor.
Nenhum texto de interface vem rasterizado de imagem; o unico texto pintado e o
do banner ("Mais aventuras para a sua historia!"), que e promocional e tem
`aria-label` equivalente.
