/**
 * O MODO "AUTOMATICO" DA POÇÃO (R16/C2-5, 14/09/2026).
 *
 * Contrato v1 do jr-C1 (`PocaoDoContrato`): `{ ligado, modo?: 'item_especifico'
 * | 'qualquer', itemId?, usarCom }` — `modo` ausente equivale a
 * 'item_especifico' (o comportamento manual de sempre, D-536). O servidor
 * declara a capacidade `pocaoAutomatica`; sem ela o controle NAO APARECE —
 * nada de botao que mente sobre o que o servidor desta build aceita.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ enviados: [] }));

vi.mock('Network/NetworkManager.js', () => ({
	default: { sendPacket: p => mocks.enviados.push(p), hookPacket: () => {} }
}));
vi.mock('Renderer/Renderer.js', () => ({ default: { render: () => {}, remove: () => {} } }));
vi.mock('Core/Preferences.js', () => ({
	default: { get: (_name, defaults) => ({ ...defaults, save: () => {} }), set: () => {} }
}));
vi.mock('UI/UIManager.js', () => ({
	default: { addComponent: c => c, getComponent: () => ({ name: '' }) }
}));
vi.mock('UI/Components/ChatBox/ChatBox.js', () => ({
	default: { addText: () => {}, TYPE: { ERROR: 1 }, FILTER: { PUBLIC_LOG: 1 } }
}));

const { default: htmlDoComponente } = await import('UI/Components/IdleConfig/IdleConfig.html?raw');
const { default: IdleConfig } = await import('UI/Components/IdleConfig/IdleConfig.js');

/** O contexto do servidor: um kit com uma poção por eixo, e a capacidade LIGADA. */
const CONTEXTO_COM_CAPACIDADE = {
	ehCidade: false,
	capacidades: { pocaoAutomatica: true, pocaoDeSp: true, sentarParaRecuperar: true },
	consumiveisDeCura: [
		{ itemId: 501, nome: 'Poção Vermelha', estoque: 200, curaHp: true, curaSp: false },
		{ itemId: 505, nome: 'Poção Azul', estoque: 200, curaHp: false, curaSp: true }
	]
};

const CONFIG_BASE = {
	descanso: { ligado: false, hpLigado: false, spLigado: false, hpAbaixo: 50, spAbaixo: 50, condicao: 'qualquer', levantarHp: 90, levantarSp: 90 },
	pocaoDeHp: { ligado: true, itemId: 501, usarCom: 50 },
	pocaoDeSp: { ligado: true, itemId: 505, usarCom: 50 }
};

/** O switch de "Automático" da poção de HP, depois de renderBody(). */
function switchAutomaticoHp() {
	return IdleConfig.getRoot().querySelector('[data-modo-pocao="pocaoDeHp"]');
}

function selectDeHp() {
	return IdleConfig.getRoot().querySelector('[data-select="pocaoDeHp.itemId"]');
}

describe('o modo automático da poção — condicionado à capacidade', () => {
	beforeEach(() => {
		IdleConfig._host = document.createElement('div');
		IdleConfig._host.innerHTML = htmlDoComponente;
		IdleConfig._shadow = IdleConfig._host;
		IdleConfig.serverConfig = JSON.parse(JSON.stringify(CONFIG_BASE));
		IdleConfig.editConfig = JSON.parse(JSON.stringify(CONFIG_BASE));
	});

	it('SEM a capacidade, o controle "Automático" nao aparece — nada de botao que mente', () => {
		IdleConfig.contexto = { ...CONTEXTO_COM_CAPACIDADE, capacidades: { pocaoDeSp: true } };
		IdleConfig.abrirNaAba('sobrevivencia');

		expect(switchAutomaticoHp(), 'o controle apareceu sem a capacidade do servidor').toBeNull();
	});

	it('COM a capacidade, o controle aparece e ligar grava modo:"qualquer"', () => {
		IdleConfig.contexto = CONTEXTO_COM_CAPACIDADE;
		IdleConfig.abrirNaAba('sobrevivencia');

		const automatico = switchAutomaticoHp();
		expect(automatico, 'o controle nao apareceu com a capacidade ligada').not.toBeNull();
		expect(automatico.checked).toBe(false);

		automatico.checked = true;
		automatico.dispatchEvent(new Event('change', { bubbles: true }));

		expect(IdleConfig.editConfig.pocaoDeHp.modo).toBe('qualquer');
	});

	it('ligado, o <select> de item some/desativa — itemId nao importa mais', () => {
		IdleConfig.contexto = CONTEXTO_COM_CAPACIDADE;
		IdleConfig.abrirNaAba('sobrevivencia');

		switchAutomaticoHp().checked = true;
		switchAutomaticoHp().dispatchEvent(new Event('change', { bubbles: true }));

		const select = selectDeHp();
		expect(select.disabled || select.hidden, 'o select de item continua ativo em modo automatico').toBe(true);
	});

	it('desligar o automático volta para "item_especifico" com uma poção valida escolhida', () => {
		IdleConfig.contexto = CONTEXTO_COM_CAPACIDADE;
		IdleConfig.editConfig.pocaoDeHp.modo = 'qualquer';
		IdleConfig.abrirNaAba('sobrevivencia');

		const automatico = switchAutomaticoHp();
		expect(automatico.checked).toBe(true);

		automatico.checked = false;
		automatico.dispatchEvent(new Event('change', { bubbles: true }));

		expect(IdleConfig.editConfig.pocaoDeHp.modo).toBe('item_especifico');
		expect(IdleConfig.editConfig.pocaoDeHp.itemId).toBe(501);
	});

	it('Aplicar manda "modo" no payload, no contrato v1 do jr-C1', () => {
		IdleConfig.contexto = CONTEXTO_COM_CAPACIDADE;
		IdleConfig.editConfig.pocaoDeHp.modo = 'qualquer';
		IdleConfig.abrirNaAba('sobrevivencia');

		mocks.enviados.length = 0;
		IdleConfig.aplicarConfig();

		expect(mocks.enviados).toHaveLength(1);
		const enviado = JSON.parse(mocks.enviados[0].json);
		expect(enviado.pocaoDeHp.modo).toBe('qualquer');
		expect(enviado.pocaoDeHp.usarCom).toBe(50);
	});
});
