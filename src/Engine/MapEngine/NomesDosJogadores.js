/**
 * Engine/MapEngine/NomesDosJogadores.js
 *
 * RAGIDLE: o NOME e a GUILDA dos jogadores desenhados SEMPRE (28/08/2026).
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTE ARQUIVO EXISTE
 * ---------------------------------------------------------------------------
 * Pedido do dono: *"hoje, em todos os personagens, precisamos colocar o mouse em
 * cima para ver qual e o nome e a guild dele... quero que, assim como as barras
 * de HP, o nome/guild dos players tambem sejam carregados diretamente"*.
 *
 * O roBrowser so pede o nome de uma entidade quando o mouse passa por cima
 * (`Controls/EntityControl.js`): `display.load` comeca em `NONE`, o hover manda
 * `CZ_REQNAME2`, e a resposta preenche nome, party, guilda e cargo. Antes disso
 * o cliente NAO SABE o nome de ninguem — nem o da propria guilda de quem esta
 * do lado.
 *
 * ---------------------------------------------------------------------------
 * O QUE JA EXISTIA, E O QUE FALTAVA
 * ---------------------------------------------------------------------------
 * Quase tudo estava pronto, e vale registrar para ninguem reescrever:
 *
 * - o renderizador ja desenha o nome A CADA QUADRO quando `display.display` e
 *   verdadeiro (`Renderer/Entity/EntityRender.js`) — e a MESMA porta pela qual a
 *   barra de HP aparece, uma linha acima, que e exatamente a analogia do dono;
 *   e
 * - o pacote de spawn ja TRAZ o nome (`ZC_NOTIFY_STANDENTRY11` tem o campo, e o
 *   nosso servidor o preenche), e `Entity.set()` ja o guarda em `display.name`.
 *
 * Faltavam duas coisas: **ligar a flag** e **pedir o nome sem esperar o hover**.
 *
 * O pedido continua sendo necessario mesmo com o nome vindo no spawn, e a razao
 * e a GUILDA: ela nao viaja no pacote de entidade — so o `id` e a versao do
 * emblema viajam. Nome de guilda, party e cargo vem no `ZC_ACK_REQNAMEALL`, que
 * e a resposta do pedido. Sem ele daria para desenhar o nome e nao a guilda, e o
 * dono pediu os dois.
 *
 * ---------------------------------------------------------------------------
 * SO JOGADOR
 * ---------------------------------------------------------------------------
 * Mob e NPC continuam por hover. O dono falou em *"personagens"* e *"players"*,
 * e a diferenca nao e so obediencia ao pedido: um mapa de caca tem ate 120 mobs
 * (`SPOTS_POR_MAPA` x `MOBS_POR_SPOT`), e 120 letreiros seriam 120 pedidos ao
 * servidor e um mural em cima do jogo. Jogador num mapa deste servidor e uma
 * ordem de grandeza menos.
 *
 * Este arquivo e parte do fork ragidle do ROBrowser.
 */

import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import PACKETVER from 'Network/PacketVerManager.js';
import Entity from 'Renderer/Entity/Entity.js';
import EntityManager from 'Renderer/EntityManager.js';
import GraphicsSettings from 'Preferences/Graphics.js';

/** O jogador quer ver os nomes? A opcao vive nas Configuracoes de video. */
function ligado() {
	// `!== false` e nao `=== true`: preferencia gravada ANTES desta opcao existir
	// nao tem o campo, e `undefined` tem de valer o padrao (ligado), senao quem
	// ja jogava veria a funcionalidade nascer desligada sem ter escolhido nada.
	return GraphicsSettings.showPlayerNames !== false;
}

/** A entidade e um JOGADOR? Mob e NPC seguem por hover. */
function ehJogador(entity) {
	return entity.objecttype === Entity.TYPE_PC;
}

/**
 * Pede o nome se ainda nao temos — a MESMA sequencia do hover.
 *
 * `load` faz o controle de repeticao sozinho: quem esta em `LOADING` ou
 * `COMPLETE` nao pede de novo. Sem essa guarda, um jogador parado no meio de
 * outros geraria um pedido por quadro.
 */
function pedirNome(entity) {
	if (entity.display.load !== entity.display.TYPE.NONE) {
		return;
	}
	entity.display.load = entity.display.TYPE.LOADING;
	const pkt =
		PACKETVER.value >= 20180307 ? new PACKET.CZ.REQNAME2() : new PACKET.CZ.REQNAME();
	pkt.AID = entity.GID;
	Network.sendPacket(pkt);
}

/**
 * Liga (ou desliga) o letreiro de UMA entidade, pela regra de hoje.
 *
 * Chamada no spawn e na chegada do nome. Ela NAO decide sobre mob e NPC: para
 * eles a funcao nao faz nada, e quem manda continua sendo o hover.
 */
function aplicar(entity) {
	if (!entity || !ehJogador(entity)) {
		return;
	}
	if (!ligado()) {
		return;
	}
	pedirNome(entity);
	// A MARCA que o hover le (`Controls/EntityControl.js`): ela mora no display
	// para aquele arquivo nao precisar importar este — ver o comentario de la.
	entity.display.fixo = true;
	entity.display.add();
}

/**
 * Reaplica em TODO MUNDO — o toggle das Configuracoes de video.
 *
 * Desligar precisa apagar o que ja esta na tela, e ligar precisa acender quem
 * ja estava la (e pedir o nome de quem nunca foi apontado). Sem isto a opcao so
 * valeria para quem entrasse na vista DEPOIS, o que parece defeito.
 */
function reaplicarEmTodos() {
	const aceso = ligado();
	EntityManager.forEach((entity) => {
		if (ehJogador(entity)) {
			// A marca acompanha o estado da opcao SEMPRE, e nao so no ramo que
			// acende: deixa-la `true` ao desligar faria o hover parar de apagar
			// o letreiro de quem o jogador acabou de mandar esconder.
			entity.display.fixo = aceso;
			if (aceso) {
				pedirNome(entity);
				entity.display.add();
			} else if (entity !== EntityManager.getOverEntity()) {
				/*
				 * O que esta SOB O MOUSE fica. Desligar "nomes sempre visiveis"
				 * nao e desligar o hover — ele e a funcionalidade original, e
				 * apaga-lo aqui tiraria do jogador algo que ele nao pediu para
				 * perder.
				 */
				entity.display.remove();
			}
		}
		return true;
	});
}

export default {
	aplicar,
	reaplicarEmTodos,
	ligado
};
