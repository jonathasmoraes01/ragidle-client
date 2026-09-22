/**
 * AS ULTIMAS N DE CADA CANAL, NA ORDEM EM QUE CHEGARAM (F31, auditoria de
 * 22/09/2026).
 *
 * Com a aba oculta o `requestAnimationFrame` nao roda, e o buffer do chat so
 * crescia (900 a 6.000 linhas por hora de caca). Na volta ele era desenhado
 * inteiro — e cada canal so guarda `MAX_MSG` linhas, entao quase tudo era
 * criado para ser apagado no mesmo quadro.
 *
 * O corte e POR CANAL, e nao um teto global: um teto global deixaria o canal
 * barulhento (o Farm, com uma linha por abate) expulsar o sussurro solitario
 * que o jogador precisa ler quando voltar.
 *
 * @template T
 * @param {T[]} mensagens na ordem de chegada
 * @param {(m: T) => string} canalDe
 * @param {number} teto quantas manter por canal
 * @return {T[]} as mantidas, na ordem original
 */
export function podarPorCanal(mensagens, canalDe, teto) {
	const vistas = new Map();
	const manter = new Array(mensagens.length).fill(false);
	for (let i = mensagens.length - 1; i >= 0; i--) {
		const canal = canalDe(mensagens[i]);
		const n = vistas.get(canal) ?? 0;
		if (n < teto) {
			manter[i] = true;
			vistas.set(canal, n + 1);
		}
	}
	return mensagens.filter((_, i) => manter[i]);
}
