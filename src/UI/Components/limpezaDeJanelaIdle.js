/**
 * FECHAR E ESQUECER — o que toda janela RAGIDLE faz na TROCA DE PERSONAGEM.
 *
 * ===========================================================================
 * O DEFEITO QUE ESTA PECA EXISTE PARA MATAR (auditoria de 30/08/2026)
 * ===========================================================================
 *
 * Trocar de personagem NAO recarrega a pagina: `onRestartAnswer`
 * (Engine/MapEngine.js) chama `cleanGameUI()` + `onRestart()`, sem
 * `GameEngine.reload()`. E `GUIComponent.remove()` apenas DESANEXA o `_host` —
 * o shadow DOM inteiro sobrevive, e `prepare()` e guardado por `__loaded`.
 *
 * As `limparEstadoDoPersonagem` das janelas zeravam so o DADO. O desenho
 * ficava: a janela voltava com `is-open`, com os cards do personagem ANTERIOR
 * escritos por `innerHTML`, e com os listeners vivos nos elementos.
 *
 * O pior caso medido e o `IdleSkills`: a arvore de habilidades do personagem A
 * reaparecia na tela do B, e um clique em "Aprender Nv. X" mandava
 * `CZ_RAGIDLE_APRENDER` com um `skillId` da classe de A **em nome de B**. O
 * servidor recusa (ele valida), mas a janela mentia sobre o que estava
 * oferecendo.
 *
 * Nove janelas tinham a mesma forma. `StatusIdle` e `CodexIdle` ja faziam
 * certo, e o comentario de `CodexIdle` registrava o padrao como conhecido e
 * nao consertado — uma nota historica que ficou pendencia por um dia.
 *
 * ===========================================================================
 * POR QUE UMA PECA SO, E NAO NOVE CONSERTOS IGUAIS
 * ===========================================================================
 *
 * Porque nove copias e como o defeito nasceu. A janela DEZ vai ser escrita
 * copiando uma das que existem, e o que ela copiar e o que vai valer. Com uma
 * funcao, o portao do repo do servidor
 * (`servidor/mapa/janela-idle-esquece-o-desenho.test.ts`) consegue cobrar que
 * TODA `limparEstadoDoPersonagem` a chame — e uma janela nova que esqueca
 * reprova a suite, em vez de virar uma queixa de "vi a ficha do outro
 * personagem" daqui a duas semanas.
 *
 * @param {Element|ShadowRoot|null} root  o `_root()` do componente
 * @param {string} seletorDaJanela        ex.: '.is-window', '.cx-window'
 * @param {{corpo?: string, texto?: string}} [corpoDePartida]
 *        Opcional: um seletor de corpo para devolver ao estado inicial, com o
 *        texto que ele deve mostrar. Sem isto a janela apenas FECHA — o que ja
 *        basta, porque reabrir passa por `toggle()` e `toggle()` pede o pacote
 *        de novo. Com isto, o instante entre reabrir e a resposta chegar
 *        tambem fica limpo, em vez de mostrar o personagem anterior por um
 *        piscar.
 */
export function fecharEEsquecer(root, seletorDaJanela, corpoDePartida) {
	if (!root) {
		return;
	}
	const janela = root.querySelector(seletorDaJanela);
	if (janela) {
		janela.classList.remove('is-open');
	}
	if (corpoDePartida && corpoDePartida.corpo) {
		const corpo = root.querySelector(corpoDePartida.corpo);
		if (corpo) {
			// `textContent`, e nao `innerHTML`: o conteudo de partida e uma
			// frase fixa nossa, e escrever texto como texto tira qualquer
			// duvida sobre o que esta sendo interpretado.
			corpo.textContent = corpoDePartida.texto || 'Carregando…';
		}
	}
}
