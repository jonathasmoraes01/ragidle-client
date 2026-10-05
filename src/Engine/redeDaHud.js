/**
 * A REDE DA HUD (05/10/2026, relato de jogador na Floresta Encantada 2,
 * `mosk_dun02`: os botoes "Caçar" e "Retornar para Prontera" somem e so voltam
 * relogando).
 *
 * ---------------------------------------------------------------------------
 * O MECANISMO QUE PRODUZ EXATAMENTE ESSE SINTOMA
 * ---------------------------------------------------------------------------
 * Toda entrada no mapa — inclusive o teleporte no MESMO mapa (a Asa de Mosca e
 * a Asa automatica do VIP) — passa por `MapRenderer.setMap`, que TIRA todos os
 * componentes da pagina (`UIManager.removeComponents`), e depois por
 * `MapRenderer.onLoad` (o closure de `onMapChange`, Engine/MapEngine.js), que
 * os anexa de volta UM A UM, em ~80 chamadas seguidas. O `HuntButtonIdle` e o
 * ULTIMO deles, logo depois do `TopMenuIdle` (cujo `onAppend` roda quinze
 * sincronizacoes).
 *
 * Uma excecao em QUALQUER `append()`/`onAppend()` anterior interrompe o resto
 * da lista. Quem chama `onLoad` a engole com um `console.error`
 * (`MapRenderer.js`, F28) para o jogo nao congelar — entao a tela segue viva,
 * so que sem os componentes que vinham depois do que lancou. E como o estado
 * que fez lancar costuma ser do MODULO (e nao do mapa), a proxima Asa lanca de
 * novo: quem desfaz e so recarregar a pagina, que zera o estado de modulo —
 * o "so volta relogando" do relato.
 *
 * NAO REPRODUZIDO na tela (`scripts/diag-floresta-encantada-na-tela.ts`, no
 * repositorio do servidor: chegada, Asa, janela que encolhe, aba escondida,
 * economia de energia e morte, no desktop e no celular — os botoes ficaram
 * de pe em todos). Por isso esta rede faz DUAS coisas, e nao uma:
 *
 *   1. garante os controles que o jogador nao tem outro jeito de reabrir: o
 *      que a lista nao anexou, ela anexa — cada um no SEU `try`, para um
 *      componente quebrado nao levar o vizinho junto;
 *   2. RELATA o que lancou (`relatarErro`, o `/analytics/erro` com a pilha),
 *      porque o `console.error` do jogador nunca chega a ninguem. A proxima
 *      ocorrencia em producao traz a pilha que esta investigacao nao teve.
 *
 * E agendada no COMECO de `onLoad`, como a rede do `CZ_NOTIFY_ACTORINIT`
 * (F28): no caminho normal ela roda depois de tudo, ve todos ativos e nao faz
 * nada.
 */

/**
 * @param {ReadonlyArray<{ name?: string, __active?: boolean, append: Function }>} componentes
 * @param {{ relatar?: (mensagem: string, pilha?: string) => void, agendar?: (fn: Function) => void }} [opcoes]
 */
export function agendarRedeDaHud(componentes, opcoes = {}) {
	const agendar = opcoes.agendar || (fn => setTimeout(fn, 0));
	agendar(() => garantirHud(componentes, opcoes.relatar));
}

/**
 * Anexa o que nao esta ativo. Devolve os nomes que precisaram da rede.
 *
 * @returns {string[]}
 */
export function garantirHud(componentes, relatar) {
	const resgatados = [];
	for (const componente of componentes) {
		if (!componente || componente.__active) {
			continue;
		}
		const nome = componente.name || '(sem nome)';
		resgatados.push(nome);
		try {
			componente.append();
		} catch (erro) {
			console.error('[hud] ' + nome + ' nao anexou nem pela rede:', erro);
			if (relatar) {
				relatar('[hud] ' + nome + ' nao anexou: ' + (erro && erro.message), erro && erro.stack);
			}
		}
	}
	if (resgatados.length > 0 && relatar) {
		// Chegar aqui ja e o defeito: a lista de `onLoad` parou antes deles.
		relatar('[hud] a entrada no mapa parou antes de anexar: ' + resgatados.join(', '));
	}
	return resgatados;
}
