/**
 * DOIS CLIQUES EM "APLICAR" GASTAM O RASCUNHO UMA VEZ SO (H09, auditoria 2 de
 * 22/09/2026).
 *
 * O lote do "Aplicar" leva `niveis` como DELTA do rascunho, e o servidor o
 * aplica por cima do nivel ATUAL, sem chave de idempotencia. O botao so se
 * apagava com o rascunho vazio, e o rascunho so zerava quando a resposta
 * chegava: dois toques dentro do RTT (o celular, a ponte WS) mandavam o mesmo
 * lote duas vezes, e com pontos livres para o dobro a habilidade subia o dobro.
 *
 * Aqui a janela de verdade, com os vizinhos pesados (WebGL, GRF, rede) falsos:
 * o que se mede e quantos `CZ_RAGIDLE_APRENDER` saem de dois cliques.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	enviados: [],
	ganchos: new Map()
}));

vi.mock('UI/GUIComponent.js', () => {
	class GUIComponent {
		constructor(name) {
			this.name = name;
			this._host = document.createElement('div');
			this._shadow = this._host;
		}
		draggable() {}
		focus() {}
	}
	GUIComponent.MouseMode = { CROSS: 0 };
	return { default: GUIComponent };
});
vi.mock('UI/UIManager.js', () => ({ default: { addComponent: componente => componente } }));
vi.mock('Renderer/Renderer.js', () => ({ default: { width: 1280, height: 720 } }));
vi.mock('Core/Preferences.js', () => ({
	default: { get: (_nome, padrao) => Object.assign({ save() {} }, padrao) }
}));
vi.mock('DB/Skills/SkillInfo.js', () => ({ default: {} }));
vi.mock('Network/NetworkManager.js', () => ({
	default: {
		hookPacket: (id, fn) => mocks.ganchos.set(id, fn),
		sendPacket: pkt => mocks.enviados.push(pkt)
	}
}));
vi.mock('Network/PacketStructure.js', () => {
	function RAGIDLE_APRENDER() {
		this.nome = 'RAGIDLE_APRENDER';
	}
	function RAGIDLE_PEDIR_SKILLS() {
		this.nome = 'RAGIDLE_PEDIR_SKILLS';
	}
	function RAGIDLE_PRIORIZAR() {
		this.nome = 'RAGIDLE_PRIORIZAR';
	}
	return {
		default: {
			CZ: { RAGIDLE_APRENDER, RAGIDLE_PEDIR_SKILLS, RAGIDLE_PRIORIZAR },
			ZC: { RAGIDLE_SKILLS: 'ZC_RAGIDLE_SKILLS' }
		}
	};
});
vi.mock('UI/hudVertical.js', () => ({ ehCelularEmPe: () => false }));
vi.mock('UI/Components/MissoesIdle/MissoesIdle.js', () => ({ default: {} }));
vi.mock('UI/toqueParaAtalho.js', () => ({ pegar: vi.fn(), pendente: () => null, assinar: vi.fn() }));

const { default: IdleSkills } = await import('UI/Components/IdleSkills/IdleSkills.js');

/** O payload do contrato v5, com UMA habilidade e pontos para o dobro do rascunho. */
function payload(extra) {
	return Object.assign(
		{
			v: 5,
			classe: 'Swordman',
			graus: [{ grau: 1, nomePt: 'Espadachim' }],
			pontos: 6,
			nivelBase: 20,
			nivelDeJob: 10,
			trava: { pontosPorGrau: [], gratis: [], cotaDoAprendiz: 0, cotaDoPrimeiro: null },
			skills: [
				{
					skillId: 'SM_BASH',
					nome: 'Golpe Fulminante',
					descricao: [],
					categoria: 'ativa',
					aprendido: 0,
					nivelMaximo: 10,
					mecanica: [],
					podeAprender: true,
					motivo: null,
					custo: 1,
					portada: true,
					semEfeitoDeCombate: false,
					naRotacao: null,
					motivoDaRotacao: null,
					preRequisitos: [],
					nivelBaseMinimo: 0,
					nivelClasseMinimo: 0,
					grau: 1,
					aceitaPeloMotor: true
				}
			]
		},
		extra || {}
	);
}

function receber(dados) {
	mocks.ganchos.get('ZC_RAGIDLE_SKILLS')({ json: JSON.stringify(dados) });
}

function aprenderes() {
	return mocks.enviados.filter(p => p.nome === 'RAGIDLE_APRENDER');
}

const root = () => IdleSkills._shadow;
const botaoAplicar = () => root().querySelector('.is-btn-aplicar');

describe('o "Aplicar" nao manda o mesmo lote duas vezes (H09)', () => {
	beforeEach(() => {
		vi.useRealTimers();
		mocks.enviados.length = 0;
		IdleSkills._shadow.innerHTML = IdleSkills.render();
		IdleSkills.limparEstadoDoPersonagem();
		IdleSkills.init();
		receber(payload());
		IdleSkills.rascunho = { SM_BASH: 3 };
		// O rodape so acende o botao quando redesenha; aqui ele e aceso a mao
		// antes de cada clique, e o que se mede e o que sai para a rede.
		botaoAplicar().disabled = false;
		mocks.enviados.length = 0;
	});

	it('o rascunho acende o botao (o controle: sem isto o resto nao mede nada)', () => {
		expect(IdleSkills.rascunho).toEqual({ SM_BASH: 3 });
		botaoAplicar().dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(aprenderes()).toHaveLength(1);
		expect(JSON.parse(aprenderes()[0].json).lote).toEqual([{ skillId: 'SM_BASH', niveis: 3 }]);
	});

	it('dois cliques antes da resposta mandam UM lote so, mesmo que o segundo chegue ao botao', () => {
		botaoAplicar().dispatchEvent(new MouseEvent('click', { bubbles: true }));
		// O botao apagado nao basta sozinho: o toque e o clique sintetizado do
		// celular, ou um redesenho do rodape no meio, entregam o segundo clique.
		botaoAplicar().disabled = false;
		botaoAplicar().dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(aprenderes(), 'o segundo clique gastou os pontos do rascunho de novo').toHaveLength(1);
	});

	it('enquanto espera, o botao fica apagado', () => {
		botaoAplicar().dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(botaoAplicar().disabled).toBe(true);
	});

	it('a resposta destrava: um rascunho novo aplica de novo', () => {
		botaoAplicar().dispatchEvent(new MouseEvent('click', { bubbles: true }));
		receber(Object.assign(payload(), { aplicado: true }));
		expect(IdleSkills.rascunho).toEqual({});
		IdleSkills.rascunho = { SM_BASH: 1 };
		botaoAplicar().disabled = false;
		botaoAplicar().dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(aprenderes()).toHaveLength(2);
	});

	it('a recusa tambem destrava, com o rascunho preservado para o jogador corrigir', () => {
		botaoAplicar().dispatchEvent(new MouseEvent('click', { bubbles: true }));
		receber(Object.assign(payload(), { aplicado: false, problemas: ['sem pontos'] }));
		expect(IdleSkills.rascunho).toEqual({ SM_BASH: 3 });
		expect(botaoAplicar().disabled).toBe(false);
		botaoAplicar().dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(aprenderes()).toHaveLength(2);
	});

	it('a resposta cancela o prazo: o prazo do lote velho nao solta o lote seguinte', () => {
		vi.useFakeTimers();
		botaoAplicar().dispatchEvent(new MouseEvent('click', { bubbles: true }));
		vi.advanceTimersByTime(6_000);
		receber(Object.assign(payload(), { aplicado: true }));
		IdleSkills.rascunho = { SM_BASH: 1 };
		botaoAplicar().disabled = false;
		botaoAplicar().dispatchEvent(new MouseEvent('click', { bubbles: true }));
		vi.advanceTimersByTime(5_000);
		botaoAplicar().disabled = false;
		botaoAplicar().dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(aprenderes(), 'o prazo do primeiro lote soltou o segundo no meio').toHaveLength(2);
		vi.useRealTimers();
	});

	it('sem resposta nenhuma, um prazo de seguranca destrava — o botao nao fica preso', () => {
		vi.useFakeTimers();
		botaoAplicar().dispatchEvent(new MouseEvent('click', { bubbles: true }));
		vi.advanceTimersByTime(10_000);
		expect(botaoAplicar().disabled).toBe(false);
		botaoAplicar().dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(aprenderes()).toHaveLength(2);
		vi.useRealTimers();
	});
});
