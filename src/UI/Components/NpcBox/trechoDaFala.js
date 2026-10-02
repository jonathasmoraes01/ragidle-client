/**
 * UI/Components/NpcBox/trechoDaFala.js
 *
 * QUAL TRECHO DA FALA DO NPC TEM TRADUCAO? (D-1929, o jogo em ingles)
 *
 * O servidor quebra a fala em linhas de 116 caracteres, e o catalogo tem a
 * PAGINA (ou o titulo sozinho, "[Guardia da Praca]"). A cada linha nova, o
 * trecho que termina nela e tentado do mais longo (a pagina inteira) ao mais
 * curto (so a linha nova): o primeiro que casa vence.
 *
 * Puro, para o teste nao precisar montar a caixa de dialogo.
 *
 * @author RagIdle
 */

import { traducaoDe } from 'Core/Traducao.js';

/**
 * @param {string[]} textos - as linhas cruas da pagina, a ultima e a nova
 * @returns {{inicio: number, texto: string, traducao: string}|null}
 */
export function trechoTraduzido(textos) {
	for (let inicio = 0; inicio < textos.length; inicio++) {
		const texto = textos.slice(inicio).join(' ');
		const traducao = traducaoDe(texto);
		if (traducao !== null) {
			return { inicio, texto, traducao };
		}
	}
	return null;
}
