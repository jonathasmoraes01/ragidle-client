/**
 * Engine/MapEngine/rotulosDaConfirmacao.js
 *
 * As regras puras da JANELA DE CONFIRMACAO do servidor (`RagidleConfirmar.js`,
 * 0x0fd1/0x0fd2) que a devolucao do carrinho trouxe (R110, D-2044, 06/10/2026):
 * os rotulos dos dois botoes e a altura da caixa. Puras para o teste alcancar
 * sem WebGL nem sessao.
 *
 * Este arquivo e parte do fork ragidle do ROBrowser.
 */

/** Os rotulos de sempre (os comandos `#`, o pet, o gole do bonus de drop). */
export const ROTULO_SIM_PADRAO = 'OK';
export const ROTULO_NAO_PADRAO = 'Cancelar';

/** Um rotulo vindo do servidor so vale se for texto nao vazio, e curto. */
function rotuloValido(valor) {
	return typeof valor === 'string' && valor.trim() !== '' && valor.length <= 40;
}

/**
 * Os rotulos dos dois botoes. `sim`/`nao` sao OPCIONAIS no contrato v1: o
 * servidor que nao os manda (todas as perguntas anteriores a R110) recebe a
 * janela de sempre. Rotulo invalido (vazio, nao-texto, comprido demais para a
 * caixa) cai no padrao em vez de desenhar um botao vazio.
 *
 * @param {{sim?: unknown, nao?: unknown}|null|undefined} dados
 * @returns {{sim: string, nao: string}}
 */
export function rotulosDaPergunta(dados) {
	const d = dados || {};
	return {
		sim: rotuloValido(d.sim) ? d.sim.trim() : ROTULO_SIM_PADRAO,
		nao: rotuloValido(d.nao) ? d.nao.trim() : ROTULO_NAO_PADRAO
	};
}

/** A altura da caixa nativa (`WinPopup.css`). */
export const ALTURA_MINIMA_DA_PERGUNTA = 120;

/**
 * A altura da caixa: o texto inteiro mais o rodape dos botoes, nunca menos que
 * os 120px de sempre e nunca mais que 80% da tela (dali em diante o texto rola
 * por dentro, e os botoes continuam a vista).
 *
 * @param {number} alturaDoTexto - o `scrollHeight` do texto
 * @param {number} alturaDoRodape - 40 no mouse, 60 no dedo
 * @param {number} alturaDaTela
 * @returns {number}
 */
export function alturaDaPergunta(alturaDoTexto, alturaDoRodape, alturaDaTela) {
	const texto = Number.isFinite(alturaDoTexto) && alturaDoTexto > 0 ? alturaDoTexto : 0;
	const desejada = Math.ceil(texto) + alturaDoRodape + 8;
	const teto = Number.isFinite(alturaDaTela) && alturaDaTela > 0 ? Math.floor(alturaDaTela * 0.8) : desejada;
	return Math.max(ALTURA_MINIMA_DA_PERGUNTA, Math.min(desejada, teto));
}
