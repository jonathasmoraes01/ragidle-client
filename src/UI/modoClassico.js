/**
 * O MODO CLASSICO (24/09/2026, ordem do dono): o jogo deixa de jogar sozinho e
 * fica so o ataque original do roBrowser.
 *
 * Palavras dele: "a gente vai desativar todo o sistema idle que a gente tem de
 * auto-ataque e a gente vai ativar o modo de ataque original do roBrowser. A
 * gente vai deixar so o ataque original, sem qualquer configuracao idle."
 *
 * O ataque original ja estava intacto no fork: clicar num mob manda o
 * `CZ_REQUEST_ACT` com `action = 7` (EntityControl.onFocus), e o servidor bate
 * ate o mob morrer. O que este modulo faz e so DECIDIR se a interface do idle
 * aparece: o botao "Ataque auto", a janela de configuracao idle, o Hunt
 * Analyzer com o "Dormir", a economia de energia, a rotacao de skills e o
 * tutorial que ensina a caca automatica. Nada e apagado (escolha do dono): o
 * servidor tem o mesmo interruptor (`servidor/mapa/modo-classico.ts`), e
 * religar e `modoClassico: false` no `Config.local.js`.
 *
 * FALHA PARA LIGADO, como o servidor: sem `ROConfig` (um teste, uma casca
 * minima) vale o modo classico, que e o estado de producao.
 */
export function modoClassicoLigado() {
	try {
		const cfg = typeof window !== 'undefined' ? window.ROConfig : undefined;
		if (cfg && cfg.modoClassico === false) return false;
	} catch (erro) {
		/* casca sem config: segue ligado */
	}
	return true;
}

/**
 * Esconde, dentro de uma raiz (shadow root ou documento), os elementos do idle
 * que o modo classico tira da tela. `display: none` com prioridade, e nao
 * remocao: os componentes continuam lendo o proprio DOM sem quebrar.
 */
export function esconderNoModoClassico(raiz, seletores) {
	if (!raiz || !modoClassicoLigado()) return;
	for (const seletor of seletores) {
		const achados = raiz.querySelectorAll ? raiz.querySelectorAll(seletor) : [];
		for (const el of achados) el.style.setProperty('display', 'none', 'important');
	}
}
