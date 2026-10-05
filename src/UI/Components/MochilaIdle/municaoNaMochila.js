/**
 * UI/Components/MochilaIdle/municaoNaMochila.js
 *
 * A MUNICAO NA MOCHILA (05/10/2026, relato de jogador): *"Fiz um arqueiro e
 * jogo apenas pelo Cell, que dificuldade equipar flechas pelo Cell, voce tem
 * que dar varios clicks e nem sempre equipa... poderia ter so uma opcao de
 * 'equipar' igual os equips normais"*.
 *
 * As tres decisoes que explicavam o relato moram aqui, sem DOM, para poderem
 * ser medidas (o mesmo desenho de `espacoEquipado.js`/`posicaoDaDica.js`):
 *
 * 1. **O menu da flecha nao tinha "Equipar".** A municao cai na aba Diversos
 *    (`getItemTab`, a mesma regra de InventoryCommon.js), e o menu so dava
 *    "Equipar" a aba Equipar. No dedo o toque abre esse menu; o unico caminho
 *    ate vestir era o DUPLO toque — e o primeiro toque ja abria o menu por
 *    cima da celula, entao o segundo caia no menu e o `dblclick` so saia
 *    quando os dois toques acertavam a celula antes do menu nascer. Daqui o
 *    "varios cliques e nem sempre equipa". `acaoPrincipalDoItem` da a flecha
 *    o MESMO "Equipar" de um toque que a arma tem.
 *
 * 2. **A flecha vestida CONTINUA na mochila.** As outras pecas saem da lista
 *    ao vestir (`onItemEquip` -> `Inventory.removeItem`); a municao nao — o
 *    rAthena responde com `ZC_EQUIP_ARROW` e a pilha fica no inventario
 *    (InventoryCommon.js `addItemSub` pula AMMO de proposito). A checagem de
 *    recusa da Mochila perguntava "o item ainda esta na mochila?" e, para a
 *    flecha, a resposta e SEMPRE sim: todo vestir de flecha que DEU CERTO
 *    terminava com "Nao foi possivel equipar essa peca agora." na tela. Para a
 *    municao a pergunta certa e "o espaco Municao agora mostra este indice?"
 *    (`municaoVestiuOIndice`).
 *
 * 3. **A grade era refeita a cada flecha disparada.** A assinatura da grade
 *    inclui a QUANTIDADE de cada pilha, e a pilha de flecha vestida desce a
 *    cada tiro (e o loot da caca muda a aba Diversos o tempo todo). Refazer a
 *    grade troca o elemento debaixo do dedo entre o `touchstart` e o `click`
 *    — o toque se perde, e o duplo clique tambem. `oQueRefazerNaGrade` deixa
 *    a janela atualizar o numero NO LUGAR quando nada alem dele mudou.
 */

import ItemType from 'DB/Items/ItemType.js';
import EquipLocation from 'DB/Items/EquipmentLocation.js';

/**
 * A acao principal do menu de um item da grade.
 *
 * @param {{type:number}} item
 * @param {*} aba - a aba do item (`getItemTab`)
 * @param {{EQUIP:*, USABLE:*}} TAB - as abas da Inventory
 * @param {number} mascaraVestida - os espacos que este indice ocupa AGORA
 *        (`mascaraVestidaDoIndice`); 0 quando nao esta vestido
 * @returns {'equipar'|'equipar-municao'|'usar'|'encaixar'|null}
 */
export function acaoPrincipalDoItem(item, aba, TAB, mascaraVestida) {
	if (aba === TAB.EQUIP) {
		return 'equipar';
	}
	if (aba === TAB.USABLE) {
		return 'usar';
	}
	if (item.type === ItemType.AMMO) {
		// A pilha que ja esta no espaco Municao nao ganha "Equipar": o rotulo
		// prometeria uma troca que nao acontece. Tirar e pelo proprio espaco.
		return municaoVestida(mascaraVestida) ? null : 'equipar-municao';
	}
	if (item.type === ItemType.CARD) {
		return 'encaixar';
	}
	return null;
}

/**
 * @param {number} mascara - os espacos que o indice ocupa agora
 * @returns {boolean} o indice esta no espaco Municao?
 */
export function municaoVestida(mascara) {
	return ((mascara | 0) & EquipLocation.AMMO) !== 0;
}

/**
 * O pedido de vestir uma municao DEU CERTO? E a pergunta da checagem de
 * recusa para a flecha (ver o item 2 do cabecalho): a pilha nao sai da
 * mochila, entao so o espaco Municao responde.
 *
 * @param {number} mascaraDepois - os espacos do indice depois do pedido
 * @returns {boolean}
 */
export function municaoVestiuOIndice(mascaraDepois) {
	return municaoVestida(mascaraDepois);
}

/**
 * A mascara a pedir ao servidor para vestir a municao. O servidor ignora o
 * pedido para municao (`pedidoDeVestir`, clif.cpp:12153-12155), mas a Mochila
 * cruza a mascara com os espacos ocupados para achar o conflito de refino, e
 * um `location` ausente cruzaria com nada.
 *
 * @param {{location?:number}} item
 * @returns {number}
 */
export function mascaraDaMunicao(item) {
	return typeof item.location === 'number' && item.location > 0 ? item.location : EquipLocation.AMMO;
}

/**
 * As duas assinaturas da grade: a ESTRUTURA (quais celulas, em que ordem, com
 * que icone) e as QUANTIDADES. A grade so precisa ser refeita quando a
 * estrutura muda.
 *
 * @param {*} aba
 * @param {ReadonlyArray<{index:number, count?:number, IsIdentified?:boolean, travado?:boolean}>} lista
 * @returns {{estrutura:string, quantidades:string}}
 */
export function assinaturasDaGrade(aba, lista) {
	return {
		estrutura:
			String(aba) +
			'|' +
			lista.map(it => it.index + ':' + (it.IsIdentified ? 1 : 0) + ':' + (it.travado ? 1 : 0)).join(','),
		quantidades: lista.map(it => String(it.count || 1)).join(',')
	};
}

/**
 * @param {{estrutura:string, quantidades:string}|null} antes
 * @param {{estrutura:string, quantidades:string}} agora
 * @returns {'nada'|'quantidade'|'tudo'} o que a grade precisa refazer
 */
export function oQueRefazerNaGrade(antes, agora) {
	if (!antes || antes.estrutura !== agora.estrutura) {
		return 'tudo';
	}
	return antes.quantidades === agora.quantidades ? 'nada' : 'quantidade';
}

/**
 * Reescreve so o contador de cada celula (a estrutura da grade nao mudou, ver
 * `oQueRefazerNaGrade`). A regra do contador e a mesma de `syncGrade`: so
 * aparece com mais de uma unidade.
 */
export function atualizarQuantidadesNaGrade(grade, lista) {
	if (!grade) {
		return;
	}
	for (const item of lista) {
		const cell = grade.querySelector(`.mo-item[data-index="${item.index}"]`);
		if (!cell) {
			continue;
		}
		const count = item.count || 1;
		let qtd = cell.querySelector('.mo-item-qtd');
		if (count > 1) {
			if (!qtd) {
				qtd = document.createElement('span');
				qtd.className = 'mo-item-qtd';
				const icone = cell.querySelector('.mo-item-icone');
				cell.insertBefore(qtd, icone ? icone.nextSibling : cell.firstChild);
			}
			qtd.textContent = String(count);
		} else if (qtd) {
			qtd.remove();
		}
	}
}

/**
 * A mascara que o selo "Equipado - <espaco>" da dica le.
 *
 * A FLECHA DA MOCHILA DIZIA "Equipado - Municao" TODA (05/10/2026, visto na
 * foto da sonda). O `WearState` do bloco NORMAL do inventario e a mascara de
 * ONDE o item PODE ir (`clif_item_normal`, clif.cpp:3001; ver o `wearState` em
 * `servidor-mapa.ts`), e a municao e o unico vestivel que mora nesse bloco —
 * entao toda pilha de flecha chegava com `WearState = AMMO` e a dica jurava
 * que todas estavam vestidas, inclusive as que o jogador tentava vestir. Para
 * a municao a verdade e o espaco Municao (os ladrilhos); para o resto fica a
 * regra de antes.
 *
 * @param {{type:number, WearState?:number}} item
 * @param {number|undefined} vestidoEmForcado - a mascara que o SLOT ja sabe
 * @param {() => number} mascaraDosLadrilhos - os espacos do indice agora
 * @returns {number}
 */
export function vestidoEmParaADica(item, vestidoEmForcado, mascaraDosLadrilhos) {
	if (typeof vestidoEmForcado === 'number' && vestidoEmForcado > 0) {
		return vestidoEmForcado;
	}
	if (item.type === ItemType.AMMO) {
		return mascaraDosLadrilhos() & EquipLocation.AMMO;
	}
	return typeof item.WearState === 'number' ? item.WearState : 0;
}
