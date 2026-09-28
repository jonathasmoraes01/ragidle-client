/**
 * Core/versaoDoCliente.js
 *
 * RAGIDLE: A VERSAO DESTE CLIENTE, que viaja no `Version` do `CA_LOGIN`
 * (28/09/2026, D-1635 do servidor - item 25: o servidor recusa cliente de
 * versao antiga na conexao).
 *
 * ---------------------------------------------------------------------------
 * A FONTE E O BUILD, NUM LUGAR SO
 * ---------------------------------------------------------------------------
 * O build (`applications/tools/builder-web.mjs`) ja carimbava a versao dele -
 * `<versao do package>-AAAAMMDDHHMMSS` (UTC) - no service worker e no
 * registrador da casca. Desde D-1635 ele injeta a MESMA string no jogo
 * (`__RAGIDLE_VERSAO_DO_BUILD__`, pelo `define` do vite), e este modulo e o
 * unico que a converte no numero do login:
 *
 *   carimbo AAAAMMDDHHMMSS  ->  AAMMDDHHMM  (u32; "2609281530" = 28/09/2026 15:30 UTC)
 *
 * Cabe no u32 do `CA_LOGIN` ate 2042. O servidor so compara com um MINIMO que
 * ele sobe de proposito (`servidor/login/versao-do-cliente.ts`); nenhum numero
 * de versao e escrito a mao aqui nem la.
 *
 * SEM BUILD (o `npm run dev`, o vitest), a versao e ZERO e o login manda o
 * `version` da configuracao, como sempre - e o "cliente sem versao de build",
 * que qualquer minimo real recusa.
 *
 * Este arquivo nao importa nada: o builder (Node) tambem o le.
 */

/* global __RAGIDLE_VERSAO_DO_BUILD__ */

/** A versao do build, como o build a escreve; `''` sem build. */
export const VERSAO_DO_BUILD =
	typeof __RAGIDLE_VERSAO_DO_BUILD__ === 'string' ? __RAGIDLE_VERSAO_DO_BUILD__ : '';

/**
 * O numero do login a partir da versao do build: o carimbo de 14 digitos do
 * fim, cortado em AAMMDDHHMM. Sem carimbo, zero.
 */
export function versaoDoCarimbo(versaoDoBuild) {
	const m = /(\d{14})$/.exec(typeof versaoDoBuild === 'string' ? versaoDoBuild : '');
	return m ? Number(m[1].slice(2, 12)) : 0;
}

/** A versao deste cliente no login (zero sem build). */
export const VERSAO_DO_CLIENTE = versaoDoCarimbo(VERSAO_DO_BUILD);

/**
 * O que vai no `Version` do `CA_LOGIN`: a versao do build, e sem ela o
 * `version` da configuracao do servidor (o comportamento de antes).
 */
export function versaoParaOLogin(versaoDaConfiguracao, versaoDoCliente = VERSAO_DO_CLIENTE) {
	return versaoDoCliente > 0 ? versaoDoCliente : parseInt(versaoDaConfiguracao, 10);
}
