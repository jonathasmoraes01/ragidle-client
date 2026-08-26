/**
 * DB/Items/nomesLocais.js
 *
 * OS NOMES QUE ESTE GRF NAO TEM — a frente aberta pelo dono em 25/08/2026
 * ("sim, pode abrir frente para nomea-los"), depois do caso do item
 * "undefined" (ver FichaDoItem.js).
 *
 * ## O que esta tabela e
 *
 * Cruzando os drops dos 112 monstros do jogo contra a tabela de nomes do GRF
 * deste cliente (`data/idnum2itemdisplaynametable.txt`), 22 ids podem cair de
 * mob e nao tem nome nenhum do lado do cliente. Sem esta tabela eles aparecem
 * como "Item desconhecido (id)" — honesto, mas nao e um nome.
 *
 * Cada nome abaixo e o campo `Name:` do item_db do rAthena, com a citacao ao
 * lado. NENHUM nome foi inventado nem traduzido: nome proprio de item fica no
 * original, como em todo o resto do projeto ("Jellopy" e Jellopy).
 *
 * ## O que ela NAO cobre, de proposito
 *
 * - O ICONE: os sprites destes 22 nao existem neste GRF (conferido na rodada
 *   que achou os 22). O icone continua o de sobra do cliente (a maca de
 *   `unknownItem`) — inventar caminho de sprite so trocaria "sem icone" por
 *   um erro de carga no console.
 * - A DESCRICAO: a tabela de descricao do GRF tambem nao os tem, e descricao
 *   inventada e pior que "..." — quem quiser a de verdade importa do item_db
 *   quando a frente de descricoes existir.
 *
 * ## Como ela envelhece, e o guarda-costas
 *
 * Um item que um dia GANHAR nome no GRF vence esta tabela sozinho: o
 * `completarFicha` so consulta aqui quando a ficha chegou SEM nome, e a carga
 * do GRF escreve `identifiedDisplayName` na ficha. Ja um DROP NOVO sem nome
 * nao entra sozinho — `tests/db/nomesLocais.test.js` cruza esta lista com o
 * `conteudo.json` do jogo (quando a arvore irma existe) para os ids nunca
 * apontarem para item que o jogo nao dropa.
 */

/** id -> nome de exibicao, do `Name:` do item_db do rAthena. */
export const NOMES_LOCAIS = {
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
	101331: 'Fruit Set Trap' // db/re/item_db_usable.yml:73810 (Fruits_Set_Trap)
};
