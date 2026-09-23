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
 * Sao TRES rodadas de medicao, e a lista abaixo esta separada por elas:
 *
 *  1. **os 22 que CAEM DE MOB** (25/08/2026): o cruzamento dos drops dos 112
 *     monstros do jogo contra a tabela do GRF. **SAIU em 22/09/2026**, junto
 *     com a Rodada 6: os dois blocos eram itens do ramo renewal, e a virada
 *     para pre-renewal os tirou do jogo (ver a nota dentro da tabela);
 *  2. **os 14 da LOJA DE COSMETICOS** (31/08/2026): dos 22 itens que o NPC de
 *     Prontera vende (`npc/custom/ragidle/loja-de-cosmeticos.txt`), so 8 tem
 *     nome no GRF. O dono viu a vitrine com sete linhas e duas nomeadas.
 *  3. **os 5 das LOJAS DE NPC** (01/09/2026): o dono, jogando, no Advanced
 *     Potion Merchant — "esse npc esta sem itens", com as quatro linhas
 *     dizendo "Unknown Item". Aqui a medicao veio ANTES do conserto e cobriu
 *     a superficie inteira: as **75 lojas do catalogo do jogo**
 *     (`assets-build/game/npcs-*.json`) cruzadas contra tudo que resolve nome
 *     hoje. Sao **5 ids mudos em 8 lojas** — os 4 siropes (o mesmo NPC em
 *     alberta_in, geffen_in, izlude_in, payon_in02 e prt_in) e o Combination
 *     Kit do Chef Assistant (prontera e geffen). Ver D-900.
 *
 *     **O buraco e maior fora do catalogo, e ficou de fora de proposito**: nas
 *     lojas que o servidor carrega mas o jogo nao serve (cash trader idRO,
 *     Eden, itemmall, Lasagna) sao **258** ids mudos em 43 lojas. Nomear item
 *     que ninguem alcanca e inventar trabalho — quando uma delas entrar no
 *     catalogo, rode `.tmp-scratch/lojas-do-catalogo.ts` de novo.
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
	// --- As Rodadas 1 e 6 SAIRAM (22/09/2026): 59 nomes, todos do ramo RENEWAL ---
	//
	// Eram os 22 drops de 25/08, os 24 dos mapas novos de 08/09 (D-1226), os 3
	// do corte D-1420 e as 10 cartas de Moscovia e Rock Ridge. A virada para
	// pre-renewal trocou o recorte de item de ramo, e os 59 deixaram de existir
	// no `conteudo.json` do jogo (medido no pacote 88: nenhum deles esta em
	// `tabelas.itens`). Item que o jogo nao entrega nao precisa de nome, e o
	// cruzamento de `tests/db/nomesLocais.test.js` reprovava apontando os 59.
	//
	// Os 41 ICONES deles sairam de `ICONES_LOCAIS` no mesmo commit. Se um destes
	// itens voltar ao jogo, o nome e o icone voltam do historico
	// (`git log -S "Crimson Spear" -- src/DB/Items/nomesLocais.js`).

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
	// O primeiro item da loja que nao e manto. Ver D-796.
	420010: 'Costume Dark Master', // db/re/item_db_equip.yml:185600 (C_Cons_Of_Darkness)

	// --- Rodada 5: as LOJAS DE NPC do catalogo (01/09/2026) ---
	// O dono, jogando: "esse npc esta sem itens" — o Advanced Potion Merchant
	// com quatro linhas "Unknown Item". Medido nas 75 lojas do catalogo do
	// jogo (`.tmp-scratch/lojas-do-catalogo.ts`, no repositorio do jogo):
	// **5 ids mudos em 8 lojas**, e sao estes. Ver D-900.
	11621: 'Red Syrup', // db/re/item_db_usable.yml:4188 (High_RedPotion)
	11622: 'Yellow Syrup', // db/re/item_db_usable.yml:4199 (High_YelloPotion)
	11623: 'White Syrup', // db/re/item_db_usable.yml:4210 (High_WhitePotion)
	11624: 'Blue Syrup', // db/re/item_db_usable.yml:4221 (High_BluePotion)
	12849: 'Combination Kit', // db/re/item_db_usable.yml:14476 (Combination_Kit) — Chef Assistant

	// --- Rodada 7: o MERCADO DO GRUPO EDEN (11/09/2026, D-1330) ---
	// Relato do dono: "tem alguns itens que continuam com o icone da maca e o
	// nome unknown item, como e o caso do ID 18145 (Vigilante Bow)".
	//
	// O 18145 ja estava nomeado desde a Rodada 6 (08/09), e o commit esta em
	// producao — medido, nao suposto. O que ele viu ali e a MACA, que e decisao
	// declarada no fim deste arquivo. Mas o "alguns" tinha sujeito, e ele estava
	// noutra porta.
	//
	// A Rodada 5 mediu as lojas do catalogo em 01/09 e EXCLUIU Eden de proposito
	// ("lojas que o servidor carrega mas o jogo nao serve"), deixando escrito:
	// *"quando uma delas entrar no catalogo, rode de novo"*. Eden entrou
	// (`LOJAS_DO_JOGO`, game/loja.ts) e ninguem refez o cruzamento — a MESMA
	// causa da Rodada 6, que e a medida e nao o item.
	//
	// Desta vez a medida cobriu as SEIS portas por onde item chega ao jogador
	// (drop de mob, loja, forja, flecha, Velha Caixa e recompensa de missao):
	// 1.480 ids distintos, e **estes 4 sao os unicos mudos**. As Velhas Caixas
	// (1.103 ids) estavam limpas — e elas nunca tinham sido medidas.
	12290: 'Mysterious Can Magic Powder', // db/re/item_db_usable.yml:7997 (Mysterious_Can)
	12291: 'Mysterious PET Bottle', // db/re/item_db_usable.yml:8011 (Mysterious_PET_Bottle)
	12376: 'Mysterious Can2', // db/re/item_db_usable.yml:9062 (Mysterious_Can2)
	12377: 'Mysterious PET Bottle2', // db/re/item_db_usable.yml:9075 (Mysterious_PET_Bottle2)

	// --- Rodada 8: os 26 VISUAIS CUSTOM da Season 1 (22/09/2026) ---
	//
	// Os ids 9.000.300-9.000.325 sao NOSSOS (`game/itens-custom.ts`), entao por
	// construcao nao existem em tabela nenhuma do GRF: `DB.getItemName` devolve
	// "Unknown Item" para os 26. **Medido no jogo vivo**, com a Pocao Vermelha
	// (501) de CONTROLE: 26 de 26 "Unknown Item" com o controle respondendo
	// "Pocao Vermelha" — sem o controle a medicao nao distinguiria "nao tem
	// nome" de "a tabela do GRF ainda nao carregou", que e exatamente o erro
	// que a primeira corrida cometeu (ela media ANTES da carga e dizia que os
	// SETE oficiais tambem eram "Unknown Item").
	//
	// A janela da Temporada ja mostrava o nome certo porque ela o le do
	// catalogo do dono; fora dela — mochila, boneco, ficha, correio, chat —
	// o jogador via "Unknown Item" em 26 dos 33 visuais.
	//
	// **Nenhum nome e inventado nem traduzido**: cada um e a coluna `nome` de
	// `servidor/temporada/catalogo-s1.ts`, que sai do pacote do dono
	// (`RO_CLASSIC_IDLE_AMANHA/04_SEASON1_VISUAL_CATALOG.md`). Por isso estes
	// 26 saem em PORTUGUES enquanto os 22 drops da rodada 1 saem em ingles: a
	// regra e a mesma (o nome vem da fonte), e as fontes e que sao duas.
	9000300: 'Asas de Anjo', // catalogo-s1.ts, Caixa Topo
	9000301: 'Asas de Demônio', // catalogo-s1.ts, Caixa Topo
	9000302: 'Elmo do Anjo', // catalogo-s1.ts, Caixa Topo
	9000303: 'Elmo de Diabolus', // catalogo-s1.ts, Caixa Topo
	9000304: 'Disfarce de Valquíria', // catalogo-s1.ts, Caixa Topo
	9000305: 'Máscara do Senhor das Trevas', // catalogo-s1.ts, Caixa Topo
	9000306: 'Orelhas de Anjo', // catalogo-s1.ts, Caixa Meio
	9000307: 'Asas Malignas', // catalogo-s1.ts, Caixa Meio
	9000308: 'Venda Sombria', // catalogo-s1.ts, Caixa Meio
	9000309: 'Espírito Olímpico', // catalogo-s1.ts, Caixa Meio
	9000310: 'Penas Ensanguentadas', // catalogo-s1.ts, Caixa Meio
	9000311: 'Diadema do Grifo', // catalogo-s1.ts, Caixa Meio
	9000312: 'Estola Angelical', // catalogo-s1.ts, Caixa Baixo
	9000313: 'Estola do Demônio', // catalogo-s1.ts, Caixa Baixo
	9000314: "Seraphim's Feather", // catalogo-s1.ts, Caixa Baixo
	9000315: 'Fallen Angel Valletta', // catalogo-s1.ts, Caixa Baixo
	9000316: 'Group of Stars', // catalogo-s1.ts, Caixa Baixo
	9000317: 'Light and Dark Master', // catalogo-s1.ts, Caixa Baixo
	9000318: "Lucifer's Wings", // catalogo-s1.ts, Caixa Manto
	9000319: 'Cristal Filosofal', // catalogo-s1.ts, Passe Free 40
	9000320: 'Valkyrie Wings', // catalogo-s1.ts, Passe Free 50
	9000321: 'Shining Angel Wings', // catalogo-s1.ts, Passe Premium 15
	9000322: 'Ghost Effect', // catalogo-s1.ts, Passe Premium 30
	9000323: 'Ancient Resonance', // catalogo-s1.ts, Passe Premium 45
	9000324: 'Rune-Midgarts Glory', // catalogo-s1.ts, Passe Premium 50
	9000325: 'Astra Blessing', // catalogo-s1.ts, VIP

	// --- Rodada 9: os 11 CONSUMIVEIS DO RO SHOP (22/09/2026) ---
	//
	// Ids NOSSOS (`game/itens-custom.ts`, faixa 9.000.100-9.000.199 dos
	// consumiveis de cash), como os visuais da Rodada 8: tabela nenhuma do GRF
	// os tem. Os dois Manuais ja existiam no jogo e tambem chegavam a mochila
	// como "Item desconhecido"; os outros nove nasceram com o RO Shop (contrato
	// do canal, secao 7). Cada nome e o campo `name` de `itens-custom.ts`.
	//
	// ATENCAO ao cruzamento de `tests/db/nomesLocais.test.js`: os ids
	// 9.000.102-110 so existem no `conteudo.json` do jogo DEPOIS de ele ser
	// regerado com a branch do RO Shop (BLOCKERS B-RS-08 do servidor). Contra
	// um pacote anterior o cruzamento reprova apontando os nove - e o aviso
	// certo: o item ainda nao esta no jogo.
	9000100: 'Manual de Experiência', // itens-custom.ts (Manual_De_Experiencia)
	9000101: 'Manual de Experiência de Classe', // itens-custom.ts (Manual_De_Experiencia_De_Classe)
	9000102: 'Bênção da Fortuna', // itens-custom.ts (Bencao_Da_Fortuna)
	9000103: 'Pack Poção Azul', // itens-custom.ts (Pack_Pocao_Azul)
	9000104: 'Pack Poção Branca', // itens-custom.ts (Pack_Pocao_Branca)
	9000105: 'Pack Sobrevivência', // itens-custom.ts (Pack_Sobrevivencia)
	9000106: 'Pack Viagem', // itens-custom.ts (Pack_Viagem)
	9000107: 'Pack Farm', // itens-custom.ts (Pack_Farm)
	9000108: 'Pack Up', // itens-custom.ts (Pack_Up)
	9000109: 'Pack Completo de Farm', // itens-custom.ts (Pack_Completo_De_Farm)
	9000110: 'Pack de Treino', // itens-custom.ts (Pack_De_Treino)
	// As pocoes que os packs entregam (23/09/2026, `game/pocoes-da-conta.ts`):
	// o mesmo efeito da comum, sem venda, troca nem chao.
	9000111: 'Poção Azul da Conta', // pocoes-da-conta.ts (Blue_Potion_Da_Conta)
	9000112: 'Poção Branca da Conta', // pocoes-da-conta.ts (White_Potion_Da_Conta)
	// Os sete TICKETS do RO Shop (23/09/2026): servicos e expansoes de conta que viraram item.
	9000113: 'Ticket de Reset de Skills', // itens-custom.ts (Ticket_Reset_De_Skills)
	9000114: 'Ticket de Reset de Status', // itens-custom.ts (Ticket_Reset_De_Status)
	9000115: 'Ticket de Troca de Nome', // itens-custom.ts (Ticket_Troca_De_Nome)
	9000116: 'Ticket de Alteração Visual', // itens-custom.ts (Ticket_Alteracao_Visual)
	9000117: 'Ticket de Slot de Personagem', // itens-custom.ts (Ticket_Slot_De_Personagem)
	9000118: 'Ticket de Expansão de Carga', // itens-custom.ts (Ticket_Expansao_De_Carga)
	9000119: 'Ticket de Expansão de Armazém', // itens-custom.ts (Ticket_Expansao_De_Armazem)

	// --- Rodada 10: as RECOMPENSAS DO ALFA (23/09/2026) ---
	//
	// Ids NOSSOS, sub-faixa 9.002.000-9.002.099 (`docs/cash-shop/ITEM_ID_REGISTRY.md`
	// e `docs/CONTRATO-ALFA.md` secao 4.7 do servidor). O visual e o oficial do
	// GRF (View 340 e View 33); so o nome e a descricao sao nossos.
	9002000: 'Poring Alpha Hat', // itens-custom.ts (Poring_Alpha_Hat), View 340
	9002001: 'Coroa do Alfa', // itens-custom.ts (Coroa_Do_Alfa), View 33
	9002002: 'Aura do Alfa' // itens-custom.ts (Aura_Do_Alfa), costume de capa com o HAT_EF 132 do Costume Magic Heir
};

/**
 * AS DESCRICOES DOS CONSUMIVEIS DO RO SHOP (Rodada 9, 22/09/2026).
 *
 * O cabecalho deste arquivo deixa a descricao de fora porque "descricao
 * inventada e pior que '...'". Estas NAO sao inventadas: sao as do documento
 * do dono do item no servidor (`docs/ro-shop/ITEM_IMPLEMENTATION.md`, secao 3,
 * do Agente 1; a dos Manuais sai da tabela 2 do mesmo documento), com o fecho
 * que os Manuais ja usam. So vale onde o GRF nao trouxe a dele
 * (`completarFicha`).
 */
const FECHO_DE_CASH = 'Não pode ser negociado nem vendido a NPCs. Pode ser guardado no armazém.';

const FECHO_DO_ALFA =
	'Recompensa do Alfa do Ragnarok Classic Idle. Visual, sem atributos. Não pode ser negociado nem vendido a NPCs.';

export const DESCRICOES_LOCAIS = {
	9002000: FECHO_DO_ALFA,
	9002001: FECHO_DO_ALFA,
	9002002: FECHO_DO_ALFA,
	9000100: `Aumenta em 25% a EXP de base ganha por 1 hora.\n${FECHO_DE_CASH}`,
	9000101: `Aumenta em 25% a EXP de classe ganha por 1 hora.\n${FECHO_DE_CASH}`,
	9000102: `Uma bênção que atrai a sorte. Aumenta em 20% a chance de itens comuns caírem de monstros comuns por 1 hora. Não vale para cartas, MVPs nem monstros raros. Usar outra enquanto ativa estende a duração.\n${FECHO_DE_CASH}`,
	9000103: `Um pack selado. Ao usar, entrega 1000 Poções Azuis da Conta.\n${FECHO_DE_CASH}`,
	9000104: `Um pack selado. Ao usar, entrega 500 Poções Brancas da Conta.\n${FECHO_DE_CASH}`,
	9000105: `Um pack selado. Ao usar, entrega 1000 Poções Azuis da Conta e 500 Poções Brancas da Conta.\n${FECHO_DE_CASH}`,
	9000106: `Um pack selado. Ao usar, entrega 500 Asas de Mosca e 100 Asas de Borboleta.\n${FECHO_DE_CASH}`,
	9000107: `Um pack selado. Ao usar, entrega 500 Poções Brancas da Conta, 1000 Poções Azuis da Conta e 1 Bênção da Fortuna.\n${FECHO_DE_CASH}`,
	9000108: `Um pack selado. Ao usar, entrega 500 Poções Brancas da Conta, 1000 Poções Azuis da Conta, 1 Manual de Experiência e 1 Manual de Experiência de Classe.\n${FECHO_DE_CASH}`,
	9000109: `Um pack selado. Ao usar, entrega 500 Poções Brancas da Conta, 1000 Poções Azuis da Conta, os dois Manuais e 1 Bênção da Fortuna.\n${FECHO_DE_CASH}`,
	9000110: `Um pack selado. Ao usar, entrega 1 Manual de Experiência, 1 Manual de Experiência de Classe e 1 Bênção da Fortuna.\n${FECHO_DE_CASH}`,
	// O efeito e o do script da base no `db/pre-re/item_db_usable.yml:117-132`
	// (`itemheal 0,rand(40,60);` e `itemheal rand(325,405),0;`).
	9000111: `Uma poção que recupera de 40 a 60 de SP. Vem dos packs do RO Shop.\n${FECHO_DE_CASH}`,
	9000112: `Uma poção que recupera de 325 a 405 de HP. Vem dos packs do RO Shop.\n${FECHO_DE_CASH}`,
	// Os tickets (23/09/2026). O numero da carga NAO vai aqui: o dono o redefine, e o servidor o diz na loja.
	9000113: `Ao usar, a conta ganha um crédito de Reset de Skills. Aplique pelo RO Shop, na aba Utilidades.\n${FECHO_DE_CASH}`,
	9000114: `Ao usar, a conta ganha um crédito de Reset de Status. Aplique pelo RO Shop, na aba Utilidades.\n${FECHO_DE_CASH}`,
	9000115: `Ao usar, a conta ganha um crédito de Troca de Nome. Aplique pelo RO Shop, na aba Conta.\n${FECHO_DE_CASH}`,
	9000116: `Ao usar, a conta ganha um crédito de Alteração Visual. Aplique pelo RO Shop, na aba Conta.\n${FECHO_DE_CASH}`,
	9000117: `Ao usar, a conta ganha mais um espaço de personagem. Permanente. No limite de espaços, o item não é gasto.\n${FECHO_DE_CASH}`,
	9000118: `Ao usar, todos os personagens da conta ganham mais capacidade de carga. Permanente. No limite de expansões, o item não é gasto.\n${FECHO_DE_CASH}`,
	9000119: `Ao usar, o armazém da Kafra ganha cem espaços, para toda a conta. Permanente. No limite de expansões, o item não é gasto.\n${FECHO_DE_CASH}`
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
 * ## O 420010 nao e derivado: ele foi DESENHADO (D-796, 31/08/2026)
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
 * ## As Rodadas 4, 4b, 4c e 6 SAIRAM (22/09/2026)
 *
 * Eram 41 icones de DROP DE MOB: os 5 com `.bmp` sob o AegisName em ASCII,
 * os Crimson e os Doram derivados em CP949 (진홍의<tipo>, 도람<peca>), os
 * Foxtail no icone de familia 여우의꼬리 e as cartas no 이름없는카드
 * generico. Todos eram itens do ramo renewal, e a virada para pre-renewal os
 * tirou do jogo junto com os nomes (ver a nota em `NOMES_LOCAIS`).
 *
 * A pesquisa de cada derivacao — as duas peneiras, a contraprova em CP949 e
 * a correcao de criterio do icone de familia — continua valendo como METODO
 * e esta no historico: `git log -S "진홍의" -- src/DB/Items/nomesLocais.js`.
 */

/** id -> nome do `.bmp` do icone, em CP949 como toda tabela de recurso. */
export const ICONES_LOCAIS = {
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
	 * fizemos, do sprite do proprio item (D-796, 31/08/2026). Ele mora em
	 * `cliente/icones-de-item/_Cons_Of_Darkness.bmp`, no repositorio do jogo, e
	 * o servidor de assets o entrega quando o GRF nao tem (a terceira fonte de
	 * `tools/oraculo/servidor-de-assets.ts`).
	 *
	 * O nome e ASCII e com a caixa exata do `HatTable[2020]`, de proposito: o
	 * arquivo em disco e achado por comparacao de caminho, e no Linux do
	 * contêiner a caixa importa.
	 */
	420010: '_Cons_Of_Darkness',

	/*
	 * Rodada 5 (01/09/2026): os 4 SIROPES do Advanced Potion Merchant.
	 *
	 * Aqui a derivacao nao e por `View` nem por transliteracao: e a TRADUCAO
	 * LITERAL do AegisName. `High_*Potion` em coreano e `상급포션` (sanggeup
	 * posyeon, "posao de grau superior") + a cor, e o proprio NPC se chama
	 * "Advanced Potion Merchant". Os quatro arquivos existem, um por cor, com
	 * o hifen ASCII no meio.
	 *
	 * As duas peneiras de sempre passam, e a segunda passa da forma mais
	 * forte possivel (`.tmp-scratch/provar-icone-siropes.ts`, no repositorio
	 * do jogo):
	 *
	 *   1. o `.bmp` existe em `item\` E em `collection\`, conferido arquivo a
	 *      arquivo pelos bytes CP949;
	 *   2. **NENHUM id** da tabela de recurso do GRF (4.026 arquivos com dono
	 *      declarado) aponta para qualquer um dos quatro — nao ha disputa de
	 *      identidade nem icone de familia compartilhado. Cada sirope e dono
	 *      unico do seu arquivo.
	 *
	 * O GRF nao tem a serie 시럽 ("syrup") — zero arquivos —, entao a grafia
	 * kRO desta familia e mesmo a de "posao de grau superior".
	 */
	11621: '\xbb\xf3\xb1\xde\xc6\xf7\xbc\xc7-\xbb\xa1\xb0\xad', // Red Syrup / 상급포션-빨강
	11622: '\xbb\xf3\xb1\xde\xc6\xf7\xbc\xc7-\xb3\xeb\xb6\xfb', // Yellow Syrup / 상급포션-노랑
	11623: '\xbb\xf3\xb1\xde\xc6\xf7\xbc\xc7-\xc7\xcf\xbe\xe7', // White Syrup / 상급포션-하양
	11624: '\xbb\xf3\xb1\xde\xc6\xf7\xbc\xc7-\xc6\xc4\xb6\xfb', // Blue Syrup / 상급포션-파랑

	/*
	 * RODADA 7 (11/09/2026, D-1330): os 4 do Mercado de Eden ficam com a
	 * maca, medidos como os 13 da Rodada 6 (que saiu em 22/09/2026).
	 *
	 *   12290 Mysterious_Can · 12291 Mysterious_PET_Bottle ·
	 *   12376 Mysterious_Can2 · 12377 Mysterious_PET_Bottle2
	 *
	 * As DUAS tabelas de recurso deste GRF foram lidas
	 * (`idnum2itemresnametable.txt`, 7.902 ids, e `num2itemresnametable.txt`,
	 * 7.897) e NENHUMA tem os quatro. Nao ha `.bmp` sob o AegisName em ASCII
	 * minusculo em `item\` nem em `collection\` — a tecnica que resolveu 5 dos
	 * 21 da Rodada 4. E nao ha familia CP949 com nome padronizado a derivar:
	 * eles nao sao Crimson nem Doram nem carta.
	 *
	 * **A medicao teve CONTROLE POSITIVO**: a Pocao Vermelha (501) aparece nas
	 * duas tabelas. Sem ele, uma leitura quebrada diria "os 4 nao tem" com a
	 * tabela vazia, e o veredito seria o criterio que passa com zero.
	 * Sonda: `.tmp-scratch/icone-dos-mysterious.ts`, no repositorio do jogo.
	 */

	/*
	 * RODADA 9b (RO Shop rodada 3, 22/09/2026): os 11 CONSUMIVEIS DO RO SHOP
	 * ganham um icone de RESERVA DECLARADA - e esta e a unica secao desta
	 * tabela em que o `.bmp` NAO e o do proprio item, de proposito.
	 *
	 * Os ids 9.000.100-110 sao nossos: tabela nenhuma do GRF os tem, e sem esta
	 * linha a mochila, o aviso "obtido(s)" e o RO Shop mostravam a MACA (QA
	 * independente, achado A-01). A arte oficial de cada um sai do pipeline do
	 * servidor (B-RS-08) em `public/ragidle/item/<id>.png`, e quem desenha
	 * icone de item (mochila, boneco, RO Shop, aviso de obtido) pede ESSE PNG
	 * primeiro (`Utils/ItemArt.js`): quando ele existir, vence sozinho, e esta
	 * reserva fica so para o caminho do GRF.
	 *
	 * A reserva e o icone do CONTEUDO (o mesmo que o card do RO Shop ja
	 * mostrava, `RO_SHOP_REQUIRED_ASSETS.md` secao 2) ou, nos boosts, o item
	 * oficial de mesmo efeito. Nenhum recurso daqui foi deduzido: cada um foi
	 * LIDO em `data\idnum2itemresnametable.txt` do `data.grf`, com o `.bmp`
	 * conferido em `texture\...\item\` (sonda `recursos.mts` da rodada 3, com o
	 * id de controle ao lado):
	 *
	 *   505 Pocao Azul       -> 파란포션        504 Pocao Branca -> 하얀포션
	 *   601 Asa de Mosca     -> 파리의날개      12208 Manual de Combate (e o
	 *   12210 Goma de Mascar -> 풍선껌          14592, de Classe) -> 전투교범
	 */
	9000100: '\xc0\xfc\xc5\xf5\xb1\xb3\xb9\xfc', // Manual de Experiencia -> 12208 Manual de Combate (전투교범)
	9000101: '\xc0\xfc\xc5\xf5\xb1\xb3\xb9\xfc', // Manual de Exp. de Classe -> 14592 Manual de Combate de Classe (o mesmo .bmp)
	9000102: '\xc7\xb3\xbc\xb1\xb2\xad', // Bencao da Fortuna -> 12210 Goma de Mascar (풍선껌, o item de drop do kRO)
	9000103: '\xc6\xc4\xb6\xf5\xc6\xf7\xbc\xc7', // Pack Pocao Azul -> 505 Pocao Azul (파란포션)
	9000104: '\xc7\xcf\xbe\xe1\xc6\xf7\xbc\xc7', // Pack Pocao Branca -> 504 Pocao Branca (하얀포션)
	9000105: '\xc6\xc4\xb6\xf5\xc6\xf7\xbc\xc7', // Pack Sobrevivencia -> 505 Pocao Azul
	9000106: '\xc6\xc4\xb8\xae\xc0\xc7\xb3\xaf\xb0\xb3', // Pack Viagem -> 601 Asa de Mosca (파리의날개)
	9000107: '\xc7\xcf\xbe\xe1\xc6\xf7\xbc\xc7', // Pack Farm -> 504 Pocao Branca
	9000108: '\xc7\xcf\xbe\xe1\xc6\xf7\xbc\xc7', // Pack Up -> 504 Pocao Branca
	9000109: '\xc7\xcf\xbe\xe1\xc6\xf7\xbc\xc7', // Pack Completo de Farm -> 504 Pocao Branca
	9000110: '\xc0\xfc\xc5\xf5\xb1\xb3\xb9\xfc', // Pack de Treino -> 12208 Manual de Combate
	9000111: '\xc6\xc4\xb6\xf5\xc6\xf7\xbc\xc7', // Pocao Azul da Conta -> 505 Pocao Azul (a mesma arte)
	9000112: '\xc7\xcf\xbe\xe1\xc6\xf7\xbc\xc7', // Pocao Branca da Conta -> 504 Pocao Branca (a mesma arte)
	/*
	 * Os sete tickets (23/09/2026). Os recursos foram LIDOS na tabela do
	 * `data.grf` pelo servidor (a mesma escolha de
	 * `tools/item-icon/recursos-que-a-tabela-nao-tem.ts`), um diferente por ticket.
	 */
	9000113: '\xbc\xb6\xb1\xa4\xb8\xb7\xb4\xeb', // Reset de Skills -> 12213 Neuralizer (섬광막대)
	9000114: '\xc4\xed\xc6\xf9\x2d\xb3\xeb\xb8\xd6', // Reset de Status -> 6153 Special_Exchange_Coupon (쿠폰-노멀)
	9000115: '\xc4\xed\xc6\xf9', // Troca de Nome -> 7623 Name_Change_Coupon (쿠폰)
	9000116: '\xc4\xfb\xc1\xee\xc2\xfc\xb0\xa1\xb1\xc7', // Alteracao Visual -> 7622 New_Style_Coupon (퀴즈참가권)
	9000117: '\xc1\xb6\xc1\xf7\xbf\xf8\xc0\xc7\xc1\xf5\xc7\xa5', // Slot de Personagem -> 12786 Change_Slot_Card (조직원의증표)
	9000118: '\xc4\xb3\xbd\xc3\xbb\xf3\xc0\xda\x5f\xbb\xa1\xb0\xad', // Expansao de Carga -> 12413 PCBang_Coupon_Box2 (캐시상자_빨강)
	9000119: '\xc4\xab\xc7\xc1\xb6\xf3\xc0\xcc\xbf\xeb\xb1\xc7', // Expansao de Armazem -> 6046 Clothing_Dye_Coupon (카프라이용권)

	/*
	 * O 12849 (Combination Kit) NAO ENTRA: nome sim, icone nao. O GRF
	 * nao tem `조합`/`합성` (johap/hapseong, "combinacao"/"sintese") em icone
	 * nenhum, e nao ha ASCII `combination`/`kit` que sirva — os 3 `키트` que
	 * existem sao Repair/Poison/Reparo, itens outros
	 * (`.tmp-scratch/buscar-12849.ts`). Ausencia real, nao peneira. A maca
	 * continua sendo a resposta honesta para ele.
	 */
};
