/**
 * A BARRA CLASSICA DE SKILLS NUNCA MAIS ABRE (F1/T1, 21/09/2026 - D-1671).
 *
 * Pedido do dono: *"Remova completamente a abertura da barra classica de
 * skills. Ela nao deve aparecer no primeiro login, nos seguintes, apos
 * recarregar, reconectar, trocar de mapa, restaurar preferencias ou acionar
 * atalhos."*
 *
 * A janela e a `SkillListV2` (fabrica em `SkillListCommon.js`). Ela era
 * anexada a cada troca de mapa e so se escondia se `!_preferences.show` - e
 * `onRemove` gravava `show = ui.is(':visible')`, entao quem a viu UMA vez a
 * reabria para sempre, em todo login e em toda troca de mapa.
 *
 * Este arquivo EXECUTA o componente de verdade (a fabrica, o HTML da V2 e o
 * GUIComponent) em jsdom, com o resto do cliente mockado no minimo, e cobre
 * os seis caminhos que o dono citou. O CONTROLE no fim prova que o selo e
 * opt-in: a fabrica sem ele (a dos SkillListMH) continua obedecendo a
 * preferencia - senao "escondida" poderia ser so o jsdom sem layout.
 *
 * `is(':visible')` do proxy NAO serve aqui: ele consulta `offsetParent`, que
 * o jsdom devolve sempre `null`. A medida e o `display` inline do host, que e
 * exatamente o que `ui.show()`/`ui.hide()` escrevem.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ idleToggle: vi.fn() }));

vi.mock('UI/Elements/Elements.js', () => ({}));
vi.mock('Core/Client.js', () => ({ default: { loadFile: vi.fn() } }));
vi.mock('DB/DBManager.js', () => ({ default: { INTERFACE_PATH: '' } }));
vi.mock('Controls/MouseEventHandler.js', () => ({ default: { screen: { x: 0, y: 0 }, intersect: true } }));
vi.mock('Renderer/Renderer.js', () => ({
	default: { width: 1920, height: 1080, render: vi.fn(), stop: vi.fn(), vsync: [] }
}));
vi.mock('Engine/SessionStorage.js', () => ({ default: { Entity: null, FreezeUI: false } }));
vi.mock('UI/Components/SkillDescription/SkillDescription.js', () => ({
	default: { uid: null, append: vi.fn(), remove: vi.fn(), setSkill: vi.fn() }
}));
vi.mock('DB/Skills/SkillInfo.js', () => ({ default: {} }));
vi.mock('UI/Components/SkillTargetSelection/SkillTargetSelection.js', () => ({
	default: { TYPE: { SELF: 1, TARGET: 2 }, append: vi.fn(), set: vi.fn() }
}));
vi.mock('DB/Skills/SkillTreeView.js', () => ({ default: {} }));
vi.mock('UI/escalaDaHud.js', () => ({ ehDedo: () => false, emUnidadesDaHud: (x) => x, default: {} }));
vi.mock('UI/UIManager.js', () => ({
	default: {
		addComponent: (c) => c,
		getComponent: (nome) => {
			if (nome === 'IdleSkills') return { toggle: mocks.idleToggle };
			throw new Error(`componente desconhecido: ${nome}`);
		}
	}
}));

const CHAVE = 'SkillListV2';
/** O que a maquina de quem ja abriu a janela uma vez guardava (versao 1.0). */
const PREF_ABERTA_V1 = { _version: 1, x: 100, y: 200, width: 8, height: 8, show: true, mini: true, skillInfo: false };

function gravar(chave, pref) {
	localStorage.setItem(chave, JSON.stringify(pref));
}
function lido(chave = CHAVE) {
	return JSON.parse(localStorage.getItem(chave));
}

/**
 * A preferencia e lida no IMPORT do modulo (`Preferences.get` roda dentro de
 * `createSkillList`), entao cada cenario recarrega o modulo - e o que um
 * recarregar de pagina faz.
 */
async function carregarJanela() {
	vi.resetModules();
	const { default: SkillListV2 } = await import('UI/Components/SkillList/SkillListV2/SkillListV2.js');
	return SkillListV2;
}

beforeEach(() => {
	localStorage.clear();
	document.body.innerHTML = '';
	mocks.idleToggle.mockClear();
});

describe('a barra classica de skills (SkillListV2) nunca abre', () => {
	it('1o login: sem nada gravado, anexar deixa a janela escondida', async () => {
		const Janela = await carregarJanela();
		Janela.prepare();
		Janela.append();
		expect(Janela._host.style.display).toBe('none');
	});

	it('logins seguintes / recarregar: o show:true gravado pela versao antiga NAO reabre e e DESCARTADO', async () => {
		gravar(CHAVE, PREF_ABERTA_V1);
		const Janela = await carregarJanela();
		Janela.prepare();
		Janela.append();
		expect(Janela._host.style.display).toBe('none');
		const salvo = lido();
		expect(salvo.show).toBe(false);
		// A versao subiu: e ela que joga fora o show:true de quem ja jogou.
		expect(salvo._version).not.toBe(1);
	});

	it('restaurar preferencias: show:true gravado NA VERSAO ATUAL tambem nao reabre', async () => {
		await carregarJanela(); // grava os defaults na versao de hoje
		const versaoAtual = lido()._version;
		gravar(CHAVE, { ...PREF_ABERTA_V1, _version: versaoAtual });
		const Janela = await carregarJanela();
		Janela.prepare();
		Janela.append();
		expect(Janela._host.style.display).toBe('none');
	});

	it('trocar de mapa / reconectar: remover e anexar de novo continua escondida, e NUNCA grava show:true', async () => {
		const Janela = await carregarJanela();
		Janela.prepare();
		Janela.append();
		// O pior caso: alguem forca o host visivel por fora antes da troca.
		Janela._host.style.display = '';
		Janela.remove();
		expect(lido().show).toBe(false);
		Janela.append();
		expect(Janela._host.style.display).toBe('none');
	});

	it('atalho de teclado (Alt+S -> onShortCut TOGGLE) e toggle() nao abrem a classica: vao para a janela Idle', async () => {
		const Janela = await carregarJanela();
		Janela.prepare();
		Janela.append();
		Janela.onShortCut({ cmd: 'TOGGLE' });
		expect(Janela._host.style.display).toBe('none');
		Janela.toggle();
		expect(Janela._host.style.display).toBe('none');
		expect(mocks.idleToggle).toHaveBeenCalledTimes(2);
	});

	it('o botao de level up (#lvlup_job) nao e mais jogado no document.body', async () => {
		const Janela = await carregarJanela();
		Janela.prepare();
		Janela.append();
		Janela.onLevelUp();
		expect(document.getElementById('lvlup_job')).toBeNull();
		expect(Janela._host.style.display).toBe('none');
	});

	it('a janela continua PREPARADA e recebendo dados (o ponto de skill do menu e a barra de atalhos leem dela)', async () => {
		const Janela = await carregarJanela();
		Janela.prepare();
		Janela.append();
		Janela.setPoints(3);
		expect(Janela.getRoot().querySelector('.skpoints_count').textContent).toBe('3');
		expect(typeof Janela.getSkillById).toBe('function');
	});
});

describe('CONTROLE: a fabrica SEM o selo continua obedecendo a preferencia (e o que os SkillListMH usam)', () => {
	it('show:true gravado ABRE a janela quando o selo nao esta ligado', async () => {
		gravar('JanelaDeProva', { ...PREF_ABERTA_V1 });
		vi.resetModules();
		const { createSkillList } = await import('UI/Components/SkillList/SkillListCommon.js');
		const Janela = createSkillList({
			name: 'JanelaDeProva',
			htmlText: '<div id="JanelaDeProva"><div class="titlebar"></div><div class="content"><table></table></div></div>',
			cssText: ''
		});
		Janela.prepare();
		Janela.append();
		expect(Janela._host.style.display).not.toBe('none');
	});
});
