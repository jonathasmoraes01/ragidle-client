/**
 * UI/Components/MochilaIdle/slotsDeFantasia.js
 *
 * OS SLOTS DE FANTASIA (costume) DA MOCHILA -- o dado puro, separado da
 * janela para poder ser medido sem DOM (mesmo motivo de posicaoDaDica.js).
 *
 * "Fantasia" e o nome em jogo para o equipamento de COSTUME do RO: pecas
 * so-visuais (asas, chapeus de fantasia) que ocupam os bits COSTUME_* de
 * EquipmentLocation.js em vez dos slots normais. O servidor deste jogo ja
 * produz e veste essas pecas (o item chega com a mascara costume em
 * `location`, e o `vestir` de la e agnostico de slot); o que faltava era a
 * NOSSA janela mostrar os slots -- este modulo e a lista deles.
 *
 * -- Por que 4 slots, e nao 5 -------------------------------------------
 * O cliente conhece 5 bits de costume (EquipmentLocation.js:22-26), mas
 * COSTUME_FLOOR (1<<14) fica FORA da lista de slots por dois fatos medidos:
 *   1. o SERVIDOR nao tem o bit: a tabela de bits do conversor
 *      (rag-idle-master, tools/gamedata/schema/index.ts:415-437) salta de
 *      Costume_Garment 0x002000 (linha 429) direto para Ammo 0x008000
 *      (linha 430) -- nenhum item pode chegar com 0x4000 em `location`;
 *   2. a Equipment NATIVA nao tem celula para ele: getSelectorFromLocation
 *      (EquipmentCommon.js:60-84) nao mapeia COSTUME_FLOOR, e a tabela
 *      #costume de EquipmentV3.html:73-100 nao tem <td> para ele.
 * Um slot sem item possivel e sem celula-fonte seria um botao morto.
 * COSTUME_FLOOR continua na MASCARA mesmo assim: reconhecer um item e outra
 * pergunta -- se um dia chegar um com esse bit, ele deve LER como fantasia
 * mesmo sem slot proprio.
 *
 * -- A armadilha do ROBE: a celula nativa chama-se "shadow_garment" ------
 * getSelectorFromLocation (EquipmentCommon.js:79) mapeia COSTUME_ROBE para
 * '.shadow_garment' -- o nome esta trocado no fonte original do roBrowser,
 * mas e NESSA celula que Equipment.equip() escreve a peca vestida (e nao
 * existe SHADOW_GARMENT no enum do cliente, entao a celula e exclusiva do
 * costume robe). Quem "corrigir" o cls abaixo para 'costume_garment' quebra
 * a leitura em silencio: essa classe nao existe em EquipmentV3.html. O
 * teste tests/ui/fantasiaNaMochila.test.js prega os dois lados deste
 * contrato.
 *
 * @author RagIdle
 */

import EquipLocation from 'DB/Items/EquipmentLocation.js';

/**
 * Todos os bits de costume do cliente (EquipmentLocation.js:22-26) -- a
 * pergunta "este item e fantasia?" e responder `location & MASCARA`.
 */
export const MASCARA_DE_FANTASIA =
	EquipLocation.COSTUME_HEAD_TOP |
	EquipLocation.COSTUME_HEAD_MID |
	EquipLocation.COSTUME_HEAD_BOTTOM |
	EquipLocation.COSTUME_ROBE |
	EquipLocation.COSTUME_FLOOR;

/**
 * Um item e de fantasia quando QUALQUER bit de costume esta na mascara de
 * vestir dele. Zero/ausente (item nao equipavel) nunca e fantasia.
 *
 * @param {number} locationMask - `item.location` (ou `item.WearState`)
 * @returns {boolean}
 */
export function eDeFantasia(locationMask) {
	return ((locationMask || 0) & MASCARA_DE_FANTASIA) !== 0;
}

/**
 * Os 4 slots de fantasia visiveis na Mochila -- mesmo formato dos
 * EQUIP_SLOTS de MochilaIdle.js ({location, cls, label, glifo}), e o `cls`
 * e a CLASSE DA CELULA NATIVA de onde syncEquipSlots le a peca vestida
 * (EquipmentV3.html:73-100; ver a armadilha do ROBE no cabecalho).
 *
 * Os glifos-fantasma reusam as siluetas dos slots normais de proposito: a
 * posicao no corpo e a MESMA (chapeu e chapeu), e quem distingue o grupo e
 * a fileira "Fantasia" da janela -- dois desenhos para o mesmo conceito e o
 * que a nota de RiIcones ja proibe nos slots normais.
 */
export const FANTASIA_SLOTS = [
	{ location: EquipLocation.COSTUME_HEAD_TOP, cls: 'costume_head_top', label: 'Chapéu de fantasia', glifo: 'slotChapeu' },
	{ location: EquipLocation.COSTUME_HEAD_MID, cls: 'costume_head_mid', label: 'Óculos de fantasia', glifo: 'slotOculos' },
	{ location: EquipLocation.COSTUME_HEAD_BOTTOM, cls: 'costume_head_bottom', label: 'Boca de fantasia', glifo: 'slotBoca' },
	{ location: EquipLocation.COSTUME_ROBE, cls: 'shadow_garment', label: 'Capa de fantasia', glifo: 'slotCapa' }
];
