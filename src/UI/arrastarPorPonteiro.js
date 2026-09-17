/**
 * UI/arrastarPorPonteiro.js
 *
 * ARRASTAR JANELA COM O DEDO — o que o `draggable()` do roBrowser não faz
 * (17/09/2026, D-1564).
 *
 * ## O defeito que este módulo existe para não repetir
 *
 * `GUIComponent.prototype.draggable()` escuta `mousedown` e `touchstart` e
 * então lê a posição do ponteiro em `Mouse.screen` a cada quadro. No toque isso
 * **não anda**: `Core/Mobile.js` marca `_daUI` no `touchstart` que nasce dentro
 * de um `[data-gui-component]` e, a partir daí, o `onTouchMove` **retorna antes
 * de atualizar `Mouse.screen`**. O laço continua rodando e lendo o mesmo ponto:
 * a janela fica colada no dedo sem sair do lugar.
 *
 * Ninguém tinha notado porque no celular em pé as janelas são fixadas por CSS
 * (painel de tela cheia, D-932), então não há o que arrastar. Quando o dono
 * pediu janelas MOVÍVEIS — o placar do MVP e a lista de grupo —, o caminho do
 * dedo passou a importar.
 *
 * ## Por que ponteiro, e não mouse+touch
 *
 * `pointerdown`/`pointermove` já vêm de mouse, dedo e caneta, e o
 * `setPointerCapture` continua entregando o movimento quando o ponteiro sai da
 * alça — que é o caso comum de quem arrasta rápido. A alternativa (ouvir
 * `mousemove` no documento) exige lembrar de remover o ouvinte, e ouvinte
 * esquecido é vazamento que este fork já pagou.
 *
 * O molde é o `ligarGesto` do `ChatBox`, que é o único arrasto deste cliente
 * que funciona no dedo hoje. Ele NÃO foi movido para cá: o do chat mede altura,
 * largura, canto e teclado virtual, e generalizar as quatro para servir a duas
 * janelas simples seria trocar código que funciona por abstração. O que veio
 * foi o PADRÃO — e este arquivo é onde ele passa a morar para a próxima janela.
 *
 * This file is part of the ragidle fork of ROBrowser.
 */

/** A folga mínima entre a janela e a borda da tela, em px. */
const MARGEM = 8;

/** A que distância da borda a janela encaixa nela. */
const ENCAIXE = 16;

function prender(valor, minimo, maximo) {
	return Math.min(Math.max(valor, minimo), Math.max(minimo, maximo));
}

/**
 * Onde a janela pode ficar, dado o tamanho dela AGORA.
 *
 * A conta é refeita a cada arrasto de propósito: a janela minimiza, a tela gira
 * e o teclado abre — guardar o limite do primeiro arrasto deixaria a janela
 * presa a uma tela que já não existe.
 */
function limites(painel) {
	const caixa = painel.getBoundingClientRect();
	return {
		larg: caixa.width,
		alt: caixa.height,
		maxEsquerda: Math.max(MARGEM, window.innerWidth - caixa.width - MARGEM),
		maxTopo: Math.max(MARGEM, window.innerHeight - caixa.height - MARGEM),
	};
}

/**
 * Põe a janela dentro da tela, mantendo a posição que ela já tem.
 *
 * Serve para três momentos: ao restaurar a posição guardada (a tela de hoje
 * pode ser menor que a de ontem), ao girar o aparelho e ao terminar um arrasto.
 */
export function prenderNaTela(painel) {
	if (!painel) {
		return;
	}
	const { maxEsquerda, maxTopo } = limites(painel);
	const caixa = painel.getBoundingClientRect();
	painel.style.left = `${Math.round(prender(caixa.left, MARGEM, maxEsquerda))}px`;
	painel.style.top = `${Math.round(prender(caixa.top, MARGEM, maxTopo))}px`;
}

/**
 * Liga o arrasto de `painel` pela `alca`.
 *
 * - `aoSoltar({left, top})` roda UMA vez por arrasto, no soltar. É lá que quem
 *   chama grava a posição: `pointermove` dispara dezenas de vezes por segundo e
 *   `localStorage.setItem` é síncrono.
 * - `classe` entra no painel durante o gesto (para o CSS tirar transição).
 * - Chamar duas vezes na mesma alça não duplica ouvinte.
 *
 * Devolve `true` se ligou, `false` se não havia o que ligar — quem chama não
 * precisa checar, mas o teste precisa.
 */
export default function arrastarPorPonteiro({ alca, painel, aoSoltar, classe = 'ri-arrastando' }) {
	if (!alca || !painel || alca.dataset.arrastoLigado === '1') {
		return false;
	}
	alca.dataset.arrastoLigado = '1';
	// Sem isto o navegador do celular ROLA A PÁGINA em vez de arrastar a
	// janela: o gesto vertical é dele antes de ser nosso.
	alca.style.touchAction = 'none';

	let inicio = null;

	alca.addEventListener('pointerdown', (event) => {
		// Botão direito e do meio não arrastam (o direito abre menu de item).
		if (event.button !== undefined && event.button !== 0) {
			return;
		}
		/*
		 * BOTÃO DENTRO DA ALÇA NÃO ARRASTA — e sem esta guarda ele também não
		 * CLICA.
		 *
		 * `preventDefault()` num `pointerdown` cancela os eventos de mouse de
		 * compatibilidade que viriam depois, e o `click` é um deles. O "−" do
		 * placar do MVP mora dentro da alça: o gesto engolia o clique dele, e o
		 * minimizar simplesmente não fazia nada — o relato do dono
		 * (17/09/2026), medido pela sonda de tela depois.
		 *
		 * `stopPropagation` no próprio botão NÃO resolveria: o ouvinte de
		 * arrasto está na alça e roda antes, no `pointerdown`.
		 */
		const alvo = event.target;
		if (alvo && typeof alvo.closest === 'function' && alvo.closest('button')) {
			return;
		}
		event.preventDefault();
		const caixa = painel.getBoundingClientRect();
		/*
		 * O CARIMBO É O QUE FAZ O ARRASTO VALER NO CELULAR.
		 *
		 * As regras do retrato (`Common.css`) são `!important` e venceriam a
		 * posição inline que este helper escreve: a janela voltaria sozinha
		 * para o canto no instante em que o dedo soltasse, e o gesto pareceria
		 * quebrado. As regras cedem a `:not([data-movido])`.
		 *
		 * Ele mora AQUI, e não em cada janela: a primeira versão o tinha só no
		 * placar do MVP, e a sonda de tela achou a faixa de grupo voltando ao
		 * canto — o mesmo defeito, na segunda janela, no mesmo dia.
		 */
		painel.dataset.movido = '1';
		inicio = { x: event.clientX, y: event.clientY, esquerda: caixa.left, topo: caixa.top };
		painel.classList.add(classe);
		alca.setPointerCapture(event.pointerId);
	});

	alca.addEventListener('pointermove', (event) => {
		if (inicio === null || !alca.hasPointerCapture(event.pointerId)) {
			return;
		}
		const { maxEsquerda, maxTopo } = limites(painel);
		let esquerda = prender(inicio.esquerda + (event.clientX - inicio.x), MARGEM, maxEsquerda);
		let topo = prender(inicio.topo + (event.clientY - inicio.y), MARGEM, maxTopo);
		// ENCAIXE: janela que quase encosta na borda parece defeito, e acertar
		// 0px à mão com o jogo rodando não acontece.
		if (esquerda - MARGEM < ENCAIXE) {
			esquerda = MARGEM;
		}
		if (maxEsquerda - esquerda < ENCAIXE) {
			esquerda = maxEsquerda;
		}
		if (topo - MARGEM < ENCAIXE) {
			topo = MARGEM;
		}
		if (maxTopo - topo < ENCAIXE) {
			topo = maxTopo;
		}
		painel.style.left = `${Math.round(esquerda)}px`;
		painel.style.top = `${Math.round(topo)}px`;
	});

	const soltar = (event) => {
		if (inicio === null || !alca.hasPointerCapture(event.pointerId)) {
			return;
		}
		alca.releasePointerCapture(event.pointerId);
		painel.classList.remove(classe);
		inicio = null;
		if (typeof aoSoltar === 'function') {
			const caixa = painel.getBoundingClientRect();
			aoSoltar({ left: Math.round(caixa.left), top: Math.round(caixa.top) });
		}
	};
	alca.addEventListener('pointerup', soltar);
	alca.addEventListener('pointercancel', soltar);
	return true;
}
