/**
 * UI/Components/NpcStore/NpcStoreV2/confirmacaoDaVenda.js
 *
 * A CONFIRMACAO DA VENDA, sem DOM (16/10/2026 — terceiro relato do dono de
 * jogador vendendo a mochila inteira por engano no "Vender itens"). O pedido:
 * *"tao claro que uma crianca de 5 anos saiba o que esta fazendo e nao consiga
 * errar"*.
 *
 * O que esta aqui e DECISAO, nao desenho (o mesmo corte de `vitrine.js` e
 * `quantidadeDeCompra.js`): o que conta como linha arriscada, o resumo que o
 * rodape e o modal escrevem, e os textos. O componente so pinta.
 *
 * ## Por que o modal, se ja havia um "Sim/Nao"
 *
 * A pergunta de 18/09 (`UIManager.showPromptBox`) dizia quantos e quanto numa
 * frase so, e o "Sim" era o botao que o Enter apertava. O jogador que acabou
 * de clicar "Tudo a vista" e "Vender" apertava o Enter por reflexo. O modal
 * novo MOSTRA a lista do que vai sumir, marca as linhas que costumam ser
 * vendidas por engano (carta, equipamento, item raro ou caro), e o Enter nao
 * confirma: o foco nasce no "Cancelar".
 *
 * Textos em pt-BR: o tradutor da borda (`Core/Traducao.js`) os traduz pelo
 * catalogo publicado (`/ragidle/i18n/en/catalogo.json`); cada frase daqui e
 * uma chave exata ou um modelo de lacunas de la.
 */

import ItemType from 'DB/Items/ItemType.js';

/**
 * Preco UNITARIO de venda a partir do qual a linha e marcada como "Caro".
 *
 * Nao e regra de jogo (o servidor nao conhece este numero): e o degrau em que
 * a tela pede atencao. 10.000z por unidade no NPC e equipamento de verdade ou
 * item de MVP — nunca o Jellopy que o jogador quer mesmo vender.
 */
export const VALOR_ALTO_DA_VENDA = 10000;

/** A raridade (fichas publicadas, 0..3) a partir da qual a linha e marcada: "Raro" e "Lendario". */
export const RARIDADE_QUE_PEDE_ATENCAO = 2;

/**
 * Os `card1` que NAO sao carta: o item forjado (0x00FF), o item com nome do
 * criador (0x00FE) e o ovo de pet (0xFF00 = -256 lido como unsigned). Nesses
 * casos `card2..card4` carregam elemento, estrelas e o id do personagem —
 * conta-los como carta inventaria carta onde nao ha.
 */
const CARD1_ESPECIAL = new Set([0x00ff, 0x00fe, 0xff00, -256]);

const EQUIPAMENTO = new Set([ItemType.WEAPON, ItemType.ARMOR, ItemType.SHADOWGEAR]);

/**
 * Quantas cartas estao ENCAIXADAS num equipamento.
 *
 * @param {{slot?: {card1?: number, card2?: number, card3?: number, card4?: number}}} item
 * @returns {number}
 */
export function cartasEncaixadas(item) {
	const slot = item && item.slot;
	if (!slot || CARD1_ESPECIAL.has(slot.card1)) {
		return 0;
	}
	return [slot.card1, slot.card2, slot.card3, slot.card4].filter(c => c > 0).length;
}

/**
 * Por que ESTA linha pede atencao. Lista vazia = linha comum.
 *
 * @param {object} linha
 * @param {number|null} linha.tipo        - `enum item_types` efetivo
 * @param {number} [linha.refino]         - `RefiningLevel`
 * @param {number} [linha.cartas]         - cartas encaixadas (`cartasEncaixadas`)
 * @param {number} [linha.slots]          - quantos slots o item tem (DB)
 * @param {number|null} [linha.raridade]  - 0..3, ou null quando a ficha nao veio
 * @param {number} linha.preco            - preco UNITARIO de venda
 * @returns {Array<'carta'|'equipamento'|'refinado'|'com-carta'|'com-slot'|'raro'|'caro'>}
 */
export function motivosDeAtencao(linha) {
	const motivos = [];
	if (linha.tipo === ItemType.CARD) {
		motivos.push('carta');
	}
	if (EQUIPAMENTO.has(linha.tipo)) {
		motivos.push('equipamento');
		if ((linha.refino || 0) > 0) {
			motivos.push('refinado');
		}
		if ((linha.cartas || 0) > 0) {
			motivos.push('com-carta');
		} else if ((linha.slots || 0) > 0) {
			motivos.push('com-slot');
		}
	}
	if (linha.raridade != null && linha.raridade >= RARIDADE_QUE_PEDE_ATENCAO) {
		motivos.push('raro');
	}
	if ((linha.preco || 0) >= VALOR_ALTO_DA_VENDA) {
		motivos.push('caro');
	}
	return motivos;
}

/**
 * A linha e DESTACADA no modal? Equipamento comum (sem refino, carta nem slot)
 * entra na contagem do aviso, mas nao pinta a linha: pintar toda espada velha
 * de amarelo faria a cor deixar de dizer alguma coisa.
 */
export function linhaEmDestaque(motivos) {
	return motivos.some(m => m !== 'equipamento');
}

/**
 * O resumo da escolha.
 *
 * @param {ReadonlyArray<{quantidade: number, preco: number, motivos?: string[]}>} linhas
 * @returns {{tipos: number, unidades: number, total: number, cartas: number, equipamentos: number, valiosos: number}}
 *   `cartas`/`equipamentos` em UNIDADES; `valiosos` = unidades raras ou caras
 *   que nao sao carta nem equipamento (para nao contar a mesma peca duas vezes).
 */
export function resumoDaEscolha(linhas) {
	const r = { tipos: 0, unidades: 0, total: 0, cartas: 0, equipamentos: 0, valiosos: 0 };
	for (const l of linhas) {
		const q = Number(l.quantidade) || 0;
		if (q <= 0) {
			continue;
		}
		r.tipos += 1;
		r.unidades += q;
		r.total += q * (Number(l.preco) || 0);
		const motivos = l.motivos || [];
		if (motivos.includes('carta')) {
			r.cartas += q;
		} else if (motivos.includes('equipamento')) {
			r.equipamentos += q;
		} else if (motivos.includes('raro') || motivos.includes('caro')) {
			r.valiosos += q;
		}
	}
	return r;
}

/**
 * O rodape da VENDA: diz exatamente o que o botao vai fazer.
 *
 * @param {{tipos: number, unidades: number, total: number}} r
 * @param {(n: number) => string} zeny - o formatador de zeny da janela
 */
export function textoDoRodapeDaVenda(r, zeny) {
	if (!r.tipos) {
		return 'Nada selecionado';
	}
	if (r.unidades === 1) {
		return `Vender 1 item (1 tipo) por ${zeny(r.total)} z`;
	}
	if (r.tipos === 1) {
		return `Vender ${r.unidades} itens (1 tipo) por ${zeny(r.total)} z`;
	}
	return `Vender ${r.unidades} itens (${r.tipos} tipos) por ${zeny(r.total)} z`;
}

/** O botao vermelho do modal: verbo, quantidade e valor, sem "OK" nem "Sim". */
export function textoDoBotaoDeVender(r, zeny) {
	return r.unidades === 1
		? `Vender 1 item por ${zeny(r.total)} z`
		: `Vender ${r.unidades} itens por ${zeny(r.total)} z`;
}

/**
 * As linhas de aviso do topo do modal, uma por familia. Frase inteira por
 * linha (e nao "2 cartas e 1 equipamento" montado por pedacos): o tradutor da
 * borda casa frase inteira com modelo, e pedaco solto sairia meio em cada
 * idioma.
 *
 * @returns {string[]}
 */
export function avisosDaVenda(r) {
	const avisos = [];
	if (r.cartas) {
		avisos.push(r.cartas === 1 ? 'Atenção: inclui 1 carta.' : `Atenção: inclui ${r.cartas} cartas.`);
	}
	if (r.equipamentos) {
		avisos.push(
			r.equipamentos === 1 ? 'Atenção: inclui 1 equipamento.' : `Atenção: inclui ${r.equipamentos} equipamentos.`
		);
	}
	if (r.valiosos) {
		avisos.push(
			r.valiosos === 1
				? 'Atenção: inclui 1 item raro ou caro.'
				: `Atenção: inclui ${r.valiosos} itens raros ou caros.`
		);
	}
	return avisos;
}

/** As etiquetas de uma linha do modal, na ordem em que aparecem. */
export function etiquetasDaLinha(motivos, refino) {
	const etiquetas = [];
	if (motivos.includes('carta')) {
		etiquetas.push('Carta');
	}
	if (motivos.includes('refinado')) {
		etiquetas.push(`Refinado +${refino}`);
	}
	if (motivos.includes('com-carta')) {
		etiquetas.push('Com carta');
	} else if (motivos.includes('com-slot')) {
		etiquetas.push('Com slot');
	}
	if (motivos.includes('raro')) {
		etiquetas.push('Raro');
	}
	if (motivos.includes('caro')) {
		etiquetas.push('Caro');
	}
	return etiquetas;
}

/**
 * O rotulo do botao de marcar em massa NA VENDA. Ele diz o alcance (a aba ou a
 * busca) e QUANTOS tipos vai marcar — o "Tudo a vista" de antes nao dizia
 * nenhum dos dois, e foi por ele que os jogadores venderam a mochila.
 *
 * @param {{cheia: boolean, comBusca: boolean, quantos: number}} e
 */
export function rotuloDeMarcarNaVenda({ cheia, comBusca, quantos }) {
	if (cheia) {
		return comBusca ? 'Desmarcar a busca' : 'Desmarcar esta aba';
	}
	const n = quantos === 1 ? '1 item' : `${quantos} itens`;
	return comBusca ? `Marcar tudo da busca (${n})` : `Marcar tudo desta aba (${n})`;
}
