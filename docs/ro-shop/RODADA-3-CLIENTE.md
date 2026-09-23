# RO Shop, rodada 3 - o cliente (Agente 2, 22/09/2026)

Os achados da QA independente do cliente, corrigidos na branch `feat/ro-shop`
(worktree `ragidle-client/.claude/worktrees/ro-shop`). Contrato lido:
`docs/ro-shop/CONTRATO.md` do servidor, commit **06e5e71c**. Nenhum campo novo
de contrato foi inventado.

## O que mudou, por achado

| achado | onde | o que |
|---|---|---|
| **A-01 (P1)** maca nos 11 SKUs de item | `DB/Items/FichaDoItem.js` (`temIconeProprio`), `UI/Components/RoShop/iconeDoRoShop.js` (novo), `RoShop.js` | a guarda do icone era `info === unknownItem` (IDENTIDADE), e `completarFicha` devolve uma COPIA batizada de `unknownItem` para os ids de `NOMES_LOCAIS`: nunca disparava. Agora a pergunta e pelo CAMPO do recurso; o resolvedor saiu para um modulo com dependencias injetadas, testavel com a ficha de verdade |
| A-01 mochila e aviso de obtido | `DB/Items/nomesLocais.js` (`ICONES_LOCAIS`, Rodada 9b), `UI/Components/ItemObtain/ItemObtain.js` | os 11 ids ganharam uma RESERVA DECLARADA do `data.grf`: Pocao Azul (505) para 9000103/105, Pocao Branca (504) para 9000104/107/108/109, Asa de Mosca (601) para 9000106, Manual de Combate (12208/14592, o mesmo `.bmp`) para 9000100/101/110, Goma de Mascar (12210) para 9000102. Cada recurso foi LIDO em `data\idnum2itemresnametable.txt` com o `.bmp` conferido. O aviso de obtido passou a pedir o PNG publicado primeiro, como a mochila: quando o pipeline pos-merge do servidor (B-RS-08) publicar `public/ragidle/item/<id>.png`, o PNG oficial vence na mochila, no boneco, no RO Shop e no aviso |
| **A-02 (P2)** mutante F8 nao aplicava | `scripts/mutantes-ro-shop-rodada2.mjs` | o trecho agora casa as tres linhas do ternario. Errata registrada em `RODADA-2-CLIENTE.md` (o placar real da rodada 2 era 28/29) |
| **A-03 (P1)** Destaques da Temporada em 390 | `TemporadaIdle.css` (`.te-chamada-passe { flex-shrink: 0 }`) | **anterior ao RO Shop**: medido IGUAL no master do cliente (72bf04d6, checkout principal, so leitura). O card e filho de uma coluna flex que rola, e a regra tatil `min-height: var(--hit-touch)` troca o piso automatico (o conteudo) por 44px: o card encolhia a 44px (114px em 430) e o conteudo descia 138px por cima de Caixa Topo e Caixa Meio |
| **A-04 (P2)** banner so com o nome | `formatoDoRoShop.js` (`rotuloDaTemporada`, `atalhoTemporadaHtml`), `RoShop.css` | o servidor MANDA o numero: `temporada.id = "S1"` (contrato secao 4, "o banner 'Season 1 - Luz & Trevas' monta daqui"). "Season N" sai do id `S<n>` (a mesma leitura do banner da janela da Temporada); id fora do formato mostra so o nome, nunca um "Season 1" cravado. Caixa alta por CSS. O fixture dos testes passou a ser fiel ao contrato (`{ id: 'S1', nome: 'Luz & Trevas' }`) |
| **A-05 (P2)** janela fixa e letra de 9-11px | `RoShop.css`, `RoShop.js` | em tela de 1360 x 860 ou mais a janela vai a 1200 x 800 (painel de 320) e a letra sobe (selo 11, rotulo 12, texto 13; menor fonte medida 11px em 1440 e 1920). Abaixo disso nada muda de tamanho (1024: 1008 x 700; 768: 752 x 700). Em toda largura o selo "SEU SALDO/RO CASH" sobe de 9 para 10px e o "cada" do carrinho de 10 para 11px. Sem `zoom`: a arte do item e pixel art ampliada inteira. A HUD do jogo continua fixa (`--ui-escala` 1 no desktop): so esta janela cresce. Sem posicao guardada, a janela nasce no centro pelo tamanho real |
| **A-06 (P2)** categoria ativa fora da vista | `controladorDoRoShop.js` (`mostrarCategoriaAtiva`), `formatoDoRoShop.js` (`deslocamentoParaMostrar`) | a fita rola SO na horizontal (`scrollLeft`, nunca `scrollIntoView`, que rolaria a area principal) e so quando a categoria muda ou a janela reabre; um redesenho qualquer nao puxa de volta a fita que o jogador rolou |
| **A-07 (P2)** gaveta aberta com a barra embaixo, aviso por cima do Comprar | `RoShop.css` | com a gaveta aberta a barra "Carrinho / Ver carrinho" sai e a gaveta desce ate a borda (com a borda segura do aparelho); o aviso sobe para o alto da janela, por cima do veu. No desktop o aviso se centra na AREA PRINCIPAL (descontando o painel), e nao na janela |
| **A-08 (P2)** paginacao no erro | `controladorDoRoShop.js` | carregando e erro nao desenham paginacao (nem titulo) |
| **A-09 (P2)** 7 servicos com o mesmo icone | `formatoDoRoShop.js` (`ICONE_DO_SERVICO`), `RO_SHOP_REQUIRED_ASSETS.md` secao 2 | um icone de item do `data.grf` ja publicado por SKU (Livro, Pedra do Sabio, Marca-Pagina, Espelho de Mao, Boneca de Marionete, Sacola de Biscoitos, Velha Caixa Azul), escolhidos numa folha de contato; nenhuma arte nova. E so arte (o id nunca vai ao servidor); falhando, volta o icone da categoria |

## Prova

- `tests/ui/roShopRodada3.test.js` (novo): a guarda por campo com a ficha DE
  VERDADE (a copia batizada de `unknownItem` e recusada e o `.bmp` dela nunca e
  pedido), os 11 recursos de reserva, o PNG publicado vencendo, a janela
  inteira sem nenhum pedido da maca, e um teste por achado.
  `tests/db/nomesLocais.test.js`: a contagem de `ICONES_LOCAIS` foi de 15 para
  26, com o motivo.
- `node scripts/mutantes-ro-shop-rodada3.mjs`: **19/19 mortos** (guarda por
  identidade, reserva apagada, aviso de obtido so no GRF, "Season 1" cravado,
  fita sem rolar ou puxada a cada redesenho, barra visivel com a gaveta, aviso
  no rodape, paginacao no erro, servico sem icone, dois servicos no mesmo
  icone, janela grande em 1040, selo em 9px, a chamada do Passe encolhendo).
- `node scripts/mutantes-ro-shop-rodada2.mjs`: **29/29 mortos**, agora com o F8
  aplicado e morto.
- `node scripts/foto-ro-shop.mjs` (porta 7361): PASSOU nas 7 larguras. O
  arnes agora usa o resolvedor de verdade com a ficha de verdade e um "GRF"
  falso que devolve a MACA (512) se ela for pedida; a medida reprova se isso
  acontecer, se houver paginacao fora do estado pronto, barra visivel com a
  gaveta aberta, aviso por cima de Comprar/Confirmar/barra ou chip ativa fora
  da fita. Estados novos: `02b-aviso-depois-de-adicionar` (todas as larguras),
  `26-no-limite` e `27-pressionado` (390 e 1440); o teto atingido continua em
  `07`/`18b` (Armazem 10 de 10). Folhas: `provas-de-tela/folha-rodada3-celular.jpg`
  e `folha-rodada3-desktop.jpg`.
- `node scripts/foto-temporada-destaques.mjs` (porta 7364, novo): master
  (`RAG_RAIZ` no checkout principal) e branch antes do conserto REPROVAM
  iguais (44px/138px em 360 e 390, 114px/52px em 430); depois PASSA (194px em
  360/390, 176px em 430) e 1440 nao muda um pixel de geometria (86px, as cinco
  caixas nas mesmas posicoes). Folha:
  `provas-de-tela/temporada/folha-destaques-master-antes-depois.jpg`.

## O que ficou de fora

- O `.bmp` de reserva dos boosts (Manual de Combate, Goma de Mascar) so aparece
  no jogo real: o arnes nao tem GRF e esses dois nao tem PNG publicado, entao
  na foto os boosts ficam no `shop-item-placeholder`.
- Outras janelas que desenham icone so pelo GRF (barra de atalhos, ficha do
  item, armazem) mostram a reserva e nao o PNG oficial ate o GRF conhecer o id;
  a mochila, o boneco, o RO Shop, a Temporada e o aviso de obtido ja pedem o
  PNG publicado primeiro.
- Ponta a ponta contra o servidor real: e prova de pilha (Agente 3).
