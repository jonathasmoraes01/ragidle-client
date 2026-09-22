/**
 * UI/Components/CharSelect/vagasDaSelecao.js
 *
 * AS VAGAS DA CONTA NA SELECAO DE PERSONAGEM (RO Shop rodada 2, 22/09/2026).
 *
 * ---------------------------------------------------------------------------
 * O QUE MUDOU
 * ---------------------------------------------------------------------------
 * O dono decidiu: 9 vagas gratis e ate 6 compradas no RO Shop ("+1 Slot de
 * Personagem"), teto 15. A grade da V4 (a do nosso PACKETVER 20211103) tem 15
 * canvas FIXOS no HTML e desenhava os 15 sempre - com a conta em 9, as vagas
 * 9..14 apareciam como "Criar personagem" e o servidor recusava a criacao
 * (`slot >= totalDeSlots`, servidor/char/nome-de-personagem.ts). Era a
 * divergencia que o comentario de `renderGrid` (CharSelectCommon.js) deixou
 * para o dono decidir.
 *
 * Agora a grade desenha o TOTAL QUE O SERVIDOR INFORMA no cabecalho da lista
 * (`HC_ACCEPT_ENTER_NEO_UNION_HEADER` 0x82d e `HC_ACCEPT_ENTER_NEO_UNION`
 * 0x6b: `TotalSlotNum` + `PremiumStartSlot`, a mesma soma que a V4 ja fazia),
 * e nunca deixa criar numa vaga que o servidor nao liberou.
 *
 * Este modulo e PURO sobre um elemento raiz: o componente (CharSelectCommon)
 * e o arnes de foto (`scripts/foto-selecao-de-personagem.mjs`) chamam as
 * MESMAS funcoes, e o teste roda no jsdom sem Renderer nem GRF.
 */

/** Quantos canvas o HTML da V4 tem (#slot0..#slot14). O teto do dono tambem e 15. */
export const VAGAS_DESENHAVEIS = 15;

/**
 * O TOTAL DE VAGAS DA CONTA, lido do pacote do char-server.
 *
 * A soma e a que a V4 ja fazia (`TotalSlotNum + PremiumStartSlot`); o que muda
 * e o que acontece nas bordas: pacote sem os campos (PACKETVER antigo) cai no
 * `padrao` da versao, e um numero acima do que a grade desenha e preso a
 * `VAGAS_DESENHAVEIS` - a tela nunca promete uma vaga que ela nao tem onde
 * mostrar.
 *
 * @param {object} pkt - o pacote decodificado (PacketStructure.js)
 * @param {number} padrao - quando o pacote nao traz a contagem
 * @returns {number} 1..VAGAS_DESENHAVEIS
 */
export function vagasDaConta(pkt, padrao = VAGAS_DESENHAVEIS) {
	const soma = Math.floor(Number(pkt && pkt.TotalSlotNum) + Number((pkt && pkt.PremiumStartSlot) || 0));
	const n = Number.isFinite(soma) && soma > 0 ? soma : Math.floor(Number(padrao)) || VAGAS_DESENHAVEIS;
	return Math.min(VAGAS_DESENHAVEIS, Math.max(1, n));
}

/**
 * Pode CRIAR personagem na vaga `indice`? So numa vaga que a conta tem
 * (`indice < vagas`) e que esta livre. O servidor recusa o resto de qualquer
 * jeito; aqui e para a tela nem oferecer.
 */
export function podeCriarNaVaga(indice, vagas, ocupada) {
	return Number.isInteger(indice) && indice >= 0 && indice < vagas && !ocupada;
}

/**
 * Para onde o cursor vai quando pedem a vaga `indice`: preso entre 0 e a
 * ultima vaga da conta. Uma vaga alem do total so e alcancavel se tiver
 * personagem nela (nunca apagamos da tela um personagem que existe).
 */
export function vagaDoCursor(indice, vagas, ocupada) {
	const i = Math.trunc(Number(indice)) || 0;
	if (i < 0) {
		return 0;
	}
	if (i >= vagas && !(ocupada && ocupada(i))) {
		return Math.max(0, vagas - 1);
	}
	return Math.min(i, VAGAS_DESENHAVEIS - 1);
}

/** "3 de 12 vagas" - o rodape do cabecalho. */
export function textoDasVagas(ocupadas, vagas) {
	return `${ocupadas} de ${vagas} ${vagas === 1 ? 'vaga' : 'vagas'} em uso`;
}

/**
 * APLICA as vagas na grade: cada `.char_canvas` alem do total da conta e sem
 * personagem sai da tela (`hidden`), e o contador do cabecalho (`.cs-vagas`)
 * diz "X de Y". Devolve quantas vagas ficaram visiveis.
 *
 * @param {Element|ShadowRoot} raiz
 * @param {number} vagas - `vagasDaConta(pkt)`
 * @param {function(number):boolean} ocupada - ha personagem na vaga i?
 */
export function aplicarVagas(raiz, vagas, ocupada) {
	if (!raiz) {
		return 0;
	}
	let visiveis = 0;
	let ocupadas = 0;
	raiz.querySelectorAll('.char_canvas').forEach((el, i) => {
		const tem = !!(ocupada && ocupada(i));
		const aparece = i < vagas || tem;
		el.hidden = !aparece;
		el.classList.toggle('is-fora-da-conta', !aparece);
		if (aparece) {
			visiveis += 1;
		}
		if (tem) {
			ocupadas += 1;
		}
	});
	const contador = raiz.querySelector('.cs-vagas');
	if (contador) {
		contador.textContent = textoDasVagas(ocupadas, vagas);
	}
	return visiveis;
}
