/**
 * DB/Items/nomesLocais.js
 *
 * OS NOMES QUE ESTE GRF NAO TEM — a frente aberta pelo dono em 25/08/2026
 * ("sim, pode abrir frente para nomea-los"), depois do caso do item
 * "undefined" (ver FichaDoItem.js).
 *
 * ## O que esta tabela e
 *
 * A tabela de nomes deste GRF (`data/idnum2itemdisplaynametable.txt`) tem 6.947
 * entradas, e o jogo usa itens que nao estao nelas. Sem esta tabela eles
 * aparecem como "Item desconhecido (id)" — honesto, mas nao e um nome — ou
 * como "Unknown Item", quando nem estube existe no `ItemTable.js`.
 *
 * Sao DUAS rodadas de medicao, e a lista abaixo esta separada por elas:
 *
 *  1. **os 22 que CAEM DE MOB** (25/08/2026): o cruzamento dos drops dos 112
 *     monstros do jogo contra a tabela do GRF;
 *  2. **os 14 da LOJA DE COSMETICOS** (31/08/2026): dos 22 itens que o NPC de
 *     Prontera vende (`npc/custom/ragidle/loja-de-cosmeticos.txt`), so 8 tem
 *     nome no GRF. O dono viu a vitrine com sete linhas e duas nomeadas.
 *
 * Cada nome abaixo e o campo `Name:` do item_db do rAthena, com a citacao ao
 * lado. NENHUM nome foi inventado nem traduzido: nome proprio de item fica no
 * original, como em todo o resto do projeto ("Jellopy" e Jellopy).
 *
 * **A VITRINE FICA BILINGUE, e isso e consequencia da regra, nao descuido.**
 * Os 8 nomes que o GRF tem vem da traducao oficial brasileira ("Asas da
 * Sarakura", "Mochila de Poring") e os 14 daqui saem em ingles. Traduzir os 14
 * seria inventar: **medido, nenhuma das 9 tabelas de nome de item dentro deste
 * GRF cita qualquer um dos 14** (`.tmp-scratch/varrer-nomes-de-item.ts` no
 * repositorio do jogo). Se o dono quiser a vitrine toda em portugues, e uma
 * decisao dele — e o custo e assumir traducao NOSSA nestes 14.
 *
 * ## O que ela NAO cobre, de proposito
 *
 * - A DESCRICAO: a tabela de descricao do GRF tambem nao os tem, e descricao
 *   inventada e pior que "..." — quem quiser a de verdade importa do item_db
 *   quando a frente de descricoes existir.
 * - O ICONE DOS QUE NAO TEM PROVA: ver `ICONES_LOCAIS` logo abaixo. Onde nao
 *   deu para PROVAR qual e o `.bmp`, o icone continua a maca de `unknownItem`.
 *
 * ## Como ela envelhece, e o guarda-costas
 *
 * Um item que um dia GANHAR nome no GRF vence esta tabela sozinho: o
 * `completarFicha` so consulta aqui quando a ficha chegou SEM nome, e a carga
 * do GRF escreve `identifiedDisplayName` na ficha. Ja um DROP NOVO sem nome
 * nao entra sozinho — `tests/db/nomesLocais.test.js` cruza esta lista com o
 * `conteudo.json` do jogo (quando a arvore irma existe) para os ids nunca
 * apontarem para item que o jogo nao tem.
 */

/** id -> nome de exibicao, do `Name:` do item_db do rAthena. */
export const NOMES_LOCAIS = {
	// --- Rodada 1: os 22 que CAEM DE MOB (25/08/2026) ---
	1443: 'Crimson Spear', // db/re/item_db_equip.yml:9033
	1690: 'Mysterious Foxtail Staff', // db/re/item_db_equip.yml:15587 (Amazing_Foxtail)
	1691: 'Strange God Foxtail Staff', // db/re/item_db_equip.yml:15611 (Strange_Foxtail)
	1694: 'Foxtail Model', // db/re/item_db_equip.yml:15701 (Model_Foxtail)
	1695: 'Fine Foxtail Replica', // db/re/item_db_equip.yml:15725 (Detail_Model_Foxtail)
	4545: 'Novice Poring Card', // db/re/item_db_etc.yml:10547 — o caso do dono em prt_fild08
	13127: 'Crimson Revolver', // db/re/item_db_equip.yml:63057
	15126: 'Private Doram Suits', // db/re/item_db_equip.yml:71291 (Doram_Only_Suit)
	16040: 'Crimson Mace', // db/re/item_db_equip.yml:80759 (Scarlet_Mace)
	20788: 'Private Doram Manteau', // db/re/item_db_equip.yml:112757 (Doram_Only_Cape)
	21015: 'Crimson Two-Handed Sword', // db/re/item_db_equip.yml:116752 (Scarlet_Twohand_Sword)
	22083: 'Private Doram Shoes', // db/re/item_db_equip.yml:119590 (Doram_Only_Shoes)
	23256: 'Elixir Bandages', // db/re/item_db_usable.yml:62464 (Elixir_Bandage)
	23817: 'Mysterious Combination Bundle', // db/re/item_db_usable.yml:65412 (Bs_Making_S)
	25729: 'Shadowdecon', // db/re/item_db_etc.yml:37204
	25731: 'Zelunium', // db/re/item_db_etc.yml:37220
	28007: 'Crimson Katar', // db/re/item_db_equip.yml:141086 (Scarlet_Katar)
	28382: 'Charm Grass Necklace', // db/re/item_db_equip.yml:145074 (Charm_G_Necklace)
	28604: 'Crimson Bible', // db/re/item_db_equip.yml:148119 (Scarlet_Bible)
	28705: 'Crimson Dagger', // db/re/item_db_equip.yml:149225 (Scarlet_Dagger)
	100796: 'Dark Bible', // db/re/item_db_usable.yml:70549 (Darkness_Bible)
	101331: 'Fruit Set Trap', // db/re/item_db_usable.yml:73810 (Fruits_Set_Trap)

	// --- Rodada 2: os 14 da LOJA DE COSMETICOS (31/08/2026) ---
	// Os outros 8 da loja (20504, 20507, 20511, 20727, 20746, 20761, 20764,
	// 20765) o GRF nomeia em portugues e nao entram aqui — nome do GRF vence.
	20500: 'Archangel Wing', // db/re/item_db_equip.yml:109916 (T_Archangel_Wing)
	20501: 'Costume Mechanic Wing', // db/re/item_db_equip.yml:109925 (C_Mechanic_Wing)
	20502: 'Costume Little Devil Wings', // db/re/item_db_equip.yml:109933 (C_Devil_Wing)
	20503: 'Costume Candy Pouch Bag', // db/re/item_db_equip.yml:109942 (C_Bag_Of_Antonio)
	20505: 'Costume Cupid Wing Skyblue', // db/re/item_db_equip.yml:109959 (C_Cupid_Wing_Skyblue)
	20509: 'Costume Wings of Uriel', // db/re/item_db_equip.yml:110000 (C_Wings_of_Uriel)
	20510: 'Costume Sword Wing', // db/re/item_db_equip.yml:110009 (C_SwordWing)
	20512: "Costume Adventurer's Backpack", // db/re/item_db_equip.yml:110027 (C_Bravery_Bag)
	20587: 'Wings of Light and Darkness', // db/re/item_db_equip.yml:110796 (C_Light_Darkness_Wing)
	20606: 'Costume Golden Angel Wing', // db/re/item_db_equip.yml:110964 (C_Golden_Angel_Wing)
	20737: 'Costume Kirin Wing', // db/re/item_db_equip.yml:112075 (C_Kirin_Wing)
	20762: 'Costume Great Devil Wings', // db/re/item_db_equip.yml:112312 (C_GreatDevilWing)
	20763: 'Costume Amistr Bag', // db/re/item_db_equip.yml:112321 (C_Amistr_Bag)
	400171: 'Costume Angel feather', // db/re/item_db_equip.yml:166992 (C_Angel_feather)

	// --- Rodada 3: o cosmetico de CABECA que o dono pediu (31/08/2026) ---
	// O primeiro item da loja que nao e manto. Ver D-789.
	420010: 'Costume Dark Master' // db/re/item_db_equip.yml:185600 (C_Cons_Of_Darkness)
};

/**
 * OS ICONES QUE ESTE GRF TEM E NAO SABE DE QUEM SAO (31/08/2026).
 *
 * Nome resolvido ainda deixa o item com a MACA de `unknownItem` na vitrine —
 * era metade da queixa do dono. O icone de item mora em
 * `texture/<interface>/item/<recurso>.bmp` e e indexado por
 * `data/idnum2itemresnametable.txt`, que nao tem estes 10 ids. Mas os `.bmp`
 * ESTAO no GRF: o que falta e o vinculo id -> nome de arquivo.
 *
 * ## Por que isto NAO e chute de caminho de sprite
 *
 * O cabecalho antigo deste arquivo proibia inventar caminho de sprite, e a
 * proibicao continua de pe. O que mudou e que existe uma DERIVACAO, e ela foi
 * medida antes de ser usada (`.tmp-scratch/icone-do-cosmetico.ts`, no
 * repositorio do jogo):
 *
 *   manto de costume -> `View` do item_db -> `RobeTable[View]` (o nome de
 *   pasta do sprite de manto) === o `<recurso>` do icone.
 *
 * Nos 9 itens da loja que TEM entrada na tabela de recurso do GRF, a igualdade
 * vale em 7. As 2 divergencias sao a razao de esta tabela existir com 10 e nao
 * com 13: **`View` nao e chave unica** — 20500 e 20765 dividem o `View` 1, e
 * 20606 e 20727 dividem o 5, com icones diferentes. Por isso a derivacao so
 * entra aqui quando passa nas DUAS peneiras:
 *
 *   1. o `.bmp` derivado EXISTE no GRF (conferido arquivo a arquivo);
 *   2. quem mais aponta para esse `.bmp` na tabela do GRF e da MESMA familia
 *      — o 20503 divide o icone com o 20844 ("Sacola Magica de Antonio") e o
 *      20763 com o 20706/20806 ("Mochila de Amistr"). Os outros 8 nao tem
 *      nenhum outro dono.
 *
 * **20500, 20606 e 400171 ficam de fora**: o `.bmp` derivado nao existe no
 * GRF, e a maca continua sendo a resposta honesta para eles.
 *
 * ## O 420010 nao e derivado: ele foi DESENHADO (D-789, 31/08/2026)
 *
 * O `C_Cons_Of_Darkness` entrou na loja por pedido do dono, e para ele a
 * derivacao nao serve — o GRF inteiro so tem 4 arquivos com esse nome, os 4
 * sprites. O icone dele foi GERADO do proprio sprite
 * (`tools/item-icon/proprio.ts`, no repositorio do jogo), no formato medido nos
 * icones do cliente (24x24, 8 bpp, 256 cores, magenta como vazio), e e servido
 * pela terceira fonte do servidor de assets. E a unica linha desta tabela que
 * aponta para arte NOSSA.
 *
 * ## So o icone IDENTIFICADO
 *
 * Medido nos 9: a tabela NAO-identificada (`data/num2itemresnametable.txt`)
 * manda `\xc8\xc4\xb5\xe5` (o capuz generico) para TODOS os cosmeticos — nao e o
 * icone do item, e sim o "manto qualquer" que o cliente mostra para equipamento
 * por identificar. Como a loja marca `IsIdentified = true` em tudo que vende
 * (`NpcStore.js`), o lado nao-identificado nao aparece nesta frente e fica como
 * estava.
 *
 * ## Rodada 4 (31/08/2026): os DROPS DE MOB — e a CONTRAPROVA que reabriu o veredito
 *
 * A queixa do dono desta vez era outra vitrine: a MOCHILA, com maca no lugar
 * do icone de itens dropados (o exemplo dele foi a "Crimson Bible"). Medido
 * (`.tmp-scratch/medir-universo-de-icones.ts`): de 553 ids que o jogo pode
 * ENTREGAR (drop dos 112 mobs + MVP + kit inicial + loja), **24** caem na
 * maca hoje — os 21 da Rodada 1 (mob-drop) + os 3 cosmeticos que a Rodada 2/3
 * ja tinham documentado como sem `.bmp` no GRF (20500, 20606, 400171, acima).
 *
 * Dos 21 de mob-drop, nenhum tem entrada nas 8 variantes de
 * `idnum2itemresnametable.txt`/`num2itemresnametable.txt`/`resnametable.txt`
 * deste GRF — diferente dos cosmeticos, aqui nao ha DERIVACAO por
 * `View`/`RobeTable` possivel (sao armas e nao mantos). A primeira passada
 * (`.tmp-scratch/buscar-recurso-crimson.ts`) achou 5 com `.bmp` sob o proprio
 * `AegisName` em ASCII e concluiu "os outros 16 sem arte" — **e essa conclusao
 * estava ERRADA**: a busca so testou ASCII/AegisName/palavra-chave em ingles, e
 * o icone kRO da familia Crimson/Doram e NOMEADO EM COREANO (CP949), nao pelo
 * `AegisName`. O supervisor rodou `.tmp-scratch/varrer-crimson-cp949.ts` contra
 * o GRF pelos BYTES coreanos e achou **101 arquivos** so na grafia 진홍
 * (jinhong, "carmesim/crimson") — a contraprova que este cabecalho documenta.
 *
 * ### O que a varredura CP949 confirmou (`.tmp-scratch/varrer-crimson-cp949-completo.ts`,
 * `.tmp-scratch/buscar-foxtail-doram-cp949.ts`, `.tmp-scratch/gerar-escapes-icones-locais.ts`)
 *
 * **20 dos 21 TEM `.bmp` de icone E de colecao no GRF, em coreano**, achados
 * por uma derivacao CITAVEL e conferida arquivo a arquivo nas duas pontas
 * (`item\` e `collection\`):
 *
 *   - **7 Crimson/Scarlet** (Spear/Revolver/Mace/Two-Handed Sword/Katar/
 *     Bible/Dagger): o prefixo `진홍의` (jinhong-ui, "de carmesim") + a
 *     transliteracao coreana do TIPO da arma — `스피어` Spear, `리볼버`
 *     Revolver, `메이스` Mace, `투핸드소드` Two-Handed Sword, `카타르` Katar,
 *     `바이블` Bible, `대거` Dagger. As DUAS peneiras batem: o `.bmp` existe
 *     (as duas pontas) E o nome translitera exatamente o TIPO da arma sem
 *     ambiguidade — a familia `진홍의*` tem ~30 armas (와이어 Wire, 스태프
 *     Staff, 로드 Rod, 투핸드액스 Two-Handed Axe, 세이버 Saber,
 *     랜스 Lance, 너클 Knuckle, 보우 Bow, 바이올린 Violin, 장미 Rose, etc.),
 *     uma por tipo, cada arquivo com DONO UNICO — nao e o caso do `View`
 *     compartilhado dos cosmeticos.
 *   - **3 Doram_Only_\*** (Suits/Manteau/Shoes): `도람` (doram) + o tipo de
 *     peca — `도람옷` (doram-ot, "roupa de Doram") = Suits, `도람망토`
 *     (doram-mangto, "manto de Doram") = Manteau, `도람슈즈` (doram-syujeu,
 *     "sapato de Doram", transliteracao direta) = Shoes. Sem ambiguidade: e a
 *     UNICA peca de cada tipo com `도람` no nome dentro da pasta de item.
 *   - **os 4 Foxtail** (1690/1691/1694/1695): `여우의꼬리` (yeou-ui-kkori,
 *     "cauda de raposa", `item\` e `collection\` confirmados). **Correcao de
 *     criterio (31/08/2026)**: a primeira passada reprovou este caso citando
 *     os 55 AegisNames de Foxtail que apontam pro MESMO recurso — mas a
 *     peneira 2 existe para barrar DISPUTA DE IDENTIDADE (dois itens
 *     DIFERENTES competindo por um `.bmp` que so pertence a um, o caso
 *     `View` 1 dos cosmeticos: 20500 e 20765 sao pecas DIFERENTES), nao pra
 *     proibir icone DE FAMILIA compartilhado — o precedente ja aceito e o
 *     20503, que divide o `.bmp` com o 20844 por serem a MESMA sacola. Os 55
 *     Foxtails sao TODOS bastoes Foxtail (nao ha disputa: nenhum outro TIPO
 *     de item aponta pra `여우의꼬리`), e e assim que o kRO trata a familia —
 *     toda variante de Foxtail mostra o mesmo rabo de raposa. Os nossos 4 SAO
 *     Foxtails, entao o icone deles e esse.
 *   - **4545 (Novice Poring Card)**: `이름없는카드` ("carta sem nome"), o
 *     MESMO recurso do 4001 (Poring Card oficial). **Mesma correcao**: medido
 *     que **111 das 112 cartas do elenco** (todo drop de carta do jogo)
 *     apontam pro EXATO mesmo `이름없는카드` — zero apontam pra recurso
 *     diferente (`.tmp-scratch/confirmar-familia-e-carta.ts`). Nao e 630
 *     ids brigando por identidade: e o comportamento CANONICO do RO classico,
 *     onde toda carta sem ilustracao unica usa o icone generico de carta. O
 *     4545 e uma carta como as outras 111 — recebe o mesmo por ser da MESMA
 *     familia. (A ilustracao GRANDE de carta mora noutra tabela,
 *     cardbmp/illustration, fora desta frente — o tooltip cai no icone
 *     pequeno pra cartas, e isso e esperado, nao um remendo faltando.)
 *
 * **Os 5 da primeira passada continuam** (Elixir Bandages, Shadowdecon,
 * Zelunium, Dark Bible, Fruit Set Trap — esses SIM tinham nome ASCII de
 * verdade no GRF, confirmado, nao precisam de CP949).
 *
 * **So 1 continua sem arte comprovavel**: **28382 (Charm Grass Necklace)** —
 * a pasta de colar (`목걸이`, mokgeori) tem 88 arquivos e NENHUM bate com
 * "charm"/"grass", nem em transliteracao (`차밍`) nem em traducao (`매력`,
 * `그라스`). Sem candidato — nao e questao de peneira, e ausencia real. Maca
 * documentada.
 */

/** id -> nome do `.bmp` do icone, em CP949 como toda tabela de recurso. */
export const ICONES_LOCAIS = {
	// --- Rodada 4: os 5 mob-drop com `.bmp` direto no GRF (31/08/2026) ---
	// Nome do arquivo == AegisName em ASCII minusculo, medido arquivo a
	// arquivo em `texture/<interface>/item/<nome>.bmp` E
	// `texture/<interface>/collection/<nome>.bmp` (os dois existem).
	23256: 'elixir_bandage', // Elixir_Bandage, item_db_usable.yml:62462
	25729: 'shadowdecon', // Shadowdecon, item_db_etc.yml:37202
	25731: 'zelunium', // Zelunium, item_db_etc.yml:37218
	100796: 'darkness_bible', // Darkness_Bible, item_db_usable.yml:70547
	101331: 'fruits_set_trap', // Fruits_Set_Trap, item_db_usable.yml:73808

	// --- Rodada 4b: a CONTRAPROVA em CP949 (31/08/2026) — 진홍의<tipo> ---
	// prefixo 진홍의 (jinhong-ui, "de carmesim") + a transliteracao coreana
	// do tipo da arma; item\ e collection\ conferidos arquivo a arquivo
	// (`.tmp-scratch/gerar-escapes-icones-locais.ts`).
	1443: '\xc1\xf8\xc8\xab\xc0\xc7\xbd\xba\xc7\xc7\xbe\xee', // Crimson Spear / 진홍의스피어
	13127: '\xc1\xf8\xc8\xab\xc0\xc7\xb8\xae\xba\xbc\xb9\xf6', // Crimson Revolver / 진홍의리볼버
	16040: '\xc1\xf8\xc8\xab\xc0\xc7\xb8\xde\xc0\xcc\xbd\xba', // Crimson Mace / 진홍의메이스
	21015: '\xc1\xf8\xc8\xab\xc0\xc7\xc5\xf5\xc7\xda\xb5\xe5\xbc\xd2\xb5\xe5', // Crimson Two-Handed Sword / 진홍의투핸드소드
	28007: '\xc1\xf8\xc8\xab\xc0\xc7\xc4\xab\xc5\xb8\xb8\xa3', // Crimson Katar / 진홍의카타르
	28604: '\xc1\xf8\xc8\xab\xc0\xc7\xb9\xd9\xc0\xcc\xba\xed', // Crimson Bible / 진홍의바이블
	28705: '\xc1\xf8\xc8\xab\xc0\xc7\xb4\xeb\xb0\xc5', // Crimson Dagger / 진홍의대거

	// --- Rodada 4b: os 3 Doram_Only_* (도람<peca>) ---
	15126: '\xb5\xb5\xb6\xf7\xbf\xca', // Private Doram Suits / 도람옷
	20788: '\xb5\xb5\xb6\xf7\xb8\xc1\xc5\xe4', // Private Doram Manteau / 도람망토
	22083: '\xb5\xb5\xb6\xf7\xbd\xb4\xc1\xee', // Private Doram Shoes / 도람슈즈

	// --- Rodada 4c: correcao de criterio (31/08/2026) — icone DE FAMILIA,
	// nao disputa de identidade (o precedente e o 20503/20844 abaixo).
	// Os 4 Foxtail: 여우의꼬리 ("cauda de raposa"), o MESMO recurso dos
	// outros 54 AegisNames de Foxtail no item_db — nenhum outro TIPO de item
	// aponta pra ele, entao nao ha disputa a resolver.
	1690: '\xbf\xa9\xbf\xec\xc0\xc7\xb2\xbf\xb8\xae', // Mysterious Foxtail Staff / 여우의꼬리
	1691: '\xbf\xa9\xbf\xec\xc0\xc7\xb2\xbf\xb8\xae', // Strange God Foxtail Staff / 여우의꼬리
	1694: '\xbf\xa9\xbf\xec\xc0\xc7\xb2\xbf\xb8\xae', // Foxtail Model / 여우의꼬리
	1695: '\xbf\xa9\xbf\xec\xc0\xc7\xb2\xbf\xb8\xae', // Fine Foxtail Replica / 여우의꼬리
	// O Novice Poring Card: 이름없는카드 ("carta sem nome"), o MESMO recurso
	// do 4001 (Poring Card oficial) — medido que 111 das 112 cartas do
	// elenco caem no mesmo `.bmp` generico; e o comportamento canonico do
	// RO classico pra carta sem ilustracao propria, nao uma brecha de 630.
	4545: '\xc0\xcc\xb8\xa7\xbe\xf8\xb4\xc2\xc4\xab\xb5\xe5', // Novice Poring Card / 이름없는카드

	20501: '\xb8\xde\xc4\xab\xb4\xd0\xc0\xae', // RobeTable[11]
	20502: '\xbc\xd2\xbe\xc7\xb8\xb6\xb3\xaf\xb0\xb3', // RobeTable[12]
	20503: '\xbe\xc8\xc5\xe4\xb4\xcf\xbf\xc0\xb0\xa1\xb9\xe6', // RobeTable[13] — tambem o icone do 20844
	20505: '\xc7\xcf\xb4\xc3\xbb\xf6\xc5\xa5\xc7\xc7\xc6\xae\xb3\xaf\xb0\xb3', // RobeTable[15]
	20509: '\xbf\xec\xb8\xae\xbf\xa4\xc0\xc7\xb3\xaf\xb0\xb3', // RobeTable[17]
	20510: '\xb0\xcb\xc0\xc7\xb3\xaf\xb0\xb3', // RobeTable[19]
	20587: '\xba\xfb\xb0\xfa\xbe\xee\xb5\xd2\xc0\xc7\xb3\xaf\xb0\xb3', // RobeTable[20]
	20737: '\xb1\xe2\xb8\xb0\xc0\xc7\xb3\xaf\xb0\xb3', // RobeTable[6]
	20762: '\xb4\xeb\xbe\xc7\xb8\xb6\xb3\xaf\xb0\xb3', // RobeTable[10]
	20763: '\xbe\xc6\xb9\xcc\xbd\xba\xc6\xae\xb8\xa3\xb0\xa1\xb9\xe6', // RobeTable[4] — tambem o icone do 20706/20806

	/*
	 * O UNICO QUE NAO E DERIVADO: este `.bmp` NAO EXISTE no GRF — nos o
	 * fizemos, do sprite do proprio item (D-789, 31/08/2026). Ele mora em
	 * `cliente/icones-de-item/_Cons_Of_Darkness.bmp`, no repositorio do jogo, e
	 * o servidor de assets o entrega quando o GRF nao tem (a terceira fonte de
	 * `tools/oraculo/servidor-de-assets.ts`).
	 *
	 * O nome e ASCII e com a caixa exata do `HatTable[2020]`, de proposito: o
	 * arquivo em disco e achado por comparacao de caminho, e no Linux do
	 * contêiner a caixa importa.
	 */
	420010: '_Cons_Of_Darkness'
};
