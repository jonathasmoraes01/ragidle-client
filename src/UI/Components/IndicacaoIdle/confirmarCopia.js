/**
 * O "Copiado!" do botao de copiar volta ao rotulo ORIGINAL (F49, auditoria de
 * 22/09/2026).
 *
 * O botao guardava o texto de antes a cada clique. Dois cliques dentro de
 * 1,6 s e o segundo guardava "Copiado!" como o texto de antes — o botao ficava
 * preso nele. Aqui o rotulo original e lembrado UMA vez por botao, e o
 * temporizador anterior e cancelado a cada clique novo.
 */

export const DURACAO_DO_COPIADO_MS = 1600;

/** @type {WeakMap<HTMLElement, {rotulo: string, timer: ReturnType<typeof setTimeout>}>} */
const _emCurso = new WeakMap();

/**
 * @param {HTMLElement} btn
 */
export function confirmarCopia(btn) {
	const anterior = _emCurso.get(btn);
	const rotulo = anterior ? anterior.rotulo : btn.textContent;
	if (anterior) {
		clearTimeout(anterior.timer);
	}
	btn.textContent = 'Copiado!';
	btn.classList.add('is-copiado');
	const timer = setTimeout(() => {
		_emCurso.delete(btn);
		btn.textContent = rotulo;
		btn.classList.remove('is-copiado');
	}, DURACAO_DO_COPIADO_MS);
	_emCurso.set(btn, { rotulo, timer });
}
