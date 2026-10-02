/*
 * A VERSAO PUBLICADA SAI DO MESMO PASSO QUE O JOGO (29/09/2026, D-1822 do
 * servidor - o achado #13 da revisao).
 *
 * `versao-do-cliente.json` diz ao servidor e a casca qual versao do jogo esta
 * no ar: o servidor usa o `login` como minimo do login depois de uma carencia
 * (D-1646), e o jogo sem service worker o le para descobrir que ha versao nova.
 *
 * Ele era escrito por `copyPwaFiles`, no passo da CASCA. Um build parcial
 * (`--PWA` sem `-O`) escrevia entao um carimbo NOVO sem compilar o `Online.js`
 * - o jogo servido continuava o de antes. Dez minutos depois o servidor subia
 * o minimo para uma versao que nenhum jogo no ar manda, e todo login era
 * recusado ate o botao de emergencia.
 *
 * A regra agora: o arquivo so e escrito no passo que COMPILA o `Online.js`, e
 * so com o carimbo que foi compilado dentro dele - conferido lendo o arquivo
 * gerado, e nao suposto. O build parcial da casca nao o toca: o que esta no
 * `dist` continua sendo o do ultimo `Online.js` compilado.
 *
 * O servidor tem a outra trava (so sobe o minimo depois de um login real com a
 * versao nova); esta e a do lado que publica.
 */
import fs from 'fs';
import { versaoDoCarimbo } from '../../src/Core/versaoDoCliente.js';

/** O nome do arquivo, ao lado do jogo. */
export const ARQUIVO_DA_VERSAO = 'versao-do-cliente.json';

/**
 * Antes de compilar o `Online.js`: tira o arquivo da versao de antes. Se a
 * compilacao falhar, o `dist` fica SEM versao publicada - e o servidor, sem
 * conseguir ler, mantem o minimo onde estava (D-1646, regra 3). Um arquivo
 * velho ao lado de um jogo que nao compilou diria uma versao que ninguem sabe
 * se esta no ar.
 */
export function apagarVersaoPublicada(destino) {
	fs.rmSync(destino + '/' + ARQUIVO_DA_VERSAO, { force: true });
}

/**
 * Depois de compilar o `Online.js`: escreve a versao que foi compilada DENTRO
 * dele. Lanca (e nao escreve) se o jogo gerado nao traz essa versao - seria
 * publicar um numero que o jogo nao manda no login.
 *
 * @param {string} destino a pasta do build (`dist/Web`).
 * @param {string} versaoDoBuild `<versao do package>-AAAAMMDDHHMMSS`, a mesma do `define`.
 * @returns {{ versao: string, login: number }} o que foi escrito.
 */
export function escreverVersaoPublicada(destino, versaoDoBuild) {
	const login = versaoDoCarimbo(versaoDoBuild);
	if (login === 0) {
		throw new Error('versao-do-cliente.json: a versao do build "' + versaoDoBuild + '" nao traz o carimbo AAAAMMDDHHMMSS');
	}
	const jogo = fs.readFileSync(destino + '/Online.js', 'utf8');
	if (!jogo.includes(versaoDoBuild)) {
		throw new Error(
			'versao-do-cliente.json NAO foi escrito: o Online.js gerado nao traz a versao ' +
				versaoDoBuild +
				' - o numero publicado nao seria o que o jogo manda no login'
		);
	}
	const conteudo = { versao: versaoDoBuild, login };
	fs.writeFileSync(destino + '/' + ARQUIVO_DA_VERSAO, JSON.stringify(conteudo) + '\n', { encoding: 'utf8' });
	return conteudo;
}
