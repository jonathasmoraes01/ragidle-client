/**
 * Botao flutuante "Ataque auto" no canto inferior direito.
 *
 * Saiu com o Novo Bot V5 (07/10/2026) e VOLTOU em 12/10/2026, a pedido do
 * dono: agora e o ON/OFF do Bot novo fora da janela. O clique faz o MESMO
 * gesto do interruptor do menu do Bot (`BotMenu.alternarLigado`), e o estado
 * exibido e sempre o que o servidor confirmou: ligar por aqui acende o menu,
 * e ligar pelo menu acende aqui.
 */

import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import BotMenu from 'UI/Components/BotMenu/BotMenu.js';
import { fraseDoErro } from 'UI/Components/BotMenu/estadoDoBot.js';
import ChatBox from 'UI/Components/ChatBox/ChatBox.js';
import RiIcones from 'UI/ri-icones.js';
import { escreverTitulo } from 'UI/escreverSeMudou.js';
import { aoRecarga, usarSkill } from 'UI/Components/ShortCut/portaDasSkills.js';
import { criarRelogioDaBarra } from 'UI/Components/ShortCut/relogioDaBarra.js';
import { acaoDoToque, desenharArco, slotsDoArco } from './arcoDeSkills.js';
import htmlText from './CombatCornerIdle.html?raw';
import cssText from './CombatCornerIdle.css?raw';

const CombatCornerIdle = new GUIComponent('CombatCornerIdle', cssText);

CombatCornerIdle.render = () => htmlText.replace(/<!--RI_ICONE:(\w+)-->/g, (_, chave) => RiIcones[chave] || '');
CombatCornerIdle.mouseMode = GUIComponent.MouseMode.CROSS;
CombatCornerIdle.needFocus = false;

let desligarOuvintes = null;

/**
 * Um ON/OFF pedido POR ESTE BOTAO esta em voo. Com a janela do Bot fechada,
 * a recusa do servidor (ex.: cidade sem Bot) so apareceria la dentro; por
 * isso a frase vai para o chat quando a resposta chega.
 */
let aguardandoResposta = false;

function root() {
	return CombatCornerIdle._shadow || CombatCornerIdle._host;
}

/*
 * O ARCO DE SKILLS (15/10/2026, HUD mobile premium): as tres skills do rodizio do Bot em volta do Auto. O
 * desenho e o toque moram em `arcoDeSkills.js`; aqui so a costura - o rodizio vem do `BotMenu`, a recarga da
 * barra (`portaDasSkills.js`, o mesmo 0x043d) e o relogio e o MESMO modulo da barra, com os discos como slots.
 */
const relogioDoArco = criarRelogioDaBarra({ slots: () => slotsDoArco(arco()) });

function arco() {
	return root() && root().querySelector('.cc-rodizio');
}

function syncRodizio(itens) {
	const container = arco();
	if (container) {
		desenharArco(container, itens || []);
		relogioDoArco.desenhar();
	}
}

function onClickArco(event) {
	const disco = event.target.closest && event.target.closest('.cc-skill');
	const acao = acaoDoToque(disco);
	if (!acao) {
		return;
	}
	event.stopImmediatePropagation();
	if (acao.acao === 'escolher') {
		BotMenu.toggle();
		return;
	}
	usarSkill(acao.skillId, acao.nivel);
}

CombatCornerIdle.init = function init() {
	root().querySelector('.cc-btn--auto').addEventListener('click', onClickAuto);
	const container = arco();
	if (container) {
		container.addEventListener('click', onClickArco);
	}
};

CombatCornerIdle.onAppend = function onAppend() {
	if (desligarOuvintes) {
		desligarOuvintes();
	}
	const soltarLigado = BotMenu.aoMudarLigado(syncAutoState);
	const soltarCapacidade = BotMenu.aoMudarCapacidade(syncVisibilidade);
	const soltarRodizio = BotMenu.aoMudarRodizio(syncRodizio);
	const soltarRecarga = aoRecarga((skillId, delay) => {
		if (skillId === null) {
			relogioDoArco.recargaGlobal(delay);
		} else {
			relogioDoArco.recarga(skillId, delay);
		}
	});
	desligarOuvintes = () => {
		soltarLigado();
		soltarCapacidade();
		soltarRodizio();
		soltarRecarga();
		desligarOuvintes = null;
	};
	syncVisibilidade(BotMenu.temCapacidade());
	syncAutoState(BotMenu.estadoDoLigado());
	syncRodizio(BotMenu.rodizioDoAuto());
};

CombatCornerIdle.onRemove = function onRemove() {
	if (desligarOuvintes) {
		desligarOuvintes();
	}
	relogioDoArco.limpar();
	aguardandoResposta = false;
};

/** Sem o Bot anunciado pelo servidor (sessao velha), nao ha o que ligar: o botao some. */
function syncVisibilidade(temBot) {
	const wrap = root() && root().querySelector('#CombatCornerIdle');
	if (wrap) {
		wrap.classList.toggle('is-sem-bot', !temBot);
	}
}

function escreverAtributo(el, nome, valor) {
	if (el.getAttribute(nome) !== valor) {
		el.setAttribute(nome, valor);
	}
}

function syncAutoState(estado) {
	const button = root() && root().querySelector('.cc-btn--auto');
	if (!button) {
		return;
	}

	const enabled = Boolean(estado && estado.ligado);
	const pendente = Boolean(estado && estado.pendente);
	button.classList.toggle('is-on', enabled);
	button.classList.toggle('is-pendente', pendente);
	// D-2385: isto roda a cada pacote do Bot (~0,4 por segundo com ele ligado), quase sempre com o mesmo
	// estado; o atributo igual nao e reescrito (cada `setAttribute` gera um registro de mutacao).
	escreverAtributo(button, 'aria-pressed', String(enabled));
	escreverAtributo(button, 'aria-busy', String(pendente));
	const dica = enabled ? 'Ataque automático ligado: clique para desligar' : 'Ataque automático desligado: clique para ligar';
	escreverTitulo(button, dica);
	escreverAtributo(button, 'aria-label', dica);

	if (aguardandoResposta && !pendente) {
		aguardandoResposta = false;
		if (estado.erro) {
			ChatBox.addText(fraseDoErro(estado.erro), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
		}
	}
}

function onClickAuto(event) {
	event.stopImmediatePropagation();
	if (BotMenu.alternarLigado()) {
		aguardandoResposta = true;
	}
}

export default UIManager.addComponent(CombatCornerIdle);
