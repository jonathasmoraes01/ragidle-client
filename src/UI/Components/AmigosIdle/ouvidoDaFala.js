/**
 * UI/Components/AmigosIdle/ouvidoDaFala.js
 *
 * A FALA DO SISTEMA QUE A JANELA "AMIGOS" PRECISA OUVIR (05/10/2026).
 *
 * O servidor responde parte do /friend pela fala do sistema, e nao por pacote
 * proprio, como a fonte (`clif_displaymessage` com os msg_txt 3, 671, 672 e
 * 674): "Personagem nao encontrado.", "Voces ja sao amigos.", "Amigo
 * removido.". Ela cai na aba Logs do chat — e no celular a janela e painel de
 * tela cheia e cobre o chat, entao o jogador digitava o nome e nada acontecia
 * na tela (o mesmo achado de `MochilaIdle/recusaDoServidor.js`).
 *
 * O `ZC_RAGIDLE_LOG` continua com UM dono (`Engine/MapEngine/Main.js`); ele
 * so REPASSA o corpo para quem assinou aqui. Quem decide o que e do "Amigos"
 * e `falaDosAmigos` (controladorDosAmigos.js).
 */

const _ouvintes = new Set();

/**
 * @param {(msg: string) => void} funcao
 * @returns {() => void} desassinar
 */
export function ouvirFalaDoSistema(funcao) {
	_ouvintes.add(funcao);
	return () => _ouvintes.delete(funcao);
}

/**
 * Chamado pelo dono do pacote a cada fala do sistema.
 *
 * @param {string} msg
 */
export function repassarFalaDoSistema(msg) {
	for (const funcao of _ouvintes) {
		// Cada ouvinte em `try`: uma excecao aqui abortaria o laco de rede.
		try {
			funcao(msg);
		} catch (err) {
			console.error('[ouvidoDaFala] ouvinte falhou', err);
		}
	}
}
