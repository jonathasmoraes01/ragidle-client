/**
 * OS BUFFS EM COLUNA, AS MISSOES NO ICONE E O MENU QUE EMPURRA OS BUFFS (pedido do dono, 15/10/2026, HUD mobile
 * premium): *"os buffs ficam na lateral esquerda abaixo das missoes em uma fileira vertical, quando cheio ate se
 * aproximar do icone do chat, ele quebra a linha e comeca preenchendo ao lado la em cima (...) as quests devem
 * ficar por padrao minimizadas somente com o icone (...) e quando ele abre o menu, os icones dos buffs tambem
 * descam junto para nao ficar atras"*.
 *
 * O desenho e CSS, e a prova de tela (`scripts/foto-hud-premium.mjs`, variantes `premium`, `premium-buffs` e
 * `premium-menu`) mede e fotografa. Aqui se cobra o que quebraria calado: as duas medidas que a coluna usa (o
 * fundo das missoes e a altura do chat), a grade que quebra em colunas, as duas marcas no documento e o nascer
 * recolhido das missoes. Os componentes nao carregam em jsdom (o mesmo motivo dos outros portoes deles): a
 * costura e cobrada pelo texto.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = join(__dirname, '..', '..', 'src', 'UI');
const ler = (...partes) => readFileSync(join(src, ...partes), 'utf8').replace(/\r\n/g, '\n');
const tokens = ler('HudPremium', 'tokens.css');
const documento = ler('HudPremium', 'documento.css');
const buffs = ler('HudPremium', 'componentes', 'StatusIcons.css');
const missoes = ler('Components', 'MissoesTrackerIdle', 'MissoesTrackerIdle.js');
const menu = ler('Components', 'TopMenuIdle', 'TopMenuIdle.js');

describe('a coluna de buffs', () => {
	it('comeca logo abaixo do cartao de missoes, no fundo que ele publica', () => {
		expect(tokens).toMatch(/--m-buffs-topo: calc\(var\(--hud-missoes-fundo, [^;]+\) \+ 6px\);/);
		expect(documento).toMatch(
			/html\.ri-vertical\.ri-premium #StatusIcons \{[^}]*top: var\(--m-buffs-topo\) !important;[^}]*left: calc\(var\(--safe-esq, 0px\) \+ var\(--m-margem\)\) !important;/
		);
	});

	it('vai ate 8px acima do chat (aberto ou bolinha), pela altura que o chat publica - e para antes do FPS', () => {
		expect(tokens).toMatch(/--m-chat-alcance: calc\(var\(--m-acima-dos-atalhos\) \+ var\(--hud-chat-altura, var\(--m-chat-bolinha\)\)\);/);
		expect(tokens).toMatch(
			/--m-buffs-altura-max: calc\(\s*var\(--m-altura-util\) - var\(--m-buffs-topo\) - var\(--m-chat-alcance\) - 8px - var\(--m-reserva-do-fps, 0px\)\s*\);/
		);
	});

	it('e uma grade em COLUNA que quebra para o lado: tantas fileiras quantas cabem, colunas novas a direita', () => {
		expect(buffs).toMatch(/display: grid;/);
		expect(buffs).toMatch(/grid-auto-flow: var\(--m-buffs-fluxo, column\);/);
		expect(buffs).toMatch(/grid-template-rows: var\(--m-buffs-fileiras, repeat\(auto-fill, var\(--m-buff, 47px\)\)\);/);
		expect(buffs).toMatch(/max-height: max\(var\(--m-buff, 47px\), var\(--m-buffs-altura-max, 400px\)\);/);
	});
});

describe('o Menu aberto empurra os buffs para o rodape', () => {
	it('o TopMenuIdle poe e tira a marca do menu aberto no documento, com o mesmo gesto do leque', () => {
		expect(menu).toContain("export const MARCA_MENU_ABERTO = 'ri-menu-aberto';");
		expect(menu).toContain(
			'raizVertical.ownerDocument.documentElement.classList.toggle(MARCA_MENU_ABERTO, _lequeAberto);'
		);
		const remove = menu.slice(menu.indexOf('TopMenuIdle.onRemove = function'));
		expect(remove.slice(0, remove.indexOf('\n};'))).toContain(
			'document.documentElement.classList.remove(MARCA_MENU_ABERTO);'
		);
	});

	it('com a folha aberta os buffs descem: acima do chat aberto, ou ao lado da bolinha', () => {
		expect(documento).toMatch(
			/html\.ri-vertical\.ri-premium\.ri-menu-aberto #StatusIcons \{\s*top: auto !important;[^}]*bottom: calc\(var\(--m-chat-alcance\) \+ 8px \+ var\(--m-reserva-do-fps, 0px\)\) !important;/
		);
		expect(documento).toMatch(
			/html\.ri-vertical\.ri-premium\.ri-menu-aberto\.ri-chat-minimizado #StatusIcons \{\s*bottom: var\(--m-acima-dos-atalhos\) !important;\s*left: calc\(var\(--safe-esq, 0px\) \+ var\(--m-margem\) \+ var\(--m-chat-bolinha\) \+ 8px\) !important;/
		);
	});

	it('la eles correm em FILEIRA ate antes do grupo de acao, e quebram para cima', () => {
		const regra = tokens.match(/html\.ri-premium\.ri-menu-aberto \{([^}]*)\}/);
		expect(regra).not.toBeNull();
		expect(regra[1]).toMatch(/--m-buffs-fluxo: row;/);
		expect(regra[1]).toMatch(/--m-buffs-colunas: repeat\(auto-fill, 34px\);/);
		expect(regra[1]).toMatch(/--m-buffs-largura-max: calc\([\s\S]*var\(--m-coluna-de-caca\)/);
		expect(buffs).toMatch(/max-width: var\(--m-buffs-largura-max, none\);/);
	});
});

describe('as missoes', () => {
	it('nascem recolhidas no icone, na premium, uma vez por sessao', () => {
		expect(missoes).toMatch(
			/if \(!_padraoDoCelularAplicado\) \{\s*_padraoDoCelularAplicado = true;\s*if \(ehHudDeCelular\(\) && ehHudPremium\(\)\) \{\s*_recolhido = true;\s*pintarRecolhido\(\);/
		);
	});

	it('no celular em pe publicam o proprio fundo (em unidade da HUD), so quando ele muda', () => {
		expect(missoes).toMatch(/if \(ehHudDeCelular\(\)\) \{[^}]*publicarFundoNaVertical\(host\);\s*return;/);
		const corpo = missoes.slice(missoes.indexOf('function publicarFundoNaVertical'));
		expect(corpo).toContain('emUnidadesDaHud(caixa.bottom)');
		expect(corpo).toMatch(/if \(fundo === _fundoPublicado\) \{\s*return;/);
		expect(corpo).toContain("setProperty('--hud-missoes-fundo', fundo);");
	});
});
