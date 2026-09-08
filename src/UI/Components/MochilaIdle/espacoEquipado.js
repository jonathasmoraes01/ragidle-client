/**
 * UI/Components/MochilaIdle/espacoEquipado.js
 *
 * O RÓTULO DO ESPAÇO EM QUE UM ITEM ESTÁ VESTIDO — a conta, separada da
 * janela para poder ser medida (o mesmo desenho de `posicaoDaDica.js`).
 *
 * Pedido do alfa (08/09/2026): *"indique claramente quando o item estiver
 * equipado e em qual espaço"*. A dica de hover já dizia tudo sobre o item e
 * nada sobre o ESTADO dele — quem olhava a coluna de equipamento sabia pelo
 * contexto, mas a mesma dica em outros lugares (o Detalhes, a comparação)
 * precisa dizer com palavras.
 *
 * A máscara de vestir (`WearState`/`location`) é a do rAthena: um item pode
 * ocupar MAIS de um espaço ao mesmo tempo — a arma de duas mãos toma
 * `WEAPON|SHIELD`, um chapéu grande toma `HEAD_TOP|HEAD_MID`. O rótulo lista
 * TODOS os espaços tomados, porque "Arma" numa espada de duas mãos esconderia
 * exatamente a informação que a comparação de equipamento precisa (ela
 * desaloja o escudo junto).
 *
 * A dupla Arma+Escudo tem nome próprio ("Arma (duas mãos)") porque é o único
 * combo com nome consagrado no jogo; os outros saem somados ("Chapéu +
 * Óculos"), que é como o RO nativo descreve os chapéus grandes.
 */

/**
 * @param {number} location - máscara de vestir do item (0 = não vestido)
 * @param {ReadonlyArray<{location:number, label:string}>} slots - os espaços
 *        da janela, com a máscara e o rótulo de cada um (EQUIP_SLOTS)
 * @returns {string|null} o rótulo ("Arma", "Arma (duas mãos)", "Chapéu +
 *        Óculos"), ou `null` quando não está vestido
 */
export function rotuloDoEspacoEquipado(location, slots) {
	if (!location || location <= 0) {
		return null;
	}
	const rotulos = [];
	for (const slot of slots) {
		if ((location & slot.location) !== 0 && !rotulos.includes(slot.label)) {
			rotulos.push(slot.label);
		}
	}
	if (rotulos.length === 0) {
		return null;
	}
	if (rotulos.length === 2 && rotulos.includes('Arma') && rotulos.includes('Escudo')) {
		return 'Arma (duas mãos)';
	}
	return rotulos.join(' + ');
}
