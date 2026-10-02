/**
 * O IDIOMA DA CONTA (D-1929): o servidor guarda a escolha da conta e a devolve
 * no retrato do tutorial. O login segue pelo aparelho; depois dele, a conta
 * vale. Este modulo e so a costura com o fio — a decisao e `decidir`, pura.
 */
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import { idiomaConhecido } from 'Core/Idioma.js';

/**
 * @param {unknown} daConta o `idioma` do retrato (ausente = a conta nunca escolheu)
 * @param {string} doAparelho o idioma em uso agora
 * @param {boolean} aparelhoEscolheu se alguem escolheu neste aparelho
 * @returns {'aplicar' | 'subir' | 'nada'}
 *   aplicar: a conta manda e difere do aparelho (recarrega uma vez);
 *   subir: a conta nao tem e o aparelho ja escolheu (guarda na conta);
 *   nada: ja estao de acordo, ou ninguem escolheu ainda (o passo zero pergunta).
 */
export function decidir(daConta, doAparelho, aparelhoEscolheu) {
	if (typeof daConta === 'string' && idiomaConhecido(daConta)) {
		return daConta === doAparelho ? 'nada' : 'aplicar';
	}
	return aparelhoEscolheu ? 'subir' : 'nada';
}

/** Guarda o idioma na conta. So no jogo: no login nao ha personagem. */
export function enviarIdiomaDaConta(codigo) {
	if (!PACKET.CZ.RAGIDLE_TUTORIAL_ACAO || !idiomaConhecido(codigo)) {
		return;
	}
	const pkt = new PACKET.CZ.RAGIDLE_TUTORIAL_ACAO();
	pkt.json = JSON.stringify({ acao: 'idioma', codigo });
	Network.sendPacket(pkt);
}
