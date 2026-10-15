/**
 * scripts/arnes-hud-premium.js - o arnes de foto da HUD mobile premium.
 *
 * Ver o cabecalho de `arnes-hud-premium.html`. A receita de montagem e a do
 * arnes do tutorial (`arnes-tutorial.js`): host -> Shadow DOM -> Common.css ->
 * CSS do componente -> `.ui-component-root` -> HTML do componente. A unica
 * peca a mais e a do GUIComponent de hoje: o pedaco premium, injetado pelo
 * MESMO `HudPremium.injetarNoShadow` que o `_prepare` chama.
 *
 * A prova (`foto-hud-premium.mjs`) le `window.__arnes.medir()`.
 */

import Common from '/src/UI/Common.css?raw';
import RiIcones from '/src/UI/ri-icones.js';
import * as EscalaDaHud from '/src/UI/escalaDaHud.js';
import * as HudVertical from '/src/UI/hudVertical.js';
import HudPremium from '/src/UI/HudPremium/hudPremium.js';
import GraphicsSettings from '/src/Preferences/Graphics.js';

import basicHtml from '/src/UI/Components/BasicInfoIdle/BasicInfoIdle.html?raw';
import basicCss from '/src/UI/Components/BasicInfoIdle/BasicInfoIdle.css?raw';
import miniHtml from '/src/UI/Components/MiniMap/MiniMapV2/MiniMapV2.html?raw';
import miniCss from '/src/UI/Components/MiniMap/MiniMapV2/MiniMapV2.css?raw';
import shortHtml from '/src/UI/Components/ShortCut/ShortCut.html?raw';
import shortCss from '/src/UI/Components/ShortCut/ShortCut.css?raw';
import chatHtml from '/src/UI/Components/ChatBox/ChatBox.html?raw';
import chatCss from '/src/UI/Components/ChatBox/ChatBox.css?raw';
import statusHtml from '/src/UI/Components/StatusIcons/StatusIcons.html?raw';
import statusCss from '/src/UI/Components/StatusIcons/StatusIcons.css?raw';
import topMenuHtml from '/src/UI/Components/TopMenuIdle/TopMenuIdle.html?raw';
import topMenuCss from '/src/UI/Components/TopMenuIdle/TopMenuIdle.css?raw';
import cornerHtml from '/src/UI/Components/CombatCornerIdle/CombatCornerIdle.html?raw';
import cornerCss from '/src/UI/Components/CombatCornerIdle/CombatCornerIdle.css?raw';
import huntHtml from '/src/UI/Components/HuntButtonIdle/HuntButtonIdle.html?raw';
import huntCss from '/src/UI/Components/HuntButtonIdle/HuntButtonIdle.css?raw';
import trackerHtml from '/src/UI/Components/MissoesTrackerIdle/MissoesTrackerIdle.html?raw';
import trackerCss from '/src/UI/Components/MissoesTrackerIdle/MissoesTrackerIdle.css?raw';
/* O cartao de missoes leva tambem o CSS do "(i)", como no jogo
   (`new GUIComponent('MissoesTrackerIdle', cssText + infoCss)`). */
import infoCss from '/src/UI/Components/MissoesIdle/infoDaMissao.css?raw';
import { desenharArco, slotsDoArco } from '/src/UI/Components/CombatCornerIdle/arcoDeSkills.js';
import { criarRelogioDaBarra } from '/src/UI/Components/ShortCut/relogioDaBarra.js';

/* `?atalhos=1`: a barra de skills LIGADA nas Configuracoes (o arco some). Sem
   ele, o padrao da premium: a barra desligada e o arco em volta do Auto. */
HudPremium.definirBarraDeAtalhos(new URLSearchParams(location.search).get('atalhos') === '1');
/* `?escala=80`: o Tamanho da HUD das Configuracoes de Video (em %), como o jogador o deixa. */
const escalaPedida = Number(new URLSearchParams(location.search).get('escala'));
if (escalaPedida > 0) {
	GraphicsSettings.escalaDaHud = escalaPedida;
}

const icones = texto => texto.replace(/<!--RI_ICONE:(\w+)-->/g, (_, chave) => RiIcones[chave] || '');

/* O Common.css de DOCUMENTO, como `UIManager.injectCommonCSS` faz: e nele que
   moram as ancoras dos hosts da HUD vertical (`html.ri-vertical #X`). */
const comumDoDocumento = document.createElement('style');
comumDoDocumento.setAttribute('data-common', '');
comumDoDocumento.textContent = Common;
document.head.appendChild(comumDoDocumento);

/** Monta um host igual ao que o GUIComponent monta (`GUIComponent._prepare`). */
function montar(nome, html, css) {
	const host = document.createElement('div');
	host.id = nome;
	host.dataset.guiComponent = nome;
	host.style.position = 'absolute';
	host.style.zIndex = '50';
	const shadow = host.attachShadow({ mode: 'open' });
	const comum = document.createElement('style');
	comum.textContent = Common;
	shadow.appendChild(comum);
	const proprio = document.createElement('style');
	proprio.setAttribute('data-component', nome);
	proprio.textContent = css;
	shadow.appendChild(proprio);
	HudPremium.injetarNoShadow(shadow, nome);
	const raiz = document.createElement('div');
	raiz.className = 'ui-component-root';
	raiz.innerHTML = icones(html);
	shadow.appendChild(raiz);
	document.body.appendChild(host);
	return { host, shadow, raiz, $: sel => shadow.querySelector(sel), $$: sel => shadow.querySelectorAll(sel) };
}

/* A ordem e a do `MapEngine` (quem entra depois paira por cima no empate de
   z-index), resumida as pecas da HUD. */
const pecas = {
	BasicInfoIdle: montar('BasicInfoIdle', basicHtml, basicCss),
	MiniMapV2: montar('MiniMapV2', miniHtml, miniCss),
	ShortCut: montar('ShortCut', shortHtml, shortCss),
	ChatBox: montar('ChatBox', chatHtml, chatCss),
	StatusIcons: montar('StatusIcons', statusHtml, statusCss),
	TopMenuIdle: montar('TopMenuIdle', topMenuHtml, topMenuCss),
	CombatCornerIdle: montar('CombatCornerIdle', cornerHtml, cornerCss),
	HuntButtonIdle: montar('HuntButtonIdle', huntHtml, huntCss),
	MissoesTrackerIdle: montar('MissoesTrackerIdle', trackerHtml, trackerCss + '\n' + infoCss)
};

/* ─── A semente: o personagem do mockup ──────────────────────────────────── */

function texto(peca, sel, valor) {
	const el = peca.$(sel);
	if (el) el.textContent = valor;
}

function semearPersonagem() {
	const p = pecas.BasicInfoIdle;
	texto(p, '.bi-name', 'Castanha');
	texto(p, '.bi-class', 'Caçador');
	texto(p, '.bi-blvl-value', '61');
	texto(p, '.bi-jlvl-value', '1');
	const bexp = p.$('.bi-bexp-fill');
	if (bexp) bexp.style.width = '89.9%';
	texto(p, '.bi-bexp-pct', '89,9%');
	const jexp = p.$('.bi-jexp-fill');
	if (jexp) jexp.style.width = '6%';
	texto(p, '.bi-jexp-pct', '6,0%');
	for (const [classe, txt] of [
		['.bi-bar-hp', '5421 / 5421'],
		['.bi-bar-sp', '892 / 892']
	]) {
		const barra = p.$(classe);
		if (!barra) continue;
		barra.querySelector('.bi-bar-fill').style.width = '100%';
		barra.querySelector('.bi-bar-text').textContent = txt;
		barra.querySelector('.bi-bar-pct').textContent = '100%';
	}
	texto(p, '.bi-zeny', '876.937');
	texto(p, '.bi-cash', '4.926');
	for (const ping of p.$$('.bi-ping')) ping.textContent = '130 ms';
	/* O retrato de classe e um PNG publicado (`retratoDeClasse.js`): o
	   Cacador e o job 11. */
	const img = p.$('.bi-avatar-img');
	if (img) {
		/* `.is-loaded` e o que `BasicInfoIdle.js` poe no `onload` (opacity 1). */
		img.addEventListener('load', () => img.classList.add('is-loaded'));
		img.src = '/ragidle/classes/11.png';
	}
	const inicial = p.$('.bi-avatar-initial');
	if (inicial) inicial.style.display = 'none';
}

/** O minimapa: o canvas recebe um desenho de mentira (no jogo e o BMP do mapa). */
function semearMinimapa() {
	const p = pecas.MiniMapV2;
	texto(p, '.mm-mapname', 'Prontera');
	texto(p, '.coord.x', '156');
	texto(p, '.coord.y', '183');
	const canvas = p.$('canvas');
	if (!canvas) return;
	const ctx = canvas.getContext('2d');
	ctx.fillStyle = '#9fb48a';
	ctx.fillRect(0, 0, 128, 128);
	ctx.fillStyle = '#d9cfb4';
	ctx.fillRect(56, 0, 16, 128);
	ctx.fillRect(0, 56, 128, 16);
	ctx.fillStyle = '#b8a27a';
	for (const [x, y] of [
		[14, 14],
		[86, 14],
		[14, 86],
		[86, 86]
	]) {
		ctx.fillRect(x, y, 28, 28);
	}
	ctx.fillStyle = '#e8c547';
	for (const [x, y] of [
		[40, 40],
		[90, 46],
		[30, 96],
		[100, 100]
	]) {
		ctx.beginPath();
		ctx.arc(x, y, 3.5, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.fillStyle = '#2f6fd6';
	ctx.beginPath();
	ctx.moveTo(64, 56);
	ctx.lineTo(70, 72);
	ctx.lineTo(64, 68);
	ctx.lineTo(58, 72);
	ctx.closePath();
	ctx.fill();
}

/** As duas missoes do mockup, no formato de `blocoDaAceita` (MissoesTrackerIdle.js). */
function semearMissoes() {
	const p = pecas.MissoesTrackerIdle;
	const caixa = p.$('.mt-aceitas');
	if (!caixa) return;
	caixa.dataset.vazia = 'false';
	caixa.innerHTML = `
		<li class="mt-bloco mt-ativa" data-missao="mestre-armaduras">
			<div class="mt-bloco-topo">
				<span class="mt-ativa-titulo">Mestre das Armaduras</span>
				<button type="button" class="im-i mt-info" data-info="mestre-armaduras" aria-label="Informações da missão Mestre das Armaduras" title="Informações da missão">i</button>
			</div>
			<div class="mt-ativa-passo">Converse com o Mestre das Armaduras em Prontera</div>
			<div class="mt-ativa-acoes"><span class="mt-eta">Prontera (156, 183)</span></div>
		</li>
		<li class="mt-bloco" data-missao="mestre-materiais">
			<div class="mt-bloco-topo">
				<span class="mt-ativa-titulo">Mestre de Materiais</span>
				<button type="button" class="im-i mt-info" data-info="mestre-materiais" aria-label="Informações da missão Mestre de Materiais" title="Informações da missão">i</button>
			</div>
			<div class="mt-ativa-passo">Colete Minério de Ferro — 0/10</div>
			<div class="mt-barra"><div class="mt-barra-fill" style="width:0%"></div></div>
		</li>`;
}

/** Tres buffs acesos, no formato de `createElement` (StatusIcons.js). */
function semearBuffs() {
	const p = pecas.StatusIcons;
	const container = p.$('#StatusIcons');
	if (!container) return;
	const cores = [
		['#2f8a3a', 'EXP', '28d'],
		['#7a3fb0', 'BL', '24:11'],
		['#2f6fd6', 'AG', '9:42']
	];
	cores.forEach(([cor, sigla, tempo], i) => {
		const state = document.createElement('div');
		state.className = 'state';
		const moldura = document.createElement('div');
		moldura.className = 'moldura';
		const canvas = document.createElement('canvas');
		canvas.width = 32;
		canvas.height = 32;
		const ctx = canvas.getContext('2d');
		ctx.fillStyle = cor;
		ctx.fillRect(0, 0, 32, 32);
		ctx.fillStyle = '#fff';
		ctx.font = '700 10px Arial';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(sigla, 16, 16);
		moldura.appendChild(canvas);
		state.appendChild(moldura);
		const relogio = document.createElement('div');
		relogio.className = 'relogio';
		relogio.textContent = tempo;
		state.appendChild(relogio);
		/* A coluna de `resetElementsPosition` (top por indice, right por coluna). */
		state.style.top = `${i * 52}px`;
		state.style.right = '0px';
		container.appendChild(state);
	});
}

/** Sete itens e um vazio na pagina 1, e os pontinhos de pagina (ShortCut.js). */
function semearAtalhos() {
	const p = pecas.ShortCut;
	const itens = [
		['#d23a3a', '2847'],
		['#2f6fd6', '8080'],
		['#c9573f', '56'],
		['#4f9a3c', '12'],
		['#7aa8e6', '3'],
		['#9a7ae0', '21'],
		['#8c5fd0', '9']
	];
	itens.forEach(([cor, n], i) => {
		const slot = p.$(`.container[data-index="${i}"]`);
		if (!slot) return;
		slot.innerHTML = '<div draggable="true" class="icon"><div class="img"></div><div class="amount"></div></div>';
		const img = slot.querySelector('.img');
		img.style.background = `radial-gradient(circle at 40% 35%, #fff8 0 18%, ${cor} 19% 70%, transparent 71%)`;
		slot.querySelector('.amount').textContent = n;
	});
	const raiz = p.$('#ShortCut');
	const paginas = document.createElement('div');
	paginas.className = 'shortcut-paginas';
	paginas.setAttribute('role', 'tablist');
	for (let i = 0; i < 5; i++) {
		const ponto = document.createElement('button');
		ponto.type = 'button';
		ponto.className = 'shortcut-pagina' + (i === 0 ? ' is-ativa' : '');
		ponto.setAttribute('aria-label', `Página ${i + 1}`);
		paginas.appendChild(ponto);
	}
	if (raiz) raiz.appendChild(paginas);
	const fileiras = p.$$('.row');
	fileiras.forEach((f, i) => f.classList.toggle('is-pagina-ativa', i === 0));
}

/** Duas linhas no chat Global. */
function semearChat() {
	const p = pecas.ChatBox;
	const global = p.$('.content[data-content="global"]');
	if (!global) return;
	global.innerHTML =
		'<div style="color:#fff">[Global] Bob: alguem pra Orc Dungeon?</div>' +
		'<div style="color:#ffe08a">[Farm] Castanha obteve Carta Poring!</div>';
}

/* O item "Bot" do menu nasce com `display:none` inline e o JS o mostra quando o
   servidor tem Bot (TopMenuIdle.js). Aqui ele tem. */
const bot = pecas.TopMenuIdle.$('.tm-item-bot');
if (bot) bot.style.display = '';
/* Admin so para a conta dona (TopMenuIdle.js). */
const admin = pecas.TopMenuIdle.$('.tm-item-admin');
if (admin) admin.style.display = 'none';

semearPersonagem();
semearMinimapa();
semearMissoes();
semearBuffs();
semearAtalhos();
semearChat();
semearArco();

/* O arco do Auto: o rodizio do Cacador (o formato de `rodizioDoAuto.js`), com
   a Chuva de Flechas em recarga (o relogio da barra, num instante fixo) e a
   Blitz Beat desligada no rodizio. */
function semearArco() {
	const container = pecas.CombatCornerIdle.$('.cc-rodizio');
	desenharArco(container, [
		{ skillId: 46, nome: 'Rajada de Flechas', chave: 'AC_DOUBLE', nivel: 10, ativa: true },
		{ skillId: 47, nome: 'Chuva de Flechas', chave: 'AC_SHOWER', nivel: 10, ativa: true },
		{ skillId: 129, nome: 'Ataque do Falcao', chave: 'HT_BLITZBEAT', nivel: 5, ativa: false }
	]);
	const relogio = criarRelogioDaBarra({
		slots: () => slotsDoArco(container),
		agora: () => 1000,
		armar: () => 0,
		desarmar() {}
	});
	relogio.recarga(47, 4000);
	relogio.desenhar(2000);
}

/* As duas marcas de verdade: a escala (D-934) e a vertical (D-939), que agora
   carimba tambem a premium quando a bandeira esta ligada. */
EscalaDaHud.reaplicar(document);
HudVertical.aplicar(document, true);

/* A altura do cartao de status, como `BasicInfoIdle.js` publica
   (`publicarCaixa` -> `--hud-basic-altura` no documento): o minimapa, as
   missoes e o trilho se penduram nela. */
function publicarAlturaDoStatus() {
	const raiz = document.documentElement.style;
	const janela = pecas.BasicInfoIdle.$('.bi-window');
	if (janela) {
		/* Em unidade da HUD, como o jogo publica (`emUnidadesDaHud`): com o Tamanho da HUD fora de 100% o pixel
		   de viewport nao e o pixel de dentro do host com `zoom`. */
		raiz.setProperty(
			'--hud-basic-altura',
			`${Math.round(EscalaDaHud.emUnidadesDaHud(janela.getBoundingClientRect().height))}px`
		);
	}
	/* E a do chat, como `ChatBox.js` publica (`--hud-chat-altura`): os buffs
	   da camada premium se apoiam nela. */
	const chat = pecas.ChatBox.$('#chatbox');
	if (chat) {
		raiz.setProperty(
			'--hud-chat-altura',
			`${Math.round(EscalaDaHud.emUnidadesDaHud(chat.getBoundingClientRect().height))}px`
		);
	}
}
publicarAlturaDoStatus();
requestAnimationFrame(publicarAlturaDoStatus);
/* Como o jogo (`observarAlturaDoChat`, o `publicarCaixa` do status): republica quando a caixa muda. As faixas
   de tela sao marcas (hudVertical.js), e trocar a marca anima a altura do log do chat - medir so duas vezes
   pegava a meia animacao (medido: 193 publicado para um chat de 91). */
if (typeof ResizeObserver === 'function') {
	const observador = new ResizeObserver(publicarAlturaDoStatus);
	observador.observe(pecas.ChatBox.$('#chatbox'));
	observador.observe(pecas.BasicInfoIdle.$('.bi-window'));
}

/* ─── A medida ──────────────────────────────────────────────────────────── */

/** A caixa visivel de um elemento, ou null se ele nao ocupa tela. */
function caixa(el, redondo) {
	if (!el) return null;
	const r = el.getBoundingClientRect();
	if (r.width < 1 || r.height < 1) return null;
	const estilo = getComputedStyle(el);
	if (estilo.visibility === 'hidden' || estilo.display === 'none' || Number(estilo.opacity) === 0) return null;
	const c = { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
	/* Peca REDONDA (os discos): a prova cruza o circulo, e nao a caixa - o
	   disco da diagonal encosta no canto da caixa do Auto sem tocar o Auto. */
	return redondo ? { ...c, redondo: true } : c;
}

/**
 * As PECAS que a prova cruza entre si. Cada uma e o elemento VISIVEL (nao o
 * host: varios hosts sao um ponto sem caixa, como o do menu).
 */
const PECAS_MEDIDAS = {
	status: ['BasicInfoIdle', '.bi-window'],
	menu: ['TopMenuIdle', '.tm-fab'],
	minimapa: ['MiniMapV2', '.mm-body'],
	missoes: ['MissoesTrackerIdle', '.mt-painel'],
	trilho: ['TopMenuIdle', '.tm-top'],
	auto: ['CombatCornerIdle', '.cc-ring', true],
	autoRotulo: ['CombatCornerIdle', '.cc-label--v'],
	skill1: ['CombatCornerIdle', '.cc-skill[data-pos="0"]', true],
	skill2: ['CombatCornerIdle', '.cc-skill[data-pos="1"]', true],
	skill3: ['CombatCornerIdle', '.cc-skill[data-pos="2"]', true],
	cacar: ['HuntButtonIdle', '.hb-cacar', true],
	voltar: ['HuntButtonIdle', '.hb-voltar', true],
	sentar: ['HuntButtonIdle', '.hb-sentar'],
	buffs: ['StatusIcons', '#StatusIcons'],
	chat: ['ChatBox', '#chatbox'],
	atalhos: ['ShortCut', '#ShortCut']
};

/**
 * A AREA DE TOQUE de um botao, e nao so a caixa desenhada: o `Common.css`
 * aumenta o alvo de dedo dos botoes pequenos com um `::before` absoluto de
 * `inset` negativo (`tests/ui/areaDeToqueAncoraNoBotao.test.js`). Contar so a
 * caixa acusaria de pequeno um botao que o dedo alcanca com folga.
 */
function areaDeToque(el, c) {
	const antes = getComputedStyle(el, '::before');
	if (!antes || antes.content === 'none' || antes.position !== 'absolute') return c;
	const px = valor => (valor && valor.endsWith('px') ? parseFloat(valor) : 0);
	const cresce = lado => Math.max(0, -px(antes[lado]));
	const w = c.w + cresce('left') + cresce('right');
	const h = c.h + cresce('top') + cresce('bottom');
	return { ...c, w: Math.round(w), h: Math.round(h) };
}

/** Os alvos de toque: todo botao visivel das pecas da HUD. */
function alvosDeToque() {
	const lista = [];
	for (const [nome, peca] of Object.entries(pecas)) {
		for (const el of peca.$$('button, [role="tab"], .tm-item')) {
			const c = caixa(el);
			if (!c) continue;
			const rotulo = (el.getAttribute('aria-label') || el.title || el.textContent || '').trim().slice(0, 30);
			lista.push({ peca: nome, rotulo, ...areaDeToque(el, c) });
		}
	}
	return lista;
}

window.__arnes = {
	premium: HudPremium.ehHudPremium(),
	marcas() {
		return {
			vertical: document.documentElement.classList.contains('ri-vertical'),
			premium: document.documentElement.classList.contains('ri-premium'),
			comAtalhos: document.documentElement.classList.contains('ri-com-atalhos')
		};
	},
	medir() {
		const caixas = {};
		for (const [nome, [peca, sel, redondo]] of Object.entries(PECAS_MEDIDAS)) {
			caixas[nome] = caixa(pecas[peca].$(sel), redondo);
		}
		return { caixas, alvos: alvosDeToque(), viewport: { w: innerWidth, h: innerHeight } };
	}
};
window.__arnesPronto = true;
