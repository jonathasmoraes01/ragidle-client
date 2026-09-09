/**
 * O RELATO DE ERRO DO CLIENTE (09/09/2026, a frente de Analytics).
 *
 * ---------------------------------------------------------------------------
 * POR QUE ELE EXISTE
 * ---------------------------------------------------------------------------
 * Em 08/09/2026 um erro no init de UM componente derrubou a montagem da HUD e o
 * jogo abriu com A TELA PRETA no login. Ele durou ate o dono reclamar — o
 * servidor nao sabia de nada, porque o erro acontece no navegador da pessoa.
 *
 * Este arquivo faz o navegador CONTAR. Ele nao conserta nada e nao muda o
 * comportamento do jogo: so avisa.
 *
 * ---------------------------------------------------------------------------
 * AS QUATRO REGRAS QUE ELE OBEDECE
 * ---------------------------------------------------------------------------
 * 1. **Nunca atrapalha o jogo.** Tudo dentro de `try`, e o envio e
 *    `fire-and-forget`: se a rota nao existir (servidor antigo), o erro do
 *    `fetch` e engolido. Um relatorio de erro que quebra a pagina seria pior
 *    que o erro que ele relata.
 * 2. **Nao repete.** O mesmo erro dispara em laco de render: sem a memoria de
 *    ja-enviados, um `TypeError` dentro de um `requestAnimationFrame` mandaria
 *    60 relatos por segundo. Cada mensagem distinta vai UMA vez por sessao.
 * 3. **Tem teto por sessao.** Mesmo mensagens distintas param no teto: um jogo
 *    que quebrou de verdade produz erro novo a cada quadro.
 * 4. **Nao manda dado de jogador.** So mensagem, pilha, a tela em que estava e
 *    a versao do build. Nome, conta e personagem ficam de fora: o servidor ja
 *    sabe quem esta conectado, e o relato existe para consertar codigo.
 */
var ROTA = '/analytics/erro';
var TETO_POR_SESSAO = 10;
var jaVistos = {};
var enviados = 0;

function versaoDoBuild() {
	try {
		var meta = document.querySelector('meta[name="ragidle-versao"]');
		return meta ? meta.getAttribute('content') : undefined;
	} catch (e) {
		return undefined;
	}
}

function telaAtual() {
	try {
		// A "tela" e o que o jogador estava vendo: a janela mais recente, ou a URL.
		return String(location.pathname + location.hash).slice(0, 120);
	} catch (e) {
		return undefined;
	}
}

export function relatarErro(mensagem, pilha) {
	try {
		if (!mensagem) return;
		var chave = String(mensagem).slice(0, 300);
		if (jaVistos[chave]) return;
		if (enviados >= TETO_POR_SESSAO) return;
		jaVistos[chave] = true;
		enviados++;
		var corpo = JSON.stringify({
			mensagem: chave,
			pilha: pilha ? String(pilha).slice(0, 1000) : undefined,
			tela: telaAtual(),
			versao: versaoDoBuild(),
		});
		// `keepalive` para o relato sobreviver a navegacao que o proprio erro
		// pode causar. O `catch` vazio e deliberado: ver a regra 1.
		fetch(ROTA, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: corpo,
			keepalive: true,
		}).catch(function () {});
	} catch (e) {
		/* relatar erro nao pode virar erro */
	}
}

/** Liga os dois ganchos do navegador. Idempotente. */
export function ligarRelatoDeErro() {
	if (typeof window === 'undefined' || window.__ragidleRelatoLigado) return;
	window.__ragidleRelatoLigado = true;
	window.addEventListener('error', function (e) {
		relatarErro(e && e.message, e && e.error && e.error.stack);
	});
	// A promessa rejeitada e o caso que mais escapa: ela nao dispara `error`, e
	// e exatamente a forma de um `await` que falhou no carregamento.
	window.addEventListener('unhandledrejection', function (e) {
		var r = e && e.reason;
		relatarErro(r && r.message ? r.message : String(r), r && r.stack);
	});
}
