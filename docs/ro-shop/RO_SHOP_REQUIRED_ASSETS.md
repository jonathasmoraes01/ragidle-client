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
se nenhum carregar, fica a reserva. Servico/conta sem item mostra o icone da
categoria. Ids dos custom: os da secao 7 do CONTRATO.md do servidor (commit
`bddee780`, branch feat/ro-shop do rag-idle-master). O contrato registra que o
cliente precisa de nome, descricao e icone para 9000102-9000110 na tabela de
itens; os Manuais 9000100/9000101 ja existiam no servidor, mas tambem nao tem
PNG publicado no cliente hoje.

| SKU | asset esperado | formato | tamanho | path esperado | status hoje |
|---|---|---|---|---|---|
| POTION_BLUE_1000 | icone do Pack Pocao Azul (9000103) | PNG alfa | 24x24 | `/ragidle/item/9000103.png` | faltante; mostra Pocao Azul (505) real |
| POTION_WHITE_500 | icone do Pack Pocao Branca (9000104) | PNG alfa | 24x24 | `/ragidle/item/9000104.png` | faltante; mostra Pocao Branca (504) real |
| POTION_SURVIVAL_PACK | icone do Pack Sobrevivencia (9000105) | PNG alfa | 24x24 | `/ragidle/item/9000105.png` | faltante; mostra Pocao Azul (505) real |
| BOOST_EXP_1H | icone do Manual de EXP (9000100) | PNG alfa | 24x24 | `/ragidle/item/9000100.png` | faltante; mostra `shop-item-placeholder` |
| BOOST_JOB_1H | icone do Manual de Job (9000101) | PNG alfa | 24x24 | `/ragidle/item/9000101.png` | faltante; placeholder |
| BOOST_DROP_1H | icone da Bencao da Fortuna (9000102) | PNG alfa | 24x24 | `/ragidle/item/9000102.png` | faltante; placeholder |
| BOOST_TRAINING_PACK | icone do Pack de Treino (9000110) | PNG alfa | 24x24 | `/ragidle/item/9000110.png` | faltante; placeholder (conteudo tambem e custom) |
| SERVICE_SKILL_RESET | - (servico) | - | - | - | reserva: icone de Utilidades |
| SERVICE_STAT_RESET | - (servico) | - | - | - | reserva: icone de Utilidades |
| SERVICE_RENAME | - (servico) | - | - | - | reserva: icone de Conta |
| SERVICE_APPEARANCE_CHANGE | - (servico) | - | - | - | reserva: icone de Conta |
| ACCOUNT_CHARACTER_SLOT | - (conta) | - | - | - | reserva: icone de Conta |
| ACCOUNT_INVENTORY_10 | - (conta) | - | - | - | reserva: icone de Conta |
| ACCOUNT_STORAGE_100 | - (conta) | - | - | - | reserva: icone de Conta |
| TRAVEL_PACK | icone do Pack Viagem (9000106) | PNG alfa | 24x24 | `/ragidle/item/9000106.png` | faltante; mostra Asa de Mosca (601) real |
| FARM_PACK | icone do Pack Farm (9000107) | PNG alfa | 24x24 | `/ragidle/item/9000107.png` | faltante; mostra Pocao Branca (504) real |
| LEVELING_PACK | icone do Pack Up (9000108) | PNG alfa | 24x24 | `/ragidle/item/9000108.png` | faltante; mostra Pocao Branca (504) real |
| COMPLETE_FARM_PACK | icone do Pack Completo de Farm (9000109) | PNG alfa | 24x24 | `/ragidle/item/9000109.png` | faltante; mostra Pocao Branca (504) real |

O icone dos custom e publicado pelo pipeline do SERVIDOR
(`scripts/publicar-icones-de-item.ts` em rag-idle-master), por id, em
`public/ragidle/item/<id>.png` deste repositorio. Quando o Agente 1 fechar os
ids e a arte (ou o `.bmp` no GRF), o card troca sozinho: nenhuma linha da
janela muda. Enquanto nao, a prova de tela conta 9-10 pedidos 404 por largura
(`/ragidle/item/9000xxx.png`), esperados e listados no `relatorio.json`.

## 3. O que NAO e asset (de proposito)

Texto, preco, saldo, quantidade e selo sao sempre HTML com o dado do servidor.
Nenhum texto de interface vem rasterizado de imagem; o unico texto pintado e o
do banner ("Mais aventuras para a sua historia!"), que e promocional e tem
`aria-label` equivalente.
