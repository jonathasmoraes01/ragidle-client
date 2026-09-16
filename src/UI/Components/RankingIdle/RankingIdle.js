/**
 * UI/Components/RankingIdle/RankingIdle.js
 *
 * RAGIDLE: O RANKING (09/09/2026) — quatro abas, e as quatro descem juntas.
 *
 * Quem calcula tudo e o servidor (`servidor/mapa/ranking.ts`): a ordem, o
 * desempate, quem fica de fora e a minha posicao. A janela desenha o que
 * chegou e manda um verbo so pelo `CZ_RAGIDLE_RANKING_ACAO` (0x0fc9):
 * `pedir`, ao abrir.
 *
 * ## Por que as quatro abas vem no mesmo pacote
 *
 * Sao 4 x 20 linhas de `{posicao, nome, classe, valor}` — poucos kB. Trocar de
 * aba sem ida ao servidor e o que faz a janela parecer instantanea; uma aba por
 * pedido faria o jogador esperar quatro vezes so para comparar duas.
 *
 * ## O que NAO esta aqui
 *
 * Nenhuma ordenacao, nenhum corte, nenhum desempate. Refazer qualquer um deles
 * no cliente seria a "segunda rota escrita a mao" que este projeto ja pagou
 * treze vezes — e ela erraria no caso que importa: o empate, onde o servidor
 * desempata por nome para a lista nao se embaralhar entre dois F5.
 *
 * This file is part of the ragidle fork of ROBrowser.
 */
import Renderer from 'Renderer/Renderer.js';
import Preferences from 'Core/Preferences.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import MonsterTable from 'DB/Monsters/MonsterTable.js';
import htmlText from './RankingIdle.html?raw';
import cssText from './RankingIdle.css?raw';
import { fecharEEsquecer } from '../limpezaDeJanelaIdle.js';
import { abaLembrada, lembrarAba } from '../memoriaDeAba.js';

const WINDOW_WIDTH = 460;
const WINDOW_HEIGHT = 560;

/** A aba padrao. Nivel de base e a que quase todo jogador quer ver primeiro. */
const ABA_PADRAO = 'base';

/** O rotulo de cada eixo no rodape — o que o numero da coluna quer dizer. */
const NOTA_DO_EIXO = {
	base: 'Nível de base — o que a experiência de aventura acumulou.',
	classe: 'Nível de classe — o que a experiência de profissão acumulou.',
	codex: 'Entradas do Codex concluídas.',
	cartas: 'Cartas diferentes já vistas cair. Conta a partir de 09/09/2026.'
};

function larguraNaTela() {
	return Math.min(WINDOW_WIDTH, Math.max(0, Renderer.width - 16));
}

function alturaNaTela() {
	return Math.min(WINDOW_HEIGHT, Math.max(0, Renderer.height - 132));
}

const RankingIdle = new GUIComponent('RankingIdle', cssText);

RankingIdle.render = () => htmlText;

RankingIdle.mouseMode = GUIComponent.MouseMode.CROSS;

/** O ultimo painel que o servidor mandou. */
RankingIdle.estado = null;

/** A aba visivel. Lembrada entre sessoes, como as outras janelas de aba. */
RankingIdle.eixo = ABA_PADRAO;

const _preferences = Preferences.get(
	'RankingIdle',
	{
		x: null,
		y: null,
		aba: null
	},
	1.0
);

function _root() {
	return RankingIdle._shadow || RankingIdle._host;
}

function escapeHtml(value) {
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

RankingIdle.limparEstadoDoPersonagem = function limparEstadoDoPersonagem() {
	// O "sou eu" e do PERSONAGEM: deixar o painel atravessar destacaria a linha
	// de A na janela de B — o mesmo defeito que a limpeza do catálogo resolve
	// no Mapa de Caça.
	RankingIdle.estado = null;
	fecharEEsquecer(_root(), '.rk-window', { corpo: '.rk-lista', texto: '' });
};

RankingIdle.init = function init() {
	const root = _root();
	if (root) {
		const fechar = root.querySelector('.rk-close');
		if (fechar) {
			fechar.addEventListener('click', onClickClose);
		}
		const titulo = root.querySelector('.rk-titlebar');
		if (titulo) {
			this.draggable(titulo);
		}
		root.querySelectorAll('.rk-aba').forEach(b => b.addEventListener('click', onClickAba));
	}
	RankingIdle.eixo = abaLembrada(_preferences, ABA_PADRAO);
	this._host.style.top = Math.max(0, (Renderer.height - alturaNaTela()) / 2) + 'px';
	this._host.style.left = Math.max(0, (Renderer.width - larguraNaTela()) / 2) + 'px';
	render();
};

RankingIdle.onAppend = function onAppend() {
	if (_preferences.x != null && _preferences.y != null) {
		this._host.style.top =
			Math.min(Math.max(0, _preferences.y), Math.max(0, Renderer.height - alturaNaTela())) + 'px';
		this._host.style.left =
			Math.min(Math.max(0, _preferences.x), Math.max(0, Renderer.width - larguraNaTela())) + 'px';
	}
};

RankingIdle.onRemove = function onRemove() {
	savePosition();
};

function savePosition() {
	_preferences.x = parseInt(RankingIdle._host.style.left, 10) || 0;
	_preferences.y = parseInt(RankingIdle._host.style.top, 10) || 0;
	_preferences.save();
}

function onClickClose(e) {
	e.stopImmediatePropagation();
	RankingIdle.toggle();
}

function onClickAba(e) {
	e.stopImmediatePropagation();
	RankingIdle.eixo = e.currentTarget.dataset.eixo || ABA_PADRAO;
	lembrarAba(_preferences, RankingIdle.eixo);
	render();
}

function pedir() {
	const pkt = new PACKET.CZ.RAGIDLE_RANKING_ACAO();
	pkt.json = JSON.stringify({ acao: 'pedir' });
	Network.sendPacket(pkt);
}

RankingIdle.toggle = function toggle() {
	const win = _root().querySelector('.rk-window');
	if (!win) {
		return;
	}
	if (win.classList.contains('is-open')) {
		win.classList.remove('is-open');
		savePosition();
		return;
	}
	win.classList.add('is-open');
	RankingIdle.focus();
	// Pede SEMPRE ao abrir: um ranking guardado da sessao passada e um numero
	// que envelheceu, e o custo de reperguntar e um pacote.
	pedir();
	render();
};

/** O nome da classe em portugues, do proprio cliente. */
function nomeDaClasse(job) {
	/*
	 * A MESMA tabela da selecao de personagem (`CharSelectCommon.js` le
	 * `MonsterTable[info.job]`). A versao anterior perguntava a
	 * `DB.getJobName`, que NAO EXISTE neste cliente — e a coluna mostrava o
	 * numero cru da classe ("4" no Novico, "0" no Aprendiz). Pergunta do
	 * dono em 10/09/2026: *"essa coluna aqui do ranking e o que?"*.
	 */
	return MonsterTable[job] || String(job);
}

function linhaHtml(linha) {
	const medalha = linha.posicao <= 3 ? ` rk-medalha-${linha.posicao}` : '';
	return (
		`<li class="rk-linha${linha.souEu ? ' is-eu' : ''}${medalha}">` +
		`<span class="rk-pos">${linha.posicao}</span>` +
		`<span class="rk-nome">${escapeHtml(linha.nome)}</span>` +
		`<span class="rk-classe">${escapeHtml(nomeDaClasse(linha.classe))}</span>` +
		`<span class="rk-valor">${linha.valor}</span>` +
		'</li>'
	);
}

function render() {
	const root = _root();
	if (!root) {
		return;
	}
	const lista = root.querySelector('.rk-lista');
	const eu = root.querySelector('.rk-eu');
	const nota = root.querySelector('.rk-nota');
	if (!lista || !eu || !nota) {
		return;
	}

	root.querySelectorAll('.rk-aba').forEach(b => {
		const ativo = b.dataset.eixo === RankingIdle.eixo;
		b.classList.toggle('is-selected', ativo);
		b.setAttribute('aria-selected', ativo ? 'true' : 'false');
	});
	nota.textContent = NOTA_DO_EIXO[RankingIdle.eixo] || '';

	const estado = RankingIdle.estado;
	if (!estado) {
		lista.innerHTML = '<li class="rk-vazio">Carregando…</li>';
		eu.innerHTML = '';
		return;
	}
	const doEixo = estado[RankingIdle.eixo];
	const linhas = doEixo && Array.isArray(doEixo.linhas) ? doEixo.linhas : [];
	if (linhas.length === 0) {
		// Ninguem pontuou ainda. Isso e o normal numa aba nova (as cartas
		// comecam vazias para todo mundo), e dizer isso e melhor que uma lista
		// em branco que parece defeito.
		lista.innerHTML = '<li class="rk-vazio">Ninguém pontuou aqui ainda.</li>';
		eu.innerHTML = '';
		return;
	}
	lista.innerHTML = linhas.map(linhaHtml).join('');

	const minha = doEixo.eu;
	if (!minha) {
		eu.innerHTML = '<div class="rk-eu-fora">Você ainda não pontua nesta lista.</div>';
		return;
	}
	// Só mostra "você é o Nº" quando ele NÃO está na tabela: repetir a própria
	// linha logo acima dela seria ruído.
	const naTabela = linhas.some(l => l.souEu);
	eu.innerHTML = naTabela
		? ''
		: '<div class="rk-eu-linha">Você é o <strong>' +
			minha.posicao +
			'º</strong> de ' +
			minha.total +
			' — <strong>' +
			minha.valor +
			'</strong></div>';
}

function onRankingRecebido(pkt) {
	let dados;
	try {
		dados = JSON.parse(pkt.json);
	} catch (err) {
		console.error('[RankingIdle] payload nao e JSON valido', err);
		return;
	}
	if (!dados || dados.v !== 1) {
		return;
	}
	RankingIdle.estado = dados;
	render();
}

Network.hookPacket(PACKET.ZC.RAGIDLE_RANKING, onRankingRecebido);

export default UIManager.addComponent(RankingIdle);
