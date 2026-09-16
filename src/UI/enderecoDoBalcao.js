/**
 * O ENDERECO DO BALCAO DO SERVIDOR (13/09/2026, auditoria de FPS do iPhone).
 *
 * O relato de erro postava num caminho RELATIVO (`/analytics/erro`). O jogo e
 * servido pela Vercel (`play.roclassicidle.com.br`), e o balcao do servidor mora
 * em `api.roclassicidle.com.br` — o `vercel.json` nao repassa `/analytics` para
 * lugar nenhum. O relato caia no site estatico, voltava "nao existe", e o
 * `.catch` vazio engolia: **nenhum erro de jogador chegou ao servidor em
 * producao** desde que o relato nasceu (09/09/2026).
 *
 * O endereco certo ja existia: o `cadastroUrl` do `Config.local.js` de producao,
 * que a pagina de cadastro usa (`applications/deploy/index.html`). Sem ele (o
 * `npm run dev`), o caminho continua relativo, como antes.
 * Teste: `tests/ui/enderecoDoBalcao.test.js`.
 */
import Configs from 'Core/Configs.js';

/**
 * @param {string} caminho - comecando por `/`
 * @return {string}
 */
export function rotaDoBalcao(caminho) {
	const base = String(Configs.get('cadastroUrl', '') || '').replace(/\/+$/, '');
	return base + caminho;
}
