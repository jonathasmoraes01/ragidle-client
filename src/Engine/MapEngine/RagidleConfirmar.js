/**
 * Engine/MapEngine/RagidleConfirmar.js
 *
 * RAGIDLE: a JANELA DE CONFIRMACAO de um comando `#` destrutivo
 * (0x0fd1 pergunta / 0x0fd2 resposta, servidor 28/08/2026).
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTE ARQUIVO EXISTE
 * ---------------------------------------------------------------------------
 * Ordem do dono: *"crie uma janela de confirmacao antes desses comandos em
 * outro player"*.
 *
 * O simbolo `#` faz um comando rodar em cima de outro jogador, e cinco deles
 * APAGAM coisa: `#dropall`, `#itemreset`, `#resetskill`, `#resetstat` e
 * `#reset`. No rAthena eles sao imediatos — mas la quem digita e quem paga.
 * Aqui quem paga e o outro, e um nome digitado errado nao tem desfazer.
 *
 * ---------------------------------------------------------------------------
 * QUEM DECIDE O QUE, E POR QUE ASSIM
 * ---------------------------------------------------------------------------
 * Quem decide que um comando pede confirmacao e o SERVIDOR
 * (`servidor/comandos/confirmacao.ts`), e nao esta janela. O cliente so
 * pergunta o que lhe mandarem perguntar e devolve sim ou nao.
 *
 * Isso nao e cerimonia: uma tranca desenhada no cliente nao e tranca. Um
 * cliente modificado — ou este mesmo com um erro — mandaria o comando direto, e
 * o servidor obedeceria. Aqui o servidor NAO EXECUTA ate ouvir o "sim", entao a
 * janela e o que o administrador ve, e nao o que o segura.
 *
 * O `id` viaja nos dois sentidos e amarra a resposta a pergunta. Sem ele, uma
 * janela velha esquecida na tela confirmaria um comando NOVO — que e
 * exatamente o acidente que ela existe para evitar, encenado por ela mesma.
 *
 * O "nao" tambem viaja: sem ele a pendencia ficaria de pe do lado do servidor
 * ate vencer, e o proximo `#` teria de esperar. Cancelar e uma decisao.
 *
 * Este arquivo e parte do fork ragidle do ROBrowser.
 */

import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import Renderer from 'Renderer/Renderer.js';
import WinPopup from 'UI/Components/WinPopup/WinPopup.js';

/** A janela aberta agora, se houver — so pode haver uma. */
let _janela = null;

class RagidleConfirmarEngine {
	static init() {
		Network.hookPacket(PACKET.ZC.RAGIDLE_CONFIRMAR, onPerguntar);
	}
}

/** Manda a resposta e fecha. `sim` decide o byte; o `id` amarra a pergunta. */
function responder(id, sim) {
	const pkt = new PACKET.CZ.RAGIDLE_CONFIRMAR();
	pkt.id = id;
	pkt.resposta = sim ? 1 : 0;
	Network.sendPacket(pkt);
	fechar();
}

function fechar() {
	if (_janela) {
		_janela.remove();
		_janela = null;
	}
}

function onPerguntar(pkt) {
	let dados;
	try {
		dados = JSON.parse(pkt.json);
	} catch (e) {
		console.warn('[RAGIDLE] confirmacao ilegivel:', e);
		return;
	}
	if (!dados || typeof dados.id !== 'number') {
		return;
	}

	/*
	 * UMA JANELA SO. Se ja havia uma aberta, ela e a de um pedido ANTERIOR — o
	 * servidor sobrescreveu a pendencia ao criar esta, entao a velha nao vale
	 * mais nada. Fecha-la sem responder e o certo: responder "nao" por conta
	 * propria mandaria uma resposta que o administrador nao deu.
	 */
	fechar();

	const id = dados.id;
	const texto = String(dados.texto || 'Confirma?');
	const janela = WinPopup.clone('WinConfirmarRagidle');

	janela.init = function Init() {
		this.draggable();

		const alvo = this._shadow.querySelector('.text');
		// `textContent` e nao `innerHTML`: o texto traz o NOME de um jogador, e
		// nome e coisa que o jogador escolhe. Interpretar isso como marcacao
		// seria deixar um jogador desenhar na tela do administrador.
		alvo.textContent = texto;
		alvo.style.whiteSpace = 'pre-wrap';

		Object.assign(this._host.style, {
			top: Renderer.height / 2.5 + 'px',
			left: (Renderer.width - 280) / 2.0 + 'px',
			zIndex: '150'
		});

		const btns = this._shadow.querySelector('.btns');
		/* Fase 3: rotulo em texto + pele .ri-btn (os btn_*.bmp nao existem no
		   GRF LATAM e viravam listra quebrada) — mesma receita de UIManager. */
		const criarBotao = (nome, aoClicar) => {
			const btn = document.createElement('button');
			btn.className = nome === 'ok' ? 'btn ri-btn' : 'btn ri-btn ri-btn--sec';
			btn.textContent = nome === 'ok' ? 'OK' : 'Cancelar';
			btn.addEventListener('click', aoClicar, { once: true });
			return btn;
		};

		/*
		 * CANCELAR VEM PRIMEIRO, e isso e escolha.
		 *
		 * A janela existe porque alguem pode ter digitado o nome errado. Pondo
		 * o botao seguro embaixo do cursor, o clique reflexo cancela — e quem
		 * quer mesmo apagar le e escolhe o outro.
		 */
		btns.appendChild(criarBotao('cancel', () => responder(id, false)));
		btns.appendChild(criarBotao('ok', () => responder(id, true)));
	};

	janela.onKeyDown = function onKeyDown(event) {
		// ESC cancela — o gesto de "sair" nunca pode ser o de confirmar.
		if (event.which === 27) {
			responder(id, false);
			event.stopImmediatePropagation();
			return false;
		}
		return true;
	};

	_janela = janela;
	janela.append();
}

export default RagidleConfirmarEngine;
