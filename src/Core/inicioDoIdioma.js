/**
 * Core/inicioDoIdioma.js
 *
 * A PARTIDA DO IDIOMA (D-1929): chamada uma vez, antes do motor do jogo
 * subir. Em portugues nao faz nada. Em ingles, marca o `lang` da pagina e
 * busca o catalogo SEM BLOQUEAR a subida: as janelas que nascerem antes de
 * ele chegar ficam registradas e sao traduzidas na chegada
 * (`retraduzirTudo`).
 *
 * @author RagIdle
 */

import { emIngles, idiomaAtual } from 'Core/Idioma.js';
import { carregarCatalogo, faltasDeTraducao } from 'Core/Traducao.js';
import { retraduzirTudo } from 'UI/traducaoDaInterface.js';

/** @type {Promise<boolean>|null} */
let _partida = null;

/**
 * @returns {Promise<boolean>} se o tradutor ligou (sempre false em portugues)
 */
export function iniciarIdioma() {
	if (_partida) {
		return _partida;
	}
	try {
		document.documentElement.lang = idiomaAtual();
	} catch (_e) {
		// sem documento (teste fora do jsdom): nada a marcar
	}
	if (!emIngles()) {
		_partida = Promise.resolve(false);
		return _partida;
	}
	/* A sonda em tela (`scripts/diag-ingles-na-tela.ts` no repositorio do jogo)
	   le o que o tradutor nao achou por aqui. So existe em ingles. */
	window.ragidleIdioma = { faltas: faltasDeTraducao };
	_partida = carregarCatalogo('en').then(ligou => {
		if (ligou) {
			retraduzirTudo();
		}
		return ligou;
	});
	return _partida;
}
