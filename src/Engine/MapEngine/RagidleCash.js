/**
 * Engine/MapEngine/RagidleCash.js
 *
 * RAGIDLE: o SALDO DE CASH da conta no HUD (0x0f00, servidor 28/08/2026).
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTE ARQUIVO EXISTE
 * ---------------------------------------------------------------------------
 * Pergunta do dono naquele dia: *"tem algum lugar dentro do game que mostre a
 * quantidade total de cash que o player tem na conta?"*. Não tinha. Conferido
 * nos dois lados: o servidor mandava o saldo em dois pontos e os dois eram a
 * mesma janela (`ZC_SE_CASHSHOP_OPEN` ao abrir a loja e o resultado da compra),
 * e aqui `grep -rln "cashPoints" src/` dava três arquivos — nenhum deles HUD.
 * `Session` não tinha campo de cash: não havia de onde outro componente ler o
 * número nem que quisesse.
 *
 * O jogador só sabia do saldo por texto que rola embora — o feed do ganho e a
 * carta de boas-vindas do beta, que promete 10.000 que ele não tinha onde
 * conferir.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ELE MORA AQUI, E NÃO DENTRO DO BasicInfoIdle
 * ---------------------------------------------------------------------------
 * O `BasicInfoIdle` **não engancha pacote nenhum de propósito**, e o cabeçalho
 * dele explica: `Network.hookPacket` faz `Packets.list[id].callback = cb`, uma
 * atribuição simples — enganchar um opcode que o `MapEngine/Main.js` já
 * engancha SUBSTITUIRIA o handler nativo em silêncio. Ele resolve isso lendo o
 * estado vivo num timer de 250 ms.
 *
 * `0x0f00` é nosso e ninguém mais o engancha, então enganchá-lo é seguro — mas
 * fazer isso lá dentro quebraria a regra que o arquivo declara sobre si mesmo,
 * e regra com exceção não escrita é a que some. Aqui o pacote vira
 * `Session.cash`, e o HUD continua só LENDO estado vivo, como faz com o zeny.
 *
 * Este arquivo é parte do fork ragidle do ROBrowser.
 */

import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import Session from 'Engine/SessionStorage.js';

class RagidleCashEngine {
	static init() {
		Network.hookPacket(PACKET.ZC.RAGIDLE_SALDO_DE_CASH, onSaldo);
	}
}

/**
 * O servidor manda na entrada do mapa e a cada mudança (ganho por marco,
 * `@cash`, `@darcash`, compra na loja). Guardar sem checar o valor é
 * deliberado: o campo é `u32` e o teto já foi aparado do outro lado
 * (`MAX_CASHPOINT`, common/mmo.hpp:85).
 */
function onSaldo(pkt) {
	Session.cash = pkt.saldo;
}

export default RagidleCashEngine;
