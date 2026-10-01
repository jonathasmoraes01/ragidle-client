/**
 * UI/balaoDaHud.js
 *
 * OS BALOES DA HUD QUE O ESC E O VOLTAR DO ANDROID FECHAM (01/10/2026).
 *
 * Um balao e um painel pequeno, ancorado num botao da HUD, que NAO e janela da
 * `pilhaDeJanelas`: registra-lo la marcaria o host de quem o abriu com
 * `.ri-janela` e o transformaria em painel de tela cheia no celular (D-932) —
 * o cartao de missoes inteiro viraria uma folha cobrindo o jogo. Mas o ESC e o
 * voltar do Android precisam fecha-lo PRIMEIRO, e o voltar com nada aberto
 * pergunta se o jogador quer sair do jogo.
 *
 * ─── POR QUE UM MODULO NOVO, E NAO O GANCHO DO SELETOR DE NIVEL ─────────
 * O seletor de nivel da barra (D-1908) resolveu o mesmo problema com UM lugar
 * (`registrarFechamentoDoSeletor`, `nivelDeUso.js`). Reusar aquele lugar para
 * o painel de informacoes da missao faria os dois baloes apagarem o registro
 * um do outro: abrir o painel com o seletor aberto substituiria o fechamento
 * do seletor, e o fechar do painel (que zera o registro) deixaria o seletor
 * aberto sem ninguem que o feche no ESC. Aqui ha uma LISTA: cada balao entra
 * com um nome, sai pelo proprio nome, e o ESC fecha o ultimo aberto — um
 * passo, uma desfeita, como o resto da pilha.
 *
 * O seletor continua no lugar dele, intocado: a pilha pergunta por ele e,
 * logo depois, por esta lista (`pilhaDeJanelas.aoEscapar`).
 *
 * Este arquivo nao importa nada: a pilha o importa sem risco de ciclo.
 */

/** Os baloes abertos, na ORDEM DE ABERTURA (o ultimo e o topo). */
const _abertos = [];

/**
 * Quem abriu um balao diz como fecha-lo. Abrir de novo com o mesmo nome
 * substitui o registro anterior (e o leva ao topo): um nome, um balao.
 *
 * @param {string} nome
 * @param {() => void} fechar
 */
export function abrirBalao(nome, fechar) {
	if (!nome || typeof fechar !== 'function') {
		return;
	}
	esquecerBalao(nome);
	_abertos.push({ nome, fechar });
}

/** O balao fechou por conta propria (clique fora, botao fechar): sai da lista. */
export function esquecerBalao(nome) {
	const i = _abertos.findIndex(b => b.nome === nome);
	if (i !== -1) {
		_abertos.splice(i, 1);
	}
}

/**
 * Fecha o ultimo balao aberto. Devolve se fechou — e a pergunta que a pilha
 * faz no ESC e no voltar do Android.
 *
 * O registro sai ANTES de chamar o `fechar`: um `fechar` que chame
 * `esquecerBalao` (o caminho normal) nao acha nada para tirar, e um que lance
 * nao deixa o balao preso na lista para sempre.
 */
export function fecharBalaoDaHud() {
	const topo = _abertos.pop();
	if (!topo) {
		return false;
	}
	topo.fechar();
	return true;
}

/** Ha balao aberto? (So leitura — para os testes e para quem precisa saber.) */
export function temBalaoAberto() {
	return _abertos.length > 0;
}

/** So para os testes: volta ao estado de modulo recem-carregado. */
export function _zerarBaloesDaHud() {
	_abertos.length = 0;
}
