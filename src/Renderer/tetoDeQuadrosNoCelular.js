/**
 * Renderer/tetoDeQuadrosNoCelular.js
 *
 * NO CELULAR, 60 QUADROS POR SEGUNDO (06/10/2026 — decisao do dono).
 *
 * O padrao do jogo e `fpslimit: 120` (`Preferences/Graphics.js`), e o
 * renderizador o aplicava em qualquer aparelho. No celular, 120 quadros quer
 * dizer o dobro de bateria e de calor por um ganho que a maior parte das telas
 * nem mostra (60 Hz), e o telefone quente baixa o relogio sozinho - o FPS
 * "cai depois de um tempo" que o relato de campo ja registrou. O desktop nao
 * muda.
 *
 * A ESCOLHA DO JOGADOR VENCE. O `fpslimit` salvo nao distingue "o padrao
 * gravado na primeira abertura" de "o jogador escolheu 120": por isso a janela
 * de opcoes graficas marca `fpslimitEscolhido` quando o jogador mexe, e so sem
 * essa marca o teto do celular vale.
 */
export const TETO_DE_QUADROS_NO_CELULAR = 60;

/**
 * @param {{fpslimit: number, fpslimitEscolhido?: boolean}} preferencias - `GraphicsSettings`
 * @param {boolean} dedo - `ehDedo()`: o aparelho e de toque
 * @returns {number} o limite de quadros a aplicar
 */
export function limiteDeQuadrosDoAparelho(preferencias, dedo) {
	const escolhido = preferencias.fpslimit;
	if (preferencias.fpslimitEscolhido === true || !dedo) {
		return escolhido;
	}
	return TETO_DE_QUADROS_NO_CELULAR;
}
