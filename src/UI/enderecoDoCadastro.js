/**
 * O "CRIAR CONTA" DA TELA DE LOGIN LEVA AO SITE COM O CADASTRO ABERTO (23/09/2026).
 *
 * O `registrationweb` de producao e vazio, entao o botao caia no aviso em ingles
 * do roBrowser ("simplified registration... _M/_F"), que nao serve a ninguem
 * aqui. O cadastro de verdade e a janela `#pre-modal` da home, e a home mora no
 * MESMO pacote, no dominio sem o `play.` (`roclassicidle.com.br`). O `#cadastro`
 * faz o `initPreRegistro` do site abrir a janela assim que a pagina monta.
 *
 * Ordem: `registrationweb` explicito vence; sem ele, o dominio do jogo sem o
 * `play.`; sem nenhum dos dois (o `npm run dev` em localhost), `''` e quem chama
 * cai no aviso antigo.
 * Teste: `tests/ui/enderecoDoCadastro.test.js`.
 */

/**
 * @param {string} registrationweb - o `Configs.get('registrationweb')`
 * @param {string} ref - o codigo de indicacao guardado pela casca, ou vazio
 * @param {{ protocol: string, hostname: string }} local - o `window.location`
 * @return {string}
 */
export function enderecoDoCadastro(registrationweb, ref, local) {
	let url = String(registrationweb || '');
	if (!url && local && /^play\./i.test(local.hostname || '')) {
		url = (local.protocol || 'https:') + '//' + local.hostname.replace(/^play\./i, '') + '/';
	}
	if (!url) return '';

	let hash = '';
	const cerquilha = url.indexOf('#');
	if (cerquilha !== -1) {
		hash = url.slice(cerquilha);
		url = url.slice(0, cerquilha);
	}

	// INDIQUE & GANHE (D-1164): o codigo guardado pela casca (`?ref=`) segue
	// para o formulario do site, que o manda no POST /cadastrar.
	if (ref && /^[A-Za-z0-9]{6}$/.test(String(ref))) {
		url += (url.indexOf('?') === -1 ? '?' : '&') + 'ref=' + encodeURIComponent(String(ref).toUpperCase());
	}
	return url + (hash || '#cadastro');
}
