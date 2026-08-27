/**
 * UI/Components/MissoesIdle/MissoesIdle.js
 *
 * A JANELA DE MISSÕES (D-551): abas Principais/Opcionais, cards com estado,
 * requisito legível, objetivos com progresso e — na missão de Troca de
 * Classe — a grade de classes com o botão "Ir até o NPC".
 *
 * Três escolhas de desenho, nenhuma estética:
 *
 * 1. **Quem decide o estado é o SERVIDOR.** Este componente desenha o que
 *    `ZC_RAGIDLE_MISSOES` (0x0fed) manda — estado, requisito e progresso
 *    chegam prontos. Recalcular aqui daria a segunda cópia da regra, a que
 *    ninguém lembra de atualizar (a mesma escolha do aviso de classe,
 *    ClassChangeNotice.js:12-15).
 *
 * 2. **O botão "Ir até o NPC" manda `CZ_RAGIDLE_VIAJAR`** — o MESMO pacote
 *    da janela "Mapa de Caça" e do aviso de classe, nunca um caminho novo.
 *    O servidor já sabe recusar mapa que não carrega.
 *
 * 3. **O pacote chega também sem pedir** (empurrado no level up e na troca),
 *    então o render é idempotente e a janela fechada só guarda o dado — o
 *    custo de desenhar só existe quando ela está aberta.
 *
 * Entrada na HUD: o botão "Missões" do cluster de essenciais
 * (TopMenuIdle.html/TopMenuIdle.js), que chama MissoesIdle.toggle().
 *
 * @author RagIdle
 */

import Renderer from 'Renderer/Renderer.js';
import Preferences from 'Core/Preferences.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import htmlText from './MissoesIdle.html?raw';
import cssText from './MissoesIdle.css?raw';

/** Manter em sincronia com o ":host"/".mi-window" do CSS (mesmo papel do
 * WINDOW_WIDTH/HEIGHT de IdleConfig.js:47-48). */
const WINDOW_WIDTH = 560;
const WINDOW_HEIGHT = 520;

const MissoesIdle = new GUIComponent('MissoesIdle', cssText);

MissoesIdle.render = () => htmlText;

/** Janela fechada não pode engolir clique de cena — par do
 * ":host{pointer-events:none}" do CSS (mesma escolha de IdleConfig.js). */
MissoesIdle.mouseMode = GUIComponent.MouseMode.CROSS;

/** As missões que o servidor mandou por último ({v:1, missoes:[...]}). */
MissoesIdle.missoes = [];

/** O retrato do EXECUTOR (D-601): {ativaId, tituloAtiva, passo, fila, pausada}.
 * O tracker (MissoesTrackerIdle) LÊ daqui — uma fonte só, um hook só. */
MissoesIdle.execucao = null;

/** Aba ativa: 'principais' | 'opcionais'. */
MissoesIdle.activeTab = 'principais';

const _preferences = Preferences.get(
	'MissoesIdle',
	{
		x: null,
		y: null
	},
	1.0
);

function _root() {
	return MissoesIdle._shadow || MissoesIdle._host;
}

/** Mesmo helper privado de IdleConfig.js:126-148 / HuntMap.js:133-148. */
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

/** O rótulo e a cor de cada estado — o VALOR vem do servidor, aqui só a pele. */
const BADGES = {
	bloqueada: { classe: 'ri-badge--cinza', rotulo: 'Bloqueada' },
	disponivel: { classe: 'ri-badge--azul', rotulo: 'Disponível' },
	'em-andamento': { classe: 'ri-badge--ouro', rotulo: 'Em andamento' },
	concluida: { classe: 'ri-badge--verde', rotulo: 'Concluída' }
};

/**
 * ESQUECE O PERSONAGEM ANTERIOR — ver a nota gemea em IdleConfig.js
 * (27/08/2026, auditoria C). `cleanGameUI()` nao limpava nenhum componente
 * RAGIDLE, e a troca de personagem nao recarrega a pagina.
 */
MissoesIdle.limparEstadoDoPersonagem = function limparEstadoDoPersonagem() {
	MissoesIdle.missoes = [];
	MissoesIdle.execucao = null;
	MissoesIdle.activeTab = 'principais';
};

MissoesIdle.init = function init() {
	const root = _root();
	// Guardas nos querySelector, pelo motivo registrado em
	// ClassChangeNotice.js:68-88: este init roda dentro de MapEngine.init, e
	// uma exceção aqui derruba o motor de mapa inteiro. Janela de missões é
	// cosmética; o que ela não pode é custar o mundo 3D.
	const fechar = root && root.querySelector('.mi-close');
	if (fechar) {
		fechar.addEventListener('click', onClickClose);
	}
	if (root) {
		root.querySelectorAll('.mi-tab').forEach(btn => btn.addEventListener('click', onClickTab));
		const titulo = root.querySelector('.mi-titlebar');
		if (titulo) {
			this.draggable(titulo);
		}
	}

	this._host.style.top = Math.max(0, (Renderer.height - WINDOW_HEIGHT) / 2) + 'px';
	this._host.style.left = Math.max(0, (Renderer.width - WINDOW_WIDTH) / 2) + 'px';

	render();
};

MissoesIdle.onAppend = function onAppend() {
	if (_preferences.x != null && _preferences.y != null) {
		this._host.style.top = Math.min(Math.max(0, _preferences.y), Renderer.height - WINDOW_HEIGHT) + 'px';
		this._host.style.left = Math.min(Math.max(0, _preferences.x), Renderer.width - WINDOW_WIDTH) + 'px';
	}
};

MissoesIdle.onRemove = function onRemove() {
	savePosition();
};

function savePosition() {
	_preferences.x = parseInt(MissoesIdle._host.style.left, 10) || 0;
	_preferences.y = parseInt(MissoesIdle._host.style.top, 10) || 0;
	_preferences.save();
}

/** Abre/fecha; ao abrir, pede o estado ao servidor (mesmo formato do
 * toggle() de IdleConfig.js). */
MissoesIdle.toggle = function toggle() {
	const root = _root();
	const win = root && root.querySelector('.mi-window');
	if (!win) {
		return;
	}
	if (win.classList.contains('is-open')) {
		closeWindow();
	} else {
		win.classList.add('is-open');
		MissoesIdle.focus();
		Network.sendPacket(new PACKET.CZ.RAGIDLE_PEDIR_MISSOES());
	}
};

function closeWindow() {
	const root = _root();
	const win = root && root.querySelector('.mi-window');
	if (win) {
		win.classList.remove('is-open');
	}
	savePosition();
}

function onClickClose(e) {
	e.stopImmediatePropagation();
	closeWindow();
}

function onClickTab(e) {
	e.stopImmediatePropagation();
	MissoesIdle.activeTab = e.currentTarget.dataset.tab;
	render();
}

function render() {
	const root = _root();
	if (!root) {
		return;
	}
	const body = root.querySelector('.mi-body');
	if (!body) {
		return;
	}

	root.querySelectorAll('.mi-tab').forEach(btn => {
		btn.classList.toggle('is-active', btn.dataset.tab === MissoesIdle.activeTab);
	});

	const tipoDaAba = MissoesIdle.activeTab === 'opcionais' ? 'opcional' : 'principal';
	const daAba = (MissoesIdle.missoes || []).filter(m => m.tipo === tipoDaAba);

	if (!daAba.length) {
		// A aba Opcionais é ESTRUTURA por enquanto (decisão do dono, 24/08/2026):
		// o formato de dados já aceita `tipo: "opcional"`, e a primeira que o
		// servidor mandar aparece aqui sem mexer em nada.
		body.innerHTML =
			MissoesIdle.activeTab === 'opcionais'
				? '<div class="mi-empty">Nenhuma missão opcional por enquanto — em breve.</div>'
				: '<div class="mi-empty">Nenhuma missão principal disponível.</div>';
		return;
	}

	body.innerHTML = daAba.map(cardDeMissao).join('');

	body.querySelectorAll('[data-mapa]').forEach(btn => {
		btn.addEventListener('click', e => {
			e.stopImmediatePropagation();
			const pkt = new PACKET.CZ.RAGIDLE_VIAJAR();
			pkt.mapName = btn.dataset.mapa;
			Network.sendPacket(pkt);
			// A viagem troca de mapa; a janela fecha para não cobrir a chegada.
			// O estado continua vivo no servidor — reabrir re-pede.
			closeWindow();
		});
	});

	// O 1-CLIQUE do executor (D-601): Iniciar/Pausar/Retomar mandam a ação e
	// o SERVIDOR decide — recusa educada chega pelo feed, nunca um alert.
	body.querySelectorAll('[data-executar]').forEach(btn => {
		btn.addEventListener('click', e => {
			e.stopImmediatePropagation();
			const pkt = new PACKET.CZ.RAGIDLE_MISSAO_ACAO();
			const acao = btn.dataset.executar;
			pkt.json = JSON.stringify(
				acao === 'iniciar' ? { acao, id: btn.dataset.id } : { acao }
			);
			Network.sendPacket(pkt);
		});
	});
}

function cardDeMissao(m) {
	const badge = BADGES[m.estado] || BADGES.bloqueada;
	const execucao = MissoesIdle.execucao || {};

	// O botão do executor (D-601): um clique, nenhuma pergunta.
	let botao = '';
	if (m.executavel) {
		if (execucao.ativaId === m.id) {
			botao = `<button type="button" class="ri-btn ri-btn--sec mi-executar" data-executar="pausar">Pausar</button>`;
		} else if (m.naFila) {
			botao = `<span class="mi-fila-aviso">Na fila…</span>`;
		} else if (m.estado === 'disponivel' || (m.estado === 'concluida' && m.repetivel && !m.cooldownS)) {
			botao = `<button type="button" class="ri-btn ri-btn--ouro mi-executar" data-executar="iniciar" data-id="${escapeHtml(m.id)}">Iniciar</button>`;
		} else if (m.cooldownS > 0) {
			botao = `<span class="mi-fila-aviso">Recarrega em ${Math.ceil(m.cooldownS / 60)} min</span>`;
		}
	}
	const rodape = botao ? `<div class="mi-card-rodape">${botao}</div>` : '';
	const dificuldade = m.dificuldade
		? `<span class="ri-badge ri-badge--cinza mi-dif" title="Dificuldade">${escapeHtml(m.dificuldade)}</span>`
		: '';

	const objetivos = (m.objetivos || [])
		.map(
			o => `
			<div class="mi-objetivo">
				<span>${escapeHtml(o.descricao)}</span>
				<span class="mi-objetivo-conta">${escapeHtml(o.progresso)}/${escapeHtml(o.alvo)}</span>
			</div>`
		)
		.join('');

	const recompensas =
		m.recompensas && m.recompensas.length
			? `<p class="mi-recompensas">Recompensas: ${m.recompensas
					.map(r => escapeHtml(r.item ? `${r.quantidade}x ${r.item}` : `${r.quantidade} ${r.tipo}`))
					.join(', ')}</p>`
			: '';

	// A grade de classes: informa sempre que a missão está viva (bloqueada
	// mostra em meia-luz o que vem pela frente), mas o botão de viajar só
	// existe quando o SERVIDOR disse "disponivel". Concluída não mostra grade
	// — não há mais nada a fazer nela.
	const classes =
		m.classes && m.classes.length && m.estado !== 'concluida'
			? `<div class="mi-classes">${m.classes
					.map(
						c => `
					<div class="mi-classe">
						<span class="mi-classe-nome">${escapeHtml(c.nomePt)}</span>
						<span class="mi-classe-cidade">${escapeHtml(c.mestre)} · ${escapeHtml(c.cidade)}</span>
						<span class="mi-classe-resumo">${escapeHtml(c.resumo)}</span>
						${
							m.estado === 'disponivel'
								? `<button type="button" class="mi-ir ri-btn" data-mapa="${escapeHtml(c.mapa)}">Ir até o NPC</button>`
								: ''
						}
					</div>`
					)
					.join('')}</div>`
			: '';

	return `
		<div class="mi-card" data-missao="${escapeHtml(m.id)}" data-estado="${escapeHtml(m.estado)}">
			<div class="mi-card-topo">
				<span class="mi-card-titulo">${escapeHtml(m.titulo)}</span>
				<span class="mi-card-badges">${dificuldade}<span class="ri-badge ${badge.classe}">${badge.rotulo}</span></span>
			</div>
			<p class="mi-desc">${escapeHtml(m.descricao)}</p>
			${m.estado === 'bloqueada' && m.requisito ? `<p class="mi-requisito">${escapeHtml(m.requisito)}</p>` : ''}
			${objetivos}
			${recompensas}
			${classes}
			${rodape}
		</div>`;
}

/**
 * O servidor mandou o estado — pedido ou empurrado, o caminho é um só.
 * Ele só escreve no fio quando o payload muda, então não há o que filtrar
 * aqui (mesmo contrato do aviso de classe).
 */
function onMissoesRecebidas(pkt) {
	let dados;
	try {
		dados = JSON.parse(pkt.json);
	} catch (err) {
		console.error('[MissoesIdle] payload nao e JSON valido', err);
		return;
	}
	if (!dados || dados.v !== 1) {
		return;
	}
	MissoesIdle.missoes = Array.isArray(dados.missoes) ? dados.missoes : [];
	MissoesIdle.execucao = dados.execucao && typeof dados.execucao === 'object' ? dados.execucao : null;
	render();
}

Network.hookPacket(PACKET.ZC.RAGIDLE_MISSOES, onMissoesRecebidas);

export default UIManager.addComponent(MissoesIdle);
