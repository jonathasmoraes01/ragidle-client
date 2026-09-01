/**
 * UI/Components/IdleSkills/IdleSkills.js
 *
 * "Habilidades de {classe}" — janela RAGIDLE. Desde 31/08/2026 (D-799, pedido
 * do dono) ela é uma **ÁRVORE DE HABILIDADES**, e não mais uma lista de cards.
 *
 * ===========================================================================
 * O QUE MUDOU, E POR QUÊ
 * ===========================================================================
 *
 * A referência é a print do **Ragnarok LATAM** que o dono mandou: trilho de
 * abas na vertical à esquerda (1ª, 2ª, 3ª, Variadas), grade de ícones com
 * `◀ n/m ▶` embaixo de cada um, o interruptor "Descrições" no alto, e
 * "Pontos de habilidade" + "Aplicar"/"Resetar" no rodapé. O pedido foi explícito
 * em manter **o nosso UI Premium** — então nada do chrome do cliente oficial
 * entrou: tudo aqui é token do design system (`UI/Common.css`, bloco RAGIDLE).
 *
 * Três coisas que a lista antiga não fazia e a árvore faz:
 *
 * 1. **O DESENHO MOSTRA A DEPENDÊNCIA.** Coluna = profundidade na árvore de
 *    pré-requisitos, e um fio ligado do pai ao filho. Era a informação que a
 *    lista escondia: o jogador via "não pode aprender" e não via de onde vem.
 * 2. **AS ABAS SÃO DEGRAUS DA CARREIRA**, e não categorias inventadas. Elas
 *    vêm do servidor (`payload.graus`, ver `grau-da-habilidade.ts`): um
 *    Aprendiz tem uma aba, um Cavaleiro tem três. As antigas
 *    ("Ativas"/"Passivas"/"Suporte") tinham uma aba que era honestamente vazia.
 * 3. **RASCUNHO com "Aplicar".** As setas mexem num rascunho LOCAL; o servidor
 *    só é chamado no "Aplicar", que manda o lote inteiro num pacote só e o
 *    aplica de forma atômica (ver o bloco do lote em `servidor-mapa.ts`). Antes
 *    era um pacote por nível — e cada um deles devolve o payload inteiro da
 *    janela.
 *
 * A geometria da árvore e o juiz do rascunho moram em `arvoreDeSkills.js`, que
 * é puro e tem prova própria (`tests/ui/arvoreDeSkills.test.js`). Aqui fica o
 * que só a pilha ao vivo julga: DOM, pacote e preferência.
 *
 * ===========================================================================
 * PROTOCOLO (extensão nossa, não é rAthena/roBrowser de fábrica)
 * ===========================================================================
 *
 *   CZ_RAGIDLE_PEDIR_SKILLS  0x0ff9  (cliente -> servidor, fixo, só o opcode)
 *   ZC_RAGIDLE_SKILLS        0x0ffa  (servidor -> cliente, variável, JSON;
 *                                     responde a TODOS os três de baixo)
 *   CZ_RAGIDLE_APRENDER      0x0ffb  (cliente -> servidor, variável, JSON —
 *                                     `{ skillId }` para um nível, ou
 *                                     `{ lote: [{skillId, niveis}] }` para o
 *                                     "Aplicar")
 *   CZ_RAGIDLE_PRIORIZAR     (rotação de ataque, D-6xx)
 *
 * Declarados em `Network/PacketStructure.js` (busque "RAGIDLE:") e registrados
 * para o enquadramento de recepção em `Network/PacketRegister.js` e
 * `Network/Packets/packets2021_len_main.js`.
 *
 * **O contrato do JSON é `servidor/mapa/contrato-de-skills.ts`**, e ele está na
 * versão **2** desde D-799 (a v1 não trazia `preRequisitos`, `grau`,
 * `aceitaPeloMotor` nem os níveis do personagem). O `if` de versão logo abaixo
 * RECUSA a v1 de propósito: um servidor velho responderia sem pré-requisito
 * nenhum, e a janela desenharia uma árvore sem nenhuma ligação — plausível e
 * errada, que é o pior resultado possível. `contrato-de-skills.test.ts` cobra
 * que todo campo lido aqui exista lá.
 *
 * @author RagIdle
 */

import Renderer from 'Renderer/Renderer.js';
import Preferences from 'Core/Preferences.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import buildResumo from './resumoDaDescricao.js';
import RiIcones from 'UI/ri-icones.js';
import htmlText from './IdleSkills.html?raw';
import cssText from './IdleSkills.css?raw';
import { fecharEEsquecer } from '../limpezaDeJanelaIdle.js';
import { abaLembrada, lembrarAba } from '../memoriaDeAba.js';
import {
	NO_L,
	avaliarDescer,
	avaliarSubir,
	montarPlano,
	nivelEfetivo,
	ordemDoLote,
	pontosNoRascunho
} from './arvoreDeSkills.js';

/**
 * A versão do contrato que esta janela sabe ler.
 *
 * Espelha `VERSAO_DO_CONTRATO_DE_SKILLS` em
 * `servidor/mapa/contrato-de-skills.ts` — e o teste de contrato daquele repo
 * cobra que os dois números sejam o mesmo, porque ele é a única coisa que
 * separa "árvore certa" de "árvore plausível e errada".
 */
const VERSAO_DO_CONTRATO = 2;

/**
 * Mantenha em sincronia com o ":host" / ".is-window" do IdleSkills.css e com
 * `--w-idleskills`/`--h-idleskills` no Common.css — os três dizem a mesma
 * medida, e é ela que `#draggable()` usa para prender a janela na tela.
 *
 * Cresceu de 640x560 para 980x640 com a árvore (940x620 na primeira rodada;
 * a segunda encorpou o nó e as quatro colunas do Cavaleiro pediam o resto):
 * a lista antiga cabia numa coluna de 190px, e o plano de uma 2ª classe não.
 */
const WINDOW_WIDTH = 980;
const WINDOW_HEIGHT = 640;

/**
 * Quanto tempo uma recusa do servidor fica em vermelho no rodapé antes de sumir.
 */
const PROBLEMAS_TIMEOUT_MS = 6000;

/**
 * Create Component
 */
const IdleSkills = new GUIComponent('IdleSkills', cssText);

/**
 * Os glifos do chrome (chevrons da plaqueta, check dos requisitos, o icone do
 * botao flutuante) entram pelo marcador "<!--RI_ICONE:chave-->" do .html e
 * pelas chaves de ri-icones.js — UM arquivo para todo glifo, por regra.
 */
IdleSkills.render = () => htmlText.replace(/<!--RI_ICONE:(\w+)-->/g, (_, chave) => RiIcones[chave] || '');

/**
 * O ícone flutuante não pode bloquear clique/hover na cena — mesma escolha do
 * HuntMap, do IdleConfig e do AdminPanel.
 */
IdleSkills.mouseMode = GUIComponent.MouseMode.CROSS;

/**
 * @var {object|null} o último payload completo confirmado pelo servidor.
 *      Sempre substituído por inteiro (o contrato garante que toda resposta é o
 *      estado corrente completo).
 */
IdleSkills.serverData = null;

/** @var {string|null} a habilidade selecionada (dirige o painel de detalhe). */
IdleSkills.selectedSkillId = null;

/**
 * @var {Record<string, number>} O RASCUNHO: quantos níveis o jogador somou à
 *      mão e ainda não aplicou, por skillId. Só o "Aplicar" o transforma em
 *      pacote; "Resetar" o joga fora. Ele NÃO atravessa a resposta do servidor
 *      quando o lote é aceito, e SOBREVIVE quando ele é recusado — nesse caso
 *      nada mudou do outro lado, e jogar fora o plano do jogador por causa de
 *      uma recusa seria punir duas vezes.
 */
IdleSkills.rascunho = {};

/**
 * @var {boolean} há um "Aplicar" no ar esperando resposta?
 *
 * Existe porque o `aplicado: true` do contrato NÃO diz qual gesto foi aplicado:
 * pôr uma habilidade na rotação de ataque volta com o mesmo `true`. Sem esta
 * marca, mexer na rotação com um rascunho aberto apagaria o rascunho.
 */
IdleSkills._esperandoAplicar = false;

/** @var {number} o degrau (grau) da aba acesa. */
IdleSkills.grauAtivo = 0;

/** @var {boolean} o painel de detalhe está aberto? (interruptor "Descrições") */
IdleSkills.mostrarDescricoes = true;

/** @var {string[]} recusas transitórias do servidor, para a mensagem vermelha. */
IdleSkills.problemas = [];

/** @var {number|null} handle do setTimeout que limpa `problemas`. */
IdleSkills._problemasTimer = null;

/**
 * @var {Preferences} posição da janela (x/y `null` até o jogador mover), o
 *      degrau em que ele estava (`aba`) e o interruptor de descrições.
 *
 * A versão continua 1.0 de propósito: subir apagaria a POSIÇÃO já ajustada só
 * para ganhar campos que já funcionam sem isso (ver `memoriaDeAba.js`).
 */
const _preferences = Preferences.get(
	'IdleSkills',
	{
		x: null,
		y: null,
		aba: null,
		descricoes: true
	},
	1.0
);

/** Helper: query inside shadow root */
function _root() {
	return IdleSkills._shadow || IdleSkills._host;
}

/**
 * Escapa texto vindo do servidor antes de entrar em `innerHTML`. Espelha o
 * helper privado do IdleConfig (que não o exporta).
 */
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

/**
 * Duas letras de reserva a partir do skillId ("NV_BASIC" -> "NB"), para quando
 * o PNG do ícone não existe.
 */
function skillInitials(skillId) {
	const parts = String(skillId || '').split('_');
	if (parts.length >= 2 && parts[0] && parts[1]) {
		return (parts[0][0] + parts[1][0]).toUpperCase();
	}
	return String(skillId || '')
		.slice(0, 2)
		.toUpperCase();
}

/** "N habilidade(s) disponível(is)" em PT-BR de verdade. */
function pluralizeDisponiveis(n) {
	return n === 1 ? '1 habilidade para subir' : n + ' habilidades para subir';
}

/**
 * O rótulo curto da aba de um degrau — "Var" para o Aprendiz, "1ª"/"2ª"/"3ª"
 * para os degraus de classe. É o rótulo da referência LATAM; o nome da classe
 * por extenso fica embaixo dele e no `title`.
 */
function rotuloDoGrau(grau) {
	if (grau <= 0) {
		return 'Var';
	}
	return grau + 'ª';
}

/** TODAS as habilidades do payload, por skillId. Refeito a cada resposta. */
function indicePorId() {
	const porId = new Map();
	const data = IdleSkills.serverData;
	if (data) {
		data.skills.forEach(s => porId.set(s.skillId, s));
	}
	return porId;
}

/** O contexto que `avaliarSubir`/`avaliarDescer` pedem. */
function contextoDoRascunho() {
	const data = IdleSkills.serverData;
	return {
		porId: indicePorId(),
		rascunho: IdleSkills.rascunho,
		pontos: data ? data.pontos : 0,
		nivelBase: data ? data.nivelBase : 0,
		nivelDeJob: data ? data.nivelDeJob : 0
	};
}

/**
 * Os degraus do trilho: os que o servidor mandou, mais um "Outras" de
 * emergência se alguma habilidade vier com grau que não está na lista.
 *
 * O "Outras" existe porque o modo de falha alternativo é MUDO: uma habilidade
 * sem aba não cai em lugar nenhum e some da janela — o jogador vê uma árvore
 * com um buraco e nada acusa. O servidor manda `grau: -1` quando não soube
 * dizer (ver `contrato-de-skills.ts`), e é exatamente esse caso que cai aqui.
 */
function degrausDoTrilho() {
	const data = IdleSkills.serverData;
	if (!data) {
		return [];
	}
	const trilho = data.graus.map(g => ({
		grau: g.grau,
		rotulo: rotuloDoGrau(g.grau),
		nome: g.nomePt
	}));
	const conhecidos = new Set(trilho.map(g => g.grau));
	const orfas = data.skills.filter(s => !conhecidos.has(s.grau));
	if (orfas.length) {
		trilho.push({ grau: orfas[0].grau, rotulo: '?', nome: 'Outras' });
	}
	return trilho;
}

/** As habilidades do degrau aceso, na ordem da árvore. */
function skillsDoGrau() {
	const data = IdleSkills.serverData;
	if (!data) {
		return [];
	}
	return data.skills.filter(s => s.grau === IdleSkills.grauAtivo);
}

/**
 * Setup de uma vez só (roda dentro do `GUIComponent#prepare()`).
 */
IdleSkills.init = function init() {
	const root = _root();

	/*
	 * A aba lembrada vem como TEXTO (é assim que `memoriaDeAba.js` guarda tudo),
	 * e aqui ela é um número. Sem lista de abas válidas: quantos degraus existem
	 * depende da CARREIRA do personagem, e ela só se sabe quando o payload chega
	 * — o `renderRail` conserta uma aba que não existe mais.
	 */
	IdleSkills.grauAtivo = parseInt(abaLembrada(_preferences, '0'), 10) || 0;
	IdleSkills.mostrarDescricoes = _preferences.descricoes !== false;

	root.querySelector('.is-button').addEventListener('click', onClickButton);
	root.querySelector('.is-close').addEventListener('click', onClickClose);
	root.querySelector('.is-btn-aplicar').addEventListener('click', onClickAplicar);
	root.querySelector('.is-btn-resetar').addEventListener('click', onClickResetar);

	const check = root.querySelector('.is-desc-check');
	check.checked = IdleSkills.mostrarDescricoes;
	check.addEventListener('change', onToggleDescricoes);

	// `#draggable()` move o ":host" por left/top usando a barra de título como
	// pega — mesma chamada das outras janelas RAGIDLE.
	this.draggable(root.querySelector('.is-titlebar'));

	this._host.style.top = Math.max(0, (Renderer.height - WINDOW_HEIGHT) / 2) + 'px';
	this._host.style.left = Math.max(0, (Renderer.width - WINDOW_WIDTH) / 2) + 'px';

	sincronizarDescricoes();
	renderAll();
};

/** Restaura a posição salva depois de anexado ao DOM. */
IdleSkills.onAppend = function onAppend() {
	if (_preferences.x != null && _preferences.y != null) {
		this._host.style.top = Math.min(Math.max(0, _preferences.y), Renderer.height - WINDOW_HEIGHT) + 'px';
		this._host.style.left = Math.min(Math.max(0, _preferences.x), Renderer.width - WINDOW_WIDTH) + 'px';
	}
};

IdleSkills.onRemove = function onRemove() {
	savePosition();
	clearProblemasTimeout();
};

function savePosition() {
	_preferences.x = parseInt(IdleSkills._host.style.left, 10) || 0;
	_preferences.y = parseInt(IdleSkills._host.style.top, 10) || 0;
	_preferences.save();
}

/** Mostra/esconde a janela (o botão flutuante fica visível dos dois jeitos). */
IdleSkills.toggle = function toggle() {
	const root = _root();
	const win = root.querySelector('.is-window');
	if (win.classList.contains('is-open')) {
		closeWindow();
	} else {
		win.classList.add('is-open');
		IdleSkills.focus();
		requestSkills();
	}
};

function closeWindow() {
	const root = _root();
	root.querySelector('.is-window').classList.remove('is-open');
	savePosition();
}

function onClickButton(e) {
	e.stopImmediatePropagation();
	IdleSkills.toggle();
}

function onClickClose(e) {
	e.stopImmediatePropagation();
	closeWindow();
}

function clearProblemasTimeout() {
	if (IdleSkills._problemasTimer != null) {
		clearTimeout(IdleSkills._problemasTimer);
		IdleSkills._problemasTimer = null;
	}
}

/**
 * Pede ao servidor o estado corrente. Mandado quando a janela abre.
 * CZ_RAGIDLE_PEDIR_SKILLS — 0x0ff9, 2 bytes fixos (só o opcode).
 */
function requestSkills() {
	setStatus(IdleSkills.serverData ? 'Atualizando…' : 'Carregando…');
	Network.sendPacket(new PACKET.CZ.RAGIDLE_PEDIR_SKILLS());
}

/**
 * Manda o rascunho inteiro num pacote só — o "Aplicar" (D-799).
 *
 * O lote vai em ordem de dependência (`ordemDoLote`), porque o servidor aplica
 * na ordem que receber e não reordena: reordenar seria ele adivinhando a
 * intenção. Do outro lado ele simula o lote antes de gravar e recusa TUDO se
 * qualquer passo falhar, então uma ordem errada daqui vira recusa, e nunca
 * meia build comprada.
 */
function sendAplicar() {
	const lote = ordemDoLote(indicePorId(), IdleSkills.rascunho);
	if (!lote.length) {
		return;
	}
	setStatus('Aplicando…');
	IdleSkills._esperandoAplicar = true;

	const pkt = new PACKET.CZ.RAGIDLE_APRENDER();
	pkt.json = JSON.stringify({ lote: lote });
	Network.sendPacket(pkt);
}

/**
 * Liga ou desliga a habilidade na ROTAÇÃO de ataque.
 *
 * `ligar` vai EXPLÍCITO, e não como um alterna calculado no servidor: esta
 * janela sabe o estado que desenhou, e um alterna com dois cliques rápidos numa
 * rede lenta faria o jogador ligar o que queria desligar.
 */
function sendPriorizar(skillId, ligar) {
	setStatus(ligar ? 'Pondo na rotação…' : 'Tirando da rotação…');

	const pkt = new PACKET.CZ.RAGIDLE_PRIORIZAR();
	pkt.json = JSON.stringify({ skillId: skillId, ligar: ligar });
	Network.sendPacket(pkt);
}

function setStatus(text) {
	const root = _root();
	const el = root.querySelector('.is-status');
	if (el) {
		el.textContent = text || '';
	}
}

/** Mostra `problemas` em vermelho no rodapé por PROBLEMAS_TIMEOUT_MS. */
function showProblemas(list) {
	clearProblemasTimeout();
	IdleSkills.problemas = list;
	renderFooter();
	IdleSkills._problemasTimer = setTimeout(() => {
		IdleSkills._problemasTimer = null;
		IdleSkills.problemas = [];
		renderFooter();
	}, PROBLEMAS_TIMEOUT_MS);
}

/**
 * ZC_RAGIDLE_SKILLS — 0x0ffa, variável, JSON UTF-8.
 *
 * Este opcode responde aos TRÊS pedidos. O contrato os distingue por
 * `aplicado`: presente (true) só na resposta a uma ação, ausente no anúncio
 * comum. Mas ele NÃO diz QUAL ação — por isso o rascunho só é jogado fora
 * quando `_esperandoAplicar` marca que o gesto no ar era o "Aplicar".
 */
function onSkillsReceived(pkt) {
	let data;
	try {
		data = JSON.parse(pkt.json);
	} catch (e) {
		console.error('[IdleSkills] Falha ao interpretar os dados de habilidades recebidos:', e, pkt.json);
		setStatus('Dados incompatíveis.');
		IdleSkills._esperandoAplicar = false;
		return;
	}

	if (
		!data ||
		data.v !== VERSAO_DO_CONTRATO ||
		!data.classe ||
		!Array.isArray(data.skills) ||
		!Array.isArray(data.graus) ||
		typeof data.pontos !== 'number' ||
		typeof data.nivelBase !== 'number' ||
		typeof data.nivelDeJob !== 'number'
	) {
		/*
		 * RECUSA ALTA, e não desenho parcial. Um servidor na v1 responde JSON
		 * válido sem `preRequisitos` — a árvore sairia sem nenhuma ligação e o
		 * rascunho aprovaria o que o "Aplicar" recusa. Ver o cabeçalho.
		 */
		console.error(
			'[IdleSkills] Contrato incompatível: esperava v=' +
				VERSAO_DO_CONTRATO +
				', veio v=' +
				(data && data.v) +
				'.',
			data
		);
		setStatus('Dados incompatíveis — servidor e cliente em versões diferentes.');
		IdleSkills._esperandoAplicar = false;
		return;
	}

	const isApplyResponse = Object.prototype.hasOwnProperty.call(data, 'aplicado');
	const problemas = Array.isArray(data.problemas) ? data.problemas : [];

	// O contrato garante que este payload É o estado corrente completo, responda
	// ele a um "pedir" ou a uma ação. Adotado por inteiro, sempre.
	IdleSkills.serverData = data;

	/*
	 * O RASCUNHO só morre quando foi ELE que virou pacote e o pacote passou.
	 * Recusa preserva: nada mudou do outro lado, e o jogador ainda quer o plano
	 * dele para corrigir um passo.
	 */
	if (IdleSkills._esperandoAplicar && isApplyResponse && data.aplicado === true) {
		IdleSkills.rascunho = {};
	}
	IdleSkills._esperandoAplicar = false;

	// Mantém a seleção se ela ainda existe; senão cai na primeira do DEGRAU
	// ABERTO — `data.skills[0]` é a primeira da árvore inteira, e ela costuma
	// ser de outra aba (ver `trazerSelecaoParaODegrau`).
	if (!IdleSkills.selectedSkillId || !data.skills.some(s => s.skillId === IdleSkills.selectedSkillId)) {
		IdleSkills.selectedSkillId = null;
	}
	if (IdleSkills.selectedSkillId === null && data.skills.length) {
		IdleSkills.selectedSkillId = data.skills[0].skillId;
	}

	setStatus('');

	if (problemas.length) {
		showProblemas(problemas);
	} else {
		clearProblemasTimeout();
		IdleSkills.problemas = [];
	}

	renderAll();
}

/** Redesenha a janela inteira a partir de serverData/rascunho/seleção. */
function renderAll() {
	renderTitle();
	// `renderRail` pode TROCAR o degrau ativo (a aba lembrada some quando o
	// personagem é de outra carreira), então a seleção só pode ser ajustada
	// depois dele — e antes da árvore e do detalhe, que a leem.
	renderRail();
	trazerSelecaoParaODegrau();
	renderArvore();
	renderDetail();
	renderFooter();
}

/** Título: "Habilidades de {classe.nomePt}". */
function renderTitle() {
	const root = _root();
	const el = root.querySelector('.is-title');
	if (!el) {
		return;
	}
	const data = IdleSkills.serverData;
	el.textContent = data && data.classe ? 'Habilidades de ' + (data.classe.nomePt || data.classe.nome) : 'Habilidades';

	/*
	 * O CONTEXTO (D-902): retrato + classe + os dois niveis na barra, e o mesmo
	 * retrato como MARCA D'AGUA da prancheta. O retrato e a arte real de
	 * /ragidle/classes/<id>.png (76 classes publicadas); se faltar, o <img>
	 * some calado e a marca fica vazia — a barra continua dizendo a classe.
	 */
	const chip = root.querySelector('.is-classe');
	const prancheta = root.querySelector('.is-arvore');
	if (!data || !data.classe) {
		if (chip) {
			chip.innerHTML = '';
		}
		if (prancheta) {
			prancheta.style.removeProperty('--is-marca');
		}
		return;
	}
	const nome = data.classe.nomePt || data.classe.nome;
	const retrato = '/ragidle/classes/' + encodeURIComponent(data.classe.id) + '.png';
	if (chip) {
		chip.innerHTML =
			'<span class="is-classe-icone"><img src="' +
			retrato +
			'" alt="" onerror="this.style.display=\'none\'" /></span>' +
			'<span class="is-classe-texto">' +
			'<span class="is-classe-nome">' +
			escapeHtml(nome) +
			'</span>' +
			'<span class="is-classe-nv">Base Nv. ' +
			escapeHtml(data.nivelBase) +
			' · Classe Nv. ' +
			escapeHtml(data.nivelDeJob) +
			'</span></span>';
	}
	if (prancheta) {
		// Inline: url() em custom property resolve contra o documento, e o
		// caminho e absoluto — o CSS da prancheta le var(--is-marca).
		prancheta.style.setProperty('--is-marca', 'url("' + retrato + '")');
	}
}

/* ------------------------------------------------------------------------ */
/* O trilho de degraus                                                       */
/* ------------------------------------------------------------------------ */

function renderRail() {
	const root = _root();
	const rail = root.querySelector('.is-grausrail');
	const trilho = degrausDoTrilho();

	if (!trilho.length) {
		rail.innerHTML = '';
		return;
	}

	/*
	 * A ABA LEMBRADA PODE NÃO EXISTIR MAIS, e o caso é comum: o jogador vivia na
	 * aba "2ª" com o Cavaleiro e entrou com um Aprendiz recém-criado. Sem este
	 * conserto o trilho abriria sem nenhuma aba acesa e a árvore vazia — o mesmo
	 * defeito que `abaLembrada` mata nas outras janelas, só que aqui a lista de
	 * abas válidas só existe depois do payload.
	 */
	if (!trilho.some(g => g.grau === IdleSkills.grauAtivo)) {
		IdleSkills.grauAtivo = trilho[trilho.length - 1].grau;
	}

	const data = IdleSkills.serverData;
	rail.innerHTML = trilho
		.map(degrau => {
			const quantas = data.skills.filter(s => s.grau === degrau.grau).length;
			const ativa = degrau.grau === IdleSkills.grauAtivo;
			return (
				'<button type="button" class="is-grau-tab' +
				(ativa ? ' is-active' : '') +
				'" data-tab="' +
				escapeHtml(degrau.grau) +
				'" title="' +
				escapeHtml(degrau.nome + ' — ' + quantas + ' habilidades') +
				'">' +
				'<span class="is-grau-rotulo">' +
				escapeHtml(degrau.rotulo) +
				'</span>' +
				'<span class="is-grau-nome">' +
				escapeHtml(degrau.nome) +
				'</span>' +
				'</button>'
			);
		})
		.join('');

	rail.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', onClickGrau));
}

function onClickGrau(e) {
	e.stopImmediatePropagation();
	IdleSkills.grauAtivo = parseInt(e.currentTarget.dataset.tab, 10) || 0;
	lembrarAba(_preferences, IdleSkills.grauAtivo);
	trazerSelecaoParaODegrau();
	renderRail();
	renderArvore();
	renderDetail();
}

/**
 * O PAINEL TEM DE DESCREVER O QUE ESTÁ NA TELA.
 *
 * Visto no primeiro print da árvore: com a aba "1ª classe" aberta, o painel da
 * direita continuava descrevendo o Contra-Ataque, que é uma habilidade da 2ª e
 * não está desenhada em lugar nenhum daquela aba. Não há erro — a seleção é
 * legítima, só que invisível —, e o jogador lê uma descrição que não casa com
 * nenhum ícone à frente dele.
 *
 * Só mexe quando a seleção saiu de vista: quem clicou num nó continua com ele.
 */
function trazerSelecaoParaODegrau() {
	const doGrau = skillsDoGrau();
	if (!doGrau.length) {
		return;
	}
	if (!doGrau.some(s => s.skillId === IdleSkills.selectedSkillId)) {
		IdleSkills.selectedSkillId = doGrau[0].skillId;
	}
}

/* ------------------------------------------------------------------------ */
/* A árvore                                                                  */
/* ------------------------------------------------------------------------ */

/**
 * Os fios, em SVG, POR BAIXO dos nós.
 *
 * Cotovelo em três segmentos (sai à direita do pai, desce/sobe no meio do vão,
 * entra à esquerda do filho) em vez de reta: com reta, dois fios que saem do
 * mesmo pai para linhas diferentes viram um leque, e num degrau com quatro
 * filhos ninguém distingue qual chega onde.
 *
 * Verde = requisito cumprido (contando o rascunho); cinza tracejado = ainda não.
 */
function renderFios(plano, contexto) {
	if (!plano.fios.length) {
		return '';
	}

	/*
	 * ======================================================================
	 * OS TRIÂNGULOS PRETOS (31/08/2026, print do dono) — leia antes de
	 * "melhorar" este desenho de volta.
	 * ======================================================================
	 *
	 * A 2ª rodada de design desenhava o cotovelo com cantos em curva (`Q`) e a
	 * ponta da seta com `<marker orient="auto">`. Na máquina do dono, a árvore
	 * do Mago aparecia coberta por TRIÂNGULOS PRETOS gigantes — os fios mais
	 * longos viravam polígonos preenchidos.
	 *
	 * Nas fotos daqui o defeito NUNCA apareceu, e o motivo é a regra 8 com
	 * outra roupa: o Playwright headless desenha no SwiftShader (software), e o
	 * dono joga na GPU DE VERDADE. Traço TRACEJADO sobre segmento CURVO e
	 * marker rotacionado são justamente as duas construções de SVG com
	 * histórico de tesselar errado em driver de GPU — o dash de curva vira
	 * triângulo degenerado preenchido com a cor padrão, que é PRETO.
	 *
	 * O conserto é não depender delas:
	 * - o cotovelo voltou a ser RETO (`M H V H`); o arredondado que o design
	 *   pedia vem de `stroke-linejoin: round`, que dobra a junta sem criar
	 *   segmento curvo;
	 * - a ponta é um `<path>` triângulo desenhado AQUI, no lugar exato — todo
	 *   fio termina entrando na horizontal, então nem rotação precisa;
	 * - o traço para 5px antes do nó, para a ponta cobrir o fim da linha.
	 */
	const RECUO_DA_PONTA = 5;

	function caminhoDoFio(fio) {
		const fim = fio.x2 - RECUO_DA_PONTA;
		if (fio.y1 === fio.y2) {
			return 'M ' + fio.x1 + ' ' + fio.y1 + ' H ' + fim;
		}
		return 'M ' + fio.x1 + ' ' + fio.y1 + ' H ' + fio.xm + ' V ' + fio.y2 + ' H ' + fim;
	}

	/** A ponta: triângulo apontando para a direita, encostado no nó. */
	function pontaDoFio(fio, cumprido) {
		const x = fio.x2;
		const y = fio.y2;
		return (
			'<path d="M ' +
			(x - 7) +
			' ' +
			(y - 4.5) +
			' L ' +
			x +
			' ' +
			y +
			' L ' +
			(x - 7) +
			' ' +
			(y + 4.5) +
			' Z" class="is-ponta ' +
			(cumprido ? 'is-ponta--ok' : 'is-ponta--travado') +
			'" />'
		);
	}

	/**
	 * A PLAQUETA DO FIO (D-902): "Nv. N", o nivel exigido, no meio do caminho.
	 * Num fio com cotovelo ela senta no trecho VERTICAL (o vao entre colunas e
	 * dela); num fio reto, no meio do trecho. Era a unica informacao da arvore
	 * que so existia no painel de detalhe.
	 */
	function seloDoFio(fio, cumprido) {
		const reto = fio.y1 === fio.y2;
		const lx = reto ? (fio.x1 + fio.x2 - RECUO_DA_PONTA) / 2 : fio.xm;
		const ly = reto ? fio.y1 : (fio.y1 + fio.y2) / 2;
		const sufixo = cumprido ? ' is-fio-selo--ok' : '';
		return (
			'<rect class="is-fio-selo' +
			sufixo +
			'" x="' +
			(lx - 14) +
			'" y="' +
			(ly - 7) +
			'" width="28" height="14" rx="7" />' +
			'<text class="is-fio-selo-texto' +
			(cumprido ? ' is-fio-selo-texto--ok' : '') +
			'" x="' +
			lx +
			'" y="' +
			ly +
			'">Nv. ' +
			fio.nivel +
			'</text>'
		);
	}

	const caminhos = plano.fios
		.map(fio => {
			const cumprido =
				(contexto.porId.has(fio.de) ? nivelEfetivo(contexto.porId.get(fio.de), contexto.rascunho) : 0) >=
				fio.nivel;
			const d = caminhoDoFio(fio);
			/*
			 * DUAS passadas por fio: um HALO claro por baixo e o traço por cima.
			 * O fundo da árvore é grade pontilhada, e um traço de 2px
			 * atravessando os pontos serrilha visualmente — o halo é o papel em
			 * volta do fio, o mesmo truque de todo mapa de metrô.
			 */
			return (
				'<path d="' +
				d +
				'" class="is-fio-halo" />' +
				'<path d="' +
				d +
				'" class="is-fio' +
				(cumprido ? ' is-fio--ok' : ' is-fio--travado') +
				'" />' +
				pontaDoFio(fio, cumprido) +
				seloDoFio(fio, cumprido)
			);
		})
		.join('');

	return (
		'<svg class="is-fios" width="' +
		plano.largura +
		'" height="' +
		plano.altura +
		'" viewBox="0 0 ' +
		plano.largura +
		' ' +
		plano.altura +
		'">' +
		caminhos +
		'</svg>'
	);
}

/**
 * Um nó: ícone (com o ladrilho `.ri-tile` do design system), nome, e a linha de
 * controle `◀ n/m ▶` da referência LATAM.
 *
 * O nível aparece como `5+2/10` quando há rascunho, com o `+2` em dourado — o
 * jogador precisa distinguir num relance o que já é dele do que ele ainda vai
 * pagar, e um `7/10` chapado esconderia isso.
 */
function renderNo(no, contexto) {
	const skill = no.skill;
	const selecionada = skill.skillId === IdleSkills.selectedSkillId;
	const extra = contexto.rascunho[skill.skillId] || 0;
	const efetivo = skill.aprendido + extra;
	const subir = avaliarSubir(skill, contexto);

	// Três estados visuais, e eles não são o mesmo: TRANCADA (falta requisito),
	// DISPONÍVEL (dá para subir agora) e DOMINADA (no teto).
	const noTeto = efetivo >= skill.nivelMaximo;
	const trancada = efetivo === 0 && !subir.ok;

	let classes = 'is-no';
	if (selecionada) {
		classes += ' is-no--selecionada';
	}
	if (trancada) {
		classes += ' is-no--trancada';
	}
	if (noTeto) {
		classes += ' is-no--dominada';
	} else if (subir.ok) {
		classes += ' is-no--pronta';
	}
	if (extra > 0) {
		classes += ' is-no--rascunho';
	}

	const selo = [];
	if (typeof skill.naRotacao === 'number') {
		selo.push(
			'<span class="is-no-selo is-no-selo--rotacao" title="Rotação de ataque, ' +
				skill.naRotacao +
				'º lugar">' +
				skill.naRotacao +
				'</span>'
		);
	}
	if (no.forasteiros.length) {
		const texto = no.forasteiros.map(f => f.nome + ' Nv. ' + f.nivel).join(', ');
		selo.push(
			'<span class="is-no-selo is-no-selo--fora" title="Exige de outro degrau: ' +
				escapeHtml(texto) +
				'">↖</span>'
		);
	}

	return (
		'<div class="' +
		classes +
		'" style="left:' +
		no.x +
		'px; top:' +
		no.y +
		'px; width:' +
		NO_L +
		'px">' +
		'<button type="button" class="is-no-icone ri-tile" data-skill-sel="' +
		escapeHtml(skill.skillId) +
		'" title="' +
		escapeHtml(skill.nome) +
		'">' +
		'<img src="/ragidle/skills/' +
		encodeURIComponent(skill.skillId) +
		'.png" alt="" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\';" />' +
		'<span class="is-no-fallback">' +
		escapeHtml(skillInitials(skill.skillId)) +
		'</span>' +
		barraDoNo(skill, extra) +
		selo.join('') +
		'</button>' +
		'<span class="is-no-nome" title="' +
		escapeHtml(skill.nome) +
		'">' +
		escapeHtml(skill.nome) +
		'</span>' +
		plaqueta(skill, contexto) +
		'</div>'
	);
}

/**
 * A BARRA DE PROGRESSO dentro do ladrilho (D-902): um segmento por nivel ate
 * 10 (ouro = aprendido, tracejado = rascunho); acima disso, barra continua
 * por percentual — 10 segmentos cabem nos 50px do ladrilho, 20 nao.
 */
function barraDoNo(skill, extra) {
	const max = skill.nivelMaximo || 0;
	if (!max) {
		return '';
	}
	if (max <= 10) {
		let segs = '';
		for (let i = 1; i <= max; i++) {
			const classe =
				i <= skill.aprendido ? ' is-no-seg--feito' : i <= skill.aprendido + extra ? ' is-no-seg--rascunho' : '';
			segs += '<span class="is-no-seg' + classe + '"></span>';
		}
		return '<span class="is-no-barra">' + segs + '</span>';
	}
	const feito = Math.round((skill.aprendido / max) * 100);
	const rascunho = Math.round((extra / max) * 100);
	return (
		'<span class="is-no-barra">' +
		'<span class="is-no-seg is-no-seg--feito" style="flex:0 0 ' +
		feito +
		'%"></span>' +
		'<span class="is-no-seg is-no-seg--rascunho" style="flex:0 0 ' +
		rascunho +
		'%"></span>' +
		'<span class="is-no-seg"></span>' +
		'</span>'
	);
}

/**
 * A PLAQUETA — o `◀ n/m ▶` da referência LATAM, como uma cápsula segmentada.
 *
 * É o elemento-assinatura da print, e a primeira rodada o desenhou como três
 * pedaços soltos (dois botões e um texto flutuando). Aqui ele vira UM controle:
 * cápsula branca com divisórias hairline, seta esquerda tira do rascunho, seta
 * direita soma — e a seta que PODE ser usada carrega a tinta azul de "ativa"
 * (--badge-ativa-*), que é como a referência acende as dela.
 *
 * Ela é compartilhada pelo NÓ e pelo cabeçalho do DETALHE (mesmos data-*, o
 * mesmo juiz): quem prefere mexer olhando a mecânica por nível não precisa
 * voltar para a árvore.
 */
function plaqueta(skill, contexto, modificador) {
	const extra = contexto.rascunho[skill.skillId] || 0;
	const subir = avaliarSubir(skill, contexto);
	const descer = avaliarDescer(skill, contexto);
	const efetivo = skill.aprendido + extra;

	const nivelHtml = extra
		? escapeHtml(skill.aprendido) + '<em>+' + escapeHtml(extra) + '</em>/' + escapeHtml(skill.nivelMaximo)
		: escapeHtml(efetivo) + '/' + escapeHtml(skill.nivelMaximo);

	return (
		'<span class="is-plaqueta' +
		(modificador ? ' ' + modificador : '') +
		(extra > 0 ? ' is-plaqueta--rascunho' : '') +
		'">' +
		'<button type="button" class="is-seta is-seta--menos" data-skill-menos="' +
		escapeHtml(skill.skillId) +
		'"' +
		(descer.ok ? '' : ' disabled') +
		' title="' +
		escapeHtml(descer.ok ? 'Tirar um ponto do rascunho' : descer.motivo) +
		'">' +
		RiIcones.chevronEsq +
		'</button>' +
		'<span class="is-no-nivel">' +
		nivelHtml +
		'</span>' +
		'<button type="button" class="is-seta is-seta--mais" data-skill-mais="' +
		escapeHtml(skill.skillId) +
		'"' +
		(subir.ok ? '' : ' disabled') +
		' title="' +
		escapeHtml(subir.ok ? 'Somar um ponto' : subir.motivo) +
		'">' +
		RiIcones.chevronDir +
		'</button>' +
		'</span>'
	);
}

function renderArvore() {
	const root = _root();
	const tela = root.querySelector('.is-tela');
	const data = IdleSkills.serverData;

	if (!data || !data.skills.length) {
		tela.style.width = '';
		tela.style.height = '';
		tela.innerHTML = '<div class="is-empty">Nenhuma habilidade nesta classe.</div>';
		return;
	}

	const doGrau = skillsDoGrau();
	if (!doGrau.length) {
		tela.style.width = '';
		tela.style.height = '';
		tela.innerHTML = '<div class="is-empty">Nenhuma habilidade neste degrau.</div>';
		return;
	}

	const contexto = contextoDoRascunho();
	const plano = montarPlano(doGrau, contexto.porId);

	tela.style.width = plano.largura + 'px';
	tela.style.height = plano.altura + 'px';
	tela.innerHTML = renderFios(plano, contexto) + plano.nos.map(no => renderNo(no, contexto)).join('');

	tela.querySelectorAll('[data-skill-sel]').forEach(b => b.addEventListener('click', onClickNo));
	tela.querySelectorAll('[data-skill-mais]').forEach(b => b.addEventListener('click', onClickMais));
	tela.querySelectorAll('[data-skill-menos]').forEach(b => b.addEventListener('click', onClickMenos));
}

function onClickNo(e) {
	e.stopImmediatePropagation();
	IdleSkills.selectedSkillId = e.currentTarget.dataset.skillSel;
	renderArvore();
	renderDetail();
}

/**
 * A seta ▶ — o gesto do rascunho.
 *
 * Ela também SELECIONA a habilidade, e isso não é conveniência: o painel de
 * detalhe é onde o jogador confere o que o ponto comprou (a mecânica do nível
 * novo), e ter de clicar duas vezes no mesmo nó para ver isso seria a janela
 * escondendo a consequência do próprio clique.
 */
function onClickMais(e) {
	e.stopImmediatePropagation();
	const skillId = e.currentTarget.dataset.skillMais;
	const contexto = contextoDoRascunho();
	const skill = contexto.porId.get(skillId);
	if (!skill) {
		return;
	}
	const veredito = avaliarSubir(skill, contexto);
	if (!veredito.ok) {
		showProblemas([skill.nome + ': ' + veredito.motivo]);
		return;
	}
	IdleSkills.rascunho[skillId] = (IdleSkills.rascunho[skillId] || 0) + 1;
	IdleSkills.selectedSkillId = skillId;
	renderArvore();
	renderDetail();
	renderFooter();
}

function onClickMenos(e) {
	e.stopImmediatePropagation();
	const skillId = e.currentTarget.dataset.skillMenos;
	const contexto = contextoDoRascunho();
	const skill = contexto.porId.get(skillId);
	if (!skill) {
		return;
	}
	const veredito = avaliarDescer(skill, contexto);
	if (!veredito.ok) {
		showProblemas([skill.nome + ': ' + veredito.motivo]);
		return;
	}
	const restante = (IdleSkills.rascunho[skillId] || 0) - 1;
	if (restante > 0) {
		IdleSkills.rascunho[skillId] = restante;
	} else {
		delete IdleSkills.rascunho[skillId];
	}
	IdleSkills.selectedSkillId = skillId;
	renderArvore();
	renderDetail();
	renderFooter();
}

function onClickAplicar(e) {
	e.stopImmediatePropagation();
	sendAplicar();
}

function onClickResetar(e) {
	e.stopImmediatePropagation();
	/*
	 * "Resetar" joga fora o RASCUNHO — não desaprende nada. O Ragnarok não
	 * devolve ponto de habilidade, e um botão que parecesse fazer isso seria a
	 * janela prometendo o que o servidor recusa. O `title` do botão diz isso.
	 */
	IdleSkills.rascunho = {};
	renderArvore();
	renderDetail();
	renderFooter();
}

function onToggleDescricoes(e) {
	IdleSkills.mostrarDescricoes = !!e.currentTarget.checked;
	_preferences.descricoes = IdleSkills.mostrarDescricoes;
	_preferences.save();
	sincronizarDescricoes();
}

/** Recolhe/mostra o painel de detalhe (o interruptor "Descrições"). */
function sincronizarDescricoes() {
	const root = _root();
	const janela = root.querySelector('.is-content');
	if (janela) {
		janela.classList.toggle('is-sem-detalhe', !IdleSkills.mostrarDescricoes);
	}
}

/* ------------------------------------------------------------------------ */
/* O painel de detalhe                                                       */
/* ------------------------------------------------------------------------ */

/**
 * Monta a linha "SP x · alcance y · conjuração z s · recarga w s · dano +k%"
 * de um nível, omitindo o que for zero/ausente.
 */
function buildMecanicaLine(m) {
	const parts = [];
	if (m.sp) {
		parts.push('SP ' + m.sp);
	}
	if (m.alcance) {
		parts.push('alcance ' + m.alcance);
	}
	if (m.conjuracaoMs) {
		parts.push('conjuração ' + m.conjuracaoMs / 1000 + 's');
	}
	if (m.recargaMs) {
		parts.push('recarga ' + m.recargaMs / 1000 + 's');
	}
	if (m.razaoAdicional) {
		parts.push('dano +' + m.razaoAdicional + '%');
	}
	return parts.join(' · ');
}

/**
 * As linhas de "Mecânica por nível": uma por nível, de 1 a `nivelMaximo`. O
 * texto sai das linhas "[Nv X]: …" da descrição do cliente quando existem;
 * senão, da linha numérica montada de `mecanica`; senão, travessão.
 *
 * `null` quando descrição E mecânica estão vazias — aí o chamador escreve "Sem
 * dados nesta build" em vez de `nivelMaximo` linhas de travessão.
 */
function buildMecanicaRows(skill) {
	const descricao = skill.descricao || [];
	const mecanica = skill.mecanica || [];

	if (!descricao.length && !mecanica.length) {
		return null;
	}

	const textByLevel = {};
	descricao.forEach(line => {
		const achado = /^\[Nv\s*(\d+)\]:\s*(.*)$/i.exec(String(line || '').trim());
		if (achado) {
			const lvl = Number(achado[1]);
			textByLevel[lvl] = textByLevel[lvl] ? textByLevel[lvl] + ' ' + achado[2] : achado[2];
		}
	});

	const mecByLevel = {};
	mecanica.forEach(m => {
		if (m && typeof m.nivel === 'number') {
			mecByLevel[m.nivel] = m;
		}
	});

	const rows = [];
	const max = skill.nivelMaximo || 0;
	for (let lvl = 1; lvl <= max; lvl++) {
		let texto = textByLevel[lvl];
		if (!texto) {
			const m = mecByLevel[lvl];
			texto = m ? buildMecanicaLine(m) : '';
		}
		rows.push({ nivel: lvl, texto: texto || '—' });
	}
	return rows;
}

/**
 * O selo de efeito de combate — TRÊS estados, e não dois (D-407).
 *
 * São dois eixos independentes, e ambos precisam ser ditos:
 * - `portada: false` → o motor não sabe executar. Nada acontece.
 * - `semEfeitoDeCombate: true` → o motor executa, mas o efeito é fora de
 *   combate (Teleporte, capacidade de carga, pré-requisito de árvore).
 *
 * Sem nenhum dos dois, o silêncio é o selo: a habilidade funciona.
 */
function seloDeEfeito(skill) {
	if (!skill.portada) {
		return '<span class="is-badge ri-badge ri-badge--cinza" title="O motor de combate ainda não executa esta habilidade — aprendê-la não muda nada na luta.">sem efeito em combate ainda</span>';
	}
	if (skill.semEfeitoDeCombate) {
		return '<span class="is-badge ri-badge ri-badge--cinza" title="O motor executa esta habilidade, mas o efeito dela é fora do combate (deslocamento, capacidade de carga, pré-requisito da árvore).">efeito fora de combate</span>';
	}
	return '';
}

/**
 * A lista de requisitos com veredito por linha (✓/✗).
 *
 * Ela é o que a lista antiga não tinha: `podeAprender: false` dizia QUE não
 * podia, e a árvore mostra DE ONDE vem — mas só para o requisito que é
 * habilidade. Nível base e nível de classe não têm nó no desenho, e sem esta
 * lista continuariam invisíveis.
 */
function renderRequisitos(skill, contexto) {
	const linhas = [];

	if (skill.nivelBaseMinimo > 0) {
		linhas.push({
			ok: contexto.nivelBase >= skill.nivelBaseMinimo,
			texto: 'Nível base ' + skill.nivelBaseMinimo
		});
	}
	if (skill.nivelClasseMinimo > 0) {
		linhas.push({
			ok: contexto.nivelDeJob >= skill.nivelClasseMinimo,
			texto: 'Nível de classe ' + skill.nivelClasseMinimo
		});
	}
	skill.preRequisitos.forEach(requisito => {
		const alvo = contexto.porId.get(requisito.skillId);
		const tem = alvo ? nivelEfetivo(alvo, contexto.rascunho) : 0;
		linhas.push({
			ok: tem >= requisito.nivel,
			texto: (alvo ? alvo.nome : requisito.skillId) + ' Nv. ' + requisito.nivel + ' (você: ' + tem + ')'
		});
	});

	if (!linhas.length) {
		return '<div class="is-req-livre">Sem pré-requisito — dá para começar por ela.</div>';
	}

	return linhas
		.map(
			linha =>
				'<div class="is-req' +
				(linha.ok ? ' is-req--ok' : '') +
				'"><span class="is-req-marca">' +
				(linha.ok ? RiIcones.confere : RiIcones.fechar) +
				'</span>' +
				escapeHtml(linha.texto) +
				'</div>'
		)
		.join('');
}

function renderDetail() {
	const root = _root();
	const scrollEl = root.querySelector('.is-detail-scroll');
	const footerEl = root.querySelector('.is-detail-footer');
	const data = IdleSkills.serverData;

	if (!data) {
		scrollEl.innerHTML = '<div class="is-empty">Abra a janela de habilidades para carregar.</div>';
		footerEl.innerHTML = '';
		return;
	}

	const skill = data.skills.find(s => s.skillId === IdleSkills.selectedSkillId);
	if (!skill) {
		scrollEl.innerHTML = '<div class="is-empty">Selecione uma habilidade.</div>';
		footerEl.innerHTML = '';
		return;
	}

	const contexto = contextoDoRascunho();
	const extra = contexto.rascunho[skill.skillId] || 0;
	const efetivo = skill.aprendido + extra;
	const noTeto = efetivo >= skill.nivelMaximo;
	const categoriaLabel = skill.categoria === 'passiva' ? 'Passiva' : 'Ativa';
	const resumo = buildResumo(skill);
	const mecanicaRows = buildMecanicaRows(skill);
	/*
	 * Duas linhas acesas, e as duas dizem algo (D-902): a do nivel ATUAL
	 * (contando o rascunho) em ouro — "voce esta aqui" — e a PROXIMA
	 * contornada em acento — e o que o proximo ponto compra, e e por isso
	 * que o jogador abriu este painel.
	 */
	const mecanicaHtml = mecanicaRows
		? mecanicaRows
				.map(
					linha =>
						'<div class="is-mecanica-row' +
						(linha.nivel === efetivo ? ' is-mecanica-row--atual' : '') +
						(!noTeto && linha.nivel === efetivo + 1 ? ' is-mecanica-row--proxima' : '') +
						'">' +
						'<span class="is-mecanica-nivel">Nv. ' +
						linha.nivel +
						'</span>' +
						'<span class="is-mecanica-texto">' +
						escapeHtml(linha.texto) +
						'</span></div>'
				)
				.join('')
		: '<div class="is-mecanica-empty">Sem dados nesta build.</div>';

	let pipsHtml = '';
	for (let i = 1; i <= skill.nivelMaximo; i++) {
		const classe = i <= skill.aprendido ? ' is-pip-filled' : i <= efetivo ? ' is-pip-rascunho' : '';
		pipsHtml += '<span class="is-pip' + classe + '"></span>';
	}

	/*
	 * A ROTAÇÃO DE ATAQUE. Três estados, e os três dizem algo: dentro (o botão
	 * TIRA), fora e pode (o botão PÕE), fora e não pode (o botão morre com o
	 * motivo do servidor no title).
	 */
	const naRotacao = typeof skill.naRotacao === 'number';
	const podeRotacionar = naRotacao || !skill.motivoDaRotacao;
	const rotacaoHtml =
		'<button type="button" class="is-btn-rotacao ri-btn ri-btn--sec' +
		(naRotacao ? ' is-btn-rotacao--dentro' : '') +
		'" data-skill-rotacao="' +
		escapeHtml(skill.skillId) +
		'" data-skill-ligar="' +
		(naRotacao ? '0' : '1') +
		'"' +
		(podeRotacionar ? '' : ' disabled') +
		' title="' +
		escapeHtml(skill.motivoDaRotacao || (naRotacao ? 'Tirar da rotação de ataque' : 'Pôr na rotação de ataque')) +
		'">' +
		(naRotacao ? 'Na rotação (' + skill.naRotacao + ')' : 'Pôr na rotação') +
		'</button>';

	const subir = avaliarSubir(skill, contexto);
	const acaoHtml = noTeto
		? '<div class="is-detail-max">Nível máximo alcançado</div>'
		: '<div class="is-detail-next">Próximo nível <strong>Nv. ' +
			(efetivo + 1) +
			'</strong> · custo ' +
			skill.custo +
			' ponto</div>' +
			(subir.ok ? '' : '<div class="is-detail-trava">' + escapeHtml(subir.motivo) + '</div>');
	// A MESMA plaqueta do nó, maior: quem está lendo a mecânica por nível mexe
	// no ponto dali, sem caçar o nó de volta na árvore.
	const plaquetaHtml = plaqueta(skill, contexto, 'is-plaqueta--detalhe');
	const nRequisitos =
		(skill.nivelBaseMinimo > 0 ? 1 : 0) + (skill.nivelClasseMinimo > 0 ? 1 : 0) + skill.preRequisitos.length;

	scrollEl.innerHTML =
		'<div class="is-hero">' +
		'<span class="is-detail-icon">' +
		'<img src="/ragidle/skills/' +
		encodeURIComponent(skill.skillId) +
		'.png" alt="" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\';" />' +
		'<span class="is-detail-icon-fallback">' +
		escapeHtml(skillInitials(skill.skillId)) +
		'</span></span>' +
		'<div class="is-detail-header-text">' +
		'<h3 class="is-detail-name">' +
		escapeHtml(skill.nome) +
		'</h3>' +
		'<div class="is-detail-badges">' +
		'<span class="is-badge ri-badge ' +
		(skill.categoria === 'passiva' ? 'ri-badge--verde' : 'ri-badge--azul') +
		'">' +
		categoriaLabel +
		'</span>' +
		seloDeEfeito(skill) +
		'</div></div></div>' +
		'<div class="is-nivel-linha">' +
		'<span class="is-nivel-rotulo">Nível</span>' +
		plaquetaHtml +
		'<div class="is-pips">' +
		pipsHtml +
		'</div></div>' +
		(resumo ? '<div class="is-detail-resumo">' + escapeHtml(resumo) + '</div>' : '') +
		'<div class="is-detail-section"><h4>Pré-requisitos' +
		(nRequisitos ? '<small>' + nRequisitos + '</small>' : '') +
		'</h4>' +
		'<div class="is-req-box">' +
		renderRequisitos(skill, contexto) +
		'</div></div>' +
		'<div class="is-detail-section"><h4>Mecânica por nível<small>' +
		skill.nivelMaximo +
		' níveis</small></h4>' +
		'<div class="is-mecanica-box ri-scroll">' +
		mecanicaHtml +
		'</div></div>';

	footerEl.innerHTML = acaoHtml + '<div class="is-detail-acoes">' + rotacaoHtml + '</div>';

	const btnRot = footerEl.querySelector('[data-skill-rotacao]');
	if (btnRot) {
		btnRot.addEventListener('click', onClickRotacao);
	}
	// A plaqueta do cabeçalho usa os MESMOS data-* e o mesmo juiz do nó.
	scrollEl.querySelectorAll('[data-skill-mais]').forEach(b => b.addEventListener('click', onClickMais));
	scrollEl.querySelectorAll('[data-skill-menos]').forEach(b => b.addEventListener('click', onClickMenos));

	// A linha da mecanica que importa fica a vista sem o jogador rolar.
	const alvo =
		scrollEl.querySelector('.is-mecanica-row--proxima') || scrollEl.querySelector('.is-mecanica-row--atual');
	if (alvo && alvo.scrollIntoView) {
		alvo.scrollIntoView({ block: 'nearest' });
	}
}

/**
 * O botão da ROTAÇÃO. `motivoDaRotacao` vem do servidor e diz por que ela não
 * entra — botão morto sem explicação manda o jogador procurar defeito onde há
 * regra, que é o mesmo argumento do `motivo` do aprendizado.
 */
function onClickRotacao(e) {
	e.stopImmediatePropagation();
	const skillId = e.currentTarget.dataset.skillRotacao;
	if (!skillId) {
		return;
	}
	sendPriorizar(skillId, e.currentTarget.dataset.skillLigar === '1');
}

/* ------------------------------------------------------------------------ */
/* O rodapé                                                                  */
/* ------------------------------------------------------------------------ */

function renderFooter() {
	const root = _root();
	const leftEl = root.querySelector('.is-footer-left');
	const pillEl = root.querySelector('.is-pontos-pill');
	const problemasEl = root.querySelector('.is-problemas');
	const btnAplicar = root.querySelector('.is-btn-aplicar');
	const btnResetar = root.querySelector('.is-btn-resetar');

	const data = IdleSkills.serverData;
	if (!data) {
		leftEl.textContent = '';
		pillEl.textContent = 'Pontos de habilidade: 0';
		btnAplicar.disabled = true;
		btnResetar.disabled = true;
	} else {
		const contexto = contextoDoRascunho();
		const gastos = pontosNoRascunho(IdleSkills.rascunho);
		const livres = data.pontos - gastos;

		// "Disponíveis" conta o RASCUNHO, e não o `podeAprender` do servidor: o
		// número tem de responder "e agora, o que eu ainda consigo subir?", e
		// depois de dois pontos no rascunho a resposta do servidor envelheceu.
		const disponiveis = data.skills.filter(s => avaliarSubir(s, contexto).ok).length;
		leftEl.textContent = pluralizeDisponiveis(disponiveis);

		pillEl.innerHTML =
			'Pontos de habilidade: ' + livres + (gastos ? ' <em>(−' + gastos + ' no rascunho)</em>' : '');

		btnAplicar.disabled = gastos === 0;
		btnResetar.disabled = gastos === 0;
		// Com rascunho aberto o Aplicar ACENDE (brilho de acento): é a única
		// ação da janela com consequência, e o olho tem de achá-la sem ler.
		btnAplicar.classList.toggle('is-armado', gastos > 0);
		btnAplicar.title = gastos ? 'Gastar ' + gastos + ' ponto(s) de habilidade' : 'Nada no rascunho';
		btnResetar.title = 'Descarta o rascunho — não desaprende nada (o Ragnarok não devolve ponto)';
	}

	problemasEl.textContent =
		IdleSkills.problemas && IdleSkills.problemas.length ? IdleSkills.problemas.join(' · ') : '';
}

Network.hookPacket(PACKET.ZC.RAGIDLE_SKILLS, onSkillsReceived);

/**
 * A TROCA DE PERSONAGEM ESQUECE a JANELA DE HABILIDADES.
 *
 * Voltar ao menu de personagem NÃO recarrega a página: `onRestartAnswer` chama
 * `cleanGameUI()` e `onRestart()`, sem `GameEngine.reload()` (o reload só
 * acontece no SAIR). Todo estado de MÓDULO atravessa a troca — e este arquivo
 * guarda a árvore inteira do personagem, mais um RASCUNHO de pontos que só faz
 * sentido para quem o montou.
 *
 * Chamada por `cleanGameUI()` em Engine/MapEngine.js, junto com os outros
 * componentes RAGIDLE. Quem somar estado de personagem aqui soma a linha
 * correspondente ABAIXO, e o portão `limpeza-da-troca-de-personagem.test.ts`
 * (no repo do servidor) reprova se esquecer.
 */
IdleSkills.limparEstadoDoPersonagem = function limparEstadoDoPersonagem() {
	IdleSkills.serverData = null;
	IdleSkills.selectedSkillId = null;
	IdleSkills.problemas = [];
	IdleSkills.rascunho = {};
	IdleSkills._esperandoAplicar = false;
	/*
	 * ZERAR O DADO NÃO BASTA: `GUIComponent.remove()` só DESANEXA o host, então
	 * o shadow DOM (com `is-open` e o HTML do personagem anterior) atravessa a
	 * troca. Ver `UI/Components/limpezaDeJanelaIdle.js`.
	 */
	fecharEEsquecer(_root(), '.is-window', { corpo: '.is-tela', texto: 'Carregando…' });
};

/**
 * Create component and export it
 */
export default UIManager.addComponent(IdleSkills);
