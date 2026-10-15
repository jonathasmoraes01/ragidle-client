/**
 * QUEM SAI DA MOCHILA QUANDO O SERVIDOR REENVIA ELA INTEIRA (16/10/2026).
 *
 * A decisao de `substituirItens` (InventoryCommon.js), fora dele para poder
 * ser testada sem a cadeia de janelas. Ver `Engine/MapEngine/reenvioDoInventario.js`
 * para o defeito (o refino "duplicava" o item: indice velho virava fantasma).
 *
 * Dois tipos de fantasma:
 *
 * - **na grade**: entrada da lista local cujo indice a lista nova nao traz;
 * - **vestido**: peca que a janela de equipamento segura e que a lista nova
 *   nao traz, ou traz SEM `WearState` (o servidor diz que ela esta na
 *   mochila). Sem tirar, ela apareceria vestida E na grade ao mesmo tempo.
 *
 * A MUNICAO fica fora da segunda regra: a flecha vestida mora na grade E no
 * equipamento ao mesmo tempo (`onArrowEquipped`), e no bloco normal o
 * `WearState` dela e a mascara de ONDE ela veste, nao se esta vestida. Quem
 * tira flecha e o pacote proprio dela.
 *
 * @param {object[]} listaAtual - Inventory.list (a grade)
 * @param {object[]} vestidosAtuais - Equipment.getEquippedList()
 * @param {object[]} itensNovos - a mochila inteira do reenvio
 * @param {number} localDaMunicao - EquipLocation.AMMO
 * @returns {{ daLista: object[], vestidos: object[] }}
 */
export function fantasmasDoReenvio(listaAtual, vestidosAtuais, itensNovos, localDaMunicao) {
	const novosPorIndice = new Map();
	for (let i = 0; i < itensNovos.length; ++i) {
		novosPorIndice.set(itensNovos[i].index, itensNovos[i]);
	}

	const daLista = listaAtual.filter(item => !novosPorIndice.has(item.index));

	const vestidos = vestidosAtuais.filter(vestido => {
		if (!vestido) {
			return false;
		}
		const onde = vestido.equipped || vestido.WearState || 0;
		// Sem saber ONDE ela esta vestida nao ha celula para limpar (o
		// `unEquip` monta o seletor pelo local, e local 0 e seletor vazio).
		if (!onde) {
			return false;
		}
		if (localDaMunicao && onde & localDaMunicao) {
			return false;
		}
		const novo = novosPorIndice.get(vestido.index);
		return !novo || !novo.WearState;
	});

	return { daLista, vestidos };
}
