/**
 * Core/Idioma.js
 *
 * O IDIOMA DO APARELHO (D-1929, 01/10/2026 — o jogo em ingles).
 *
 * O servidor continua falando portugues; quem traduz e o cliente, na borda
 * (`Core/Traducao.js`). Este modulo so guarda QUAL idioma o jogador escolheu,
 * no localStorage (`Preferences`, chave `Idioma`), e responde as perguntas
 * que o resto do cliente faz: "estou em ingles?", "que locale formata os
 * numeros?", "ja escolheu, ou o passo zero do tutorial ainda precisa
 * perguntar?".
 *
 * O PADRAO E PORTUGUES, de proposito: quem ja joga nao ve nada mudar no dia
 * do deploy. O estrangeiro escolhe no botao da tela de login, no passo zero
 * do tutorial ou nas Configuracoes.
 *
 * Trocar de idioma RECARREGA o jogo (quem chama decide como; ver
 * `trocarIdioma` no componente da escolha). Cada janela e montada uma vez, e
 * recarregar e o caminho que nunca deixa meia tela num idioma e meia noutro.
 *
 * @author RagIdle
 */

import Preferences from 'Core/Preferences.js';

/** Os idiomas que o jogo fala. A ordem e a da janela de escolha. */
export const IDIOMAS = Object.freeze([
	Object.freeze({ codigo: 'pt-BR', nome: 'Português (BR)', bandeira: 'br', locale: 'pt-BR' }),
	Object.freeze({ codigo: 'en', nome: 'English', bandeira: 'us', locale: 'en-US' })
]);

/** O idioma de quem nunca escolheu: o de sempre. */
export const IDIOMA_PADRAO = 'pt-BR';

/** A versao da chave no localStorage. Mudar APAGA a escolha de todo mundo. */
const VERSAO_DA_PREFERENCIA = 1.0;

let _preferencia = null;

function preferencia() {
	if (!_preferencia) {
		_preferencia = Preferences.get('Idioma', { codigo: null, escolhido: false }, VERSAO_DA_PREFERENCIA);
	}
	return _preferencia;
}

/**
 * @param {string} codigo
 * @returns {boolean} se o jogo fala esse idioma
 */
export function idiomaConhecido(codigo) {
	return IDIOMAS.some(i => i.codigo === codigo);
}

/** @returns {string} o codigo do idioma em uso (`pt-BR` ou `en`) */
export function idiomaAtual() {
	const codigo = preferencia().codigo;
	return idiomaConhecido(codigo) ? codigo : IDIOMA_PADRAO;
}

/** @returns {boolean} se o jogo deve aparecer em ingles */
export function emIngles() {
	return idiomaAtual() === 'en';
}

/**
 * Se o jogador JA ESCOLHEU (por qualquer porta). O passo zero do tutorial so
 * pergunta a quem nao escolheu — quem chegou em ingles pelo botao do login
 * nao responde de novo.
 */
export function idiomaFoiEscolhido() {
	return preferencia().escolhido === true && idiomaConhecido(preferencia().codigo);
}

/** @returns {string} o locale de `toLocaleString`/`Intl` para o idioma em uso */
export function localeDoIdioma() {
	const idioma = IDIOMAS.find(i => i.codigo === idiomaAtual());
	return idioma ? idioma.locale : 'pt-BR';
}

/**
 * Grava a escolha. NAO recarrega: quem chama decide (o passo zero recarrega
 * mantendo a sessao; o login recarrega a pagina).
 *
 * @param {string} codigo
 * @returns {boolean} se mudou de idioma (false quando ja era esse)
 */
export function definirIdioma(codigo) {
	if (!idiomaConhecido(codigo)) {
		throw new Error(`idioma desconhecido: ${String(codigo)} (o jogo fala ${IDIOMAS.map(i => i.codigo).join(', ')})`);
	}
	const p = preferencia();
	const mudou = idiomaAtual() !== codigo;
	p.codigo = codigo;
	p.escolhido = true;
	p.save();
	return mudou;
}

/** So para os testes: esquece o que foi lido do localStorage. */
export function esquecerIdiomaLido() {
	_preferencia = null;
}
