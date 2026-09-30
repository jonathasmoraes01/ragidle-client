/**
 * A LISTA QUE ROLA PARA O LADO, COM MOUSE, RODA E SETAS (29/09/2026).
 *
 * Relato do dono: *"os players nao estao conseguindo visualizar todos os itens
 * arrastando para o lado"*. A trilha de recompensas da Temporada e um
 * `overflow-x: auto`, e isso so resolve metade:
 *
 *  - no MOUSE, arrastar nao rola (o navegador so arrasta texto), e a roda rola
 *    na VERTICAL — a lista lateral so andava pela barrinha fina ou com Shift;
 *  - no TOQUE o arrasto nativo funciona, mas nada diz que ha mais itens a
 *    direita.
 *
 * Este modulo liga as duas pecas que faltam no mouse (arrastar e a roda
 * vertical virando lateral) e mantem as SETAS de quem o chama acesas ou
 * apagadas conforme a posicao. O toque continua sendo o nativo: reimplementa-lo
 * brigaria com a inercia do sistema.
 */

/** Quanto o ponteiro anda antes de o gesto virar arrasto (e o clique sumir). */
const LIMIAR_DO_ARRASTO_PX = 5;

/** Ha mais conteudo para os lados do que cabe? */
function transborda(el) {
	return el.scrollWidth - el.clientWidth > 1;
}

/**
 * Acende/apaga as setas conforme a posicao. `setas` e `{ esquerda, direita }`
 * (elementos ou null).
 */
export function atualizarSetas(el, setas) {
	if (!setas) {
		return;
	}
	const cabe = !transborda(el);
	const noInicio = el.scrollLeft <= 1;
	const noFim = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
	if (setas.esquerda) {
		setas.esquerda.disabled = cabe || noInicio;
		setas.esquerda.hidden = cabe;
	}
	if (setas.direita) {
		setas.direita.disabled = cabe || noFim;
		setas.direita.hidden = cabe;
	}
}

/** Um "passo" da seta: 80% da largura visivel, para sobrar contexto. */
export function passoDaSeta(el) {
	return Math.max(40, Math.round(el.clientWidth * 0.8));
}

/**
 * Liga a rolagem lateral num elemento com `overflow-x`. Idempotente: chamar de
 * novo no mesmo elemento nao duplica ouvintes (a janela redesenha o corpo, e o
 * elemento novo liga do zero).
 */
export function ligarRolagemLateral(el, setas = null) {
	if (!el || el.dataset.rolagemLateral === '1') {
		return;
	}
	el.dataset.rolagemLateral = '1';

	/* A RODA: vertical vira lateral enquanto a lista tem para onde andar. Na
	   ponta, a roda volta a rolar a janela — senao o jogador ficaria preso. */
	el.addEventListener(
		'wheel',
		evento => {
			if (!transborda(el) || Math.abs(evento.deltaY) <= Math.abs(evento.deltaX)) {
				return;
			}
			const antes = el.scrollLeft;
			el.scrollLeft += evento.deltaY;
			if (el.scrollLeft !== antes) {
				evento.preventDefault();
			}
		},
		{ passive: false }
	);

	/* O ARRASTO COM O MOUSE. Toque e caneta ficam com o nativo. */
	let gesto = null;
	el.addEventListener('pointerdown', evento => {
		if (evento.pointerType !== 'mouse' || evento.button !== 0 || !transborda(el)) {
			return;
		}
		gesto = { x: evento.clientX, inicio: el.scrollLeft, arrastou: false, id: evento.pointerId };
	});
	el.addEventListener('pointermove', evento => {
		if (!gesto || evento.pointerId !== gesto.id) {
			return;
		}
		const dx = evento.clientX - gesto.x;
		if (!gesto.arrastou && Math.abs(dx) < LIMIAR_DO_ARRASTO_PX) {
			return;
		}
		if (!gesto.arrastou) {
			gesto.arrastou = true;
			el.classList.add('is-arrastando');
			try {
				el.setPointerCapture(gesto.id);
			} catch {
				// sem captura o arrasto segue enquanto o mouse estiver em cima
			}
		}
		el.scrollLeft = gesto.inicio - dx;
		evento.preventDefault();
	});
	const soltar = () => {
		if (!gesto) {
			return;
		}
		const arrastou = gesto.arrastou;
		gesto = null;
		el.classList.remove('is-arrastando');
		if (arrastou) {
			/* O clique que fecha o arrasto nao e um clique num premio. */
			el.addEventListener(
				'click',
				e => {
					e.stopPropagation();
					e.preventDefault();
				},
				{ capture: true, once: true }
			);
		}
	};
	el.addEventListener('pointerup', soltar);
	el.addEventListener('pointercancel', soltar);

	if (setas) {
		if (setas.esquerda) {
			setas.esquerda.addEventListener('click', () => el.scrollBy({ left: -passoDaSeta(el), behavior: 'smooth' }));
		}
		if (setas.direita) {
			setas.direita.addEventListener('click', () => el.scrollBy({ left: passoDaSeta(el), behavior: 'smooth' }));
		}
		el.addEventListener('scroll', () => atualizarSetas(el, setas), { passive: true });
		atualizarSetas(el, setas);
	}
}
