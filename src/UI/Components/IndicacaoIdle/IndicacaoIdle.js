/**
 * UI/Components/IndicacaoIdle/IndicacaoIdle.js
 *
 * RAGIDLE: INDIQUE & GANHE (D-1164, 07/09/2026) — o sistema de indicacao,
 * no molde do Poke Idle World e com a nossa identidade visual: link com
 * codigo, 10% em cash de tudo que o indicado gastar (para sempre), contadores
 * de indicados e de ganhos, "voce foi indicado por X", a lista dos indicados e
 * o aviso de que o sistema esta em teste.
 *
 * Quem decide TUDO e o servidor (`servidor/indicacao.ts`): o codigo e derivado
 * da conta, o vinculo e avaliado la, a comissao e creditada la. A janela
 * desenha o que chegou e manda dois verbos pelo mesmo pacote
 * `CZ_RAGIDLE_INDICACAO_ACAO` (0x0fdd): `pedir` (ao abrir) e `usar` (o codigo
 * de um amigo, para quem chegou sem o `?ref=` — o PWA instalado perde a
 * query). A resposta e sempre o painel inteiro (`ZC_RAGIDLE_INDICACAO`,
 * 0x0fdc), com `recusa` quando o `usar` nao passou.
 *
 * This file is part of the ragidle fork of ROBrowser.
 */
import Renderer from 'Renderer/Renderer.js';
import Preferences from 'Core/Preferences.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import htmlText from './IndicacaoIdle.html?raw';
import cssText from './IndicacaoIdle.css?raw';
import { fecharEEsquecer } from '../limpezaDeJanelaIdle.js';

const WINDOW_WIDTH = 520;
const WINDOW_HEIGHT = 620;

const RECUSAS = {
	'codigo-invalido': 'Esse código não existe. Confira as seis letras com quem te indicou.',
	'proprio-codigo': 'Esse é o seu próprio código — não dá para se indicar.',
	'ja-indicado': 'Sua conta já tem quem a indicou, e isso não muda.',
	'indicador-nao-existe': 'Esse código não pertence a nenhuma conta.',
	'nao-e-conta-nova': 'Só contas novas (com um personagem) podem usar um código de indicação.'
};

const IndicacaoIdle = new GUIComponent('IndicacaoIdle', cssText);

IndicacaoIdle.render = () => htmlText;

IndicacaoIdle.mouseMode = GUIComponent.MouseMode.CROSS;

/** O ultimo painel que o servidor mandou. */
IndicacaoIdle.estado = null;

const _preferences = Preferences.get(
	'IndicacaoIdle',
	{
		x: null,
		y: null
	},
	1.0
);

function _root() {
	return IndicacaoIdle._shadow || IndicacaoIdle._host;
}

function escapeHtml(value) {
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

IndicacaoIdle.limparEstadoDoPersonagem = function limparEstadoDoPersonagem() {
	IndicacaoIdle.estado = null;
	fecharEEsquecer(_root(), '.in-window', { corpo: '.in-chips', texto: '' });
};

IndicacaoIdle.init = function init() {
	const root = _root();
	if (root) {
		const fechar = root.querySelector('.in-close');
		if (fechar) {
			fechar.addEventListener('click', onClickClose);
		}
		const titulo = root.querySelector('.in-titlebar');
		if (titulo) {
			this.draggable(titulo);
		}
		const copiar = root.querySelector('.in-copiar');
		if (copiar) {
			copiar.addEventListener('click', onClickCopiar);
		}
		const corpo = root.querySelector('.in-body');
		if (corpo) {
			// O botao "Usar" nasce no render; o clique e capturado no corpo.
			corpo.addEventListener('click', onClickCorpo);
			// Digitar no campo do codigo nao pode virar tecla de jogo.
			corpo.addEventListener('keydown', e => e.stopPropagation());
		}
	}
	this._host.style.top = Math.max(0, (Renderer.height - WINDOW_HEIGHT) / 2) + 'px';
	this._host.style.left = Math.max(0, (Renderer.width - WINDOW_WIDTH) / 2) + 'px';
	render();
};

IndicacaoIdle.onAppend = function onAppend() {
	if (_preferences.x != null && _preferences.y != null) {
		this._host.style.top = Math.min(Math.max(0, _preferences.y), Renderer.height - WINDOW_HEIGHT) + 'px';
		this._host.style.left = Math.min(Math.max(0, _preferences.x), Renderer.width - WINDOW_WIDTH) + 'px';
	}
};

IndicacaoIdle.onRemove = function onRemove() {
	savePosition();
};

function savePosition() {
	_preferences.x = parseInt(IndicacaoIdle._host.style.left, 10) || 0;
	_preferences.y = parseInt(IndicacaoIdle._host.style.top, 10) || 0;
	_preferences.save();
}

function enviarAcao(corpo) {
	const pkt = new PACKET.CZ.RAGIDLE_INDICACAO_ACAO();
	pkt.json = JSON.stringify(corpo);
	Network.sendPacket(pkt);
}

IndicacaoIdle.toggle = function toggle() {
	const root = _root();
	const win = root && root.querySelector('.in-window');
	if (!win) {
		return;
	}
	if (win.classList.contains('is-open')) {
		closeWindow();
	} else {
		win.classList.add('is-open');
		IndicacaoIdle.focus();
		enviarAcao({ acao: 'pedir' });
	}
};

function closeWindow() {
	const root = _root();
	const win = root && root.querySelector('.in-window');
	if (win) {
		win.classList.remove('is-open');
	}
	savePosition();
}

function onClickClose(e) {
	e.stopImmediatePropagation();
	closeWindow();
}

/**
 * Copiar: o Clipboard API quando houver (contexto seguro), senao o velho
 * `select()` + `execCommand` — o PWA em `127.0.0.1` do dev conta como seguro,
 * mas a reserva fica para o navegador que negar.
 */
function onClickCopiar(e) {
	e.stopImmediatePropagation();
	const root = _root();
	const campo = root && root.querySelector('.in-link');
	const btn = e.currentTarget;
	if (!campo || !campo.value) {
		return;
	}
	const confirmar = () => {
		if (!btn) {
			return;
		}
		const antes = btn.textContent;
		btn.textContent = 'Copiado!';
		btn.classList.add('is-copiado');
		setTimeout(() => {
			btn.textContent = antes;
			btn.classList.remove('is-copiado');
		}, 1600);
	};
	if (navigator.clipboard && navigator.clipboard.writeText) {
		navigator.clipboard.writeText(campo.value).then(confirmar, () => {
			campo.select();
			document.execCommand('copy');
			confirmar();
		});
	} else {
		campo.select();
		document.execCommand('copy');
		confirmar();
	}
}

function onClickCorpo(e) {
	const alvo = e.target && e.target.closest ? e.target.closest('.in-usar') : null;
	if (!alvo) {
		return;
	}
	e.stopImmediatePropagation();
	const root = _root();
	const campo = root && root.querySelector('.in-usar-codigo');
	const codigo = campo ? String(campo.value || '').trim().toUpperCase() : '';
	if (codigo.length !== 6) {
		mostrarRecado('O código tem seis letras.', 'is-erro');
		return;
	}
	alvo.disabled = true;
	enviarAcao({ acao: 'usar', codigo });
}

function mostrarRecado(texto, classe) {
	const root = _root();
	const recado = root && root.querySelector('.in-recado');
	if (!recado) {
		return;
	}
	recado.textContent = texto;
	recado.className = 'in-recado' + (classe ? ' ' + classe : '');
}

function indicadoPorHtml(estado) {
	if (estado.indicadoPor) {
		return (
			'<div class="in-cartao-verde">Você foi indicado por <strong>' +
			escapeHtml(estado.indicadoPor) +
			'</strong>. 🎉</div>'
		);
	}
	if (estado.podeUsarCodigo) {
		return (
			'<div class="in-rotulo">Alguém te indicou?</div>' +
			'<div class="in-usar-linha">' +
			'<input type="text" class="in-usar-codigo ri-input" maxlength="6" placeholder="CÓDIGO" aria-label="Código de indicação">' +
			'<button type="button" class="in-usar ri-btn ri-btn--sec">Usar código</button>' +
			'</div>' +
			'<div class="in-recado' +
			(estado.recusa ? ' is-erro' : '') +
			'">' +
			escapeHtml(estado.recusa ? RECUSAS[estado.recusa] || 'Não foi possível usar esse código.' : 'Vale só para contas novas. Quem te indicou passa a ganhar 10% do que você gastar.') +
			'</div>'
		);
	}
	return '';
}

function chipsHtml(indicados) {
	if (!Array.isArray(indicados) || indicados.length === 0) {
		return '<div class="in-vazio">Ninguém ainda. Mande o link para um amigo.</div>';
	}
	return indicados
		.map(
			i =>
				'<span class="in-chip" title="Nível ' +
				escapeHtml(i.nivel) +
				'">' +
				escapeHtml(i.nome) +
				' <small>Nv ' +
				escapeHtml(i.nivel) +
				'</small></span>'
		)
		.join('');
}

function render() {
	const root = _root();
	if (!root) {
		return;
	}
	const estado = IndicacaoIdle.estado;
	const link = root.querySelector('.in-link');
	const codigo = root.querySelector('.in-codigo');
	const taxa = root.querySelector('.in-taxa');
	const total = root.querySelector('.in-indicados-total');
	const ganhos = root.querySelector('.in-ganhos-valor');
	const indicadoPor = root.querySelector('.in-indicado-por');
	const chips = root.querySelector('.in-chips');
	const listaTotal = root.querySelector('.in-lista-total');
	if (!link || !codigo || !taxa || !total || !ganhos || !indicadoPor || !chips || !listaTotal) {
		return;
	}
	if (!estado) {
		link.value = '';
		codigo.textContent = '······';
		total.textContent = '0';
		ganhos.textContent = '0';
		indicadoPor.innerHTML = '';
		chips.innerHTML = '<div class="in-vazio">Carregando…</div>';
		listaTotal.textContent = '';
		return;
	}
	link.value = estado.link || '';
	codigo.textContent = estado.codigo || '';
	taxa.textContent = String(estado.taxa || 10) + '%';
	const indicados = Array.isArray(estado.indicados) ? estado.indicados : [];
	total.textContent = String(indicados.length);
	ganhos.textContent = String(estado.ganhos || 0);
	indicadoPor.innerHTML = indicadoPorHtml(estado);
	listaTotal.textContent = '(' + indicados.length + ')';
	chips.innerHTML = chipsHtml(indicados);
}

function onIndicacaoRecebida(pkt) {
	let dados;
	try {
		dados = JSON.parse(pkt.json);
	} catch (err) {
		console.error('[IndicacaoIdle] payload nao e JSON valido', err);
		return;
	}
	if (!dados || dados.v !== 1) {
		return;
	}
	IndicacaoIdle.estado = dados;
	render();
}

Network.hookPacket(PACKET.ZC.RAGIDLE_INDICACAO, onIndicacaoRecebida);

export default UIManager.addComponent(IndicacaoIdle);
