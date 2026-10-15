/**
 * O RECADO DO RODAPE DA JANELA DE GRUPO (ML14, 15/10/2026, achado do critico do grupo).
 *
 * "Abra o Localizador de Grupos para entrar num grupo." e o texto de quem NAO tem grupo, e morava solto no HTML: quem JA
 * estava em grupo o via embaixo da janela (a linha so era trocada quando chegava `recado` ou `problemas`). A regra
 * agora e uma funcao pura: cada estado que o servidor empurra diz o que a linha deve mostrar, e o texto de "sem grupo"
 * some quando o personagem entra em um (sem apagar o ultimo aviso de verdade, que continua valendo ate o proximo).
 */

/** O texto de quem nao tem grupo. E o mesmo que o HTML traz de fabrica em `.gi-recado`. */
export const RECADO_SEM_GRUPO = 'Abra o Localizador de Grupos para entrar num grupo.';

/**
 * O que a linha do rodape deve mostrar para o estado que chegou.
 *
 * @param {{problemas?: string[], recado?: string, grupo?: object|null}} dados o estado do grupo empurrado pelo servidor
 * @param {string} textoAtual o que a linha mostra agora
 * @returns {{texto: string, ehProblema: boolean}|null} `null` = a linha fica como esta (o ultimo aviso continua valendo)
 */
export function recadoDoEstado(dados, textoAtual) {
	if (Array.isArray(dados.problemas) && dados.problemas.length) {
		// A recusa e a frase do SERVIDOR, mostrada como veio: a janela nao reescreve o motivo.
		return { texto: dados.problemas.join(' · '), ehProblema: true };
	}
	if (dados.recado) {
		return { texto: dados.recado, ehProblema: false };
	}
	if (!dados.grupo) {
		return { texto: RECADO_SEM_GRUPO, ehProblema: false };
	}
	// Em grupo, o texto de "sem grupo" que sobrou na linha (de fabrica ou de antes de entrar) so atrapalha.
	if (textoAtual === RECADO_SEM_GRUPO) {
		return { texto: '', ehProblema: false };
	}
	return null;
}
