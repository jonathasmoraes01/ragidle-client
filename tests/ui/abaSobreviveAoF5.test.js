/**
 * "FECHOU EM ALVOS, VOLTA PARA ALVOS" — a prova de ponta a ponta (D-797).
 *
 * `memoriaDeAba.test.js` mede as peças e o portão. Este mede o PEDIDO, com a
 * janela real: monta a `Configuração idle` com o HTML de verdade, clica na aba
 * "Alvos", joga fora o módulo inteiro (que é o que o F5 faz) e monta de novo.
 *
 * Os dois casos separados existem porque as duas metades falham por motivos
 * diferentes: gravar sem restaurar, e restaurar sem acender o botão. A segunda
 * é a que ninguém testa e o jogador vê primeiro — a lista certa embaixo do
 * rótulo errado.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('Network/NetworkManager.js', () => ({
	default: { sendPacket: vi.fn(), hookPacket: vi.fn() }
}));
vi.mock('Renderer/Renderer.js', () => ({ default: { render: vi.fn(), stop: vi.fn(), width: 1280, height: 720 } }));
vi.mock('UI/UIManager.js', () => ({ default: { showErrorBox: vi.fn(), addComponent: c => c } }));
vi.mock('UI/Components/ChatBox/ChatBox.js', () => ({
	default: { addText: vi.fn(), TYPE: { ERROR: 1 }, FILTER: { PUBLIC_LOG: 1 } }
}));

/**
 * Monta a janela como o jogo monta: HTML REAL do componente, `init()` de
 * verdade. Um esqueleto escrito à mão mentiria assim que a janela ganhasse um
 * nó novo — a razão já registrada em `estadoEntrePersonagensEMapas.test.js`.
 *
 * `draggable` é o único ponto trocado: ela é do `GUIComponent` e depende de
 * layout que o jsdom não tem. Nada do que este caso mede passa por ela.
 */
async function montarJanela() {
	const { default: html } = await import('UI/Components/IdleConfig/IdleConfig.html?raw');
	const { default: IdleConfig } = await import('UI/Components/IdleConfig/IdleConfig.js');

	IdleConfig._host = document.createElement('div');
	IdleConfig._host.innerHTML = html;
	IdleConfig._shadow = null;
	IdleConfig.draggable = () => {};
	IdleConfig.init();

	return IdleConfig;
}

/** A aba acesa, lida do DOM — não do estado do módulo. */
function abaAcesa(IdleConfig) {
	const acesa = IdleConfig._host.querySelector('.ic-tab.is-active');
	return acesa && acesa.dataset.tab;
}

describe('a Configuração idle abre na aba em que o jogador a fechou', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.resetModules();
	});

	it('sem escolha nenhuma, abre na Caçada', async () => {
		const IdleConfig = await montarJanela();
		expect(IdleConfig.activeTab).toBe('caca');
		expect(abaAcesa(IdleConfig)).toBe('caca');
	});

	it('clicar em Suporte grava a escolha', async () => {
		const IdleConfig = await montarJanela();
		IdleConfig._host.querySelector('.ic-tab[data-tab="suporte"]').click();

		expect(IdleConfig.activeTab).toBe('suporte');
		expect(JSON.parse(localStorage.getItem('IdleConfig')).aba).toBe('suporte');
	});

	it('depois do F5, volta em Suporte — estado E botão aceso', async () => {
		const antes = await montarJanela();
		antes._host.querySelector('.ic-tab[data-tab="suporte"]').click();

		// O F5: o módulo morre e é carregado de novo. O `localStorage` fica.
		vi.resetModules();
		const depois = await montarJanela();

		expect(depois.activeTab, 'a janela esqueceu a aba').toBe('suporte');
		expect(abaAcesa(depois), 'a aba certa está aberta com o botão errado aceso').toBe('suporte');
	});

	it('abrir pelo medalhão de skills também conta como "eu estava lá"', async () => {
		// `abrirNaAba` é a porta que o CombatCornerIdle usa. Quem entra por ela
		// vai FECHAR a janela dali, e "a última aba em que eu estava" é essa.
		const antes = await montarJanela();
		antes.abrirNaAba('ataque');

		vi.resetModules();
		const depois = await montarJanela();

		expect(depois.activeTab).toBe('ataque');
	});

	it('o id ANTIGO de uma aba (gravado antes do redesenho, D-903) cai na seção que herdou o conteúdo', async () => {
		// Quem fechou a janela em "Alvos" ontem abre hoje na Caçada, onde as
		// presas moram agora — e não na aba padrão por "id desconhecido".
		localStorage.setItem('IdleConfig', JSON.stringify({ x: null, y: null, aba: 'alvos', _version: 1.0 }));

		const IdleConfig = await montarJanela();

		expect(IdleConfig.activeTab).toBe('caca');
		expect(abaAcesa(IdleConfig)).toBe('caca');

		// E a porta antiga do dock ('skills') abre a seção de Ataque.
		IdleConfig.abrirNaAba('skills');
		expect(IdleConfig.activeTab).toBe('ataque');
		expect(abaAcesa(IdleConfig)).toBe('ataque');
	});

	it('uma aba que não existe mais no HTML cai na Caçada, e não em aba nenhuma', async () => {
		localStorage.setItem('IdleConfig', JSON.stringify({ x: null, y: null, aba: 'aposentada', _version: 1.0 }));

		const IdleConfig = await montarJanela();

		expect(IdleConfig.activeTab).toBe('caca');
		expect(abaAcesa(IdleConfig), 'a janela abriu sem nenhuma aba acesa').toBe('caca');
	});

	it('a posição salva por quem já jogava sobrevive à chegada da chave `aba`', async () => {
		// O `localStorage` no formato ANTIGO — só x/y. É o que está gravado na
		// máquina de quem já jogava, e é o que uma subida de `version` apagaria.
		localStorage.setItem('IdleConfig', JSON.stringify({ x: 200, y: 100, _version: 1.0 }));

		const IdleConfig = await montarJanela();
		IdleConfig.onAppend();

		expect(IdleConfig._host.style.left).toBe('200px');
		expect(IdleConfig._host.style.top).toBe('100px');
		expect(IdleConfig.activeTab).toBe('caca');
	});
});

/**
 * A segunda janela, de propósito: o mecanismo tem de ser o MESMO, e a de Missões
 * tem uma pergunta que a Configuração idle não tem — a troca de personagem.
 *
 * `limparEstadoDoPersonagem` devolvia a aba a 'principais' junto com o dado do
 * personagem. Aba não é dado de personagem: é a escolha da PESSOA, e vale para
 * os personagens dela todos.
 */
async function montarMissoes() {
	const { default: html } = await import('UI/Components/MissoesIdle/MissoesIdle.html?raw');
	const { default: MissoesIdle } = await import('UI/Components/MissoesIdle/MissoesIdle.js');

	MissoesIdle._host = document.createElement('div');
	MissoesIdle._host.innerHTML = html;
	MissoesIdle._shadow = null;
	MissoesIdle.draggable = () => {};
	MissoesIdle.init();

	return MissoesIdle;
}

describe('a janela de Missões abre na aba em que o jogador a fechou', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.resetModules();
	});

	it('clicar em Opcionais sobrevive ao F5', async () => {
		const antes = await montarMissoes();
		antes._host.querySelector('.mi-tab[data-tab="opcionais"]').click();
		expect(antes.activeTab).toBe('opcionais');

		vi.resetModules();
		const depois = await montarMissoes();

		expect(depois.activeTab).toBe('opcionais');
		expect(depois._host.querySelector('.mi-tab.is-active').dataset.tab).toBe('opcionais');
	});

	it('trocar de personagem NÃO esquece a aba', async () => {
		const MissoesIdle = await montarMissoes();
		MissoesIdle._host.querySelector('.mi-tab[data-tab="opcionais"]').click();

		// O que o `cleanGameUI()` chama na volta ao menu de personagem.
		MissoesIdle.limparEstadoDoPersonagem();

		expect(MissoesIdle.missoes, 'o dado do personagem anterior ficou').toEqual([]);
		expect(MissoesIdle.activeTab, 'a aba foi zerada junto com o dado').toBe('opcionais');
	});
});
