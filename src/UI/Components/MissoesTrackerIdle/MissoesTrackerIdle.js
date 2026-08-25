/**
 * UI/Components/MissoesTrackerIdle/MissoesTrackerIdle.js
 *
 * O TRACKER DE MISSÕES (D-601) — o painel estilo Ragnarok Origin ancorado
 * ABAIXO das informações do personagem, pedido do dono em 25/08/2026:
 * "só clicar na missão e ele faz tudo automático".
 *
 * Três escolhas de desenho:
 *
 * 1. **Uma fonte de dados só.** `Network.hookPacket` SOBRESCREVE o handler do
 *    pacote (NetworkManager.js:200-210) — fisgar `ZC_RAGIDLE_MISSOES` aqui
 *    roubaria a janela MissoesIdle. Este painel LÊ `MissoesIdle.missoes` e
 *    `MissoesIdle.execucao` por polling de 250ms — o mesmo idioma do
 *    CorreioIdle com o Rodex nativo, e pela mesma razão.
 *
 * 2. **A âncora é MEDIDA, não fixa.** O BasicInfoIdle é arrastável e muda de
 *    altura ao compactar, sem emitir evento nenhum — então o syncPosition()
 *    lê o getBoundingClientRect() do host dele no mesmo polling e se
 *    posiciona logo abaixo, com a mesma largura. O painel anda junto quando
 *    o jogador arrasta o cartão do personagem.
 *
 * 3. **Um clique, nenhuma pergunta.** Clicar numa missão manda
 *    `CZ_RAGIDLE_MISSAO_ACAO {acao:'iniciar'}` e pronto — o servidor valida,
 *    recusa com motivo no feed se for o caso, e o executor assume. Sem
 *    confirmação: a recusa educada do servidor é mais barata que um "tem
 *    certeza?" para quem tem 5 anos.
 *
 * @author RagIdle
 */

import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import BasicInfoIdle from 'UI/Components/BasicInfoIdle/BasicInfoIdle.js';
import MissoesIdle from 'UI/Components/MissoesIdle/MissoesIdle.js';
import htmlText from './MissoesTrackerIdle.html?raw';
import cssText from './MissoesTrackerIdle.css?raw';

/** Quantas missões clicáveis o painel lista (as demais ficam na janela). */
const MAX_LINHAS = 5;

const MissoesTrackerIdle = new GUIComponent('MissoesTrackerIdle', cssText);

MissoesTrackerIdle.render = () => htmlText;
MissoesTrackerIdle.mouseMode = GUIComponent.MouseMode.CROSS;
MissoesTrackerIdle.needFocus = false;

let _timer = null;
let _recolhido = false;
let _assinatura = '';

function _root() {
	return MissoesTrackerIdle._shadow || MissoesTrackerIdle._host;
}

function escapeHtml(value) {
	return String(value == null ? '' : value).replace(/[&<>"']/g, ch => {
		switch (ch) {
			case '&':
				return '&amp;';
			case '<':
				return '&lt;';
			case '>':
				return '&gt;';
			case '"':
				return '&quot;';
			default:
				return '&#39;';
		}
	});
}

function mandarAcao(acao, id) {
	const pkt = new PACKET.CZ.RAGIDLE_MISSAO_ACAO();
	pkt.json = JSON.stringify(id ? { acao, id } : { acao });
	Network.sendPacket(pkt);
}

MissoesTrackerIdle.init = function init() {
	const root = _root();
	// Guardas pelo motivo de ClassChangeNotice.js:68-88: este init roda dentro
	// de MapEngine.init e uma exceção aqui derruba o mundo 3D.
	const recolher = root && root.querySelector('.mt-recolher');
	if (recolher) {
		recolher.addEventListener('click', e => {
			e.stopImmediatePropagation();
			_recolhido = !_recolhido;
			const painel = _root().querySelector('.mt-painel');
			if (painel) {
				painel.classList.toggle('is-recolhido', _recolhido);
			}
			recolher.textContent = _recolhido ? '+' : '−';
		});
	}
	// Delegação: um listener no corpo resolve lista re-renderizada por
	// innerHTML (o padrão do CorreioIdle).
	const corpo = root && root.querySelector('.mt-corpo');
	if (corpo) {
		corpo.addEventListener('click', e => {
			const btn = e.target.closest('[data-acao]');
			if (!btn) {
				return;
			}
			e.stopImmediatePropagation();
			const acao = btn.dataset.acao;
			if (acao === 'iniciar' && btn.dataset.fila !== 'true') {
				mandarAcao('iniciar', btn.dataset.id);
			} else if (acao === 'pausar' || acao === 'retomar') {
				mandarAcao(acao, null);
			}
		});
	}
};

MissoesTrackerIdle.onAppend = function onAppend() {
	if (_timer) {
		clearInterval(_timer);
	}
	_timer = setInterval(() => {
		syncPosition();
		renderSeMudou();
	}, 250);
	syncPosition();
	renderSeMudou();
};

MissoesTrackerIdle.onRemove = function onRemove() {
	if (_timer) {
		clearInterval(_timer);
		_timer = null;
	}
};

/** Cola o painel logo abaixo do cartão do personagem, na mesma coluna. */
function syncPosition() {
	const host = MissoesTrackerIdle._host;
	const alvo = BasicInfoIdle && BasicInfoIdle._host;
	if (!host || !alvo) {
		return;
	}
	const rect = alvo.getBoundingClientRect();
	if (!rect || rect.width === 0) {
		return;
	}
	host.style.top = Math.round(rect.bottom + 8) + 'px';
	host.style.left = Math.round(rect.left) + 'px';
}

function renderSeMudou() {
	const missoes = MissoesIdle.missoes || [];
	const execucao = MissoesIdle.execucao || null;
	const assinatura = JSON.stringify([execucao, missoes.map(m => [m.id, m.estado, m.cooldownS, m.naFila])]);
	if (assinatura === _assinatura) {
		return;
	}
	_assinatura = assinatura;
	render(missoes, execucao);
}

function render(missoes, execucao) {
	const root = _root();
	if (!root) {
		return;
	}
	const caixaAtiva = root.querySelector('.mt-ativa');
	const lista = root.querySelector('.mt-lista');
	if (!caixaAtiva || !lista) {
		return;
	}

	/* A ATIVA (ou o estado pausado) no topo. */
	if (execucao && execucao.ativaId) {
		const passo = execucao.passo || {};
		const temBarra = typeof passo.progresso === 'number' && typeof passo.alvo === 'number' && passo.alvo > 0;
		const pct = temBarra ? Math.round((passo.progresso / passo.alvo) * 100) : 0;
		caixaAtiva.dataset.vazia = 'false';
		caixaAtiva.innerHTML = `
			<div class="mt-ativa-titulo">${escapeHtml(execucao.tituloAtiva || execucao.ativaId)}</div>
			<div class="mt-ativa-passo">${escapeHtml(passo.texto || 'Trabalhando...')}${
				temBarra ? ` — ${passo.progresso}/${passo.alvo}` : ''
			}</div>
			${temBarra ? `<div class="mt-barra"><div class="mt-barra-fill" style="width:${pct}%"></div></div>` : ''}
			<div class="mt-ativa-acoes">
				<span class="mt-eta">${passo.etaMin ? `~${passo.etaMin} min` : ''}</span>
				<button type="button" class="ri-btn ri-btn--sec mt-btn-mini" data-acao="pausar">Pausar</button>
			</div>`;
	} else if (execucao && execucao.pausada) {
		caixaAtiva.dataset.vazia = 'false';
		caixaAtiva.innerHTML = `
			<div class="mt-ativa-titulo">Missões pausadas</div>
			<div class="mt-ativa-passo">${execucao.fila.length} na fila esperando você.</div>
			<div class="mt-ativa-acoes">
				<span class="mt-eta"></span>
				<button type="button" class="ri-btn ri-btn--ouro mt-btn-mini" data-acao="retomar">Retomar</button>
			</div>`;
	} else {
		caixaAtiva.dataset.vazia = 'true';
		caixaAtiva.innerHTML = '';
	}

	/* A lista de 1-clique: disponíveis executáveis primeiro, depois a fila. */
	const naFila = new Set((execucao && execucao.fila) || []);
	const clicaveis = missoes
		.filter(m => m.executavel && (m.estado === 'disponivel' || naFila.has(m.id)))
		.sort((a, b) => (naFila.has(b.id) ? 1 : 0) - (naFila.has(a.id) ? 1 : 0));
	const linhas = clicaveis.slice(0, MAX_LINHAS).map(m => {
		const fila = naFila.has(m.id);
		return `
			<li>
				<button type="button" class="mt-item" data-acao="iniciar" data-id="${escapeHtml(m.id)}" data-fila="${fila}">
					<span class="mt-item-seta">${fila ? '…' : '▶'}</span>
					<span class="mt-item-nome">${escapeHtml(m.titulo)}</span>
					<span class="mt-item-nivel">${fila ? 'na fila' : escapeHtml(m.dificuldade || '')}</span>
				</button>
			</li>`;
	});
	lista.innerHTML =
		linhas.join('') ||
		(execucao && execucao.ativaId
			? ''
			: '<li class="mt-vazio">Nenhuma missão disponível agora — suba de nível!</li>');
}

export default UIManager.addComponent(MissoesTrackerIdle);
