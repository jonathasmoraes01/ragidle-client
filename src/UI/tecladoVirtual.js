/**
 * UI/tecladoVirtual.js — QUANTO DO JOGO O TECLADO DO CELULAR ESCONDE (15/10/2026).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * O RELATO
 * ═══════════════════════════════════════════════════════════════════════
 * *"quando vai digitar pelo celular atualmente o chat buga e fica la em cima,
 * isso nao pode acontecer"* — no iPhone e no Android, no navegador e no app
 * instalado.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * A CAUSA: O JOGO MORA NUM IFRAME
 * ═══════════════════════════════════════════════════════════════════════
 * O PWA (`applications/pwa/index.html`) abre o jogo com `ROBrowser.TYPE.FRAME`.
 * A conta de 08/09 (`escalaDaHud.publicarAlturaDoTeclado`) media
 * `innerHeight - visualViewport.height` do PROPRIO quadro - e o teclado nao
 * encolhe o viewport de um iframe: ele encolhe o da pagina de FORA. Dentro do
 * quadro a conta dava ZERO sempre, e quem resolvia era o navegador, do jeito
 * dele: o iPhone desloca a area visivel (`visualViewport.offsetTop`) e o
 * Android ROLA a pagina de fora para mostrar o campo - e a pagina nem sempre
 * volta quando o teclado fecha. O jogo inteiro fica deslocado para cima.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * A CONTA DE AGORA
 * ═══════════════════════════════════════════════════════════════════════
 * Mede pela area visivel da pagina de FORA (o quadro e da mesma origem), no
 * sistema de coordenadas do quadro:
 *
 *   fundo visivel no quadro = offsetTop + height (da pagina de fora)
 *                             - topo do iframe (o quanto a pagina rolou)
 *   escondido               = altura do quadro - fundo visivel
 *
 * A mesma formula cobre os tres jeitos de o navegador reagir, sem perguntar
 * qual e (testes em `tests/ui/tecladoVirtual.test.js`):
 *   - o iPhone que DESLOCA a area visivel (offsetTop > 0);
 *   - o Android que ROLA a pagina de fora (topo do iframe < 0);
 *   - o Android que ENCOLHE o layout (o quadro encolhe junto: escondido 0).
 *
 * Fora de um iframe (ou com a pagina de fora inacessivel) a conta e a mesma,
 * com o proprio viewport.
 *
 * E quando o teclado FECHA, a pagina de fora volta a posicao zero - e esse o
 * "fica la em cima" do relato.
 *
 * LIMITE DECLARADO: o Chromium do Playwright nao abre teclado de sistema. O
 * que os testes provam e a CONTA; que o chat cole no teclado e pergunta para um
 * telefone.
 */

/** Abaixo disto e a barra do navegador aparecendo/sumindo, e nao teclado. */
export const PISO_DO_TECLADO = 120;

/**
 * Quanto do FUNDO do quadro esta escondido, em px do quadro. Pura.
 *
 * @param {object} m
 * @param {number} m.alturaDoQuadro - o `innerHeight` do quadro do jogo
 * @param {number} m.topoDoQuadro - o topo do iframe na pagina de fora (0 sem iframe)
 * @param {number} m.topoVisivel - `visualViewport.offsetTop` de quem mede
 * @param {number} m.alturaVisivel - `visualViewport.height` de quem mede
 * @returns {number}
 */
export function alturaEscondida({ alturaDoQuadro, topoDoQuadro, topoVisivel, alturaVisivel }) {
	const fundoVisivel = topoVisivel + alturaVisivel - topoDoQuadro;
	const escondida = Math.round(alturaDoQuadro - fundoVisivel);
	return escondida > PISO_DO_TECLADO ? escondida : 0;
}

/**
 * A janela que enxerga o teclado: a de fora, se o jogo esta num iframe da
 * mesma origem; senao, a propria. `frameElement` e `null` entre origens
 * diferentes, e ler o `visualViewport` de fora lanca - os dois caem aqui.
 */
export function janelaQueVeOTeclado(win) {
	try {
		if (win.parent && win.parent !== win && win.frameElement && win.parent.visualViewport) {
			return { de: win.parent, quadro: win.frameElement };
		}
	} catch {
		/* outra origem: mede com o proprio viewport */
	}
	return { de: win, quadro: null };
}

/** A medida de agora, para a janela do jogo. */
export function medirTeclado(win) {
	if (!win || !win.visualViewport) {
		return 0;
	}
	const { de, quadro } = janelaQueVeOTeclado(win);
	const vv = de.visualViewport;
	return alturaEscondida({
		alturaDoQuadro: win.innerHeight,
		topoDoQuadro: quadro ? quadro.getBoundingClientRect().top : 0,
		topoVisivel: vv.offsetTop || 0,
		alturaVisivel: vv.height
	});
}

let _ligado = false;
let _aberto = false;

/**
 * Publica a medida no `documentElement` do jogo:
 *   - `--teclado-altura`: quanto do fundo esta escondido (0 sem teclado);
 *   - `--teclado-aberto`: 1 ou 0, para o CSS trocar a folga do rodape pela do
 *     teclado (com ele aberto a barra de atalhos esta atras dele, e o chat cola
 *     no teclado em vez de ficar uma barra acima).
 * Os dois herdam para dentro de todo Shadow DOM pelo host.
 */
export function publicar(win, doc) {
	const w = win || (typeof window !== 'undefined' ? window : null);
	const d = doc || (typeof document !== 'undefined' ? document : null);
	if (!w || !d || !d.documentElement) {
		return 0;
	}
	const altura = medirTeclado(w);
	const aberto = altura > 0;
	d.documentElement.style.setProperty('--teclado-altura', `${altura}px`);
	d.documentElement.style.setProperty('--teclado-aberto', aberto ? '1' : '0');

	/* O TECLADO FECHOU: a pagina de fora (e a do quadro) voltam ao zero. E o
	   "fica la em cima" do relato - o navegador rolou para mostrar o campo e
	   nao desrolou. So no FECHAR: rolar com o teclado aberto brigaria com o
	   navegador. */
	if (_aberto && !aberto) {
		voltarAoZero(w);
	}
	_aberto = aberto;
	return altura;
}

function voltarAoZero(win) {
	const { de } = janelaQueVeOTeclado(win);
	for (const janela of de === win ? [win] : [de, win]) {
		try {
			if (janela.scrollX || janela.scrollY) {
				janela.scrollTo(0, 0);
			}
		} catch {
			/* nada a desfazer */
		}
	}
}

/**
 * Liga os ouvintes: `resize` E `scroll` do `visualViewport` de quem ve o
 * teclado (o iPhone desloca a area visivel sem redimensionar), e o da propria
 * janela, para o caso de o layout de fora encolher.
 */
export function ligar(doc) {
	if (_ligado || typeof window === 'undefined') {
		return;
	}
	_ligado = true;
	const responder = () => publicar(window, doc || document);
	const { de } = janelaQueVeOTeclado(window);
	const viewports = new Set([window.visualViewport, de.visualViewport].filter(Boolean));
	for (const vv of viewports) {
		vv.addEventListener('resize', responder);
		vv.addEventListener('scroll', responder);
	}
	window.addEventListener('resize', responder);
	responder();
}

/** So para testes: volta o modulo ao estado de fabrica. */
export function desligarParaTeste() {
	_ligado = false;
	_aberto = false;
}

export default {
	PISO_DO_TECLADO,
	alturaEscondida,
	janelaQueVeOTeclado,
	medirTeclado,
	publicar,
	ligar,
	desligarParaTeste
};
