/**
 * UI/Components/FPS/marcaDoFps.js
 *
 * A MARCA DO CONTADOR DE FPS A VISTA (15/10/2026, HUD mobile premium).
 *
 * O dono viu o "120 FPS" por cima da aba Codex do cartao de missoes: o contador nasce em (100, 100), o ponto de
 * arrastar do desktop, e no celular em pe isso cai no meio da coluna da esquerda. Na premium ele mora logo acima
 * do chat (`HudPremium/documento.css`), e a coluna de buffs, que desce ate o chat, precisa saber que ele esta la
 * para parar antes dele (`--m-reserva-do-fps`, tokens.css). Quem diz e esta marca no `<html>`, porque o contador
 * aparece e some pela janela de video e pelo atalho de teclado (`FPS.toggle`), e nao por CSS.
 *
 * Sem dependencia nenhuma, para o teste alcancar em jsdom (o FPS.js arrasta o Renderer).
 *
 * This file is part of the ragidle fork of ROBrowser.
 */

/** A marca no `<html>`: o contador de FPS esta na tela. */
export const MARCA_FPS_VISIVEL = 'ri-fps-visivel';

/**
 * Poe ou tira a marca conforme o host do contador.
 *
 * @param {HTMLElement|null} host o host do componente FPS; sem ele, ou fora do documento, a marca sai
 * @returns {boolean} se o contador ficou marcado como visivel
 */
export function marcarFps(host) {
	const visivel = !!host && host.isConnected && host.style.display !== 'none';
	const raiz = (host && host.ownerDocument) || (typeof document !== 'undefined' ? document : null);
	if (raiz && raiz.documentElement) {
		raiz.documentElement.classList.toggle(MARCA_FPS_VISIVEL, visivel);
	}
	return visivel;
}
