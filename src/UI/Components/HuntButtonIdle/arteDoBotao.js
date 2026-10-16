/**
 * UI/Components/HuntButtonIdle/arteDoBotao.js
 *
 * A ARTE DOS BOTOES "CACAR" E "RETORNAR" NAO PODE SUMIR CALADA (14/10/2026,
 * relato J20 de TioGabs na Floresta de Payon, o mesmo de 05/10 na Floresta
 * Encantada 2; D-2454 no repositorio do servidor).
 *
 * ---------------------------------------------------------------------------
 * O QUE ACONTECIA
 * ---------------------------------------------------------------------------
 * No desktop cada botao E a imagem (23/09/2026): a arte era o `background-image`
 * do proprio `<button>`, com o rotulo recortado para so o leitor de tela ler.
 * Quando o pedido da arte falhava, o botao ficava na pagina, anexado, ativo,
 * clicavel e INVISIVEL: sem arte, sem moldura e sem texto.
 *
 * E a falha durava. Medido na tela (`scripts/diag-hud-caca-sessao-longa.ts
 * --arte-falha-na-entrada`, no repositorio do servidor): a imagem de fundo e
 * pedida de novo a cada carga de OUTRO mapa (o host fica segundos fora da
 * pagina), mas NAO na Asa de Mosca (sai e volta no mesmo instante). Quem caca
 * parado num mapa so com Asas ficava sem os botoes ate morrer, viajar ou
 * apertar F5. Em producao esse pedido vai a rede a cada carga de mapa: o
 * `sw.js` revalida o que nao tem carimbo (`cache: 'no-cache'`) e a Vercel serve
 * a arte com `max-age=0`. Uma queda de rede de segundos na hora certa bastava.
 *
 * A rede da HUD (`Engine/redeDaHud.js`) nao via nada disso: ela confere se o
 * componente esta ANEXADO, e ele estava. A sonda de 05/10 media o host, a caixa
 * e quem responde ao toque - tudo "ok" com o botao invisivel.
 *
 * ---------------------------------------------------------------------------
 * O QUE ESTE ARQUIVO FAZ
 * ---------------------------------------------------------------------------
 * A arte vira um `<img>` dentro do botao (o desenho e o mesmo: a caixa tem a
 * proporcao da arte). O `<img>` tem estado observavel (`load`/`error`) e guarda
 * a imagem quando o host sai e volta da pagina: a carga de mapa nao pede nada.
 *
 *   1. Ate a arte carregar, o botao tem a classe `hb-sem-arte` e o CSS do
 *      desktop desenha o `.ri-btn` azul com o rotulo: o botao NUNCA fica sem
 *      nada visivel, nem com a arte pendurada num pedido que nao responde.
 *   2. A falha agenda uma nova tentativa sozinha, com espera crescente, numa URL
 *      nova (o pedido que falhou nao volta da memoria do navegador).
 *   3. A primeira falha de cada botao vai ao `/analytics/erro`: a proxima
 *      ocorrencia em producao chega a alguem.
 *   4. A nova tentativa tem TETO e PAUSA (ML12, achados baixos do critico da D-2454):
 *      depois de `MAXIMO_DE_FALHAS` falhas seguidas ela para (o botao segue na reserva,
 *      legivel e clicavel; o desafio do Cloudflare que nao passa so se resolve com F5, e
 *      numa sessao de 10 h eram ~1.200 pedidos 403 por jogador), e a proxima carga de mapa
 *      recomeca a rodada. Com a aba oculta nenhum pedido sai.
 *
 * Sem import e sem DOM proprio: os relogios e o relato entram por parametro, e
 * o teste roda no jsdom (`tests/ui/arteDoBotaoDaHud.test.js`).
 */

/**
 * As esperas entre as tentativas, em ms. A rede que caiu costuma voltar em
 * segundos; a ultima espera se repete enquanto a arte nao vier. Nao e numero do
 * jogo (nada do rAthena): e a cadencia de um pedido de imagem que falhou.
 */
export const ESPERAS_DA_NOVA_TENTATIVA_MS = [2000, 5000, 15000, 30000, 60000];

/**
 * O teto (ML12): a falha numero 8 (o pedido de entrada e sete repeticoes, uns 4 minutos) encerra a rodada. Daqui em
 * diante so a proxima carga de mapa, ou a troca de idioma, pede de novo.
 */
export const MAXIMO_DE_FALHAS = 8;

/** Com a aba oculta o relogio so olha de novo a cada tanto, sem pedir nada (ML12). */
export const ESPERA_COM_A_ABA_OCULTA_MS = 60000;

/** A classe da reserva: o CSS do desktop desenha o `.ri-btn` com o rotulo. */
export const CLASSE_SEM_ARTE = 'hb-sem-arte';

/**
 * @param {object} opcoes
 * @param {HTMLImageElement} opcoes.img - o `<img class="hb-arte">` do botao
 * @param {HTMLElement} opcoes.botao - o `<button>` que ganha e perde a reserva
 * @param {string} opcoes.nome - quem e, no relato (`cacar`, `voltar`)
 * @param {(fn: Function, ms: number) => unknown} [opcoes.agendar]
 * @param {(id: unknown) => void} [opcoes.desagendar]
 * @param {((mensagem: string) => void) | null} [opcoes.relatar]
 * @param {() => boolean} [opcoes.abaOculta] - `true` com a aba escondida: a nova tentativa espera, sem pedir (ML12)
 * @returns {{ usar: (url: string) => void }}
 */
export function criarArteDoBotao({
	img,
	botao,
	nome,
	agendar = (fn, ms) => setTimeout(fn, ms),
	desagendar = id => clearTimeout(id),
	relatar = null,
	abaOculta = () => false
}) {
	let url = null;
	let tentativa = 0;
	let relogio = null;
	let relatou = false;
	let desistiu = false;

	const pedir = () => {
		relogio = null;
		img.src = tentativa === 0 ? url : `${url}?tentativa=${tentativa}`;
	};

	// So a REPETICAO espera a aba voltar: o primeiro pedido sai na hora, como sempre (a arte chega pronta).
	const repetir = () => {
		relogio = null;
		if (abaOculta()) {
			relogio = agendar(repetir, ESPERA_COM_A_ABA_OCULTA_MS);
			return;
		}
		pedir();
	};

	const cancelar = () => {
		if (relogio !== null) {
			desagendar(relogio);
			relogio = null;
		}
	};

	img.addEventListener('load', () => {
		botao.classList.remove(CLASSE_SEM_ARTE);
	});

	img.addEventListener('error', () => {
		if (url === null || desistiu) {
			return;
		}
		botao.classList.add(CLASSE_SEM_ARTE);
		if (!relatou && relatar) {
			relatou = true;
			relatar(`[hud] a arte do botao ${nome} nao carregou: ${url}`);
		}
		const espera = ESPERAS_DA_NOVA_TENTATIVA_MS[Math.min(tentativa, ESPERAS_DA_NOVA_TENTATIVA_MS.length - 1)];
		tentativa++;
		cancelar();
		if (tentativa >= MAXIMO_DE_FALHAS) {
			// O botao fica na reserva (legivel e clicavel). Dizer que parou: se a telemetria so mostrasse a primeira falha,
			// a rodada que nao se resolveu nunca chegaria a ninguem.
			desistiu = true;
			if (relatar) {
				relatar(`[hud] a arte do botao ${nome} desistiu depois de ${tentativa} falhas: ${url}`);
			}
			return;
		}
		relogio = agendar(repetir, espera);
	});

	return {
		/**
		 * Poe (ou troca, no idioma) a arte. A mesma URL de novo nao pede nada, EXCETO depois de a rodada desistir (ML12): ai
		 * a carga de mapa seguinte recomeca, que e o que o F5 fazia a mao.
		 */
		usar(nova) {
			if (nova === url && !desistiu) {
				return;
			}
			url = nova;
			tentativa = 0;
			desistiu = false;
			cancelar();
			pedir();
		}
	};
}
