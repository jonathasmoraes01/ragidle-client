/**
 * UI/Components/BotMenu/BotMenu.js
 *
 * RAGIDLE: o MENU DO BOT NOVO (07/10/2026, pacote "Novo Bot V5"). Substitui a
 * janela "Idle" (IdleConfig) como lugar de configurar o automatico. O combate
 * e 100% o do Modo Classico: o Bot do servidor decide e pede pela mesma
 * fronteira do clique do jogador, e esta janela so o liga, desliga e
 * configura.
 *
 * TRES PECAS:
 * - `estadoDoBot.js`: serverConfig x rascunho, pedidos em voo, status - sem DOM;
 * - este arquivo: a COSTURA com o jogo (pacote, arrasto, posicao, pilha);
 * - `servidor/bot/*` (no rag-idle-master): a decisao e a validacao.
 *
 * O PACOTE TEM UM DONO SO: o `ZC_RAGIDLE_BOT` (0x0fb1) e fisgado aqui.
 * O ponto de entrada do menu (o item "Bot" do TopMenuIdle) so aparece quando o
 * servidor anunciou a capacidade (`temCapacidade`), e nao depende do modo
 * classico estar ligado ou desligado.
 *
 * This file is part of the ragidle fork of ROBrowser.
 */
import Renderer from 'Renderer/Renderer.js';
import Preferences from 'Core/Preferences.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import htmlText from './BotMenu.html?raw';
import cssText from './BotMenu.css?raw';
import { fecharEEsquecer } from '../limpezaDeJanelaIdle.js';
import { criarEstadoDoBot, fraseDoErro, fraseDoStatus } from './estadoDoBot.js';
import { desenharEditorDeSkills } from './editorDeSkills.js';
import { desenharColeta, desenharSobrevivencia, desenharSuporte } from './editorDeManutencao.js';
import { desenharFlechas } from './editorDeFlechas.js';
import DB from 'DB/DBManager.js';
import { esquecer as esquecerContexto, marcarObsoleto, receberDoServidor } from 'UI/contextoDoMapa.js';

const WINDOW_WIDTH = 420;
const WINDOW_HEIGHT = 560;

const NOME_DA_SECAO = Object.freeze({
	cacada: 'Caçada',
	ataque: 'Ataque',
	sobrevivencia: 'Sobrevivência',
	suporte: 'Suporte',
	coleta: 'Coleta',
	flechas: 'Flechas',
	postura: 'Postura'
});

const POSTURA_PADRAO = Object.freeze({ tipo: 'melee-dps', fallbackMelee: false });

/** O bloco `postura` da config (Fase 8); ausente (servidor velho) = o padrao. */
function lerPostura(c) {
	const p = (c && c.postura) || {};
	return {
		tipo: typeof p.tipo === 'string' ? p.tipo : POSTURA_PADRAO.tipo,
		fallbackMelee: typeof p.fallbackMelee === 'boolean' ? p.fallbackMelee : POSTURA_PADRAO.fallbackMelee
	};
}

/** O nome do item que o cliente conhece (a lista de ignorados da coleta); null = desconhecido. */
function nomeDoItem(itemId) {
	const it = DB.getItemInfo(itemId);
	const nome = it && it.identifiedDisplayName;
	return typeof nome === 'string' && nome && nome !== 'Unknown Item' ? nome : null;
}

function larguraNaTela() {
	return Math.min(WINDOW_WIDTH, Math.max(0, Renderer.width - 16));
}

function alturaNaTela() {
	return Math.min(WINDOW_HEIGHT, Math.max(0, Renderer.height - 132));
}

const BotMenu = new GUIComponent('BotMenu', cssText);

BotMenu.render = () => htmlText;

BotMenu.mouseMode = GUIComponent.MouseMode.CROSS;

const _preferences = Preferences.get('BotMenu', { x: null, y: null, aba: 'cacada' }, 1.0);

function enviar(corpo) {
	const pkt = new PACKET.CZ.RAGIDLE_BOT_ACAO();
	pkt.json = JSON.stringify(corpo);
	Network.sendPacket(pkt);
}

const _estado = criarEstadoDoBot({ enviar });

/** O escopo do editor de skills: a lista geral ou a especie escolhida (so desta tela). */
let _escopoDasSkills = 'geral';

/** Quem ouve a capacidade (o TopMenuIdle mostra o item "Bot" so com ela). */
const _ouvintesDaCapacidade = new Set();

function _root() {
	return BotMenu._shadow || BotMenu._host;
}

function el(seletor) {
	const r = _root();
	return r ? r.querySelector(seletor) : null;
}

/** O servidor anunciou o Bot novo nesta sessao? */
BotMenu.temCapacidade = function temCapacidade() {
	return _estado.secoes().length > 0;
};

BotMenu.aoMudarCapacidade = function aoMudarCapacidade(fn) {
	_ouvintesDaCapacidade.add(fn);
	return () => _ouvintesDaCapacidade.delete(fn);
};

/** Para os testes da costura e as provas de tela. */
BotMenu._estado = _estado;

BotMenu.limparEstadoDoPersonagem = function limparEstadoDoPersonagem() {
	_estado.reiniciar();
	_escopoDasSkills = 'geral';
	esquecerContexto();
	fecharEEsquecer(_root(), '.bm-window');
	avisarCapacidade();
};

BotMenu.init = function init() {
	const root = _root();
	if (!root) {
		return;
	}
	const fechar = el('.bm-close');
	if (fechar) {
		fechar.addEventListener('click', e => {
			e.stopImmediatePropagation();
			closeWindow();
		});
	}
	const titulo = el('.bm-titlebar');
	if (titulo) {
		this.draggable(titulo);
	}
	el('.bm-liga').addEventListener('click', onClickLiga);
	el('.bm-aplicar').addEventListener('click', () => {
		_estado.aplicar();
		desenhar();
	});
	el('.bm-descartar').addEventListener('click', () => {
		_estado.descartar();
		desenhar();
	});
	el('.bm-recarregar').addEventListener('click', () => {
		_estado.recarregar();
		desenhar();
	});
	el('.bm-cacar').addEventListener('change', e => editar(c => ({ ...c, cacar: e.target.checked })));
	el('.bm-raio').addEventListener('input', e => editar(c => ({ ...c, raioDePercepcao: Number(e.target.value) })));
	root.querySelectorAll('input[name="bm-modo"]').forEach(r =>
		r.addEventListener('change', e => editar(c => ({ ...c, modoDeAtaque: e.target.value })))
	);
	el('.bm-monstros').addEventListener('click', onClickMonstro);
	root.querySelectorAll('input[name="bm-postura"]').forEach(r =>
		r.addEventListener('change', e => editar(c => ({ ...c, postura: { ...lerPostura(c), tipo: e.target.value } })))
	);
	el('.bm-fallback').addEventListener('change', e =>
		editar(c => ({ ...c, postura: { ...lerPostura(c), fallbackMelee: e.target.checked } }))
	);
	// Tecla dentro da janela nao vira atalho do jogo nem ESC da pilha por acidente.
	el('.bm-corpo').addEventListener('keydown', e => e.stopPropagation());
	this._host.style.top = Math.max(0, (Renderer.height - alturaNaTela()) / 2) + 'px';
	this._host.style.left = Math.max(0, (Renderer.width - larguraNaTela()) / 2) + 'px';
};

BotMenu.onAppend = function onAppend() {
	if (_preferences.x != null && _preferences.y != null) {
		this._host.style.top = Math.min(Math.max(0, _preferences.y), Math.max(0, Renderer.height - alturaNaTela())) + 'px';
		this._host.style.left = Math.min(Math.max(0, _preferences.x), Math.max(0, Renderer.width - larguraNaTela())) + 'px';
	}
	// Mapa novo: o servidor pode ter invalidado a intencao; o estado operacional vem dele.
	// O contexto do mapa anterior nao vale ate a resposta chegar (`UI/contextoDoMapa.js`).
	marcarObsoleto();
	_estado.pedirEstado();
};

BotMenu.onRemove = function onRemove() {
	savePosition();
};

function savePosition() {
	_preferences.x = parseInt(BotMenu._host.style.left, 10) || 0;
	_preferences.y = parseInt(BotMenu._host.style.top, 10) || 0;
	_preferences.save();
}

BotMenu.toggle = function toggle() {
	const win = el('.bm-window');
	if (!win) {
		return;
	}
	if (win.classList.contains('is-open')) {
		closeWindow();
	} else {
		win.classList.add('is-open');
		BotMenu.focus();
		_estado.pedirEstado();
		desenhar();
	}
};

function closeWindow() {
	const win = el('.bm-window');
	if (win) {
		win.classList.remove('is-open');
	}
	savePosition();
}

function editar(fn) {
	_estado.editar(fn);
	desenhar();
}

function onClickLiga(e) {
	e.stopImmediatePropagation();
	const s = _estado.estado();
	if (s.pendenteLigarDesligar !== null) {
		return;
	}
	if (s.ligado) {
		_estado.desligar();
	} else {
		_estado.ligar();
	}
	desenhar();
}

function onClickMonstro(e) {
	const item = e.target.closest('[data-especie]');
	if (!item) {
		return;
	}
	const especie = Number(item.getAttribute('data-especie'));
	editar(c => {
		const lista = new Set(c.especiesVetadas || []);
		if (lista.has(especie)) {
			lista.delete(especie);
		} else {
			lista.add(especie);
		}
		return { ...c, especiesVetadas: [...lista] };
	});
}

function abaAtual(secoes) {
	return secoes.includes(_preferences.aba) ? _preferences.aba : secoes[0];
}

function desenharAbas(secoes) {
	const abas = el('.bm-abas');
	const atual = abaAtual(secoes);
	const chave = secoes.join(',') + '|' + atual;
	if (abas.getAttribute('data-chave') !== chave) {
		abas.setAttribute('data-chave', chave);
		abas.innerHTML = '';
		for (const s of secoes) {
			const b = document.createElement('button');
			b.type = 'button';
			b.className = 'ri-tab' + (s === atual ? ' is-active' : '');
			b.setAttribute('role', 'tab');
			b.setAttribute('aria-selected', String(s === atual));
			b.textContent = NOME_DA_SECAO[s] || s;
			b.addEventListener('click', () => {
				_preferences.aba = s;
				_preferences.save();
				desenhar();
			});
			abas.appendChild(b);
		}
	}
	_root()
		.querySelectorAll('.bm-secao')
		.forEach(sec => {
			sec.hidden = sec.getAttribute('data-secao') !== atual;
		});
}

function desenhar() {
	const root = _root();
	if (!root) {
		return;
	}
	const s = _estado.estado();
	const liga = el('.bm-liga');
	liga.setAttribute('aria-checked', String(s.ligado));
	liga.classList.toggle('is-pendente', s.pendenteLigarDesligar !== null);
	el('.bm-liga-texto').textContent =
		s.pendenteLigarDesligar === 'ligar'
			? 'Ligando...'
			: s.pendenteLigarDesligar === 'desligar'
				? 'Desligando...'
				: s.ligado
					? 'Bot ligado'
					: 'Bot desligado';
	const status = el('.bm-status');
	status.textContent = s.carregado ? fraseDoStatus(s.status) : 'Carregando...';
	status.classList.toggle('is-suspenso', s.status && s.status.codigo === 'suspenso-manual');
	el('.bm-mapa').textContent = s.mapa || '';

	const secoes = _estado.secoes();
	desenharAbas(secoes);

	const c = s.editConfig;
	if (c) {
		el('.bm-cacar').checked = !!c.cacar;
		const raio = el('.bm-raio');
		const lim = (s.capacidades && s.capacidades.limites) || {};
		raio.min = String(lim.raioMinimo || 3);
		raio.max = String(lim.raioMaximo || 30);
		raio.value = String(c.raioDePercepcao);
		el('.bm-raio-valor').textContent = String(c.raioDePercepcao);
		root.querySelectorAll('input[name="bm-modo"]').forEach(r => {
			r.checked = r.value === c.modoDeAtaque;
		});
		desenharMonstros(s, c);
		desenharPostura(s, c);
		const lim2 = (s.capacidades && s.capacidades.limites) || {};
		desenharEditorDeSkills(
			el('[data-secao="ataque"]'),
			{
				config: c,
				skills: s.skills,
				monstros: s.monstros,
				escopo: _escopoDasSkills,
				teto: { geral: lim2.skillsNaListaGeral || 12, porMonstro: lim2.skillsPorMonstro || 12 }
			},
			editar,
			escopo => {
				_escopoDasSkills = escopo;
				desenhar();
			}
		);
		desenharManutencao(s, c, secoes, lim2);
	}

	const recado = el('.bm-recado');
	recado.classList.remove('is-aviso');
	if (s.erro) {
		recado.textContent = fraseDoErro(s.erro);
	} else if (s.mudouNoServidor) {
		recado.textContent = 'A configuração mudou no servidor enquanto você editava. Aplique para manter a sua ou recarregue.';
		recado.classList.add('is-aviso');
	} else {
		recado.textContent = '';
	}
	const problemas = el('.bm-problemas');
	problemas.innerHTML = '';
	for (const p of s.problemas || []) {
		const li = document.createElement('li');
		li.textContent = p.mensagem;
		problemas.appendChild(li);
	}
	el('.bm-recarregar').hidden = !(s.conflito || s.mudouNoServidor);
	el('.bm-aplicar').disabled = !s.dirty || s.pendenteAplicar;
	el('.bm-aplicar').textContent = s.pendenteAplicar ? 'Aplicando...' : 'Aplicar';
	el('.bm-descartar').disabled = !s.dirty || s.pendenteAplicar;
}

/** Sobrevivencia, Suporte e Coleta (Fase 6): so desenha a secao que o servidor anunciou. */
function desenharManutencao(s, c, secoes, lim) {
	if (secoes.includes('sobrevivencia')) {
		desenharSobrevivencia(
			el('[data-secao="sobrevivencia"]'),
			{ config: c, pocoes: s.pocoes, teto: lim.pocoesPorLista || 6, nomeDoItem },
			editar
		);
	}
	if (secoes.includes('suporte')) {
		desenharSuporte(el('[data-secao="suporte"]'), { config: c, skills: s.skills, teto: lim.skillsDeSuporte || 8 }, editar);
	}
	if (secoes.includes('coleta')) {
		desenharColeta(
			el('[data-secao="coleta"]'),
			{
				config: c,
				teto: lim.itensIgnoradosNaColeta || 300,
				raioMinimo: lim.raioDeColetaMinimo || 1,
				raioMaximo: lim.raioDeColetaMaximo || 15,
				nomeDoItem
			},
			editar
		);
	}
	if (secoes.includes('flechas')) {
		desenharFlechas(
			el('[data-secao="flechas"]'),
			{
				config: c,
				municoes: s.municoes,
				municao: s.municao,
				monstros: s.monstros,
				tetoPermitidas: lim.municoesPermitidas || 30,
				tetoMonstros: lim.monstrosComRegraDeFlecha || 120,
				nomeDoItem
			},
			editar,
			() => {
				_estado.retomarMunicao();
				desenhar();
			}
		);
	}
}

/** A aba Postura (Fase 8): a postura do rascunho, o fallback (so no Dano a distancia) e o posto em vigor. */
function desenharPostura(s, c) {
	const p = lerPostura(c);
	_root()
		.querySelectorAll('input[name="bm-postura"]')
		.forEach(r => {
			r.checked = r.value === p.tipo;
		});
	el('.bm-fallback').checked = p.fallbackMelee;
	el('.bm-fallback-melee').hidden = p.tipo !== 'ranged-dps';
	const g = s.grupo;
	el('.bm-posto-atual').textContent =
		g && g.emGrupo ? 'Posto em vigor: ' + g.postoNome + '.' : 'Sem grupo: o Bot caça sozinho (Andarilho).';
}

function desenharMonstros(s, c) {
	const lista = el('.bm-monstros');
	const vetadas = new Set(c.especiesVetadas || []);
	const conhecidos = new Map((s.monstros || []).map(m => [m.especie, m.nome]));
	for (const v of vetadas) {
		if (!conhecidos.has(v)) {
			conhecidos.set(v, '#' + v);
		}
	}
	const chave = [...conhecidos].map(([e, n]) => e + ':' + n + ':' + vetadas.has(e)).join(',');
	if (lista.getAttribute('data-chave') === chave) {
		return;
	}
	lista.setAttribute('data-chave', chave);
	lista.innerHTML = '';
	const ordenados = [...conhecidos].sort((a, b) => String(a[1]).localeCompare(String(b[1])));
	for (const [especie, nome] of ordenados) {
		const li = document.createElement('li');
		li.className = 'bm-monstro' + (vetadas.has(especie) ? ' is-vetado' : '');
		li.setAttribute('data-especie', String(especie));
		li.setAttribute('role', 'checkbox');
		li.setAttribute('aria-checked', String(vetadas.has(especie)));
		li.tabIndex = 0;
		const caixa = document.createElement('input');
		caixa.type = 'checkbox';
		caixa.checked = vetadas.has(especie);
		caixa.tabIndex = -1;
		caixa.setAttribute('aria-hidden', 'true');
		const rotulo = document.createElement('span');
		rotulo.textContent = nome;
		rotulo.setAttribute('translate', 'no');
		li.appendChild(caixa);
		li.appendChild(rotulo);
		lista.appendChild(li);
	}
}

function avisarCapacidade() {
	const tem = BotMenu.temCapacidade();
	for (const fn of _ouvintesDaCapacidade) {
		try {
			fn(tem);
		} catch (err) {
			console.error('[BotMenu] ouvinte da capacidade falhou', err);
		}
	}
}

function onBotRecebido(pkt) {
	let dados;
	try {
		dados = JSON.parse(pkt.json);
	} catch (err) {
		console.error('[BotMenu] payload nao e JSON valido', err);
		return;
	}
	const tinha = BotMenu.temCapacidade();
	const atual = _estado.estado().personagemId;
	if (_estado.receber(dados, atual)) {
		// O contexto do mapa (cidade? qual mapa?) e o Bot ligado alimentam quem nao e do Bot:
		// drop da Analise, botao Cacar, tela acesa no farm.
		receberDoServidor(dados.contexto, _estado.estado().ligado);
		desenhar();
		if (tinha !== BotMenu.temCapacidade()) {
			avisarCapacidade();
		}
	}
}

Network.hookPacket(PACKET.ZC.RAGIDLE_BOT, onBotRecebido);

export default UIManager.addComponent(BotMenu);
