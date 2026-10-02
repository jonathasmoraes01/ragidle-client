/**
 * DB/tabelasNoIdioma.js
 *
 * AS TABELAS DO GRF NO IDIOMA DO JOGADOR (D-1929).
 *
 * Nome e descricao de item, nome de mapa e as mensagens do cliente vem de
 * tabelas do GRF servidas pelo servidor de arquivos do jogo. Em ingles, o
 * cliente pede O MESMO arquivo sob `data/english/` — um caminho proprio do
 * idioma, para o cache do PWA nunca misturar os dois —, e o servidor de
 * arquivos responde com a fonte inglesa (o `kRO.lua` versionado, o
 * `mapnametable` ingles do GRF, a coluna inglesa do `msgstringtable`).
 *
 * Se o caminho ingles falhar (um servidor de arquivos antigo, por exemplo), o
 * DBManager cai no portugues: nome em portugues e melhor que nome nenhum.
 *
 * @author RagIdle
 */

import { emIngles } from 'Core/Idioma.js';

/** As tabelas que tem versao inglesa. As outras (sprites, recursos) nao dependem de idioma. */
export const TABELAS_TRADUZIDAS = Object.freeze([
	'data/mapnametable.txt',
	'data/msgstringtable.txt',
	'data/msgstringtable.csv',
	'data/num2itemdisplaynametable.txt',
	'data/num2itemdesctable.txt',
	'data/idnum2itemdisplaynametable.txt',
	'data/idnum2itemdesctable.txt'
]);

/**
 * @param {string} caminho - o caminho portugues (o de sempre)
 * @param {boolean} [ingles] - injetavel no teste; o padrao e o idioma do aparelho
 * @returns {string} o caminho a pedir primeiro
 */
export function caminhoDaTabela(caminho, ingles = emIngles()) {
	if (ingles && TABELAS_TRADUZIDAS.includes(caminho)) {
		return caminho.replace(/^data\//, 'data/english/');
	}
	return caminho;
}
