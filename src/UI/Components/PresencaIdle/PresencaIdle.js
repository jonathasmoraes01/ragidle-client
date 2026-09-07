/**
 * UI/Components/PresencaIdle/PresencaIdle.js
 *
 * RAGIDLE: a janela de PRESENCA (D-1162, 07/09/2026) — a distribuicao MENSAL
 * de itens para TODOS os jogadores. Pedido do dono: *"abre a janela
 * automaticamente 1x por dia ao fazer login ou sempre as 00h (para todos os
 * players que estao online) para que eles possam recolher a recompensa do
 * dia"*. E DIFERENTE do passe semanal (PasseIdle): o passe e produto pago e
 * paga por correio so a quem comprou; a presenca e de todos e se recolhe aqui.
 *
 * Quem decide TUDO e o servidor (`servidor/presenca-painel.ts`): que dia e,
 * qual e o dia por recolher, o que cada dia da, se pode recolher. A janela so
 * desenha o que chegou e manda dois verbos (`pedir`, `recolher`) pelo mesmo
 * pacote `CZ_RAGIDLE_PRESENCA_ACAO` (0x0fdf). A resposta e sempre o painel
 * inteiro (`ZC_RAGIDLE_PRESENCA`, 0x0fde), inclusive quando o servidor decide
 * abrir a janela sozinho (`abrir: true`) — no login e a meia-noite.
 *
 * Nao usa a janela nativa `CheckAttendance` do RO: aquela precisa do
 * `CheckAttendance.lub` e do `0x0ae2`, e o nosso evento e por CONTA e por MES
 * do calendario — outro modelo. Ver D-949 para o que a nativa fazia aqui.
 *
 * This file is part of the ragidle fork of ROBrowser.
 */
import Renderer from 'Renderer/Renderer.js';
import Preferences from 'Core/Preferences.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import htmlText from './PresencaIdle.html?raw';
import cssText from './PresencaIdle.css?raw';
import { fecharEEsquecer } from '../limpezaDeJanelaIdle.js';

const WINDOW_WIDTH = 520;
const WINDOW_HEIGHT = 560;

/*
 * O TAMANHO REAL NA TELA (07/09/2026): a folha usa `min(520px, 100vw - 16px)`,
 * entao num celular a janela e menor que a constante. Centrar pela constante a
 * empurrava para fora e a fazia cobrir a HUD — no telefone o botao "Cacar"
 * ficava debaixo dela, e ela abre sozinha uma vez por dia.
 */
function larguraNaTela() {
	return Math.min(WINDOW_WIDTH, Math.max(0, Renderer.width - 16));
}

function alturaNaTela() {
	return Math.min(WINDOW_HEIGHT, Math.max(0, Renderer.height - 132));
}

const MESES = [
	'janeiro',
	'fevereiro',
	'março',
	'abril',
	'maio',
	'junho',
	'julho',
	'agosto',
	'setembro',
	'outubro',
	'novembro',
	'dezembro'
];

const RECUSAS = {
	'ja-recebeu-hoje': 'Você já recolheu a recompensa de hoje. Volte amanhã.',
	'periodo-esgotado': 'Você recolheu todos os dias deste mês. O próximo mês traz um calendário novo.',
	'sem-espaco': 'Não coube na mochila e a sua caixa de correio está cheia. Libere espaço e tente de novo.'
};

const PresencaIdle = new GUIComponent('PresencaIdle', cssText);

PresencaIdle.render = () => htmlText;

/* :host{pointer-events:none} — o clique atravessa fora da janela. */
PresencaIdle.mouseMode = GUIComponent.MouseMode.CROSS;

/** O ultimo painel que o servidor mandou. `null` = ainda nao chegou nada. */
PresencaIdle.estado = null;

const _preferences = Preferences.get(
	'PresencaIdle',
	{
		x: null,
		y: null
	},
	1.0
);

function _root() {
	return PresencaIdle._shadow || PresencaIdle._host;
}

function escapeHtml(value) {
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/**
 * O que a troca de personagem tem de apagar: o painel e do personagem (a
 * CONTA, na verdade — mas a janela aberta e a posicao sao da sessao). Mesmo
 * contrato das outras janelas Idle; o portao
 * `janela-idle-esquece-o-desenho.test.ts` cobra o `fecharEEsquecer`.
 */
PresencaIdle.limparEstadoDoPersonagem = function limparEstadoDoPersonagem() {
	PresencaIdle.estado = null;
	fecharEEsquecer(_root(), '.pr-window', { corpo: '.pr-grade', texto: '' });
};

PresencaIdle.init = function init() {
	const root = _root();
	if (root) {
		const fechar = root.querySelector('.pr-close');
		if (fechar) {
			fechar.addEventListener('click', onClickClose);
		}
		const titulo = root.querySelector('.pr-titlebar');
		if (titulo) {
			this.draggable(titulo);
		}
		const recolher = root.querySelector('.pr-recolher');
		if (recolher) {
			recolher.addEventListener('click', onClickRecolher);
		}
	}
	this._host.style.top = Math.max(0, (Renderer.height - alturaNaTela()) / 2) + 'px';
	this._host.style.left = Math.max(0, (Renderer.width - larguraNaTela()) / 2) + 'px';
	render();
};

PresencaIdle.onAppend = function onAppend() {
	if (_preferences.x != null && _preferences.y != null) {
		this._host.style.top =
			Math.min(Math.max(0, _preferences.y), Math.max(0, Renderer.height - alturaNaTela())) + 'px';
		this._host.style.left =
			Math.min(Math.max(0, _preferences.x), Math.max(0, Renderer.width - larguraNaTela())) + 'px';
	}
};

PresencaIdle.onRemove = function onRemove() {
	savePosition();
};

function savePosition() {
	_preferences.x = parseInt(PresencaIdle._host.style.left, 10) || 0;
	_preferences.y = parseInt(PresencaIdle._host.style.top, 10) || 0;
	_preferences.save();
}

function enviarAcao(corpo) {
	const pkt = new PACKET.CZ.RAGIDLE_PRESENCA_ACAO();
	pkt.json = JSON.stringify(corpo);
	Network.sendPacket(pkt);
}

function abrir() {
	const root = _root();
	const win = root && root.querySelector('.pr-window');
	if (!win) {
		return;
	}
	win.classList.add('is-open');
	PresencaIdle.focus();
}

PresencaIdle.toggle = function toggle() {
	const root = _root();
	const win = root && root.querySelector('.pr-window');
	if (!win) {
		return;
	}
	if (win.classList.contains('is-open')) {
		closeWindow();
	} else {
		abrir();
		enviarAcao({ acao: 'pedir' });
	}
};

function closeWindow() {
	const root = _root();
	const win = root && root.querySelector('.pr-window');
	if (win) {
		win.classList.remove('is-open');
	}
	savePosition();
}

function onClickClose(e) {
	e.stopImmediatePropagation();
	closeWindow();
}

function onClickRecolher(e) {
	e.stopImmediatePropagation();
	const estado = PresencaIdle.estado;
	if (!estado || !estado.podeRecolher) {
		return;
	}
	// Desarma ate a resposta chegar: o servidor recusa o duplo clique, mas nao
	// ha razao para mandar dois pedidos.
	const btn = e.currentTarget;
	if (btn) {
		btn.disabled = true;
	}
	enviarAcao({ acao: 'recolher' });
}

/** "5× Poção Branca" — a soma do dia numa linha curta. */
function premioHtml(itens) {
	if (!Array.isArray(itens) || itens.length === 0) {
		return '';
	}
	return itens
		.map(it => '×' + escapeHtml(it.quantidade) + ' <small>' + escapeHtml(it.nome || it.item || '') + '</small>')
		.join('<br>');
}

function diaHtml(d) {
	const classe = 'pr-dia is-' + escapeHtml(d.estado);
	const titulo =
		'Dia ' +
		escapeHtml(d.dia) +
		' — ' +
		(Array.isArray(d.itens)
			? d.itens.map(it => escapeHtml(it.quantidade) + '× ' + escapeHtml(it.nome || it.item || '')).join(', ')
			: '');
	return (
		'<div class="' +
		classe +
		'" title="' +
		titulo +
		'">' +
		'<span class="pr-dia-numero">' +
		escapeHtml(d.dia) +
		'</span>' +
		'<span class="pr-dia-premio">' +
		premioHtml(d.itens) +
		'</span>' +
		'</div>'
	);
}

function nomeDoMes(periodo) {
	const mes = Number(periodo) % 100;
	return MESES[mes - 1] || '';
}

function render() {
	const root = _root();
	if (!root) {
		return;
	}
	const estado = PresencaIdle.estado;
	const mes = root.querySelector('.pr-mes');
	const progresso = root.querySelector('.pr-progresso');
	const grade = root.querySelector('.pr-grade');
	const recado = root.querySelector('.pr-recado');
	const btn = root.querySelector('.pr-recolher');
	if (!mes || !progresso || !grade || !recado || !btn) {
		return;
	}
	if (!estado) {
		mes.textContent = 'Carregando…';
		progresso.textContent = '';
		grade.innerHTML = '';
		recado.textContent = '';
		recado.className = 'pr-recado';
		btn.disabled = true;
		btn.textContent = 'Recolher';
		return;
	}
	mes.textContent = 'Presença de ' + nomeDoMes(estado.periodo) + ' · dia ' + estado.diaDoCalendario;
	progresso.innerHTML =
		'<strong>' + escapeHtml(estado.recolhidos) + '</strong> de ' + escapeHtml(estado.diasDoPeriodo) + ' dias recolhidos';
	grade.innerHTML = (estado.dias || []).map(diaHtml).join('');

	if (estado.recolhido) {
		const itens = (estado.recolhido.itens || [])
			.map(it => escapeHtml(it.quantidade) + '× ' + escapeHtml(it.nome || ''))
			.join(', ');
		recado.textContent =
			'Dia ' +
			estado.recolhido.dia +
			' recolhido: ' +
			itens +
			(estado.recolhido.destino === 'correio' ? ' — não coube na mochila, foi para o seu correio.' : ' — está na sua mochila.');
		recado.className = 'pr-recado is-ok';
	} else if (estado.recusa) {
		recado.textContent = RECUSAS[estado.recusa] || 'Não foi possível recolher agora.';
		recado.className = 'pr-recado is-erro';
	} else if (estado.podeRecolher) {
		recado.textContent = 'Recompensa do dia ' + estado.diaDeHoje + ' disponível. Todo jogador recebe — basta recolher.';
		recado.className = 'pr-recado';
	} else {
		recado.textContent = 'Nada a recolher agora. Volte amanhã depois da meia-noite.';
		recado.className = 'pr-recado';
	}

	btn.disabled = !estado.podeRecolher;
	btn.textContent = estado.podeRecolher ? 'Recolher dia ' + estado.diaDeHoje : 'Volte amanhã';
}

function onPresencaRecebida(pkt) {
	let dados;
	try {
		dados = JSON.parse(pkt.json);
	} catch (err) {
		console.error('[PresencaIdle] payload nao e JSON valido', err);
		return;
	}
	if (!dados || dados.v !== 1) {
		return;
	}
	PresencaIdle.estado = dados;
	render();
	// O servidor mandou abrir (login, uma vez por dia; ou a meia-noite): a
	// janela aparece sem clique. So ele decide isso — a janela nao tem relogio.
	if (dados.abrir === true) {
		abrir();
	}
}

Network.hookPacket(PACKET.ZC.RAGIDLE_PRESENCA, onPresencaRecebida);

export default UIManager.addComponent(PresencaIdle);
