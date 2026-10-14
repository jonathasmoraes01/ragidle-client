/**
 * UI/Components/Trade/papelDaTroca.js
 *
 * RAGIDLE (14/10/2026, R127, D-2476). Decisao 6 do dono: *"Liberar os vips de
 * dar trade para conta free, onde a conta vip consegue passar os itens e a
 * free receber, free nao pode enviar item apenas receber"*.
 *
 * O PAPEL deste lado numa troca MISTA (um VIP e um FREE). O servidor o manda
 * logo depois do resultado 3 que abre a janela, pelo `ZC_RAGIDLE_TROCA`
 * (`{ v: 1, acao: 'papel', podeOferecer, texto }`, ver
 * `servidor/troca-vip-para-free.ts` no servidor):
 *
 * - o lado FREE (`podeOferecer: false`) so recebe: a faixa da janela diz isso
 *   desde a abertura, a coluna "Voce oferece" apaga, o zeny trava em 0, e
 *   soltar um item, tocar na coluna ou mandar zeny e recusado AQUI, com a
 *   frase do servidor no chat e a faixa piscando;
 * - o lado VIP (`podeOferecer: true`) le na faixa que so ele oferece.
 *
 * VIP com VIP, e a troca com o administrador, NAO recebem papel: a janela fica
 * como sempre foi.
 *
 * QUEM DECIDE E O SERVIDOR. Isto so MOSTRA: o `CZ_ADD_EXCHANGE_ITEM` do lado
 * FREE que passasse daqui (cliente velho, roteiro no DevTools) volta recusado
 * de la, com o ack 2 e a mesma frase. A conta de "barrar" e a mesma de
 * `ofertaBarradaPorVip`: o zeny ZERO nao e oferta, porque o "Confirmar" manda
 * o campo de zeny em toda troca, e o FREE tem de conseguir confirmar a troca
 * em que so recebe.
 *
 * Sem motor: recebe a raiz (a shadow da janela, ou um elemento com o
 * `Trade.html` dentro), para o teste montar o HTML de verdade no jsdom.
 */

/**
 * O papel lido do pacote, ou `null` (sem papel: a janela de sempre).
 *
 * @param {object} dados - o corpo do `ZC_RAGIDLE_TROCA`
 * @returns {{ podeOferecer: boolean, texto: string } | null}
 */
export function papelDoPacote(dados) {
	if (!dados || typeof dados !== 'object' || dados.acao !== 'papel' || typeof dados.podeOferecer !== 'boolean') {
		return null;
	}
	return { podeOferecer: dados.podeOferecer, texto: typeof dados.texto === 'string' ? dados.texto : '' };
}

/**
 * Este lado esta proibido de por isto na mesa? A mesma conta do servidor.
 *
 * @param {object|null} papel
 * @param {boolean} ehZeny - o indice 0 do `CZ_ADD_EXCHANGE_ITEM`
 * @param {number} quantidade
 * @returns {boolean}
 */
export function ofertaBarradaPeloPapel(papel, ehZeny, quantidade) {
	if (!papel || papel.podeOferecer) {
		return false;
	}
	return !ehZeny || quantidade > 0;
}

/**
 * Mostra o papel na janela. `null` limpa a faixa e as marcas (o zeny volta
 * pelo `resetUI` do `Trade.js`, que e quem o destrava a cada abertura).
 *
 * @param {ShadowRoot|HTMLElement|null|undefined} raiz
 * @param {object|null} papel
 */
export function aplicarPapel(raiz, papel) {
	if (!raiz || typeof raiz.querySelector !== 'function') {
		return;
	}
	const soRecebe = !!papel && !papel.podeOferecer;
	const janela = raiz.querySelector('#Trade');
	if (janela) {
		janela.classList.toggle('so-recebe', soRecebe);
		janela.classList.toggle('so-voce-oferece', !!papel && papel.podeOferecer);
	}
	const faixa = raiz.querySelector('.trade-papel');
	if (faixa) {
		faixa.textContent = papel ? papel.texto : '';
		faixa.hidden = !papel || !papel.texto;
		faixa.classList.remove('is-recusa');
	}
	const zeny = raiz.querySelector('.zeny.send');
	if (zeny && soRecebe) {
		zeny.value = '0';
		zeny.disabled = true;
		zeny.classList.add('disabled');
	}
}

/**
 * A recusa VISIVEL na janela: a faixa pisca em vermelho. Tirar e por a classe
 * com um reflow no meio recomeca a animacao a cada recusa.
 *
 * @param {ShadowRoot|HTMLElement|null|undefined} raiz
 */
export function piscarRecusa(raiz) {
	if (!raiz || typeof raiz.querySelector !== 'function') {
		return;
	}
	const faixa = raiz.querySelector('.trade-papel');
	if (!faixa) {
		return;
	}
	faixa.hidden = !faixa.textContent;
	faixa.classList.remove('is-recusa');
	void faixa.offsetWidth;
	faixa.classList.add('is-recusa');
}
