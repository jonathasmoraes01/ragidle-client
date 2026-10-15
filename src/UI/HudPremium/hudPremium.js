/**
 * UI/HudPremium/hudPremium.js — A HUD MOBILE PREMIUM (15/10/2026).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * O PEDIDO
 * ═══════════════════════════════════════════════════════════════════════
 * Redesenho visual da HUD do celular em pe, a partir do pacote "HUD Mobile
 * Premium" (mockups `hud-premium-vertical.png` / `hud-premium-horizontal.png`):
 * marfim, azul profundo e dourado discreto, o MINIMAPA DE VOLTA no canto
 * superior direito (revoga, so com esta bandeira, o "sem minimapa" de D-939),
 * trilho Mochila/Auto/Skills/Config/RO Shop, e o botao de caca em medalhao.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * O QUE ESTE MODULO E, E O QUE ELE NAO E
 * ═══════════════════════════════════════════════════════════════════════
 * Ele e uma CAMADA POR CIMA da HUD vertical de D-939, e nao uma HUD nova:
 *
 *   - os COMPONENTES sao os mesmos (BasicInfoIdle, TopMenuIdle, MiniMapV2,
 *     HuntButtonIdle...), com o mesmo estado e os mesmos handlers. Nada aqui
 *     reimplementa logica de jogo, e nenhum botao novo nasce sem destino real;
 *   - o CRITERIO de "celular em pe" continua sendo o de `hudVertical.js`. A
 *     marca `ri-premium` so existe onde `ri-vertical` existe, e e carimbada
 *     pela MESMA rota (`hudVertical.aplicar`), sem ouvinte proprio;
 *   - o DESENHO mora em CSS atras da marca: um pedaco por componente
 *     (`componentes/<Nome>.css`), injetado no shadow DEPOIS do CSS do proprio
 *     componente (vence por ordem, sem guerra de especificidade), e um pedaco
 *     de documento (`documento.css`) para as ancoras dos hosts.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * A BANDEIRA FALHA PARA DESLIGADO — o contrario de `enableHudAdaptavel`
 * ═══════════════════════════════════════════════════════════════════════
 * `enableHudAdaptavel` falha para LIGADO porque e o estado normal do jogo. Esta
 * e uma camada NOVA: sem `ROConfig`, ou com qualquer valor que nao seja
 * exatamente `true`, ela nao existe. Com ela desligada nenhum byte deste
 * diretorio chega ao documento nem a shadow nenhum — a volta e inteira.
 *
 * Como a outra, ela mora no `Config.js`/`Config.local.js` (publicado como
 * arquivo separado, `no-cache`): ligar e desligar e trocar uma linha, sem
 * rebuild.
 */

import { ehAdaptavel } from 'UI/escalaDaHud.js';
import Preferences from 'Core/Preferences.js';

import tokensCss from './tokens.css?raw';
import documentoCss from './documento.css?raw';
import basicInfoCss from './componentes/BasicInfoIdle.css?raw';
import topMenuCss from './componentes/TopMenuIdle.css?raw';
import miniMapCss from './componentes/MiniMapV2.css?raw';
import trackerCss from './componentes/MissoesTrackerIdle.css?raw';
import combatCornerCss from './componentes/CombatCornerIdle.css?raw';
import huntButtonCss from './componentes/HuntButtonIdle.css?raw';
import statusIconsCss from './componentes/StatusIcons.css?raw';
import shortCutCss from './componentes/ShortCut.css?raw';
import chatBoxCss from './componentes/ChatBox.css?raw';

/** A marca que o CSS le — no `<html>` e no root interno de cada shadow. */
export const MARCA_PREMIUM = 'ri-premium';

/**
 * A marca da BARRA DE SKILLS ligada (pedido do dono, 15/10/2026): *"tirar essa barra inferior das skills da
 * tela do mobile (...) o player pudesse depois habilitar pelas configuracoes a barra de skills tambem, mas por
 * padrao que ela viesse desativada"*. Sem ela (o padrao), a barra de atalhos some e as tres skills do rodizio
 * aparecem em volta do Auto; com ela, a barra volta e o arco some. So existe junto com `ri-premium`.
 */
export const MARCA_COM_ATALHOS = 'ri-com-atalhos';

/** O atributo do `<style>` de documento, para a injecao ser idempotente. */
const ATRIBUTO_DO_DOCUMENTO = 'data-hud-premium';

/**
 * O CSS de cada componente, pelo NOME do componente (o mesmo `this.name` do
 * GUIComponent, que e tambem o id do host). Componente fora deste mapa nao
 * recebe nada: as janelas seguem com o desenho delas.
 */
const CSS_POR_COMPONENTE = Object.freeze({
	BasicInfoIdle: basicInfoCss,
	TopMenuIdle: topMenuCss,
	MiniMapV2: miniMapCss,
	MissoesTrackerIdle: trackerCss,
	CombatCornerIdle: combatCornerCss,
	HuntButtonIdle: huntButtonCss,
	StatusIcons: statusIconsCss,
	ShortCut: shortCutCss,
	ChatBox: chatBoxCss
});

/**
 * A bandeira `enableHudMobilePremium` esta ligada?
 *
 * So `true` liga (ver o cabecalho). E ela depende da camada adaptavel: com
 * `enableHudAdaptavel: false` nao existe HUD vertical, entao nao existe esta.
 */
export function ehHudPremium() {
	try {
		const cfg = typeof window !== 'undefined' ? window.ROConfig : null;
		return !!cfg && cfg.enableHudMobilePremium === true && ehAdaptavel();
	} catch {
		return false;
	}
}

/**
 * O CSS premium de um componente, ou '' quando ele nao tem (ou a bandeira
 * esta desligada). Os tokens vao junto em todo pedaco: custom property herda
 * do host para dentro do shadow, mas so se o host a tiver — e quem a declara
 * no documento e o `html.ri-premium`, que a heranca alcanca. Repetir os
 * tokens no shadow seria redundante; o que vai junto e so o que o pedaco usa.
 */
export function cssDoComponente(nome) {
	if (!ehHudPremium()) {
		return '';
	}
	return CSS_POR_COMPONENTE[nome] || '';
}

/*
 * A PREFERENCIA da barra mora no `localStorage` do jogador (`Core/Preferences.js`, chave `HudPremium`), lida
 * na primeira pergunta e nao no carregamento do modulo: o navegador em modo privado pode recusar o storage, e
 * a recusa nao pode derrubar o GUIComponent (que importa este modulo).
 */
let _prefs = null;

function preferencias() {
	if (_prefs === null) {
		try {
			_prefs = Preferences.get('HudPremium', { barraDeAtalhos: false }, 1.0);
		} catch {
			_prefs = { barraDeAtalhos: false, save() {} };
		}
	}
	return _prefs;
}

/** A barra de skills esta ligada? Nasce DESLIGADA. */
export function barraDeAtalhosLigada() {
	return preferencias().barraDeAtalhos === true;
}

/** Liga ou desliga a barra (a janela de Configuracoes chama; quem reaplica a marca e quem chamou). */
export function definirBarraDeAtalhos(ligada) {
	const p = preferencias();
	p.barraDeAtalhos = ligada === true;
	try {
		p.save();
	} catch {
		/* storage recusado: vale ate o fim da sessao */
	}
	return p.barraDeAtalhos;
}

/** So para testes: esquece a preferencia lida. */
export function esquecerPreferenciasParaTeste() {
	_prefs = null;
}

/** Os nomes que recebem CSS premium — para o arnes e os testes. */
export function componentesComCss() {
	return Object.keys(CSS_POR_COMPONENTE);
}

/**
 * Poe o CSS de documento (tokens + ancoras dos hosts) no `<head>`, uma vez.
 *
 * Mora DEPOIS do `Common.css` de documento (`style[data-common]`), porque as
 * ancoras de D-939 sao `html.ri-vertical #X { ... !important }` e as daqui
 * precisam vencer as que redeclaram — mesma especificidade mais um elo
 * (`html.ri-vertical.ri-premium`) ja vence, e a ordem desempata o resto.
 *
 * @returns {boolean} se o estilo esta no documento agora
 */
export function garantirCssDoDocumento(doc) {
	const d = doc || (typeof document !== 'undefined' ? document : null);
	if (!d || !d.head || !ehHudPremium()) {
		return false;
	}
	if (d.head.querySelector('style[' + ATRIBUTO_DO_DOCUMENTO + ']')) {
		return true;
	}
	const estilo = d.createElement('style');
	estilo.setAttribute(ATRIBUTO_DO_DOCUMENTO, '');
	estilo.textContent = tokensCss + '\n' + documentoCss;
	d.head.appendChild(estilo);
	return true;
}

/**
 * Injeta o pedaco premium no shadow de um componente, DEPOIS do CSS dele.
 *
 * Chamado pelo `GUIComponent._prepare` logo apos o `<style data-component>`.
 * Idempotente: um segundo `prepare` do mesmo shadow nao duplica o estilo.
 */
export function injetarNoShadow(shadow, nome) {
	/* A decisao e "este componente faz parte da camada?", e nao "o texto e
	   vazio?": o vitest entrega `?raw` de CSS como string vazia, e o portao
	   tem de medir a mesma regra que o jogo segue. */
	if (!shadow || !ehHudPremium() || !Object.prototype.hasOwnProperty.call(CSS_POR_COMPONENTE, nome)) {
		return false;
	}
	const css = CSS_POR_COMPONENTE[nome];
	if (shadow.querySelector('style[' + ATRIBUTO_DO_DOCUMENTO + ']')) {
		return true;
	}
	const estilo = document.createElement('style');
	estilo.setAttribute(ATRIBUTO_DO_DOCUMENTO, nome);
	estilo.textContent = css;
	shadow.appendChild(estilo);
	return true;
}

export default {
	MARCA_PREMIUM,
	MARCA_COM_ATALHOS,
	barraDeAtalhosLigada,
	definirBarraDeAtalhos,
	ehHudPremium,
	cssDoComponente,
	componentesComCss,
	garantirCssDoDocumento,
	injetarNoShadow
};
