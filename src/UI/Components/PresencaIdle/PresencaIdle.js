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
 * do calendario — outro modelo. Ver D-959 para o que a nativa fazia aqui.
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
import { itemIconUrl } from 'Utils/ItemArt.js';

/*
 * A FRASE DO PRINT (08/09/2026). Ela mora na sobra da ultima fileira da grade
 * e e a unica linha de sabor da janela — o resto do texto aqui e informacao do
 * servidor. Fica no JS, e nao no HTML, porque e um FILHO DA GRADE: o
 * `grid-column: auto / -1` da folha so a coloca "no que sobrou" se ela for
 * irma dos dias, e a grade e reescrita inteira a cada painel.
 */
const FRASE_DO_MES = 'Todo dia é um novo passo para um mundo melhor!';

/* A COPIA da conta que esta no `:host` de PresencaIdle.css (620x640 desde
   08/09/2026, com o desenho do print). As duas andam JUNTAS: e por estas
   constantes que a janela se centraliza, e uma divergencia poe a janela fora
   do centro sem erro nenhum aparecer. */
const WINDOW_WIDTH = 620;
const WINDOW_HEIGHT = 640;

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

/** "x5 Poção Branca" — uma linha por item, com a quantidade em ouro. */
function premioHtml(itens) {
	if (!Array.isArray(itens) || itens.length === 0) {
		return '';
	}
	const linhas = itens
		.map(
			it =>
				'<span class="pr-dia-linha"><b class="pr-dia-qtd">x' +
				escapeHtml(it.quantidade) +
				'</b><span class="pr-dia-nome">' +
				escapeHtml(it.nome || it.item || '') +
				'</span></span>'
		)
		.join('');
	return '<span class="pr-dia-premio">' + linhas + '</span>';
}

/**
 * A ARTE do dia: o icone 24x24 do PRIMEIRO item, entre os dois brilhos do
 * print (regra 4 — o quadro e CSS, o que informa e o PNG do cliente).
 *
 * O `itemId` ja vinha no payload desde D-1162: o servidor resolve o AegisName
 * antes de mandar (`enviarPresenca`). Ninguem estava desenhando.
 *
 * DOIS jeitos de nao haver icone, e nos dois o quadro continua de pe (os
 * brilhos sozinhos ja preenchem a faixa do meio): o item que o servidor nao
 * soube resolver chega com `itemId: 0`, e o item que o pipeline de arte ainda
 * nao converteu (hoje sao 582 ids) da 404 — dai o `onerror` tira a imagem.
 * Nao ha volta ao GRF aqui de proposito: as recompensas de presenca sao itens
 * comuns, todos publicados, e montar o caminho antigo (DB + Client.loadFile)
 * por um caso que nao acontece seria codigo que ninguem consegue provar.
 */
function arteHtml(itens) {
	const primeiro = Array.isArray(itens) ? itens[0] : null;
	const id = primeiro ? Number(primeiro.itemId) : 0;
	const icone =
		Number.isFinite(id) && id > 0
			? '<img class="pr-dia-icone" src="' +
				escapeHtml(itemIconUrl(id)) +
				'" alt="" onerror="this.remove()">'
			: '';
	return (
		'<span class="pr-dia-arte">' +
		'<span class="pr-brilho" aria-hidden="true"></span>' +
		icone +
		'<span class="pr-brilho" aria-hidden="true"></span>' +
		'</span>'
	);
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
		arteHtml(d.itens) +
		premioHtml(d.itens) +
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
	/* O MES em ouro (o `<b>` que a folha pinta), o resto na cor do titulo — o
	   nome do mes sai da tabela MESES daqui, nao do servidor, entao o `<b>`
	   nunca embrulha texto de fora; o dia vem do payload e por isso escapa. */
	mes.innerHTML =
		'Presença de <b>' + nomeDoMes(estado.periodo) + '</b> · dia ' + escapeHtml(estado.diaDoCalendario);
	progresso.innerHTML =
		'<strong>' + escapeHtml(estado.recolhidos) + '</strong> de ' + escapeHtml(estado.diasDoPeriodo) + ' dias recolhidos';
	/* A frase ocupa O QUE SOBROU da ultima fileira, e quanto sobra depende do
	   mes: 30 dias deixam 5 colunas, 31 deixam 4, 28 nao deixam nenhuma (e ai
	   ela ganha uma fileira inteira, com o `|| 7`). A conta e do JS porque so
	   ele sabe quantos dias o painel trouxe. */
	const dias = estado.dias || [];
	const colunasLivres = (7 - (dias.length % 7)) % 7 || 7;
	grade.innerHTML =
		dias.map(diaHtml).join('') +
		'<p class="pr-frase" style="--pr-frase-colunas: ' +
		colunasLivres +
		'">' +
		escapeHtml(FRASE_DO_MES) +
		'</p>';

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
