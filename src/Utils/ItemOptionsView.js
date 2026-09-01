/**
 * Utils/ItemOptionsView.js
 *
 * Runas — o markup COMPARTILHADO das opcoes aleatorias de equipamento
 * (`item.Options[1..5]`, cada uma `{index, value, param}`; `param` e a
 * RARIDADE: 0 Comum, 1 Incomum, 2 Raro, 3 Lendario). Dois consumidores hoje:
 * a dica de hover da Mochila (MochilaIdle.js) e a janela de Detalhes
 * (ItemInfo.js) -- os dois chamavam `DB.getOptionName(...)` e montavam a
 * mesma lista badge-a-badge, cada um com seu proprio HTML; isto tira a
 * duplicacao e da aos dois o MESMO visual (capsula de vidro escuro + losango
 * + rotulo de raridade, ver `.ri-runas*` em UI/Common.css -- a pele mora la
 * porque os dois componentes rodam em Shadow DOM proprio e Common.css e
 * replicado em ambos).
 *
 * @author RagIdle
 */

import DB from 'DB/DBManager.js';

/** Rotulo em pt-BR por indice de raridade (`Options[i].param`). */
export const RARIDADE_LABEL = ['Comum', 'Incomum', 'Raro', 'Lendário'];

/** Classe CSS por indice de raridade -- ver `.ri-runa.is-*` em Common.css. */
export const RARIDADE_CLASSE = ['is-comum', 'is-incomum', 'is-raro', 'is-lendario'];

/**
 * Escapa texto para uso seguro em innerHTML -- MESMA tecnica de
 * `ItemInfo.js#_escapeHTML` (textContent de um <div> descartavel), so que
 * exportada para nao duplicar entre os consumidores deste modulo.
 *
 * @param {*} texto
 * @returns {string}
 */
export function escapeHTML(texto) {
	const div = document.createElement('div');
	div.textContent = texto == null ? '' : String(texto);
	return div.innerHTML;
}

/**
 * As runas VALIDAS de um item -- `Options[i]` com `index > 0`, na ordem 1..5
 * (o proprio contrato do pacote, index 0 = slot de opcao vazio).
 *
 * @param {object} item
 * @returns {Array<{index:number, value:number, param:number}>}
 */
export function runasDoItem(item) {
	if (!item || !item.Options) {
		return [];
	}
	const runas = [];
	for (let i = 1; i <= 5; i++) {
		const opt = item.Options[i];
		if (opt && opt.index > 0) {
			runas.push(opt);
		}
	}
	return runas;
}

/** `true` se o item tem ao menos uma runa valida. */
export function temRunas(item) {
	return runasDoItem(item).length > 0;
}

/**
 * O texto do bonus -- `DB.getOptionName(index)` com `%d`/`%%` resolvidos
 * (MESMA substituicao que ItemInfo.js/ItemCompare.js ja faziam).
 */
function textoDaRuna(opcao) {
	return DB.getOptionName(opcao.index).replace('%d', opcao.value).replace('%%', '%');
}

/**
 * Markup da capsula de runas (".ri-runas"), ou string vazia se o item nao
 * tem nenhuma -- o chamador so precisa injetar o retorno (innerHTML +=) e
 * testar `''` para saber se deve mostrar o bloco.
 *
 * @param {object} item
 * @returns {string}
 */
export function renderRunasHTML(item) {
	const runas = runasDoItem(item);
	if (runas.length === 0) {
		return '';
	}

	const linhas = runas
		.map(opcao => {
			const raridade = opcao.param || 0;
			const classe = RARIDADE_CLASSE[raridade] || RARIDADE_CLASSE[0];
			const rotulo = RARIDADE_LABEL[raridade] || RARIDADE_LABEL[0];
			const texto = escapeHTML(textoDaRuna(opcao));
			return (
				`<div class="ri-runa ${classe}">` +
				'<span class="ri-runa-losango" aria-hidden="true"></span>' +
				`<span class="ri-runa-texto">${texto}</span>` +
				`<span class="ri-runa-raridade">${rotulo}</span>` +
				'</div>'
			);
		})
		.join('');

	return (
		'<div class="ri-runas">' +
		'<div class="ri-runas-titulo">Runas</div>' +
		`<div class="ri-runas-capsula">${linhas}</div>` +
		'</div>'
	);
}
