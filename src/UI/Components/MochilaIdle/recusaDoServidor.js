/**
 * UI/Components/MochilaIdle/recusaDoServidor.js
 *
 * O MOTIVO QUE O SERVIDOR DEU PARA NAO VESTIR (04/10/2026, relato de 03/10: o
 * cajado "Liberacao da Sabedoria" num Bruxo 56 mostrava so "Nao foi possivel
 * equipar essa peca agora.").
 *
 * O servidor sempre explicou: a recusa de vestir manda "Nao deu para equipar:
 * <motivo>" pela fala do sistema (`ZC_RAGIDLE_LOG`), que cai na aba Logs do
 * chat. So que no celular a Mochila e painel de TELA CHEIA e cobre o chat, e no
 * desktop a aba ativa quase nunca e a Logs: o motivo existia e ninguem o via.
 * A Mochila, por sua vez, so sabia que o item continuou na mochila, e chutava a
 * frase generica.
 *
 * Aqui o tratador da fala do sistema ANOTA a ultima recusa de vestir, e a
 * Mochila a usa no aviso dela quando ela e recente. A janela de tempo existe
 * para uma recusa velha nao aparecer como motivo de outro pedido.
 */

const PREFIXO = /N[aã]o deu para equipar:\s*(.+)$/i;

/** Uma recusa vale como motivo do pedido atual por ate este tempo. */
export const JANELA_DA_RECUSA_MS = 3000;

let _ultima = null;

/**
 * Le a fala do sistema e guarda o motivo se for uma recusa de vestir.
 *
 * @param {string} msg o corpo do pacote ("Sistema : Nao deu para equipar: ...")
 * @param {number} agora ms
 */
export function anotarFalaDoSistema(msg, agora) {
	if (typeof msg !== 'string') {
		return;
	}
	const m = PREFIXO.exec(msg.replace(/\0+$/, ''));
	if (!m) {
		return;
	}
	_ultima = { motivo: m[1].trim(), em: agora };
}

/**
 * O motivo da recusa recente, ou `null`. Le UMA vez: o motivo consumido nao
 * serve de explicacao para o proximo pedido.
 *
 * @param {number} agora ms
 * @returns {string|null}
 */
export function consumirMotivoRecente(agora) {
	const u = _ultima;
	_ultima = null;
	if (!u || !u.motivo || agora - u.em > JANELA_DA_RECUSA_MS) {
		return null;
	}
	return u.motivo;
}
