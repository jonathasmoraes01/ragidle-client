/**
 * Audio/retomadaDoBGM.js
 *
 * O BGM QUE O NAVEGADOR BARROU VOLTA NO PRIMEIRO GESTO (relato J12 da comunidade, 15/10/2026: "Musica de Prontera").
 *
 * O navegador so deixa tocar audio com som depois de um gesto do jogador na pagina (a politica de autoplay). O
 * `BGM.load` chama `audio.play()` e, barrado, so escrevia "Failed to play" no console: a musica ficava parada ate o
 * proximo `BGM.play`, que so vem na proxima troca de mapa. O caso que pega o jogador e entrar no mapa SEM ter tocado
 * na pagina: a retomada depois da atualizacao automatica (D-997) recarrega a aba e entra direto no personagem, sem
 * clique, e quem estava parado em Prontera ficava em silencio la ate sair da cidade. A tela de login tambem sofre: a
 * musica de abertura (`GameEngine`, 01.mp3) e chamada antes de qualquer gesto.
 *
 * Aqui: barrado pela politica (`NotAllowedError`), o BGM se arma para tentar de novo no primeiro gesto (os eventos que
 * o navegador conta como ativacao), uma vez so. `BGM.stop` desarma: a musica parada de proposito nao volta com um
 * clique.
 */

/** Os eventos que o navegador conta como gesto do jogador (ativacao do usuario). */
export const GESTOS_DO_JOGADOR = ['pointerdown', 'keydown', 'touchend'];

/**
 * @param {unknown} erro - a rejeicao de `audio.play()`
 * @returns {boolean} se foi a politica de autoplay (e nao arquivo ausente, formato ou troca de faixa no meio)
 */
export function ehBloqueioDeAutoplay(erro) {
	return !!erro && /** @type {{name?: string}} */ (erro).name === 'NotAllowedError';
}

/**
 * Arma `tocar` para o primeiro gesto em `alvo`. Dispara uma vez e se desarma sozinha.
 *
 * @param {EventTarget} alvo - o `document` do jogo
 * @param {() => void} tocar
 * @returns {() => void} desarmar (sem efeito depois de disparar)
 */
export function armarRetomadaNoGesto(alvo, tocar) {
	let armada = true;
	const desarmar = () => {
		if (!armada) {
			return;
		}
		armada = false;
		for (const gesto of GESTOS_DO_JOGADOR) {
			alvo.removeEventListener(gesto, disparar, true);
		}
	};
	function disparar() {
		if (!armada) {
			return;
		}
		desarmar();
		tocar();
	}
	for (const gesto of GESTOS_DO_JOGADOR) {
		alvo.addEventListener(gesto, disparar, true);
	}
	return desarmar;
}
